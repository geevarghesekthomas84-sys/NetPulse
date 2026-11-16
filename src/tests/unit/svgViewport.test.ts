import { describe, expect, it } from 'vitest';
import {
  clientDeltaToSvg,
  clientPointToSvg,
  computeFitViewport,
  computeZoomAtAnchor,
  SVG_MAX_ZOOM,
  SVG_MIN_ZOOM,
  wheelDeltaToZoomFactor,
} from '../../lib/svgViewport';

function makeMockSvg(rect: { left: number; top: number; width: number; height: number }): SVGSVGElement {
  return {
    getBoundingClientRect: () => rect as DOMRect,
  } as unknown as SVGSVGElement;
}

describe('SVG Viewport Coordinate Projection & Smooth Zoom Helpers', () => {
  it('normalizes wheel and trackpad deltas into smooth bounded zoom factors', () => {
    const gentleUp = wheelDeltaToZoomFactor(-4, 0);
    const gentleDown = wheelDeltaToZoomFactor(4, 0);
    expect(gentleUp).toBeGreaterThan(1);
    expect(gentleUp).toBeLessThan(1.03);
    expect(gentleDown).toBeLessThan(1);
    expect(gentleDown).toBeGreaterThan(0.97);

    // Line mode (e.g. Firefox mouse wheel) should produce sensible ~10% zoom steps
    const lineStep = wheelDeltaToZoomFactor(-3, 1);
    expect(lineStep).toBeGreaterThan(1.08);
    expect(lineStep).toBeLessThan(1.16);

    // Extreme delta spikes are clamped smoothly
    const hugeSpike = wheelDeltaToZoomFactor(-10000, 0);
    expect(hugeSpike).toBeLessThan(1.35);
  });

  it('keeps the cursor SVG anchor stationary across consecutive zoom-in and zoom-out steps', () => {
    let zoom = 1;
    let pan = { x: 0, y: 0 };
    const anchor = { x: 650, y: 310 };

    // Simulate 15 tiny trackpad wheel ticks without rounding stalls
    for (let i = 0; i < 15; i++) {
      const factor = wheelDeltaToZoomFactor(-6, 0);
      const next = computeZoomAtAnchor({
        currentZoom: zoom,
        currentPan: pan,
        nextZoomRaw: zoom * factor,
        anchorX: anchor.x,
        anchorY: anchor.y,
        baseWidth: 1000,
        baseHeight: 520,
      });
      // Relative screen fraction of anchor must remain invariant
      const relXBefore = (anchor.x - pan.x) / (1000 / zoom);
      const relXAfter = (anchor.x - next.pan.x) / (1000 / next.zoom);
      const relYBefore = (anchor.y - pan.y) / (520 / zoom);
      const relYAfter = (anchor.y - next.pan.y) / (520 / next.zoom);
      expect(relXAfter).toBeCloseTo(relXBefore, 5);
      expect(relYAfter).toBeCloseTo(relYBefore, 5);
      zoom = next.zoom;
      pan = next.pan;
    }

    expect(zoom).toBeGreaterThan(1.18);

    // Clamp cleanly to min and max bounds
    const maxState = computeZoomAtAnchor({
      currentZoom: zoom,
      currentPan: pan,
      nextZoomRaw: 99,
      anchorX: anchor.x,
      anchorY: anchor.y,
      baseWidth: 1000,
      baseHeight: 520,
    });
    expect(maxState.zoom).toBe(SVG_MAX_ZOOM);

    const minState = computeZoomAtAnchor({
      currentZoom: zoom,
      currentPan: pan,
      nextZoomRaw: 0.01,
      anchorX: anchor.x,
      anchorY: anchor.y,
      baseWidth: 1000,
      baseHeight: 520,
    });
    expect(minState.zoom).toBe(SVG_MIN_ZOOM);
  });

  it('projects client pointer and drag deltas accurately under letterboxed preserveAspectRatio="xMidYMid meet"', () => {
    // Ultra-wide container: 1400 x 390 while viewBox is 1000 x 520.
    // Meet scale = min(1400/1000, 390/520) = 0.75 => rendered 750x390 centered with 325px horizontal padding.
    const wideSvg = makeMockSvg({ left: 0, top: 0, width: 1400, height: 390 });
    const centerPt = clientPointToSvg(wideSvg, 700, 195, 0, 0, 1000, 520);
    expect(centerPt.x).toBeCloseTo(500, 2);
    expect(centerPt.y).toBeCloseTo(260, 2);

    const topLeftContent = clientPointToSvg(wideSvg, 325, 0, 0, 0, 1000, 520);
    expect(topLeftContent.x).toBeCloseTo(0, 2);
    expect(topLeftContent.y).toBeCloseTo(0, 2);

    const delta = clientDeltaToSvg(wideSvg, 75, 75, 1000, 520);
    expect(delta.dx).toBeCloseTo(100, 2);
    expect(delta.dy).toBeCloseTo(100, 2);
  });

  it('centers fitted viewports symmetrically around topology nodes', () => {
    const vp = computeFitViewport(
      [
        { x: 100, y: 120 },
        { x: 900, y: 380 },
      ],
      1000,
      520
    );
    expect(vp.zoom).toBeGreaterThanOrEqual(0.5);
    expect(vp.zoom).toBeLessThanOrEqual(1.6);
    const centerX = vp.pan.x + (1000 / vp.zoom) / 2;
    const centerY = vp.pan.y + (520 / vp.zoom) / 2;
    expect(centerX).toBeCloseTo(500, 1);
    expect(centerY).toBeCloseTo(250, 1);
  });
});
