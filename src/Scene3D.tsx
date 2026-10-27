import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createModel, loadLock, LOCK_ORIENTATIONS } from './LockModels';
import { containerBottom, type Operation, type Snapshot, type Vehicle } from './data';

export default function Scene3D({ snapshot, vehicle, abnormal, dual, transparent, resetVersion, operation, started }: { snapshot: Snapshot; vehicle: Vehicle; abnormal: boolean; dual: boolean; transparent: boolean; resetVersion: number; operation: Operation | null; started: boolean }) {
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const update = useRef<() => void>(() => {}), reset = useRef<() => void>(() => {});
  const latest = useRef({snapshot,abnormal,dual,operation,started}); latest.current = {snapshot,abnormal,dual,operation,started};
  const transparentRef = useRef(false), [failed,setFailed] = useState(false);
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
    const frameMat=mat(0x35586a,.65), railMat=mat(0x5d899a,.7), boxMat=mat(0x39758b,.22);
    const box=(parent:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material) => {const g=new THREE.BoxGeometry(w,h,d);geometries.push(g);const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
    const tracks=new THREE.Group();scene.add(tracks);
    const makeTrack=(lane:number) => { for(const x of [-.86,.86]) box(tracks,.09,.12,15,lane+x,0,0,railMat); for(let i=-18;i<=18;i++) box(tracks,2.2,.08,.18,lane,-.09,i*.4,frameMat); };
    makeTrack(0); if(dual)makeTrack(4.6);
    const container=new THREE.Group();scene.add(container);
    const carGroups=[new THREE.Group(),new THREE.Group()];scene.add(carGroups[0]);if(dual)scene.add(carGroups[1]);carGroups[1].position.x=4.6;
    const anchors=[[-1.14,-2.94],[1.14,-2.94],[-1.14,2.94],[1.14,2.94]];
    const lockGroups=[new THREE.Group(),new THREE.Group()];scene.add(lockGroups[0]);if(dual)scene.add(lockGroups[1]);lockGroups[1].position.x=4.6;
    let lockModels: ReturnType<typeof createModel>[][]=[];
    const loader=new GLTFLoader();
    const loadCad = (name:string, material:THREE.Material, groups:THREE.Group[]) => loader.loadAsync(`${import.meta.env.BASE_URL}assets/${name}`).then(gltf=>{
      if(!active)return;
      gltf.scene.traverse(item=>{if(item instanceof THREE.Mesh){
        if(!item.geometry.attributes.normal)item.geometry.computeVertexNormals();
        geometries.push(item.geometry); groups.forEach(group=>{const mesh=new THREE.Mesh(item.geometry,material);group.add(mesh);});
      }});render();
    });
    Promise.all([
      loadCad('flatcar-cad.glb',frameMat,dual?carGroups:[carGroups[0]]),
      loadCad('container-cad.glb',boxMat,[container]),
      loadLock().then(asset=>{if(!active)return;lockModels=(dual?lockGroups:[lockGroups[0]]).map(group=>anchors.map(([x,z],i)=>{const model=createModel(asset);model.group.rotation.y=LOCK_ORIENTATIONS[i];model.group.scale.setScalar(.00165);model.group.position.set(x,.635,z);group.add(model.group);return model;}));render();}),
    ]).catch(()=>{if(active)setFailed(true);});
    const world=new THREE.Vector3();
    const render=()=>{if(!active)return; const r=element.getBoundingClientRect();if(!r.width||!r.height)return;
      const s=latest.current.snapshot;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();
      if (boxMat.transparent !== transparentRef.current) { boxMat.transparent=transparentRef.current; boxMat.needsUpdate=true; }
      boxMat.opacity=transparentRef.current ? .12 : 1;boxMat.depthWrite=!transparentRef.current;
      boxMat.color.set(transparentRef.current ? 0xffffff : 0x39758b);
      const bottom=containerBottom(s,latest.current.operation,latest.current.started);
      container.position.set(dual?s.transfer*4.6:0,bottom,0);container.rotation.y=THREE.MathUtils.degToRad(s.rotation * 6);
      const activeLane=dual && s.transfer>=1 ? 1 : 0;
      lockModels.forEach((models,lane)=>models.forEach((model,i)=>model.update(lane===activeLane?s.surfaces[i]:'无',lane===activeLane&&(latest.current.abnormal || s.jam&&i===0),lane!==activeLane)));
      renderer.render(scene,camera);
      anchors.forEach(([x,z],i)=>{world.set(x+activeLane*4.6,.83,z).project(camera);const marker=element.querySelector<HTMLElement>(`[data-lock-anchor="${i}"]`);if(marker){marker.style.left=`${(world.x+1)*r.width/2}px`;marker.style.top=`${(1-world.y)*r.height/2}px`;}});
      element.dispatchEvent(new Event('lock-anchors-updated'));
    };
    update.current=render;reset.current=()=>{controls.reset();render();};controls.addEventListener('change',render);
    const observer=new ResizeObserver(render);observer.observe(element);render();
    return()=>{active=false;observer.disconnect();controls.dispose();lockModels.flat().forEach(m=>m.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());renderer.dispose();update.current=()=>{};reset.current=()=>{};};
  },[dual]);
  useEffect(()=>{update.current();},[snapshot,abnormal,transparent,operation,started]);
  useEffect(()=>{reset.current();},[resetVersion]);
  return <div className="scene3d" ref={host} aria-label={`三维作业画面 ${vehicle.id}`}><canvas ref={canvas}/>{[0,1,2,3].map(i=><span key={i} className="scene3d-anchor" data-lock-anchor={i}/>)}{failed && <div className="scene3d-error">三维模型加载失败</div>}</div>;
}
