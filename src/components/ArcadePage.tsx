"use client";

import { Users, User, HelpCircle, Trophy, BarChart3, Coins, Zap, Play, Radio, Clock, Target, Eye, Lightbulb } from "lucide-react";

interface ArcadePageProps {
  onSelectGame: (game: 'quizzbattle' | 'trivia' | 'spacegenx' | 'memory' | 'prediction' | 'genxmen' | 'nextplay' | 'faceblur') => void;
  onShowRankings?: () => void;
}

export default function ArcadePage({ onSelectGame, onShowRankings }: ArcadePageProps) {
  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-cream">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-warm bg-cream">
        <div className="flex items-center gap-2">
          <img src="/images/Icon/trivia2.png" alt="" className="w-5 h-5 object-contain" />
          <span className="font-display text-lg tracking-wider text-gray-900">Arcade</span>
        </div>
      </div>

      {/* Games */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: 'none' }}>
        
        {/* QuizzBattle - Multiplayer Banner */}
        <button
          onClick={() => onSelectGame('quizzbattle')}
          className="w-full relative overflow-hidden rounded-2xl shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] bg-cover bg-center aspect-[2/1]"
          style={{ backgroundImage: "url('/images/Hintergund/battle.png')" }}
        >
          {/* Left fade for text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent" />

          {/* Badge - top right */}
          <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 bg-black/50 backdrop-blur-sm border border-white/20 text-white text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest z-10">
            <Users className="w-3 h-3" />
            Multiplayer
          </div>

          <div className="relative h-full flex flex-col justify-center items-start text-left px-4 py-3 max-w-[68%]">
            {/* Title */}
            <h3 className="font-display text-[30px] leading-none tracking-wide mt-2">
              <span className="text-white">QUIZZ</span><span className="text-[#A855F7]">BATTLE</span>
            </h3>

            {/* Subtitle */}
            <p className="text-white text-[12px] font-semibold leading-tight mt-1.5">
              Challenge real players.<br />
              <span className="text-[#A855F7]">Win their bet!</span>
            </p>

            {/* Features */}
            <div className="flex items-center gap-3 mt-2.5">
              <div className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-[#A855F7]" />
                <span className="text-white/90 text-[10px] font-medium leading-tight">Real<br/>Opponents</span>
              </div>
              <div className="w-px h-6 bg-white/25" />
              <div className="flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-[#A855F7]" />
                <span className="text-white/90 text-[10px] font-medium leading-tight">Big<br/>Rewards</span>
              </div>
              <div className="w-px h-6 bg-white/25" />
              <div className="flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5 text-[#A855F7]" />
                <span className="text-white/90 text-[10px] font-medium leading-tight">Climb<br/>Rankings</span>
              </div>
            </div>

            {/* Play Now */}
            <div className="flex items-center gap-1.5 mt-3 text-white/90 text-[11px] font-medium">
              PLAY NOW
              <Play className="w-3 h-3 text-[#A855F7] fill-[#A855F7]" />
            </div>
          </div>
        </button>

        {/* Solo Trivia - Single Player Banner */}
        <button
          onClick={() => onSelectGame('trivia')}
          className="w-full relative overflow-hidden rounded-2xl shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] bg-cover aspect-[2/1]"
          style={{ backgroundImage: "url('/images/Hintergund/solo.png')", backgroundPosition: "right center" }}
        >
          {/* Left fade for text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent" />

          {/* Badge - top right */}
          <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 bg-black/50 backdrop-blur-sm border border-white/20 text-white text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest z-10">
            <User className="w-3 h-3" />
            Single Player
          </div>

          <div className="relative h-full flex flex-col justify-center items-start text-left px-4 py-3 max-w-[70%]">
            {/* Title */}
            <h3 className="font-display text-[30px] leading-none tracking-wide mt-2">
              <span className="text-white">SOLO</span> <span className="text-[#D4873A]">TRIVIA</span>
            </h3>

            {/* Subtitle */}
            <p className="text-white text-[12px] font-semibold leading-tight mt-1.5">
              +0.30 per correct.<br />
              <span className="text-[#E5A55A]">-0.01 per wrong.</span>
            </p>

            {/* Features - 2 lines max like QuizzBattle */}
            <div className="flex items-center gap-3 mt-2.5">
              <div className="flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-[#E5A55A] flex-shrink-0" />
                <span className="text-white/90 text-[10px] font-medium leading-tight">10 or 20<br/>Questions</span>
              </div>
              <div className="w-px h-6 bg-white/25 flex-shrink-0" />
              <div className="flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-[#E5A55A] flex-shrink-0" />
                <span className="text-white/90 text-[10px] font-medium">+0.30<br/><span className="whitespace-nowrap">Per Correct</span></span>
              </div>
              <div className="w-px h-6 bg-white/25 flex-shrink-0" />
              <div className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-[#E5A55A] flex-shrink-0" />
                <span className="text-white/90 text-[10px] font-medium">Beat<br/><span className="whitespace-nowrap">the Clock</span></span>
              </div>
            </div>

            {/* Play Now - more centered */}
            <div className="flex items-center gap-1.5 mt-3 text-white/90 text-[11px] font-medium">
              PLAY NOW
              <Play className="w-3 h-3 text-[#E5A55A] fill-[#E5A55A]" />
            </div>
          </div>
        </button>

        {/* Next Play - Live Predictions Banner */}
        <button
          onClick={() => onSelectGame('nextplay')}
          className="w-full relative overflow-hidden rounded-2xl shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] bg-cover bg-center aspect-[2/1]"
          style={{ backgroundImage: "url('/images/Hintergund/nextplay.png')" }}
        >
          {/* Left fade for text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent" />

          {/* Badge - top right */}
          <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 bg-black/50 backdrop-blur-sm border border-white/20 text-white text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest z-10">
            <User className="w-3 h-3" />
            Single Player
          </div>

          <div className="relative h-full flex flex-col justify-center items-start text-left px-4 py-3 max-w-[68%]">
            {/* Title */}
            <h3 className="font-display text-[30px] leading-none tracking-wide mt-2">
              <span className="text-white">NEXT</span> <span className="text-[#22C55E]">PLAY</span>
            </h3>

            {/* Subtitle */}
            <p className="text-white text-[12px] font-semibold leading-tight mt-1.5">
              Call the next play.<br />
              <span className="text-[#22C55E]">Win points and cash rewards.</span>
            </p>

            {/* Features */}
            <div className="flex items-center gap-3 mt-2.5">
              <div className="flex items-center gap-1">
                <Radio className="w-3.5 h-3.5 text-[#22C55E]" />
                <span className="text-white/90 text-[10px] font-medium leading-tight">Live<br/>Events</span>
              </div>
              <div className="w-px h-6 bg-white/25" />
              <div className="flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-[#22C55E]" />
                <span className="text-white/90 text-[10px] font-medium leading-tight">Instant<br/>Rewards</span>
              </div>
              <div className="w-px h-6 bg-white/25" />
              <div className="flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-[#22C55E]" />
                <span className="text-white/90 text-[10px] font-medium leading-tight">Top<br/>Predictors</span>
              </div>
            </div>

            {/* Coming Soon */}
            <div className="flex items-center gap-1.5 mt-3 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full">
              <Clock className="w-3 h-3 text-white/80" />
              <span className="text-white/90 text-[10px] font-semibold uppercase tracking-wider">Coming Soon</span>
            </div>
          </div>
        </button>

        {/* Face Blur - Recognition Challenge Banner */}
        <button
          onClick={() => onSelectGame('faceblur')}
          className="w-full relative overflow-hidden rounded-2xl shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] bg-cover bg-center aspect-[2/1]"
          style={{ backgroundImage: "url('/images/Hintergund/facemash.png')" }}
        >
          {/* Left fade for text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />

          {/* Badge - top right */}
          <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 bg-black/50 backdrop-blur-sm border border-white/20 text-white text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest z-10">
            <User className="w-3 h-3" />
            Single Player
          </div>

          <div className="relative h-full flex flex-col justify-center items-start text-left px-4 py-3 max-w-[68%]">
            {/* Title */}
            <h3 className="font-display text-[30px] leading-none tracking-wide mt-2">
              <span className="text-white">FACE</span><span className="text-[#DC2626]">BLUR</span>
            </h3>

            {/* Subtitle */}
            <p className="text-white text-[12px] font-semibold leading-tight mt-1.5">
              Recognize the face.<br />
              <span className="text-[#DC2626]">Before it becomes clear.</span>
            </p>

            {/* Features */}
            <div className="flex items-center gap-3 mt-2.5">
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#DC2626]" />
                <span className="text-white/90 text-[10px] font-medium leading-tight">20<br/>Seconds</span>
              </div>
              <div className="w-px h-6 bg-white/25" />
              <div className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-[#DC2626]" />
                <span className="text-white/90 text-[10px] font-medium leading-tight">Famous<br/>Faces</span>
              </div>
              <div className="w-px h-6 bg-white/25" />
              <div className="flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-[#DC2626]" />
                <span className="text-white/90 text-[10px] font-medium leading-tight">Beat the<br/>Clock</span>
              </div>
            </div>

            {/* Coming Soon */}
            <div className="flex items-center gap-1.5 mt-3 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full">
              <Clock className="w-3 h-3 text-white/80" />
              <span className="text-white/90 text-[10px] font-semibold uppercase tracking-wider">Coming Soon</span>
            </div>
          </div>
        </button>

        {/* Predictions Banner */}
        <button
          onClick={() => onSelectGame('prediction')}
          className="w-full relative overflow-hidden rounded-2xl shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] bg-cover bg-center aspect-[2/1]"
          style={{ backgroundImage: "url('/images/Hintergund/predict.png')" }}
        >
          {/* Left fade for text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent" />

          {/* Badge - top right */}
          <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 bg-black/50 backdrop-blur-sm border border-white/20 text-white text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest z-10">
            <User className="w-3 h-3" />
            Single Player
          </div>

          <div className="relative h-full flex flex-col justify-center items-start text-left px-4 py-3 max-w-[68%]">
            {/* Title */}
            <h3 className="font-display text-[30px] leading-none tracking-wide mt-2">
              <span className="text-white">PREDICT</span><span className="text-[#84CC16]">IONS</span>
            </h3>

            {/* Subtitle */}
            <p className="text-white text-[12px] font-semibold leading-tight mt-1.5">
              Predict the outcome.<br />
              <span className="text-[#84CC16]">Prove you know.</span>
            </p>

            {/* Features */}
            <div className="flex items-center gap-3 mt-2.5">
              <div className="flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5 text-[#84CC16]" />
                <span className="text-white/90 text-[10px] font-medium leading-tight">Make<br/>Predictions</span>
              </div>
              <div className="w-px h-6 bg-white/25" />
              <div className="flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-[#84CC16]" />
                <span className="text-white/90 text-[10px] font-medium leading-tight">Earn<br/>Points</span>
              </div>
              <div className="w-px h-6 bg-white/25" />
              <div className="flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5 text-[#84CC16]" />
                <span className="text-white/90 text-[10px] font-medium leading-tight">Top<br/>Predictors</span>
              </div>
            </div>

            {/* Coming Soon */}
            <div className="flex items-center gap-1.5 mt-3 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full">
              <Clock className="w-3 h-3 text-white/80" />
              <span className="text-white/90 text-[10px] font-semibold uppercase tracking-wider">Coming Soon</span>
            </div>
          </div>
        </button>

      </div>
    </div>
  );
}
