"use client";

import { useEffect, useState } from "react";

/**
 * Eased 0 -> target ramp for result-screen figures.
 *
 * Writes ABSOLUTE values (`target * eased`), never `prev + step`: a relative
 * accumulation drifts off the real total and is exactly the double-counting
 * pattern the coin-counter rule in AGENTS.md forbids.
 *
 * `active` gates the ramp instead of a conditional hook call, so callers that
 * only animate in one phase keep a stable hook order across renders.
 *
 * Shared by Solo Trivia and the Battle result screen - the two screens are
 * meant to feel the same, and a second copy of the easing would let them drift.
 */
export function useCountUp(target: number, active: boolean, durationMs = 900): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - started) / durationMs, 1);
      // easeOutCubic - fast first, settles on the number instead of snapping.
      setValue(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, active, durationMs]);

  return value;
}

export default useCountUp;
