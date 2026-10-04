"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Crown, Radio, Tv, User, ArrowUp, ArrowDown, Lock } from "lucide-react";
import Image from "next/image";
import { formatCurrency, getCurrencySymbol } from "@/utils/currency";
import { type RankPeriod, rankUnrankedTip, rankUnrankedGuestTip } from "@/lib/rankPeriod";

// Direction of a rank position compared to the last value we ever saw for it.
// Returns null if the position hasn't changed (neutral).
function useRankDirection(label: string, value: number): 'up' | 'down' | null {
  const storageKey = `rank-dir-${label.toLowerCase()}`;
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let stored: { rank: number } | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) stored = JSON.parse(raw);
    } catch { /* ignore */ }

    // Unranked (no points in this period yet) - no arrow
    if (value <= 0) {
      setDirection(null);
      return;
    }

    // Lower rank number = better position.
    let dir: 'up' | 'down' | null = null;
    if (stored && stored.rank > 0) {
      if (value < stored.rank) {
        dir = 'up';
      } else if (value > stored.rank) {
        dir = 'down';
      }
    }

    setDirection(dir);
    try {
      localStorage.setItem(storageKey, JSON.stringify({ rank: value }));
    } catch { /* ignore */ }
  }, [storageKey, value]);

  return direction;
}

interface HeaderProps {
  coins: number;
  username: string;
  userAvatar?: string;
  userRank?: number; // User's current ranking position
  hasPendingWager?: boolean; // User has coins locked in an open/active battle
  rankingsOpen?: boolean; // Rankings overlay is open
  onCoinsClick?: () => void;
  onLogoClick?: () => void;
  onNotificationClick?: () => void;
  onProfileClick?: () => void;
  onRadioClick?: () => void;
  onTVClick?: () => void;
  notificationOpen?: boolean;
  profileOpen?: boolean;
  radioOpen?: boolean;
  tvOpen?: boolean;
  notificationsEnabled?: boolean; // Push notifications enabled
  unreadCount?: number; // Number of unread notifications
  coinAnimation?: { amount: number } | null; // Explicit animation trigger
  // Rank positions like desktop
  dailyRank?: number;
  monthlyRank?: number;
  yearlyRank?: number;
  // Wager display
  pendingAmount?: number;
  onWagerClick?: () => void;
  // Loading state
  isLoadingRanks?: boolean;
  // Unranked-period tooltip
  isLoggedIn?: boolean;
  onShowLogin?: () => void;
}

export default function Header({ coins, userAvatar, userRank, hasPendingWager = false, rankingsOpen, onCoinsClick, onLogoClick, onNotificationClick, onProfileClick, onRadioClick, onTVClick, notificationOpen, profileOpen, radioOpen = false, tvOpen = false, notificationsEnabled, unreadCount = 0, coinAnimation, dailyRank = 0, monthlyRank = 0, yearlyRank = 0, pendingAmount = 0, onWagerClick, isLoadingRanks = false, isLoggedIn = true, onShowLogin }: HeaderProps) {
  const [displayCoins, setDisplayCoins] = useState(coins);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isNegative, setIsNegative] = useState(false);
  const [isPositive, setIsPositive] = useState(false);
  const [flyingAmount, setFlyingAmount] = useState<number | null>(null);
  const prevCoinsRef = useRef(coins);
  const lastAnimationRef = useRef<{ amount: number } | null>(null);
  
  // Rank direction arrows
  const dailyDir = useRankDirection('day', dailyRank);
  const monthlyDir = useRankDirection('month', monthlyRank);
  const yearlyDir = useRankDirection('year', yearlyRank);
  
  // Wager animation state
  const [wagerVisible, setWagerVisible] = useState(pendingAmount > 0);
  const [wagerAnim, setWagerAnim] = useState<'in' | 'out' | null>(null);
  const prevPendingRef = useRef(pendingAmount);

  // Which unranked period was tapped - drives the explanation tooltip.
  // Touch has no mouseleave, so the tip closes itself after a few seconds.
  const [tipFor, setTipFor] = useState<RankPeriod | null>(null);
  useEffect(() => {
    if (!tipFor) return;
    const timer = setTimeout(() => setTipFor(null), 5000);
    return () => clearTimeout(timer);
  }, [tipFor]);
  
  // Track wager changes for fade in/out
  useEffect(() => {
    const prev = prevPendingRef.current;
    const curr = pendingAmount;
    prevPendingRef.current = curr;
    
    if (prev === 0 && curr > 0) {
      // Wager appeared - fade in
      setWagerVisible(true);
      setWagerAnim('in');
      setTimeout(() => setWagerAnim(null), 500);
    } else if (prev > 0 && curr === 0) {
      // Wager disappeared - fade out
      setWagerAnim('out');
      setTimeout(() => {
        setWagerVisible(false);
        setWagerAnim(null);
      }, 500);
    } else if (prev > 0 && curr > 0 && prev !== curr) {
      // Wager amount changed
      setWagerAnim('in');
      setTimeout(() => setWagerAnim(null), 500);
    }
  }, [pendingAmount]);
  
  const handleNotificationClick = () => {
    if (onNotificationClick) {
      onNotificationClick();
    }
  };

  // Update display coins silently when coins change (no animation)
  useEffect(() => {
    // Only update silently if no animation is active
    if (!isAnimating) {
      setDisplayCoins(coins);
      prevCoinsRef.current = coins;
    }
  }, [coins, isAnimating]);

  // Only animate when explicitly triggered via coinAnimation prop
  useEffect(() => {
    if (!coinAnimation || coinAnimation === lastAnimationRef.current) return;
    lastAnimationRef.current = coinAnimation;
    
    const diff = coinAnimation.amount;
    if (diff === 0) return;
    
    // Show flying amount
    setFlyingAmount(diff);
    setTimeout(() => setFlyingAmount(null), 3000);
    
    // Animate counting up or down
    setIsAnimating(true);
    setIsNegative(diff < 0);
    setIsPositive(diff > 0);
    
    // Clear positive/negative glow after animation (safety timeout)
    if (diff > 0) {
      setTimeout(() => setIsPositive(false), 3000);
    }
    if (diff < 0) {
      setTimeout(() => setIsNegative(false), 4000); // Safety reset after 4s max
    }
    
    // Use prevCoinsRef as the TRUE starting point (before this animation)
    const startValue = prevCoinsRef.current;
    const endValue = startValue + diff;
    
    // Update prevCoinsRef immediately to the target value
    prevCoinsRef.current = endValue;
    
    // For small amounts (< 0.1), just update immediately with a short animation
    if (Math.abs(diff) < 0.1) {
      // Small amount - just flash and update
      setTimeout(() => {
        setDisplayCoins(endValue);
        setIsAnimating(false);
        setTimeout(() => {
          setIsNegative(false);
          setIsPositive(false);
        }, 500);
      }, 300);
      return;
    }
    
    // Count EVERY SINGLE CENT: 0,01 -> 0,02 -> 0,03 -> ... -> 0,50
    //
    // `diff` arrives in BOGX (0,50), NOT in cents. Treating it as a step count meant
    // 0,50 became half a step: the first tick added a whole 1,00 to the balance and the
    // loop then ended immediately and snapped back to the real value - a visible jump on
    // every reward.
    const totalCents = Math.round(Math.abs(diff) * 100);
    const direction = diff > 0 ? 1 : -1;
    let currentCent = 0;
    
    // 50ms per cent, but capped so a big win doesn't count for half a minute.
    const msPerCent = Math.max(12, Math.min(50, Math.round(2500 / totalCents)));

    const interval = setInterval(() => {
      currentCent++;
      const newValue = startValue + (currentCent * direction) / 100;
      setDisplayCoins(newValue);
      
      if (currentCent >= totalCents) {
        setDisplayCoins(endValue);
        setIsAnimating(false);
        setTimeout(() => {
          setIsNegative(false);
          setIsPositive(false);
        }, 500);
        clearInterval(interval);
      }
    }, msPerCent);

    return () => clearInterval(interval);
  }, [coinAnimation]);
  return (
    <div className="absolute top-0 left-0 right-0 z-50 bg-cream border-b border-warm">
      <div className="relative flex items-center justify-between px-4 h-[72px]">
        {/* Left - GenX Logo.
            Shrinkable on purpose: the score widget next to it is overflow-hidden, so
            when the row runs out of room it CLIPS its own content instead of wrapping -
            that is what cut the "22 DAY" column off at the right edge. The logo giving
            up a few pixels on narrow phones is the cheaper trade. */}
        <button onClick={onLogoClick} className="flex items-center hover:scale-105 transition-all -ml-1 min-w-0 shrink">
          <Image 
            src="/images/genxlogo1.png" 
            alt="Best of GenX" 
            width={80} 
            height={46} 
            className="object-contain h-[46px] w-auto max-w-full"
          />
        </button>

        {/* Score Widget - Desktop-like design with animations */}
        <button
          onClick={onCoinsClick}
          // Only the open rankings overlay fills this widget. A win/loss used to flood
          // it (red, then orange) for 1.4s, which turned the whole header into a
          // different colour for every reward - the shake/scale animation, the coloured
          // number and the flying delta are cue enough.
          className={`ml-auto shrink-0 flex items-stretch rounded-lg border shadow-sm transition-all relative overflow-hidden ${
            rankingsOpen
              ? 'bg-gradient-to-b from-[#E36B11] to-[#C4772A] border-[#E36B11]'
              : 'bg-gradient-to-b from-[#FFFDF9] to-[#FDF8F0] border-[#E36B11]/30'
          }`}
          style={isAnimating ? { 
            animation: isPositive ? 'scoreWin 1.4s ease-out' : 'scoreLoss 1.4s ease-out' 
          } : undefined}
        >
          {/* Left accent bar */}
          <div className={`absolute left-0 top-1 bottom-1 w-0.5 rounded-full ${
            rankingsOpen ? 'bg-gradient-to-b from-white to-white/80' : 'bg-gradient-to-b from-[#E36B11] to-[#E5A55A]'
          }`} />
          
          {/* Coins Section - with BOGX coin icon */}
          <div
            className={`flex items-center gap-1 pl-1 pr-1 py-2 border-r ${
              rankingsOpen ? 'border-white/20' : 'border-[#E36B11]/10'
            }`}
            style={{ minWidth: '70px' }}
          >
            {/* BOGX Coin Icon - same size AND same spin as Desktop. The coinSpin*
                keyframes were already defined below but nothing used them, so a
                reward only nudged the icon's scale while desktop spun its coin. */}
            <img 
              src="/images/bogxcoin.png" 
              alt="" 
              className="w-10 h-10 -my-1 shrink-0"
              style={isAnimating ? {
                animation: isPositive
                  ? 'coinSpinWin 1.1s ease-out'
                  : 'coinSpinLoss 0.9s ease-in-out',
              } : undefined}
            />
            <div className="flex flex-col justify-center">
              <span 
                // The balance has exactly ONE resting colour (brand orange). Green only
                // while the counter is actually running: isPositive alone lingers for up
                // to 3s after the number stopped moving (safety timeout below), which
                // made the widget look like it had two permanent states.
                className={`font-display font-bold tabular-nums leading-none transition-all ${
                  rankingsOpen ? 'text-white' :
                  isAnimating && isPositive ? 'text-green-600' : 'text-[#E36B11]'
                }`}
                // Same size as the rank number next to it - a smaller balance looked
                // secondary to its own day rank.
                style={{ fontSize: '26px' }}
              >
                {displayCoins.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-[8px] font-display uppercase ${
                rankingsOpen ? 'text-white/60' : 'text-gray-600'
              }`}>Coins</span>
            </div>
          </div>
          
          {/* Rank Positions OR Wager Section - fixed width in BOTH states on purpose:
              the wager replaces the rank column, and a content-driven width made the
              whole score widget resize the moment a wager appeared or was settled. */}
          <div className="flex items-center justify-center px-0.5 py-2 relative" style={{ minWidth: '72px' }}>
            {/* Wager overlay - shows instead of ranks when active - Desktop style with fade in/out */}
            {wagerVisible ? (
              <div 
                // Gold (#D4A04A tint, #C4772A on hover) instead of the indigo it used
                // to be: locked coins are still coins, and indigo was the only cool
                // colour in an otherwise cream/gold header.
                className={`group/wager relative flex items-center gap-1 px-1 py-1 rounded-lg cursor-pointer transition-all duration-300 border hover:bg-[#C4772A] hover:border-[#C4772A] ${
                  wagerAnim === 'in' ? 'bg-[#E8A54B]/30 border-[#E8A54B]/55' :
                  wagerAnim === 'out' ? 'bg-green-500/25 border-green-500/40' :
                  'bg-[#D4A04A]/20 border-[#D4A04A]/45'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onWagerClick?.();
                }}
                style={
                  wagerAnim === 'in' ? { animation: 'wagerIn 0.5s cubic-bezier(0.22, 1, 0.36, 1)' } :
                  wagerAnim === 'out' ? { animation: 'wagerOut 0.5s ease-in forwards' } :
                  { animation: 'wagerPulse 2s ease-in-out infinite' }
                }
              >
                <Lock className={`w-4 h-4 shrink-0 transition-all group-hover/wager:text-white ${
                  wagerAnim === 'in' ? 'text-[#E36B11] scale-125' :
                  wagerAnim === 'out' ? 'text-green-500 scale-110' :
                  'text-[#C4772A]'
                }`} />
                <div className="flex flex-col">
                  <span 
                    className={`font-display font-bold tabular-nums leading-none transition-all group-hover/wager:text-white ${
                      wagerAnim === 'in' ? 'text-[#E36B11] scale-110' :
                      wagerAnim === 'out' ? 'text-green-500 scale-110' :
                      'text-[#C4772A]'
                    }`}
                    style={{ fontSize: '20px' }}
                  >
                    {pendingAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[8px] font-display uppercase text-gray-600 transition-colors group-hover/wager:text-white/70">Wager</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center">
                {/* Mobile: only show Day rank for cleaner design */}
                <div className="flex flex-col items-center">
                  {isLoadingRanks ? (
                    <div className="w-8 h-6 bg-gray-200 rounded animate-pulse" />
                  ) : (
                    <div className="flex items-center gap-0.5">
                      {/* Arrow indicator - matches Desktop: green up, red down, green neutral */}
                      {dailyRank > 0 && dailyDir === 'up' && (
                        <ArrowUp className={`w-3.5 h-3.5 shrink-0 transition-colors ${rankingsOpen ? 'text-white' : 'text-green-500'}`} />
                      )}
                      {dailyRank > 0 && dailyDir === 'down' && (
                        <ArrowDown className={`w-3.5 h-3.5 shrink-0 transition-colors ${rankingsOpen ? 'text-white' : 'text-red-500'}`} />
                      )}
                      {dailyRank > 0 && dailyDir === null && (
                        <ArrowUp className={`w-3.5 h-3.5 shrink-0 transition-colors ${rankingsOpen ? 'text-white' : 'text-green-500'}`} />
                      )}
                      {dailyRank <= 0 && (
                        <span className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span
                        onClick={dailyRank > 0 ? undefined : (e) => {
                          e.stopPropagation();
                          setTipFor(prev => (prev === 'day' ? null : 'day'));
                        }}
                        className={`text-[26px] font-display font-bold tabular-nums leading-none transition-all ${
                          rankingsOpen
                            ? 'text-white'
                            : dailyRank > 0
                              ? 'text-gray-800'
                              : 'text-[#E36B11] cursor-pointer active:scale-125'
                        }`}
                      >
                        {dailyRank > 0 ? dailyRank.toString().padStart(2, '0') : '?'}
                      </span>
                    </div>
                  )}
                  <span className={`text-[9px] font-display uppercase transition-colors ${
                    rankingsOpen ? 'text-white/60' : 'text-gray-600'
                  }`}>Day</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Flying amount indicator */}
          {flyingAmount !== null && (
            <span 
              className={`absolute left-1/2 -translate-x-1/2 -top-1 z-20 pointer-events-none font-display text-sm ${
                flyingAmount > 0 ? 'text-green-500' : 'text-red-500'
              }`}
              style={{
                animation: 'scoreDelta 1.4s ease-out forwards',
                textShadow: '0 1px 6px rgba(255,255,255,0.9)',
              }}
            >
              {flyingAmount > 0 ? '+' : '−'}{Math.abs(flyingAmount).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </button>

        {/* Explanation for an unranked period. Rendered as a sibling of the score
            widget because that widget is overflow-hidden and would clip it. */}
        {tipFor && (
          <div className="absolute top-full right-2 mt-1 w-[240px] p-3 bg-[#FFF8E7] border border-[#E36B11]/30 rounded-lg shadow-xl z-[100]">
            <p className="text-[11px] text-gray-700 leading-relaxed">
              <strong className="text-[#E36B11]">Tip:</strong> {isLoggedIn ? (
                rankUnrankedTip(tipFor)
              ) : (
                <><span onClick={(e) => { e.stopPropagation(); setTipFor(null); onShowLogin?.(); }} className="text-[#E36B11] underline cursor-pointer">Log in</span>{rankUnrankedGuestTip(tipFor)}</>
              )}
            </p>
          </div>
        )}

        {/* Keyframes for animations - same as Desktop */}
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
            20% { transform: translate(-50%, -12px) scale(1.15); opacity: 1; }
            60% { transform: translate(-50%, -28px) scale(1); opacity: 1; }
            100% { transform: translate(-50%, -50px) scale(0.9); opacity: 0; }
          }
          @keyframes wagerPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(212, 160, 74, 0.45); }
            50% { box-shadow: 0 0 0 6px rgba(212, 160, 74, 0); }
          }
          /* Revealed left-to-right so it reads as coming out of the score, not fading
             in on top of it. clip-path rather than scaleX: scaling squashed the amount
             and the lock icon while the panel was still narrow. */
          @keyframes wagerIn {
            0% { clip-path: inset(0 100% 0 0); }
            100% { clip-path: inset(0 0 0 0); }
          }
          @keyframes wagerOut {
            0% { clip-path: inset(0 0 0 0); opacity: 1; }
            100% { clip-path: inset(0 100% 0 0); opacity: 0; }
          }
        `}</style>

        {/* Separator */}
        <div className="w-px h-6 bg-gray-300 mx-1.5" />

        {/* Right side - Notifications + Profile */}
        <div className="flex items-center gap-0 -mr-1 shrink-0">
          {/* Notification Bell */}
          <button 
            onClick={handleNotificationClick}
            className={`flex flex-col items-center px-1.5 py-1 rounded-lg transition-all relative ${
              notificationOpen ? 'bg-[#E36B11]' : 'hover:bg-cream'
            }`}
          >
            <Bell className={`w-6 h-6 transition-colors ${
              notificationOpen 
                ? 'text-white' 
                : notificationsEnabled 
                  ? 'text-[#E36B11]' 
                  : 'text-gray-900'
            }`} />
            <span className={`text-[8px] font-bold tracking-wider ${
              notificationOpen 
                ? 'text-white' 
                : notificationsEnabled 
                  ? 'text-[#E36B11]' 
                  : 'text-gray-900'
            }`}>NEWS</span>
            {unreadCount > 0 && !notificationOpen && (
              <div className="absolute top-0 right-0.5 w-3.5 h-3.5 bg-[#E36B11] rounded-full flex items-center justify-center">
                <span className="text-[8px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
              </div>
            )}
          </button>
          
          {/* Separator */}
          <div className="w-px h-6 bg-gray-300 mx-0.5" />
          
          {/* Profile - same style as Radio/News */}
          <button 
            onClick={onProfileClick}
            className={`flex flex-col items-center px-1.5 py-1 rounded-lg transition-all ${
              profileOpen ? 'bg-[#E36B11]' : 'hover:bg-cream'
            }`}
          >
            <div className={`w-6 h-6 rounded-full overflow-hidden border ${profileOpen ? 'border-white' : 'border-gray-400'}`}>
              {userAvatar ? (
                <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${profileOpen ? 'bg-[#E36B11]' : 'bg-skeleton-light'}`}>
                  <User className={`w-3 h-3 ${profileOpen ? 'text-white' : 'text-gray-900'}`} />
                </div>
              )}
            </div>
            <span className={`text-[8px] font-bold tracking-wider ${profileOpen ? 'text-white' : 'text-gray-900'}`}>PROFILE</span>
          </button>
        </div>
      </div>
    </div>
  );
}
