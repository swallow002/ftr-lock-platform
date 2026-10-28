export type ModuleId = 'loading' | 'inspection' | 'transfer' | 'transit' | 'unloading' | 'devices';
export type Operation = 'loading' | 'transfer-unload' | 'transfer-load' | 'unloading';
export type DeviceFilter = 'all' | 'normal' | 'abnormal' | 'offline';
export type Surface = '无' | '落箱上导向斜面' | '落箱下导向斜面' | '重力面' | '提箱导向面' | '提箱阻挡面';
import railway from './railRoute.json';

export interface LockDevice { id: string; vehicleId: string; battery: number; online: boolean; abnormal: boolean; lat: number; lng: number; signal: number; lastSeen: number; }
export interface Vehicle { id: string; container: string; locks: LockDevice[]; }
export interface Stage { name: string; instruction: string; duration: number; }
export interface Snapshot {
  stage: number; phase: string; instruction: string; distance: number; unit: string; angle: number;
  force: number[]; surfaces: Surface[]; progress: number; containerHeight: number;
  rotation: number; transfer: number; jam: boolean; jamProgress: number; complete: boolean;
}

export const MODULES: { id: ModuleId; label: string; en: string; description: string }[] = [
  { id: 'loading', label: '装车指引', en: 'LOADING GUIDANCE', description: '四点感知 · 精准落箱' },
  { id: 'inspection', label: '途中货检', en: 'CARGO INSPECTION', description: '受力分析 · 异常定位' },
  { id: 'transfer', label: '换轨吊装', en: 'RAIL TRANSFER', description: '双轨协同 · 智能换装' },
  { id: 'transit', label: '途中监管', en: 'IN-TRANSIT MONITORING', description: '位置追踪 · 全程感知' },
  { id: 'unloading', label: '卸车指引', en: 'UNLOADING GUIDANCE', description: '卡阻识别 · 安全提箱' },
  { id: 'devices', label: '设备管理', en: 'DEVICE MANAGEMENT', description: '设备定位 · 状态总览' },
];

const identifier = (n: number) => `F-TR-${String(n).padStart(n < 5 ? 2 : 3, '0')}`;
const sessionStart = Date.now();
// Vehicle centres follow an existing railway segment; four corners stay only metres apart.
const regionalNodes = [1, 4, 8, 11, 16, 20, 24, 29, 32, 36, 42, 47, 52, 56, 60];
function deviceLocation(vehicle: number, corner: number) {
  if (vehicle >= regionalNodes.length) return {lat: 41.874444 + (Math.floor(vehicle / 3) - 2) * .005, lng: 123.269722 + (vehicle % 10 - 4) * .004};
  const index = regionalNodes[vehicle], points = railway.coordinates;
  const [lng, lat] = points[index], [nextLng, nextLat] = points[Math.min(index + 1, points.length - 1)];
  const east = (nextLng - lng) * Math.cos(lat * Math.PI / 180), north = nextLat - lat, len = Math.hypot(east, north) || 1;
  const along = corner < 2 ? -7 : 7, side = corner % 2 ? 1.25 : -1.25;
  const dx = along * east / len + side * north / len, dy = along * north / len - side * east / len;
  return {lat: lat + dy / 111320, lng: lng + dx / (111320 * Math.cos(lat * Math.PI / 180))};
}

export const FLEET: Vehicle[] = Array.from({ length: 110 }, (_, v) => {
  const id = `X70 ${5306203 + v}`;
  return {
    id, container: `TBLU ${274041 + v * 7}`,
    locks: Array.from({ length: 4 }, (_, corner) => {
      const n = v * 4 + corner;
      return {
        id: identifier(n + 1), vehicleId: id,
        battery: Math.min(98, 62 + (v * 7 % 34) + [0, -1, 1, 0][corner]),
        online: ![55, 56, 57].includes(n), abnormal: [55, 56, 57].includes(n),
        signal: -55 - (n * 7 % 32), lastSeen: sessionStart - (n % 13 + 2) * 60000,
        ...deviceLocation(v, corner),
      };
    }),
  };
});
export const DEMO_TRAIN = FLEET.slice(0, 55);
// Target vehicles are a separate train and are not part of the 440-device fleet.
export const TARGET_TRAIN: Vehicle[] = DEMO_TRAIN.map((vehicle, index) => {
  const id = `NX70 ${6306203 + index}`;
  return { ...vehicle, id, locks: vehicle.locks.map((lock, i) => ({ ...lock, id: `T-${String(index * 4 + i + 1).padStart(3, '0')}`, vehicleId: id })) };
});
export const REGIONAL_DEVICES = FLEET.flatMap(v => v.locks).slice(0, 58);
export const INSPECTION_VEHICLE = DEMO_TRAIN[6].id;

export function filterDevices(query: string, filter: DeviceFilter) {
  const q = query.trim().toUpperCase().replace(/\s/g, '');
  return REGIONAL_DEVICES.filter(d => {
    const match = !q || d.id.replace(/\s/g, '').includes(q) || d.vehicleId.replace(/\s/g, '').includes(q);
    return match && (filter === 'all' || filter === 'normal' && d.online && !d.abnormal || filter === 'abnormal' && d.abnormal || filter === 'offline' && !d.online);
  });
}

export const STAGES: Record<Operation, Stage[]> = {
  loading: [
    { name: '初次下降', instruction: '起升下降', duration: 6 },
    { name: '右旋调整', instruction: '吊架右旋', duration: 6 },
    { name: '再次下降', instruction: '起升下降', duration: 5 },
    { name: '左旋调整', instruction: '吊架左旋', duration: 7 },
    { name: '落箱完成', instruction: '吊钩松开', duration: 6 },
  ],
  'transfer-load': [],
  'transfer-unload': [
    { name: '开始提箱', instruction: '起升上升', duration: 10 },
    { name: '右旋调整', instruction: '吊架右旋', duration: 10 },
    { name: '起升离车', instruction: '起升上升', duration: 10 },
    { name: '跨轨移动', instruction: '移向目标车辆', duration: 5 },
  ],
  unloading: [
    { name: '开始提箱', instruction: '起升上升', duration: 8 },
    { name: '右旋调整', instruction: '吊架右旋', duration: 7 },
    { name: '卡阻识别', instruction: '检测卡阻', duration: 10 },
    { name: '卡阻处理', instruction: '吊架左旋', duration: 4 },
    { name: '完成提箱', instruction: '起升上升', duration: 6 },
  ],
};
STAGES['transfer-load'] = STAGES.loading;
export const operationDuration = (op: Operation) => STAGES[op].reduce((sum, s) => sum + s.duration, 0);
const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const all = <T,>(value: T): T[] => Array(4).fill(value);

export function operationSnapshot(op: Operation, time: number, started = true): Snapshot {
  const duration = operationDuration(op);
  const elapsed = clamp(time, 0, duration);
  const stages = STAGES[op];
  let stage = 0, start = 0;
  while (stage < stages.length - 1 && elapsed >= start + stages[stage].duration) { start += stages[stage].duration; stage++; }
  const p = clamp((elapsed - start) / stages[stage].duration);
  const snap: Snapshot = {
    stage, phase: stages[stage].name, instruction: stages[stage].instruction,
    distance: 0, unit: 'cm', angle: 0, force: all(0), surfaces: all<Surface>('无'),
    progress: elapsed / duration, containerHeight: .9, rotation: 0,
    transfer: op === 'transfer-load' ? 1 : 0, jam: false, jamProgress: 0, complete: elapsed >= duration,
  };
  const loading = op === 'loading' || op === 'transfer-load';
  if (loading) {
    const initial = op === 'transfer-load' ? 2.7 : 2.6;
    if (stage === 0) {
      snap.distance = initial * (1 - p); snap.containerHeight = lerp(.9, .6, p);
      snap.rotation = 0; snap.surfaces = all('落箱上导向斜面');
      snap.force = [23, 22, 22, 22].map(f => lerp(f, 35, p));
    } else if (stage === 1) {
      snap.angle = .34 * (1 - p); snap.rotation = .34 * p;
      snap.containerHeight = .6; snap.surfaces = all('落箱上导向斜面');
      snap.force = [56, 56, 58, 56].map(f => lerp(35, f, p));
    } else if (stage === 2) {
      snap.distance = 3.5 * (1 - p); snap.containerHeight = lerp(.6, .25, p); snap.rotation = .34;
    } else if (stage === 3) {
      snap.angle = .34 * (1 - p); snap.rotation = .34 * (1 - p);
      snap.containerHeight = lerp(.25, 0, p); snap.surfaces = all('落箱下导向斜面');
      snap.force = [15, 18, 16, 18].map((f, i) => lerp(f, i < 2 ? 62 : 63, p));
    } else {
      snap.containerHeight = 0; snap.surfaces = all('重力面');
      snap.force = [62, 62, 63, 63].map((f, i) => clamp(f + Math.sin(elapsed * 1.6 + i) * .22, 61, 63));
      if (elapsed - start >= 2) snap.instruction = '无';
    }
  } else {
    if (stage === 0) {
      snap.distance = 3.6 * (1 - p); snap.containerHeight = .16 * p;
      snap.surfaces = all(p < .15 ? '重力面' : '无');
      snap.force = p < .15 ? [62, 62, 63, 63] : all(0);
    } else if (stage === 1) {
      snap.angle = .34 * (1 - p); snap.rotation = .34 * p; snap.containerHeight = .16;
      snap.surfaces = all('提箱导向面');
      snap.force = (op === 'unloading' ? [56, 49, 52, 52] : [66, 63, 62, 65]).map(f => f * (1 - p));
    } else if (op === 'unloading' && stage === 2) {
      snap.rotation = .34; snap.containerHeight = .16;
      snap.surfaces = ['提箱阻挡面', '无', '无', '无']; snap.force = [63 * clamp((p - .8) / .2), 0, 0, 0];
      snap.jam = true; snap.jamProgress = p;
    } else if (op === 'unloading' && stage === 3) {
      snap.angle = .2 * (1 - p); snap.rotation = .34 - .2 * p; snap.containerHeight = .16;
      snap.surfaces = ['提箱阻挡面', '无', '无', '无']; snap.force = [63 * (1 - p), 0, 0, 0];
      snap.jam = true; snap.jamProgress = 1 + p;
    } else if (op === 'transfer-unload' && stage === 3) {
      snap.containerHeight = 1; snap.transfer = p; snap.rotation = .34;
      if (snap.complete) snap.instruction = '等待装车';
    } else {
      snap.distance = (op === 'transfer-unload' ? 5 : 5) * (1 - p);
      snap.unit = op === 'transfer-unload' ? 'm' : 'cm'; snap.containerHeight = lerp(.16, 1, p);
      snap.rotation = op === 'transfer-unload' ? .34 : .14;
      if (snap.complete) snap.instruction = '提箱完成';
    }
  }
  if (!started) {
    snap.phase = '待作业'; snap.instruction = '等待作业';
    snap.force = loading ? all(0) : [62, 62, 63, 63];
    snap.surfaces = all(loading ? '无' : '重力面');
    snap.containerHeight = loading ? .9 : 0;
    snap.rotation = 0;
  }
  return snap;
}

/** Container bottom elevation in metres, aligned to the CAD lock tips. */
export const LOCK_SUPPORT_HEIGHT = .635 + 30 * .00165;
export function containerBottom(s: Snapshot, operation: Operation | null, started: boolean): number {
  const tip = .635 + 120.515 * .00165;
  const resting = LOCK_SUPPORT_HEIGHT;
  if (!operation) return resting;
  if (operation === 'loading' || operation === 'transfer-load') {
    const first = operation === 'transfer-load' ? 2.7 : 2.6;
    const scale = (tip - resting) / (first + 3.5);
    if (!started) return tip;
    if (s.stage === 0) return tip - (first - s.distance) * scale;
    if (s.stage === 1) return tip - first * scale;
    if (s.stage === 2) return tip - (first + 3.5 - s.distance) * scale;
    return resting;
  }
  if (!started) return resting;
  const scale = (tip - resting) / 6.1;
  if (s.stage === 0) return resting + (3.6 - s.distance) * scale;
  const guided = resting + 3.6 * scale;
  if (operation === 'unloading' && s.stage < 4 || operation === 'transfer-unload' && s.stage === 1) return guided;
  if (operation === 'transfer-unload' && s.stage === 3) return guided + .65;
  return guided + (operation === 'transfer-unload' ? (5 - s.distance) * .13 : (5 - s.distance) * scale);
}

export function monitoringSnapshot(module: 'inspection' | 'transit', time: number, abnormal = false): Snapshot {
  const force = module === 'inspection' && abnormal ? [72, 73, 53, 53] : [63, 62, 62, 61];
  return {
    stage: 0, phase: abnormal ? '受力不均' : '正常运行', instruction: '无', distance: 0, unit: 'cm', angle: 0,
    force: force.map((v, i) => {
      const reading = v + Math.sin(time * .8 + i) * .24;
      return module === 'inspection' && abnormal ? i < 2 ? clamp(reading, 71, 73) : reading : clamp(reading, 61, 63);
    }), surfaces: all('重力面'),
    progress: 0, containerHeight: 0, rotation: 0, transfer: 0, jam: false, jamProgress: 0, complete: false,
  };
}

/** GeoJSON coordinates use longitude first; UI coordinates use latitude first. */
export type GeoPoint = [number, number];
export const TRANSIT_ROUTE = railway.coordinates as GeoPoint[];
const radians = (degrees: number) => degrees * Math.PI / 180;
export function segmentMeters(a: GeoPoint, b: GeoPoint) {
  const lat1 = radians(a[1]), lat2 = radians(b[1]);
  const dlat = lat2 - lat1, dlng = radians(b[0] - a[0]);
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(Math.sin(dlat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlng / 2) ** 2)));
}
const routeDistances = TRANSIT_ROUTE.reduce<number[]>((list, point, i) => { list.push(i ? list[i - 1] + segmentMeters(TRANSIT_ROUTE[i - 1], point) : 0); return list; }, []);
export const ROUTE_LENGTH = routeDistances[routeDistances.length - 1];
export interface TransitSnapshot { position: [number, number]; completed: GeoPoint[]; remaining: GeoPoint[]; heading: number; speed: number; arrived: boolean; distance: number; }
export function transitSnapshot(time: number): TransitSnapshot {
  const seconds = Math.max(0, time);
  const distance = Math.min(ROUTE_LENGTH, ROUTE_LENGTH * .25 + (92 * seconds + 6 * (1 - Math.cos(seconds * .2))) / 3.6);
  let i = 0;
  while (i < routeDistances.length - 2 && routeDistances[i + 1] < distance) i++;
  const span = routeDistances[i + 1] - routeDistances[i];
  const fraction = span ? clamp((distance - routeDistances[i]) / span) : 0;
  const a = TRANSIT_ROUTE[i], b = TRANSIT_ROUTE[i + 1];
  const point: GeoPoint = [lerp(a[0], b[0], fraction), lerp(a[1], b[1], fraction)];
  const heading = (Math.atan2((b[0] - a[0]) * Math.cos(radians(point[1])), b[1] - a[1]) * 180 / Math.PI + 360) % 360;
  const arrived = distance >= ROUTE_LENGTH;
  return { position: [point[1], point[0]], completed: [...TRANSIT_ROUTE.slice(0, i + 1), point], remaining: [point, ...TRANSIT_ROUTE.slice(i + 1)], heading, speed: arrived ? 0 : 92 + Math.sin(seconds * .2) * 1.2, arrived, distance };
}
export const transitPosition = (time: number): [number, number] => transitSnapshot(time).position;

export function deviceForce(device: LockDevice, time: number) {
  const seed = Number(device.id.split('-').pop()) || 0;
  return Math.max(61, Math.min(63, 62 + Math.sin(time * .45 + seed * .7) * .8));
}
export function forceHistory(devices: LockDevice[], time: number) {
  const active = devices.filter(d => d.online);
  return Array.from({ length: 60 }, (_, i) => active.length ? active.reduce((n, d) => n + deviceForce(d, time - (59 - i)), 0) / active.length : null);
}

export function coordinates(lat: number, lng: number) {
  const dms = (value: number, axis: 'lat' | 'lng') => {
    const abs = Math.abs(value), d = Math.floor(abs), m = Math.floor((abs - d) * 60);
    const s = Math.floor(((abs - d) * 60 - m) * 60);
    return `${d}°${String(m).padStart(2, '0')}′${String(s).padStart(2, '0')}″${axis === 'lat' ? value >= 0 ? 'N' : 'S' : value >= 0 ? 'E' : 'W'}`;
  };
  return `${dms(lat, 'lat')}  ${dms(lng, 'lng')}`;
}
