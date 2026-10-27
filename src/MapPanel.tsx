import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin, RefreshCw } from 'lucide-react';
import { TRANSIT_ROUTE, REGIONAL_DEVICES, type LockDevice, type TransitSnapshot } from './data';
setWorkerUrl(workerUrl);
interface Props { devices?: LockDevice[]; selectedId?: string; onSelect?: (id: string) => void; transit?: TransitSnapshot; compact?: boolean }
export default function MapPanel({ devices, selectedId, onSelect, transit, compact = false }: Props) {
  const host = useRef<HTMLDivElement>(null), map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]), train = useRef<maplibregl.Marker | null>(null);
  const previousSelection = useRef(selectedId);
  const latest = useRef({ devices, selectedId, onSelect, transit }); latest.current = { devices, selectedId, onSelect, transit };
  const [failed, setFailed] = useState(false), [ready, setReady] = useState(false), [attempt, setAttempt] = useState(0), [zoom, setZoom] = useState(12);
  const isTransit = !devices;
  useEffect(() => {
    if (!host.current) return;
    let m: maplibregl.Map;
    setReady(false);
    try {
      m = new maplibregl.Map({ container: host.current, style: 'https://tiles.openfreemap.org/styles/dark', center: TRANSIT_ROUTE[0], zoom: 12, attributionControl: false });
    } catch { setFailed(true); return; }
    map.current = m; m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    let loaded = false;
    const timeout = window.setTimeout(() => { if (!loaded) setFailed(true); }, 12000);
    m.on('load', () => {
      loaded = true; setFailed(false);
      if (m.getLayer('background')) m.setPaintProperty('background', 'background-color', '#0a2030');
      if (m.getLayer('water')) m.setPaintProperty('water', 'fill-color', '#102e3d');
      if (m.getLayer('landuse_residential')) m.setPaintProperty('landuse_residential', 'fill-color', '#102938');
      if (m.getLayer('landuse_park')) m.setPaintProperty('landuse_park', 'fill-color', '#153441');
      if (isTransit) {
        const current = latest.current.transit;
        for (const [id, color] of [['completed', '#83929d'], ['remaining', '#36d4df']]) {
          m.addSource(id, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: current?.[id as 'completed' | 'remaining'] ?? TRANSIT_ROUTE } } });
          m.addLayer({ id, type: 'line', source: id, paint: { 'line-color': color, 'line-width': 4, 'line-opacity': .9 } });
        }
        const bounds = new maplibregl.LngLatBounds(); TRANSIT_ROUTE.forEach(p => bounds.extend(p)); m.fitBounds(bounds, { padding: 28, duration: 0, maxZoom: 13 });
        const el = document.createElement('div'); el.className = 'train-map-marker'; el.title = '运行列车'; el.innerHTML = '<span>➤</span>';
        train.current = new maplibregl.Marker({ element: el }).setLngLat(current ? [current.position[1], current.position[0]] : TRANSIT_ROUTE[0]).addTo(m);
      }
      if (!isTransit) {
        const bounds = new maplibregl.LngLatBounds(); REGIONAL_DEVICES.forEach(d => bounds.extend([d.lng,d.lat]));
        m.jumpTo({center: bounds.getCenter(), zoom: 13});
      }
      setZoom(m.getZoom()); m.on('zoomend', () => setZoom(m.getZoom()));
      setReady(true);
    });
    const observer = new ResizeObserver(() => m.resize()); observer.observe(host.current);
    return () => { clearTimeout(timeout); observer.disconnect(); markers.current.forEach(marker => marker.remove()); markers.current = []; train.current = null; m.remove(); map.current = null; };
  }, [isTransit, attempt]);
  useEffect(() => {
    const m = map.current; if (!ready || !m || !devices) return;
    markers.current.forEach(marker => marker.remove());
    const grouped = new Map<string, LockDevice[]>();
    devices.forEach(d => grouped.set(d.vehicleId, [...(grouped.get(d.vehicleId) ?? []), d]));
    const icon = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 25h26l-1.5-3h-6l-1-4 4-3-1-3-8-8c-1.5-1.5-3-1-3 1v5l2 3-4 4v5H5z" fill="currentColor" stroke="currentColor" stroke-linejoin="round"/></svg>';
    if (zoom < 17) {
      markers.current = [...grouped.entries()].map(([vehicle, group]) => {
        const el = document.createElement('button'); el.type='button'; el.className=`map-lock-group ${group.some(d=>d.abnormal)?'offline':''} ${group.some(d=>d.id===selectedId)?'selected':''}`;
        el.innerHTML=icon+`<span>${group.length}</span>`; el.title=`${vehicle} · ${group.length} 把锁`; el.setAttribute('aria-label',`查看车辆 ${vehicle} 的锁具`);
        const lng=group.reduce((n,d)=>n+d.lng,0)/group.length, lat=group.reduce((n,d)=>n+d.lat,0)/group.length;
        el.onclick=()=>m.easeTo({center:[lng,lat],zoom:20,duration:500});
        return new maplibregl.Marker({element:el}).setLngLat([lng,lat]).addTo(m);
      });
    } else {
      markers.current = devices.map(d => {
        const el = document.createElement('button'); el.type = 'button'; el.className = `map-device-marker ${d.abnormal ? 'offline' : ''} ${d.id === selectedId ? 'selected' : ''}`;
        el.innerHTML=icon; el.title = `${d.id} · ${d.online ? '在线' : '离线异常'}`; el.setAttribute('aria-label', `地图设备 ${d.id}`); el.onclick = () => latest.current.onSelect?.(d.id);
        return new maplibregl.Marker({ element: el }).setLngLat([d.lng, d.lat]).addTo(m);
      });
    }
  }, [devices, selectedId, ready, zoom]);
  useEffect(() => {
    const m=map.current; if (!ready || !m || !devices) return;
    if (selectedId !== previousSelection.current) {
      previousSelection.current=selectedId;
      const selected=devices.find(d=>d.id===selectedId);
      if (selected && !m.getBounds().contains([selected.lng,selected.lat])) m.panTo([selected.lng,selected.lat]);
    }
  }, [selectedId, devices, ready]);
  useEffect(() => {
    const m = map.current; if (!ready || !m || !transit) return;
    for (const id of ['completed', 'remaining'] as const) (m.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: transit[id] } });
    train.current?.setLngLat([transit.position[1], transit.position[0]]);
    const arrow = train.current?.getElement().querySelector('span'); if (arrow) arrow.style.transform = `rotate(${transit.heading - 90}deg)`;
  }, [transit, ready]);
  return <div className={`map-shell ${compact ? 'compact-map' : ''}`}><div ref={host} className="leaflet-host" aria-label={isTransit ? '列车运行地图' : '区域设备地图'}/><div className="map-label"><MapPin size={12}/>{isTransit ? '列车运行轨迹' : '区域设备分布'}</div>{!isTransit && <button className="map-reset-view" onClick={() => {const bounds=new maplibregl.LngLatBounds(); REGIONAL_DEVICES.forEach(d=>bounds.extend([d.lng,d.lat])); map.current?.easeTo({center:bounds.getCenter(),zoom:13,duration:400});}}>全区域</button>}<div className="map-attribution"><a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · <a href="https://openmaptiles.org" target="_blank" rel="noreferrer">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></div>{failed && <div className="map-fallback" role="status"><MapPin size={16}/><span>地图加载失败</span><button aria-label="重新加载地图" onClick={() => { setFailed(false); setAttempt(n => n + 1); }}><RefreshCw size={13}/></button></div>}</div>;
}
