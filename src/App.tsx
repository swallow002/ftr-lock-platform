import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDown, ArrowDownToLine, ArrowLeftRight, ArrowRight, ArrowUp, BatteryMedium, Check, CheckCheck, ChevronRight, CircleHelp, Clock3, Cpu, Expand, LocateFixed, LockKeyhole, LogOut, MapPin, Navigation, Pause, Play, Radio, RotateCcw, RotateCw, Search, ShieldCheck, Signal, TrainFront, TriangleAlert, Wifi, X } from 'lucide-react';
import { coordinates, DEMO_TRAIN, filterDevices, INSPECTION_VEHICLE, MODULES, monitoringSnapshot, operationDuration, operationSnapshot, REGIONAL_DEVICES, STAGES, transitPosition, type DeviceFilter, type LockDevice, type ModuleId, type Operation, type Snapshot, type Vehicle } from './data';
import Scene, { LockShape } from './Scene';
import MapPanel from './MapPanel';
import { usePlayback } from './usePlayback';

const navIcons = [ArrowDownToLine, ShieldCheck, ArrowLeftRight, Navigation, ArrowUp, Cpu];
const moduleIndex = (id: ModuleId) => MODULES.findIndex(m => m.id === id);

function Brand({ large = false }: { large?: boolean }) {
  return <div className={`brand ${large ? 'large-brand' : ''}`}><div className="brand-emblem"><span>F</span><i/></div><div><h1>智能 <span>F-TR</span> 锁管控平台</h1><p>INTELLIGENT LOCK CONTROL PLATFORM</p></div></div>;
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  return <main className="login-page">
    <header className="login-header"><Brand/><span className="environment-tag"><i/>演示环境</span></header>
    <div className="login-content">
      <section className="login-intro"><div className="eyebrow"><span/> RAILWAY INTELLIGENCE / 轨道智能感知</div><h2>每一次锁定，<br/>都清晰可见<span>。</span></h2><p>从精准落箱到全程监管，让四点受力、设备状态与作业指引，在同一个视野中协同呈现。</p>
        <div className="login-scene"><Scene vehicle={DEMO_TRAIN[0]} snapshot={monitoringSnapshot('transit', 0)}/></div>
        <div className="login-features"><span><Radio size={16}/>四点受力感知</span><span><LocateFixed size={16}/>设备位置追踪</span><span><ShieldCheck size={16}/>全流程作业指引</span></div>
      </section>
      <section className="login-card"><div className="login-card-line"/><div className="eyebrow">WELCOME TO F-TR</div><h2>进入智能管控中心</h2><p>以数据感知状态，以指引辅助作业。</p>
        <form onSubmit={e => { e.preventDefault(); onLogin(); }}>
          <label htmlFor="username">演示账号<span>DEMO ACCOUNT</span></label><div className="login-input"><Cpu size={17}/><input id="username" autoComplete="off" defaultValue="demo" aria-label="演示账号"/></div>
          <label htmlFor="password">演示密码<span>DEMO PASSWORD</span></label><div className="login-input"><LockKeyhole size={17}/><input id="password" type={showPassword ? 'text' : 'password'} autoComplete="off" defaultValue="ftr-demo" aria-label="演示密码"/><button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)}>{showPassword ? '隐藏' : '显示'}</button></div>
          <div className="demo-hint"><CircleHelp size={14}/>模拟登录，点击下方按钮即可体验全部功能</div>
          <button className="login-submit" type="submit">演示登录<ArrowRight size={19}/></button>
        </form>
        <div className="login-card-footer"><span><i/>系统准备就绪</span><span>DEMO V1.0</span></div>
      </section>
    </div><footer className="login-footer"><span>F-TR · 智能锁具作业演示平台</span><span>模拟数据，仅用于系统功能展示</span></footer>
  </main>;
}

function Header({ onLogout }: { onLogout: () => void }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const id = window.setInterval(() => setTime(new Date()), 1000); return () => clearInterval(id); }, []);
  const [full, setFull] = useState(Boolean(document.fullscreenElement));
  useEffect(() => { const onChange = () => setFull(Boolean(document.fullscreenElement)); document.addEventListener('fullscreenchange', onChange); return () => document.removeEventListener('fullscreenchange', onChange); }, []);
  const toggleFull = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* Browser may disallow fullscreen; the layout stays usable. */ } };
  return <header className="app-header"><Brand/><div className="header-right"><span className="environment-tag"><i/>演示环境</span><div className="header-clock"><strong>{time.toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}</strong><span>{time.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })} · 北京时间</span></div><button className="icon-button fullscreen-button" onClick={toggleFull} aria-label={full ? '退出全屏' : '全屏展示'} title="全屏展示"><Expand size={18}/></button><button className="icon-button" onClick={onLogout} aria-label="退出演示" title="退出演示"><LogOut size={18}/></button></div></header>;
}

function Stat({ label, value, unit, danger = false, icon }: { label: string; value: string | number; unit?: string; danger?: boolean; icon?: React.ReactNode }) {
  return <div className={`stat-item ${danger ? 'danger' : ''}`}><div className="stat-label">{label}{icon}</div><div className="stat-value">{value}<small>{unit}</small></div></div>;
}

function LockCard({ device, force, surface, index, abnormal }: { device: LockDevice; force: number; surface: string; index: number; abnormal: boolean }) {
  return <article className={`lock-card ${abnormal ? 'abnormal' : ''}`} data-testid={`lock-${index + 1}`}><div className="lock-card-top"><span><i/>{device.id}</span><span className="lock-corner">{['左前', '右前', '左后', '右后'][index]}角</span></div>
    <div className="lock-card-body"><LockShape surface={surface} abnormal={abnormal}/><div className="force-reading"><span>当前受力</span><strong>{force.toFixed(1)}<small>kN</small></strong></div></div>
    <div className="lock-card-bottom"><span className="surface-label">{surface}</span><span><BatteryMedium size={12}/>{device.battery}%</span></div>
  </article>;
}

function VehicleStrip({ current, onSelect, inspection = false }: { current: number; onSelect: (index: number) => void; inspection?: boolean }) {
  return <section className="vehicle-strip" aria-label="演示列车车辆选择"><div className="vehicle-strip-label"><TrainFront size={17}/><div><strong>演示列车</strong><span>13 辆 / 52 把锁</span></div></div><div className="vehicle-scroll">
    {DEMO_TRAIN.map((v, i) => <button key={v.id} className={`vehicle-button ${current === i ? 'selected' : ''} ${inspection && v.id === INSPECTION_VEHICLE ? 'has-alert' : ''}`} onClick={() => onSelect(i)} aria-label={`选择车辆 ${v.id}`} aria-pressed={current === i}>
      <span className="vehicle-order">{String(i + 1).padStart(2, '0')}{inspection && v.id === INSPECTION_VEHICLE && <TriangleAlert size={9}/>}</span><span className="mini-container"><i/><i/><i/><i/><i/><i/><i/><i/></span><span className="mini-wheels"><i/><i/><i/><i/></span><span className="vehicle-number">{v.id.split(' ')[1]}</span>
    </button>)}
  </div><span className="vehicle-scroll-hint">点击选车<ChevronRight size={14}/></span></section>;
}

function JamOverlay({ snapshot, lockId }: { snapshot: Snapshot; lockId: string }) {
  return <div className="jam-overlay" role="status"><div className="jam-heading"><TriangleAlert size={18}/><strong>检测到提箱卡阻</strong><span>{lockId}</span></div><div className="jam-visual"><svg viewBox="0 0 300 180" role="img" aria-label="吊架左旋解除锁具阻挡面卡阻">
    <path d="M24 150H276" stroke="#47697c" strokeWidth="3"/><path d="M90 147V120L120 95V58L142 39L191 85L163 108V147Z" fill="#213e50" stroke="#759bac" strokeWidth="2"/>
    <path d="M123 97L123 63" stroke="#ff6974" strokeWidth="6"/>
    <g transform={`translate(${snapshot.angle / .2 * 12} 0)`}><path d="M30 28H112V95H64V121H30Z" fill="#215068" stroke="#59c9d5" strokeWidth="2"/><path d="M37 38H103V85" fill="none" stroke="#4c8ea6"/></g>
    <path d="M181 37Q240 40 232 90l-7-10m7 10 9-7" stroke="#e9b85c" strokeWidth="2" fill="none"/><text x="214" y="115" fill="#e9b85c" fontSize="13" textAnchor="middle">左旋 {snapshot.angle.toFixed(2)}°</text>
  </svg><div><span>提箱阻挡面受力</span><strong>{snapshot.force[0].toFixed(1)}<small>kN</small></strong></div></div><p>操作指引：吊架左旋，释放阻挡面受力</p><div className="jam-progress"><span style={{ width: `${(1 - snapshot.angle / .2) * 100}%` }}/></div><small>自动演示解除过程 · 可通过底部按钮暂停</small></div>;
}

function OperationSidebar({ op, snapshot, started, running }: { op: Operation; snapshot: Snapshot; started: boolean; running: boolean }) {
  return <section className="panel operation-panel"><div className="panel-heading"><span><Activity size={15}/>作业进程</span><small>WORKFLOW</small></div><div className="task-status"><i className={running ? 'pulsing' : ''}/>{snapshot.complete ? '本段演示已完成' : !started ? '设备准备就绪' : running ? '作业演示进行中' : '作业演示已暂停'}</div>
    <ol className="stage-list">{STAGES[op].map((s, i) => <li key={s.name} className={`${started && i === snapshot.stage ? 'current' : ''} ${started && (i < snapshot.stage || snapshot.complete) ? 'done' : ''}`}><span className="stage-dot">{started && (i < snapshot.stage || snapshot.complete) ? <Check size={12}/> : String(i + 1).padStart(2, '0')}</span><div><strong>{s.name}</strong><small>{s.instruction}</small></div>{started && i === snapshot.stage && !snapshot.complete && <span className="stage-live"/>}</li>)}</ol>
    <div className="sidebar-divider"/><div className="sensor-status"><span><Radio size={13}/>感知链路</span><b>4 / 4 在线</b></div><div className="sensor-status"><span><Signal size={13}/>信号状态</span><b>良好</b></div><div className="sensor-status"><span><Clock3 size={13}/>演示时长</span><b>{operationDuration(op)} 秒</b></div><div className="sidebar-note"><CircleHelp size={13}/><span>操作指引与受力数据同步变化，动作幅度为示意。</span></div>
  </section>;
}

function MonitorSidebar({ module, elapsed, abnormal, position, running, onToggle }: { module: 'inspection' | 'transit'; elapsed: number; abnormal: boolean; position: [number, number]; running: boolean; onToggle: () => void }) {
  return <div className="monitor-sidebar"><section className="panel monitor-stat-panel"><div className="panel-heading"><span><Radio size={15}/>全系统概览</span><small>OVERVIEW</small></div><Stat label="智能 F-TR 锁" value="440" unit="把"/><div className="stat-pair"><Stat label={module === 'inspection' ? '正常设备' : '在线设备'} value={module === 'inspection' ? 436 : 440}/><Stat label="异常设备" value={module === 'inspection' ? 4 : 0} danger={module === 'inspection'}/></div><div className="online-meter"><i style={{ width: module === 'inspection' ? '99.1%' : '100%' }}/></div><div className="overview-caption"><span>{module === 'inspection' ? '正常率' : '在线率'}</span><strong>{module === 'inspection' ? '99.1' : '100'}%</strong></div></section>
    {module === 'inspection' ? <section className={`panel inspection-message ${abnormal ? 'alert-message' : ''}`}><div className="panel-heading"><span>{abnormal ? <TriangleAlert size={15}/> : <ShieldCheck size={15}/>}当前货检结果</span></div><strong>{abnormal ? '受力不均，建议检查' : '当前车辆受力正常'}</strong><p>{abnormal ? '四把锁作为一组待检查设备。请关注前后锁具的受力差异，安排人工检查。' : '点击底部红色标记车辆，查看受力不均案例。'}</p>{abnormal && <div className="imbalance"><span>前后受力差</span><b>约 20 <small>kN</small></b></div>}<span className="message-foot">模拟货检案例 · 独立场景</span></section> : <section className="panel transit-map-panel"><div className="panel-heading"><span><MapPin size={15}/>列车位置</span><button className="tiny-button" onClick={onToggle} aria-label={running ? '暂停监管' : '继续监管'}>{running ? <Pause size={12}/> : <Play size={12}/>}</button></div><MapPanel compact position={position}/><div className="transit-speed"><span>运行速度</span><strong>{(92 + Math.sin(elapsed * .2) * 1.2).toFixed(1)}<small>km/h</small></strong></div><div className="coordinate-value">{coordinates(...position)}</div></section>}
  </div>;
}

function GuideBanner({ snapshot: s, started }: { snapshot: Snapshot; started: boolean }) {
  const rotation = s.instruction.includes('旋');
  const Icon = rotation ? s.instruction.includes('右') ? RotateCw : RotateCcw : s.instruction.includes('下降') ? ArrowDown : s.instruction.includes('上升') ? ArrowUp : s.complete || s.instruction === '吊钩松开' ? CheckCheck : Activity;
  const value = rotation ? s.angle : s.distance;
  return <div className={`guide-banner ${s.jam ? 'guide-alert' : ''} ${s.complete ? 'guide-complete' : ''}`}><div className="guide-icon"><Icon size={24}/></div><div><span>当前操作指引</span><strong>{!started ? '准备就绪，等待开始演示' : s.instruction === '无' ? '落箱完成 · 状态稳定' : s.instruction}</strong></div>{started && (rotation || s.instruction.includes('起升')) && <div className="guide-distance"><strong>{rotation ? value.toFixed(2) : value.toFixed(1)}</strong><span>{rotation ? '°' : s.unit}</span><small>剩余{rotation ? '角度' : '距离'}</small></div>}{s.complete && <span className="complete-tag"><Check size={14}/>演示完成</span>}</div>;
}

function OperationView({ module, vehicle, transferMode }: { module: Exclude<ModuleId, 'devices'>; vehicle: Vehicle; transferMode: 'unload' | 'load' }) {
  const monitor = module === 'inspection' || module === 'transit';
  const op: Operation = module === 'transfer' ? transferMode === 'unload' ? 'transfer-unload' : 'transfer-load' : module === 'unloading' ? 'unloading' : 'loading';
  const player = usePlayback(monitor ? Infinity : operationDuration(op), monitor);
  const abnormal = module === 'inspection' && vehicle.id === INSPECTION_VEHICLE;
  const snapshot = monitor ? monitoringSnapshot(module, player.elapsed, abnormal) : operationSnapshot(op, player.elapsed, player.started);
  const position = transitPosition(player.elapsed);
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
      {monitor ? <MonitorSidebar module={module} elapsed={player.elapsed} abnormal={abnormal} position={position} running={player.running} onToggle={player.running ? player.pause : player.play}/> : <OperationSidebar op={op} snapshot={snapshot} started={player.started} running={player.running}/>}
      <section className="panel scene-panel"><div className="scene-toolbar"><span><i className={abnormal ? 'red-dot' : ''}/>{monitor ? '四点受力监测' : module === 'transfer' ? '双轨换装示意' : '智能作业示意'}</span><span className="scene-view-label">俯视视角 <span>2D</span></span></div><div className="scene-wrap"><Scene snapshot={{ ...snapshot, force: settleForce }} vehicle={vehicle} abnormal={abnormal} dual={module === 'transfer'}/>{snapshot.jam && <JamOverlay snapshot={snapshot} lockId={vehicle.locks[0].id}/>}</div>
        {monitor ? <div className={`monitor-banner ${abnormal ? 'monitor-warning' : ''}`}>{abnormal ? <TriangleAlert size={19}/> : <ShieldCheck size={19}/>}<div><strong>{abnormal ? '受力不均，建议检查' : '锁具状态正常 · 受力稳定'}</strong><span>{module === 'inspection' ? '依据当前车辆四点受力数据展示货检状态' : '位置、速度与四点受力持续更新'}</span></div><span className="live-badge"><i className={player.running ? 'pulsing' : ''}/>{player.running ? '实时演示' : '已暂停'}</span></div> : <GuideBanner snapshot={snapshot} started={player.started}/>}
      </section>
      <section className="locks-panel"><div className="locks-panel-heading"><span><LockKeyhole size={14}/>四锁状态</span><small>4 / 4</small></div><div className="lock-card-list">{vehicle.locks.map((device, i) => <LockCard key={device.id} device={device} force={settleForce[i]} surface={snapshot.surfaces[i]} index={i} abnormal={abnormal || snapshot.jam && i === 0}/>)}</div></section>
    </div>
    <div className="playback-bar"><div className="playback-buttons"><button className="primary-button" onClick={player.running ? player.pause : player.play}>{player.running ? <Pause size={15}/> : <Play size={15}/>}<span>{player.running ? '暂停演示' : !player.started ? '开始演示' : snapshot.complete && !monitor ? '再次演示' : '继续演示'}</span></button><button className="secondary-button" onClick={player.replay}><RotateCcw size={14}/>重播</button></div>
      {monitor ? <div className="monitor-timeline"><span><i className={player.running ? 'pulsing' : ''}/>{player.running ? '模拟数据持续更新中' : '演示已暂停'}</span><small>独立演示场景 · 切换模块恢复初始状态</small></div> : <><div className="playback-timeline"><div className="timeline-heading"><span>{!player.started ? '等待开始' : snapshot.phase}</span><span>{Math.floor(player.elapsed).toString().padStart(2, '0')} / {total} s</span></div><div className="timeline-track"><span style={{ width: `${snapshot.progress * 100}%` }}/>{STAGES[op].slice(0, -1).map((_, i) => <i key={i} style={{ left: `${STAGES[op].slice(0, i + 1).reduce((n, s) => n + s.duration, 0) / total * 100}%` }}/>)}</div></div><span className="playback-caption">{Math.round(snapshot.progress * 100)}<small>%</small></span></>}
    </div>
  </>;
}

function DeviceDetails({ device }: { device: LockDevice | undefined }) {
  return <section className="panel device-detail"><div className="panel-heading"><span><LockKeyhole size={15}/>设备详情</span><small>DETAILS</small></div>{device ? <><div className={`device-identity ${device.abnormal ? 'danger' : ''}`}><div className="identity-icon"><LockKeyhole size={24}/></div><strong>{device.id}</strong><span><i/>{device.online ? '正常在线' : '离线异常'}</span></div><LockShape surface={device.online ? '重力面' : '无'} abnormal={device.abnormal}/><dl><div><dt>所属车号</dt><dd>{device.vehicleId}</dd></div><div><dt>设备电量</dt><dd><BatteryMedium size={14}/>{device.battery}%</dd></div><div><dt>连接状态</dt><dd className={device.online ? 'cyan-text' : 'red-text'}>{device.online ? '在线' : '离线'}</dd></div><div><dt>设备状态</dt><dd className={device.abnormal ? 'red-text' : 'cyan-text'}>{device.abnormal ? '异常 · 通信中断' : '正常'}</dd></div></dl><div className="device-location"><MapPin size={14}/><div><span>设备位置{!device.online && ' · 最后已知位置'}</span><strong>{coordinates(device.lat, device.lng)}</strong></div></div>{device.abnormal && <div className="offline-note"><TriangleAlert size={14}/>设备离线，建议检查通信连接。</div>}<div className="detail-note"><ShieldCheck size={13}/>设备状态与位置均为模拟数据</div></> : <div className="empty-detail"><MapPin size={28}/><strong>选择设备查看详情</strong><p>点击地图点位或左侧列表中的设备。</p></div>}</section>;
}

function DeviceView() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DeviceFilter>('all');
  const [selected, setSelected] = useState(REGIONAL_DEVICES[25].id);
  const results = useMemo(() => filterDevices(query, filter), [query, filter]);
  const selectedDevice = results.find(d => d.id === selected);
  useEffect(() => { if (!results.some(d => d.id === selected)) setSelected(results[0]?.id ?? ''); }, [results, selected]);
  return <><div className="device-stats"><Stat label="全系统设备" value={440} unit="把" icon={<Cpu size={16}/>}/><Stat label="当前区域设备" value={58} unit="把" icon={<MapPin size={16}/>}/><Stat label="区域正常在线" value={55} unit="把" icon={<Wifi size={16}/>}/><Stat label="区域离线异常" value={3} unit="把" danger icon={<TriangleAlert size={16}/>}/></div><div className="device-grid"><section className="panel device-list-panel"><div className="panel-heading"><span><Search size={14}/>设备查找</span><small>区域内 58 把</small></div><div className="device-search"><Search size={15}/><input aria-label="搜索锁具编号或车号" placeholder="搜索锁具编号 / 车号" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button aria-label="清空搜索" onClick={() => setQuery('')}><X size={13}/></button>}</div><div className="device-filters">{(['all', 'normal', 'abnormal', 'offline'] as DeviceFilter[]).map((f, i) => <button key={f} onClick={() => setFilter(f)} className={filter === f ? 'active' : ''} aria-pressed={filter === f}>{['全部', '正常', '异常', '离线'][i]}</button>)}</div><div className="result-heading"><span>匹配设备</span><strong data-testid="result-count">{results.length}<small> 把</small></strong></div><div className="device-results">{results.length ? results.map(d => <button key={d.id} className={`device-row ${selected === d.id ? 'selected' : ''}`} onClick={() => setSelected(d.id)} aria-label={`查看设备 ${d.id}`} aria-pressed={selected === d.id}><span className={`device-row-icon ${d.abnormal ? 'danger' : ''}`}><LockKeyhole size={17}/></span><span><strong>{d.id}</strong><small>{d.vehicleId}</small></span><span className={`device-state ${d.abnormal ? 'danger' : ''}`}>{d.online ? '在线' : '离线'}</span></button>) : <div className="no-results"><Search size={24}/><strong>未找到匹配设备</strong><p>请更换编号、车号或筛选条件。</p><button onClick={() => { setQuery(''); setFilter('all'); }}>重置查找条件</button></div>}</div></section><section className="panel device-map-panel"><div className="panel-heading"><span><LocateFixed size={15}/>区域设备分布</span><span className="map-legend"><i/>正常<i className="red-dot"/>异常<i className="yellow-dot"/>选中</span></div><MapPanel devices={results} selectedId={selected} onSelect={setSelected}/><div className="map-summary"><span>当前区域：PPT 示例位置附近</span><strong>显示 {results.length} / 58 个设备点</strong></div></section><DeviceDetails device={selectedDevice}/></div></>;
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [module, setModule] = useState<ModuleId>('loading');
  const [vehicle, setVehicle] = useState(0);
  const [transferMode, setTransferMode] = useState<'unload' | 'load'>('unload');
  const current = MODULES[moduleIndex(module)];
  const switchModule = (id: ModuleId) => { setModule(id); setVehicle(0); setTransferMode('unload'); };
  if (!loggedIn) return <Login onLogin={() => { setLoggedIn(true); setModule('loading'); setVehicle(0); }}/>;
  return <div className="app-shell"><Header onLogout={() => setLoggedIn(false)}/><nav className="main-nav" aria-label="系统模块">{MODULES.map((m, i) => { const Icon = navIcons[i]; return <button key={m.id} className={module === m.id ? 'active' : ''} onClick={() => switchModule(m.id)} aria-current={module === m.id ? 'page' : undefined}><Icon size={17}/><span>{m.label}</span><small>{String(i + 1).padStart(2, '0')}</small></button>; })}<div className="nav-status"><i/>系统运行正常</div></nav>
    <main className={`workspace ${module === 'devices' ? 'device-workspace' : ''}`}><div className="workspace-heading"><div><div className="section-kicker">{current.en}</div><h2>{current.label}<span>{current.description}</span></h2></div><div className="workspace-heading-right">{module === 'transfer' && <div className="transfer-tabs" aria-label="换轨作业阶段"><button className={transferMode === 'unload' ? 'active' : ''} onClick={() => setTransferMode('unload')}><ArrowUp size={13}/>卸车</button><button className={transferMode === 'load' ? 'active' : ''} onClick={() => setTransferMode('load')}><ArrowDown size={13}/>装车</button></div>}{module !== 'devices' && <div className="current-vehicle"><TrainFront size={16}/><span>当前车号</span><strong>{DEMO_TRAIN[vehicle].id}</strong></div>}<span className="scenario-tag">模拟场景</span></div></div>
    {module === 'devices' ? <DeviceView key={module}/> : <><OperationView key={`${module}-${vehicle}-${transferMode}`} module={module} vehicle={DEMO_TRAIN[vehicle]} transferMode={transferMode}/><VehicleStrip current={vehicle} onSelect={setVehicle} inspection={module === 'inspection'}/></>}
    </main><footer className="app-footer"><span><ShieldCheck size={12}/>F-TR 智能感知 · 全流程作业演示</span><span>模拟数据 / 独立场景<span className="footer-version">V1.0</span></span></footer>
  </div>;
}
