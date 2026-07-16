/**
 * Vanilla three.js "studio" car stage. Built imperatively (no react-three-fiber,
 * which crashed under Next 15) and only ever imported client-side via ssr:false.
 *
 * A stylised low-poly car is assembled from primitive panels, each with a "home"
 * transform and an explode direction. The page feeds a single linear scroll
 * progress (0..1); internally we drive assemble → explode → reassemble with a
 * sine curve so the car is whole at the ends and blown apart in the middle, with
 * a gentle camera orbit throughout. Studio lighting + a RoomEnvironment PMREM map
 * give clean metal reflections that match the grey/white identity.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export interface CarStageHandle {
  setProgress: (p: number) => void;
  resize: () => void;
  start: () => void;
  stop: () => void;
  dispose: () => void;
}

interface Panel {
  mesh: THREE.Object3D;
  home: THREE.Vector3;
  baseRot: THREE.Euler; // resting orientation (raked glass etc.)
  dir: THREE.Vector3;   // explode direction (unit-ish), scaled by distance
  dist: number;         // how far it flies out
  spin: THREE.Vector3;  // extra rotation applied at full explode
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function createCarScene(canvas: HTMLCanvasElement): CarStageHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(4.6, 2.1, 6.4);
  camera.lookAt(0, 0.35, 0);

  // studio reflections
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  // lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8f96, 0.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(5, 8, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 30;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfe4ea, 1.1);
  rim.position.set(-6, 3, -4);
  scene.add(rim);

  // materials — clearcoat physical paint sells the showroom finish
  const paint = new THREE.MeshPhysicalMaterial({
    color: 0xc9ced4, metalness: 0.9, roughness: 0.22,
    clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.35,
  });
  const paintDark = new THREE.MeshPhysicalMaterial({
    color: 0x101215, metalness: 0.7, roughness: 0.4,
    clearcoat: 0.6, clearcoatRoughness: 0.15,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x0b0e13, metalness: 0.2, roughness: 0.03,
    clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6,
  });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x121418, metalness: 0.05, roughness: 0.9 });
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xf2f4f6, metalness: 1, roughness: 0.08, envMapIntensity: 1.5 });

  const car = new THREE.Group();
  scene.add(car);
  const panels: Panel[] = [];

  const addPanel = (
    mesh: THREE.Object3D, x: number, y: number, z: number,
    dir: [number, number, number], dist: number, spin: [number, number, number] = [0, 0, 0],
    rot: [number, number, number] = [0, 0, 0],
  ) => {
    mesh.position.set(x, y, z);
    mesh.rotation.set(...rot);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    car.add(mesh);
    panels.push({
      mesh,
      home: new THREE.Vector3(x, y, z),
      baseRot: new THREE.Euler(...rot),
      dir: new THREE.Vector3(...dir).normalize(),
      dist,
      spin: new THREE.Vector3(...spin),
    });
  };

  // ── car body panels — rounded edges read as pressed metal, not toy bricks ──
  const box = (w: number, h: number, d: number, m: THREE.Material, edge = 0.12) => {
    const r = Math.min(w, h, d) * edge;
    return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), m);
  };

  /** Extrude a 2D side-profile across the car's width — real automotive curves. */
  const profile = (pts: [number, number][], width: number, m: THREE.Material) => {
    const shape = new THREE.Shape();
    shape.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: width, bevelEnabled: true, bevelThickness: 0.09,
      bevelSize: 0.07, bevelSegments: 5, curveSegments: 12,
    });
    geo.translate(0, 0, -width / 2);
    return new THREE.Mesh(geo, m);
  };

  // lower body shell — one continuous coupe profile (nose → beltline → tail)
  addPanel(profile([
    [-2.25, 0.06], [-2.32, 0.5], [-2.0, 0.56], [1.05, 0.56],
    [1.75, 0.44], [2.28, 0.38], [2.34, 0.12], [2.0, 0.04], [-1.95, 0.04],
  ], 1.72, paint), 0, 0.06, 0, [0, -1, 0], 0.9);

  // glass canopy — raked windshield into a fastback roof line
  addPanel(profile([
    [1.02, 0.56], [0.2, 1.0], [-0.6, 0.99], [-1.55, 0.57], [-0.9, 0.53], [0.6, 0.53],
  ], 1.5, glass), 0, 0.06, 0, [0, 1, 0], 1.7, [0.25, 0, 0]);

  // doors — thin overlays that blow outward
  addPanel(box(1.5, 0.34, 0.07, paint, 0.3), -0.25, 0.34, 0.92, [0, 0.2, 1], 1.9, [0, 0.5, 0]);
  addPanel(box(1.5, 0.34, 0.07, paint, 0.3), -0.25, 0.34, -0.92, [0, 0.2, -1], 1.9, [0, -0.5, 0]);
  // front splitter + rear diffuser
  addPanel(box(0.5, 0.14, 1.8, paintDark, 0.35), 2.2, 0.06, 0, [1, 0, 0], 2.4);
  addPanel(box(0.5, 0.14, 1.8, paintDark, 0.35), -2.24, 0.07, 0, [-1, 0, 0], 2.3);
  // headlights — slim LED strips tucked into the nose
  addPanel(box(0.1, 0.06, 0.46, chrome), 2.32, 0.3, 0.52, [1, 0.3, 0.4], 2.6);
  addPanel(box(0.1, 0.06, 0.46, chrome), 2.32, 0.3, -0.52, [1, 0.3, -0.4], 2.6);

  // wheels — larger, smoother, tighter to the arches
  const wheelGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.32, 40);
  const rimGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.34, 24);
  const wheelPos: [number, number][] = [[1.35, 1.02], [1.35, -1.02], [-1.4, 1.02], [-1.4, -1.02]];
  const wheels: THREE.Group[] = [];
  wheelPos.forEach(([x, z]) => {
    const g = new THREE.Group();
    const w = new THREE.Mesh(wheelGeo, tyre);
    w.rotation.x = Math.PI / 2;
    w.castShadow = true;
    const r = new THREE.Mesh(rimGeo, chrome);
    r.rotation.x = Math.PI / 2;
    g.add(w, r);
    wheels.push(g);
    addPanel(g, x, -0.12, z, [0, -0.6, Math.sign(z)], 1.5, [2.5, 0, 0]);
  });

  // ground shadow catcher
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(9, 48),
    new THREE.ShadowMaterial({ opacity: 0.22 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.65;
  ground.receiveShadow = true;
  scene.add(ground);

  // ── animation state ──
  let targetP = 0;
  let curP = 0;
  let raf = 0;
  let running = false;
  const clock = new THREE.Clock();

  const applyProgress = (p: number) => {
    // explode factor: 0 at ends, 1 in the middle → assemble→explode→reassemble
    const e = Math.sin(Math.max(0, Math.min(1, p)) * Math.PI);
    const eased = e * e * (3 - 2 * e); // smoothstep for a softer bloom
    for (const pan of panels) {
      pan.mesh.position.set(
        pan.home.x + pan.dir.x * pan.dist * eased,
        pan.home.y + pan.dir.y * pan.dist * eased,
        pan.home.z + pan.dir.z * pan.dist * eased,
      );
      pan.mesh.rotation.set(
        pan.baseRot.x + pan.spin.x * eased,
        pan.baseRot.y + pan.spin.y * eased,
        pan.baseRot.z + pan.spin.z * eased,
      );
    }
    // whole car turns slowly across the scroll for parallax life
    car.rotation.y = -0.5 + p * 1.15;
    car.position.y = Math.sin(p * Math.PI) * 0.12;
    // camera drifts up and in a touch at the explode peak
    camera.position.y = lerp(1.9, 2.6, eased);
    camera.position.z = lerp(6.4, 7.2, eased);
    camera.lookAt(0, 0.35, 0);
  };
  applyProgress(0);

  const frame = () => {
    curP = lerp(curP, targetP, 0.09);
    applyProgress(curP);
    const dt = clock.getDelta();
    for (const w of wheels) w.rotation.z -= dt * 1.4; // idle wheel spin
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };

  const resize = () => {
    const w = canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || canvas.parentElement?.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();

  return {
    setProgress: (p: number) => { targetP = p; },
    resize,
    start: () => { if (!running) { running = true; clock.start(); raf = requestAnimationFrame(frame); } },
    stop: () => { running = false; cancelAnimationFrame(raf); },
    dispose: () => {
      cancelAnimationFrame(raf);
      running = false;
      scene.traverse((o) => {
        const anyO = o as THREE.Mesh;
        if (anyO.geometry) anyO.geometry.dispose();
      });
      [paint, paintDark, glass, tyre, chrome].forEach((m) => m.dispose());
      wheelGeo.dispose(); rimGeo.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
