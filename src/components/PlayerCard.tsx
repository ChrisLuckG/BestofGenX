"use client";

import { useState, useEffect, useRef } from "react";
import { Trophy, Clock, Target, TrendingUp, Award, Calendar, Swords, User } from "lucide-react";
import { ProfileSkeleton } from "@/components/desktop/DesktopSkeletons";
import BackButton from "./BackButton";
import CountryFlag from "./CountryFlag";
import { useBackButton } from "@/hooks/useBackButton";
import { getUserLevel, getLevelProgress, getBogxToNextLevel, getNextLevelName, getProgressSegments, LEVELS } from "@/utils/levels";
import { formatCurrency } from "@/utils/currency";

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

  // Desktop: render inline in content area (full width, no popup)
  // Mobile: render as absolute overlay with slide animation
  return (
    <div 
      className={isDesktop 
        ? "w-full h-full flex flex-col bg-[#F5F0E8]" 
        : "absolute inset-0 z-20 flex flex-col bg-cream animate-slide-in-right"
      }
    >
      {/* Header - consistent style like other pages */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#E36B11]/5 to-transparent">
        <BackButton onClick={onClose} />
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-[#E36B11]" />
          <span className="font-display text-lg tracking-wider text-gray-900 uppercase">
            Player Profile
          </span>
        </div>
        {/* Rank & Score Badge */}
        {player && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#E36B11]/10 border border-[#E36B11]/30 rounded-lg">
            <span className="text-sm font-bold text-[#E36B11]">#{player.rank || '—'}</span>
            <div className="w-px h-4 bg-[#E36B11]/30" />
            <img src="/images/bogxcoin.png" alt="" className="w-5 h-5" />
            <span className="text-sm font-bold text-[#E36B11]">{player.points.toFixed(2)}</span>
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
            <div className={`mx-4 mt-4 rounded-2xl shadow-sm border border-warm overflow-hidden ${isDesktop ? 'bg-[#F5F0E8]' : 'bg-white'}`}>
              {/* Background Gradient */}
              <div className="h-20 bg-gradient-to-br from-[#E36B11]/25 via-[#E36B11]/10 to-transparent" />
              
              {/* Avatar & Name */}
              <div className="px-5 pb-5 -mt-12 relative">
                <div className="flex items-end gap-4">
                  <div className="relative">
                    {/* Outer orange ring */}
                    <div className="w-[100px] h-[100px] rounded-full p-1 bg-gradient-to-br from-[#E36B11] to-[#E36B11]/70 shadow-lg">
                      <div className="w-full h-full rounded-full overflow-hidden border-[3px] border-white bg-white">
                        <img 
                          src={player.avatar || `https://i.pravatar.cc/200?u=${player._id}`} 
                          alt={player.username}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    {/* Rank Badge */}
                    {player.rank && (
                      <div className={`absolute -top-1 -right-1 w-9 h-9 rounded-full flex items-center justify-center shadow-md border-2 border-white ${
                        player.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-amber-600' :
                        player.rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                        player.rank === 3 ? 'bg-gradient-to-br from-amber-600 to-amber-800' :
                        'bg-[#E36B11]'
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

            {/* Level Progress - Card */}
            {(() => {
              const playerBogx = player.points;
              const level = getUserLevel(playerBogx);
              const progress = getLevelProgress(playerBogx);
              const segments = getProgressSegments(playerBogx);
              const toNext = getBogxToNextLevel(playerBogx);
              const nextName = getNextLevelName(playerBogx);
              
              return (
                <div className={`mx-4 mt-3 rounded-2xl shadow-sm border border-warm overflow-hidden ${isDesktop ? 'bg-[#F5F0E8]' : 'bg-white'}`}>
                  <div className="p-4">
                    <div style={{ color: level.color }} className="font-bold text-sm">{level.name.toUpperCase()}</div>
                    <div className="flex items-center gap-3 mt-2">
                      {/* Segmented Progress Bar - Animated */}
                      <div className="flex gap-1 flex-1">
                        {[...Array(10)].map((_, i) => (
                          <div 
                            key={i} 
                            className="flex-1 h-2.5 rounded-sm"
                            style={{
                              backgroundColor: i < segments ? level.color : '#D1D5DB',
                              transformOrigin: 'left',
                              opacity: i >= segments ? 0.5 : 0,
                              transform: i >= segments ? 'scaleX(1)' : 'scaleX(0)',
                              animation: i < segments ? `progressFill 0.3s ease-out ${i * 80}ms forwards` : 'none',
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-bold animate-fade-in" style={{ color: level.color, animationDelay: '600ms' }}>{progress}%</span>
                    </div>
                    <div className="text-[10px] text-gray-600 mt-1.5 animate-fade-in" style={{ animationDelay: '700ms' }}>
                      {formatCurrency(playerBogx)} BOGX · {nextName ? (
                        <>{formatCurrency(toNext)} to <span style={{ color: level.color }} className="font-semibold">{nextName}</span></>
                      ) : (
                        <span style={{ color: level.color }} className="font-semibold">Max Level!</span>
                      )}
                    </div>
                    
                    {/* Level Steps - Animated */}
                    <div className="flex items-center gap-1.5 mt-2 text-[8px] text-gray-500 flex-wrap">
                      {LEVELS.map((l, i) => (
                        <span key={l.name} className="animate-fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
                          {i > 0 && <span className="mx-0.5">•</span>}
                          <span style={{ color: l.name === level.name ? level.color : undefined, fontWeight: l.name === level.name ? 'bold' : undefined }}>
                            {l.name.toUpperCase()}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Main Stats - Card */}
            <div className={`mx-4 mt-3 rounded-2xl shadow-sm border border-warm overflow-hidden ${isDesktop ? 'bg-[#F5F0E8]' : 'bg-white'}`}>
              <div className="grid grid-cols-3 divide-x divide-warm">
                <div className="p-4 text-center">
                  <p className="text-2xl font-black text-gray-900">{player.points.toLocaleString()}</p>
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mt-1">BOGX</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-2xl font-black text-gray-900">{player.wins}</p>
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mt-1">Wins</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-2xl font-black text-gray-900">{player.gamesPlayed}</p>
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mt-1">Games</p>
                </div>
              </div>
            </div>

            {/* Performance Stats - Card */}
            <div className={`mx-4 mt-3 rounded-2xl shadow-sm border border-warm overflow-hidden ${isDesktop ? 'bg-[#F5F0E8]' : 'bg-white'}`}>
              <div className="px-4 py-3 border-b border-warm/60">
                <h3 className="text-[10px] font-bold tracking-widest uppercase text-gray-500 flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3 text-[#E36B11]" />
                  Performance Stats
                </h3>
              </div>
              
              <div className="divide-y divide-warm/60">
                {/* Average Answer Time */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#E36B11]/10 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-[#E36B11]/70" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Avg. Answer Time</p>
                      <p className="text-[10px] text-gray-400">Speed matters!</p>
                    </div>
                  </div>
                  <p className="text-base font-bold text-gray-900">
                    {player.avgAnswerTime ? `${player.avgAnswerTime.toFixed(1)}s` : '—'}
                  </p>
                </div>

                {/* Accuracy */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#E36B11]/10 flex items-center justify-center">
                      <Target className="w-4 h-4 text-[#E36B11]/70" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Accuracy</p>
                      <p className="text-[10px] text-gray-400">Correct answers</p>
                    </div>
                  </div>
                  <p className="text-base font-bold text-gray-900">
                    {player.accuracy ? `${player.accuracy.toFixed(0)}%` : '—'}
                  </p>
                </div>

                {/* Win Rate */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#E36B11]/10 flex items-center justify-center">
                      <Trophy className="w-4 h-4 text-[#E36B11]/70" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Win Rate</p>
                      <p className="text-[10px] text-gray-400">Games won</p>
                    </div>
                  </div>
                  <p className="text-base font-bold text-gray-900">
                    {player.winRate ? `${player.winRate.toFixed(0)}%` : 
                     player.gamesPlayed > 0 ? `${((player.wins / player.gamesPlayed) * 100).toFixed(0)}%` : '—'}
                  </p>
                </div>

                {/* Current Streak */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#E36B11]/10 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-[#E36B11]/70" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Current Streak</p>
                      <p className="text-[10px] text-gray-400">Days in a row</p>
                    </div>
                  </div>
                  <p className="text-base font-bold text-gray-900">
                    {player.currentStreak ? `🔥 ${player.currentStreak}` : '—'}
                  </p>
                </div>

                {/* Best Streak */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#E36B11]/10 flex items-center justify-center">
                      <Award className="w-4 h-4 text-[#E36B11]/70" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Best Streak</p>
                      <p className="text-[10px] text-gray-400">Personal record</p>
                    </div>
                  </div>
                  <p className="text-base font-bold text-gray-900">
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
                  className="w-full py-3.5 bg-[#E36B11] hover:bg-[#C4772A] rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 transition-colors shadow-sm"
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
