import React, { useId } from 'react';
import type { DeviceRole } from '../../engine/types';

export interface IsometricHardwareProps {
  role: DeviceRole;
  active?: boolean;
  poweredOff?: boolean;
  connectedPortCount?: number;
  hasLinkDown?: boolean;
  showPortLabels?: boolean;
  portLabels?: string[];
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
 * Photorealistic 30-degree isometric enterprise networking hardware library (64x64 coordinate space).
 * Features authentic materials: brushed aluminum, powder-coated slate metal, RJ-45 jacks with gold pins,
 * metallic SFP cages, dual-color activity LEDs, and glass display reflections.
 */
export const IsometricHardwareArt: React.FC<IsometricHardwareProps> = ({
  role,
  active = false,
  poweredOff = false,
  connectedPortCount = 1,
  hasLinkDown = false,
  showPortLabels = true,
  portLabels,
}) => {
  const uid = useId().replace(/:/g, '');
  const p0 = portLabels?.[0] ? formatPortLabel(portLabels[0]) : undefined;
  const p1 = portLabels?.[1] ? formatPortLabel(portLabels[1]) : undefined;

  // Unique Gradient IDs
  const rackTopId = `hw-racktop-${uid}`;
  const rackLeftId = `hw-rackleft-${uid}`;
  const rackRightId = `hw-rackright-${uid}`;
  const aluDeckId = `hw-aludeck-${uid}`;
  const screenId = `hw-screen-${uid}`;
  const glareId = `hw-glare-${uid}`;
  const fireId = `hw-fire-${uid}`;
  const globeId = `hw-globe-${uid}`;
  const antennaId = `hw-ant-${uid}`;

  // Lighting & Material Tones
  const chassisBevel = active && !poweredOff ? '#38bdf8' : '#64748b';
  const chassisHighlight = '#cbd5e1';
  const chassisShadow = '#090d16';
  const ledPower = poweredOff ? '#334155' : '#22c55e';
  const ledLink = poweredOff ? '#334155' : hasLinkDown ? '#ef4444' : connectedPortCount > 0 ? '#22c55e' : '#475569';
  const ledAct = poweredOff ? '#334155' : connectedPortCount > 0 ? '#38bdf8' : '#f59e0b';
  const ledAmber = poweredOff ? '#334155' : '#f59e0b';
  const ledRed = poweredOff ? '#334155' : '#ef4444';

  return (
    <g opacity={poweredOff ? 0.65 : 1}>
      <defs>
        {/* Powder-Coated Enterprise Slate Metal (Top Light) */}
        <linearGradient id={rackTopId} x1="12" y1="10" x2="52" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={active && !poweredOff ? '#334155' : '#273549'} />
          <stop offset="60%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#131c2a" />
        </linearGradient>

        {/* Shaded Left Flank */}
        <linearGradient id={rackLeftId} x1="10" y1="22" x2="32" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>

        {/* Ambient Occlusion Right Face */}
        <linearGradient id={rackRightId} x1="32" y1="22" x2="54" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#141e2e" />
          <stop offset="100%" stopColor="#0a0f18" />
        </linearGradient>

        {/* Realistic Brushed Aluminum Deck */}
        <linearGradient id={aluDeckId} x1="10" y1="26" x2="53" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="35%" stopColor="#e2e8f0" />
          <stop offset="70%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>

        {/* Glass Screen */}
        <linearGradient id={screenId} x1="32" y1="8" x2="50" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={poweredOff ? '#090e17' : '#0369a1'} />
          <stop offset="50%" stopColor={poweredOff ? '#05080e' : '#024d77'} />
          <stop offset="100%" stopColor="#020d1c" />
        </linearGradient>

        {/* Specular Diagonal Glass Glare */}
        <linearGradient id={glareId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Security Crimson Appliance Top */}
        <linearGradient id={fireId} x1="12" y1="14" x2="52" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#dc2626" />
          <stop offset="50%" stopColor="#991b1b" />
          <stop offset="100%" stopColor="#450a0a" />
        </linearGradient>

        {/* Global Optical Network Sphere */}
        <radialGradient id={globeId} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="40%" stopColor="#0284c7" />
          <stop offset="75%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>

        {/* Antenna Dipole Texture */}
        <linearGradient id={antennaId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="50%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>

      {/* Realistic Soft Ambient Occlusion Floor Shadow */}
      <ellipse cx="32" cy="56" rx="23" ry="5.5" fill="#020617" fillOpacity="0.45" />

      {/* =====================================================================
          1. CLIENT / WORKSTATION LAPTOP (host)
         ===================================================================== */}
      {role === 'host' && (
        <g strokeLinejoin="round">
          {/* Display Lid Back Shell */}
          <polygon points="31,6.5 53,16.5 53,35.5 31,25.5" fill={`url(#${rackRightId})`} stroke={chassisShadow} strokeWidth="0.8" />
          
          {/* Thin Black Display Bezel */}
          <polygon points="32,8.5 51.5,17.4 51.5,34 32,25.2" fill="#090d16" />
          
          {/* Glass Display Screen */}
          <polygon points="33,10.2 50,18 50,32.6 33,24.8" fill={`url(#${screenId})`} />
          
          {/* Specular Diagonal Glass Glare */}
          <polygon points="33,10.2 46,16 40,28 33,24.8" fill={`url(#${glareId})`} />

          {/* Screen UI Lines (Terminal / Desktop preview) */}
          {!poweredOff && (
            <g opacity="0.85">
              <line x1="35" y1="14" x2="44" y2="18.2" stroke="#bae6fd" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="35" y1="17.2" x2="48" y2="23.2" stroke="#7dd3fc" strokeWidth="1" strokeLinecap="round" />
              <line x1="35" y1="20.4" x2="43" y2="24" stroke="#4ade80" strokeWidth="1.1" strokeLinecap="round" />
              <line x1="35" y1="23.2" x2="41" y2="26" stroke="#facc15" strokeWidth="1" strokeLinecap="round" />
            </g>
          )}

          {/* Micro Webcam Bezel & Green Indicator */}
          <circle cx="42.5" cy="12.5" r="0.8" fill="#1e293b" />
          <circle cx="42.5" cy="12.5" r="0.4" fill={ledAct} />

          {/* Brushed Aluminum Keyboard Deck (Top Plane) */}
          <polygon points="10,35.5 31,25.5 53,35.5 32,45.5" fill={`url(#${aluDeckId})`} stroke={chassisHighlight} strokeWidth="0.6" strokeOpacity="0.8" />
          
          {/* Recessed Chiclet Keyboard Area */}
          <polygon points="15.5,35 31,27.8 46.5,35 31,42.2" fill="#0f172a" stroke="#334155" strokeWidth="0.5" />
          {/* Key Rows Hints */}
          <line x1="19" y1="34" x2="43" y2="34" stroke="#1e293b" strokeWidth="0.8" />
          <line x1="22" y1="36.8" x2="40" y2="36.8" stroke="#1e293b" strokeWidth="0.8" />

          {/* Smooth Metallic Trackpad */}
          <polygon points="23,39.8 27.5,37.6 32,39.8 27.5,42" fill="#94a3b8" stroke="#cbd5e1" strokeWidth="0.45" />

          {/* Aluminum Front Edge & Thickness */}
          <polygon points="10,35.5 32,45.5 32,49.5 10,39.5" fill={`url(#${rackLeftId})`} stroke={chassisShadow} strokeWidth="0.6" />
          <polygon points="32,45.5 53,35.5 53,39.5 32,49.5" fill={`url(#${rackRightId})`} stroke={chassisShadow} strokeWidth="0.6" />

          {/* Left Side RJ-45 Gigabit Port with Metallic Shield Collar */}
          <polygon points="13.5,38.5 18,40.6 18,43 13.5,40.8" fill="#020617" stroke="#64748b" strokeWidth="0.65" />
          <line x1="14.2" y1="39.2" x2="17.3" y2="40.7" stroke="#fbbf24" strokeWidth="0.75" />
          <circle cx="20" cy="42.5" r="0.9" fill={ledLink} />
          <circle cx="23" cy="44" r="0.8" fill={ledPower} />

          {/* Discreet Silkscreen Port Badge */}
          {showPortLabels && (
            <g transform="translate(15, 46.5)">
              <rect x="-7.5" y="-3" width="15" height="4.8" rx="1.2" fill="#020617" fillOpacity="0.92" stroke="#475569" strokeWidth="0.45" />
              <text x="0" y="0.5" textAnchor="middle" fill="#f8fafc" fontSize="3.3" fontFamily="monospace" fontWeight="700">
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
          {/* Dual Articulated High-Gain Rubberized Dipole Antennas with Pivot Collars */}
          <g>
            {/* Left Antenna Base Collar */}
            <polygon points="19.5,19.5 22.5,21 22.5,23.5 19.5,22" fill="#334155" stroke="#0f172a" strokeWidth="0.5" />
            <path d="M21,20 L21,6.5" stroke={`url(#${antennaId})`} strokeWidth="3" strokeLinecap="round" />
            <circle cx="21" cy="6" r="1.5" fill="#475569" stroke="#1e293b" strokeWidth="0.5" />

            {/* Right Antenna Base Collar */}
            <polygon points="41.5,19.5 44.5,21 44.5,23.5 41.5,22" fill="#334155" stroke="#0f172a" strokeWidth="0.5" />
            <path d="M43,20 L43,6.5" stroke={`url(#${antennaId})`} strokeWidth="3" strokeLinecap="round" />
            <circle cx="43" cy="6" r="1.5" fill="#475569" stroke="#1e293b" strokeWidth="0.5" />
          </g>

          {/* Enterprise 3D Matte Slate Chassis */}
          <polygon points="32,14 55,24.5 32,35 9,24.5" fill={`url(#${rackTopId})`} stroke={chassisShadow} strokeWidth="0.8" />
          <polygon points="9,24.5 32,35 32,46.5 9,36" fill={`url(#${rackLeftId})`} stroke={chassisShadow} strokeWidth="0.8" />
          <polygon points="32,35 55,24.5 55,36 32,46.5" fill={`url(#${rackRightId})`} stroke={chassisShadow} strokeWidth="0.8" />

          {/* Top Bevel Highlight Edge */}
          <polyline points="9,24.5 32,14 55,24.5" fill="none" stroke={chassisHighlight} strokeWidth="0.75" strokeOpacity="0.4" />

          {/* Top Chassis Air Ventilation Slits */}
          {[19, 21.5, 24, 26.5].map((y, i) => (
            <line
              key={i}
              x1={24 + i * 2.5}
              y1={y}
              x2={36 + i * 2.5}
              y2={y}
              stroke="#0f172a"
              strokeWidth="0.9"
              strokeLinecap="round"
            />
          ))}

          {/* Cisco / Gateway Routing Vector Emblem on Top */}
          <path
            d="M23,24.5 L39,24.5 M36,22.2 L39,24.5 L36,26.8 M39,21 L23,28"
            stroke={chassisBevel}
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.9"
          />

          {/* Front-Left Faceplate: 4 Shielded RJ-45 Gigabit Ports with Gold Pins */}
          {[0, 1, 2, 3].map((idx) => {
            const x0 = 11.5 + idx * 4.6;
            const y0 = 28 + idx * 2.08;
            return (
              <g key={idx}>
                {/* Metallic RJ45 Outer Shield */}
                <polygon
                  points={`${x0},${y0} ${x0 + 3.6},${y0 + 1.6} ${x0 + 3.6},${y0 + 5.2} ${x0},${y0 + 3.6}`}
                  fill="#020617"
                  stroke="#64748b"
                  strokeWidth="0.6"
                />
                {/* Gold Contact Pins */}
                <line x1={x0 + 0.6} y1={y0 + 1.1} x2={x0 + 3} y2={y0 + 2.2} stroke="#fbbf24" strokeWidth="0.85" />
                {/* Port Activity Mini-LED */}
                <circle cx={x0 + 1.8} cy={y0 - 0.9} r="0.9" fill={idx === 0 ? ledLink : idx === 1 ? ledAct : ledAmber} />
              </g>
            );
          })}

          {/* Front-Right Faceplate: Blue WAN Port + SFP Optical Bay + Power LED Strip */}
          <polygon points="36,35.5 41.5,33 41.5,37.6 36,40.1" fill="#024d77" stroke="#38bdf8" strokeWidth="0.65" />
          <polygon points="43.5,32 48,30 48,34.2 43.5,36.2" fill="#020617" stroke="#22d3ee" strokeWidth="0.6" />
          <circle cx="51.5" cy="29.8" r="1.1" fill={ledPower} />
          <circle cx="51.5" cy="33.2" r="1.1" fill={role === 'nat_gateway' ? ledAmber : ledAct} />

          {/* Discreet High-Contrast Silkscreen Port Labels */}
          {showPortLabels && (
            <g fontFamily="monospace" fontWeight="700" textAnchor="middle">
              <g transform="translate(15, 42)">
                <rect x="-8.5" y="-3" width="17" height="4.8" rx="1.2" fill="#020617" fillOpacity="0.92" stroke="#475569" strokeWidth="0.45" />
                <text x="0" y="0.5" fill="#f8fafc" fontSize="3.3">
                  {p0 ?? 'Gig0/0'}
                </text>
              </g>
              <g transform="translate(39, 43)">
                <rect x="-8" y="-3" width="16" height="4.8" rx="1.2" fill="#020617" fillOpacity="0.92" stroke="#0284c7" strokeWidth="0.45" />
                <text x="0" y="0.5" fill="#7dd3fc" fontSize="3.3">
                  {p1 ?? 'Gig0/1'}
                </text>
              </g>
            </g>
          )}

          {/* NAT Translation Engine Badge */}
          {role === 'nat_gateway' && (
            <g transform="translate(32, 24.5)">
              <circle r="4.2" fill="#f59e0b" fillOpacity="0.25" stroke="#f59e0b" strokeWidth="0.9" />
              <text x="0" y="1.5" textAnchor="middle" fill="#fef08a" fontSize="4.2" fontFamily="monospace" fontWeight="bold">
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
          {/* Silver 19-inch Rackmount Mounting Ears with Screw Holes */}
          <g>
            {/* Left Ear */}
            <polygon points="5,29.5 8,28 8,36.5 5,38" fill="#64748b" stroke="#334155" strokeWidth="0.5" />
            <circle cx="6.5" cy="31" r="0.7" fill="#0f172a" />
            <circle cx="6.5" cy="35" r="0.7" fill="#0f172a" />
            {/* Right Ear */}
            <polygon points="56,26 59,27.5 59,36 56,34.5" fill="#64748b" stroke="#334155" strokeWidth="0.5" />
            <circle cx="57.5" cy="28.5" r="0.7" fill="#0f172a" />
            <circle cx="57.5" cy="32.5" r="0.7" fill="#0f172a" />
          </g>

          {/* 3D Isometric 1U Rackmount Powder-Coated Metal Chassis */}
          <polygon points="32,16 56,27 32,38 8,27" fill={`url(#${rackTopId})`} stroke={chassisShadow} strokeWidth="0.8" />
          <polygon points="8,27 32,38 32,47.5 8,36.5" fill={`url(#${rackLeftId})`} stroke={chassisShadow} strokeWidth="0.8" />
          <polygon points="32,38 56,27 56,36.5 32,47.5" fill={`url(#${rackRightId})`} stroke={chassisShadow} strokeWidth="0.8" />

          {/* Top Chassis Bevel Highlight */}
          <polyline points="8,27 32,16 56,27" fill="none" stroke={chassisHighlight} strokeWidth="0.7" strokeOpacity="0.45" />

          {/* Switching Bidirectional Vectors silkscreen on top */}
          <g stroke={role === 'hub' ? '#f59e0b' : chassisBevel} strokeWidth="1.2" strokeLinecap="round" opacity="0.85">
            <path d="M24,24.5 L38,24.5 M35,22.5 L38,24.5 L35,26.5" />
            <path d="M40,29 L26,29 M29,27 L26,29 L29,31" />
          </g>

          {/* High-Density Grouped RJ-45 Port Matrix with Metal Tab Dividers */}
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const x0 = 10.5 + idx * 3.4;
            const y0 = 30 + idx * 1.55;
            return (
              <g key={idx}>
                <polygon
                  points={`${x0},${y0} ${x0 + 2.7},${y0 + 1.2} ${x0 + 2.7},${y0 + 4.3} ${x0},${y0 + 3.1}`}
                  fill="#020617"
                  stroke="#64748b"
                  strokeWidth="0.5"
                />
                <line x1={x0 + 0.5} y1={y0 + 0.8} x2={x0 + 2.2} y2={y0 + 1.55} stroke="#fbbf24" strokeWidth="0.75" />
                <circle
                  cx={x0 + 1.3}
                  cy={y0 - 0.8}
                  r="0.8"
                  fill={role === 'hub' ? ledAmber : idx % 3 === 2 ? ledAct : ledLink}
                />
              </g>
            );
          })}

          {/* Cisco Light-Blue RJ-45 Console Port + Dual SFP+ Optical Cages */}
          <polygon points="34.5,39.5 37.5,38.1 37.5,41.2 34.5,42.6" fill="#0284c7" stroke="#38bdf8" strokeWidth="0.5" />
          {[0, 1].map((idx) => {
            const x0 = 39 + idx * 5;
            const y0 = 37.5 - idx * 2.3;
            return (
              <g key={idx}>
                <polygon
                  points={`${x0},${y0} ${x0 + 3.7},${y0 - 1.7} ${x0 + 3.7},${y0 + 1.7} ${x0},${y0 + 3.4}`}
                  fill="#020617"
                  stroke="#22d3ee"
                  strokeWidth="0.6"
                />
                <circle cx={x0 + 1.8} cy={y0 - 1.3} r="0.8" fill={ledAct} />
              </g>
            );
          })}

          {/* Status Diagnostic LED Bank */}
          <circle cx="50" cy="33.5" r="1.1" fill={ledPower} />
          <circle cx="53" cy="32" r="1.1" fill={role === 'hub' ? ledAmber : ledLink} />

          {showPortLabels && (
            <g fontFamily="monospace" fontWeight="700" textAnchor="middle">
              <g transform="translate(15.5, 43.5)">
                <rect x="-8" y="-3" width="16" height="4.8" rx="1.2" fill="#020617" fillOpacity="0.92" stroke="#475569" strokeWidth="0.45" />
                <text x="0" y="0.5" fill="#f8fafc" fontSize="3.3">
                  {p0 ?? 'Fa0/1'}
                </text>
              </g>
              <g transform="translate(42.5, 43.5)">
                <rect x="-8.5" y="-3" width="17" height="4.8" rx="1.2" fill="#020617" fillOpacity="0.92" stroke="#0284c7" strokeWidth="0.45" />
                <text x="0" y="0.5" fill="#7dd3fc" fontSize="3.3">
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
          {/* Subtle Ambient RF Wave Aura */}
          <path d="M19,19 C23,12 41,12 45,19" stroke={ledAct} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.75" />
          <path d="M24,23 C26.5,18 37.5,18 40,23" stroke={ledAct} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9" />

          {/* Enterprise Ceiling Dome Body (Matte White / Slate) */}
          <ellipse cx="32" cy="40" rx="22" ry="11" fill={`url(#${rackRightId})`} stroke={chassisShadow} strokeWidth="0.8" />
          <ellipse cx="32" cy="37" rx="21.5" ry="10" fill={`url(#${rackTopId})`} stroke={chassisHighlight} strokeWidth="0.6" strokeOpacity="0.5" />

          {/* Glowing Status LED Ring */}
          <ellipse cx="32" cy="36.5" rx="8" ry="3.8" fill="none" stroke={ledLink} strokeWidth="1.6" strokeOpacity="0.9" />
          <circle cx="32" cy="36.5" r="1.6" fill={ledAct} />

          {/* Bottom PoE Gigabit Port Recess */}
          <rect x="28.5" y="47.5" width="7" height="3.2" rx="0.7" fill="#020617" stroke="#64748b" strokeWidth="0.65" />
          <line x1="30" y1="48.4" x2="34" y2="48.4" stroke="#fbbf24" strokeWidth="0.8" />

          {showPortLabels && (
            <g transform="translate(45, 47.8)">
              <rect x="-7.5" y="-3" width="15" height="4.8" rx="1.2" fill="#020617" fillOpacity="0.92" stroke="#475569" strokeWidth="0.45" />
              <text x="0" y="0.5" textAnchor="middle" fill="#f8fafc" fontSize="3.3" fontFamily="monospace" fontWeight="700">
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
          {/* Tall 42U Heavy-Duty Server Cabinet */}
          <polygon points="32,7 51,15.5 32,24 13,15.5" fill={`url(#${rackTopId})`} stroke={chassisShadow} strokeWidth="0.8" />
          <polygon points="13,15.5 32,24 32,53 13,44.5" fill={`url(#${rackLeftId})`} stroke={chassisShadow} strokeWidth="0.8" />
          <polygon points="32,24 51,15.5 51,44.5 32,53" fill={`url(#${rackRightId})`} stroke={chassisShadow} strokeWidth="0.8" />

          {/* Top Bevel Highlight Edge */}
          <polyline points="13,15.5 32,7 51,15.5" fill="none" stroke={chassisHighlight} strokeWidth="0.75" strokeOpacity="0.4" />

          {/* 4 Realistic 3.5" Hot-Swap Hard Drive Caddies on Front Face */}
          {[0, 1, 2, 3].map((idx) => {
            const y0 = 19.5 + idx * 6.5;
            return (
              <g key={idx}>
                {/* Drive Caddy Tray */}
                <polygon
                  points={`15,${y0} 30,${y0 + 6.8} 30,${y0 + 10.8} 15,${y0 + 4}`}
                  fill="#0a101d"
                  stroke="#334155"
                  strokeWidth="0.6"
                />
                {/* Brushed Aluminum Release Lever */}
                <line x1="16.8" y1={y0 + 2.5} x2="23.5" y2={y0 + 5.5} stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round" />
                {/* Dual Green Drive Activity LEDs */}
                <circle cx="26" cy={y0 + 6.8} r="0.9" fill={idx === 0 ? ledAct : ledLink} />
                <circle cx="28.2" cy={y0 + 7.8} r="0.9" fill={ledLink} />
              </g>
            );
          })}

          {/* Side Hexagonal Intake Louvers & NIC on Right Face */}
          {[22, 27, 32, 37].map((y) => (
            <line key={y} x1="35" y1={y + 2} x2="48" y2={y - 3.8} stroke="#1e293b" strokeWidth="1.2" strokeLinecap="round" />
          ))}
          <polygon points="41,41.5 46,39.3 46,43.3 41,45.5" fill="#020617" stroke="#22d3ee" strokeWidth="0.65" />

          {showPortLabels && (
            <g transform="translate(43, 49)">
              <rect x="-8" y="-3" width="16" height="4.8" rx="1.2" fill="#020617" fillOpacity="0.92" stroke="#475569" strokeWidth="0.45" />
              <text x="0" y="0.5" textAnchor="middle" fill="#f8fafc" fontSize="3.3" fontFamily="monospace" fontWeight="700">
                {p0 ?? 'Eth0'}
              </text>
            </g>
          )}

          {/* Server Role Identity Emblem */}
          {role === 'web_server' && (
            <g transform="translate(32, 15.5)">
              <ellipse cx="0" cy="0" rx="6.5" ry="3.2" fill="#0284c7" fillOpacity="0.35" stroke="#7dd3fc" strokeWidth="0.9" />
              <line x1="-6" y1="0" x2="6" y2="0" stroke="#7dd3fc" strokeWidth="0.75" />
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
          <polygon points="32,7 48,14.5 32,22 16,14.5" fill={`url(#${rackTopId})`} stroke={chassisShadow} strokeWidth="0.8" />
          <polygon points="16,14.5 32,22 32,53 16,45.5" fill={`url(#${rackLeftId})`} stroke={chassisShadow} strokeWidth="0.8" />
          <polygon points="32,22 48,14.5 48,45.5 32,53" fill={`url(#${rackRightId})`} stroke={chassisShadow} strokeWidth="0.8" />

          {/* Vertical Hot-Swap Drive Bays with Brushed Aluminum Pulls */}
          {[0, 1, 2].map((idx) => {
            const x0 = 18.2 + idx * 4.2;
            const yTop = 21 + idx * 1.95;
            return (
              <g key={idx}>
                <polygon
                  points={`${x0},${yTop} ${x0 + 3},${yTop + 1.4} ${x0 + 3},${yTop + 21} ${x0},${yTop + 19.6}`}
                  fill="#0a101d"
                  stroke="#334155"
                  strokeWidth="0.6"
                />
                <line x1={x0 + 1.5} y1={yTop + 2} x2={x0 + 1.5} y2={yTop + 6} stroke="#cbd5e1" strokeWidth="0.9" />
                <circle cx={x0 + 1.5} cy={yTop + 9} r="0.85" fill={idx === 1 ? ledAct : ledLink} />
              </g>
            );
          })}

          {/* Illuminated Halo Power Button & Front I/O */}
          <circle cx="42" cy="39.5" r="1.5" fill={ledPower} />
          <polygon points="36,42 40,40.2 40,43.8 36,45.6" fill="#020617" stroke="#475569" strokeWidth="0.6" />

          {showPortLabels && (
            <g transform="translate(40, 49.5)">
              <rect x="-7.5" y="-3" width="15" height="4.8" rx="1.2" fill="#020617" fillOpacity="0.92" stroke="#475569" strokeWidth="0.45" />
              <text x="0" y="0.5" textAnchor="middle" fill="#f8fafc" fontSize="3.3" fontFamily="monospace" fontWeight="700">
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
          {/* Base Heavy-Duty Metal Security Chassis */}
          <polygon points="32,28 55,38 32,48 9,38" fill={`url(#${rackTopId})`} stroke={chassisShadow} strokeWidth="0.8" />
          <polygon points="9,38 32,48 32,53 9,43" fill={`url(#${rackLeftId})`} stroke={chassisShadow} strokeWidth="0.8" />
          <polygon points="32,48 55,38 55,43 32,53" fill={`url(#${rackRightId})`} stroke={chassisShadow} strokeWidth="0.8" />

          {/* Armored Crimson Security Core Wall */}
          <polygon points="32,9 51,17.5 32,26 13,17.5" fill={`url(#${fireId})`} stroke="#fca5a5" strokeWidth="0.8" />
          <polygon points="13,17.5 32,26 32,43 13,34.5" fill="#991b1b" stroke="#fca5a5" strokeWidth="0.8" />
          <polygon points="32,26 51,17.5 51,34.5 32,43" fill="#450a0a" stroke="#fca5a5" strokeWidth="0.8" />

          {/* Security Interlock Grooves */}
          <g stroke="#fecaca" strokeOpacity="0.5" strokeWidth="0.8">
            <line x1="13" y1="23.2" x2="32" y2="31.7" />
            <line x1="13" y1="28.8" x2="32" y2="37.3" />
            <line x1="32" y1="31.7" x2="51" y2="23.2" />
            <line x1="32" y1="37.3" x2="51" y2="28.8" />
          </g>

          {/* Shielded WAN/LAN/DMZ Ports */}
          {[0, 1, 2].map((idx) => (
            <polygon
              key={idx}
              points={`${13 + idx * 5},${40.5 + idx * 2.2} ${16.2 + idx * 5},${42 + idx * 2.2} ${16.2 + idx * 5},${44.8 + idx * 2.2} ${13 + idx * 5},${43.3 + idx * 2.2}`}
              fill="#020617"
              stroke="#fca5a5"
              strokeWidth="0.55"
            />
          ))}
          <circle cx="41" cy="46" r="1.2" fill={ledRed} />
          <circle cx="46" cy="43.8" r="1.2" fill={ledLink} />

          {showPortLabels && (
            <g fontFamily="monospace" fontWeight="700" textAnchor="middle">
              <g transform="translate(14.5, 48.5)">
                <rect x="-7.5" y="-3" width="15" height="4.8" rx="1.2" fill="#020617" fillOpacity="0.92" stroke="#fca5a5" strokeWidth="0.45" />
                <text x="0" y="0.5" fill="#fecaca" fontSize="3.3">
                  {p0 ?? 'Eth0'}
                </text>
              </g>
              <g transform="translate(44, 49.5)">
                <rect x="-7.5" y="-3" width="15" height="4.8" rx="1.2" fill="#020617" fillOpacity="0.92" stroke="#86efac" strokeWidth="0.45" />
                <text x="0" y="0.5" fill="#bbf7d0" fontSize="3.3">
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
          <polygon points="32,14 54,24 32,34 10,24" fill={`url(#${rackTopId})`} stroke={chassisShadow} strokeWidth="0.8" />
          <polygon points="10,24 32,34 32,48 10,38" fill={`url(#${rackLeftId})`} stroke={chassisShadow} strokeWidth="0.8" />
          <polygon points="32,34 54,24 54,38 32,48" fill={`url(#${rackRightId})`} stroke={chassisShadow} strokeWidth="0.8" />

          {/* VPN / Proxy Security Crest Emblem */}
          <path
            d="M32,17 L39,20.5 V25 C39,28.5 35.8,30.8 32,32 C28.2,30.8 25,28.5 25,25 V20.5 Z"
            fill="#0284c7"
            fillOpacity="0.35"
            stroke="#7dd3fc"
            strokeWidth="1.1"
          />

          {/* Dual-NIC Shielded Interfaces */}
          {[0, 1].map((idx) => {
            const x0 = 14 + idx * 7;
            const y0 = 29 + idx * 3.1;
            return (
              <g key={idx}>
                <polygon
                  points={`${x0},${y0} ${x0 + 4.5},${y0 + 2} ${x0 + 4.5},${y0 + 6} ${x0},${y0 + 4}`}
                  fill="#020617"
                  stroke={idx === 0 ? '#22d3ee' : '#22c55e'}
                  strokeWidth="0.65"
                />
                <circle cx={x0 + 2.2} cy={y0 - 1.2} r="0.95" fill={idx === 0 ? ledAct : ledLink} />
              </g>
            );
          })}
          <circle cx="47" cy="33" r="1.1" fill={ledPower} />
          <circle cx="42" cy="35.3" r="1.1" fill={ledAct} />

          {showPortLabels && (
            <g fontFamily="monospace" fontWeight="700" textAnchor="middle">
              <g transform="translate(17.5, 42)">
                <rect x="-7.5" y="-3" width="15" height="4.8" rx="1.2" fill="#020617" fillOpacity="0.92" stroke="#22d3ee" strokeWidth="0.45" />
                <text x="0" y="0.5" fill="#67e8f9" fontSize="3.3">
                  {p0 ?? 'Eth0'}
                </text>
              </g>
              <g transform="translate(44, 43)">
                <rect x="-7.5" y="-3" width="15" height="4.8" rx="1.2" fill="#020617" fillOpacity="0.92" stroke="#86efac" strokeWidth="0.45" />
                <text x="0" y="0.5" fill="#bbf7d0" fontSize="3.3">
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
          <circle cx="32" cy="30" r="19" fill={`url(#${globeId})`} stroke="#0284c7" strokeWidth="1.2" />
          <ellipse cx="32" cy="30" rx="9" ry="19" fill="none" stroke="#7dd3fc" strokeOpacity="0.5" strokeWidth="1" />
          <ellipse cx="32" cy="30" rx="22" ry="7" transform="rotate(-18 32 30)" fill="none" stroke="#38bdf8" strokeOpacity="0.65" strokeWidth="1" strokeDasharray="3 2" />
          <line x1="13" y1="30" x2="51" y2="30" stroke="#7dd3fc" strokeOpacity="0.4" strokeWidth="0.9" />
          {/* Backbone Fiber POP Junction Nodes */}
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
          {/* Wall Mount & Swivel Arm */}
          <polygon points="8,24 14,27 14,45 8,42" fill={`url(#${rackLeftId})`} stroke={chassisShadow} strokeWidth="0.7" />
          <path d="M14,35 L23,35 L23,29" stroke="#64748b" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          {/* Camera Barrel */}
          <polygon points="18,17 44,21 38,26 12,22" fill={`url(#${rackTopId})`} stroke={chassisShadow} strokeWidth="0.8" />
          <polygon points="12,22 38,26 38,37 12,33" fill={`url(#${rackLeftId})`} stroke={chassisShadow} strokeWidth="0.8" />
          {/* Glass Lens Assembly */}
          <ellipse cx="44" cy="29.5" rx="6.5" ry="8" fill="#020617" stroke="#475569" strokeWidth="1.2" />
          <ellipse cx="44.5" cy="29.5" rx="3.2" ry="4" fill={`url(#${screenId})`} stroke="#7dd3fc" strokeWidth="0.7" />
          <circle cx="43.5" cy="28" r="1" fill="#ffffff" fillOpacity="0.8" />
          <circle cx="21" cy="26.5" r="1.2" fill={ledRed} />
          <circle cx="25" cy="27.2" r="1" fill={ledLink} />
        </g>
      )}

      {/* =====================================================================
          11. SMART TV / MEDIA BOX (tv_box)
         ===================================================================== */}
      {role === 'tv_box' && (
        <g strokeLinejoin="round">
          <polygon points="13,12 51,21 51,43 13,34" fill={`url(#${rackRightId})`} stroke={chassisShadow} strokeWidth="0.8" />
          <polygon points="16,15 48,22.6 48,39.8 16,32.2" fill={`url(#${screenId})`} />
          <polygon points="16,15 36,19.6 30,35 16,32.2" fill={`url(#${glareId})`} />
          {!poweredOff && (
            <polygon points="29,23.5 29,31 36,28.8" fill="#7dd3fc" fillOpacity="0.9" />
          )}
          <line x1="32" y1="38.5" x2="32" y2="48" stroke="#64748b" strokeWidth="2.4" />
          <polygon points="32,45 44,50 32,54 20,50" fill={`url(#${rackTopId})`} stroke={chassisShadow} strokeWidth="0.8" />
          <circle cx="46" cy="40.5" r="1.1" fill={ledLink} />
        </g>
      )}

      {/* =====================================================================
          12. SMARTPHONE (phone)
         ===================================================================== */}
      {role === 'phone' && (
        <g strokeLinejoin="round">
          <polygon points="22,12 42,20 42,50 22,42" fill={`url(#${rackRightId})`} stroke={chassisShadow} strokeWidth="0.8" />
          <polygon points="24.5,15.5 39.5,21.5 39.5,45.5 24.5,39.5" fill={`url(#${screenId})`} />
          <polygon points="24.5,15.5 35,19.5 30,42 24.5,39.5" fill={`url(#${glareId})`} />
          {!poweredOff && (
            <g>
              <line x1="27" y1="22" x2="36" y2="25.5" stroke="#7dd3fc" strokeWidth="1.2" strokeLinecap="round" />
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
          <polygon points="6,27 58,27 58,34 6,34" fill="#334155" fillOpacity="0.45" />
          <polygon points="32,9 51,17.5 32,26 13,17.5" fill={`url(#${rackTopId})`} stroke="#d97706" strokeWidth="0.8" />
          <polygon points="13,17.5 32,26 32,51 13,42.5" fill={`url(#${rackLeftId})`} stroke="#d97706" strokeWidth="0.8" />
          <polygon points="32,26 51,17.5 51,42.5 32,51" fill={`url(#${rackRightId})`} stroke="#d97706" strokeWidth="0.8" />

          {/* Screw Terminal Blocks */}
          <polygon points="16,20.5 29,26.3 29,30.5 16,24.7" fill="#1e293b" />
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} cx={18 + i * 3} cy={23.2 + i * 1.35} r="0.85" fill="#020617" stroke="#cbd5e1" strokeWidth="0.45" />
          ))}

          <circle cx="17" cy="31" r="1.1" fill={ledLink} />
          <circle cx="17" cy="35" r="1.1" fill={ledAmber} />
          <circle cx="17" cy="39" r="1.1" fill={ledAct} />

          <polygon points="22,38.5 27,40.8 27,45.5 22,43.2" fill="#020617" stroke="#38bdf8" strokeWidth="0.75" />
          <line x1="23" y1="39.8" x2="26" y2="41.2" stroke="#fbbf24" strokeWidth="0.75" />

          {showPortLabels && (
            <g transform="translate(24.5, 49.5)">
              <rect x="-7.5" y="-3" width="15" height="4.8" rx="1.2" fill="#020617" fillOpacity="0.92" stroke="#f59e0b" strokeWidth="0.45" />
              <text x="0" y="0.5" textAnchor="middle" fill="#fef08a" fontSize="3.3" fontFamily="monospace" fontWeight="700">
                {p0 ?? 'Eth0'}
              </text>
            </g>
          )}
        </g>
      )}
    </g>
  );
};
