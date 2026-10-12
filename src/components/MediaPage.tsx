"use client";

import { Clapperboard, Headphones, Tv, ArrowRight } from "lucide-react";

interface MediaPageProps {
  onOpenRadio: () => void;
  onOpenTV: (videoId?: string) => void;
}

export default function MediaPage({ onOpenRadio, onOpenTV }: MediaPageProps) {
  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-cream">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-warm bg-cream">
        <div className="flex items-center gap-3">
          <Clapperboard className="w-5 h-5 text-[#E36B11]" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">MEDIA</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">Radio &amp; TV, no ads, no algorithm</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-4 py-4 gap-4">

        {/* RADIO Banner */}
        <button
          onClick={onOpenRadio}
          className="flex-1 relative overflow-hidden rounded-2xl shadow-md border border-warm transition-transform active:scale-[0.98] cursor-pointer"
          style={{ backgroundColor: '#15803D', minHeight: 140 }}
        >
          {/* Background video */}
          <video 
            src="/videos/community-sound-bg.mp4" 
            className="absolute inset-0 w-full h-full object-cover opacity-60" 
            muted 
            autoPlay 
            loop 
            playsInline 
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#15803D]/90 via-[#15803D]/70 to-transparent" />
          
          {/* Content */}
          <div className="relative h-full flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                <Headphones className="w-7 h-7 text-white" />
              </div>
              <div className="text-left">
                <span className="font-display text-2xl text-white tracking-wide block">COMMUNITY SOUND</span>
                <span className="text-white/80 text-xs">Your songs. Our playlist.</span>
              </div>
            </div>
            <ArrowRight className="w-6 h-6 text-white/80" />
          </div>
        </button>

        {/* TV Banner */}
        <button
          onClick={() => onOpenTV()}
          className="flex-1 relative overflow-hidden rounded-2xl shadow-md border border-warm transition-transform active:scale-[0.98] cursor-pointer"
          style={{ backgroundColor: '#E36B11', minHeight: 140 }}
        >
          {/* Background image */}
          <img 
            src="/images/categories/movies.png" 
            alt="" 
            className="absolute inset-0 w-full h-full object-cover opacity-40" 
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#E36B11]/90 via-[#E36B11]/70 to-transparent" />
          
          {/* Content */}
          <div className="relative h-full flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                <Tv className="w-7 h-7 text-white" />
              </div>
              <div className="text-left">
                <span className="font-display text-2xl text-white tracking-wide block">GENX TV</span>
                <span className="text-white/80 text-xs">Videos from our generation</span>
              </div>
            </div>
            <ArrowRight className="w-6 h-6 text-white/80" />
          </div>
        </button>

      </div>
    </div>
  );
}
