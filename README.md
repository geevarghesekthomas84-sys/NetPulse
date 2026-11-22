# NetPulse

Interactive internet protocols, a Wireshark-style packet inspector and a Packet Tracer-style network
simulator. Everything runs in the browser: no sign-up, no tracking, nothing uploaded.

## What's inside

- **Explore**: 39 protocols (DNS, TCP, TLS, HTTP, BGP, DHCP and more) as step-by-step animations with plain-English
  notes, a packet inspector with hex view, a sequence view, and a follow-the-step camera. Open your own `.pcap`
  captures from Wireshark or tcpdump.
- **Simulator**: drag routers, switches, PCs and servers onto a canvas and cable them up. Configure devices from an
  IOS-style CLI (`enable`, `configure terminal`, `interface`, `ip address`, `vlan`, `router ospf`/`rip`/`bgp` with
  `network` statements, `ip nat`, `access-list`, `ip helper-address`, `show ...`), use DHCP, a PC desktop, and send
  test packets (PDUs) with a per-packet event list. 20 guided labs.
- **Learn**: quizzes with a "review what you missed" round, port and packet games, "Break it" troubleshooting
  challenges, a subnet calculator, and a daily streak.
- **Six languages** (English, Español, العربية, हिन्दी, മലയാളം, தமிழ்) with right-to-left support, light and dark
  themes, and installable offline use (PWA).

## Run it

```bash
npm install --legacy-peer-deps
npm run dev        # http://localhost:3000
```

```bash
npm run build      # production build in dist/
npm run preview    # serve the build locally
npm test           # unit and integration tests (vitest)
npm run lint       # type-check
```

## Project layout

| Path | What lives there |
| --- | --- |
| `src/engine/` | Discrete-event network engine: packets, TCP, routing, the IOS-style CLI (`ios.ts`), DHCP, PDUs |
| `src/protocols/` | The 39 protocol scenarios (steps, packets, quizzes) |
| `src/components/explore/` | Explore diagram, step panel, packet table, capture viewer |
| `src/components/simulator/` | Canvas, device palette, properties panel, terminal, PDU and desktop windows |
| `src/components/learn/` | Quizzes, review, games, challenges, tools |
| `src/components/landing/` | Landing page |
| `src/components/icons/WireDevices.tsx` | Isometric wireframe device art |
| `src/i18n/` | UI strings per language, plus `content/` translations of lesson text |
| `src/tests/` | Unit and integration tests |

## Translations

UI text lives in `src/i18n/<lang>.json` (a test keeps all six languages in step). Lesson text is translated
through English-keyed dictionaries in `src/i18n/content/<lang>.json`; a test fails if an entry is missing or
stale.

## Saved data

Settings and progress are stored in the browser under `netpulse-*` keys. Older `gg-*` keys are moved over
automatically the first time the app loads.

## Deploying

`npm run build` produces a static site in `dist/` (service worker included). Serve it from any static host over
HTTPS. The share image is `public/og.png` and the page's social tags are in `index.html`.

## Credits

Monospace type is [Iosevka](https://typeface.app/iosevka) (SIL Open Font License).
