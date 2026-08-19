"use client";

import { ArrowUp, ArrowDown, Minus, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface DesktopRankWidgetProps {
  rank: number | null;
  coins: number;
  isActive?: boolean;
  hasPendingWager?: boolean;
  pendingAmount?: number;
  dailyRank?: number;      // User's rank position in daily leaderboard
  monthlyRank?: number;    // User's rank position in monthly leaderboard
  yearlyRank?: number;     // User's rank position in yearly leaderboard
  dailyChange?: 'up' | 'down' | null;
  monthlyChange?: 'up' | 'down' | null;
  yearlyChange?: 'up' | 'down' | null;
  wagerAmount?: number;    // Current wager amount
  onClick?: () => void;
  onWagerClick?: () => void; // Click handler for wager section
  animateDelta?: number;   // Explicit delta to animate (bypasses internal diff calculation)
  animateKey?: number;     // Key to trigger animation
}

function RankPosition({ value, label, isActive, change }: { value: number; label: string; isActive?: boolean; change?: 'up' | 'down' | null }) {
  const hasRank = value > 0;

  // Keep showing the last known direction. Rankings only report a direction at
  // the moment the position moves, so without this the arrow would fall back to
  // a neutral dash on the next poll.
  const [lastChange, setLastChange] = useState<'up' | 'down' | null>(null);
  useEffect(() => {
    if (change) setLastChange(change);
  }, [change]);
  const shown = change || lastChange;

  return (
    <div className="flex items-center gap-0.5">
      {/* Always rendered so the row never shifts */}
      {shown === 'up' ? (
        <ArrowUp className={`w-3 h-3 shrink-0 transition-colors ${isActive ? 'text-green-300' : 'text-green-500 group-hover/main:text-green-300'}`} />
      ) : shown === 'down' ? (
        <ArrowDown className={`w-3 h-3 shrink-0 transition-colors ${isActive ? 'text-red-300' : 'text-red-500 group-hover/main:text-red-300'}`} />
      ) : (
        <Minus className={`w-3 h-3 shrink-0 transition-colors ${isActive ? 'text-white/40' : 'text-gray-300 group-hover/main:text-white/40'}`} />
      )}
      <div className="flex flex-col justify-center">
        <span className={`text-lg font-display tabular-nums leading-none transition-colors ${
          isActive 
            ? 'text-white'
            : (hasRank ? 'text-gray-800 group-hover/main:text-white' : 'text-gray-400 group-hover/main:text-white/60')
        }`}>
          {hasRank ? value.toString().padStart(2, '0') : '—'}
        </span>
        <span className={`text-[9px] font-display uppercase transition-colors ${isActive ? 'text-white/60' : 'text-gray-400 group-hover/main:text-white/60'}`}>{label}</span>
      </div>
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
  dailyChange,
  monthlyChange,
  yearlyChange,
  wagerAmount = 0,
  onClick,
  onWagerClick,
  animateDelta,
  animateKey
}: DesktopRankWidgetProps) {
  const active = isActive;
  const prevCoinsRef = useRef(coins);
  const prevWagerRef = useRef(pendingAmount);
  const [coinAnim, setCoinAnim] = useState<'up' | 'down' | null>(null);
  const [coinDelta, setCoinDelta] = useState(0);
  const [wagerAnim, setWagerAnim] = useState<'in' | 'out' | null>(null);
  const [wagerVisible, setWagerVisible] = useState(pendingAmount > 0);

  // Animate when explicit delta is provided (preferred - shows correct amount)
  useEffect(() => {
    if (animateDelta !== undefined && animateDelta !== 0 && animateKey !== undefined) {
      setCoinAnim(animateDelta > 0 ? 'up' : 'down');
      setCoinDelta(animateDelta);
      prevCoinsRef.current = coins;

      const timer = setTimeout(() => setCoinAnim(null), 1400);
      return () => clearTimeout(timer);
    }
  }, [animateKey, animateDelta, coins]);

  // Fallback: Animate when coins change (for cases without explicit delta)
  useEffect(() => {
    // Skip if we have explicit delta
    if (animateDelta !== undefined && animateKey !== undefined) return;
    
    const diff = Math.round((coins - prevCoinsRef.current) * 100) / 100;
    if (diff !== 0) {
      setCoinAnim(diff > 0 ? 'up' : 'down');
      setCoinDelta(diff);
      prevCoinsRef.current = coins;

      const timer = setTimeout(() => setCoinAnim(null), 1400);
      return () => clearTimeout(timer);
    }
  }, [coins, animateDelta, animateKey]);

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
      className={`relative flex cursor-pointer transition-transform ${active ? 'scale-[0.98]' : ''}`}
      style={coinAnim ? { animation: coinAnim === 'up' ? 'scoreWin 1.4s ease-out' : 'scoreLoss 1.4s ease-out' } : undefined}
    >
      {/* Floating delta amount */}
      {coinAnim && (
        <span
          className={`absolute left-1/2 -translate-x-1/2 -top-1 z-20 pointer-events-none font-display text-base ${
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
        @keyframes coinSpin {
          0% { transform: rotate(0deg) scale(1); }
          40% { transform: rotate(180deg) scale(1.25); }
          100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes scoreDelta {
          0% { transform: translate(-50%, 6px) scale(0.7); opacity: 0; }
          20% { transform: translate(-50%, -8px) scale(1.15); opacity: 1; }
          60% { transform: translate(-50%, -18px) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -32px) scale(0.9); opacity: 0; }
        }
      `}</style>
      
      {/* Main container - Coins & Rankings with own hover group */}
      <div 
        onClick={onClick}
        className={`group/main relative flex items-stretch gap-0 rounded-lg border shadow-sm transition-all duration-200 overflow-hidden ${
          active 
            ? 'bg-gradient-to-b from-[#E36B11] to-[#C4772A] border-[#E36B11]' 
            : 'bg-gradient-to-b from-[#FFFDF9] to-[#FDF8F0] border-[#E36B11]/30 hover:from-[#E36B11] hover:to-[#C4772A] hover:border-[#E36B11]'
        } ${wagerVisible ? 'rounded-r-none border-r-0' : ''}`}
      >
        
        {/* Left accent */}
        <div className={`absolute left-0 top-1 bottom-1 w-0.5 rounded-full transition-all ${
          active ? 'bg-gradient-to-b from-white to-white/80' : 'bg-gradient-to-b from-[#E36B11] to-[#E5A55A] group-hover/main:from-white group-hover/main:to-white/80'
        }`} />
        
        {/* Coins Section - highlighted */}
        <div className={`relative flex items-center gap-2 pl-3 pr-3 py-2 border-r transition-colors ${active ? 'border-white/20' : 'border-[#E36B11]/10 group-hover/main:border-white/20'}`}>
          <img 
            src="/images/bogxcoin.png" 
            alt="" 
            className={`relative w-10 h-10 -my-2 shrink-0 transition-all ${!active ? 'group-hover/main:brightness-0 group-hover/main:invert' : ''}`}
            style={coinAnim ? { animation: 'coinSpin 0.9s ease-out' } : undefined}
          />
          <div className="relative flex flex-col justify-center">
            <span className={`text-lg font-display tabular-nums leading-none transition-all duration-300 ${
              coinAnim === 'up' ? 'text-green-500' : 
              coinAnim === 'down' ? 'text-red-500' : 
              active ? 'text-white' : 'text-[#E36B11] group-hover/main:text-white'
            }`}>
              {coins.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`text-[9px] font-display uppercase transition-colors ${active ? 'text-white/60' : 'text-gray-400 group-hover/main:text-white/60'}`}>Coins</span>
          </div>
        </div>
        
        {/* Rank Positions Section */}
        <div className={`flex items-center gap-3 px-3 py-2 transition-colors ${active ? 'border-white/20' : 'border-[#E36B11]/10 group-hover/main:border-white/20'}`}>
          <RankPosition value={dailyRank} label="Day" isActive={active} change={dailyChange} />
          <RankPosition value={monthlyRank} label="Month" isActive={active} change={monthlyChange} />
          <RankPosition value={yearlyRank} label="Year" isActive={active} change={yearlyChange} />
        </div>
      </div>
      
      {/* Wager Section - completely separate, blue hover */}
      {wagerVisible && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            onWagerClick?.();
          }}
          className={`group/wager relative flex items-center gap-2 px-3 py-2 rounded-r-lg border border-l-2 border-[#6366F1]/30 shadow-sm transition-all duration-300 cursor-pointer bg-gradient-to-b from-[#FFFDF9] to-[#FDF8F0] ${
            wagerAnim === 'in' ? 'animate-fade-in' : 
            wagerAnim === 'out' ? 'opacity-0' : 'opacity-100'
          } hover:from-[#6366F1] hover:to-[#4F46E5] hover:border-[#6366F1]`}
        >
          {/* Wager background */}
          <div className={`absolute inset-0 rounded-r-lg transition-all group-hover/wager:opacity-0 ${
            wagerAnim === 'in' ? 'bg-[#A855F7]/20' : 
            wagerAnim === 'out' ? 'bg-green-500/20' : 
            'bg-[#6366F1]/10'
          }`} />
          <Lock className={`relative w-4 h-4 transition-all group-hover/wager:text-white ${
            wagerAnim === 'in' ? 'text-[#A855F7] scale-125' : 
            wagerAnim === 'out' ? 'text-green-500 scale-110' : 
            'text-[#6366F1]'
          }`} />
          <div className="relative flex flex-col">
            <span className={`text-base font-display tabular-nums leading-none transition-all group-hover/wager:text-white ${
              wagerAnim === 'in' ? 'text-[#A855F7] scale-110' : 
              wagerAnim === 'out' ? 'text-green-500 scale-110' : 
              'text-gray-800'
            }`}>
              {pendingAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] font-display uppercase text-gray-400 transition-colors group-hover/wager:text-white/70">Wager</span>
          </div>
          {/* Right accent for wager */}
          <div className="absolute right-0 top-1 bottom-1 w-0.5 rounded-full bg-[#6366F1] transition-all group-hover/wager:bg-white" />
        </div>
      )}
    </div>
  );
}
