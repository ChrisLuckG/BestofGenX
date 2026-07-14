"use client";

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

  return (
    <div className="flex flex-col h-full p-4 bg-cream">
      {/* Card Container - same style as Reel Quiz */}
      <div className="flex-1 border border-warm bg-cream rounded-xl flex flex-col p-5 shadow-sm">
        
        {/* Header: Players + Progress */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full overflow-hidden border-2 border-[#A855F7]">
              <img src={userAvatar || 'https://i.pravatar.cc/80?img=47'} alt="" className="w-full h-full object-cover" />
            </div>
            <span className="text-xs font-semibold text-gray-900">You</span>
          </div>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: battle.rounds }).map((_, i) => {
              let color = 'bg-skeleton';
              if (i < myResults.length) {
                color = myResults[i].correct ? 'bg-[#A855F7]' : 'bg-red-500';
              } else if (i === currentRound) {
                color = 'bg-[#A855F7]/50';
              }
              return <div key={i} className={`w-4 h-1 rounded ${color}`} />;
            })}
          </div>
          <div className="flex items-center gap-2 flex-row-reverse">
            {isCreator ? (
              <>
                <div className="w-6 h-6 rounded-full border-2 border-warm bg-cream flex items-center justify-center">
                  <span className="text-gray-600 text-[10px] font-bold">?</span>
                </div>
                <span className="text-xs font-semibold text-gray-600">???</span>
              </>
            ) : (
              <>
                <div className="w-6 h-6 rounded-full overflow-hidden border-2 border-warm">
                  <img src={battle.creator.avatar} alt="" className="w-full h-full object-cover" />
                </div>
                <span className="text-xs font-semibold text-gray-900">{battle.creator.username}</span>
              </>
            )}
          </div>
        </div>

        {/* Topic Badge */}
        <div className="mb-4">
          <span className="px-2 py-0.5 bg-cream border border-warm rounded text-[10px] text-gray-600 uppercase tracking-wider">
            <topic.icon className="w-3 h-3 inline" /> {topic.label} · Round {currentRound + 1}/{battle.rounds}
          </span>
        </div>

        {/* BIG Countdown in center - pulsing animation */}
        <div className="flex-1 flex items-center justify-center">
          <div 
            key={countdown}
            className="relative"
            style={{
              animation: 'pulse-scale 0.9s ease-out',
            }}
          >
            <div className={`w-32 h-32 rounded-full flex items-center justify-center ${
              countdown === 0 
                ? 'bg-[#A855F7] text-white' 
                : 'bg-[#A855F7]/10 border-4 border-[#A855F7] text-[#A855F7]'
            }`}>
              <span className="font-display text-6xl">
                {countdown === 0 ? 'GO!' : countdown}
              </span>
            </div>
            {/* Ripple effect */}
            <div 
              className="absolute inset-0 rounded-full border-4 border-[#A855F7] opacity-0"
              style={{
                animation: 'ripple 0.9s ease-out',
              }}
            />
          </div>
        </div>
        
        {/* Small timer row at bottom */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 border-2 border-[#A855F7]/30 bg-[#A855F7]/5 rounded-lg flex items-center justify-center">
              <span className="font-display text-lg text-gray-600">{countdown}</span>
            </div>
            <span className="text-gray-500 text-[10px]">SEC</span>
          </div>
          <div className="flex-1 px-1">
            <div className="flex gap-0.5">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-3 flex-1 rounded bg-skeleton" />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-display text-lg text-gray-600">0,30</span>
            <img src="/images/bogxcoin.png" alt="BOGX" className="w-4 h-4 opacity-50" />
          </div>
        </div>

        {/* Question Container - same size as quiz screen */}
        <div className="border border-warm bg-cream rounded-xl px-4 py-4 mb-4 flex items-center justify-center min-h-[100px]">
          <h2 className="text-gray-900 text-base font-bold text-center leading-snug">
            {question?.question}
          </h2>
        </div>

        {/* Placeholder Answers - same size as quiz screen buttons */}
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="px-2 py-3 min-h-[64px] bg-cream border border-warm rounded-lg flex items-center justify-center">
              <span className="text-gray-300 text-sm">···</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
