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
// INFO BOX
// ============================================================

const infoBox = document.querySelector('#object-info');
const infoTitle = document.querySelector('#object-info-title');
const infoText = document.querySelector('#object-info-text');
const infoLink = document.querySelector('#object-info-link');

function showInfo(object) {
  infoTitle.textContent = object.title;
  infoText.textContent = object.text;
  infoLink.href = object.href;

  infoBox.classList.remove('hidden');
}

function hideInfo() {
  infoBox.classList.add('hidden');
}


// ============================================================
// PHYSICS WORLD
// ============================================================

const world = new CANNON.World();

world.gravity.set(0, 0, 0);


// ============================================================
// OBJECT STORAGE
// ============================================================

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

  title: 'Projects',
  text: 'Stuff I have made.',
  href: './projects/',
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

  title: 'About Me',
  text: 'Who is this strange little man?',
  href: './about/',
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
    1,
    1,
    2.5,
    16
  ),

  position: new CANNON.Vec3(4, 1, 0),
});

world.addBody(cylinderBody);

objects.push({
  mesh: cylinderMesh,
  body: cylinderBody,

  title: 'Map Game',
  text: 'My geography game.',
  href: './MaptapClone/',
});


// ============================================================
// OBJECT PHYSICS SETTINGS
// ============================================================

for (const object of objects) {

  object.body.linearFactor.set(1, 1, 0);

  object.body.angularFactor.set(1, 1, 1);

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

  walls = [
    left,
    right,
    top,
    bottom
  ];

  walls.forEach(
    wall => world.addBody(wall)
  );
}

rebuildWalls();


// ============================================================
// DRAGGING + CLICK DETECTION
// ============================================================

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const dragPlane = new THREE.Plane(
  new THREE.Vector3(0, 0, 1),
  0
);

let selected = null;

const pointerStart = new THREE.Vector2();

let wasDragged = false;

const dragThreshold = 6;


// ============================================================
// MOUSE PHYSICS BODY
// ============================================================

const mouseBody = new CANNON.Body({
  mass: 0,
  type: CANNON.Body.KINEMATIC,
});

world.addBody(mouseBody);

let mouseConstraint = null;


// ============================================================
// MOUSE POSITION
// ============================================================

function updateMouse(event) {

  mouse.x =
    (event.clientX / window.innerWidth) * 2 - 1;

  mouse.y =
    -(event.clientY / window.innerHeight) * 2 + 1;
}


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

  if (infoBox.contains(event.target)) {
    return;
  }

  updateMouse(event);

  raycaster.setFromCamera(mouse, camera);

  const hits = raycaster.intersectObjects(
    objects.map(object => object.mesh)
  );

  if (hits.length === 0) {

    hideInfo();

    selected = null;

    return;
  }

  const clickedMesh = hits[0].object;

  selected = objects.find(
    object => object.mesh === clickedMesh
  );

  pointerStart.set(
    event.clientX,
    event.clientY
  );

  wasDragged = false;

  document.body.style.cursor = 'grabbing';
});


// ============================================================
// POINTER MOVE
// ============================================================

window.addEventListener('pointermove', event => {

  updateMouse(event);

  if (!selected) {

    raycaster.setFromCamera(mouse, camera);

    const hits = raycaster.intersectObjects(
      objects.map(object => object.mesh)
    );

    document.body.style.cursor =
      hits.length > 0
        ? 'grab'
        : 'default';

    return;
  }


  const distanceMoved = Math.hypot(
    event.clientX - pointerStart.x,
    event.clientY - pointerStart.y
  );


  // Start dragging only after the cursor has moved enough.

  if (
    !wasDragged &&
    distanceMoved > dragThreshold
  ) {

    wasDragged = true;

    hideInfo();

    const mousePosition =
      getMouseWorldPosition();

    mouseBody.position.set(
      mousePosition.x,
      mousePosition.y,
      0
    );

    mouseConstraint =
      new CANNON.PointToPointConstraint(
        selected.body,

        new CANNON.Vec3(0, 0, 0),

        mouseBody,

        new CANNON.Vec3(0, 0, 0)
      );

    world.addConstraint(
      mouseConstraint
    );

    selected.body.wakeUp();
  }


  if (wasDragged) {

    const position =
      getMouseWorldPosition();

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

  const releasedObject = selected;

  if (mouseConstraint) {

    world.removeConstraint(
      mouseConstraint
    );

    mouseConstraint = null;
  }


  if (
    releasedObject &&
    !wasDragged
  ) {

    showInfo(
      releasedObject
    );
  }


  selected = null;

  wasDragged = false;

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

  world.step(
    1 / 60,
    delta,
    3
  );

  for (const object of objects) {

    object.mesh.position.copy(
      object.body.position
    );

    object.mesh.quaternion.copy(
      object.body.quaternion
    );
  }

  renderer.render(
    scene,
    camera
  );
}

animate();