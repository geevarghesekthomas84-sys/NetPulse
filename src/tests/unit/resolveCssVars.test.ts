// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { resolveCssVars } from '../../lib/resolveCssVars';

describe('resolveCssVars', () => {
  it('inlines theme variables so exported SVGs keep their colors', () => {
    document.documentElement.style.setProperty('--pkt-dns', '#7c4dbd');
    const out = resolveCssVars('<path stroke="var(--pkt-dns)" fill="var(--missing, #123456)"/>');
    expect(out).toContain('stroke="#7c4dbd"');
    expect(out).toContain('fill="#123456"');
    expect(out).not.toContain('var(');
  });
});
