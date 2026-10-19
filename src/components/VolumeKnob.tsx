"use client";

import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import { REACTION_REWARD } from "@/config/rewards";
import { VOLUME_MAX, formatVolume, segmentColor, volumeLabel } from "@/lib/personVolume";
import { updateCardVolume } from "./CardVolumeBadge";

// "Goes to 11" under a person article: an amp's volume scale 1-11. The reader turns the PERSON up
// (one vote per person, shared by all their articles); the community level is shown underneath.
// Replaces the mood emojis on person articles (lib/personVolume.ts).
interface VolumeKnobProps {
  personId: string;
  personName?: string;
  userId?: string;
  isLoggedIn: boolean;
  onShowLogin?: () => void;
  onCoinAnimation?: (amount: number) => void;
  /** Desktop: one flat row over the full width (headline | scale | crowd) between two rules */
  wide?: boolean;
}

const LEVELS = Array.from({ length: VOLUME_MAX }, (_, i) => i + 1);

export default function VolumeKnob({ personId, personName, userId, isLoggedIn, onShowLogin, onCoinAnimation, wide = false }: VolumeKnobProps) {
  const [avg, setAvg] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  // votes per level ([0] = votes for 1 ... [10] = votes for 11): the ratio behind the average
  const [dist, setDist] = useState<number[]>(() => Array(VOLUME_MAX).fill(0));
  const [mine, setMine] = useState<number | null>(null);
  const [rewarded, setRewarded] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/people/volume?personId=${personId}&userId=${userId || ''}`)
      .then(r => r.json())
      .then(d => { if (!cancelled && d.success) { setAvg(d.avg); setCount(d.count); setMine(d.mine); setRewarded(!!d.rewarded); if (Array.isArray(d.distribution)) setDist(d.distribution); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [personId, userId]);

  // One vote per person, final (the server enforces it too): once you voted, the scale is locked
  const locked = mine != null;

  const vote = async (value: number) => {
    // not logged in: a click on a bar leads to the login
    if (!isLoggedIn || !userId) { onShowLogin?.(); return; }
    if (saving || locked) return;
    const before = { mine, avg, count, rewarded };
    // optimistic: the bar moves at once, the coins fly at once (first vote only)
    setMine(value);
    if (!rewarded) { setRewarded(true); onCoinAnimation?.(REACTION_REWARD); }
    setSaving(true);
    try {
      const res = await fetch('/api/people/volume', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personId, userId, value }) });
      const d = await res.json();
      if (d.alreadyVoted) {
        // voted before (another tab, another device): show the vote that counts - no coins for this click
        setAvg(d.avg); setCount(d.count); setMine(d.mine); setRewarded(true);
        if (Array.isArray(d.distribution)) setDist(d.distribution);
        return;
      }
      if (!d.success) throw new Error(d.error);
      setAvg(d.avg); setCount(d.count); setMine(d.mine);
      if (Array.isArray(d.distribution)) setDist(d.distribution);
      updateCardVolume(personId, { avg: d.avg, count: d.count });
      if (d.coinsEarned > 0) window.dispatchEvent(new Event('bogx-updated'));
    } catch {
      setMine(before.mine); setAvg(before.avg); setCount(before.count); setRewarded(before.rewarded);
    } finally {
      setSaving(false);
    }
  };

  const shown = (mine == null ? hover : null) ?? mine ?? 0;
  const first = (personName || '').split(' ')[0] || 'them';

  // One bar of the scale. Sizes differ between the compact (phone) and the wide (desktop) layout.
  const maxVotes = Math.max(1, ...dist);
  const bar = (n: number, cls: string, height: number) => {
    const on = n <= shown;
    const votes = dist[n - 1] || 0;
    const pct = count ? Math.round((votes / count) * 100) : 0;
    return (
      <button
        key={n}
        type="button"
        onMouseEnter={() => !locked && setHover(n)}
        onFocus={() => !locked && setHover(n)}
        onBlur={() => setHover(null)}
        onClick={() => vote(n)}
        disabled={saving || locked}
        aria-label={`Volume ${n}: ${votes} ${votes === 1 ? 'vote' : 'votes'}`}
        title={`${n} · ${volumeLabel(n)} - ${votes} ${votes === 1 ? 'vote' : 'votes'}${count ? ` (${pct}%)` : ''}`}
        aria-pressed={mine === n}
        className={`relative rounded-sm transition-all duration-150 ${cls} ${locked ? 'cursor-default' : 'cursor-pointer'} ${mine === n ? 'ring-2 ring-offset-1 ring-gray-900/70' : ''} ${n === VOLUME_MAX && on ? 'shadow-[0_0_12px_rgba(220,38,38,0.7)]' : ''}`}
        style={{
          height: `${height}px`,
          backgroundColor: on ? segmentColor(n) : `${segmentColor(n)}2e`, // unlit: a faint tint of its own colour, so it reads as a volume ramp
          transform: hover === n ? 'translateY(-2px)' : undefined,
        }}
      >
        {/* the crowd: this level's share of the votes, filled from the bottom (hidden while lit by your pick) */}
        {votes > 0 && !on && (
          <span className="absolute inset-x-0 bottom-0 rounded-sm pointer-events-none" style={{ height: `${Math.max(8, (votes / maxVotes) * 100)}%`, backgroundColor: segmentColor(n), opacity: 0.55 }} />
        )}
        {votes > 0 && (
          <span className="absolute -top-4 inset-x-0 text-center text-[10px] font-semibold text-gray-500 pointer-events-none">{votes}</span>
        )}
      </button>
    );
  };

  if (wide) {
    return (
      <section className="w-full border-y border-warm py-6" aria-label="Goes to 11">
        <div className="flex items-center gap-8">
          {/* Left: headline, question, your pick and the crowd */}
          <div className="w-56 shrink-0">
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-[#E36B11]" />
              <h3 className="font-display text-2xl tracking-wider text-gray-900 leading-none">Goes to 11</h3>
            </div>
            <p className="text-sm text-gray-500 mt-1.5">How loud do you turn {first} up?</p>
            <p className="text-xs font-semibold mt-3 h-4" style={{ color: shown ? segmentColor(shown) : '#9ca3af' }}>
              {mine != null ? `Your vote: ${mine} · ${volumeLabel(mine)}` : shown ? `${shown} · ${volumeLabel(shown)}` : isLoggedIn ? 'Pick a level - one vote' : 'Log in to vote'}
            </p>
            {count > 0 ? (
              <p className="text-xs text-gray-500 mt-1">
                Crowd: <span className="font-display text-base text-gray-900">VOL {formatVolume(avg, count)}</span>
                <span className="text-gray-400"> · {count} {count === 1 ? 'vote' : 'votes'}</span>
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">Be the first to turn {first} up</p>
            )}
          </div>

          {/* The scale fills the rest of the row */}
          <div className="flex-1 min-w-0">
            <div className="flex items-end gap-2 h-24 pt-4" onMouseLeave={() => setHover(null)}>
              {LEVELS.map(n => bar(n, 'flex-1', 26 + n * 4.8))}
            </div>
            <div className="flex gap-2 mt-1.5">
              {LEVELS.map(n => (
                <span key={n} className={`flex-1 text-center text-xs font-display ${n === VOLUME_MAX ? 'text-red-600' : 'text-gray-400'}`}>{n}</span>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <p className="text-sm text-gray-500 text-center mb-3">How loud do you turn {first} up?</p>

      {/* The scale: 11 bars, rising like an amp's volume ramp */}
      <div className="flex items-end justify-center gap-1.5 h-20 pt-4" onMouseLeave={() => setHover(null)}>
        {LEVELS.map(n => bar(n, 'w-5', 28 + n * 3.2))}
      </div>
      <div className="flex justify-center gap-1.5 mt-1">
        {LEVELS.map(n => (
          <span key={n} className={`w-5 text-center text-[10px] font-display ${n === VOLUME_MAX ? 'text-red-600' : 'text-gray-400'}`}>{n}</span>
        ))}
      </div>

      {/* What the reader is pointing at / what they picked */}
      <p className="text-center text-xs mt-2 h-4 font-semibold" style={{ color: shown ? segmentColor(shown) : '#9ca3af' }}>
        {mine != null ? `Your vote: ${mine} · ${volumeLabel(mine)}` : shown ? `${shown} · ${volumeLabel(shown)}` : isLoggedIn ? 'Pick a level - one vote' : 'Log in to vote'}
      </p>

      {/* The crowd */}
      <div className="mt-3 flex items-center justify-center gap-2 text-sm text-gray-600">
        <Volume2 className="w-4 h-4 text-[#E36B11]" />
        {count > 0 ? (
          <span>
            Crowd: <span className="font-display text-base text-gray-900">VOL {formatVolume(avg, count)}</span>
            <span className="text-gray-400"> · {volumeLabel(avg)} · {count} {count === 1 ? 'vote' : 'votes'}</span>
          </span>
        ) : (
          <span className="text-gray-400">Be the first to turn {first} up</span>
        )}
      </div>
    </div>
  );
}
