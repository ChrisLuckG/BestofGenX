"use client";

import { useState, useEffect } from "react";
import { Users, User, HelpCircle, Trophy, BarChart3, Coins, Zap, Play, LucideIcon, Radio, Clock, Target, Lightbulb, Swords, Crosshair } from "lucide-react";
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
    subtitleB: 'Win their bet!',
    features: [
      { icon: Users, lines: ['Real', 'Opponents'] },
      { icon: Trophy, lines: ['Big', 'Rewards'] },
      { icon: BarChart3, lines: ['Climb', 'Rankings'] },
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
    titleColor: '#D4873A',
    subtitleA: '+0.30 per correct.',
    subtitleB: '-0.03 per wrong.',
    features: [
      { icon: HelpCircle, lines: ['10 or 20', 'Questions'] },
      { icon: Coins, lines: ['+0.30', 'Correct'] },
      { icon: Zap, lines: ['Beat the', 'Clock'] },
    ],
    featureColor: '#E5A55A',
  },
  {
    game: 'bogxinvaders',
    image: '/images/Hintergund/hamster.png',
    badgeIcon: User,
    badge: 'Single Player',
    titleA: 'BOGX',
    titleB: 'INVADERS',
    titleColor: '#760b79',
    subtitleA: 'Shoot the hamster wheels!',
    subtitleB: '+0.01 BOGX per kill.',
    features: [
      { icon: Crosshair, lines: ['Arcade', 'Shooter'] },
      { icon: Coins, lines: ['Real-time', 'Rewards'] },
      { icon: Trophy, lines: ['Beat the', 'Boss'] },
    ],
    featureColor: '#760b79',
    overlayColor: 'none',
  },
  {
    game: 'nextplay',
    image: '/images/Hintergund/nextplay.png',
    badgeIcon: User,
    badge: 'Single Player',
    titleA: 'NEXT',
    titleB: 'PLAY',
    titleColor: '#22C55E',
    subtitleA: 'Call the next play.',
    subtitleB: 'Win BOGX and cash rewards.',
    features: [
      { icon: Radio, lines: ['Live', 'Events'] },
      { icon: Coins, lines: ['Instant', 'Rewards'] },
      { icon: Trophy, lines: ['Top', 'Predictors'] },
    ],
    featureColor: '#22C55E',
    comingSoon: true,
  },
  {
    game: 'faceblur',
    image: '/images/Hintergund/facemash.png',
    badgeIcon: User,
    badge: 'Single Player',
    titleA: 'FACE',
    titleB: 'BLUR',
    titleColor: '#DC2626',
    subtitleA: 'Recognize the face.',
    subtitleB: 'Before it becomes clear.',
    features: [
      { icon: Clock, lines: ['20', 'Seconds'] },
      { icon: User, lines: ['Famous', 'Faces'] },
      { icon: Trophy, lines: ['Beat the', 'Clock'] },
    ],
    featureColor: '#DC2626',
    comingSoon: true,
  },
  {
    game: 'prediction',
    image: '/images/Hintergund/predict.png',
    badgeIcon: User,
    badge: 'Single Player',
    titleA: 'PREDICT',
    titleB: 'IONS',
    titleColor: '#84CC16',
    subtitleA: 'Predict the outcome.',
    subtitleB: 'Prove you know.',
    features: [
      { icon: Lightbulb, lines: ['Make', 'Predictions'] },
      { icon: Target, lines: ['Earn', 'BOGX'] },
      { icon: BarChart3, lines: ['Top', 'Predictors'] },
    ],
    featureColor: '#84CC16',
    comingSoon: true,
  },
];

export default function DesktopArcadePage({ onSelectGame, userId, battleAlertCount = 0, onCoinsChange, onPlaySpecificBattle, onShowLogin }: DesktopArcadePageProps) {
  const [showOpenBattles, setShowOpenBattles] = useState(false);
  const [liveBattleCount, setLiveBattleCount] = useState(battleAlertCount);

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
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#D4873A]/5 to-transparent">
        <div className="flex items-center gap-3">
          <Swords className="w-5 h-5 text-[#D4873A]" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">Arcade</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">Challenge yourself & others</span>
          </div>
        </div>
        {/* Open Battles button */}
        <button
          onClick={() => setShowOpenBattles(true)}
          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D4873A]/40 bg-[#D4873A]/10 hover:bg-[#D4873A]/20 transition-colors"
        >
          <Swords className="w-4 h-4 text-[#D4873A]" />
          <span className="text-xs font-semibold text-[#D4873A]">Open Battles</span>
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
      />

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="grid grid-cols-2 gap-5 max-w-5xl">
          {GAMES.map((g) => {
            const BadgeIcon = g.badgeIcon;
            return (
              <button
                key={g.game}
                onClick={() => !g.comingSoon && onSelectGame(g.game)}
                disabled={g.comingSoon}
                className={`group relative overflow-hidden rounded-2xl shadow-md transition-all bg-cover bg-center aspect-[16/9] ${
                  g.comingSoon ? 'cursor-default opacity-80' : 'hover:scale-[1.02] active:scale-[0.99]'
                }`}
                style={{ backgroundImage: `url('${g.image}')` }}
              >
                {/* Left fade for text readability */}
                {g.overlayColor !== 'none' && (
                  <div 
                    className="absolute inset-0 bg-gradient-to-r to-transparent" 
                    style={{ 
                      background: g.overlayColor 
                        ? `linear-gradient(to right, ${g.overlayColor}cc, ${g.overlayColor}70, transparent)`
                        : 'linear-gradient(to right, rgba(0,0,0,0.85), rgba(0,0,0,0.45), transparent)'
                    }}
                  />
                )}

                <div className="relative h-full flex flex-col justify-center items-start text-left px-6 py-5 max-w-[70%]">
                  {/* Badge */}
                  <div className="inline-flex items-center gap-1 bg-black/50 backdrop-blur-sm border border-white/20 text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    <BadgeIcon className="w-3 h-3" />
                    {g.badge}
                  </div>

                  {/* Title */}
                  <h3 className="font-display text-[38px] leading-none tracking-wide mt-2.5">
                    <span className="text-white">{g.titleA}</span>
                    {(g.titleA === 'SOLO' || g.titleA === 'NEXT') && ' '}
                    <span style={{ color: g.titleColor }}>{g.titleB}</span>
                  </h3>

                  {/* Subtitle */}
                  <p className="text-white text-[14px] font-semibold leading-tight mt-2">
                    {g.subtitleA}<br />
                    <span style={{ color: g.featureColor }}>{g.subtitleB}</span>
                  </p>

                  {/* Features */}
                  <div className="flex items-center gap-4 mt-3.5">
                    {g.features.map((f, i) => {
                      const FIcon = f.icon;
                      return (
                        <div key={i} className="flex items-center gap-1.5">
                          {i > 0 && <div className="w-px h-7 bg-white/25 -ml-2.5 mr-1" />}
                          <FIcon className="w-4 h-4 flex-shrink-0" style={{ color: g.featureColor }} />
                          <span className="text-white/90 text-[11px] font-medium leading-tight">
                            {f.lines[0]}<br />{f.lines[1]}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Play Now or Coming Soon */}
                  {g.comingSoon ? (
                    <div className="flex items-center gap-1.5 mt-4 bg-black/50 backdrop-blur-sm border border-white/30 px-4 py-2 rounded-lg">
                      <Clock className="w-4 h-4 text-white" />
                      <span className="text-white text-[12px] font-semibold uppercase tracking-wider">Coming Soon</span>
                    </div>
                  ) : (
                    <div 
                      className="flex items-center gap-2 mt-4 font-bold text-[13px] px-5 py-2.5 rounded-lg shadow-sm transition-colors"
                      style={{ backgroundColor: g.titleColor }}
                    >
                      <span className="text-white">PLAY NOW</span>
                      <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                        <Play className="w-2.5 h-2.5 text-white fill-white ml-0.5" />
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
