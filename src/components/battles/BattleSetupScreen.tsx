"use client";

import { Users, Clock, Trophy, Target, Zap, RefreshCcw, Shield, Swords } from "lucide-react";
import BackButton from "@/components/BackButton";
import { incrementGamePlayCount } from "@/utils/gameIntro";

interface BattleSetupScreenProps {
  user?: { avatar?: string };
  onlinePlayers: number;
  onlineLoading: boolean;
  onBack?: () => void;
  onStartBattle: () => void;
}

export default function BattleSetupScreen({
  user,
  onlinePlayers,
  onlineLoading,
  onBack,
  onStartBattle,
}: BattleSetupScreenProps) {
  return (
    <div className="flex flex-col h-full min-h-full flex-1" style={{ backgroundColor: '#F5F0E8' }}>
      {/* Header with Online Players */}
      <div className="px-4 pt-4 pb-3 border-b border-warm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onBack && <BackButton onClick={onBack} className="-ml-1" />}
            <div>
              <span className="font-display text-lg tracking-wider text-gray-900">QUIZZBATTLE</span>
              <p className="text-[10px] text-gray-500 -mt-0.5">Challenge players, win their wager.</p>
            </div>
          </div>
          {/* Online Players Indicator */}
          <div className="flex items-center gap-2 bg-cream border border-warm px-3 py-1.5 rounded-full">
            <div className="relative">
              <img src={user?.avatar || '/images/default-avatar.png'} alt="" className="w-6 h-6 rounded-full border-2 border-white" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
            </div>
            {onlineLoading ? (
              <div className="w-6 h-4 bg-gray-300 rounded animate-pulse" />
            ) : (
              <span className="text-xs font-bold text-gray-700">{onlinePlayers.toLocaleString()}</span>
            )}
            <span className="text-[10px] text-gray-500 uppercase">Online</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: 'none' }}>
        {/* Hero Banner */}
        <div 
          className="relative overflow-hidden bg-cover bg-center rounded-2xl"
          style={{ backgroundImage: "url('/images/Hintergund/battle.png')", minHeight: '240px' }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          <div className="relative px-6 py-8">
            <span className="inline-block px-3 py-1 bg-[#A855F7] text-white font-bold uppercase tracking-wider rounded-full mb-4 text-[10px]">
              Multiplayer
            </span>
            <h2 className="font-display text-white leading-tight mb-2 text-2xl md:text-3xl">
              CHALLENGE PLAYERS<br/>
              <span className="text-[#A855F7]">WIN THEIR WAGER</span>
            </h2>
            <div className="flex items-center gap-2 mt-4 text-white/90 text-[10px]">
              <span className="flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-full"><Users className="w-3 h-3" /> 3 or 5 Rounds</span>
              <span className="flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-full"><Clock className="w-3 h-3" /> 10 Sec</span>
              <span className="flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-full"><Trophy className="w-3 h-3" /> High Score Wins</span>
            </div>
          </div>
        </div>

        {/* Start Button */}
        <div className="flex justify-center mt-6">
          <button
            onClick={() => {
              incrementGamePlayCount("quizzbattle");
              onStartBattle();
            }}
            className="px-20 py-4 rounded-2xl text-white font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #C084FC 0%, #A855F7 50%, #9333EA 100%)' }}
          >
            <Swords className="w-5 h-5" />
            START BATTLE
          </button>
        </div>

        {/* Fair Play */}
        <div className="flex items-center justify-center gap-3 mt-4 text-xs text-gray-500 pb-4">
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-green-500" />
            Fair play guaranteed
          </span>
          <span className="text-gray-400">•</span>
          <span className="flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5 text-[#A855F7]" />
            Winner takes 2x wager
          </span>
          <span className="text-gray-400">•</span>
          <span className="flex items-center gap-1">
            <RefreshCcw className="w-3.5 h-3.5 text-[#A855F7]" />
            Tie = coins back
          </span>
        </div>
      </div>
    </div>
  );
}
