"use client";

import { useState, useEffect } from "react";
import { Gift, Sparkles, Coins, PartyPopper } from "lucide-react";

interface SurpriseReelProps {
  onComplete?: (reward: number) => void;
}

export default function SurpriseReel({ onComplete }: SurpriseReelProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);
  
  const reward = 500;

  const handleClaim = () => {
    if (!hasClaimed) {
      setIsRevealed(true);
      setShowConfetti(true);
      setHasClaimed(true);
      onComplete?.(reward);
    }
  };

  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Fullscreen Background Image */}
      <img 
        src="https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800"
        alt="Celebration"
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {/* Dark Overlay with Gold Tint */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#00003C] via-[#00003C]/80 to-yellow-900/40" />

      {/* Sparkle Effects */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 animate-ping">
            <Sparkles className="w-6 h-6 text-yellow-400" />
          </div>
          <div className="absolute top-1/3 right-1/4 animate-ping delay-100">
            <Sparkles className="w-4 h-4 text-yellow-300" />
          </div>
          <div className="absolute top-1/2 left-1/3 animate-ping delay-200">
            <Sparkles className="w-5 h-5 text-yellow-500" />
          </div>
          <div className="absolute bottom-1/3 right-1/3 animate-ping delay-300">
            <Sparkles className="w-6 h-6 text-yellow-400" />
          </div>
        </div>
      )}

      {/* Content Overlay */}
      <div className="relative z-10 w-full h-full flex flex-col">
        {/* Top Badge */}
        <div className="px-3 pt-5 pb-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/30 backdrop-blur-sm rounded-full border border-yellow-500/50">
            <Gift className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-bold text-yellow-400">SURPRISE!</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 rounded-full">
            <Coins className="w-4 h-4 text-white" />
            <span className="text-sm font-black text-white">+{reward}</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          {!isRevealed ? (
            // Claim State - User must click to claim
            <div className="text-center">
              <button
                onClick={handleClaim}
                className="w-32 h-32 rounded-full bg-yellow-500/30 border-4 border-yellow-500 flex items-center justify-center mb-6 hover:scale-110 transition-all cursor-pointer hover:bg-yellow-500/50"
              >
                <Gift className="w-16 h-16 text-yellow-400" />
              </button>
              <h2 className="text-2xl font-black text-white mb-2">Surprise!</h2>
              <p className="text-white/60 mb-4">Tap the gift!</p>
              <p className="text-yellow-400 font-bold animate-pulse">🎁 Open now!</p>
            </div>
          ) : (
            // Revealed State
            <div className="text-center">
              <div className="w-32 h-32 rounded-full bg-yellow-500/30 border-4 border-yellow-500 flex items-center justify-center mb-6 animate-bounce">
                <PartyPopper className="w-16 h-16 text-yellow-400" />
              </div>
              <h2 className="text-3xl font-black text-yellow-400 mb-2">JACKPOT!</h2>
              <p className="text-white text-xl font-bold mb-4">You won!</p>
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-yellow-500/20 border-2 border-yellow-500 ">
                <Coins className="w-10 h-10 text-yellow-400" />
                <span className="text-yellow-400 font-black text-4xl">+{reward}</span>
              </div>
              <p className="text-white/60 text-sm mt-4">Congratulations! Bonus points have been credited.</p>
            </div>
          )}
        </div>

        {/* Bottom Info */}
        <div className="flex-shrink-0 p-4 pt-0">
          <div className="bg-yellow-500/20 backdrop-blur-sm border border-yellow-500/50  p-3">
            <div className="flex items-center justify-center gap-3">
              <Sparkles className="w-6 h-6 text-yellow-400" />
              <div className="text-center">
                <p className="text-yellow-400 font-bold text-sm">Rare Bonus!</p>
                <p className="text-white/60 text-[10px]">You're lucky - this reel appears rarely!</p>
              </div>
              <Sparkles className="w-6 h-6 text-yellow-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
