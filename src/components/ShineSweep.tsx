"use client";

import { useEffect, useState } from "react";

/**
 * A light streak that sweeps across its parent now and then, at a random
 * interval - a small "alive" cue for primary buttons and hero cards.
 *
 * The parent must be `relative overflow-hidden`. Purely decorative: no pointer
 * events, hidden for prefers-reduced-motion (see .shine-sweep in globals.css).
 */
export default function ShineSweep({
  minDelayMs = 3500,
  maxDelayMs = 8000,
  firstDelayMs = 900,
  firstJitterMs = 0,
  intensity = 0.35,
  rgb = '255, 255, 255',
  active = true,
}: {
  /** Streak colour as "r, g, b". White by default; use a tint on light surfaces. */
  rgb?: string;
  minDelayMs?: number;
  maxDelayMs?: number;
  /** Delay before the very first sweep, so it lands shortly after the element appears. */
  firstDelayMs?: number;
  /** Random extra on the first delay, so several shines on one page don't fire in sync. */
  firstJitterMs?: number;
  /** Peak opacity of the white streak. */
  intensity?: number;
  active?: boolean;
}) {
  // Each new key remounts the streak, which restarts the CSS animation.
  const [sweep, setSweep] = useState(0);

  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = (delay: number) => {
      timer = setTimeout(() => {
        setSweep(n => n + 1);
        schedule(minDelayMs + Math.random() * (maxDelayMs - minDelayMs));
      }, delay);
    };
    schedule(firstDelayMs + Math.random() * firstJitterMs);
    return () => clearTimeout(timer);
  }, [active, minDelayMs, maxDelayMs, firstDelayMs, firstJitterMs]);

  if (!active || sweep === 0) return null;

  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      <span
        key={sweep}
        className="shine-sweep"
        style={{ ['--shine-opacity' as string]: intensity, ['--shine-rgb' as string]: rgb }}
      />
    </span>
  );
}
