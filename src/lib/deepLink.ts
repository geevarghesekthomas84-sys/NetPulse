import LZString from 'lz-string';

export interface ExploreDeepLink {
  mode?: 'explore' | 'simulator' | 'learn';
  protocol?: string;
  step?: number;
  speed?: number;
  view?: 'network' | 'sequence';
  theme?: 'dark' | 'light';
  sim?: string;
}

export function encodeExploreHash(state: ExploreDeepLink): string {
  const params = new URLSearchParams();
  if (state.mode) params.set('m', state.mode);
  if (state.protocol) params.set('p', state.protocol);
  if (state.step !== undefined) params.set('s', String(state.step));
  if (state.speed !== undefined) params.set('sp', String(state.speed));
  if (state.view) params.set('v', state.view);
  if (state.theme) params.set('t', state.theme);
  if (state.sim) params.set('sim', state.sim);
  return `#${params.toString()}`;
}

export function decodeExploreHash(hash: string): ExploreDeepLink {
  const clean = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!clean) return {};
  // Support both key=val and legacy explore/http format
  if (clean.startsWith('explore/')) {
    return { mode: 'explore', protocol: clean.replace('explore/', '') };
  }
  if (clean === 'simulator' || clean === 'learn') {
    return { mode: clean };
  }
  const params = new URLSearchParams(clean);
  const res: ExploreDeepLink = {};
  const m = params.get('m');
  if (m === 'explore' || m === 'simulator' || m === 'learn') res.mode = m;
  const p = params.get('p');
  if (p) res.protocol = p;
  const s = params.get('s');
  if (s && !Number.isNaN(Number(s))) res.step = Number(s);
  const sp = params.get('sp');
  if (sp && !Number.isNaN(Number(sp))) res.speed = Number(sp);
  const v = params.get('v');
  if (v === 'network' || v === 'sequence') res.view = v;
  const t = params.get('t');
  if (t === 'dark' || t === 'light') res.theme = t;
  const sim = params.get('sim');
  if (sim) res.sim = sim;
  return res;
}

export function compressTopology(obj: unknown): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(obj));
}

export function decompressTopology<T>(encoded: string): T | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
