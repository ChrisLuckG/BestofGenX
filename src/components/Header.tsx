"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Crown, Radio, Tv, User } from "lucide-react";
import Image from "next/image";
import { formatCurrency, getCurrencySymbol } from "@/utils/currency";

interface HeaderProps {
  coins: number;
  username: string;
  userAvatar?: string;
  userRank?: number; // User's current ranking position
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
}

export default function Header({ coins, userAvatar, userRank, rankingsOpen, onCoinsClick, onLogoClick, onNotificationClick, onProfileClick, onRadioClick, onTVClick, notificationOpen, profileOpen, radioOpen = false, tvOpen = false, notificationsEnabled, unreadCount = 0, coinAnimation }: HeaderProps) {
  const [displayCoins, setDisplayCoins] = useState(coins);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isNegative, setIsNegative] = useState(false);
  const [isPositive, setIsPositive] = useState(false);
  const [flyingAmount, setFlyingAmount] = useState<number | null>(null);
  const prevCoinsRef = useRef(coins);
  const lastAnimationRef = useRef<{ amount: number } | null>(null);
  
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
      <div className="relative flex items-center justify-between px-4 h-16">
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

        {/* Center - Score Widget: Coin left, Rank+Points right - same height as TV/Radio */}
        <button
          onClick={onCoinsClick}
          className={`ml-auto flex items-center gap-1.5 px-1.5 py-1.5 hover:scale-105 rounded-lg relative ${isNegative ? 'animate-pulse' : ''}`}
          style={{ 
            background: rankingsOpen
              ? '#D4873A'
              : isNegative 
                ? 'linear-gradient(180deg, #ff0000 0%, #cc0000 100%)'
                : isPositive
                  ? 'linear-gradient(180deg, #D4873A 0%, #c06a2a 100%)'
                  : 'rgba(212, 135, 58, 0.1)',
            border: rankingsOpen ? 'none' : '2px solid #D4873A',
            boxShadow: rankingsOpen
              ? '0 2px 10px rgba(212, 135, 58, 0.4)'
              : isNegative 
                ? '0 4px 30px rgba(255, 0, 0, 0.8)'
                : isPositive
                  ? '0 4px 20px rgba(212, 135, 58, 0.6)'
                  : '0 2px 8px rgba(212, 135, 58, 0.15)',
            transition: 'all 0.3s ease'
          }}
        >
          {/* Left: Coin icon (bigger) - enhanced contrast when on orange bg */}
          <img 
            src="/images/bogxcoin.png" 
            alt="" 
            className="w-8 h-8"
            style={{ 
              filter: rankingsOpen 
                ? 'brightness(1.3) contrast(1.5) saturate(1.4) drop-shadow(0 1px 3px rgba(0,0,0,0.4))' 
                : 'saturate(1.1)' 
            }}
          />
          
          {/* Right: Rank on top, Points below */}
          <div className="flex flex-col items-start leading-tight">
            {/* Top row: Crown + Rank */}
            <span className={`text-[10px] font-bold flex items-center gap-0.5 ${rankingsOpen ? 'text-white/80' : 'text-[#D4873A]'}`}>
              <Crown className="w-3.5 h-3.5" />
              #{userRank 
                ? userRank >= 10000 
                  ? `${(userRank / 1000).toFixed(0)}K` 
                  : userRank >= 1000 
                    ? `${(userRank / 1000).toFixed(1)}K`
                    : userRank.toLocaleString('de-DE')
                : '—'}
            </span>
            {/* Bottom: BOGX Coins */}
            <span className={`font-black transition-all duration-300 whitespace-nowrap ${isAnimating ? "scale-110" : ""} text-sm ${isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : rankingsOpen ? 'text-white' : 'text-[#D4873A]'}`}>
              {formatCurrency(displayCoins)}
            </span>
          </div>
          
          {/* Flying amount indicator */}
          {flyingAmount !== null && (
            <span 
              className={`absolute left-1/2 -translate-x-1/2 font-black text-lg pointer-events-none ${
                flyingAmount > 0 ? 'text-green-400' : 'text-red-400'
              }`}
              style={{
                animation: flyingAmount > 0 ? 'flyUp 1.5s ease-out forwards' : 'flyDown 1.5s ease-out forwards',
                textShadow: flyingAmount > 0 
                  ? '0 0 10px rgba(74, 222, 128, 0.8)' 
                  : '0 0 10px rgba(248, 113, 113, 0.8)'
              }}
            >
              {flyingAmount > 0 ? `+${formatCurrency(flyingAmount)}` : `${formatCurrency(flyingAmount)}`}
            </span>
          )}
        </button>
        
        {/* Keyframes for flying animation */}
        <style>{`
          @keyframes flyUp {
            0% { bottom: 0; opacity: 1; transform: translateX(-50%) scale(1); }
            100% { bottom: 80px; opacity: 0; transform: translateX(-50%) scale(1.5); }
          }
          @keyframes flyDown {
            0% { top: 100%; opacity: 1; transform: translateX(-50%) scale(1); }
            100% { top: 200%; opacity: 0; transform: translateX(-50%) scale(0.5); }
          }
        `}</style>

        {/* Separator */}
        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Right side - TV + Radio + Notifications + Profile - all same style */}
        <div className="flex items-center gap-0 -mr-1">
          {/* TV Button */}
          <button
            onClick={onTVClick}
            className={`flex flex-col items-center px-1.5 py-1 rounded-lg transition-all ${
              tvOpen ? 'bg-[#D4873A]' : 'hover:bg-cream'
            }`}
            title="BestOfGenX TV"
          >
            <Tv className={`w-6 h-6 ${tvOpen ? 'text-white' : 'text-gray-900'}`} />
            <span className={`text-[8px] font-bold tracking-wider ${tvOpen ? 'text-white' : 'text-gray-900'}`}>TV</span>
          </button>
          
          {/* Separator */}
          <div className="w-px h-6 bg-gray-300 mx-0.5" />
          
          {/* Radio Button */}
          <button
            onClick={onRadioClick}
            className={`flex flex-col items-center px-1.5 py-1 rounded-lg transition-all ${
              radioOpen ? 'bg-[#D4873A]' : 'hover:bg-cream'
            }`}
            title="BestOfGenX Radio"
          >
            <Radio className={`w-6 h-6 ${radioOpen ? 'text-white' : 'text-gray-900'}`} />
            <span className={`text-[8px] font-bold tracking-wider ${radioOpen ? 'text-white' : 'text-gray-900'}`}>RADIO</span>
          </button>
          
          {/* Separator */}
          <div className="w-px h-6 bg-gray-300 mx-0.5" />
          
          {/* Notification Bell - same style as Radio */}
          <button 
            onClick={handleNotificationClick}
            className={`flex flex-col items-center px-1.5 py-1 rounded-lg transition-all relative ${
              notificationOpen ? 'bg-[#D4873A]' : 'hover:bg-cream'
            }`}
          >
            <Bell className={`w-6 h-6 transition-colors ${
              notificationOpen 
                ? 'text-white' 
                : notificationsEnabled 
                  ? 'text-[#D4873A]' 
                  : 'text-gray-900'
            }`} />
            <span className={`text-[8px] font-bold tracking-wider ${
              notificationOpen 
                ? 'text-white' 
                : notificationsEnabled 
                  ? 'text-[#D4873A]' 
                  : 'text-gray-900'
            }`}>NEWS</span>
            {unreadCount > 0 && !notificationOpen && (
              <div className="absolute top-0 right-0.5 w-3.5 h-3.5 bg-[#D4873A] rounded-full flex items-center justify-center">
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
              profileOpen ? 'bg-[#D4873A]' : 'hover:bg-cream'
            }`}
          >
            <div className={`w-6 h-6 rounded-full overflow-hidden border ${profileOpen ? 'border-white' : 'border-gray-400'}`}>
              {userAvatar ? (
                <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${profileOpen ? 'bg-[#D4873A]' : 'bg-skeleton-light'}`}>
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
