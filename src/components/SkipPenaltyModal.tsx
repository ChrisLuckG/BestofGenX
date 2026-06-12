"use client";

import { AlertTriangle, Play, SkipForward } from "lucide-react";

interface SkipPenaltyModalProps {
  isOpen: boolean;
  onPlay: () => void;
  onSkip: () => void;
  reward: number;
}

export default function SkipPenaltyModal({ isOpen, onPlay, onSkip }: SkipPenaltyModalProps) {
  if (!isOpen) return null;

  const penalty = 100;

  return (
    <div className="absolute inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-cream rounded-2xl max-w-sm w-full shadow-xl">
        {/* Header */}
        <div className="p-6 text-center">
          <div className="w-20 h-20 bg-[#D4873A]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-10 h-10 text-[#D4873A]" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">
            Skip Challenge?
          </h2>
          <p className="text-gray-500 text-sm">
            Skipping requires a penalty payment
          </p>
        </div>

        {/* Penalty Info */}
        <div className="mx-6 mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-gray-700 text-center text-sm">
            To skip this challenge, you must pay
          </p>
          <p className="text-red-500 font-black text-3xl text-center mt-1">
            -{penalty} BOGX
          </p>
        </div>

        {/* Buttons */}
        <div className="px-6 pb-6 space-y-3">
          <button
            onClick={onPlay}
            className="w-full py-4 bg-[#D4873A] hover:bg-[#c4e000] rounded-xl font-bold text-white text-lg transition-all flex items-center justify-center gap-3"
          >
            <Play className="w-6 h-6" fill="black" />
            Play Challenge
          </button>
          <button
            onClick={onSkip}
            className="w-full py-4 bg-cream hover:bg-gray-200 rounded-xl font-bold text-gray-600 hover:text-gray-800 transition-all flex items-center justify-center gap-3"
          >
            <SkipForward className="w-5 h-5" />
            Pay & Skip
          </button>
        </div>
      </div>
    </div>
  );
}
