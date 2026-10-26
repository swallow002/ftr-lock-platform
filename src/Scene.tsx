import { useId } from 'react';
import type { Snapshot, Vehicle } from './data';

export function LockShape({ surface = '无', abnormal = false, compact = false }: { surface?: string; abnormal?: boolean; compact?: boolean }) {
  const active = surface !== '无';
  const color = abnormal ? '#ff6974' : '#42d6df';
  return <svg viewBox="0 0 180 128" className={compact ? 'lock-shape compact' : 'lock-shape'} aria-label={`锁具受力面：${surface}`}>
    <defs><linearGradient id={`lock-${surface}-${abnormal}`} x2="0" y2="1"><stop stopColor="#24485b"/><stop offset="1" stopColor="#0d2434"/></linearGradient></defs>
    <ellipse cx="90" cy="113" rx="72" ry="8" fill="#020b14" opacity=".7"/>
    <path d="M27 99 H62 Q72 99 72 88 L72 76 Q72 71 77 67 L88 57 82 39 82 23 Q82 13 91 19 L137 60 Q144 68 136 75 L117 87 120 99 H152 L158 111 H23 Z" fill={`url(#lock-${surface}-${abnormal})`} stroke={active ? color : '#527b90'} strokeWidth="2" strokeLinejoin="round"/>
    <path d="M87 24 L135 64" stroke={surface === '落箱上导向斜面' ? color : '#416174'} strokeWidth={surface === '落箱上导向斜面' ? 6 : 2}/>
    <path d="M136 72 L115 85" stroke={surface === '提箱导向面' ? color : '#416174'} strokeWidth={surface === '提箱导向面' ? 6 : 2}/>
    <path d="M75 72 L75 89" stroke={surface === '提箱阻挡面' ? color : '#416174'} strokeWidth={surface === '提箱阻挡面' ? 6 : 2}/>
    <path d="M77 67 L89 57" stroke={surface === '落箱下导向斜面' ? color : '#416174'} strokeWidth={surface === '落箱下导向斜面' ? 6 : 2}/>
    <path d="M29 101 H62 M122 101 H151" stroke={surface === '重力面' ? color : '#416174'} strokeWidth={surface === '重力面' ? 6 : 2}/>
    <path d="M31 107 H150" stroke="#4f7b90" strokeWidth="1" opacity=".6"/>
    {active && <circle cx="149" cy="25" r="4" fill={color}/>}
  </svg>;
}

function Track({ y, label }: { y: number; label?: string }) {
  return <g>
    {Array.from({ length: 36 }, (_, i) => <path key={i} d={`M${i * 28} ${y - 32}v64`} stroke="#254354" strokeWidth="6" opacity=".48"/>)}
    <path d={`M0 ${y - 21}H1000 M0 ${y + 21}H1000`} stroke="#456679" strokeWidth="4"/>
    <path d={`M0 ${y - 24}H1000 M0 ${y + 18}H1000`} stroke="#9bb3bf" strokeWidth="1" opacity=".4"/>
    {label && <text x="30" y={y - 40} fill="#7899ad" fontSize="11" letterSpacing="2">{label}</text>}
  </g>;
}

function Flatcar({ y, target = false }: { y: number; target?: boolean }) {
  return <g transform={`translate(0 ${y})`}>
    <rect x="173" y="-80" width="654" height="160" rx="12" fill="#0b1e2d" stroke="#42687e" strokeWidth="2"/>
    <rect x="184" y="-69" width="632" height="138" rx="5" fill="#102a3b" stroke="#2b4a60"/>
    {Array.from({ length: 20 }, (_, i) => <path key={i} d={`M${195 + i * 32} -68V68`} stroke="#294759" strokeWidth="2"/>)}
    <path d="M140 -10H173 M827 -10H860 M140 10H173 M827 10H860" stroke="#517489" strokeWidth="4"/>
    {[210, 760].map(x => <g key={x}><rect x={x} y="-85" width="32" height="9" rx="2" fill="#08121d" stroke="#4b6b7e"/><rect x={x} y="76" width="32" height="9" rx="2" fill="#08121d" stroke="#4b6b7e"/></g>)}
    <text x="500" y="5" fill="#446477" textAnchor="middle" fontSize="12" letterSpacing="8">{target ? 'TARGET PLATFORM' : 'X70 · FREIGHT PLATFORM'}</text>
  </g>;
}

export default function Scene({ snapshot: s, vehicle, abnormal = false, dual = false }: { snapshot: Snapshot; vehicle: Vehicle; abnormal?: boolean; dual?: boolean }) {
  const id = useId().replace(/:/g, '');
  const baseY = dual ? 150 : 265;
  const boxY = baseY + (dual ? s.transfer * 260 : 0);
  const scale = 1 + s.containerHeight * .055;
  const locks = [[215, -55], [785, -55], [215, 55], [785, 55]];
  return <svg className="scene-svg" viewBox="0 0 1000 560" role="img" aria-label={`${dual ? '双轨道换轨' : '集装箱俯视'}作业，${s.phase}`}>
    <defs>
      <pattern id={`grid-${id}`} width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#204253" strokeWidth=".6" opacity=".35"/></pattern>
      <linearGradient id={`box-${id}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#326f88"/><stop offset=".5" stopColor="#28566e"/><stop offset="1" stopColor="#1a4059"/></linearGradient>
      <linearGradient id={`shine-${id}`}><stop stopColor="#5bcede" stopOpacity="0"/><stop offset=".5" stopColor="#79e8ef" stopOpacity=".3"/><stop offset="1" stopColor="#5bcede" stopOpacity="0"/></linearGradient>
      <filter id={`glow-${id}`}><feGaussianBlur stdDeviation="3"/></filter>
    </defs>
    <rect width="1000" height="560" fill={`url(#grid-${id})`}/>
    <path d="M500 0V560 M0 280H1000" stroke="#2d5267" strokeDasharray="5 9" opacity=".35"/>
    <circle cx="500" cy="280" r="225" fill="none" stroke="#1c3b4f" strokeWidth="1"/>
    <circle cx="500" cy="280" r="240" fill="none" stroke="#20475b" strokeDasharray="2 15"/>
    <Track y={baseY} label={dual ? '01 / 来源轨道' : undefined}/>
    <Flatcar y={baseY}/>
    {dual && <><Track y={410} label="02 / 目标轨道"/><Flatcar y={410} target/>
      <path d="M895 160V388l-5-9m5 9 5-9" fill="none" stroke="#d5ae66" strokeWidth="2" strokeDasharray="5 6"/>
      <text x="914" y="285" fill="#a2916f" fontSize="11" transform="rotate(90 914 285)">TRANSFER DIRECTION</text>
    </>}
    <g opacity=".28" transform={`translate(0 ${boxY + s.containerHeight * 20})`}><rect x="205" y="-64" width="590" height="128" rx="5" fill="#010810"/></g>
    <g transform={`translate(500 ${boxY - s.containerHeight * 18}) rotate(${s.rotation}) scale(${scale}) translate(-500 0)`}>
      <rect x="205" y="-65" width="590" height="130" rx="4" fill={`url(#box-${id})`} stroke="#82c4d3" strokeWidth="2"/>
      <rect x="214" y="-57" width="572" height="114" rx="2" fill="none" stroke="#4a8ca2"/>
      {Array.from({ length: 35 }, (_, i) => <g key={i}><path d={`M${229 + i * 16} -52V52`} stroke="#102e44" strokeWidth="5" opacity=".6"/><path d={`M${231 + i * 16} -52V52`} stroke="#5894a7" strokeWidth="1" opacity=".7"/></g>)}
      <rect x="207" y="-64" width="586" height="10" fill={`url(#shine-${id})`}/>
      <path d="M211 -60V60 M789 -60V60" stroke="#95d6e0" strokeWidth="3" opacity=".6"/>
      <rect x="404" y="-18" width="192" height="36" rx="2" fill="#102d42" stroke="#49758b"/>
      <text x="500" y="5" fill="#c4e8ef" textAnchor="middle" fontSize="16" fontFamily="monospace" letterSpacing="2">{vehicle.container}</text>
      {locks.map(([x, y], i) => {
        const color = abnormal || s.jam && i === 0 ? '#ff6974' : s.force[i] > 0 ? '#42d6df' : '#6b8e9e';
        return <g key={i} transform={`translate(${x} ${y})`}>
          <rect x="-10" y="-10" width="20" height="20" rx="3" fill="#0a1a27" stroke={color} strokeWidth="2"/>
          <rect x="-5" y="-5" width="10" height="10" rx="2" fill={color} opacity=".85"/>
          <circle r="18" fill="none" stroke={color} opacity=".3"/>
          {s.force[i] > 0 && <circle r="24" fill="none" stroke={color} opacity=".18"/>}
        </g>;
      })}
    </g>
    {!dual && locks.map(([x, y], i) => {
      const top = y < 0;
      const color = abnormal || s.jam && i === 0 ? '#ff6974' : '#42d6df';
      return <g key={i}>
        <path d={`M${x} ${baseY + y + (top ? -18 : 18)}V${top ? 111 : 419}H${x + (x < 500 ? -35 : 35)}`} fill="none" stroke={color} strokeWidth="1" opacity=".6"/>
        <text x={x} y={top ? 94 : 449} textAnchor="middle" fill="#8caeba" fontSize="11" fontFamily="monospace">{vehicle.locks[i].id}</text>
        <text x={x} y={top ? 77 : 474} textAnchor="middle" fill={color} fontSize="22" fontFamily="monospace">{s.force[i].toFixed(1)}<tspan fontSize="10" fill="#7795a6"> kN</tspan></text>
      </g>;
    })}
    <path d="M30 55V30H55 M945 30H970V55 M30 505V530H55 M945 530H970V505" fill="none" stroke="#3c8aa2" strokeWidth="2"/>
  </svg>;
}
