"use client";

import { X } from "lucide-react";
import { createPortal } from "react-dom";

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
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmColor = "red",
  loading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const colorClasses = {
    red: "bg-red-500 hover:bg-red-600",
    orange: "bg-[#E36B11] hover:bg-[#c47830]",
    green: "bg-green-500 hover:bg-green-600",
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/70" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative w-full max-w-sm bg-[#F5F0E8] rounded-2xl shadow-2xl border-2 border-[#E5DDD0] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5DDD0]">
          <h3 className="font-bold text-gray-900 text-lg">{title}</h3>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Content */}
        <div className="px-5 py-4">
          <p className="text-gray-700 text-sm">{message}</p>
        </div>
        
        {/* Actions */}
        <div className="flex gap-3 px-5 py-4 border-t border-[#E5DDD0]">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-[#E5DDD0] text-gray-700 rounded-lg font-bold text-sm hover:bg-[#DDD5C8] transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 text-white rounded-lg font-bold text-sm transition-colors disabled:opacity-50 ${colorClasses[confirmColor]}`}
          >
            {loading ? "..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
