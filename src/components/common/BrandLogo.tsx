import React from 'react';

interface BrandLogoProps {
  size?: number;
  showWordmark?: boolean;
}

/**
 * World-Class High-Tech Network Pulse "N" Mark for NetPulse.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 32, showWordmark = true }) => {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="blBorderGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#1e3a5f" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.2" />
          </linearGradient>

          <radialGradient id="blBackdropGlow" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.3" />
            <stop offset="60%" stopColor="#0ea5e9" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="blPulseStream" x1="14" y1="48" x2="50" y2="16" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="25%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#22c55e" />
            <stop offset="75%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>

          <filter id="blNeonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Base Tile */}
        <rect width="64" height="64" rx="14" fill="#070e1e" />
        <rect x="1.5" y="1.5" width="61" height="61" rx="12.5" fill="url(#blBackdropGlow)" />
        <rect x="1.5" y="1.5" width="61" height="61" rx="12.5" stroke="url(#blBorderGrad)" strokeWidth="1.5" />

        {/* Circuit Accent Grid */}
        <path d="M16 32H48" stroke="#1e293b" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
        <path d="M32 16V48" stroke="#1e293b" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />

        {/* Neon Glow Under-layer */}
        <path
          d="M 16 48 L 16 18 L 26 33 L 32 17 L 38 43 L 48 23 L 48 48"
          stroke="url(#blPulseStream)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.35"
          filter="url(#blNeonGlow)"
        />

        {/* Primary Vector Pulse 'N' Track */}
        <path
          d="M 16 48 L 16 18 L 26 33 L 32 17 L 38 43 L 48 23 L 48 48"
          stroke="url(#blPulseStream)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Inner core luminous wire */}
        <path
          d="M 16 48 L 16 18 L 26 33 L 32 17 L 38 43 L 48 23 L 48 48"
          stroke="#ffffff"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />

        {/* Network Nodes */}
        <circle cx="16" cy="48" r="3" fill="#0284c7" stroke="#ffffff" strokeWidth="1" />
        <circle cx="16" cy="18" r="3.2" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
        <circle cx="32" cy="17" r="3.5" fill="#22c55e" stroke="#ffffff" strokeWidth="1.2" filter="url(#blNeonGlow)" />
        <circle cx="48" cy="23" r="3.2" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
        <circle cx="48" cy="48" r="3" fill="#818cf8" stroke="#ffffff" strokeWidth="1" />

        {/* Signal Spark */}
        <circle cx="36" cy="34" r="1.8" fill="#fde047" filter="url(#blNeonGlow)" />
      </svg>

      {showWordmark && (
        <span className="font-display text-xl font-extrabold tracking-tight text-[var(--text-primary)] leading-none">
          Net<span className="text-[var(--accent-primary)]">Pulse</span>
        </span>
      )}
    </span>
  );
};
