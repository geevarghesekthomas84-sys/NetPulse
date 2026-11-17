export interface ProtocolRecap {
  bullets: [string, string, string];
  nextProtocolId: string;
  nextProtocolName: string;
}

export const PROTOCOL_RECAPS: Record<string, ProtocolRecap> = {
  http: {
    bullets: [
      'Client initiated an HTTP GET request with Host and User-Agent headers.',
      'Server processed the request and responded with HTTP/1.1 200 OK and payload.',
      'Stateless request-response completed, paving the way for DNS resolution analysis.',
    ],
    nextProtocolId: 'dns',
    nextProtocolName: 'DNS (Domain Name System)',
  },
  dns: {
    bullets: [
      'Client queried the local resolver via UDP Port 53 for an A/AAAA record.',
      'Recursive resolver traversed root and authoritative nameservers to resolve the IP.',
      'Client received the IP address with a caching TTL to initiate transport connections.',
    ],
    nextProtocolId: 'tcp',
    nextProtocolName: 'TCP (Transmission Control)',
  },
  tcp: {
    bullets: [
      'Client sent SYN to initiate connection; Server replied with SYN-ACK.',
      'Client completed 3-Way Handshake with ACK, establishing a reliable bidirectional byte stream.',
      'Sequence numbers, acknowledgment numbers, and receive windows now track all data delivery.',
    ],
    nextProtocolId: 'tls',
    nextProtocolName: 'TLS (Transport Layer Security)',
  },
  tls: {
    bullets: [
      'Client and server negotiated TLS 1.3 cipher suites via ClientHello and ServerHello.',
      'Server presented its X.509 certificate and authenticated public key exchange.',
      'Symmetric session keys derived, securing application traffic against eavesdropping and tampering.',
    ],
    nextProtocolId: 'http2',
    nextProtocolName: 'HTTP/2 (Multiplexed Streams)',
  },
  arp: {
    bullets: [
      'Sender broadcasted "Who has IP X.X.X.X? Tell sender MAC" over Layer 2.',
      'Target device answered with a unicast ARP reply containing its physical MAC address.',
      'Both hosts updated their local ARP cache tables to bridge Layer 3 to Layer 2.',
    ],
    nextProtocolId: 'dhcp',
    nextProtocolName: 'DHCP (Dynamic Host Config)',
  },
  dhcp: {
    bullets: [
      'Client broadcasted DHCP Discover; Server offered available lease (DORA process).',
      'Client requested the offered lease parameters including subnet mask, gateway, and DNS.',
      'Server acknowledged with DHCP ACK, binding the IP address configuration.',
    ],
    nextProtocolId: 'dns',
    nextProtocolName: 'DNS (Domain Name System)',
  },
  icmp: {
    bullets: [
      'Host transmitted ICMP Echo Request (Type 8) to verify end-to-end reachability.',
      'Intermediate routers forwarded the datagram without modifying protocol payload.',
      'Target replied with ICMP Echo Reply (Type 0), reporting round-trip latency (RTT).',
    ],
    nextProtocolId: 'bgp',
    nextProtocolName: 'BGP (Border Gateway Protocol)',
  },
  bgp: {
    bullets: [
      'Autonomous Systems exchanged OPEN messages and established TCP port 179 peering.',
      'Path-vector UPDATE messages announced reachability prefixes and AS_PATH attributes.',
      'KEEPALIVE messages maintain topology stability across global inter-domain routes.',
    ],
    nextProtocolId: 'ospf',
    nextProtocolName: 'OSPF (Open Shortest Path First)',
  },
  websocket: {
    bullets: [
      'Client requested HTTP 101 Switching Protocols with Upgrade: websocket header.',
      'Server acknowledged handshake, transforming the socket into full-duplex framing.',
      'Bi-directional messages flow with minimal 2-byte framing overhead without HTTP polling.',
    ],
    nextProtocolId: 'webrtc',
    nextProtocolName: 'WebRTC (Peer-to-Peer Real-Time)',
  },
};

export function getProtocolRecap(id: string, name: string): ProtocolRecap {
  if (PROTOCOL_RECAPS[id]) {
    return PROTOCOL_RECAPS[id];
  }
  return {
    bullets: [
      `Initiated ${name} protocol exchange and negotiated transport parameters.`,
      'Transmitted headers, payloads, and control signaling across the network topology.',
      'State transition completed successfully with verified delivery and acknowledgment.',
    ],
    nextProtocolId: 'tcp',
    nextProtocolName: 'TCP',
  };
}
