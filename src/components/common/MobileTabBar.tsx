import React from 'react';
import { useTranslation } from 'react-i18next';
import { Compass, Cpu, GraduationCap, Layers } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const MobileTabBar: React.FC = () => {
  const { t } = useTranslation();
  const { mode, setMode, drawerOpen, setDrawerOpen } = useAppStore();

  const navItems = [
    {
      id: 'explore' as const,
      label: t('nav.explore'),
      icon: Compass,
      active: mode === 'explore' && !drawerOpen,
      onClick: () => {
        setDrawerOpen(false);
        setMode('explore');
      },
    },
    {
      id: 'simulator' as const,
      label: t('nav.simulator'),
      icon: Cpu,
      active: mode === 'simulator' && !drawerOpen,
      onClick: () => {
        setDrawerOpen(false);
        setMode('simulator');
      },
    },
    {
      id: 'learn' as const,
      label: t('nav.learn'),
      icon: GraduationCap,
      active: mode === 'learn' && !drawerOpen,
      onClick: () => {
        setDrawerOpen(false);
        setMode('learn');
      },
    },
    {
      id: 'protocols' as const,
      label: t('nav.protocols'),
      icon: Layers,
      active: drawerOpen,
      onClick: () => {
        setDrawerOpen(!drawerOpen);
      },
    },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)] shadow-lg"
    >
      <div className="flex items-center justify-around h-14 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              aria-pressed={item.active}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[11px] font-semibold transition-colors ${
                item.active
                  ? 'text-[var(--accent-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                  item.active ? 'bg-[var(--accent-primary-soft)]' : ''
                }`}
              >
                <Icon className={`w-4 h-4 ${item.active ? 'text-[var(--accent-primary)]' : ''}`} />
              </div>
              <span className="leading-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
