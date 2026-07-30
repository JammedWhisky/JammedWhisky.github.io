// src/home.js

import './home.css';

import * as THREE from 'three';
import * as CANNON from 'cannon-es';


// ============================================================
// CANVAS
// ============================================================

const canvas = document.createElement('canvas');
canvas.id = 'home-bg';
document.body.appendChild(canvas);


// ============================================================
// THREE.JS SETUP
// ============================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f3ee);

const camera = new THREE.PerspectiveCamera(
  40,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);

camera.position.set(0, 0, 14);


const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);


// ============================================================
// LIGHTING
// ============================================================

const ambientLight = new THREE.AmbientLight(0xffffff, 2);

const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
directionalLight.position.set(-5, 8, 10);

scene.add(ambientLight, directionalLight);


// ============================================================
// PHYSICS WORLD
// ============================================================

const world = new CANNON.World();

// No gravity for now.
// Objects float around like a menu / desktop toybox.
world.gravity.set(0, 0, 0);


// ============================================================
// OBJECT STORAGE
// ============================================================

// Each entry connects:
//
// Three.js mesh  <-->  Cannon physics body
//
// Three renders it.
// Cannon decides where it actually is.

const objects = [];


// ============================================================
// OBJECT 1 — BOX
// ============================================================

const boxMesh = new THREE.Mesh(
  new THREE.BoxGeometry(2, 2, 2),
  new THREE.MeshStandardMaterial({
    color: 0xdf7f62,
    roughness: 0.6,
  })
);

scene.add(boxMesh);


const boxBody = new CANNON.Body({
  mass: 1,

  shape: new CANNON.Box(
    new CANNON.Vec3(1, 1, 1)
  ),

  position: new CANNON.Vec3(-4, 1, 0),
});

world.addBody(boxBody);

objects.push({
  mesh: boxMesh,
  body: boxBody,
});


// ============================================================
// OBJECT 2 — SPHERE
// ============================================================

const sphereMesh = new THREE.Mesh(
  new THREE.SphereGeometry(1.25, 32, 32),
  new THREE.MeshStandardMaterial({
    color: 0x7896c7,
    roughness: 0.5,
  })
);

scene.add(sphereMesh);


const sphereBody = new CANNON.Body({
  mass: 1,

  shape: new CANNON.Sphere(1.25),

  position: new CANNON.Vec3(0, -1, 0),
});

world.addBody(sphereBody);

objects.push({
  mesh: sphereMesh,
  body: sphereBody,
});


// ============================================================
// OBJECT 3 — CYLINDER
// ============================================================

const cylinderMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(1, 1, 2.5, 32),
  new THREE.MeshStandardMaterial({
    color: 0xd5b65d,
    roughness: 0.5,
  })
);

scene.add(cylinderMesh);


const cylinderBody = new CANNON.Body({
  mass: 1,

  shape: new CANNON.Cylinder(
    1,      // top radius
    1,      // bottom radius
    2.5,    // height
    16      // collision subdivisions
  ),

  position: new CANNON.Vec3(4, 1, 0),
});

world.addBody(cylinderBody);

objects.push({
  mesh: cylinderMesh,
  body: cylinderBody,
});


// ============================================================
// KEEP EVERYTHING MOSTLY IN A 2D PLANE
// ============================================================

for (const object of objects) {

  // Allow x/y motion, but not z motion.
  object.body.linearFactor.set(1, 1, 0);

  // Allow visible rotation.
  object.body.angularFactor.set(1, 1, 1);

  // Gradually lose energy.
  object.body.linearDamping = 0.15;
  object.body.angularDamping = 0.2;
}


// ============================================================
// SCREEN WALLS
// ============================================================

let walls = [];


function rebuildWalls() {

  for (const wall of walls) {
    world.removeBody(wall);
  }

  walls = [];


  // Convert the visible camera area into world dimensions.

  const distance = camera.position.z;

  const visibleHeight =
    2 *
    Math.tan(
      THREE.MathUtils.degToRad(camera.fov / 2)
    ) *
    distance;

  const visibleWidth =
    visibleHeight * camera.aspect;


  const thickness = 1;

  const left = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(
      new CANNON.Vec3(
        thickness,
        visibleHeight,
        5
      )
    ),
    position: new CANNON.Vec3(
      -visibleWidth / 2 - thickness,
      0,
      0
    ),
  });


  const right = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(
      new CANNON.Vec3(
        thickness,
        visibleHeight,
        5
      )
    ),
    position: new CANNON.Vec3(
      visibleWidth / 2 + thickness,
      0,
      0
    ),
  });


  const top = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(
      new CANNON.Vec3(
        visibleWidth,
        thickness,
        5
      )
    ),
    position: new CANNON.Vec3(
      0,
      visibleHeight / 2 + thickness,
      0
    ),
  });


  const bottom = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(
      new CANNON.Vec3(
        visibleWidth,
        thickness,
        5
      )
    ),
    position: new CANNON.Vec3(
      0,
      -visibleHeight / 2 - thickness,
      0
    ),
  });


  walls = [left, right, top, bottom];

  walls.forEach(wall => world.addBody(wall));
}


rebuildWalls();


// ============================================================
// DRAGGING
// ============================================================

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();


// Invisible mathematical plane corresponding to z = 0.
//
// We raycast the mouse onto this plane to determine where
// the dragged physics object should go.

const dragPlane = new THREE.Plane(
  new THREE.Vector3(0, 0, 1),
  0
);


let selected = null;


// This is an invisible physics body controlled by the mouse.
//
// Instead of teleporting the selected object directly,
// we attach the object to this body with a constraint.
//
// That allows Cannon to preserve actual physics.

const mouseBody = new CANNON.Body({
  mass: 0,
  type: CANNON.Body.KINEMATIC,
});

world.addBody(mouseBody);


let mouseConstraint = null;


// ------------------------------------------------------------
// Convert browser mouse coordinates into normalized Three coords
// ------------------------------------------------------------

function updateMouse(event) {

  mouse.x =
    (event.clientX / window.innerWidth) * 2 - 1;

  mouse.y =
    -(event.clientY / window.innerHeight) * 2 + 1;

}


// ------------------------------------------------------------
// Convert cursor position into x/y coordinates in our 3D scene
// ------------------------------------------------------------

function getMouseWorldPosition() {

  raycaster.setFromCamera(mouse, camera);

  const position = new THREE.Vector3();

  raycaster.ray.intersectPlane(
    dragPlane,
    position
  );

  return position;
}


// ============================================================
// POINTER DOWN
// ============================================================

window.addEventListener('pointerdown', event => {

  updateMouse(event);

  raycaster.setFromCamera(mouse, camera);


  const meshes = objects.map(object => object.mesh);

  const hits = raycaster.intersectObjects(meshes);


  if (hits.length === 0) {
    return;
  }


  const clickedMesh = hits[0].object;


  selected = objects.find(
    object => object.mesh === clickedMesh
  );


  const mousePosition = getMouseWorldPosition();


  mouseBody.position.set(
    mousePosition.x,
    mousePosition.y,
    0
  );


  // Create a temporary physical connection
  // between the mouse and the selected object.

  mouseConstraint = new CANNON.PointToPointConstraint(
    selected.body,

    new CANNON.Vec3(0, 0, 0),

    mouseBody,

    new CANNON.Vec3(0, 0, 0)
  );


  world.addConstraint(mouseConstraint);


  selected.body.wakeUp();

  document.body.style.cursor = 'grabbing';
});


// ============================================================
// POINTER MOVE
// ============================================================

window.addEventListener('pointermove', event => {

  updateMouse(event);


  // Hover cursor

  if (!selected) {

    raycaster.setFromCamera(mouse, camera);

    const hits = raycaster.intersectObjects(
      objects.map(object => object.mesh)
    );

    document.body.style.cursor =
      hits.length > 0 ? 'grab' : 'default';
  }


  // Dragging

  if (selected) {

    const position = getMouseWorldPosition();

    mouseBody.position.set(
      position.x,
      position.y,
      0
    );

    mouseBody.velocity.set(0, 0, 0);

  }

});


// ============================================================
// POINTER UP
// ============================================================

window.addEventListener('pointerup', () => {

  if (mouseConstraint) {

    world.removeConstraint(mouseConstraint);

    mouseConstraint = null;
  }

  selected = null;

  document.body.style.cursor = 'default';
});


// ============================================================
// WINDOW RESIZE
// ============================================================

window.addEventListener('resize', () => {

  camera.aspect =
    window.innerWidth /
    window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  rebuildWalls();
});


// ============================================================
// ANIMATION LOOP
// ============================================================

const clock = new THREE.Clock();


function animate() {

  requestAnimationFrame(animate);


  const delta = clock.getDelta();


  // Advance physics simulation.

  world.step(
    1 / 60,
    delta,
    3
  );


  // Cannon calculates positions.
  // Copy those positions into Three.js.

  for (const object of objects) {

    object.mesh.position.copy(
      object.body.position
    );

    object.mesh.quaternion.copy(
      object.body.quaternion
    );

  }


  renderer.render(scene, camera);

}


animate();