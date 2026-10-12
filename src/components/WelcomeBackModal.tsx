"use client";

import { X, TrendingDown, TrendingUp, ChevronRight, Gift, Trophy, Target, Zap, Swords, Users, Star } from "lucide-react";
import { LEVELS } from "@/utils/levels";

export interface WelcomeBackRankChange {
  from: number;
  to: number;
  direction: "up" | "down" | "same";
}

export interface WhileAwayEvent {
  type: "overtook" | "points" | "battle" | "newPlayers" | "challenge" | "community" | "winner" | "battles" | "topBattler" | "streak" | "level" | "motivation";
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
  totalPlayers?: number;
  // Level system
  level?: number;
  levelName?: string;
  levelProgress?: number; // 0-100
  pointsToNextLevel?: number;
  onPrimaryAction: () => void;
  onClaimDailyReward?: () => void;
  onGoToBattles?: () => void;
  isDesktop?: boolean;
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
  totalPlayers = 0,
  level = 1,
  levelName = 'Newbie',
  levelProgress = 0,
  pointsToNextLevel = 0,
  onPrimaryAction,
  onClaimDailyReward,
  onGoToBattles,
  isDesktop = false,
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

  const levelColor = LEVELS[level - 1]?.color || '#E36B11';
  const nextLevelName = level < LEVELS.length ? LEVELS[level]?.name : null;

  // Build display events - ensure we always have enough content
  const displayEvents: WhileAwayEvent[] = [...whileAwayEvents];
  
  // Always add these baseline events if not already present
  if (!displayEvents.some(e => e.type === 'community') && totalPlayers > 0) {
    displayEvents.push({
      type: 'community',
      text: `You're ranked #${currentRank}`,
      highlight: `of ${totalPlayers} players`,
    });
  }
  
  // Points collected
  if (!displayEvents.some(e => e.text.includes('BOGX'))) {
    displayEvents.push({
      type: 'points',
      text: `${formatPoints(totalPoints)} BOGX collected`,
      highlight: 'total',
    });
  }
  
  // Level info
  if (!displayEvents.some(e => e.type === 'level')) {
    displayEvents.push({
      type: 'level',
      text: `Level ${level}: ${levelName}`,
      highlight: nextLevelName ? `Next: ${nextLevelName}` : 'Max level!',
    });
  }
  
  // Streak
  if (streak > 0 && !displayEvents.some(e => e.type === 'streak')) {
    displayEvents.push({
      type: 'streak',
      text: `${streak}-day streak active`,
      highlight: 'Keep going!',
    });
  }
  
  // Points to next rank
  if (pointsToNextRank > 0 && currentRank && currentRank > 1) {
    displayEvents.push({
      type: 'points',
      text: `${formatPoints(pointsToNextRank)} BOGX to rank`,
      highlight: `#${currentRank - 1}`,
    });
  }
  
  // Points earned today
  if (pointsToday > 0) {
    displayEvents.push({
      type: 'points',
      text: `+${formatPoints(pointsToday)} BOGX`,
      highlight: 'earned today',
    });
  }
  
  // Rank change info
  if (rankChange) {
    if (rankChange.direction === 'up') {
      displayEvents.push({
        type: 'overtook',
        text: `You moved up`,
        highlight: `${rankChange.from - rankChange.to} positions!`,
      });
    } else if (rankChange.direction === 'down') {
      displayEvents.push({
        type: 'overtook',
        text: `You dropped`,
        highlight: `${rankChange.to - rankChange.from} positions`,
      });
    }
  }

  // Desktop Layout
  if (isDesktop) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-8">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />
        <div className="relative w-full max-w-5xl bg-cream rounded-3xl shadow-2xl overflow-hidden border border-warm">
          {/* Close Button */}
          <button onClick={onClose} className="absolute top-5 right-5 z-10 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center transition-colors shadow-md">
            <X className="w-5 h-5 text-gray-500" />
          </button>

          <div className="flex min-h-[500px]">
            {/* LEFT COLUMN - Welcome & Branding */}
            <div className="w-[400px] flex-shrink-0 bg-gradient-to-br from-[#E36B11] via-[#D4621A] to-[#B85515] p-10 flex flex-col relative overflow-hidden">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-10 left-10 w-32 h-32 border-4 border-white rounded-full" />
                <div className="absolute bottom-20 right-5 w-24 h-24 border-4 border-white rounded-full" />
                <div className="absolute top-1/2 left-1/2 w-40 h-40 border-4 border-white rounded-full -translate-x-1/2 -translate-y-1/2" />
              </div>

              {/* Logo */}
              <div className="relative z-10 flex items-center gap-2 mb-8">
                <img src="/images/bogxcoin.png" alt="BOGX" className="w-8 h-8" />
                <span className="font-display text-white text-xl tracking-wide">BOGX</span>
              </div>

              {/* Welcome Text */}
              <div className="relative z-10 flex-1">
                <p className="text-white/70 text-sm uppercase tracking-wider mb-1">Good to have you back</p>
                <h1 className="font-display text-4xl text-white leading-tight mb-2">
                  Welcome back,<br />
                  <span className="text-5xl">{username}!</span>
                </h1>
                <p className="text-white/80 text-sm mt-4 leading-relaxed">
                  Ready to compete, improve and climb the ranks? Let's continue where you left off.
                </p>
              </div>

              {/* CTA Button - moved here */}
              <button
                onClick={onPrimaryAction}
                className="relative z-10 mt-6 w-full py-4 bg-white/20 hover:bg-white/30 text-white font-display text-xl tracking-wide rounded-xl transition-colors flex items-center justify-center gap-2 border border-white/30"
              >
                LET'S GO
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Tagline */}
              <div className="relative z-10 mt-4 pt-4 border-t border-white/20">
                <p className="text-white/80 text-xs text-center">
                  Play. Compete. Remember. <span className="font-bold text-white">That's GenX.</span>
                </p>
              </div>
            </div>

            {/* RIGHT COLUMN - Stats & Info */}
            <div className="flex-1 p-8 flex flex-col">
              {/* Rank Card */}
              <div className="bg-white rounded-2xl border border-warm p-6 mb-5 shadow-sm">
                <div className="flex items-start gap-5">
                  {/* User Avatar */}
                  <div 
                    className={`w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden border-2 ${loading ? 'animate-pulse' : ''}`}
                    style={{ backgroundColor: loading ? '#E5E7EB' : `${levelColor}20`, borderColor: loading ? '#D1D5DB' : `${levelColor}40` }}
                  >
                    {loading ? (
                      <div className="w-12 h-12 rounded-full bg-gray-300" />
                    ) : avatar ? (
                      <img src={avatar} alt={username} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl">👤</span>
                    )}
                  </div>

                  {/* Rank Info */}
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Your Rank</div>
                    {loading ? (
                      <>
                        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2" />
                        <div className="h-6 w-20 bg-gray-100 rounded animate-pulse" />
                      </>
                    ) : (
                      <>
                        <div className="font-display text-3xl tracking-wide" style={{ color: levelColor }}>{levelName.toUpperCase()}</div>
                        <div className="inline-block px-3 py-1 rounded text-xs font-bold uppercase tracking-wider mt-2" style={{ backgroundColor: `${levelColor}15`, color: levelColor }}>
                          Level {level}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Position */}
                  <div className="text-right flex-shrink-0 bg-cream rounded-2xl px-6 py-4">
                    {loading ? (
                      <>
                        <div className="h-8 w-12 bg-gray-200 rounded animate-pulse mb-1 ml-auto" />
                        <div className="h-3 w-10 bg-gray-100 rounded animate-pulse ml-auto" />
                      </>
                    ) : (
                      <>
                        <div className="font-display text-3xl text-gray-900">#{currentRank || '–'}</div>
                        <div className="text-[10px] text-gray-500 uppercase">of {totalPlayers || '–'}</div>
                      </>
                    )}
                  </div>
                </div>

                {/* LED Segment Progress Bar */}
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                    {loading ? (
                      <>
                        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                        <div className="h-4 w-8 bg-gray-200 rounded animate-pulse" />
                      </>
                    ) : (
                      <>
                        <span className="flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5" style={{ color: levelColor }} />
                          {formatPoints(totalPoints)} BOGX gesammelt
                        </span>
                        <span className="font-bold" style={{ color: levelColor }}>{levelProgress}%</span>
                      </>
                    )}
                  </div>
                  {/* LED Segments */}
                  <div className="flex gap-0.5">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div 
                        key={i}
                        className={`flex-1 h-3 rounded-sm transition-all duration-300 ${loading ? 'animate-pulse' : ''}`}
                        style={{ 
                          backgroundColor: loading ? '#E5E7EB' : (levelProgress >= (i + 1) * 5 ? levelColor : '#E5E7EB'),
                          boxShadow: !loading && levelProgress >= (i + 1) * 5 ? `0 0 4px ${levelColor}` : 'none',
                        }}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-gray-400 mt-1.5">
                    {loading ? (
                      <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
                    ) : (
                      nextLevelName ? `Noch ${formatPoints(pointsToNextLevel)} BOGX bis ${nextLevelName}` : 'Max Level erreicht!'
                    )}
                  </div>
                </div>

                {/* Level Timeline */}
                <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                  <div className="flex items-center justify-between relative">
                    {/* Connection Line */}
                    <div className="absolute top-3 left-4 right-4 h-0.5 bg-gray-200" />
                    <div 
                      className="absolute top-3 left-4 h-0.5 transition-all duration-500"
                      style={{ 
                        width: `${((level - 1) / (LEVELS.length - 1)) * 100}%`,
                        backgroundColor: levelColor 
                      }}
                    />
                    
                    {/* Level Nodes - pulse animation while loading */}
                    {LEVELS.map((l, i) => {
                      const isActive = loading ? false : i < level;
                      const isCurrent = loading ? false : i === level - 1;
                      return (
                        <div key={l.name} className="flex flex-col items-center z-10">
                          <div 
                            className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                              loading ? 'animate-pulse' : ''
                            } ${isCurrent ? 'shadow-lg' : ''}`}
                            style={{ 
                              backgroundColor: isActive ? l.color : '#E5E7EB',
                              borderColor: isActive ? l.color : '#D1D5DB',
                            }}
                          >
                            {isCurrent && <Star className="w-3 h-3 text-white" />}
                          </div>
                          <div 
                            className={`mt-1 text-[8px] font-bold uppercase tracking-wide ${loading ? 'animate-pulse' : ''}`} 
                            style={{ color: isActive ? l.color : '#9CA3AF' }}
                          >
                            {l.name.split(' ')[0]}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* While You Were Away */}
              <div className="bg-white rounded-xl border border-warm overflow-hidden flex-1 shadow-sm">
                <div className="px-4 py-2 border-b border-warm flex items-center gap-1.5 bg-cream/50">
                  <Zap className="w-3 h-3 text-[#E36B11]" />
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">While You Were Away</span>
                  <span className="ml-auto text-[10px] text-gray-400">{displayEvents.length}</span>
                </div>
                <div className="divide-y divide-gray-100/50 max-h-[240px] overflow-y-auto">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="px-4 py-1.5 flex items-center gap-2 animate-pulse">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#E36B11]/20 flex-shrink-0" />
                        <div className="flex-1 h-3 rounded bg-[#E36B11]/10" />
                      </div>
                    ))
                  ) : (
                    displayEvents.map((event, i) => (
                      <div key={i} className="px-4 py-1.5 flex items-center gap-2 hover:bg-cream/30 transition-colors">
                        {/* Tiny dot indicator */}
                        <div 
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: levelColor }}
                        />
                        {event.avatar && (
                          <img src={event.avatar} alt="" className="w-5 h-5 rounded-full object-cover border border-[#E36B11]/20 flex-shrink-0" />
                        )}
                        <p className="flex-1 min-w-0 text-xs text-gray-600">
                          {event.text}
                          {event.highlight && <span className="font-semibold text-[#E36B11]"> {event.highlight}</span>}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Battle Alerts - compact */}
              {hasBattleAlerts && (
                <button
                  onClick={() => { onGoToBattles?.(); onClose(); }}
                  className="mt-3 w-full rounded-lg bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] border border-[#E36B11]/40 px-3 py-2 flex items-center gap-3 hover:border-[#E36B11] transition-all group"
                >
                  <div className="relative flex-shrink-0">
                    <Swords className="w-5 h-5 text-[#E36B11]" />
                    <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 bg-red-500 rounded-full flex items-center justify-center text-white text-[8px] font-bold animate-pulse">
                      {pendingChallengeCount + activeBattleCount}
                    </span>
                  </div>
                  <p className="flex-1 text-left text-xs text-white">
                    {pendingChallengeCount > 0 && `${pendingChallengeCount} challenge${pendingChallengeCount > 1 ? 's' : ''}`}
                    {pendingChallengeCount > 0 && activeBattleCount > 0 && ' · '}
                    {activeBattleCount > 0 && `${activeBattleCount} active`}
                    <span className="text-[#E36B11] ml-1">→</span>
                  </p>
                </button>
              )}

              {/* Leader Info - compact */}
              {!hasBattleAlerts && currentLeader && currentLeader !== username && (
                <div className="mt-3 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/50 px-3 py-2 flex items-center gap-2">
                  <span className="text-sm">👑</span>
                  <p className="text-xs text-gray-700"><span className="font-semibold text-[#E36B11]">{currentLeader}</span> leads today</p>
                </div>
              )}

              {/* You are the leader */}
              {currentLeader && currentLeader === username && (
                <div className="mt-3 rounded-lg bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200/50 px-3 py-2 flex items-center gap-2">
                  <span className="text-sm">👑</span>
                  <p className="text-xs font-bold text-emerald-700">You're the leader! Defend your crown.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mobile Layout (original)
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
