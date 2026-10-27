import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BatteryMedium, RotateCcw } from 'lucide-react';
import type { LockDevice, Snapshot, Surface } from './data';

type GeometryAsset = { body: THREE.BufferGeometry; surfaces: Partial<Record<Surface, THREE.BufferGeometry>> };
type MotionFrame = { t: number; translation: [number, number, number]; angle: number; gap: number };
type Motion = { duration: number; endTranslation: [number, number, number]; endAngle: number; contactPoint: [number, number, number]; frames: MotionFrame[] };
const assetUrl = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`;
let lockPromise: Promise<GeometryAsset> | undefined;
let jamPromise: Promise<{ sleeve: THREE.BufferGeometry; motion: Motion }> | undefined;

function extractSurfaces(body: THREE.BufferGeometry) {
  const position = body.getAttribute('position');
  const normal = body.getAttribute('normal');
  const samples: Partial<Record<Surface, number[]>> = {};
  const add = (surface: Surface, index: number) => {
    const output = samples[surface] ?? (samples[surface] = []);
    for (let vertex = index; vertex < index + 3; vertex++) output.push(position.getX(vertex), position.getY(vertex), position.getZ(vertex));
  };
  for (let i = 0; i < position.count; i += 3) {
    const y = (position.getY(i) + position.getY(i + 1) + position.getY(i + 2)) / 3;
    const ny = normal.getY(i), nz = normal.getZ(i);
    if (ny > .93 && y >= 27 && y < 34) add('重力面', i);
    if (ny > .3 && nz > .3 && y > 65) add('落箱上导向斜面', i);
    if (ny > .3 && nz < -.3 && y > 35 && y < 70) add('落箱下导向斜面', i);
    if (ny < -.3 && Math.abs(nz) > .3 && y > 45) add('提箱导向面', i);
    if (Math.abs(ny) < .16 && nz < -.9 && y > 32) add('提箱阻挡面', i);
  }
  const surfaces: Partial<Record<Surface, THREE.BufferGeometry>> = {};
  for (const [surface, points] of Object.entries(samples)) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.computeVertexNormals();
    surfaces[surface as Surface] = geometry;
  }
  return surfaces;
}

export function loadLock(): Promise<GeometryAsset> {
  if (!lockPromise) lockPromise = new STLLoader().loadAsync(assetUrl('ftr-lock.stl')).then(body => {
    body.translate(-90, 0, -90);
    body.computeBoundingBox();
    return { body, surfaces: extractSurfaces(body) };
  }).catch(error => { lockPromise = undefined; throw error; });
  return lockPromise;
}

function loadJam() {
  if (!jamPromise) jamPromise = Promise.all([
    new STLLoader().loadAsync(assetUrl('ftr-sleeve.stl')),
    fetch(assetUrl('jam-motion.json')).then(response => { if (!response.ok) throw new Error('motion unavailable'); return response.json() as Promise<Motion>; }),
  ]).then(([sleeve, motion]) => ({ sleeve, motion })).catch(error => { jamPromise = undefined; throw error; });
  return jamPromise;
}

function createScene() {
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.5); key.position.set(-170, 300, 240); scene.add(key);
  const fill = new THREE.DirectionalLight(0x8bd9eb, 1.2); fill.position.set(200, 120, -220); scene.add(fill);
  return scene;
}

function createCamera() {
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 2000);
  camera.position.set(290, 220, 330); camera.lookAt(0, 57, 0); return camera;
}

export function createModel(asset: GeometryAsset) {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xd67b09, metalness: .36, roughness: .39 });
  const body = new THREE.Mesh(asset.body, bodyMaterial); group.add(body);
  const accentMaterial = new THREE.MeshBasicMaterial({ color: 0x38dce8, side: THREE.DoubleSide, transparent: true, opacity: .86, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const accents: Partial<Record<Surface, THREE.Mesh>> = {};
  for (const [name, geometry] of Object.entries(asset.surfaces)) {
    const mesh = new THREE.Mesh(geometry, accentMaterial); mesh.visible = false; mesh.renderOrder = 2;
    accents[name as Surface] = mesh; group.add(mesh);
  }
  return {
    group,
    update(surface: Surface, abnormal: boolean, inactive = false) {
      bodyMaterial.color.set(inactive ? 0x586a72 : 0xd67b09);
      accentMaterial.color.set(abnormal ? 0xff596d : 0x3fe2e9);
      bodyMaterial.emissive.set(abnormal ? 0x391015 : 0x000000);
      Object.entries(accents).forEach(([name, mesh]) => { if (mesh) mesh.visible = !inactive && (abnormal ? (name === surface || surface === '无' && name === '提箱阻挡面') : surface !== '重力面' && name === surface); });
    },
    dispose() { bodyMaterial.dispose(); accentMaterial.dispose(); },
  };
}

function rendererFor(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

// The long-axis ends form the two pairs; the upper guide faces outwards.
export const LOCK_ORIENTATIONS = [-Math.PI / 2, -Math.PI / 2, Math.PI / 2, Math.PI / 2] as const;

/** A single canvas renders the four independently highlighted lock instances. */
export function CornerLocks({ vehicle, snapshot, abnormal }: { vehicle: { locks: LockDevice[] }; snapshot: Snapshot; abnormal: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const update = useRef<() => void>(() => {});
  const latest = useRef({ snapshot, abnormal }); latest.current = { snapshot, abnormal };
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!root.current || !canvas.current) return;
    const container = root.current;
    let active = true;
    let renderer: THREE.WebGLRenderer;
    try { renderer = rendererFor(canvas.current); } catch { setFailed(true); return; }
    renderer.autoClear = false;
    let models: ReturnType<typeof createModel>[] = [];
    let scenes: THREE.Scene[] = [];
    const camera = createCamera();
    const render = () => {
      if (!active || !container.isConnected || models.length !== 4) return;
      const bounds = container.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      renderer.setSize(bounds.width, bounds.height, false); renderer.setScissorTest(false); renderer.clear(); renderer.setScissorTest(true);
      const slots = container.querySelectorAll<HTMLElement>('.corner-model-slot');
      slots.forEach((slot, i) => {
        const r = slot.getBoundingClientRect(); if (!r.width || !r.height) return;
        const x = r.left - bounds.left, y = bounds.bottom - r.bottom;
        models[i].update(latest.current.snapshot.surfaces[i], latest.current.abnormal || latest.current.snapshot.jam && i === 0);
        renderer.setViewport(x, y, r.width, r.height); renderer.setScissor(x, y, r.width, r.height); renderer.clearDepth();
        camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); renderer.render(scenes[i], camera);
      });
      renderer.setScissorTest(false);
      container.querySelectorAll<SVGPathElement>('.corner-connector path').forEach((path, i) => {
        const card = container.querySelector<HTMLElement>(`.corner-${i}`)?.getBoundingClientRect();
        const anchor = container.parentElement?.querySelector<HTMLElement>(`[data-lock-anchor="${i}"]`)?.getBoundingClientRect();
        if (!card || !anchor) return;
        const right = i % 2 === 1, top = i < 2;
        const x1 = (right ? card.left : card.right) - bounds.left, y1 = (top ? card.bottom - 12 : card.top + 12) - bounds.top;
        const x2 = anchor.left + anchor.width / 2 - bounds.left, y2 = anchor.top + anchor.height / 2 - bounds.top;
        const mid = (x1 + x2) / 2;
        path.setAttribute('d', `M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`);
      });
    };
    update.current = render;
    const observer = new ResizeObserver(render); observer.observe(container);
    const sceneHost = container.parentElement?.querySelector('.scene3d');
    sceneHost?.addEventListener('lock-anchors-updated', render);
    loadLock().then(asset => {
      if (!active) return;
      models = Array.from({ length: 4 }, (_, i) => { const model = createModel(asset); model.group.rotation.y = LOCK_ORIENTATIONS[i]; return model; });
      scenes = models.map(model => { const scene = createScene(); scene.add(model.group); return scene; });
      render();
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; observer.disconnect(); sceneHost?.removeEventListener('lock-anchors-updated', render); update.current = () => {}; models.forEach(model => model.dispose()); renderer.dispose(); };
  }, []);
  useEffect(() => { update.current(); }, [snapshot, abnormal]);
  return <div className="corner-overlay" ref={root}>
    <svg className="corner-connector" aria-hidden="true">{vehicle.locks.map((lock, i) => <path key={lock.id} className={abnormal || snapshot.jam && i === 0 ? 'alert' : ''}/>)}</svg><canvas ref={canvas} className="corner-model-canvas" aria-hidden="true"/>
    {vehicle.locks.map((lock, i) => {
      const bad = abnormal || snapshot.jam && i === 0;
      return <article key={lock.id} className={`corner-card corner-${i} ${bad ? 'abnormal' : ''}`} data-testid={`lock-${i + 1}`}>
        <div className="corner-header"><span><i/>{lock.id}</span><small>{['左前', '右前', '左后', '右后'][i]}角</small></div>
        <div className="corner-body"><div className="corner-model-slot">{failed && <small>模型加载失败</small>}</div><div className="corner-reading"><span>当前受力</span><strong>{snapshot.force[i].toFixed(1)}<small>kN</small></strong></div></div>
        <div className="corner-footer"><span>感压：{snapshot.surfaces[i]}</span><span><BatteryMedium size={12}/>{lock.battery}%</span></div>
      </article>;
    })}
  </div>;
}

export function LockModel({ surface, abnormal, autoRotate = false }: { surface: Surface; abnormal: boolean; autoRotate?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const reset = useRef<() => void>(() => {});
  const update = useRef<(surface: Surface, abnormal: boolean) => void>(() => {});
  const [failed, setFailed] = useState(false);
  const latestModel = useRef({ surface, abnormal }); latestModel.current = { surface, abnormal };
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!canvas.current || !container.current) return;
    const host = container.current; let active = true;
    let renderer: THREE.WebGLRenderer;
    try { renderer = rendererFor(canvas.current); } catch { setFailed(true); return; }
    const scene = createScene(), camera = createCamera();
    const controls = new OrbitControls(camera, renderer.domElement); controls.enablePan = false; controls.minDistance = 200; controls.maxDistance = 800; controls.target.set(0, 58, 0); controls.update(); controls.saveState();
    const render = () => { const r = host.getBoundingClientRect(); if (!r.width || !r.height) return; renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); renderer.render(scene, camera); };
    controls.addEventListener('change', render); reset.current = () => { controls.reset(); render(); };
    const observer = new ResizeObserver(render); observer.observe(host);
    let frame = 0; let interacting = false;
    const start = () => { interacting = true; }; const end = () => { interacting = false; };
    controls.addEventListener('start', start); controls.addEventListener('end', end);
    let model: ReturnType<typeof createModel> | undefined;
    loadLock().then(asset => {
      if (!active) return;
      model = createModel(asset); model.update(latestModel.current.surface, latestModel.current.abnormal); scene.add(model.group); render();
      update.current = (next, bad) => { model?.update(next, bad); render(); };
    }).catch(() => { if (active) setFailed(true); });
    const tick = () => { if (!active) return; if (autoRotate && model && !interacting) { model.group.rotation.y += .003; render(); } frame = requestAnimationFrame(tick); };
    if (autoRotate) frame = requestAnimationFrame(tick);
    return () => { active = false; cancelAnimationFrame(frame); observer.disconnect(); controls.removeEventListener('start', start); controls.removeEventListener('end', end); controls.dispose(); model?.dispose(); renderer.dispose(); update.current = () => {}; reset.current = () => {}; };
  }, [attempt, autoRotate]);
  useEffect(() => { update.current(surface, abnormal); }, [surface, abnormal]);
  return <div className="detail-model" ref={container} aria-label="锁具三维模型"><canvas ref={canvas}/>{failed ? <button className="model-error" onClick={() => { setFailed(false); setAttempt(n => n + 1); }}>模型加载失败 · 重试</button> : <button className="model-reset" onClick={() => reset.current()} aria-label="恢复模型视角" title="恢复模型视角"><RotateCcw size={14}/></button>}</div>;
}

/** The supplied CAD mesh and 150 recorded poses share the operation clock. */
export function JamModel({ progress }: { progress: number }) {
  const canvas = useRef<HTMLCanvasElement>(null), container = useRef<HTMLDivElement>(null);
  const update = useRef<(value: number) => void>(() => {});
  const latest = useRef(progress); latest.current = progress;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!canvas.current || !container.current) return;
    const host = container.current; let active = true;
    let renderer: THREE.WebGLRenderer;
    try { renderer = rendererFor(canvas.current); } catch { setFailed(true); return; }
    renderer.autoClear = false;
    const scene = createScene(), main = createCamera();
    const detail = new THREE.PerspectiveCamera(30, 1, 1, 1000);
    let model: ReturnType<typeof createModel> | undefined;
    let shellMaterial: THREE.Material | undefined, edgesGeometry: THREE.BufferGeometry | undefined, edgesMaterial: THREE.Material | undefined, contactGeometry: THREE.SphereGeometry | undefined, contactMaterial: THREE.Material | undefined;
    let poseUpdate = (_p: number) => {};
    const render = () => {
      const r = host.getBoundingClientRect(); if (!r.width || !r.height || !model) return;
      renderer.setSize(r.width, r.height, false); renderer.setScissorTest(false); renderer.clear(); renderer.setScissorTest(true);
      const mainWidth = r.width * .68;
      renderer.setViewport(0, 0, mainWidth, r.height); renderer.setScissor(0, 0, mainWidth, r.height); main.aspect = mainWidth / r.height; main.updateProjectionMatrix(); renderer.render(scene, main);
      const x = r.width * .68, y = r.height * .16, w = r.width * .32, h = r.height * .68;
      renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h); renderer.clearDepth(); detail.aspect = w / h; detail.updateProjectionMatrix(); renderer.render(scene, detail); renderer.setScissorTest(false);
    };
    const observer = new ResizeObserver(render); observer.observe(host);
    Promise.all([loadLock(), loadJam()]).then(([asset, jam]) => {
      if (!active) return;
      model = createModel(asset); model.update('提箱阻挡面', true); scene.add(model.group);
      shellMaterial = new THREE.MeshStandardMaterial({ color: 0x9abfd1, transparent: true, opacity: .18, side: THREE.DoubleSide, depthWrite: false, roughness: .55 });
      const shell = new THREE.Mesh(jam.sleeve, shellMaterial);
      edgesGeometry = new THREE.EdgesGeometry(jam.sleeve, 20); edgesMaterial = new THREE.LineBasicMaterial({ color: 0x94b8c8, transparent: true, opacity: .56 });
      const sleeveGroup = new THREE.Group(); sleeveGroup.matrixAutoUpdate = false; sleeveGroup.add(shell, new THREE.LineSegments(edgesGeometry, edgesMaterial)); scene.add(sleeveGroup);
      contactGeometry = new THREE.SphereGeometry(2.7, 16, 12); contactMaterial = new THREE.MeshBasicMaterial({ color: 0xff5367 });
      const contact = new THREE.Mesh(contactGeometry, contactMaterial); contact.position.set(...jam.motion.contactPoint); scene.add(contact);
      detail.position.copy(contact.position).add(new THREE.Vector3(-130, 65, 120)); detail.lookAt(contact.position);
      const end = new THREE.Matrix4().makeTranslation(...jam.motion.endTranslation).multiply(new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(jam.motion.endAngle))).invert();
      poseUpdate = (value: number) => {
        const p = Math.max(0, Math.min(2, value));
        const index = Math.min(jam.motion.frames.length - 1, Math.round(Math.min(p, 1) * (jam.motion.frames.length - 1)));
        const frame = jam.motion.frames[index];
        const angle = p > 1 ? jam.motion.endAngle - .2 * (p - 1) : frame.angle;
        const translation = p > 1 ? jam.motion.endTranslation : frame.translation;
        sleeveGroup.matrix.copy(new THREE.Matrix4().makeTranslation(...translation).multiply(new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(angle))).multiply(end));
        const touching = p >= 1 || frame.gap <= .01; contact.visible = touching; model?.update(touching ? '提箱阻挡面' : '无', touching); render();
      };
      update.current = poseUpdate; poseUpdate(latest.current);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; observer.disconnect(); update.current = () => {}; model?.dispose(); shellMaterial?.dispose(); edgesGeometry?.dispose(); edgesMaterial?.dispose(); contactGeometry?.dispose(); contactMaterial?.dispose(); renderer.dispose(); };
  }, []);
  useEffect(() => { update.current(progress); }, [progress]);
  return <div className="jam-model" ref={container} aria-label="锁具卡阻三维画面"><canvas ref={canvas}/><span className="jam-detail-label">接触局部</span>{failed && <span className="model-error">模型加载失败</span>}</div>;
}
