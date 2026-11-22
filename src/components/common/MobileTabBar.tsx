import React from 'react';
import { useTranslation } from 'react-i18next';
import { Compass, Cpu, GraduationCap, Library } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

/**
 * Thumb-reach navigation for phones (< md): the three sections plus the
 * protocol library, which opens as a bottom sheet. Larger screens keep the
 * top navigation, so this renders nothing visually from md up.
 */
export const MobileTabBar: React.FC = () => {
  const { t } = useTranslation();
  const { mode, setMode, drawerOpen, setDrawerOpen } = useAppStore();

  const tabs = [
    { id: 'explore', label: t('nav.explore'), icon: Compass },
    { id: 'simulator', label: t('nav.simulator'), icon: Cpu },
    { id: 'learn', label: t('nav.learn'), icon: GraduationCap },
  ] as const;

  const base =
    'flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-semibold transition-colors min-w-0';

  return (
    <nav
      aria-label={t('nav.workspaces')}
      className="md:hidden shrink-0 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-stretch">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = mode === id && !drawerOpen;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                setMode(id);
              }}
              aria-current={active ? 'page' : undefined}
              className={`${base} ${active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}
            >
              <span
                className={`flex h-7 w-14 items-center justify-center rounded-full transition-colors ${
                  active ? 'bg-[var(--accent-primary-soft)]' : ''
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
              </span>
              <span className="truncate max-w-full px-1">{label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setDrawerOpen(!drawerOpen)}
          aria-expanded={drawerOpen}
          className={`${base} ${drawerOpen ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}
        >
          <span
            className={`flex h-7 w-14 items-center justify-center rounded-full transition-colors ${
              drawerOpen ? 'bg-[var(--accent-primary-soft)]' : ''
            }`}
          >
            <Library className="w-5 h-5" aria-hidden="true" />
          </span>
          <span className="truncate max-w-full px-1">{t('nav.protocols')}</span>
        </button>
      </div>
    </nav>
  );
};
