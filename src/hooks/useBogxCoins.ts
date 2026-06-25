"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================
// CENTRAL BOGX COINS HOOK
// Single source of truth for the user's BOGX balance.
// Works identically on Desktop AND Mobile.
//
// - Loads authoritative balance from the server
// - Re-syncs instantly on 'bogx-updated' event (fired after
//   any game/vote/article reward)
// - Re-syncs when tab becomes visible again (device switch!)
// - setCoins still available for optimistic UI animations,
//   but the server value always wins on next sync
// ============================================================

export function useBogxCoins(userId?: string) {
  const [coins, setCoins] = useState(0);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  // Fetch authoritative balance from server
  const syncFromServer = useCallback(async () => {
    const id = userIdRef.current;
    if (!id) {
      // Guest: load from localStorage
      const guestCoins = parseFloat(localStorage.getItem('bogx_guest_coins') || '0');
      setCoins(guestCoins);
      return;
    }
    try {
      const res = await fetch(`/api/user/${id}`);
      const data = await res.json();
      if (data.user) {
        const bogx = data.user.bogxCoins || 0;
        const legacyBogx = (data.user.coins || 0) / 100;
        // Round to 2 decimals to avoid floating point residue (e.g. -5.5e-17)
        setCoins(Math.round(Math.max(bogx, legacyBogx) * 100) / 100);
      }
    } catch {
      // Keep current value on network error
    }
  }, []);

  // Initial load + reload when user changes
  useEffect(() => {
    syncFromServer();
  }, [userId, syncFromServer]);

  // Instant re-sync on BOGX changes + when returning to the tab
  useEffect(() => {
    if (!userId) return;

    const onBogxUpdate = () => syncFromServer();
    const onVisibility = () => {
      // User switched back to this tab/device - sync to latest server value
      if (document.visibilityState === "visible") syncFromServer();
    };

    window.addEventListener("bogx-updated", onBogxUpdate);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);

    return () => {
      window.removeEventListener("bogx-updated", onBogxUpdate);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, [userId, syncFromServer]);

  return { coins, setCoins, syncFromServer };
}
