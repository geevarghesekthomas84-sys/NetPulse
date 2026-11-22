import React, { useEffect, useState } from 'react';

/** Small looping animation: packets travelling client → router → server and back. Static when motion is reduced. */
export const HeroDiagram: React.FC = () => {
  const [still, setStill] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    setStill(Boolean(mq?.matches));
  }, []);

  const path = 'M90 190 L280 190 L470 190';
  const back = 'M470 214 L280 214 L90 214';

  // Hidden until each packet's own start time (otherwise it would sit at the SVG origin), then fades in and out along its path.
  const motion = (dur: string, begin: string, d: string) => (
    <>
      <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={d} />
      <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.06;0.9;1" dur={dur} begin={begin} repeatCount="indefinite" />
    </>
  );

  const packet = (color: string, label: string, dur: string, begin: string, d: string, labelDy = -14) => (
    <g key={label + begin}>
      <circle r="7" fill={color} opacity={still ? 0.9 : 0}>
        {!still && motion(dur, begin, d)}
      </circle>
      <text fontSize="11" fontWeight="700" fill={color} textAnchor="middle" fontFamily="var(--font-mono, monospace)" dy={labelDy} opacity={still ? 0.9 : 0}>
        {label}
        {!still && motion(dur, begin, d)}
      </text>
    </g>
  );

  const node = (x: number, label: string, sub: string, kind: 'pc' | 'router' | 'server') => (
    <g transform={`translate(${x} 202)`}>
      <circle r="44" fill="var(--bg-surface)" stroke="var(--border-strong)" strokeWidth="2" />
      <circle r="44" fill="none" stroke="var(--accent-primary)" strokeOpacity="0.25" strokeWidth="8" />
      {kind === 'pc' && (
        <g stroke="var(--accent-primary)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <rect x="-17" y="-18" width="34" height="22" rx="3" />
          <path d="M-24 10 H24 L19 4 H-19 Z" />
        </g>
      )}
      {kind === 'router' && (
        <g stroke="var(--accent-primary)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <rect x="-22" y="-4" width="44" height="16" rx="4" />
          <path d="M-12 -4 V-16 M0 -4 V-20 M12 -4 V-16" />
          <circle cx="-12" cy="4" r="1.5" fill="var(--accent-primary)" />
          <circle cx="-4" cy="4" r="1.5" fill="var(--accent-primary)" />
        </g>
      )}
      {kind === 'server' && (
        <g stroke="var(--accent-primary)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <rect x="-18" y="-20" width="36" height="12" rx="3" />
          <rect x="-18" y="-4" width="36" height="12" rx="3" />
          <rect x="-18" y="12" width="36" height="12" rx="3" />
        </g>
      )}
      <text y="64" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--text-primary)">
        {label}
      </text>
      <text y="80" textAnchor="middle" fontSize="11" fill="var(--text-muted)" fontFamily="var(--font-mono, monospace)">
        {sub}
      </text>
    </g>
  );

  return (
    <svg viewBox="0 0 560 330" role="img" aria-label="Packets travelling between a computer, a router and a server" className="h-auto w-full">
      <defs>
        <radialGradient id="heroGlow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0" />
        </radialGradient>
        <pattern id="heroGrid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M28 0H0V28" fill="none" stroke="var(--border-hairline)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="560" height="330" rx="24" fill="var(--bg-inset)" />
      <rect width="560" height="330" rx="24" fill="url(#heroGrid)" opacity="0.7" />
      <rect width="560" height="330" rx="24" fill="url(#heroGlow)" />

      {/* links */}
      <g stroke="var(--border-strong)" strokeWidth="3" strokeLinecap="round">
        <path d="M90 202 L280 202 L470 202" fill="none" />
      </g>
      <path d={path} fill="none" stroke="none" />

      {node(90, 'Client', '192.168.1.10', 'pc')}
      {node(280, 'Router', '192.168.1.1', 'router')}
      {node(470, 'Web server', '203.0.113.10', 'server')}

      {packet('var(--pkt-dns, #8b5cf6)', 'DNS', '5s', '0s', path.replace(/190/g, '186'))}
      {packet('var(--pkt-tcp, #0ea5e9)', 'SYN', '5s', '1.6s', path.replace(/190/g, '186'))}
      {packet('var(--pkt-http-res, #10b981)', '200 OK', '5s', '3.2s', back.replace(/214/g, '218'), 22)}
    </svg>
  );
};
