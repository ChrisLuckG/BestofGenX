"use client";

import { Trophy, UserPlus } from "lucide-react";
import BrandedModal, { ModalActions } from "./BrandedModal";

interface JustForFunModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
}

export default function JustForFunModal({ isOpen, onClose, onLogin }: JustForFunModalProps) {
  return (
    <BrandedModal isOpen={isOpen} onClose={onClose} eyebrow="Guest mode" title="Just for fun" icon={Trophy}>
      <p className="text-gray-700 text-sm md:text-base leading-relaxed">
        The next games are <span className="text-[#E36B11] font-bold">just for fun</span>. Your scores won&apos;t count towards the ranking.
      </p>
      <p className="text-gray-500 text-sm mt-2">
        But you can still <span className="text-[#E36B11] font-bold">redeem your coins</span> for rewards. Want to compete in the official rankings? Register now!
      </p>
      <ModalActions confirmText="REGISTER NOW" confirmIcon={UserPlus} onConfirm={onLogin} cancelText="Continue for fun" onCancel={onClose} />
    </BrandedModal>
  );
}
