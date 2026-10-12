"use client";

import { ChevronLeft } from "lucide-react";

interface BackButtonProps {
  onClick: () => void;
  /** Show a "Back" text label next to the icon */
  label?: boolean;
  className?: string;
}

// Consistent app-wide back button: a plain chevron, no circle or box.
export default function BackButton({ onClick, label = false, className = "" }: BackButtonProps) {
  if (label) {
    return (
      <button
        onClick={onClick}
        aria-label="Back"
        className={`flex items-center gap-1 p-1 text-gray-600 hover:text-[#E36B11] transition-colors ${className}`}
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
      className={`p-1 text-gray-600 hover:text-[#E36B11] transition-colors ${className}`}
    >
      <ChevronLeft className="w-5 h-5" />
    </button>
  );
}
