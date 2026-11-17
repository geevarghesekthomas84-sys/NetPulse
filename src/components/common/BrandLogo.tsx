import React from 'react';
import logoImg from '../../assets/logo.png';

interface BrandLogoProps {
  size?: number;
  showWordmark?: boolean;
}

/**
 * 3D Glassmorphism Brand Logo for NetPulse.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 32, showWordmark = true }) => {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <img
        src={logoImg}
        alt="NetPulse Logo"
        width={size}
        height={size}
        className="shrink-0 rounded-xl object-cover shadow-2xs border border-[var(--border-hairline)]"
        style={{ width: size, height: size }}
      />

      {showWordmark && (
        <span className="font-display text-xl font-extrabold tracking-tight text-[var(--text-primary)] leading-none">
          Net<span className="text-[var(--accent-primary)]">Pulse</span>
        </span>
      )}
    </span>
  );
};
