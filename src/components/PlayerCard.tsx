"use client";

import { useState, useEffect, useRef } from "react";
import { Trophy, Clock, Target, TrendingUp, Award, Calendar, Swords, User } from "lucide-react";
import { ProfileSkeleton } from "@/components/desktop/DesktopSkeletons";
import BackButton from "./BackButton";
import CountryFlag from "./CountryFlag";
import { useBackButton } from "@/hooks/useBackButton";

interface PlayerStats {
  _id: string;
  username: string;
  avatar: string;
  country: string;
  countryFlag: string;
  points: number;
  wins: number;
  gamesPlayed: number;
  createdAt: string;
  // Calculated stats
  avgAnswerTime?: number;
  accuracy?: number;
  winRate?: number;
  currentStreak?: number;
  bestStreak?: number;
  rank?: number;
}

interface PlayerCardProps {
  isOpen: boolean;
  playerId: string | null;
  onClose: () => void;
  onChallenge?: (playerId: string, username: string) => void;
  currentUserId?: string;
  isDesktop?: boolean;
}

export default function PlayerCard({ isOpen, playerId, onClose, onChallenge, currentUserId, isDesktop = false }: PlayerCardProps) {
  const [player, setPlayer] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Intercept system/browser back button to close player card instead of leaving page
  useBackButton(isOpen, onClose);

  useEffect(() => {
    if (!isOpen || !playerId) return;
    
    const fetchPlayer = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/users/${playerId}/stats`);
        if (res.ok) {
          const data = await res.json();
          setPlayer(data);
        }
      } catch (error) {
        console.error('Failed to fetch player:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPlayer();
  }, [isOpen, playerId]);

  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      year: 'numeric' 
    });
  };

  // Desktop: render inline in content area
  // Mobile: render as fixed overlay with slide animation
  return (
    <div 
      className={isDesktop 
        ? "w-full h-full flex flex-col bg-[#FDFBF7]" 
        : "fixed inset-0 z-[100] flex flex-col bg-cream animate-slide-in-right"
      }
    >
      {/* Header - consistent style like other pages */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#D4873A]/5 to-transparent">
        <BackButton onClick={onClose} />
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-[#D4873A]" />
          <span className="font-display text-lg tracking-wider text-gray-900">
            Player Profile
          </span>
        </div>
        {/* Rank & Score Badge */}
        {player && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#D4873A]/10 border border-[#D4873A]/30 rounded-lg">
            <span className="text-sm font-bold text-[#D4873A]">#{player.rank || '—'}</span>
            <div className="w-px h-4 bg-[#D4873A]/30" />
            <img src="/images/bogxcoin.png" alt="" className="w-5 h-5" />
            <span className="text-sm font-bold text-[#D4873A]">{(player.points / 100).toFixed(2)}</span>
          </div>
        )}
        {!player && <div className="w-14" />}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {loading ? (
          <ProfileSkeleton />
        ) : player ? (
          <>
            {/* Profile Header Card */}
            <div className={`mx-4 mt-4 rounded-2xl shadow-sm border border-warm overflow-hidden ${isDesktop ? 'bg-[#FDFBF7]' : 'bg-white'}`}>
              {/* Background Gradient */}
              <div className="h-20 bg-gradient-to-br from-[#D4873A]/25 via-[#D4873A]/10 to-transparent" />
              
              {/* Avatar & Name */}
              <div className="px-5 pb-5 -mt-12 relative">
                <div className="flex items-end gap-4">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md">
                      <img 
                        src={player.avatar || `https://i.pravatar.cc/200?u=${player._id}`} 
                        alt={player.username}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {/* Rank Badge */}
                    {player.rank && player.rank <= 3 && (
                      <div className={`absolute -top-1 -right-1 w-9 h-9 rounded-full flex items-center justify-center shadow-md border-2 border-white ${
                        player.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-amber-600' :
                        player.rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                        'bg-gradient-to-br from-amber-600 to-amber-800'
                      }`}>
                        <span className="text-xs font-black text-white">#{player.rank}</span>
                      </div>
                    )}
                  </div>
                  <div className="pb-1 flex-1 min-w-0">
                    <h2 className="text-xl font-black text-gray-900 truncate">{player.username}</h2>
                    <div className="flex items-center gap-1.5 mt-1">
                      <CountryFlag flag={player.countryFlag} className="w-5 h-4 rounded-[2px]" />
                      <span className="text-sm text-gray-500">{player.country || 'World'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* GenX Hero Level - Card */}
            <div className={`mx-4 mt-3 rounded-2xl shadow-sm border border-warm overflow-hidden ${isDesktop ? 'bg-[#FDFBF7]' : 'bg-white'}`}>
              <div className="p-4">
                <div className="text-[#D4873A] font-bold text-sm">GENX HERO</div>
                <div className="flex items-center gap-3 mt-2">
                  {/* Segmented Progress Bar - Animated */}
                  <div className="flex gap-1 flex-1">
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
                  <span className="text-sm text-[#D4873A] font-bold animate-fade-in" style={{ animationDelay: '600ms' }}>62%</span>
                </div>
                <div className="text-[10px] text-gray-600 mt-1.5 animate-fade-in" style={{ animationDelay: '700ms' }}>1270 / 2000 XP · 730 XP to <span className="text-[#D4873A] font-semibold">Nostalgia Master</span></div>
                
                {/* Level Steps - Animated */}
                <div className="flex items-center gap-1.5 mt-2 text-[8px] text-gray-500 flex-wrap">
                  <span className="animate-fade-in-up" style={{ animationDelay: '0ms' }}>ROOKIE</span>
                  <span className="animate-fade-in-up" style={{ animationDelay: '50ms' }}>•</span>
                  <span className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>RETRO FAN</span>
                  <span className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>•</span>
                  <span className="text-[#D4873A] font-bold animate-fade-in-up" style={{ animationDelay: '200ms' }}>GENX HERO</span>
                  <span className="animate-fade-in-up" style={{ animationDelay: '250ms' }}>•</span>
                  <span className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>NOSTALGIA MASTER</span>
                  <span className="animate-fade-in-up" style={{ animationDelay: '350ms' }}>•</span>
                  <span className="animate-fade-in-up" style={{ animationDelay: '400ms' }}>TOP GENX</span>
                </div>
              </div>
            </div>

            {/* Main Stats - Card */}
            <div className={`mx-4 mt-3 rounded-2xl shadow-sm border border-warm overflow-hidden ${isDesktop ? 'bg-[#FDFBF7]' : 'bg-white'}`}>
              <div className="grid grid-cols-3 divide-x divide-warm">
                <div className="p-4 text-center">
                  <p className="text-2xl font-black text-[#D4873A]">{player.points.toLocaleString()}</p>
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mt-1">Points</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-2xl font-black text-[#FFB800]">{player.wins}</p>
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mt-1">Wins</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-2xl font-black text-blue-500">{player.gamesPlayed}</p>
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mt-1">Games</p>
                </div>
              </div>
            </div>

            {/* Performance Stats - Card */}
            <div className={`mx-4 mt-3 rounded-2xl shadow-sm border border-warm overflow-hidden ${isDesktop ? 'bg-[#FDFBF7]' : 'bg-white'}`}>
              <div className="px-4 py-3 border-b border-warm/60">
                <h3 className="text-[10px] font-bold tracking-widest uppercase text-gray-500 flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3 text-[#D4873A]" />
                  Performance Stats
                </h3>
              </div>
              
              <div className="divide-y divide-warm/60">
                {/* Average Answer Time */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Avg. Answer Time</p>
                      <p className="text-[10px] text-gray-400">Speed matters!</p>
                    </div>
                  </div>
                  <p className="text-base font-bold text-purple-500">
                    {player.avgAnswerTime ? `${player.avgAnswerTime.toFixed(1)}s` : '—'}
                  </p>
                </div>

                {/* Accuracy */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                      <Target className="w-4 h-4 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Accuracy</p>
                      <p className="text-[10px] text-gray-400">Correct answers</p>
                    </div>
                  </div>
                  <p className="text-base font-bold text-green-500">
                    {player.accuracy ? `${player.accuracy.toFixed(0)}%` : '—'}
                  </p>
                </div>

                {/* Win Rate */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center">
                      <Trophy className="w-4 h-4 text-[#FFB800]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Win Rate</p>
                      <p className="text-[10px] text-gray-400">Games won</p>
                    </div>
                  </div>
                  <p className="text-base font-bold text-[#FFB800]">
                    {player.winRate ? `${player.winRate.toFixed(0)}%` : 
                     player.gamesPlayed > 0 ? `${((player.wins / player.gamesPlayed) * 100).toFixed(0)}%` : '—'}
                  </p>
                </div>

                {/* Current Streak */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Current Streak</p>
                      <p className="text-[10px] text-gray-400">Days in a row</p>
                    </div>
                  </div>
                  <p className="text-base font-bold text-orange-500">
                    {player.currentStreak ? `🔥 ${player.currentStreak}` : '—'}
                  </p>
                </div>

                {/* Best Streak */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#D4873A]/10 flex items-center justify-center">
                      <Award className="w-4 h-4 text-[#D4873A]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Best Streak</p>
                      <p className="text-[10px] text-gray-400">Personal record</p>
                    </div>
                  </div>
                  <p className="text-base font-bold text-[#D4873A]">
                    {player.bestStreak ? `⭐ ${player.bestStreak}` : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Member Since */}
            <div className="flex items-center justify-center gap-1.5 py-4 text-gray-400 text-xs">
              <Calendar className="w-3.5 h-3.5" />
              <span>Member since {formatDate(player.createdAt)}</span>
            </div>

            {/* Challenge Button - only show if not viewing own profile */}
            {onChallenge && currentUserId && player._id !== currentUserId && (
              <div className="px-4 pb-6">
                <button
                  onClick={() => onChallenge(player._id, player.username)}
                  className="w-full py-3.5 bg-[#D4873A] hover:bg-[#C4772A] rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <Swords className="w-5 h-5" />
                  Challenge {player.username}
                </button>
              </div>
            )}

            {/* Bottom spacer */}
            <div className="h-6" />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <User className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500">Player not found</p>
          </div>
        )}
      </div>
    </div>
  );
}
