// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Header } from '../../components/common/Header';
import { AnnotatedCaption } from '../../components/common/AnnotatedCaption';
import { ExploreWorkspace } from '../../components/explore/ExploreWorkspace';
import { SimCanvas } from '../../components/simulator/SimCanvas';
import { SimulatorWorkspace } from '../../components/simulator/SimulatorWorkspace';
import { TerminalEmulator } from '../../components/simulator/TerminalEmulator';
import { createDefaultInterface, SimulationEngine } from '../../engine/simulator';
import { PRESET_LABS } from '../../simulator/labs';
import { useAppStore } from '../../store/useAppStore';

afterEach(() => {
  useAppStore.getState().setLanguage('en');
  useAppStore.getState().setTheme('light');
  useAppStore.getState().setExperienceLevel('simple');
  useAppStore.getState().setSimPlaying(false);
  useAppStore.getState().reopenWelcome();
  cleanup();
});

describe('UI Components Integration (SimCanvas, SimulatorWorkspace, TerminalEmulator, ExploreWorkspace, Header)', () => {
  it('renders SimCanvas with hardware port badges, zoom controls, and Connect Cable / Port Picker flow', () => {
    const lab = PRESET_LABS[0];
    const onConnectPorts = vi.fn();
    const onToggleConnectMode = vi.fn();

    render(
      <SimCanvas
        devices={lab.devices}
        links={lab.links}
        packets={[]}
        selectedDeviceId={lab.devices[0].id}
        selectedLinkId={null}
        connectMode={true}
        linkMedium="ethernet"
        canUndo={false}
        canRedo={false}
        annotations={[]}
        onToggleConnectMode={onToggleConnectMode}
        onChangeMedium={() => undefined}
        onSelectDevice={() => undefined}
        onSelectLink={() => undefined}
        onMoveDevice={() => undefined}
        onCommitMove={() => undefined}
        onConnectPorts={onConnectPorts}
        onToggleLinkUp={() => undefined}
        onDropNewDevice={() => undefined}
        onDeleteSelected={() => undefined}
        onAutoLayout={() => undefined}
        onUndo={() => undefined}
        onRedo={() => undefined}
        onAddAnnotation={() => undefined}
        onRemoveAnnotation={() => undefined}
        onInspectPacket={() => undefined}
      />
    );

    // Zoom In / Reset / Zoom Out update zoom readout and SVG viewBox
    const zoomLabel = screen.getByLabelText('Reset Zoom');
    expect(zoomLabel.textContent).toBe('100%');
    fireEvent.click(screen.getByLabelText('Zoom In'));
    expect(zoomLabel.textContent).toBe('115%');
    fireEvent.click(screen.getByLabelText('Zoom Out'));
    expect(zoomLabel.textContent).toBe('100%');
    fireEvent.click(screen.getByLabelText('Zoom In'));
    fireEvent.click(zoomLabel);
    expect(zoomLabel.textContent).toBe('100%');

    // Escape exits connect mode
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onToggleConnectMode).toHaveBeenCalledWith(false);

    // Export SVG & Export PNG buttons are present on canvas HUD
    expect(screen.getByLabelText('Export SVG')).toBeTruthy();
    expect(screen.getByLabelText('Export PNG')).toBeTruthy();

    // Clicking multi-port Wi-Fi Router in connect mode opens Port Picker showing lan0 & wan0
    const routerLabel = screen.getByText('Wi-Fi Router');
    fireEvent.mouseDown(routerLabel);
    const picker = screen.getByRole('dialog', { name: /Select port on Wi-Fi Router/i });
    expect(picker.textContent).toContain('lan0');
    expect(picker.textContent).toContain('wan0');
  });

  it('executes commands, navigates history, and clears TerminalEmulator', () => {
    const dev = {
      id: 'pc',
      name: 'PC1',
      role: 'host' as const,
      x: 0,
      y: 0,
      poweredOn: true,
      interfaces: [createDefaultInterface('eth0', 'eth0', '192.168.1.10')],
      routingTable: [],
      arpCache: [],
      macTable: [],
      natTable: [],
      firewallRules: [],
      services: {},
      openPorts: [80],
      cpuLoad: 5,
    };
    const eng = new SimulationEngine({ seed: 1, devices: [dev], links: [] });

    render(
      <TerminalEmulator
        devices={[dev]}
        activeDeviceId="pc"
        onSelectDevice={() => undefined}
        onExecute={(id, cmd) => eng.execCommand(id, cmd)}
      />
    );

    const input = screen.getByLabelText('CLI command input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ipconfig' } });
    fireEvent.submit(input.closest('form')!);
    expect(screen.getByText(/inet 192\.168\.1\.10\s+netmask 255\.255\.255\.0/)).toBeTruthy();

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('ipconfig');

    fireEvent.change(input, { target: { value: 'clear' } });
    fireEvent.submit(input.closest('form')!);
    expect(screen.queryByText(/gg-net shell ready/)).toBeNull();
  });

  it('switches ExploreWorkspace between Network and Sequence views and adjusts zoom', () => {
    useAppStore.getState().selectProtocol('http', 0);
    render(<ExploreWorkspace />);

    expect(screen.getByRole('img', { name: /network topology animation diagram/i })).toBeTruthy();
    const zoomBtn = screen.getByLabelText('Reset Zoom');
    fireEvent.click(screen.getByLabelText('Zoom In'));
    expect(zoomBtn.textContent).toBe('115%');

    // Switch to Sequence view and test Sequence Zoom
    fireEvent.click(screen.getByRole('button', { name: /Sequence/i }));
    expect(screen.getByRole('img', { name: /Protocol sequence ladder diagram/i })).toBeTruthy();
    const seqZoomBtn = screen.getByLabelText('Reset Zoom');
    expect(seqZoomBtn.textContent).toBe('100%');
    fireEvent.click(screen.getByLabelText('Zoom In'));
    expect(seqZoomBtn.textContent).toBe('115%');
  });

  it('supports Quick-Start Welcome Guide, Simple/Pro mode progressive disclosure, theme toggle, and 6-language RTL switching', () => {
    useAppStore.getState().setExperienceLevel('simple');
    useAppStore.getState().reopenWelcome();
    useAppStore.getState().selectProtocol('http', 0);

    render(
      <>
        <Header />
        <ExploreWorkspace />
      </>
    );

    // Quick-Start Entry Site renders in Simple mode, Compare button is hidden until Pro mode
    expect(screen.getByText(/First-Time Quick Start/i)).toBeTruthy();
    expect(screen.getByRole('region', { name: /Platform Capabilities/i })).toBeTruthy();
    expect(screen.getByText(/Curated Protocol Pathways/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Compare$/i })).toBeNull();
    expect(screen.getByRole('button', { name: /Open Network Simulator/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Launch Topology Studio/i })).toBeTruthy();

    // Switch to Pro mode from Header
    fireEvent.click(screen.getByRole('button', { name: /^Pro$/i }));
    expect(useAppStore.getState().experienceLevel).toBe('pro');
    expect(screen.getAllByRole('button', { name: /^Compare$/i }).length).toBeGreaterThanOrEqual(1);

    // Clicking Open Network Simulator updates workspace mode cleanly
    fireEvent.click(screen.getByRole('button', { name: /Open Network Simulator/i }));
    expect(useAppStore.getState().mode).toBe('simulator');
    useAppStore.getState().setMode('explore');

    // Hide Quick-Start Entry Site
    fireEvent.click(screen.getByRole('button', { name: /Hide guide/i }));
    expect(screen.queryByText(/First-Time Quick Start/i)).toBeNull();
    expect(screen.queryByRole('region', { name: /Platform Capabilities/i })).toBeNull();

    // Toggle theme Crisp Daylight <-> Deep Ocean Slate
    fireEvent.click(screen.getByLabelText(/Switch to Deep Ocean Slate/i));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    fireEvent.click(screen.getByLabelText(/Switch to Crisp Daylight/i));
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    // Switch language to Arabic (RTL) and Spanish (LTR)
    const langSelect = screen.getByLabelText(/Select Language/i) as HTMLSelectElement;
    fireEvent.change(langSelect, { target: { value: 'ar' } });
    expect(document.documentElement.dir).toBe('rtl');
    expect(useAppStore.getState().language).toBe('ar');

    fireEvent.change(langSelect, { target: { value: 'es' } });
    expect(document.documentElement.dir).toBe('ltr');
    expect(useAppStore.getState().language).toBe('es');
  });

  it('supports Step-by-Step playback mode with single-step forward/back, pause/resume, rewind, and synced capture log', () => {
    useAppStore.getState().loadLab(PRESET_LABS[0].id);
    render(<SimulatorWorkspace />);

    // Switch from Live mode to Step-by-Step mode
    fireEvent.click(screen.getByRole('button', { name: /^Step-by-Step$/i }));
    const stepBar = screen.getByRole('region', { name: /Step-by-Step/i });
    expect(stepBar.textContent).toContain('Step 0 / 0');

    // Single-step forward seeds the lab and reveals Packet #1 only
    fireEvent.click(screen.getByLabelText('Single Step Next Event'));
    expect(stepBar.textContent).toMatch(/Step 1 \/ [1-9]\d*/);
    expect(stepBar.textContent).toContain('#1 ·');
    expect(screen.getByRole('button', { name: /Capture \(1\)/i })).toBeTruthy();

    // Advance to Step 2 and step back to Step 1
    fireEvent.click(screen.getByLabelText('Single Step Next Event'));
    expect(stepBar.textContent).toMatch(/Step 2 \/ [2-9]\d*/);
    expect(screen.getByRole('button', { name: /Capture \(2\)/i })).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Step Back One Event'));
    expect(stepBar.textContent).toMatch(/Step 1 \/ [2-9]\d*/);
    expect(screen.getByRole('button', { name: /Capture \(1\)/i })).toBeTruthy();

    // Resume and Pause step playback
    fireEvent.click(screen.getByLabelText('Resume Step Playback'));
    expect(useAppStore.getState().simPlaying).toBe(true);
    fireEvent.click(screen.getByLabelText('Pause Step Playback'));
    expect(useAppStore.getState().simPlaying).toBe(false);

    // Rewind returns timeline cursor to Step 0
    fireEvent.click(screen.getByTitle(/^Rewind/i));
    expect(stepBar.textContent).toMatch(/Step 0 \/ [2-9]\d*/);
    expect(screen.getByRole('button', { name: /Capture \(0\)/i })).toBeTruthy();
  });

  it('supports global playback keyboard shortcuts while ignoring input fields and open modals', () => {
    useAppStore.getState().loadLab(PRESET_LABS[0].id);
    useAppStore.getState().setSimSpeed(1);
    render(<SimulatorWorkspace />);

    // M switches Live -> Step-by-Step
    fireEvent.keyDown(window, { key: 'm' });
    const stepBar = screen.getByRole('region', { name: /Step-by-Step/i });
    expect(stepBar.textContent).toContain('Step 0 / 0');

    // ArrowRight seeds and advances Step 1 -> Step 2, ArrowLeft returns to Step 1
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(stepBar.textContent).toMatch(/Step 1 \/ [2-9]\d*/);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(stepBar.textContent).toMatch(/Step 2 \/ [2-9]\d*/);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(stepBar.textContent).toMatch(/Step 1 \/ [2-9]\d*/);

    // Space toggles play/pause in Step-by-Step
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(useAppStore.getState().simPlaying).toBe(true);
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(useAppStore.getState().simPlaying).toBe(false);

    // + and - step simulation speed
    fireEvent.keyDown(window, { key: '+' });
    expect(useAppStore.getState().simSpeed).toBe(2);
    fireEvent.keyDown(window, { key: '-' });
    expect(useAppStore.getState().simSpeed).toBe(1);

    // End jumps to last packet, Home rewinds to Step 0
    fireEvent.keyDown(window, { key: 'End' });
    expect(stepBar.textContent).not.toContain('Step 0 /');
    expect(stepBar.textContent).not.toContain('Step 1 /');
    fireEvent.keyDown(window, { key: 'Home' });
    expect(stepBar.textContent).toMatch(/Step 0 \/ [2-9]\d*/);

    // Shortcuts must NOT fire when focus is inside an input field (e.g., capture display filter)
    const filterInput = screen.getByLabelText('Wireshark capture display filter');
    fireEvent.keyDown(filterInput, { key: 'ArrowRight' });
    expect(stepBar.textContent).toMatch(/Step 0 \/ [2-9]\d*/);
    fireEvent.keyDown(filterInput, { key: ' ', code: 'Space' });
    expect(useAppStore.getState().simPlaying).toBe(false);

    // '?' opens Playback Shortcuts help strip and Escape closes it
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByRole('dialog', { name: /Playback Shortcuts/i })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /Playback Shortcuts/i })).toBeNull();

    // R resets simulation packets, M returns to Live mode
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(stepBar.textContent).toMatch(/Step 1 \/ [2-9]\d*/);
    fireEvent.keyDown(window, { key: 'r' });
    expect(stepBar.textContent).toContain('Step 0 / 0');
    fireEvent.keyDown(window, { key: 'm' });
    expect(screen.queryByRole('region', { name: /Step-by-Step/i })).toBeNull();
  });

  it('starts animated Live packet playback when clicking Run on an idle topology and updates packet positions across rAF frames', async () => {
    useAppStore.getState().loadLab(PRESET_LABS[0].id);
    const rafQueue: Array<(t: number) => void> = [];
    const origRaf = window.requestAnimationFrame;
    const origCancel = window.cancelAnimationFrame;
    let fakeNow = 1000;
    const perfSpy = vi.spyOn(performance, 'now').mockImplementation(() => fakeNow);
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafQueue.push(cb);
      return rafQueue.length;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = (() => undefined) as typeof window.cancelAnimationFrame;

    try {
      const { container } = render(<SimulatorWorkspace />);

      expect(screen.getByText(/Ready · Press Run/i)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /^Run$/i }));

      // Remains playing in Live mode, reveals packet #1 first, and renders active canvas indicator
      expect(useAppStore.getState().simPlaying).toBe(true);
      expect(screen.getByRole('button', { name: /^Pause$/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Capture \(1\)/i })).toBeTruthy();
      expect(screen.getByText(/Running · #1/i)).toBeTruthy();

      const pktEl = container.querySelector('g[data-packet-id]') as SVGGElement | null;
      expect(pktEl).toBeTruthy();
      const initialTransform = pktEl!.getAttribute('transform');
      const initialProg = Number(pktEl!.getAttribute('data-packet-progress'));

      // Advance simulated rAF frame clock by 220ms and flush animation frame callback
      fakeNow += 220;
      const cb = rafQueue.shift();
      expect(cb).toBeTypeOf('function');
      await Promise.resolve();
      fireEvent(window, new Event('noop'));
      const { act } = await import('@testing-library/react');
      act(() => {
        cb!(fakeNow);
      });

      const nextEl = container.querySelector('g[data-packet-id]') as SVGGElement | null;
      const nextProg = Number(nextEl!.getAttribute('data-packet-progress'));
      expect(nextProg).toBeGreaterThan(initialProg);
      expect(nextEl!.getAttribute('transform')).not.toBe(initialTransform);

      // Pause stops playback cleanly
      fireEvent.click(screen.getByRole('button', { name: /^Pause$/i }));
      expect(useAppStore.getState().simPlaying).toBe(false);
    } finally {
      perfSpy.mockRestore();
      window.requestAnimationFrame = origRaf;
      window.cancelAnimationFrame = origCancel;
    }
  });

  it('renders curved SVG connections for non-direct nodes and animates packets along the Bezier curve across animation ticks', async () => {
    const dhcpLab = PRESET_LABS.find((l) => l.id === 'lab-5-dhcp-relay')!;
    const eng = new SimulationEngine({ seed: 42, devices: dhcpLab.devices, links: dhcpLab.links });
    dhcpLab.onSolve?.(eng);

    const nonDirectPkt = eng.packets.find((p) => p.curvedPath?.isNonDirect);
    expect(nonDirectPkt).toBeDefined();

    const rafQueue: Array<(t: number) => void> = [];
    const origRaf = window.requestAnimationFrame;
    const origCancel = window.cancelAnimationFrame;
    let fakeNow = 2000;
    const perfSpy = vi.spyOn(performance, 'now').mockImplementation(() => fakeNow);
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafQueue.push(cb);
      return rafQueue.length;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = (() => undefined) as typeof window.cancelAnimationFrame;

    try {
      const baseProps = {
        devices: dhcpLab.devices,
        links: dhcpLab.links,
        packets: [nonDirectPkt!],
        selectedDeviceId: null,
        selectedLinkId: null,
        connectMode: false,
        linkMedium: 'ethernet' as const,
        canUndo: false,
        canRedo: false,
        annotations: [],
        activePacketId: nonDirectPkt!.id,
        simPlaying: false,
        stepDurationMs: 720,
        onToggleConnectMode: () => undefined,
        onChangeMedium: () => undefined,
        onSelectDevice: () => undefined,
        onSelectLink: () => undefined,
        onMoveDevice: () => undefined,
        onCommitMove: () => undefined,
        onConnectPorts: () => undefined,
        onToggleLinkUp: () => undefined,
        onDropNewDevice: () => undefined,
        onDeleteSelected: () => undefined,
        onAutoLayout: () => undefined,
        onUndo: () => undefined,
        onRedo: () => undefined,
        onAddAnnotation: () => undefined,
        onRemoveAnnotation: () => undefined,
        onInspectPacket: () => undefined,
      };

      const { container, rerender } = render(<SimCanvas {...baseProps} animationTick={1} />);

      const curvedPath = container.querySelector(`path[data-curved-connection="${nonDirectPkt!.id}"]`);
      expect(curvedPath).toBeTruthy();
      expect(curvedPath!.getAttribute('d')).toContain('Q ');

      const pktEl = container.querySelector(`g[data-packet-id="${nonDirectPkt!.id}"]`) as SVGGElement | null;
      expect(pktEl).toBeTruthy();
      expect(pktEl!.getAttribute('data-packet-curved')).toBe('true');
      expect(pktEl!.getAttribute('data-packet-non-direct')).toBe('true');
      expect(pktEl!.getAttribute('data-packet-tick')).toBe('1');
      expect(pktEl!.style.transition).toContain('transform');

      const parseTranslate = (attr: string | null) => {
        const m = attr?.match(/translate\(([-0-9.]+),\s*([-0-9.]+)\)/);
        return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
      };

      const posStart = parseTranslate(pktEl!.getAttribute('transform'));
      expect(posStart).toBeTruthy();

      // Trigger next animation tick and flush rAF partway through curve traversal
      rerender(<SimCanvas {...baseProps} simPlaying={true} animationTick={2} />);
      fakeNow += 260;
      const cb = rafQueue.pop();
      expect(cb).toBeTypeOf('function');
      const { act } = await import('@testing-library/react');
      act(() => {
        cb!(fakeNow);
      });

      const nextPktEl = container.querySelector(`g[data-packet-id="${nonDirectPkt!.id}"]`) as SVGGElement | null;
      expect(nextPktEl!.getAttribute('data-packet-tick')).toBe('2');
      const posMid = parseTranslate(nextPktEl!.getAttribute('transform'));
      expect(posMid).toBeTruthy();
      expect(posMid!.x).not.toBe(posStart!.x);
      // Curved trajectory deviates markedly from the y=220 horizontal chord between dhcp and client
      expect(Math.abs(posMid!.y - 220)).toBeGreaterThan(20);
    } finally {
      perfSpy.mockRestore();
      window.requestAnimationFrame = origRaf;
      window.cancelAnimationFrame = origCancel;
    }
  });

  it('exposes Live Metrics & Tables in Simple mode, applies Starter Templates with Undo, and highlights multi-hop routes + node table popover', () => {
    useAppStore.getState().setExperienceLevel('simple');
    useAppStore.getState().loadLab(PRESET_LABS[0].id);

    const { container } = render(<SimulatorWorkspace />);

    // Both Metrics and Tables tabs are available in Simple mode
    const metricsTab = screen.getByRole('button', { name: /^Metrics$/i });
    const tablesTab = screen.getByRole('button', { name: /^Tables$/i });
    expect(metricsTab).toBeTruthy();
    expect(tablesTab).toBeTruthy();

    // Open Metrics before running -> shows empty prompt and 0 Kbps KPI
    fireEvent.click(metricsTab);
    expect(screen.getByTestId('kpi-throughput').textContent).toBe('0 Kbps');
    expect(screen.getByText(/Press Run or Step to generate traffic/i)).toBeTruthy();

    // Step forward in Step-by-Step mode -> live throughput SVG chart renders & multi-hop links/nodes illuminate
    fireEvent.click(screen.getByRole('button', { name: /^Step-by-Step$/i }));
    fireEvent.click(screen.getByLabelText('Single Step Next Event'));

    // Jump to an ICMP/TCP multi-hop packet after ARP if step 1 is ARP
    let guard = 0;
    while (container.querySelectorAll('path[data-multihop-link]').length < 2 && guard < 4) {
      fireEvent.click(screen.getByLabelText('Single Step Next Event'));
      guard++;
    }
    expect(container.querySelectorAll('path[data-multihop-link]').length).toBeGreaterThanOrEqual(2);
    expect(container.querySelectorAll('g[data-multihop-node]').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByTestId('live-throughput-chart')).toBeTruthy();
    expect(screen.getByTestId('kpi-throughput').textContent).not.toBe('0 Kbps');

    // Inspect node tables directly on canvas for Wi-Fi Router (has Routing & NAT entries)
    fireEvent.mouseDown(screen.getByText('Wi-Fi Router'));
    const inspectBtn = container.querySelector('g[data-inspect-tables="homerouter"]') as SVGGElement | null;
    expect(inspectBtn).toBeTruthy();
    fireEvent.mouseDown(inspectBtn!);

    const popover = screen.getByTestId('node-tables-popover');
    expect(popover.textContent).toContain('Wi-Fi Router');
    fireEvent.click(popover.querySelector('[role="tab"]:nth-child(2)')!); // Routing tab
    expect(popover.textContent).toContain('192.168.1.0');
    fireEvent.click(screen.getByLabelText('Close node tables'));
    expect(screen.queryByTestId('node-tables-popover')).toBeNull();

    // Apply Starter Template in Simple mode -> replaces topology, Undo restores original node count
    expect(screen.getByText('4 nodes · 3 links')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Templates$/i }));
    const templateCard = container.querySelector('button[data-template-id="tpl-soho-nat"]') as HTMLButtonElement | null;
    expect(templateCard).toBeTruthy();
    fireEvent.click(templateCard!);
    expect(screen.getByText('5 nodes · 4 links')).toBeTruthy();
    expect(screen.getByText('ISP Edge')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Undo'));
    expect(screen.getByText('4 nodes · 3 links')).toBeTruthy();
    expect(screen.getByText('Wi-Fi Router')).toBeTruthy();
  });

  it('renders interactive AnnotatedCaption and portaled glossary tooltips without canvas collision', () => {
    render(<AnnotatedCaption text="Stub resolver queries 8.8.8.8, which walks the DNS hierarchy" />);

    // Term button should exist
    const dnsButton = screen.getByRole('button', { name: /DNS/i });
    expect(dnsButton).toBeDefined();

    // Clicking opens tooltip portal in document.body
    fireEvent.click(dnsButton);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeDefined();
    expect(tooltip.textContent).toContain('Domain Name System');
    expect(tooltip.textContent).toContain('RFC 1035');

    // Close button dismisses it
    const closeBtn = screen.getByLabelText('Close tooltip');
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

