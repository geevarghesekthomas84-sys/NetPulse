import { triggerDownload } from './pcapWriter';
import { resolveCssVars } from './resolveCssVars';

export type BlueprintThemeMode = 'light' | 'dark';

export interface BlueprintPalette {
  bgCanvas: string;
  bgSurface: string;
  bgElevated: string;
  bgInset: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderHairline: string;
  borderStrong: string;
  accentPrimary: string;
  accentTeal: string;
  toneInfo: string;
  toneSuccess: string;
  toneWarning: string;
  toneDanger: string;
  gridLine: string;
  gridLineMajor: string;
  nodeStroke: string;
  nodeFill: string;
  linkStroke: string;
  hwSlateLight: string;
  hwSlateDark: string;
  hwScreen: string;
}

const LIGHT_FALLBACK: BlueprintPalette = {
  bgCanvas: '#f7f5f0',
  bgSurface: '#ffffff',
  bgElevated: '#f2efe8',
  bgInset: '#eeeae2',
  textPrimary: '#1d2130',
  textSecondary: '#394150',
  textMuted: '#555d6e',
  borderHairline: '#ddd7cb',
  borderStrong: '#a9a08f',
  accentPrimary: '#4338ca',
  accentTeal: '#0b6b61',
  toneInfo: '#075985',
  toneSuccess: '#046c4e',
  toneWarning: '#92400e',
  toneDanger: '#b01c1c',
  gridLine: 'rgba(29, 33, 48, 0.04)',
  gridLineMajor: 'rgba(29, 33, 48, 0.08)',
  nodeStroke: '#4338ca',
  nodeFill: '#eef0ff',
  linkStroke: '#6f7686',
  hwSlateLight: '#e6e8f2',
  hwSlateDark: '#c9cde0',
  hwScreen: '#1b1f3a',
};

const DARK_FALLBACK: BlueprintPalette = {
  bgCanvas: '#14161d',
  bgSurface: '#1b1e28',
  bgElevated: '#252936',
  bgInset: '#171922',
  textPrimary: '#f2f3f7',
  textSecondary: '#d0d4df',
  textMuted: '#a6adbd',
  borderHairline: '#2f3445',
  borderStrong: '#4b5169',
  accentPrimary: '#a5b4fc',
  accentTeal: '#5eead4',
  toneInfo: '#7dd3fc',
  toneSuccess: '#6ee7b7',
  toneWarning: '#fcd34d',
  toneDanger: '#fca5a5',
  gridLine: 'rgba(165, 180, 252, 0.045)',
  gridLineMajor: 'rgba(165, 180, 252, 0.09)',
  nodeStroke: '#a5b4fc',
  nodeFill: '#20243a',
  linkStroke: '#7b84a0',
  hwSlateLight: '#2f3552',
  hwSlateDark: '#171a2b',
  hwScreen: '#0c0f20',
};

const VAR_MAP_KEYS: Array<[string, keyof BlueprintPalette]> = [
  ['--bg-canvas', 'bgCanvas'],
  ['--bg-surface', 'bgSurface'],
  ['--bg-elevated', 'bgElevated'],
  ['--bg-inset', 'bgInset'],
  ['--text-primary', 'textPrimary'],
  ['--text-secondary', 'textSecondary'],
  ['--text-muted', 'textMuted'],
  ['--border-hairline', 'borderHairline'],
  ['--border-strong', 'borderStrong'],
  ['--accent-primary', 'accentPrimary'],
  ['--accent-teal', 'accentTeal'],
  ['--tone-info', 'toneInfo'],
  ['--tone-success', 'toneSuccess'],
  ['--tone-warning', 'toneWarning'],
  ['--tone-danger', 'toneDanger'],
  ['--grid-line', 'gridLine'],
  ['--grid-line-major', 'gridLineMajor'],
  ['--node-stroke', 'nodeStroke'],
  ['--node-fill', 'nodeFill'],
  ['--link-stroke', 'linkStroke'],
  ['--hw-slate-light', 'hwSlateLight'],
  ['--hw-slate-dark', 'hwSlateDark'],
  ['--hw-screen', 'hwScreen'],
];

export function resolveBlueprintPalette(theme: BlueprintThemeMode): BlueprintPalette {
  const base = theme === 'dark' ? { ...DARK_FALLBACK } : { ...LIGHT_FALLBACK };
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
    return base;
  }
  const styles = getComputedStyle(document.documentElement);
  for (const [cssVar, prop] of VAR_MAP_KEYS) {
    const val = styles.getPropertyValue(cssVar).trim();
    if (val) {
      base[prop] = val;
    }
  }
  return base;
}

export interface DrawBlueprintGridOptions {
  /** Spacing of minor grid lines in exported canvas pixels (default: 38.4px, 1.6x of 24px CSS grid) */
  minorSpacing?: number;
  /** How many minor grid steps per major grid line (default: 5 => 192px, 1.6x of 120px CSS major grid) */
  majorEvery?: number;
  /** Optional subtitle/topology title rendered subtly in the bottom-right corner */
  caption?: string;
}

/**
 * Paints the Crisp Daylight or Deep Ocean Slate `.blueprint-grid` background onto a 2D canvas.
 */
export function drawBlueprintGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: BlueprintThemeMode,
  options: DrawBlueprintGridOptions = {}
): void {
  const palette = resolveBlueprintPalette(theme);
  const minorSpacing = options.minorSpacing ?? 38.4; // 24px * (1600 / 1000)
  const majorEvery = options.majorEvery ?? 5; // 120px major interval

  // 1. Base canvas background
  ctx.save();
  ctx.fillStyle = palette.bgCanvas;
  ctx.fillRect(0, 0, width, height);

  // 2. Minor grid lines (matches CSS `.blueprint-grid` 24px grid)
  ctx.lineWidth = 1;
  ctx.strokeStyle = palette.gridLine;
  ctx.beginPath();
  for (let i = 1; i * minorSpacing < width; i++) {
    if (i % majorEvery === 0) continue;
    const x = Math.round(i * minorSpacing) + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let j = 1; j * minorSpacing < height; j++) {
    if (j % majorEvery === 0) continue;
    const y = Math.round(j * minorSpacing) + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  // 3. Major grid lines (matches CSS `.blueprint-grid` 120px major grid)
  ctx.strokeStyle = palette.gridLineMajor;
  ctx.beginPath();
  const majorSpacing = minorSpacing * majorEvery;
  for (let xPos = majorSpacing; xPos < width; xPos += majorSpacing) {
    const x = Math.round(xPos) + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let yPos = majorSpacing; yPos < height; yPos += majorSpacing) {
    const y = Math.round(yPos) + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  // 4. Subtle outer blueprint border & corner framing mark
  ctx.strokeStyle = palette.borderHairline;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  if (options.caption) {
    ctx.font = '600 13px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = palette.textMuted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(options.caption, width - 18, height - 14);
  }

  ctx.restore();
}

function replaceVarTokens(rawValue: string, varLookup: Record<string, string>): string {
  return rawValue.replace(/var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,\s*([^)]+))?\)/g, (_m, name: string, fallback?: string) => {
    return varLookup[name] ?? fallback?.trim() ?? _m;
  });
}

/**
 * Clones an SVG element, injects theme CSS custom properties and Tailwind SVG typography/fill rules,
 * and resolves inline `var(--...)` attributes so standalone SVG-to-Canvas PNG rasterization preserves styling.
 */
export function prepareSvgForExport(
  svgElement: SVGSVGElement,
  theme: BlueprintThemeMode,
  width = 1600,
  height = 832
): string {
  const palette = resolveBlueprintPalette(theme);
  const varLookup: Record<string, string> = {};
  for (const [cssVar, prop] of VAR_MAP_KEYS) {
    varLookup[cssVar] = palette[prop];
  }

  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));

  // Ensure <defs> exists and prepend an embedded stylesheet so Tailwind classes work outside the DOM
  const svgNs = 'http://www.w3.org/2000/svg';
  let defs = clone.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS(svgNs, 'defs');
    clone.insertBefore(defs, clone.firstChild);
  }

  const styleEl = document.createElementNS(svgNs, 'style');
  styleEl.textContent = `
    text {
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
    }
    .font-mono {
      font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .font-semibold { font-weight: 600; }
    .font-bold { font-weight: 700; }
    .opacity-70 { opacity: 0.7; }
    .text-\\[8px\\] { font-size: 8px; }
    .text-\\[8\\.5px\\] { font-size: 8.5px; }
    .text-\\[9px\\] { font-size: 9px; }
    .text-\\[9\\.5px\\] { font-size: 9.5px; }
    .text-\\[10px\\] { font-size: 10px; }
    .text-\\[10\\.5px\\] { font-size: 10.5px; }
    .text-\\[11\\.5px\\] { font-size: 11.5px; }
    .fill-amber-400 { fill: #fbbf24; }
    .fill-\\[var\\(--text-primary\\)\\] { fill: ${palette.textPrimary}; }
    .fill-\\[var\\(--text-secondary\\)\\] { fill: ${palette.textSecondary}; }
    .fill-\\[var\\(--text-muted\\)\\] { fill: ${palette.textMuted}; }
    .fill-\\[var\\(--accent-primary\\)\\] { fill: ${palette.accentPrimary}; }
    .fill-\\[var\\(--accent-teal\\)\\] { fill: ${palette.accentTeal}; }
    .fill-\\[var\\(--tone-warning\\)\\] { fill: ${palette.toneWarning}; }
    .fill-\\[var\\(--tone-success\\)\\] { fill: ${palette.toneSuccess}; }
    .fill-\\[var\\(--tone-danger\\)\\] { fill: ${palette.toneDanger}; }
  `;
  defs.insertBefore(styleEl, defs.firstChild);

  // Resolve inline var(--...) references on attributes (fill, stroke, stop-color) for universal SVG rasterizers
  const allEls = clone.querySelectorAll('*');
  allEls.forEach((el) => {
    for (const attr of ['fill', 'stroke', 'stop-color', 'style']) {
      const val = el.getAttribute(attr);
      if (val && val.includes('var(')) {
        // Palette first, then whatever the page defines (wireframe device tokens, packet colours).
        const first = replaceVarTokens(val, varLookup);
        el.setAttribute(attr, first.includes('var(') ? resolveCssVars(first) : first);
      }
    }
  });

  return new XMLSerializer().serializeToString(clone);
}

export interface ExportTopologyPngParams {
  svgElement: SVGSVGElement;
  theme: BlueprintThemeMode;
  filename?: string;
  caption?: string;
  width?: number;
  height?: number;
}

/**
 * Exports the Simulator SVG topology as a crisp PNG image preserving the `.blueprint-grid` styling.
 */
export function exportTopologyPng({
  svgElement,
  theme,
  filename = 'netpulse-simulator-topology.png',
  caption,
  width = 1600,
  height = 832,
}: ExportTopologyPngParams): Promise<Blob | null> {
  const serializedSvg = prepareSvgForExport(svgElement, theme, width, height);
  const svgBlob = new Blob([serializedSvg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(null);
        return;
      }

      drawBlueprintGrid(ctx, width, height, theme, { caption });
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (blob) {
          triggerDownload(blob, filename);
        }
        resolve(blob);
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
