import type { CapturedPacket } from '../engine/types';

export interface DisplayFilterValidation {
  valid: boolean;
  reason?: string;
}

const KNOWN_FIELDS = new Set([
  'ip.addr',
  'ip.src',
  'ip.dst',
  'eth.addr',
  'tcp.port',
  'tcp.srcport',
  'tcp.dstport',
  'udp.port',
  'udp.srcport',
  'udp.dstport',
  'tcp.flags.syn',
  'tcp.flags.ack',
  'tcp.flags.fin',
  'tcp.flags.rst',
  'tcp.flags.psh',
]);

/**
 * Validates Wireshark-like display filter syntax and returns a clear diagnostic if malformed.
 */
export function validateDisplayFilter(rawFilter: string): DisplayFilterValidation {
  const filter = rawFilter.trim();
  if (!filter) return { valid: true };

  // Check unbalanced quotes
  const doubleQuotes = (filter.match(/"/g) || []).length;
  const singleQuotes = (filter.match(/'/g) || []).length;
  if (doubleQuotes % 2 !== 0 || singleQuotes % 2 !== 0) {
    return { valid: false, reason: 'Unclosed quote' };
  }

  // Check leading or trailing logical operators
  if (/^(&&|\|\|)/.test(filter)) {
    return { valid: false, reason: 'Leading logical operator' };
  }
  if (/(&&|\|\|)$/.test(filter)) {
    return { valid: false, reason: 'Trailing logical operator' };
  }

  const orParts = filter.split(/\s*\|\|\s*/);
  for (const orPart of orParts) {
    if (!orPart.trim()) {
      return { valid: false, reason: 'Empty clause around ||' };
    }
    const andParts = orPart.split(/\s*&&\s*/);
    for (const andPart of andParts) {
      let atom = andPart.trim();
      if (!atom) {
        return { valid: false, reason: 'Empty clause around &&' };
      }
      if (atom.startsWith('!')) {
        atom = atom.slice(1).trim();
        if (!atom) {
          return { valid: false, reason: 'Missing expression after !' };
        }
      }

      // Check incomplete single '=' or dangling comparison operator
      if (/^[a-z0-9_.]+\s*(==|!=|\s+eq|\s+ne)\s*$/i.test(atom)) {
        return { valid: false, reason: 'Missing value after operator' };
      }
      if (/^(==|!=|eq\s+|ne\s+)\s*.+$/i.test(atom)) {
        return { valid: false, reason: 'Missing field before operator' };
      }
      if (/^[a-z0-9_.]+\s*=\s*[^=]*$/i.test(atom) && !/==|!=/.test(atom)) {
        return { valid: false, reason: 'Use == or != for comparisons' };
      }

      const cmpMatch = atom.toLowerCase().match(/^([a-z0-9_.]+)(?:\s*(==|!=)\s*|\s+(eq|ne)\s+)(.+)$/);
      if (cmpMatch) {
        const field = cmpMatch[1];
        const rawVal = cmpMatch[4];
        if (!KNOWN_FIELDS.has(field)) {
          return { valid: false, reason: `Unknown field "${field}"` };
        }
        const cleaned = rawVal.replace(/^["']|["']$/g, '').trim();
        if (!cleaned) {
          return { valid: false, reason: `Empty value for ${field}` };
        }
      }
    }
  }

  return { valid: true };
}

/**
 * Evaluates Wireshark-like display filters against a CapturedPacket:
 * Supports:
 *  - protocol names: tcp, udp, dns, http, https, tls, arp, icmp, dhcp, bgp, ssh, etc.
 *  - ip.addr ==/!= x, ip.src ==/!= x, ip.dst ==/!= x, eth.addr ==/!= x
 *  - tcp.port, tcp.srcport, tcp.dstport, udp.port, udp.srcport, udp.dstport
 *  - tcp.flags.syn == 1, tcp.flags.ack == 1, tcp.flags.fin == 1, tcp.flags.rst == 1, tcp.flags.psh == 1
 *  - http.request, http.response
 *  - negation (!) and boolean combinators (&&, ||)
 *  - fallback substring search if not an expression
 */
export function matchesDisplayFilter(pkt: CapturedPacket, rawFilter: string): boolean {
  const filter = rawFilter.trim();
  if (!filter) return true;

  // Split OR expressions at top level
  const orParts = filter.split(/\s*\|\|\s*/);
  if (orParts.length > 1) {
    return orParts.some((part) => matchesDisplayFilter(pkt, part));
  }

  // Split AND expressions
  const andParts = filter.split(/\s*&&\s*/);
  if (andParts.length > 1) {
    return andParts.every((part) => matchesDisplayFilter(pkt, part));
  }

  let expr = andParts[0].trim();
  let negate = false;
  if (expr.startsWith('!')) {
    negate = true;
    expr = expr.slice(1).trim();
  }

  const evalAtom = (atom: string): boolean => {
    const lower = atom.toLowerCase();

    // Comparison check: field == / != / eq / ne value
    const cmpMatch = lower.match(/^([a-z0-9_.]+)(?:\s*(==|!=)\s*|\s+(eq|ne)\s+)(.+)$/);
    if (cmpMatch) {
      const field = cmpMatch[1];
      const op = cmpMatch[2] || cmpMatch[3];
      const rawVal = cmpMatch[4];
      const val = rawVal.replace(/^["']|["']$/g, '').trim();
      const isNegOp = op === '!=' || op === 'ne';

      let matched = false;
      switch (field) {
        case 'ip.addr':
          matched = pkt.srcIp === val || pkt.dstIp === val;
          break;
        case 'ip.src':
          matched = pkt.srcIp === val;
          break;
        case 'ip.dst':
          matched = pkt.dstIp === val;
          break;
        case 'eth.addr':
          matched = pkt.srcMac.toLowerCase() === val || pkt.dstMac.toLowerCase() === val;
          break;
        case 'tcp.port':
          matched =
            pkt.layers.tcp !== undefined &&
            (String(pkt.layers.tcp.srcPort) === val || String(pkt.layers.tcp.dstPort) === val);
          break;
        case 'tcp.srcport':
          matched = pkt.layers.tcp !== undefined && String(pkt.layers.tcp.srcPort) === val;
          break;
        case 'tcp.dstport':
          matched = pkt.layers.tcp !== undefined && String(pkt.layers.tcp.dstPort) === val;
          break;
        case 'udp.port':
          matched =
            pkt.layers.udp !== undefined &&
            (String(pkt.layers.udp.srcPort) === val || String(pkt.layers.udp.dstPort) === val);
          break;
        case 'udp.srcport':
          matched = pkt.layers.udp !== undefined && String(pkt.layers.udp.srcPort) === val;
          break;
        case 'udp.dstport':
          matched = pkt.layers.udp !== undefined && String(pkt.layers.udp.dstPort) === val;
          break;
        case 'tcp.flags.syn':
          matched = Boolean(pkt.layers.tcp?.flags.syn) === (val === '1' || val === 'true');
          break;
        case 'tcp.flags.ack':
          matched = Boolean(pkt.layers.tcp?.flags.ack) === (val === '1' || val === 'true');
          break;
        case 'tcp.flags.fin':
          matched = Boolean(pkt.layers.tcp?.flags.fin) === (val === '1' || val === 'true');
          break;
        case 'tcp.flags.rst':
          matched = Boolean(pkt.layers.tcp?.flags.rst) === (val === '1' || val === 'true');
          break;
        case 'tcp.flags.psh':
          matched = Boolean(pkt.layers.tcp?.flags.psh) === (val === '1' || val === 'true');
          break;
        default:
          matched = pkt.info.toLowerCase().includes(val);
          break;
      }

      return isNegOp ? !matched : matched;
    }

    if (lower === 'http.request') {
      return pkt.protocol.toUpperCase() === 'HTTP' && /^(GET|POST|PUT|DELETE|HEAD|OPTIONS)/i.test(pkt.info);
    }
    if (lower === 'http.response') {
      return pkt.protocol.toUpperCase() === 'HTTP' && /^HTTP\/\d/i.test(pkt.info);
    }
    if (lower === 'tcp') return Boolean(pkt.layers.tcp);
    if (lower === 'udp') return Boolean(pkt.layers.udp);
    if (lower === 'ipv4' || lower === 'ip') return Boolean(pkt.layers.ipv4);
    if (lower === 'ipv6') return Boolean(pkt.layers.ipv6);
    if (lower === 'arp') return Boolean(pkt.layers.arp) || pkt.protocol.toUpperCase() === 'ARP';
    if (lower === 'icmp') return Boolean(pkt.layers.icmp) || pkt.protocol.toUpperCase().includes('ICMP');
    if (lower === 'dns') return Boolean(pkt.layers.dns) || pkt.protocol.toUpperCase().includes('DNS');
    if (lower === 'tls') return Boolean(pkt.layers.tls) || pkt.protocol.toUpperCase() === 'TLS' || pkt.protocol.toUpperCase() === 'HTTPS';

    // Generic protocol / info substring match
    return (
      pkt.protocol.toLowerCase().includes(lower) ||
      pkt.info.toLowerCase().includes(lower) ||
      pkt.srcIp.toLowerCase().includes(lower) ||
      pkt.dstIp.toLowerCase().includes(lower)
    );
  };

  const res = evalAtom(expr);
  return negate ? !res : res;
}
