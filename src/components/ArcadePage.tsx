"use client";
import PageHeader, { HeaderButton } from "@/components/PageHeader";

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
      <PageHeader
        icon={Brain}
        title="Trivia"
        subtitle="Test your GenX knowledge!"
        right={
          <HeaderButton neon icon={Swords} label="Open Battles" color="#A855F7" active={showOpenBattles} badge={liveBattleCount} onClick={() => setShowOpenBattles(v => !v)} />
        }
      />

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
      <div className="flex-1 flex flex-col px-2 py-4 gap-4">
        <PosterBanner
          color="#A855F7"
          media={{ type: 'image', src: '/images/categories/battle.png' }}
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
          media={{ type: 'image', src: '/images/categories/solo.png' }}
          badge={{ icon: User, label: 'Single Player' }}
          title="SOLO"
          accent="TRIVIA"
          tagline="Beat the clock. The faster you answer, the more you win."
          info={soloLive}
          onClick={() => onSelectGame('trivia')}
        />
      </div>
    </div>
  );
}
