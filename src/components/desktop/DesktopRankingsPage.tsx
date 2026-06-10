"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Trophy, Star, Gamepad2, Gift, Zap, Target, TrendingUp, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import PlayerCard from "@/components/PlayerCard";
import CountryFlag from "@/components/CountryFlag";
import { RankingsSkeleton } from "./DesktopSkeletons";
import { formatCurrency, autoConvertToBOGX } from "@/utils/currency";

// Membership tiers
const MEMBERSHIP_TIERS = [
  { level: 5, name: 'Rookie', minCoins: 0, maxCoins: 19.99, color: '#9CA3AF' },
  { level: 4, name: 'Slacker', minCoins: 20, maxCoins: 39.99, color: '#A78BFA' },
  { level: 3, name: 'Radical', minCoins: 40, maxCoins: 79.99, color: '#60A5FA' },
  { level: 2, name: 'Legendary', minCoins: 80, maxCoins: 149.99, color: '#FBBF24' },
  { level: 1, name: 'Icon', minCoins: 150, maxCoins: Infinity, color: '#F472B6' },
];

function getMembershipTier(coins: number) {
  return MEMBERSHIP_TIERS.find(t => coins >= t.minCoins && coins <= t.maxCoins) || MEMBERSHIP_TIERS[0];
}

interface Player {
  id: string;
  rank: number;
  name: string;
  country: string;
  flag: string;
  points: number;
  wins: number;
  avatar: string;
  change?: "up" | "down" | null;
  pointsGained?: number;
  isGuest?: boolean;
  isCurrentUser?: boolean;
  isActive?: boolean;
  recentPoints?: number;
  avgAnswerTime?: number;
}

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
  const [rankings, setRankings] = useState<Player[]>([]);
  const prevRankingsRef = useRef<Map<string, { rank: number; points: number }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isLive, setIsLive] = useState(true);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(initialPlayerId || null);

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

  const formatDateForApi = (date: Date, period: string) => {
    if (period === 'day') {
      return date.toISOString().split('T')[0];
    } else if (period === 'month') {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } else {
      return `${date.getFullYear()}`;
    }
  };

  const fetchRankings = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('period', activeTab);
      if (activeTab === 'day' && !isToday()) {
        params.set('date', formatDateForApi(selectedDate, 'day'));
      } else if (activeTab === 'month') {
        params.set('month', formatDateForApi(selectedDate, 'month'));
      } else if (activeTab === 'year') {
        params.set('year', formatDateForApi(selectedDate, 'year'));
      }
      if (user?.id) {
        params.set('userId', user.id);
      }

      const res = await fetch(`/api/rankings?${params}`);
      const data = await res.json();

      if (data.rankings) {
        // Transform API response to match Player interface
        const newRankings = data.rankings.map((p: any) => {
          const oderId = p._id || p.id;
          const prev = prevRankingsRef.current.get(oderId);
          let change: "up" | "down" | null = null;
          if (prev) {
            if (p.rank < prev.rank) change = "up";
            else if (p.rank > prev.rank) change = "down";
          }
          return {
            id: oderId,
            rank: p.rank,
            name: p.username || p.name,
            country: p.country,
            flag: p.countryFlag || p.flag || '🌍',
            points: autoConvertToBOGX(p.points || 0),
            wins: p.wins || 0,
            avatar: p.avatar || '',
            change,
            isCurrentUser: user?.id === oderId,
          };
        });

        const newMap = new Map<string, { rank: number; points: number }>();
        data.rankings.forEach((p: any) => {
          const oderId = p._id || p.id;
          newMap.set(oderId, { rank: p.rank, points: p.points });
        });
        prevRankingsRef.current = newMap;

        setRankings(newRankings);
        setIsLive(isToday());
      }
    } catch (error) {
      console.error('Failed to fetch rankings:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchRankings();
  }, [activeTab, selectedDate, user?.id]);

  useEffect(() => {
    if (!isToday()) return;
    const interval = setInterval(() => fetchRankings(true), 30000);
    return () => clearInterval(interval);
  }, [activeTab, selectedDate]);

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

  const currentUserRank = rankings.find(p => p.isCurrentUser);
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
    <div className="w-full h-full flex flex-col overflow-y-auto bg-[#FDFBF7]" style={{ scrollbarWidth: "none" }}>
      {/* Header - Desktop warm style */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#D4873A]/5 to-transparent">
        <div className="flex items-center gap-3">
          <Trophy className="w-5 h-5 text-[#D4873A]" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-tight">Rankings</span>
            <span className="text-[10px] text-gray-500">See who's on top today</span>
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
        {isLoggedIn && loading ? (
          <div className="mx-4 mt-3 mb-2 px-3 py-2.5 bg-[#D4873A]/5 border border-[#D4873A]/20 rounded-lg flex items-center gap-3 animate-pulse">
            <div className="w-14 h-14 rounded-full bg-[#D4873A]/10 flex-shrink-0" />
            <div className="flex-shrink-0">
              <div className="h-2 w-12 bg-[#D4873A]/10 rounded mb-2" />
              <div className="h-6 w-10 bg-[#D4873A]/10 rounded mb-1" />
              <div className="h-3 w-20 bg-[#D4873A]/10 rounded" />
            </div>
          </div>
        ) : isLoggedIn && currentUserRank ? (
          <div className="mx-4 mt-3 mb-3">
            {/* Main Card */}
            <div className="bg-gradient-to-r from-[#F5EDE4] to-[#EDE5DC] border border-[#D4873A]/20 rounded-xl overflow-hidden">
              {/* Top Section - 3 Columns with Separators */}
              <div className="p-5 flex items-center">
                {/* LEFT: Avatar + Name + Country */}
                <div className="flex items-center gap-4 pr-6">
                  <div className="w-16 h-16 rounded-full border-2 border-[#D4873A]/40 overflow-hidden shadow-lg flex-shrink-0">
                    <img src={currentUserRank.avatar} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-lg text-gray-900">{currentUserRank.name}</span>
                      <CountryFlag flag={currentUserRank.flag} className="w-5 h-4 rounded-[2px]" />
                    </div>
                    <div className="text-[10px] text-gray-500 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      EUROPE
                    </div>
                  </div>
                </div>
                
                {/* Separator */}
                <div className="w-px h-14 bg-[#D4873A]/20 flex-shrink-0" />
                
                {/* CENTER: GenX Hero Part (Level/Progress) */}
                <div className="flex-1 px-6">
                  <div className="text-[#D4873A] font-bold text-sm">GENX HERO</div>
                  <div className="flex items-center gap-3 mt-1.5">
                    {/* Segmented Progress Bar - Animated */}
                    <div className="flex gap-1 flex-1 max-w-[280px]">
                      {[...Array(10)].map((_, i) => (
                        <div 
                          key={i} 
                          className={`flex-1 h-2.5 rounded-sm ${i < 6 ? 'bg-[#D4873A]' : 'bg-gray-300'}`}
                          style={{
                            transformOrigin: 'left',
                            opacity: i >= 6 ? 0.5 : 0,
                            transform: i >= 6 ? 'scaleX(1)' : 'scaleX(0)',
                            animation: i < 6 ? `progressFill 0.3s ease-out ${i * 80}ms forwards` : 'none',
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-gray-500 font-medium animate-fade-in" style={{ animationDelay: '500ms' }}>62%</span>
                  </div>
                  <div className="text-[10px] text-gray-600 mt-1 animate-fade-in" style={{ animationDelay: '600ms' }}>1270 / 2000 XP · 730 XP to <span className="text-[#D4873A] font-semibold">Nostalgia Master</span></div>
                  
                  {/* Level Steps */}
                  <div className="flex items-center gap-2 mt-1.5 text-[9px] text-gray-500">
                    <span>ROOKIE</span>
                    <span>•</span>
                    <span>RETRO FAN</span>
                    <span>•</span>
                    <span className="text-[#D4873A] font-bold">GENX HERO</span>
                    <span>•</span>
                    <span>NOSTALGIA MASTER</span>
                    <span>•</span>
                    <span>TOP GENX</span>
                  </div>
                </div>
                
                {/* Separator */}
                <div className="w-px h-14 bg-[#D4873A]/20 flex-shrink-0" />
                
                {/* RIGHT: Rank Box */}
                <div className="flex-shrink-0 bg-[#D4873A]/10 rounded-xl p-4 text-center min-w-[90px] ml-6">
                  <Trophy className="w-5 h-5 text-[#D4873A] mx-auto mb-0.5" />
                  <div className="text-[9px] text-gray-500 uppercase tracking-wider">Rank</div>
                  <div className="font-display text-2xl text-[#D4873A] leading-none">#{currentUserRank.rank}</div>
                </div>
              </div>
              
              {/* Stats Row with Separators */}
              <div className="flex items-center justify-around py-3 px-6 border-t border-dashed border-[#D4873A]/20 bg-white/30">
                <div className="text-center px-4">
                  <Trophy className="w-5 h-5 text-gray-400 mx-auto" />
                  <div className="font-bold text-base text-gray-900 mt-0.5">{currentUserRank.wins || 0}</div>
                  <div className="text-[8px] text-gray-500 uppercase tracking-wide">Wins</div>
                </div>
                <div className="w-px h-10 bg-[#D4873A]/20" />
                <div className="text-center px-4">
                  <Gamepad2 className="w-5 h-5 text-gray-400 mx-auto" />
                  <div className="font-bold text-base text-gray-900 mt-0.5">321</div>
                  <div className="text-[8px] text-gray-500 uppercase tracking-wide">Games</div>
                </div>
                <div className="w-px h-10 bg-[#D4873A]/20" />
                <div className="text-center px-4">
                  <Target className="w-5 h-5 text-gray-400 mx-auto" />
                  <div className="font-bold text-base text-gray-900 mt-0.5">78%</div>
                  <div className="text-[8px] text-gray-500 uppercase tracking-wide">Accuracy</div>
                </div>
                <div className="w-px h-10 bg-[#D4873A]/20" />
                <div className="text-center px-4">
                  <img src="/images/bogxcoin.png" alt="" className="w-5 h-5 mx-auto" />
                  <div className="font-bold text-base text-gray-900 mt-0.5">{formatCurrency(currentUserRank.points)}</div>
                  <div className="text-[8px] text-gray-500 uppercase tracking-wide">BOGX</div>
                </div>
                <div className="w-px h-10 bg-[#D4873A]/20" />
                <div className="text-center px-4">
                  <Clock className="w-5 h-5 text-[#D4873A] mx-auto" />
                  <div className="font-bold text-base text-gray-900 mt-0.5">{currentUserRank.avgAnswerTime ? `${(currentUserRank.avgAnswerTime / 1000).toFixed(1)}s` : '—'}</div>
                  <div className="text-[8px] text-gray-500 uppercase tracking-wide">Avg Time</div>
                </div>
              </div>
            </div>
          </div>
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

        {/* Tabs */}
        <div className="flex border-b border-warm sticky top-0 bg-[#FDFBF7]/95 backdrop-blur-sm z-10">
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
            {isToday() && (
              <div className="flex items-center justify-center gap-1.5 mb-1">
                {isOnBreak() ? (
                  <>
                    <span className="text-lg">☕</span>
                    <span className="text-[9px] font-semibold tracking-widest text-orange-500 uppercase">Break</span>
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
          <div className="text-center py-10 text-gray-600">No ranking data for this date</div>
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
                    <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-cream border border-warm">
                      <img src={player.avatar} alt="" className="w-full h-full object-cover" />
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
