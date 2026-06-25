"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================
// CENTRAL PENDING WAGER HOOK
// Single source of truth for whether the user has BOGX coins
// locked in an open/active battle. Works identically on
// Desktop AND Mobile so the "pending wager" indicator is
// consistent everywhere.
//
// - Re-syncs on 'bogx-updated' event (fired after any battle
//   create/accept/complete)
// - Re-syncs when the tab becomes visible again
// - Polls periodically as a safety net
// ============================================================

export function usePendingWager(userId?: string) {
  const [hasPendingWager, setHasPendingWager] = useState(false);
  const [pendingAmount, setPendingAmount] = useState(0);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const syncFromServer = useCallback(async () => {
    const id = userIdRef.current;
    if (!id) {
      setHasPendingWager(false);
      setPendingAmount(0);
      return;
    }
    try {
      const res = await fetch(`/api/battles/pending?userId=${id}`);
      const data = await res.json();
      if (data.success) {
        setHasPendingWager(!!data.hasPending);
        setPendingAmount(data.amount || 0);
      }
    } catch {
      // Keep current value on network error
    }
  }, []);

  // Initial load + reload when user changes
  useEffect(() => {
    syncFromServer();
  }, [userId, syncFromServer]);

  // Instant re-sync on BOGX changes + when returning to the tab + periodic poll
  useEffect(() => {
    if (!userId) return;

    const onBogxUpdate = () => syncFromServer();
    const onVisibility = () => {
      if (document.visibilityState === "visible") syncFromServer();
    };

    window.addEventListener("bogx-updated", onBogxUpdate);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);

    const interval = setInterval(syncFromServer, 30000);

    return () => {
      window.removeEventListener("bogx-updated", onBogxUpdate);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
      clearInterval(interval);
    };
  }, [userId, syncFromServer]);

  return { hasPendingWager, pendingAmount, syncFromServer };
}
