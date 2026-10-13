"use client";

import { useState, useEffect, useRef } from "react";
import { Trophy, Clock, Target, TrendingUp, Award, Calendar, Swords, User, ArrowUp, Coins, Layers } from "lucide-react";
import { ProfileSkeleton } from "@/components/desktop/DesktopSkeletons";
import BackButton from "./BackButton";
import CountryFlag from "./CountryFlag";
import { useBackButton } from "@/hooks/useBackButton";
import { getUserLevel, getLevelProgress, getBogxToNextLevel, getNextLevelName, getProgressSegments, LEVELS } from "@/utils/levels";
import { formatCurrency } from "@/utils/currency";
import CountUpNumber from "@/components/CountUpNumber";

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
  avgAnswerTime?: number | null; // milliseconds
  accuracy?: number | null;
  winRate?: number | null;
  quizzWins?: number;
  quizzLosses?: number;
  questionsAnswered?: number;
  questionsCorrect?: number;
  rank?: number;
  // Period rankings
  dailyRank?: number | null;
  dailyPoints?: number;
  monthlyRank?: number | null;
  monthlyPoints?: number;
  annuallyRank?: number | null;
  annuallyPoints?: number;
}

interface PlayerCardProps {
  isOpen: boolean;
  playerId: string | null;
  onClose: () => void;
  // avatar/countryFlag are already loaded on this page - passing them along
  // means the invite flow (player preview, VS banner, preparing screen) can
  // show the real photo/flag instead of falling back to an initial letter for
  // every step after the challenge button is clicked.
  onChallenge?: (playerId: string, username: string, avatar?: string, countryFlag?: string) => void;
  currentUserId?: string;
  isDesktop?: boolean;
}

export default function PlayerCard({ isOpen, playerId, onClose, onChallenge, currentUserId, isDesktop = false }: PlayerCardProps) {
  const [player, setPlayer] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Battle record (W/L/D, net, best topic) and - when looking at someone else - your
  // own record against them. Loaded beside the main stats so the page is not held up.
  const [battle, setBattle] = useState<any>(null);
  const [h2h, setH2h] = useState<{ wins: number; losses: number; ties: number } | null>(null);
  useEffect(() => {
    setBattle(null);
    setH2h(null);
    if (!isOpen || !playerId) return;
    let cancelled = false;
    fetch(`/api/user/battle-stats?userId=${playerId}`).then(r => r.json()).then(d => { if (!cancelled && d.success) setBattle(d); }).catch(() => {});
    if (currentUserId && currentUserId !== playerId) {
      fetch(`/api/users/battle-info?ids=${currentUserId},${playerId}`).then(r => r.json()).then(d => {
        const rec = d.h2h?.record;
        if (!cancelled && rec) setH2h({ wins: rec.wins, losses: rec.losses, ties: rec.ties || 0 });
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [isOpen, playerId, currentUserId]);

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
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-warm bg-cream">
        <BackButton onClick={onClose} />
        <User className="w-5 h-5 text-[#E36B11]" />
        <div>
          <span className="font-display text-lg tracking-wider text-gray-900 block leading-none uppercase">Player Profile</span>
          <span className="text-[10px] text-gray-500 -mt-0.5 block">View stats and achievements</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {loading ? (
          <ProfileSkeleton />
        ) : player ? (
          <>
            {/* Profile Header Card. Sizing below is deliberately smaller on
                desktop (isDesktop) - this page was using the exact same
                phone-sized avatar, gradient band and paddings on desktop, which
                just meant more empty space, not more content. Mobile is
                untouched. */}
            <div className={`mx-4 ${isDesktop ? 'mt-3' : 'mt-4'} rounded-2xl shadow-sm border border-warm overflow-hidden ${isDesktop ? 'bg-[#F5F0E8]' : 'bg-white'}`}>
              {/* Background Gradient */}
              <div className={isDesktop ? 'h-24' : 'h-20'} style={{ background: 'linear-gradient(to bottom right, rgba(227,107,17,0.25), rgba(227,107,17,0.1), transparent)' }} />
              
              {/* Avatar & Name */}
              <div className={`px-5 relative ${isDesktop ? 'pb-5 -mt-12' : 'pb-5 -mt-12'}`}>
                <div className="flex items-end gap-3">
                  <div className="relative flex-shrink-0">
                    {/* Outer orange ring */}
                    <div className={`rounded-full p-1 bg-gradient-to-br from-[#E36B11] to-[#E36B11]/70 shadow-lg ${isDesktop ? 'w-24 h-24' : 'w-[100px] h-[100px]'}`}>
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
                      <div className={`absolute -top-1 -right-1 rounded-full flex items-center justify-center shadow-md border-2 border-white ${isDesktop ? 'w-9 h-9' : 'w-9 h-9'} ${
                        player.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-amber-600' :
                        player.rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                        player.rank === 3 ? 'bg-gradient-to-br from-amber-600 to-amber-800' :
                        'bg-[#E36B11]'
                      }`}>
                        <span className={`font-display text-white ${isDesktop ? 'text-sm' : 'text-sm'}`}>#<CountUpNumber value={player.rank} delayMs={100} durationMs={900} /></span>
                      </div>
                    )}
                  </div>
                  <div className="pb-1 flex-1 min-w-0">
                    <h2 className={`font-display tracking-wide text-gray-900 truncate ${isDesktop ? 'text-4xl' : 'text-2xl'}`}>{player.username}</h2>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <CountryFlag flag={player.countryFlag} className={isDesktop ? 'w-7 h-5 rounded-[2px]' : 'w-5 h-4 rounded-[2px]'} />
                      <span className={isDesktop ? 'text-lg text-gray-500' : 'text-sm text-gray-500'}>{player.country || 'World'}</span>
                    </div>
                  </div>
                  {/* BOGX Balance - prominent on right */}
                  <div className="flex flex-col items-end justify-center">
                    <div className="flex items-center gap-2">
                      <img src="/images/bogxcoin.png" alt="" className={isDesktop ? 'w-11 h-11' : 'w-8 h-8'} />
                      <div className="text-right">
                        <span className={`font-display tracking-wide text-[#E36B11] ${isDesktop ? 'text-5xl' : 'text-3xl'}`}><CountUpNumber value={player.points} format={formatCurrency} delayMs={150} durationMs={1300} /></span>
                        <div className={`font-display tracking-widest uppercase text-gray-400 ${isDesktop ? 'text-xs mt-0.5' : 'text-[11px]'}`}>BOGX</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rankings Row - Daily / Monthly / Annually */}
                <div className={`grid grid-cols-3 gap-2 border-t border-warm/50 ${isDesktop ? 'mt-5 pt-5' : 'mt-4 pt-4'}`}>
                  <div className="text-center">
                    <div className={`font-display tracking-widest uppercase text-gray-400 mb-1 ${isDesktop ? 'text-sm' : 'text-[11px]'}`}>Day</div>
                    <div className="flex items-center justify-center gap-0.5">
                      <span className={`font-display tracking-wide text-gray-900 ${isDesktop ? 'text-5xl' : 'text-2xl'}`}>
                        {player.dailyRank ? <CountUpNumber value={player.dailyRank} delayMs={350} /> : '—'}
                      </span>
                    </div>
                    {player.dailyPoints !== undefined && player.dailyPoints > 0 && (
                      <div className={`font-display tracking-wide text-green-600 ${isDesktop ? 'text-lg' : 'text-[13px]'}`}>+<CountUpNumber value={player.dailyPoints} format={formatCurrency} delayMs={450} /></div>
                    )}
                  </div>
                  <div className="text-center border-x border-warm/50">
                    <div className={`font-display tracking-widest uppercase text-gray-400 mb-1 ${isDesktop ? 'text-sm' : 'text-[11px]'}`}>Month</div>
                    <div className="flex items-center justify-center gap-0.5">
                      <span className={`font-display tracking-wide text-gray-900 ${isDesktop ? 'text-5xl' : 'text-2xl'}`}>
                        {player.monthlyRank ? <CountUpNumber value={player.monthlyRank} delayMs={450} /> : '—'}
                      </span>
                    </div>
                    {player.monthlyPoints !== undefined && player.monthlyPoints > 0 && (
                      <div className={`font-display tracking-wide text-green-600 ${isDesktop ? 'text-lg' : 'text-[13px]'}`}>+<CountUpNumber value={player.monthlyPoints} format={formatCurrency} delayMs={550} /></div>
                    )}
                  </div>
                  <div className="text-center">
                    <div className={`font-display tracking-widest uppercase text-gray-400 mb-1 ${isDesktop ? 'text-sm' : 'text-[11px]'}`}>Year</div>
                    <div className="flex items-center justify-center gap-0.5">
                      <span className={`font-display tracking-wide text-gray-900 ${isDesktop ? 'text-5xl' : 'text-2xl'}`}>
                        {player.annuallyRank ? <CountUpNumber value={player.annuallyRank} delayMs={550} /> : '—'}
                      </span>
                    </div>
                    {player.annuallyPoints !== undefined && player.annuallyPoints > 0 && (
                      <div className={`font-display tracking-wide text-green-600 ${isDesktop ? 'text-lg' : 'text-[13px]'}`}>+<CountUpNumber value={player.annuallyPoints} format={formatCurrency} delayMs={650} /></div>
                    )}
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
                <div className={`mx-4 mt-2.5 rounded-2xl shadow-sm border border-warm overflow-hidden ${isDesktop ? 'bg-[#F5F0E8]' : 'bg-white'}`}>
                  <div className={isDesktop ? 'px-5 py-4' : 'p-4'}>
                    <div style={{ color: level.color }} className={`font-display tracking-wider ${isDesktop ? 'text-lg' : 'text-sm'}`}>{level.name.toUpperCase()}</div>
                    <div className={`flex items-center gap-3 ${isDesktop ? 'mt-2.5' : 'mt-2'}`}>
                      {/* Segmented Progress Bar - Animated */}
                      <div className="flex gap-1 flex-1">
                        {[...Array(10)].map((_, i) => (
                          <div 
                            key={i} 
                            className={`flex-1 rounded-sm ${isDesktop ? 'h-3' : 'h-2.5'}`}
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
                      <span className={`font-display tracking-wide animate-fade-in ${isDesktop ? 'text-3xl' : 'text-lg'}`} style={{ color: level.color, animationDelay: '600ms' }}><CountUpNumber value={progress} delayMs={600} durationMs={1000} />%</span>
                    </div>
                    <div className={`text-gray-600 mt-2 animate-fade-in ${isDesktop ? 'text-sm' : 'text-[10px]'}`} style={{ animationDelay: '700ms' }}>
                      <CountUpNumber value={playerBogx} format={formatCurrency} delayMs={700} /> BOGX · {nextName ? (
                        <><CountUpNumber value={toNext} format={formatCurrency} delayMs={800} /> to <span style={{ color: level.color }} className="font-semibold">{nextName}</span></>
                      ) : (
                        <span style={{ color: level.color }} className="font-semibold">Max Level!</span>
                      )}
                    </div>
                    
                    {/* Level Steps - Animated. Desktop drops this row entirely - it
                        is decorative context that repeats the level name already
                        shown above, and cutting it is real vertical space back. */}
                    {!isDesktop && (
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
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Main Stats - Card */}
            <div className={`mx-4 mt-2.5 rounded-2xl shadow-sm border border-warm overflow-hidden ${isDesktop ? 'bg-[#F5F0E8]' : 'bg-white'}`}>
              <div className="grid grid-cols-3 divide-x divide-warm">
                <div className={`text-center ${isDesktop ? 'p-5' : 'p-4'}`}>
                  <p className={`font-display tracking-wide text-gray-900 ${isDesktop ? 'text-5xl' : 'text-3xl'}`}><CountUpNumber value={player.points} format={(n) => n.toLocaleString()} delayMs={400} durationMs={1200} /></p>
                  <p className={`font-display text-gray-500 uppercase tracking-wider mt-1 ${isDesktop ? 'text-sm' : 'text-[11px]'}`}>BOGX</p>
                </div>
                <div className={`text-center ${isDesktop ? 'p-5' : 'p-4'}`}>
                  <p className={`font-display tracking-wide text-gray-900 ${isDesktop ? 'text-5xl' : 'text-3xl'}`}><CountUpNumber value={player.wins} delayMs={500} durationMs={1200} /></p>
                  <p className={`font-display text-gray-500 uppercase tracking-wider mt-1 ${isDesktop ? 'text-sm' : 'text-[11px]'}`}>Wins</p>
                </div>
                <div className={`text-center ${isDesktop ? 'p-5' : 'p-4'}`}>
                  <p className={`font-display tracking-wide text-gray-900 ${isDesktop ? 'text-5xl' : 'text-3xl'}`}><CountUpNumber value={player.gamesPlayed} delayMs={600} durationMs={1200} /></p>
                  <p className={`font-display text-gray-500 uppercase tracking-wider mt-1 ${isDesktop ? 'text-sm' : 'text-[11px]'}`}>Games</p>
                </div>
              </div>
            </div>

            {/* Performance Stats - Card. Two columns on desktop instead of one
                long list - same rows, half the height, and it now fits above the
                fold next to a compact header instead of needing a scroll. */}
            <div className={`mx-4 mt-2.5 rounded-2xl shadow-sm border border-warm overflow-hidden ${isDesktop ? 'bg-[#F5F0E8]' : 'bg-white'}`}>
              <div className={`border-b border-warm/60 ${isDesktop ? 'px-5 py-3' : 'px-4 py-3'}`}>
                <h3 className={`font-display tracking-widest uppercase text-gray-500 flex items-center gap-1.5 ${isDesktop ? 'text-sm' : 'text-[11px]'}`}>
                  <TrendingUp className="w-3 h-3 text-[#E36B11]" />
                  Performance Stats
                </h3>
              </div>
              
              <div className={isDesktop ? 'grid grid-cols-2 divide-x divide-y divide-warm/60' : 'divide-y divide-warm/60'}>
                {(() => {
                  // Only things that exist in the data. The streak rows had no data behind
                  // them (the API returned null for both, "TODO"), so they always read "—".
                  const dash = '—';
                  // Every figure counts up from 0, row after row
                  const cu = (v: number, d: number, f: (n: number) => string = (n) => String(Math.round(n))) => <CountUpNumber value={v} delayMs={d} durationMs={1000} format={f} />;
                  const int = (n: number) => Math.round(n).toLocaleString();
                  const played = battle?.played ?? ((player.quizzWins ?? 0) + (player.quizzLosses ?? 0));
                  const wonN = player.quizzWins ?? battle?.wins ?? 0;
                  const lostN = player.quizzLosses ?? battle?.losses ?? 0;
                  const topics: { label: string; played: number; winRate: number }[] = battle?.topics || [];
                  // Best topic = best win rate, but only with 3+ battles - 1 of 1 is not a strength
                  const best = [...topics].filter(t => t.played >= 3).sort((a, b) => b.winRate - a.winRate || b.played - a.played)[0];
                  const net: number | null = battle ? battle.net : null;
                  const rows: { icon: any; title: string; sub: React.ReactNode; value: React.ReactNode; wide?: boolean }[] = [
                    {
                      icon: Clock, title: 'Avg. Answer Time', sub: 'Speed matters!',
                      // The API sends milliseconds
                      value: player.avgAnswerTime != null ? cu(player.avgAnswerTime / 1000, 700, (n) => `${n.toFixed(1)}s`) : dash,
                    },
                    {
                      icon: Target, title: 'Accuracy',
                      sub: player.questionsAnswered ? <>{cu(player.questionsCorrect ?? 0, 800, int)} of {cu(player.questionsAnswered, 800, int)} correct</> : 'Correct answers',
                      value: player.accuracy != null ? cu(player.accuracy, 800, (n) => `${Math.round(n)}%`) : dash,
                    },
                    {
                      icon: Trophy, title: 'Battle Win Rate',
                      sub: played > 0 ? <>{cu(wonN, 900, int)} won · {cu(lostN, 900, int)} lost</> : 'No battles yet',
                      value: played > 0 && player.winRate != null ? cu(player.winRate, 900, (n) => `${Math.round(n)}%`) : dash,
                    },
                    {
                      icon: Swords, title: 'Battles',
                      sub: battle ? <>{cu(battle.wins, 1000, int)} W · {cu(battle.losses, 1000, int)} L · {cu(battle.draws, 1000, int)} D</> : 'QuizzBattle record',
                      value: played > 0 ? cu(played, 1000, int) : dash,
                    },
                    {
                      icon: Coins, title: 'Battle Earnings', sub: 'Won minus lost wagers',
                      value: net == null ? dash : (
                        <span className={net > 0 ? 'text-green-600' : net < 0 ? 'text-red-500' : ''}>
                          {cu(net, 1100, (n) => `${net > 0 ? '+' : ''}${formatCurrency(n)}`)}
                        </span>
                      ),
                    },
                    {
                      icon: Award, title: 'Best Topic',
                      sub: best ? <>{cu(best.winRate, 1200, (n) => `${Math.round(n)}%`)} of {cu(best.played, 1200, int)} battles won</> : 'Needs 3+ battles in a topic',
                      value: best ? best.label : dash,
                    },
                    ...(h2h ? [{
                      icon: Layers, title: 'You vs. ' + player.username, sub: 'Your record against them',
                      value: h2h.wins + h2h.losses + h2h.ties > 0
                        ? <span><span className="text-green-600">{cu(h2h.wins, 1300)}</span> – <span className="text-red-500">{cu(h2h.losses, 1300)}</span>{h2h.ties > 0 && <span className="text-gray-500"> – {cu(h2h.ties, 1300)}</span>}</span>
                        : dash,
                      wide: true,
                    }] : []),
                  ];
                  return rows.map(r => {
                    const Icon = r.icon;
                    return (
                      <div key={r.title} className={`flex items-center justify-between ${isDesktop ? 'px-5 py-4' : 'px-4 py-3'} ${r.wide && isDesktop ? 'col-span-2' : ''}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`rounded-lg bg-[#E36B11]/10 flex items-center justify-center flex-shrink-0 ${isDesktop ? 'w-11 h-11' : 'w-8 h-8'}`}>
                            <Icon className={`text-[#E36B11]/70 ${isDesktop ? 'w-5 h-5' : 'w-4 h-4'}`} />
                          </div>
                          <div className="min-w-0">
                            <p className={`font-display text-gray-900 truncate ${isDesktop ? 'text-lg' : 'text-sm'}`}>{r.title}</p>
                            <p className={`text-gray-400 truncate ${isDesktop ? 'text-sm' : 'text-[10px]'}`}>{r.sub}</p>
                          </div>
                        </div>
                        <p className={`font-display tracking-wide text-gray-900 flex-shrink-0 ml-2 ${isDesktop ? 'text-4xl' : 'text-xl'}`}>{r.value}</p>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Member Since */}
            <div className={`flex items-center justify-center gap-1.5 text-gray-400 ${isDesktop ? 'py-4 text-sm' : 'py-4 text-xs'}`}>
              <Calendar className="w-3.5 h-3.5" />
              <span>Member since {formatDate(player.createdAt)}</span>
            </div>

            {/* Challenge Button - only show if not viewing own profile */}
            {onChallenge && currentUserId && player._id !== currentUserId && (
              <div className={`px-4 ${isDesktop ? 'pb-4' : 'pb-6'}`}>
                <button
                  onClick={() => onChallenge(player._id, player.username, player.avatar, player.countryFlag)}
                  className={`w-full bg-[#E36B11] hover:bg-[#C4772A] rounded-2xl text-white font-display tracking-wide flex items-center justify-center gap-2 transition-colors shadow-sm ${isDesktop ? 'py-4 text-lg' : 'py-3.5 text-base'}`}
                >
                  <Swords className="w-5 h-5" />
                  Challenge {player.username}
                </button>
              </div>
            )}

            {/* Bottom spacer */}
            <div className={isDesktop ? 'h-3' : 'h-6'} />
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
