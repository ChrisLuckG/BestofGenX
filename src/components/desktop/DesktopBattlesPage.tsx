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
    <div className="relative min-h-full flex flex-col bg-[#F5F0E8] desktop-battles-wrapper">
      <style jsx global>{`
        .desktop-battles-wrapper > div > .bg-cream:not(.z-20) {
          background-color: transparent !important;
        }
        .desktop-battles-wrapper .bg-white {
          background-color: #F5F0E8 !important;
        }
        .desktop-battles-wrapper > div:first-child > div:first-child {
          background: linear-gradient(to bottom, rgba(212, 135, 58, 0.05), transparent) !important;
        }
        /* Desktop: Make cards taller and use more space */
        .desktop-battles-wrapper .max-w-md {
          max-width: 600px !important;
        }
        .desktop-battles-wrapper .aspect-\\[3\\/4\\] {
          aspect-ratio: 4/3 !important;
        }
        .desktop-battles-wrapper .py-4 {
          padding-top: 1.5rem !important;
          padding-bottom: 1.5rem !important;
        }
        .desktop-battles-wrapper .gap-3 {
          gap: 1rem !important;
        }
        .desktop-battles-wrapper .text-sm {
          font-size: 1rem !important;
        }
        .desktop-battles-wrapper .text-xs {
          font-size: 0.875rem !important;
        }
      `}</style>
      <BattlesPage
        {...props}
        embedded={true}
        onBack={props.onBack}
      />
    </div>
  );
}
