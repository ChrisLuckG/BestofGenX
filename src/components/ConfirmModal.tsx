"use client";

import { AlertTriangle, HelpCircle, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import BrandedConfirmModal from "./BrandedConfirmModal";

// The app's plain "are you sure?" dialog - now the branded one (colour band left, text right), with
// the same props as before, so callers did not change.
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: "red" | "orange" | "green";
  loading?: boolean;
  eyebrow?: string;
  icon?: LucideIcon;
}

const DEFAULTS = {
  red: { eyebrow: "Are you sure?", icon: AlertTriangle },
  orange: { eyebrow: "Heads up", icon: HelpCircle },
  green: { eyebrow: "Almost there", icon: CheckCircle2 },
} as const;

export default function ConfirmModal({
  isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel", confirmColor = "red", loading = false, eyebrow, icon,
}: ConfirmModalProps) {
  return (
    <BrandedConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      eyebrow={eyebrow ?? DEFAULTS[confirmColor].eyebrow}
      title={title}
      message={message}
      icon={icon ?? DEFAULTS[confirmColor].icon}
      confirmText={confirmText.toUpperCase()}
      cancelText={cancelText}
      accent={confirmColor}
      loading={loading}
    />
  );
}
