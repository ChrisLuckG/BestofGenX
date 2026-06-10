"use client";

import { useRef } from "react";
import { Trophy, ArrowRight, ChevronLeft, Lock } from "lucide-react";

interface JoinChallengePageProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinAsGuest?: () => void;
  onShowLogin?: () => void;
  onShowSignUp?: () => void;
  onOpenShop?: () => void;
}

// Daily prizes - replace image paths with real shop product photos
const dailyPrizes = [
  { place: "1ST", label: "DAILY", value: "50€", img: "/images/genxlogo1.png", color: "#D4873A", textColor: "text-[#D4873A]", border: "border-[#D4873A]/40", glow: "shadow-[#D4873A]/20" },
  { place: "2ND", label: "DAILY", value: "25€", img: "/images/genxlogo1.png", color: "#aaa", textColor: "text-gray-300", border: "border-white/20", glow: "shadow-white/10" },
  { place: "3RD", label: "DAILY", value: "10€", img: "/images/genxlogo1.png", color: "#cd7f32", textColor: "text-[#cd7f32]", border: "border-[#cd7f32]/30", glow: "shadow-[#cd7f32]/10" },
];

export default function JoinChallengePage({ isOpen, onClose, onJoinAsGuest, onShowLogin, onShowSignUp, onOpenShop }: JoinChallengePageProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div 
      className={`fixed z-40 transition-all duration-300 ease-out ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
      style={{ backgroundColor: '#000', top: 48, bottom: 90, left: 0, right: 0, display: 'flex', flexDirection: 'column' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-4 pb-3 border-b border-white/10 flex-shrink-0">
        <button onClick={onClose} className="flex items-center gap-2 text-white hover:text-[#D4873A] transition-colors">
          <ChevronLeft className="w-6 h-6" />
          <span className="text-base font-bold">Back</span>
        </button>
        <div className="w-16" />
      </div>

      {/* Scrollable Content */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Hero */}
        <div className="relative px-4 pt-2 pb-6 text-center">
          <p className="text-[#D4873A] text-[10px] font-bold tracking-[0.3em] mb-2">BEST OF GENX</p>
          <h1 className="text-3xl font-black text-white leading-tight mb-2">
            WIN<br />REAL PRIZES
          </h1>
          <p className="text-white/50 text-xs">Answer daily quizzes. Climb the rankings. Win.</p>
        </div>

        {/* Daily Prize Podium */}
        <div className="px-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/30 text-[9px] tracking-[0.25em]">TODAY'S PRIZES</p>
            {onOpenShop && (
              <button
                onClick={() => { onClose(); onOpenShop(); }}
                className="text-[#D4873A] text-[10px] font-bold tracking-wider hover:text-[#e8ff1a] transition-colors"
              >
                FROM OUR SHOP →
              </button>
            )}
          </div>
          <div className="flex gap-2 items-end">
            {/* 2nd Place */}
            <div className={`flex-1 border ${dailyPrizes[1].border} bg-cream/5 overflow-hidden`}>
              <div className="aspect-square bg-cream/5 flex items-center justify-center relative">
                {/* Replace with: <img src="/images/shop/product-2nd.jpg" className="w-full h-full object-cover" /> */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
                <img src={dailyPrizes[1].img} className="w-10 h-10 opacity-20" />
                <div className="absolute bottom-2 left-0 right-0 text-center">
                  <p className={`text-lg font-black ${dailyPrizes[1].textColor}`}>{dailyPrizes[1].value}</p>
                </div>
              </div>
              <div className="px-2 py-2 text-center">
                <p className="text-white/40 text-[8px] tracking-widest">{dailyPrizes[1].place}</p>
              </div>
            </div>

            {/* 1st Place - bigger */}
            <div className={`flex-[1.3] border-2 ${dailyPrizes[0].border} bg-cream/5 overflow-hidden shadow-lg ${dailyPrizes[0].glow}`} style={{ boxShadow: `0 0 30px ${dailyPrizes[0].color}30` }}>
              <div className="relative">
                <div className="aspect-square bg-cream/5 flex items-center justify-center relative">
                  {/* Replace with: <img src="/images/shop/product-1st.jpg" className="w-full h-full object-cover" /> */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
                  <img src={dailyPrizes[0].img} className="w-12 h-12 opacity-20" />
                  <div className="absolute top-2 right-2">
                    <div className="bg-[#D4873A] w-6 h-6 flex items-center justify-center">
                      <Trophy className="w-3 h-3 text-white" />
                    </div>
                  </div>
                  <div className="absolute bottom-2 left-0 right-0 text-center">
                    <p className={`text-2xl font-black ${dailyPrizes[0].textColor}`}>{dailyPrizes[0].value}</p>
                  </div>
                </div>
                <div className="px-2 py-2 text-center">
                  <p className={`text-[9px] font-bold tracking-widest ${dailyPrizes[0].textColor}`}>{dailyPrizes[0].place} PLACE</p>
                </div>
              </div>
            </div>

            {/* 3rd Place */}
            <div className={`flex-1 border ${dailyPrizes[2].border} bg-cream/5 overflow-hidden`}>
              <div className="aspect-square bg-cream/5 flex items-center justify-center relative">
                {/* Replace with: <img src="/images/shop/product-3rd.jpg" className="w-full h-full object-cover" /> */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
                <img src={dailyPrizes[2].img} className="w-10 h-10 opacity-20" />
                <div className="absolute bottom-2 left-0 right-0 text-center">
                  <p className={`text-lg font-black ${dailyPrizes[2].textColor}`}>{dailyPrizes[2].value}</p>
                </div>
              </div>
              <div className="px-2 py-2 text-center">
                <p className="text-white/40 text-[8px] tracking-widest">{dailyPrizes[2].place}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly + Annual */}
        <div className="px-4 mb-6 space-y-3">
          {/* Monthly */}
          <div className="border border-white/10 bg-cream/5 p-4 flex items-center gap-4">
            <div className="w-16 h-16 bg-cream/5 border border-white/10 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
              {/* Replace with: <img src="/images/shop/monthly-prize.jpg" className="w-full h-full object-cover" /> */}
              <img src="/images/genxlogo1.png" className="w-8 h-8 opacity-20" />
            </div>
            <div className="flex-1">
              <p className="text-white/40 text-[9px] tracking-widest">MONTHLY WINNER</p>
              <p className="text-white font-black text-xl">500€</p>
              <p className="text-white/40 text-[10px]">+ 250€ 2nd · 100€ 3rd</p>
            </div>
            <Lock className="w-4 h-4 text-white/20" />
          </div>

          {/* Annual */}
          <div className="border border-[#D4873A]/20 p-4 flex items-center gap-4" style={{ background: 'linear-gradient(135deg, rgba(212,240,0,0.08) 0%, rgba(0,0,0,0.5) 100%)' }}>
            <div className="w-16 h-16 border border-[#D4873A]/30 flex items-center justify-center flex-shrink-0 relative overflow-hidden" style={{ background: 'rgba(212,240,0,0.1)' }}>
              {/* Replace with: <img src="/images/shop/annual-prize.jpg" className="w-full h-full object-cover" /> */}
              <img src="/images/genxlogo1.png" className="w-8 h-8 opacity-30" />
            </div>
            <div className="flex-1">
              <p className="text-[#D4873A] text-[9px] tracking-widest font-bold">ANNUAL WINNER</p>
              <p className="text-white font-black text-xl">5.000€</p>
              <p className="text-white/40 text-[10px]">+ 2.500€ 2nd · 1.000€ 3rd</p>
            </div>
            <Lock className="w-4 h-4 text-[#D4873A]/40" />
          </div>
        </div>

        {/* Stats bar */}
        <div className="px-4 mb-6">
          <div className="flex overflow-hidden border border-[#D4873A]/20">
            <div className="flex-1 py-3 text-center bg-cream/5">
              <p className="text-white font-black text-base">2,847</p>
              <p className="text-white/30 text-[8px] tracking-wider">PLAYERS</p>
            </div>
            <div className="w-px bg-cream/10" />
            <div className="flex-1 py-3 text-center bg-cream/5">
              <p className="text-white font-black text-base">Daily</p>
              <p className="text-white/30 text-[8px] tracking-wider">RESETS</p>
            </div>
            <div className="w-px bg-cream/10" />
            <div className="flex-1 py-3 text-center bg-cream/5">
              <p className="text-white font-black text-base">Free</p>
              <p className="text-white/30 text-[8px] tracking-wider">TO PLAY</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="px-4 pb-8 space-y-3">
          <button
            onClick={() => onShowSignUp?.()}
            className="w-full py-4 font-black text-white text-base transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ background: '#D4873A', boxShadow: '0 8px 30px rgba(212,240,0,0.35)' }}
          >
            <span>SIGN UP</span>
            <ArrowRight className="w-5 h-5" />
          </button>

          <button
            onClick={() => onShowLogin?.()}
            className="w-full py-4 font-bold text-white text-base transition-all active:scale-95 border border-[#D4873A]/30 bg-[#D4873A]/10 hover:bg-[#D4873A]/20"
          >
            SIGN IN
          </button>
        </div>
      </div>
    </div>
  );
}
