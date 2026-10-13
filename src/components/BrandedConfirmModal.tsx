"use client";

import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import ModalPortal from "./ModalPortal";

// "Are you sure?" dialog in the same family as the Login / Logout / Welcome-back
// modals: coloured brand band with the BOGX wordmark and a big faint icon, Bebas
// headline, cream body. Use it instead of the plain ConfirmModal for anything the
// player should feel is part of the game.
interface BrandedConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Small line above the headline, e.g. "Hold on" */
  eyebrow?: string;
  title: string;
  message?: string;
  /** Big faint icon in the band */
  icon?: LucideIcon;
  /** Extra content between message and buttons (e.g. a stats chip) */
  children?: ReactNode;
  confirmText: string;
  /** Second button under the main one. Omit it for a plain OK-style alert. */
  cancelText?: string;
  /** Runs when the second button is used (defaults to just closing) */
  onCancel?: () => void;
  accent?: "orange" | "red";
  loading?: boolean;
}

const BAND = {
  orange: "from-[#E36B11] via-[#D4621A] to-[#B85515]",
  red: "from-red-500 via-red-600 to-red-700",
} as const;

export default function BrandedConfirmModal({
  isOpen, onClose, onConfirm, eyebrow, title, message, icon: Icon, children, confirmText, cancelText, onCancel, accent = "orange", loading = false,
}: BrandedConfirmModalProps) {
  if (!isOpen) return null;
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={loading ? undefined : onClose} />
        {/* Same split as the Login / Logout / Not-enough-coins cards: brand panel on the
            left (on top on a phone), content next to it */}
        <div role="dialog" aria-modal="true" className="relative w-full max-w-sm md:max-w-2xl max-h-[92vh] overflow-y-auto bg-cream rounded-3xl shadow-2xl border border-warm flex flex-col md:flex-row animate-[cardIn_0.3s_ease-out]" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
            className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 bg-white/20 hover:bg-white/30 text-white md:bg-white/80 md:hover:bg-white md:text-gray-500 md:shadow-sm"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Brand panel */}
          <div className={`relative overflow-hidden flex-shrink-0 md:w-[260px] bg-gradient-to-br ${BAND[accent]} px-6 pt-5 pb-6 md:p-8 flex flex-col`}>
            {Icon && (
              <div className="absolute -right-8 -bottom-8 md:-right-14 md:-bottom-4 opacity-[0.12] pointer-events-none">
                <Icon className="w-40 h-40 md:w-56 md:h-56 text-white" />
              </div>
            )}
            <span className="relative z-10 font-display text-2xl text-white tracking-wide mb-4 md:mb-10">BOGX</span>
            <div className="relative z-10 md:mt-auto">
              {eyebrow && <p className="text-white/70 text-xs uppercase tracking-wider mb-1">{eyebrow}</p>}
              <h2 className="font-display text-3xl md:text-4xl text-white leading-tight">{title}</h2>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 px-6 pt-5 pb-6 md:p-8 flex flex-col justify-center">
            {message && <p className="text-gray-700 text-sm md:text-base leading-relaxed">{message}</p>}
            {children && <div className="mt-4">{children}</div>}

            <button
              onClick={onConfirm}
              disabled={loading}
              className={`hover-shine relative overflow-hidden mt-5 w-full py-3.5 rounded-xl font-display text-lg tracking-wider text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-60 bg-gradient-to-br ${BAND[accent]}`}
            >
              {loading ? "PLEASE WAIT…" : confirmText}
            </button>
            {cancelText && (
              <button
                onClick={onCancel ?? onClose}
                disabled={loading}
                className="mt-2 w-full py-2.5 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-black/5 font-display text-base tracking-wider transition-colors disabled:opacity-50"
              >
                {cancelText}
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}