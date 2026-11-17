import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Command,
  Compass,
  Github,
  Globe,
  HelpCircle,
  Menu,
  Moon,
  Network,
  Search,
  Settings,
  SlidersHorizontal,
  Sun,
  X,
} from 'lucide-react';
import { LANGUAGES } from '../../i18n';
import { fuzzySearchProtocols } from '../../protocols';
import { useAppStore } from '../../store/useAppStore';
import { BrandLogo } from './BrandLogo';
import { PWAInstallButton } from './PWAInstallButton';

export const Header: React.FC = () => {
  const { t } = useTranslation();
  const {
    theme,
    toggleTheme,
    language,
    setLanguage,
    mode,
    setMode,
    experienceLevel,
    setExperienceLevel,
    drawerOpen,
    setDrawerOpen,
    selectProtocol,
    reopenWelcome,
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

  return (
    <header className="shrink-0 sticky top-0 z-40 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 backdrop-blur-md">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 sm:gap-3 px-3.5 sm:px-5 py-2">
        {/* Left: Protocol Drawer Toggle + Brand Mark */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 shrink-0">
          <button
            type="button"
            onClick={() => setDrawerOpen(!drawerOpen)}
            aria-label={t('nav.protocols')}
            aria-expanded={drawerOpen}
            className={`flex h-9.5 items-center gap-2 rounded-xl border px-3 text-[13px] font-bold transition-all shrink-0 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[var(--accent-primary)] shadow-2xs ${
              drawerOpen
                ? 'border-[var(--accent-teal)] bg-[var(--accent-teal-soft)] text-[var(--accent-teal)]'
                : 'border-[var(--border-hairline)] bg-[var(--bg-inset)]/70 text-[var(--text-primary)] hover:border-[var(--accent-teal)]/50'
            }`}
          >
            <Menu className="w-4 h-4 text-[var(--accent-teal)]" />
            <span className="hidden xl:inline">{t('nav.protocols')}</span>
            <span className="rounded-full bg-[var(--bg-surface)] px-1.5 py-0.2 font-mono text-[10px] font-extrabold text-[var(--accent-teal)] border border-[var(--border-hairline)]">
              39
            </span>
          </button>

          <a
            href="#explore"
            onClick={(e) => {
              e.preventDefault();
              setMode('explore');
            }}
            className="flex items-center gap-2 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--accent-primary)] rounded-lg px-1 group"
          >
            <BrandLogo size={32} showWordmark />
            <span className="hidden sm:inline-block rounded-md bg-[var(--accent-primary-soft)] border border-[var(--accent-primary)]/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-[var(--accent-primary)] uppercase tracking-wider">
              v2.4
            </span>
          </a>
        </div>

        {/* Center: Modern Unified Mode Bar + Pro Switch */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <nav
            aria-label="Workspace modes"
            className="flex items-center gap-1 rounded-2xl bg-[var(--bg-inset)]/80 p-1 border border-[var(--border-hairline)] shadow-2xs"
          >
            {[
              { id: 'explore', label: t('nav.explore'), icon: Compass },
              { id: 'simulator', label: t('nav.simulator'), icon: Network },
              { id: 'learn', label: t('nav.learn'), icon: BookOpen },
            ].map(({ id, label, icon: Icon }) => {
              const active = mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id as typeof mode)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-[13px] font-semibold rounded-xl transition-all whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--accent-primary)] ${
                    active
                      ? 'bg-[var(--accent-cta)] text-white shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

          {/* Pro Mode Chip Toggle */}
          <button
            type="button"
            onClick={() => setExperienceLevel(experienceLevel === 'pro' ? 'simple' : 'pro')}
            title={experienceLevel === 'pro' ? t('nav.proTooltip') : t('nav.simpleTooltip')}
            aria-pressed={experienceLevel === 'pro'}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all whitespace-nowrap shrink-0 shadow-2xs ${
              experienceLevel === 'pro'
                ? 'border-[var(--accent-primary)]/40 bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                : 'border-[var(--border-hairline)] bg-[var(--bg-inset)]/70 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>PRO</span>
            <span
              className={`h-2 w-2 rounded-full ${
                experienceLevel === 'pro'
                  ? 'bg-[var(--accent-primary)] animate-pulse shadow-[0_0_8px_var(--accent-primary)]'
                  : 'bg-slate-400'
              }`}
            />
          </button>
        </div>

        {/* Right: Inline Search + Language + Theme + Settings */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Desktop Inline Fuzzy Protocol Search */}
          <div className="relative hidden md:block w-48 lg:w-64">
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
              className="h-9 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] ps-9 pe-8 text-[13px] font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label={t('common.clear')}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {searchFocused && searchResults.length > 0 && (
              <div
                role="listbox"
                aria-label="Protocol search results"
                className="absolute end-0 top-full mt-1.5 w-[380px] z-50 max-h-80 overflow-y-auto rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl divide-y divide-[var(--border-hairline)]"
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
                      <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                        {highlightMatch(protocol.name, searchQuery)}{' '}
                        <span className="font-normal text-[var(--text-secondary)]">
                          — {highlightMatch(protocol.fullName, searchQuery)}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs font-mono text-[var(--text-muted)] truncate">
                        {protocol.category} · {t('explore.port')} {highlightMatch(protocol.defaultPort, searchQuery)} ·{' '}
                        {protocol.rfcs.map((r) => r.number).join(', ')}
                      </div>
                    </div>
                    <span className="text-xs font-mono font-semibold text-[var(--accent-primary)] shrink-0">
                      {t('common.open')} →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mobile Search Toggle */}
          <button
            type="button"
            onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            aria-label={t('common.search')}
            className="flex md:hidden h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <Search className="w-4 h-4" />
          </button>

          <PWAInstallButton />

          {/* Quick Architecture Guide Launcher */}
          <button
            type="button"
            onClick={reopenWelcome}
            title={t('nav.quickGuide')}
            aria-label={t('nav.quickGuide')}
            className="hidden lg:flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-inset)]/70 px-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-primary)] transition-colors whitespace-nowrap shrink-0 shadow-2xs"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[var(--accent-teal)]" />
            <span>Guide</span>
          </button>

          {experienceLevel === 'pro' && (
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              title={`${t('nav.commandPalette')} (Ctrl/Cmd + K)`}
              aria-label={t('nav.commandPalette')}
              className="hidden sm:flex h-9 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 text-xs font-mono font-semibold text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
            >
              <Command className="w-3.5 h-3.5" />
              <span>K</span>
            </button>
          )}

          {/* Language Switcher displaying native language names */}
          <div className="relative flex items-center">
            <Globe
              className="w-4 h-4 text-[var(--accent-teal)] pointer-events-none absolute start-2.5"
              aria-hidden="true"
            />
            <select
              aria-label={t('nav.selectLanguage')}
              title={t('nav.selectLanguage')}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="h-9 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] ps-8 pe-2.5 text-[13px] font-semibold text-[var(--text-primary)] hover:border-[var(--accent-teal)] focus-visible:outline-2 focus-visible:outline-[var(--accent-primary)] cursor-pointer"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? t('nav.switchLight') : t('nav.switchDark')}
            title={theme === 'dark' ? t('nav.switchLight') : t('nav.switchDark')}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--accent-primary)]"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-[var(--tone-warning)]" />
            ) : (
              <Moon className="w-4 h-4 text-[var(--accent-primary)]" />
            )}
          </button>

          <a
            href="https://github.com/geevarghesekthomas84-sys/NetPulse"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub Repository"
            title="GitHub Repository"
            className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--accent-primary)]"
          >
            <Github className="w-4 h-4" />
          </a>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label={t('common.settings')}
            title={t('common.settings')}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--accent-primary)]"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Collapsible Mobile Quick Controls + Search Drawer */}
      {mobileSearchOpen && (
        <div className="md:hidden border-t border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 space-y-2 relative">
          <div className="flex items-center justify-between gap-2 sm:hidden">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">
              {experienceLevel === 'simple' ? t('nav.simpleMode') : t('nav.proMode')}
            </span>
            <button
              type="button"
              onClick={() => setExperienceLevel(experienceLevel === 'simple' ? 'pro' : 'simple')}
              className="rounded-md bg-[var(--accent-cta)] px-2.5 py-1 text-[11px] font-semibold text-white"
            >
              {experienceLevel === 'simple' ? t('nav.proMode') : t('nav.simpleMode')}
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
                    {protocol.name} — {protocol.fullName}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--accent-primary)] shrink-0">{t('common.open')}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  );
};
