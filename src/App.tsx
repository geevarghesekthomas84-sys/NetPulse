import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AboutModal } from './components/common/AboutModal';
import { CommandPalette } from './components/common/CommandPalette';
import { Header } from './components/common/Header';
import { MobileTabBar } from './components/common/MobileTabBar';
import { OnboardingTour } from './components/common/OnboardingTour';
import { PacketInspector } from './components/common/PacketInspector';
import { ProtocolDrawer } from './components/common/ProtocolDrawer';
import { OfflineIndicator } from './components/common/PWAInstallButton';
import { SettingsModal } from './components/common/SettingsModal';
import { ExploreWorkspace } from './components/explore/ExploreWorkspace';
import { LearnWorkspace } from './components/learn/LearnWorkspace';
import { SimulatorWorkspace } from './components/simulator/SimulatorWorkspace';
import type { SimDevice, SimLink } from './engine/types';
import { LANGUAGES } from './i18n';
import { decodeExploreHash, decompressTopology } from './lib/deepLink';
import { getProtocolById } from './protocols';
import { useAppStore } from './store/useAppStore';

export default function App() {
  const { t } = useTranslation();
  const {
    theme,
    language,
    mode,
    activeProtocolId,
    whatIfOptions,
    inspectedPacketId,
    setInspectedPacketId,
    settings,
    setTheme,
    setLanguage,
    setMode,
    selectProtocol,
    setPlaybackSpeed,
    setExploreView,
    setSimTopology,
    setAboutOpen,
    setTourOpen,
    reopenWelcome,
  } = useAppStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#08111e' : '#f6f8fb');
    }
  }, [theme]);

  useEffect(() => {
    const meta = LANGUAGES.find((l) => l.code === language);
    document.documentElement.dir = meta?.dir ?? 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const parsed = decodeExploreHash(hash);
    if (parsed.theme) setTheme(parsed.theme);
    if (parsed.view) setExploreView(parsed.view);
    if (parsed.speed) setPlaybackSpeed(parsed.speed);
    if (parsed.protocol) {
      selectProtocol(parsed.protocol, parsed.step ?? 0);
    }
    if (parsed.sim) {
      const topo = decompressTopology<{ devices: SimDevice[]; links: SimLink[] }>(parsed.sim);
      if (topo?.devices && topo?.links) {
        setSimTopology(topo.devices, topo.links);
        setMode('simulator');
        return;
      }
    }
    if (parsed.mode) setMode(parsed.mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLanguage(language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const explorePackets = useMemo(() => {
    const proto = getProtocolById(activeProtocolId);
    return proto.scenario({ ...whatIfOptions, seed: settings.defaultSeed }).packets;
  }, [activeProtocolId, whatIfOptions, settings.defaultSeed]);

  const inspectedExplorePacket = useMemo(
    () => (inspectedPacketId ? explorePackets.find((p) => p.id === inspectedPacketId) ?? null : null),
    [inspectedPacketId, explorePackets]
  );

  return (
    <div className="flex h-screen max-h-screen h-dvh w-full flex-col overflow-hidden bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <Header />
      <OfflineIndicator />

      {/* Packet-Tracer Workbench Shell: Global Collapsible Sidebar + Central Full-Width Workspace */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden pb-14 lg:pb-0">
        <ProtocolDrawer />

        <main className="flex flex-1 min-w-0 min-h-[240px] flex-col overflow-hidden bg-[var(--bg-canvas)]">
          {mode === 'explore' && <ExploreWorkspace />}
          {mode === 'simulator' && <SimulatorWorkspace />}
          {mode === 'learn' && <LearnWorkspace />}
        </main>
      </div>

      <footer className="hidden lg:flex h-7 shrink-0 items-center justify-between border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 text-[11px] font-medium text-[var(--text-secondary)] select-none">
        <div className="flex items-center gap-2 truncate">
          <span className="font-semibold text-[var(--text-primary)]">{t('brand')}</span>
          <span className="text-[var(--text-muted)]">·</span>
          <span>{t('credit')}</span>
          <span className="text-[var(--text-muted)]">·</span>
          <span className="truncate">{t('nav.footerTagline')}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              reopenWelcome();
              setMode('explore');
            }}
            className="hover:text-[var(--accent-primary)] transition-colors"
          >
            {t('nav.quickGuide')}
          </button>
          <span className="text-[var(--text-muted)]">·</span>
          <button
            type="button"
            onClick={() => setTourOpen(true)}
            className="hover:text-[var(--accent-primary)] transition-colors"
          >
            {t('nav.guidedTour')}
          </button>
          <span className="text-[var(--text-muted)]">·</span>
          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            className="hover:text-[var(--accent-primary)] transition-colors"
          >
            {t('nav.aboutPrivacy')}
          </button>
        </div>
      </footer>

      {mode === 'explore' && (
        <PacketInspector
          packet={inspectedExplorePacket}
          onClose={() => setInspectedPacketId(null)}
          defaultShowHex={settings.showHexByDefault}
        />
      )}

      <CommandPalette />
      <SettingsModal />
      <AboutModal />
      <OnboardingTour />
      <MobileTabBar />
    </div>
  );
}
