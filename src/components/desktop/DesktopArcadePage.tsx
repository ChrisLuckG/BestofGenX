"use client";

import { useState, useEffect } from "react";
import { Users, User, HelpCircle, Trophy, BarChart3, Coins, Zap, Play, LucideIcon, Swords } from "lucide-react";
import OpenBattlesModal from "../OpenBattlesModal";

interface DesktopArcadePageProps {
  onSelectGame: (game: 'quizzbattle' | 'trivia' | 'spacegenx' | 'memory' | 'prediction' | 'genxmen' | 'nextplay' | 'faceblur' | 'bogxinvaders') => void;
  onShowRankings?: () => void;
  userId?: string;
  battleAlertCount?: number;
  onCoinsChange?: (delta: number) => void;
  onPlaySpecificBattle?: (battleId: string) => void;
  onShowLogin?: () => void;
}

interface GameFeature {
  icon: LucideIcon;
  lines: [string, string];
}

interface GameBanner {
  game: 'quizzbattle' | 'trivia' | 'nextplay' | 'faceblur' | 'prediction' | 'bogxinvaders';
  image: string;
  badgeIcon: LucideIcon;
  badge: string;
  titleA: string;
  titleB: string;
  titleColor: string;
  subtitleA: string;
  subtitleB: string;
  features: GameFeature[];
  featureColor: string;
  comingSoon?: boolean;
  overlayColor?: string;
}

const GAMES: GameBanner[] = [
  {
    game: 'quizzbattle',
    image: '/images/Hintergund/battle.png',
    badgeIcon: Users,
    badge: 'Multiplayer',
    titleA: 'QUIZZ',
    titleB: 'BATTLE',
    titleColor: '#A855F7',
    subtitleA: 'Challenge real players.',
    subtitleB: 'Winner takes 2x wager!',
    features: [
      { icon: Users, lines: ['3 or 5', 'Rounds'] },
      { icon: Zap, lines: ['10 Sec', 'Per Question'] },
      { icon: Trophy, lines: ['High Score', 'Wins'] },
    ],
    featureColor: '#A855F7',
  },
  {
    game: 'trivia',
    image: '/images/Hintergund/solo.png',
    badgeIcon: User,
    badge: 'Single Player',
    titleA: 'SOLO',
    titleB: 'TRIVIA',
    titleColor: '#E36B11',
    subtitleA: '+0.30 per correct.',
    subtitleB: '-0.03 per wrong.',
    features: [
      { icon: HelpCircle, lines: ['10 or 20', 'Questions'] },
      { icon: Coins, lines: ['+0.30', 'Correct'] },
      { icon: Zap, lines: ['Beat the', 'Clock'] },
    ],
    featureColor: '#E5A55A',
  },
];

// Preload banner images to prevent slow loading
const PRELOAD_IMAGES = [
  '/images/Hintergund/battle.png',
  '/images/Hintergund/solo.png',
];

export default function DesktopArcadePage({ onSelectGame, userId, battleAlertCount = 0, onCoinsChange, onPlaySpecificBattle, onShowLogin }: DesktopArcadePageProps) {
  const [showOpenBattles, setShowOpenBattles] = useState(false);
  const [liveBattleCount, setLiveBattleCount] = useState(battleAlertCount);
  const [onlinePlayers, setOnlinePlayers] = useState(0);
  const [onlineLoading, setOnlineLoading] = useState(true);
  
  // Preload banner images on mount
  useEffect(() => {
    PRELOAD_IMAGES.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

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

  // Fetch live battle count when arcade is shown
  useEffect(() => {
    if (!userId) return;
    // Get count of pending + active battles needing attention
    fetch(`/api/battles?countOnly=true&userId=${userId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // pendingChallenges = incoming challenges to accept/deny
          // activeBattles = battles where you need to play
          const total = (data.pendingChallenges || 0) + (data.activeBattles || 0);
          setLiveBattleCount(total);
        }
      })
      .catch(() => {});
  }, [userId]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Header - same style as Feed/Articles */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#E36B11]/5 to-transparent">
        <div className="flex items-center gap-3">
          <Swords className="w-5 h-5 text-[#E36B11]" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">Trivia</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">Test your GenX knowledge!</span>
          </div>
        </div>
        {/* Open Battles button */}
        <button
          onClick={() => setShowOpenBattles(true)}
          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#A855F7]/40 bg-[#A855F7]/10 hover:bg-[#A855F7]/20 transition-colors"
        >
          <Swords className="w-4 h-4 text-[#A855F7]" />
          <span className="text-xs font-semibold text-[#A855F7]">Open Battles</span>
          {liveBattleCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
              {liveBattleCount}
            </span>
          )}
        </button>
      </div>

      {/* Open Battles Modal */}
      <OpenBattlesModal
        isOpen={showOpenBattles}
        onClose={() => setShowOpenBattles(false)}
        userId={userId || ''}
        onPlayBattle={(battleId) => { setShowOpenBattles(false); onPlaySpecificBattle?.(battleId) || onSelectGame('quizzbattle'); }}
        onCoinsChange={onCoinsChange}
        onShowLogin={onShowLogin}
        accentColor="purple"
      />

      {/* Vertical Stack Layout */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="flex flex-col gap-5 max-w-5xl mx-auto">
          
          {/* QuizzyBattle Banner - same style as Solo Trivia */}
          <button
            onClick={() => onSelectGame('quizzbattle')}
            className="group relative overflow-hidden rounded-2xl shadow-lg transition-all bg-cover bg-center hover:scale-[1.01] active:scale-[0.99]"
            style={{ backgroundImage: "url('/images/Hintergund/battle.png')", minHeight: '320px' }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent" />

            {/* Online Badge - top right */}
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20 z-10">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
              {onlineLoading ? (
                <div className="w-5 h-4 bg-white/30 rounded animate-pulse" />
              ) : (
                <span className="text-[14px] font-bold text-white">{onlinePlayers}</span>
              )}
              <span className="text-[10px] text-white/80 uppercase font-semibold">Online</span>
            </div>

            <div className="relative h-full flex flex-col justify-center items-start text-left px-8 py-6 max-w-[60%]">
              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 bg-black/50 backdrop-blur-sm border border-white/20 text-white text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                <Users className="w-3.5 h-3.5" />
                Multiplayer
              </div>

              {/* Title */}
              <h3 className="font-display text-[48px] leading-none tracking-wide mt-3">
                <span className="text-white">QUIZZ</span>
                <span className="text-[#A855F7]">BATTLE</span>
              </h3>

              {/* Subtitle */}
              <p className="text-white text-[16px] font-semibold leading-tight mt-2.5">
                Challenge real players.<br />
                <span className="text-[#A855F7]">Winner takes 2x wager!</span>
              </p>

              {/* Features */}
              <div className="flex items-center gap-5 mt-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#A855F7]" />
                  <span className="text-white/90 text-[12px] font-medium leading-tight">3 or 5<br/>Rounds</span>
                </div>
                <div className="w-px h-8 bg-white/25" />
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-[#A855F7]" />
                  <span className="text-white/90 text-[12px] font-medium leading-tight">10 Sec<br/>Per Question</span>
                </div>
                <div className="w-px h-8 bg-white/25" />
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-[#A855F7]" />
                  <span className="text-white/90 text-[12px] font-medium leading-tight">High Score<br/>Wins</span>
                </div>
              </div>

              {/* Wagers */}
              <div className="flex items-center gap-2 mt-4">
                <span className="text-white/70 text-[11px] uppercase font-bold">Wagers:</span>
                {[0.10, 0.25, 0.50, 0.75, 1.00].map((w) => (
                  <span key={w} className="px-2.5 py-1 rounded text-[12px] font-bold bg-transparent text-white border border-white/40">
                    {w.toFixed(2)}
                  </span>
                ))}
                <span className="text-white/60 text-[11px] ml-1">BOGX</span>
              </div>

              {/* Play Now + Tie */}
              <div className="flex items-center gap-4 mt-5">
                <div className="flex items-center gap-2 font-bold text-[14px] px-6 py-3 rounded-lg shadow-md bg-[#A855F7]">
                  <span className="text-white">PLAY NOW</span>
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                    <Play className="w-2.5 h-2.5 text-white fill-white ml-0.5" />
                  </span>
                </div>
                <span className="text-white/50 text-[11px]">Tie = coins back to both</span>
              </div>
            </div>
          </button>

          {/* Solo Trivia Banner */}
          {GAMES.filter(g => g.game === 'trivia').map((g) => {
            const BadgeIcon = g.badgeIcon;
            return (
              <button
                key={g.game}
                onClick={() => onSelectGame(g.game)}
                className="group relative overflow-hidden rounded-2xl shadow-lg transition-all bg-cover bg-center aspect-[2.5/1] hover:scale-[1.01] active:scale-[0.99]"
                style={{ backgroundImage: `url('${g.image}')` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent" />

                <div className="relative h-full flex flex-col justify-center items-start text-left px-8 py-6 max-w-[60%]">
                  {/* Badge */}
                  <div className="inline-flex items-center gap-1.5 bg-black/50 backdrop-blur-sm border border-white/20 text-white text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    <BadgeIcon className="w-3.5 h-3.5" />
                    {g.badge}
                  </div>

                  {/* Title */}
                  <h3 className="font-display text-[48px] leading-none tracking-wide mt-3">
                    <span className="text-white">{g.titleA}</span>{' '}
                    <span style={{ color: g.titleColor }}>{g.titleB}</span>
                  </h3>

                  {/* Subtitle */}
                  <p className="text-white text-[16px] font-semibold leading-tight mt-2.5">
                    {g.subtitleA}<br />
                    <span style={{ color: g.featureColor }}>{g.subtitleB}</span>
                  </p>

                  {/* Features */}
                  <div className="flex items-center gap-5 mt-4">
                    {g.features.map((f, i) => {
                      const FIcon = f.icon;
                      return (
                        <div key={i} className="flex items-center gap-2">
                          {i > 0 && <div className="w-px h-8 bg-white/25 -ml-3 mr-1" />}
                          <FIcon className="w-5 h-5 flex-shrink-0" style={{ color: g.featureColor }} />
                          <span className="text-white/90 text-[12px] font-medium leading-tight">
                            {f.lines[0]}<br />{f.lines[1]}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Play Now */}
                  <div 
                    className="flex items-center gap-2 mt-5 font-bold text-[14px] px-6 py-3 rounded-lg shadow-md transition-colors"
                    style={{ backgroundColor: g.titleColor }}
                  >
                    <span className="text-white">PLAY NOW</span>
                    <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                      <Play className="w-2.5 h-2.5 text-white fill-white ml-0.5" />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
