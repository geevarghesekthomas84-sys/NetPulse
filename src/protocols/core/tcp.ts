import { buildEngineFromNodes } from '../helpers';
import type { ProtocolEntry, ProtocolLinkDef, ProtocolNodeDef, ProtocolStepDef } from '../types';

const nodes: ProtocolNodeDef[] = [
  { id: 'client', label: 'Client', ip: '192.168.1.10', role: 'host', x: 160, y: 250, mac: '02:42:ac:11:00:10' },
  { id: 'router', label: 'ISP Router', ip: '192.168.1.1', role: 'router', x: 500, y: 250, mac: '02:42:ac:11:00:01' },
  { id: 'server', label: 'Web Server', ip: '203.0.113.10', role: 'web_server', x: 840, y: 250, mac: '02:42:ac:11:00:80', openPorts: [80, 443] },
];

const links: ProtocolLinkDef[] = [
  { id: 'l1', sourceId: 'client', targetId: 'router', delayMs: 8, bandwidthMbps: 100 },
  { id: 'l2', sourceId: 'router', targetId: 'server', delayMs: 14, bandwidthMbps: 100 },
];

const steps: ProtocolStepDef[] = [
  { title: '3-Way Handshake', subtitle: 'SYN -> SYN-ACK -> ACK (Seq/Ack sync)', caption: 'Client and Server exchange initial sequence numbers (ISN) and negotiate MSS=1460.', osiLayer: 4 },
  { title: 'Slow Start', subtitle: 'cwnd grows exponentially (2 -> 4 -> 8 MSS)', caption: 'Congestion window doubles each RTT while cwnd < ssthresh.', osiLayer: 4 },
  { title: 'Loss & Recovery', subtitle: 'Segment loss triggers Reno/CUBIC backoff', caption: 'Simulated loss or congestion reduces ssthresh and triggers fast retransmit / RTO recovery.', osiLayer: 4 },
  { title: 'Congestion Avoidance', subtitle: 'Linear AIMD growth after ssthresh', caption: 'TCP probes bandwidth cautiously (+1 MSS per RTT) to avoid saturating queues.', osiLayer: 4 },
  { title: '4-Way Teardown', subtitle: 'FIN-ACK -> FIN-ACK -> TIME_WAIT', caption: 'Both sides cleanly close their half-duplex byte streams with FIN and final ACK.', osiLayer: 4 },
];

export const tcpProtocol: ProtocolEntry = {
  id: 'tcp',
  name: 'TCP',
  fullName: 'Transmission Control Protocol',
  category: 'CORE',
  status: 'full',
  layer: 'Layer 4 (Transport) / TCP-IP Transport',
  osiLayer: 4,
  defaultPort: 'N/A (Uses Ports 0–65535)',
  transport: 'Runs directly over IPv4 (Proto 6) / IPv6',
  dataFormat: '20–60 Byte Header + Byte Stream Segments',
  methods: ['SYN', 'SYN-ACK', 'ACK', 'PSH-ACK', 'FIN-ACK', 'RST'],
  rfcs: [
    { number: 'RFC 9293', title: 'Transmission Control Protocol (TCP)', url: 'https://www.rfc-editor.org/rfc/rfc9293' },
    { number: 'RFC 5681', title: 'TCP Congestion Control', url: 'https://www.rfc-editor.org/rfc/rfc5681' },
  ],
  keywords: ['handshake', 'syn', 'ack', 'fin', 'rst', 'cwnd', 'congestion', 'reno', 'cubic', 'retransmit', 'sliding window'],
  description:
    'TCP provides reliable, ordered, congestion-controlled byte-stream delivery over unreliable IP networks using sequence numbers, acknowledgments, sliding windows, and adaptive congestion control.',
  eli5: 'TCP is like a registered phone call: first both say "Can you hear me? / Yes, can you hear me? / Yes!" then number every sentence and repeat any part that broke up.',
  securityNotes: [
    {
      attack: 'SYN Flood DoS',
      description: 'Attackers send millions of forged SYN packets without completing the handshake, exhausting the server’s SYN_RCVD backlog.',
      defense: 'Enable SYN Cookies so the server encodes state into the ISN instead of allocating memory.',
    },
    {
      attack: 'TCP RST Injection',
      description: 'On-path or blind attackers inject forged RST segments matching the 4-tuple and sequence window to kill connections.',
      defense: 'Encrypt sessions with TLS or IPsec and use strict RFC 5961 challenge ACKs.',
    },
  ],
  nodes,
  links,
  steps,
  whatIfOptions: [
    { id: 'packetLoss', label: 'Inject Segment Loss', description: 'Trigger RTO timeout & cwnd drop to 1 MSS' },
    { id: 'portClosed', label: 'Port Closed (RST)', description: 'Server rejects SYN with immediate TCP RST' },
    { id: 'smallMtu', label: 'Small MTU (576 B)', description: 'Negotiate smaller MSS=536 during SYN' },
  ],
  quiz: [
    {
      question: 'Which flags are set in the second packet of a TCP 3-way handshake?',
      options: ['SYN only', 'SYN and ACK', 'ACK and PSH', 'FIN and ACK'],
      correctIndex: 1,
      explanation: 'The server replies with SYN+ACK to acknowledge the client’s SYN and send its own ISN.',
    },
    {
      question: 'What triggers TCP Fast Retransmit without waiting for RTO expiration?',
      options: ['1 duplicate ACK', '3 duplicate ACKs', 'Receiving a FIN', 'TTL reaching 1'],
      correctIndex: 1,
      explanation: 'Receiving 3 duplicate ACKs signals an out-of-order gap and triggers immediate retransmission.',
    },
    {
      question: 'During TCP Slow Start, how does cwnd grow per RTT when no packets are lost?',
      options: ['Linearly (+1 MSS)', 'Exponentially (doubles)', 'Remains constant', 'Decreases by half'],
      correctIndex: 1,
      explanation: 'Every ACK increases cwnd by 1 MSS, doubling cwnd each round-trip time until ssthresh.',
    },
    {
      question: 'Why does the active closer enter TIME_WAIT after sending the final ACK?',
      options: ['To allow delayed packets to drain and ensure the peer received the final ACK', 'To encrypt remaining bytes', 'To flush DNS cache', 'To reset MAC tables'],
      correctIndex: 0,
      explanation: 'TIME_WAIT (2*MSL) prevents old delayed segments from corrupting a new connection on the same 4-tuple.',
    },
    {
      question: 'Which defense mitigates SYN flood memory exhaustion?',
      options: ['ARP caching', 'SYN Cookies', 'Increasing TTL', 'Disabling Nagle'],
      correctIndex: 1,
      explanation: 'SYN cookies avoid storing half-open state until the client returns the third handshake ACK.',
    },
  ],
  scenario: (opts = {}) => {
    const engine = buildEngineFromNodes(nodes, links, opts);
    if (opts.portClosed) {
      const link = Array.from(engine.links.values())[0];
      if (link) link.up = true;
      engine.enqueueDirectPacket({
        fromId: 'client', toId: 'server', startTimeMs: 0, protocol: 'TCP', colorCategory: 'tcp',
        info: '52344 -> 80 [SYN] Seq=0', osiLayer: 4, stepIndex: 0,
        ipv4: { version: 4, ihl: 5, tos: 0, identification: 1, flags: { df: true, mf: false }, fragmentOffset: 0, ttl: 64, protocol: 6, srcIp: '192.168.1.10', dstIp: '203.0.113.10' },
        tcp: { srcPort: 52344, dstPort: 80, seq: 0, ack: 0, dataOffset: 6, flags: { urg: false, ack: false, psh: false, rst: false, syn: true, fin: false }, window: 65535, urgentPointer: 0, mss: 1460 },
      });
      engine.enqueueDirectPacket({
        fromId: 'server', toId: 'client', startTimeMs: 18, protocol: 'TCP', colorCategory: 'error',
        info: '80 -> 52344 [RST, ACK] Seq=0 Ack=1 (Port Closed)', osiLayer: 4, stepIndex: 0,
        ipv4: { version: 4, ihl: 5, tos: 0, identification: 2, flags: { df: true, mf: false }, fragmentOffset: 0, ttl: 64, protocol: 6, srcIp: '203.0.113.10', dstIp: '192.168.1.10' },
        tcp: { srcPort: 80, dstPort: 52344, seq: 0, ack: 1, dataOffset: 5, flags: { urg: false, ack: true, psh: false, rst: true, syn: false, fin: false }, window: 0, urgentPointer: 0 },
      });
      engine.runAll();
      return { packets: engine.packets, steps, nodes, links };
    }

    if (opts.packetLoss) {
      const l2 = Array.from(engine.links.values())[1];
      if (l2) l2.lossPercent = 25;
    }

    const tcb = engine.runTcpTransfer({ clientId: 'client', serverId: 'server', serverPort: 80, segments: 8, algorithm: 'reno' });
    // Assign stepIndex to packets cleanly based on handshake/data/teardown
    engine.packets.forEach((p, idx) => {
      if (idx < 6) p.stepIndex = 0;
      else if (idx < 14) p.stepIndex = 1;
      else if (idx < 22) p.stepIndex = 2;
      else if (idx < engine.packets.length - 5) p.stepIndex = 3;
      else p.stepIndex = 4;
    });

    return {
      packets: engine.packets,
      steps,
      nodes,
      links,
      cwndSeries: tcb.cwndHistory,
    };
  },
};
