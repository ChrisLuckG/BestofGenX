"use client";

import { LogIn, AlertTriangle, CheckCircle, Info, X, Lightbulb, BookOpen, Play, ChevronRight, Star, Send } from "lucide-react";
import { createPortal } from "react-dom";
import NotEnoughCoinsCard from "./NotEnoughCoinsCard";
import BrandedConfirmModal from "./BrandedConfirmModal";

export type AlertType = 'error' | 'login' | 'coins' | 'success' | 'info';

interface AlertModalProps {
  show: boolean;
  type: AlertType;
  title?: string;
  message: string;
  onClose: () => void;
  buttonText?: string;
  onButtonClick?: () => void;
  secondaryButtonText?: string;
  onSecondaryButtonClick?: () => void;
  details?: string[];
  /** If true, renders inline in content area instead of fullscreen overlay (for desktop) */
  embedded?: boolean;
  /** For coins type - callbacks for earn options */
  onReadArticles?: () => void;
  onWatchVideos?: () => void;
  onPlayTrivia?: () => void;
  /** For coins type - actual balance and required amount (avoids parsing them out of the message) */
  balance?: number;
  required?: number;
}

const alertConfig = {
  error: {
    icon: AlertTriangle,
    iconColor: 'text-[#E36B11]',
    bgColor: 'bg-[#E36B11]/10 border border-[#E36B11]/30',
    defaultTitle: 'OOPS!'
  },
  login: {
    icon: LogIn,
    iconColor: 'text-[#E36B11]',
    bgColor: 'bg-[#E36B11]/10 border border-[#E36B11]/30',
    defaultTitle: 'LOGIN REQUIRED'
  },
  coins: {
    icon: null, // Uses BOGX coin image instead
    iconColor: 'text-[#E36B11]',
    bgColor: 'bg-[#E36B11]/10 border border-[#E36B11]/30',
    defaultTitle: 'NOT ENOUGH COINS'
  },
  success: {
    icon: CheckCircle,
    iconColor: 'text-[#E36B11]',
    bgColor: 'bg-[#E36B11]/10 border border-[#E36B11]/30',
    defaultTitle: 'SUCCESS!'
  },
  info: {
    icon: Info,
    iconColor: 'text-[#E36B11]',
    bgColor: 'bg-[#E36B11]/10 border border-[#E36B11]/30',
    defaultTitle: 'INFO'
  }
};

export default function AlertModal({ 
  show, 
  type, 
  title, 
  message, 
  onClose, 
  buttonText = 'OK',
  onButtonClick,
  secondaryButtonText,
  onSecondaryButtonClick,
  details,
  embedded = false,
  onReadArticles,
  onWatchVideos,
  onPlayTrivia,
  balance,
  required
}: AlertModalProps) {
  if (!show) return null;

  const config = alertConfig[type];
  const Icon = config.icon;

  const handleButtonClick = () => {
    if (onButtonClick) {
      onButtonClick();
    }
    onClose();
  };

  // Container class - always has blur overlay now
  const containerClass = "fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-md";
  
  // Wrap in portal to escape stacking contexts
  const renderModal = (content: React.ReactNode) => {
    if (typeof document === 'undefined') return content;
    return createPortal(content, document.body);
  };

  // Special layout for coins type: the shared card in the Login/Logout style
  if (type === 'coins') {
    // Prefer the explicit values; only fall back to parsing the message for legacy callers
    const amountMatch = message.match(/(\d+[,.]?\d*)/);
    const currentBalance = balance ?? (amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : 0);
    const requiredAmount = required ?? 0.50;
    const then = (fn?: () => void) => () => { fn?.(); onClose(); };

    return renderModal(
      <div className={containerClass} onClick={onClose}>
        <NotEnoughCoinsCard
          balance={currentBalance}
          required={requiredAmount}
          message={message}
          title={title}
          onClose={onClose}
          onEarn={handleButtonClick}
          onReadArticles={then(onReadArticles)}
          onWatchVideos={then(onWatchVideos)}
          onPlayTrivia={then(onPlayTrivia)}
        />
      </div>
    );
  }
  // Special, more celebratory layout for success
  if (type === 'success') {
    return renderModal(
      <div className={containerClass} onClick={onClose}>
        <div
          className="mx-6 w-full max-w-sm bg-[#F5F0E8] rounded-2xl shadow-2xl p-6 pt-7 relative border border-warm overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white border border-warm text-gray-500 hover:text-gray-700 transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Decorative checkmark with confetti accents */}
          <div className="relative w-20 h-20 mx-auto mb-4">
            <Star className="absolute -top-1 -left-2 w-4 h-4 text-[#E36B11]/50 fill-[#E36B11]/50" />
            <Star className="absolute top-1 -right-2 w-3 h-3 text-[#E36B11]/40 fill-[#E36B11]/40" />
            <span className="absolute -bottom-0.5 -left-1 w-2 h-2 rounded-full bg-[#E36B11]/40" />
            <span className="absolute -bottom-1 right-0 w-1.5 h-1.5 rounded-full bg-[#E36B11]/30" />
            <div className="w-20 h-20 rounded-full bg-[#E36B11]/10 border-2 border-[#E36B11]/25 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-[#E36B11]" strokeWidth={2} />
            </div>
          </div>

          {/* Title with star divider */}
          <h3 className="font-display text-2xl tracking-wider text-center text-gray-900 mb-1.5">
            {title || config.defaultTitle}
          </h3>
          <div className="flex items-center justify-center gap-1.5 mb-3">
            <span className="w-6 h-px bg-[#E36B11]/40" />
            <Star className="w-2.5 h-2.5 text-[#E36B11] fill-[#E36B11]" />
            <span className="w-6 h-px bg-[#E36B11]/40" />
          </div>

          {/* Message */}
          <p className="text-gray-600 text-sm text-center mb-4">
            {message}
          </p>

          {/* Details as a "What's next?" card */}
          {details && details.length > 0 && (
            <div className="bg-white/70 border border-warm rounded-xl p-3 mb-5 flex items-start gap-3 text-left">
              <div className="w-9 h-9 rounded-lg bg-[#E36B11]/10 flex items-center justify-center flex-shrink-0">
                <Send className="w-4 h-4 text-[#E36B11]" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">What's next?</p>
                {details.map((detail, i) => (
                  <p key={i} className="text-gray-700 text-xs leading-snug">{detail}</p>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleButtonClick}
              className="w-full py-3.5 bg-[#E36B11] text-white font-bold text-sm tracking-wider rounded-xl hover:bg-[#C4772A] transition-colors flex items-center justify-center gap-1.5"
            >
              {buttonText}
              <ChevronRight className="w-4 h-4" />
            </button>

            {secondaryButtonText && (
              <button
                onClick={() => {
                  if (onSecondaryButtonClick) onSecondaryButtonClick();
                  onClose();
                }}
                className="w-full py-3 bg-cream text-gray-600 font-bold text-sm tracking-wider rounded-xl hover:bg-skeleton-light transition-colors"
              >
                {secondaryButtonText}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Standard layout (login / error / info): the same branded card as the confirm and
  // Login/Logout dialogs - orange band with the BOGX wordmark and the type's icon
  const eyebrow = type === 'login' ? 'Members only' : type === 'error' ? 'Something went wrong' : 'Good to know';
  return (
    <BrandedConfirmModal
      isOpen
      onClose={onClose}
      onConfirm={handleButtonClick}
      accent={type === 'error' ? 'red' : 'orange'}
      icon={Icon ?? Info}
      eyebrow={eyebrow}
      title={title || config.defaultTitle}
      message={message}
      confirmText={buttonText}
      cancelText={secondaryButtonText}
      onCancel={() => { if (onSecondaryButtonClick) onSecondaryButtonClick(); onClose(); }}
    >
      {details && details.length > 0 && (
        <div className="bg-white rounded-xl border border-warm px-4 py-3 shadow-sm">
          {details.map((detail, i) => (
            <p key={i} className="text-gray-600 text-xs text-center py-0.5">{detail}</p>
          ))}
        </div>
      )}
    </BrandedConfirmModal>
  );
}