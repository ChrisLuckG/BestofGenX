"use client";

import { useEffect, useState } from "react";
import { Swords, Users } from "lucide-react";
import CountryFlag from "@/components/CountryFlag";
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
function Chip({ r, dim }: { r?: Result; dim?: boolean }) {
  const bg = !r ? "border border-dashed border-gray-300" : dim ? "bg-gray-300" : r === "W" ? "bg-green-600" : r === "L" ? "bg-red-500" : "bg-gray-500";
  return (
    <span className={`inline-flex flex-shrink-0 items-center justify-center w-4 h-4 rounded text-white font-display text-[10px] leading-none ${bg}`}>
      {r}
    </span>
  );
}

const LABEL = "text-[9px] font-display tracking-widest uppercase text-gray-500 leading-none";

// Compact one-line H2H (your W/L/T vs this player + last 5) for the battle pool
// cards. Always the same slots, with or without history.
// `stacked`: two lines (record + ring / last 5) for narrow phone rows, where one
// line squeezed the chips together.
export function H2HStrip({ h2h, stacked = false }: { h2h?: InvitePlayer["h2h"]; stacked?: boolean }) {
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
      {online && <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-green-500" />}

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
          {online && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />}
        </div>
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-1.5">
            {player.countryFlag && <CountryFlag flag={player.countryFlag} className="w-4 h-3 rounded-[2px] flex-shrink-0" />}
            <span className="font-display text-lg leading-none tracking-wide text-gray-900 truncate">{player.username}</span>
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
      </div>

      {/* Stats: matches | win-rate ring | H2H - fixed columns so every card lines up,
          with or without data */}
      <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-warm/70">
        <div className="flex-1 min-w-0 flex items-center gap-1.5" title="Battles you played against this player">
          <Swords className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <div>
            <div className={LABEL}>Matches</div>
            <div className="font-display text-lg leading-none text-gray-900 mt-0.5">{total}</div>
          </div>
        </div>

        <div title="Your win rate against this player" className="flex-none px-3 border-x border-warm/70">
          <WinRateRing rate={winRate} active={total > 0} />
        </div>

        <div className="flex-1 min-w-0 flex flex-col items-end" title={h2hTotal > 0 ? "Your head-to-head record against this player" : "You haven't played this player yet"}>
          <div className={`${LABEL} flex items-center gap-1`}>
            <Users className="w-3 h-3" /> H2H
          </div>
          <div className={`flex items-center gap-1 mt-1 font-display text-sm leading-none ${h2hTotal > 0 ? "" : "text-gray-300"}`}>
            <Chip r="W" dim={!h2hTotal} /><span className={h2hTotal ? "text-green-600" : ""}>{h2h?.wins ?? 0}</span>
            <Chip r="L" dim={!h2hTotal} /><span className={h2hTotal ? "text-red-500" : ""}>{h2h?.losses ?? 0}</span>
            <Chip r="T" dim={!h2hTotal} /><span className={h2hTotal ? "text-gray-600" : ""}>{h2h?.ties ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Last 5 vs this player, newest first - always five slots */}
      <div className="flex items-center justify-end gap-0.5 mt-2.5 pt-2 border-t border-warm/70">
        <span className={`${LABEL} mr-1`}>Last 5</span>
        {Array.from({ length: 5 }, (_, i) => <Chip key={i} r={h2h?.last5?.[i]} />)}
      </div>
    </button>
  );
}
