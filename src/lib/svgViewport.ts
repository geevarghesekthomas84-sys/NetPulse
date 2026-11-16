export const SVG_MIN_ZOOM = 0.4;
export const SVG_MAX_ZOOM = 3.0;

export interface SvgPoint {
  x: number;
  y: number;
}

export interface SvgViewportState {
  zoom: number;
  pan: SvgPoint;
}

export function clampSvgZoom(rawZoom: number, minZoom = SVG_MIN_ZOOM, maxZoom = SVG_MAX_ZOOM): number {
  const clamped = Math.max(minZoom, Math.min(maxZoom, rawZoom));
  return Math.round(clamped * 10000) / 10000;
}

/**
 * Normalizes mouse wheel and trackpad pinch/scroll deltas into a smooth multiplicative zoom factor.
 */
export function wheelDeltaToZoomFactor(deltaY: number, deltaMode = 0): number {
  const pixelDelta =
    deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 120 : deltaY;
  if (!Number.isFinite(pixelDelta) || pixelDelta === 0) return 1;
  const clamped = Math.max(-120, Math.min(120, pixelDelta));
  return Math.exp(-clamped * 0.0022);
}

function getLetterboxMetrics(
  rect: { left: number; top: number; width: number; height: number },
  vbW: number,
  vbH: number
) {
  const safeW = Math.max(1, rect.width);
  const safeH = Math.max(1, rect.height);
  const scale = Math.min(safeW / vbW, safeH / vbH);
  const renderedW = vbW * scale;
  const renderedH = vbH * scale;
  const offsetX = (safeW - renderedW) / 2;
  const offsetY = (safeH - renderedH) / 2;
  return { scale: Math.max(0.0001, scale), renderedW, renderedH, offsetX, offsetY };
}

/**
 * Maps client pointer coordinates accurately into SVG viewBox coordinates,
 * respecting SVG getScreenCTM (browser) or preserveAspectRatio="xMidYMid meet" (fallback/jsdom).
 */
export function clientPointToSvg(
  svg: SVGSVGElement | null,
  clientX: number,
  clientY: number,
  panX: number,
  panY: number,
  vbW: number,
  vbH: number
): SvgPoint {
  if (!svg) return { x: panX + vbW / 2, y: panY + vbH / 2 };

  if (typeof svg.getScreenCTM === 'function') {
    const ctm = svg.getScreenCTM();
    if (ctm && typeof ctm.inverse === 'function' && ctm.a !== 0 && ctm.d !== 0) {
      try {
        const inv = ctm.inverse();
        return {
          x: clientX * inv.a + clientY * inv.c + inv.e,
          y: clientX * inv.b + clientY * inv.d + inv.f,
        };
      } catch {
        // Fallback to geometric letterbox calculation below
      }
    }
  }

  const rect = svg.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: panX + vbW / 2, y: panY + vbH / 2 };
  }

  const { scale, offsetX, offsetY } = getLetterboxMetrics(rect, vbW, vbH);
  return {
    x: panX + (clientX - rect.left - offsetX) / scale,
    y: panY + (clientY - rect.top - offsetY) / scale,
  };
}

/**
 * Converts pixel drag deltas into SVG coordinate deltas using uniform meet scaling.
 */
export function clientDeltaToSvg(
  svg: SVGSVGElement | null,
  dxPx: number,
  dyPx: number,
  vbW: number,
  vbH: number
): { dx: number; dy: number } {
  if (!svg) return { dx: dxPx, dy: dyPx };

  if (typeof svg.getScreenCTM === 'function') {
    const ctm = svg.getScreenCTM();
    if (ctm && ctm.a > 0 && ctm.d > 0) {
      return {
        dx: dxPx / ctm.a,
        dy: dyPx / ctm.d,
      };
    }
  }

  const rect = svg.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return { dx: dxPx, dy: dyPx };
  }

  const { scale } = getLetterboxMetrics(rect, vbW, vbH);
  return {
    dx: dxPx / scale,
    dy: dyPx / scale,
  };
}

/**
 * Computes next zoom and pan so anchorX/anchorY stays anchored under the cursor.
 */
export function computeZoomAtAnchor(opts: {
  currentZoom: number;
  currentPan: SvgPoint;
  nextZoomRaw: number;
  anchorX: number;
  anchorY: number;
  baseWidth: number;
  baseHeight: number;
  minZoom?: number;
  maxZoom?: number;
}): SvgViewportState {
  const minZoom = opts.minZoom ?? SVG_MIN_ZOOM;
  const maxZoom = opts.maxZoom ?? SVG_MAX_ZOOM;
  const nextZoom = clampSvgZoom(opts.nextZoomRaw, minZoom, maxZoom);
  const currW = opts.baseWidth / opts.currentZoom;
  const currH = opts.baseHeight / opts.currentZoom;
  const nextW = opts.baseWidth / nextZoom;
  const nextH = opts.baseHeight / nextZoom;
  const relX = (opts.anchorX - opts.currentPan.x) / currW;
  const relY = (opts.anchorY - opts.currentPan.y) / currH;
  return {
    zoom: nextZoom,
    pan: {
      x: opts.anchorX - relX * nextW,
      y: opts.anchorY - relY * nextH,
    },
  };
}

/**
 * Computes centered zoom and pan to frame all points cleanly inside the SVG viewBox.
 */
export function computeFitViewport(
  points: SvgPoint[],
  baseWidth: number,
  baseHeight: number,
  padding: SvgPoint = { x: 100, y: 90 },
  minZoom = 0.5,
  maxZoom = 1.6
): SvgViewportState {
  if (points.length === 0) {
    return { zoom: 1, pan: { x: 0, y: 0 } };
  }
  const minX = Math.min(...points.map((p) => p.x)) - padding.x;
  const maxX = Math.max(...points.map((p) => p.x)) + padding.x;
  const minY = Math.min(...points.map((p) => p.y)) - padding.y;
  const maxY = Math.max(...points.map((p) => p.y)) + padding.y;
  const spanX = Math.max(320, maxX - minX);
  const spanY = Math.max(200, maxY - minY);
  const nextZoom = clampSvgZoom(Math.min(baseWidth / spanX, baseHeight / spanY), minZoom, maxZoom);
  const vbW = baseWidth / nextZoom;
  const vbH = baseHeight / nextZoom;
  return {
    zoom: nextZoom,
    pan: {
      x: (minX + maxX) / 2 - vbW / 2,
      y: (minY + maxY) / 2 - vbH / 2,
    },
  };
}

/**
 * Maps an SVG coordinate into container percentage offsets for anchored HTML overlays.
 */
export function svgPointToContainerPercent(
  svg: SVGSVGElement | null,
  svgX: number,
  svgY: number,
  panX: number,
  panY: number,
  vbW: number,
  vbH: number
): { leftPct: number; topPct: number } {
  if (svg) {
    const rect = svg.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const { scale, offsetX, offsetY } = getLetterboxMetrics(rect, vbW, vbH);
      const px = offsetX + (svgX - panX) * scale;
      const py = offsetY + (svgY - panY) * scale;
      return {
        leftPct: (px / rect.width) * 100,
        topPct: (py / rect.height) * 100,
      };
    }
  }
  return {
    leftPct: ((svgX - panX) / vbW) * 100,
    topPct: ((svgY - panY) / vbH) * 100,
  };
}
