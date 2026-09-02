"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Crown, Radio, Tv, User, ArrowUp, ArrowDown, Lock } from "lucide-react";
import Image from "next/image";
import { formatCurrency, getCurrencySymbol } from "@/utils/currency";
import { type RankPeriod, rankUnrankedTip, rankUnrankedGuestTip } from "@/lib/rankPeriod";

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
    const totalCents = Math.abs(diff); // e.g., 50 cents = 50 steps
    const direction = diff > 0 ? 1 : -1;
    let currentCent = 0;
    
    // 50 cents over 2.5 seconds = 50ms per cent
    const msPerCent = 50;

    const interval = setInterval(() => {
      currentCent++;
      const newValue = startValue + (currentCent * direction);
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
        {/* Left - GenX Logo */}
        <button onClick={onLogoClick} className="flex items-center hover:scale-105 transition-all -ml-1">
          <Image 
            src="/images/genxlogo1.png" 
            alt="Best of GenX" 
            width={80} 
            height={46} 
            className="object-contain"
          />
        </button>

        {/* Score Widget - Desktop-like design with animations */}
        <button
          onClick={onCoinsClick}
          className={`ml-auto flex items-stretch rounded-lg border shadow-sm transition-all relative overflow-hidden ${
            rankingsOpen 
              ? 'bg-gradient-to-b from-[#E36B11] to-[#C4772A] border-[#E36B11]' 
              : isNegative
                ? 'bg-gradient-to-b from-red-500 to-red-600 border-red-500'
                : isPositive
                  ? 'bg-gradient-to-b from-[#E36B11] to-[#C4772A] border-[#E36B11]'
                  : 'bg-gradient-to-b from-[#FFFDF9] to-[#FDF8F0] border-[#E36B11]/30'
          }`}
          style={isAnimating ? { 
            animation: isPositive ? 'scoreWin 1.4s ease-out' : 'scoreLoss 1.4s ease-out' 
          } : undefined}
        >
          {/* Left accent bar */}
          <div className={`absolute left-0 top-1 bottom-1 w-0.5 rounded-full ${
            rankingsOpen || isPositive ? 'bg-gradient-to-b from-white to-white/80' : 'bg-gradient-to-b from-[#E36B11] to-[#E5A55A]'
          }`} />
          
          {/* Coins Section - no icon, bigger numbers, fixed min width */}
          <div className={`flex items-center pl-2 pr-1 py-2 border-r ${
            rankingsOpen || isPositive || isNegative ? 'border-white/20' : 'border-[#E36B11]/10'
          }`} style={{ minWidth: '70px' }}>
            <div className="flex flex-col justify-center">
              <span 
                className={`font-display font-bold tabular-nums leading-none transition-all ${
                  isPositive ? 'text-green-400' : 
                  isNegative ? 'text-red-300' : 
                  rankingsOpen ? 'text-white' : 'text-[#E36B11]'
                }`}
                style={{ fontSize: '26px' }}
              >
                {displayCoins.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-[7px] font-display uppercase ${
                rankingsOpen || isPositive || isNegative ? 'text-white/60' : 'text-gray-400'
              }`}>Coins</span>
            </div>
          </div>
          
          {/* Rank Positions OR Wager Section - fixed width to prevent size change */}
          <div className="flex items-center justify-center px-1 py-2 relative" style={{ minWidth: '100px' }}>
            {/* Wager overlay - shows instead of ranks when active - Desktop style with fade in/out */}
            {wagerVisible ? (
              <div 
                className={`group/wager relative flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer transition-all duration-300 border hover:bg-[#6366F1] hover:border-[#6366F1] ${
                  wagerAnim === 'in' ? 'bg-[#A855F7]/25 border-[#A855F7]/40' :
                  wagerAnim === 'out' ? 'bg-green-500/25 border-green-500/40' :
                  'bg-[#6366F1]/15 border-[#6366F1]/30'
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
                <Lock className={`w-4 h-4 transition-all group-hover/wager:text-white ${
                  wagerAnim === 'in' ? 'text-[#A855F7] scale-125' :
                  wagerAnim === 'out' ? 'text-green-500 scale-110' :
                  'text-[#6366F1]'
                }`} />
                <div className="flex flex-col">
                  <span 
                    className={`font-display font-bold tabular-nums leading-none transition-all group-hover/wager:text-white ${
                      wagerAnim === 'in' ? 'text-[#A855F7] scale-110' :
                      wagerAnim === 'out' ? 'text-green-500 scale-110' :
                      'text-[#6366F1]'
                    }`}
                    style={{ fontSize: '20px' }}
                  >
                    {pendingAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[8px] font-display uppercase text-gray-400 transition-colors group-hover/wager:text-white/70">Wager</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                {/* One column per period. An unranked period shows an orange "?" that
                    opens the explanation instead of the rankings overlay - a bare "—"
                    made "played 35 games, net negative" look like "never played".
                    A span, not a button: the whole widget already is a <button>. */}
                {([
                  { key: 'day', label: 'Day', value: dailyRank },
                  { key: 'month', label: 'Mon', value: monthlyRank },
                  { key: 'year', label: 'Year', value: yearlyRank },
                ] as const).map(({ key, label, value }, i) => {
                  const hasRank = value > 0;
                  return (
                    <div key={key} className="flex items-center gap-1.5">
                      {i > 0 && <div className={`w-px h-6 ${rankingsOpen ? 'bg-white/20' : 'bg-gray-300'}`} />}
                      <div className="flex flex-col items-center">
                        {isLoadingRanks ? (
                          <div className="w-8 h-6 bg-gray-200 rounded animate-pulse" />
                        ) : (
                          <span
                            onClick={hasRank ? undefined : (e) => {
                              e.stopPropagation();
                              setTipFor(prev => (prev === key ? null : key));
                            }}
                            className={`font-display font-bold tabular-nums leading-none transition-transform ${
                              rankingsOpen
                                ? 'text-white'
                                : hasRank
                                  ? 'text-green-500'
                                  : 'text-[#E36B11] cursor-pointer active:scale-125'
                            }`}
                            style={{ fontSize: '20px' }}
                          >
                            {hasRank ? value.toString().padStart(2, '0') : '?'}
                          </span>
                        )}
                        <span className={`text-[8px] font-display uppercase ${
                          rankingsOpen ? 'text-white/60' : 'text-gray-400'
                        }`}>{label}</span>
                      </div>
                    </div>
                  );
                })}
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
            0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
            50% { box-shadow: 0 0 0 6px rgba(99, 102, 241, 0); }
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
        <div className="flex items-center gap-0 -mr-1">
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
