"use client";

import { useEffect, useMemo, useState } from "react";
import { Volume2 } from "lucide-react";
import { formatVolume, segmentColor } from "@/lib/personVolume";

// "VOL 8.7" on an article card about a person (the person's Goes-to-11 level, lib/personVolume.ts).
// A feed renders dozens of cards at once, so all badges on screen share ONE request: ids are collected
// for a moment and fetched together, and the answers are cached for the session.
export type Vol = { avg: number | null; count: number };
const cache = new Map<string, Vol>();
const listeners = new Map<string, Set<(v: Vol) => void>>();
let queue = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

function request(id: string, cb: (v: Vol) => void) {
  const hit = cache.get(id);
  if (hit) { cb(hit); return () => {}; }
  (listeners.get(id) || listeners.set(id, new Set()).get(id)!).add(cb);
  queue.add(id);
  if (!timer) {
    timer = setTimeout(async () => {
      const ids = Array.from(queue); queue = new Set(); timer = null;
      for (let i = 0; i < ids.length; i += 150) {
        const chunk = ids.slice(i, i + 150);
        try {
          const d = await (await fetch(`/api/people/volume?ids=${chunk.join(',')}`)).json();
          for (const pid of chunk) {
            const v: Vol = d?.byPerson?.[pid] || { avg: null, count: 0 };
            cache.set(pid, v);
            listeners.get(pid)?.forEach(l => l(v));
            listeners.delete(pid);
          }
        } catch { /* the badges stay at "-" */ }
      }
    }, 40);
  }
  return () => { listeners.get(id)?.delete(cb); };
}

/**
 * Levels for many people at once (sorting lists by "Loudest", the Timeline). Shares the cache and the
 * batched request with the badges, so a page with both still asks once per person.
 */
export function usePersonVolumes(ids: (string | null | undefined)[]): Map<string, Vol> {
  const key = Array.from(new Set(ids.filter(Boolean).map(String))).sort().join(',');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!key) return;
    const unsubs = key.split(',').map(id => request(id, () => setTick(t => t + 1)));
    return () => unsubs.forEach(u => u());
  }, [key]);
  return useMemo(() => {
    const m = new Map<string, Vol>();
    for (const id of key ? key.split(',') : []) { const v = cache.get(id); if (v) m.set(id, v); }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);
}

/** Loudest first: a level beats no level, then the higher level, then more votes. 0 = equal. */
export function compareLoudness(a?: Vol, b?: Vol): number {
  const la = a?.count ? (a.avg as number) : -1, lb = b?.count ? (b.avg as number) : -1;
  return lb - la || (b?.count || 0) - (a?.count || 0);
}

/** After a vote on the article page, the badges show the new level without a reload */
export function updateCardVolume(id: string, v: Vol) { cache.set(id, v); }

const SIZE = { xs: 'text-[10px] px-1.5 py-0.5 gap-0.5', sm: 'text-[11px] px-2 py-0.5 gap-1', md: 'text-xs px-2 py-1 gap-1' } as const;

export default function CardVolumeBadge({ personId, size = 'sm' }: { personId: string; size?: 'xs' | 'sm' | 'md' }) {
  const [v, setV] = useState<Vol | null>(cache.get(personId) || null);
  useEffect(() => request(personId, setV), [personId]);
  const level = v?.count ? (v.avg as number) : 0;
  return (
    <span
      className={`inline-flex items-center rounded-sm font-display tracking-wide border ${SIZE[size]}`}
      style={level ? { color: segmentColor(Math.round(level)), borderColor: `${segmentColor(Math.round(level))}55`, backgroundColor: `${segmentColor(Math.round(level))}12` } : { color: '#9ca3af', borderColor: '#E5DDD0' }}
      title={v?.count ? `Goes to 11: the crowd turns this GenXer up to ${formatVolume(v.avg, v.count)} (${v.count} votes)` : 'Goes to 11: nobody has turned this GenXer up yet'}
    >
      <Volume2 className="w-3 h-3" />
      <span>VOL&nbsp;{formatVolume(v?.avg, v?.count || 0)}</span>
    </span>
  );
}
