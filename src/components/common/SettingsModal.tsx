import React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { LANGUAGES } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';

export const SettingsModal: React.FC = () => {
  const { t } = useTranslation();
  const {
    settingsOpen,
    setSettingsOpen,
    theme,
    setTheme,
    language,
    setLanguage,
    experienceLevel,
    setExperienceLevel,
    settings,
    updateSettings,
  } = useAppStore();

  if (!settingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-label={t('modals.settingsTitle')}
        className="w-full max-w-lg rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-5 py-3.5">
          <h2 className="font-display text-base font-bold text-[var(--text-primary)]">{t('modals.settingsTitle')}</h2>
          <button
            type="button"
            onClick={() => setSettingsOpen(false)}
            aria-label={t('common.close')}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Theme</span>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as 'dark' | 'light')}
                className="mt-1 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                <option value="light">Crisp Daylight (Light)</option>
                <option value="dark">Deep Ocean Slate (Dark)</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-[var(--text-secondary)]">{t('nav.selectLanguage')}</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name} ({l.label})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)]/60 px-3 py-2.5">
            <div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">
                {t('nav.simpleMode')} / {t('nav.proMode')}
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                {experienceLevel === 'simple' ? t('nav.simpleTooltip') : t('nav.proTooltip')}
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setExperienceLevel('simple')}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                  experienceLevel === 'simple' ? 'bg-[var(--accent-teal)] text-white' : 'text-[var(--text-secondary)]'
                }`}
              >
                {t('nav.simpleMode')}
              </button>
              <button
                type="button"
                onClick={() => setExperienceLevel('pro')}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                  experienceLevel === 'pro' ? 'bg-[var(--accent-cta)] text-white' : 'text-[var(--text-secondary)]'
                }`}
              >
                {t('nav.proMode')}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Packet Size Scale ({settings.packetScale.toFixed(2)}x)
              </span>
              <input
                type="range"
                min={0.75}
                max={1.5}
                step={0.05}
                value={settings.packetScale}
                onChange={(e) => updateSettings({ packetScale: Number(e.target.value) })}
                className="mt-2 w-full accent-[var(--accent-primary)]"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Deterministic RNG Seed</span>
              <input
                type="number"
                value={settings.defaultSeed}
                onChange={(e) => updateSettings({ defaultSeed: Number(e.target.value) || 42 })}
                className="mt-1 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-1.5 font-mono text-sm text-[var(--text-primary)]"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Packet Time Format</span>
            <select
              value={settings.timeFormat}
              onChange={(e) => updateSettings({ timeFormat: e.target.value as 'relative' | 'ms' })}
              className="mt-1 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              <option value="relative">Seconds (0.024s)</option>
              <option value="ms">Milliseconds (24.0 ms)</option>
            </select>
          </label>

          <div className="space-y-2.5 pt-1">
            {(
              [
                ['animationsEnabled', 'Enable smooth packet animations'],
                ['showMacAddresses', 'Show MAC addresses under network nodes'],
                ['showHexByDefault', 'Expand Hex + ASCII dump by default in Inspector'],
                ['soundEffects', 'Soft audio click blips on packet send/receive'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-sm text-[var(--text-secondary)]">{label}</span>
                <input
                  type="checkbox"
                  checked={settings[key]}
                  onChange={(e) => updateSettings({ [key]: e.target.checked })}
                  className="h-4 w-4 rounded accent-[var(--accent-primary)]"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end border-t border-[var(--border-hairline)] px-5 py-3">
          <button
            type="button"
            onClick={() => setSettingsOpen(false)}
            className="rounded-lg bg-[var(--accent-cta)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-cta-hover)]"
          >
            {t('common.gotIt')}
          </button>
        </div>
      </div>
    </div>
  );
};
