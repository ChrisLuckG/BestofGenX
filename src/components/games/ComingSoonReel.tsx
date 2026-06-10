"use client";

import { Construction, Clock, Bell } from "lucide-react";

interface ComingSoonReelProps {
  title: string;
  emoji: string;
  description?: string;
}

export default function ComingSoonReel({ title, emoji, description }: ComingSoonReelProps) {
  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Fullscreen Background Image */}
      <img 
        src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800"
        alt="Coming Soon"
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#00003C] via-[#00003C]/80 to-[#00003C]/60" />

      {/* Content */}
      <div className="relative z-10 w-full h-full flex flex-col">
        {/* Top Badge */}
        <div className="flex-shrink-0 p-4 flex justify-between items-start">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/30 backdrop-blur-sm rounded-full border border-yellow-500/50">
            <Construction className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-bold text-yellow-400">COMING SOON</span>
          </div>
        </div>

        {/* Main Content - Centered */}
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {/* Big Emoji */}
          <div className="text-8xl mb-6 animate-bounce">
            {emoji}
          </div>
          
          {/* Title */}
          <h2 className="text-3xl font-black text-white text-center mb-3">
            {title}
          </h2>
          
          {/* Description */}
          {description && (
            <p className="text-white/70 text-center text-base mb-6 max-w-xs">
              {description}
            </p>
          )}
          
          {/* Coming Soon Badge */}
          <div className="px-6 py-3 bg-cream/10 backdrop-blur-sm  border border-white/20">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-yellow-400" />
              <span className="text-white font-bold">Coming soon!</span>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex-shrink-0 p-4 pt-0">
          <div className="bg-yellow-500/20 backdrop-blur-sm border border-yellow-500/50  p-4">
            <div className="flex items-center justify-center gap-3">
              <Bell className="w-6 h-6 text-yellow-400" />
              <div className="text-center">
                <p className="text-yellow-400 font-bold">Stay tuned!</p>
                <p className="text-white/60 text-xs">New features coming soon</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
