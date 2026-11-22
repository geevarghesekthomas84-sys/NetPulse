import React, { useId } from 'react';

interface BrandLogoProps {
  size?: number;
  showWordmark?: boolean;
}

/**
 * NetPulse mark: a gradient tile with a pulse line that ends in a network node,
 * i.e. "watch the network's heartbeat". Same artwork as public/icon.svg.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 30, showWordmark = true }) => {
  const gid = `np-${useId().replace(/:/g, '')}`;
  return (
    <span className="inline-flex select-none items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" className="shrink-0">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#5b4de0" />
            <stop offset="100%" stopColor="#16b8d4" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="15" fill={`url(#${gid})`} />
        <path d="M9 36H22L27 20L35 48L41 28L45 36H50" stroke="#fff" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="55.5" cy="36" r="7.2" stroke="#fff" strokeOpacity="0.43" strokeWidth="1.6" />
        <circle cx="55.5" cy="36" r="4.4" fill="#fff" />
      </svg>

      {showWordmark && (
        <span className="font-display text-lg font-extrabold leading-none tracking-tight text-[var(--text-primary)]">
          Net<span className="text-[var(--accent-primary)]">Pulse</span>
        </span>
      )}
    </span>
  );
};
