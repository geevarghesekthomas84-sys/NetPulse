import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Compass, Cpu, GraduationCap, HelpCircle, Library, Moon, Settings, Sun } from 'lucide-react';
import { LANGUAGES } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { BrandLogo } from './BrandLogo';
import { StreakBadge } from './StreakBadge';

const MODES = [
  { id: 'explore', icon: Compass },
  { id: 'simulator', icon: Cpu },
  { id: 'learn', icon: GraduationCap },
] as const;

/** Closes a popover when the user clicks elsewhere or presses Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

/** Label shown beside a rail button on hover or keyboard focus. Icon-only buttons keep the rail the same width in every language. */
const Tip: React.FC<{ label: string; hide?: boolean }> = ({ label, hide }) => (
  <span
    role="presentation"
    className={`pointer-events-none absolute start-full top-1/2 z-50 ms-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[var(--text-primary)] px-2.5 py-1.5 text-xs font-semibold text-[var(--bg-surface)] opacity-0 shadow-lg transition-opacity duration-100 group-focus-within:opacity-100 group-hover:opacity-100 ${hide ? 'hidden' : ''}`}
  >
    {label}
  </span>
);

const tile = 'flex h-11 w-11 items-center justify-center rounded-xl transition-colors';
const idle = 'text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)]';

/** Persistent left rail: the three workspaces, the protocol library and personal controls, all icon-only with hover labels. */
export const SideNav: React.FC = () => {
  const { t } = useTranslation();
  const {
    mode,
    setMode,
    setLandingOpen,
    drawerOpen,
    setDrawerOpen,
    theme,
    toggleTheme,
    language,
    setLanguage,
    setSettingsOpen,
    reopenWelcome,
    setTourOpen,
    setAboutOpen,
  } = useAppStore();

  const [langOpen, setLangOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const langRef = useDismiss(langOpen, () => setLangOpen(false));
  const helpRef = useDismiss(helpOpen, () => setHelpOpen(false));

  const menu =
    'absolute bottom-0 start-full z-50 ms-3 w-56 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-1.5 text-sm shadow-2xl';

  return (
    <nav
      aria-label={t('nav.workspaces')}
      className="hidden h-full w-16 shrink-0 flex-col items-center gap-1.5 border-e border-[var(--border-hairline)] bg-[var(--bg-surface)] py-3 md:flex [@media(max-height:640px)]:gap-0.5 [@media(max-height:640px)]:py-1.5"
    >
      <a
        href="#explore"
        onClick={(e) => {
          e.preventDefault();
          setLandingOpen(true);
        }}
        aria-label="NetPulse"
        title="NetPulse"
        className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl"
      >
        <BrandLogo size={34} showWordmark={false} />
      </a>

      {MODES.map(({ id, icon: Icon }) => {
        const active = mode === id;
        return (
          <div key={id} className="group relative">
            <button
              type="button"
              onClick={() => setMode(id)}
              aria-current={active ? 'page' : undefined}
              aria-label={t(`nav.${id}`)}
              className={`${tile} ${active ? 'bg-[var(--accent-primary)] text-[var(--on-accent)] shadow-md' : idle}`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </button>
            <Tip label={t(`nav.${id}`)} />
          </div>
        );
      })}

      <div className="my-1.5 h-px w-7 bg-[var(--border-hairline)]" aria-hidden="true" />

      <div className="group relative">
        <button
          type="button"
          onClick={() => setDrawerOpen(!drawerOpen)}
          aria-expanded={drawerOpen}
          aria-label={t('nav.protocols')}
          className={`${tile} ${drawerOpen ? 'border border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]' : idle}`}
        >
          <Library className="h-5 w-5" aria-hidden="true" />
        </button>
        <Tip label={t('nav.protocols')} />
      </div>

      <div className="mt-auto flex flex-col items-center gap-1.5 [@media(max-height:640px)]:gap-0.5">
        <StreakBadge className="mb-1 !h-8 !px-2 text-xs" />

        <div ref={langRef} className="group relative">
          <button
            type="button"
            onClick={() => setLangOpen(!langOpen)}
            aria-haspopup="listbox"
            aria-expanded={langOpen}
            aria-label={t('nav.selectLanguage')}
            className={`${tile} text-xs font-bold uppercase tracking-wide ${langOpen ? 'bg-[var(--bg-inset)] text-[var(--text-primary)]' : idle}`}
          >
            {language}
          </button>
          <Tip label={t('nav.selectLanguage')} hide={langOpen} />
          {langOpen && (
            <ul role="listbox" aria-label={t('nav.selectLanguage')} className={menu}>
              {LANGUAGES.map((l) => (
                <li key={l.code} role="option" aria-selected={l.code === language}>
                  <button
                    type="button"
                    lang={l.code}
                    onClick={() => {
                      setLanguage(l.code);
                      setLangOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-start ${
                      l.code === language ? 'bg-[var(--accent-primary-soft)] font-semibold text-[var(--accent-primary)]' : 'text-[var(--text-primary)] hover:bg-[var(--bg-inset)]'
                    }`}
                  >
                    {l.name}
                    {l.code === language && <Check className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="group relative">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? t('nav.switchLight') : t('nav.switchDark')}
            className={`${tile} ${idle}`}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
          </button>
          <Tip label={theme === 'dark' ? t('nav.switchLight') : t('nav.switchDark')} />
        </div>

        <div ref={helpRef} className="group relative">
          <button
            type="button"
            onClick={() => setHelpOpen(!helpOpen)}
            aria-haspopup="menu"
            aria-expanded={helpOpen}
            aria-label={t('nav.help')}
            className={`${tile} ${helpOpen ? 'bg-[var(--bg-inset)] text-[var(--text-primary)]' : idle}`}
          >
            <HelpCircle className="h-5 w-5" aria-hidden="true" />
          </button>
          <Tip label={t('nav.help')} hide={helpOpen} />
          {helpOpen && (
            <div role="menu" className={menu}>
              {(
                [
                  [t('nav.quickGuide'), () => { reopenWelcome(); setMode('explore'); }],
                  [t('nav.guidedTour'), () => setTourOpen(true)],
                  [t('nav.aboutPrivacy'), () => setAboutOpen(true)],
                ] as [string, () => void][]
              ).map(([label, run]) => (
                <button
                  key={label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    run();
                    setHelpOpen(false);
                  }}
                  className="flex w-full rounded-lg px-3 py-2 text-start text-[var(--text-primary)] hover:bg-[var(--bg-inset)]"
                >
                  {label}
                </button>
              ))}
              <p className="mt-1 border-t border-[var(--border-hairline)] px-3 pt-2 pb-1 text-xs text-[var(--text-muted)]">{t('credit')}</p>
            </div>
          )}
        </div>

        <div className="group relative">
          <button type="button" onClick={() => setSettingsOpen(true)} aria-label={t('common.settings')} className={`${tile} ${idle}`}>
            <Settings className="h-5 w-5" aria-hidden="true" />
          </button>
          <Tip label={t('common.settings')} />
        </div>
      </div>
    </nav>
  );
};
