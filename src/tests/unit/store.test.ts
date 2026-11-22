// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '../../store/useAppStore';

describe('Zustand AppStore State & Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().setTheme('light');
    useAppStore.getState().setExperienceLevel('simple');
    useAppStore.getState().reopenWelcome();
    useAppStore.getState().setLanguage('en');
    useAppStore.getState().resetWhatIf();
  });

  it('defaults to Crisp Daylight light theme and Simple mode, and switches themes/experience cleanly', () => {
    const s0 = useAppStore.getState();
    expect(s0.theme).toBe('light');
    expect(s0.experienceLevel).toBe('simple');
    expect(s0.welcomeDismissed).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    s0.toggleTheme();
    expect(useAppStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    s0.toggleTheme();
    expect(useAppStore.getState().theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    s0.toggleExperienceLevel();
    expect(useAppStore.getState().experienceLevel).toBe('pro');
    expect(localStorage.getItem('netpulse-experience')).toBe('pro');
    s0.setExperienceLevel('simple');
    expect(useAppStore.getState().experienceLevel).toBe('simple');

    s0.dismissWelcome();
    expect(useAppStore.getState().welcomeDismissed).toBe(true);
    expect(localStorage.getItem('netpulse-welcome-dismissed')).toBe('true');
    s0.reopenWelcome();
    expect(useAppStore.getState().welcomeDismissed).toBe(false);
  });

  it('toggles themes, languages, and Explore protocol playback state cleanly', () => {
    const store = useAppStore.getState();
    store.setTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    store.toggleTheme();
    expect(useAppStore.getState().theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    store.setLanguage('ar');
    expect(useAppStore.getState().language).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    store.setLanguage('es');
    expect(document.documentElement.dir).toBe('ltr');
    store.setLanguage('en');

    store.selectProtocol('tls', 2);
    const s2 = useAppStore.getState();
    expect(s2.mode).toBe('explore');
    expect(s2.activeProtocolId).toBe('tls');
    expect(s2.currentStepIndex).toBe(2);
    expect(s2.recentlyViewed[0]).toBe('tls');
    expect(s2.viewedProtocols).toContain('tls');

    store.toggleWhatIf('packetLoss');
    expect(useAppStore.getState().whatIfOptions.packetLoss).toBe(true);
    expect(useAppStore.getState().currentPacketIndex).toBe(0);
    store.resetWhatIf();
    expect(useAppStore.getState().whatIfOptions).toEqual({});
  });

  it('records best quiz score, completed labs, favorites, and isolates cloned lab topologies', () => {
    const store = useAppStore.getState();
    store.recordQuizScore('http', 60);
    store.recordQuizScore('http', 40);
    expect(useAppStore.getState().quizScores.http).toBe(60);
    store.recordQuizScore('http', 100);
    expect(useAppStore.getState().quizScores.http).toBe(100);

    store.markLabCompleted('lab-1-home');
    store.markLabCompleted('lab-1-home');
    expect(useAppStore.getState().completedLabs.filter((x) => x === 'lab-1-home')).toHaveLength(1);

    const hadDns = useAppStore.getState().favorites.includes('dns');
    store.toggleFavorite('dns');
    expect(useAppStore.getState().favorites.includes('dns')).toBe(!hadDns);

    store.loadLab('lab-7-firewall-dmz');
    expect(useAppStore.getState().mode).toBe('simulator');
    expect(useAppStore.getState().activeLabId).toBe('lab-7-firewall-dmz');

    store.saveNamedProject('DMZ Test Snap');
    const saved = useAppStore.getState().savedProjects;
    expect(saved[0].name).toBe('DMZ Test Snap');

    store.loadLab('lab-1-home');
    store.loadNamedProject(saved[0].id);
    expect(useAppStore.getState().simDevices.some((d) => d.id === 'dmz')).toBe(true);
  });
});
