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

// How long an optimistic change owns the counter before a server value may
// overwrite it. Must exceed the longest count-up animation (1.5s on desktop):
// a server value landing mid-animation is what caused the balance to overshoot
// (96.71 -> 96.75 -> 96.73). The animation adds RELATIVE steps, the sync writes an
// ABSOLUTE value, so any sync inside the animation window gets the remaining steps
// added on top of an already-correct balance.
const OPTIMISTIC_WINDOW_MS = 2500;

export function useBogxCoins(userId?: string) {
  const [coins, setCoinsState] = useState(0);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  // When the last optimistic (local) change happened, and a handle for a sync that
  // was postponed because of it.
  const lastOptimisticAtRef = useRef(0);
  const deferredSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncRef = useRef<() => void>(() => {});

  /**
   * Optimistic setter for callers (animations, instant reward feedback).
   *
   * Every call marks the counter as locally owned for OPTIMISTIC_WINDOW_MS, so a
   * concurrent server sync waits instead of interleaving with a running animation.
   */
  const setCoins = useCallback<React.Dispatch<React.SetStateAction<number>>>(value => {
    lastOptimisticAtRef.current = Date.now();
    setCoinsState(value);
  }, []);
  // Monotonically increasing request counter. If multiple syncFromServer()
  // calls overlap (e.g. rapidly cancelling several battles in a row, each
  // firing a 'bogx-updated' event), responses can resolve OUT OF ORDER —
  // an older request's response arriving after a newer one would otherwise
  // overwrite the correct latest balance with a stale value. Only the
  // response matching the most recently issued request is allowed to apply.
  const requestIdRef = useRef(0);

  // Fetch authoritative balance from server
  const syncFromServer = useCallback(async () => {
    // An optimistic change is still playing out - postpone instead of fighting it.
    // Rewards are dispatched the moment the user clicks, so 'bogx-updated' usually
    // arrives while the count-up is running AND before the POST has committed;
    // waiting fixes both the overshoot and reading a pre-credit balance.
    const sinceOptimistic = Date.now() - lastOptimisticAtRef.current;
    if (sinceOptimistic < OPTIMISTIC_WINDOW_MS) {
      if (deferredSyncRef.current) clearTimeout(deferredSyncRef.current);
      deferredSyncRef.current = setTimeout(() => {
        deferredSyncRef.current = null;
        syncRef.current();
      }, OPTIMISTIC_WINDOW_MS - sinceOptimistic + 50);
      return;
    }

    const id = userIdRef.current;
    const myRequestId = ++requestIdRef.current;
    if (!id) {
      // Guest: load from localStorage
      const stored = localStorage.getItem('bogx_guest_coins');
      const guestCoins = stored !== null ? parseFloat(stored) : 0;
      if (myRequestId === requestIdRef.current) setCoinsState(guestCoins);
      return;
    }
    try {
      const res = await fetch(`/api/user/${id}`);
      const data = await res.json();
      // Discard this response if a newer sync has been kicked off meanwhile.
      if (myRequestId !== requestIdRef.current) return;
      if (data.user) {
        const bogx = data.user.bogxCoins ?? 0;
        // Round to 2 decimals to avoid floating point residue (e.g. -5.5e-17)
        // Allow negative balances - don't use Math.max
        // setCoinsState, not setCoins: a server value is not an optimistic change
        // and must not extend the suppression window.
        setCoinsState(Math.round(bogx * 100) / 100);
      }
    } catch {
      // Keep current value on network error
    }
  }, []);
  syncRef.current = syncFromServer;

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

  // Drop a postponed sync when the component goes away.
  useEffect(() => () => {
    if (deferredSyncRef.current) clearTimeout(deferredSyncRef.current);
  }, []);

  return { coins, setCoins, syncFromServer };
}
