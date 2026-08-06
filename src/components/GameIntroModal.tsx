"use client";

import { X, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface GameIntroRule {
  /** Optional icon shown next to the rule (defaults to a check) */
  icon?: LucideIcon;
  /** Optional image URL for rich rule display */
  image?: string;
  /** Rule title (for rich mode) */
  title?: string;
  text: string;
}

interface GameIntroModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Game title, e.g. "QUIZZBATTLE" */
  title: string;
  /** One-line tagline under the title */
  subtitle?: string;
  /** Bullet-point rules explaining how to play */
  rules: GameIntroRule[];
  /** Primary action label (defaults to "Let's go") */
  actionLabel?: string;
  onAction: () => void;
  /** Optional icon for the header badge */
  icon?: LucideIcon;
  /** If true, render inline without overlay (for desktop content area) */
  embedded?: boolean;
  /** Optional back callback - if provided, shows a back button */
  onBack?: () => void;
  /** Optional header image (e.g. baseball bats) */
  headerImage?: string;
  /** Optional full background image for the modal (dark theme) */
  backgroundImage?: string;
  /** Optional secondary action label (e.g. "Maybe later") */
  secondaryLabel?: string;
  /** Optional info badges at bottom */
  infoBadges?: { icon: LucideIcon; label: string; sublabel: string }[];
}

// Generic, reusable game-intro modal. Same GenX look for every game:
// header badge, title + tagline, a short list of rules, and a CTA.
export default function GameIntroModal({
  isOpen,
  onClose,
  title,
  subtitle,
  rules,
  actionLabel = "Let's go",
  onAction,
  icon: Icon,
  embedded = false,
  onBack,
  headerImage,
  backgroundImage,
  secondaryLabel,
  infoBadges,
}: GameIntroModalProps) {
  // Check if rules have images (rich mode)
  const hasRichRules = rules.some(r => r.image);
  if (!isOpen) return null;

  // Embedded mode: render inline without overlay
  if (embedded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#F5F0E8] p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-warm overflow-hidden">
          {/* Header - Icon and Close in same row */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-br from-[#E36B11]/10 via-[#E36B11]/5 to-transparent">
            <div className="w-12 h-12 rounded-xl bg-white border border-warm shadow-sm flex items-center justify-center">
              {Icon ? (
                <Icon className="w-6 h-6 text-[#E36B11]" />
              ) : (
                <img src="/images/genxlogo1.png" alt="Best of GenX" className="h-7 object-contain" />
              )}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/80 hover:bg-white border border-warm flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors shadow-sm"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="px-5 pb-5">
            <h2 className="font-display text-[24px] tracking-wide text-gray-900 leading-tight text-center mb-1">
              {title}
            </h2>
            {subtitle && (
              <p className="text-gray-500 text-[13px] leading-relaxed text-center mb-4">{subtitle}</p>
            )}

            {/* Rules */}
            <div className="space-y-2 mb-5">
              {rules.map((rule, i) => {
                const RuleIcon = rule.icon ?? Check;
                return (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-[#E36B11]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <RuleIcon className="w-3 h-3 text-[#E36B11]" />
                    </div>
                    <p className="text-[13px] text-gray-700 leading-relaxed">{rule.text}</p>
                  </div>
                );
              })}
            </div>

            {/* Action */}
            <button
              onClick={onAction}
              className="w-full py-3 bg-[#E36B11] hover:bg-[#C4772A] text-white font-bold rounded-xl text-[14px] transition-colors shadow-sm"
            >
              {actionLabel}
            </button>

            {/* Back button - optional */}
            {onBack && (
              <button
                onClick={onBack}
                className="w-full mt-2 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-[14px] transition-colors"
              >
                Back to Trivia
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-cream rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/90 hover:bg-white border border-warm flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors shadow-sm"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with background image */}
        {backgroundImage ? (
          <div 
            className="relative bg-cover bg-center min-h-[140px]"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-cream/80" />
            <div className="relative pl-[42%] pr-12 pt-6 pb-4 min-h-[140px] flex flex-col justify-center">
              <h2 className="font-display text-[24px] tracking-wide text-gray-900 leading-none">
                {title}
              </h2>
              {subtitle && (
                <p className="text-gray-600 text-[12px] leading-snug mt-2" dangerouslySetInnerHTML={{ __html: subtitle }} />
              )}
            </div>
          </div>
        ) : headerImage ? (
          <div className="relative pt-3 pb-2 min-h-[120px]">
            <img src={headerImage} alt="" className="absolute left-0 top-1 h-32 w-auto object-contain" />
            <div className="relative z-[1] pl-[42%] pr-12 pt-3">
              <h2 className="font-display text-[26px] tracking-wide text-gray-900 leading-none">
                {title}
              </h2>
              {subtitle && (
                <p className="text-gray-600 text-[12px] leading-snug mt-1.5" dangerouslySetInnerHTML={{ __html: subtitle }} />
              )}
            </div>
          </div>
        ) : (
          <div className="px-6 pt-4 pb-2">
            <div className="flex justify-center mb-3">
              <div className="w-14 h-14 rounded-xl bg-[#E36B11]/10 border border-[#E36B11]/20 flex items-center justify-center">
                {Icon ? (
                  <Icon className="w-7 h-7 text-[#E36B11]" />
                ) : (
                  <img src="/images/genxlogo1.png" alt="" className="h-8 object-contain" />
                )}
              </div>
            </div>
            <h2 className="font-display text-[28px] tracking-wide text-gray-900 leading-tight text-center">
              {title}
            </h2>
            {subtitle && (
              <p className="text-gray-500 text-[14px] leading-relaxed text-center mt-1" dangerouslySetInnerHTML={{ __html: subtitle }} />
            )}
          </div>
        )}

        {/* Rules */}
        <div className="px-4 py-3">
          {hasRichRules ? (
            <div className="space-y-2">
              {rules.map((rule, i) => (
                <div key={i} className="flex items-center gap-3 bg-[#E36B11]/5 rounded-xl p-3">
                  {rule.image && (
                    <div className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200">
                      <img src={rule.image} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[#E36B11] font-bold text-sm">{i + 1}.</span>
                      {rule.title && <span className="font-bold text-gray-900 text-sm">{rule.title}</span>}
                    </div>
                    <p className="text-gray-500 text-xs leading-snug mt-0.5">{rule.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule, i) => {
                const RuleIcon = rule.icon ?? Check;
                return (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-[#E36B11]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <RuleIcon className="w-3 h-3 text-[#E36B11]" />
                    </div>
                    <p className="text-[13px] text-gray-700 leading-relaxed">{rule.text}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info Badges - single box with dividers */}
        {infoBadges && infoBadges.length > 0 && (
          <div className="px-4 pb-3">
            <div className="flex items-stretch bg-[#E36B11]/5 rounded-xl divide-x divide-[#E36B11]/10">
              {infoBadges.map((badge, i) => (
                <div key={i} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5">
                  <badge.icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-gray-700 leading-tight">{badge.label}</div>
                    <div className="text-[10px] text-gray-400 leading-tight">{badge.sublabel}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="px-4 pb-4 space-y-2">
          <button
            onClick={onAction}
            className="w-full py-3.5 bg-[#E36B11] hover:bg-[#C4772A] text-white font-bold rounded-xl text-[15px] transition-colors shadow-md flex items-center justify-center gap-2"
          >
            {Icon && <Icon className="w-5 h-5" />}
            {actionLabel}
          </button>
          
          {(secondaryLabel || onBack) && (
            <button
              onClick={onBack || onClose}
              className="w-full py-2.5 bg-transparent hover:bg-black/5 text-gray-500 font-medium rounded-xl text-[13px] transition-colors"
            >
              {secondaryLabel || "Back to Trivia"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
