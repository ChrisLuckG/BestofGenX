"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Trophy, Gift, Zap, Target, TrendingUp, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import PlayerCard from "@/components/PlayerCard";
import CountryFlag from "@/components/CountryFlag";
import LogoLoader from "@/components/LogoLoader";
import { formatCurrency, getCurrencySymbol, autoConvertToBOGX } from "@/utils/currency";
import { getUserLevel, getLevelProgress, getBogxToNextLevel, getNextLevelName, getProgressSegments, LEVELS } from "@/utils/levels";
import { useLiveRankings, RankingPlayer as Player } from "@/hooks/useLiveRankings";

interface RankingsPageProps {
  currentUserScore: number;
  onBack?: () => void;
  onShowSignup?: () => void;
  onShowRewards?: () => void;
}

export default function RankingsPage({ currentUserScore, onBack, onShowSignup, onShowRewards }: RankingsPageProps) {
  const { user, isLoggedIn } = useAuth();
  const [activeTab, setActiveTab] = useState<"day" | "month" | "year">("day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  
  // Central live rankings hook - same logic on Desktop AND Mobile
  const { rankings, loading, isLive } = useLiveRankings({
    period: activeTab,
    selectedDate,
    userId: user?.id,
    pollIntervalMs: 5000, // mobile refreshes faster
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
  }, [isLoggedIn, user?.id, rankings]);

  // Check if game is on break (9:00-10:00 CET)
  const isOnBreak = () => {
    const now = new Date();
    const germanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    const hour = germanTime.getHours();
    return hour >= 9 && hour < 10;
  };

  // Check if selected date is today
  const isToday = () => {
    const today = new Date();
    return selectedDate.toDateString() === today.toDateString();
  };

  // Navigate based on active tab (day/month/year)
  const goToPrevious = () => {
    const newDate = new Date(selectedDate);
    if (activeTab === "day") {
      newDate.setDate(newDate.getDate() - 1);
    } else if (activeTab === "month") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setFullYear(newDate.getFullYear() - 1);
    }
    setSelectedDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(selectedDate);
    const today = new Date();
    
    if (activeTab === "day") {
      newDate.setDate(newDate.getDate() + 1);
    } else if (activeTab === "month") {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setFullYear(newDate.getFullYear() + 1);
    }
    
    // Don't go past today/current month/current year
    if (newDate <= today) {
      setSelectedDate(newDate);
    }
  };

  // Check if can go to next
  const canGoNext = () => {
    const today = new Date();
    if (activeTab === "day") {
      return !isToday();
    } else if (activeTab === "month") {
      return selectedDate.getMonth() < today.getMonth() || selectedDate.getFullYear() < today.getFullYear();
    } else {
      return selectedDate.getFullYear() < today.getFullYear();
    }
  };

  // Format display based on tab
  const getDateDisplay = () => {
    if (activeTab === "day") {
      return selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } else if (activeTab === "month") {
      return selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else {
      return selectedDate.getFullYear().toString();
    }
  };

  // Get label for date selector
  const getDateLabel = () => {
    const today = new Date();
    if (activeTab === "day") {
      return isToday() ? 'Today (Live)' : 'Historical';
    } else if (activeTab === "month") {
      const isCurrentMonth = selectedDate.getMonth() === today.getMonth() && selectedDate.getFullYear() === today.getFullYear();
      return isCurrentMonth ? 'This Month' : 'Historical';
    } else {
      const isCurrentYear = selectedDate.getFullYear() === today.getFullYear();
      return isCurrentYear ? 'This Year' : 'Historical';
    }
  };

  // Live updates removed - using real API data now
  useEffect(() => {
    // Placeholder for future live updates via WebSocket
    const interval = setInterval(() => {
      // Rankings refresh handled by the fetch interval above
    }, 30000);

    return () => clearInterval(interval);
  }, [activeTab]);

  // Find current user's rank from rankings, or create fallback from user data
  const currentUserRank = rankings.find(p => p.isCurrentUser) || (user ? {
    id: user.id,
    rank: rankings.length + 1, // Not in top rankings
    name: user.username || 'You',
    country: user.country || 'World',
    flag: user.countryFlag || '🌍',
    points: user.bogxCoins || autoConvertToBOGX(user.coins || 0),
    wins: user.wins || 0,
    avatar: user.avatar || `https://i.pravatar.cc/100?u=${user.id}`,
    isCurrentUser: true,
    change: null,
    pointsGained: 0,
    isActive: false,
    recentPoints: 0,
  } : null);
  
  // Get top 3 for podium
  const top3 = rankings.slice(0, 3);
  const restRankings = rankings.slice(3);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-cream">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#D4873A]/5 to-transparent">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[#D4873A]" />
          <span className="font-display text-lg tracking-wider text-gray-900">Rankings</span>
        </div>
        {onShowRewards && (
          <button 
            onClick={onShowRewards}
            className="flex items-center gap-2 text-gray-600"
          >
            <Gift className="w-5 h-5" />
            <span className="font-display text-lg tracking-wider">Rewards</span>
          </button>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        
        {/* My Rank Card - compact single row (logged in) OR Join CTA (guest) */}
        {isLoggedIn && loading ? (
          /* Skeleton for My Rank while loading */
          <div className="mx-4 mt-3 mb-2 px-3 py-2.5 bg-skeleton-light border border-[#E8DFD4] rounded-lg flex items-center gap-3 animate-pulse">
            <div className="w-14 h-14 rounded-full bg-skeleton flex-shrink-0" />
            <div className="flex-shrink-0">
              <div className="h-2 w-12 bg-skeleton rounded mb-2" />
              <div className="h-6 w-10 bg-skeleton rounded mb-1" />
              <div className="h-3 w-20 bg-skeleton rounded" />
            </div>
            <div className="flex-1 flex justify-end gap-4">
              <div className="text-center">
                <div className="w-4 h-4 bg-skeleton rounded mx-auto mb-1" />
                <div className="h-5 w-10 bg-skeleton rounded mx-auto mb-1" />
                <div className="h-2 w-6 bg-skeleton rounded mx-auto" />
              </div>
              <div className="text-center">
                <div className="w-4 h-4 bg-skeleton rounded mx-auto mb-1" />
                <div className="h-5 w-8 bg-skeleton rounded mx-auto mb-1" />
                <div className="h-2 w-8 bg-skeleton rounded mx-auto" />
              </div>
              <div className="text-center">
                <div className="w-4 h-4 bg-skeleton rounded mx-auto mb-1" />
                <div className="h-5 w-6 bg-skeleton rounded mx-auto mb-1" />
                <div className="h-2 w-10 bg-skeleton rounded mx-auto" />
              </div>
            </div>
          </div>
        ) : isLoggedIn && currentUserRank ? (
          <div className="mx-4 mt-3 mb-3">
            {/* Main Card */}
            <div className="bg-gradient-to-r from-[#F5EDE4] to-[#EDE5DC] border border-[#D4873A]/20 rounded-xl overflow-hidden">
              {/* Row 1: Avatar+Name (left) | Rank (right) */}
              <div className="p-3 flex items-center justify-between">
                {/* LEFT: Avatar + Name + Country */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full border-2 border-[#D4873A]/40 overflow-hidden flex-shrink-0">
                    <img src={currentUserRank.avatar} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-bold text-sm text-gray-900">{currentUserRank.name}</span>
                      <CountryFlag flag={currentUserRank.flag} className="w-5 h-4 rounded-[2px]" />
                    </div>
                    <div className="text-[8px] text-gray-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      EUROPE
                    </div>
                  </div>
                </div>
                
                {/* RIGHT: Rank Box - solid background */}
                <div className="flex-shrink-0 bg-[#D4873A] rounded-lg px-3 py-2 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-white" />
                  <div>
                    <div className="text-[7px] text-white/80 uppercase tracking-wider leading-none">Rank</div>
                    <div className="font-display text-xl text-white leading-none">#{currentUserRank.rank}</div>
                  </div>
                </div>
              </div>
              
              {/* Row 2: Level Progress (full width) */}
              {(() => {
                // Tier/level is based on LIFETIME wallet balance (not the period score),
                // so it stays consistent across Today/Month/Year tabs.
                const userBogx = user?.bogxCoins ?? currentUserScore ?? currentUserRank.points;
                const level = getUserLevel(userBogx);
                const progress = getLevelProgress(userBogx);
                const segments = getProgressSegments(userBogx);
                const toNext = getBogxToNextLevel(userBogx);
                const nextName = getNextLevelName(userBogx);
                
                return (
                  <div className="px-3 pb-3 border-t border-dashed border-[#D4873A]/10 pt-2">
                    <div style={{ color: level.color }} className="font-bold text-[10px]">{level.name.toUpperCase()}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {/* Segmented Progress Bar */}
                      <div className="flex-1 flex gap-0.5">
                        {[...Array(10)].map((_, i) => (
                          <div 
                            key={i} 
                            className="flex-1 h-2 rounded-sm"
                            style={{ backgroundColor: i < segments ? level.color : '#D1D5DB' }}
                          />
                        ))}
                      </div>
                      <span className="text-[8px] text-gray-500">{progress}%</span>
                    </div>
                    <div className="text-[9px] text-gray-600 mt-0.5">
                      {formatCurrency(userBogx)} BOGX · {nextName ? (
                        <>{formatCurrency(toNext)} to <span style={{ color: level.color }} className="font-semibold">{nextName}</span></>
                      ) : (
                        <span style={{ color: level.color }} className="font-semibold">Max Level!</span>
                      )}
                    </div>
                    
                    {/* Level Steps */}
                    <div className="flex items-center gap-1 mt-1 text-[7px] text-gray-500">
                      {LEVELS.map((l, i) => (
                        <span key={l.name}>
                          {i > 0 && <span className="mx-0.5">•</span>}
                          <span style={{ color: l.name === level.name ? level.color : undefined, fontWeight: l.name === level.name ? 'bold' : undefined }}>
                            {l.name.toUpperCase()}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
              
              {/* Row 3: Stats (full width) - larger, black */}
              <div className="flex items-center justify-around py-3 px-3 border-t border-dashed border-[#D4873A]/20 bg-white/50">
                <div className="text-center">
                  <Trophy className="w-4 h-4 text-gray-900 mx-auto" />
                  <div className="font-bold text-base text-gray-900">
                    {userStats ? `${userStats.quizzWins} / ${userStats.quizzLosses}` : '—'}
                  </div>
                  <div className="text-[8px] text-gray-700 uppercase font-medium">Battle W/L</div>
                </div>
                <div className="text-center">
                  <Target className="w-4 h-4 text-gray-900 mx-auto" />
                  <div className="font-bold text-base text-gray-900">
                    {userStats && userStats.accuracy != null ? `${Math.round(userStats.accuracy)}%` : '—'}
                  </div>
                  <div className="text-[8px] text-gray-700 uppercase font-medium">Accuracy</div>
                </div>
                <div className="text-center">
                  <Clock className="w-4 h-4 text-gray-900 mx-auto" />
                  <div className="font-bold text-base text-gray-900">
                    {userStats && userStats.avgAnswerTime != null ? `${(userStats.avgAnswerTime / 1000).toFixed(1)}s` : '—'}
                  </div>
                  <div className="text-[8px] text-gray-700 uppercase font-medium">Avg Time</div>
                </div>
              </div>
            </div>
          </div>
        ) : !isLoggedIn && (
          <button 
            onClick={onShowSignup}
            className="mx-4 mt-3 mb-2 px-3 py-3 bg-cream border border-warm rounded-lg flex items-center gap-3 w-[calc(100%-2rem)] hover:border-[#D4873A] hover:bg-[#D4873A]/5 transition-colors"
          >
            {/* Placeholder Avatar */}
            <div className="w-12 h-12 rounded-full border-2 border-warm bg-cream flex items-center justify-center flex-shrink-0">
              <span className="text-gray-600 text-lg">?</span>
            </div>
            
            {/* CTA Text */}
            <div className="flex-1 text-left">
              <div className="text-[10px] font-semibold tracking-[1px] uppercase text-gray-600">Your Rank</div>
              <div className="text-sm font-semibold text-gray-700 mt-0.5">Sign up to see your ranking</div>
            </div>
            
            {/* Signup button */}
            <div className="px-3 py-1.5 bg-[#D4873A] text-white text-xs font-bold tracking-wider">
              JOIN NOW
            </div>
          </button>
        )}
        
        {/* Info: Why user might not appear in rankings */}
        {isLoggedIn && currentUserRank && !rankings.find(p => p.isCurrentUser) && activeTab === 'day' && (
          <div className="mx-4 mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <span className="text-amber-500 text-sm mt-0.5">💡</span>
            <p className="text-xs text-amber-700">
              <strong>Tip:</strong> You appear in the daily ranking once you've earned positive points today.
            </p>
          </div>
        )}

        {/* Tabs - Today/Month/Year */}
        <div className="flex border-b border-warm sticky top-0 bg-cream/95 backdrop-blur-sm z-10">
          {(["day", "month", "year"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-widest transition-all ${
                activeTab === tab
                  ? "text-[#D4873A] border-b-2 border-[#D4873A]"
                  : "text-gray-600"
              }`}
            >
              {tab === "day" ? "Today" : tab === "month" ? "Month" : "Year"}
            </button>
          ))}
        </div>

        {/* Date Navigation */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-warm">
          <button onClick={goToPrevious} className="w-7 h-7 bg-cream border border-warm rounded-lg flex items-center justify-center">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <div className="text-center">
            {isToday() && (
              <div className="flex items-center justify-center gap-1.5 mb-1">
                {isOnBreak() ? (
                  <>
                    <img src="/images/coffee-break.svg" alt="" className="w-5 h-5" />
                    <span className="text-[9px] font-semibold tracking-widest text-[#D4873A] uppercase">Break</span>
                  </>
                ) : isLive ? (
                  <>
                    <div className="w-1.5 h-1.5 bg-[#D4873A] rounded-full animate-pulse" />
                    <span className="text-[9px] font-semibold tracking-widest text-[#D4873A] uppercase">Live</span>
                  </>
                ) : null}
              </div>
            )}
            <div className="text-sm font-medium text-gray-900">{getDateDisplay()}</div>
          </div>
          <button 
            onClick={goToNext}
            disabled={!canGoNext()}
            className={`w-7 h-7 bg-cream border border-warm rounded-lg flex items-center justify-center ${!canGoNext() ? 'opacity-30' : ''}`}
          >
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Loading State - Skeleton */}
        {loading && (
          <>
            {/* Podium Skeleton */}
            <div className="grid grid-cols-3 gap-2 px-5 py-4 border-b border-warm animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className={`flex flex-col items-center ${i === 2 ? 'order-1' : i === 1 ? 'order-2' : 'order-3'}`}>
                  <div className={`${i === 1 ? 'w-16 h-16' : 'w-14 h-14'} rounded-full bg-skeleton mb-2`} />
                  <div className="w-16 h-3 bg-skeleton rounded mb-1" />
                  <div className="w-12 h-4 bg-skeleton rounded" />
                </div>
              ))}
            </div>
            {/* List Skeleton */}
            <div className="px-4 py-2 space-y-2">
              {[4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-cream border border-warm rounded-xl animate-pulse">
                  <div className="w-6 h-4 bg-skeleton rounded" />
                  <div className="w-10 h-10 rounded-full bg-skeleton" />
                  <div className="flex-1">
                    <div className="w-24 h-4 bg-skeleton rounded mb-1" />
                    <div className="w-16 h-3 bg-skeleton-light rounded" />
                  </div>
                  <div className="w-16 h-5 bg-skeleton rounded" />
                </div>
              ))}
            </div>
          </>
        )}

        {/* No Data Message */}
        {!loading && rankings.length === 0 && (
          <div className="text-center py-10 text-gray-600">No ranking data for this date</div>
        )}

        {!loading && rankings.length > 0 && (
          <>
            {/* Podium - Top 3 */}
            <div className="grid grid-cols-3 gap-2 px-5 py-4 border-b border-warm">
              {/* 2nd Place */}
              {top3[1] && (
                <div 
                  className="flex flex-col items-center cursor-pointer order-1"
                  onClick={() => setSelectedPlayerId(top3[1].id)}
                >
                  <div className="relative mb-2">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#A0A8B8]">
                      <img src={top3[1].avatar} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className={`absolute top-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-cream ${top3[1].isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#A0A8B8] flex items-center justify-center">
                      <span className="text-[10px] font-black text-black">2</span>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-gray-900 text-center truncate w-full">{top3[1].name}</div>
                  <CountryFlag flag={top3[1].flag} className="w-5 h-4 mx-auto rounded-[2px]" />
                  <div className="font-display text-base text-[#A0A8B8]">{formatCurrency(top3[1].points)} {getCurrencySymbol()}</div>
                </div>
              )}
              
              {/* 1st Place */}
              {top3[0] && (
                <div 
                  className="flex flex-col items-center cursor-pointer order-2"
                  onClick={() => setSelectedPlayerId(top3[0].id)}
                >
                  <div className="relative mb-2">
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#FFB800]">
                      <img src={top3[0].avatar} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className={`absolute top-0 right-0 w-4 h-4 rounded-full border-2 border-cream ${top3[0].isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#FFB800] flex items-center justify-center">
                      <span className="text-xs font-black text-black">1</span>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-gray-900 text-center truncate w-full">{top3[0].name}</div>
                  <CountryFlag flag={top3[0].flag} className="w-5 h-4 mx-auto rounded-[2px]" />
                  <div className="font-display text-xl text-[#FFB800]">{formatCurrency(top3[0].points)} {getCurrencySymbol()}</div>
                </div>
              )}
              
              {/* 3rd Place */}
              {top3[2] && (
                <div 
                  className="flex flex-col items-center cursor-pointer order-3"
                  onClick={() => setSelectedPlayerId(top3[2].id)}
                >
                  <div className="relative mb-2">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#CD7F32]">
                      <img src={top3[2].avatar} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className={`absolute top-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-cream ${top3[2].isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#CD7F32] flex items-center justify-center">
                      <span className="text-[10px] font-black text-black">3</span>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-gray-900 text-center truncate w-full">{top3[2].name}</div>
                  <CountryFlag flag={top3[2].flag} className="w-5 h-4 mx-auto rounded-[2px]" />
                  <div className="font-display text-base text-[#CD7F32]">{formatCurrency(top3[2].points)} {getCurrencySymbol()}</div>
                </div>
              )}
            </div>

            {/* Rest of Rankings */}
            <div className="px-5 pb-6">
              {restRankings.map((player) => {
                const isMe = player.isCurrentUser;
                const wentUp = player.change === "up";
                const wentDown = player.change === "down";
                
                return (
                  <div
                    key={player.id}
                    onClick={() => setSelectedPlayerId(player.id)}
                    className={`flex items-center gap-3 py-3 border-b border-warm cursor-pointer hover:bg-cream ${
                      isMe ? 'bg-[#D4873A]/5 border-t border-b border-[#D4873A]/20 -mx-5 px-5' : ''
                    }`}
                  >
                    {/* Rank */}
                    <div className={`font-display text-base min-w-[24px] text-center ${isMe ? 'text-[#D4873A]' : 'text-gray-600'}`}>
                      {player.rank}
                    </div>
                    
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-cream border border-warm">
                        <img src={player.avatar} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-cream ${player.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <CountryFlag flag={player.flag} className="w-4 h-3 rounded-[2px]" />
                        <span className="text-sm font-semibold text-gray-900 truncate">{player.name}</span>
                        {isMe && <span className="text-[7px] font-bold bg-[#D4873A] text-white px-1.5 py-0.5">YOU</span>}
                      </div>
                      <div className="text-[10px] text-gray-600">{player.country}</div>
                    </div>
                    
                    {/* Trend */}
                    {wentUp && <span className="text-[9px] font-semibold text-[#D4873A]">↑</span>}
                    {wentDown && <span className="text-[9px] font-semibold text-red-500">↓</span>}
                    {!wentUp && !wentDown && <span className="text-[9px] text-gray-300">—</span>}
                    
                    {/* Points */}
                    <div className={`font-display text-lg ${isMe ? 'text-[#D4873A]' : 'text-gray-900'}`}>
                      {formatCurrency(player.points)} {getCurrencySymbol()}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Player Card Modal */}
      <PlayerCard
        isOpen={selectedPlayerId !== null}
        playerId={selectedPlayerId}
        onClose={() => setSelectedPlayerId(null)}
      />
    </div>
  );
}
