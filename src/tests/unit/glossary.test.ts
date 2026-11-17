import { describe, expect, it } from 'vitest';
import { GLOSSARY_DICTIONARY, parseGlossaryTokens } from '../../lib/glossary';

describe('Glossary Tooltips', () => {
  it('contains essential networking terms', () => {
    expect(GLOSSARY_DICTIONARY.TTL).toBeDefined();
    expect(GLOSSARY_DICTIONARY.SYN).toBeDefined();
    expect(GLOSSARY_DICTIONARY.MTU).toBeDefined();
    expect(GLOSSARY_DICTIONARY.MSS).toBeDefined();
    expect(GLOSSARY_DICTIONARY.ACK).toBeDefined();
  });

  it('correctly tokenizes string containing acronyms', () => {
    const text = 'Host sends a SYN packet with MTU 1500 to server.';
    const tokens = parseGlossaryTokens(text);

    const synToken = tokens.find((t) => t.isTerm && t.text === 'SYN');
    expect(synToken).toBeDefined();
    expect(synToken?.entry?.fullName).toBe('Synchronize Sequence Numbers');

    const mtuToken = tokens.find((t) => t.isTerm && t.text === 'MTU');
    expect(mtuToken).toBeDefined();
    expect(mtuToken?.entry?.layer).toBe(2);
  });
});
