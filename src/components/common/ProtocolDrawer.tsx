import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Cpu,
  GraduationCap,
  PanelLeftOpen,
  Search,
  Star,
  X,
} from 'lucide-react';
import { PROTOCOLS, PROTOCOL_MAP } from '../../protocols';
import { useAppStore } from '../../store/useAppStore';

export const ProtocolDrawer: React.FC = () => {
  const { t } = useTranslation();
  const {
    mode,
    setMode,
    drawerOpen,
    setDrawerOpen,
    drawerCategory,
    setDrawerCategory,
    activeProtocolId,
    currentStepIndex,
    selectProtocol,
    favorites,
    recentlyViewed,
    toggleFavorite,
  } = useAppStore();

  const [quickFilter, setQuickFilter] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerOpen && window.innerWidth < 1024) {
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen, setDrawerOpen]);

  const coreCount = PROTOCOLS.filter((p) => p.category === 'CORE').length;
  const appCount = PROTOCOLS.filter((p) => p.category === 'APPLICATION').length;
  const secCount = PROTOCOLS.filter((p) => p.category === 'SECURITY').length;

  const filtered = PROTOCOLS.filter((p) => {
    if (drawerCategory !== 'ALL' && p.category !== drawerCategory) return false;
    const q = quickFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.fullName.toLowerCase().includes(q) ||
      p.defaultPort.toLowerCase().includes(q)
    );
  });

  const favProtocols = favorites
    .map((id) => PROTOCOL_MAP.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const recentProtocols = recentlyViewed
    .map((id) => PROTOCOL_MAP.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const statusIndicator = (status: 'full' | 'partial' | 'basic') => {
    if (status === 'full') return { color: 'bg-emerald-500', label: t('drawer.fullySimulated') };
    if (status === 'partial') return { color: 'bg-amber-500', label: t('drawer.partiallySimulated') };
    return { color: 'bg-slate-400', label: t('drawer.basicDiagram') };
  };

  const renderProtocolBody = (isMobileOverlay: boolean) => (
    <>
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between border-b border-[var(--border-hairline)] px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-[var(--text-primary)] truncate">
            {t('drawer.title')}
          </h2>
          <p className="mt-0.5 text-xs font-medium text-[var(--text-secondary)] tabular-nums">
            {t('drawer.specsHint', { count: PROTOCOLS.length })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          aria-label={isMobileOverlay ? t('common.close') : t('drawer.collapse')}
          title={isMobileOverlay ? t('common.close') : t('drawer.collapse')}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors"
        >
          {isMobileOverlay ? <X className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Quick Filter */}
      <div className="shrink-0 border-b border-[var(--border-hairline)] px-3 py-2.5 bg-[var(--bg-inset)]/60">
        <div className="relative">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={quickFilter}
            onChange={(e) => setQuickFilter(e.target.value)}
            placeholder={t('drawer.filterPlaceholder')}
            aria-label={t('drawer.filterPlaceholder')}
            className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] py-2 ps-9 pe-3 text-[13px] font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Category Filter Tabs (Adaptive Flex Wrap — zero clipped labels) */}
      <div className="shrink-0 flex flex-wrap items-center gap-1 border-b border-[var(--border-hairline)] bg-[var(--bg-inset)] p-1.5">
        {(
          [
            { id: 'ALL', label: `${t('drawer.all')} (${PROTOCOLS.length})` },
            { id: 'CORE', label: `${t('drawer.core')} (${coreCount})` },
            { id: 'APPLICATION', label: `${t('drawer.application')} (${appCount})` },
            { id: 'SECURITY', label: `${t('drawer.security')} (${secCount})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setDrawerCategory(tab.id)}
            className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
              drawerCategory === tab.id
                ? 'bg-[var(--accent-cta)] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]/70 hover:text-[var(--text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scrollable List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-hairline)]">
        {/* Favorites */}
        {favProtocols.length > 0 && !quickFilter.trim() && (
          <div className="p-3">
            <div className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">
              {t('drawer.favorites')}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {favProtocols.map((p) => (
                <button
                  key={`fav-${p.id}`}
                  type="button"
                  onClick={() => {
                    selectProtocol(p.id, 0);
                    if (mode !== 'explore') setMode('explore');
                    if (isMobileOverlay) setDrawerOpen(false);
                  }}
                  className={`rounded-md border px-2.5 py-1 text-xs font-mono font-semibold transition-colors ${
                    activeProtocolId === p.id
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recently Viewed */}
        {recentProtocols.length > 0 && !quickFilter.trim() && (
          <div className="px-3 py-2.5">
            <div className="mb-1 text-xs font-semibold text-[var(--text-secondary)]">
              {t('drawer.recent')}
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs font-medium text-[var(--text-secondary)]">
              {recentProtocols.map((p, idx) => (
                <React.Fragment key={`rec-${p.id}`}>
                  <button
                    type="button"
                    onClick={() => {
                      selectProtocol(p.id, 0);
                      if (mode !== 'explore') setMode('explore');
                      if (isMobileOverlay) setDrawerOpen(false);
                    }}
                    className="hover:text-[var(--accent-primary)] underline-offset-2 hover:underline"
                  >
                    {p.name}
                  </button>
                  {idx < recentProtocols.length - 1 && <span aria-hidden="true">·</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Full Protocol Accordion Rows */}
        <div>
          {filtered.map((p) => {
            const isSelected = p.id === activeProtocolId;
            const isFav = favorites.includes(p.id);
            const st = statusIndicator(p.status);
            return (
              <div key={p.id} className="border-b border-[var(--border-hairline)] last:border-none">
                <div
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 transition-colors ${
                    isSelected ? 'bg-[var(--accent-primary-soft)]' : 'hover:bg-[var(--accent-primary-soft)]/50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      selectProtocol(p.id, 0);
                      if (mode !== 'explore') setMode('explore');
                    }}
                    className="flex flex-1 items-center gap-2.5 text-start min-w-0"
                  >
                    <span
                      title={st.label}
                      aria-label={st.label}
                      className={`h-5 w-1 rounded-xs shrink-0 ${st.color}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-display text-sm font-bold text-[var(--text-primary)] truncate">
                          {p.name}
                        </span>
                        <span className="text-xs font-mono font-semibold text-[var(--accent-primary)] tabular-nums shrink-0">
                          {p.defaultPort.split(' ')[0]}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[12.5px] font-medium text-[var(--text-secondary)] truncate">
                        {p.fullName}
                      </div>
                    </div>
                    {isSelected ? (
                      <ChevronDown className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleFavorite(p.id)}
                    aria-label={isFav ? t('explore.removeFavorite') : t('explore.addFavorite')}
                    className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--tone-warning)] shrink-0"
                  >
                    <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400 text-amber-500' : ''}`} />
                  </button>
                </div>

                {/* Expanded Accordion Steps */}
                {isSelected && (
                  <div className="bg-[var(--bg-inset)]/80 px-3.5 py-2 space-y-1">
                    {p.steps.map((step, sIdx) => (
                      <button
                        key={step.title}
                        type="button"
                        onClick={() => {
                          selectProtocol(p.id, sIdx);
                          if (mode !== 'explore') setMode('explore');
                          if (isMobileOverlay) setDrawerOpen(false);
                        }}
                        className={`flex w-full items-baseline gap-2 rounded-lg px-2.5 py-1.5 text-start text-[13px] transition-colors ${
                          currentStepIndex === sIdx
                            ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-semibold'
                            : 'text-[var(--text-secondary)] font-medium hover:bg-[var(--accent-primary-soft)]/50 hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <span className="font-mono text-xs font-semibold opacity-80 tabular-nums">{sIdx + 1}.</span>
                        <span className="truncate">{step.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Collapsible Docked Sidebar / Activity Rail (lg+) */}
      {drawerOpen ? (
        <aside
          aria-label="Global Protocol Explorer Sidebar"
          className="hidden lg:flex w-[308px] shrink-0 flex-col border-e border-[var(--border-hairline)] bg-[var(--bg-surface)]"
        >
          {renderProtocolBody(false)}
        </aside>
      ) : (
        <aside
          aria-label="Workbench Navigation Rail"
          className="hidden lg:flex w-12 shrink-0 flex-col items-center justify-between border-e border-[var(--border-hairline)] bg-[var(--bg-surface)] py-2.5"
        >
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              title={t('drawer.title')}
              aria-label={t('drawer.title')}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>

            <span className="my-1 h-px w-6 bg-[var(--border-hairline)]" />

            {(
              [
                { id: 'explore', label: t('nav.explore'), icon: Compass },
                { id: 'simulator', label: t('nav.simulator'), icon: Cpu },
                { id: 'learn', label: t('nav.learn'), icon: GraduationCap },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = mode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  title={item.label}
                  aria-label={item.label}
                  className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                    active
                      ? 'border-[var(--accent-cta)] bg-[var(--accent-cta)] text-white shadow-sm'
                      : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--border-hairline)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-1">
            {favProtocols.slice(0, 4).map((p) => (
              <button
                key={`rail-${p.id}`}
                type="button"
                onClick={() => {
                  selectProtocol(p.id, 0);
                  setMode('explore');
                }}
                title={`${p.name} — ${p.fullName}`}
                className={`flex h-7 w-8 items-center justify-center rounded border font-mono text-[9.5px] font-bold transition-colors ${
                  activeProtocolId === p.id && mode === 'explore'
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                    : 'border-[var(--border-hairline)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {p.name.slice(0, 4)}
              </button>
            ))}
          </div>
        </aside>
      )}

      {/* Mobile / Tablet Slide-up Sheet (<lg) */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-black/65 backdrop-blur-xs transition-opacity"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-label={t('drawer.title')}
            className="relative z-10 flex h-[82vh] sm:h-full w-full sm:w-[360px] flex-col rounded-t-2xl sm:rounded-none border-t sm:border-t-0 sm:border-e border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-left duration-200"
          >
            {/* Grab handle for slide-up sheet on phones */}
            <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0 bg-[var(--bg-surface)]">
              <div className="w-10 h-1.5 rounded-full bg-[var(--border-strong)]" />
            </div>
            {renderProtocolBody(true)}
          </aside>
        </div>
      )}
    </>
  );
};
