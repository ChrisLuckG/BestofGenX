"use client";

import { Check, X, Clock, ArrowRight } from "lucide-react";
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
  const timeSecondsRaw = timeLeft / 1000;
  const timeSecondsDisplay = Math.ceil(timeSecondsRaw); // For display: whole numbers
  const timePct = timeLeft / 10000;
  const filledSegments = Math.round(timePct * 8); // 8 segments like standalone

  // Calculate color based on time remaining: >5s gray, 5-3s yellow, <3s red
  const timerColor = timeSecondsRaw > 5 
    ? '#6B7280' 
    : timeSecondsRaw > 3 
      ? '#EAB308' 
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

  // Count correct answers so far
  const myCorrectCount = myResults.filter(r => r.correct).length;

  return (
    <div className="flex flex-col h-full bg-cream">
      {/* Main Card */}
      <div className="flex-1 m-2 sm:m-4 border border-warm bg-cream rounded-2xl flex flex-col p-4 sm:p-6 shadow-lg animate-[cardIn_0.4s_ease-out]">
        
        {/* Players Bar - Compact on mobile, horizontal on desktop */}
        <div className="flex items-stretch border border-warm rounded-xl bg-cream overflow-hidden mb-4 sm:mb-5">
          {/* You */}
          <div className="flex-1 min-w-0 flex flex-col items-center gap-1 p-2 sm:p-4 border-r border-warm animate-[slideInLeft_0.4s_ease-out_backwards]">
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
          <div className="flex-1 min-w-0 flex flex-col items-center gap-1 p-2 sm:p-4 border-l border-warm animate-[slideInRightBattle_0.4s_ease-out_backwards]">
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
            <div className="font-display text-xl sm:text-4xl text-gray-400 tracking-wide">
              {isCreator ? '?' : '?'}
            </div>
          </div>
        </div>

        {/* Timer Row - LED style like standalone */}
        <div className="flex items-center gap-2.5 sm:gap-4 mb-4 sm:mb-5">
          <div 
            className={`w-12 h-12 sm:w-16 sm:h-16 rounded-lg sm:rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
              timeSecondsDisplay <= 3 ? 'animate-timer-pulse' : ''
            }`}
            style={{ 
              background: `linear-gradient(135deg, ${timerColor}dd 0%, ${timerColor} 100%)`,
              boxShadow: `inset 0 0 0 2px ${timerColor}40`
            }}
          >
            <span className="font-display text-lg sm:text-2xl text-white animate-[ledPulse_1.6s_ease-in-out_infinite]">
              {String(timeSecondsDisplay).padStart(2, '0')}
            </span>
            <span className="font-display text-[7px] sm:text-[9px] text-white/80 tracking-widest">SEC</span>
          </div>
          <div className="flex-1 flex gap-1 sm:gap-1.5">
            {[...Array(8)].map((_, i) => (
              <span 
                key={i} 
                className="h-2.5 sm:h-4 flex-1 rounded transition-all duration-300"
                style={{ backgroundColor: i < filledSegments ? timerColor : '#E5E0D8' }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <span className="font-display text-xl sm:text-3xl text-gray-800">{formatCurrency(currentPoints)}</span>
            <img src="/images/bogxcoin.png" alt="" className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Question Card - no animation, always visible */}
        <div className="border border-warm bg-cream rounded-xl p-4 sm:p-6 mb-4 sm:mb-5 flex items-center justify-center min-h-[80px] sm:min-h-[120px]">
          <h2 className="font-display text-lg sm:text-2xl text-gray-900 text-center leading-snug tracking-wide">
            {question?.question}
          </h2>
        </div>

        {/* Answer Buttons - 2x2 Grid */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mb-3 sm:mb-4">
          {question?.answers.map((answer, i) => {
            const delay = `${i * 0.08}s`;
            let style: React.CSSProperties = {
              animationDelay: delay,
            };
            let className = 'rounded-lg sm:rounded-xl p-3 sm:p-4 min-h-[56px] sm:min-h-[72px] text-base sm:text-xl font-display tracking-wide flex items-center justify-center text-center transition-all cursor-pointer';
            let showIcon = false;
            let iconType: 'check' | 'x' | null = null;
            
            if (showAnswer) {
              if (i === question.correctIndex) {
                // Green for correct answer
                className += ' bg-green-500 text-white border-2 border-green-500';
                showIcon = true;
                iconType = 'check';
              } else if (i === selectedAnswer && !myResults[currentRound]?.correct) {
                // Red for wrong answer
                className += ' bg-red-500 text-white border-2 border-red-500';
                showIcon = true;
                iconType = 'x';
              } else {
                className += ' bg-cream border-2 border-warm text-gray-400 opacity-60';
              }
            } else {
              className += ' bg-cream text-gray-900 border-2 border-warm hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]';
            }
            
            return (
              <button
                key={i}
                onClick={() => !showAnswer && onAnswer(i)}
                disabled={showAnswer}
                className={`${className} animate-[fadeInUp_0.4s_ease-out_backwards]`}
                style={style}
              >
                <span className="line-clamp-2">{answer}</span>
                {showIcon && iconType === 'check' && (
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 ml-1.5 sm:ml-2 animate-[popIcon_0.35s_ease-out]" />
                )}
                {showIcon && iconType === 'x' && (
                  <X className="w-4 h-4 sm:w-5 sm:h-5 ml-1.5 sm:ml-2 animate-[popIcon_0.35s_ease-out]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Feedback + Next Button - Always visible, gray before answer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4 min-h-[48px] sm:min-h-[56px]">
          {/* Feedback Tag - Always visible */}
          <div 
            className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base flex items-center justify-center sm:justify-start gap-2 transition-all flex-1 sm:flex-initial"
            style={{
              background: !showAnswer ? '#e5e7eb' : 
                selectedAnswer === -1 ? '#ef4444' : 
                myResults[currentRound]?.correct ? '#10b981' : '#ef4444',
              color: showAnswer ? 'white' : '#9ca3af'
            }}
          >
            {!showAnswer ? (
              'Pick an answer'
            ) : selectedAnswer === -1 ? (
              <>
                <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                Time's up!
              </>
            ) : myResults[currentRound]?.correct ? (
              <>
                <Check className="w-4 h-4 sm:w-5 sm:h-5 animate-[popIcon_0.35s_ease-out]" />
                Correct — +{formatCurrency(myResults[currentRound]?.points || 0)}
              </>
            ) : (
              <>
                <X className="w-4 h-4 sm:w-5 sm:h-5 animate-[popIcon_0.35s_ease-out]" />
                Wrong!
              </>
            )}
          </div>

          {/* Next Button - Always visible, light gray before answer, darker when active */}
          <button
            onClick={handleNextClick}
            disabled={!showAnswer}
            className={`px-6 sm:px-8 py-2.5 sm:py-3 font-display text-sm sm:text-base tracking-widest rounded-lg sm:rounded-xl flex items-center justify-center gap-2 transition-all ${
              showAnswer 
                ? 'bg-gray-500 text-white hover:bg-gray-600 cursor-pointer' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {currentRound < battle.rounds - 1 ? 'Next' : (isCreator ? 'Submit' : 'Results')}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
