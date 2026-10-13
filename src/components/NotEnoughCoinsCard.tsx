"use client";

import { X, Lightbulb, BookOpen, Play, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/utils/currency";
import CountUpNumber from "./CountUpNumber";

// "Not enough coins" in the Login / Logout family: an orange brand panel with the BOGX
// wordmark and the big faint coin, cream content next to it (below it on a phone).
// One card for AlertModal (type "coins") and NoFundsModal, which used to carry two
// hand-built copies of the same content.
export default function NotEnoughCoinsCard({
  balance, required, message, title, onClose, onEarn, onReadArticles, onWatchVideos, onPlayTrivia,
}: {
  balance: number;
  required: number;
  message: string;
  title?: string;
  onClose: () => void;
  /** Main button */
  onEarn: () => void;
  onReadArticles?: () => void;
  onWatchVideos?: () => void;
  onPlayTrivia?: () => void;
}) {
  const missing = Math.max(0, required - balance);
  const coin = (cls: string) => <img src="/images/bogxcoin.png" alt="" className={cls} />;

  const options = [
    { key: 'read', icon: <BookOpen className="w-5 h-5 text-gray-700" />, title: 'Read articles', sub: 'Earn per article', reward: '+0,05', onClick: onReadArticles },
    { key: 'watch', icon: <Play className="w-5 h-5 text-gray-700" />, title: 'Watch videos', sub: 'Watch 1 video', reward: '+0,10', onClick: onWatchVideos },
    { key: 'trivia', icon: <img src="/images/Icon/trivia2.png" alt="" className="w-5 h-5" />, title: 'Win a trivia', sub: 'Earn up to 0.15 per question', reward: '+0,05-0,15', onClick: onPlayTrivia },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={e => e.stopPropagation()}
      className="relative mx-4 w-full max-w-sm md:max-w-3xl max-h-[92vh] overflow-y-auto bg-cream rounded-3xl shadow-2xl border border-warm flex flex-col md:flex-row animate-[cardIn_0.3s_ease-out]"
      style={{ scrollbarWidth: 'none' }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-white/20 hover:bg-white/30 text-white md:bg-white/80 md:hover:bg-white md:text-gray-500 md:shadow-sm"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Brand panel */}
      <div className="relative overflow-hidden flex-shrink-0 md:w-[280px] bg-gradient-to-br from-[#E36B11] via-[#D4621A] to-[#B85515] px-6 pt-5 pb-6 md:p-8 flex flex-col">
        <img
          src="/images/bogxcoin.png"
          alt=""
          className="pointer-events-none absolute -right-10 -bottom-10 md:-right-16 md:-bottom-6 w-44 h-44 md:w-64 md:h-64 opacity-[0.14]"
        />
        <span className="relative z-10 font-display text-2xl text-white tracking-wide mb-4 md:mb-8">BOGX</span>
        <div className="relative z-10 flex-1">
          <p className="text-white/70 text-xs uppercase tracking-wider mb-1">Hold on</p>
          <h2 className="font-display text-3xl md:text-4xl leading-tight text-white">{title || 'NOT ENOUGH COINS'}</h2>
          <p className="text-white/85 text-sm mt-2 md:mt-4 leading-relaxed">{message}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 p-5 md:p-7 flex flex-col font-display">
        {/* Balance / missing */}
        <div className="flex bg-white rounded-xl border border-warm divide-x divide-warm shadow-sm">
          <div className="flex-1 py-3 md:py-4 text-center">
            <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider">Your balance</div>
            <div className="text-2xl md:text-3xl text-gray-900 leading-tight">
              <CountUpNumber value={balance} format={formatCurrency} delayMs={150} /> <span className="text-xs md:text-sm text-gray-500">BOGX</span>
            </div>
          </div>
          <div className="flex-1 py-3 md:py-4 text-center">
            <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider">Missing</div>
            <div className="text-2xl md:text-3xl text-[#E36B11] leading-tight">
              <CountUpNumber value={missing} format={formatCurrency} delayMs={300} /> <span className="text-xs md:text-sm text-gray-500">BOGX</span>
            </div>
          </div>
        </div>

        {/* Ways to earn */}
        <div className="flex items-center gap-3 mt-4 mb-2.5">
          <div className="w-9 h-9 bg-[#E36B11]/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Lightbulb className="w-5 h-5 text-[#E36B11]" />
          </div>
          <div>
            <p className="text-gray-900 text-base leading-tight">Earn coins and join the action!</p>
            <p className="text-xs text-gray-500">Here are some quick ways to get BOGX.</p>
          </div>
        </div>

        <div className="space-y-2">
          {options.map((o, i) => (
            <button
              key={o.key}
              onClick={o.onClick}
              style={{ animation: `cardIn 0.35s ease-out ${200 + i * 90}ms backwards` }}
              className="group w-full p-2.5 md:p-3 bg-white rounded-xl border border-warm flex items-center gap-3 text-left transition-all hover:border-[#E36B11]/50 hover:shadow-sm"
            >
              <div className="w-10 h-10 bg-cream rounded-lg flex items-center justify-center border border-warm flex-shrink-0">{o.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 text-base leading-tight">{o.title}</p>
                <p className="text-xs text-gray-500 truncate">{o.sub}</p>
              </div>
              <div className="flex items-center gap-1 text-[#E36B11] text-base whitespace-nowrap">
                {o.reward} {coin('w-4 h-4')}
                <ChevronRight className="w-4 h-4 text-gray-400 transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-5 space-y-1.5">
          <button
            onClick={onEarn}
            className="hover-shine relative overflow-hidden w-full py-3.5 rounded-xl bg-gradient-to-br from-[#E36B11] via-[#D4621A] to-[#B85515] text-white text-lg tracking-wider shadow-lg transition-all hover:brightness-110 active:scale-[0.99]"
          >
            EARN BOGX
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-black/5 text-base tracking-wider transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
