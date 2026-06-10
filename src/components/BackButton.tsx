"use client";

import { ChevronLeft } from "lucide-react";

interface BackButtonProps {
  onClick: () => void;
  /** Show a "Back" text label next to the icon */
  label?: boolean;
  className?: string;
}

// Consistent app-wide back button: a circular control with a subtle
// background so it reads as a tappable button everywhere it appears.
export default function BackButton({ onClick, label = false, className = "" }: BackButtonProps) {
  if (label) {
    return (
      <button
        onClick={onClick}
        aria-label="Back"
        className={`flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full bg-black/5 border border-warm text-gray-700 hover:bg-black/10 hover:text-[#D4873A] transition-colors ${className}`}
      >
        <ChevronLeft className="w-5 h-5" />
        <span className="text-sm font-medium">Back</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      aria-label="Back"
      className={`w-9 h-9 rounded-full flex items-center justify-center bg-black/5 border border-warm text-gray-700 hover:bg-black/10 hover:text-[#D4873A] transition-colors ${className}`}
    >
      <ChevronLeft className="w-5 h-5" />
    </button>
  );
}
