"use client";

import { Crown } from "lucide-react";

interface DesktopRankWidgetProps {
  rank: number | null;
  coins: number;
  isActive?: boolean;
  onClick?: () => void;
}

export default function DesktopRankWidget({ rank, coins, isActive = false, onClick }: DesktopRankWidgetProps) {
  const active = isActive;
  
  return (
    <button 
      onClick={onClick}
      className={`relative group cursor-pointer transition-transform ${active ? 'scale-[0.98]' : ''}`}
    >
      {/* Subtle glow */}
      <div className={`absolute inset-0 rounded-xl blur-sm transition-all ${active ? 'bg-[#D4873A]/40' : 'bg-[#D4873A]/10 group-hover:bg-[#D4873A]/30'}`} />
      
      {/* Main container */}
      <div className={`relative flex items-center gap-3 rounded-xl border-2 px-4 py-2 shadow-md transition-all duration-200 ${
        active 
          ? 'bg-gradient-to-b from-[#D4873A] to-[#C4772A] border-[#D4873A]' 
          : 'bg-gradient-to-b from-[#FFFDF9] to-[#FDF8F0] border-[#D4873A]/30 group-hover:from-[#D4873A] group-hover:to-[#C4772A] group-hover:border-[#D4873A]'
      }`}>
        {/* Left accent */}
        <div className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full transition-all ${
          active ? 'bg-gradient-to-b from-white to-white/80' : 'bg-gradient-to-b from-[#D4873A] to-[#E5A55A] group-hover:from-white group-hover:to-white/80'
        }`} />
        
        {/* Rank */}
        <div className="flex items-center gap-1.5 pl-2">
          <Crown className={`w-4 h-4 transition-colors ${active ? 'text-white' : 'text-[#D4873A] group-hover:text-white'}`} />
          <span className={`text-sm font-bold tabular-nums transition-colors ${active ? 'text-white' : 'text-gray-800 group-hover:text-white'}`}>#{rank ?? '-'}</span>
        </div>
        
        {/* Divider */}
        <div className={`w-px h-6 transition-colors ${active ? 'bg-white/30' : 'bg-[#D4873A]/20 group-hover:bg-white/30'}`} />
        
        {/* Coin + Amount */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className={`absolute inset-0 rounded-full blur-sm transition-colors ${active ? 'bg-white/30' : 'bg-[#D4873A]/20 group-hover:bg-white/30'}`} />
            <img src="/images/bogxcoin.png" alt="" className="relative w-7 h-7" />
          </div>
          <span className={`text-lg font-bold tabular-nums transition-colors ${active ? 'text-white' : 'text-[#D4873A] group-hover:text-white'}`}>
            {coins.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        
        {/* Right accent */}
        <div className={`absolute right-0 top-1.5 bottom-1.5 w-1 rounded-full transition-all ${
          active ? 'bg-gradient-to-b from-white to-white/80' : 'bg-gradient-to-b from-[#D4873A] to-[#E5A55A] group-hover:from-white group-hover:to-white/80'
        }`} />
      </div>
    </button>
  );
}
