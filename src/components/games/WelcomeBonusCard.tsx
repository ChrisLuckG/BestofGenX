"use client";

import { useState } from "react";
import { sounds } from "@/utils/sounds";
import { ChevronUp, Zap, Timer, Trophy, Star, Gift } from "lucide-react";

interface WelcomeBonusCardProps {
  onClaim: (amount: number) => void;
  nextCardTheme?: string;
}

export default function WelcomeBonusCard({ onClaim, nextCardTheme }: WelcomeBonusCardProps) {
  const [claimed, setClaimed] = useState(false);
  const bonusAmount = 500;

  const handleClaim = () => {
    sounds.claim();
    if (claimed) return;
    setClaimed(true);
    onClaim(bonusAmount);
  };

  return (
    <div 
      className="w-full h-full flex flex-col px-3 pb-2 pt-4 relative" 
      style={{ backgroundColor: '#000000' }}
    >
      {/* Main Card with border - turns green when claimed */}
      <div className={`flex-1 w-full border overflow-hidden flex flex-col relative min-h-0 transition-all duration-500 ${claimed ? 'border-green-500/50' : 'border-white/20'}`} style={{ backgroundColor: '#0a0a0a' }}>
        
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src="/images/hinter.png" 
            alt=""
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 from-30% via-black/50 via-60% to-transparent to-100%" />
        </div>
        
        {/* Top Badges - turn green when claimed */}
        <div className="relative z-10 px-4 pt-3 flex items-center justify-between shrink-0">
          <div className={`flex items-center gap-2 px-3 py-1 border transition-all duration-500 ${claimed ? 'bg-green-500/10 border-green-500/30' : 'bg-black/40 border-white/20'}`}>
            <span className={`text-[10px] uppercase tracking-[0.2em] transition-colors duration-500 ${claimed ? 'text-green-400' : 'text-white/80'}`}>Welcome</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1 border transition-all duration-500 ${claimed ? 'bg-green-500/10 border-green-500/30' : 'bg-black/40 border-white/20'}`}>
            <span className={`text-[10px] uppercase tracking-[0.2em] transition-colors duration-500 ${claimed ? 'text-green-400' : 'text-[#E36B11]'}`}>Bonus</span>
          </div>
        </div>

        {/* Content - no scroll */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-1 min-h-0 overflow-hidden">
          <p className="text-[9px] uppercase tracking-[0.35em] text-white/50 mb-1 shrink-0">Welcome to the</p>
          <h1 className={`font-display text-[44px] leading-[0.9] text-center mb-2 shrink-0 transition-colors duration-500 tracking-wide ${claimed ? 'text-green-400' : 'text-[#E36B11]'}`}>
            DAILY<br />CHALLENGE
          </h1>
          
          <p className="text-[12px] text-white/75 text-center mb-3 leading-relaxed max-w-[280px] shrink-0">
            Test your retro knowledge across Music, Movies, TV, Gaming & Sports — 80s, 90s and early 2000s.
          </p>

          {/* How it works container */}
          <div className="w-full max-w-[300px] border border-white/20 bg-black/40 backdrop-blur-md p-3 mb-3 shrink-0">
            <p className="text-[9px] uppercase tracking-[0.25em] text-white/50 text-center mb-2">How it works</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Zap className={`w-4 h-4 shrink-0 transition-colors duration-500 ${claimed ? 'text-green-400' : 'text-[#E36B11]'}`} />
                <p className="text-[13px] text-white/90">Choose your difficulty</p>
              </div>
              <div className="flex items-center gap-3">
                <Timer className={`w-4 h-4 shrink-0 transition-colors duration-500 ${claimed ? 'text-green-400' : 'text-[#E36B11]'}`} />
                <p className="text-[13px] text-white/90">Answer fast for more BOGX</p>
              </div>
              <div className="flex items-center gap-3">
                <Trophy className={`w-4 h-4 shrink-0 transition-colors duration-500 ${claimed ? 'text-green-400' : 'text-[#E36B11]'}`} />
                <p className="text-[13px] text-white/90">Compete in the daily rankings</p>
              </div>
            </div>
          </div>

          {/* Bonus - clickable */}
          {!claimed ? (
            <button
              onClick={handleClaim}
              className="group shrink-0 w-full px-6"
            >
              <div className="border-2 border-[#E36B11] bg-[#E36B11]/10 px-6 py-2 transition-all active:bg-[#E36B11]/20 active:scale-[0.98]">
                <p className="text-[8px] uppercase tracking-[0.25em] text-[#E36B11] text-center mb-0.5">Tap to claim</p>
                <p className="font-display text-[32px] leading-none text-[#E36B11] text-center">
                  +{bonusAmount} <span className="text-[12px] tracking-[0.2em]">PTS</span>
                </p>
              </div>
            </button>
          ) : (
            <div className="w-full px-6 shrink-0">
              <div className="border-2 border-green-500 bg-[#00C44E]/30 px-6 py-2">
                <p className="text-[8px] uppercase tracking-[0.25em] text-green-400 text-center mb-0.5">Claimed ✓</p>
                <p className="font-display text-[32px] leading-none text-green-400 text-center">
                  +{bonusAmount} <span className="text-[12px] tracking-[0.2em]">PTS</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Swipe Indicator OUTSIDE card */}
      <div className="pt-3 pb-2 flex flex-col items-center shrink-0">
        {claimed ? (
          <div className="flex flex-col items-center animate-bounce">
            <div className="flex flex-col items-center" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
              <ChevronUp className="w-7 h-7 text-[#E36B11]" />
              <ChevronUp className="w-7 h-7 -mt-5 text-[#E36B11]/70" />
            </div>
            <span className="text-[11px] uppercase tracking-[0.25em] mt-1 text-[#E36B11] font-medium">Swipe up to begin</span>
          </div>
        ) : (
          <div className="flex flex-col items-center text-[#E36B11] animate-pulse">
            <span className="text-[10px] uppercase tracking-[0.25em]">Claim your bonus to start</span>
          </div>
        )}
      </div>
    </div>
  );
}
