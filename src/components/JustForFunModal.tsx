"use client";

import { Trophy, X, UserPlus, Play } from "lucide-react";

interface JustForFunModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
}

export default function JustForFunModal({ isOpen, onClose, onLogin }: JustForFunModalProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-cream rounded-2xl max-w-sm w-full shadow-xl">
        {/* Header */}
        <div className="p-5 text-center border-b border-warm">
          <div className="w-16 h-16 rounded-full bg-[#D4873A]/20 flex items-center justify-center mx-auto mb-3">
            <Trophy className="w-8 h-8 text-[#D4873A]" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            Just for Fun Mode
          </h2>
        </div>

        {/* Content */}
        <div className="p-5">
          <p className="text-gray-700 text-center mb-4">
            The next games are <span className="text-[#D4873A] font-bold">just for fun</span>. 
            Your scores won't count towards the ranking.
          </p>
          <p className="text-gray-500 text-sm text-center mb-2">
            But don't worry - you can still <span className="text-[#D4873A] font-bold">redeem your coins</span> for rewards!
          </p>
          <p className="text-gray-500 text-sm text-center mb-6">
            Want to compete in the official rankings? Register now!
          </p>

          {/* Buttons */}
          <div className="space-y-3">
            <button
              onClick={onLogin}
              className="w-full py-3 bg-[#D4873A] hover:bg-[#c4e000] rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              Register Now
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 bg-cream hover:bg-skeleton-light rounded-xl font-bold text-gray-700 transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              Continue for Fun
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
