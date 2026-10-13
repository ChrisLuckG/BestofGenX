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
  cancelText: string;
  accent?: "orange" | "red";
  loading?: boolean;
}

const BAND = {
  orange: "from-[#E36B11] via-[#D4621A] to-[#B85515]",
  red: "from-red-500 via-red-600 to-red-700",
} as const;

export default function BrandedConfirmModal({
  isOpen, onClose, onConfirm, eyebrow, title, message, icon: Icon, children, confirmText, cancelText, accent = "orange", loading = false,
}: BrandedConfirmModalProps) {
  if (!isOpen) return null;
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={loading ? undefined : onClose} />
        <div role="dialog" aria-modal="true" className="relative w-full max-w-md bg-cream rounded-3xl shadow-2xl overflow-hidden border border-warm animate-[cardIn_0.3s_ease-out]">
          {/* Brand band */}
          <div className={`relative overflow-hidden bg-gradient-to-br ${BAND[accent]} px-7 pt-6 pb-7`}>
            {Icon && (
              <div className="absolute inset-0 flex items-center justify-end pr-4 opacity-[0.1] pointer-events-none">
                <Icon className="w-40 h-40 text-white" />
              </div>
            )}
            <div className="relative z-10 flex items-center justify-between mb-5">
              <span className="font-display text-2xl text-white tracking-wide">BOGX</span>
              <button
                onClick={onClose}
                disabled={loading}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="relative z-10">
              {eyebrow && <p className="text-white/70 text-xs uppercase tracking-wider mb-1">{eyebrow}</p>}
              <h2 className="font-display text-4xl text-white leading-tight">{title}</h2>
            </div>
          </div>

          {/* Body */}
          <div className="px-7 pt-5 pb-6">
            {message && <p className="text-gray-700 text-sm leading-relaxed">{message}</p>}
            {children && <div className="mt-4">{children}</div>}

            <button
              onClick={onConfirm}
              disabled={loading}
              className={`hover-shine relative overflow-hidden mt-5 w-full py-3.5 rounded-xl font-display text-lg tracking-wider text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-60 bg-gradient-to-br ${BAND[accent]}`}
            >
              {loading ? "PLEASE WAIT…" : confirmText}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="mt-2 w-full py-2.5 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-black/5 font-display text-base tracking-wider transition-colors disabled:opacity-50"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
