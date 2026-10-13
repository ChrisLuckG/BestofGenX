"use client";

import { formatCurrency } from "@/utils/currency";
import ModalPortal from "./ModalPortal";
import NotEnoughCoinsCard from "./NotEnoughCoinsCard";

interface NoFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTopUp: () => void;
  onWatchAd?: () => void;
  requiredAmount?: number;
  currentBalance?: number;
  onReadArticles?: () => void;
  onWatchVideos?: () => void;
  onPlayTrivia?: () => void;
}

export default function NoFundsModal({ 
  isOpen, 
  onClose, 
  onTopUp, 
  onWatchAd,
  requiredAmount = 0.50,
  currentBalance = 0,
  onReadArticles,
  onWatchVideos,
  onPlayTrivia
}: NoFundsModalProps) {
  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-md p-4" onClick={onClose}>
        <NotEnoughCoinsCard
          balance={currentBalance}
          required={requiredAmount}
          message={`You need ${formatCurrency(requiredAmount)} BOGX to join this battle.`}
          onClose={onClose}
          onEarn={onTopUp}
          onReadArticles={onReadArticles || onTopUp}
          onWatchVideos={onWatchVideos || onWatchAd || onTopUp}
          onPlayTrivia={onPlayTrivia || onTopUp}
        />
      </div>
    </ModalPortal>
  );
}