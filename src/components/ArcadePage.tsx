"use client";

import { useState, useEffect } from "react";
import { Users, User, HelpCircle, Trophy, BarChart3, Coins, Zap, Play, Swords, Brain, ArrowRight } from "lucide-react";
import OpenBattlesModal from "./OpenBattlesModal";

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
            onClick={() => userId ? setShowOpenBattles(v => !v) : onShowLogin?.()}
            className={`absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-3 rounded-lg border transition-colors text-[10px] tracking-wider ${
              showOpenBattles
                ? 'border-[#A855F7] bg-[#A855F7] font-bold shadow-sm'
                : 'border-[#A855F7]/40 bg-[#A855F7]/10 hover:bg-[#A855F7]/20 font-semibold'
            }`}
          >
            <Swords className={`w-3.5 h-3.5 ${showOpenBattles ? 'text-white' : 'text-[#A855F7]'}`} />
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

      {/* Split Layout - Two Game Cards */}
      <div className="flex-1 flex flex-col px-4 py-4 gap-4 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        
        {/* QuizzBattle - Multiplayer Banner with full info */}
        <button
          onClick={() => onSelectGame('quizzbattle')}
          className="w-full relative overflow-hidden rounded-2xl shadow-md border border-warm transition-all hover:scale-[1.02] active:scale-[0.98] bg-cover bg-center"
          style={{ backgroundImage: "url('/images/Hintergund/battle-bats.png')", minHeight: '290px' }}
        >
          {/* The action bar now runs the full width, so the right edge needs a
              floor of its own instead of fading to bare artwork. */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#F5F0E8]/80 via-[#F5F0E8]/35 to-transparent" />

          {/* Online Players Badge - top right */}
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-white/70 backdrop-blur-sm border border-[#A855F7]/25 px-2 py-1 rounded-full z-10">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            {onlineLoading ? (
              <div className="w-4 h-3 bg-black/10 rounded animate-pulse" />
            ) : (
              <span className="text-[10px] font-bold text-gray-800">{onlinePlayers}</span>
            )}
            <span className="text-[8px] text-gray-500 uppercase">Online</span>
          </div>

          {/* Same sections as desktop, stacked - three columns do not fit here. */}
          <div className="relative h-full flex flex-col text-left px-4 py-3">
            {/* Badge */}
            <div className="self-start inline-flex items-center gap-1 bg-white/70 backdrop-blur-sm border border-[#A855F7]/25 text-[#A855F7] text-[7px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              <Users className="w-2.5 h-2.5" />
              Multiplayer
            </div>

            {/* Title */}
            <h3 className="font-display text-[28px] leading-none tracking-wide mt-2">
              <span className="text-gray-900">QUIZZ</span><span className="text-[#A855F7]">BATTLE</span>
            </h3>

            {/* Subtitle */}
            <p className="text-gray-700 text-[11px] font-semibold leading-tight mt-1">
              Challenge real players. <span className="text-[#A855F7]">Winner takes 2x wager!</span>
            </p>

            {/* How it works */}
            <span className="font-display text-gray-500 text-[8px] tracking-[0.12em] mt-3">How it works</span>
            <div className="flex items-start gap-3 mt-1.5">
              {[
                { icon: Users, value: '3 – 5', label: 'Rounds' },
                { icon: Zap, value: '10 sec', label: 'Per question' },
                { icon: Trophy, value: 'High score', label: 'Wins' },
              ].map((f) => {
                const FIcon = f.icon;
                return (
                  <div key={f.label} className="flex items-center gap-1.5 min-w-0">
                    <span className="w-6 h-6 rounded-full border border-[#A855F7]/30 bg-white/50 flex items-center justify-center shrink-0">
                      <FIcon className="w-3 h-3 text-[#A855F7]" />
                    </span>
                    <span className="min-w-0">
                      <span className="font-display text-gray-900 text-[10px] tracking-wide block leading-none">{f.value}</span>
                      <span className="font-display text-gray-500 text-[8px] tracking-wide block leading-tight">{f.label}</span>
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Stake */}
            <div className="flex items-baseline justify-between mt-3 max-w-[78%]">
              <span className="font-display text-gray-500 text-[8px] tracking-[0.12em]">Your stake</span>
              <span className="font-display text-gray-400 text-[7px] tracking-wider">BOGX</span>
            </div>
            <div className="grid grid-cols-6 gap-1 mt-1.5 max-w-[78%]">
              {[0.25, 0.50, 0.75, 1.00, 2.50, 5.00].map((w) => (
                <span key={w} className="py-1 rounded font-display text-[8px] text-gray-800 text-center border border-[#A855F7]/30 bg-white/55">
                  {w.toFixed(2)}
                </span>
              ))}
            </div>

            {/* Action bar */}
            <div className="mt-3 w-full flex items-center justify-center relative py-2 rounded-lg bg-[#A855F7]">
              <span className="font-display text-white text-[10px] tracking-wide">PLAY NOW</span>
              <ArrowRight className="w-3.5 h-3.5 text-white absolute right-3" />
            </div>
            <span className="font-display text-gray-500 text-[8px] tracking-wide mt-1.5 text-center">Tie = coins back to both players</span>
          </div>
        </button>

        {/* Solo Trivia - Single Player Banner.
            LIGHT treatment: the hamster-wheel banner is cream with pale line
            art, so the dark gradient this card used to carry would have buried
            it completely and left a grey block. Text is dark here instead. */}
        <button
          onClick={() => onSelectGame('trivia')}
          className="w-full relative overflow-hidden rounded-2xl shadow-md border border-warm transition-all hover:scale-[1.02] active:scale-[0.98] bg-cover bg-center"
          style={{ backgroundImage: "url('/images/Hintergund/solo-hamster.png')", minHeight: '290px' }}
        >
          {/* Lifts the left side just enough to read against, while the wheel
              on the right stays visible. */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#F5F0E8]/80 via-[#F5F0E8]/35 to-transparent" />

          {/* Badge - top right */}
          <div className="absolute top-2 right-2 inline-flex items-center gap-1 bg-white/70 backdrop-blur-sm border border-[#E36B11]/25 text-[#E36B11] text-[7px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider z-10">
            <User className="w-2.5 h-2.5" />
            Single Player
          </div>

          <div className="relative h-full flex flex-col text-left px-4 py-3">
            {/* Title */}
            <h3 className="font-display text-[30px] leading-none tracking-wide mt-5">
              <span className="text-gray-900">SOLO</span> <span className="text-[#E36B11]">TRIVIA</span>
            </h3>

            {/* Subtitle */}
            <p className="text-gray-700 text-[12px] font-semibold leading-tight mt-1.5">
              Test your knowledge.<br />
              <span className="text-[#E36B11]">Beat the clock.</span>
            </p>

            {/* Game settings */}
            <span className="font-display text-gray-500 text-[8px] tracking-[0.12em] mt-3">Game settings</span>
            <div className="flex items-start gap-3 mt-1.5">
              {[
                { icon: HelpCircle, value: '5', label: 'Questions' },
                { icon: Zap, value: '10 sec', label: 'Per question' },
                { icon: Trophy, value: '5 / day', label: 'Games' },
              ].map((f) => {
                const FIcon = f.icon;
                return (
                  <div key={f.label} className="flex items-center gap-1.5 min-w-0">
                    <span className="w-6 h-6 rounded-full border border-[#E36B11]/30 bg-white/50 flex items-center justify-center shrink-0">
                      <FIcon className="w-3 h-3 text-[#E36B11]" />
                    </span>
                    <span className="min-w-0">
                      <span className="font-display text-gray-900 text-[10px] tracking-wide block leading-none">{f.value}</span>
                      <span className="font-display text-gray-500 text-[8px] tracking-wide block leading-tight">{f.label}</span>
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Stake */}
            <div className="flex items-baseline justify-between mt-3 max-w-[78%]">
              <span className="font-display text-gray-500 text-[8px] tracking-[0.12em]">Your stake</span>
              <span className="font-display text-gray-400 text-[7px] tracking-wider">BOGX</span>
            </div>
            <div className="grid grid-cols-5 gap-1 mt-1.5 max-w-[78%]">
              {[0.10, 0.20, 0.30, 0.40, 0.50].map((p) => (
                <span key={p} className="py-1 rounded font-display text-[8px] text-gray-800 text-center border border-[#E36B11]/30 bg-white/55">
                  {p.toFixed(2)}
                </span>
              ))}
            </div>

            {/* Action bar */}
            <div className="mt-3 w-full flex items-center justify-center relative py-2 rounded-lg bg-[#E36B11]">
              <span className="font-display text-white text-[10px] tracking-wide">PLAY NOW</span>
              <ArrowRight className="w-3.5 h-3.5 text-white absolute right-3" />
            </div>
            <span className="font-display text-gray-500 text-[8px] tracking-wide mt-1.5 text-center">Win your stake per correct · −20% per wrong</span>
          </div>
        </button>

      </div>
    </div>
  );
}
