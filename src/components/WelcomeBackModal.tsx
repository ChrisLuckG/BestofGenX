"use client";

import { X, TrendingDown, TrendingUp, Bell, Swords } from "lucide-react";

export interface WelcomeBackRankChange {
  from: number;
  to: number;
  direction: "up" | "down" | "same";
}

interface WelcomeAI {
  greeting: string;
  subtitle: string;
  facts?: string[];
  fact?: string;
  factReaction?: string;
  callToAction: string;
}

interface WelcomeBackModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  currentRank: number | null;
  rankChange: WelcomeBackRankChange | null;
  welcomeAI: WelcomeAI | null;
  notificationsEnabled: boolean;
  unreadCount: number;
  playedCount: number;
  totalCards: number;
  pendingChallengeCount?: number;
  activeBattleCount?: number;
  onPrimaryAction: () => void;
  onEnableNotifications: () => void;
  onGoToBattles?: () => void;
}

export default function WelcomeBackModal({
  isOpen,
  onClose,
  username,
  currentRank,
  rankChange,
  welcomeAI,
  notificationsEnabled,
  unreadCount,
  playedCount,
  totalCards,
  pendingChallengeCount = 0,
  activeBattleCount = 0,
  onPrimaryAction,
  onEnableNotifications,
  onGoToBattles,
}: WelcomeBackModalProps) {
  const hasStarted = playedCount > 0;
  const isComplete = totalCards > 0 && playedCount >= totalCards;
  const progressPct = totalCards > 0 ? Math.round((playedCount / totalCards) * 100) : 0;
  const showNotificationReminder = !notificationsEnabled && unreadCount > 0;
  const hasBattleAlerts = pendingChallengeCount > 0 || activeBattleCount > 0;

  const greeting = welcomeAI?.greeting || `Hey ${username}!`;
  const subtitle = welcomeAI?.subtitle || "Ready for today's challenge?";
  const callToAction = welcomeAI?.callToAction || (
    hasStarted && !isComplete ? "Continue" : isComplete ? "View Results" : "Let's go!"
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-cream rounded-2xl shadow-2xl overflow-hidden max-h-[96vh] flex flex-col border border-warm">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full hover:bg-[#D4873A]/10 flex items-center justify-center text-gray-400 hover:text-[#D4873A] transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header - Logo centered on top */}
        <div className="px-5 pt-5 pb-3 text-center flex-shrink-0">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[#D4873A]/10 to-[#D4873A]/5 flex items-center justify-center shadow-sm">
            <img src="/images/genxlogo1.png" alt="Best of GenX" className="h-9 object-contain" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">{greeting}</h2>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>

        {/* Content - no scroll */}
        <div className="px-5 pb-2 space-y-3">
          {/* Ranking change - down */}
          {rankChange && rankChange.direction === "down" && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <TrendingDown className="w-4 h-4 text-red-500" />
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">
                You dropped from <span className="font-semibold text-red-600">#{rankChange.from}</span> to{" "}
                <span className="font-semibold text-red-600">#{rankChange.to}</span> while away. Time to climb back!
              </p>
            </div>
          )}

          {/* Ranking change - up */}
          {rankChange && rankChange.direction === "up" && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">
                You climbed from <span className="font-semibold text-emerald-700">#{rankChange.from}</span> to{" "}
                <span className="font-semibold text-emerald-700">#{rankChange.to}</span>. Keep it up!
              </p>
            </div>
          )}

          {/* Current rank (no change) */}
          {!rankChange && currentRank && (
            <div className="rounded-xl bg-[#D4873A]/10 border border-[#D4873A]/20 p-4 text-center">
              <p className="text-sm text-gray-700">
                Currently ranked <span className="font-bold text-[#D4873A]">#{currentRank}</span>
              </p>
            </div>
          )}

          {/* Battle Alerts - pending invitations & active battles */}
          {hasBattleAlerts && (
            <button
              onClick={() => { onGoToBattles?.(); onClose(); }}
              className="w-full rounded-xl bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] border border-[#D4873A]/40 p-4 flex items-center gap-4 hover:border-[#D4873A] transition-all group"
            >
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-xl bg-[#D4873A]/20 flex items-center justify-center">
                  <Swords className="w-6 h-6 text-[#D4873A]" />
                </div>
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-lg animate-pulse">
                  {pendingChallengeCount + activeBattleCount}
                </span>
              </div>
              <div className="flex-1 text-left">
                {pendingChallengeCount > 0 && (
                  <p className="text-white font-semibold text-sm">
                    ⚔️ {pendingChallengeCount === 1 ? "1 battle challenge" : `${pendingChallengeCount} battle challenges`} waiting!
                  </p>
                )}
                {activeBattleCount > 0 && (
                  <p className={`font-semibold text-sm ${pendingChallengeCount > 0 ? 'text-white/70' : 'text-white'}`}>
                    🎯 {activeBattleCount === 1 ? "1 active battle" : `${activeBattleCount} active battles`} to play
                  </p>
                )}
                <p className="text-[#D4873A] text-xs mt-0.5 group-hover:underline">Tap to open Arcade →</p>
              </div>
            </button>
          )}

          {/* Notification reminder */}
          {showNotificationReminder && (
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#D4873A]/10 flex items-center justify-center flex-shrink-0">
                <Bell className="w-4 h-4 text-[#D4873A]" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-700 leading-relaxed">
                  You have <span className="font-semibold text-[#D4873A]">{unreadCount}</span> unread{" "}
                  {unreadCount === 1 ? "notification" : "notifications"}.
                </p>
                <button
                  onClick={onEnableNotifications}
                  className="text-sm font-medium text-[#D4873A] hover:text-[#C4772A] transition-colors mt-1"
                >
                  Enable notifications →
                </button>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {hasStarted && !isComplete && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Today's Progress
                </span>
                <span className="text-xs font-semibold text-[#D4873A]">
                  {playedCount} / {totalCards}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#D4873A] to-[#E5A55A] rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer action */}
        <div className="px-5 pb-5 pt-2 flex-shrink-0">
          <button
            onClick={onPrimaryAction}
            className="w-full py-3.5 bg-[#D4873A] hover:bg-[#C4772A] text-white font-semibold rounded-xl text-sm transition-colors shadow-sm"
          >
            {callToAction}
          </button>
        </div>
      </div>
    </div>
  );
}
