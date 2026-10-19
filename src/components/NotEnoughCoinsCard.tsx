"use client";

import { X, Lightbulb, BookOpen, Play, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/utils/currency";
import CountUpNumber from "./CountUpNumber";

// "Not enough coins" in the Login / Logout family: a purple battle-brand panel with
// the BOGX wordmark over the fight artwork, cream content next to it (below it on a
// phone). Purple because every caller is a battle context - accepting, creating or
// joining a QuizzBattle without enough BOGX.
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

      {/* Brand panel - the poster artwork already carries the "NOT ENOUGH COINS"
          headline, so the panel shows the WHOLE image (object-contain) over a
          blurred copy of itself that fills the letterbox, instead of text over
          a crop */}
      {/* aspect-ratio on a stretched flex item collapses to 0 width (verified),
          so the panel keeps a fixed width and object-contain shows the whole
          poster - the blurred copy behind fills the top/bottom letterbox */}
      <div className="relative overflow-hidden flex-shrink-0 w-full h-52 md:w-[280px] md:h-auto bg-gradient-to-br from-[#A855F7] via-[#9333EA] to-[#7E22CE]">
        <img
          src="/images/categories/coins.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 w-full h-full object-cover scale-125 blur-lg opacity-80"
        />
        {/* absolute on purpose: a non-absolute img would feed its intrinsic
            1448px height back into the panel and break the aspect-ratio sizing */}
        <img
          src="/images/categories/coins.png"
          alt="Not enough coins"
          className="pointer-events-none absolute inset-0 w-full h-full object-contain"
        />
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
            <div className="text-2xl md:text-3xl text-[#A855F7] leading-tight">
              <CountUpNumber value={missing} format={formatCurrency} delayMs={300} /> <span className="text-xs md:text-sm text-gray-500">BOGX</span>
            </div>
          </div>
        </div>

        {/* Ways to earn */}
        <div className="flex items-center gap-3 mt-4 mb-2.5">
          <div className="w-9 h-9 bg-[#A855F7]/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Lightbulb className="w-5 h-5 text-[#A855F7]" />
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
              className="group w-full p-2.5 md:p-3 bg-white rounded-xl border border-warm flex items-center gap-3 text-left transition-all hover:border-[#A855F7]/50 hover:shadow-sm"
            >
              <div className="w-10 h-10 bg-cream rounded-lg flex items-center justify-center border border-warm flex-shrink-0">{o.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 text-base leading-tight">{o.title}</p>
                <p className="text-xs text-gray-500 truncate">{o.sub}</p>
              </div>
              <div className="flex items-center gap-1 text-[#A855F7] text-base whitespace-nowrap">
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
            className="hover-shine relative overflow-hidden w-full py-3.5 rounded-xl bg-gradient-to-br from-[#A855F7] via-[#9333EA] to-[#7E22CE] text-white text-lg tracking-wider shadow-lg transition-all hover:brightness-110 active:scale-[0.99] flex items-center justify-center gap-2"
          >
            {coin('w-5 h-5')} EARN BOGX
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
