"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { autoConvertToBOGX } from "@/utils/currency";

// ============================================================
// CENTRAL LIVE RANKINGS HOOK
// Single source of truth for rankings on Desktop AND Mobile.
// - Fetches from /api/rankings/snapshot
// - Auto-polls every 30s when viewing today
// - Instantly refreshes on 'bogx-updated' event (fired after
//   any game/vote/article reward - see notifyBogxUpdate)
// ============================================================

export interface RankingPlayer {
  id: string;
  rank: number;
  name: string;
  country: string;
  flag: string;
  points: number;
  wins: number;
  avatar: string;
  change?: "up" | "down" | null;
  pointsGained?: number;
  isCurrentUser?: boolean;
  isActive?: boolean;
  isOnline?: boolean;
  isBot?: boolean;
  recentPoints?: number;
  avgAnswerTime?: number;
  isGuest?: boolean;
}

export type RankingPeriod = "day" | "month" | "year";

interface UseLiveRankingsOptions {
  period: RankingPeriod;
  selectedDate: Date;
  userId?: string;
  pollIntervalMs?: number; // default 30000
  limit?: number; // optional: slice results (e.g. 10 for widgets)
}

// Fire this after ANY BOGX change so all rankings UIs update instantly
export function notifyBogxUpdate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bogx-updated"));
  }
}

function formatDateForApi(date: Date, period: RankingPeriod): string {
  if (period === "day") {
    return date.toISOString().split("T")[0]; // YYYY-MM-DD
  } else if (period === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM
  }
  return `${date.getFullYear()}`; // YYYY
}

function isTodayDate(date: Date): boolean {
  return date.toDateString() === new Date().toDateString();
}

export function useLiveRankings({
  period,
  selectedDate,
  userId,
  pollIntervalMs = 5000,
  limit,
}: UseLiveRankingsOptions) {
  const [rankings, setRankings] = useState<RankingPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(true);
  // Own net for the window, also when it is <= 0 and the player is not ranked
  const [myPoints, setMyPoints] = useState<number | undefined>(undefined);
  const prevRankingsRef = useRef<Map<string, { rank: number; points: number; change: "up" | "down" | null }>>(new Map());
  
  // Load previous rankings from localStorage on first render (period-specific key)
  const storageKey = `rankings-prev-state-${period}`;
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          prevRankingsRef.current = new Map(Object.entries(parsed));
        } catch { /* ignore */ }
      }
    }
  }, [storageKey]);

  // Depend on the resolved query string, not the Date object. Callers that pass
  // an inline `new Date()` would otherwise change the dependency on every render
  // and trigger an endless fetch loop (ERR_INSUFFICIENT_RESOURCES).
  const isToday = isTodayDate(selectedDate);
  const query = (() => {
    const params = new URLSearchParams();
    params.set("period", period);
    if (period === "day" && !isToday) {
      params.set("date", formatDateForApi(selectedDate, "day"));
    } else if (period === "month") {
      params.set("month", formatDateForApi(selectedDate, "month"));
    } else if (period === "year") {
      params.set("year", formatDateForApi(selectedDate, "year"));
    }
    if (userId) params.set("userId", userId);
    return params.toString();
  })();

  // A response may only write state if it is for the CURRENT query and no newer
  // response has been applied yet. Month/year are slow: the first fetch (before
  // login resolved, no userId) landed AFTER the fetch with userId and overwrote
  // the user's ranks with "?".
  // Do NOT make this "only the newest REQUEST wins": the day polls every 5s, so
  // once a response takes longer than that every single one is discarded and the
  // widget freezes (Day stuck at -0,48 while the server already said -0,46).
  const requestSeqRef = useRef(0);
  const appliedSeqRef = useRef(0);
  const queryRef = useRef(query);
  queryRef.current = query;

  const fetchRankings = useCallback(
    async (silent = false) => {
      const seq = ++requestSeqRef.current;
      const isStale = () => query !== queryRef.current || seq < appliedSeqRef.current;
      if (!silent) setLoading(true);
      try {
        const res = await fetch(`/api/rankings/snapshot?${query}`);
        if (!res.ok || isStale()) return;

        const data = await res.json();
        if (isStale()) return;
        appliedSeqRef.current = seq;
        setIsLive(data.isLive || isToday);
        setMyPoints(data.me ? autoConvertToBOGX(data.me.points ?? 0) : undefined);

        const players: RankingPlayer[] = (data.rankings || []).map((r: any, index: number) => {
          const id = r._id || r.oderId || `user-${index}`;
          const currentRank = r.rank || index + 1;
          const prev = prevRankingsRef.current.get(id);

          // Arrows come from the server (rank now vs an hour ago / start of today),
          // so every device shows the same direction. The per-browser comparison
          // below is only a fallback for responses without `change`.
          let change: "up" | "down" | null = prev?.change || null;
          if ("change" in r) {
            change = r.change ?? null;
          } else if (prev) {
            if (currentRank < prev.rank) change = "up";
            else if (currentRank > prev.rank) change = "down";
          }

          return {
            id,
            rank: currentRank,
            name: r.username || r.name || "Unknown",
            country: r.country || "World",
            flag: r.countryFlag || r.flag || "🌍",
            points: autoConvertToBOGX(r.points ?? 0),
            wins: r.wins || 0,
            avatar:
              r.avatar && r.avatar.length > 0
                ? r.avatar
                : `https://i.pravatar.cc/100?u=${id}`,
            isCurrentUser: userId === id,
            change,
            pointsGained: autoConvertToBOGX(r.recentPoints || 0),
            isActive: r.isActive || false,
            isOnline: r.isOnline === true,
            isBot: r.isBot === true,
            recentPoints: autoConvertToBOGX(r.recentPoints || 0),
          };
        });

        const newPrev = new Map<string, { rank: number; points: number; change: "up" | "down" | null }>();
        players.forEach((p) => newPrev.set(p.id, { rank: p.rank, points: p.points, change: p.change || null }));
        prevRankingsRef.current = newPrev;
        
        // Save to localStorage for persistence across refreshes (period-specific key)
        try {
          const toSave = Object.fromEntries(newPrev.entries());
          localStorage.setItem(storageKey, JSON.stringify(toSave));
        } catch { /* ignore */ }

        setRankings(limit ? players.slice(0, limit) : players);
      } catch (error) {
        console.error("Failed to fetch rankings:", error);
      } finally {
        if (query === queryRef.current) setLoading(false);
      }
    },
    [query, isToday, storageKey, userId, limit]
  );

  // Initial load + reload when period/date/user changes
  useEffect(() => {
    fetchRankings(false);
  }, [fetchRankings]);

  // Does the window being shown include "now"? Only then can a balance change move it.
  const now = new Date();
  const isCurrentPeriod =
    period === "day" ? isToday
    : period === "month" ? selectedDate.getFullYear() === now.getFullYear() && selectedDate.getMonth() === now.getMonth()
    : selectedDate.getFullYear() === now.getFullYear();

  // Polling + instant refresh whenever the balance moves.
  //
  // The scoreboard shows coins AND day/month/year side by side, so they must move
  // together. Every current window (not only the day - month and year used to wait
  // for their 60s poll) refreshes on:
  //  - 'bogx-updated': a reward/battle was committed server-side
  //  - 'bogx-balance-changed': useBogxCoins saw the balance change, whatever the
  //    cause - catches flows that update coins without dispatching bogx-updated
  // A second refresh follows after the ledger write window: optimistic coin updates
  // run BEFORE the reward POST commits, so the first refresh can still read the old
  // ledger (same reason as OPTIMISTIC_WINDOW_MS in useBogxCoins).
  useEffect(() => {
    const interval = setInterval(
      () => fetchRankings(true),
      period === "day" && isToday ? pollIntervalMs : 60000
    );
    if (!isCurrentPeriod) return () => clearInterval(interval);

    let soon: ReturnType<typeof setTimeout> | null = null;
    let settle: ReturnType<typeof setTimeout> | null = null;
    const onBalanceMoved = () => {
      if (soon) clearTimeout(soon);
      if (settle) clearTimeout(settle);
      soon = setTimeout(() => fetchRankings(true), 150);
      settle = setTimeout(() => fetchRankings(true), 2800);
    };
    window.addEventListener("bogx-updated", onBalanceMoved);
    window.addEventListener("bogx-balance-changed", onBalanceMoved);

    return () => {
      clearInterval(interval);
      if (soon) clearTimeout(soon);
      if (settle) clearTimeout(settle);
      window.removeEventListener("bogx-updated", onBalanceMoved);
      window.removeEventListener("bogx-balance-changed", onBalanceMoved);
    };
  }, [period, isToday, isCurrentPeriod, pollIntervalMs, fetchRankings]);

  // Derived helpers
  const currentUserEntry = rankings.find((p) => p.isCurrentUser) || null;

  return {
    rankings,
    loading,
    isLive,
    currentUserEntry,
    myPoints,
    refresh: fetchRankings,
  };
}
