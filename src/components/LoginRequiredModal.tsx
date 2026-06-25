"use client";

import { X, Lock, LogIn, UserPlus } from "lucide-react";

interface LoginRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Open the full login flow (initialView controls which tab to land on) */
  onLogin: () => void;
  onRegister: () => void;
  /** Optional title and message overrides */
  title?: string;
  message?: string;
  /** If true, renders inline instead of as fullscreen overlay (for desktop) */
  embedded?: boolean;
}

// Lightweight gate shown when a guest tries to interact with a feature
// that needs an account (e.g. submitting a prediction).
export default function LoginRequiredModal({
  isOpen,
  onClose,
  onLogin,
  onRegister,
  title = "Login required",
  message = "Create a free account or log in to submit your pick. We'll bring you right back here.",
  embedded = false,
}: LoginRequiredModalProps) {
  if (!isOpen) return null;

  // Desktop: render inline in content area
  if (embedded) {
    return (
      <div className="absolute inset-0 z-[50] flex items-center justify-center p-5 bg-[#F5F0E8]/80 backdrop-blur-sm">
        <div className="relative w-full max-w-sm bg-cream rounded-2xl shadow-xl border border-warm overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-warm">
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-[#D4873A]/10 flex items-center justify-center text-gray-400 hover:text-[#D4873A] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-12 h-12 rounded-xl bg-[#D4873A]/10 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-[#D4873A]" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">{message}</p>
          </div>

          <div className="px-6 py-5 space-y-3">
            <button
              onClick={onLogin}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#D4873A] hover:bg-[#C4772A] text-white font-medium rounded-xl text-sm transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Log in
            </button>
            <button
              onClick={onRegister}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#D4873A]/10 hover:bg-[#D4873A]/20 text-[#D4873A] font-medium rounded-xl text-sm transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Create account
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-gray-400 hover:text-gray-600 text-sm transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Mobile: fullscreen overlay
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-5">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#F5F0E8] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-warm">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-[#D4873A]/10 flex items-center justify-center text-gray-400 hover:text-[#D4873A] transition-colors"
          >

            <X className="w-4 h-4" />
          </button>
          <div className="w-12 h-12 rounded-xl bg-[#D4873A]/10 flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-[#D4873A]" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">{message}</p>
        </div>

        <div className="px-6 py-5 space-y-3">
          <button
            onClick={onLogin}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#D4873A] hover:bg-[#C4772A] text-white font-medium rounded-xl text-sm transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Log in
          </button>
          <button
            onClick={onRegister}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#D4873A]/10 hover:bg-[#D4873A]/20 text-[#D4873A] font-medium rounded-xl text-sm transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Create account
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-gray-400 hover:text-gray-600 text-sm transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
