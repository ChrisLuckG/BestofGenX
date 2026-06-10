"use client";

import { AlertTriangle, RotateCcw, ArrowDown } from "lucide-react";

interface SwipeWarningModalProps {
  isOpen: boolean;
  onContinue: () => void;
  onRestart: () => void;
  reward: number;
}

export default function SwipeWarningModal({ isOpen, onContinue, onRestart, reward }: SwipeWarningModalProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-cream rounded-2xl max-w-sm w-full shadow-xl">
        {/* Header */}
        <div className="p-5 text-center border-b border-warm">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            Challenge in Progress!
          </h2>
        </div>

        {/* Content */}
        <div className="p-5">
          <p className="text-gray-700 text-center mb-4">
            If you swipe away now, you will <span className="text-red-500 font-bold">lose {reward} coins</span>.
          </p>
          <p className="text-gray-500 text-sm text-center mb-6">
            Would you like to restart the challenge or continue and lose the coins?
          </p>

          {/* Buttons */}
          <div className="space-y-3">
            <button
              onClick={onRestart}
              className="w-full py-3 bg-[#D4873A] hover:bg-[#c4e000] rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Restart Challenge
            </button>
            <button
              onClick={onContinue}
              className="w-full py-3 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl font-bold text-red-500 transition-all flex items-center justify-center gap-2"
            >
              <ArrowDown className="w-5 h-5" />
              Swipe Away (-{reward} Coins)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
