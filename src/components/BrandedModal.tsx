"use client";

import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import ModalPortal from "./ModalPortal";

// THE modal shell. Same family as the Login / Logout / Not-enough-coins cards: a coloured brand
// panel on the LEFT (on top on a phone) with the BOGX wordmark, a big faint icon, an eyebrow line
// and the Bebas headline - and the content on the RIGHT on cream. Every dialog in the app uses this
// (directly, or through BrandedConfirmModal for "are you sure?" / OK alerts), so they all look alike.
// scripts/check-modals.ts fails for a dialog that draws its own box.

export type ModalAccent = "orange" | "red" | "green" | "blue" | "gray";

export const MODAL_BAND: Record<ModalAccent, string> = {
  orange: "from-[#E36B11] via-[#D4621A] to-[#B85515]",
  red: "from-red-500 via-red-600 to-red-700",
  green: "from-emerald-500 via-emerald-600 to-emerald-700",
  blue: "from-sky-500 via-sky-600 to-sky-700",
  gray: "from-gray-500 via-gray-600 to-gray-700",
};


export interface BrandedModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Small line above the headline, e.g. "Hold on" */
  eyebrow?: string;
  title: ReactNode;
  /** Big faint icon in the band */
  icon?: LucideIcon;
  accent?: ModalAccent;
  /** A topic colour (hex) instead of a named accent - e.g. a battle's category */
  bandColor?: string;
  /** Wider right side for forms and pickers */
  size?: "md" | "lg";
  /** No close button and no click-outside (e.g. while a payment is being verified) */
  locked?: boolean;
  /** Extra content under the headline in the band (e.g. a stake or a score) */
  bandFooter?: ReactNode;
  children: ReactNode;
}

export default function BrandedModal({
  isOpen, onClose, eyebrow, title, icon: Icon, accent = "orange", bandColor, size = "md", locked = false, bandFooter, children,
}: BrandedModalProps) {
  if (!isOpen) return null;
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={locked ? undefined : onClose} />
        <div
          role="dialog"
          aria-modal="true"
          className={`relative w-full max-w-sm ${size === "lg" ? "md:max-w-3xl" : "md:max-w-2xl"} max-h-[92vh] overflow-y-auto bg-cream rounded-3xl shadow-2xl border border-warm flex flex-col md:flex-row`}
          style={{ scrollbarWidth: "none" }}
        >
          {!locked && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-white/20 hover:bg-white/30 text-white md:bg-white/80 md:hover:bg-white md:text-gray-500 md:shadow-sm"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Brand panel */}
          <div
            className={`relative overflow-hidden flex-shrink-0 md:w-[260px] ${bandColor ? "" : `bg-gradient-to-br ${MODAL_BAND[accent]}`} px-6 pt-5 pb-6 md:p-8 flex flex-col`}
            style={bandColor ? { background: `linear-gradient(135deg, ${bandColor} 0%, ${bandColor} 45%, color-mix(in srgb, ${bandColor} 75%, black) 100%)` } : undefined}
          >
            {Icon && (
              <div className="absolute -right-8 -bottom-8 md:-right-14 md:-bottom-4 opacity-[0.12] pointer-events-none">
                <Icon className="w-40 h-40 md:w-56 md:h-56 text-white" />
              </div>
            )}
            <span className="relative z-10 font-display text-2xl text-white tracking-wide mb-4 md:mb-10">BOGX</span>
            <div className="relative z-10 md:mt-auto">
              {eyebrow && <p className="text-white/70 text-xs uppercase tracking-wider mb-1">{eyebrow}</p>}
              <h2 className="font-display text-3xl md:text-4xl text-white leading-tight">{title}</h2>
              {bandFooter && <div className="mt-4">{bandFooter}</div>}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 px-6 pt-5 pb-6 md:p-8 flex flex-col justify-center">{children}</div>
        </div>
      </div>
    </ModalPortal>
  );
}

/** Main + secondary button in the modal style. Put them at the end of a BrandedModal's content. */
export function ModalActions({
  confirmText, onConfirm, cancelText, onCancel, accent = "orange", color, loading = false, disabled = false, confirmIcon: ConfirmIcon,
}: {
  confirmText: ReactNode;
  onConfirm: () => void;
  cancelText?: ReactNode;
  onCancel?: () => void;
  accent?: ModalAccent;
  /** Hex instead of the accent (topic colour) */
  color?: string;
  loading?: boolean;
  disabled?: boolean;
  confirmIcon?: LucideIcon;
}) {
  return (
    <>
      <button
        onClick={onConfirm}
        disabled={loading || disabled}
        className={`hover-shine relative overflow-hidden mt-5 w-full py-3.5 rounded-xl font-display text-lg tracking-wider text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${color ? "" : `bg-gradient-to-br ${MODAL_BAND[accent]}`}`}
        style={color ? { backgroundColor: color } : undefined}
      >
        {ConfirmIcon && !loading && <ConfirmIcon className="w-5 h-5" />}
        {loading ? "PLEASE WAIT…" : confirmText}
      </button>
      {cancelText && onCancel && (
        <button
          onClick={onCancel}
          disabled={loading}
          className="mt-2 w-full py-2.5 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-black/5 font-display text-base tracking-wider transition-colors disabled:opacity-50"
        >
          {cancelText}
        </button>
      )}
    </>
  );
}
