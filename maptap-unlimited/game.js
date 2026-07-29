import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const EARTH_RADIUS = 1;
const EARTH_TEXTURE = 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg';
const MAX_ROUND_SCORE = 5000;

const ui = {
  canvas: document.querySelector('#globe'),
  loading: document.querySelector('#loading'),
  targetName: document.querySelector('#target-name'),
  targetMeta: document.querySelector('#target-meta'),
  roundValue: document.querySelector('#round-value'),
  totalScore: document.querySelector('#total-score'),
  avgScore: document.querySelector('#avg-score'),
  guessCard: document.querySelector('#guess-card'),
  guessCoords: document.querySelector('#guess-coords'),
  resultCard: document.querySelector('#result-card'),
  distanceValue: document.querySelector('#distance-value'),
  roundScore: document.querySelector('#round-score'),
  resultCopy: document.querySelector('#result-copy'),
  guessBtn: document.querySelector('#guess-btn'),
  nextBtn: document.querySelector('#next-btn'),
  resetBtn: document.querySelector('#reset-btn'),
  continentFilter: document.querySelector('#continent-filter'),
  difficultyFilter: document.querySelector('#difficulty-filter'),
  poolSize: document.querySelector('#pool-size'),
};

const state = {
  allLocations: [],
  pool: [],
  target: null,
  guess: null,
  round: 0,
  totalScore: 0,
  completedRounds: 0,
  locked: false,
  previousId: null,
};

// ---------- THREE.JS SETUP ----------

const renderer = new THREE.WebGLRenderer({
  canvas: ui.canvas,
  antialias: true,
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050912);

const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
camera.position.set(0, 0.22, 2.75);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.rotateSpeed = 0.52;
controls.zoomSpeed = 0.85;
controls.minDistance = 1.28;
controls.maxDistance = 4.6;
controls.target.set(0, 0, 0);

scene.add(new THREE.AmbientLight(0xffffff, 1.35));
const sun = new THREE.DirectionalLight(0xffffff, 2.3);
sun.position.set(3.5, 2.5, 4.5);
scene.add(sun);

const earthGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 128, 96);
const earthMaterial = new THREE.MeshStandardMaterial({
  color: 0x416a8a,
  roughness: 0.82,
  metalness: 0.0,
});
const earth = new THREE.Mesh(earthGeometry, earthMaterial);
scene.add(earth);

new THREE.TextureLoader().load(
  EARTH_TEXTURE,
  (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    earthMaterial.map = texture;
    earthMaterial.needsUpdate = true;
  },
  undefined,
  (error) => {
    console.warn('Earth texture failed to load. Using fallback globe material.', error);
  }
);

// A subtle atmospheric rim.
const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_RADIUS * 1.025, 96, 64),
  new THREE.MeshBasicMaterial({
    color: 0x5aaeff,
    transparent: true,
    opacity: 0.065,
    side: THREE.BackSide,
    depthWrite: false,
  })
);
scene.add(atmosphere);

addStarfield();

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let guessMarker = null;
let targetMarker = null;
let resultArc = null;

// Prevent an orbit-drag from also counting as a guess click.
let pointerDown = null;
renderer.domElement.addEventListener('pointerdown', (event) => {
  pointerDown = { x: event.clientX, y: event.clientY, button: event.button };
});
renderer.domElement.addEventListener('pointerup', (event) => {
  if (!pointerDown || pointerDown.button !== 0 || state.locked || !state.target) return;

  const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
  pointerDown = null;
  if (moved > 6) return;

  placeGuessFromPointer(event);
});

window.addEventListener('resize', resize);
resize();
renderer.setAnimationLoop(animate);

// ---------- DATA ----------

async function loadLocations() {
  const response = await fetch('./data/locations.csv');
  if (!response.ok) throw new Error(`Could not load locations.csv (${response.status})`);

  const text = await response.text();
  const rows = parseCSV(text);

  state.allLocations = rows
    .map((row) => ({
      ...row,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      difficulty_level: row.difficulty_level ? Number(row.difficulty_level) : null,
    }))
    .filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude) && row.city);

  const continents = [...new Set(state.allLocations.map((x) => x.continent).filter(Boolean))].sort();
  for (const continent of continents) {
    const option = document.createElement('option');
    option.value = continent;
    option.textContent = continent.replaceAll('_', ' ');
    ui.continentFilter.append(option);
  }

  applyFilters();
  resetGame();
  ui.loading.classList.add('hidden');
}

function parseCSV(text) {
  // Small RFC-4180-ish parser so quoted commas in source_name do not break rows.
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"' && quoted && next === '"') {
      field += '"';
      i++;
    } else if (c === '"') {
      quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && next === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((v) => v.length)) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const headers = rows.shift().map((h) => h.replace(/^\uFEFF/, '').trim());
  return rows.map((values) => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));
}

function applyFilters() {
  const continent = ui.continentFilter.value;
  const difficulty = ui.difficultyFilter.value;

  state.pool = state.allLocations.filter((location) => {
    const continentOK = continent === 'all' || location.continent === continent;
    const difficultyOK = difficulty === 'all' || location.difficulty === difficulty;
    return continentOK && difficultyOK;
  });

  ui.poolSize.textContent = `${state.pool.length.toLocaleString()} locations`;
}

// ---------- GAME ----------

function resetGame() {
  state.round = 0;
  state.totalScore = 0;
  state.completedRounds = 0;
  state.previousId = null;
  startRound();
}

function startRound() {
  clearRoundVisuals();
  state.locked = false;
  state.guess = null;
  state.round += 1;

  state.target = pickRandomTarget();
  if (!state.target) {
    ui.targetName.textContent = 'No locations match';
    ui.targetMeta.textContent = 'Change the filters below.';
    ui.guessBtn.disabled = true;
    return;
  }

  state.previousId = state.target.source_id;
  ui.targetName.textContent = formatLocation(state.target);
  ui.targetMeta.textContent = 'Click the globe, then lock your guess.';
  ui.roundValue.textContent = state.round.toLocaleString();
  ui.totalScore.textContent = state.totalScore.toLocaleString();
  ui.avgScore.textContent = state.completedRounds
    ? Math.round(state.totalScore / state.completedRounds).toLocaleString()
    : '—';

  ui.guessBtn.disabled = true;
  ui.guessBtn.classList.remove('hidden');
  ui.nextBtn.classList.add('hidden');
  ui.guessCard.classList.add('hidden');
  ui.resultCard.classList.add('hidden');
}

function pickRandomTarget() {
  if (!state.pool.length) return null;
  if (state.pool.length === 1) return state.pool[0];

  let target;
  do {
    target = state.pool[Math.floor(Math.random() * state.pool.length)];
  } while (target.source_id === state.previousId);
  return target;
}

function placeGuessFromPointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(earth, false)[0];
  if (!hit) return;

  // Earth itself is not rotated, so world-space and globe-space are identical here.
  const coords = vectorToLatLon(hit.point.clone().normalize());
  state.guess = coords;

  setGuessMarker(coords.latitude, coords.longitude);
  ui.guessCoords.textContent = `${formatCoordinate(coords.latitude, 'N', 'S')} · ${formatCoordinate(coords.longitude, 'E', 'W')}`;
  ui.guessCard.classList.remove('hidden');
  ui.guessBtn.disabled = false;
}

function lockGuess() {
  if (!state.guess || state.locked || !state.target) return;
  state.locked = true;

  const distance = haversineKm(
    state.guess.latitude,
    state.guess.longitude,
    state.target.latitude,
    state.target.longitude
  );

  const score = scoreFromDistance(distance);
  state.totalScore += score;
  state.completedRounds += 1;

  setTargetMarker(state.target.latitude, state.target.longitude);
  drawResultArc(state.guess, state.target);

  ui.distanceValue.textContent = formatDistance(distance);
  ui.roundScore.textContent = score.toLocaleString();
  ui.resultCopy.textContent = `Target: ${formatLocation(state.target)} · ${formatCoordinate(state.target.latitude, 'N', 'S')} · ${formatCoordinate(state.target.longitude, 'E', 'W')}`;
  ui.resultCard.classList.remove('hidden');

  ui.totalScore.textContent = state.totalScore.toLocaleString();
  ui.avgScore.textContent = Math.round(state.totalScore / state.completedRounds).toLocaleString();
  ui.guessBtn.classList.add('hidden');
  ui.nextBtn.classList.remove('hidden');

  frameResult(state.guess, state.target);
}

function scoreFromDistance(distanceKm) {
  // Intentionally simple, tweakable scoring curve:
  // 0 km = 5000, ~1730 km = 2500, and approaches zero at huge distances.
  return Math.max(0, Math.round(MAX_ROUND_SCORE * Math.exp(-distanceKm / 2500)));
}

function formatLocation(location) {
  const parts = [location.city];
  if (location.province_state_region) parts.push(location.province_state_region);
  if (location.country) parts.push(location.country);
  return parts.join(', ');
}

function clearRoundVisuals() {
  removeObject(guessMarker);
  removeObject(targetMarker);
  removeObject(resultArc);
  guessMarker = targetMarker = resultArc = null;
}

// ---------- GLOBE MATH ----------

function vectorToLatLon(v) {
  const latitude = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(v.y, -1, 1)));
  const longitude = THREE.MathUtils.radToDeg(Math.atan2(-v.z, v.x));
  return { latitude, longitude };
}

function latLonToVector(latitude, longitude, radius = EARTH_RADIUS) {
  const lat = THREE.MathUtils.degToRad(latitude);
  const lon = THREE.MathUtils.degToRad(longitude);
  const cosLat = Math.cos(lat);

  return new THREE.Vector3(
    radius * cosLat * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * cosLat * Math.sin(lon)
  );
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0088;
  const φ1 = THREE.MathUtils.degToRad(lat1);
  const φ2 = THREE.MathUtils.degToRad(lat2);
  const Δφ = THREE.MathUtils.degToRad(lat2 - lat1);
  const Δλ = THREE.MathUtils.degToRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------- VISUAL FEEDBACK ----------

function setGuessMarker(lat, lon) {
  removeObject(guessMarker);
  guessMarker = createMarker(lat, lon, 0xff747c, 0.024);
  scene.add(guessMarker);
}

function setTargetMarker(lat, lon) {
  removeObject(targetMarker);
  targetMarker = createMarker(lat, lon, 0x6ee7a8, 0.026);
  scene.add(targetMarker);
}

function createMarker(lat, lon, color, size) {
  const group = new THREE.Group();
  const p = latLonToVector(lat, lon, EARTH_RADIUS + 0.015);
  group.position.copy(p);

  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(size, 20, 14),
    new THREE.MeshBasicMaterial({ color, depthTest: true })
  );
  group.add(dot);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(size * 1.45, size * 2.15, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.58, side: THREE.DoubleSide, depthWrite: false })
  );
  // A RingGeometry faces +Z. Point it away from the globe's center.
  ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), p.clone().normalize());
  group.add(ring);

  return group;
}

function drawResultArc(guess, target) {
  removeObject(resultArc);

  const a = latLonToVector(guess.latitude, guess.longitude, 1).normalize();
  const b = latLonToVector(target.latitude, target.longitude, 1).normalize();
  const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1);
  const omega = Math.acos(dot);
  const points = [];
  const steps = 96;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let p;

    if (omega < 1e-6) {
      p = a.clone();
    } else {
      const sinOmega = Math.sin(omega);
      p = a.clone().multiplyScalar(Math.sin((1 - t) * omega) / sinOmega)
        .add(b.clone().multiplyScalar(Math.sin(t * omega) / sinOmega))
        .normalize();
    }

    const lift = 1.018 + 0.10 * Math.sin(Math.PI * t);
    points.push(p.multiplyScalar(lift));
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.78 });
  resultArc = new THREE.Line(geometry, material);
  scene.add(resultArc);
}

function frameResult(guess, target) {
  // Aim controls between both points. Camera distance grows for far-apart guesses.
  const a = latLonToVector(guess.latitude, guess.longitude, 1).normalize();
  const b = latLonToVector(target.latitude, target.longitude, 1).normalize();
  let midpoint = a.clone().add(b);
  if (midpoint.lengthSq() < 0.02) midpoint = a.clone();
  midpoint.normalize();

  const angularSeparation = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
  const desiredDistance = THREE.MathUtils.clamp(1.8 + angularSeparation * 0.75, 1.85, 3.8);

  // Keep the current camera side when possible, but gently reframe toward the pair.
  const direction = midpoint.clone();
  const desired = direction.multiplyScalar(desiredDistance);
  camera.position.lerp(desired, 0.34);
  controls.update();
}

function removeObject(object) {
  if (!object) return;
  scene.remove(object);
  object.traverse?.((child) => {
    child.geometry?.dispose?.();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else child.material.dispose?.();
    }
  });
}

function addStarfield() {
  const count = 1400;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const r = 18 + Math.random() * 42;
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    positions[i * 3] = r * s * Math.cos(theta);
    positions[i * 3 + 1] = r * u;
    positions[i * 3 + 2] = r * s * Math.sin(theta);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.025,
    transparent: true,
    opacity: 0.65,
    sizeAttenuation: true,
    depthWrite: false,
  });
  scene.add(new THREE.Points(geometry, material));
}

// ---------- UI ----------

ui.guessBtn.addEventListener('click', lockGuess);
ui.nextBtn.addEventListener('click', startRound);
ui.resetBtn.addEventListener('click', resetGame);

ui.continentFilter.addEventListener('change', () => {
  applyFilters();
  resetGame();
});
ui.difficultyFilter.addEventListener('change', () => {
  applyFilters();
  resetGame();
});

window.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.repeat) return;
  if (!state.locked && state.guess) lockGuess();
  else if (state.locked) startRound();
});

function formatCoordinate(value, positive, negative) {
  const suffix = value >= 0 ? positive : negative;
  return `${Math.abs(value).toFixed(2)}°${suffix}`;
}

function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${Math.round(km).toLocaleString()} km`;
}

function resize() {
  const width = renderer.domElement.clientWidth || window.innerWidth;
  const height = renderer.domElement.clientHeight || window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animate() {
  controls.update();
  renderer.render(scene, camera);
}

loadLocations().catch((error) => {
  console.error(error);
  ui.loading.textContent = 'Could not load locations.csv';
  ui.targetName.textContent = 'Load error';
  ui.targetMeta.textContent = 'Serve this folder over HTTP instead of opening index.html as file://.';
});
