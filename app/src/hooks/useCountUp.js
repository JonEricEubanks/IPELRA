/**
 * useCountUp — animates a numeric display from prev value to target.
 * Returns the current display value (number).
 *
 * @param {number} target   - the value to count toward
 * @param {number} duration - animation duration in ms (default 900)
 */
import { useEffect, useRef, useState } from 'react';

export default function useCountUp(target, duration = 900) {
  const [display, setDisplay] = useState(target);
  const prevRef  = useRef(target);
  const frameRef = useRef(null);

  useEffect(() => {
    const from = prevRef.current;
    const to   = target;

    if (from === to) return;

    let start = null;

    function step(ts) {
      if (!start) start = ts;
      const elapsed  = ts - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const ease     = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * ease));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        prevRef.current = to;
      }
    }

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return display;
}
