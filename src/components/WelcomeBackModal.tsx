"use client";

import { useState, useEffect } from "react";
import { X, TrendingDown, TrendingUp, Bell, Sparkles } from "lucide-react";

export interface WelcomeBackRankChange {
  from: number;
  to: number;
  direction: "up" | "down" | "same";
}

interface WelcomeAI {
  greeting: string;
  subtitle: string;
  facts?: string[];  // Array of 3 daily facts
  fact?: string;     // Legacy single fact (fallback)
  factReaction?: string;
  callToAction: string;
}

interface WelcomeBackModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  currentRank: number | null;
  rankChange: WelcomeBackRankChange | null;
  welcomeAI: WelcomeAI | null;
  notificationsEnabled: boolean;
  unreadCount: number;
  playedCount: number;
  totalCards: number;
  onPrimaryAction: () => void;
  onEnableNotifications: () => void;
}

// Slide content types
interface SlideContent {
  icon: React.ElementType;
  label: string;
  content: string;
  reaction?: string;
  bgClass: string;
  iconClass: string;
  labelClass: string;
}

export default function WelcomeBackModal({
  isOpen,
  onClose,
  username,
  currentRank,
  rankChange,
  welcomeAI,
  notificationsEnabled,
  unreadCount,
  playedCount,
  totalCards,
  onPrimaryAction,
  onEnableNotifications,
}: WelcomeBackModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const hasStarted = playedCount > 0;
  const isComplete = totalCards > 0 && playedCount >= totalCards;
  const progressPct = totalCards > 0 ? Math.round((playedCount / totalCards) * 100) : 0;
  const showNotificationReminder = !notificationsEnabled && unreadCount > 0;

  // AI-generated or fallback content
  const greeting = welcomeAI?.greeting || `Hey ${username}!`;
  const subtitle = welcomeAI?.subtitle || "Ready for today's challenge?";
  const facts = welcomeAI?.facts || (welcomeAI?.fact ? [welcomeAI.fact] : []);
  const callToAction = welcomeAI?.callToAction || (
    hasStarted && !isComplete ? "Continue" : isComplete ? "View Results" : "Let's go!"
  );

  // Build slides array - one slide per daily fact
  const slides: SlideContent[] = facts.map((factText, idx) => ({
    icon: Sparkles,
    label: "On This Day",
    content: factText,
    bgClass: idx === 0 
      ? "bg-gradient-to-br from-[#D4873A]/10 to-[#D4873A]/5"
      : idx === 1
        ? "bg-gradient-to-br from-purple-50 to-purple-100/50"
        : "bg-gradient-to-br from-emerald-50 to-emerald-100/50",
    iconClass: idx === 0 ? "text-[#D4873A]" : idx === 1 ? "text-purple-500" : "text-emerald-500",
    labelClass: idx === 0 ? "text-[#D4873A]" : idx === 1 ? "text-purple-600" : "text-emerald-600",
  }));

  // Auto-advance slides
  useEffect(() => {
    if (!isOpen || slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isOpen, slides.length]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

  // Touch swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    
    if (Math.abs(diff) > 50) { // Minimum swipe distance
      if (diff > 0) {
        nextSlide(); // Swipe left = next
      } else {
        prevSlide(); // Swipe right = prev
      }
    }
    setTouchStart(null);
  };

  if (!isOpen) return null;

  const slide = slides[currentSlide];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-5">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-cream rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-warm">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full hover:bg-[#D4873A]/10 flex items-center justify-center text-gray-400 hover:text-[#D4873A] transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header - Logo centered on top */}
        <div className="px-6 pt-6 pb-4 text-center flex-shrink-0">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#D4873A]/10 to-[#D4873A]/5 flex items-center justify-center shadow-sm">
            <img src="/images/genxlogo1.png" alt="Best of GenX" className="h-10 object-contain" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">{greeting}</h2>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>

        {/* Scrollable content */}
        <div className="px-6 py-4 overflow-y-auto space-y-4">
          {/* Ranking change - down */}
          {rankChange && rankChange.direction === "down" && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <TrendingDown className="w-4 h-4 text-red-500" />
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">
                You dropped from <span className="font-semibold text-red-600">#{rankChange.from}</span> to{" "}
                <span className="font-semibold text-red-600">#{rankChange.to}</span> while away. Time to climb back!
              </p>
            </div>
          )}

          {/* Ranking change - up */}
          {rankChange && rankChange.direction === "up" && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">
                You climbed from <span className="font-semibold text-emerald-700">#{rankChange.from}</span> to{" "}
                <span className="font-semibold text-emerald-700">#{rankChange.to}</span>. Keep it up!
              </p>
            </div>
          )}

          {/* Current rank (no change) */}
          {!rankChange && currentRank && (
            <div className="rounded-xl bg-[#D4873A]/10 border border-[#D4873A]/20 p-4 text-center">
              <p className="text-sm text-gray-700">
                Currently ranked <span className="font-bold text-[#D4873A]">#{currentRank}</span>
              </p>
            </div>
          )}

          {/* Slider for facts/tips */}
          {slides.length > 0 && (
            <div 
              className="relative"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <div className={`rounded-xl ${slide.bgClass} border border-warm p-5 text-center min-h-[120px] flex flex-col justify-center transition-all duration-300`}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <slide.icon className={`w-4 h-4 ${slide.iconClass}`} />
                  <span className={`text-xs font-bold uppercase tracking-wide ${slide.labelClass}`}>
                    {slide.label}
                  </span>
                </div>
                <p className="text-sm text-gray-800 leading-relaxed">{slide.content}</p>
                {slide.reaction && (
                  <p className="text-sm text-[#D4873A] mt-2 font-semibold">{slide.reaction}</p>
                )}
              </div>

              {/* Dots indicator */}
              {slides.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-3">
                  {slides.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSlide(idx)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        idx === currentSlide ? "bg-[#D4873A] w-4" : "bg-gray-300 hover:bg-gray-400"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notification reminder */}
          {showNotificationReminder && (
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#D4873A]/10 flex items-center justify-center flex-shrink-0">
                <Bell className="w-4 h-4 text-[#D4873A]" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-700 leading-relaxed">
                  You have <span className="font-semibold text-[#D4873A]">{unreadCount}</span> unread{" "}
                  {unreadCount === 1 ? "notification" : "notifications"}.
                </p>
                <button
                  onClick={onEnableNotifications}
                  className="text-sm font-medium text-[#D4873A] hover:text-[#C4772A] transition-colors mt-1"
                >
                  Enable notifications →
                </button>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {hasStarted && !isComplete && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Today's Progress
                </span>
                <span className="text-xs font-semibold text-[#D4873A]">
                  {playedCount} / {totalCards}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#D4873A] to-[#E5A55A] rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer action */}
        <div className="px-6 pb-6 pt-2 flex-shrink-0">
          <button
            onClick={onPrimaryAction}
            className="w-full py-3.5 bg-[#D4873A] hover:bg-[#C4772A] text-white font-semibold rounded-xl text-sm transition-colors shadow-sm"
          >
            {callToAction}
          </button>
        </div>
      </div>
    </div>
  );
}
