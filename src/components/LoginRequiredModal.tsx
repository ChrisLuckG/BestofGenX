"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

interface LoginRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Open the full login flow - called automatically after brief animation */
  onLogin: () => void;
  onRegister: () => void;
  /** Optional title and message overrides */
  title?: string;
  message?: string;
  /** If true, renders inline instead of as fullscreen overlay (for desktop) */
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
  embedded = false,
}: LoginRequiredModalProps) {
  const [animating, setAnimating] = useState(false);

  // Auto-transition to login after brief delay
  useEffect(() => {
    if (!isOpen) {
      setAnimating(false);
      return;
    }

    // Start animation
    setAnimating(true);

    // Transition to login after 800ms
    const timer = setTimeout(() => {
      onLogin();
    }, 800);

    return () => clearTimeout(timer);
  }, [isOpen, onLogin]);

  if (!isOpen) return null;

  const content = (
    <div 
      className={`relative w-full max-w-xs bg-[#F5F0E8] rounded-2xl shadow-2xl overflow-hidden border border-warm transition-all duration-300 ${
        animating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
      }`}
    >
      <div className="px-6 py-8 text-center">
        {/* Animated icon */}
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#E36B11] to-[#C4772A] flex items-center justify-center mb-4 shadow-lg animate-pulse">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        
        <h2 className="text-xl font-display tracking-wide text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-2">{message}</p>
        
        {/* Loading dots */}
        <div className="flex justify-center gap-1 mt-4">
          <div className="w-2 h-2 rounded-full bg-[#E36B11] animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-[#E36B11] animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-[#E36B11] animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );

  // Desktop: render inline in content area
  if (embedded) {
    return (
      <div className="absolute inset-0 z-[50] flex items-center justify-center p-5 bg-[#F5F0E8]/80 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  // Mobile: fullscreen overlay
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-5">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {content}
    </div>
  );
}
