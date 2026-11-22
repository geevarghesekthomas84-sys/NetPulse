/**
 * Replaces `var(--token)` references with their current computed values.
 *
 * The live diagrams use theme variables, which only exist inside the page. A
 * downloaded .svg, or an SVG rasterised into a PNG, has no stylesheet, so
 * every variable would otherwise render as nothing (black or invisible).
 */
export function resolveCssVars(markup: string, root: Element = document.documentElement): string {
  const style = getComputedStyle(root);
  return markup.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_m, name: string, fallback?: string) => {
    const value = style.getPropertyValue(name).trim();
    return value || fallback?.trim() || 'currentColor';
  });
}

/**
 * Returns a copy of a live SVG with text and dash styles written onto the elements themselves.
 * Tailwind classes (font size, weight, fill) do not exist in a downloaded file, so without this
 * every label would fall back to a plain serif font.
 */
export function inlineSvgStyles(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const source = svg.querySelectorAll('text, line, path');
  const target = clone.querySelectorAll('text, line, path');
  source.forEach((el, i) => {
    const cs = getComputedStyle(el);
    const out = target[i];
    if (!out) return;
    if (el.tagName === 'text') {
      out.setAttribute('font-family', cs.fontFamily);
      out.setAttribute('font-size', cs.fontSize);
      out.setAttribute('font-weight', cs.fontWeight);
      out.setAttribute('fill', cs.fill);
    } else if (cs.strokeDasharray && cs.strokeDasharray !== 'none' && !out.getAttribute('stroke-dasharray')) {
      out.setAttribute('stroke-dasharray', cs.strokeDasharray);
    }
  });
  return clone;
}
