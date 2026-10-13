"use client";

import { useState, useEffect, useRef } from "react";
import RankTooltip from "./RankTooltip";
import { Bell, Crown, Radio, Tv, User, ArrowUp, ArrowDown, Lock, Info } from "lucide-react";
import LoadingDots from "./LoadingDots";
import { useAnimatedValue, useIntroCount, animateUnranked } from "@/hooks/useCountUp";
import Image from "next/image";
import { formatCurrency, getCurrencySymbol } from "@/utils/currency";
import { type RankPeriod, rankUnrankedTip, rankUnrankedGuestTip, formatUnrankedValue } from "@/lib/rankPeriod";
import ShineSweep from "./ShineSweep";

// Flip-clock roll + "just placed" fade for a rank position. Ported from
// DesktopRankWidget's RankBox so the mobile header stops switching its rank
// number hard while desktop rolls it - the two had drifted apart (see AGENTS.md).
// Presentation only: it never touches the balance.
function useRankRoll(value: number): { roll: 'up' | 'down' | null; justPlaced: boolean } {
  const prevValueRef = useRef(value);
  const [roll, setRoll] = useState<'up' | 'down' | null>(null);
  const [justPlaced, setJustPlaced] = useState(false);

  useEffect(() => {
    const prev = prevValueRef.current;
    prevValueRef.current = value;

    // Was unranked, now has a position - fade in instead of rolling.
    if (prev <= 0 && value > 0) {
      setJustPlaced(true);
      const timer = setTimeout(() => setJustPlaced(false), 1000);
      return () => clearTimeout(timer);
    }

    // Ranks arrive as 0 and are filled in once loaded. Animating that would
    // claim a position change on every page load.
    if (prev === value || prev <= 0 || value <= 0) return;

    // Smaller rank number = better position = rolls upwards.
    setRoll(value < prev ? 'up' : 'down');
    const timer = setTimeout(() => setRoll(null), 600);
    return () => clearTimeout(timer);
  }, [value]);

  return { roll, justPlaced };
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
  coinAnimationKey?: number; // Bumped once per event - the trigger object is recreated every render
  // Rank positions like desktop
  dailyRank?: number;
  monthlyRank?: number;
  yearlyRank?: number;
  // Rank arrows, computed server-side (same on desktop) - null = no movement
  dailyChange?: 'up' | 'down' | null;
  monthlyChange?: 'up' | 'down' | null;
  yearlyChange?: 'up' | 'down' | null;
  // Points for showing negative balance when unranked
  dailyPoints?: number;
  monthlyPoints?: number;
  yearlyPoints?: number;
  // Wager display
  pendingAmount?: number;
  onWagerClick?: () => void;
  // Loading state
  isLoadingRanks?: boolean;
  isLoadingCoins?: boolean; // balance not loaded yet - show a placeholder instead of 0,00
  // Unranked-period tooltip
  isLoggedIn?: boolean;
  onShowLogin?: () => void;
}

export default function Header({ coins, userAvatar, userRank, hasPendingWager = false, rankingsOpen, onCoinsClick, onLogoClick, onNotificationClick, onProfileClick, onRadioClick, onTVClick, notificationOpen, profileOpen, radioOpen = false, tvOpen = false, notificationsEnabled, unreadCount = 0, coinAnimation, coinAnimationKey, dailyRank = 0, monthlyRank = 0, yearlyRank = 0, dailyChange = null, monthlyChange = null, yearlyChange = null, dailyPoints, monthlyPoints, yearlyPoints, pendingAmount = 0, onWagerClick, isLoadingRanks = false, isLoadingCoins = false, isLoggedIn = true, onShowLogin }: HeaderProps) {
  const [displayCoins, setDisplayCoins] = useState(coins);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isNegative, setIsNegative] = useState(false);
  const [isPositive, setIsPositive] = useState(false);
  const [flyingAmount, setFlyingAmount] = useState<number | null>(null);
  const prevCoinsRef = useRef(coins);
  const lastAnimationRef = useRef<{ amount: number } | null>(null);
  // Intro gimmick: counts up from 0 once the balance has loaded. Later changes
  // keep their own animation (displayCoins).
  const introCoins = useIntroCount(isLoadingCoins ? undefined : coins);
  
  // Rank direction arrows
  const dailyDir = dailyChange;
  const monthlyDir = monthlyChange;
  const yearlyDir = yearlyChange;

  // Roll/fade for the Day position shown in the widget.
  const { roll: dailyRoll, justPlaced: dailyJustPlaced } = useRankRoll(dailyRank);
  const dailyArrowAnim = dailyRoll
    ? { animation: `arrowPop${dailyRoll === 'up' ? 'Up' : 'Down'} 0.6s ease-out` }
    : undefined;
  
  // Wager animation state
  const [wagerVisible, setWagerVisible] = useState(pendingAmount > 0);
  const [wagerAnim, setWagerAnim] = useState<'in' | 'out' | null>(null);
  const prevPendingRef = useRef(pendingAmount);
  // Last non-zero amount, so the fade-out does not count down to 0,00
  const [wagerDisplay, setWagerDisplay] = useState(pendingAmount);
  useEffect(() => { if (pendingAmount > 0) setWagerDisplay(pendingAmount); }, [pendingAmount]);

  // Which unranked period was tapped - drives the explanation tooltip.
  // Touch has no mouseleave, so the tip closes itself after a few seconds.
  const [tipFor, setTipFor] = useState<RankPeriod | null>(null);

  // Unranked: own net for the period ("-0,37" / "0,00"), "?" only when unknown.
  // Counts from the old to the new balance instead of jumping.
  // Held back while the loading dots show, so the intro count is actually seen.
  const animDaily = useAnimatedValue(isLoadingRanks ? undefined : dailyPoints);
  const animMonthly = useAnimatedValue(isLoadingRanks ? undefined : monthlyPoints);
  const animYearly = useAnimatedValue(isLoadingRanks ? undefined : yearlyPoints);
  // Intro gimmick: ranks count up once they have loaded
  const introDailyRank = useIntroCount(isLoadingRanks || dailyRank <= 0 ? undefined : dailyRank, 900);
  const introMonthlyRank = useIntroCount(isLoadingRanks || monthlyRank <= 0 ? undefined : monthlyRank, 900);
  const introYearlyRank = useIntroCount(isLoadingRanks || yearlyRank <= 0 ? undefined : yearlyRank, 900);
  const showRank = (rank: number, intro: number | null) => intro === null ? rank : Math.max(1, Math.round(intro));
  const formatUnranked = (points: number | undefined, animated: number | undefined) =>
    formatUnrankedValue(animateUnranked(points, animated));
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

  // Count-up runs in a ref-guarded interval. The guard must be a REF: the parent
  // raises `coins` in the same render that triggers the animation, and a state flag
  // is still false in that commit, so the silent sync below used to snap the
  // display to the end value first - the count then ran from the end value upwards
  // and jumped back when it finished.
  const animatingRef = useRef(false);
  const countIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const coinsRef = useRef(coins);
  coinsRef.current = coins;
  useEffect(() => () => { if (countIntervalRef.current) clearInterval(countIntervalRef.current); }, []);

  // Animate when explicitly triggered. Keyed on `coinAnimationKey` (bumped once per
  // event by the parent): the `coinAnimation` object is recreated on every parent
  // render, so keying on its identity restarted the count mid-flight.
  // Declared BEFORE the silent sync so it claims the counter in the same commit.
  useEffect(() => {
    if (!coinAnimation) return;
    const marker = coinAnimationKey !== undefined ? { amount: coinAnimationKey } : coinAnimation;
    if (coinAnimationKey !== undefined ? lastAnimationRef.current?.amount === coinAnimationKey : coinAnimation === lastAnimationRef.current) return;
    lastAnimationRef.current = marker;
    
    const diff = coinAnimation.amount;
    if (diff === 0) return;
    animatingRef.current = true;
    if (countIntervalRef.current) clearInterval(countIntervalRef.current);
    
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
    
    // Small amounts count too (a Solo Trivia answer is often 0,05-0,30); they
    // used to skip straight to the end value, which read as a jump.
    // Count EVERY SINGLE CENT: 0,01 -> 0,02 -> 0,03 -> ... -> 0,50
    //
    // `diff` arrives in BOGX (0,50), NOT in cents. Treating it as a step count meant
    // 0,50 became half a step: the first tick added a whole 1,00 to the balance and the
    // loop then ended immediately and snapped back to the real value - a visible jump on
    // every reward.
    const totalCents = Math.max(1, Math.round(Math.abs(diff) * 100));
    // Fixed duration regardless of the amount: a 0,05 win used to be over in a
    // quarter of a second. Up to MAX_STEPS cents every single cent is shown;
    // beyond that it steps evenly so a big win doesn't count for half a minute.
    const COUNT_DURATION_MS = 1800;
    const MAX_STEPS = 45;
    const steps = Math.min(totalCents, MAX_STEPS);
    const msPerStep = Math.round(COUNT_DURATION_MS / steps);
    let currentStep = 0;

    // No effect cleanup here on purpose: the interval lives in a ref and is only
    // replaced by the next event or cleared on unmount, so a parent re-render can
    // no longer cancel a running count.
    countIntervalRef.current = setInterval(() => {
      currentStep++;
      const newValue = startValue + (diff * currentStep) / steps;
      setDisplayCoins(Math.round(newValue * 100) / 100);
      
      if (currentStep >= steps) {
        if (countIntervalRef.current) clearInterval(countIntervalRef.current);
        countIntervalRef.current = null;
        animatingRef.current = false;
        // Land on the authoritative balance, not on start + diff.
        setDisplayCoins(coinsRef.current);
        prevCoinsRef.current = coinsRef.current;
        setIsAnimating(false);
        setTimeout(() => {
          setIsNegative(false);
          setIsPositive(false);
        }, 500);
      }
    }, msPerStep);
  }, [coinAnimation, coinAnimationKey]);

  // Update display coins silently when coins change and nothing is counting
  useEffect(() => {
    if (animatingRef.current) return;
    setDisplayCoins(coins);
    prevCoinsRef.current = coins;
  }, [coins]);
  return (
    <div className="absolute top-0 left-0 right-0 z-50 bg-cream border-b border-warm">
      <div className="relative flex items-center justify-between px-4 h-[72px]">
        {/* Left - GenX Logo - fixed size, never shrink */}
        <button onClick={onLogoClick} className="fx-logo flex items-center -ml-1 shrink-0" style={{ ['--fx-logo-src' as string]: 'url(/images/genxlogo1.png)' }}>
          <Image 
            src="/images/genxlogo1.png" 
            alt="Best of GenX" 
            width={80} 
            height={46} 
            className="object-contain h-[46px] w-auto max-w-full"
          />
        </button>

        {/* Score Widget - Design with separators like mockup */}
        <div
          className={`ml-1 flex-1 min-w-0 flex items-center relative h-[46px] rounded border shadow-sm pl-2.5 pr-2 transition-all ${
            rankingsOpen 
              ? 'bg-gradient-to-b from-[#E36B11] to-[#C4772A] border-[#E36B11]' 
              : 'bg-gradient-to-b from-[#FFFDF9] to-[#FDF8F0] border-[#E36B11]/30'
          }`}
          style={isAnimating ? { 
            animation: isPositive ? 'scoreWin 1.4s ease-out' : 'scoreLoss 1.4s ease-out' 
          } : undefined}
        >
          {/* Left accent bar */}
          <div className={`absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full ${
            rankingsOpen ? 'bg-gradient-to-b from-white to-white/80' : 'bg-gradient-to-b from-[#E36B11] to-[#E5A55A]'
          }`} />
          {/* Occasional subtle glint - gold on the cream card, white when it is orange */}
          <ShineSweep rgb={rankingsOpen ? '255, 255, 255' : '229, 165, 90'} intensity={rankingsOpen ? 0.25 : 0.28} minDelayMs={9000} maxDelayMs={18000} firstDelayMs={2500} firstJitterMs={2000} />
          
          {/* Coins Section - clickable, with coin icon */}
          <button
            onClick={onCoinsClick}
            className="flex flex-col items-center hover:opacity-80 transition-opacity px-0 py-0"
          >
            <div className="flex items-center gap-0.5">
              {/* BOGX Coin Icon - image size = font size of the balance; the PNG's ~12% transparent padding makes the visible disc match the digit height. Inline sizes so they never depend on a freshly generated Tailwind class */}
              <img 
                src="/images/bogxcoin.png" 
                alt="" 
                className="shrink-0"
                style={{
                  width: 22,
                  height: 22,
                  margin: '-1px -1.5px 1px -2px',
                  ...(isAnimating ? {
                    animation: isPositive
                      ? 'coinSpinWin 1.1s ease-out'
                      : 'coinSpinLoss 0.9s ease-in-out',
                  } : {}),
                }}
              />
              {isLoadingCoins ? (
                // Balance not loaded yet - a placeholder, never a fake "0,00"
                <span className="inline-flex items-center h-[22px] px-1"><LoadingDots className={rankingsOpen ? 'text-white' : 'text-[#E36B11]'} /></span>
              ) : (
              <span 
                className={`font-display font-bold tabular-nums leading-none transition-all ${
                  rankingsOpen ? 'text-white' :
                  isAnimating && isPositive ? 'text-green-600' : 'text-[#E36B11]'
                }`}
                style={{ fontSize: '22px' }}
              >
                {(introCoins ?? displayCoins).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              )}
            </div>
            <span className={`relative top-[3px] text-[10px] leading-[12px] font-normal font-display uppercase tracking-wide ${rankingsOpen ? 'text-white/70' : 'text-gray-500'}`}>Coins</span>
          </button>
          
          {/* Rank Positions - with separators */}
          <button
            onClick={onCoinsClick}
            className="flex-1 flex items-center justify-evenly hover:opacity-80 transition-opacity"
          >
            {/* Day */}
            <div className={`w-px h-8 mx-1 ${rankingsOpen ? 'bg-white/30' : 'bg-gray-300'}`} />
            <div className="flex flex-col items-center min-w-[32px]">
              {isLoadingRanks ? (
                <div className="flex items-center h-5"><LoadingDots className={rankingsOpen ? 'text-white' : 'text-[#E36B11]'} /></div>
              ) : (
                <div className="flex items-center gap-0.5">
                  {dailyRank > 0 && dailyDir === 'down' && (
                    <ArrowDown style={dailyArrowAnim} className={`w-3.5 h-3.5 shrink-0 animate-bounce-subtle-down ${rankingsOpen ? 'text-white' : 'text-[#E36B11]'}`} />
                  )}
                  {dailyRank > 0 && dailyDir === 'up' && (
                    <ArrowUp style={dailyArrowAnim} className={`w-3.5 h-3.5 shrink-0 animate-bounce-subtle-up ${rankingsOpen ? 'text-white' : 'text-green-500'}`} />
                  )}
                  {/* No arrow when unranked - neutral state */}
                  <span
                    key={`day-${dailyRank}-${dailyRoll ?? 'idle'}`}
                    onClick={dailyRank > 0 ? undefined : (e) => { e.stopPropagation(); setTipFor(prev => prev === 'day' ? null : 'day'); }}
                    style={dailyJustPlaced ? { animation: 'rankFadeIn 0.5s ease-out' } : dailyRoll ? { animation: `rankRoll${dailyRoll === 'up' ? 'Up' : 'Down'} 0.5s cubic-bezier(0.22, 1, 0.36, 1)` } : undefined}
                    className={`font-display font-bold tabular-nums leading-none ${rankingsOpen ? 'text-white text-[22px]' : dailyRank > 0 ? 'text-gray-800 text-[22px]' : 'text-[#E36B11] text-[13px] cursor-pointer active:scale-110'}`}
                  >
                    {dailyRank > 0 ? showRank(dailyRank, introDailyRank) : formatUnranked(dailyPoints, animDaily)}
                  </span>
                </div>
              )}
              <span className={`relative top-[3px] text-[10px] leading-[12px] font-normal font-display uppercase ${rankingsOpen ? 'text-white/70' : 'text-gray-500'}`}>Day{!isLoadingRanks && isLoggedIn && dailyRank <= 0 && <Info className={`absolute left-full top-1/2 -translate-y-1/2 ml-0.5 w-2.5 h-2.5 ${rankingsOpen ? 'text-white/70' : 'text-gray-400'}`} />}</span>
            </div>
            
            {/* Open wager takes the place of Month + Year - the header has no room
                for a fourth column, and the wager was otherwise not shown at all */}
            {wagerVisible ? (
              <>
                <div className={`w-px h-8 mx-1 ${rankingsOpen ? 'bg-white/30' : 'bg-gray-300'}`} />
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); onWagerClick?.(); }}
                  style={
                    pendingAmount === 0 ? { animation: 'wagerOut 0.45s ease-in forwards' }
                    : wagerAnim === 'in' ? { animation: 'wagerIn 0.55s cubic-bezier(0.22, 1, 0.36, 1)' }
                    : undefined
                  }
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg min-w-[76px] justify-center ${rankingsOpen ? 'bg-white/15' : 'bg-[#D4A04A]/15 border border-[#D4A04A]/40'}`}
                >
                  <Lock className={`w-3.5 h-3.5 shrink-0 ${rankingsOpen ? 'text-white' : 'text-[#C4772A]'}`} />
                  <span className="flex flex-col items-center">
                    <span className={`font-display font-bold tabular-nums leading-none text-[18px] ${rankingsOpen ? 'text-white' : 'text-gray-800'}`}>
                      {wagerDisplay.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={`relative top-[3px] text-[10px] leading-[12px] font-normal font-display uppercase ${rankingsOpen ? 'text-white/70' : 'text-gray-500'}`}>Wager</span>
                  </span>
                </span>
              </>
            ) : (<>
            {/* Month */}
            <div className={`w-px h-8 mx-1 ${rankingsOpen ? 'bg-white/30' : 'bg-gray-300'}`} />
            <div className="flex flex-col items-center min-w-[32px]">
              {isLoadingRanks ? (
                <div className="flex items-center h-5"><LoadingDots className={rankingsOpen ? 'text-white' : 'text-[#E36B11]'} /></div>
              ) : (
                <div className="flex items-center gap-0.5">
                  {monthlyRank > 0 && monthlyDir === 'down' && (
                    <ArrowDown className={`w-3.5 h-3.5 shrink-0 animate-bounce-subtle-down ${rankingsOpen ? 'text-white' : 'text-[#E36B11]'}`} />
                  )}
                  {monthlyRank > 0 && monthlyDir === 'up' && (
                    <ArrowUp className={`w-3.5 h-3.5 shrink-0 animate-bounce-subtle-up ${rankingsOpen ? 'text-white' : 'text-green-500'}`} />
                  )}
                  {/* No arrow when unranked - neutral state */}
                  <span
                    onClick={monthlyRank > 0 ? undefined : (e) => { e.stopPropagation(); setTipFor(prev => prev === 'month' ? null : 'month'); }}
                    className={`font-display font-bold tabular-nums leading-none ${rankingsOpen ? 'text-white text-[22px]' : monthlyRank > 0 ? 'text-gray-800 text-[22px]' : 'text-[#E36B11] text-[13px] cursor-pointer active:scale-110'}`}
                  >
                    {monthlyRank > 0 ? showRank(monthlyRank, introMonthlyRank) : formatUnranked(monthlyPoints, animMonthly)}
                  </span>
                </div>
              )}
              <span className={`relative top-[3px] text-[10px] leading-[12px] font-normal font-display uppercase ${rankingsOpen ? 'text-white/70' : 'text-gray-500'}`}>Month{!isLoadingRanks && isLoggedIn && monthlyRank <= 0 && <Info className={`absolute left-full top-1/2 -translate-y-1/2 ml-0.5 w-2.5 h-2.5 ${rankingsOpen ? 'text-white/70' : 'text-gray-400'}`} />}</span>
            </div>
            
            {/* Year */}
            <div className={`w-px h-8 mx-1 ${rankingsOpen ? 'bg-white/30' : 'bg-gray-300'}`} />
            <div className="flex flex-col items-center min-w-[32px]">
              {isLoadingRanks ? (
                <div className="flex items-center h-5"><LoadingDots className={rankingsOpen ? 'text-white' : 'text-[#E36B11]'} /></div>
              ) : (
                <div className="flex items-center gap-0.5">
                  {yearlyRank > 0 && yearlyDir === 'down' && (
                    <ArrowDown className={`w-3.5 h-3.5 shrink-0 animate-bounce-subtle-down ${rankingsOpen ? 'text-white' : 'text-[#E36B11]'}`} />
                  )}
                  {yearlyRank > 0 && yearlyDir === 'up' && (
                    <ArrowUp className={`w-3.5 h-3.5 shrink-0 animate-bounce-subtle-up ${rankingsOpen ? 'text-white' : 'text-green-500'}`} />
                  )}
                  {/* No arrow when unranked - neutral state */}
                  <span
                    onClick={yearlyRank > 0 ? undefined : (e) => { e.stopPropagation(); setTipFor(prev => prev === 'year' ? null : 'year'); }}
                    className={`font-display font-bold tabular-nums leading-none ${rankingsOpen ? 'text-white text-[22px]' : yearlyRank > 0 ? 'text-gray-800 text-[22px]' : 'text-[#E36B11] text-[13px] cursor-pointer active:scale-110'}`}
                  >
                    {yearlyRank > 0 ? showRank(yearlyRank, introYearlyRank) : formatUnranked(yearlyPoints, animYearly)}
                  </span>
                </div>
              )}
              <span className={`relative top-[3px] text-[10px] leading-[12px] font-normal font-display uppercase ${rankingsOpen ? 'text-white/70' : 'text-gray-500'}`}>Year{!isLoadingRanks && isLoggedIn && yearlyRank <= 0 && <Info className={`absolute left-full top-1/2 -translate-y-1/2 ml-0.5 w-2.5 h-2.5 ${rankingsOpen ? 'text-white/70' : 'text-gray-400'}`} />}</span>
            </div>
            </>)}
          </button>
          
          {/* Flying amount indicator */}
          {flyingAmount !== null && (
            <span 
              className={`absolute left-1/4 -top-1 z-20 pointer-events-none font-display text-sm ${
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
        </div>

        {/* Profile - separate from the score widget */}
        <button 
          onClick={onProfileClick}
          className="ml-1 shrink-0 flex flex-col items-center hover:opacity-80 transition-opacity"
        >
          <div className={`w-[46px] h-[46px] rounded overflow-hidden border ${profileOpen ? 'border-[#E36B11]' : 'border-[#E36B11]/30'} shadow-sm bg-gradient-to-b from-[#FFFDF9] to-[#FDF8F0]`}>
            {userAvatar ? (
              <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-6 h-6 text-[#E36B11]" />
              </div>
            )}
          </div>

        </button>

        {/* Explanation for an unranked period */}
        {tipFor && (
          <RankTooltip
            compact
            period={tipFor}
            isLoggedIn={isLoggedIn}
            onLogin={() => { setTipFor(null); onShowLogin?.(); }}
            className="absolute top-full right-2 mt-1.5 w-[250px] z-[100]"
          />
        )}

        {/* Keyframes for animations - same as Desktop */}
        <style>{`n          @keyframes rankTipIn {
            from { opacity: 0; transform: translateY(-6px) scale(0.94); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
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
          /* Rank positions roll like a flip clock: a better position (smaller
             number) comes up from below, a worse one drops in from above.
             Same keyframes as DesktopRankWidget - mobile had none of these, so
             its rank number switched hard while desktop rolled. */
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

      </div>
    </div>
  );
}
