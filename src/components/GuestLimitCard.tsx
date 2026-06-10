"use client";

import { Lock, Play, User, Trophy, Zap } from "lucide-react";

interface GuestLimitCardProps {
  guestName: string;
  gamesPlayed: number;
  onShowLogin?: () => void;
}

export default function GuestLimitCard({ guestName, gamesPlayed, onShowLogin }: GuestLimitCardProps) {
  return (
    <div className="w-full h-full relative overflow-hidden flex flex-col p-3 items-center" style={{ backgroundColor: '#000000' }}>
      <div className="flex-1 w-full flex flex-col rounded-3xl overflow-hidden border border-[#D4873A]" style={{ backgroundColor: '#000000', boxShadow: '0 0 30px rgba(242, 5, 80, 0.3)' }}>
        
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#D4873A]/20 via-transparent to-black/80" />
        
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center">
          
          {/* Lock Icon */}
          <div className="w-20 h-20 rounded-full bg-[#D4873A]/20 border-2 border-[#D4873A] flex items-center justify-center mb-6 animate-pulse">
            <Lock className="w-10 h-10 text-[#D4873A]" />
          </div>

          {/* Guest Info */}
          <div className="flex items-center gap-2 mb-4 px-4 py-2 bg-cream/5 rounded-full">
            <User className="w-4 h-4 text-white/60" />
            <span className="text-white/60 text-sm">Playing as</span>
            <span className="text-[#D4873A] font-bold">{guestName}</span>
          </div>

          {/* Main Message */}
          <h1 className="text-2xl font-black text-white mb-2">
            FREE TRIAL ENDED
          </h1>
          <p className="text-white/60 text-sm mb-6">
            You played {gamesPlayed} games as a guest
          </p>

          {/* Benefits */}
          <div className="w-full max-w-xs space-y-2 mb-6">
            <div className="flex items-center gap-3 px-4 py-2 bg-cream/5 ">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <span className="text-white/80 text-sm">Compete in global rankings</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 bg-cream/5 ">
              <Zap className="w-5 h-5 text-cyan-400" />
              <span className="text-white/80 text-sm">Unlock unlimited challenges</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 bg-cream/5 ">
              <Play className="w-5 h-5 text-green-400" />
              <span className="text-white/80 text-sm">Save your progress & coins</span>
            </div>
          </div>

          {/* Login Button */}
          <button
            onClick={onShowLogin}
            className="w-full max-w-xs py-4 bg-gradient-to-r from-[#D4873A] to-[#ff6b35]  font-bold text-lg text-white flex items-center justify-center gap-3 hover:scale-105 transition-transform shadow-lg shadow-[#D4873A]/30"
          >
            <User className="w-5 h-5" />
            LOGIN TO CONTINUE
          </button>

          <p className="text-white/40 text-xs mt-4">
            Create a free account in seconds
          </p>
        </div>
      </div>
    </div>
  );
}
