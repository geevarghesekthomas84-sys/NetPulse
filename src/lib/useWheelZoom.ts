import { type RefObject, useEffect, useRef } from 'react';

/**
 * Wheel-zoom for an SVG canvas that does not fight the browser.
 *
 * - Zooms only on Ctrl/Cmd + wheel (which is also what a trackpad pinch sends),
 *   so ordinary scrolling still scrolls the page instead of being swallowed.
 * - Uses a native, non-passive listener. React attaches wheel handlers as
 *   passive, which makes `preventDefault()` a no-op: the browser would then
 *   zoom the whole page at the same time as the diagram.
 */
export function useWheelZoom(
  ref: RefObject<Element | null>,
  onZoom: (factor: number, clientX: number, clientY: number) => void
): void {
  const handler = useRef(onZoom);
  handler.current = onZoom;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: Event) => {
      const we = e as WheelEvent;
      if (!we.ctrlKey && !we.metaKey) return;
      we.preventDefault();
      // Trackpad pinch sends small fractional deltas; mouse wheels send large steps.
      const step = Math.min(Math.abs(we.deltaY), 60) / 60;
      const factor = we.deltaY < 0 ? 1 + 0.12 * Math.max(step, 0.3) : 1 - 0.11 * Math.max(step, 0.3);
      handler.current(factor, we.clientX, we.clientY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref]);
}
