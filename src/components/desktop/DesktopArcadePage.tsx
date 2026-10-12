"use client";

import { useState, useEffect } from "react";
import { Users, User, Swords, Brain } from "lucide-react";
import OpenBattlesModal from "../OpenBattlesModal";
import PosterBanner from "../PosterBanner";
import { DAILY_GAME_LIMIT } from "../games/SoloTriviaGame";

interface DesktopArcadePageProps {
  onSelectGame: (game: 'quizzbattle' | 'trivia' | 'spacegenx' | 'memory' | 'genxmen' | 'nextplay' | 'faceblur' | 'bogxinvaders') => void;
  onShowRankings?: () => void;
  userId?: string;
  battleAlertCount?: number;
  onCoinsChange?: (delta: number, variant?: 'gain' | 'loss' | 'hold') => void;
  onPlaySpecificBattle?: (battleId: string) => void;
  onShowLogin?: () => void;
}

export default function DesktopArcadePage({ onSelectGame, userId, battleAlertCount = 0, onCoinsChange, onPlaySpecificBattle, onShowLogin }: DesktopArcadePageProps) {
  const [showOpenBattles, setShowOpenBattles] = useState(false);
  const [liveBattleCount, setLiveBattleCount] = useState(battleAlertCount);
  const [onlinePlayers, setOnlinePlayers] = useState(0);
  const [onlineLoading, setOnlineLoading] = useState(true);
  const [dailyTriviaCount, setDailyTriviaCount] = useState<number | null>(null);

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

  // Fetch daily trivia count
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/user/daily-trivia-count?userId=${userId}`)
      .then(res => res.json())
      .then(data => { if (data.success) setDailyTriviaCount(data.count); })
      .catch(() => {});
  }, [userId]);

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

      {/* Banner Layout - same as Mobile */}
      <div className="flex-1 flex flex-col overflow-hidden p-4">
        <div className="flex-1 flex flex-col gap-4">
          {/* QuizzBattle Banner */}
          <PosterBanner
            color="#A855F7"
            media={{ type: 'image', src: '/images/Hintergund/battle-bats.png', lineArt: true }}
            badge={{ icon: Users, label: 'Multiplayer' }}
            title="QUIZZBATTLE"
            tagline="Pick a fight. Winner takes the pot."
            info={liveBattleCount > 0 ? `${liveBattleCount} battles waiting for you` : `Wager 0.25 – 5.00 BOGX · tie = money back`}
            cta="PLAY"
            onClick={() => onSelectGame('quizzbattle')}
            minHeight={280}
            topRight={
              <div className="flex items-center gap-1.5 bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                {onlineLoading ? (
                  <div className="w-4 h-3 bg-white/30 rounded animate-pulse" />
                ) : (
                  <span className="text-xs font-bold text-white">{onlinePlayers}</span>
                )}
                <span className="text-[9px] text-white/80 uppercase font-semibold">Online</span>
              </div>
            }
          />

          {/* Solo Trivia Banner */}
          <PosterBanner
            color="#E36B11"
            media={{ type: 'image', src: '/images/Hintergund/solo-hamster.png', lineArt: true }}
            badge={{ icon: User, label: 'Single Player' }}
            title="SOLO TRIVIA"
            tagline="Beat the clock. The faster you answer, the more you win."
            info={
              userId && dailyTriviaCount !== null
                ? dailyTriviaCount >= DAILY_GAME_LIMIT
                  ? `All ${DAILY_GAME_LIMIT} played. Back at 10:00.`
                  : `${DAILY_GAME_LIMIT - dailyTriviaCount} of ${DAILY_GAME_LIMIT} games left today`
                : `${DAILY_GAME_LIMIT} games a day · 10 sec per question`
            }
            cta="PLAY"
            onClick={() => onSelectGame('trivia')}
            minHeight={280}
          />
        </div>
      </div>
    </div>
  );
}
