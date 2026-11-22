// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Gloss } from '../../components/common/Gloss';
import { GUIDED_PATH, nextSuggestion } from '../../lib/guidedPath';

describe('Gloss', () => {
  afterEach(cleanup);

  it('turns known terms into tooltips and leaves other text alone', () => {
    render(<Gloss text="The router lowers the TTL and checks the MTU." />);
    expect(screen.getAllByRole('tooltip').length).toBe(2);
    expect(screen.getAllByText('TTL').length).toBeGreaterThanOrEqual(1);
    expect(document.body.textContent).toContain('The router lowers the');
  });

  it('does not match terms inside longer words', () => {
    render(<Gloss text="ATTLEMENT SYNTAX" />);
    expect(screen.queryAllByRole('tooltip').length).toBe(0);
  });
});

describe('guided path', () => {
  it('suggests the next unfinished lesson, then falls back to the library order', () => {
    expect(nextSuggestion('http', [])?.id).toBe('dns');
    expect(nextSuggestion('dns', ['http', 'dns'])?.id).toBe('tcp');
    const allDone = [...GUIDED_PATH];
    const after = nextSuggestion('tls', allDone);
    expect(after?.fromPath).toBe(false);
    expect(after?.id).not.toBe('tls');
  });
});
