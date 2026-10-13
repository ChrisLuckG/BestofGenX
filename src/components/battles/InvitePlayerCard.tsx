"use client";

import { useEffect, useState } from "react";
import { Swords } from "lucide-react";
import CountryFlag from "@/components/CountryFlag";
import CountUpNumber from "@/components/CountUpNumber";
import { useCountUp } from "@/hooks/useCountUp";

type Result = "W" | "L" | "T";

export interface InvitePlayer {
  _id: string;
  username: string;
  avatar?: string;
  countryFlag?: string;
  isOnline?: boolean;
  rank?: number | null;
  points?: number;
  bogxCoins?: number;
  battlesWon?: number;
  battlesLost?: number;
  h2h?: { wins: number; losses: number; ties?: number; last5?: Result[] } | null;
}

// Win-rate ring: draws from 0 to the player's rate once the card mounts,
// the number in the middle counts up alongside.
function WinRateRing({ rate, active, small = false }: { rate: number; active: boolean; small?: boolean }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const shown = useCountUp(rate, drawn && active, 900);
  const r = 18;
  const c = 2 * Math.PI * r;
  const color = !active ? "#D1D5DB" : rate >= 50 ? "#16A34A" : "#E36B11";
  return (
    <div className={`relative flex-shrink-0 ${small ? "w-7 h-7" : "w-11 h-11"}`}>
      <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#E8DFD3" strokeWidth={small ? 5 : 4} />
        <circle
          cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth={small ? 5 : 4} strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={drawn && active ? c * (1 - rate / 100) : c}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center font-display text-gray-900 ${small ? "text-[8px] tracking-tighter" : "text-sm"}`}>
        {active ? `${Math.round(shown)}%` : "—"}
      </span>
    </div>
  );
}

// `r` undefined = empty slot, so every card keeps the same five positions.
function Chip({ r, dim, lg, delay }: { r?: Result; dim?: boolean; lg?: boolean; delay?: number }) {
  const bg = !r ? "border border-dashed border-gray-300" : dim ? "bg-gray-300" : r === "W" ? "bg-green-600" : r === "L" ? "bg-red-500" : "bg-gray-500";
  return (
    <span className={`inline-flex flex-shrink-0 items-center justify-center rounded text-white font-display leading-none ${lg ? "w-7 h-7 text-sm" : "w-4 h-4 text-[10px]"} ${bg}`} style={delay !== undefined ? { animation: `chipIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms backwards` } : undefined}>
      {r}
    </span>
  );
}

const LABEL = "text-[9px] font-display tracking-widest uppercase text-gray-500 leading-none";

// Compact one-line H2H (your W/L/T vs this player + last 5) for the battle pool
// cards. Always the same slots, with or without history.
// `stacked`: two lines (record + ring / last 5) for narrow phone rows, where one
// line squeezed the chips together.
export function H2HStrip({ h2h, stacked = false, narrow = false, large = false }: { h2h?: InvitePlayer["h2h"]; stacked?: boolean; narrow?: boolean; large?: boolean }) {
  const total = h2h ? h2h.wins + h2h.losses + (h2h.ties || 0) : 0;
  const record = (
    <div className={`flex-1 min-w-0 flex items-center gap-1 font-display text-sm leading-none tabular-nums ${total ? "" : "text-gray-300"}`}>
      <span className={`${LABEL} mr-0.5`}>H2H</span>
      <Chip r="W" dim={!total} /><span className={`min-w-[1.25em] ${total ? "text-green-600" : ""}`}>{h2h?.wins ?? 0}</span>
      <Chip r="L" dim={!total} /><span className={`min-w-[1.25em] ${total ? "text-red-500" : ""}`}>{h2h?.losses ?? 0}</span>
      <Chip r="T" dim={!total} /><span className={`min-w-[1.25em] ${total ? "text-gray-600" : ""}`}>{h2h?.ties ?? 0}</span>
    </div>
  );
  const ring = (
    <div className="flex-none" title="Your win rate against this player">
      <WinRateRing small rate={total ? Math.round((h2h!.wins / total) * 100) : 0} active={total > 0} />
    </div>
  );
  const form = Array.from({ length: 5 }, (_, i) => <Chip key={i} r={h2h?.last5?.[i]} />);
  const title = total ? "Your record against this player · last 5, newest first" : "You haven't played this player yet";

  if (large) {
    // Setup screen on desktop: plenty of room, so the same three facts at reading size
    const num = (v: number, cls: string, d: number) => <CountUpNumber value={v} delayMs={d} durationMs={800} className={`font-display text-2xl leading-none tabular-nums ${total ? cls : "text-gray-300"}`} />;
    return (
      <div className="flex items-center" title={title}>
        <div className="flex-1 min-w-0 flex flex-col items-center">
          <div className={`${LABEL} !text-[11px]`}>Your record</div>
          <div className="flex items-center gap-1.5 mt-2">
            <Chip lg r="W" dim={!total} delay={250} />{num(h2h?.wins ?? 0, "text-green-600", 300)}
            <Chip lg r="L" dim={!total} delay={400} />{num(h2h?.losses ?? 0, "text-red-500", 450)}
            <Chip lg r="T" dim={!total} delay={550} />{num(h2h?.ties ?? 0, "text-gray-600", 600)}
          </div>
        </div>
        <div className="flex-none px-6 mx-2 border-x border-warm flex flex-col items-center gap-1">
          <div className={`${LABEL} !text-[11px]`}>Win rate</div>
          <WinRateRing rate={total ? Math.round((h2h!.wins / total) * 100) : 0} active={total > 0} />
        </div>
        <div className="flex-1 min-w-0 flex flex-col items-center">
          <div className={`${LABEL} !text-[11px]`}>Last 5</div>
          <div className="flex items-center gap-1 mt-2">
            {Array.from({ length: 5 }, (_, i) => <Chip lg key={i} r={h2h?.last5?.[i]} delay={700 + i * 90} />)}
          </div>
        </div>
      </div>
    );
  }  if (narrow) {
    // ~200px desktop pool cards: three columns side by side overlapped, so the
    // ring shares a row with the record and the last 5 get their own row.
    return (
      <div title={title}>
        <div className="flex items-center gap-2">{record}{ring}</div>
        <div className="flex items-center justify-between gap-1 mt-1.5 pt-1.5 border-t border-warm/50">
          <span className={LABEL}>Last 5</span>
          <div className="flex items-center gap-0.5">{form}</div>
        </div>
      </div>
    );
  }
  if (stacked) {
    // Phone: one tight row, labels above the values - H2H | ring | Last 5
    return (
      <div className="flex items-center" title={title}>
        <div className="flex-1 min-w-0">
          <div className={LABEL}>H2H</div>
          <div className={`flex items-center gap-0.5 mt-1 font-display text-sm leading-none tabular-nums ${total ? "" : "text-gray-300"}`}>
            <Chip r="W" dim={!total} /><span className={`mr-1 ${total ? "text-green-600" : ""}`}>{h2h?.wins ?? 0}</span>
            <Chip r="L" dim={!total} /><span className={`mr-1 ${total ? "text-red-500" : ""}`}>{h2h?.losses ?? 0}</span>
            <Chip r="T" dim={!total} /><span className={total ? "text-gray-600" : ""}>{h2h?.ties ?? 0}</span>
          </div>
        </div>
        <div className="flex-none px-3 mx-1 border-x border-warm/70">{ring}</div>
        <div className="flex-1 min-w-0 flex flex-col items-end">
          <div className={LABEL}>Last 5</div>
          <div className="flex items-center gap-0.5 mt-1">{form}</div>
        </div>
      </div>
    );
  }
  return (
    // Fixed columns (record | ring | last 5): with justify-between the ring moved
    // with the width of the numbers, so it sat somewhere else on every card.
    <div className="flex items-center gap-2" title={title}>
      {record}
      {ring}
      <div className="flex-1 flex items-center justify-end gap-0.5">{form}</div>
    </div>
  );
}

export default function InvitePlayerCard({ player, onSelect }: { player: InvitePlayer; onSelect: () => void }) {
  // Everything below the name is YOU vs THIS player. Matches + ring used to be the
  // other player's overall record, so after losing your only battle against him
  // the card said "1 match, 100%" - his win, read as yours.
  const h2h = player.h2h;
  const h2hTotal = h2h ? h2h.wins + h2h.losses + (h2h.ties || 0) : 0;
  const total = h2hTotal;
  const winRate = h2hTotal > 0 ? Math.round((h2h!.wins / h2hTotal) * 100) : 0;
  const online = !!player.isOnline;

  return (
    <button
      onClick={onSelect}
      className={`relative w-full p-3 bg-cream border-2 rounded-xl text-left group transition-all duration-200 active:scale-[0.98] ${
        // No translate on hover: the list scrolls, and a lifted first row got its
        // top border clipped by the scroll container.
        online ? "border-warm hover:border-[#E36B11]/60 hover:bg-[#FBEBDD] hover:shadow-md" : "border-gray-200 opacity-60 hover:opacity-80"
      }`}
    >
      {/* Identity */}
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-md bg-white">
            {player.avatar ? (
              <img src={player.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg font-display">
                {player.username?.[0]?.toUpperCase() || "?"}
              </div>
            )}
          </div>
          {/* Flag where the online dot used to be, like the leaderboard widget; the
              online dot moves to the opposite corner */}
          {player.countryFlag && (
            <div className="absolute -bottom-1 -right-1">
              <CountryFlag flag={player.countryFlag} className="w-5 h-4 rounded-[2px] shadow-sm" />
            </div>
          )}
          {online && <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />}
        </div>
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-display text-lg leading-none tracking-wide text-gray-900 truncate">{player.username}</span>
            <span className="flex items-center gap-0.5 flex-shrink-0 font-display text-sm leading-none text-gray-500" title="Battles you played against this player">
              <Swords className="w-3.5 h-3.5" />{total}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="px-1.5 py-px rounded bg-[#E8DFD3]/70 font-display text-sm leading-tight text-gray-900">
              #{player.rank || "—"}
            </span>
            <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
            <span className="font-display text-base leading-none text-gray-900">
              {(player.points ?? player.bogxCoins ?? 0).toFixed(2)}
            </span>
          </div>
        </div>
        {/* Your win rate vs this player, top right (was in the middle of the stats row) */}
        <div title="Your win rate against this player" className="flex-none">
          <WinRateRing rate={winRate} active={total > 0} />
        </div>
      </div>

      {/* One row: your record vs this player (left), last 5 newest first (right).
          Always the same slots, with or without history. */}
      <div
        className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-warm/70"
        title={h2hTotal > 0 ? "Your record against this player · last 5, newest first" : "You haven't played this player yet"}
      >
        <div className={`flex items-center gap-1 font-display text-sm leading-none tabular-nums ${h2hTotal > 0 ? "" : "text-gray-300"}`}>
          <span className={`${LABEL} mr-0.5`}>H2H</span>
          <Chip r="W" dim={!h2hTotal} /><span className={h2hTotal ? "text-green-600" : ""}>{h2h?.wins ?? 0}</span>
          <Chip r="L" dim={!h2hTotal} /><span className={h2hTotal ? "text-red-500" : ""}>{h2h?.losses ?? 0}</span>
          <Chip r="T" dim={!h2hTotal} /><span className={h2hTotal ? "text-gray-600" : ""}>{h2h?.ties ?? 0}</span>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {Array.from({ length: 5 }, (_, i) => <Chip key={i} r={h2h?.last5?.[i]} />)}
        </div>
      </div>    </button>
  );
}
