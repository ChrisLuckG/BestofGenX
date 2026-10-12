"use client";

import BattlesPage from "@/components/BattlesPage";
import type { ChallengeTarget } from "@/components/battles/types";

interface DesktopBattlesPageProps {
  coins: number;
  setCoins: (fn: (prev: number) => number) => void;
  onCoinAnimation?: (amount: number, variant?: 'gain' | 'loss' | 'hold') => void;
  onShowLogin?: () => void;
  onBattleActiveChange?: (isActive: boolean) => void;
  pendingBattleId?: string | null;
  onPendingBattleHandled?: () => void;
  onBack?: () => void;
  challengeTarget?: ChallengeTarget | null;
  onChallengeTargetHandled?: () => void;
}

export default function DesktopBattlesPage(props: DesktopBattlesPageProps) {
  // Go directly to battles page - no intro screen
  return (
    <div className="min-h-full h-full flex flex-col bg-[#F5F0E8] desktop-battles-wrapper">
      <style jsx global>{`
        .desktop-battles-wrapper > div > .bg-cream:not(.z-20) {
          background-color: transparent !important;
        }
        .desktop-battles-wrapper .bg-white {
          background-color: #F5F0E8 !important;
        }
        
        /* ── Preparing Screen ONLY: Desktop – bigger text ── */
        /* Target only the PreparingScreen component */
        .desktop-battles-wrapper .preparing-screen .text-\[10px\] {
          font-size: 1.125rem !important;
        }
        .desktop-battles-wrapper .preparing-screen .text-\[9px\] {
          font-size: 1rem !important;
        }
        .desktop-battles-wrapper .preparing-screen .w-11 {
          width: 5rem !important;
          height: 5rem !important;
        }
        .desktop-battles-wrapper .preparing-screen .h-11 {
          width: 5rem !important;
          height: 5rem !important;
        }
        .desktop-battles-wrapper .preparing-screen .text-base {
          font-size: 1.25rem !important;
        }
        .desktop-battles-wrapper .preparing-screen .text-sm {
          font-size: 1.125rem !important;
        }
      `}</style>
      <BattlesPage
        {...props}
        embedded={true}
        isDesktop={true}
        skipSetup={true}
        onBack={props.onBack}
      />
    </div>
  );
}
