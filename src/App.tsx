import { Suspense, lazy, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AboutModal } from './components/common/AboutModal';
import { CommandPalette } from './components/common/CommandPalette';
import { Header } from './components/common/Header';
import { LandingPage } from './components/landing/LandingPage';
import { SideNav } from './components/common/SideNav';
import { MobileTabBar } from './components/common/MobileTabBar';
import { OnboardingTour } from './components/common/OnboardingTour';
import { PacketInspector } from './components/common/PacketInspector';
import { ProtocolDrawer } from './components/common/ProtocolDrawer';
import { OfflineIndicator } from './components/common/PWAInstallButton';
import { SettingsModal } from './components/common/SettingsModal';
const ExploreWorkspace = lazy(() => import('./components/explore/ExploreWorkspace').then((m) => ({ default: m.ExploreWorkspace })));
const LearnWorkspace = lazy(() => import('./components/learn/LearnWorkspace').then((m) => ({ default: m.LearnWorkspace })));
const SimulatorWorkspace = lazy(() => import('./components/simulator/SimulatorWorkspace').then((m) => ({ default: m.SimulatorWorkspace })));
import type { SimDevice, SimLink } from './engine/types';
import { LANGUAGES } from './i18n';
import { decodeExploreHash, decompressTopology } from './lib/deepLink';
import { parsePath, pathFor } from './lib/routes';
import { loadScriptFont } from './lib/scriptFonts';
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
    setDrawerOpen,
    setTourOpen,
    reopenWelcome,
    landingOpen,
    setLandingOpen,
  } = useAppStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#14161d' : '#f7f5f0');
    }
  }, [theme]);

  useEffect(() => {
    const meta = LANGUAGES.find((l) => l.code === language);
    document.documentElement.dir = meta?.dir ?? 'ltr';
    document.documentElement.lang = language;
    loadScriptFont(language);
  }, [language]);

  useEffect(() => {
    // Real paths first (/explore/dns/, /simulator/ ...): these are the crawlable URLs.
    const route = parsePath(window.location.pathname);
    if (route && route.page !== 'landing') {
      if (route.page === 'explore') {
        if (route.protocol) selectProtocol(route.protocol, 0);
        else setMode('explore');
      } else if (route.page === 'simulator' || route.page === 'learn') {
        setMode(route.page);
      } else if (route.page === 'protocols') {
        setMode('explore');
        setDrawerOpen(true);
      } else if (route.page === 'about') {
        setMode('explore');
        setAboutOpen(true);
      }
      return;
    }
    const hash = window.location.hash;
    // A plain visit lands on the front page; older share links (#...) go straight into the app.
    if (!hash) {
      setLandingOpen(true);
      return;
    }
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

  // Keep the address bar on the page you are looking at, so every view has its own shareable URL.
  const firstSync = useRef(true);
  const { activeProtocolId: urlProtocol } = useAppStore();
  useEffect(() => {
    if (firstSync.current) {
      firstSync.current = false;
      return;
    }
    const path = landingOpen ? '/' : pathFor(mode, mode === 'explore' ? urlProtocol : undefined);
    if (window.location.pathname !== path || window.location.hash) {
      window.history.replaceState(null, '', path);
    }
  }, [landingOpen, mode, urlProtocol]);

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

  if (landingOpen) return <LandingPage />;

  return (
    <div className="flex h-dvh min-h-[620px] min-w-[320px] w-full flex-col overflow-hidden bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <SideNav />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header />
          <OfflineIndicator />

          {/* Workbench: protocol library drawer + the active workspace */}
          <div className="flex min-h-0 w-full flex-1 overflow-hidden">
            <ProtocolDrawer />

            <main className="flex min-h-[240px] min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg-canvas)]">
              <Suspense fallback={<div className="flex-1 animate-pulse bg-[var(--bg-canvas)]" aria-busy="true" />}>
                {mode === 'explore' && <ExploreWorkspace />}
                {mode === 'simulator' && <SimulatorWorkspace />}
                {mode === 'learn' && <LearnWorkspace />}
              </Suspense>
            </main>
          </div>
        </div>
      </div>

      <MobileTabBar />

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
    </div>
  );
}
