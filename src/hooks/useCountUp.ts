"use client";

import { useEffect, useRef, useState } from "react";

/**
 * One-off intro: once `target` is first defined (loaded), ramps 0 -> target and
 * returns the ramp value; returns null otherwise, so the caller keeps showing its
 * own (separately animated) value. Used for the scoreboard coin counter.
 */
export function useIntroCount(target: number | undefined, durationMs = 1100): number | null {
  const [value, setValue] = useState<number | null>(null);
  const startedRef = useRef(false);
  const targetRef = useRef(target);
  targetRef.current = target;

  // Keyed on "loaded" only: re-running on every target change would cancel the
  // ramp mid-way and leave it frozen on an intermediate value.
  const ready = target !== undefined;
  useEffect(() => {
    if (!ready || startedRef.current) return;
    startedRef.current = true;
    setValue(0);
    let frame = 0;
    const started = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - started) / durationMs, 1);
      // Ramp towards the CURRENT target, so a sync landing mid-intro is honoured.
      const t = targetRef.current ?? 0;
      setValue(p >= 1 ? null : t * (1 - Math.pow(1 - p, 3)));
      if (p < 1) frame = requestAnimationFrame(step);
      else finished = true;
    };
    let finished = false;
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      setValue(null);
      // Interrupted (unmount, Strict Mode double effect): allow a fresh start
      if (!finished) startedRef.current = false;
    };
  }, [ready, durationMs]);

  return value;
}

/**
 * Value to show for an unranked period while it animates: a ramp coming down from
 * a positive balance must not pass through > 0, which formatUnrankedValue renders
 * as "?". Positive targets (unknown / not listed) are returned unchanged.
 */
export function animateUnranked(target: number | undefined, animated: number | undefined): number | undefined {
  if (target === undefined || target > 0 || animated === undefined) return target;
  return Math.min(animated, 0);
}

/**
 * Live figure for the scoreboard. When the first real value arrives (after
 * loading) it counts up/down from 0 - a small intro gimmick. With
 * `changes: true` it also counts from the previous value to every new one
 * (-0,46 -> -0,44); callers whose value is already animated elsewhere (the coin
 * counter, see animateCoins) pass `changes: false` so it isn't animated twice.
 * `undefined` (unknown / loading) passes straight through.
 * Absolute values (`from + delta * eased`), same rule as useCountUp below.
 */
export function useAnimatedValue(
  target: number | undefined,
  { durationMs = 800, introMs = 1100, changes = true }: { durationMs?: number; introMs?: number; changes?: boolean } = {},
): number | undefined {
  const [value, setValue] = useState<number | undefined>(undefined);
  const shownRef = useRef<number | undefined>(undefined);
  const introDoneRef = useRef(false);

  useEffect(() => {
    const isIntro = target !== undefined && !introDoneRef.current;
    if (isIntro) {
      introDoneRef.current = true;
      // Show the 0 right away (no frame with the final number), and keep it in
      // shownRef so an interrupted intro (Strict Mode re-run) resumes from 0.
      shownRef.current = 0;
      setValue(0);
    }
    const from = isIntro ? 0 : shownRef.current;
    if (target === undefined || from === undefined || from === target || (!isIntro && !changes)) {
      shownRef.current = target;
      setValue(target);
      return;
    }
    const duration = isIntro ? introMs : durationMs;
    let frame = 0;
    const started = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - started) / duration, 1);
      const v = p >= 1 ? target : from + (target - from) * (1 - Math.pow(1 - p, 3));
      shownRef.current = v;
      setValue(v);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    // Interrupted mid-ramp: the next ramp continues from what is on screen (shownRef)
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, introMs, changes]);

  return value;
}

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
