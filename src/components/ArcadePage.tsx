"use client";

import { useState, useEffect } from "react";
import { Users, User, HelpCircle, Trophy, BarChart3, Coins, Zap, Play, Swords } from "lucide-react";
import OpenBattlesModal from "./OpenBattlesModal";

interface ArcadePageProps {
  onSelectGame: (game: 'quizzbattle' | 'trivia' | 'spacegenx' | 'memory' | 'prediction' | 'genxmen' | 'nextplay' | 'faceblur' | 'bogxinvaders') => void;
  onShowRankings?: () => void;
  onShowBattles?: () => void;
  battleAlertCount?: number;
  userId?: string;
  onCoinsChange?: (amount: number) => void;
  onPlaySpecificBattle?: (battleId: string) => void;
}

export default function ArcadePage({ onSelectGame, onShowRankings, onShowBattles, battleAlertCount = 0, userId, onCoinsChange, onPlaySpecificBattle }: ArcadePageProps) {
  const [showOpenBattles, setShowOpenBattles] = useState(false);
  const [liveBattleCount, setLiveBattleCount] = useState(battleAlertCount);
  const [onlinePlayers, setOnlinePlayers] = useState(0);
  const [onlineLoading, setOnlineLoading] = useState(true);

  // Fetch online players count
  useEffect(() => {
    fetch('/api/users/online')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setOnlinePlayers(data.count || data.users?.length || 0);
        }
        setOnlineLoading(false);
      })
      .catch(() => setOnlineLoading(false));
  }, []);

  // Fetch live battle count every time arcade is shown — independent of bottom nav badge
  const refreshBattleCount = () => {
    if (!userId) return;
    fetch(`/api/battles?userId=${userId}&countOnly=true`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setLiveBattleCount((data.pendingChallenges ?? 0) + (data.activeBattles ?? 0) + (data.myOpenBattles ?? 0));
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    refreshBattleCount();
  }, [userId]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-cream">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#E36B11]/5 to-transparent">
        <div className="flex items-center gap-3">
          <img src="/images/Icon/trivia2.png" alt="" className="w-5 h-5 object-contain" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">Trivia</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">Test your GenX knowledge!</span>
          </div>
          {/* Open battles button - right side */}
          <button
            onClick={() => userId ? setShowOpenBattles(true) : onShowBattles?.()}
            className="ml-auto relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#A855F7]/40 bg-[#A855F7]/10 hover:bg-[#A855F7]/20 transition-colors"
          >
            <Swords className="w-4 h-4 text-[#A855F7]" />
            <span className="text-xs font-bold text-[#A855F7]">Open Battles</span>
            {liveBattleCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] font-black shadow animate-pulse">
                {liveBattleCount > 9 ? '9+' : liveBattleCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Open Battles Popup */}
      {userId && (
        <OpenBattlesModal
          isOpen={showOpenBattles}
          onClose={() => { setShowOpenBattles(false); refreshBattleCount(); }}
          userId={userId}
          onPlayBattle={(battleId) => { setShowOpenBattles(false); onPlaySpecificBattle?.(battleId) || onSelectGame('quizzbattle'); }}
          onCoinsChange={onCoinsChange}
          accentColor="purple"
        />
      )}

      {/* Split Layout - Two Game Cards */}
      <div className="flex-1 flex flex-col px-4 py-4 gap-4" style={{ scrollbarWidth: 'none' }}>
        
        {/* QuizzBattle - Multiplayer Banner with full info */}
        <button
          onClick={() => onSelectGame('quizzbattle')}
          className="w-full relative overflow-hidden rounded-2xl shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] bg-cover bg-center"
          style={{ backgroundImage: "url('/images/Hintergund/battle.png')", minHeight: '220px' }}
        >
          {/* Left fade for text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent" />

          {/* Online Players Badge - top right */}
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-2 py-1 rounded-full z-10">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            {onlineLoading ? (
              <div className="w-4 h-3 bg-white/30 rounded animate-pulse" />
            ) : (
              <span className="text-[10px] font-bold text-white">{onlinePlayers}</span>
            )}
            <span className="text-[8px] text-white/80 uppercase">Online</span>
          </div>

          <div className="relative h-full flex flex-col justify-center items-start text-left px-4 py-3 max-w-[72%]">
            {/* Badge */}
            <div className="inline-flex items-center gap-1 bg-black/50 backdrop-blur-sm border border-white/20 text-white text-[7px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              <Users className="w-2.5 h-2.5" />
              Multiplayer
            </div>

            {/* Title */}
            <h3 className="font-display text-[28px] leading-none tracking-wide mt-2">
              <span className="text-white">QUIZZ</span><span className="text-[#A855F7]">BATTLE</span>
            </h3>

            {/* Subtitle */}
            <p className="text-white text-[11px] font-semibold leading-tight mt-1">
              Challenge real players. <span className="text-[#A855F7]">Winner takes 2x wager!</span>
            </p>

            {/* Features */}
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3 text-[#A855F7]" />
                <span className="text-white/90 text-[9px] font-medium">3-5 Rounds</span>
              </div>
              <div className="w-px h-4 bg-white/25" />
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-[#A855F7]" />
                <span className="text-white/90 text-[9px] font-medium">10 Sec</span>
              </div>
              <div className="w-px h-4 bg-white/25" />
              <div className="flex items-center gap-1">
                <Trophy className="w-3 h-3 text-[#A855F7]" />
                <span className="text-white/90 text-[9px] font-medium">High Score Wins</span>
              </div>
            </div>

            {/* Wager Options */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-white/60 text-[8px] uppercase font-semibold">Wagers:</span>
              <div className="flex items-center gap-1">
                {[0.10, 0.25, 0.50, 0.75, 1.00].map((w) => (
                  <span key={w} className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#A855F7]/30 text-white border border-[#A855F7]/50">
                    {w.toFixed(2)}
                  </span>
                ))}
              </div>
            </div>

            {/* Play Now + Tie info */}
            <div className="flex items-center gap-3 mt-2.5">
              <div className="flex items-center gap-1.5 bg-[#A855F7] px-3 py-1.5 rounded-lg">
                <span className="text-white text-[10px] font-bold">PLAY NOW</span>
                <span className="w-3.5 h-3.5 rounded-full bg-white/20 flex items-center justify-center">
                  <Play className="w-2 h-2 text-white fill-white ml-0.5" />
                </span>
              </div>
              <span className="text-white/50 text-[8px]">Tie = coins back</span>
            </div>
          </div>
        </button>

        {/* Solo Trivia - Single Player Banner */}
        <button
          onClick={() => onSelectGame('trivia')}
          className="w-full relative overflow-hidden rounded-2xl shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] bg-cover bg-center"
          style={{ backgroundImage: "url('/images/Hintergund/solo.png')", minHeight: '220px' }}
        >
          {/* Left fade for text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent" />

          {/* Badge - top right */}
          <div className="absolute top-2 right-2 inline-flex items-center gap-1 bg-black/50 backdrop-blur-sm border border-white/20 text-white text-[7px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider z-10">
            <User className="w-2.5 h-2.5" />
            Single Player
          </div>

          <div className="relative h-full flex flex-col justify-center items-start text-left px-4 py-3 max-w-[70%]">
            {/* Title */}
            <h3 className="font-display text-[30px] leading-none tracking-wide mt-2">
              <span className="text-white">SOLO</span> <span className="text-[#E36B11]">TRIVIA</span>
            </h3>

            {/* Subtitle */}
            <p className="text-white text-[12px] font-semibold leading-tight mt-1.5">
              +0.30 per correct.<br />
              <span className="text-[#E5A55A]">-0.03 per wrong.</span>
            </p>

            {/* Features - 2 lines max like QuizzBattle */}
            <div className="flex items-center gap-3 mt-2.5">
              <div className="flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-[#E5A55A] flex-shrink-0" />
                <span className="text-white/90 text-[10px] font-medium leading-tight">10 or 20<br/>Questions</span>
              </div>
              <div className="w-px h-6 bg-white/25 flex-shrink-0" />
              <div className="flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-[#E5A55A] flex-shrink-0" />
                <span className="text-white/90 text-[10px] font-medium">+0.30<br/><span className="whitespace-nowrap">Per Correct</span></span>
              </div>
              <div className="w-px h-6 bg-white/25 flex-shrink-0" />
              <div className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-[#E5A55A] flex-shrink-0" />
                <span className="text-white/90 text-[10px] font-medium leading-tight">Beat the<br/>Clock</span>
              </div>
            </div>

            {/* Play Now */}
            <div className="flex items-center gap-2 mt-3 bg-[#E36B11] px-4 py-1.5 rounded-lg">
              <span className="text-white text-[11px] font-bold">PLAY NOW</span>
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                <Play className="w-2 h-2 text-white fill-white ml-0.5" />
              </span>
            </div>
          </div>
        </button>

      </div>
    </div>
  );
}
