import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Cpu, Globe, Search, Settings, X } from 'lucide-react';
import { PROTOCOLS } from '../../protocols';
import { PRESET_LABS } from '../../simulator/labs';
import { useAppStore } from '../../store/useAppStore';

export const CommandPalette: React.FC = () => {
  const { t } = useTranslation();
  const { commandPaletteOpen, setCommandPaletteOpen, selectProtocol, loadLab, setMode, setSettingsOpen } =
    useAppStore();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [commandPaletteOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && commandPaletteOpen) setCommandPaletteOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list: Array<{ id: string; group: string; title: string; sub: string; action: () => void; icon: React.ReactNode }> = [];

    for (const p of PROTOCOLS) {
      list.push({
        id: `proto-${p.id}`,
        group: t('nav.protocols'),
        title: `${p.name} — ${p.fullName}`,
        sub: `${p.category} · ${t('explore.port')} ${p.defaultPort}`,
        icon: <Globe className="w-4 h-4 text-[var(--tone-info)]" />,
        action: () => selectProtocol(p.id, 0),
      });
    }

    for (const lab of PRESET_LABS) {
      list.push({
        id: `lab-${lab.id}`,
        group: t('simulator.labs'),
        title: `Lab ${lab.number}: ${lab.title}`,
        sub: lab.category,
        icon: <Cpu className="w-4 h-4 text-[var(--tone-success)]" />,
        action: () => loadLab(lab.id),
      });
    }

    list.push({
      id: 'act-learn',
      group: t('nav.learn'),
      title: `${t('nav.learn')} — ${t('learn.quizzes')}, ${t('learn.games')}`,
      sub: t('nav.learn'),
      icon: <BookOpen className="w-4 h-4 text-[var(--accent-primary)]" />,
      action: () => setMode('learn'),
    });

    list.push({
      id: 'act-settings',
      group: t('common.settings'),
      title: t('modals.settingsTitle'),
      sub: t('common.settings'),
      icon: <Settings className="w-4 h-4 text-[var(--tone-warning)]" />,
      action: () => setSettingsOpen(true),
    });

    if (!q) return list.slice(0, 14);
    return list
      .filter((i) => i.title.toLowerCase().includes(q) || i.sub.toLowerCase().includes(q) || i.group.toLowerCase().includes(q))
      .slice(0, 14);
  }, [query, selectProtocol, loadLab, setMode, setSettingsOpen, t]);

  if (!commandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-20 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-label={t('nav.commandPalette')}
        className="w-full max-w-xl overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] px-4 py-3">
          <Search className="w-4 h-4 text-[var(--text-muted)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('modals.cmdPlaceholder')}
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(false)}
            aria-label={t('common.close')}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-[var(--border-hairline)]">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                item.action();
                setCommandPaletteOpen(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-[var(--accent-primary-soft)] transition-colors"
            >
              {item.icon}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[var(--text-primary)] truncate">{item.title}</div>
                <div className="text-xs text-[var(--text-muted)] truncate">
                  {item.group} · {item.sub}
                </div>
              </div>
            </button>
          ))}
          {items.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">{t('common.noResults')}</div>
          )}
        </div>
      </div>
    </div>
  );
};
