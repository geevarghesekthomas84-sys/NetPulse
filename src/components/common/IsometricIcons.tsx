import React from 'react';
import type { DeviceRole } from '../../engine/types';
import { IsometricHardwareArt } from '../icons/IsometricHardwareLibrary';

interface IsometricIconProps {
  role: DeviceRole;
  size?: number;
  active?: boolean;
  poweredOff?: boolean;
  connectedPortCount?: number;
  hasLinkDown?: boolean;
  showPortLabels?: boolean;
  portLabels?: string[];
  className?: string;
}

/**
 * Multi-tone 30-degree isometric hardware SVG device icons with physical ports and live LEDs.
 */
export const IsometricDeviceIcon: React.FC<IsometricIconProps> = ({
  role,
  size = 56,
  active = false,
  poweredOff = false,
  connectedPortCount = 1,
  hasLinkDown = false,
  showPortLabels,
  portLabels,
  className = '',
}) => {
  const renderLabels = showPortLabels ?? size >= 36;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      style={{
        filter: active && !poweredOff ? 'drop-shadow(0 0 8px var(--accent-glow))' : undefined,
      }}
      aria-hidden="true"
    >
      <IsometricHardwareArt
        role={role}
        active={active}
        poweredOff={poweredOff}
        connectedPortCount={connectedPortCount}
        hasLinkDown={hasLinkDown}
        showPortLabels={renderLabels}
        portLabels={portLabels}
      />
    </svg>
  );
};
