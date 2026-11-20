/*
 * Lift Lab 3D barbell: one sleeve of an Olympic bar and four bumper plates, built from plain shapes
 * (no model files). It is bundled with the few parts of three.js it uses into js/barbell.js, so edit
 * this file and rebuild. See the README, "3D barbell".
 *
 * createBarbell() returns { setStep, setProgress, dispose }.
 *   setStep(0..4)   loads that many plates; step 4 also clamps the collar and lifts the bar.
 *   setProgress(p)  0..1 scroll position through the steps, turns the bar a little.
 */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Color, Vector3,
  CylinderGeometry, TorusGeometry, PlaneGeometry, DirectionalLight,
  MeshStandardMaterial, MeshBasicMaterial, PMREMGenerator,
  ACESFilmicToneMapping, DoubleSide,
} from 'three';

const ORANGE = 0xf5821f;

// Biggest plate goes on first, like a real bar. r = radius, t = thickness (metres), kg = per side.
const PLATES = [
  { r: 0.225, t: 0.078, kg: 25 },
  { r: 0.2, t: 0.07, kg: 20 },
  { r: 0.17, t: 0.062, kg: 15 },
  { r: 0.135, t: 0.052, kg: 10 },
];
const BAR_KG = 20;
const GAP = 0.004;
const SLEEVE_START = 0.235;
const SLIDE = 0.95; // how far outside the frame a plate starts its slide

/** Total weight on the bar after each step (0 = empty bar). */
export const KG_BY_STEP = (() => {
  const out = [BAR_KG];
  let kg = BAR_KG;
  for (const p of PLATES) { kg += p.kg * 2; out.push(kg); }
  return out;
})();

const alongX = (geometry) => geometry.rotateZ(Math.PI / 2);

/** A dark studio made of bright panels, baked into a reflection map so the chrome has something to mirror. */
function studioEnvironment(renderer) {
  const env = new Scene();
  env.background = new Color(0x0b0b0c);
  const panels = [];
  const panel = (w, h, x, y, z, color, power) => {
    const material = new MeshBasicMaterial({ color, side: DoubleSide });
    material.color.multiplyScalar(power); // brighter than 1: the map keeps the highlights
    const mesh = new Mesh(new PlaneGeometry(w, h), material);
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    env.add(mesh);
    panels.push(mesh);
  };
  panel(10, 4, 0, 7, 1, 0xffffff, 16); // soft box overhead
  panel(3, 7, -7, 1, 4, 0xffffff, 11); // tall strip, left
  panel(2.5, 6, 7, 0.5, -3, ORANGE, 4); // a hint of orange from behind, right
  panel(5, 3, 5, 0, 6, 0xffffff, 3); // gentle fill, front right
  panel(12, 12, 0, -4, 0, 0x2a1a0f, 1.2); // warm floor bounce
  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromScene(env, 0.03);
  pmrem.dispose();
  for (const mesh of panels) { mesh.geometry.dispose(); mesh.material.dispose(); }
  return target;
}

export function createBarbell({ canvas, stage, onFail }) {
  const gs = window.gsap;
  const dprCap = Math.min(window.devicePixelRatio || 1, 2);

  let renderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: dprCap < 2, // at 2x the pixels are already small enough
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch (err) {
    if (onFail) onFail(err);
    return null;
  }
  let dpr = dprCap;
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new Scene();
  const envTarget = studioEnvironment(renderer);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 1;

  const key = new DirectionalLight(0xffffff, 1.6);
  key.position.set(2, 3, 2.5);
  scene.add(key);

  const camera = new PerspectiveCamera(28, 1, 0.1, 30);

  /* ---------- materials ---------- */
  const chrome = new MeshStandardMaterial({ color: 0xd8dbe1, metalness: 1, roughness: 0.2 });
  const sleeveMetal = new MeshStandardMaterial({ color: 0xeceef2, metalness: 1, roughness: 0.14 });
  const rubber = new MeshStandardMaterial({ color: 0x131416, metalness: 0, roughness: 0.78 });
  const orange = new MeshStandardMaterial({
    color: ORANGE, metalness: 0.3, roughness: 0.4, emissive: ORANGE, emissiveIntensity: 0.2,
  });

  /* ---------- the bar: rig turns it, pivot holds it, so the plates sit at the middle of the frame ---------- */
  const rig = new Group();
  const pivot = new Group();
  pivot.position.x = -0.32;
  rig.add(pivot);
  scene.add(rig);

  const add = (geometry, material, x = 0, parent = pivot) => {
    const mesh = new Mesh(geometry, material);
    mesh.position.x = x;
    parent.add(mesh);
    return mesh;
  };
  add(alongX(new CylinderGeometry(0.0135, 0.0135, 1.5, 48)), chrome, -0.55); // shaft, runs out of frame to the left
  add(alongX(new CylinderGeometry(0.033, 0.033, 0.03, 48)), chrome, 0.205); // fixed shoulder
  add(alongX(new CylinderGeometry(0.025, 0.025, 0.46, 48)), sleeveMetal, 0.45); // sleeve the plates slide on
  add(alongX(new CylinderGeometry(0.025, 0.02, 0.018, 48)), sleeveMetal, 0.689); // rounded tip

  /* ---------- plates ---------- */
  function makePlate({ r, t }) {
    const g = new Group();
    const part = (geometry, material, x = 0, spinY = false) => {
      const mesh = new Mesh(geometry, material);
      if (spinY) mesh.rotation.y = Math.PI / 2; // torus axis z -> x
      mesh.position.x = x;
      g.add(mesh);
    };
    part(alongX(new CylinderGeometry(r, r, t, 72)), rubber);
    for (const side of [-1, 1]) part(new TorusGeometry(r - 0.007, 0.011, 10, 72), rubber, side * (t / 2 - 0.004), true); // rounded edge
    part(alongX(new CylinderGeometry(0.07, 0.07, t + 0.012, 40)), chrome); // hub
    part(new TorusGeometry(r - 0.02, 0.0042, 8, 120), orange, t / 2 + 0.0012, true); // orange ring, the colour of the logo
    part(new TorusGeometry(r * 0.55, 0.003, 8, 96), chrome, t / 2 + 0.0008, true); // thin chrome ring
    return g;
  }

  const plates = [];
  let cursor = SLEEVE_START;
  for (const spec of PLATES) {
    const group = makePlate(spec);
    const rest = cursor + spec.t / 2;
    cursor += spec.t + GAP;
    group.position.x = rest + SLIDE;
    group.visible = false;
    pivot.add(group);
    plates.push({ group, rest, on: false });
  }

  // the collar that locks the plates, with an orange band
  const collar = new Group();
  const collarRest = cursor + 0.022;
  collar.add(new Mesh(alongX(new CylinderGeometry(0.04, 0.04, 0.04, 48)), chrome));
  const band = new Mesh(new TorusGeometry(0.0405, 0.0042, 8, 64), orange);
  band.rotation.y = Math.PI / 2;
  collar.add(band);
  collar.position.x = collarRest + SLIDE;
  collar.visible = false;
  pivot.add(collar);
  let collarOn = false;

  /* ---------- motion ---------- */
  const fx = { flash: 0 }; // brightens the whole bar for a moment when it lifts
  const thud = () => {
    if (!gs) return;
    gs.fromTo(pivot.position, { y: -0.012 }, { y: 0, duration: 0.55, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' });
  };

  function slide(group, rest, on, onDone) {
    if (!gs) {
      group.visible = on;
      group.position.x = on ? rest : rest + SLIDE;
      group.rotation.x = 0;
      return;
    }
    gs.killTweensOf([group.position, group.rotation]);
    if (on) {
      group.visible = true;
      gs.fromTo(group.position, { x: rest + SLIDE }, { x: rest, duration: 0.95, ease: 'power3.out', onComplete: onDone });
      gs.fromTo(group.rotation, { x: -Math.PI * 3 }, { x: 0, duration: 0.95, ease: 'power3.out' });
    } else {
      gs.to(group.position, { x: rest + SLIDE, duration: 0.45, ease: 'power2.in', onComplete: () => { group.visible = false; } });
      gs.to(group.rotation, { x: -Math.PI, duration: 0.45, ease: 'power2.in' });
    }
  }

  function lift() {
    if (!gs) return;
    gs.timeline()
      .to(pivot.position, { y: 0.07, duration: 0.55, ease: 'power2.out', overwrite: 'auto' })
      .to(pivot.position, { y: 0, duration: 0.9, ease: 'bounce.out' });
    gs.fromTo(fx, { flash: 0 }, { flash: 1, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' });
  }

  let step = 0;
  function setStep(n) {
    const next = Math.max(0, Math.min(PLATES.length, Math.round(n)));
    const wasFull = step === PLATES.length;
    step = next;
    plates.forEach((p, i) => {
      const on = next >= i + 1;
      if (p.on !== on) { p.on = on; slide(p.group, p.rest, on, thud); }
    });
    const full = next === PLATES.length;
    if (collarOn !== full) { collarOn = full; slide(collar, collarRest, full, thud); }
    if (full && !wasFull) lift();
  }

  /* ---------- camera, size and the render loop ---------- */
  let progress = 0;
  let aspect = 1;
  const target = new Vector3(0, 0, 0);
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };

  function size() {
    const w = Math.max(1, stage.clientWidth);
    const h = Math.max(1, stage.clientHeight);
    renderer.setSize(w, h, false);
    aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(size);
  resizeObserver.observe(stage);
  size();

  const onMove = (e) => {
    const r = stage.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    pointer.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
  };
  const onLeave = () => { pointer.x = 0; pointer.y = 0; };
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerleave', onLeave);

  const AZIMUTH = 1.12; // radians from the bar's axis: a three-quarter view that shows the plates stacking up
  const ELEVATION = 0.3;
  const BASE_DISTANCE = 1.5;

  let last = 0;
  let avg = 1 / 60;
  let frames = 0;
  let running = false;

  function frame(time) {
    const dt = Math.min(0.1, (time - last) / 1000 || 0.016);
    last = time;

    // ease towards the pointer so the bar follows it softly
    const k = 1 - Math.pow(0.002, dt);
    pointer.sx += (pointer.x - pointer.sx) * k;
    pointer.sy += (pointer.y - pointer.sy) * k;

    const az = AZIMUTH + (progress - 0.5) * 0.7 + pointer.sx * 0.22 + Math.sin(time * 0.0004) * 0.03;
    const el = ELEVATION - pointer.sy * 0.1;
    const distance = BASE_DISTANCE * Math.max(1, 0.95 / aspect);
    camera.position.set(
      target.x + distance * Math.cos(el) * Math.cos(az),
      target.y + distance * Math.sin(el),
      target.z + distance * Math.cos(el) * Math.sin(az),
    );
    camera.lookAt(target);
    rig.position.y = Math.sin(time * 0.0011) * 0.006; // idle float

    renderer.toneMappingExposure = 1.05 + fx.flash * 0.7;
    orange.emissiveIntensity = 0.2 + fx.flash * 1.4;
    renderer.render(scene, camera);

    // If this device cannot keep up, drop to a lighter picture, and give up (the page shows the photos instead)
    if (dt < 0.1) {
      avg += (dt - avg) * 0.1;
      frames += 1;
      if (frames > 60 && avg > 0.036) {
        frames = 0;
        if (dpr > 1) {
          dpr = 1;
          renderer.setPixelRatio(dpr);
          size();
        } else {
          dispose();
          if (onFail) onFail(new Error('too slow'));
        }
      }
    }
  }

  function run(on) {
    if (on === running) return;
    running = on;
    if (on) { last = performance.now(); renderer.setAnimationLoop(frame); } else renderer.setAnimationLoop(null);
  }

  // Draw only while the stage is on screen and the tab is open.
  let inView = true;
  const sync = () => run(inView && !document.hidden);
  const observer = new IntersectionObserver((entries) => { inView = entries[entries.length - 1].isIntersecting; sync(); });
  observer.observe(stage);
  document.addEventListener('visibilitychange', sync);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); dispose(); if (onFail) onFail(new Error('context lost')); });
  sync();

  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    run(false);
    observer.disconnect();
    resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', sync);
    stage.removeEventListener('pointermove', onMove);
    stage.removeEventListener('pointerleave', onLeave);
    if (gs) gs.killTweensOf([pivot.position, fx, ...plates.map((p) => p.group.position), ...plates.map((p) => p.group.rotation), collar.position, collar.rotation]);
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const m of [chrome, sleeveMetal, rubber, orange]) m.dispose();
    envTarget.dispose();
    renderer.dispose();
  }

  return {
    setStep,
    setProgress: (p) => { progress = Math.max(0, Math.min(1, p)); },
    dispose,
  };
}
