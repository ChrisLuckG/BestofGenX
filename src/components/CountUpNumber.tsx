"use client";

import { useEffect, useState } from "react";
import { useCountUp } from "@/hooks/useCountUp";

// A number that counts up from 0 once it appears (optionally after a delay, so it
// can follow a staggered entrance). Same easing as Solo Trivia / Battle results.
export default function CountUpNumber({
  value, format = (n) => String(Math.round(n)), durationMs = 900, delayMs = 0, className,
}: {
  value: number;
  format?: (n: number) => string;
  durationMs?: number;
  delayMs?: number;
  className?: string;
}) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  const v = useCountUp(value, on, durationMs);
  return <span className={className}>{format(on ? v : 0)}</span>;
}
