"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import BrandedModal, { ModalActions, type ModalAccent } from "./BrandedModal";

// "Are you sure?" dialog / OK alert in the same family as the Login / Logout / Welcome-back
// modals: coloured brand band on the left, text and buttons on the right (BrandedModal).
interface BrandedConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Small line above the headline, e.g. "Hold on" */
  eyebrow?: string;
  title: string;
  message?: ReactNode;
  /** Big faint icon in the band */
  icon?: LucideIcon;
  /** Extra content between message and buttons (e.g. a stats chip) */
  children?: ReactNode;
  confirmText: string;
  /** Second button under the main one. Omit it for a plain OK-style alert. */
  cancelText?: string;
  /** Runs when the second button is used (defaults to just closing) */
  onCancel?: () => void;
  accent?: ModalAccent;
  /** Topic colour (hex) instead of the accent */
  bandColor?: string;
  loading?: boolean;
}

export default function BrandedConfirmModal({
  isOpen, onClose, onConfirm, eyebrow, title, message, icon, children, confirmText, cancelText, onCancel, accent = "orange", bandColor, loading = false,
}: BrandedConfirmModalProps) {
  return (
    <BrandedModal isOpen={isOpen} onClose={loading ? () => {} : onClose} eyebrow={eyebrow} title={title} icon={icon} accent={accent} bandColor={bandColor} locked={loading}>
      {message && <div className="text-gray-700 text-sm md:text-base leading-relaxed">{message}</div>}
      {children && <div className="mt-4">{children}</div>}
      <ModalActions
        confirmText={confirmText}
        onConfirm={onConfirm}
        cancelText={cancelText}
        onCancel={onCancel ?? onClose}
        accent={accent}
        color={bandColor}
        loading={loading}
      />
    </BrandedModal>
  );
}
