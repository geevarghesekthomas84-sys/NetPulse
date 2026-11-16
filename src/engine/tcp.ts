import type { CongestionAlgorithm, TcpControlBlock, TcpFlags } from './types';

export interface CreateTcbOptions {
  id: string;
  localIp: string;
  localPort: number;
  remoteIp: string;
  remotePort: number;
  iss?: number;
  mss?: number;
  rwnd?: number;
  algorithm?: CongestionAlgorithm;
  nagleEnabled?: boolean;
  delayedAckEnabled?: boolean;
  initialState?: TcpControlBlock['state'];
}

export function createTcpControlBlock(opts: CreateTcbOptions): TcpControlBlock {
  const iss = opts.iss ?? 0;
  return {
    id: opts.id,
    localIp: opts.localIp,
    localPort: opts.localPort,
    remoteIp: opts.remoteIp,
    remotePort: opts.remotePort,
    state: opts.initialState ?? 'CLOSED',
    iss,
    sndUna: iss,
    sndNxt: iss,
    rcvNxt: 0,
    cwnd: 2, // IW2 (in MSS segments)
    ssthresh: 16, // initial slow-start threshold (in MSS segments)
    rwnd: opts.rwnd ?? 65535,
    mss: opts.mss ?? 1460,
    srttMs: 0,
    rttvarMs: 0,
    rtoMs: 1000,
    dupAcks: 0,
    algorithm: opts.algorithm ?? 'reno',
    nagleEnabled: opts.nagleEnabled ?? true,
    delayedAckEnabled: opts.delayedAckEnabled ?? false,
    retransmissions: 0,
    cwndHistory: [{ timeMs: 0, cwnd: 2, ssthresh: 16, event: 'INIT' }],
  };
}

/**
 * Updates Jacobson/Karels SRTT, RTTVAR, and RTO (RFC 6298)
 */
export function updateRttEstimate(tcb: TcpControlBlock, sampleRttMs: number): void {
  const r = Math.max(1, sampleRttMs);
  if (tcb.srttMs === 0) {
    tcb.srttMs = r;
    tcb.rttvarMs = r / 2;
  } else {
    tcb.rttvarMs = 0.75 * tcb.rttvarMs + 0.25 * Math.abs(tcb.srttMs - r);
    tcb.srttMs = 0.875 * tcb.srttMs + 0.125 * r;
  }
  tcb.rtoMs = Math.max(200, Math.min(60000, tcb.srttMs + Math.max(10, 4 * tcb.rttvarMs)));
}

/**
 * Handles congestion window growth on new ACK (Slow Start vs Congestion Avoidance for Tahoe, Reno, CUBIC)
 */
export function onNewAckCongestionControl(tcb: TcpControlBlock, timeMs: number): void {
  tcb.dupAcks = 0;
  if (tcb.cwnd < tcb.ssthresh) {
    // Slow Start: exponential growth (+1 MSS per ACK)
    tcb.cwnd = Math.min(64, tcb.cwnd + 1);
  } else {
    // Congestion Avoidance
    if (tcb.algorithm === 'cubic') {
      // Simplified CUBIC growth curve: faster recovery toward Wmax then concave/convex growth
      const k = 0.4;
      const delta = Math.max(0.25, k * Math.pow(Math.max(1, tcb.ssthresh - tcb.cwnd), 0.33));
      tcb.cwnd = Math.min(64, Number((tcb.cwnd + delta / Math.max(1, tcb.cwnd)).toFixed(2)));
    } else {
      // Tahoe & Reno AIMD: +1/cwnd per ACK
      tcb.cwnd = Math.min(64, Number((tcb.cwnd + 1 / Math.max(1, tcb.cwnd)).toFixed(2)));
    }
  }
  tcb.cwndHistory.push({ timeMs, cwnd: tcb.cwnd, ssthresh: tcb.ssthresh, event: 'ACK' });
}

/**
 * Handles 3 duplicate ACKs (Fast Retransmit / Fast Recovery)
 */
export function onTripleDupAck(tcb: TcpControlBlock, timeMs: number): boolean {
  tcb.dupAcks += 1;
  if (tcb.dupAcks === 3) {
    tcb.retransmissions += 1;
    if (tcb.algorithm === 'tahoe') {
      tcb.ssthresh = Math.max(2, Math.floor(tcb.cwnd / 2));
      tcb.cwnd = 1;
    } else if (tcb.algorithm === 'cubic') {
      tcb.ssthresh = Math.max(2, Math.floor(tcb.cwnd * 0.7));
      tcb.cwnd = tcb.ssthresh;
    } else {
      // Reno Fast Recovery
      tcb.ssthresh = Math.max(2, Math.floor(tcb.cwnd / 2));
      tcb.cwnd = tcb.ssthresh + 3;
    }
    tcb.cwndHistory.push({
      timeMs,
      cwnd: tcb.cwnd,
      ssthresh: tcb.ssthresh,
      event: '3-DUP-ACK Fast Retransmit',
    });
    return true;
  }
  return false;
}

/**
 * Handles RTO expiration timeout (all variants drop cwnd to 1 MSS)
 */
export function onRtoTimeout(tcb: TcpControlBlock, timeMs: number): void {
  tcb.retransmissions += 1;
  tcb.ssthresh = Math.max(2, Math.floor(tcb.cwnd / 2));
  tcb.cwnd = 1;
  tcb.dupAcks = 0;
  tcb.rtoMs = Math.min(60000, tcb.rtoMs * 2);
  tcb.cwndHistory.push({
    timeMs,
    cwnd: tcb.cwnd,
    ssthresh: tcb.ssthresh,
    event: 'RTO Timeout',
  });
}

/**
 * Effective send window respecting both congestion window (cwnd * MSS) and receiver advertised window (rwnd).
 */
export function effectiveWindowBytes(tcb: TcpControlBlock): number {
  return Math.min(Math.floor(tcb.cwnd * tcb.mss), tcb.rwnd);
}

/**
 * Advances TCP FSM on segment arrival and returns resulting outgoing control flags (if any).
 */
export function stepTcpFsm(
  tcb: TcpControlBlock,
  incomingFlags: TcpFlags,
  incomingSeq: number,
  incomingAck: number,
  payloadLen: number
): { nextFlags?: TcpFlags; ackToSend?: number } {
  switch (tcb.state) {
    case 'LISTEN':
      if (incomingFlags.syn && !incomingFlags.ack) {
        tcb.rcvNxt = incomingSeq + 1;
        tcb.state = 'SYN_RCVD';
        return {
          nextFlags: { urg: false, ack: true, psh: false, rst: false, syn: true, fin: false },
          ackToSend: tcb.rcvNxt,
        };
      }
      break;

    case 'SYN_SENT':
      if (incomingFlags.syn && incomingFlags.ack) {
        tcb.sndUna = incomingAck;
        tcb.rcvNxt = incomingSeq + 1;
        tcb.state = 'ESTABLISHED';
        return {
          nextFlags: { urg: false, ack: true, psh: false, rst: false, syn: false, fin: false },
          ackToSend: tcb.rcvNxt,
        };
      }
      if (incomingFlags.rst) {
        tcb.state = 'CLOSED';
      }
      break;

    case 'SYN_RCVD':
      if (incomingFlags.ack && !incomingFlags.syn) {
        tcb.sndUna = incomingAck;
        tcb.state = 'ESTABLISHED';
      }
      break;

    case 'ESTABLISHED':
      if (incomingFlags.fin) {
        tcb.rcvNxt = incomingSeq + payloadLen + 1;
        tcb.state = 'CLOSE_WAIT';
        return {
          nextFlags: { urg: false, ack: true, psh: false, rst: false, syn: false, fin: false },
          ackToSend: tcb.rcvNxt,
        };
      }
      if (payloadLen > 0) {
        tcb.rcvNxt = incomingSeq + payloadLen;
        return {
          nextFlags: { urg: false, ack: true, psh: false, rst: false, syn: false, fin: false },
          ackToSend: tcb.rcvNxt,
        };
      }
      if (incomingFlags.ack) {
        if (incomingAck > tcb.sndUna) {
          tcb.sndUna = incomingAck;
        }
      }
      break;

    case 'FIN_WAIT_1':
      if (incomingFlags.fin && incomingFlags.ack) {
        tcb.sndUna = incomingAck;
        tcb.rcvNxt = incomingSeq + 1;
        tcb.state = 'TIME_WAIT';
        return {
          nextFlags: { urg: false, ack: true, psh: false, rst: false, syn: false, fin: false },
          ackToSend: tcb.rcvNxt,
        };
      }
      if (incomingFlags.ack) {
        tcb.sndUna = incomingAck;
        tcb.state = 'FIN_WAIT_2';
      }
      break;

    case 'FIN_WAIT_2':
      if (incomingFlags.fin) {
        tcb.rcvNxt = incomingSeq + 1;
        tcb.state = 'TIME_WAIT';
        return {
          nextFlags: { urg: false, ack: true, psh: false, rst: false, syn: false, fin: false },
          ackToSend: tcb.rcvNxt,
        };
      }
      break;

    case 'CLOSE_WAIT':
      // Local application calls close -> transitions to LAST_ACK
      break;

    case 'LAST_ACK':
      if (incomingFlags.ack) {
        tcb.sndUna = incomingAck;
        tcb.state = 'CLOSED';
      }
      break;

    case 'TIME_WAIT':
      break;
  }

  return {};
}
