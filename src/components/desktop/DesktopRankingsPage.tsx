"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, Trophy, Star, Gift, Zap, Target, TrendingUp, Clock, Sparkles, Flame, Crown, Award } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import PlayerCard from "@/components/PlayerCard";
import CountryFlag from "@/components/CountryFlag";
import { RankingsSkeleton } from "./DesktopSkeletons";
import { formatCurrency, autoConvertToBOGX } from "@/utils/currency";
import { getUserLevel, getLevelProgress, getBogxToNextLevel, getNextLevelName, getProgressSegments, LEVELS } from "@/utils/levels";
import { useLiveRankings, RankingPlayer as Player } from "@/hooks/useLiveRankings";


interface DesktopRankingsPageProps {
  currentUserScore: number;
  onBack?: () => void;
  onShowSignup?: () => void;
  onShowRewards?: () => void;
  selectedPlayerId?: string | null;
  onPlayerClose?: () => void;
}

export default function DesktopRankingsPage({ currentUserScore, onBack, onShowSignup, onShowRewards, selectedPlayerId: initialPlayerId, onPlayerClose }: DesktopRankingsPageProps) {
  const { user, isLoggedIn } = useAuth();
  const [activeTab, setActiveTab] = useState<"day" | "month" | "year">("day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(initialPlayerId || null);
  const [countdown, setCountdown] = useState('');
  const [statsExpanded, setStatsExpanded] = useState(false); // Stats row - collapsed by default
  
  // Central live rankings hook - same logic on Desktop AND Mobile
  const { rankings, loading, isLive } = useLiveRankings({
    period: activeTab,
    selectedDate,
    userId: user?.id,
  });

  // Real lifetime stats (quizzbattle W/L, accuracy, avg time) from GameResult + Battle
  const [userStats, setUserStats] = useState<{
    quizzWins: number;
    quizzLosses: number;
    accuracy: number | null;
    avgAnswerTime: number | null;
  } | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !user?.id) { setUserStats(null); return; }
    fetch(`/api/users/${user.id}/stats`)
      .then(r => r.json())
      .then(d => { if (d && !d.error) setUserStats(d); })
      .catch(() => {});
  }, [isLoggedIn, user?.id]);

  // Sync with external selectedPlayerId prop
  useEffect(() => {
    if (initialPlayerId !== undefined) {
      setSelectedPlayerId(initialPlayerId);
    }
  }, [initialPlayerId]);

  // Handle player card close
  const handlePlayerClose = () => {
    setSelectedPlayerId(null);
    onPlayerClose?.();
  };

  // Countdown to 9:00 Berlin time (end of game day) with seconds
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const berlinTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
      const berlinHour = berlinTime.getHours();
      const berlinMinute = berlinTime.getMinutes();
      const berlinSecond = berlinTime.getSeconds();
      
      let totalSeconds;
      if (berlinHour < 9) {
        totalSeconds = (9 - berlinHour - 1) * 3600 + (60 - berlinMinute - 1) * 60 + (60 - berlinSecond);
      } else {
        totalSeconds = (24 - berlinHour + 8) * 3600 + (60 - berlinMinute - 1) * 60 + (60 - berlinSecond);
      }
      
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      setCountdown(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const isOnBreak = () => {
    const now = new Date();
    const germanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    const hour = germanTime.getHours();
    return hour >= 9 && hour < 10;
  };

  const isToday = () => {
    const today = new Date();
    return selectedDate.toDateString() === today.toDateString();
  };

  const getDateDisplay = () => {
    if (activeTab === "day") {
      return selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } else if (activeTab === "month") {
      return selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else {
      return selectedDate.getFullYear().toString();
    }
  };

  const goToPrevious = () => {
    const newDate = new Date(selectedDate);
    if (activeTab === "day") newDate.setDate(newDate.getDate() - 1);
    else if (activeTab === "month") newDate.setMonth(newDate.getMonth() - 1);
    else newDate.setFullYear(newDate.getFullYear() - 1);
    setSelectedDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(selectedDate);
    if (activeTab === "day") newDate.setDate(newDate.getDate() + 1);
    else if (activeTab === "month") newDate.setMonth(newDate.getMonth() + 1);
    else newDate.setFullYear(newDate.getFullYear() + 1);
    setSelectedDate(newDate);
  };

  const canGoNext = () => {
    const today = new Date();
    if (activeTab === "day") return selectedDate < today;
    if (activeTab === "month") return selectedDate.getMonth() < today.getMonth() || selectedDate.getFullYear() < today.getFullYear();
    return selectedDate.getFullYear() < today.getFullYear();
  };

  // Find current user in rankings, or create from user data if logged in
  const currentUserRank = rankings.find(p => p.isCurrentUser) || (user ? {
    id: user.id,
    rank: rankings.length > 0 ? rankings.length + 1 : 0,
    name: user.username || 'You',
    country: user.country || 'World',
    flag: user.countryFlag || '🌍',
    points: user.bogxCoins || user.coins || 0,
    wins: user.wins || 0,
    avatar: user.avatar || `https://i.pravatar.cc/100?u=${user.id}`,
    isCurrentUser: true,
    change: null,
    pointsGained: 0,
    isActive: false,
    recentPoints: 0,
    avgAnswerTime: 0,
  } : null);
  const top3 = rankings.slice(0, 3);
  const restRankings = rankings.slice(3);

  // If a player is selected, show PlayerCard in content area
  if (selectedPlayerId) {
    return (
      <PlayerCard
        isOpen={true}
        playerId={selectedPlayerId}
        onClose={() => setSelectedPlayerId(null)}
        isDesktop={true}
      />
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto bg-[#F5F0E8]" style={{ scrollbarWidth: "none" }}>
      {/* Header - Desktop warm style */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#D4873A]/5 to-transparent">
        <div className="flex items-center gap-3">
          <Trophy className="w-5 h-5 text-[#D4873A]" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">Rankings</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">See who's on top today</span>
          </div>
        </div>
        {onShowRewards && (
          <button 
            onClick={onShowRewards}
            className="flex items-center gap-2 text-gray-600 hover:text-[#D4873A] transition-colors"
          >
            <Gift className="w-5 h-5" />
            <span className="font-display text-sm tracking-wider">Rewards</span>
          </button>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-transparent to-[#D4873A]/[0.03]" style={{ scrollbarWidth: 'none' }}>
        
        {/* My Rank Card */}
        {isLoggedIn && loading && rankings.length === 0 ? (
          <div className="mx-4 mt-3 mb-2 px-3 py-2.5 bg-[#D4873A]/5 border border-[#D4873A]/20 rounded-lg flex items-center gap-3 animate-pulse">
            <div className="w-14 h-14 rounded-full bg-[#D4873A]/10 flex-shrink-0" />
            <div className="flex-shrink-0">
              <div className="h-2 w-12 bg-[#D4873A]/10 rounded mb-2" />
              <div className="h-6 w-10 bg-[#D4873A]/10 rounded mb-1" />
              <div className="h-3 w-20 bg-[#D4873A]/10 rounded" />
            </div>
          </div>
        ) : isLoggedIn && currentUserRank ? (
          (() => {
            // Tier/level is based on LIFETIME wallet balance (not the period score),
            // so it stays consistent across Today/Month/Year tabs.
            const userBogx = user?.bogxCoins ?? currentUserScore ?? currentUserRank.points;
            const level = getUserLevel(userBogx);
            const levelIndex = LEVELS.findIndex(l => l.name === level.name);
            const progress = getLevelProgress(userBogx);
            const toNext = getBogxToNextLevel(userBogx);
            const nextName = getNextLevelName(userBogx);
            
            return (
              <div className="mx-4 mt-3 mb-3">
                {/* Main Card */}
                <div className="bg-gradient-to-r from-[#F5EDE4] to-[#EDE5DC] border border-[#D4873A]/20 rounded-xl overflow-hidden">
                  {/* Top Section - 3 Columns */}
                  <div className="p-5 flex items-center">
                    {/* LEFT: Avatar + Name + Country */}
                    <div className="flex items-center gap-4 pr-6 border-r border-[#D4873A]/20">
                      <div className="w-14 h-14 rounded-full border-2 border-[#D4873A]/40 overflow-hidden shadow-lg flex-shrink-0">
                        <img src={currentUserRank.avatar} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-base text-gray-900">{currentUserRank.name}</span>
                          <CountryFlag flag={currentUserRank.flag} className="w-4 h-3 rounded-[2px]" />
                        </div>
                        <div className="text-[9px] text-gray-500 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          EUROPE
                        </div>
                      </div>
                    </div>
                    
                    {/* CENTER: Level Info */}
                    <div className="flex-1 px-6">
                      {/* Level Name + Badge */}
                      <div className="flex items-center gap-2">
                        <div className="font-display text-xl tracking-wide" style={{ color: level.color }}>{level.name.toUpperCase()}</div>
                        <div className="px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider" style={{ borderColor: level.color, color: level.color }}>
                          Level {levelIndex + 1}
                        </div>
                      </div>
                      
                      {/* LED Segment Progress Bar */}
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex gap-0.5 flex-1">
                          {Array.from({ length: 20 }).map((_, i) => {
                            const segmentProgress = (i + 1) * 5; // Each segment = 5%
                            const isActive = progress >= segmentProgress;
                            return (
                              <div 
                                key={i}
                                className="flex-1 h-3 rounded-sm"
                                style={{ 
                                  backgroundColor: level.color,
                                  boxShadow: isActive ? `0 0 4px ${level.color}` : 'none',
                                  transformOrigin: 'bottom',
                                  opacity: isActive ? 0 : 0.2,
                                  transform: isActive ? 'scaleY(0)' : 'scaleY(1)',
                                  animation: isActive ? `ledPopIn 0.25s ease-out ${i * 40}ms forwards` : 'none',
                                }}
                              />
                            );
                          })}
                        </div>
                        <span className="text-sm font-bold text-gray-600 flex-shrink-0">{progress}%</span>
                      </div>
                      
                      {/* BOGX Info */}
                      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-gray-600">
                        <Star className="w-3 h-3 flex-shrink-0" style={{ color: level.color }} />
                        <span className="font-semibold" style={{ color: level.color }}>{formatCurrency(userBogx)} BOGX</span>
                        <span className="text-gray-300">•</span>
                        <span className="text-gray-500">
                          {nextName ? <><span className="font-semibold text-gray-700">{formatCurrency(toNext)} BOGX</span> to next rank</> : 'Max Level reached!'}
                        </span>
                      </div>
                    </div>
                    
                    {/* RIGHT: Rank Box */}
                    <div className="flex-shrink-0 bg-[#D4873A]/10 rounded-xl p-4 text-center min-w-[80px]">
                      <Trophy className="w-5 h-5 text-[#D4873A] mx-auto mb-0.5" />
                      <div className="text-[8px] text-gray-500 uppercase tracking-wider">Rank</div>
                      <div className="font-display text-2xl text-[#D4873A] leading-none">#{currentUserRank.rank || 0}</div>
                    </div>
                  </div>
                  
                  {/* Level Timeline with LEDs */}
                  <div className="px-6 py-4 border-t border-dashed border-[#D4873A]/20 bg-white/30">
                    <div className="flex items-center justify-between relative">
                      {/* Connection Line */}
                      <div className="absolute top-3 left-6 right-6 h-0.5 bg-gray-300" />
                      {/* Solid line up to current level */}
                      <div 
                        className="absolute top-3 left-6 h-0.5"
                        style={{ 
                          width: `${(levelIndex / (LEVELS.length - 1)) * 100}%`,
                          backgroundColor: level.color,
                          transformOrigin: 'left',
                          animation: 'lineGrow 0.6s ease-out 150ms both',
                        }}
                      />
                      {/* Progress line within current level (gradient to next node) */}
                      {levelIndex < LEVELS.length - 1 && progress > 0 && (() => {
                        // Calculate segment width as percentage of total line
                        const segmentWidth = 100 / (LEVELS.length - 1); // e.g., 25% for 5 levels
                        const progressWidth = segmentWidth * (progress / 100); // e.g., 82% of 25% = 20.5%
                        const startPos = (levelIndex / (LEVELS.length - 1)) * 100; // e.g., 25% for level 2
                        return (
                          <div 
                            className="absolute top-3 left-6 h-0.5"
                            style={{ 
                              marginLeft: `${startPos}%`,
                              width: `${progressWidth}%`,
                              background: `linear-gradient(to right, ${level.color}, ${level.color}20)`,
                              transformOrigin: 'left',
                              animation: 'lineGrow 0.6s ease-out 300ms both',
                            }}
                          />
                        );
                      })()}
                      
                      {/* Level Nodes */}
                      {LEVELS.map((l, i) => {
                        const isActive = i <= levelIndex;
                        const isCurrent = l.name === level.name;
                        // Different icon for each level
                        const LevelIcon = [Sparkles, Star, Flame, Award, Crown][i] || Star;
                        return (
                          <div key={l.name} className="flex flex-col items-center z-10">
                            {/* LED Circle */}
                            <div 
                              className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                                isCurrent ? 'shadow-lg' : ''
                              }`}
                              style={{ 
                                backgroundColor: isActive ? l.color : '#E5E7EB',
                                borderColor: isActive ? l.color : '#D1D5DB',
                                color: l.color,
                                animation: isCurrent
                                  ? `nodePopIn 0.35s ease-out ${i * 120}ms both, pulseRing 2s ease-in-out ${i * 120 + 400}ms infinite`
                                  : `nodePopIn 0.35s ease-out ${i * 120}ms both`,
                              }}
                            >
                              <LevelIcon className={`w-3 h-3 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                            </div>
                            {/* Label */}
                            <div 
                              className="mt-2 text-center"
                              style={{ animation: `fadeInUp 0.35s ease-out ${i * 120 + 100}ms both` }}
                            >
                              <div 
                                className="text-[9px] font-bold uppercase tracking-wide"
                                style={{ color: isActive ? l.color : '#6B7280' }}
                              >
                                {l.name}
                              </div>
                              <div className="text-[8px] text-gray-600">Level {i + 1}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Pull handle - toggles Stats Row */}
                  <button
                    onClick={() => setStatsExpanded(prev => !prev)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 border-t border-dashed border-[#D4873A]/20 bg-white/30 hover:bg-[#D4873A]/5 transition-colors group"
                  >
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-gray-500 group-hover:text-[#D4873A] transition-colors">
                      {statsExpanded ? 'Less' : 'More Stats'}
                    </span>
                    <ChevronDown 
                      className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#D4873A] transition-all duration-300"
                      style={{ transform: statsExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    />
                  </button>
                  
                  {/* Stats Row - collapsible, collapsed by default */}
                  <div 
                    className="overflow-hidden transition-all duration-300 ease-out"
                    style={{ maxHeight: statsExpanded ? '120px' : '0px', opacity: statsExpanded ? 1 : 0 }}
                  >
                    <div className="flex items-center justify-around py-3 px-6 border-t border-dashed border-[#D4873A]/20 bg-white/50">
                      <div className="text-center px-3">
                        <Trophy className="w-4 h-4 text-gray-400 mx-auto" />
                        <div className="font-bold text-sm text-gray-900 mt-0.5">
                          {userStats ? `${userStats.quizzWins} / ${userStats.quizzLosses}` : '—'}
                        </div>
                        <div className="text-[7px] text-gray-500 uppercase tracking-wide">Battle W/L</div>
                      </div>
                      <div className="w-px h-8 bg-[#D4873A]/20" />
                      <div className="text-center px-3">
                        <Target className="w-4 h-4 text-gray-400 mx-auto" />
                        <div className="font-bold text-sm text-gray-900 mt-0.5">
                          {userStats && userStats.accuracy != null ? `${Math.round(userStats.accuracy)}%` : '—'}
                        </div>
                        <div className="text-[7px] text-gray-500 uppercase tracking-wide">Accuracy</div>
                      </div>
                      <div className="w-px h-8 bg-[#D4873A]/20" />
                      <div className="text-center px-3">
                        <Clock className="w-4 h-4 text-gray-400 mx-auto" />
                        <div className="font-bold text-sm text-gray-900 mt-0.5">
                          {userStats && userStats.avgAnswerTime != null ? `${(userStats.avgAnswerTime / 1000).toFixed(1)}s` : '—'}
                        </div>
                        <div className="text-[7px] text-gray-500 uppercase tracking-wide">Avg Time</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()
        ) : !isLoggedIn ? (
          <button
            onClick={onShowSignup}
            className="mx-4 mt-3 mb-2 px-3 py-2.5 bg-[#D4873A]/5 border border-[#D4873A]/20 rounded-lg flex items-center gap-3 w-[calc(100%-2rem)] hover:bg-[#D4873A]/10 transition-colors"
          >
            <div className="w-14 h-14 rounded-full bg-[#D4873A]/10 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-6 h-6 text-[#D4873A]/40" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-[10px] font-semibold tracking-[1px] uppercase text-gray-600">Your Rank</div>
              <div className="text-sm font-semibold text-gray-700 mt-0.5">Sign up to see your ranking</div>
            </div>
            <div className="px-3 py-1.5 bg-[#D4873A] text-white text-xs font-bold tracking-wider rounded">
              JOIN NOW
            </div>
          </button>
        ) : null}
        
        {/* Info: Why user might not appear in rankings */}
        {isLoggedIn && currentUserRank && !rankings.find(p => p.isCurrentUser) && activeTab === 'day' && (
          <div className="mx-4 mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <span className="text-amber-500 text-sm mt-0.5">💡</span>
            <p className="text-xs text-amber-700">
              <strong>Tip:</strong> You appear in the daily ranking once you've earned positive points today. Wrong answers and lost battles reduce your daily score.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-warm sticky top-0 bg-[#F5F0E8]/95 backdrop-blur-sm z-10">
          {(["day", "month", "year"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-widest transition-all ${
                activeTab === tab
                  ? "text-[#D4873A] border-b-2 border-[#D4873A]"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {tab === "day" ? "Today" : tab === "month" ? "Month" : "Year"}
            </button>
          ))}
        </div>

        {/* Date Navigation */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-warm bg-[#D4873A]/[0.02]">
          <button onClick={goToPrevious} className="w-7 h-7 bg-cream border border-warm rounded-lg flex items-center justify-center hover:bg-[#D4873A]/10 transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <div className="text-center">
            {isToday() && rankings.length > 0 && (
              <div className="flex items-center justify-center gap-2 mb-1">
                {isOnBreak() ? (
                  <>
                    <img src="/images/coffee-break.svg" alt="" className="w-5 h-5" />
                    <span className="text-[9px] font-semibold tracking-widest text-[#D4873A] uppercase">Break</span>
                  </>
                ) : isLive ? (
                  <>
                    <div className="w-1.5 h-1.5 bg-[#D4873A] rounded-full animate-pulse" />
                    <span className="text-[9px] font-semibold tracking-widest text-[#D4873A] uppercase">Live</span>
                    <span className="text-gray-400">·</span>
                    <Clock className="w-3 h-3 text-gray-500" />
                    <span className="font-mono text-[10px] font-bold text-gray-600 tabular-nums">{countdown}</span>
                  </>
                ) : null}
              </div>
            )}
            <div className="text-sm font-medium text-gray-900">{getDateDisplay()}</div>
          </div>
          <button 
            onClick={goToNext}
            disabled={!canGoNext()}
            className={`w-7 h-7 bg-cream border border-warm rounded-lg flex items-center justify-center hover:bg-[#D4873A]/10 transition-colors ${!canGoNext() ? 'opacity-30' : ''}`}
          >
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="px-4">
            <RankingsSkeleton />
          </div>
        )}

        {/* No Data */}
        {!loading && rankings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 rounded-full bg-warm/50 flex items-center justify-center mb-4">
              <Trophy className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="font-display text-lg text-gray-700 mb-2">No Ranking Data</h3>
            <p className="text-sm text-gray-500 text-center max-w-xs">
              {activeTab === 'day' && isToday()
                ? 'Be the first to play today!'
                : activeTab === 'day' 
                ? 'No games were played on this day.' 
                : activeTab === 'month'
                ? 'No ranking data available for this month.'
                : 'No ranking data available for this year.'}
            </p>
          </div>
        )}

        {!loading && rankings.length > 0 && (
          <>
            {/* Podium - Top 3 with Separators */}
            <div className="flex items-center justify-center gap-0 px-5 py-4 border-b border-warm bg-gradient-to-b from-[#D4873A]/5 to-transparent">
              {/* 2nd Place */}
              {top3[1] && (
                <div 
                  className="flex-1 flex flex-col items-center cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => setSelectedPlayerId(top3[1].id)}
                >
                  <div className="relative mb-2">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#A0A8B8]">
                      <img src={top3[1].avatar} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className={`absolute top-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-cream ${top3[1].isOnline ? 'bg-green-500' : 'bg-gray-400'}`} title={top3[1].isOnline ? 'Online' : 'Offline'} />
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#A0A8B8] flex items-center justify-center">
                      <span className="text-[10px] font-black text-black">2</span>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-gray-900 text-center truncate w-full">{top3[1].name}</div>
                  <CountryFlag flag={top3[1].flag} className="w-5 h-4 mx-auto rounded-[2px]" />
                  <div className="flex items-center gap-1 justify-center">
                    <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                    <span className="font-display text-base text-[#A0A8B8]">{formatCurrency(top3[1].points)}</span>
                  </div>
                </div>
              )}
              
              {/* Separator 2-1 */}
              <div className="w-px h-20 bg-warm/50 mx-2" />
              
              {/* 1st Place */}
              {top3[0] && (
                <div 
                  className="flex-1 flex flex-col items-center cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => setSelectedPlayerId(top3[0].id)}
                >
                  <div className="relative mb-2">
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#FFB800]">
                      <img src={top3[0].avatar} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className={`absolute top-0 right-0 w-4 h-4 rounded-full border-2 border-cream ${top3[0].isOnline ? 'bg-green-500' : 'bg-gray-400'}`} title={top3[0].isOnline ? 'Online' : 'Offline'} />
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#FFB800] flex items-center justify-center">
                      <span className="text-xs font-black text-black">1</span>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-gray-900 text-center truncate w-full">{top3[0].name}</div>
                  <CountryFlag flag={top3[0].flag} className="w-5 h-4 mx-auto rounded-[2px]" />
                  <div className="flex items-center gap-1 justify-center">
                    <img src="/images/bogxcoin.png" alt="" className="w-5 h-5" />
                    <span className="font-display text-xl text-[#FFB800]">{formatCurrency(top3[0].points)}</span>
                  </div>
                </div>
              )}
              
              {/* Separator 1-3 */}
              <div className="w-px h-20 bg-warm/50 mx-2" />
              
              {/* 3rd Place */}
              {top3[2] && (
                <div 
                  className="flex-1 flex flex-col items-center cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => setSelectedPlayerId(top3[2].id)}
                >
                  <div className="relative mb-2">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#CD7F32]">
                      <img src={top3[2].avatar} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className={`absolute top-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-cream ${top3[2].isOnline ? 'bg-green-500' : 'bg-gray-400'}`} title={top3[2].isOnline ? 'Online' : 'Offline'} />
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#CD7F32] flex items-center justify-center">
                      <span className="text-[10px] font-black text-black">3</span>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-gray-900 text-center truncate w-full">{top3[2].name}</div>
                  <CountryFlag flag={top3[2].flag} className="w-5 h-4 mx-auto rounded-[2px]" />
                  <div className="flex items-center gap-1 justify-center">
                    <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                    <span className="font-display text-base text-[#CD7F32]">{formatCurrency(top3[2].points)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Rest of Rankings */}
            <div className="px-5 pb-6 bg-gradient-to-b from-transparent via-[#D4873A]/[0.02] to-[#D4873A]/5">
              {restRankings.map((player) => {
                const isMe = player.isCurrentUser;
                const wentUp = player.change === "up";
                const wentDown = player.change === "down";
                
                return (
                  <div
                    key={player.id}
                    onClick={() => setSelectedPlayerId(player.id)}
                    className={`flex items-center gap-3 py-3 border-b border-warm cursor-pointer hover:bg-[#D4873A]/5 transition-colors ${
                      isMe ? 'bg-[#D4873A]/5 border-t border-b border-[#D4873A]/20 -mx-5 px-5' : ''
                    }`}
                  >
                    <div className={`font-display text-base min-w-[24px] text-center ${isMe ? 'text-[#D4873A]' : 'text-gray-600'}`}>
                      {player.rank}
                    </div>
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-cream border border-warm">
                        <img src={player.avatar} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-cream ${player.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} title={player.isOnline ? 'Online' : 'Offline'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <CountryFlag flag={player.flag} className="w-4 h-3 rounded-[2px]" />
                        <span className="text-sm font-semibold text-gray-900 truncate">{player.name}</span>
                        {isMe && <span className="text-[7px] font-bold bg-[#D4873A] text-white px-1.5 py-0.5">YOU</span>}
                      </div>
                      <div className="text-[10px] text-gray-600">{player.country}</div>
                    </div>
                    {wentUp && <span className="text-[9px] font-semibold text-[#D4873A]">↑</span>}
                    {wentDown && <span className="text-[9px] font-semibold text-red-500">↓</span>}
                    {!wentUp && !wentDown && <span className="text-[9px] text-gray-300">—</span>}
                    <div className="flex items-center gap-1">
                      <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                      <span className={`font-display text-lg ${isMe ? 'text-[#D4873A]' : 'text-gray-900'}`}>
                        {formatCurrency(player.points)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      
      {/* Player Card - Desktop inline */}
      {selectedPlayerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={handlePlayerClose}>
          <div className="w-full max-w-md bg-cream rounded-2xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <PlayerCard
              isOpen={true}
              playerId={selectedPlayerId}
              onClose={handlePlayerClose}
              currentUserId={user?.id}
              isDesktop={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
