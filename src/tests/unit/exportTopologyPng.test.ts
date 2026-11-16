// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { drawBlueprintGrid, prepareSvgForExport, resolveBlueprintPalette } from '../../lib/exportTopologyPng';

describe('Topology PNG Blueprint Exporter', () => {
  it('resolves distinct Crisp Daylight and Deep Ocean Slate blueprint grid palettes', () => {
    const light = resolveBlueprintPalette('light');
    const dark = resolveBlueprintPalette('dark');

    expect(light.bgCanvas).toBe('#f6f8fb');
    expect(dark.bgCanvas).toBe('#08111e');
    expect(light.gridLine).not.toBe(dark.gridLine);
    expect(light.gridLineMajor).not.toBe(dark.gridLineMajor);
  });

  it('draws background, minor grid lines, major grid lines, border, and caption onto canvas context', () => {
    const strokes: string[] = [];
    const fills: string[] = [];
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(() => {
        strokes.push(String(mockCtx.strokeStyle));
      }),
      fillText: vi.fn(),
      set fillStyle(v: string) {
        fills.push(v);
      },
      get fillStyle() {
        return fills[fills.length - 1] ?? '';
      },
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: 'left',
      textBaseline: 'alphabetic',
    } as unknown as CanvasRenderingContext2D;

    drawBlueprintGrid(mockCtx, 1600, 832, 'light', { caption: 'gg · Lab 1' });

    expect(fills[0]).toBe('#f6f8fb');
    expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 1600, 832);
    expect(mockCtx.moveTo).toHaveBeenCalled();
    expect(mockCtx.lineTo).toHaveBeenCalled();
    // Minor grid stroke + major grid stroke
    expect(strokes).toContain('rgba(15, 23, 42, 0.045)');
    expect(strokes).toContain('rgba(15, 23, 42, 0.09)');
    expect(mockCtx.strokeRect).toHaveBeenCalled();
    expect(mockCtx.fillText).toHaveBeenCalledWith('gg · Lab 1', 1582, 818);

    strokes.length = 0;
    fills.length = 0;
    drawBlueprintGrid(mockCtx, 1600, 832, 'dark');
    expect(fills[0]).toBe('#08111e');
    expect(strokes).toContain('rgba(45, 212, 191, 0.045)');
    expect(strokes).toContain('rgba(56, 189, 248, 0.09)');
  });

  it('embeds SVG stylesheet and resolves CSS var() tokens for standalone rasterization', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 1000 520');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('fill', 'var(--bg-surface)');
    rect.setAttribute('stroke', 'var(--accent-primary)');
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('class', 'fill-[var(--text-primary)] font-mono font-bold');
    text.textContent = 'Router1';
    svg.appendChild(rect);
    svg.appendChild(text);

    const lightXml = prepareSvgForExport(svg, 'light');
    expect(lightXml).toContain('<style>');
    expect(lightXml).toContain('fill="#ffffff"');
    expect(lightXml).toContain('stroke="#1d4ed8"');
    expect(lightXml).toContain('width="1600"');
    expect(lightXml).toContain('height="832"');

    const darkXml = prepareSvgForExport(svg, 'dark');
    expect(darkXml).toContain('fill="#0e1b2e"');
    expect(darkXml).toContain('stroke="#38bdf8"');
  });
});
