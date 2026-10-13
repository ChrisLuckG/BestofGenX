"use client";

import { ArrowUp, ArrowDown, Lock, Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type RankPeriod, rankUnrankedTip, rankUnrankedGuestTip, formatUnrankedValue } from "@/lib/rankPeriod";
import ShineSweep from "@/components/ShineSweep";
import LoadingDots from "@/components/LoadingDots";
import { useAnimatedValue, useIntroCount, animateUnranked } from "@/hooks/useCountUp";

// After an explicit animation, balance changes are its own tail (count-up ticks,
// deferred server sync at OPTIMISTIC_WINDOW_MS 2.5s + request) - not new events.
const EXPLICIT_QUIET_MS = 4000;

interface DesktopRankWidgetProps {
  rank: number | null;
  coins: number;
  isActive?: boolean;
  hasPendingWager?: boolean;
  pendingAmount?: number;
  dailyRank?: number;      // User's rank position in daily leaderboard
  monthlyRank?: number;    // User's rank position in monthly leaderboard
  yearlyRank?: number;     // User's rank position in yearly leaderboard
  dailyPoints?: number;    // Points for showing negative balance when unranked
  monthlyPoints?: number;
  yearlyPoints?: number;
  dailyChange?: 'up' | 'down' | null;
  monthlyChange?: 'up' | 'down' | null;
  yearlyChange?: 'up' | 'down' | null;
  wagerAmount?: number;    // Current wager amount
  onClick?: () => void;
  onWagerClick?: () => void; // Click handler for wager section
  animateDelta?: number;   // Explicit delta to animate (bypasses internal diff calculation)
  animateKey?: number;     // Key to trigger animation
  isBreakTime?: boolean;   // Whether we're in the daily reset break
  breakCountdown?: string; // Countdown string like "01:37:40" or "04:32" (MM:SS when under 1 hour)
  countdownMs?: number;    // Centiseconds (0-99) for fast timer when under 1 hour
  isLoggedIn?: boolean;    // Whether user is logged in
  onShowLogin?: () => void; // Callback to show login modal
  isLoadingCoins?: boolean; // Balance not loaded yet - placeholder instead of 0,00
  isLoadingRanks?: boolean; // Ranks not loaded yet - placeholder instead of "?"
}

function RankPosition({ value, label, isActive, change, onHoverChange, points, loading = false, showInfo = true }: { value: number; label: string; isActive?: boolean; change?: 'up' | 'down' | null; onHoverChange?: (hovering: boolean) => void; points?: number; loading?: boolean; showInfo?: boolean }) {
  const hasRank = value > 0;
  
  // Unranked: own net for the period ("-0,37" / "0,00"), "?" only when unknown
  // Counts from the old to the new balance instead of jumping
  const animatedPoints = useAnimatedValue(loading ? undefined : points);
  const unrankedText = formatUnrankedValue(animateUnranked(points, animatedPoints));
  // A real number ("-0,48" / "0,00") is sized like a rank; only "?" stays small
  const unrankedIsValue = !hasRank && unrankedText !== '?';
  const isNegative = !hasRank && points !== undefined && points < 0 && unrankedText !== '0,00';
  // Intro gimmick: the rank counts up once it has loaded
  const introRank = useIntroCount(loading || !hasRank ? undefined : value, 900);
  const shownRank = introRank === null ? value : Math.max(1, Math.round(introRank));

  // Direction comes from the server via the rankings hook - identical on mobile.
  // The old localStorage fallback ("last rank this browser saw") is what made
  // desktop and phone disagree.
  const shown = change ?? null;

  // Roll the digits when the position actually moves.
  const prevValueRef = useRef(value);
  const [roll, setRoll] = useState<'up' | 'down' | null>(null);
  // Track if we just got placed (transition from 0 to ranked)
  const [justPlaced, setJustPlaced] = useState(false);

  useEffect(() => {
    const prev = prevValueRef.current;
    prevValueRef.current = value;
    
    // Detect when user just got placed (was 0, now has rank)
    if (prev <= 0 && value > 0) {
      setJustPlaced(true);
      const timer = setTimeout(() => setJustPlaced(false), 1000);
      return () => clearTimeout(timer);
    }
    
    // Ranks arrive as 0 first and are filled in once loaded - animating that would
    // claim a position change on every page load.
    if (prev === value || prev <= 0 || value <= 0) return;

    // Smaller rank number = better position = rolls upwards.
    setRoll(value < prev ? 'up' : 'down');
    const timer = setTimeout(() => setRoll(null), 600);
    return () => clearTimeout(timer);
  }, [value]);

  const arrowAnim = roll ? { animation: `arrowPop${roll === 'up' ? 'Up' : 'Down'} 0.6s ease-out` } : undefined;

  return (
    <div 
      className="relative flex items-center gap-0.5 group/rank"
      onMouseEnter={() => !hasRank && onHoverChange?.(true)}
      onMouseLeave={() => !hasRank && onHoverChange?.(false)}
    >
      {/* Arrows: ranked with a change direction, or unranked with a negative
          balance (down). Otherwise a spacer so the width never changes. */}
      {hasRank && shown === 'up' ? (
        <ArrowUp style={arrowAnim} className={`w-3 h-3 shrink-0 transition-colors animate-bounce-subtle-up ${isActive ? 'text-white' : 'text-green-500 group-hover/main:text-white'}`} />
      ) : (hasRank && shown === 'down') || isNegative ? (
        <ArrowDown style={arrowAnim} className={`w-3 h-3 shrink-0 transition-colors animate-bounce-subtle-down ${isActive ? 'text-white' : 'text-red-500 group-hover/main:text-white'}`} />
      ) : (
        <span className="w-3 h-3 shrink-0" />
      )}
      <div className="flex flex-col items-center justify-center">
        {/* Clipping wrapper: the incoming number slides in from outside it, which is
            what makes it read as a flip-clock rather than a fade. */}
        <span className={`block h-[18px] text-center ${!hasRank ? 'overflow-visible' : 'overflow-hidden'}`}>
          <span
            // Remounts on change so the CSS animation restarts.
            key={`${value}-${roll ?? 'idle'}-${justPlaced ? 'placed' : ''}`}
            style={
              justPlaced 
                ? { animation: 'rankFadeIn 0.5s ease-out' }
                : roll 
                  ? { animation: `rankRoll${roll === 'up' ? 'Up' : 'Down'} 0.5s cubic-bezier(0.22, 1, 0.36, 1)` } 
                  : undefined
            }
            // inline-block, not block: as a block the box spans the whole column
            // and is taller than the glyph, so scaling the "?" around the BOX
            // centre visibly shifted it up and to the left. An inline-block box
            // hugs the glyph, so it grows in place.
            className={`inline-block align-top font-display tabular-nums leading-none transition-all origin-center ${
              isActive
                ? 'text-white text-lg'
                : hasRank 
                  ? 'text-gray-800 text-lg group-hover/main:text-white' 
                  : unrankedIsValue
                    ? `${isNegative ? 'text-red-500' : 'text-gray-800'} text-lg cursor-pointer group-hover/main:text-white`
                    : 'text-red-500 text-sm cursor-pointer group-hover/main:text-white group-hover/rank:scale-125'
            }`}
          >
            {loading
              ? <span className="inline-flex items-center h-4"><LoadingDots className={isActive ? 'text-white' : 'text-[#E36B11] group-hover/main:text-white'} /></span>
              : hasRank ? shownRank.toString().padStart(2, '0') : unrankedText}
          </span>
        </span>
        {/* text-gray-400 was nearly invisible against this widget's pale cream
            background (#FFFDF9 -> #FDF8F0) - gray-600 gives the label enough
            contrast to actually read as a label instead of disappearing next to
            the bold number above it. */}
        <span className={`relative text-[9px] font-display uppercase transition-colors ${isActive ? 'text-white/60' : 'text-gray-600 group-hover/main:text-white/60'}`}>
          {label}
          {/* Unranked: small ⓘ after the label - hovering it explains why there
              is no rank. Absolute, so the label stays centred under the value. */}
          {!hasRank && !loading && showInfo && (
            <Info className={`absolute left-full top-1/2 -translate-y-1/2 ml-0.5 w-2.5 h-2.5 cursor-help ${isActive ? 'text-white/70' : 'text-gray-400 group-hover/main:text-white/70'}`} />
          )}
        </span>
      </div>
      {/* Mirrors the arrow slot so the value sits centred between the separators */}
      <span className="w-3 h-3 shrink-0" />
    </div>
  );
}

export default function DesktopRankWidget({ 
  rank, 
  coins, 
  isActive = false, 
  hasPendingWager = false, 
  pendingAmount = 0,
  dailyRank = 0,
  monthlyRank = 0,
  yearlyRank = 0,
  dailyPoints,
  monthlyPoints,
  yearlyPoints,
  dailyChange,
  monthlyChange,
  yearlyChange,
  wagerAmount = 0,
  onClick,
  onWagerClick,
  animateDelta,
  animateKey,
  isBreakTime = false,
  breakCountdown = '',
  countdownMs = 0,
  isLoggedIn = true,
  onShowLogin,
  isLoadingCoins = false,
  isLoadingRanks = false,
}: DesktopRankWidgetProps) {
  const active = isActive;
  // Intro gimmick: counts up from 0 once the balance has loaded. Later changes
  // are animated by the page (animateCoins).
  const introCoins = useIntroCount(isLoadingCoins ? undefined : coins);
  const prevCoinsRef = useRef(coins);
  const prevWagerRef = useRef(pendingAmount);
  const [coinAnim, setCoinAnim] = useState<'up' | 'down' | null>(null);
  // Which unranked period is being hovered - drives the explanation tooltip.
  const [tipFor, setTipFor] = useState<RankPeriod | null>(null);
  const [coinDelta, setCoinDelta] = useState(0);
  const [wagerAnim, setWagerAnim] = useState<'in' | 'out' | null>(null);
  const [wagerVisible, setWagerVisible] = useState(pendingAmount > 0);
  // Last non-zero amount: during the fade-out pendingAmount is already 0, and
  // watching the wager count down to 0,00 while it slides away looks broken.
  const [displayAmount, setDisplayAmount] = useState(pendingAmount);

  // The glow always clears itself, and it does so in an effect that depends on
  // NOTHING BUT `coinAnim`.
  //
  // It used to be a timer created inside the trigger effect below, whose deps
  // include `animateDelta`. The parent passes
  // `animateDelta={coinAnimation.show ? coinAnimation.amount : undefined}`, and
  // CoinAnimation flips `show` back to false after ~1200ms - BEFORE the 1400ms
  // reset fired. That dep change ran the effect's cleanup, which cleared the
  // pending reset, and the re-run then hit a falsy `animateDelta` and armed no
  // new one. The widget stayed lit until a reload - very visible on a loss,
  // because that glow is red.
  useEffect(() => {
    if (!coinAnim) return;
    const timer = setTimeout(() => setCoinAnim(null), 1400);
    return () => clearTimeout(timer);
  }, [coinAnim]);

  // Animate when explicit delta is provided (preferred - shows correct amount).
  // Keyed on `animateKey`, which the parent bumps once per event: re-running on
  // a `coins` change used to restart the animation mid-flight.
  const lastAnimKeyRef = useRef(animateKey);
  const lastExplicitAtRef = useRef(0);
  useEffect(() => {
    if (animateKey === undefined || animateKey === lastAnimKeyRef.current) return;
    lastAnimKeyRef.current = animateKey;
    if (animateDelta === undefined || animateDelta === 0) return;

    setCoinAnim(animateDelta > 0 ? 'up' : 'down');
    setCoinDelta(animateDelta);
    prevCoinsRef.current = coins;
    lastExplicitAtRef.current = Date.now();
  }, [animateKey, animateDelta, coins]);

  // Fallback: Animate when coins change (for cases without explicit delta)
  // Use a small debounce to prevent flickering when multiple updates happen quickly
  const pendingAnimRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    // Changes that belong to an explicit animation are absorbed silently: the
    // parent's count-up keeps ticking after `animateDelta` is cleared (~1.2s), and
    // the deferred server sync (useBogxCoins, ~2.5s after the last tick) lands a
    // cent-level correction. Both used to replay as a second "±0,01" after every
    // Solo Trivia answer.
    if ((animateDelta !== undefined && animateKey !== undefined) || Date.now() - lastExplicitAtRef.current < EXPLICIT_QUIET_MS) {
      prevCoinsRef.current = coins;
      return;
    }
    
    const diff = Math.round((coins - prevCoinsRef.current) * 100) / 100;
    if (diff !== 0) {
      // Clear any pending animation
      if (pendingAnimRef.current) {
        clearTimeout(pendingAnimRef.current);
      }
      
      // Small delay to batch rapid changes (e.g. refund + wager release).
      // No reset timer here - the effect above owns clearing the glow. The
      // `return () => clearTimeout(timer)` that used to sit in this callback was
      // dead code anyway: a value returned from a setTimeout callback goes
      // nowhere, it is not an effect cleanup.
      pendingAnimRef.current = setTimeout(() => {
        const finalDiff = Math.round((coins - prevCoinsRef.current) * 100) / 100;
        if (finalDiff !== 0) {
          setCoinAnim(finalDiff > 0 ? 'up' : 'down');
          setCoinDelta(finalDiff);
          prevCoinsRef.current = coins;
        }
      }, 100);
    }
    
    return () => {
      if (pendingAnimRef.current) {
        clearTimeout(pendingAnimRef.current);
      }
    };
  }, [coins, animateDelta, animateKey]);

  useEffect(() => {
    if (pendingAmount > 0) setDisplayAmount(pendingAmount);
  }, [pendingAmount]);

  // Animate when wager changes - fade in/out
  useEffect(() => {
    if (pendingAmount > 0 && !wagerVisible) {
      // Wager added - fade in
      setWagerVisible(true);
      setWagerAnim('in');
      const timer = setTimeout(() => setWagerAnim(null), 500);
      return () => clearTimeout(timer);
    } else if (pendingAmount === 0 && wagerVisible) {
      // Wager removed - fade out then hide
      setWagerAnim('out');
      const timer = setTimeout(() => {
        setWagerVisible(false);
        setWagerAnim(null);
      }, 500);
      return () => clearTimeout(timer);
    } else if (pendingAmount !== prevWagerRef.current && pendingAmount > 0) {
      // Wager amount changed while visible
      setWagerAnim(pendingAmount > prevWagerRef.current ? 'in' : 'out');
      const timer = setTimeout(() => setWagerAnim(null), 500);
      prevWagerRef.current = pendingAmount;
      return () => clearTimeout(timer);
    }
    prevWagerRef.current = pendingAmount;
  }, [pendingAmount, wagerVisible]);
  
  return (
    <div 
      className={`rank-widget relative flex cursor-pointer transition-transform ${active ? 'scale-[0.98]' : ''}`}
      style={coinAnim ? { 
        animation: coinAnim === 'up' ? 'scoreWin 1.4s ease-out' : 'scoreLoss 1.4s ease-out',
        willChange: 'transform',
        transform: 'translateZ(0)', // Force GPU acceleration
      } : undefined}
    >
      {/* Floating delta amount - starts from COINS area (left side) */}
      {coinAnim && (
        <span
          className={`absolute left-8 -top-1 z-20 pointer-events-none font-display text-base ${
            coinAnim === 'up' ? 'text-green-500' : 'text-red-500'
          }`}
          style={{
            animation: 'scoreDelta 1.4s ease-out forwards',
            textShadow: '0 1px 6px rgba(255,255,255,0.9)',
          }}
        >
          {coinDelta > 0 ? '+' : '−'}{Math.abs(coinDelta).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      )}

      {/* Subtle glow - only for main section */}
      <div
        className={`absolute rounded-xl blur-sm transition-all pointer-events-none ${
          coinAnim === 'up'
            ? 'bg-green-500/50'
            : coinAnim === 'down'
              ? 'bg-red-500/50'
              : active ? 'bg-[#E36B11]/40' : 'bg-[#E36B11]/10 group-hover/main:bg-[#E36B11]/30'
        }`}
        style={{ inset: 0, right: wagerVisible ? '80px' : 0 }}
      />

      <style>{`
        @keyframes scoreWin {
          0% { transform: scale(1); }
          25% { transform: scale(1.06); }
          50% { transform: scale(0.99); }
          75% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
        @keyframes scoreLoss {
          0%, 100% { transform: translateX(0) scale(1); }
          15% { transform: translateX(-4px) scale(1.02); }
          30% { transform: translateX(4px) scale(1.02); }
          45% { transform: translateX(-3px) scale(1); }
          60% { transform: translateX(3px) scale(1); }
          80% { transform: translateX(-1px) scale(1); }
        }
        /* Win spins the coin twice and forward; a loss turns it back the other way
           and briefly drains the colour, so the two read differently at a glance
           without needing to see the number. */
        @keyframes coinSpinWin {
          0%   { transform: rotate(0deg) scale(1); }
          35%  { transform: rotate(300deg) scale(1.28); }
          70%  { transform: rotate(560deg) scale(1.04); }
          100% { transform: rotate(720deg) scale(1); }
        }
        @keyframes coinSpinLoss {
          0%   { transform: rotate(0deg) scale(1); filter: saturate(1); }
          30%  { transform: rotate(-140deg) scale(0.88); filter: saturate(0.35); }
          65%  { transform: rotate(-260deg) scale(1.02); filter: saturate(0.8); }
          100% { transform: rotate(-360deg) scale(1); filter: saturate(1); }
        }
        @keyframes scoreDelta {
          0% { transform: translate(-50%, 6px) scale(0.7); opacity: 0; }
          20% { transform: translate(-50%, -8px) scale(1.15); opacity: 1; }
          60% { transform: translate(-50%, -18px) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -32px) scale(0.9); opacity: 0; }
        }
        /* Rank positions roll like a flip clock: a better position (smaller number)
           comes up from below, a worse one drops in from above. */
        @keyframes rankRollUp {
          0%   { transform: translateY(105%); opacity: 0; }
          60%  { transform: translateY(-8%);  opacity: 1; }
          100% { transform: translateY(0);    opacity: 1; }
        }
        @keyframes rankRollDown {
          0%   { transform: translateY(-105%); opacity: 0; }
          60%  { transform: translateY(8%);    opacity: 1; }
          100% { transform: translateY(0);     opacity: 1; }
        }
        @keyframes rankFadeIn {
          0%   { transform: scale(0.5); opacity: 0; }
          50%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes arrowPopUp {
          0%   { transform: translateY(3px) scale(0.8); opacity: 0.4; }
          45%  { transform: translateY(-3px) scale(1.2); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes arrowPopDown {
          0%   { transform: translateY(-3px) scale(0.8); opacity: 0.4; }
          45%  { transform: translateY(3px) scale(1.2); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        /* The wager comes OUT OF the score widget: it is revealed left-to-right from
           the shared edge, so it reads as sliding out of the score rather than fading
           in next to it. Removal reverses the reveal, back into the score.
           clip-path rather than scaleX on purpose - scaling the panel would squash the
           amount and the lock icon while it is still narrow. */
        @keyframes wagerIn {
          0%   { clip-path: inset(0 100% 0 0); }
          100% { clip-path: inset(0 0 0 0); }
        }
        @keyframes wagerOut {
          0%   { clip-path: inset(0 0 0 0); }
          100% { clip-path: inset(0 100% 0 0); opacity: 0; }
        }
        /* Respect the OS setting - this widget animates on every reward, which is
           exactly the kind of motion that setting exists for. */
        @media (prefers-reduced-motion: reduce) {
          .rank-widget, .rank-widget * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
      
      {/* Tooltip for an unranked period - outside overflow-hidden so it's visible.
          Every period needs it, not only the day: a negative net balance drops you
          out of that leaderboard entirely, so a month can read "?" while the day
          and the year both show a rank. */}
      {tipFor && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 p-3 bg-[#FFF8E7] border border-[#E36B11]/30 rounded-lg shadow-xl z-[100]">
          <p className="text-xs text-gray-700 leading-relaxed">
            <strong className="text-[#E36B11]">Tip:</strong> {isLoggedIn ? (
              rankUnrankedTip(tipFor)
            ) : (
              <><button onClick={onShowLogin} className="text-[#E36B11] underline hover:no-underline">Log in</button>{rankUnrankedGuestTip(tipFor)}</>
            )}
          </p>
        </div>
      )}

      {/* Main container - Coins & Rankings with own hover group */}
      <div 
        onClick={onClick}
        className={`group/main relative flex items-stretch gap-0 rounded-lg border shadow-sm transition-all duration-200 overflow-hidden ${
          active 
            ? 'bg-gradient-to-b from-[#E36B11] to-[#C4772A] border-[#E36B11]' 
            : 'bg-gradient-to-b from-[#FFFDF9] to-[#FDF8F0] border-[#E36B11]/30 hover:from-[#E36B11] hover:to-[#C4772A] hover:border-[#E36B11]'
        } ${wagerVisible ? 'rounded-r-none border-r-0' : ''}`}
      >
        
        {/* Occasional subtle glint - gold on the cream card, white when it is orange */}
        <ShineSweep rgb={active ? '255, 255, 255' : '229, 165, 90'} intensity={active ? 0.25 : 0.28} minDelayMs={9000} maxDelayMs={18000} firstDelayMs={2500} firstJitterMs={2000} />

        {/* Left accent */}
        <div className={`absolute left-0 top-1 bottom-1 w-0.5 rounded-full transition-all ${
          active ? 'bg-gradient-to-b from-white to-white/80' : 'bg-gradient-to-b from-[#E36B11] to-[#E5A55A] group-hover/main:from-white group-hover/main:to-white/80'
        }`} />
        
        {/* Coins Section - highlighted */}
        <div className={`relative flex items-center gap-3 pl-5 pr-6 py-2 border-r transition-colors ${active ? 'border-white/20' : 'border-[#E36B11]/10 group-hover/main:border-white/20'}`}>
          <img 
            src="/images/bogxcoin.png" 
            alt="" 
            className={`relative w-10 h-10 -my-2 shrink-0 transition-all ${!active ? 'group-hover/main:brightness-0 group-hover/main:invert' : ''}`}
            style={coinAnim
              ? { animation: coinAnim === 'up' ? 'coinSpinWin 1.1s ease-out' : 'coinSpinLoss 0.9s ease-in-out' }
              : undefined}
          />
          <div className="relative flex flex-col justify-center">
            {/* The win/loss colours only work on the pale background. Once the widget
                turns orange (active, or hovered) green-500 sits at roughly 1.5:1
                against #E36B11 and the number all but vanishes mid-animation - these
                branches carried no hover variant, so green won over the base rule.
                On orange the number goes white; direction is still carried by the coin
                spin, the shake-vs-bounce and the ± delta above it. */}
            {isLoadingCoins ? (
              <span className="inline-flex items-center h-[18px] px-1"><LoadingDots className={active ? 'text-white' : 'text-[#E36B11] group-hover/main:text-white'} /></span>
            ) : (
            <span className={`text-lg font-display tabular-nums leading-none transition-all duration-300 ${
              coinAnim === 'up' ? (active ? 'text-white' : 'text-green-600 group-hover/main:text-white') : 
              coinAnim === 'down' ? (active ? 'text-white' : 'text-red-500 group-hover/main:text-white') : 
              active ? 'text-white' : 'text-[#E36B11] group-hover/main:text-white'
            }`}>
              {(introCoins ?? coins).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            )}
            <span className={`text-[9px] font-display uppercase transition-colors ${active ? 'text-white/60' : 'text-gray-600 group-hover/main:text-white/60'}`}>Coins</span>
          </div>
        </div>
        
        {/* Rank Positions Section - or Break Timer during reset */}
        <div className={`relative flex items-center gap-3 px-3 py-2 transition-colors ${active ? 'border-white/20' : 'border-[#E36B11]/10 group-hover/main:border-white/20'}`}>
          {/* The rank positions are ALWAYS rendered - during the break they only turn
              invisible. The timer sits in the same grid cell, so the widget keeps
              exactly the width and height it has the rest of the day (it used to
              shrink to the width of the smaller timer). */}
          <div className="relative grid">
            <div className={`col-start-1 row-start-1 flex items-center gap-3 ${isBreakTime && breakCountdown ? 'invisible' : ''}`} aria-hidden={isBreakTime && !!breakCountdown}>
              <RankPosition value={dailyRank} label="Day" isActive={active} change={dailyChange} onHoverChange={(h) => setTipFor(h ? 'day' : null)} points={dailyPoints} loading={isLoadingRanks} showInfo={isLoggedIn} />
              <div className={`w-px h-8 ${active ? 'bg-white/20' : 'bg-gray-300 group-hover/main:bg-white/20'}`} />
              <RankPosition value={monthlyRank} label="Month" isActive={active} change={monthlyChange} onHoverChange={(h) => setTipFor(h ? 'month' : null)} points={monthlyPoints} loading={isLoadingRanks} showInfo={isLoggedIn} />
              <div className={`w-px h-8 ${active ? 'bg-white/20' : 'bg-gray-300 group-hover/main:bg-white/20'}`} />
              <RankPosition value={yearlyRank} label="Year" isActive={active} change={yearlyChange} onHoverChange={(h) => setTipFor(h ? 'year' : null)} points={yearlyPoints} loading={isLoadingRanks} showInfo={isLoggedIn} />
            </div>
            {isBreakTime && breakCountdown && (() => {
              const parts = breakCountdown.split(':');
              const [h, m, s] = parts.map(v => parseInt(v, 10) || 0);
              const isUnderOneHour = h === 0;
              // When under 1 hour: show MIN:SEC:MS, otherwise HRS:MIN:SEC
              const displayParts = isUnderOneHour
                ? [m.toString().padStart(2, '0'), s.toString().padStart(2, '0'), (99 - countdownMs).toString().padStart(2, '0')]
                : parts;
              const labels = isUnderOneHour ? ['Min', 'Sec', 'Ms'] : ['Hrs', 'Min', 'Sec'];
              return (
                <div className="col-start-1 row-start-1 flex items-center justify-center gap-3">
                  {/* Same type as the rank columns: value in an 18px box, label in the
                      9px Day/Month/Year style - so the timer column is exactly as tall
                      as the rank column it replaces. */}
                  <span className={`font-display text-[9px] leading-[1.15] uppercase text-left transition-colors ${active ? 'text-white/60' : 'text-gray-600 group-hover/main:text-white/60'}`}>Next<br />game in</span>
                  <div className="flex items-center gap-2.5">
                    {displayParts.map((part, i) => (
                      <div key={i} className="flex flex-col items-center justify-center">
                        <span className="block h-[18px] text-center">
                          <span className={`inline-block align-top font-display text-xl tabular-nums leading-none transition-colors ${active ? 'text-white' : 'text-[#E36B11] group-hover/main:text-white'}`}>{part}</span>
                        </span>
                        <span className={`text-[9px] font-display uppercase transition-colors ${active ? 'text-white/60' : 'text-gray-600 group-hover/main:text-white/60'}`}>{labels[i]}</span>
                      </div>
                    ))}
                  </div>
                </div>              );
            })()}
          </div>
        </div>
      </div>
      
      {/* Wager Section - completely separate, blue hover */}
      {wagerVisible && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            onWagerClick?.();
          }}
          // Only an actual removal retracts. A reduced-but-still-open wager keeps
          // its red/green colour cue but slides out again, otherwise `forwards` would
          // leave it clipped away and it would pop back when the state resets.
          style={
            pendingAmount === 0 ? { animation: 'wagerOut 0.45s ease-in forwards' }
            : wagerAnim ? { animation: 'wagerIn 0.55s cubic-bezier(0.22, 1, 0.36, 1)' }
            : undefined
          }
          // hover:from-/hover:to- alone only set the gradient's CSS variables - with
          // no bg-gradient-* utility nothing is ever painted, so hovering removed the
          // tint (see the overlay below) and turned the text white on the cream
          // background: white on white. The gradient needs its bg-gradient-to-r.
          className={`group/wager relative flex items-center gap-2 px-3 py-2 rounded-r-lg border border-l-2 border-[#D4A04A]/45 shadow-sm transition-all duration-300 cursor-pointer bg-[#FFFDF9] origin-left hover:bg-gradient-to-r hover:from-[#D4A04A] hover:to-[#C4772A] hover:border-[#C4772A]`}
        >
          {/* Wager background */}
          <div className={`absolute inset-0 rounded-r-lg transition-all group-hover/wager:opacity-0 ${
            wagerAnim === 'in' ? 'bg-[#E8A54B]/25' : 
            wagerAnim === 'out' ? 'bg-green-500/20' : 
            'bg-[#D4A04A]/15'
          }`} />
          <Lock className={`relative w-4 h-4 transition-all group-hover/wager:text-white ${
            wagerAnim === 'in' ? 'text-[#E36B11] scale-125' : 
            wagerAnim === 'out' ? 'text-green-500 scale-110' : 
            'text-[#C4772A]'
          }`} />
          <div className="relative flex flex-col">
            <span className={`text-base font-display tabular-nums leading-none transition-all group-hover/wager:text-white ${
              wagerAnim === 'in' ? 'text-[#E36B11] scale-110' : 
              wagerAnim === 'out' ? 'text-green-500 scale-110' : 
              'text-gray-800'
            }`}>
              {displayAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] font-display uppercase text-gray-600 transition-colors group-hover/wager:text-white/70">Wager</span>
          </div>
          {/* Right accent for wager */}
          <div className="absolute right-0 top-1 bottom-1 w-0.5 rounded-full bg-[#D4A04A] transition-all group-hover/wager:bg-white" />
        </div>
      )}
    </div>
  );
}
