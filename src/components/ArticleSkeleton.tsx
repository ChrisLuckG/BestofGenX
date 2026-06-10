"use client";

import { useState, useEffect } from "react";

const LOADING_STEPS = [
  "Loading header...",
  "Loading images...",
  "Loading story...",
  "Almost there...",
];

// Skeleton placeholder for the article view. Shows animated, rotating
// loading labels inside shimmering skeleton cards instead of a logo.
export default function ArticleSkeleton() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % LOADING_STEPS.length);
    }, 1100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full bg-cream overflow-y-auto" style={{ scrollbarWidth: "none" }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="w-9 h-9 rounded-full bg-skeleton-light animate-pulse" />
        <div className="h-4 w-24 rounded bg-skeleton-light animate-pulse" />
      </div>

      {/* Hero image skeleton */}
      <div className="px-4">
        <div className="relative w-full h-48 rounded-2xl bg-skeleton-light overflow-hidden animate-pulse">
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[12px] font-bold tracking-widest uppercase text-gray-400/80 animate-pulse">
              {LOADING_STEPS[step]}
            </span>
          </div>
          {/* Shimmer sweep */}
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.6s_infinite]" />
        </div>
      </div>

      {/* Title lines */}
      <div className="px-4 mt-4 space-y-2">
        <div className="h-6 w-11/12 rounded bg-skeleton-light animate-pulse" />
        <div className="h-6 w-3/4 rounded bg-skeleton-light animate-pulse" />
      </div>

      {/* Meta row */}
      <div className="px-4 mt-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-skeleton-light animate-pulse" />
        <div className="h-3 w-28 rounded bg-skeleton-light animate-pulse" />
        <div className="h-3 w-16 rounded bg-skeleton-light animate-pulse" />
      </div>

      {/* Paragraph lines */}
      <div className="px-4 mt-6 space-y-2.5">
        {[100, 96, 92, 98, 88, 94, 70].map((w, i) => (
          <div
            key={i}
            className="h-3.5 rounded bg-skeleton-light animate-pulse"
            style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>

      {/* Second image block */}
      <div className="px-4 mt-6">
        <div className="relative w-full h-36 rounded-2xl bg-skeleton-light overflow-hidden animate-pulse">
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.6s_infinite]" />
        </div>
      </div>

      <div className="px-4 mt-6 mb-10 space-y-2.5">
        {[95, 90, 85, 60].map((w, i) => (
          <div
            key={i}
            className="h-3.5 rounded bg-skeleton-light animate-pulse"
            style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
