import * as THREE from './vendor/three.module.js';

document.getElementById('year').textContent = new Date().getFullYear();
const mount = document.getElementById('neural-canvas');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

try {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 18);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  mount.appendChild(renderer.domElement);

  const network = new THREE.Group();
  scene.add(network);
  const counts = [11, 9, 7, 5, 3];
  const layers = counts.map((count, layer) => Array.from({ length: count }, (_, index) => {
    const y = (index / (count - 1) - 0.5) * (5.2 - layer * 0.24);
    const z = Math.sin(index * 2.41 + layer * 1.77) * 0.72;
    return new THREE.Vector3((layer - 2) * 2.28, y, z);
  }));
  const edgePositions = [];
  for (let layer = 0; layer < layers.length - 1; layer++) {
    for (const from of layers[layer]) for (const to of layers[layer + 1]) {
      edgePositions.push(from.x, from.y, from.z, to.x, to.y, to.z);
    }
  }
  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
  network.add(new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: 0x77777d, transparent: true, opacity: 0.17, depthWrite: false })));

  const nodeGeometry = new THREE.SphereGeometry(0.047, 8, 8);
  const nodes = new THREE.InstancedMesh(nodeGeometry, new THREE.MeshBasicMaterial({ color: 0xb5b5bd }), counts.reduce((a, b) => a + b, 0));
  const dummy = new THREE.Object3D();
  let nodeIndex = 0;
  for (const layer of layers) for (const point of layer) {
    dummy.position.copy(point);
    dummy.updateMatrix();
    nodes.setMatrixAt(nodeIndex++, dummy.matrix);
  }
  network.add(nodes);

  const pulseGeometry = new THREE.SphereGeometry(0.08, 12, 12);
  const pulses = Array.from({ length: 17 }, (_, index) => {
    const mesh = new THREE.Mesh(pulseGeometry, new THREE.MeshBasicMaterial({ color: index % 4 === 0 ? 0xffffff : 0xc8c8d0, transparent: true, opacity: 0.9 }));
    mesh.visible = false;
    network.add(mesh);
    return { mesh, progress: ((index * 0.31) % 5) - 1, speed: 0.36 + (index % 5) * 0.035, route: layers.map(layer => Math.floor(Math.random() * layer.length)) };
  });
  const pointer = { x: 0, y: 0 };
  mount.addEventListener('pointermove', event => {
    const rect = mount.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    pointer.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  });
  mount.addEventListener('pointerleave', () => { pointer.x = 0; pointer.y = 0; });

  function resize() {
    const width = mount.clientWidth, height = mount.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = width < 500 ? 24 : width < 700 ? 21 : 18;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(mount);

  const clock = new THREE.Clock();
  let frameId;
  function draw() {
    frameId = requestAnimationFrame(draw);
    const delta = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    network.rotation.y += ((pointer.x * 0.1 + Math.sin(time * 0.12) * 0.08) - network.rotation.y) * 0.025;
    network.rotation.x += ((-pointer.y * 0.07 + Math.sin(time * 0.16) * 0.025) - network.rotation.x) * 0.025;
    for (const pulse of pulses) {
      pulse.progress += delta * pulse.speed;
      if (pulse.progress >= 4) {
        pulse.progress = -Math.random() * 1.2;
        pulse.route = layers.map(layer => Math.floor(Math.random() * layer.length));
      }
      const segment = Math.floor(pulse.progress);
      if (segment < 0) { pulse.mesh.visible = false; continue; }
      pulse.mesh.visible = true;
      const t = pulse.progress - segment;
      pulse.mesh.position.lerpVectors(layers[segment][pulse.route[segment]], layers[segment + 1][pulse.route[segment + 1]], t);
      pulse.mesh.material.opacity = Math.min(1, Math.min(t * 4, (1 - t) * 4) + 0.22);
      pulse.mesh.scale.setScalar(0.65 + Math.sin(t * Math.PI) * 0.65);
    }
    renderer.render(scene, camera);
  }
  if (!reduceMotion.matches) draw();
  else renderer.render(scene, camera);
  reduceMotion.addEventListener('change', event => {
    if (event.matches) { cancelAnimationFrame(frameId); renderer.render(scene, camera); }
    else { clock.getDelta(); draw(); }
  });
} catch (error) {
  console.warn('Neural visual could not be initialized:', error);
  mount.closest('.hero-visual').classList.add('no-webgl');
}
