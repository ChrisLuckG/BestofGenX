"use client";

import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import BrandedModal from "./BrandedModal";

interface LoginRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Open the full login flow - called automatically after brief animation */
  onLogin: () => void;
  onRegister: () => void;
  /** Optional title and message overrides */
  title?: string;
  message?: string;
  /** Kept for callers; the dialog is the same branded modal everywhere now */
  embedded?: boolean;
}

// Lightweight transition modal shown when a guest tries to interact with a feature
// that needs an account. Shows a brief welcoming message then automatically
// transitions to the full LoginPage wizard.
export default function LoginRequiredModal({
  isOpen,
  onClose,
  onLogin,
  title = "Ready to join?",
  message = "Let's get you set up...",
}: LoginRequiredModalProps) {
  // Auto-transition to login after brief delay
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => onLogin(), 800);
    return () => clearTimeout(timer);
  }, [isOpen, onLogin]);

  return (
    <BrandedModal isOpen={isOpen} onClose={onClose} eyebrow="Members only" title={title} icon={Sparkles}>
      <p className="text-gray-700 text-sm md:text-base leading-relaxed">{message}</p>
      {/* Loading dots */}
      <div className="flex gap-1.5 mt-5">
        <div className="w-2 h-2 rounded-full bg-[#E36B11] animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-[#E36B11] animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 rounded-full bg-[#E36B11] animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </BrandedModal>
  );
}
