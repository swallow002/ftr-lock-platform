import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, RefreshCw } from 'lucide-react';
import { TRANSIT_ROUTE, type LockDevice } from './data';

interface Props {
  devices?: LockDevice[]; selectedId?: string; onSelect?: (id: string) => void;
  position?: [number, number]; compact?: boolean;
}

export default function MapPanel({ devices, selectedId, onSelect, position, compact = false }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const train = useRef<L.Marker | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const callbacks = useRef({ onSelect }); callbacks.current = { onSelect };
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const transit = !devices;
  useEffect(() => {
    if (!container.current) return;
    const center: [number, number] = transit ? TRANSIT_ROUTE[0] : [41.877, 123.273];
    const m = L.map(container.current, { center, zoom: transit ? 12 : 13, zoomControl: false, attributionControl: true });
    map.current = m;
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    const tile = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    }).addTo(m);
    tiles.current = tile;
    let successful = false;
    tile.on('tileload', () => { successful = true; setLoaded(true); setFailed(false); });
    tile.on('tileerror', () => { if (!successful) setFailed(true); });
    const timer = window.setTimeout(() => { if (!successful) setFailed(true); }, 12000);
    layer.current = L.layerGroup().addTo(m);
    if (transit) {
      L.polyline(TRANSIT_ROUTE, { color: '#15384c', weight: 9, opacity: .6 }).addTo(m);
      L.polyline(TRANSIT_ROUTE, { color: '#1dbaca', weight: 3, dashArray: '7 6' }).addTo(m);
      const icon = L.divIcon({ className: 'train-map-icon', html: '<span>↗</span>', iconSize: [28, 28], iconAnchor: [14, 14] });
      train.current = L.marker(center, { icon, keyboard: true, title: '模拟运行列车' }).addTo(m);
      m.fitBounds(L.latLngBounds(TRANSIT_ROUTE).pad(.15));
    }
    const observer = new ResizeObserver(() => m.invalidateSize()); observer.observe(container.current);
    return () => { clearTimeout(timer); observer.disconnect(); m.remove(); map.current = null; layer.current = null; train.current = null; };
  }, [transit]);
  useEffect(() => {
    const group = layer.current;
    if (!group || !devices) return;
    group.clearLayers();
    devices.forEach(d => {
      const selected = d.id === selectedId;
      const color = d.abnormal ? '#ff6974' : '#32c5d2';
      if (selected) L.circleMarker([d.lat, d.lng], { radius: 13, color: '#efc46c', weight: 2, fillOpacity: .08, interactive: false }).addTo(group);
      const marker = L.circleMarker([d.lat, d.lng], { radius: selected ? 7 : 5, color, fillColor: color, fillOpacity: .9, weight: 2 });
      marker.bindTooltip(`${d.id} · ${d.online ? '在线' : '离线异常'}`, { direction: 'top' });
      marker.on('click', () => callbacks.current.onSelect?.(d.id));
      marker.on('add', () => {
        const element = marker.getElement();
        element?.setAttribute('role', 'button');
        element?.setAttribute('tabindex', '0');
        element?.setAttribute('aria-label', `地图设备 ${d.id}`);
        element?.addEventListener('keydown', event => {
          const key = (event as KeyboardEvent).key;
          if (key === 'Enter' || key === ' ') { event.preventDefault(); callbacks.current.onSelect?.(d.id); }
        });
      });
      marker.addTo(group);
    });
    const selected = devices.find(d => d.id === selectedId);
    if (selected && map.current && !map.current.getBounds().contains([selected.lat, selected.lng])) map.current.panTo([selected.lat, selected.lng]);
  }, [devices, selectedId]);
  useEffect(() => {
    if (position && train.current) train.current.setLatLng(position);
  }, [position]);
  return <div className={`map-shell ${compact ? 'compact-map' : ''}`}>
    <div ref={container} className="leaflet-host" aria-label={transit ? '列车模拟运行地图' : '区域设备地图'}/>
    <div className="map-label"><MapPin size={12}/>{transit ? '列车模拟轨迹' : '区域设备分布'}<span>OSM</span></div>
    {failed && !loaded && <div className="map-fallback" role="status"><MapPin size={16}/><span>底图暂未加载，模拟点位及详情可继续查看</span><button aria-label="重新加载地图" onClick={() => { setFailed(false); tiles.current?.redraw(); window.setTimeout(() => setFailed(true), 12000); }}><RefreshCw size={13}/></button></div>}
    <div className="map-coordinate-label">真实底图 / 模拟数据</div>
  </div>;
}
