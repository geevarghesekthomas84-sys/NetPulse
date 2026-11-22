import '../lib/migrateStorage';
import { create } from 'zustand';
import i18n, { LANGUAGES } from '../i18n';
import { loadContentLanguage, onContentLoaded } from '../i18n/content';
import { getProtocolById } from '../protocols';
import type { ScenarioOptions } from '../protocols/types';
import { PRESET_LABS } from '../simulator/labs';
import type { SimDevice, SimLink } from '../engine/types';
import { playPacketBlip } from '../lib/sound';
import { dayKey, EMPTY_STREAK, recordDay, type StreakState } from '../lib/streak';

export type AppMode = 'explore' | 'simulator' | 'learn';
export type ExploreView = 'network' | 'sequence';
export interface MissedQuestion {
  protocolId: string;
  /** English question text, which is also how it is looked up in the protocol's quiz. */
  question: string;
  misses: number;
}

export type ThemeMode = 'dark' | 'light';
export type ExperienceLevel = 'simple' | 'pro';

export interface AppSettings {
  animationsEnabled: boolean;
  packetScale: number; // 0.75..1.5
  showMacAddresses: boolean;
  showHexByDefault: boolean;
  timeFormat: 'relative' | 'ms';
  soundEffects: boolean;
  defaultSeed: number;
}

export interface SavedLabProject {
  id: string;
  name: string;
  savedAt: string;
  devices: SimDevice[];
  links: SimLink[];
}

interface AppState {
  theme: ThemeMode;
  language: string;
  /** Bumped when a lesson-content dictionary finishes loading. */
  contentVersion: number;
  mode: AppMode;
  experienceLevel: ExperienceLevel;
  welcomeDismissed: boolean;
  /** The landing page is shown instead of the workspace. */
  landingOpen: boolean;
  drawerOpen: boolean;
  drawerCategory: 'ALL' | 'CORE' | 'APPLICATION' | 'SECURITY';
  activeProtocolId: string;
  compareMode: boolean;
  comparePairId: string;
  exploreView: ExploreView;
  whatIfOptions: ScenarioOptions;

  // Playback state for Explore mode
  currentStepIndex: number;
  currentPacketIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  loopEnabled: boolean;
  autoAdvanceSteps: boolean;
  inspectedPacketId: string | null;

  // Discovery & User lists
  favorites: string[];
  recentlyViewed: string[];

  // Modals & Overlays
  settingsOpen: boolean;
  aboutOpen: boolean;
  commandPaletteOpen: boolean;
  tourOpen: boolean;
  settings: AppSettings;

  // Learn progress
  viewedProtocols: string[];
  /** Protocols the learner has played through to the last packet. */
  finishedProtocols: string[];
  /** Best score (10-100) per Break-it challenge id. */
  challengeBest: Record<string, number>;
  /** Daily activity streak, stored per browser. */
  streak: StreakState;
  /** Quiz questions answered wrongly and not yet answered correctly in review. */
  missed: Record<string, MissedQuestion>;
  completedLabs: string[];
  quizScores: Record<string, number>;

  // Simulator workspace state
  simDevices: SimDevice[];
  simLinks: SimLink[];
  activeLabId: string;
  simSpeed: number;
  simPlaying: boolean;
  selectedDeviceId: string | null;
  savedProjects: SavedLabProject[];

  // Actions
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setExperienceLevel: (level: ExperienceLevel) => void;
  toggleExperienceLevel: () => void;
  dismissWelcome: () => void;
  reopenWelcome: () => void;
  setLanguage: (lang: string) => void;
  setLandingOpen: (open: boolean) => void;
  setMode: (mode: AppMode) => void;
  setDrawerOpen: (open: boolean) => void;
  setDrawerCategory: (cat: AppState['drawerCategory']) => void;
  selectProtocol: (id: string, stepIndex?: number) => void;
  setExploreView: (view: ExploreView) => void;
  toggleWhatIf: (key: keyof ScenarioOptions) => void;
  resetWhatIf: () => void;
  setCompareMode: (on: boolean) => void;
  setComparePairId: (id: string) => void;

  setCurrentStepIndex: (idx: number) => void;
  setCurrentPacketIndex: (idx: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  setLoopEnabled: (loop: boolean) => void;
  setAutoAdvanceSteps: (auto: boolean) => void;
  setInspectedPacketId: (id: string | null) => void;

  toggleFavorite: (id: string) => void;
  setSettingsOpen: (open: boolean) => void;
  setAboutOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setTourOpen: (open: boolean) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;

  markProtocolFinished: (id: string) => void;
  recordChallenge: (id: string, score: number) => void;
  recordActivity: () => void;
  recordQuizResults: (items: Array<{ protocolId: string; question: string; correct: boolean }>) => void;
  recordQuizScore: (protocolId: string, score: number) => void;
  markLabCompleted: (labId: string) => void;

  loadLab: (labId: string) => void;
  setSimTopology: (devices: SimDevice[], links: SimLink[]) => void;
  setSelectedDeviceId: (id: string | null) => void;
  setSimSpeed: (speed: number) => void;
  setSimPlaying: (playing: boolean) => void;
  saveNamedProject: (name: string) => void;
  loadNamedProject: (id: string) => void;
}

const loadJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const initialTheme: ThemeMode =
  typeof window !== 'undefined' && localStorage.getItem('netpulse-theme') === 'dark' ? 'dark' : 'light';

const initialExperience: ExperienceLevel =
  typeof window !== 'undefined' && localStorage.getItem('netpulse-experience') === 'pro' ? 'pro' : 'simple';

const initialWelcomeDismissed: boolean =
  typeof window !== 'undefined' && localStorage.getItem('netpulse-welcome-dismissed') !== 'false';

const defaultLab = PRESET_LABS[0];

export const useAppStore = create<AppState>((set, get) => ({
  theme: initialTheme,
  language: typeof window !== 'undefined' ? localStorage.getItem('netpulse-lang') || 'en' : 'en',
  contentVersion: 0,
  mode: 'explore',
  experienceLevel: initialExperience,
  welcomeDismissed: initialWelcomeDismissed,
  landingOpen: false,
  drawerOpen: false,
  drawerCategory: 'ALL',
  activeProtocolId: 'http',
  compareMode: false,
  comparePairId: 'http-vs-https',
  exploreView: 'network',
  whatIfOptions: {},

  currentStepIndex: 0,
  currentPacketIndex: 0,
  isPlaying: false,
  playbackSpeed: 1,
  loopEnabled: false,
  autoAdvanceSteps: true,
  inspectedPacketId: null,

  favorites: loadJson<string[]>('netpulse-favorites', ['http', 'dns', 'tcp', 'tls']),
  recentlyViewed: loadJson<string[]>('netpulse-recent', ['http', 'dns', 'tcp']),

  settingsOpen: false,
  aboutOpen: false,
  commandPaletteOpen: false,
  tourOpen: false,
  settings: loadJson<AppSettings>('netpulse-settings', {
    animationsEnabled: true,
    packetScale: 1,
    showMacAddresses: false,
    showHexByDefault: true,
    timeFormat: 'relative',
    soundEffects: false,
    defaultSeed: 42,
  }),

  viewedProtocols: loadJson<string[]>('netpulse-viewed', ['http']),
  finishedProtocols: loadJson<string[]>('netpulse-finished', []),
  challengeBest: loadJson<Record<string, number>>('netpulse-challenges', {}),
  streak: loadJson<StreakState>('netpulse-streak', EMPTY_STREAK),
  missed: loadJson<Record<string, MissedQuestion>>('netpulse-missed', {}),
  completedLabs: loadJson<string[]>('netpulse-completed-labs', []),
  quizScores: loadJson<Record<string, number>>('netpulse-quiz-scores', {}),

  simDevices: structuredClone(defaultLab.devices),
  simLinks: structuredClone(defaultLab.links),
  activeLabId: defaultLab.id,
  simSpeed: 1,
  simPlaying: false,
  selectedDeviceId: defaultLab.devices[0]?.id ?? null,
  savedProjects: loadJson<SavedLabProject[]>('netpulse-saved-projects', []),

  setTheme: (theme) => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.classList.add('theme-switching');
      root.classList.toggle('dark', theme === 'dark');
      // Force the new token values to be applied before transitions are re-enabled.
      void root.offsetHeight;
      window.setTimeout(() => root.classList.remove('theme-switching'), 60);
      localStorage.setItem('netpulse-theme', theme);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute('content', theme === 'dark' ? '#14161d' : '#f7f5f0');
      }
    }
    set({ theme });
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },

  setExperienceLevel: (experienceLevel) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('netpulse-experience', experienceLevel);
    }
    set({ experienceLevel });
  },

  toggleExperienceLevel: () => {
    const next = get().experienceLevel === 'simple' ? 'pro' : 'simple';
    get().setExperienceLevel(next);
  },

  dismissWelcome: () => {
    if (typeof window !== 'undefined') localStorage.setItem('netpulse-welcome-dismissed', 'true');
    set({ welcomeDismissed: true });
  },

  reopenWelcome: () => {
    if (typeof window !== 'undefined') localStorage.setItem('netpulse-welcome-dismissed', 'false');
    set({ welcomeDismissed: false });
  },

  setLanguage: (lang) => {
    void loadContentLanguage(lang);
    void i18n.changeLanguage(lang);
    const meta = LANGUAGES.find((l) => l.code === lang);
    if (typeof document !== 'undefined') {
      document.documentElement.dir = meta?.dir ?? 'ltr';
      document.documentElement.lang = lang;
      localStorage.setItem('netpulse-lang', lang);
    }
    set({ language: lang });
  },

  setLandingOpen: (landingOpen) => set({ landingOpen }),
  setMode: (mode) => set({ mode }),
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  setDrawerCategory: (drawerCategory) => set({ drawerCategory }),

  selectProtocol: (id, stepIndex = 0) => {
    const proto = getProtocolById(id);
    const recent = [proto.id, ...get().recentlyViewed.filter((x) => x !== proto.id)].slice(0, 6);
    const viewed = Array.from(new Set([...get().viewedProtocols, proto.id]));
    if (typeof window !== 'undefined') {
      localStorage.setItem('netpulse-recent', JSON.stringify(recent));
      localStorage.setItem('netpulse-viewed', JSON.stringify(viewed));
      document.title = `${proto.name} Explained: Step-by-Step Packet Animation | NetPulse`;
    }
    const result = proto.scenario(get().whatIfOptions);
    const firstPacketOfStep = Math.max(
      0,
      result.packets.findIndex((p) => (p.stepIndex ?? 0) >= stepIndex)
    );
    set({
      mode: 'explore',
      activeProtocolId: proto.id,
      currentStepIndex: stepIndex,
      currentPacketIndex: firstPacketOfStep,
      isPlaying: false,
      inspectedPacketId: null,
      recentlyViewed: recent,
      viewedProtocols: viewed,
    });
  },

  setExploreView: (exploreView) => set({ exploreView }),

  toggleWhatIf: (key) => {
    const curr = get().whatIfOptions;
    const next = { ...curr, [key]: !curr[key] };
    set({ whatIfOptions: next, currentPacketIndex: 0, currentStepIndex: 0, isPlaying: false });
  },

  resetWhatIf: () => set({ whatIfOptions: {}, currentPacketIndex: 0, currentStepIndex: 0, isPlaying: false }),

  setCompareMode: (compareMode) => set({ compareMode }),
  setComparePairId: (comparePairId) => set({ comparePairId }),

  setCurrentStepIndex: (currentStepIndex) => set({ currentStepIndex }),
  setCurrentPacketIndex: (currentPacketIndex) => {
    if (get().settings.soundEffects) {
      playPacketBlip('send');
    }
    set({ currentPacketIndex });
  },
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setLoopEnabled: (loopEnabled) => set({ loopEnabled }),
  setAutoAdvanceSteps: (autoAdvanceSteps) => set({ autoAdvanceSteps }),
  setInspectedPacketId: (inspectedPacketId) => set({ inspectedPacketId }),

  toggleFavorite: (id) => {
    const favs = get().favorites;
    const next = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
    if (typeof window !== 'undefined') localStorage.setItem('netpulse-favorites', JSON.stringify(next));
    set({ favorites: next });
  },

  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setAboutOpen: (aboutOpen) => set({ aboutOpen }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setTourOpen: (tourOpen) => set({ tourOpen }),

  updateSettings: (partial) => {
    const next = { ...get().settings, ...partial };
    if (typeof window !== 'undefined') localStorage.setItem('netpulse-settings', JSON.stringify(next));
    set({ settings: next });
  },

  recordActivity: () => {
    const prev = get().streak;
    const next = recordDay(prev, dayKey());
    if (next === prev) return;
    if (typeof window !== 'undefined') localStorage.setItem('netpulse-streak', JSON.stringify(next));
    set({ streak: next });
  },

  recordQuizResults: (items) => {
    const missed = { ...get().missed };
    for (const it of items) {
      const key = `${it.protocolId}|${it.question}`;
      if (it.correct) delete missed[key];
      else missed[key] = { protocolId: it.protocolId, question: it.question, misses: (missed[key]?.misses ?? 0) + 1 };
    }
    if (typeof window !== 'undefined') localStorage.setItem('netpulse-missed', JSON.stringify(missed));
    set({ missed });
    get().recordActivity();
  },

  recordChallenge: (id, score) => {
    get().recordActivity();
    const cur = get().challengeBest;
    const next = { ...cur, [id]: Math.max(cur[id] ?? 0, score) };
    if (typeof window !== 'undefined') localStorage.setItem('netpulse-challenges', JSON.stringify(next));
    set({ challengeBest: next });
  },

  markProtocolFinished: (id) => {
    get().recordActivity();
    const cur = get().finishedProtocols;
    if (cur.includes(id)) return;
    const next = [...cur, id];
    if (typeof window !== 'undefined') localStorage.setItem('netpulse-finished', JSON.stringify(next));
    set({ finishedProtocols: next });
  },

  recordQuizScore: (protocolId, score) => {
    get().recordActivity();
    const prev = get().quizScores;
    const next = { ...prev, [protocolId]: Math.max(prev[protocolId] ?? 0, score) };
    if (typeof window !== 'undefined') localStorage.setItem('netpulse-quiz-scores', JSON.stringify(next));
    set({ quizScores: next });
  },

  markLabCompleted: (labId) => {
    const next = Array.from(new Set([...get().completedLabs, labId]));
    if (typeof window !== 'undefined') localStorage.setItem('netpulse-completed-labs', JSON.stringify(next));
    set({ completedLabs: next });
  },

  loadLab: (labId) => {
    const lab = PRESET_LABS.find((l) => l.id === labId) ?? PRESET_LABS[0];
    set({
      mode: 'simulator',
      activeLabId: lab.id,
      simDevices: structuredClone(lab.devices),
      simLinks: structuredClone(lab.links),
      selectedDeviceId: lab.devices[0]?.id ?? null,
    });
  },

  setSimTopology: (simDevices, simLinks) => set({ simDevices, simLinks }),
  setSelectedDeviceId: (selectedDeviceId) => set({ selectedDeviceId }),
  setSimSpeed: (simSpeed) => set({ simSpeed }),
  setSimPlaying: (simPlaying) => set({ simPlaying }),

  saveNamedProject: (name) => {
    const proj: SavedLabProject = {
      id: `proj-${Date.now()}`,
      name: name.trim() || 'Untitled Lab',
      savedAt: new Date().toISOString(),
      devices: structuredClone(get().simDevices),
      links: structuredClone(get().simLinks),
    };
    const next = [proj, ...get().savedProjects].slice(0, 20);
    if (typeof window !== 'undefined') localStorage.setItem('netpulse-saved-projects', JSON.stringify(next));
    set({ savedProjects: next });
  },

  loadNamedProject: (id) => {
    const proj = get().savedProjects.find((p) => p.id === id);
    if (!proj) return;
    set({
      simDevices: structuredClone(proj.devices),
      simLinks: structuredClone(proj.links),
      selectedDeviceId: proj.devices[0]?.id ?? null,
    });
  },
}));

onContentLoaded(() => useAppStore.setState((s) => ({ contentVersion: s.contentVersion + 1 })));
