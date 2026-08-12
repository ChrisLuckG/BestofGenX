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
  const prevRankingsRef = useRef<Map<string, { rank: number; points: number }>>(new Map());

  const fetchRankings = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("period", period);
        if (period === "day" && !isTodayDate(selectedDate)) {
          params.set("date", formatDateForApi(selectedDate, "day"));
        } else if (period === "month") {
          params.set("month", formatDateForApi(selectedDate, "month"));
        } else if (period === "year") {
          params.set("year", formatDateForApi(selectedDate, "year"));
        }

        const res = await fetch(`/api/rankings/snapshot?${params.toString()}`);
        if (!res.ok) return;

        const data = await res.json();
        setIsLive(data.isLive || isTodayDate(selectedDate));

        const players: RankingPlayer[] = (data.rankings || []).map((r: any, index: number) => {
          const id = r._id || r.oderId || `user-${index}`;
          const currentRank = r.rank || index + 1;
          const prev = prevRankingsRef.current.get(id);

          let change: "up" | "down" | null = null;
          if (prev) {
            if (currentRank < prev.rank) change = "up";
            else if (currentRank > prev.rank) change = "down";
          }

          return {
            id,
            rank: currentRank,
            name: r.username || r.name || "Unknown",
            country: r.country || "World",
            flag: r.countryFlag || r.flag || "🌍",
            points: autoConvertToBOGX(r.points || 0),
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

        const newPrev = new Map<string, { rank: number; points: number }>();
        players.forEach((p) => newPrev.set(p.id, { rank: p.rank, points: p.points }));
        prevRankingsRef.current = newPrev;

        setRankings(limit ? players.slice(0, limit) : players);
      } catch (error) {
        console.error("Failed to fetch rankings:", error);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [period, selectedDate, userId, limit]
  );

  // Initial load + reload when period/date/user changes
  useEffect(() => {
    fetchRankings(false);
  }, [fetchRankings]);

  // Polling + instant refresh via bogx-updated event
  useEffect(() => {
    const isLiveDay = period === "day" && isTodayDate(selectedDate);
    const isCurrentMonthOrYear = period === "month" || period === "year";

    // Day: fast poll + bogx-updated event
    // Month/Year: slow poll every 60s to pick up accumulated plays
    const interval = setInterval(
      () => fetchRankings(true),
      isLiveDay ? pollIntervalMs : 60000
    );

    const onBogxUpdate = () => fetchRankings(true);
    if (isLiveDay) window.addEventListener("bogx-updated", onBogxUpdate);

    return () => {
      clearInterval(interval);
      if (isLiveDay) window.removeEventListener("bogx-updated", onBogxUpdate);
    };
  }, [period, selectedDate, pollIntervalMs, fetchRankings]);

  // Derived helpers
  const currentUserEntry = rankings.find((p) => p.isCurrentUser) || null;

  return {
    rankings,
    loading,
    isLive,
    currentUserEntry,
    refresh: fetchRankings,
  };
}
