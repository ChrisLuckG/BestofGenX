"use client";

import { ArrowRight } from "lucide-react";
import { Battle, RoundResult, getTopicConfig } from "./types";

interface BattleCountdownScreenProps {
  battle: Battle;
  currentRound: number;
  countdown: number;
  myResults: RoundResult[];
  isCreator: boolean;
  userAvatar?: string;
}

export default function BattleCountdownScreen({
  battle,
  currentRound,
  countdown,
  myResults,
  isCreator,
  userAvatar,
}: BattleCountdownScreenProps) {
  const question = battle.questions[currentRound];
  const topic = getTopicConfig(battle.topic);
  const isGo = countdown === 0;
  
  // Count correct answers so far
  const myCorrectCount = myResults.filter(r => r.correct).length;

  return (
    <div className="flex flex-col h-full bg-cream">
      {/* Main Card - same structure as BattleQuizScreen */}
      <div className="flex-1 m-2 sm:m-4 border border-warm bg-cream rounded-2xl flex flex-col p-4 sm:p-6 shadow-lg min-h-0">
        
        {/* Players Bar - Same as BattleQuizScreen */}
        <div className="flex items-stretch border border-warm rounded-xl bg-cream overflow-hidden mb-4 sm:mb-5">
          {/* You */}
          <div className="flex-1 min-w-0 flex flex-col items-center gap-1 p-2 sm:p-4 border-r border-warm">
            <div className="w-8 h-8 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 sm:border-3 flex-shrink-0 border-warm">
              <img src={userAvatar || 'https://i.pravatar.cc/80?img=47'} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="font-display text-sm sm:text-xl text-gray-900 truncate tracking-wide">You</div>
            <div className="font-display text-xl sm:text-4xl tracking-wide text-gray-800">{myCorrectCount}</div>
          </div>

          {/* VS Center */}
          <div className="flex flex-col items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-4 py-2 sm:py-4">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] uppercase tracking-wider font-bold whitespace-nowrap" style={{ backgroundColor: `${topic.color}15`, color: topic.color }}>
              <topic.icon className="w-3 h-3" /> {topic.label}
            </span>
            <span className="font-display text-xs sm:text-lg text-gray-400 tracking-wider">VS</span>
            {/* Round dots */}
            <div className="flex gap-1 sm:gap-2">
              {Array.from({ length: battle.rounds }).map((_, i) => {
                const result = myResults[i];
                const color = result ? (result.correct ? '#10b981' : '#ef4444') : (i === currentRound ? '#9ca3af' : '#e5e7eb');
                const opacity = i === currentRound && !result ? '0.5' : '1';
                return (
                  <span 
                    key={i} 
                    className="min-w-[24px] h-6 sm:min-w-[36px] sm:h-8 px-1.5 sm:px-2 rounded-md flex items-center justify-center font-display text-[10px] sm:text-xs tracking-wider text-white"
                    style={{ background: color, opacity }}
                  >
                    R{i + 1}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Opponent */}
          <div className="flex-1 min-w-0 flex flex-col items-center gap-1 p-2 sm:p-4 border-l border-warm">
            <div className="w-8 h-8 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 sm:border-3 border-warm flex-shrink-0">
              {isCreator ? (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xs sm:text-xl">?</div>
              ) : (
                <img src={battle.creator.avatar} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="font-display text-sm sm:text-xl text-gray-900 truncate text-center tracking-wide max-w-[60px] sm:max-w-none">
              {isCreator ? '???' : battle.creator.username}
            </div>
            <div className="font-display text-xl sm:text-4xl text-gray-400 tracking-wide">?</div>
          </div>
        </div>

        {/* Timer Row - GET READY / GO style - Same as Solo Trivia */}
        <div className="flex items-center gap-2.5 sm:gap-4 mb-4 sm:mb-5">
          <div 
            key={countdown}
            className={`w-12 h-12 sm:w-16 sm:h-16 rounded-lg sm:rounded-xl flex flex-col items-center justify-center flex-shrink-0 transition-all duration-200 ${
              isGo ? 'scale-110' : 'animate-pulse'
            }`}
            style={{ 
              background: isGo 
                ? 'linear-gradient(135deg, #10b981dd 0%, #10b981 100%)' 
                : 'linear-gradient(135deg, #6B7280dd 0%, #6B7280 100%)',
              boxShadow: isGo 
                ? '0 0 25px rgba(16,185,129,0.6), inset 0 0 0 2px rgba(16,185,129,0.4)' 
                : '0 0 20px rgba(107,114,128,0.4), inset 0 0 0 2px rgba(107,114,128,0.4)',
              animation: 'popIn 0.4s ease-out'
            }}
          >
            <span 
              className="font-display text-lg sm:text-2xl text-white tabular-nums"
              style={{ 
                animation: 'popNumber 0.4s ease-out',
                textShadow: '0 0 10px rgba(255,255,255,0.5)'
              }}
            >
              {isGo ? 'GO' : countdown}
            </span>
            <span className="font-display text-[7px] sm:text-[9px] text-white/80 tracking-widest">
              {isGo ? '' : 'GET READY'}
            </span>
          </div>
          <div className="flex-1 flex gap-1 sm:gap-1.5">
            {[...Array(8)].map((_, i) => {
              const ledsOn = isGo ? 8 : Math.round((countdown / 3) * 8);
              const isActive = isGo ? true : i < ledsOn;
              return (
                <span 
                  key={i} 
                  className="h-2.5 sm:h-4 flex-1 rounded transition-all duration-300"
                  style={{ 
                    backgroundColor: isActive ? (isGo ? '#10b981' : '#6B7280') : '#E5E0D8',
                    boxShadow: isActive ? `0 0 8px ${isGo ? '#10b981' : '#6B7280'}` : 'none'
                  }}
                />
              );
            })}
          </div>
          {/* Right side: Countdown number OR GO */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {isGo ? (
              <span 
                className="font-display text-xl sm:text-3xl text-green-500 animate-pulse"
                style={{ 
                  textShadow: '0 0 15px rgba(16,185,129,0.6)',
                  animation: 'popNumber 0.4s ease-out'
                }}
              >
                GO!
              </span>
            ) : (
              <>
                <span 
                  key={countdown}
                  className="font-display text-xl sm:text-3xl text-gray-500 tabular-nums"
                  style={{ 
                    animation: 'popNumber 0.4s ease-out',
                    textShadow: '0 0 8px rgba(107,114,128,0.4)'
                  }}
                >
                  {countdown}
                </span>
                <span className="font-display text-xs sm:text-sm text-gray-400">sec</span>
              </>
            )}
          </div>
        </div>
        
        {/* Countdown animations */}
        <style jsx>{`
          @keyframes popIn {
            0% { transform: scale(0.8); opacity: 0.5; }
            50% { transform: scale(1.15); }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes popNumber {
            0% { transform: scale(1.5); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>

        {/* Question Card */}
        <div className="border border-warm bg-cream rounded-xl p-4 sm:p-6 mb-4 sm:mb-5 flex items-center justify-center min-h-[80px] sm:min-h-[120px]">
          <h2 className="font-display text-lg sm:text-2xl text-gray-900 text-center leading-snug tracking-wide">
            {question?.question}
          </h2>
        </div>

        {/* Hidden Answers - 2x2 grid with "..." */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 flex-1">
          {[0, 1, 2, 3].map((i) => (
            <div 
              key={i} 
              className="rounded-xl p-3 sm:p-4 min-h-[60px] sm:min-h-[72px] bg-cream border-2 border-warm flex items-center justify-center"
            >
              <span className="text-gray-300 text-base sm:text-lg">···</span>
            </div>
          ))}
        </div>

        {/* Feedback + Next Button Row - Always visible (grayed out during countdown) */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 min-h-[48px] sm:min-h-[56px] mt-3 sm:mt-4">
          <div className="px-3 sm:px-5 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-base flex items-center gap-2 bg-gray-200 text-gray-400">
            Pick an answer
          </div>
          <div className="px-4 sm:px-8 py-2 sm:py-3 font-display text-sm sm:text-base tracking-widest rounded-xl flex items-center gap-2 bg-gray-200 text-gray-400">
            Next
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
