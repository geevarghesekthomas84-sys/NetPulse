import { describe, expect, it } from 'vitest';
import { getProtocolRecap, PROTOCOL_RECAPS } from '../../lib/protocolRecaps';

describe('Protocol Recaps', () => {
  it('returns valid 3-bullet recap for core protocols', () => {
    const http = getProtocolRecap('http', 'HTTP');
    expect(http.bullets).toHaveLength(3);
    expect(http.nextProtocolId).toBe('dns');

    const dns = getProtocolRecap('dns', 'DNS');
    expect(dns.bullets).toHaveLength(3);
    expect(dns.nextProtocolId).toBe('tcp');

    const tcp = getProtocolRecap('tcp', 'TCP');
    expect(tcp.bullets).toHaveLength(3);
    expect(tcp.nextProtocolId).toBe('tls');

    const tls = getProtocolRecap('tls', 'TLS');
    expect(tls.bullets).toHaveLength(3);
    expect(tls.nextProtocolId).toBe('http2');
  });

  it('provides sensible fallback for unlisted protocol', () => {
    const custom = getProtocolRecap('custom-proto', 'Custom Protocol');
    expect(custom.bullets).toHaveLength(3);
    expect(custom.bullets[0]).toContain('Custom Protocol');
    expect(custom.nextProtocolId).toBe('tcp');
  });
});
