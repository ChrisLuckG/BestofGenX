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
}

const alertConfig = {
  error: {
    icon: AlertTriangle,
    iconColor: 'text-[#D4873A]',
    bgColor: 'bg-[#D4873A]/10 border border-[#D4873A]/30',
    defaultTitle: 'OOPS!'
  },
  login: {
    icon: LogIn,
    iconColor: 'text-[#D4873A]',
    bgColor: 'bg-[#D4873A]/10 border border-[#D4873A]/30',
    defaultTitle: 'LOGIN REQUIRED'
  },
  coins: {
    icon: null, // Uses BOGX coin image instead
    iconColor: 'text-[#D4873A]',
    bgColor: 'bg-[#D4873A]/10 border border-[#D4873A]/30',
    defaultTitle: 'NOT ENOUGH COINS'
  },
  success: {
    icon: CheckCircle,
    iconColor: 'text-[#D4873A]',
    bgColor: 'bg-[#D4873A]/10 border border-[#D4873A]/30',
    defaultTitle: 'SUCCESS!'
  },
  info: {
    icon: Info,
    iconColor: 'text-[#D4873A]',
    bgColor: 'bg-[#D4873A]/10 border border-[#D4873A]/30',
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
  onPlayTrivia
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
    // Extract amount from message if possible (e.g. "You need 0.50 coins...")
    const amountMatch = message.match(/(\d+[,.]?\d*)/);
    const requiredAmount = amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : 0.50;
    
    return renderModal(
      <div className={containerClass} onClick={onClose}>
        <div 
          className="mx-4 w-full max-w-sm bg-cream rounded-2xl shadow-2xl relative overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition-all border border-warm z-10"
          >
            <X className="w-3.5 h-3.5 text-gray-500" />
          </button>

          {/* Header with BOGX coin */}
          <div className="pt-5 pb-1 text-center font-display">
            <img 
              src="/images/bogxcoin.png" 
              alt="BOGX" 
              className="w-12 h-12 mx-auto mb-2"
            />
            
            <h2 className="text-xl tracking-wide text-gray-900 mb-0.5">
              {title || 'NOT ENOUGH COINS'}
            </h2>
            <p className="text-gray-600 text-sm px-4">
              {message}
            </p>
          </div>

          {/* Balance Box */}
          <div className="mx-4 mb-2 font-display">
            <div className="flex bg-[#D4873A]/5 rounded-lg border border-[#D4873A]/10 divide-x divide-[#D4873A]/10">
              <div className="flex-1 py-1.5 text-center">
                <div className="text-[10px] text-gray-600 uppercase tracking-wider">Your balance</div>
                <div className="text-base text-gray-900">0,00 <span className="text-[11px] text-gray-600">BOGX</span></div>
              </div>
              <div className="flex-1 py-1.5 text-center">
                <div className="text-[10px] text-gray-600 uppercase tracking-wider">Missing</div>
                <div className="text-base text-[#D4873A]">{requiredAmount.toFixed(2).replace('.', ',')} <span className="text-[11px] text-gray-600">BOGX</span></div>
              </div>
            </div>
          </div>

          {/* Earn coins section */}
          <div className="mx-4 mb-2 font-display">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 bg-[#D4873A]/10 rounded-md flex items-center justify-center">
                <Lightbulb className="w-3 h-3 text-[#D4873A]" />
              </div>
              <div>
                <p className="text-gray-900 text-sm">Earn coins and join the action!</p>
                <p className="text-[10px] text-gray-600">Here are some quick ways to get BOGX.</p>
              </div>
            </div>

            {/* Earn options */}
            <div className="space-y-1">
              {/* Read articles */}
              <button
                onClick={() => { onReadArticles?.(); onClose(); }}
                className="w-full p-2 bg-[#D4873A]/5 rounded-lg flex items-center gap-2 hover:bg-[#D4873A]/10 transition-all"
              >
                <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center border border-warm">
                  <BookOpen className="w-4 h-4 text-gray-700" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-gray-900 text-sm">Read articles</p>
                  <p className="text-[10px] text-gray-600">Earn per article</p>
                </div>
                <div className="flex items-center gap-1 text-[#D4873A] text-sm">
                  +0,05 <img src="/images/bogxcoin.png" alt="" className="w-3.5 h-3.5" />
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                </div>
              </button>

              {/* Watch videos */}
              <button
                onClick={() => { onWatchVideos?.(); onClose(); }}
                className="w-full p-2 bg-[#D4873A]/5 rounded-lg flex items-center gap-2 hover:bg-[#D4873A]/10 transition-all"
              >
                <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center border border-warm">
                  <Play className="w-4 h-4 text-gray-700" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-gray-900 text-sm">Watch videos</p>
                  <p className="text-[10px] text-gray-600">Watch 1 video</p>
                </div>
                <div className="flex items-center gap-1 text-[#D4873A] text-sm">
                  +0,10 <img src="/images/bogxcoin.png" alt="" className="w-3.5 h-3.5" />
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                </div>
              </button>

              {/* Win a trivia */}
              <button
                onClick={() => { onPlayTrivia?.(); onClose(); }}
                className="w-full p-2 bg-[#D4873A]/5 rounded-lg flex items-center gap-2 hover:bg-[#D4873A]/10 transition-all"
              >
                <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center border border-warm">
                  <img src="/images/Icon/trivia2.png" alt="" className="w-4 h-4" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-gray-900 text-sm">Win a trivia</p>
                  <p className="text-[10px] text-gray-600">Earn up to 0.15 per question</p>
                </div>
                <div className="flex items-center gap-1 text-[#D4873A] text-sm">
                  +0,05-0,15 <img src="/images/bogxcoin.png" alt="" className="w-3.5 h-3.5" />
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                </div>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="px-4 pb-4 space-y-1.5">
            <button
              onClick={handleButtonClick}
              className="w-full py-3 bg-[#D4873A] rounded-xl font-bold text-white transition-all hover:bg-[#C4772A] text-sm"
            >
              EARN BOGX
            </button>

            <button
              onClick={onClose}
              className="w-full py-2 text-gray-500 font-medium text-xs transition-all hover:text-gray-700"
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
            <Star className="absolute -top-1 -left-2 w-4 h-4 text-[#D4873A]/50 fill-[#D4873A]/50" />
            <Star className="absolute top-1 -right-2 w-3 h-3 text-[#D4873A]/40 fill-[#D4873A]/40" />
            <span className="absolute -bottom-0.5 -left-1 w-2 h-2 rounded-full bg-[#D4873A]/40" />
            <span className="absolute -bottom-1 right-0 w-1.5 h-1.5 rounded-full bg-[#D4873A]/30" />
            <div className="w-20 h-20 rounded-full bg-[#D4873A]/10 border-2 border-[#D4873A]/25 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-[#D4873A]" strokeWidth={2} />
            </div>
          </div>

          {/* Title with star divider */}
          <h3 className="font-display text-2xl tracking-wider text-center text-gray-900 mb-1.5">
            {title || config.defaultTitle}
          </h3>
          <div className="flex items-center justify-center gap-1.5 mb-3">
            <span className="w-6 h-px bg-[#D4873A]/40" />
            <Star className="w-2.5 h-2.5 text-[#D4873A] fill-[#D4873A]" />
            <span className="w-6 h-px bg-[#D4873A]/40" />
          </div>

          {/* Message */}
          <p className="text-gray-600 text-sm text-center mb-4">
            {message}
          </p>

          {/* Details as a "What's next?" card */}
          {details && details.length > 0 && (
            <div className="bg-white/70 border border-warm rounded-xl p-3 mb-5 flex items-start gap-3 text-left">
              <div className="w-9 h-9 rounded-lg bg-[#D4873A]/10 flex items-center justify-center flex-shrink-0">
                <Send className="w-4 h-4 text-[#D4873A]" />
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
              className="w-full py-3.5 bg-[#D4873A] text-white font-bold text-sm tracking-wider rounded-xl hover:bg-[#C4772A] transition-colors flex items-center justify-center gap-1.5"
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
            className="w-full py-3 bg-[#D4873A] text-white font-bold text-sm tracking-wider rounded-xl hover:bg-[#C4772A] transition-colors"
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
