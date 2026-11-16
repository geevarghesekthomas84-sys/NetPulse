import React from 'react';

interface BrandLogoProps {
  size?: number;
  showWordmark?: boolean;
}

/**
 * Real-world RJ-45 8P8C Ethernet patch plug hardware mark for NetPulse.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 30, showWordmark = true }) => {
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
          <linearGradient id="brandPlugHousing" x1="14" y1="12" x2="50" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--hw-slate-light, #1e3a5f)" />
            <stop offset="100%" stopColor="var(--hw-slate-dark, #091326)" />
          </linearGradient>
          <linearGradient id="brandGoldPins" x1="20" y1="18" x2="44" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
        </defs>

        {/* Outer patch-port socket recess */}
        <rect
          x="6"
          y="6"
          width="52"
          height="52"
          rx="11"
          fill="var(--bg-inset)"
          stroke="var(--border-strong)"
          strokeWidth="2"
        />

        {/* RJ-45 top locking clip */}
        <path
          d="M24 12H40V17H24V12Z"
          fill="#0284c7"
          stroke="var(--accent-primary)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Modular 8P8C polycarbonate plug nose */}
        <path
          d="M16 17H48V37L42 43H22L16 37V17Z"
          fill="url(#brandPlugHousing)"
          stroke="var(--accent-primary)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Internal pin bay */}
        <rect x="19" y="19.5" width="26" height="10" rx="1.5" fill="#050b16" fillOpacity="0.7" />

        {/* Precision gold 8P8C contact pins */}
        {[20.5, 24, 27.5, 31, 34.5, 38, 41.5].map((x) => (
          <rect key={x} x={x} y="20.5" width="2" height="7.5" rx="0.6" fill="url(#brandGoldPins)" />
        ))}

        {/* Link / Activity LEDs */}
        <circle cx="23.5" cy="36" r="2" fill="#22c55e" />
        <circle cx="40.5" cy="36" r="2" fill="#38bdf8" />

        {/* Strain-relief boot & cable stem */}
        <path
          d="M25 43H39L37 50H27L25 43Z"
          fill="#0f2544"
          stroke="var(--accent-primary)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <line x1="32" y1="50" x2="32" y2="57" stroke="var(--accent-primary)" strokeWidth="3.5" strokeLinecap="round" />
      </svg>

      {showWordmark && (
        <span className="font-display text-xl font-extrabold tracking-tight text-[var(--text-primary)] leading-none">
          NetPulse
        </span>
      )}
    </span>
  );
};
