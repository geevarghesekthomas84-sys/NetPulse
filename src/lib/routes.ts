/**
 * Real, crawlable URLs for the app. Each protocol has its own path (/explore/dns/) so search engines
 * can index it; the build step (scripts/prerender.mjs) writes a static HTML page for every one of them.
 */
export const SITE_URL = 'https://netpulse.itgg.space';

export type AppPage = 'landing' | 'explore' | 'simulator' | 'learn';

export interface RouteState {
  page: AppPage | 'protocols' | 'about';
  protocol?: string;
}

/** Reads a pathname such as `/explore/dns/` into app state; null when it is not one of ours. */
export function parsePath(pathname: string): RouteState | null {
  const parts = pathname.replace(/\/index\.html$/, '').split('/').filter(Boolean);
  if (parts.length === 0) return { page: 'landing' };
  if (parts[0] === 'explore') return parts[1] ? { page: 'explore', protocol: decodeURIComponent(parts[1]) } : { page: 'explore' };
  if (parts[0] === 'simulator') return { page: 'simulator' };
  if (parts[0] === 'learn') return { page: 'learn' };
  if (parts[0] === 'protocols') return { page: 'protocols' };
  if (parts[0] === 'about') return { page: 'about' };
  return null;
}

/** The URL path for the current app state. Always ends in a slash, matching the prerendered folders. */
export function pathFor(page: AppPage, protocol?: string): string {
  switch (page) {
    case 'landing':
      return '/';
    case 'explore':
      return protocol ? `/explore/${encodeURIComponent(protocol)}/` : '/explore/';
    case 'simulator':
      return '/simulator/';
    case 'learn':
      return '/learn/';
  }
}
