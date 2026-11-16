# Simulator Analytics, Multi-Hop Path Highlighting, Node Table Overlays & Starter Templates

This plan introduces live throughput and protocol analytics charts, end-to-end multi-hop path highlighting during packet animation, direct on-canvas ARP/NAT/routing table inspection overlays, and one-click starter topology templates—available seamlessly in both Simple and Pro modes across all six languages.

### User Review & Critical Decisions

> [!IMPORTANT] All core product directions were confirmed during clarification. One optional UX detail is noted below with a recommended default.

- **Confirmed Focus Area**: Live throughput charts and packet analytics derived from real-time simulation traffic.
- **Confirmed Capabilities**:
  1. Full multi-hop path highlighting across traversed links and relay nodes during packet animation.
  2. Direct on-canvas inspection popovers for ARP caches, NAT translation tables, MAC tables, and L3 routing tables.
  3. One-click starter topology templates for common network architectures.
- **Confirmed Mode Availability**: Available in both **Simple** and **Pro** modes with full six-language translation and RTL support.
- **Open Choice — Template Selection Behavior (Recommended Default)**: Selecting a starter template will push the previous topology onto the Undo stack before replacing the canvas, so accidental template clicks can be reversed in one click without losing custom edits.

---

### 1. Overview & Core Concept

- **What It Does**: Transforms the network simulator from a single-hop visualizer into an interactive diagnostic workbench where users can spawn proven network architectures in one click, watch packets illuminate their entire multi-hop route in motion, click any router/switch/host on the canvas to inspect live ARP/NAT/routing state, and observe live throughput, protocol mix, and latency curves update as frames arrive.
- **Target Audience**: First-time learners in Simple mode building intuition for how packets cross routers and switches, as well as advanced users in Pro mode diagnosing bottlenecks, NAT bindings, and route convergence.
- **Key Value**: Connects every animated packet directly to its end-to-end network path, device forwarding state, and aggregate link performance without forcing users to hunt through separate hidden panels.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **One-Click Starter Templates**: From the simulator toolbar (or canvas empty state), users open the **Templates** popover, choose an architecture (such as *SOHO Wi-Fi & NAT*, *Dual-LAN Router*, *Firewall & DMZ*, *VLAN Switch Trunk*, or *Load-Balanced Web Tier*), and immediately see the wired topology centered on the blueprint grid—with Undo available to revert.
  2. **Animated Multi-Hop Flow**: Pressing **Run** or stepping forward animates the active packet along its hop or curved connection while illuminating every link in its end-to-end route (`src → relay → dst`) with a directional flow halo and clean hop indicators (`1`, `2`, `3`) on traversed nodes.
  3. **On-Canvas Node Table Inspector**: Clicking the compact table inspect button on a selected or hovered device opens an anchored overlay card beside that node showing segmented tabs (**ARP**, **Routing**, **NAT**, **MAC**) with live tabular rows and empty-state guidance when a table has no learned entries yet.
  4. **Live Throughput & Analytics**: Opening the **Metrics** dock tab (now visible in both Simple and Pro modes) shows real-time SVG time-series throughput/goodput sparklines, a protocol breakdown bar chart, link utilization gauges, and summary KPIs using tabular numerals that update dynamically at each playback tick.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Clean educational instrumentation paired with disciplined SaaS telemetry—preserving the existing **Crisp Daylight** (light) and **Deep Ocean Slate** (dark) semantic theme tokens (`--bg-canvas`, `--bg-surface`, `--bg-inset`, `--accent-primary`, `--accent-teal`).
  - *Color Budget (60-30-10)*: 60% neutral canvas/blueprint grid, 30% single-elevation structural panels with `1px` hairline borders (`--border-hairline`), and 10% Cobalt/Teal focal accents reserved strictly for active route highlights, active chart series, and primary buttons.
  - *Typography & Tabular Discipline*: Uses `Plus Jakarta Sans` for headers, `DM Sans` for readable prose/labels, and `JetBrains Mono` with `tabular-nums` on every throughput figure, IP/MAC address, port translation, and hop index.
  - *Dual-Coded States & Zero-Pill Discipline*: Nominal, warning, and dropped metrics always combine semantic color with explicit icon or text indicators (`Nominal`, `Loss`, `Blocked`), and metadata uses quiet typographic `·` separators rather than pill enclosures.

- **Interactive Feedback & Motion**:
  - Chart updates, popover reveals, and route highlight transitions stay within the `≤ 200ms` compositor budget (`transform`, `opacity`), automatically honoring reduced-motion preferences.
  - Empty states clearly explain how to trigger data (for instance, *"Run a ping or demo to populate throughput curves and ARP entries"*).

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Cursor-Synced Analytics Computation**
  - *Chosen Approach*: Compute live throughput time-buckets, protocol counts, and latency stats dynamically up to the active Live/Step playback cursor rather than showing final post-run totals immediately.
  - *Why*: As packets animate across the canvas step by step, learners see throughput curves, protocol bars, and link utilization rise in lockstep with what is happening visually on screen.
  - *Alternatives Considered*: Showing static end-of-simulation totals only, which breaks the connection between animated packet playback and live analytics.

- **Decision 2: Anchored Node Table Overlay + Synchronized Dock Tab**
  - *Chosen Approach*: Render an on-canvas node popover for quick ARP/NAT/Routing/MAC inspection right next to the node, while also enabling the **Tables** dock tab in both Simple and Pro modes.
  - *Why*: Users do not lose spatial context when checking a router's NAT bindings or routing table mid-simulation, yet still have a wide multi-column deck when comparing large tables.
  - *Alternatives Considered*: A modal dialog, which obscures the topology canvas and blocks side-by-side observation during playback.

- **Decision 3: Multi-Hop Route Grouping vs. Per-Hop Envelopes**
  - *Chosen Approach*: Tag multi-hop packets emitted from a single logical transmission with their end-to-end `flowRouteNodeIds` and `flowLinkIds`, while still keeping individual hop packets inspectable in the Wireshark capture table.
  - *Why*: Preserves realistic hop-by-hop TTL, NAT, and MAC header changes per hop while enabling full-path illumination across the topology.
  - *Alternatives Considered*: Merging multi-hop transmissions into a single packet, which would hide per-hop L2/L3 header mutations.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                         Simulator Workspace State                         │
│  Topology (Devices/Links) · Playback Cursor & Tick · Selected Node/Flow   │
└──────────────┬─────────────────────────┬──────────────────┬───────────────┘
               │                         │                  │
               ▼                         ▼                  ▼
┌──────────────────────────┐ ┌───────────────────┐ ┌────────────────────────┐
│   Template Catalog &     │ │  Simulation Engine│ │   Analytics Aggregator │
│   Undo History Manager   │ │  (Route + Flow    │ │  (Time-Bucket Kbps,    │
│  - 5+ Starter Topologies │ │   Link Tracking)  │ │   Protocol Mix, Drops) │
└──────────────┬───────────┘ └─────────┬─────────┘ └───────────┬────────────┘
               │                       │                       │
               ▼                       ▼                       ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                        Simulator UI & Canvas Stage                        │
│                                                                           │
│  ┌──────────────────────────────┐   ┌──────────────────────────────────┐  │
│  │ Toolbar & Starter Templates  │   │ Anchored Node Table Popover      │  │
│  │ - One-Click Architecture Load│   │ - ARP · Routing · NAT · MAC Tabs │  │
│  └──────────────────────────────┘   └──────────────────────────────────┘  │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ Interactive SVG Canvas                                              │  │
│  │ - Full Multi-Hop Route Halo & Hop Badges (1, 2, 3...)               │  │
│  │ - Animated Packet + Curved Non-Direct Connections                   │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ Docked Analytics & Inspection Deck (Simple & Pro)                   │  │
│  │ - Live Throughput/Goodput SVG Line Chart & Protocol Mix Bars        │  │
│  │ - Link Utilization · TCP cwnd Chart · Full Device Tables            │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - **Multi-Hop Flow Context**: Extend captured packet records with optional `flowPathNodeIds` and `flowLinkIds` populated during multi-hop routing and non-direct path discovery so any active packet carries its full end-to-end topology path.
  - **Time-Series Analytics**: Pure helper aggregating visible packets (sliced to the current playback cursor) into evenly spaced time buckets for throughput (`Kbps`), packet rate, protocol distribution counts, and latency statistics.
  - **Starter Topology Definitions**: Structured catalog of reusable, self-contained device/link/service presets (`SOHO NAT + Wi-Fi`, `Dual-Subnet Static Router`, `DMZ Perimeter Firewall`, `VLAN Trunk Switch`, `DNS + Load Balancer`) with localized names and short descriptions.

- **Interactive Component & State Mapping**:
  - **Template Picker Control**: Clicking a starter template dispatches a history snapshot, loads the template topology into the simulation store, clears stale cursors/selections, and fits the viewport to the new nodes.
  - **Canvas Multi-Hop Overlay**: Reads the focused packet's `flowLinkIds` and `flowPathNodeIds`; highlights traversed links with an animated directional stroke and renders numbered hop markers on intermediate devices while the packet moves.
  - **Canvas Node Inspector Popover**: Triggered from a compact inspect icon on any selected/hovered device; tracks `inspectedTableNodeId` and active table tab (`arp` | `routing` | `nat` | `mac`), reading live device state synced on every simulation tick and closing cleanly via Close button, `Escape`, or clicking empty canvas.
  - **Live Metrics Deck**: Available in both Simple and Pro dock tabs; reacts to `packets` (sliced to playback cursor), rendering interactive SVG coordinate charts with axes, hover tooltips for bucket values, and responsive zero-state prompts.
