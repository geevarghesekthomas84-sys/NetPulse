import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Star,
  X,
} from 'lucide-react';
import { PROTOCOLS, PROTOCOL_MAP } from '../../protocols';
import { useAppStore } from '../../store/useAppStore';
import { tc } from '../../i18n/content';

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


  const filtered = PROTOCOLS.filter((p) => {
    if (drawerCategory !== 'ALL' && p.category !== drawerCategory) return false;
    const q = quickFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.fullName.toLowerCase().includes(q) ||
      tc(p.fullName).toLowerCase().includes(q) ||
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
      <div className="shrink-0 flex items-center justify-between border-b border-[var(--border-hairline)] px-3 py-2.5">
        <div className="min-w-0">
          <h2 className="hud-title text-sm text-[var(--text-primary)] truncate">
            {t('drawer.title')}
          </h2>
          <p className="font-mono text-[11px] text-[var(--text-muted)]">
            {t('drawer.specsHint', { count: PROTOCOLS.length })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          aria-label={isMobileOverlay ? t('common.close') : t('drawer.collapse')}
          title={isMobileOverlay ? t('common.close') : t('drawer.collapse')}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]"
        >
          {isMobileOverlay ? <X className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Quick Filter */}
      <div className="shrink-0 border-b border-[var(--border-hairline)] px-2.5 py-2 bg-[var(--bg-inset)]/60">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute start-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={quickFilter}
            onChange={(e) => setQuickFilter(e.target.value)}
            placeholder={t('drawer.filterPlaceholder')}
            aria-label={t('drawer.filterPlaceholder')}
            className="w-full rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] py-1 ps-7.5 pe-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
          />
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="shrink-0 grid grid-cols-4 gap-1 border-b border-[var(--border-hairline)] bg-[var(--bg-inset)] p-1">
        {(
          [
            { id: 'ALL', label: t('drawer.all') },
            { id: 'CORE', label: t('drawer.core') },
            { id: 'APPLICATION', label: t('drawer.application') },
            { id: 'SECURITY', label: t('drawer.security') },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setDrawerCategory(tab.id)}
            className={`rounded-full py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 truncate px-1 ${
              drawerCategory === tab.id
                ? 'bg-[var(--accent-cta)] text-[var(--on-accent)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
          <div className="p-2.5">
            <div className="mb-1.5 text-[11px] font-mono font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {t('drawer.favorites')}
            </div>
            <div className="flex flex-wrap gap-1">
              {favProtocols.map((p) => (
                <button
                  key={`fav-${p.id}`}
                  type="button"
                  onClick={() => {
                    selectProtocol(p.id, 0);
                    if (mode !== 'explore') setMode('explore');
                    if (isMobileOverlay) setDrawerOpen(false);
                  }}
                  className={`rounded border px-2 py-0.5 text-xs font-mono font-medium transition-colors ${
                    activeProtocolId === p.id
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-semibold'
                      : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
          <div className="px-2.5 py-2">
            <div className="mb-1 text-[11px] font-mono font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {t('drawer.recent')}
            </div>
            <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 text-xs text-[var(--text-secondary)]">
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
              <div key={p.id} className="border-b border-[var(--border-hairline)]/60 last:border-none">
                <div
                  className={`flex items-center justify-between gap-1.5 px-2.5 py-2 transition-colors ${
                    isSelected ? 'bg-[var(--accent-primary-soft)]' : 'hover:bg-[var(--accent-primary-soft)]/50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      selectProtocol(p.id, 0);
                      if (mode !== 'explore') setMode('explore');
                      if (isMobileOverlay) setDrawerOpen(false);
                    }}
                    className="flex flex-1 items-center gap-2 text-start min-w-0"
                  >
                    <span
                      title={st.label}
                      aria-label={st.label}
                      className={`h-2 w-2 rounded-full shrink-0 ${st.color}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {p.name}
                        </span>
                        <span className="text-[11px] font-mono text-[var(--text-muted)]">
                          {p.defaultPort.split(' ')[0]}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--text-muted)] truncate">{tc(p.fullName)}</div>
                    </div>
                    {isSelected ? (
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleFavorite(p.id)}
                    aria-label={isFav ? t('explore.removeFavorite') : t('explore.addFavorite')}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--tone-warning)] shrink-0"
                  >
                    <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400 text-amber-500' : ''}`} />
                  </button>
                </div>

                {/* Expanded Accordion Steps */}
                {isSelected && (
                  <div className="bg-[var(--bg-inset)]/80 px-3 py-1.5 space-y-0.5">
                    {p.steps.map((step, sIdx) => (
                      <button
                        key={step.title}
                        type="button"
                        onClick={() => {
                          selectProtocol(p.id, sIdx);
                          if (mode !== 'explore') setMode('explore');
                          if (isMobileOverlay) setDrawerOpen(false);
                        }}
                        className={`flex w-full items-start gap-2 rounded px-2 py-1 text-start text-xs transition-colors ${
                          currentStepIndex === sIdx
                            ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-semibold'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--accent-primary-soft)]/50'
                        }`}
                      >
                        <span className="font-mono text-[11px] opacity-80">{sIdx + 1}.</span>
                        <span className="truncate">{tc(step.title)}</span>
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
          aria-label={t('drawer.title')}
          className="hidden lg:flex w-[300px] shrink-0 flex-col border-e border-[var(--border-hairline)] bg-[var(--bg-surface)]"
        >
          {renderProtocolBody(false)}
        </aside>
      ) : null}

      {/* Phones: bottom sheet. Tablets (<lg): side slide-over. */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end md:items-stretch">
          <div
            className="fixed inset-0 bg-black/65 backdrop-blur-xs"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={t('drawer.title')}
            className="np-sheet relative z-10 flex h-[82dvh] w-full flex-col rounded-t-3xl border-t border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl md:h-full md:w-[360px] md:rounded-none md:border-t-0 md:border-e"
          >
            <div className="md:hidden flex justify-center pt-2" aria-hidden="true">
              <span className="h-1.5 w-10 rounded-full bg-[var(--border-strong)]" />
            </div>
            {renderProtocolBody(true)}
          </aside>
        </div>
      )}
    </>
  );
};
