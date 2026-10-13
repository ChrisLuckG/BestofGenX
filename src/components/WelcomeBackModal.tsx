"use client";

import { useEffect, useState } from "react";
import { X, TrendingDown, TrendingUp, ChevronRight, Gift, Trophy, Target, Zap, Swords, Users, Star } from "lucide-react";
import { LEVELS } from "@/utils/levels";
import { getCategoryLabel, getTopicColor } from "@/lib/categories";
import ModalPortal from "./ModalPortal";
import CountUpNumber from "./CountUpNumber";
import LoadingDots from "./LoadingDots";

type InboxPerson = { username: string; avatar?: string; countryFlag?: string; isBot?: boolean } | null;
type InboxItem = { id: string; person: InboxPerson; topic: string; wager: number; rounds: number; kind: "challenge" | "turn" };

export interface WelcomeBackRankChange {
  from: number;
  to: number;
  direction: "up" | "down" | "same";
}

export interface WhileAwayEvent {
  type: "overtook" | "passed" | "yourDay" | "points" | "battle" | "newPlayers" | "challenge" | "community" | "winner" | "battles" | "topBattler" | "streak" | "level" | "motivation";
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
  userId?: string; // desktop: loads the battle inbox (who challenged you, where it's your turn)
}

// Level progress for the welcome-back screen: ONE bar from the current level to the
// next, filled with a gradient from this level's colour to the next one's. The five
// level dots that used to sit below it said the same thing a second time.
function LevelProgressBar({ loading, level, levelProgress, collected, toGo }: {
  loading: boolean; level: number; levelProgress: number; collected: string; toGo: string;
}) {
  const color = LEVELS[level - 1]?.color || '#E36B11';
  const next = level < LEVELS.length ? LEVELS[level] : null;
  const nextColor = next?.color || color;
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (loading) { setOn(false); return; }
    const t = setTimeout(() => setOn(true), 250);
    return () => clearTimeout(t);
  }, [loading]);
  // A sliver is always visible once there is any progress, so 4% does not look empty
  const width = on ? (levelProgress > 0 ? Math.max(levelProgress, 3) : 0) : 0;

  return (
    <div>
      <div className="flex items-end justify-between mb-1.5 font-display uppercase tracking-wider leading-none">
        {loading ? (
          <>
            <span className="h-3 w-28 rounded bg-gray-200 animate-pulse" />
            <span className="h-3 w-8 rounded bg-gray-200 animate-pulse" />
          </>
        ) : next ? (
          <>
            <span className="text-xs text-gray-500">Next: <span className="text-sm" style={{ color: nextColor }}>{next.name}</span></span>
            <span className="text-sm" style={{ color }}><CountUpNumber value={levelProgress} delayMs={250} durationMs={1200} />%</span>
          </>
        ) : (
          <span className="text-sm" style={{ color }}>Top level reached</span>
        )}
      </div>
      <div className="relative h-4 rounded-full bg-[#E5DDD0]/70 shadow-inner">
        <div
          className="absolute inset-y-0 left-0 rounded-full overflow-hidden transition-[width] ease-out"
          style={{
            width: `${width}%`,
            transitionDuration: '1300ms',
            background: `linear-gradient(90deg, ${color}, ${nextColor})`,
            boxShadow: width > 0 ? `0 0 10px ${color}66` : 'none',
          }}
        >
          {/* diagonal retro stripes */}
          <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.25) 0 6px, transparent 6px 12px)' }} />
          {/* soft top highlight */}
          <div className="absolute inset-x-0 top-0 h-1/2 bg-white/20" />
        </div>
        {/* 5% LED ticks over the whole track */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent 0, transparent calc(5% - 1px), rgba(245,240,232,0.9) calc(5% - 1px), rgba(245,240,232,0.9) 5%)' }}
        />
      </div>

      <div className="flex items-center justify-between mt-2 text-[11px] text-gray-500">
        {loading ? (
          <span className="h-3 w-40 rounded bg-gray-100 animate-pulse" />
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5" style={{ color }} />
              {collected} BOGX collected
            </span>
            <span>{next ? `${toGo} BOGX to go` : 'Max level reached!'}</span>
          </>
        )}
      </div>
    </div>
  );
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
  userId,
}: WelcomeBackModalProps) {
  const hasBattleAlerts = pendingChallengeCount > 0 || activeBattleCount > 0;

  const [inbox, setInbox] = useState<InboxItem[] | null>(null);
  useEffect(() => {
    if (!isOpen || !isDesktop || !userId) return;
    let cancelled = false;
    fetch(`/api/battles?userId=${userId}&countOnly=true&details=true`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (!d.success) { setInbox([]); return; }
        setInbox([
          ...(d.challenges || []).map((c: any) => ({ id: c.id, person: c.from, topic: c.topic, wager: c.wager, rounds: c.rounds, kind: "challenge" as const })),
          ...(d.yourTurn || []).map((c: any) => ({ id: c.id, person: c.vs, topic: c.topic, wager: c.wager, rounds: c.rounds, kind: "turn" as const })),
        ]);
      })
      .catch(() => { if (!cancelled) setInbox([]); });
    return () => { cancelled = true; };
  }, [isOpen, isDesktop, userId]);
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

  // Player events from the server first (yesterday's winner, overtakes, your
  // battles...). Rank change and today's net are added because the rank card
  // does not show them. The rank / total / level lines repeat what the card
  // above already shows, so they are only a fallback for an empty list.
  const displayEvents: WhileAwayEvent[] = [...whileAwayEvents];
  if (rankChange && rankChange.direction !== 'same') {
    const up = rankChange.direction === 'up';
    displayEvents.unshift({
      type: 'overtook',
      text: up ? `You moved up to #${rankChange.to}` : `You dropped to #${rankChange.to}`,
      highlight: `${Math.abs(rankChange.from - rankChange.to)} place${Math.abs(rankChange.from - rankChange.to) === 1 ? '' : 's'}`,
    });
  }
  if (pointsToday !== 0) {
    displayEvents.push({ type: 'points', text: 'Today so far', highlight: `${pointsToday > 0 ? '+' : ''}${formatPoints(pointsToday)} BOGX` });
  }
  if (displayEvents.length === 0) {
    if (totalPlayers > 0) displayEvents.push({ type: 'community', text: `You're ranked #${currentRank}`, highlight: `of ${totalPlayers} players` });
    displayEvents.push({ type: 'level', text: `Level ${level}: ${levelName}`, highlight: nextLevelName ? `Next: ${nextLevelName}` : 'Max level!' });
    if (pointsToNextRank > 0 && currentRank && currentRank > 1) {
      displayEvents.push({ type: 'points', text: `${formatPoints(pointsToNextRank)} BOGX to rank`, highlight: `#${currentRank - 1}` });
    }
  }

  // Desktop Layout
  if (isDesktop) {
    return (
      <ModalPortal>
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
              <div className="relative z-10">
                <p className="text-white/70 text-sm uppercase tracking-wider mb-1">Good to have you back</p>
                <h1 className="font-display text-4xl text-white leading-tight">
                  Welcome back,<br />
                  <span className="text-5xl">{username}!</span>
                </h1>
              </div>

              {/* Battle inbox - who challenged you, where it's your turn */}
              <div className="relative z-10 flex-1 mt-6 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5 text-white/80 text-[11px] font-display tracking-widest uppercase">
                    <Swords className="w-3.5 h-3.5" /> Battle inbox
                  </span>
                  {pendingChallengeCount + activeBattleCount > 0 && (
                    <span className="text-white/70 text-[11px]">
                      {pendingChallengeCount > 0 && `${pendingChallengeCount} challenge${pendingChallengeCount === 1 ? '' : 's'}`}
                      {pendingChallengeCount > 0 && activeBattleCount > 0 && ' · '}
                      {activeBattleCount > 0 && `${activeBattleCount} active`}
                    </span>
                  )}
                </div>
                {inbox === null ? (
                  <div className="flex-1 flex items-center justify-center rounded-xl bg-white/10 border border-white/15"><LoadingDots className="text-white" /></div>
                ) : inbox.length === 0 ? (
                  <button
                    onClick={() => { onGoToBattles?.(); onClose(); }}
                    className="flex-1 rounded-xl bg-white/10 border border-dashed border-white/30 p-4 text-left hover:bg-white/15 transition-colors"
                  >
                    <p className="text-white text-sm font-semibold">Nobody's called you out. Yet.</p>
                    <p className="text-white/70 text-xs mt-1 leading-relaxed">No challenges waiting and no battle on your turn. Throw down the first one →</p>
                  </button>
                ) : (
                  <div className="space-y-1.5 overflow-y-auto pr-1" style={{ scrollbarWidth: 'none' }}>
                    {inbox.slice(0, 4).map(item => (
                      <button
                        key={item.id}
                        onClick={() => { onGoToBattles?.(); onClose(); }}
                        className="w-full flex items-center gap-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 px-2.5 py-2 text-left transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-white/30 flex-shrink-0 border border-white/40">
                          {item.person?.avatar
                            ? <img src={item.person.avatar} alt="" className="w-full h-full object-cover" />
                            : <span className="w-full h-full flex items-center justify-center text-white font-display">{item.person?.username?.[0] || '?'}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs leading-tight truncate">
                            <span className="font-semibold">{item.person?.username || 'Someone'}</span>
                            {item.kind === 'challenge' ? ' challenged you' : ' — your turn'}
                          </p>
                          <p className="flex items-center gap-1.5 mt-0.5 text-[10px] text-white/75">
                            <span className="px-1 py-px rounded text-white" style={{ backgroundColor: getTopicColor(item.topic) }}>{getCategoryLabel(item.topic)}</span>
                            {item.rounds} rounds
                          </p>
                        </div>
                        <span className="flex items-center gap-1 text-white font-display text-sm flex-shrink-0">
                          {item.wager.toFixed(2)}
                          <img src="/images/bogxcoin.png" alt="" className="w-3.5 h-3.5" />
                        </span>
                      </button>
                    ))}
                    {inbox.length > 4 && <p className="text-white/70 text-[11px] text-center pt-1">+{inbox.length - 4} more in QuizzBattle</p>}
                  </div>
                )}
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

                <div className="mt-5">
                  <LevelProgressBar loading={loading} level={level} levelProgress={levelProgress} collected={formatPoints(totalPoints)} toGo={formatPoints(pointsToNextLevel)} />
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

              {/* Battle alerts moved to the battle inbox in the left column */}

              {/* Leader Info - compact */}
              {currentLeader && currentLeader !== username && (
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
      </ModalPortal>
    );
  }

  // Mobile Layout (original)
  return (
    <ModalPortal>
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
                  
                  <div className="mt-3">
                    <LevelProgressBar loading={false} level={level} levelProgress={levelProgress} collected={formatPoints(totalPoints)} toGo={formatPoints(pointsToNextLevel)} />
                  </div>
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
    </ModalPortal>
  );
}
