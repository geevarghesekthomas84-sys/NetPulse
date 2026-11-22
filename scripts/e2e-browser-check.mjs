import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const DEFAULT_BROWSER = '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell';
const TARGET_URL = process.env.E2E_URL || 'http://127.0.0.1:3000';

async function main() {
  if (!fs.existsSync(DEFAULT_BROWSER)) {
    throw new Error(`Chromium headless shell not found at ${DEFAULT_BROWSER}`);
  }

  const browser = await chromium.launch({
    executablePath: DEFAULT_BROWSER,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const consoleErrors = [];
  const pageErrors = [];

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        // Ignore expected WebSocket HMR notice when disabled
        if (!txt.includes('WebSocket')) consoleErrors.push(txt);
      }
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('header', { timeout: 10000 });

    // 0. Verify Crisp Daylight initial theme, Quick-Start Welcome Guide, Simple/Pro toggle, and 6-language switching
    const title = await page.title();
    assert.ok(title.includes('gg'), `Unexpected page title: ${title}`);

    const isInitialDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    assert.equal(isInitialDark, false, 'Expected initial Crisp Daylight light theme');

    // Quick-Start Welcome Guide visible on first visit
    const welcomeGuide = page.getByRole('region', { name: /First-Time Quick Start/i });
    await welcomeGuide.waitFor();
    await welcomeGuide.getByRole('button', { name: /^DNS$/i }).click();
    await page.getByRole('heading', { name: 'DNS', exact: true }).waitFor();
    await welcomeGuide.getByRole('button', { name: /^HTTP$/i }).click();
    await page.getByRole('heading', { name: 'HTTP', exact: true }).waitFor();
    await welcomeGuide.getByRole('button', { name: /Hide guide/i }).click();
    assert.equal(await page.getByText(/First-Time Quick Start/i).count(), 0);

    // Check computed colors differ in Light & Dark themes
    const lightColors = await page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return { color: s.color, bg: s.backgroundColor };
    });
    assert.notEqual(lightColors.color, lightColors.bg, 'Light mode text & background must have distinct contrast');

    await page.getByLabel(/Switch to Deep Ocean Slate/i).click();
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), true);
    const darkColors = await page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return { color: s.color, bg: s.backgroundColor };
    });
    assert.notEqual(darkColors.color, darkColors.bg, 'Dark mode text & background must have distinct contrast');
    assert.notEqual(darkColors.bg, lightColors.bg, 'Theme switch must change background color');

    await page.getByLabel(/Switch to Crisp Daylight/i).click();
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), false);

    // Verify 6-language switching including Arabic RTL
    const langSelect = page.locator('header select').first();
    await langSelect.selectOption('es');
    await page.locator('header').getByRole('button', { name: /Simulador/i }).waitFor();
    await langSelect.selectOption('ar');
    assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl');
    await langSelect.selectOption('hi');
    assert.equal(await page.evaluate(() => document.documentElement.dir), 'ltr');
    await langSelect.selectOption('ml');
    await langSelect.selectOption('ta');
    await langSelect.selectOption('en');
    assert.equal(await page.evaluate(() => document.documentElement.dir), 'ltr');

    // Simple -> Pro disclosure in Explore
    assert.equal(await page.getByRole('button', { name: /^Compare$/i }).count(), 0);
    await page.locator('header').getByRole('button', { name: /^Pro$/i }).click();
    await page.getByRole('button', { name: /^Compare$/i }).first().waitFor();
    await page.locator('header').getByRole('button', { name: /^Simple$/i }).click();

    // 1. Explore Mode: Network Diagram Zoom + Sequence View Zoom + Playback
    const zoomResetBtn = page.getByLabel('Reset Zoom').first();
    assert.equal(await zoomResetBtn.textContent(), '100%');
    await page.getByLabel('Zoom In').first().click();
    assert.equal(await zoomResetBtn.textContent(), '115%');
    await page.getByLabel('Zoom Out').first().click();
    assert.equal(await zoomResetBtn.textContent(), '100%');

    await page.getByRole('button', { name: /Sequence/i }).click();
    await page.getByRole('img', { name: /Protocol sequence ladder diagram/i }).waitFor();
    await page.getByLabel('Zoom In').first().click();
    assert.equal(await page.getByLabel('Reset Zoom').first().textContent(), '115%');
    await page.getByLabel('Reset Zoom').first().click();
    assert.equal(await page.getByLabel('Reset Zoom').first().textContent(), '100%');

    // Switch back to Network and test Next Packet
    await page.getByRole('button', { name: /^Network$/i }).click();
    await page.getByTitle('Next Packet (Right Arrow)').click();

    // 2. Simulator Mode: Canvas Visibility, Live Run Animation, Zoom, Connect Cable, CLI Terminal, Display Filter
    await page.locator('header').getByRole('button', { name: /Simulator/i }).click();
    const simCanvasEl = page.getByRole('img', { name: /Interactive network simulator canvas/i });
    await simCanvasEl.waitFor();
    const simBox = await simCanvasEl.boundingBox();
    assert.ok(simBox && simBox.width > 400 && simBox.height >= 220, `Simulator canvas must be visibly sized, got ${JSON.stringify(simBox)}`);

    // Click Run in Live mode -> enters animated playback and visibly updates SVG packet coordinates
    await page.getByRole('button', { name: /^Run$/i }).click();
    await page.getByRole('button', { name: /^Pause$/i }).waitFor({ timeout: 3000 });
    await page.waitForSelector('text=/Running · #1/', { timeout: 3000 });
    const firstTransform = await page.locator('g[data-packet-id]').last().getAttribute('transform');
    await page.waitForTimeout(160);
    const movedTransform = await page.locator('g[data-packet-id]').last().getAttribute('transform');
    assert.ok(firstTransform && movedTransform && firstTransform !== movedTransform, `Expected packet SVG position to animate (${firstTransform} vs ${movedTransform})`);
    await page.waitForSelector('text=/Running · #[2-9]/', { timeout: 3000 });
    await page.getByRole('button', { name: /^Reset$/i }).click();

    // Check Simulator Zoom
    const simZoomReset = page.getByLabel('Reset Zoom').first();
    assert.equal(await simZoomReset.textContent(), '100%');
    await page.getByLabel('Zoom In').first().click();
    assert.equal(await simZoomReset.textContent(), '115%');
    await page.getByLabel('Fit Topology').click();
    await simZoomReset.click();
    assert.equal(await simZoomReset.textContent(), '100%');

    // Test Connect Cable flow: add a new cable between Wi-Fi Router and Web Server via Connect mode + Port Picker
    const beforeLinksText = await page.locator('text=/\\d+ nodes · \\d+ links/').textContent();
    const initialLinks = Number(beforeLinksText?.match(/(\d+) links/)?.[1] ?? 0);
    assert.ok(initialLinks >= 3, `Expected initial links >= 3, got ${beforeLinksText}`);

    await page.getByRole('button', { name: 'Connect Cable', exact: true }).click();
    await page.locator('svg text', { hasText: 'Wi-Fi Router' }).dispatchEvent('mousedown');
    await page.getByRole('dialog', { name: /Select port on Wi-Fi Router/i }).waitFor();
    await page.getByRole('button', { name: /Add & wire/i }).click();
    await page.locator('svg text', { hasText: 'Web Server' }).dispatchEvent('mousedown');
    const webPickerVisible = await page.getByRole('dialog', { name: /Select port on Web Server/i }).isVisible().catch(() => false);
    if (webPickerVisible) {
      await page.getByRole('button', { name: /Add & wire/i }).click();
    }
    const afterLinksText = await page.locator('text=/\\d+ nodes · \\d+ links/').textContent();
    const afterLinks = Number(afterLinksText?.match(/(\d+) links/)?.[1] ?? 0);
    assert.equal(afterLinks, initialLinks + 1, `Expected link count to increment from ${initialLinks} to ${initialLinks + 1}`);

    // Undo the test cable
    await page.getByLabel('Undo').click();
    const restoredText = await page.locator('text=/\\d+ nodes · \\d+ links/').textContent();
    assert.equal(Number(restoredText?.match(/(\d+) links/)?.[1] ?? 0), initialLinks);

    // Exit Connect mode and test direct Drag-and-Drop rubber-band wiring from a perimeter port handle
    await page.keyboard.press('Escape');
    const ispBox = await page.locator('svg text', { hasText: 'ISP AS64500' }).boundingBox();
    assert.ok(ispBox, 'Expected bounding box for ISP AS64500');
    await page.locator('svg text', { hasText: 'Wi-Fi Router' }).click();
    const addPortCircle = page.locator('g.cursor-crosshair', { hasText: '+eth' }).locator('circle').last();
    await addPortCircle.waitFor({ state: 'visible', timeout: 3000 });
    const portBox = await addPortCircle.boundingBox();
    assert.ok(portBox, 'Expected perimeter port handle bounding box');
    await page.mouse.move(portBox.x + portBox.width / 2, portBox.y + portBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(ispBox.x + ispBox.width / 2, ispBox.y - 42, { steps: 10 });
    await page.mouse.up();
    const dragLinksText = await page.locator('text=/\\d+ nodes · \\d+ links/').textContent();
    assert.equal(Number(dragLinksText?.match(/(\d+) links/)?.[1] ?? 0), initialLinks + 1);
    await page.getByLabel('Undo').click();
    const dragRestoredText = await page.locator('text=/\\d+ nodes · \\d+ links/').textContent();
    assert.equal(Number(dragRestoredText?.match(/(\d+) links/)?.[1] ?? 0), initialLinks);

    // Run real ping command inside Simulator CLI Terminal tab
    await page.getByRole('button', { name: /CLI Terminal/i }).click();
    const cliInput = page.getByLabel('CLI command input');
    await cliInput.fill('ping 203.0.113.10 -c 1');
    await cliInput.press('Enter');
    await page.waitForSelector('text=/1 received, 0% packet loss/', { timeout: 5000 });

    // Switch to Capture tab and filter by icmp
    await page.getByRole('button', { name: /Capture \(/i }).click();
    const filterInput = page.getByLabel('Wireshark capture display filter');
    await filterInput.fill('icmp');
    await page.waitForSelector('text=/Echo \\(ping\\)/', { timeout: 5000 });

    // Verify Simulator Pro Mode unlocks Device Palette, Properties & Event Logs + Export PNG works with real PNG payload
    const [canvasPngDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export PNG' }).click(),
    ]);
    assert.equal(canvasPngDownload.suggestedFilename(), 'gg-simulator-topology.png');
    const pngPath = await canvasPngDownload.path();
    assert.ok(pngPath, 'Expected PNG download file path');
    const pngBytes = fs.readFileSync(pngPath);
    assert.equal(pngBytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Downloaded file must have valid PNG magic signature');
    assert.ok(pngBytes.length > 5000, `Expected rich blueprint PNG (>5KB), got ${pngBytes.length} bytes`);

    await page.locator('header').getByRole('button', { name: /^Pro$/i }).click();
    await page.getByRole('button', { name: /Event Logs/i }).waitFor();
    await page.getByRole('button', { name: /Metrics/i }).waitFor();
    await page.getByRole('button', { name: /Save \/ Share/i }).click();
    const [menuPngDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export PNG' }).nth(0).click(),
    ]);
    assert.equal(menuPngDownload.suggestedFilename(), 'gg-simulator-topology.png');

    // Verify Step-by-Step playback mode on captured frames & protocol state transitions
    await page.getByLabel('Wireshark capture display filter').fill('');
    await page.getByRole('button', { name: /^Step-by-Step$/i }).click();
    const stepBar = page.getByRole('region', { name: /Step-by-Step/i });
    await stepBar.waitFor();
    assert.ok((await stepBar.textContent())?.includes('Step 1 /'), 'Entering Step-by-Step with packets should focus Step 1');
    assert.ok((await stepBar.textContent())?.includes('#1 ·'), 'Expected protocol state badge for packet #1');

    await page.getByLabel('Single Step Next Event').click();
    assert.ok((await stepBar.textContent())?.includes('Step 2 /'), 'Single step forward should advance to Step 2');
    assert.ok((await stepBar.textContent())?.includes('#2 ·'), 'Expected protocol state badge for packet #2');

    await page.getByLabel('Step Back One Event').click();
    assert.ok((await stepBar.textContent())?.includes('Step 1 /'), 'Step back should return to Step 1');

    await page.getByLabel('Resume Step Playback').click();
    await page.waitForSelector('button[aria-label="Pause Step Playback"], button:has-text("Step 2 /")', { timeout: 3000 }).catch(() => undefined);
    const pauseBtn = page.getByLabel('Pause Step Playback');
    if (await pauseBtn.isVisible().catch(() => false)) {
      await pauseBtn.click();
    }

    await page.getByRole('button', { name: /^Live$/i }).click();
    assert.equal(await stepBar.count(), 0, 'Returning to Live mode should hide the Step-by-Step bar');

    // Verify global keyboard shortcuts in Simulator (click canvas container to ensure focus is not in an input)
    await page.getByRole('img', { name: /Interactive network simulator canvas/i }).click();
    await page.keyboard.press('m');
    await stepBar.waitFor();
    assert.ok((await stepBar.textContent())?.includes('Step 1 /'), 'Pressing M should toggle Step-by-Step mode');
    await page.keyboard.press('ArrowRight');
    assert.ok((await stepBar.textContent())?.includes('Step 2 /'), 'ArrowRight should step forward');
    await page.keyboard.press('ArrowLeft');
    assert.ok((await stepBar.textContent())?.includes('Step 1 /'), 'ArrowLeft should step back');
    await page.keyboard.press('?');
    await page.getByRole('dialog', { name: /Playback Shortcuts/i }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog', { name: /Playback Shortcuts/i }).count(), 0);
    await page.keyboard.press('m');
    assert.equal(await stepBar.count(), 0, 'Pressing M again should return to Live mode');

    // Verify curved SVG paths & packet animation for non-direct nodes (Lab 5 DHCP Relay: dhcp -> client)
    await page.getByRole('button', { name: /Labs/i }).click();
    await page.getByLabel('Select preset lab').selectOption('lab-5-dhcp-relay');
    await page.getByRole('button', { name: /Check Solution/i }).first().click();
    await page.locator('path[data-curved-connection]').first().waitFor({ timeout: 4000 });
    const curvedD = await page.locator('path[data-curved-connection]').first().getAttribute('d');
    assert.ok(curvedD && curvedD.includes(' Q '), `Expected quadratic Bezier SVG path for non-direct nodes, got ${curvedD}`);
    const nonDirectPkt = page.locator('g[data-packet-non-direct="true"]').first();
    await nonDirectPkt.waitFor({ timeout: 4000 });

    // Verify Simple mode access to Metrics, Templates + Undo, Multi-Hop Path Highlighting, and On-Canvas Node Tables Popover
    await page.locator('header').getByRole('button', { name: /^Simple$/i }).click();
    await page.getByRole('button', { name: /^Templates$/i }).click();
    await page.locator('button[data-template-id="tpl-dual-router"]').click();
    await page.locator('text=/4 nodes · 3 links/').waitFor({ timeout: 4000 });

    await page.getByRole('button', { name: /^Metrics$/i }).click();
    await page.getByRole('button', { name: /^Step-by-Step$/i }).click();
    await page.getByLabel('Single Step Next Event').click();
    await page.getByLabel('Single Step Next Event').click();
    await page.getByLabel('Single Step Next Event').click();
    await page.locator('[data-testid="live-throughput-chart"]').waitFor({ timeout: 4000 });
    const kpiThroughput = await page.locator('[data-testid="kpi-throughput"]').textContent();
    assert.ok(kpiThroughput && kpiThroughput !== '0 Kbps', `Expected live throughput KPI > 0 Kbps, got ${kpiThroughput}`);

    const multiHopLinksCount = await page.locator('path[data-multihop-link]').count();
    assert.ok(multiHopLinksCount >= 2, `Expected >=2 multi-hop highlighted links, got ${multiHopLinksCount}`);
    const multiHopNodesCount = await page.locator('g[data-multihop-node]').count();
    assert.ok(multiHopNodesCount >= 3, `Expected >=3 multi-hop numbered nodes, got ${multiHopNodesCount}`);

    // Open on-canvas Node Tables popover for Core Router
    await page.locator('svg text', { hasText: 'Core Router' }).dispatchEvent('mousedown');
    await page.locator('g[data-inspect-tables="tpl-dual-r1"]').dispatchEvent('mousedown');
    const nodeTablesDialog = page.getByTestId('node-tables-popover');
    await nodeTablesDialog.waitFor({ timeout: 4000 });
    await nodeTablesDialog.getByRole('tab', { name: /Routing/i }).click();
    assert.ok((await nodeTablesDialog.textContent())?.includes('192.168.10.0'), 'Expected Core Router routing table entry in popover');
    await page.getByLabel('Close node tables').click();

    // Undo restores prior topology
    await page.getByLabel('Undo').click();
    await page.locator('text=/3 nodes · 2 links/').waitFor({ timeout: 4000 });

    // 3. Learn Mode
    await page.locator('header').getByRole('button', { name: /Learn/i }).click();
    await page.waitForSelector('text=/39|Protocol|Progress/i', { timeout: 5000 });

    assert.equal(pageErrors.length, 0, `Uncaught page errors: ${pageErrors.join(' | ')}`);
    assert.equal(consoleErrors.length, 0, `Console errors: ${consoleErrors.join(' | ')}`);
    console.log('E2E_BROWSER_CHECK_PASSED: Welcome Guide, Daylight/Ocean Themes, 6-Language RTL, Simple/Pro, Explore, Simulator (incl. Templates, Live Throughput, Multi-Hop & Node Tables) & Learn verified with 0 errors.');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('E2E_BROWSER_CHECK_FAILED:', err);
  process.exit(1);
});
