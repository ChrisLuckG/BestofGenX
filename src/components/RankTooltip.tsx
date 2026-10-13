"use client";

import { rankUnrankedTip, rankUnrankedGuestTip, type RankPeriod } from "@/lib/rankPeriod";

// The explanation under the scoreboard when a period shows "?" or a balance instead
// of a rank. One component for the desktop widget and the mobile header (they drifted
// apart before). Deliberately calm: the scoreboard above is the orange thing, so this
// is a light card with a thin orange top line, the coin and the period name - not a
// second orange block. Wording stays in lib/rankPeriod.ts.
const TITLES: Record<RankPeriod, string> = { day: "Daily ranking", month: "Monthly ranking", year: "Yearly ranking" };

export default function RankTooltip({
  period, isLoggedIn, onLogin, compact = false, className = "",
}: {
  period: RankPeriod;
  isLoggedIn: boolean;
  onLogin?: () => void;
  /** Phone header: smaller type */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      role="tooltip"
      className={`rounded-xl border border-warm border-t-2 border-t-[#E36B11] bg-[#FFFDF9] shadow-[0_8px_24px_rgba(60,40,20,0.14)] ${compact ? "px-3 py-2.5" : "px-4 py-3.5"} ${className}`}
      style={{ animation: "rankTipIn 0.22s ease-out both", transformOrigin: "top right" }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <img src="/images/bogxcoin.png" alt="" className={compact ? "w-4 h-4" : "w-[18px] h-[18px]"} />
        <span className={`font-display tracking-wider uppercase text-gray-900 ${compact ? "text-xs" : "text-sm"}`}>{TITLES[period]}</span>
      </div>
      <p className={`text-gray-600 leading-relaxed ${compact ? "text-[11px]" : "text-[13px]"}`}>
        {isLoggedIn ? (
          rankUnrankedTip(period)
        ) : (
          <><span className="font-semibold text-[#E36B11]">Log in</span>{rankUnrankedGuestTip(period)}</>
        )}
      </p>
      {!isLoggedIn && onLogin && (
        <button
          onClick={(e) => { e.stopPropagation(); onLogin(); }}
          className={`mt-2.5 w-full rounded-lg border border-[#E36B11]/50 bg-[#E36B11]/10 text-[#E36B11] font-display tracking-wider transition-colors hover:bg-[#E36B11] hover:text-white ${compact ? "py-1.5 text-sm" : "py-1.5 text-[15px]"}`}
        >
          LOG IN
        </button>
      )}
    </div>
  );
}
