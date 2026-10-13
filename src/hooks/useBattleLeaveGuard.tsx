"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, Swords } from "lucide-react";
import BrandedConfirmModal from "@/components/BrandedConfirmModal";
import { formatCurrency } from "@/utils/currency";

// While the QuizzBattle "get ready" screen is open, the wager is already taken
// from the balance. Walking away silently (tab click, logo, profile...) used to
// leave a locked wager behind in Open Battles. The battle page registers a guard
// while that screen is up; the app shell calls `intercept()` before any
// navigation and, if a guard is set, asks first. Confirming runs the guard's
// `leave` (cancel + refund, same as the CANCEL button) and then navigates.
export interface BattleLeaveGuard {
  wager: number;
  leave: () => Promise<void>;
}

export function useBattleLeaveGuard() {
  const guardRef = useRef<BattleLeaveGuard | null>(null);
  const [pending, setPending] = useState<{ go: () => void; wager: number } | null>(null);
  const [leaving, setLeaving] = useState(false);

  const setGuard = useCallback((g: BattleLeaveGuard | null) => { guardRef.current = g; }, []);

  /** Returns true when navigation was held back for confirmation. */
  const intercept = useCallback((proceed: () => void): boolean => {
    const g = guardRef.current;
    if (!g) return false;
    setPending({ go: proceed, wager: g.wager });
    return true;
  }, []);

  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  // Desktop has many ways out of the get-ready screen besides the nav: leaderboard
  // rows, banners, news, the rank widget, profile... Rather than wiring each one,
  // catch the click itself. Anything clickable OUTSIDE the battle page is held back,
  // the player is asked, and after confirming the very same click is replayed.
  // "Clickable" = the browser would show a pointer cursor, which excludes empty
  // background and plain text.
  useEffect(() => {
    const onClickCapture = (e: MouseEvent) => {
      if (!guardRef.current || pendingRef.current || !e.isTrusted) return;
      const target = e.target as HTMLElement | null;
      if (!target || typeof target.closest !== "function") return;
      if (target.closest("[data-battle-zone], [role='dialog']")) return;
      if (getComputedStyle(target).cursor !== "pointer") return;
      e.preventDefault();
      e.stopPropagation();
      intercept(() => { target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })); });
    };
    window.addEventListener("click", onClickCapture, true);
    return () => window.removeEventListener("click", onClickCapture, true);
  }, [intercept]);
  const confirm = async () => {
    const g = guardRef.current;
    const go = pending?.go;
    if (!g || !go) { setPending(null); return; }
    setLeaving(true);
    try { await g.leave(); } finally {
      guardRef.current = null; // cleared before navigating, or the same click would be intercepted again
      setLeaving(false);
      setPending(null);
    }
    go();
  };

  const modal = (
    <BrandedConfirmModal
      isOpen={!!pending}
      onClose={() => { if (!leaving) setPending(null); }}
      onConfirm={confirm}
      loading={leaving}
      icon={Swords}
      eyebrow="Battle in progress"
      title="Leave this battle?"
      message="You haven't started yet, so nothing is lost. Leaving cancels the battle and your wager goes straight back to your balance."
      confirmText="LEAVE & GET MY WAGER BACK"
      cancelText="Stay and play"
    >
      <div className="flex items-center gap-3 bg-white rounded-xl border border-warm px-4 py-3 shadow-sm">
        <Lock className="w-5 h-5 text-[#C4772A] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-display uppercase tracking-widest text-gray-500">Your wager</div>
          <div className="font-display text-2xl leading-none text-gray-900 mt-0.5 flex items-center gap-1.5">
            {formatCurrency(pending?.wager ?? 0)}
            <img src="/images/bogxcoin.png" alt="" className="w-5 h-5" />
          </div>
        </div>
        <div className="text-right text-[11px] text-gray-500 leading-tight">locked until<br />you press start</div>
      </div>
    </BrandedConfirmModal>
  );
  return { setGuard, intercept, modal };
}
