import React, { useId } from 'react';
import type { DeviceRole } from '../../engine/types';
import { WireDeviceArt } from './WireDevices';

export interface IsometricHardwareProps {
  role: DeviceRole;
  active?: boolean;
  poweredOff?: boolean;
  connectedPortCount?: number;
  hasLinkDown?: boolean;
  showPortLabels?: boolean;
  portLabels?: string[];
  /** Blue isometric wireframe style (WireDevices). Pass false for the original full-colour hardware art. */
  wire?: boolean;
}

export function formatPortLabel(raw: string): string {
  const s = raw.trim();
  if (!s) return raw;
  const lower = s.toLowerCase();
  if (lower.startsWith('gig')) return `Gig${s.slice(3)}`;
  if (lower.startsWith('gi') && !lower.startsWith('gig')) return `Gig${s.slice(2)}`;
  if (lower.startsWith('fa')) return `Fa${s.slice(2)}`;
  if (lower.startsWith('eth')) return `Eth${s.slice(3)}`;
  if (lower.startsWith('wlan')) return `Wlan${s.slice(4)}`;
  if (lower.startsWith('ser')) return `Ser${s.slice(3)}`;
  if (lower === 'wan' || lower === 'lan' || lower === 'dmz') return lower.toUpperCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Pure SVG (<g>) 30-degree isometric multi-tone hardware library (64x64 coordinate space).
 * Designed to render natively inside SVG canvases (pan/zoom & SVG/PNG export safe)
 * as well as inside standalone <svg> thumbnails via IsometricDeviceIcon.
 */
export const IsometricHardwareArt: React.FC<IsometricHardwareProps> = ({
  role,
  active = false,
  poweredOff = false,
  connectedPortCount = 1,
  hasLinkDown = false,
  showPortLabels = true,
  portLabels,
  wire = true,
}) => {
  const uid = useId().replace(/:/g, '');
  if (wire) {
    return (
      <WireDeviceArt
        role={role}
        active={active}
        poweredOff={poweredOff}
        connectedPortCount={connectedPortCount}
        hasLinkDown={hasLinkDown}
        showPortLabels={showPortLabels}
        portLabels={portLabels}
      />
    );
  }
  const p0 = portLabels?.[0] ? formatPortLabel(portLabels[0]) : undefined;
  const p1 = portLabels?.[1] ? formatPortLabel(portLabels[1]) : undefined;

  const topId = `hw-top-${uid}`;
  const leftId = `hw-left-${uid}`;
  const rightId = `hw-right-${uid}`;
  const aluId = `hw-alu-${uid}`;
  const screenId = `hw-scr-${uid}`;
  const fireId = `hw-fire-${uid}`;
  const globeId = `hw-globe-${uid}`;

  const edge = poweredOff ? '#475569' : active ? '#7dd3fc' : '#38bdf8';
  const edgeSubtle = poweredOff ? '#334155' : '#476996';
  const ledPower = poweredOff ? '#334155' : '#22c55e';
  const ledLink = poweredOff ? '#334155' : hasLinkDown ? '#ef4444' : connectedPortCount > 0 ? '#22c55e' : '#475569';
  const ledAct = poweredOff ? '#334155' : connectedPortCount > 0 ? '#38bdf8' : '#f59e0b';
  const ledAmber = poweredOff ? '#334155' : '#f59e0b';
  const ledRed = poweredOff ? '#334155' : '#ef4444';

  return (
    <g opacity={poweredOff ? 0.62 : 1}>
      <defs>
        <linearGradient id={topId} x1="10" y1="10" x2="54" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={active && !poweredOff ? '#3b5984' : '#2a4063'} />
          <stop offset="100%" stopColor="#17263f" />
        </linearGradient>
        <linearGradient id={leftId} x1="10" y1="22" x2="32" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1e2f4d" />
          <stop offset="100%" stopColor="#0e192d" />
        </linearGradient>
        <linearGradient id={rightId} x1="32" y1="22" x2="54" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0f1c32" />
          <stop offset="100%" stopColor="#070e1b" />
        </linearGradient>
        <linearGradient id={aluId} x1="12" y1="18" x2="52" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="55%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
        <linearGradient id={screenId} x1="20" y1="8" x2="48" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={poweredOff ? '#090e17' : '#0284c7'} />
          <stop offset="100%" stopColor="#061529" />
        </linearGradient>
        <linearGradient id={fireId} x1="12" y1="14" x2="52" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="50%" stopColor="#b91c1c" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </linearGradient>
        <radialGradient id={globeId} cx="38%" cy="32%" r="65%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="45%" stopColor="#0369a1" />
          <stop offset="100%" stopColor="#081b33" />
        </radialGradient>
      </defs>

      {/* Soft Isometric Floor Shadow */}
      <ellipse cx="32" cy="56" rx="22" ry="5.5" fill="#020617" fillOpacity="0.35" />

      {/* =====================================================================
          1. CLIENT / WORKSTATION LAPTOP (host)
         ===================================================================== */}
      {role === 'host' && (
        <g strokeLinejoin="round">
          {/* Open Lid Back & Side Bezel */}
          <polygon points="31,7 53,17 53,36 31,26" fill={`url(#${rightId})`} stroke={edge} strokeWidth="1.2" />
          {/* Display Screen */}
          <polygon points="33,10 51,18.2 51,33.5 33,25.2" fill={`url(#${screenId})`} />
          {/* Screen UI Lines */}
          {!poweredOff && (
            <g opacity="0.9">
              <line x1="35" y1="14.5" x2="45" y2="19" stroke="#7dd3fc" strokeWidth="1.4" strokeLinecap="round" />
              <line x1="35" y1="18" x2="48" y2="23.8" stroke="#bae6fd" strokeWidth="1.1" strokeOpacity="0.7" strokeLinecap="round" />
              <line x1="35" y1="21.5" x2="43" y2="25.2" stroke="#22c55e" strokeWidth="1.2" strokeLinecap="round" />
            </g>
          )}
          {/* Webcam LED */}
          <circle cx="42" cy="13.2" r="0.8" fill={ledAct} />

          {/* Brushed Aluminum Keyboard Deck (Top Plane) */}
          <polygon points="10,36 31,26 53,36 32,46" fill={`url(#${aluId})`} stroke={edge} strokeWidth="1.2" />
          {/* Recessed Keyboard Area */}
          <polygon points="16,35.5 31,28.5 46,35.5 31,42.5" fill="#1e293b" />
          {/* Trackpad */}
          <polygon points="22,40 27,37.7 32,40 27,42.3" fill="#475569" stroke="#cbd5e1" strokeWidth="0.5" />

          {/* Left Front Thickness + Side RJ45 & USB-C Ports */}
          <polygon points="10,36 32,46 32,50 10,40" fill={`url(#${leftId})`} stroke={edge} strokeWidth="1.1" />
          <polygon points="32,46 53,36 53,40 32,50" fill={`url(#${rightId})`} stroke={edge} strokeWidth="1.1" />
          {/* Left Side RJ-45 Ethernet Port + Link LED */}
          <polygon points="14,39 19,41.3 19,43.6 14,41.3" fill="#020617" stroke="#64748b" strokeWidth="0.6" />
          <circle cx="21.5" cy="43.2" r="1.1" fill={ledLink} />
          <circle cx="25" cy="44.8" r="1" fill={ledPower} />
          {showPortLabels && (
            <g transform="translate(15, 46.8)">
              <rect x="-7.5" y="-3.2" width="15" height="5" rx="1.2" fill="#020617" fillOpacity="0.88" stroke="#334155" strokeWidth="0.45" />
              <text x="0" y="0.5" textAnchor="middle" fill="#e0f2fe" fontSize="3.6" fontFamily="monospace" fontWeight="700">
                {p0 ?? 'Eth0'}
              </text>
            </g>
          )}
        </g>
      )}

      {/* =====================================================================
          2. ENTERPRISE ROUTER & NAT GATEWAY (router, nat_gateway)
         ===================================================================== */}
      {(role === 'router' || role === 'nat_gateway') && (
        <g strokeLinejoin="round">
          {/* Dual Rear Articulated Wi-Fi / LTE Antennas */}
          <path d="M21,20 L21,7 M43,20 L43,7" stroke="#1e293b" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M21,20 L21,7 M43,20 L43,7" stroke={edge} strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="21" cy="6.5" r="1.7" fill={edge} />
          <circle cx="43" cy="6.5" r="1.7" fill={edge} />

          {/* 3D Isometric Chassis */}
          <polygon points="32,14 55,24.5 32,35 9,24.5" fill={`url(#${topId})`} stroke={edge} strokeWidth="1.3" />
          <polygon points="9,24.5 32,35 32,47 9,36.5" fill={`url(#${leftId})`} stroke={edge} strokeWidth="1.2" />
          <polygon points="32,35 55,24.5 55,36.5 32,47" fill={`url(#${rightId})`} stroke={edge} strokeWidth="1.2" />

          {/* Top Brushed Plate & Routing Arrows */}
          <path
            d="M23,24.5 L41,24.5 M37,22 L41,24.5 L37,27 M41,20.5 L23,28.5"
            stroke={edge}
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.85"
          />

          {/* Front-Left Faceplate: 4 Recessed RJ-45 Gigabit Jacks with Gold Pins & LEDs */}
          {[0, 1, 2, 3].map((idx) => {
            const x0 = 12 + idx * 4.5;
            const y0 = 28.2 + idx * 2.05;
            return (
              <g key={idx}>
                <polygon
                  points={`${x0},${y0} ${x0 + 3.4},${y0 + 1.55} ${x0 + 3.4},${y0 + 5.1} ${x0},${y0 + 3.55}`}
                  fill="#020617"
                  stroke="#64748b"
                  strokeWidth="0.65"
                />
                {/* Gold pins along top inside jack */}
                <line
                  x1={x0 + 0.6}
                  y1={y0 + 1.1}
                  x2={x0 + 2.8}
                  y2={y0 + 2.1}
                  stroke="#fbbf24"
                  strokeWidth="0.9"
                />
                {/* Port LED above jack */}
                <circle
                  cx={x0 + 1.7}
                  cy={y0 - 0.9}
                  r="0.95"
                  fill={idx === 0 ? ledLink : idx === 1 ? ledAct : ledAmber}
                />
              </g>
            );
          })}

          {/* Front-Right Faceplate: SFP Fiber Cage, Console & SYS/PWR LEDs */}
          <polygon points="36,36 42,33.2 42,37.8 36,40.6" fill="#020617" stroke="#22d3ee" strokeWidth="0.8" />
          <polygon points="44,32.3 48.5,30.2 48.5,34.4 44,36.5" fill="#0369a1" fillOpacity="0.4" stroke={edge} strokeWidth="0.7" />
          <circle cx="51.5" cy="30.2" r="1.2" fill={ledPower} />
          <circle cx="51.5" cy="33.8" r="1.2" fill={role === 'nat_gateway' ? ledAmber : ledAct} />

          {/* Subtle High-Contrast Silkscreen Port Markings */}
          {showPortLabels && (
            <g fontFamily="monospace" fontWeight="700" textAnchor="middle">
              <g transform="translate(15, 42)">
                <rect x="-8.5" y="-3.2" width="17" height="5" rx="1.2" fill="#020617" fillOpacity="0.9" stroke="#38bdf8" strokeOpacity="0.55" strokeWidth="0.45" />
                <text x="0" y="0.5" fill="#e0f2fe" fontSize="3.4">
                  {p0 ?? 'Gig0/0'}
                </text>
              </g>
              <g transform="translate(39, 43.2)">
                <rect x="-8" y="-3.2" width="16" height="5" rx="1.2" fill="#020617" fillOpacity="0.9" stroke="#22d3ee" strokeOpacity="0.65" strokeWidth="0.45" />
                <text x="0" y="0.5" fill="#67e8f9" fontSize="3.4">
                  {p1 ?? 'Gig0/1'}
                </text>
              </g>
            </g>
          )}

          {/* NAT Indicator Badge */}
          {role === 'nat_gateway' && (
            <g transform="translate(32, 24.5)">
              <circle r="4.5" fill="#f59e0b" fillOpacity="0.22" stroke="#f59e0b" strokeWidth="1" />
              <text x="0" y="1.6" textAnchor="middle" fill="#fde68a" fontSize="4.6" fontFamily="monospace" fontWeight="bold">
                NAT
              </text>
            </g>
          )}
        </g>
      )}

      {/* =====================================================================
          3. L2 MANAGED SWITCH / L1 HUB (switch, hub)
         ===================================================================== */}
      {(role === 'switch' || role === 'hub') && (
        <g strokeLinejoin="round">
          {/* 3D Isometric 1U Rackmount Chassis */}
          <polygon points="32,16 57,27.5 32,39 7,27.5" fill={`url(#${topId})`} stroke={edge} strokeWidth="1.3" />
          <polygon points="7,27.5 32,39 32,48.5 7,37" fill={`url(#${leftId})`} stroke={edge} strokeWidth="1.2" />
          <polygon points="32,39 57,27.5 57,37 32,48.5" fill={`url(#${rightId})`} stroke={edge} strokeWidth="1.2" />

          {/* Top Switching Bidirectional Vectors */}
          <g stroke={role === 'hub' ? '#f59e0b' : edge} strokeWidth="1.35" strokeLinecap="round" opacity="0.9">
            <path d="M24,25 L38,25 M35,23 L38,25 L35,27" />
            <path d="M40,29.5 L26,29.5 M29,27.5 L26,29.5 L29,31.5" />
          </g>

          {/* 6 Isometric RJ-45 Ports on Left-Front Bezel with Gold Pins + Port LEDs */}
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const x0 = 9.5 + idx * 3.5;
            const y0 = 30.8 + idx * 1.6;
            return (
              <g key={idx}>
                <polygon
                  points={`${x0},${y0} ${x0 + 2.6},${y0 + 1.2} ${x0 + 2.6},${y0 + 4.4} ${x0},${y0 + 3.2}`}
                  fill="#020617"
                  stroke="#64748b"
                  strokeWidth="0.55"
                />
                <line x1={x0 + 0.5} y1={y0 + 0.9} x2={x0 + 2.1} y2={y0 + 1.65} stroke="#fbbf24" strokeWidth="0.8" />
                <circle
                  cx={x0 + 1.3}
                  cy={y0 - 0.8}
                  r="0.85"
                  fill={role === 'hub' ? ledAmber : idx % 3 === 2 ? ledAct : ledLink}
                />
              </g>
            );
          })}

          {/* Right-Front Side: Dual SFP+ Uplinks + Rack Ear + System LEDs */}
          {[0, 1].map((idx) => {
            const x0 = 36 + idx * 5.2;
            const y0 = 39.2 - idx * 2.4;
            return (
              <g key={idx}>
                <polygon
                  points={`${x0},${y0} ${x0 + 3.8},${y0 - 1.75} ${x0 + 3.8},${y0 + 1.8} ${x0},${y0 + 3.55}`}
                  fill="#020617"
                  stroke="#22d3ee"
                  strokeWidth="0.7"
                />
                <circle cx={x0 + 1.9} cy={y0 - 1.4} r="0.85" fill={ledAct} />
              </g>
            );
          })}
          <circle cx="49" cy="34.5" r="1.15" fill={ledPower} />
          <circle cx="52.5" cy="32.8" r="1.15" fill={role === 'hub' ? ledAmber : ledLink} />
          {showPortLabels && (
            <g fontFamily="monospace" fontWeight="700" textAnchor="middle">
              <g transform="translate(15.5, 44.2)">
                <rect x="-8.5" y="-3.2" width="17" height="5" rx="1.2" fill="#020617" fillOpacity="0.9" stroke="#38bdf8" strokeOpacity="0.55" strokeWidth="0.45" />
                <text x="0" y="0.5" fill="#e0f2fe" fontSize="3.4">
                  {p0 ?? 'Fa0/1'}
                </text>
              </g>
              <g transform="translate(42.5, 44.5)">
                <rect x="-8.5" y="-3.2" width="17" height="5" rx="1.2" fill="#020617" fillOpacity="0.9" stroke="#22d3ee" strokeOpacity="0.65" strokeWidth="0.45" />
                <text x="0" y="0.5" fill="#67e8f9" fontSize="3.4">
                  {p1 ?? 'Gig0/1'}
                </text>
              </g>
            </g>
          )}
        </g>
      )}

      {/* =====================================================================
          4. WI-FI ACCESS POINT (access_point)
         ===================================================================== */}
      {role === 'access_point' && (
        <g strokeLinejoin="round">
          {/* Isometric RF Waves */}
          <path d="M18,19 C23,11 41,11 46,19" stroke={ledAct} strokeWidth="1.7" strokeLinecap="round" fill="none" />
          <path d="M23,23 C26.5,17.5 37.5,17.5 41,23" stroke={ledAct} strokeWidth="1.7" strokeLinecap="round" fill="none" />

          {/* 3D Isometric Enterprise Dish */}
          <ellipse cx="32" cy="40" rx="22" ry="11" fill={`url(#${rightId})`} stroke={edge} strokeWidth="1.3" />
          <ellipse cx="32" cy="37" rx="21.5" ry="10.2" fill={`url(#${topId})`} stroke={edge} strokeWidth="1.2" />
          {/* Glowing Status Ring LED */}
          <ellipse cx="32" cy="36.5" rx="8.5" ry="4" fill="none" stroke={ledLink} strokeWidth="1.8" />
          <circle cx="32" cy="36.5" r="1.8" fill={ledAct} />
          {/* Front PoE RJ-45 Recess */}
          <rect x="28.5" y="47.5" width="7" height="3.2" rx="0.7" fill="#020617" stroke="#64748b" strokeWidth="0.8" />
          <line x1="30" y1="48.4" x2="34" y2="48.4" stroke="#fbbf24" strokeWidth="0.8" />
          {showPortLabels && (
            <g transform="translate(45, 48.2)">
              <rect x="-7.5" y="-3" width="15" height="4.8" rx="1.2" fill="#020617" fillOpacity="0.9" stroke="#38bdf8" strokeOpacity="0.55" strokeWidth="0.45" />
              <text x="0" y="0.5" textAnchor="middle" fill="#e0f2fe" fontSize="3.3" fontFamily="monospace" fontWeight="700">
                {p0 ?? 'Eth0'}
              </text>
            </g>
          )}
        </g>
      )}

      {/* =====================================================================
          5. SERVER RACK / WEB / DNS / DHCP (server_rack, web_server, dns_server, dhcp_server)
         ===================================================================== */}
      {(role === 'server_rack' || role === 'web_server' || role === 'dns_server' || role === 'dhcp_server') && (
        <g strokeLinejoin="round">
          {/* Tall Isometric 42U Cabinet */}
          <polygon points="32,7 51,15.5 32,24 13,15.5" fill={`url(#${topId})`} stroke={edge} strokeWidth="1.3" />
          <polygon points="13,15.5 32,24 32,53 13,44.5" fill={`url(#${leftId})`} stroke={edge} strokeWidth="1.2" />
          <polygon points="32,24 51,15.5 51,44.5 32,53" fill={`url(#${rightId})`} stroke={edge} strokeWidth="1.2" />

          {/* 4 Hot-Swap Server Blade Units on Left Front Face */}
          {[0, 1, 2, 3].map((idx) => {
            const y0 = 20 + idx * 6.4;
            return (
              <g key={idx}>
                <polygon
                  points={`15,${y0} 30,${y0 + 6.8} 30,${y0 + 10.6} 15,${y0 + 3.8}`}
                  fill="#0b1528"
                  stroke={edgeSubtle}
                  strokeWidth="0.75"
                />
                {/* Drive Bay Handle & Vent */}
                <line x1="16.8" y1={y0 + 2.4} x2="23.5" y2={y0 + 5.4} stroke="#64748b" strokeWidth="1.1" strokeLinecap="round" />
                {/* Dual Blade LEDs */}
                <circle cx="25.8" cy={y0 + 6.7} r="0.95" fill={idx === 0 ? ledAct : ledLink} />
                <circle cx="28.1" cy={y0 + 7.7} r="0.95" fill={ledLink} />
              </g>
            );
          })}

          {/* Side Cooling Louvers + Rear NIC Port on Right Face */}
          {[22, 27, 32, 37].map((y) => (
            <line key={y} x1="35" y1={y + 2} x2="48" y2={y - 3.8} stroke="#334155" strokeWidth="1.2" strokeLinecap="round" />
          ))}
          <polygon points="41,42 46,39.8 46,43.8 41,46" fill="#020617" stroke="#22d3ee" strokeWidth="0.7" />
          {showPortLabels && (
            <g transform="translate(43, 49.2)">
              <rect x="-8" y="-3.2" width="16" height="5" rx="1.2" fill="#020617" fillOpacity="0.9" stroke="#22d3ee" strokeOpacity="0.6" strokeWidth="0.45" />
              <text x="0" y="0.5" textAnchor="middle" fill="#67e8f9" fontSize="3.4" fontFamily="monospace" fontWeight="700">
                {p0 ?? 'Eth0'}
              </text>
            </g>
          )}

          {/* Role Distinction Emblem on Top/Corner */}
          {role === 'web_server' && (
            <g transform="translate(32, 15.5)">
              <ellipse cx="0" cy="0" rx="6.5" ry="3.2" fill="#0284c7" fillOpacity="0.35" stroke="#7dd3fc" strokeWidth="0.9" />
              <line x1="-6" y1="0" x2="6" y2="0" stroke="#7dd3fc" strokeWidth="0.7" />
            </g>
          )}
          {role === 'dns_server' && (
            <circle cx="32" cy="15.5" r="3" fill="#a855f7" stroke="#f3e8ff" strokeWidth="0.9" />
          )}
          {role === 'dhcp_server' && (
            <circle cx="32" cy="15.5" r="3" fill="#22c55e" stroke="#dcfce7" strokeWidth="0.9" />
          )}
        </g>
      )}

      {/* =====================================================================
          6. SERVER TOWER / NAS / FILE / MAIL (server_tower, file_server, mail_server)
         ===================================================================== */}
      {(role === 'server_tower' || role === 'file_server' || role === 'mail_server') && (
        <g strokeLinejoin="round">
          <polygon points="32,7 48,14.5 32,22 16,14.5" fill={`url(#${topId})`} stroke={edge} strokeWidth="1.3" />
          <polygon points="16,14.5 32,22 32,53 16,45.5" fill={`url(#${leftId})`} stroke={edge} strokeWidth="1.2" />
          <polygon points="32,22 48,14.5 48,45.5 32,53" fill={`url(#${rightId})`} stroke={edge} strokeWidth="1.2" />

          {/* Vertical NAS Hot-Swap Sleds */}
          {[0, 1, 2].map((idx) => {
            const x0 = 18.2 + idx * 4.2;
            const yTop = 21 + idx * 1.95;
            return (
              <g key={idx}>
                <polygon
                  points={`${x0},${yTop} ${x0 + 3},${yTop + 1.4} ${x0 + 3},${yTop + 21} ${x0},${yTop + 19.6}`}
                  fill="#0b1528"
                  stroke={edgeSubtle}
                  strokeWidth="0.7"
                />
                <circle cx={x0 + 1.5} cy={yTop + 3.2} r="0.95" fill={idx === 1 ? ledAct : ledLink} />
              </g>
            );
          })}

          {/* Power Button & Dual NIC on Side */}
          <circle cx="42" cy="40" r="1.4" fill={ledPower} />
          <polygon points="36,42 40,40.2 40,43.8 36,45.6" fill="#020617" stroke={edge} strokeWidth="0.7" />
          {showPortLabels && (
            <g transform="translate(40, 49.6)">
              <rect x="-7.5" y="-3.2" width="15" height="5" rx="1.2" fill="#020617" fillOpacity="0.9" stroke="#38bdf8" strokeOpacity="0.55" strokeWidth="0.45" />
              <text x="0" y="0.5" textAnchor="middle" fill="#e0f2fe" fontSize="3.4" fontFamily="monospace" fontWeight="700">
                {p0 ?? 'Eth0'}
              </text>
            </g>
          )}
          {role === 'mail_server' && (
            <path d="M26,14.5 L32,17.2 L38,14.5 L32,11.8 Z" fill="#0284c7" fillOpacity="0.4" stroke="#7dd3fc" strokeWidth="0.9" />
          )}
        </g>
      )}

      {/* =====================================================================
          7. HARDWARE FIREWALL (firewall)
         ===================================================================== */}
      {role === 'firewall' && (
        <g strokeLinejoin="round">
          {/* Base Metallic 1U Security Chassis */}
          <polygon points="32,28 55,38 32,48 9,38" fill={`url(#${topId})`} stroke={edge} strokeWidth="1.1" />
          <polygon points="9,38 32,48 32,53 9,43" fill={`url(#${leftId})`} stroke={edge} strokeWidth="1.1" />
          <polygon points="32,48 55,38 55,43 32,53" fill={`url(#${rightId})`} stroke={edge} strokeWidth="1.1" />

          {/* Armored Isometric Brick Wall Rising Above Base */}
          <polygon points="32,9 51,17.5 32,26 13,17.5" fill="#ef4444" stroke="#fca5a5" strokeWidth="1.2" />
          <polygon points="13,17.5 32,26 32,43 13,34.5" fill={`url(#${fireId})`} stroke="#fca5a5" strokeWidth="1.2" />
          <polygon points="32,26 51,17.5 51,34.5 32,43" fill="#7f1d1d" stroke="#fca5a5" strokeWidth="1.2" />

          {/* Isometric Brick Mortar Courses */}
          <g stroke="#fecaca" strokeOpacity="0.55" strokeWidth="0.9">
            <line x1="13" y1="23.2" x2="32" y2="31.7" />
            <line x1="13" y1="28.8" x2="32" y2="37.3" />
            <line x1="32" y1="31.7" x2="51" y2="23.2" />
            <line x1="32" y1="37.3" x2="51" y2="28.8" />
            <line x1="22.5" y1="21.8" x2="22.5" y2="27.5" />
            <line x1="18" y1="25.5" x2="18" y2="31" />
            <line x1="27" y1="29.5" x2="27" y2="35" />
            <line x1="41.5" y1="21.8" x2="41.5" y2="27.5" />
          </g>

          {/* Front Base RJ-45 Trusted/Untrusted Ports + Threat LED */}
          {[0, 1, 2].map((idx) => (
            <polygon
              key={idx}
              points={`${13 + idx * 5},${40.5 + idx * 2.2} ${16.2 + idx * 5},${42 + idx * 2.2} ${16.2 + idx * 5},${44.8 + idx * 2.2} ${13 + idx * 5},${43.3 + idx * 2.2}`}
              fill="#020617"
              stroke="#fca5a5"
              strokeWidth="0.6"
            />
          ))}
          <circle cx="41" cy="46" r="1.3" fill={ledRed} />
          <circle cx="46" cy="43.8" r="1.3" fill={ledLink} />
          {showPortLabels && (
            <g fontFamily="monospace" fontWeight="700" textAnchor="middle">
              <g transform="translate(14.5, 48.5)">
                <rect x="-7.5" y="-3.2" width="15" height="5" rx="1.2" fill="#020617" fillOpacity="0.9" stroke="#fca5a5" strokeOpacity="0.65" strokeWidth="0.45" />
                <text x="0" y="0.5" fill="#fecaca" fontSize="3.4">
                  {p0 ?? 'Eth0'}
                </text>
              </g>
              <g transform="translate(44, 49.5)">
                <rect x="-7.5" y="-3.2" width="15" height="5" rx="1.2" fill="#020617" fillOpacity="0.9" stroke="#86efac" strokeOpacity="0.65" strokeWidth="0.45" />
                <text x="0" y="0.5" fill="#bbf7d0" fontSize="3.4">
                  {p1 ?? 'Eth1'}
                </text>
              </g>
            </g>
          )}
        </g>
      )}

      {/* =====================================================================
          8. PROXY / REVERSE PROXY / VPN GATEWAY (proxy, reverse_proxy, vpn_gateway)
         ===================================================================== */}
      {(role === 'proxy' || role === 'reverse_proxy' || role === 'vpn_gateway') && (
        <g strokeLinejoin="round">
          <polygon points="32,14 54,24 32,34 10,24" fill={`url(#${topId})`} stroke={edge} strokeWidth="1.3" />
          <polygon points="10,24 32,34 32,48 10,38" fill={`url(#${leftId})`} stroke={edge} strokeWidth="1.2" />
          <polygon points="32,34 54,24 54,38 32,48" fill={`url(#${rightId})`} stroke={edge} strokeWidth="1.2" />

          {/* Glowing Crypto / Proxy Shield Crest on Top */}
          <path
            d="M32,17 L39,20.5 V25 C39,28.5 35.8,30.8 32,32 C28.2,30.8 25,28.5 25,25 V20.5 Z"
            fill="#0284c7"
            fillOpacity="0.45"
            stroke="#7dd3fc"
            strokeWidth="1.2"
          />

          {/* Dual-NIC WAN/LAN Ports + Status LEDs */}
          {[0, 1].map((idx) => {
            const x0 = 14 + idx * 7;
            const y0 = 29 + idx * 3.1;
            return (
              <g key={idx}>
                <polygon
                  points={`${x0},${y0} ${x0 + 4.5},${y0 + 2} ${x0 + 4.5},${y0 + 6} ${x0},${y0 + 4}`}
                  fill="#020617"
                  stroke={idx === 0 ? '#22d3ee' : '#22c55e'}
                  strokeWidth="0.7"
                />
                <circle cx={x0 + 2.2} cy={y0 - 1.2} r="1" fill={idx === 0 ? ledAct : ledLink} />
              </g>
            );
          })}
          <circle cx="47" cy="33" r="1.2" fill={ledPower} />
          <circle cx="42" cy="35.3" r="1.2" fill={ledAct} />
          {showPortLabels && (
            <g fontFamily="monospace" fontWeight="700" textAnchor="middle">
              <g transform="translate(17.5, 42.2)">
                <rect x="-7.5" y="-3.2" width="15" height="5" rx="1.2" fill="#020617" fillOpacity="0.9" stroke="#22d3ee" strokeOpacity="0.65" strokeWidth="0.45" />
                <text x="0" y="0.5" fill="#67e8f9" fontSize="3.4">
                  {p0 ?? 'Eth0'}
                </text>
              </g>
              <g transform="translate(44, 43.2)">
                <rect x="-7.5" y="-3.2" width="15" height="5" rx="1.2" fill="#020617" fillOpacity="0.9" stroke="#86efac" strokeOpacity="0.65" strokeWidth="0.45" />
                <text x="0" y="0.5" fill="#bbf7d0" fontSize="3.4">
                  {p1 ?? 'Eth1'}
                </text>
              </g>
            </g>
          )}
        </g>
      )}

      {/* =====================================================================
          9. INTERNET BACKBONE GLOBE / CLOUD (cloud)
         ===================================================================== */}
      {role === 'cloud' && (
        <g strokeLinejoin="round">
          <circle cx="32" cy="30" r="19" fill={`url(#${globeId})`} stroke={edge} strokeWidth="1.4" />
          <ellipse cx="32" cy="30" rx="9" ry="19" fill="none" stroke="#7dd3fc" strokeOpacity="0.55" strokeWidth="1.1" />
          <ellipse cx="32" cy="30" rx="22" ry="7" transform="rotate(-18 32 30)" fill="none" stroke={edge} strokeOpacity="0.7" strokeWidth="1.1" strokeDasharray="3 2.5" />
          <line x1="13" y1="30" x2="51" y2="30" stroke="#7dd3fc" strokeOpacity="0.45" strokeWidth="1" />
          {/* Backbone Fiber POP Nodes */}
          <circle cx="22" cy="22" r="2.2" fill={ledAct} stroke="#fff" strokeWidth="0.7" />
          <circle cx="41" cy="25" r="2.2" fill={ledLink} stroke="#fff" strokeWidth="0.7" />
          <circle cx="30" cy="39" r="2.2" fill={ledAmber} stroke="#fff" strokeWidth="0.7" />
        </g>
      )}

      {/* =====================================================================
          10. POE IP CAMERA (ip_camera)
         ===================================================================== */}
      {role === 'ip_camera' && (
        <g strokeLinejoin="round">
          {/* Wall Mount & Pivot Arm */}
          <polygon points="8,24 14,27 14,45 8,42" fill={`url(#${leftId})`} stroke={edge} strokeWidth="1.1" />
          <path d="M14,35 L23,35 L23,29" stroke={edge} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          {/* Isometric Camera Barrel */}
          <polygon points="18,17 44,21 38,26 12,22" fill={`url(#${topId})`} stroke={edge} strokeWidth="1.2" />
          <polygon points="12,22 38,26 38,37 12,33" fill={`url(#${leftId})`} stroke={edge} strokeWidth="1.2" />
          {/* Optical Glass Lens Assembly */}
          <ellipse cx="44" cy="29.5" rx="6.5" ry="8" fill="#020617" stroke={edge} strokeWidth="1.4" />
          <ellipse cx="44.5" cy="29.5" rx="3.2" ry="4" fill={`url(#${screenId})`} stroke="#7dd3fc" strokeWidth="0.8" />
          <circle cx="43.5" cy="28" r="1" fill="#ffffff" fillOpacity="0.8" />
          {/* IR Ring + Recording LED */}
          <circle cx="21" cy="26.5" r="1.3" fill={ledRed} />
          <circle cx="25" cy="27.2" r="1.1" fill={ledLink} />
        </g>
      )}

      {/* =====================================================================
          11. SMART TV / MEDIA BOX (tv_box)
         ===================================================================== */}
      {role === 'tv_box' && (
        <g strokeLinejoin="round">
          {/* Angled Isometric Widescreen Display */}
          <polygon points="13,12 51,21 51,43 13,34" fill={`url(#${rightId})`} stroke={edge} strokeWidth="1.4" />
          <polygon points="16,15 48,22.6 48,39.8 16,32.2" fill={`url(#${screenId})`} />
          {!poweredOff && (
            <polygon points="29,23.5 29,31 36,28.8" fill="#7dd3fc" fillOpacity="0.9" />
          )}
          {/* Pedestal Neck & Base */}
          <line x1="32" y1="38.5" x2="32" y2="48" stroke={edge} strokeWidth="2.6" />
          <polygon points="32,45 44,50 32,54 20,50" fill={`url(#${topId})`} stroke={edge} strokeWidth="1.2" />
          <circle cx="46" cy="40.5" r="1.1" fill={ledLink} />
        </g>
      )}

      {/* =====================================================================
          12. SMARTPHONE (phone)
         ===================================================================== */}
      {role === 'phone' && (
        <g strokeLinejoin="round">
          {/* Isometric Angled Chassis */}
          <polygon points="22,12 42,20 42,50 22,42" fill={`url(#${rightId})`} stroke={edge} strokeWidth="1.5" />
          <polygon points="24.5,15.5 39.5,21.5 39.5,45.5 24.5,39.5" fill={`url(#${screenId})`} />
          {!poweredOff && (
            <g>
              <line x1="27" y1="22" x2="36" y2="25.5" stroke="#7dd3fc" strokeWidth="1.4" strokeLinecap="round" />
              <rect x="27" y="27" width="2" height="5" fill={ledLink} />
              <rect x="30" y="26.5" width="2" height="6.5" fill={ledLink} />
              <rect x="33" y="26" width="2" height="8" fill={ledAct} />
            </g>
          )}
          <circle cx="32" cy="44" r="1.1" fill={ledAct} />
        </g>
      )}

      {/* =====================================================================
          13. INDUSTRIAL DIN-RAIL PLC (plc)
         ===================================================================== */}
      {role === 'plc' && (
        <g strokeLinejoin="round">
          {/* DIN Rail Backing */}
          <polygon points="6,27 58,27 58,34 6,34" fill="#334155" fillOpacity="0.45" />
          {/* 3D Isometric PLC Module */}
          <polygon points="32,9 51,17.5 32,26 13,17.5" fill={`url(#${topId})`} stroke="#f59e0b" strokeWidth="1.3" />
          <polygon points="13,17.5 32,26 32,51 13,42.5" fill={`url(#${leftId})`} stroke="#f59e0b" strokeWidth="1.2" />
          <polygon points="32,26 51,17.5 51,42.5 32,51" fill={`url(#${rightId})`} stroke="#f59e0b" strokeWidth="1.2" />

          {/* Screw Terminal I/O Block */}
          <polygon points="16,20.5 29,26.3 29,30.5 16,24.7" fill="#334155" />
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} cx={18 + i * 3} cy={23.2 + i * 1.35} r="0.9" fill="#020617" stroke="#cbd5e1" strokeWidth="0.5" />
          ))}

          {/* RUN / IO / ETH Status LEDs */}
          <circle cx="17" cy="31" r="1.2" fill={ledLink} />
          <circle cx="17" cy="35" r="1.2" fill={ledAmber} />
          <circle cx="17" cy="39" r="1.2" fill={ledAct} />

          {/* Bottom Profinet RJ-45 Port */}
          <polygon points="22,38.5 27,40.8 27,45.5 22,43.2" fill="#020617" stroke="#38bdf8" strokeWidth="0.8" />
          <line x1="23" y1="39.8" x2="26" y2="41.2" stroke="#fbbf24" strokeWidth="0.8" />
          {showPortLabels && (
            <g transform="translate(24.5, 49.6)">
              <rect x="-7.5" y="-3.2" width="15" height="5" rx="1.2" fill="#020617" fillOpacity="0.9" stroke="#f59e0b" strokeOpacity="0.7" strokeWidth="0.45" />
              <text x="0" y="0.5" textAnchor="middle" fill="#fde68a" fontSize="3.4" fontFamily="monospace" fontWeight="700">
                {p0 ?? 'Eth0'}
              </text>
            </g>
          )}
        </g>
      )}
    </g>
  );
};
