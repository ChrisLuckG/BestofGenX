"use client";

import { Check, X, Clock } from "lucide-react";
import { formatCurrency } from "@/utils/currency";
import { Battle, RoundResult, getTopicConfig } from "./types";

interface BattleQuizScreenProps {
  battle: Battle;
  currentRound: number;
  timeLeft: number;
  currentPoints: number;
  myResults: RoundResult[];
  myTotalPoints: number;
  opponentTotalPoints: number;
  selectedAnswer: number | null;
  showAnswer: boolean;
  isCreator: boolean;
  userAvatar?: string;
  onAnswer: (index: number) => void;
  onNext: () => void;
  onSubmit: () => void;
  onSeeResults: () => void;
}

export default function BattleQuizScreen({
  battle,
  currentRound,
  timeLeft,
  currentPoints,
  myResults,
  myTotalPoints,
  opponentTotalPoints,
  selectedAnswer,
  showAnswer,
  isCreator,
  userAvatar,
  onAnswer,
  onNext,
  onSubmit,
  onSeeResults,
}: BattleQuizScreenProps) {
  const question = battle.questions[currentRound];
  const topic = getTopicConfig(battle.topic);
  const timeSeconds = Math.ceil(timeLeft / 1000);
  const timePct = timeLeft / 10000;
  const filledSegments = Math.round(timePct * 10);

  // Calculate color based on time remaining (purple -> orange -> red)
  const timerColor = timePct > 0.5 
    ? '#A855F7' 
    : timePct > 0.25 
      ? '#E05A00' 
      : '#DC2626';

  const handleNextClick = () => {
    if (!showAnswer) return;
    if (currentRound < battle.rounds - 1) {
      onNext();
    } else if (isCreator) {
      onSubmit();
    } else {
      onSeeResults();
    }
  };

  return (
    <div className="flex flex-col h-full p-4 bg-cream">
      {/* Card Container */}
      <div className="flex-1 border border-warm bg-cream rounded-xl flex flex-col p-5 shadow-sm">
        
        {/* Header: Players + Progress */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full overflow-hidden border-2 border-[#A855F7]">
              <img src={userAvatar || 'https://i.pravatar.cc/80?img=47'} alt="" className="w-full h-full object-cover" />
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-900">You</span>
              <div className="font-display text-sm text-gray-900">{formatCurrency(myTotalPoints)}</div>
            </div>
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
                <div className="text-right">
                  <span className="text-xs font-semibold text-gray-600">???</span>
                  <div className="font-display text-sm text-gray-300">?</div>
                </div>
              </>
            ) : (
              <>
                <div className="w-6 h-6 rounded-full overflow-hidden border-2 border-warm">
                  <img src={battle.creator.avatar} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-gray-900">{battle.creator.username}</span>
                  <div className="font-display text-sm text-gray-600">{formatCurrency(opponentTotalPoints)}</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Topic Badge */}
        <div className="mb-3">
          <span className="px-2 py-0.5 bg-cream border border-warm rounded text-[10px] text-gray-600 uppercase tracking-wider">
            <topic.icon className="w-3 h-3 inline" /> {topic.label} · Round {currentRound + 1}/{battle.rounds}
          </span>
        </div>

        {/* Timer Row with LED segments */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-1">
            <div 
              className={`w-11 h-11 border-2 rounded-lg flex items-center justify-center transition-colors duration-300 ${
                timeSeconds <= 3 ? 'animate-timer-pulse' : ''
              }`}
              style={{ borderColor: timerColor, backgroundColor: `${timerColor}15` }}
            >
              <span className="font-display text-2xl text-gray-900">{String(timeSeconds).padStart(2, '0')}</span>
            </div>
            <span className="text-gray-600 text-[10px]">SEC</span>
          </div>
          <div className="flex-1 px-1">
            <div className="flex gap-0.5">
              {[...Array(10)].map((_, i) => (
                <div 
                  key={i} 
                  className="h-4 flex-1 rounded transition-colors duration-300"
                  style={{ backgroundColor: i < filledSegments ? timerColor : '#E5E0D8' }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-display text-2xl text-gray-900">{formatCurrency(currentPoints)}</span>
            <img src="/images/bogxcoin.png" alt="BOGX" className="w-5 h-5" />
          </div>
        </div>

        {/* Question Container */}
        <div className="border border-warm bg-cream rounded-xl px-4 py-4 mb-4 flex items-center justify-center min-h-[100px]">
          <h2 className="text-gray-900 text-base font-bold text-center leading-snug">
            {question?.question}
          </h2>
        </div>

        {/* Answers */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {question?.answers.map((answer, i) => {
            let className = 'px-2 py-3 min-h-[64px] text-sm font-bold flex items-center justify-center text-center transition-all rounded-lg';
            
            if (showAnswer) {
              if (i === question.correctIndex) {
                className += ' bg-[#A855F7] text-white border-2 border-[#A855F7]';
              } else if (i === selectedAnswer && !myResults[currentRound]?.correct) {
                className += ' bg-red-500 text-white border-2 border-red-500';
              } else {
                className += ' bg-cream border border-warm text-gray-600';
              }
            } else {
              className += ' bg-cream text-gray-900 border border-warm hover:bg-cream hover:border-gray-300 cursor-pointer';
            }
            
            return (
              <button
                key={i}
                onClick={() => onAnswer(i)}
                disabled={showAnswer}
                className={className}
              >
                <span className="line-clamp-2">{answer}</span>
              </button>
            );
          })}
        </div>

        {/* Result Banner + Next Button */}
        <div className="grid grid-cols-2 gap-2 mt-auto">
          {/* Result Banner */}
          <div className={`py-4 px-4 rounded-xl flex items-center justify-center gap-2 transition-opacity ${
            showAnswer ? 'opacity-100' : 'opacity-0'
          } ${
            selectedAnswer === -1 
              ? 'bg-red-500' 
              : myResults[currentRound]?.correct 
                ? 'bg-[#A855F7]' 
                : 'bg-red-500'
          }`}>
            {selectedAnswer === -1 ? (
              <>
                <Clock className="w-5 h-5 text-white" />
                <span className="font-display text-base tracking-wider text-white">TIME'S UP!</span>
              </>
            ) : myResults[currentRound]?.correct ? (
              <>
                <Check className="w-5 h-5 text-white" />
                <span className="font-display text-base tracking-wider text-white">+{formatCurrency(myResults[currentRound]?.points || 0)}</span>
                <img src="/images/bogxcoin.png" alt="BOGX" className="w-5 h-5" />
              </>
            ) : (
              <>
                <X className="w-5 h-5 text-white" />
                <span className="font-display text-base tracking-wider text-white">WRONG!</span>
              </>
            )}
          </div>
          {/* Next Button */}
          <button
            onClick={handleNextClick}
            disabled={!showAnswer}
            className={`py-4 bg-[#A855F7] text-white font-display tracking-widest rounded-xl flex items-center justify-center gap-2 transition-opacity ${
              showAnswer ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {currentRound < battle.rounds - 1 ? 'NEXT →' : (isCreator ? 'SUBMIT ✓' : 'RESULTS')}
          </button>
        </div>
      </div>
    </div>
  );
}
