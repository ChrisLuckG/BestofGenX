"use client";

import BattlesPage from "@/components/BattlesPage";

interface DesktopBattlesPageProps {
  coins: number;
  setCoins: (fn: (prev: number) => number) => void;
  onCoinAnimation?: (amount: number, variant?: 'gain' | 'loss' | 'hold') => void;
  onShowLogin?: () => void;
  onBattleActiveChange?: (isActive: boolean) => void;
  pendingBattleId?: string | null;
  onPendingBattleHandled?: () => void;
  onBack?: () => void;
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
        /* Desktop: Make cards taller and use more space */
        .desktop-battles-wrapper .max-w-md {
          max-width: 640px !important;
        }
        .desktop-battles-wrapper .aspect-\\[3\\/4\\] {
          aspect-ratio: 4/3 !important;
        }
        .desktop-battles-wrapper .text-sm {
          font-size: 1rem !important;
        }
        .desktop-battles-wrapper .text-xs {
          font-size: 0.875rem !important;
        }
        /* Keep header Open Battles button at original size */
        .desktop-battles-wrapper .battle-header-btn .text-xs,
        .desktop-battles-wrapper .battle-header-btn.text-xs {
          font-size: 0.75rem !important;
        }

        /* ── Battle Intro: Desktop – bigger everything ── */
        .desktop-battles-wrapper .battle-topic-image {
          width: 140px !important;
          height: 110px !important;
        }
        .desktop-battles-wrapper .battle-topic-banner .font-display {
          font-size: 1.25rem !important;
        }
        .desktop-battles-wrapper .battle-topic-banner .text-xs {
          font-size: 0.875rem !important;
        }
        .desktop-battles-wrapper .battle-intro-content {
          padding: 16px 24px !important;
        }
        
        /* ── Battle VS Banner: Desktop – bigger avatars and more padding ── */
        .desktop-battles-wrapper .battle-vs-banner {
          padding: 32px 48px !important;
          min-height: 200px !important;
        }
        .desktop-battles-wrapper .battle-vs-avatar {
          width: 100px !important;
          height: 100px !important;
        }
        .desktop-battles-wrapper .battle-vs-name {
          font-size: 1.125rem !important;
        }
        .desktop-battles-wrapper .battle-vs-pot {
          font-size: 2.5rem !important;
        }
        .desktop-battles-wrapper .battle-vs-rank {
          font-size: 0.75rem !important;
          padding: 4px 12px !important;
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
