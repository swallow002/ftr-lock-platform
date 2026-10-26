export type ModuleId = 'loading' | 'inspection' | 'transfer' | 'transit' | 'unloading' | 'devices';
export type Operation = 'loading' | 'transfer-unload' | 'transfer-load' | 'unloading';
export type DeviceFilter = 'all' | 'normal' | 'abnormal' | 'offline';
export type Surface = '无' | '落箱上导向斜面' | '落箱下导向斜面' | '重力面' | '提箱导向面' | '提箱阻挡面';
export interface LockDevice { id: string; vehicleId: string; battery: number; online: boolean; abnormal: boolean; lat: number; lng: number; }
export interface Vehicle { id: string; container: string; locks: LockDevice[]; }
export interface Stage { name: string; instruction: string; duration: number; }
export interface Snapshot {
  stage: number; phase: string; instruction: string; distance: number; unit: string; angle: number;
  force: number[]; surfaces: Surface[]; progress: number; containerHeight: number;
  rotation: number; transfer: number; jam: boolean; complete: boolean;
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
export const FLEET: Vehicle[] = Array.from({ length: 110 }, (_, v) => {
  const id = `X70 ${5306203 + v}`;
  return {
    id, container: `TBLU ${274041 + v * 7}`,
    locks: Array.from({ length: 4 }, (_, corner) => {
      const n = v * 4 + corner;
      return {
        id: identifier(n + 1), vehicleId: id,
        battery: n === 25 ? 62 : n < 4 ? [86, 84, 85, 86][corner] : 60 + (n * 7) % 38,
        online: ![55, 56, 57].includes(n), abnormal: [55, 56, 57].includes(n),
        lat: 41.874444 + (Math.floor(n / 10) - 2) * .005 + Math.sin(n * 2.4) * .0015,
        lng: 123.269722 + (n % 10 - 4) * .004 + Math.cos(n * 1.7) * .001,
      };
    }),
  };
});
export const DEMO_TRAIN = FLEET.slice(0, 13);
export const REGIONAL_DEVICES = FLEET.flatMap(v => v.locks).slice(0, 58);
export const INSPECTION_VEHICLE = DEMO_TRAIN[0].id;

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
    { name: '卡阻处理', instruction: '吊架左旋', duration: 9 },
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
    transfer: op === 'transfer-load' ? 1 : 0, jam: false, complete: elapsed >= duration,
  };
  const loading = op === 'loading' || op === 'transfer-load';
  if (loading) {
    const initial = op === 'transfer-load' ? 2.7 : 2.6;
    if (stage === 0) {
      snap.distance = initial * (1 - p); snap.containerHeight = lerp(.9, .6, p);
      snap.rotation = 2.8; snap.surfaces = all('落箱上导向斜面');
      snap.force = [23, 22, 22, 22].map(f => lerp(f, 35, p));
    } else if (stage === 1) {
      snap.angle = .34 * (1 - p); snap.rotation = 2.8 * (1 - p);
      snap.containerHeight = .6; snap.surfaces = all('落箱上导向斜面');
      snap.force = [56, 56, 58, 56].map(f => lerp(35, f, p));
    } else if (stage === 2) {
      snap.distance = 3.5 * (1 - p); snap.containerHeight = lerp(.6, .25, p);
    } else if (stage === 3) {
      snap.angle = .34 * (1 - p); snap.rotation = -2 * (1 - p);
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
      snap.angle = .34 * (1 - p); snap.rotation = 2.8 * p; snap.containerHeight = .16;
      snap.surfaces = all('提箱导向面');
      snap.force = (op === 'unloading' ? [56, 49, 52, 52] : [66, 63, 62, 65]).map(f => f * (1 - p));
    } else if (op === 'unloading' && stage === 2) {
      snap.angle = .2 * (1 - p); snap.rotation = 2.8 * (1 - p); snap.containerHeight = .16;
      snap.surfaces = ['提箱阻挡面', '无', '无', '无']; snap.force = [63 * (1 - p), 0, 0, 0];
      snap.jam = p < .9;
    } else if (op === 'transfer-unload' && stage === 3) {
      snap.containerHeight = 1; snap.transfer = p;
      if (snap.complete) snap.instruction = '等待装车';
    } else {
      snap.distance = (op === 'transfer-unload' ? 5 : 5) * (1 - p);
      snap.unit = op === 'transfer-unload' ? 'm' : 'cm'; snap.containerHeight = lerp(.16, 1, p);
      if (snap.complete) snap.instruction = '提箱完成';
    }
  }
  if (!started) {
    snap.phase = '待作业'; snap.instruction = '等待作业';
    snap.force = loading ? all(0) : [62, 62, 63, 63];
    snap.surfaces = all(loading ? '无' : '重力面');
    snap.containerHeight = loading ? .9 : 0;
    snap.rotation = loading ? 2.8 : 0;
  }
  return snap;
}

export function monitoringSnapshot(module: 'inspection' | 'transit', time: number, abnormal = false): Snapshot {
  const force = module === 'inspection' && abnormal ? [72, 73, 53, 53] : [63, 62, 62, 61];
  return {
    stage: 0, phase: abnormal ? '受力不均' : '正常运行', instruction: '无', distance: 0, unit: 'cm', angle: 0,
    force: force.map((v, i) => {
      const reading = v + Math.sin(time * .8 + i) * .24;
      return module === 'inspection' && abnormal ? i < 2 ? clamp(reading, 71, 73) : reading : clamp(reading, 61, 63);
    }), surfaces: all('重力面'),
    progress: 0, containerHeight: 0, rotation: 0, transfer: 0, jam: false, complete: false,
  };
}

export const TRANSIT_ROUTE: [number, number][] = [
  [32.144722, 118.883611], [32.150, 118.894], [32.159, 118.908],
  [32.165, 118.923], [32.170, 118.941], [32.176, 118.951],
];
export function transitPosition(time: number): [number, number] {
  // A return journey avoids teleporting at the end of the demonstration route.
  const phase = (time % 720) / 360;
  const position = (phase > 1 ? 2 - phase : phase) * (TRANSIT_ROUTE.length - 1);
  const i = Math.min(Math.floor(position), TRANSIT_ROUTE.length - 2);
  const p = position - i;
  return [lerp(TRANSIT_ROUTE[i][0], TRANSIT_ROUTE[i + 1][0], p), lerp(TRANSIT_ROUTE[i][1], TRANSIT_ROUTE[i + 1][1], p)];
}

export function coordinates(lat: number, lng: number) {
  const dms = (value: number, axis: 'lat' | 'lng') => {
    const abs = Math.abs(value), d = Math.floor(abs), m = Math.floor((abs - d) * 60);
    const s = Math.floor(((abs - d) * 60 - m) * 60);
    return `${d}°${String(m).padStart(2, '0')}′${String(s).padStart(2, '0')}″${axis === 'lat' ? value >= 0 ? 'N' : 'S' : value >= 0 ? 'E' : 'W'}`;
  };
  return `${dms(lat, 'lat')}  ${dms(lng, 'lng')}`;
}
