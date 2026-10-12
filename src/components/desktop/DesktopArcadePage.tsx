"use client";

import { useState, useEffect } from "react";
import { Users, User, HelpCircle, Trophy, BarChart3, Coins, Zap, Play, LucideIcon, Swords, Brain, Info, PlusCircle, XCircle, ArrowRight } from "lucide-react";
import OpenBattlesModal from "../OpenBattlesModal";

interface DesktopArcadePageProps {
  onSelectGame: (game: 'quizzbattle' | 'trivia' | 'spacegenx' | 'memory' | 'genxmen' | 'nextplay' | 'faceblur' | 'bogxinvaders') => void;
  onShowRankings?: () => void;
  userId?: string;
  battleAlertCount?: number;
  onCoinsChange?: (delta: number, variant?: 'gain' | 'loss' | 'hold') => void;
  onPlaySpecificBattle?: (battleId: string) => void;
  onShowLogin?: () => void;
}

interface GameFeature {
  icon: LucideIcon;
  lines: [string, string];
}

interface GameBanner {
  game: 'quizzbattle' | 'trivia' | 'nextplay' | 'faceblur' | 'bogxinvaders';
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
    image: '/images/Hintergund/solo-hamster.png',
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
  '/images/Hintergund/solo-hamster.png',
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

  // Fetch live battle count when arcade is shown + poll every 10s
  useEffect(() => {
    if (!userId) return;
    
    const fetchBattleCount = () => {
      // Get count of pending + active battles needing attention
      fetch(`/api/battles?countOnly=true&userId=${userId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            // pendingChallenges = incoming challenges to accept/deny
            // activeBattles = battles where you need to play
            // myOpenBattles = battles you created waiting for opponent
            const total = (data.pendingChallenges || 0) + (data.activeBattles || 0) + (data.myOpenBattles || 0);
            setLiveBattleCount(total);
          }
        })
        .catch(() => {});
    };
    
    // Fetch immediately
    fetchBattleCount();
    
    // Poll every 10 seconds
    const interval = setInterval(fetchBattleCount, 10000);
    return () => clearInterval(interval);
  }, [userId]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Header - same style as Feed/Articles */}
      <div className="px-4 pt-4 pb-3 border-b border-warm bg-cream">
        <div className="relative flex items-center gap-3">
          <Brain className="w-5 h-5 text-[#E36B11]" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">Trivia</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">Test your GenX knowledge!</span>
          </div>
          {/* Open Battles button - absolute so height never grows the header */}
          <button
            onClick={() => setShowOpenBattles(v => !v)}
            className={`absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-3 rounded-lg border transition-colors text-[10px] tracking-wider ${
              showOpenBattles
                ? 'border-[#A855F7] bg-[#A855F7] font-bold shadow-sm'
                : 'border-[#A855F7]/40 bg-[#A855F7]/10 hover:bg-[#A855F7]/20 font-semibold'
            }`}
          >
            <Swords className={`w-3.5 h-3.5 ${showOpenBattles ? 'text-white' : 'text-[#A855F7]'}`} />
            <span className={showOpenBattles ? 'text-white' : 'text-[#A855F7]'}>OPEN BATTLES</span>
            {liveBattleCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                {liveBattleCount}
              </span>
            )}
          </button>
        </div>
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
        onCountChange={setLiveBattleCount}
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
            {/* The content now spans the full width, so the right edge needs a
                floor of its own - at to-transparent the stake grid sat on bare
                artwork and the white numbers were unreadable. */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/45" />

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

            {/* Three columns over the artwork, then a full-width action bar -
                the layout from the reference wireframe. */}
            <div className="relative h-full flex flex-col text-left px-8 py-6">
              <div className="flex-1 flex items-stretch gap-7">
                {/* Identity */}
                <div className="w-[27%] flex flex-col justify-center shrink-0">
                  <div className="self-start inline-flex items-center gap-1.5 bg-black/50 backdrop-blur-sm border border-white/20 text-white text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    <Users className="w-3.5 h-3.5" />
                    Multiplayer
                  </div>
                  <h3 className="font-display text-[44px] leading-none tracking-wide mt-3">
                    <span className="text-white">QUIZZ</span>
                    <span className="text-[#A855F7]">BATTLE</span>
                  </h3>
                  <p className="text-white text-[15px] font-semibold leading-snug mt-2.5">
                    Challenge real players.<br />
                    <span className="text-[#A855F7]">Winner takes 2x wager!</span>
                  </p>
                </div>

                <div className="w-px bg-white/20 shrink-0" />

                {/* How it works */}
                <div className="flex-1 flex flex-col justify-center min-w-0">
                  <span className="font-display text-white/60 text-[11px] tracking-[0.12em]">How it works</span>
                  <div className="flex items-start gap-6 mt-4">
                    {[
                      { icon: Users, value: '3 – 5', label: 'Rounds', desc: 'A quick series\nof questions.' },
                      { icon: Zap, value: '10 sec', label: 'Per question', desc: 'Think fast.\nEvery second counts.' },
                      { icon: Trophy, value: 'High score', label: 'Wins', desc: 'Most correct answers\ntakes the pot.' },
                    ].map((f) => {
                      const FIcon = f.icon;
                      return (
                        <div key={f.label} className="flex-1 min-w-0">
                          <div className="w-11 h-11 rounded-full border border-white/35 flex items-center justify-center">
                            <FIcon className="w-5 h-5 text-[#A855F7]" />
                          </div>
                          <div className="font-display text-white text-[15px] tracking-wide mt-2.5 leading-none">{f.value}</div>
                          <div className="font-display text-white/60 text-[11px] tracking-wide mt-1">{f.label}</div>
                          <div className="font-display text-white/45 text-[10px] tracking-wide leading-snug mt-1.5 whitespace-pre-line">{f.desc}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="w-px bg-white/20 shrink-0" />

                {/* Stake */}
                <div className="w-[30%] flex flex-col justify-center shrink-0">
                  <div className="flex items-baseline justify-between">
                    <span className="font-display text-white/60 text-[11px] tracking-[0.12em]">Your stake</span>
                    <span className="font-display text-white/40 text-[10px] tracking-wider">BOGX</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {[0.25, 0.50, 0.75, 1.00, 2.50, 5.00].map((w) => (
                      <span
                        key={w}
                        className="py-2 rounded-lg font-display text-[13px] text-white text-center border border-white/35 bg-white/[0.07]"
                      >
                        {w.toFixed(2)}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-3.5">
                    <Info className="w-4 h-4 text-white/40 shrink-0" />
                    <span className="font-display text-white/50 text-[11px] tracking-wide">Tie = coins back to both players</span>
                  </div>
                </div>
              </div>

              {/* Action bar - full width, like the wireframe */}
              <div className="mt-6 w-full flex items-center justify-center relative py-3.5 rounded-xl shadow-md bg-[#A855F7]">
                <span className="font-display text-white text-[15px] tracking-wide">PLAY NOW</span>
                <ArrowRight className="w-5 h-5 text-white absolute right-5" />
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
                className="group relative overflow-hidden rounded-2xl shadow-lg border border-warm transition-all bg-cover bg-center hover:scale-[1.01] active:scale-[0.99]"
                style={{ backgroundImage: `url('${g.image}')`, minHeight: '320px' }}
              >
                {/* LIGHT overlay, unlike QuizzBattle above: the hamster-wheel
                    banner is cream with pale line art, so a dark scrim would
                    bury the artwork and leave a grey block. Text is dark on
                    this card for the same reason. */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#F5F0E8]/80 via-[#F5F0E8]/35 to-transparent" />

                {/* Same three-column + action bar structure as QuizzBattle. */}
                <div className="relative h-full flex flex-col text-left px-8 py-6">
                  <div className="flex-1 flex items-stretch gap-7">
                    {/* Identity */}
                    <div className="w-[27%] flex flex-col justify-center shrink-0">
                      <div className="self-start inline-flex items-center gap-1.5 bg-white/70 backdrop-blur-sm border border-[#E36B11]/25 text-[#E36B11] text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                        <BadgeIcon className="w-3.5 h-3.5" />
                        {g.badge}
                      </div>
                      <h3 className="font-display text-[44px] leading-none tracking-wide mt-3">
                        <span className="text-gray-900">{g.titleA}</span>{' '}
                        <span style={{ color: g.titleColor }}>{g.titleB}</span>
                      </h3>
                      <p className="text-gray-700 text-[15px] font-semibold leading-snug mt-2.5">
                        Test your knowledge.<br />
                        <span style={{ color: g.featureColor }}>Beat the clock.</span>
                      </p>
                    </div>

                    <div className="w-px bg-black/10 shrink-0" />

                    {/* Game settings */}
                    <div className="flex-1 flex flex-col justify-center min-w-0">
                      <span className="font-display text-gray-500 text-[11px] tracking-[0.12em]">Game settings</span>
                      <div className="flex items-start gap-6 mt-4">
                        {[
                          { icon: HelpCircle, value: '5', label: 'Questions', desc: 'One short round\nper game.' },
                          { icon: Zap, value: '10 sec', label: 'Per question', desc: 'Faster answers\nscore more.' },
                          { icon: Trophy, value: '5 / day', label: 'Games', desc: 'Your daily\nallowance.' },
                        ].map((f) => {
                          const FIcon = f.icon;
                          return (
                            <div key={f.label} className="flex-1 min-w-0">
                              <div className="w-11 h-11 rounded-full border border-[#E36B11]/30 bg-white/50 flex items-center justify-center">
                                <FIcon className="w-5 h-5" style={{ color: g.featureColor }} />
                              </div>
                              <div className="font-display text-gray-900 text-[15px] tracking-wide mt-2.5 leading-none">{f.value}</div>
                              <div className="font-display text-gray-500 text-[11px] tracking-wide mt-1">{f.label}</div>
                              <div className="font-display text-gray-500 text-[10px] tracking-wide leading-snug mt-1.5 whitespace-pre-line">{f.desc}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="w-px bg-black/10 shrink-0" />

                    {/* Scoring - the stake column's counterpart */}
                    <div className="w-[30%] flex flex-col justify-center shrink-0">
                      <div className="flex items-baseline justify-between">
                        <span className="font-display text-gray-500 text-[11px] tracking-[0.12em]">Your stake</span>
                        <span className="font-display text-gray-400 text-[10px] tracking-wider">BOGX</span>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5 mt-3">
                        {[0.10, 0.20, 0.30, 0.40, 0.50].map((p) => (
                          <span
                            key={p}
                            className="py-2 rounded-lg font-display text-[11px] text-gray-800 text-center border border-[#E36B11]/30 bg-white/55"
                          >
                            {p.toFixed(2)}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 mt-3.5">
                        <div className="flex items-center gap-1.5">
                          <PlusCircle className="w-4 h-4 text-green-400 shrink-0" />
                          <span className="font-display text-gray-600 text-[11px] tracking-wide">Per correct</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                          <span className="font-display text-gray-600 text-[11px] tracking-wide">−20% per wrong</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action bar */}
                  <div
                    className="mt-6 w-full flex items-center justify-center relative py-3.5 rounded-xl shadow-md"
                    style={{ backgroundColor: g.titleColor }}
                  >
                    <span className="font-display text-white text-[15px] tracking-wide">PLAY NOW</span>
                    <ArrowRight className="w-5 h-5 text-white absolute right-5" />
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
