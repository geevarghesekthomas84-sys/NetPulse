import { runPacketTemplates } from '../helpers';
import type { ProtocolEntry, ProtocolLinkDef, ProtocolNodeDef } from '../types';

const appNodes: ProtocolNodeDef[] = [
  { id: 'client', label: 'Client', ip: '192.168.1.10', role: 'host', x: 160, y: 250 },
  { id: 'proxy', label: 'Gateway', ip: '192.168.1.1', role: 'router', x: 500, y: 250 },
  { id: 'server', label: 'Service Server', ip: '203.0.113.10', role: 'server_rack', x: 840, y: 250 },
];
const appLinks: ProtocolLinkDef[] = [
  { id: 'l1', sourceId: 'client', targetId: 'proxy', delayMs: 6 },
  { id: 'l2', sourceId: 'proxy', targetId: 'server', delayMs: 12 },
];

export const websocketProtocol: ProtocolEntry = {
  id: 'websocket',
  name: 'WebSocket',
  fullName: 'The WebSocket Protocol (WS / WSS)',
  category: 'APPLICATION',
  status: 'full',
  layer: 'Layer 7 (Application)',
  osiLayer: 7,
  defaultPort: '80 (WS), 443 (WSS)',
  transport: 'TCP (+ TLS for WSS)',
  dataFormat: 'HTTP Upgrade Handshake -> Binary Masked Frames (RFC 6455)',
  methods: ['GET Upgrade: websocket', '101 Switching Protocols', 'Text/Binary Frame', 'Ping/Pong', 'Close'],
  rfcs: [{ number: 'RFC 6455', title: 'The WebSocket Protocol', url: 'https://www.rfc-editor.org/rfc/rfc6455' }],
  keywords: ['realtime', 'duplex', '101', 'upgrade', 'chat', 'ws', 'wss', 'socket'],
  description:
    'WebSocket upgrades a standard HTTP/1.1 TCP connection into a persistent, full-duplex, low-overhead bidirectional message channel for live chat, trading feeds, and multiplayer games.',
  eli5: 'Instead of mailing letters back and forth every second (HTTP polling), WebSocket knocks once via HTTP ("Upgrade?") and leaves the walkie-talkie channel open both ways.',
  securityNotes: [
    { attack: 'Cross-Site WebSocket Hijacking (CSWSH)', description: 'Browsers send cookies on WS upgrade; servers that skip Origin checks can be hijacked.', defense: 'Validate the HTTP Origin header and use WSS (TLS) with CSRF tokens.' },
  ],
  nodes: appNodes,
  links: appLinks,
  steps: [
    { title: 'HTTP Upgrade Request', subtitle: 'Upgrade: websocket + Sec-WebSocket-Key', caption: 'Client sends HTTP GET with Connection: Upgrade and a random base64 Sec-WebSocket-Key.', osiLayer: 7 },
    { title: '101 Switching Protocols', subtitle: 'Server computes Sec-WebSocket-Accept', caption: 'Server hashes key + GUID, responds HTTP/1.1 101 Switching Protocols, switching socket framing.', osiLayer: 7 },
    { title: 'Full-Duplex Frames', subtitle: 'Server pushes frames without client polling', caption: 'Tiny 2–6 byte framed messages flow bidirectionally; client frames are XOR-masked.', osiLayer: 7 },
  ],
  whatIfOptions: [{ id: 'portClosed', label: 'Upgrade Rejected (403)', description: 'Server rejects invalid Origin header with HTTP 403' }],
  quiz: [
    { question: 'Which HTTP status code confirms a successful WebSocket handshake?', options: ['200 OK', '101 Switching Protocols', '301 Moved', '204 No Content'], correctIndex: 1, explanation: '101 Switching Protocols transitions the TCP socket from HTTP to WebSocket framing.' },
    { question: 'Why must WebSocket frames sent from a browser client be masked?', options: ['For encryption', 'To prevent cache poisoning of legacy transparent HTTP proxies', 'To compress JSON', 'To bypass TCP'], correctIndex: 1, explanation: 'Client-to-server XOR masking stops malicious scripts from crafting fake HTTP requests inside WebSocket frames.' },
    { question: 'Which heartbeat opcodes keep idle WebSocket connections alive?', options: ['SYN/ACK', 'Ping (0x9) and Pong (0xA)', 'DISCOVER/OFFER', 'EHLO/QUIT'], correctIndex: 1, explanation: 'WebSocket includes native Ping and Pong control frames.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(appNodes, appLinks, websocketProtocol.steps, [
      { stepIndex: 0, fromId: 'client', toId: 'server', protocol: 'HTTP', colorCategory: 'http_req', info: 'GET /ws HTTP/1.1 (Upgrade: websocket, Sec-WebSocket-Key)', osiLayer: 7, srcPort: 54500, dstPort: 443, tcpFlags: { psh: true, ack: true }, sizeBytes: 260 },
      { stepIndex: 1, fromId: 'server', toId: 'client', protocol: 'HTTP', colorCategory: opts.portClosed ? 'error' : 'http_res', info: opts.portClosed ? 'HTTP/1.1 403 Forbidden (Invalid Origin)' : 'HTTP/1.1 101 Switching Protocols (Upgrade: websocket)', osiLayer: 7, srcPort: 443, dstPort: 54500, tcpFlags: { psh: true, ack: true }, sizeBytes: 185 },
      ...(opts.portClosed ? [] : [
        { stepIndex: 2, fromId: 'server', toId: 'client', protocol: 'WebSocket', colorCategory: 'tls' as const, info: 'WS Text Frame [FIN=1, Len=42] {"tick":"BTC 98420"}', osiLayer: 7, srcPort: 443, dstPort: 54500, tcpFlags: { psh: true, ack: true }, sizeBytes: 98 },
        { stepIndex: 2, fromId: 'client', toId: 'server', protocol: 'WebSocket', colorCategory: 'http_req' as const, info: 'WS Masked Frame [FIN=1, Mask=1] {"msg":"ping"}', osiLayer: 7, srcPort: 54500, dstPort: 443, tcpFlags: { psh: true, ack: true }, sizeBytes: 82 },
      ]),
    ], opts),
};

const webrtcNodes: ProtocolNodeDef[] = [
  { id: 'peerA', label: 'Peer A (Behind NAT)', ip: '192.168.1.10', role: 'host', x: 120, y: 280 },
  { id: 'stun', label: 'STUN / Signaling', ip: '198.51.100.1', role: 'server_rack', x: 500, y: 95, openPorts: [3478, 443] },
  { id: 'peerB', label: 'Peer B (Their Laptop)', ip: '192.168.0.23', role: 'host', x: 880, y: 280 },
];
const webrtcLinks: ProtocolLinkDef[] = [
  { id: 'l1', sourceId: 'peerA', targetId: 'stun', delayMs: 8 },
  { id: 'l2', sourceId: 'peerB', targetId: 'stun', delayMs: 8 },
  { id: 'l3', sourceId: 'peerA', targetId: 'peerB', delayMs: 14 },
];

export const webrtcProtocol: ProtocolEntry = {
  id: 'webrtc',
  name: 'WebRTC',
  fullName: 'Web Real-Time Communication (ICE / STUN / DTLS / SRTP)',
  category: 'APPLICATION',
  status: 'full',
  layer: 'Layer 7 / Session Media',
  osiLayer: 7,
  defaultPort: '3478 (STUN/TURN), Dynamic UDP',
  transport: 'UDP (ICE + DTLS + SRTP / SCTP)',
  dataFormat: 'SDP Offer/Answer + STUN Binding + SRTP Encrypted Media',
  methods: ['SDP Offer/Answer', 'STUN Binding', 'ICE Connectivity Check', 'DTLS-SRTP'],
  rfcs: [{ number: 'RFC 8445', title: 'Interactive Connectivity Establishment (ICE)', url: 'https://www.rfc-editor.org/rfc/rfc8445' }],
  keywords: ['stun', 'turn', 'ice', 'sdp', 'dtls', 'srtp', 'video call', 'p2p', 'nat traversal'],
  description:
    'WebRTC enables sub-second peer-to-peer browser video, audio, and data channels by discovering public NAT mappings via STUN/TURN, punching holes with ICE, securing keys via DTLS, and streaming encrypted SRTP.',
  eli5: 'Two friends behind locked apartment gates (NATs) ask a lookout tower (STUN) what their outside gate numbers are, trade those numbers, and then throw video balls directly between gates.',
  securityNotes: [
    { attack: 'ICE IP Leak', description: 'Gathering host/srflx ICE candidates can expose a user’s local LAN or real public IP behind a VPN.', defense: 'Use mDNS obfuscated host candidates and TURN-only relay policies when IP privacy is required.' },
  ],
  nodes: webrtcNodes,
  links: webrtcLinks,
  steps: [
    { title: 'STUN Public IP Discovery', subtitle: 'Binding Request discovers NAT external IP:port', caption: 'Peer A queries STUN (UDP 3478) to learn its public reflexive address.', osiLayer: 7 },
    { title: 'SDP Offer / ICE Candidates', subtitle: 'Exchange codecs & candidate IPs via signaling', caption: 'Peers swap SDP descriptions and ICE candidate lists through the signaling server.', osiLayer: 7 },
    { title: 'ICE Hole Punch + DTLS-SRTP', subtitle: 'Direct P2P UDP + encrypted media stream', caption: 'ICE connectivity checks succeed; DTLS establishes keys for encrypted SRTP audio/video.', osiLayer: 6 },
  ],
  whatIfOptions: [{ id: 'packetLoss', label: 'Symmetric NAT (TURN Relay)', description: 'Direct P2P fails; traffic falls back to TURN relay' }],
  quiz: [
    { question: 'What is the purpose of a STUN server in WebRTC?', options: ['To transcode 4K video', 'To tell a peer its public IP:port behind NAT', 'To assign MAC addresses', 'To route BGP'], correctIndex: 1, explanation: 'STUN returns the XOR-MAPPED-ADDRESS seen from outside the NAT.' },
    { question: 'When direct P2P hole-punching fails (e.g. symmetric NAT), which server relays WebRTC media?', options: ['DHCP', 'TURN', 'SMTP', 'SNMP'], correctIndex: 1, explanation: 'TURN (Traversal Using Relays around NAT) relays media packets as a fallback.' },
    { question: 'Which protocol encrypts WebRTC audio and video frames?', options: ['HTTP', 'SRTP (keyed via DTLS)', 'Telnet', 'ARP'], correctIndex: 1, explanation: 'WebRTC mandates DTLS key exchange paired with SRTP media encryption.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(webrtcNodes, webrtcLinks, webrtcProtocol.steps, [
      { stepIndex: 0, fromId: 'peerA', toId: 'stun', protocol: 'STUN', colorCategory: 'udp', info: 'STUN Binding Request (Learn public NAT mapping)', osiLayer: 7, isUdp: true, srcPort: 51234, dstPort: 3478, sizeBytes: 72 },
      { stepIndex: 0, fromId: 'stun', toId: 'peerA', protocol: 'STUN', colorCategory: 'udp', info: 'Binding Success: XOR-MAPPED 198.51.100.42:51234', osiLayer: 7, isUdp: true, srcPort: 3478, dstPort: 51234, sizeBytes: 96 },
      { stepIndex: 1, fromId: 'peerA', toId: 'stun', protocol: 'WebSocket', colorCategory: 'http_req', info: 'Signaling: SDP Offer + ICE Candidates', osiLayer: 7, srcPort: 54000, dstPort: 443, tcpFlags: { psh: true, ack: true }, sizeBytes: 640 },
      { stepIndex: 1, fromId: 'stun', toId: 'peerB', protocol: 'WebSocket', colorCategory: 'http_res', info: 'Signaling Relay: SDP Offer -> Peer B', osiLayer: 7, srcPort: 443, dstPort: 54001, tcpFlags: { psh: true, ack: true }, sizeBytes: 640 },
      ...(opts.packetLoss
        ? [
            { stepIndex: 2, fromId: 'peerA', toId: 'peerB', protocol: 'STUN', colorCategory: 'error' as const, info: 'ICE Direct Check Failed (Symmetric NAT) -> Using TURN Relay', osiLayer: 7, isUdp: true, srcPort: 51234, dstPort: 52000, sizeBytes: 96, forceDrop: true },
            { stepIndex: 2, fromId: 'peerA', toId: 'stun', protocol: 'SRTP', colorCategory: 'tls' as const, info: 'Relayed SRTP Video via TURN (UDP 3478)', osiLayer: 6, isUdp: true, srcPort: 51234, dstPort: 3478, sizeBytes: 1180 },
          ]
        : [
            { stepIndex: 2, fromId: 'peerA', toId: 'peerB', protocol: 'DTLS', colorCategory: 'tls' as const, info: 'DTLS Handshake -> Key Export for SRTP', osiLayer: 6, isUdp: true, srcPort: 51234, dstPort: 52000, sizeBytes: 410 },
            { stepIndex: 2, fromId: 'peerA', toId: 'peerB', protocol: 'SRTP', colorCategory: 'tls' as const, info: 'Encrypted P2P SRTP Audio/Video Stream (Direct!)', osiLayer: 6, isUdp: true, srcPort: 51234, dstPort: 52000, sizeBytes: 1180 },
          ]),
    ], opts),
};

export const sipProtocol: ProtocolEntry = {
  id: 'sip',
  name: 'SIP',
  fullName: 'Session Initiation Protocol (VoIP Signaling)',
  category: 'APPLICATION',
  status: 'partial',
  layer: 'Layer 7 (Application Signaling)',
  osiLayer: 7,
  defaultPort: '5060 (SIP), 5061 (SIPS/TLS)',
  transport: 'UDP / TCP / TLS',
  dataFormat: 'Text-based SIP Headers + SDP Body',
  methods: ['REGISTER', 'INVITE', '100 Trying', '180 Ringing', '200 OK', 'ACK', 'BYE'],
  rfcs: [{ number: 'RFC 3261', title: 'SIP: Session Initiation Protocol', url: 'https://www.rfc-editor.org/rfc/rfc3261' }],
  keywords: ['voip', 'call', 'invite', '5060', 'rtp', 'pbx', 'ringing'],
  description:
    'SIP sets up, modifies, and tears down voice and video VoIP calls (INVITE / 180 Ringing / 200 OK / ACK) while actual voice packets travel separately over RTP.',
  eli5: 'SIP is the telephone operator that rings the other phone ("INVITE", "Ringing!", "Picked up!"), and once connected, both people talk directly over RTP.',
  securityNotes: [
    { attack: 'SIP Toll Fraud & Eavesdropping', description: 'Unencrypted SIP on port 5060 leaks caller IDs and credentials; weak PBX auth allows expensive international call hijack.', defense: 'Use SIPS (TLS on port 5061) and SRTP for voice media.' },
  ],
  nodes: webrtcNodes,
  links: webrtcLinks,
  steps: [
    { title: 'INVITE -> 180 Ringing', subtitle: 'Caller sends INVITE with SDP codecs', caption: 'Phone A sends SIP INVITE via SIP Proxy; Phone B alerts user with 180 Ringing.', osiLayer: 7 },
    { title: '200 OK & ACK', subtitle: 'Call answered; media parameters agreed', caption: 'Phone B answers with 200 OK; Phone A confirms with ACK.', osiLayer: 7 },
    { title: 'RTP Media & BYE', subtitle: 'Voice flows over RTP; BYE hangs up', caption: 'Bidirectional RTP audio packets flow directly until one party sends SIP BYE.', osiLayer: 7 },
  ],
  whatIfOptions: [{ id: 'portClosed', label: '486 Busy Here', description: 'Callee rejects call with SIP 486 Busy Here' }],
  quiz: [
    { question: 'Which ports does SIP use for plaintext and TLS signaling?', options: ['80 and 443', '5060 and 5061', '25 and 587', '53 and 853'], correctIndex: 1, explanation: 'SIP uses 5060 (UDP/TCP) and SIPS uses 5061 (TLS).' },
    { question: 'Which protocol carries the actual voice audio after SIP establishes the call?', options: ['SMTP', 'RTP', 'ICMP', 'DHCP'], correctIndex: 1, explanation: 'SIP is signaling only; RTP (Real-time Transport Protocol) carries audio/video.' },
    { question: 'Which SIP message ends an active call?', options: ['FIN', 'BYE', 'QUIT', 'LOGOUT'], correctIndex: 1, explanation: 'SIP uses BYE to tear down an established dialog.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(webrtcNodes, webrtcLinks, sipProtocol.steps, [
      { stepIndex: 0, fromId: 'peerA', toId: 'stun', protocol: 'SIP', colorCategory: 'http_req', info: 'INVITE sip:bob@voip.example.com SIP/2.0 (SDP)', osiLayer: 7, isUdp: true, srcPort: 5060, dstPort: 5060, sizeBytes: 580 },
      { stepIndex: 0, fromId: 'stun', toId: 'peerB', protocol: 'SIP', colorCategory: 'http_req', info: 'INVITE sip:bob@192.168.0.23 SIP/2.0', osiLayer: 7, isUdp: true, srcPort: 5060, dstPort: 5060, sizeBytes: 580 },
      { stepIndex: 0, fromId: 'peerB', toId: 'peerA', protocol: 'SIP', colorCategory: 'http_res', info: opts.portClosed ? 'SIP/2.0 486 Busy Here' : 'SIP/2.0 180 Ringing', osiLayer: 7, isUdp: true, srcPort: 5060, dstPort: 5060, sizeBytes: 310 },
      ...(opts.portClosed ? [] : [
        { stepIndex: 1, fromId: 'peerB', toId: 'peerA', protocol: 'SIP', colorCategory: 'http_res' as const, info: 'SIP/2.0 200 OK (Call Answered)', osiLayer: 7, isUdp: true, srcPort: 5060, dstPort: 5060, sizeBytes: 420 },
        { stepIndex: 1, fromId: 'peerA', toId: 'peerB', protocol: 'SIP', colorCategory: 'http_req' as const, info: 'ACK sip:bob@192.168.0.23 SIP/2.0', osiLayer: 7, isUdp: true, srcPort: 5060, dstPort: 5060, sizeBytes: 280 },
        { stepIndex: 2, fromId: 'peerA', toId: 'peerB', protocol: 'RTP', colorCategory: 'udp' as const, info: 'RTP G.711 Audio Stream (20ms frames)', osiLayer: 7, isUdp: true, srcPort: 16384, dstPort: 16384, sizeBytes: 214 },
        { stepIndex: 2, fromId: 'peerA', toId: 'peerB', protocol: 'SIP', colorCategory: 'http_req' as const, info: 'BYE sip:bob@192.168.0.23 SIP/2.0', osiLayer: 7, isUdp: true, srcPort: 5060, dstPort: 5060, sizeBytes: 290 },
      ]),
    ], opts),
};

const camNodes: ProtocolNodeDef[] = [
  { id: 'client', label: 'VLC / NVR Client', ip: '192.168.1.10', role: 'tv_box', x: 160, y: 250 },
  { id: 'router', label: 'LAN Switch', ip: '192.168.1.2', role: 'switch', x: 500, y: 250 },
  { id: 'cam', label: 'IP Camera', ip: '192.168.1.64', role: 'ip_camera', x: 840, y: 250, openPorts: [554] },
];

export const rtspProtocol: ProtocolEntry = {
  id: 'rtsp',
  name: 'RTSP',
  fullName: 'Real Time Streaming Protocol (CCTV / IP Cameras)',
  category: 'APPLICATION',
  status: 'partial',
  layer: 'Layer 7 (Application)',
  osiLayer: 7,
  defaultPort: '554',
  transport: 'TCP (Control) + UDP/TCP (RTP Media)',
  dataFormat: 'HTTP-like Control Commands (DESCRIBE, SETUP, PLAY)',
  methods: ['OPTIONS', 'DESCRIBE', 'SETUP', 'PLAY', 'PAUSE', 'TEARDOWN'],
  rfcs: [{ number: 'RFC 7826', title: 'Real-Time Streaming Protocol Version 2.0', url: 'https://www.rfc-editor.org/rfc/rfc7826' }],
  keywords: ['554', 'camera', 'cctv', 'video', 'rtp', 'nvr', 'play'],
  description:
    'RTSP acts as a "network remote control" on port 554 for IP cameras and media servers (DESCRIBE -> SETUP -> PLAY -> TEARDOWN), while video frames stream over RTP.',
  eli5: 'RTSP is the Play/Pause/Rewind remote control for a security camera, while RTP is the live video river flowing onto your screen.',
  securityNotes: [
    { attack: 'Exposed Camera Streams on Port 554', description: 'Many IP cameras ship with default credentials or unencrypted RTSP exposed to the internet.', defense: 'Isolate cameras on a dedicated VLAN, disable UPnP, and wrap RTSP inside VPN/RTSPS.' },
  ],
  nodes: camNodes,
  links: appLinks,
  steps: [
    { title: 'OPTIONS & DESCRIBE', subtitle: 'Fetch camera SDP track metadata', caption: 'Client sends OPTIONS and DESCRIBE rtsp://192.168.1.64:554/stream1; camera returns H.264 SDP.', osiLayer: 7 },
    { title: 'SETUP & PLAY', subtitle: 'Negotiate RTP ports and start stream', caption: 'Client configures RTP transport ports with SETUP and triggers PLAY.', osiLayer: 7 },
    { title: 'RTP Video Stream', subtitle: 'H.264 NAL units streamed over RTP', caption: 'IP Camera streams real-time H.264 video frames to client.', osiLayer: 7 },
  ],
  whatIfOptions: [{ id: 'wrongPassword', label: '401 Unauthorized', description: 'Camera requires Digest Authentication before DESCRIBE' }],
  quiz: [
    { question: 'Which default TCP port does RTSP use?', options: ['554', '1935', '8080', '5060'], correctIndex: 0, explanation: 'RTSP listens on port 554 (and 322 for RTSPS).' },
    { question: 'Which RTSP command actually begins media transmission?', options: ['DESCRIBE', 'SETUP', 'PLAY', 'OPTIONS'], correctIndex: 2, explanation: 'PLAY instructs the server to begin sending RTP packets.' },
    { question: 'Does RTSP carry the video pixels itself or control the stream?', options: ['It controls the stream; RTP carries media', 'It carries raw HDMI', 'It replaces IP', 'It only sends audio'], correctIndex: 0, explanation: 'RTSP is a VCR-style control channel; RTP carries the media frames.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(camNodes, appLinks, rtspProtocol.steps, [
      { stepIndex: 0, fromId: 'client', toId: 'cam', protocol: 'RTSP', colorCategory: 'http_req', info: 'DESCRIBE rtsp://192.168.1.64:554/stream1 RTSP/1.0', osiLayer: 7, srcPort: 54700, dstPort: 554, tcpFlags: { psh: true, ack: true }, sizeBytes: 175 },
      { stepIndex: 0, fromId: 'cam', toId: 'client', protocol: 'RTSP', colorCategory: opts.wrongPassword ? 'error' : 'http_res', info: opts.wrongPassword ? 'RTSP/1.0 401 Unauthorized (Digest Auth)' : 'RTSP/1.0 200 OK (SDP: H.264 1080p)', osiLayer: 7, srcPort: 554, dstPort: 54700, tcpFlags: { psh: true, ack: true }, sizeBytes: 410 },
      ...(opts.wrongPassword ? [] : [
        { stepIndex: 1, fromId: 'client', toId: 'cam', protocol: 'RTSP', colorCategory: 'http_req' as const, info: 'SETUP /track1 (Transport: RTP/AVP;client_port=5000-5001)', osiLayer: 7, srcPort: 54700, dstPort: 554, tcpFlags: { psh: true, ack: true }, sizeBytes: 185 },
        { stepIndex: 1, fromId: 'client', toId: 'cam', protocol: 'RTSP', colorCategory: 'http_req' as const, info: 'PLAY rtsp://192.168.1.64:554/stream1', osiLayer: 7, srcPort: 54700, dstPort: 554, tcpFlags: { psh: true, ack: true }, sizeBytes: 150 },
        { stepIndex: 2, fromId: 'cam', toId: 'client', protocol: 'RTP', colorCategory: 'udp' as const, info: 'RTP H.264 Video Frame (PT=96, Marker=1)', osiLayer: 7, isUdp: true, srcPort: 5000, dstPort: 5000, sizeBytes: 1380 },
      ]),
    ], opts),
};

export const rtmpProtocol: ProtocolEntry = {
  id: 'rtmp',
  name: 'RTMP',
  fullName: 'Real-Time Messaging Protocol (Live Ingest)',
  category: 'APPLICATION',
  status: 'partial',
  layer: 'Layer 7 (Application)',
  osiLayer: 7,
  defaultPort: '1935 (RTMP), 443 (RTMPS)',
  transport: 'TCP',
  dataFormat: 'Chunked Binary Audio/Video/AMF0 Messages',
  methods: ['C0/C1/C2 Handshake', 'connect', 'createStream', 'publish', 'Video/Audio Chunks'],
  rfcs: [{ number: 'RTMP 1.0', title: 'Adobe RTMP Specification', url: 'https://www.rfc-editor.org/rfc/rfc6455' }],
  keywords: ['1935', 'obs', 'twitch', 'youtube live', 'ingest', 'streaming', 'rtmps'],
  description:
    'RTMP is the persistent TCP-based ingest protocol used by OBS Studio and encoders to push low-latency live audio/video streams to ingest servers (port 1935) before HLS/DASH distribution.',
  eli5: 'RTMP is the backstage camera cable connecting a streamer’s OBS studio directly to Twitch or YouTube’s broadcast booth.',
  securityNotes: [
    { attack: 'Stream Key Exposure on Plain RTMP', description: 'Plain RTMP sends the broadcast stream key over TCP 1935 without encryption.', defense: 'Always stream over RTMPS (RTMP inside TLS) and rotate stream keys.' },
  ],
  nodes: appNodes,
  links: appLinks,
  steps: [
    { title: 'C0/C1/C2 + S0/S1/S2 Handshake', subtitle: 'Fixed-size binary handshake on TCP 1935', caption: 'Encoder and Ingest Server exchange random 1536-byte C1/S1 blocks to sync timestamps.', osiLayer: 7 },
    { title: 'connect & publish', subtitle: 'AMF0 NetConnection.connect + publish(streamKey)', caption: 'Encoder authenticates with stream key and requests publish rights.', osiLayer: 7 },
    { title: 'Multiplexed Media Chunks', subtitle: 'H.264 video & AAC audio chunks', caption: 'Audio, video, and metadata packets are interleaved into 128-byte/4KB RTMP chunks.', osiLayer: 7 },
  ],
  whatIfOptions: [{ id: 'wrongPassword', label: 'Invalid Stream Key', description: 'Ingest server returns NetStream.Publish.BadName' }],
  quiz: [
    { question: 'Which TCP port is the standard for RTMP ingest?', options: ['554', '1935', '3478', '5060'], correctIndex: 1, explanation: 'RTMP uses TCP port 1935 (or 443 for RTMPS).' },
    { question: 'Where is RTMP primarily used today?', options: ['Playback in browsers', 'Live video ingest from encoders (OBS) to streaming platforms', 'DNS queries', 'Email relay'], correctIndex: 1, explanation: 'Encoders push via RTMP/RTMPS while viewers usually watch via HLS/DASH/WebRTC.' },
    { question: 'How do you encrypt RTMP stream keys in transit?', options: ['Use UDP', 'Use RTMPS (RTMP over TLS)', 'Use ARP', 'Use ICMP'], correctIndex: 1, explanation: 'RTMPS wraps the RTMP session inside TLS.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(appNodes, appLinks, rtmpProtocol.steps, [
      { stepIndex: 0, fromId: 'client', toId: 'server', protocol: 'RTMP', colorCategory: 'tcp', info: 'RTMP Handshake C0+C1 (1537 bytes)', osiLayer: 7, srcPort: 54800, dstPort: 1935, tcpFlags: { psh: true, ack: true }, sizeBytes: 1537 },
      { stepIndex: 0, fromId: 'server', toId: 'client', protocol: 'RTMP', colorCategory: 'tcp', info: 'RTMP Handshake S0+S1+S2', osiLayer: 7, srcPort: 1935, dstPort: 54800, tcpFlags: { psh: true, ack: true }, sizeBytes: 1537 },
      { stepIndex: 1, fromId: 'client', toId: 'server', protocol: 'RTMP', colorCategory: 'http_req', info: 'AMF0 Command: publish("live_key_****")', osiLayer: 7, srcPort: 54800, dstPort: 1935, tcpFlags: { psh: true, ack: true }, sizeBytes: 180 },
      { stepIndex: 1, fromId: 'server', toId: 'client', protocol: 'RTMP', colorCategory: opts.wrongPassword ? 'error' : 'http_res', info: opts.wrongPassword ? 'onStatus: NetStream.Publish.BadName' : 'onStatus: NetStream.Publish.Start', osiLayer: 7, srcPort: 1935, dstPort: 54800, tcpFlags: { psh: true, ack: true }, sizeBytes: 160 },
      ...(opts.wrongPassword ? [] : [
        { stepIndex: 2, fromId: 'client', toId: 'server', protocol: 'RTMP', colorCategory: 'http_req' as const, info: 'Video Chunk (H.264 Keyframe) + Audio Chunk (AAC)', osiLayer: 7, srcPort: 54800, dstPort: 1935, tcpFlags: { psh: true, ack: true }, sizeBytes: 1420 },
      ]),
    ], opts),
};

export const quicProtocol: ProtocolEntry = {
  id: 'quic',
  name: 'QUIC (HTTP/3)',
  fullName: 'QUIC Transport & HTTP/3',
  category: 'APPLICATION',
  status: 'full',
  layer: 'Layer 4–6 (UDP-based Encrypted Multiplexed Transport)',
  osiLayer: 4,
  defaultPort: '443 (UDP)',
  transport: 'UDP + Built-in TLS 1.3',
  dataFormat: 'Encrypted QUIC Packets + Independent Multiplexed Streams',
  methods: ['Initial (TLS ClientHello)', '0-RTT Early Data', 'Handshake', '1-RTT Streams', 'Connection Migration'],
  rfcs: [
    { number: 'RFC 9000', title: 'QUIC: A UDP-Based Multiplexed and Secure Transport', url: 'https://www.rfc-editor.org/rfc/rfc9000' },
    { number: 'RFC 9114', title: 'HTTP/3', url: 'https://www.rfc-editor.org/rfc/rfc9114' },
  ],
  keywords: ['http/3', '0-rtt', 'udp 443', 'head of line', 'connection migration', 'tls 1.3'],
  description:
    'QUIC reimagines transport over UDP port 443 with TLS 1.3 baked in from packet #1 (1-RTT or 0-RTT resume), independent streams that eliminate TCP head-of-line blocking, and Connection IDs that survive Wi-Fi-to-5G handoffs.',
  eli5: 'TCP puts every webpage item on one single-lane train track—if one boxcar stalls, all cars behind it wait. QUIC gives each item its own fast lane over UDP with built-in encryption.',
  securityNotes: [
    { attack: 'QUIC Initial Amplification / 0-RTT Replay', description: 'Without care, 0-RTT early data can be replayed across servers.', defense: 'QUIC requires Initial packets >=1200 bytes to thwart amplification and restricts 0-RTT to idempotent GET requests.' },
  ],
  nodes: appNodes,
  links: appLinks,
  steps: [
    { title: '1-RTT Initial (Transport + TLS)', subtitle: 'Single Initial packet carries TLS ClientHello', caption: 'Client sends a 1200B UDP/443 Initial packet combining transport setup and TLS 1.3 ClientHello.', osiLayer: 4 },
    { title: 'Server Initial + Handshake', subtitle: 'ServerHello + Encrypted Cert in same flight', caption: 'Server replies with Initial + Handshake packets; connection is ready in 1 RTT total!', osiLayer: 6 },
    { title: 'Independent HTTP/3 Streams', subtitle: 'Stream 0 (HTML) & Stream 4 (CSS) without HoL blocking', caption: 'Loss on Stream 0 only pauses Stream 0; Stream 4 delivers CSS immediately.', osiLayer: 7 },
  ],
  whatIfOptions: [{ id: 'packetLoss', label: 'Stream 0 Loss (No HoL Block)', description: 'Stream 0 packet drops while Stream 4 delivers uninterrupted' }],
  quiz: [
    { question: 'Which Layer 4 protocol does QUIC run on top of?', options: ['TCP', 'UDP (port 443)', 'SCTP', 'ICMP'], correctIndex: 1, explanation: 'QUIC runs over UDP so middleboxes don’t break new transport extensions and to eliminate TCP HoL blocking.' },
    { question: 'How does QUIC keep a session alive when a phone switches from Wi-Fi to 5G?', options: ['By keeping the same IP address', 'Using a 64-bit Connection ID independent of IP/port', 'Sending ARP requests', 'Restarting TCP'], correctIndex: 1, explanation: 'QUIC identifies connections by Connection ID rather than the 4-tuple IP/port.' },
    { question: 'What problem in HTTP/2 over TCP does HTTP/3 over QUIC solve?', options: ['DNS caching', 'Transport-layer Head-of-Line (HoL) blocking', 'IPv4 exhaustion', 'MAC spoofing'], correctIndex: 1, explanation: 'In QUIC, packet loss only affects the stream carrying that lost frame, not other multiplexed streams.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(appNodes, appLinks, quicProtocol.steps, [
      { stepIndex: 0, fromId: 'client', toId: 'server', protocol: 'QUIC', colorCategory: 'tls', info: 'Initial, PKN=0 (DCID=a49f, TLS 1.3 ClientHello ALPN=h3)', osiLayer: 4, isUdp: true, srcPort: 55100, dstPort: 443, sizeBytes: 1242, tls: { recordType: 'Handshake', version: 'TLS 1.3', handshakeType: 'QUIC Initial + ClientHello', alpn: 'h3' } },
      { stepIndex: 1, fromId: 'server', toId: 'client', protocol: 'QUIC', colorCategory: 'tls', info: 'Initial + Handshake (ServerHello, Cert, Finished)', osiLayer: 6, isUdp: true, srcPort: 443, dstPort: 55100, sizeBytes: 1320, tls: { recordType: 'Handshake', version: 'TLS 1.3', handshakeType: 'QUIC ServerHello + Cert' } },
      { stepIndex: 2, fromId: 'client', toId: 'server', protocol: 'HTTP/3', colorCategory: 'http_req', info: '1-RTT Stream 0 (GET /) + Stream 4 (GET /app.css)', osiLayer: 7, isUdp: true, srcPort: 55100, dstPort: 443, sizeBytes: 340 },
      { stepIndex: 2, fromId: 'server', toId: 'client', protocol: 'HTTP/3', colorCategory: opts.packetLoss ? 'error' : 'http_res', info: opts.packetLoss ? 'Stream 0 Lost (Stream 4 CSS delivered cleanly!)' : '1-RTT Stream 0 (200 OK HTML) + Stream 4 (CSS)', osiLayer: 7, isUdp: true, srcPort: 443, dstPort: 55100, sizeBytes: 1280, forceDrop: opts.packetLoss },
      ...(opts.packetLoss ? [
        { stepIndex: 2, fromId: 'server', toId: 'client', protocol: 'HTTP/3', colorCategory: 'http_res' as const, info: 'Stream 4 (200 OK CSS) Delivered Unblocked + Stream 0 Retransmit', osiLayer: 7, isUdp: true, srcPort: 443, dstPort: 55100, sizeBytes: 980 },
      ] : []),
    ], opts),
};

export const dohProtocol: ProtocolEntry = {
  id: 'doh',
  name: 'DNS over HTTPS',
  fullName: 'DNS Queries over HTTPS (DoH)',
  category: 'APPLICATION',
  status: 'full',
  layer: 'Layer 7 (Encrypted DNS inside HTTPS)',
  osiLayer: 7,
  defaultPort: '443',
  transport: 'TCP + TLS (or QUIC)',
  dataFormat: 'application/dns-message (POST/GET over HTTPS)',
  methods: ['GET /dns-query?dns=...', 'POST /dns-query', 'TLS 1.3'],
  rfcs: [{ number: 'RFC 8484', title: 'DNS Queries over HTTPS (DoH)', url: 'https://www.rfc-editor.org/rfc/rfc8484' }],
  keywords: ['doh', 'dot', 'privacy', 'encrypted dns', '443', '1.1.1.1', '8.8.8.8'],
  description:
    'DNS over HTTPS (DoH) wraps binary DNS queries inside standard HTTPS port-443 traffic so ISPs and local Wi-Fi observers cannot snoop or tamper with the websites you look up.',
  eli5: 'Regular DNS is shouting the website name out loud to the phonebook operator. DoH puts that question inside an encrypted HTTPS envelope indistinguishable from normal web browsing.',
  securityNotes: [
    { attack: 'Corporate Visibility Bypass', description: 'Because DoH blends into TCP/443 HTTPS, enterprise DNS firewalls cannot filter malicious domains unless configured.', defense: 'Use managed enterprise DoH policies or TLS-aware DNS proxies.' },
  ],
  nodes: [
    { id: 'client', label: 'Browser', ip: '192.168.1.10', role: 'host', x: 160, y: 250 },
    { id: 'isp', label: 'ISP Observer', ip: '100.64.0.1', role: 'router', x: 500, y: 250 },
    { id: 'doh', label: 'DoH Resolver (1.1.1.1)', ip: '1.1.1.1', role: 'dns_server', x: 840, y: 250, openPorts: [443] },
  ],
  links: appLinks.map((l, i) => ({ ...l, sourceId: i === 0 ? 'client' : 'isp', targetId: i === 0 ? 'isp' : 'doh' })),
  steps: [
    { title: 'TLS 1.3 Session to Port 443', subtitle: 'Handshake with 1.1.1.1:443', caption: 'Browser opens an HTTPS/TLS 1.3 tunnel to Cloudflare/Google DoH endpoint.', osiLayer: 6 },
    { title: 'HTTPS POST /dns-query', subtitle: 'Encrypted wire-format DNS query', caption: 'ISP sees only opaque TLS packets on port 443—domain name is completely hidden.', osiLayer: 7 },
    { title: 'Encrypted DNS Response', subtitle: '200 OK application/dns-message', caption: 'DoH server returns signed/resolved A record inside encrypted HTTPS 200 OK.', osiLayer: 7 },
  ],
  whatIfOptions: [{ id: 'expiredCert', label: 'MITM Cert Warning', description: 'Browser blocks DoH if local proxy tampers with TLS certificate' }],
  quiz: [
    { question: 'Which port does DNS over HTTPS (DoH) use?', options: ['53', '443', '853', '123'], correctIndex: 1, explanation: 'DoH uses standard HTTPS port 443 (whereas DNS over TLS / DoT uses port 853).' },
    { question: 'What Content-Type carries binary DNS wire messages in DoH?', options: ['text/html', 'application/dns-message', 'image/png', 'application/octet-dns'], correctIndex: 1, explanation: 'RFC 8484 specifies `application/dns-message`.' },
    { question: 'What privacy threat does DoH eliminate on public Wi-Fi?', options: ['MAC addresses', 'Passive sniffing and injection of plaintext UDP/53 DNS queries', 'IP routing', 'Browser cookies'], correctIndex: 1, explanation: 'Encrypting DNS prevents local attackers or ISPs from reading or forging DNS replies.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(
      [
        { id: 'client', label: 'Browser', ip: '192.168.1.10', role: 'host', x: 160, y: 250 },
        { id: 'isp', label: 'ISP Router', ip: '100.64.0.1', role: 'router', x: 500, y: 250 },
        { id: 'doh', label: 'DoH Resolver', ip: '1.1.1.1', role: 'dns_server', x: 840, y: 250 },
      ],
      [
        { id: 'l1', sourceId: 'client', targetId: 'isp', delayMs: 6 },
        { id: 'l2', sourceId: 'isp', targetId: 'doh', delayMs: 12 },
      ],
      dohProtocol.steps,
      [
        { stepIndex: 0, fromId: 'client', toId: 'doh', protocol: 'TLS', colorCategory: 'tls', info: 'TLS 1.3 Handshake (1.1.1.1:443, ALPN=h2)', osiLayer: 6, srcPort: 54900, dstPort: 443, tcpFlags: { psh: true, ack: true }, sizeBytes: 517, tls: { recordType: 'Handshake', version: 'TLS 1.3', handshakeType: 'ClientHello -> Finished' } },
        ...(opts.expiredCert
          ? [{ stepIndex: 0, fromId: 'client', toId: 'doh', protocol: 'TLS', colorCategory: 'error' as const, info: 'TLS Fatal Alert: Untrusted/Expired Cert (DoH aborted)', osiLayer: 6, srcPort: 54900, dstPort: 443, tcpFlags: { psh: true, ack: true }, sizeBytes: 67 }]
          : [
              { stepIndex: 1, fromId: 'client', toId: 'doh', protocol: 'DoH', colorCategory: 'dns' as const, info: 'HTTPS POST /dns-query [Encrypted: A private.org]', osiLayer: 7, srcPort: 54900, dstPort: 443, tcpFlags: { psh: true, ack: true }, sizeBytes: 184, tls: { recordType: 'Application Data' as const, version: 'TLS 1.3' as const, handshakeType: 'Encrypted DoH Query' } },
              { stepIndex: 2, fromId: 'doh', toId: 'client', protocol: 'DoH', colorCategory: 'dns' as const, info: 'HTTPS 200 OK application/dns-message [203.0.113.55]', osiLayer: 7, srcPort: 443, dstPort: 54900, tcpFlags: { psh: true, ack: true }, sizeBytes: 210, tls: { recordType: 'Application Data' as const, version: 'TLS 1.3' as const, handshakeType: 'Encrypted DoH Answer' } },
            ]),
      ],
      opts
    ),
};

export const dnssecProtocol: ProtocolEntry = {
  id: 'dnssec',
  name: 'DNSSEC',
  fullName: 'Domain Name System Security Extensions',
  category: 'APPLICATION',
  status: 'full',
  layer: 'Layer 7 (DNS Integrity & Authenticity)',
  osiLayer: 7,
  defaultPort: '53',
  transport: 'UDP (EDNS0) / TCP',
  dataFormat: 'DNS RRSIG, DNSKEY, DS, NSEC/NSEC3 Records',
  methods: ['DO Flag (DNSSEC OK)', 'RRSIG Verification', 'DNSKEY + DS Chain of Trust'],
  rfcs: [{ number: 'RFC 4033', title: 'DNS Security Introduction and Requirements', url: 'https://www.rfc-editor.org/rfc/rfc4033' }],
  keywords: ['rrsig', 'dnskey', 'ds', 'chain of trust', 'cache poisoning', 'ad flag', 'servfail'],
  description:
    'DNSSEC adds cryptographic digital signatures (RRSIG) and a hierarchical chain of trust (Root -> TLD DS -> Zone DNSKEY) so validating resolvers detect forged or poisoned DNS answers—note it ensures authenticity, not encryption.',
  eli5: 'DNSSEC is a wax royal seal on the phonebook page: anyone can still read the number, but nobody can fake it without breaking the seal.',
  securityNotes: [
    { attack: 'Zone Enumeration via NSEC', description: 'Standard NSEC records allow walking every subdomain in a zone.', defense: 'Use hashed NSEC3 records with opt-out to prevent easy zone walking.' },
  ],
  nodes: [
    { id: 'client', label: 'Client', ip: '192.168.1.10', role: 'host', x: 120, y: 250 },
    { id: 'resolver', label: 'Validating Resolver', ip: '8.8.8.8', role: 'dns_server', x: 480, y: 250 },
    { id: 'auth', label: 'Signed Auth NS', ip: '198.51.100.53', role: 'dns_server', x: 860, y: 250 },
  ],
  links: [
    { id: 'l1', sourceId: 'client', targetId: 'resolver', delayMs: 8 },
    { id: 'l2', sourceId: 'resolver', targetId: 'auth', delayMs: 14 },
  ],
  steps: [
    { title: 'Query with DO=1', subtitle: 'Resolver requests DNSSEC signatures', caption: 'Validating resolver sets EDNS0 DO (DNSSEC OK) bit requesting RRSIG signatures.', osiLayer: 7 },
    { title: 'Signed Answer + DNSKEY/DS', subtitle: 'Auth returns A record + RRSIG signature', caption: 'Authoritative server returns A 203.0.113.10 paired with RRSIG signed by ZSK/KSK.', osiLayer: 7 },
    { title: 'Chain Verification (AD=1)', subtitle: 'Verify Root -> TLD DS -> Zone DNSKEY', caption: 'Resolver verifies signature against DS hash in parent zone and sets AD=1 (Authenticated Data).', osiLayer: 7 },
  ],
  whatIfOptions: [{ id: 'packetLoss', label: 'Bogus / Forged Signature (SERVFAIL)', description: 'RRSIG fails validation -> resolver returns SERVFAIL' }],
  quiz: [
    { question: 'Does DNSSEC encrypt DNS queries from eavesdroppers?', options: ['Yes', 'No, DNSSEC provides cryptographic authenticity/integrity, not encryption', 'Only for IPv6', 'Only on port 443'], correctIndex: 1, explanation: 'DNSSEC prevents tampering/spoofing via signatures; DoH/DoT provide privacy encryption.' },
    { question: 'Which DNSSEC record holds the digital signature for a record set?', options: ['DS', 'RRSIG', 'MX', 'PTR'], correctIndex: 1, explanation: 'RRSIG holds the cryptographic signature covering an RRset.' },
    { question: 'What does a validating resolver return when a DNSSEC signature fails verification?', options: ['NXDOMAIN', 'SERVFAIL', '200 OK', 'A 0.0.0.0'], correctIndex: 1, explanation: 'Bogus DNSSEC responses trigger SERVFAIL to protect clients from poisoned data.' },
  ],
  scenario: (opts = {}) =>
    runPacketTemplates(
      [
        { id: 'client', label: 'Client', ip: '192.168.1.10', role: 'host', x: 120, y: 250 },
        { id: 'resolver', label: 'Validating Resolver', ip: '8.8.8.8', role: 'dns_server', x: 480, y: 250 },
        { id: 'auth', label: 'Signed Auth NS', ip: '198.51.100.53', role: 'dns_server', x: 860, y: 250 },
      ],
      [
        { id: 'l1', sourceId: 'client', targetId: 'resolver', delayMs: 8 },
        { id: 'l2', sourceId: 'resolver', targetId: 'auth', delayMs: 14 },
      ],
      dnssecProtocol.steps,
      [
        { stepIndex: 0, fromId: 'client', toId: 'resolver', protocol: 'DNSSEC', colorCategory: 'dns', info: 'Query A bank.example.com (EDNS0 DO=1, AD=1)', osiLayer: 7, isUdp: true, srcPort: 54111, dstPort: 53, sizeBytes: 86 },
        { stepIndex: 0, fromId: 'resolver', toId: 'auth', protocol: 'DNSSEC', colorCategory: 'dns', info: 'Query A + DNSKEY bank.example.com (DO=1)', osiLayer: 7, isUdp: true, srcPort: 55111, dstPort: 53, sizeBytes: 86 },
        { stepIndex: 1, fromId: 'auth', toId: 'resolver', protocol: 'DNSSEC', colorCategory: 'dns', info: 'Response: A 203.0.113.10 + RRSIG + DNSKEY', osiLayer: 7, isUdp: true, srcPort: 53, dstPort: 55111, sizeBytes: 540 },
        { stepIndex: 2, fromId: 'resolver', toId: 'client', protocol: 'DNSSEC', colorCategory: opts.packetLoss ? 'error' : 'dns', info: opts.packetLoss ? 'SERVFAIL (Bogus RRSIG Signature Rejected!)' : 'Validated Response (AD=1): A 203.0.113.10', osiLayer: 7, isUdp: true, srcPort: 53, dstPort: 54111, sizeBytes: 112 },
      ],
      opts
    ),
};
