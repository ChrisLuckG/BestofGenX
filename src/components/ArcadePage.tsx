"use client";

import { useState, useEffect } from "react";
import { Users, User, Swords, Brain } from "lucide-react";
import OpenBattlesModal from "./OpenBattlesModal";
import PosterBanner from "./PosterBanner";
import { DAILY_GAME_LIMIT } from "./games/SoloTriviaGame";

interface ArcadePageProps {
  onSelectGame: (game: 'quizzbattle' | 'trivia' | 'spacegenx' | 'memory' | 'genxmen' | 'nextplay' | 'faceblur' | 'bogxinvaders') => void;
  onShowRankings?: () => void;
  onShowBattles?: () => void;
  battleAlertCount?: number;
  userId?: string;
  onCoinsChange?: (amount: number, variant?: 'gain' | 'loss' | 'hold') => void;
  onPlaySpecificBattle?: (battleId: string) => void;
  onShowLogin?: () => void;
}

export default function ArcadePage({ onSelectGame, onShowRankings, onShowBattles, battleAlertCount = 0, userId, onCoinsChange, onPlaySpecificBattle, onShowLogin }: ArcadePageProps) {
  const [showOpenBattles, setShowOpenBattles] = useState(false);
  const [liveBattleCount, setLiveBattleCount] = useState(battleAlertCount);
  const [onlinePlayers, setOnlinePlayers] = useState(0);
  const [onlineLoading, setOnlineLoading] = useState(true);

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

  // Solo games played today (logged in only - guests see the static rule)
  const [soloPlayedToday, setSoloPlayedToday] = useState<number | null>(null);
  useEffect(() => {
    if (!userId) { setSoloPlayedToday(null); return; }
    fetch(`/api/user/daily-trivia-count?userId=${userId}`)
      .then(r => r.json())
      .then(data => { if (data.success) setSoloPlayedToday(data.count || 0); })
      .catch(() => {});
  }, [userId]);
  const soloLeft = soloPlayedToday === null ? null : Math.max(0, DAILY_GAME_LIMIT - soloPlayedToday);

  // Fetch live battle count every time arcade is shown — independent of bottom nav badge
  const refreshBattleCount = () => {
    if (!userId) return;
    fetch(`/api/battles?userId=${userId}&countOnly=true`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setLiveBattleCount((data.pendingChallenges ?? 0) + (data.activeBattles ?? 0) + (data.myOpenBattles ?? 0));
        }
      })
      .catch(() => {});
  };

  // Fetch on mount + poll every 10 seconds
  useEffect(() => {
    refreshBattleCount();
    const interval = setInterval(refreshBattleCount, 10000);
    return () => clearInterval(interval);
  }, [userId]);

  const battleLive = userId && liveBattleCount > 0
    ? `${liveBattleCount} battle${liveBattleCount === 1 ? '' : 's'} waiting for you`
    : 'Wager 0.25 – 5.00 BOGX · tie = money back';

  const soloLive = soloLeft === null
    ? `${DAILY_GAME_LIMIT} games a day · 10 sec per question`
    : soloLeft > 0
      ? `${soloLeft} of ${DAILY_GAME_LIMIT} games left today`
      : `All ${DAILY_GAME_LIMIT} played. Back at 10:00.`;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-cream">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-warm bg-cream">
        <div className="relative flex items-center gap-3">
          <Brain className="w-5 h-5 text-[#E36B11]" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">Trivia</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">Test your GenX knowledge!</span>
          </div>
          {/* Open battles button - absolute so height never grows the header */}
          <button
            onClick={() => setShowOpenBattles(v => !v)}
            style={{ ['--fx-glow' as string]: 'rgba(168, 85, 247, 0.75)' }}
            className={`fx-neon group absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-3 rounded-lg border transition-colors text-[10px] tracking-wider ${
              showOpenBattles
                ? 'border-[#A855F7] bg-[#A855F7] font-bold shadow-sm'
                : 'border-[#A855F7]/40 bg-[#A855F7]/10 hover:bg-[#A855F7]/20 font-semibold'
            }`}
          >
            <Swords className={`fx-wiggle w-3.5 h-3.5 ${showOpenBattles ? 'text-white' : 'text-[#A855F7]'}`} />
            <span className={showOpenBattles ? 'text-white' : 'text-[#A855F7]'}>OPEN BATTLES</span>
            {liveBattleCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] font-black shadow animate-pulse">
                {liveBattleCount > 9 ? '9+' : liveBattleCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Open Battles Popup - rendered even without a userId, exactly like desktop:
          the modal itself carries the "Login to see your battles" state. Gating it
          on userId sent guests to QuizzBattle instead of showing that prompt. */}
      <OpenBattlesModal
        isOpen={showOpenBattles}
        onClose={() => { setShowOpenBattles(false); refreshBattleCount(); }}
        userId={userId || ''}
        onPlayBattle={(battleId) => { setShowOpenBattles(false); onPlaySpecificBattle?.(battleId) || onSelectGame('quizzbattle'); }}
        onCoinsChange={onCoinsChange}
        onShowLogin={onShowLogin}
        accentColor="purple"
        onCountChange={setLiveBattleCount}
      />

      {/* Two poster banners - like the Media page, no scrolling needed */}
      <div className="flex-1 flex flex-col px-4 py-4 gap-4">
        <PosterBanner
          color="#A855F7"
          media={{ type: 'image', src: '/images/Hintergund/battle-bats.png', lineArt: true }}
          badge={{ icon: Users, label: 'Multiplayer' }}
          topRight={
            <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-2 py-1 rounded-full">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              {onlineLoading ? (
                <div className="w-4 h-3 bg-white/20 rounded animate-pulse" />
              ) : (
                <span className="text-[10px] font-bold text-white">{onlinePlayers}</span>
              )}
              <span className="text-[8px] text-white/80 uppercase">Online</span>
            </div>
          }
          title="QUIZZ"
          accent="BATTLE"
          tagline="Pick a fight. Winner takes the pot."
          info={battleLive}
          onClick={() => onSelectGame('quizzbattle')}
        />

        <PosterBanner
          color="#E36B11"
          media={{ type: 'image', src: '/images/Hintergund/solo-hamster.png', lineArt: true }}
          badge={{ icon: User, label: 'Single Player' }}
          title="SOLO "
          accent="TRIVIA"
          tagline="Beat the clock. The faster you answer, the more you win."
          info={soloLive}
          onClick={() => onSelectGame('trivia')}
        />
      </div>
    </div>
  );
}
