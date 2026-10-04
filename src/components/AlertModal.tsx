"use client";

import { LogIn, AlertTriangle, CheckCircle, Info, X, Lightbulb, BookOpen, Play, ChevronRight, Star, Send } from "lucide-react";
import { createPortal } from "react-dom";

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

  // Special layout for coins type
  if (type === 'coins') {
    // Prefer the explicit values; only fall back to parsing the message for legacy callers
    const amountMatch = message.match(/(\d+[,.]?\d*)/);
    const currentBalance = balance ?? (amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : 0);
    const requiredAmount = required ?? 0.50;
    const missingAmount = Math.max(0, requiredAmount - currentBalance);
    
    return renderModal(
      <div className={containerClass} onClick={onClose}>
        {/* Sizing is mobile-first and scaled up from `md:` (>=768px) only, so the
            cramped phone layout is untouched while desktop gets room to breathe.
            The `embedded` prop is NOT usable as the desktop signal here - this
            coins branch returns before embedded is ever consulted. */}
        <div 
          className="mx-4 w-full max-w-sm md:max-w-2xl bg-cream rounded-2xl shadow-2xl relative overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 md:top-4 md:right-4 w-7 h-7 md:w-9 md:h-9 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition-all border border-warm z-10"
          >
            <X className="w-3.5 h-3.5 md:w-5 md:h-5 text-gray-500" />
          </button>

          {/* Header with BOGX coin */}
          <div className="pt-5 pb-1 md:pt-9 md:pb-3 text-center font-display">
            <img 
              src="/images/bogxcoin.png" 
              alt="BOGX" 
              className="w-12 h-12 md:w-20 md:h-20 mx-auto mb-2 md:mb-4"
            />
            
            <h2 className="text-xl md:text-4xl tracking-wide text-gray-900 mb-0.5 md:mb-2">
              {title || 'NOT ENOUGH COINS'}
            </h2>
            <p className="text-gray-600 text-sm md:text-lg px-4">
              {message}
            </p>
          </div>

          {/* Balance Box */}
          <div className="mx-4 md:mx-8 mb-2 md:mb-5 font-display">
            <div className="flex bg-[#E36B11]/5 rounded-lg md:rounded-xl border border-[#E36B11]/10 divide-x divide-[#E36B11]/10">
              <div className="flex-1 py-1.5 md:py-4 text-center">
                <div className="text-[10px] md:text-xs text-gray-600 uppercase tracking-wider">Your balance</div>
                <div className="text-base md:text-3xl text-gray-900">{currentBalance.toFixed(2).replace('.', ',')} <span className="text-[11px] md:text-sm text-gray-600">BOGX</span></div>
              </div>
              <div className="flex-1 py-1.5 md:py-4 text-center">
                <div className="text-[10px] md:text-xs text-gray-600 uppercase tracking-wider">Missing</div>
                <div className="text-base md:text-3xl text-[#E36B11]">{missingAmount.toFixed(2).replace('.', ',')} <span className="text-[11px] md:text-sm text-gray-600">BOGX</span></div>
              </div>
            </div>
          </div>

          {/* Earn coins section */}
          <div className="mx-4 md:mx-8 mb-2 md:mb-5 font-display">
            <div className="flex items-center gap-2 md:gap-3 mb-1.5 md:mb-3">
              <div className="w-6 h-6 md:w-9 md:h-9 bg-[#E36B11]/10 rounded-md md:rounded-lg flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-3 h-3 md:w-5 md:h-5 text-[#E36B11]" />
              </div>
              <div>
                <p className="text-gray-900 text-sm md:text-lg">Earn coins and join the action!</p>
                <p className="text-[10px] md:text-sm text-gray-600">Here are some quick ways to get BOGX.</p>
              </div>
            </div>

            {/* Earn options */}
            <div className="space-y-1 md:space-y-2.5">
              {/* Read articles */}
              <button
                onClick={() => { onReadArticles?.(); onClose(); }}
                className="w-full p-2 md:p-4 bg-[#E36B11]/5 rounded-lg md:rounded-xl flex items-center gap-2 md:gap-4 hover:bg-[#E36B11]/10 transition-all"
              >
                <div className="w-8 h-8 md:w-12 md:h-12 bg-white rounded-md md:rounded-lg flex items-center justify-center border border-warm flex-shrink-0">
                  <BookOpen className="w-4 h-4 md:w-6 md:h-6 text-gray-700" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-gray-900 text-sm md:text-lg">Read articles</p>
                  <p className="text-[10px] md:text-sm text-gray-600">Earn per article</p>
                </div>
                <div className="flex items-center gap-1 md:gap-2 text-[#E36B11] text-sm md:text-lg whitespace-nowrap">
                  +0,05 <img src="/images/bogxcoin.png" alt="" className="w-3.5 h-3.5 md:w-5 md:h-5" />
                  <ChevronRight className="w-3.5 h-3.5 md:w-5 md:h-5 text-gray-400" />
                </div>
              </button>

              {/* Watch videos */}
              <button
                onClick={() => { onWatchVideos?.(); onClose(); }}
                className="w-full p-2 md:p-4 bg-[#E36B11]/5 rounded-lg md:rounded-xl flex items-center gap-2 md:gap-4 hover:bg-[#E36B11]/10 transition-all"
              >
                <div className="w-8 h-8 md:w-12 md:h-12 bg-white rounded-md md:rounded-lg flex items-center justify-center border border-warm flex-shrink-0">
                  <Play className="w-4 h-4 md:w-6 md:h-6 text-gray-700" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-gray-900 text-sm md:text-lg">Watch videos</p>
                  <p className="text-[10px] md:text-sm text-gray-600">Watch 1 video</p>
                </div>
                <div className="flex items-center gap-1 md:gap-2 text-[#E36B11] text-sm md:text-lg whitespace-nowrap">
                  +0,10 <img src="/images/bogxcoin.png" alt="" className="w-3.5 h-3.5 md:w-5 md:h-5" />
                  <ChevronRight className="w-3.5 h-3.5 md:w-5 md:h-5 text-gray-400" />
                </div>
              </button>

              {/* Win a trivia */}
              <button
                onClick={() => { onPlayTrivia?.(); onClose(); }}
                className="w-full p-2 md:p-4 bg-[#E36B11]/5 rounded-lg md:rounded-xl flex items-center gap-2 md:gap-4 hover:bg-[#E36B11]/10 transition-all"
              >
                <div className="w-8 h-8 md:w-12 md:h-12 bg-white rounded-md md:rounded-lg flex items-center justify-center border border-warm flex-shrink-0">
                  <img src="/images/Icon/trivia2.png" alt="" className="w-4 h-4 md:w-6 md:h-6" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-gray-900 text-sm md:text-lg">Win a trivia</p>
                  <p className="text-[10px] md:text-sm text-gray-600">Earn up to 0.15 per question</p>
                </div>
                <div className="flex items-center gap-1 md:gap-2 text-[#E36B11] text-sm md:text-lg whitespace-nowrap">
                  +0,05-0,15 <img src="/images/bogxcoin.png" alt="" className="w-3.5 h-3.5 md:w-5 md:h-5" />
                  <ChevronRight className="w-3.5 h-3.5 md:w-5 md:h-5 text-gray-400" />
                </div>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="px-4 md:px-8 pb-4 md:pb-8 space-y-1.5 md:space-y-3">
            <button
              onClick={handleButtonClick}
              className="w-full py-3 md:py-5 bg-[#E36B11] rounded-xl font-bold text-white transition-all hover:bg-[#C4772A] text-sm md:text-xl"
            >
              EARN BOGX
            </button>

            <button
              onClick={onClose}
              className="w-full py-2 md:py-3 text-gray-500 font-medium text-xs md:text-base transition-all hover:text-gray-700"
            >
              Maybe later
            </button>
          </div>
        </div>
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

  // Standard layout for other types
  return renderModal(
    <div 
      className={containerClass}
      onClick={onClose}
    >
      <div 
        className="mx-6 w-full max-w-sm bg-[#F5F0E8] rounded-2xl shadow-2xl p-6 relative border border-warm"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        {Icon && (
          <div className={`w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center ${config.bgColor}`}>
            <Icon className={`w-7 h-7 ${config.iconColor}`} />
          </div>
        )}
        
        {/* Title */}
        <h3 className="font-display text-xl tracking-wider text-center text-gray-900 mb-2">
          {title || config.defaultTitle}
        </h3>
        
        {/* Message */}
        <p className="text-gray-600 text-sm text-center mb-4">
          {message}
        </p>

        {/* Details list */}
        {details && details.length > 0 && (
          <div className="bg-cream rounded-xl p-3 mb-4">
            {details.map((detail, i) => (
              <p key={i} className="text-gray-500 text-xs text-center py-1">
                {detail}
              </p>
            ))}
          </div>
        )}
        
        {/* Buttons */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleButtonClick}
            className="w-full py-3 bg-[#E36B11] text-white font-bold text-sm tracking-wider rounded-xl hover:bg-[#C4772A] transition-colors"
          >
            {buttonText}
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
