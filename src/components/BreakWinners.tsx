"use client";

import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import CountryFlag from "./CountryFlag";
import CountUpNumber from "./CountUpNumber";
import LoadingDots from "./LoadingDots";

// Shown during the 9:55-10:00 daily break instead of empty space: the top three of
// the ranking day that has just ended, and a reminder that the next round is about to
// start. /api/rankings/snapshot?period=day is, before 10:00, still the day that is
// ending - so no date maths is needed here.
interface Winner { _id: string; username: string; avatar?: string; countryFlag?: string; points: number; isBot?: boolean }

const MEDAL = ["#E5A500", "#9CA3AF", "#C4772A"]; // gold, silver, bronze
const fmt = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Avatar({ w, size, ring }: { w: Winner; size: string; ring: string }) {
  return (
    <div className="relative">
      <div className={`${size} rounded-full overflow-hidden bg-white border-[3px] shadow-md`} style={{ borderColor: ring }}>
        {w.avatar
          ? <img src={w.avatar} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center font-display text-lg text-gray-400">{w.username[0]}</div>}
      </div>
      {w.countryFlag && (
        <div className="absolute -bottom-1 -right-1">
          <CountryFlag flag={w.countryFlag} className="w-4 h-3 rounded-[2px] shadow-sm" />
        </div>
      )}
    </div>
  );
}

export default function BreakWinners({ variant = "podium" }: { variant?: "podium" | "list" }) {
  const [winners, setWinners] = useState<Winner[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/rankings/snapshot?period=day")
      .then(r => r.json())
      .then(d => { if (!cancelled) setWinners((d.rankings || []).slice(0, 3)); })
      .catch(() => { if (!cancelled) setWinners([]); });
    return () => { cancelled = true; };
  }, []);

  const title = (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1.5 font-display uppercase tracking-wider text-gray-900">
        <Crown className="w-4 h-4 text-[#E5A500]" />
        <span className="text-sm">Winners of the day</span>
      </div>
      <p className="text-[11px] text-gray-500 mt-0.5">The next round starts in a moment.</p>
    </div>
  );

  if (winners === null) {
    return <div className="py-3">{title}<div className="flex justify-center mt-3"><LoadingDots /></div></div>;
  }
  if (winners.length === 0) {
    return <div className="py-3">{title}<p className="text-center text-xs text-gray-500 mt-2">Nobody scored yet. Tomorrow could be you.</p></div>;
  }

  if (variant === "list") {
    return (
      <div className="w-full rounded-lg border border-warm/60 p-3 text-left">
        {title}
        <div className="mt-3 space-y-1.5">
          {winners.map((w, i) => (
            <div key={w._id} className="flex items-center gap-2.5" style={{ animation: `cardIn 0.4s ease-out ${i * 120}ms backwards` }}>
              <span className="w-4 text-center font-display text-base" style={{ color: MEDAL[i] }}>{i + 1}</span>
              <Avatar w={w} size="w-8 h-8" ring={MEDAL[i]} />
              <span className="flex-1 min-w-0 font-display text-sm tracking-wide text-gray-900 truncate">
                {w.username}{w.isBot && <span className="ml-1 text-[8px] text-gray-400 align-middle">BOT</span>}
              </span>
              <span className="font-display text-sm tabular-nums text-[#E36B11]">
                +<CountUpNumber value={w.points} format={fmt} delayMs={200 + i * 120} />
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Podium: 2nd | 1st | 3rd, the winner on the tallest step
  const order = [1, 0, 2].filter(i => winners[i]);
  const step = ["h-14", "h-10", "h-7"];
  return (
    <div className="w-full">
      {title}
      <div className="flex items-end justify-center gap-3 mt-4">
        {order.map(i => {
          const w = winners[i];
          return (
            <div key={w._id} className="flex flex-col items-center w-24" style={{ animation: `cardIn 0.5s ease-out ${(i === 0 ? 350 : 150)}ms backwards` }}>
              {i === 0 && <Crown className="w-5 h-5 mb-0.5 text-[#E5A500] drop-shadow" fill="#E5A500" />}
              <Avatar w={w} size={i === 0 ? "w-16 h-16" : "w-12 h-12"} ring={MEDAL[i]} />
              <span className="mt-1.5 max-w-full font-display text-sm tracking-wide text-gray-900 truncate">
                {w.username}{w.isBot && <span className="ml-1 text-[8px] text-gray-400 align-middle">BOT</span>}
              </span>
              <span className="font-display text-sm tabular-nums text-[#E36B11]">
                +<CountUpNumber value={w.points} format={fmt} delayMs={500 + i * 150} />
              </span>
              <div className={`mt-1.5 w-full ${step[i]} rounded-t-lg flex items-start justify-center pt-1 font-display text-lg text-white shadow-inner`} style={{ background: `linear-gradient(180deg, ${MEDAL[i]}, ${MEDAL[i]}AA)` }}>
                {i + 1}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
