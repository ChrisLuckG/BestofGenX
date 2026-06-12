"use client";

import { Users, User, HelpCircle, Trophy, BarChart3, Coins, Zap, Play, LucideIcon, Radio, Clock, Target, Lightbulb, Swords } from "lucide-react";

interface DesktopArcadePageProps {
  onSelectGame: (game: 'quizzbattle' | 'trivia' | 'spacegenx' | 'memory' | 'prediction' | 'genxmen' | 'nextplay' | 'faceblur') => void;
  onShowRankings?: () => void;
}

interface GameFeature {
  icon: LucideIcon;
  lines: [string, string];
}

interface GameBanner {
  game: 'quizzbattle' | 'trivia' | 'nextplay' | 'faceblur' | 'prediction';
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

export default function DesktopArcadePage({ onSelectGame }: DesktopArcadePageProps) {
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
        {/* Placeholder for consistent spacing */}
        <div className="w-48" />
      </div>

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
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent" />

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
