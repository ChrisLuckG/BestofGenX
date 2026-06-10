"use client";

import { useState } from "react";
import { Play, Coins, Check } from "lucide-react";
import GenXLoader from "./GenXLoader";

interface RewardedAdButtonProps {
  onReward: (points: number) => void;
  disabled?: boolean;
}

const REWARD_POINTS = 50;
const COOLDOWN_SECONDS = 60; // 1 minute between ads

export default function RewardedAdButton({ onReward, disabled }: RewardedAdButtonProps) {
  const [isWatching, setIsWatching] = useState(false);
  const [isRewarded, setIsRewarded] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const handleWatchAd = async () => {
    if (isWatching || cooldown > 0 || disabled) return;

    setIsWatching(true);

    // TODO: Replace with real AdSense/AdMob integration
    // For now, simulate watching an ad (3 seconds)
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Give reward
    onReward(REWARD_POINTS);
    setIsWatching(false);
    setIsRewarded(true);

    // Start cooldown
    setCooldown(COOLDOWN_SECONDS);
    const interval = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsRewarded(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <button
      onClick={handleWatchAd}
      disabled={isWatching || cooldown > 0 || disabled}
      className={`w-full p-4  border transition-all flex items-center justify-between ${
        isRewarded
          ? 'bg-green-500/20 border-green-500/50'
          : cooldown > 0
            ? 'bg-cream/5 border-white/10 opacity-50'
            : 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/30 hover:border-yellow-500/50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12  flex items-center justify-center ${
          isRewarded ? 'bg-green-500/30' : 'bg-yellow-500/30'
        }`}>
          {isWatching ? (
            <GenXLoader size="md" />
          ) : isRewarded ? (
            <Check className="w-6 h-6 text-green-400" />
          ) : (
            <Play className="w-6 h-6 text-yellow-400" />
          )}
        </div>
        <div className="text-left">
          <p className="text-white font-bold text-sm">
            {isWatching ? 'Watching Ad...' : isRewarded ? 'Reward Claimed!' : 'Watch Ad for Bonus'}
          </p>
          <p className="text-white/50 text-xs">
            {cooldown > 0 
              ? `Available in ${cooldown}s` 
              : isWatching 
                ? 'Please wait...'
                : 'Short video = free points!'
            }
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-1 px-3 py-1.5 bg-yellow-500/20 rounded-lg">
        <Coins className="w-4 h-4 text-yellow-400" />
        <span className="text-yellow-400 font-bold text-sm">+{REWARD_POINTS}</span>
      </div>
    </button>
  );
}
