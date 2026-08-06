"use client";

import { X, TrendingDown, TrendingUp, ChevronRight, Gift, Trophy, Target, Zap, Swords, Users, Star } from "lucide-react";
import { LEVELS } from "@/utils/levels";

export interface WelcomeBackRankChange {
  from: number;
  to: number;
  direction: "up" | "down" | "same";
}

export interface WhileAwayEvent {
  type: "overtook" | "points" | "battle" | "newPlayers" | "challenge";
  icon?: string;
  avatar?: string;
  text: string;
  highlight?: string;
}

interface WelcomeBackModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading?: boolean;
  username: string;
  avatar?: string;
  currentRank: number | null;
  rankChange: WelcomeBackRankChange | null;
  totalPoints?: number;
  pointsToday?: number;
  pointsToNextRank?: number;
  nextRankPosition?: number;
  streak?: number;
  whileAwayEvents?: WhileAwayEvent[];
  lastSeenAt?: string | null;
  dailyRewardReady?: boolean;
  pendingChallengeCount?: number;
  activeBattleCount?: number;
  currentLeader?: string | null;
  // Level system
  level?: number;
  levelName?: string;
  levelProgress?: number; // 0-100
  pointsToNextLevel?: number;
  onPrimaryAction: () => void;
  onClaimDailyReward?: () => void;
  onGoToBattles?: () => void;
}

export default function WelcomeBackModal({
  isOpen,
  onClose,
  loading = false,
  username,
  avatar,
  currentRank,
  rankChange,
  totalPoints = 0,
  pointsToday = 0,
  pointsToNextRank = 0,
  nextRankPosition,
  streak = 0,
  whileAwayEvents = [],
  lastSeenAt,
  dailyRewardReady = false,
  pendingChallengeCount = 0,
  activeBattleCount = 0,
  currentLeader,
  level = 1,
  levelName = 'Newbie',
  levelProgress = 0,
  pointsToNextLevel = 0,
  onPrimaryAction,
  onClaimDailyReward,
  onGoToBattles,
}: WelcomeBackModalProps) {
  const hasBattleAlerts = pendingChallengeCount > 0 || activeBattleCount > 0;
  const progressToNext = pointsToNextRank > 0 ? Math.min(100, Math.round((pointsToday / pointsToNextRank) * 100)) : 0;

  // Format points nicely: 2,460 or 9.48 (max 2 decimals)
  const formatPoints = (n: number) => {
    if (n >= 1000) return Math.round(n).toLocaleString();
    if (Number.isInteger(n)) return n.toLocaleString();
    return n.toFixed(2).replace(/\.?0+$/, '');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />
      <div className="relative w-full max-w-lg bg-cream rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col border border-warm">
        {/* Hero Header - Welcome */}
        <div className="relative bg-gradient-to-br from-[#E36B11] via-[#E5A55A] to-[#E36B11] px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {avatar ? (
                <img src={avatar} alt={username} className="w-16 h-16 rounded-xl object-cover border-3 border-white/30 shadow-lg" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center border-3 border-white/30 shadow-lg">
                  <span className="text-3xl">👤</span>
                </div>
              )}
            </div>
            
            {/* User Info */}
            <div className="flex-1 text-white min-w-0">
              <p className="text-white/80 text-xs">Welcome back,</p>
              <h2 className="text-xl font-bold truncate">{username}!</h2>
            </div>
            
            {/* Rank Box */}
            <div className="flex-shrink-0 bg-white/20 rounded-xl px-3 py-2 text-center">
              <Trophy className="w-4 h-4 text-white mx-auto mb-0.5" />
              <div className="text-[8px] text-white/70 uppercase">Rank</div>
              <div className="font-display text-xl text-white leading-none">#{currentRank || '–'}</div>
            </div>
          </div>
          
          {/* Streak Badge */}
          {streak > 0 && (
            <div className="absolute top-3 right-12 px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full flex items-center gap-1">
              <span className="text-sm">🔥</span>
              <span className="text-white text-[10px] font-bold">{streak}</span>
            </div>
          )}
        </div>
        
        {/* Level Card - same as Rankings */}
        {(() => {
          const levelColor = LEVELS[level - 1]?.color || '#E36B11';
          const nextLevelName = level < LEVELS.length ? LEVELS[level]?.name : null;
          
          return (
            <div className="mx-4 mt-3 mb-2 rounded-xl border border-[#E36B11]/20 bg-cream overflow-hidden shadow-sm">
              {/* Level Header */}
              <div className="px-4 py-3 flex items-center gap-4">
                {/* Level Name + Badge */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-display text-lg tracking-wide" style={{ color: levelColor }}>{levelName.toUpperCase()}</div>
                    <div className="px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider" style={{ borderColor: levelColor, color: levelColor }}>
                      Level {level}
                    </div>
                  </div>
                  
                  {/* LED Segment Progress Bar - Full Width */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 flex gap-0.5">
                      {Array.from({ length: 20 }).map((_, i) => {
                        const segmentProgress = (i + 1) * 5;
                        const isActive = levelProgress >= segmentProgress;
                        return (
                          <div 
                            key={i}
                            className="flex-1 h-3 rounded-sm transition-all duration-300"
                            style={{ 
                              backgroundColor: isActive ? levelColor : '#E5E7EB',
                              boxShadow: isActive ? `0 0 4px ${levelColor}` : 'none',
                            }}
                          />
                        );
                      })}
                    </div>
                    <span className="text-xs font-bold text-gray-600">{levelProgress}%</span>
                  </div>
                  
                  {/* BOGX Info */}
                  <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-gray-600">
                    <Star className="w-3 h-3" style={{ color: levelColor }} />
                    <span>{formatPoints(totalPoints)} BOGX gesammelt</span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    {nextLevelName ? `Noch ${formatPoints(pointsToNextLevel)} BOGX bis zum nächsten Rang` : 'Max Level erreicht!'}
                  </div>
                </div>
              </div>
              
              {/* Level Timeline with LEDs */}
              <div className="px-4 py-3 border-t border-dashed border-[#E36B11]/20 bg-white/30">
                <div className="flex items-center justify-between relative">
                  {/* Connection Line */}
                  <div className="absolute top-3 left-4 right-4 h-0.5 bg-gray-300" />
                  <div 
                    className="absolute top-3 left-4 h-0.5 transition-all duration-500"
                    style={{ 
                      width: `${((level - 1) / (LEVELS.length - 1)) * 100}%`,
                      backgroundColor: levelColor 
                    }}
                  />
                  
                  {/* Level Nodes */}
                  {LEVELS.map((l, i) => {
                    const isActive = i < level;
                    const isCurrent = i === level - 1;
                    return (
                      <div key={l.name} className="flex flex-col items-center z-10">
                        {/* LED Circle */}
                        <div 
                          className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                            isCurrent ? 'shadow-lg' : ''
                          }`}
                          style={{ 
                            backgroundColor: isActive ? l.color : '#E5E7EB',
                            borderColor: isActive ? l.color : '#D1D5DB',
                          }}
                        >
                          {isCurrent && <Star className="w-3 h-3 text-white" />}
                        </div>
                        {/* Label */}
                        <div className="mt-1.5 text-center">
                          <div 
                            className="text-[8px] font-bold uppercase tracking-wide"
                            style={{ color: isActive ? l.color : '#6B7280' }}
                          >
                            {l.name.split(' ')[0]}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-3">
          {/* While You Were Away */}
          <div className="bg-cream rounded-xl border border-warm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-warm flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#E36B11]" />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">While You Were Away</span>
            </div>
            <div className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-[#E36B11]/10 flex-shrink-0" />
                    <div className="flex-1 h-3.5 rounded bg-[#E36B11]/10" />
                  </div>
                ))
              ) : whileAwayEvents.length > 0 ? (
                whileAwayEvents.slice(0, 6).map((event, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                    {event.avatar ? (
                      <img src={event.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-[#E36B11]/20" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#E36B11]/10 flex items-center justify-center text-base">
                        {event.icon || '📢'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700">
                        {event.text}
                        {event.highlight && <span className="font-bold text-[#E36B11]"> {event.highlight}</span>}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-4 text-center text-gray-500">
                  <p className="text-sm">No updates{lastSeenAt ? ` since ${new Date(lastSeenAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}` : ''}</p>
                  <p className="text-xs mt-1">Your rank is stable</p>
                </div>
              )}
            </div>
          </div>

          {/* Battle Alerts */}
          {hasBattleAlerts && (
            <button
              onClick={() => { onGoToBattles?.(); onClose(); }}
              className="w-full rounded-xl bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] border border-[#E36B11]/40 p-4 flex items-center gap-4 hover:border-[#E36B11] transition-all group"
            >
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-xl bg-[#E36B11]/20 flex items-center justify-center">
                  <Swords className="w-6 h-6 text-[#E36B11]" />
                </div>
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-lg animate-pulse">
                  {pendingChallengeCount + activeBattleCount}
                </span>
              </div>
              <div className="flex-1 text-left">
                {pendingChallengeCount > 0 && (
                  <p className="text-white font-semibold text-sm">
                    ⚔️ {pendingChallengeCount === 1 ? "1 battle challenge" : `${pendingChallengeCount} battle challenges`} waiting!
                  </p>
                )}
                {activeBattleCount > 0 && (
                  <p className={`font-semibold text-sm ${pendingChallengeCount > 0 ? 'text-white/70' : 'text-white'}`}>
                    🎯 {activeBattleCount === 1 ? "1 active battle" : `${activeBattleCount} active battles`} to play
                  </p>
                )}
                <p className="text-[#E36B11] text-xs mt-0.5 group-hover:underline">Tap to open Arcade →</p>
              </div>
            </button>
          )}

          {/* No battles - show leader info instead */}
          {!hasBattleAlerts && currentLeader && currentLeader !== username && (
            <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/50 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E36B11]/20 flex items-center justify-center flex-shrink-0">
                <span className="text-lg">👑</span>
              </div>
              <div>
                <p className="text-sm text-gray-700">
                  <span className="font-bold text-[#E36B11]">{currentLeader}</span> is today's leader
                </p>
                <p className="text-xs text-gray-500">Can you take the crown?</p>
              </div>
            </div>
          )}

          {/* You are the leader! */}
          {currentLeader && currentLeader === username && (
            <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200/50 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <span className="text-lg">👑</span>
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-700">You're the leader!</p>
                <p className="text-xs text-gray-500">Defend your crown today</p>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 flex-shrink-0 border-t border-warm/50">
          <button
            onClick={onPrimaryAction}
            className="w-full py-3.5 bg-[#E36B11] hover:bg-[#C4772A] text-white font-bold rounded-xl text-sm transition-colors shadow-md"
          >
            LET'S GO!
          </button>
          <p className="text-center text-xs text-gray-400 mt-2">
            Play. Compete. Remember. <span className="text-[#E36B11] font-medium">That's GenX.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
