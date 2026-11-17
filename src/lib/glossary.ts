export interface GlossaryEntry {
  term: string;
  fullName: string;
  definition: string;
  layer?: number;
  rfc?: string;
}

export const GLOSSARY_DICTIONARY: Record<string, GlossaryEntry> = {
  TTL: {
    term: 'TTL',
    fullName: 'Time To Live',
    definition: 'An 8-bit hop counter in the IPv4 header (Hop Limit in IPv6) decremented by every router. Prevents packets from circulating indefinitely and powers traceroute.',
    layer: 3,
    rfc: 'RFC 791',
  },
  SYN: {
    term: 'SYN',
    fullName: 'Synchronize Sequence Numbers',
    definition: 'A 1-bit TCP control flag used during the 3-way handshake to initiate a connection and synchronize initial sequence numbers (ISN).',
    layer: 4,
    rfc: 'RFC 9293',
  },
  ACK: {
    term: 'ACK',
    fullName: 'Acknowledgment',
    definition: 'A TCP control flag confirming receipt of bytes up to the sequence number specified in the Acknowledgment Number field.',
    layer: 4,
    rfc: 'RFC 9293',
  },
  FIN: {
    term: 'FIN',
    fullName: 'Finish',
    definition: 'A TCP control flag used to gracefully close a connection direction, indicating the sender has no more data to transmit.',
    layer: 4,
    rfc: 'RFC 9293',
  },
  RST: {
    term: 'RST',
    fullName: 'Reset',
    definition: 'A TCP control flag sent to abruptly abort a connection, reject an invalid segment, or refuse an incoming connection on a closed port.',
    layer: 4,
    rfc: 'RFC 9293',
  },
  MTU: {
    term: 'MTU',
    fullName: 'Maximum Transmission Unit',
    definition: 'The largest packet size (typically 1500 bytes on standard Ethernet) that a network layer protocol can transmit over a physical medium without fragmentation.',
    layer: 2,
    rfc: 'RFC 894',
  },
  MSS: {
    term: 'MSS',
    fullName: 'Maximum Segment Size',
    definition: 'The largest amount of data, in bytes, that a computer can receive in a single TCP segment (typically MTU - 40 bytes IP/TCP headers = 1460 bytes).',
    layer: 4,
    rfc: 'RFC 879',
  },
  RTT: {
    term: 'RTT',
    fullName: 'Round-Trip Time',
    definition: 'The elapsed time taken for a data packet to travel from sender to destination plus the time for the acknowledgment to travel back.',
    layer: 4,
    rfc: 'RFC 6298',
  },
  NAT: {
    term: 'NAT',
    fullName: 'Network Address Translation',
    definition: 'A method of remapping an entire IP address space into another by modifying network address information in the IP packet header while in transit.',
    layer: 3,
    rfc: 'RFC 3022',
  },
  PAT: {
    term: 'PAT',
    fullName: 'Port Address Translation (NAPT)',
    definition: 'An extension to NAT where multiple private IP hosts share a single public IP address by assigning unique Layer-4 port numbers to each outbound connection.',
    layer: 4,
    rfc: 'RFC 3022',
  },
  CIDR: {
    term: 'CIDR',
    fullName: 'Classless Inter-Domain Routing',
    definition: 'A method for allocating IP addresses and IP routing using slash notation (e.g., 192.168.1.0/24), replacing obsolete Class A, B, and C networks.',
    layer: 3,
    rfc: 'RFC 4632',
  },
  ARP: {
    term: 'ARP',
    fullName: 'Address Resolution Protocol',
    definition: 'A communication protocol used for discovering the Layer-2 link layer address (such as a MAC address) associated with a given Layer-3 IPv4 address.',
    layer: 2,
    rfc: 'RFC 826',
  },
  MAC: {
    term: 'MAC',
    fullName: 'Media Access Control Address',
    definition: 'A unique 48-bit hardware identifier permanently assigned to a Network Interface Card (NIC) by manufacturer (e.g. 00:1A:2B:3C:4D:5E).',
    layer: 2,
    rfc: 'IEEE 802',
  },
  DNS: {
    term: 'DNS',
    fullName: 'Domain Name System',
    definition: 'The hierarchical and decentralized naming system that translates human-friendly domain names (like example.com) into numerical IP addresses.',
    layer: 7,
    rfc: 'RFC 1035',
  },
  DHCP: {
    term: 'DHCP',
    fullName: 'Dynamic Host Configuration Protocol',
    definition: 'A network management protocol used on UDP/IP networks to automatically assign IP addresses, subnet masks, default gateways, and DNS servers.',
    layer: 7,
    rfc: 'RFC 2131',
  },
  TLS: {
    term: 'TLS',
    fullName: 'Transport Layer Security',
    definition: 'A cryptographic protocol designed to provide end-to-end communications security, encryption, and data integrity over computer networks.',
    layer: 6,
    rfc: 'RFC 8446',
  },
  BGP: {
    term: 'BGP',
    fullName: 'Border Gateway Protocol',
    definition: 'The de facto exterior gateway routing protocol of the global Internet, exchanging reachability and Autonomous System (AS) path vectors.',
    layer: 7,
    rfc: 'RFC 4271',
  },
  OSPF: {
    term: 'OSPF',
    fullName: 'Open Shortest Path First',
    definition: 'An interior link-state routing protocol using Dijkstra’s shortest-path algorithm to compute optimal loop-free routes within an autonomous system.',
    layer: 3,
    rfc: 'RFC 2328',
  },
  ICMP: {
    term: 'ICMP',
    fullName: 'Internet Control Message Protocol',
    definition: 'A network layer supporting protocol used by routers and hosts to send error messages and operational information (e.g., ping Echo, TTL expired).',
    layer: 3,
    rfc: 'RFC 792',
  },
  CWND: {
    term: 'CWND',
    fullName: 'Congestion Window',
    definition: 'A TCP state variable limiting the total number of unacknowledged bytes a sender may transmit into the network before receiving an ACK.',
    layer: 4,
    rfc: 'RFC 5681',
  },
  VLAN: {
    term: 'VLAN',
    fullName: 'Virtual Local Area Network',
    definition: 'A broadcast domain partitioned and isolated in a computer network at the data link layer (IEEE 802.1Q) allowing multiple logical networks over one switch.',
    layer: 2,
    rfc: 'IEEE 802.1Q',
  },
  STP: {
    term: 'STP',
    fullName: 'Spanning Tree Protocol',
    definition: 'A Layer-2 network protocol (IEEE 802.1D) that prevents catastrophic broadcast loops and bridge storms by creating a logical loop-free tree topology.',
    layer: 2,
    rfc: 'IEEE 802.1D',
  },
  SNI: {
    term: 'SNI',
    fullName: 'Server Name Indication',
    definition: 'A TLS extension by which a client indicates the hostname of the server it is attempting to connect to at the start of the handshake.',
    layer: 6,
    rfc: 'RFC 6066',
  },
  ALPN: {
    term: 'ALPN',
    fullName: 'Application-Layer Protocol Negotiation',
    definition: 'A TLS extension allowing client and server to negotiate the application protocol (e.g., http/1.1, h2, h3) within the TLS handshake without an extra RTT.',
    layer: 6,
    rfc: 'RFC 7301',
  },
  QUIC: {
    term: 'QUIC',
    fullName: 'Quick UDP Internet Connections',
    definition: 'A modern transport layer network protocol designed by Google, operating on top of UDP with built-in TLS 1.3 encryption, 0-RTT, and multiplexing (HTTP/3).',
    layer: 4,
    rfc: 'RFC 9000',
  },
};

/**
 * Searches text for known networking acronyms and returns structured tokens
 * for rendering interactive tooltip pills.
 */
export function parseGlossaryTokens(text: string): Array<{ isTerm: boolean; text: string; entry?: GlossaryEntry }> {
  if (!text) return [];

  // Match whole-word acronyms that exist in our dictionary
  const keys = Object.keys(GLOSSARY_DICTIONARY).sort((a, b) => b.length - a.length);
  const regex = new RegExp(`\\b(${keys.join('|')})\\b`, 'g');

  const tokens: Array<{ isTerm: boolean; text: string; entry?: GlossaryEntry }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ isTerm: false, text: text.slice(lastIndex, match.index) });
    }
    const termKey = match[1].toUpperCase();
    tokens.push({
      isTerm: true,
      text: match[1],
      entry: GLOSSARY_DICTIONARY[termKey],
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({ isTerm: false, text: text.slice(lastIndex) });
  }

  return tokens;
}
