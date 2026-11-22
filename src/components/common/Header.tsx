import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Moon, Search, Settings, Sun, X } from 'lucide-react';
import { tc } from '../../i18n/content';
import { fuzzySearchProtocols } from '../../protocols';
import { useAppStore } from '../../store/useAppStore';
import { BrandLogo } from './BrandLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { LanguageMenu } from './LanguageMenu';
import { StreakBadge } from './StreakBadge';

export const Header: React.FC = () => {
  const { t } = useTranslation();
  const {
    theme,
    toggleTheme,
    mode,
    setMode,
    setLandingOpen,
    experienceLevel,
    setExperienceLevel,
    selectProtocol,
    setSettingsOpen,
    setCommandPaletteOpen,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return fuzzySearchProtocols(searchQuery).slice(0, 8);
  }, [searchQuery]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

      if (e.key === '/' && !inInput) {
        e.preventDefault();
        setMobileSearchOpen(true);
        requestAnimationFrame(() => searchInputRef.current?.focus());
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      } else if (e.key === 'Escape' && searchFocused) {
        setSearchFocused(false);
        setMobileSearchOpen(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setCommandPaletteOpen, searchFocused]);

  const highlightMatch = (text: string, q: string) => {
    if (!q.trim()) return text;
    const idx = text.toLowerCase().indexOf(q.trim().toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="rounded bg-[var(--accent-teal-soft)] px-0.5 text-[var(--accent-teal)]">
          {text.slice(idx, idx + q.trim().length)}
        </mark>
        {text.slice(idx + q.trim().length)}
      </>
    );
  };

  const iconBtn =
    'flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-inset)] hover:text-[var(--text-primary)] transition-colors shrink-0';

  return (
    <header className="shrink-0 sticky top-0 z-40 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]">
      <div className="flex h-14 items-center justify-between gap-2 sm:gap-4 px-3 sm:px-5">
        {/* Left: brand on phones; on larger screens the side rail owns navigation, so show where you are */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <a
            href="#explore"
            onClick={(e) => {
              e.preventDefault();
              setLandingOpen(true);
            }}
            className="flex shrink-0 items-center whitespace-nowrap rounded-md md:hidden"
          >
            <span className="sm:hidden">
              <BrandLogo size={28} />
            </span>
            <span className="hidden sm:inline-flex">
              <BrandLogo size={28} showWordmark />
            </span>
          </a>
          <div className="hidden min-w-0 md:block">
            <h1 className="truncate font-display text-base font-bold leading-tight text-[var(--text-primary)]">{t(`nav.${mode}`)}</h1>
            <p className="hidden truncate text-xs leading-tight text-[var(--text-muted)] xl:block">{t(`nav.${mode}Hint`)}</p>
          </div>
        </div>

        {/* Right: search, detail level, language, theme, settings */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <div className="relative hidden lg:block w-72 xl:w-96">
            <Search
              className="w-4 h-4 text-[var(--text-muted)] absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 160)}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              className="h-9 w-full rounded-full border border-[var(--border-hairline)] bg-[var(--bg-inset)] ps-9 pe-8 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label={t('common.clear')}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {searchFocused && searchResults.length > 0 && (
              <div
                role="listbox"
                aria-label={t('common.search')}
                className="absolute end-0 top-full mt-2 w-[380px] z-50 max-h-80 overflow-y-auto rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)] divide-y divide-[var(--border-hairline)]"
              >
                {searchResults.map(({ protocol }) => (
                  <button
                    key={protocol.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectProtocol(protocol.id, 0);
                      setSearchQuery('');
                      setSearchFocused(false);
                    }}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start hover:bg-[var(--accent-primary-soft)] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {highlightMatch(protocol.name, searchQuery)}
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--text-muted)] truncate">
                        {tc(protocol.fullName)} · {t('explore.port')} {protocol.defaultPort}
                      </div>
                    </div>
                    <span className="text-xs font-medium text-[var(--accent-primary)] shrink-0">
                      {t('common.open')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            aria-label={t('common.search')}
            title={t('common.search')}
            className={`${iconBtn} lg:hidden`}
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Detail level: Simple (guided) or Pro (everything) */}
          <div
            role="group"
            aria-label={t('nav.detailLevel')}
            className="hidden lg:flex items-center gap-0.5 rounded-full border border-[var(--border-hairline)] p-0.5 shrink-0"
          >
            {(['simple', 'pro'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setExperienceLevel(lvl)}
                title={t(lvl === 'simple' ? 'nav.simpleTooltip' : 'nav.proTooltip')}
                aria-pressed={experienceLevel === lvl}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                  experienceLevel === lvl
                    ? 'bg-[var(--text-primary)] text-[var(--bg-surface)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t(lvl === 'simple' ? 'nav.simpleMode' : 'nav.proMode')}
              </button>
            ))}
          </div>

          <PWAInstallButton />

          <StreakBadge className="hidden sm:inline-flex md:hidden" />

          <LanguageMenu className="md:hidden" />

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? t('nav.switchLight') : t('nav.switchDark')}
            title={theme === 'dark' ? t('nav.switchLight') : t('nav.switchDark')}
            className={`${iconBtn} md:hidden`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label={t('common.settings')}
            title={t('common.settings')}
            className={`${iconBtn} hidden sm:flex md:hidden`}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Collapsible Mobile Quick Controls + Search Drawer */}
      {mobileSearchOpen && (
        <div className="lg:hidden border-t border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 space-y-2 relative">
          <div className="flex items-center gap-2 lg:hidden">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              {experienceLevel === 'simple' ? t('nav.simpleMode') : t('nav.proMode')}
            </span>
            <button
              type="button"
              onClick={() => setExperienceLevel(experienceLevel === 'simple' ? 'pro' : 'simple')}
              className="rounded-full bg-[var(--accent-cta)] px-3 py-1 text-xs font-semibold text-[var(--on-accent)]"
            >
              {experienceLevel === 'simple' ? t('nav.proMode') : t('nav.simpleMode')}
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="sm:hidden ms-auto rounded-full border border-[var(--border-hairline)] px-3 py-1 text-xs font-medium text-[var(--text-primary)]"
            >
              {t('common.settings')}
            </button>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute start-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('common.search')}
              className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] py-1.5 ps-8 pe-8 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setMobileSearchOpen(false);
              }}
              aria-label={t('common.close')}
              className="absolute end-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-1.5 max-h-60 overflow-y-auto rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] divide-y divide-[var(--border-hairline)]">
              {searchResults.map(({ protocol }) => (
                <button
                  key={protocol.id}
                  type="button"
                  onClick={() => {
                    selectProtocol(protocol.id, 0);
                    setSearchQuery('');
                    setMobileSearchOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-xs hover:bg-[var(--accent-primary-soft)]"
                >
                  <span className="font-semibold text-[var(--text-primary)] truncate">
                    {protocol.name} — {tc(protocol.fullName)}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--accent-primary)] shrink-0">{t('common.open')}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  );
};
