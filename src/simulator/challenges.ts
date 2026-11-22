import type { SimDevice, SimLink } from '../engine/types';
import { PRESET_LABS } from './labs';

/**
 * "Break it" challenges: a network that used to work now has one fault.
 * The learner investigates with real simulator commands, names the root cause,
 * and applies the fix; the fix is verified by re-running the failing test.
 *
 * Every faulty behaviour below was chosen because the simulation engine really
 * enforces it (link down, device off, firewall ACL, missing DNS record, wrong
 * subnet), so the symptoms learners see are produced by the engine, not scripted.
 * Text is English and is translated through tc() at render time.
 */
export interface ChallengeOption {
  text: string;
  correct?: boolean;
}

export interface Challenge {
  id: string;
  difficulty: 1 | 2 | 3;
  title: string;
  /** What the "user" reports. */
  symptom: string;
  /** The command that fails now and must succeed after the fix. */
  test: { deviceId: string; cmd: string; successIncludes: string };
  /** One-click starting commands. */
  suggested: Array<{ deviceId: string; cmd: string }>;
  options: ChallengeOption[];
  hints: [string, string];
  fixLabel: string;
  lesson: string;
  build: (fixed: boolean) => { devices: SimDevice[]; links: SimLink[] };
}

function baseLab(id: string) {
  const lab = PRESET_LABS.find((l) => l.id === id);
  if (!lab) throw new Error(`Missing lab ${id}`);
  return lab;
}

function variant(
  labId: string,
  fixed: boolean,
  breakIt: (devices: SimDevice[], links: SimLink[]) => void
): { devices: SimDevice[]; links: SimLink[] } {
  const lab = baseLab(labId);
  const devices = structuredClone(lab.devices);
  const links = structuredClone(lab.links);
  if (!fixed) breakIt(devices, links);
  return { devices, links };
}

const byId = <T extends { id: string }>(list: T[], id: string): T => {
  const found = list.find((x) => x.id === id);
  if (!found) throw new Error(`Missing ${id}`);
  return found;
};

export const CHALLENGES: Challenge[] = [
  {
    id: 'ch-unplugged',
    difficulty: 1,
    title: 'The Silent Laptop',
    symptom: 'Nothing works. The home PC cannot reach the web server and even basic pings fail immediately.',
    test: { deviceId: 'pc', cmd: 'ping 203.0.113.10 -c 2', successIncludes: '2 received, 0% packet loss' },
    suggested: [
      { deviceId: 'pc', cmd: 'ping 203.0.113.10 -c 2' },
      { deviceId: 'pc', cmd: 'ipconfig' },
      { deviceId: 'pc', cmd: 'traceroute 203.0.113.10' },
    ],
    options: [
      { text: 'The cable between the PC and the router is disconnected', correct: true },
      { text: 'The web server firewall is blocking pings' },
      { text: 'The DNS server has no record for the website' },
      { text: 'The PC has the wrong subnet mask' },
    ],
    hints: [
      'The error says "No route / link down" before the packet even leaves the PC.',
      'Use "Check cables and power" to look at the status lights on every device and link.',
    ],
    fixLabel: 'Plug the cable back in',
    lesson:
      'A link that is physically down fails at Layer 1: nothing is sent at all. Always check the lights and cables before blaming software.',
    build: (fixed) =>
      variant('lab-1-home', fixed, (_d, links) => {
        byId(links, 'l1').up = false;
      }),
  },
  {
    id: 'ch-power',
    difficulty: 1,
    title: 'The Dark Router',
    symptom: 'The PC can still see its own network settings, but nothing past the first hop works.',
    test: { deviceId: 'pc', cmd: 'ping 203.0.113.10 -c 2', successIncludes: '2 received, 0% packet loss' },
    suggested: [
      { deviceId: 'pc', cmd: 'ping 203.0.113.10 -c 2' },
      { deviceId: 'pc', cmd: 'ping 192.168.1.1 -c 1' },
      { deviceId: 'pc', cmd: 'traceroute 203.0.113.10' },
    ],
    options: [
      { text: 'The Wi-Fi router is powered off', correct: true },
      { text: 'The ISP is blocking port 80' },
      { text: 'The web server has the wrong IP address' },
      { text: 'The PC has a duplicate IP address' },
    ],
    hints: [
      'Even the router next door cannot be reached, so the problem is at or before the router.',
      'Use "Check cables and power": one device is not powered on.',
    ],
    fixLabel: 'Switch the router on',
    lesson:
      'When the very first hop is silent, test it directly. A powered-off device looks just like a broken link until you check its status.',
    build: (fixed) =>
      variant('lab-1-home', fixed, (devices) => {
        byId(devices, 'homerouter').poweredOn = false;
      }),
  },
  {
    id: 'ch-firewall',
    difficulty: 2,
    title: 'The Over-Eager Firewall',
    symptom: 'Everyone can reach the network, but the website never answers. Traceroute even reaches the server.',
    test: { deviceId: 'pc', cmd: 'ping 203.0.113.10 -c 2', successIncludes: '2 received, 0% packet loss' },
    suggested: [
      { deviceId: 'pc', cmd: 'ping 203.0.113.10 -c 2' },
      { deviceId: 'pc', cmd: 'traceroute 203.0.113.10' },
      { deviceId: 'web', cmd: 'show running-config' },
    ],
    options: [
      { text: 'A firewall rule on the web server drops the traffic', correct: true },
      { text: 'The cable to the ISP is unplugged' },
      { text: 'The router is out of IP addresses' },
      { text: 'The PC is using the wrong DNS server' },
    ],
    hints: [
      'The error names who blocked the packet. Read it carefully.',
      'Run "show running-config" on the web server and look for an access-list line.',
    ],
    fixLabel: 'Remove the blocking firewall rule',
    lesson:
      'If traceroute reaches the destination but traffic is refused, the path is fine: something at the destination, usually a firewall rule, is saying no.',
    build: (fixed) =>
      variant('lab-1-home', fixed, (devices) => {
        const web = byId(devices, 'web');
        web.statefulFirewall = true;
        web.firewallRules = [
          { id: 'fw-deny-web', action: 'deny', direction: 'inbound', protocol: 'TCP', srcIp: 'any', dstIp: 'any', dstPort: 80 },
        ];
      }),
  },
  {
    id: 'ch-dns',
    difficulty: 2,
    title: 'The Missing Name',
    symptom: 'Looking up example.com says the domain does not exist, but it worked yesterday.',
    test: { deviceId: 'c', cmd: 'dig example.com', successIncludes: '203.0.113.10' },
    suggested: [
      { deviceId: 'c', cmd: 'dig example.com' },
      { deviceId: 'c', cmd: 'ipconfig' },
      { deviceId: 'auth', cmd: 'show running-config' },
    ],
    options: [
      { text: 'The authoritative server no longer has a record for example.com', correct: true },
      { text: 'The client cannot reach its DNS resolver' },
      { text: 'The router has stopped doing NAT' },
      { text: 'The root server is powered off' },
    ],
    hints: [
      'The trace shows the resolver was reached and gave a definite answer, so connectivity is fine.',
      'NXDOMAIN means "this name does not exist" according to whoever is responsible for the zone.',
    ],
    fixLabel: 'Add the missing A record',
    lesson:
      'NXDOMAIN is a reply, not a timeout: the network works, but the zone is missing the record. A timeout would point at connectivity instead.',
    build: (fixed) =>
      variant('lab-4-dns-hierarchy', fixed, (devices) => {
        const dns = byId(devices, 'auth').services.dns;
        if (dns) dns.records = [];
      }),
  },
  {
    id: 'ch-subnet',
    difficulty: 3,
    title: 'The Wrong Neighbourhood',
    symptom: 'Host A cannot reach Host B across the router, yet both hosts and the router look healthy.',
    test: { deviceId: 'ha', cmd: 'ping 192.168.2.20 -c 2', successIncludes: '2 received, 0% packet loss' },
    suggested: [
      { deviceId: 'ha', cmd: 'ping 192.168.2.20 -c 2' },
      { deviceId: 'hb', cmd: 'ipconfig' },
      { deviceId: 'r1', cmd: 'ipconfig' },
    ],
    options: [
      { text: "Host B's IP address is in a different subnet than its router interface", correct: true },
      { text: 'Host A has no default gateway configured' },
      { text: 'The router interface for Subnet A is shut down' },
      { text: 'Host B is powered off' },
    ],
    hints: [
      'Compare the address on Host B with the address of the router interface it connects to.',
      'Router interface 192.168.2.1 serves 192.168.2.0/24. Which subnet is Host B really in?',
    ],
    fixLabel: 'Give Host B an address in 192.168.2.0/24',
    lesson:
      'Routers only deliver to the subnet an interface belongs to. A host with an address from the wrong subnet is unreachable even though everything is plugged in and powered on.',
    build: (fixed) =>
      variant('lab-2-two-lans', fixed, (devices) => {
        byId(devices, 'hb').interfaces[0].ip = '192.168.9.20';
      }),
  },
];

/** Stars shown for a finished challenge. */
export function starsForScore(score: number): 1 | 2 | 3 {
  return score >= 80 ? 3 : score >= 55 ? 2 : 1;
}

/** Score = 100, minus penalties; never below 10 once solved. */
export function computeScore(opts: { tools: number; wrongGuesses: number; hints: number }): number {
  const freeTools = 4;
  const raw = 100 - 3 * Math.max(0, opts.tools - freeTools) - 15 * opts.wrongGuesses - 10 * opts.hints;
  return Math.max(10, raw);
}
