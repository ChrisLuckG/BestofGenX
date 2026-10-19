"use client";

import { AlertTriangle, Play } from "lucide-react";
import BrandedModal, { ModalActions } from "./BrandedModal";

interface SkipPenaltyModalProps {
  isOpen: boolean;
  onPlay: () => void;
  onSkip: () => void;
  reward: number;
}

export default function SkipPenaltyModal({ isOpen, onPlay, onSkip }: SkipPenaltyModalProps) {
  const penalty = 100;
  return (
    <BrandedModal isOpen={isOpen} onClose={onPlay} eyebrow="Hold on" title="Skip challenge?" icon={AlertTriangle}>
      <p className="text-gray-700 text-sm md:text-base leading-relaxed">Skipping requires a penalty payment. To skip this challenge, you must pay</p>
      <p className="font-display text-4xl text-red-500 mt-2">-{penalty} BOGX</p>
      <ModalActions confirmText="PLAY CHALLENGE" confirmIcon={Play} onConfirm={onPlay} cancelText="Pay & skip" onCancel={onSkip} />
    </BrandedModal>
  );
}
