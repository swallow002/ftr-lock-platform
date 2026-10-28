import { useEffect, useState } from 'react';
import { Activity, ArrowDown, ArrowDownToLine, ArrowLeftRight, ArrowRight, ArrowUp, Check, CheckCheck, Clock3, Cpu, Expand, LockKeyhole, LogOut, MapPin, Navigation, Pause, Play, Radio, RotateCcw, RotateCw, ShieldCheck, Signal, TrainFront, TriangleAlert } from 'lucide-react';
import { coordinates, DEMO_TRAIN, TARGET_TRAIN, INSPECTION_VEHICLE, MODULES, monitoringSnapshot, operationDuration, operationSnapshot, STAGES, transitSnapshot, type TransitSnapshot, type ModuleId, type Operation, type Snapshot, type Vehicle } from './data';
import Scene3D from './Scene3D';
import { CornerLocks, JamModel } from './LockModels';
import DeviceManagement from './DeviceManagement';
import MapPanel from './MapPanel';
import { usePlayback } from './usePlayback';

const navIcons = [ArrowDownToLine, ShieldCheck, ArrowLeftRight, Navigation, ArrowUp, Cpu];

function Brand({ large = false }: { large?: boolean }) {
  return <div className={`brand ${large ? 'large-brand' : ''}`}><div className="brand-emblem"><span>F</span><i/></div><div><h1>智能 <span>F-TR</span> 锁管控平台</h1><p>INTELLIGENT LOCK CONTROL PLATFORM</p></div></div>;
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  return <main className="login-page">
    <header className="login-header"><Brand/><div className="login-header-status"><i/>系统就绪</div></header>
    <div className="login-content">
      <section className="login-intro"><div className="login-title"><div className="eyebrow"><span/> INTELLIGENT LOCK CONTROL</div><h2><span>智能 F-TR 锁</span><br/>管控平台</h2></div>
        <div className="login-scene"><div className="login-scene-grid" aria-hidden="true"/><div className="login-scene-corners" aria-hidden="true"/><div className="login-scene-line" aria-hidden="true"/><Scene3D hero snapshot={monitoringSnapshot('transit', 0)} vehicle={DEMO_TRAIN[0]} abnormal={false} dual={false} transparent resetVersion={0} operation={null} started/></div>
      </section>
      <div className="login-capabilities" aria-label="平台功能"><div className="capabilities-heading"><span>PLATFORM STATUS</span><i/></div><div className="capabilities-list"><div><span className="capability-icon"><Activity size={17}/></span><span><strong>受力监测</strong><small>LOAD MONITORING</small></span></div><div><span className="capability-icon"><ArrowLeftRight size={17}/></span><span><strong>作业指引</strong><small>OPERATION GUIDANCE</small></span></div><div><span className="capability-icon"><Cpu size={17}/></span><span><strong>设备管理</strong><small>DEVICE MANAGEMENT</small></span></div></div></div>
      <section className="login-card"><div className="login-card-line"/><div className="eyebrow">F-TR CONTROL CENTER</div><h2>系统登录</h2>
        <form onSubmit={e => { e.preventDefault(); onLogin(); }}>
          <label htmlFor="username">账号<span>ACCOUNT</span></label><div className="login-input"><Cpu size={17}/><input id="username" autoComplete="off" defaultValue="operator" aria-label="账号"/></div>
          <label htmlFor="password">密码<span>PASSWORD</span></label><div className="login-input"><LockKeyhole size={17}/><input id="password" type={showPassword ? 'text' : 'password'} autoComplete="off" defaultValue="ftr-control" aria-label="密码"/><button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)}>{showPassword ? '隐藏' : '显示'}</button></div>
          <button className="login-submit" type="submit">登录<ArrowRight size={19}/></button>
        </form>
        <div className="login-card-footer"><span><i/>系统就绪</span><span>V2.3</span></div>
      </section>
    </div>
    <footer className="login-school-footer"><div className="login-school-inner"><strong className="login-company">南京智锁通轨道科技有限公司</strong><span>F-TR LOCK CONTROL PLATFORM</span></div></footer>
  </main>;
}

function Header({ onLogout }: { onLogout: () => void }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const id = window.setInterval(() => setTime(new Date()), 1000); return () => clearInterval(id); }, []);
  const [full, setFull] = useState(Boolean(document.fullscreenElement));
  useEffect(() => { const onChange = () => setFull(Boolean(document.fullscreenElement)); document.addEventListener('fullscreenchange', onChange); return () => document.removeEventListener('fullscreenchange', onChange); }, []);
  const toggleFull = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* Browser may disallow fullscreen; the layout stays usable. */ } };
  return <header className="app-header"><Brand/><div className="header-right"><div className="header-clock"><strong>{time.toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}</strong><span>{time.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })} · 北京时间</span></div><button className="icon-button fullscreen-button" onClick={toggleFull} aria-label={full ? '退出全屏' : '全屏'} title="全屏"><Expand size={18}/></button><button className="icon-button" onClick={onLogout} aria-label="退出登录" title="退出登录"><LogOut size={18}/></button></div></header>;
}

function Stat({ label, value, unit, danger = false, icon }: { label: string; value: string | number; unit?: string; danger?: boolean; icon?: React.ReactNode }) {
  return <div className={`stat-item ${danger ? 'danger' : ''}`}><div className="stat-label">{label}{icon}</div><div className="stat-value">{value}<small>{unit}</small></div></div>;
}

function VehicleStrip({ current, onSelect, inspection = false, target = false, transfer = false }: { current: number; onSelect: (index: number) => void; inspection?: boolean; target?: boolean; transfer?: boolean }) {
  const vehicles = target ? TARGET_TRAIN : DEMO_TRAIN;
  const label = target ? '目标列车' : transfer ? '来源列车' : '当前列车';
  return <section className="vehicle-strip" aria-label={`${label}车辆选择`}><div className="vehicle-strip-label"><TrainFront size={17}/><div><strong>{label}</strong><span>{`${vehicles.length} 辆 / ${vehicles.reduce((total, item) => total + item.locks.length, 0)} 把锁`}</span></div></div><div className="vehicle-scroll">
    {vehicles.map((v, i) => <button key={v.id} className={`vehicle-button ${current === i ? 'selected' : ''} ${inspection && v.id === INSPECTION_VEHICLE ? 'has-alert' : ''}`} onClick={() => onSelect(i)} aria-label={`选择${label}车辆 ${v.id}`} aria-pressed={current === i}>
      <span className="vehicle-order">{String(i + 1).padStart(2, '0')}{inspection && v.id === INSPECTION_VEHICLE && <TriangleAlert size={9}/>}</span><span className="mini-container"><i/><i/><i/><i/><i/><i/><i/><i/></span><span className="mini-wheels"><i/><i/><i/><i/></span><span className="vehicle-number">{v.id.split(' ')[1]}</span>
    </button>)}
  </div></section>;
}

type JamFrame = { t: number; translation: [number,number,number]; angle: number; gap: number };
type JamMotion = { frames: JamFrame[]; contactPoint: [number,number,number] };
function JamOverlay({ snapshot, lockId }: { snapshot: Snapshot; lockId: string }) {
  const [motion, setMotion] = useState<JamMotion | null>(null);
  useEffect(() => { let active=true; fetch(`${import.meta.env.BASE_URL}assets/jam-motion.json`).then(r=>{if(!r.ok)throw new Error('motion');return r.json() as Promise<JamMotion>;}).then(data=>{if(active)setMotion(data);}).catch(()=>{}); return ()=>{active=false;}; }, []);
  const progress=snapshot.jamProgress, frame=motion?.frames[Math.min(motion.frames.length-1,Math.round(Math.min(progress,1)*(motion.frames.length-1)))];
  const translation=frame?.translation, contact=motion?.contactPoint;
  const rows: [string,string][] = [
    ['锁具编号',lockId], ['感压位置',snapshot.surfaces[0]], ['阻挡面受力',`${snapshot.force[0].toFixed(1)} kN`],
    ['接触状态',progress >= 1 ? '解除中' : frame && frame.gap <= .01 ? '接触' : '接近'],
    ['锁套 X 位移',translation ? `${translation[0].toFixed(2)} mm` : '—'], ['锁套 Y 位移',translation ? `${translation[1].toFixed(2)} mm` : '—'],
    ['锁套 Z 位移',translation ? `${translation[2].toFixed(2)} mm` : '—'], ['锁套旋转',frame ? `${(frame.angle - Math.max(0,progress-1)*.2).toFixed(2)}°` : '—'],
    ['接触间隙',frame && progress <= 1 ? `${Math.max(0,frame.gap).toFixed(2)} mm` : '—'], ['吊架左旋余量',progress >= 1 ? `${snapshot.angle.toFixed(2)}°` : '—'],
    ['接触点坐标',contact && (progress >= 1 || frame && frame.gap <= .01) ? `${contact.map(n=>n.toFixed(1)).join(' / ')} mm` : '—'],
  ];
  return <div className="jam-overlay" role="status"><div className="jam-heading"><TriangleAlert size={18}/><strong>提箱卡阻</strong><span>{lockId}</span></div><JamModel progress={progress}/><div className="jam-telemetry">{rows.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="jam-progress"><span style={{ width: `${(Math.min(progress,1)*10+Math.max(0,progress-1)*4)/14*100}%` }}/></div></div>;
}

function OperationSidebar({ op, snapshot, started, running }: { op: Operation; snapshot: Snapshot; started: boolean; running: boolean }) {
  return <section className="panel operation-panel"><div className="panel-heading"><span><Activity size={15}/>作业进程</span><small>WORKFLOW</small></div><div className="task-status"><i className={running ? 'pulsing' : ''}/>{snapshot.complete ? '作业完成' : !started ? '待作业' : running ? '作业进行中' : '作业已暂停'}</div>
    <ol className="stage-list">{STAGES[op].map((s, i) => <li key={s.name} className={`${started && i === snapshot.stage ? 'current' : ''} ${started && (i < snapshot.stage || snapshot.complete) ? 'done' : ''}`}><span className="stage-dot">{started && (i < snapshot.stage || snapshot.complete) ? <Check size={12}/> : String(i + 1).padStart(2, '0')}</span><div><strong>{s.name}</strong><small>{s.instruction}</small></div>{started && i === snapshot.stage && !snapshot.complete && <span className="stage-live"/>}</li>)}</ol>
    <div className="sidebar-divider"/><div className="sensor-status"><span><Radio size={13}/>感知链路</span><b>4 / 4 在线</b></div><div className="sensor-status"><span><Signal size={13}/>信号状态</span><b>良好</b></div><div className="sensor-status"><span><Clock3 size={13}/>预计时长</span><b>{operationDuration(op)} 秒</b></div>
  </section>;
}

function MonitorSidebar({ module, abnormal, transit, running, onToggle }: { module: 'inspection' | 'transit'; abnormal: boolean; transit: TransitSnapshot; running: boolean; onToggle: () => void }) {
  return <div className="monitor-sidebar"><section className="panel monitor-stat-panel"><div className="panel-heading"><span><Radio size={15}/>全系统概览</span><small>OVERVIEW</small></div><Stat label="智能 F-TR 锁" value="440" unit="把"/><div className="stat-pair"><Stat label={module === 'inspection' ? '正常设备' : '在线设备'} value={module === 'inspection' ? 436 : 440}/><Stat label="异常设备" value={module === 'inspection' ? 4 : 0} danger={module === 'inspection'}/></div><div className="online-meter"><i style={{ width: module === 'inspection' ? '99.1%' : '100%' }}/></div><div className="overview-caption"><span>{module === 'inspection' ? '正常率' : '在线率'}</span><strong>{module === 'inspection' ? '99.1' : '100'}%</strong></div></section>
    {module === 'inspection' ? <section className={`panel inspection-message ${abnormal ? 'alert-message' : ''}`}><div className="panel-heading"><span>{abnormal ? <TriangleAlert size={15}/> : <ShieldCheck size={15}/>}当前货检结果</span></div><strong>{abnormal ? '受力不均，建议检查' : '当前车辆受力正常'}</strong>{abnormal && <p>前后锁具受力不均，待检查。</p>}{abnormal && <div className="imbalance"><span>前后受力差</span><b>约 20 <small>kN</small></b></div>}</section> : <section className="panel transit-map-panel"><div className="panel-heading"><span><MapPin size={15}/>列车位置</span><button className="tiny-button" onClick={onToggle} aria-label={running ? '暂停刷新' : '恢复刷新'}>{running ? <Pause size={12}/> : <Play size={12}/>}</button></div><MapPanel compact transit={transit}/><div className="transit-speed"><span>运行速度</span><strong>{transit.speed.toFixed(1)}<small>km/h</small></strong></div><div className="coordinate-value">{coordinates(...transit.position)}</div></section>}
  </div>;
}

function GuideBanner({ snapshot: s, started }: { snapshot: Snapshot; started: boolean }) {
  const rotation = s.instruction.includes('旋');
  const Icon = rotation ? s.instruction.includes('右') ? RotateCw : RotateCcw : s.instruction.includes('下降') ? ArrowDown : s.instruction.includes('上升') ? ArrowUp : s.complete || s.instruction === '吊钩松开' ? CheckCheck : Activity;
  const value = rotation ? s.angle : s.distance;
  return <div className={`guide-banner ${s.jam ? 'guide-alert' : ''} ${s.complete ? 'guide-complete' : ''}`}><div className="guide-icon"><Icon size={24}/></div><div><span>当前操作指引</span><strong>{!started ? '待作业' : s.instruction === '无' ? '落箱完成 · 状态稳定' : s.instruction}</strong></div>{started && (rotation || s.instruction.includes('起升')) && <div className="guide-distance"><strong>{rotation ? value.toFixed(2) : value.toFixed(1)}</strong><span>{rotation ? '°' : s.unit}</span><small>剩余{rotation ? '角度' : '距离'}</small></div>}{s.complete && <span className="complete-tag"><Check size={14}/>作业完成</span>}</div>;
}

function OperationView({ module, vehicle, sourceVehicle, targetVehicle, transferMode, setTransferMode }: { module: Exclude<ModuleId, 'devices'>; vehicle: Vehicle; sourceVehicle: Vehicle; targetVehicle: Vehicle; transferMode: 'unload' | 'load'; setTransferMode: (mode: 'unload' | 'load') => void }) {
  const [transparent, setTransparent] = useState(true);
  const [resetVersion, setResetVersion] = useState(0);
  const monitor = module === 'inspection' || module === 'transit';
  const op: Operation = module === 'transfer' ? transferMode === 'unload' ? 'transfer-unload' : 'transfer-load' : module === 'unloading' ? 'unloading' : 'loading';
  const player = usePlayback(monitor ? Infinity : operationDuration(op), monitor);
  const abnormal = module === 'inspection' && vehicle.id === INSPECTION_VEHICLE;
  const snapshot = monitor ? monitoringSnapshot(module, player.elapsed, abnormal) : operationSnapshot(op, player.elapsed, player.started);
  const displayedVehicle = module === 'transfer' && snapshot.transfer >= 1 ? targetVehicle : vehicle;
  const transit = transitSnapshot(player.elapsed);
  const settleForce = snapshot.complete && (op === 'loading' || op === 'transfer-load') ? snapshot.force.map((v, i) => v + Math.sin(Date.now() / 2000 + i) * .04) : snapshot.force;
  const total = operationDuration(op);
  // The completed loading state remains alive; unmounting stops its small stable-load updates.
  const [, refreshStable] = useState(0);
  useEffect(() => {
    if (!snapshot.complete || op === 'unloading' || op === 'transfer-unload') return;
    const id = window.setInterval(() => refreshStable(n => n + 1), 1000); return () => clearInterval(id);
  }, [snapshot.complete, op]);
  return <>
    <div className="work-grid">
      {monitor ? <MonitorSidebar module={module} abnormal={abnormal} transit={transit} running={player.running} onToggle={player.running ? player.pause : player.play}/> : <OperationSidebar op={op} snapshot={snapshot} started={player.started} running={player.running}/>}
      <section className="panel scene-panel"><div className="scene-toolbar"><span><i className={abnormal ? 'red-dot' : ''}/>{monitor ? '四点受力监测' : module === 'transfer' ? '换轨作业' : module === 'unloading' ? '卸车作业' : '装车作业'}</span><div className="scene-toolbar-actions">{module === 'transfer' && <div className="transfer-tabs" aria-label="换轨作业阶段"><button className={transferMode === 'unload' ? 'active' : ''} onClick={() => setTransferMode('unload')}><ArrowUp size={13}/>卸车</button><button className={transferMode === 'load' ? 'active' : ''} onClick={() => setTransferMode('load')}><ArrowDown size={13}/>装车</button></div>}<div className="current-vehicle"><TrainFront size={16}/>{module === 'transfer' ? <><span>来源</span><strong>{sourceVehicle.id}</strong><span>目标</span><strong>{targetVehicle.id}</strong></> : <><span>当前车号</span><strong>{vehicle.id}</strong></>}</div><div className="scene-toolbar-controls"><button aria-pressed={transparent} onClick={() => setTransparent(v => !v)}>集装箱半透明 {transparent ? '开' : '关'}</button><button aria-label="恢复作业视角" title="恢复作业视角" onClick={() => setResetVersion(v => v + 1)}><RotateCcw size={14}/></button></div></div></div><div className="scene-wrap"><Scene3D snapshot={{ ...snapshot, force: settleForce }} vehicle={displayedVehicle} abnormal={abnormal} dual={module === 'transfer'} transparent={transparent} resetVersion={resetVersion} operation={monitor ? null : op} started={player.started}/><CornerLocks vehicle={displayedVehicle} snapshot={{ ...snapshot, force: settleForce }} abnormal={abnormal}/>{snapshot.jam && <JamOverlay snapshot={snapshot} lockId={vehicle.locks[0].id}/>}</div>
        {monitor ? <div className={`monitor-banner ${abnormal ? 'monitor-warning' : ''}`}>{abnormal ? <TriangleAlert size={19}/> : <ShieldCheck size={19}/>}<div><strong>{abnormal ? '受力不均，建议检查' : '锁具状态正常 · 受力稳定'}</strong></div><span className="live-badge"><i className={player.running ? 'pulsing' : ''}/>{player.running ? '数据更新中' : '刷新已暂停'}</span></div> : <GuideBanner snapshot={snapshot} started={player.started}/>}
      </section>

    </div>
    <div className="playback-bar"><div className="playback-buttons"><button className="primary-button" onClick={player.running ? player.pause : player.play}>{player.running ? <Pause size={15}/> : <Play size={15}/>}<span>{monitor ? player.running ? '暂停刷新' : '恢复刷新' : player.running ? '暂停作业' : !player.started || snapshot.complete ? '开始作业' : '继续作业'}</span></button><button className="secondary-button" onClick={player.replay}><RotateCcw size={14}/>{monitor ? '刷新' : '重新开始'}</button></div>
      {monitor ? <div className="monitor-timeline"><span><i className={player.running ? 'pulsing' : ''}/>{player.running ? '数据更新中' : '刷新已暂停'}</span></div> : <><div className="playback-timeline"><div className="timeline-heading"><span>{!player.started ? '待作业' : snapshot.phase}</span><span>{Math.floor(player.elapsed).toString().padStart(2, '0')} / {total} s</span></div><div className="timeline-track"><span style={{ width: `${snapshot.progress * 100}%` }}/>{STAGES[op].slice(0, -1).map((_, i) => <i key={i} style={{ left: `${STAGES[op].slice(0, i + 1).reduce((n, s) => n + s.duration, 0) / total * 100}%` }}/>)}</div></div><span className="playback-caption">{Math.round(snapshot.progress * 100)}<small>%</small></span></>}
    </div>
  </>;
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [module, setModule] = useState<ModuleId>('loading');
  const [vehicle, setVehicle] = useState(0);
  const [targetVehicle, setTargetVehicle] = useState(0);
  const [transferMode, setTransferMode] = useState<'unload' | 'load'>('unload');
  const switchModule = (id: ModuleId) => { setModule(id); setVehicle(id === 'inspection' ? 6 : 0); setTargetVehicle(0); setTransferMode('unload'); };
  if (!loggedIn) return <Login onLogin={() => { setLoggedIn(true); setModule('loading'); setVehicle(0); }}/>;
  return <div className="app-shell"><Header onLogout={() => setLoggedIn(false)}/><nav className="main-nav" aria-label="系统模块">{MODULES.map((m, i) => { const Icon = navIcons[i]; return <button key={m.id} className={module === m.id ? 'active' : ''} onClick={() => switchModule(m.id)} aria-current={module === m.id ? 'page' : undefined}><Icon size={17}/><span>{m.label}</span><small>{String(i + 1).padStart(2, '0')}</small></button>; })}<div className="nav-status"><i/>系统运行正常</div></nav>
    <main className={`workspace ${module === 'devices' ? 'device-workspace' : ''} ${module === 'transfer' ? 'transfer-workspace' : ''}`}>    {module === 'devices' ? <DeviceManagement key={module}/> : <><OperationView key={`${module}-${vehicle}-${targetVehicle}-${transferMode}`} module={module} vehicle={module === 'transfer' && transferMode === 'load' ? TARGET_TRAIN[targetVehicle] : DEMO_TRAIN[vehicle]} sourceVehicle={DEMO_TRAIN[vehicle]} targetVehicle={TARGET_TRAIN[targetVehicle]} transferMode={transferMode} setTransferMode={setTransferMode}/><VehicleStrip current={vehicle} onSelect={setVehicle} inspection={module === 'inspection'} transfer={module === 'transfer'}/>{module === 'transfer' && <VehicleStrip current={targetVehicle} onSelect={setTargetVehicle} target transfer/>}</>}
    </main><footer className="app-footer"><span><ShieldCheck size={12}/>F-TR 智能锁具管控平台</span><span className="footer-version">V2.3</span></footer>
  </div>;
}
