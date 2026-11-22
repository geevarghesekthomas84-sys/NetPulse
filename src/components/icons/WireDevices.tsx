import React from 'react';
import type { DeviceRole } from '../../engine/types';

/**
 * Isometric wireframe devices (64x64 space): translucent blue planes with crisp edges, drawn from small
 * cuboids so every device shares one light direction. Colours come from CSS variables (--wire, --wire-rgb,
 * --wire-base) so the art follows the theme and still resolves when a diagram is exported.
 */

type V3 = [number, number, number];
const K = Math.sqrt(3) / 2;
/** 30-degree isometric projection into the 64x64 art box. x runs right-down, y runs left-down, z is up. */
const P = (x: number, y: number, z: number): [number, number] => [32 + (x - y) * K, 47 + (x + y) * 0.5 - z];
const pts = (vs: V3[]) => vs.map((v) => P(...v).map((n) => n.toFixed(2)).join(',')).join(' ');

interface Tone {
  stroke: string;
  rgb: string;
}

const TONES = {
  blue: { stroke: 'var(--wire)', rgb: 'var(--wire-rgb)' },
  red: { stroke: '#e5584f', rgb: '229, 88, 79' },
  off: { stroke: 'var(--text-muted)', rgb: '120, 130, 150' },
} satisfies Record<string, Tone>;

const Face: React.FC<{ points: string; alpha: number; tone: Tone; sw?: number }> = ({ points, alpha, tone, sw = 1.4 }) => (
  <>
    <polygon points={points} fill="var(--wire-base)" stroke="none" />
    <polygon points={points} fill={`rgba(${tone.rgb}, ${alpha})`} stroke={tone.stroke} strokeWidth={sw} strokeLinejoin="round" />
  </>
);

interface CuboidProps {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  tone: Tone;
}

/** A box whose three visible faces (top, front-left, front-right) get descending tints. */
const Cuboid: React.FC<CuboidProps> = ({ x, y, z, w, d, h, tone }) => {
  const zt = z + h;
  return (
    <g>
      <Face points={pts([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, zt], [x, y + d, zt]])} alpha={0.15} tone={tone} />
      <Face points={pts([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, zt], [x + w, y, zt]])} alpha={0.07} tone={tone} />
      <Face points={pts([[x, y, zt], [x + w, y, zt], [x + w, y + d, zt], [x, y + d, zt]])} alpha={0.26} tone={tone} />
    </g>
  );
};

const Ln: React.FC<{ a: V3; b: V3; tone: Tone; o?: number; w?: number }> = ({ a, b, tone, o = 0.8, w = 1.1 }) => {
  const [x1, y1] = P(...a);
  const [x2, y2] = P(...b);
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={tone.stroke} strokeWidth={w} strokeOpacity={o} strokeLinecap="round" />;
};

/** A small rectangle lying on the front-left face (plane y = y0). */
const PanelL: React.FC<{ x: number; y: number; z: number; w: number; h: number; tone: Tone; o?: number }> = ({ x, y, z, w, h, tone, o = 0.9 }) => (
  <polygon points={pts([[x, y, z], [x + w, y, z], [x + w, y, z + h], [x, y, z + h]])} fill={`rgba(${tone.rgb}, 0.28)`} stroke={tone.stroke} strokeWidth={0.8} strokeOpacity={o} />
);

const Led: React.FC<{ at: V3; color: string; r?: number }> = ({ at, color, r = 1.15 }) => {
  const [cx, cy] = P(...at);
  return <circle cx={cx} cy={cy} r={r} fill={color} />;
};

export interface WireDeviceProps {
  role: DeviceRole;
  active?: boolean;
  poweredOff?: boolean;
  connectedPortCount?: number;
  hasLinkDown?: boolean;
  showPortLabels?: boolean;
  portLabels?: string[];
}

export const WireDeviceArt: React.FC<WireDeviceProps> = ({
  role,
  active = false,
  poweredOff = false,
  connectedPortCount = 1,
  hasLinkDown = false,
  showPortLabels = false,
  portLabels,
}) => {
  const tone: Tone = poweredOff ? TONES.off : TONES.blue;
  const red: Tone = poweredOff ? TONES.off : TONES.red;
  const ok = poweredOff ? '#64748b' : '#22c55e';
  const link = poweredOff ? '#64748b' : hasLinkDown ? '#ef4444' : connectedPortCount > 0 ? '#22c55e' : '#94a3b8';
  const act = poweredOff ? '#64748b' : '#38bdf8';
  const amber = poweredOff ? '#64748b' : '#f59e0b';

  const portsRow = (x0: number, y: number, n: number, step: number, z = 1.4, h = 3.2, w = 3.4) =>
    Array.from({ length: n }, (_, i) => <PanelL key={i} x={x0 + i * step} y={y} z={z} w={w} h={h} tone={tone} />);

  const body = (() => {
    switch (role) {
      case 'host':
        return (
          <g>
            <Cuboid x={-17} y={-8} z={0} w={34} d={22} h={2.5} tone={tone} />
            <Cuboid x={-17} y={-8} z={2.5} w={34} d={2} h={22} tone={tone} />
            {/* screen content on the front-left face of the lid */}
            <Ln a={[-13, -6, 19]} b={[6, -6, 19]} tone={tone} w={1.3} />
            <Ln a={[-13, -6, 15]} b={[11, -6, 15]} tone={tone} o={0.55} />
            <Ln a={[-13, -6, 11]} b={[1, -6, 11]} tone={tone} o={0.55} />
            <Ln a={[-13, -6, 7]} b={[8, -6, 7]} tone={tone} o={0.4} />
            {/* keyboard rows and trackpad */}
            {[-3, 0, 3].map((y) => (
              <Ln key={y} a={[-13, y, 2.5]} b={[13, y, 2.5]} tone={tone} o={0.5} />
            ))}
            <polygon points={pts([[-5, 7, 2.5], [5, 7, 2.5], [5, 11, 2.5], [-5, 11, 2.5]])} fill={`rgba(${tone.rgb}, 0.3)`} stroke={tone.stroke} strokeWidth={0.8} />
            <Led at={[-14, 14, 1.2]} color={ok} />
            <Led at={[-11, 14, 1.2]} color={link} />
          </g>
        );
      case 'router':
      case 'nat_gateway':
        return (
          <g>
            <Cuboid x={-18} y={-9} z={0} w={36} d={20} h={8} tone={tone} />
            <Ln a={[-9, -4, 8]} b={[-9, -4, 25]} tone={tone} w={1.4} />
            <circle cx={P(-9, -4, 25)[0]} cy={P(-9, -4, 25)[1]} r={1.7} fill="var(--wire-base)" stroke={tone.stroke} strokeWidth={1.2} />
            {role === 'nat_gateway' && (
              <>
                <Ln a={[6, -4, 8]} b={[6, -4, 21]} tone={tone} w={1.4} />
                <circle cx={P(6, -4, 21)[0]} cy={P(6, -4, 21)[1]} r={1.7} fill="var(--wire-base)" stroke={tone.stroke} strokeWidth={1.2} />
              </>
            )}
            {portsRow(-14, 11, 4, 7)}
            <Led at={[18, 0, 4]} color={ok} />
            <Led at={[18, 4, 4]} color={link} />
            <Led at={[18, 8, 4]} color={act} />
          </g>
        );
      case 'switch':
      case 'hub':
        return (
          <g>
            <Cuboid x={-22} y={-9} z={0} w={role === 'hub' ? 34 : 44} d={18} h={6} tone={tone} />
            {portsRow(-19, 9, role === 'hub' ? 5 : 8, 5, 1.2, 3.4, 3.2)}
            <Ln a={[-20, -2, 6]} b={[role === 'hub' ? 10 : 20, -2, 6]} tone={tone} o={0.45} />
            <Led at={[role === 'hub' ? 12 : 22, 0, 3]} color={ok} />
            <Led at={[role === 'hub' ? 12 : 22, 4, 3]} color={link} />
          </g>
        );
      case 'access_point': {
        const [cx, cy] = P(0, 0, 4.5);
        return (
          <g>
            <Cuboid x={-11} y={-11} z={0} w={22} d={22} h={4} tone={tone} />
            {[5, 9, 13].map((r) => (
              <path key={r} d={`M${cx - r * 0.72} ${cy - 3 - r * 0.72} A${r} ${r} 0 0 1 ${cx + r * 0.72} ${cy - 3 - r * 0.72}`} fill="none" stroke={tone.stroke} strokeWidth={1.3} strokeLinecap="round" strokeOpacity={1 - r * 0.03} />
            ))}
            <circle cx={cx} cy={cy - 1.5} r={1.3} fill={tone.stroke} />
            <Led at={[0, 11, 2]} color={ok} />
          </g>
        );
      }
      case 'firewall':
        return (
          <g>
            <Cuboid x={-17} y={-10} z={0} w={34} d={20} h={18} tone={red} />
            {[6, 12].map((z) => (
              <Ln key={z} a={[-17, 10, z]} b={[17, 10, z]} tone={red} o={0.7} />
            ))}
            {[0, 1, 2, 3].map((i) => (
              <Ln key={`a${i}`} a={[-17 + 8.5 * i, 10, 0]} b={[-17 + 8.5 * i, 10, 6]} tone={red} o={0.7} />
            ))}
            {[0, 1, 2].map((i) => (
              <Ln key={`b${i}`} a={[-12.75 + 8.5 * i, 10, 6]} b={[-12.75 + 8.5 * i, 10, 12]} tone={red} o={0.7} />
            ))}
            {[0, 1, 2, 3].map((i) => (
              <Ln key={`c${i}`} a={[-17 + 8.5 * i, 10, 12]} b={[-17 + 8.5 * i, 10, 18]} tone={red} o={0.7} />
            ))}
            <Led at={[17, -2, 14]} color={ok} />
            <Led at={[17, 3, 14]} color={amber} />
          </g>
        );
      case 'vpn_gateway': {
        const [lx, ly] = P(0, 0, 9);
        return (
          <g>
            <Cuboid x={-18} y={-9} z={0} w={36} d={20} h={8} tone={tone} />
            {portsRow(-14, 11, 4, 7)}
            <rect x={lx - 5} y={ly - 9} width={10} height={8} rx={1.5} fill="var(--wire-base)" stroke={tone.stroke} strokeWidth={1.3} />
            <path d={`M${lx - 3} ${ly - 9} v-3 a3 3 0 0 1 6 0 v3`} fill="none" stroke={tone.stroke} strokeWidth={1.3} />
            <Led at={[18, 0, 4]} color={ok} />
          </g>
        );
      }
      case 'web_server':
      case 'server_tower':
        return (
          <g>
            <Cuboid x={-13} y={-11} z={0} w={26} d={22} h={38} tone={tone} />
            {Array.from({ length: 6 }, (_, i) => (
              <Ln key={i} a={[-9, 11, 5 + i * 4]} b={[9, 11, 5 + i * 4]} tone={tone} o={0.55} />
            ))}
            <PanelL x={-9} y={11} z={28} w={18} h={5} tone={tone} />
            <Led at={[13, -3, 32]} color={ok} />
            <Led at={[13, 2, 32]} color={act} />
            {role === 'web_server' && (
              <>
                <circle cx={P(0, 0, 38)[0]} cy={P(0, 0, 38)[1]} r={3.6} fill="var(--wire-base)" stroke={tone.stroke} strokeWidth={1.1} />
                <ellipse cx={P(0, 0, 38)[0]} cy={P(0, 0, 38)[1]} rx={1.5} ry={3.6} fill="none" stroke={tone.stroke} strokeWidth={0.8} />
              </>
            )}
          </g>
        );
      case 'cloud':
        return (
          <g>
            <path d="M14 46 C5 46 3 33 13 32 C12 22 27 17 33 26 C38 19 51 22 50 33 C60 34 60 46 49 46 Z" fill="var(--wire-base)" />
            <path d="M14 46 C5 46 3 33 13 32 C12 22 27 17 33 26 C38 19 51 22 50 33 C60 34 60 46 49 46 Z" fill={`rgba(${tone.rgb}, 0.18)`} stroke={tone.stroke} strokeWidth={1.5} strokeLinejoin="round" />
            <circle cx={32} cy={36} r={8} fill="var(--wire-base)" stroke={tone.stroke} strokeWidth={1.3} />
            <ellipse cx={32} cy={36} rx={3.5} ry={8} fill="none" stroke={tone.stroke} strokeWidth={0.9} />
            <line x1={24} y1={36} x2={40} y2={36} stroke={tone.stroke} strokeWidth={0.9} />
          </g>
        );
      case 'phone':
        return (
          <g>
            <Cuboid x={-6} y={-2} z={0} w={12} d={3} h={24} tone={tone} />
            <PanelL x={-4} y={1} z={4} w={8} h={15} tone={tone} o={0.6} />
            <Ln a={[-2, 1, 2]} b={[2, 1, 2]} tone={tone} w={1.4} />
            <Led at={[0, 1, 19.5]} color={act} r={0.9} />
          </g>
        );
      case 'ip_camera': {
        const [lx, ly] = P(-2, 5, 6);
        return (
          <g>
            <Cuboid x={-8} y={-5} z={4} w={16} d={10} h={9} tone={tone} />
            <Ln a={[0, 0, 4]} b={[0, 0, 0]} tone={tone} w={1.6} />
            <Cuboid x={-8} y={-5} z={0} w={16} d={10} h={1.5} tone={tone} />
            <circle cx={lx} cy={ly} r={3.4} fill="var(--wire-base)" stroke={tone.stroke} strokeWidth={1.2} />
            <circle cx={lx} cy={ly} r={1.3} fill={act} />
            <Led at={[8, 0, 11]} color={poweredOff ? '#64748b' : '#ef4444'} r={0.9} />
          </g>
        );
      }
      case 'tv_box':
        return (
          <g>
            <Cuboid x={-14} y={-9} z={0} w={28} d={18} h={5} tone={tone} />
            <PanelL x={-10} y={9} z={1} w={8} h={2.4} tone={tone} />
            <Led at={[10, 9, 2.4]} color={ok} />
            <Led at={[7, 9, 2.4]} color={act} />
            <Ln a={[-12, 0, 5]} b={[12, 0, 5]} tone={tone} o={0.4} />
          </g>
        );
      case 'plc':
        return (
          <g>
            <Cuboid x={-11} y={-8} z={0} w={22} d={16} h={18} tone={tone} />
            {[0, 1, 2, 3].map((i) => (
              <Led key={i} at={[-7 + i * 4.5, 8, 14]} color={i % 2 ? act : ok} r={0.9} />
            ))}
            <PanelL x={-8} y={8} z={4} w={16} h={5} tone={tone} />
            <Ln a={[-11, 8, 10]} b={[11, 8, 10]} tone={tone} o={0.5} />
          </g>
        );
      default: {
        // server_rack, dns_server, dhcp_server, mail_server, file_server, proxy, reverse_proxy: stacked slabs
        return (
          <g>
            {[0, 1, 2].map((i) => (
              <g key={i}>
                <Cuboid x={-15} y={-11} z={i * 8.5} w={30} d={22} h={7} tone={tone} />
                <Ln a={[-11, 11, i * 8.5 + 4.6]} b={[7, 11, i * 8.5 + 4.6]} tone={tone} o={0.6} />
                <Ln a={[-11, 11, i * 8.5 + 2.4]} b={[7, 11, i * 8.5 + 2.4]} tone={tone} o={0.4} />
                <Led at={[11, 11, i * 8.5 + 3.5]} color={i === 0 ? link : ok} r={1} />
              </g>
            ))}
            {role === 'dns_server' && <Ln a={[-15, 11, 18]} b={[15, 11, 18]} tone={{ stroke: poweredOff ? '#64748b' : 'var(--pkt-dns, #22d3ee)', rgb: tone.rgb }} w={1.8} />}
          </g>
        );
      }
    }
  })();

  const labelPos = P(-14, 14, 0);
  return (
    <g opacity={poweredOff ? 0.6 : 1} style={active && !poweredOff ? { filter: 'saturate(1.25) brightness(1.12)' } : undefined}>
      {body}
      {showPortLabels && portLabels?.[0] && (
        <g transform={`translate(${labelPos[0]}, ${labelPos[1] + 5})`}>
          <rect x={-8} y={-3.2} width={16} height={5} rx={1.2} fill="var(--wire-base)" stroke={tone.stroke} strokeWidth={0.5} />
          <text x={0} y={0.5} textAnchor="middle" fill={tone.stroke} fontSize={3.6} fontFamily="Iosevka, monospace" fontWeight={700}>
            {portLabels[0]}
          </text>
        </g>
      )}
    </g>
  );
};
