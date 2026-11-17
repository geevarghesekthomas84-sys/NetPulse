import { create } from 'zustand';
import i18n, { LANGUAGES } from '../i18n';
import { getProtocolById } from '../protocols';
import type { ScenarioOptions } from '../protocols/types';
import { PRESET_LABS } from '../simulator/labs';
import type { CapturedPacket, SimDevice, SimLink } from '../engine/types';
import { playPacketBlip } from '../lib/sound';

export interface WrongQuestion {
  protocolId: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface DailyStreakData {
  current: number;
  lastDate: string;
  longest: number;
}

export type AppMode = 'explore' | 'simulator' | 'learn';
export type ExploreView = 'network' | 'sequence';
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
  mode: AppMode;
  experienceLevel: ExperienceLevel;
  welcomeDismissed: boolean;
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

  // Learn progress & Daily practice
  viewedProtocols: string[];
  completedLabs: string[];
  quizScores: Record<string, number>;
  dailyStreak: DailyStreakData;
  wrongQuizQuestions: WrongQuestion[];
  customPcapPackets: CapturedPacket[] | null;
  guidedTrackDismissed: boolean;

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

  recordQuizScore: (protocolId: string, score: number) => void;
  markLabCompleted: (labId: string) => void;
  updateDailyStreak: () => void;
  recordWrongQuizQuestion: (q: WrongQuestion) => void;
  clearWrongQuizQuestion: (question: string) => void;
  setCustomPcapPackets: (packets: CapturedPacket[] | null) => void;
  setGuidedTrackDismissed: (dismissed: boolean) => void;

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
  typeof window !== 'undefined' && localStorage.getItem('gg-theme') === 'dark' ? 'dark' : 'light';

const initialExperience: ExperienceLevel =
  typeof window !== 'undefined' && localStorage.getItem('gg-experience') === 'pro' ? 'pro' : 'simple';

const initialWelcomeDismissed: boolean =
  typeof window !== 'undefined' && localStorage.getItem('gg-entry-v2-dismissed') === 'true';

const defaultLab = PRESET_LABS[0];

export const useAppStore = create<AppState>((set, get) => ({
  theme: initialTheme,
  language: typeof window !== 'undefined' ? localStorage.getItem('gg-lang') || 'en' : 'en',
  mode: 'explore',
  experienceLevel: initialExperience,
  welcomeDismissed: initialWelcomeDismissed,
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

  favorites: loadJson<string[]>('gg-favorites', ['http', 'dns', 'tcp', 'tls']),
  recentlyViewed: loadJson<string[]>('gg-recent', ['http', 'dns', 'tcp']),

  settingsOpen: false,
  aboutOpen: false,
  commandPaletteOpen: false,
  tourOpen: false,
  settings: loadJson<AppSettings>('gg-settings', {
    animationsEnabled: true,
    packetScale: 1,
    showMacAddresses: false,
    showHexByDefault: true,
    timeFormat: 'relative',
    soundEffects: false,
    defaultSeed: 42,
  }),

  viewedProtocols: loadJson<string[]>('gg-viewed', ['http']),
  completedLabs: loadJson<string[]>('gg-completed-labs', []),
  quizScores: loadJson<Record<string, number>>('gg-quiz-scores', {}),
  dailyStreak: loadJson<DailyStreakData>('netpulse-streak', { current: 1, lastDate: '', longest: 1 }),
  wrongQuizQuestions: loadJson<WrongQuestion[]>('netpulse-wrong-quiz', []),
  customPcapPackets: null,
  guidedTrackDismissed: loadJson<boolean>('netpulse-guided-dismissed', false),

  simDevices: structuredClone(defaultLab.devices),
  simLinks: structuredClone(defaultLab.links),
  activeLabId: defaultLab.id,
  simSpeed: 1,
  simPlaying: false,
  selectedDeviceId: defaultLab.devices[0]?.id ?? null,
  savedProjects: loadJson<SavedLabProject[]>('gg-saved-projects', []),

  setTheme: (theme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      localStorage.setItem('gg-theme', theme);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute('content', theme === 'dark' ? '#08111e' : '#f6f8fb');
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
      localStorage.setItem('gg-experience', experienceLevel);
    }
    set({ experienceLevel });
  },

  toggleExperienceLevel: () => {
    const next = get().experienceLevel === 'simple' ? 'pro' : 'simple';
    get().setExperienceLevel(next);
  },

  dismissWelcome: () => {
    if (typeof window !== 'undefined') localStorage.setItem('gg-entry-v2-dismissed', 'true');
    set({ welcomeDismissed: true });
  },

  reopenWelcome: () => {
    if (typeof window !== 'undefined') localStorage.setItem('gg-entry-v2-dismissed', 'false');
    set({ welcomeDismissed: false });
  },

  setLanguage: (lang) => {
    void i18n.changeLanguage(lang);
    const meta = LANGUAGES.find((l) => l.code === lang);
    if (typeof document !== 'undefined') {
      document.documentElement.dir = meta?.dir ?? 'ltr';
      document.documentElement.lang = lang;
      localStorage.setItem('gg-lang', lang);
    }
    set({ language: lang });
  },

  setMode: (mode) => set({ mode }),
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  setDrawerCategory: (drawerCategory) => set({ drawerCategory }),

  selectProtocol: (id, stepIndex = 0) => {
    const proto = getProtocolById(id);
    const recent = [proto.id, ...get().recentlyViewed.filter((x) => x !== proto.id)].slice(0, 6);
    const viewed = Array.from(new Set([...get().viewedProtocols, proto.id]));
    if (typeof window !== 'undefined') {
      localStorage.setItem('gg-recent', JSON.stringify(recent));
      localStorage.setItem('gg-viewed', JSON.stringify(viewed));
      document.title = `${proto.name} (${proto.fullName}) – NetPulse`;
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
    if (typeof window !== 'undefined') localStorage.setItem('gg-favorites', JSON.stringify(next));
    set({ favorites: next });
  },

  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setAboutOpen: (aboutOpen) => set({ aboutOpen }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setTourOpen: (tourOpen) => set({ tourOpen }),

  updateSettings: (partial) => {
    const next = { ...get().settings, ...partial };
    if (typeof window !== 'undefined') localStorage.setItem('gg-settings', JSON.stringify(next));
    set({ settings: next });
  },

  recordQuizScore: (protocolId, score) => {
    const prev = get().quizScores;
    const next = { ...prev, [protocolId]: Math.max(prev[protocolId] ?? 0, score) };
    if (typeof window !== 'undefined') localStorage.setItem('gg-quiz-scores', JSON.stringify(next));
    set({ quizScores: next });
  },

  markLabCompleted: (labId) => {
    const next = Array.from(new Set([...get().completedLabs, labId]));
    if (typeof window !== 'undefined') localStorage.setItem('gg-completed-labs', JSON.stringify(next));
    set({ completedLabs: next });
  },

  updateDailyStreak: () => {
    const today = new Date().toISOString().slice(0, 10);
    const { current, lastDate, longest } = get().dailyStreak;
    if (lastDate === today) return;

    let nextCurrent = 1;
    if (lastDate) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (lastDate === yesterday) {
        nextCurrent = current + 1;
      }
    }
    const nextLongest = Math.max(longest, nextCurrent);
    const updated = { current: nextCurrent, lastDate: today, longest: nextLongest };
    if (typeof window !== 'undefined') localStorage.setItem('netpulse-streak', JSON.stringify(updated));
    set({ dailyStreak: updated });
  },

  recordWrongQuizQuestion: (q) => {
    const prev = get().wrongQuizQuestions;
    const exists = prev.some((item) => item.question === q.question);
    if (!exists) {
      const next = [q, ...prev].slice(0, 30);
      if (typeof window !== 'undefined') localStorage.setItem('netpulse-wrong-quiz', JSON.stringify(next));
      set({ wrongQuizQuestions: next });
    }
  },

  clearWrongQuizQuestion: (question) => {
    const next = get().wrongQuizQuestions.filter((q) => q.question !== question);
    if (typeof window !== 'undefined') localStorage.setItem('netpulse-wrong-quiz', JSON.stringify(next));
    set({ wrongQuizQuestions: next });
  },

  setCustomPcapPackets: (customPcapPackets) => set({ customPcapPackets }),

  setGuidedTrackDismissed: (guidedTrackDismissed) => {
    if (typeof window !== 'undefined') localStorage.setItem('netpulse-guided-dismissed', JSON.stringify(guidedTrackDismissed));
    set({ guidedTrackDismissed });
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
    if (typeof window !== 'undefined') localStorage.setItem('gg-saved-projects', JSON.stringify(next));
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
