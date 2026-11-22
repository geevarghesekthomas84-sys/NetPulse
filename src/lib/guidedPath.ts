import { PROTOCOLS } from '../protocols';

/** The recommended first lessons, in order. */
export const GUIDED_PATH = ['http', 'dns', 'tcp', 'tls'] as const;

/**
 * Picks what to suggest after `currentId`: the next unfinished step of the
 * guided path if there is one, otherwise the next protocol in the library.
 */
export function nextSuggestion(currentId: string, finished: string[]): { id: string; fromPath: boolean } | null {
  const pending = GUIDED_PATH.filter((id) => !finished.includes(id) && id !== currentId);
  if (pending.length > 0) return { id: pending[0], fromPath: true };
  const idx = PROTOCOLS.findIndex((p) => p.id === currentId);
  const next = PROTOCOLS[(idx + 1) % PROTOCOLS.length];
  return next ? { id: next.id, fromPath: false } : null;
}
