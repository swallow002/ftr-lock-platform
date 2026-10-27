import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RotateCcw } from 'lucide-react';
import { createModel, loadLock, LOCK_ORIENTATIONS } from './LockModels';
import type { Snapshot, Vehicle } from './data';

export default function Scene3D({ snapshot, vehicle, abnormal, dual }: { snapshot: Snapshot; vehicle: Vehicle; abnormal: boolean; dual: boolean }) {
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const update = useRef<() => void>(() => {}), reset = useRef<() => void>(() => {});
  const latest = useRef({snapshot,abnormal,dual}); latest.current = {snapshot,abnormal,dual};
  const [transparent, setTransparent] = useState(false), transparentRef = useRef(false), [failed,setFailed] = useState(false);
  transparentRef.current = transparent;
  useEffect(() => {
    if (!host.current || !canvas.current) return;
    const element=host.current; let active=true;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({canvas:canvas.current,alpha:true,antialias:true}); } catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.setClearColor(0x000000,0); renderer.outputColorSpace=THREE.SRGBColorSpace;
    const scene=new THREE.Scene(); scene.add(new THREE.AmbientLight(0xffffff,1.4));
    const light=new THREE.DirectionalLight(0xffffff,2.3); light.position.set(-6,10,8); scene.add(light);
    const fill=new THREE.DirectionalLight(0x67cbd9,1); fill.position.set(8,4,-6); scene.add(fill);
    const camera=new THREE.PerspectiveCamera(35,1,.01,100); camera.position.set(dual ? 10 : 8,7,10);
    const controls=new OrbitControls(camera,renderer.domElement); controls.target.set(dual ? 2.3 : 0,1.2,0); controls.enablePan=false; controls.minDistance=7; controls.maxDistance=25; controls.maxPolarAngle=Math.PI*.49; controls.update(); controls.saveState();
    const materials: THREE.Material[]=[]; const geometries: THREE.BufferGeometry[]=[];
    const mat=(color:number, metalness=.3) => {const m=new THREE.MeshStandardMaterial({color,metalness,roughness:.52}); materials.push(m); return m;};
    const frameMat=mat(0x35586a,.65), steel=mat(0x5b7e8c,.7), wheelMat=mat(0x172d3a,.7), railMat=mat(0x5d899a,.7), boxMat=mat(0x266982,.4), edgeMat=mat(0x68b3c5,.55);
    const box=(parent:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material) => {const g=new THREE.BoxGeometry(w,h,d);geometries.push(g);const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
    const tracks=new THREE.Group();scene.add(tracks);
    const makeTrack=(lane:number) => { for(const x of [-.75,.75]) box(tracks,.09,.12,15,lane+x,0,0,railMat); for(let i=-18;i<=18;i++) box(tracks,2.2,.08,.18,lane,-.09,i*.4,frameMat); };
    const makeCar=(lane:number) => { const group=new THREE.Group(); group.position.x=lane; scene.add(group);
      box(group,2.65,.22,6.9,0,.48,0,frameMat); for(const x of [-1.17,1.17]) box(group,.14,.30,7.2,x,.38,0,steel);
      for(const z of [-3.35,-2.0,-.65,.65,2.0,3.35]) box(group,2.5,.13,.12,0,.33,z,steel);
      for(const z of [-3.65,3.65]) {box(group,.55,.16,.45,0,.34,z,frameMat);box(group,.3,.22,.25,0,.34,z+(z<0?-.3:.3),steel);}
      for(const at of [-2.55,2.55]) {box(group,2.6,.22,.5,0,.23,at,steel); for(const x of [-.82,.82]) {const g=new THREE.CylinderGeometry(.27,.27,.16,20);geometries.push(g);const wheel=new THREE.Mesh(g,wheelMat);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.22,at);group.add(wheel);}}
      return group; };
    makeTrack(0); makeCar(0); if(dual){makeTrack(4.6);makeCar(4.6);}
    const container=new THREE.Group();scene.add(container);
    const shell=box(container,2.42,2.35,6.1,0,1.175,0,boxMat);
    // Repeated ribs and edges clarify the container silhouette at any angle.
    for(const z of Array.from({length:20},(_,i)=>-2.9+i*.305)) for(const x of [-1.22,1.22]) box(container,.035,2.26,.045,x,1.18,z,edgeMat);
    for(const x of [-1.21,1.21]) for(const y of [.04,2.31]) box(container,.06,.07,6.12,x,y,0,edgeMat);
    const anchors=[[-1.14,-2.75],[1.14,-2.75],[-1.14,2.75],[1.14,2.75]];
    const lockGroup=new THREE.Group();scene.add(lockGroup);let models:ReturnType<typeof createModel>[]=[];
    loadLock().then(asset=>{ if(!active)return; models=anchors.map(([x,z],i)=>{const model=createModel(asset);model.group.rotation.y=LOCK_ORIENTATIONS[i];model.group.scale.setScalar(.00165);model.group.position.set(x,.61,z);lockGroup.add(model.group);return model;});render(); }).catch(()=>{if(active)setFailed(true);});
    const world=new THREE.Vector3();
    const render=()=>{if(!active)return; const r=element.getBoundingClientRect();if(!r.width||!r.height)return;
      const s=latest.current.snapshot;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();
      boxMat.transparent=transparentRef.current;boxMat.opacity=transparentRef.current ? .22 : 1;boxMat.depthWrite=!transparentRef.current;
      edgeMat.transparent=transparentRef.current;edgeMat.opacity=transparentRef.current ? .4 : 1; edgeMat.depthWrite=!transparentRef.current;
      container.position.set(dual?s.transfer*4.6:0,.62+s.containerHeight*1.8,0);container.rotation.y=THREE.MathUtils.degToRad(s.rotation);
      lockGroup.position.x=dual && s.transfer >= 1 ? 4.6 : 0;
      models.forEach((model,i)=>model.update(s.surfaces[i],latest.current.abnormal || s.jam && i===0));
      shell.material=boxMat; renderer.render(scene,camera);
      anchors.forEach(([x,z],i)=>{world.set(x+lockGroup.position.x,.75,z).project(camera);const marker=element.querySelector<HTMLElement>(`[data-lock-anchor="${i}"]`);if(marker){marker.style.left=`${(world.x+1)*r.width/2}px`;marker.style.top=`${(1-world.y)*r.height/2}px`;}});
      element.dispatchEvent(new Event('lock-anchors-updated'));
    };
    update.current=render;reset.current=()=>{controls.reset();render();};controls.addEventListener('change',render);
    const observer=new ResizeObserver(render);observer.observe(element);render();
    return()=>{active=false;observer.disconnect();controls.dispose();models.forEach(m=>m.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());renderer.dispose();update.current=()=>{};reset.current=()=>{};};
  },[dual]);
  useEffect(()=>{update.current();},[snapshot,abnormal,transparent]);
  return <div className="scene3d" ref={host} aria-label={`三维作业画面 ${vehicle.id}`}><canvas ref={canvas}/>{[0,1,2,3].map(i=><span key={i} className="scene3d-anchor" data-lock-anchor={i}/>)}<div className="scene3d-controls"><button onClick={()=>setTransparent(v=>!v)} aria-pressed={transparent}>集装箱半透明 {transparent?'开':'关'}</button><button onClick={()=>reset.current()} aria-label="恢复作业视角" title="恢复作业视角"><RotateCcw size={14}/></button></div>{failed && <div className="scene3d-error">三维模型加载失败</div>}</div>;
}
