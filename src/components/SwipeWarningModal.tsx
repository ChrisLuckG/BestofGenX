"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import BrandedModal, { ModalActions } from "./BrandedModal";

interface SwipeWarningModalProps {
  isOpen: boolean;
  onContinue: () => void;
  onRestart: () => void;
  reward: number;
}

export default function SwipeWarningModal({ isOpen, onContinue, onRestart, reward }: SwipeWarningModalProps) {
  return (
    <BrandedModal isOpen={isOpen} onClose={onRestart} eyebrow="Challenge in progress" title="Leave now?" icon={AlertTriangle} accent="red">
      <p className="text-gray-700 text-sm md:text-base leading-relaxed">
        If you swipe away now, you will <span className="text-red-500 font-bold">lose {reward} coins</span>.
      </p>
      <p className="text-gray-500 text-sm mt-2">Would you like to restart the challenge or continue and lose the coins?</p>
      <ModalActions confirmText="RESTART CHALLENGE" confirmIcon={RotateCcw} onConfirm={onRestart} cancelText={`Swipe away (-${reward} coins)`} onCancel={onContinue} accent="red" />
    </BrandedModal>
  );
}
