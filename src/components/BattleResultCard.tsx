"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, X, Check, HelpCircle } from "lucide-react";

interface RoundResult {
  correct: boolean;
  timeMs?: number;
  points: number;
  answerIndex?: number;
}

interface BattleQuestion {
  question: string;
  answers: string[];
  correctIndex: number;
}

interface BattleResultCardProps {
  topic: string;
  wager: number;
  rounds: number;
  myResults: RoundResult[];
  opponentResults: RoundResult[];
  myTotalPoints: number;
  opponentTotalPoints: number;
  myAvatar?: string;
  myUsername?: string;
  opponentAvatar?: string;
  opponentUsername?: string;
  onClose?: () => void;
  showButtons?: boolean;
  onBackToPool?: () => void;
  onPlayAgain?: () => void;
  forceComplete?: boolean; // Force showing as complete even if results are incomplete
  questions?: BattleQuestion[];
}

// Topic config
const TOPICS: Record<string, { label: string; emoji: string }> = {
  sport: { label: 'Sport', emoji: '⚽' },
  music: { label: 'Music', emoji: '🎵' },
  film: { label: 'Film', emoji: '🎬' },
  culture: { label: 'Culture', emoji: '🕹' },
  fashion: { label: 'Fashion', emoji: '👗' },
  games: { label: 'Games', emoji: '🎮' },
  tv: { label: 'TV', emoji: '📺' },
  art: { label: 'Art', emoji: '🎨' },
  food: { label: 'Food', emoji: '🍔' },
};

export default function BattleResultCard({
  topic,
  wager,
  rounds,
  myResults,
  opponentResults,
  myTotalPoints,
  opponentTotalPoints,
  myAvatar,
  myUsername = 'You',
  opponentAvatar,
  opponentUsername = 'Opponent',
  onClose,
  showButtons = true,
  onBackToPool,
  onPlayAgain,
  forceComplete = false,
  questions = [],
}: BattleResultCardProps) {
  const [viewingQuestion, setViewingQuestion] = useState<number | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  
  const topicConfig = TOPICS[topic] || { label: topic, emoji: '❓' };
  const isComplete = forceComplete || (myResults.length >= rounds && opponentResults.length >= rounds);
  const won = myTotalPoints > opponentTotalPoints;
  const isTie = myTotalPoints === opponentTotalPoints;
  const leading = myTotalPoints >= opponentTotalPoints;
  const diff = Math.abs(myTotalPoints - opponentTotalPoints);
  const myCorrect = myResults.filter(r => r.correct).length;
  const oppCorrect = opponentResults.filter(r => r.correct).length;
  
  const hasQuestions = questions && questions.length > 0;
  
  // Fixed card height for consistent flip effect - fits in viewport with padding
  const CARD_HEIGHT = 480; // Fixed height in pixels
  
  // Format time in seconds
  const formatTime = (ms?: number) => {
    if (!ms) return '-';
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
  };

  // Handle flip to questions
  const handleFlipToQuestions = () => {
    setIsFlipped(true);
    // Wait for flip-out animation, then show questions
    setTimeout(() => setViewingQuestion(0), 200);
  };
  
  // Handle flip back to results
  const handleFlipToResults = () => {
    setIsFlipped(false);
    // Wait for flip-out animation, then show results
    setTimeout(() => setViewingQuestion(null), 200);
  };

  // Question viewer (back of card) with flip animation
  if (viewingQuestion !== null && hasQuestions) {
    const q = questions[viewingQuestion];
    const myResult = myResults[viewingQuestion];
    const correctIndex = q?.correctIndex;
    
    return (
      <div 
        className="border border-warm bg-cream rounded-2xl flex flex-col p-4 shadow-xl transition-transform duration-300 overflow-hidden"
        style={{ 
          animation: 'flipIn 0.3s ease-out',
          height: `${CARD_HEIGHT}px`,
          maxHeight: '85vh',
        }}
      >
        <style jsx>{`
          @keyframes flipIn {
            0% { transform: perspective(1000px) rotateY(-90deg); opacity: 0; }
            50% { opacity: 0; }
            100% { transform: perspective(1000px) rotateY(0deg); opacity: 1; }
          }
        `}</style>
        {/* Header - compact */}
        <div className="flex items-center justify-between mb-3">
          {/* Left: Results button */}
          <button 
            onClick={handleFlipToResults}
            className="px-3 py-1.5 rounded-lg bg-[#D4873A] text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm hover:bg-[#C4772A] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Results
          </button>
          {/* Center: Round indicator */}
          <span className="px-2 py-1 bg-[#D4873A]/10 text-[#D4873A] rounded-lg text-[10px] uppercase tracking-wider font-bold">
            {viewingQuestion + 1} / {rounds}
          </span>
          {/* Right: Close button - red background, white X */}
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
        
        {/* Question - compact */}
        <div className="text-center mb-3 px-1">
          <p className="text-base font-bold text-gray-900 leading-snug">{q?.question}</p>
          {/* Your result indicator */}
          <div className="mt-2">
            {myResult?.correct ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-100 text-green-700 text-xs font-bold">
                <Check className="w-3 h-3" /> Correct! (+{myResult.points} BOGX)
              </span>
            ) : myResult?.answerIndex === -1 ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-yellow-100 text-yellow-700 text-xs font-bold">
                <HelpCircle className="w-3 h-3" /> Time's up - no answer
              </span>
            ) : typeof myResult?.answerIndex === 'number' && myResult.answerIndex >= 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-bold">
                <X className="w-3 h-3" /> You answered {String.fromCharCode(65 + myResult.answerIndex)} - Wrong! Correct: {String.fromCharCode(65 + correctIndex)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-bold">
                <X className="w-3 h-3" /> Wrong! Correct: {String.fromCharCode(65 + correctIndex)}
              </span>
            )}
          </div>
        </div>
        
        {/* Answers - compact */}
        <div className="space-y-2 mb-3 flex-1">
          {q?.answers.map((answer, i) => {
            const isCorrect = i === correctIndex;
            // Check if this was my answer - handle both number and undefined
            const myAnswerIdx = myResult?.answerIndex;
            const wasMyAnswer = typeof myAnswerIdx === 'number' && myAnswerIdx >= 0 && myAnswerIdx === i;
            const isWrongSelection = wasMyAnswer && !isCorrect;
            const noAnswer = myAnswerIdx === -1; // Timeout
            
            return (
              <div 
                key={i}
                className={`p-2.5 rounded-lg border-2 flex items-center gap-2 ${
                  isCorrect 
                    ? 'border-green-500 bg-green-50' 
                    : isWrongSelection
                      ? 'border-red-500 bg-red-50'
                      : 'border-warm bg-white'
                }`}
              >
                <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  isCorrect ? 'bg-green-500 text-white' : isWrongSelection ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {String.fromCharCode(65 + i)}
                </span>
                <div className="flex-1 min-w-0">
                  <span className={`text-xs ${isCorrect ? 'text-green-700 font-semibold' : isWrongSelection ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
                    {answer}
                  </span>
                  {isWrongSelection && myResult?.timeMs && (
                    <span className="ml-2 inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold bg-red-100 text-red-600">
                      Your answer • {formatTime(myResult.timeMs)}
                    </span>
                  )}
                  {isCorrect && wasMyAnswer && myResult && (
                    <span className="ml-2 inline-flex items-center gap-1">
                      <span className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold bg-green-100 text-green-600">
                        {formatTime(myResult.timeMs || 0)}
                      </span>
                      <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold bg-[#D4873A]/10 text-[#D4873A]">
                        <img src="/images/bogxcoin.png" alt="" className="w-2.5 h-2.5" />
                        +{myResult.points}
                      </span>
                    </span>
                  )}
                  {isCorrect && noAnswer && (
                    <span className="ml-2 inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold bg-yellow-100 text-yellow-700">
                      Time's up!
                    </span>
                  )}
                </div>
                {isCorrect && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
                {isWrongSelection && <X className="w-4 h-4 text-red-500 flex-shrink-0" />}
              </div>
            );
          })}
        </div>
        
        {/* Navigation - compact */}
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={() => setViewingQuestion(prev => prev !== null && prev > 0 ? prev - 1 : prev)}
            disabled={viewingQuestion === 0}
            className="flex-1 py-2 rounded-lg border border-warm bg-white text-gray-600 font-semibold text-xs disabled:opacity-40 flex items-center justify-center gap-1 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Prev
          </button>
          <button
            onClick={() => setViewingQuestion(prev => prev !== null && prev < rounds - 1 ? prev + 1 : prev)}
            disabled={viewingQuestion >= rounds - 1}
            className="flex-1 py-2 rounded-lg border border-warm bg-white text-gray-600 font-semibold text-xs disabled:opacity-40 flex items-center justify-center gap-1 hover:bg-gray-50 transition-colors"
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Calculate if close match (within 20% of total possible points)
  const isCloseMatch = isComplete && !isTie && diff <= Math.max(rounds * 50, wager * 0.3);
  const oppPerfect = oppCorrect === rounds;
  const myPerfect = myCorrect === rounds;

  return (
    <div 
      className="border border-warm bg-cream rounded-2xl flex flex-col p-4 shadow-xl overflow-hidden"
      style={{ 
        animation: isFlipped ? undefined : 'flipBack 0.3s ease-out',
        height: `${CARD_HEIGHT}px`,
        maxHeight: '85vh',
      }}
    >
      <style jsx>{`
        @keyframes flipBack {
          0% { transform: perspective(1000px) rotateY(90deg); opacity: 0; }
          50% { opacity: 0; }
          100% { transform: perspective(1000px) rotateY(0deg); opacity: 1; }
        }
      `}</style>
      
      {/* Header - sticky close button */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <span className="px-2 py-1 bg-white border border-warm rounded-lg text-[10px] text-gray-700 uppercase tracking-wider font-semibold">
          {topicConfig.emoji} {topicConfig.label}
        </span>
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
          Battle Complete
        </span>
        {onClose && (
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500 hover:bg-red-600 transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        )}
      </div>

      {/* Big Result with Lightning - compact */}
      <div className="text-center mb-2 relative flex-shrink-0">
        <div className="flex items-center justify-center gap-1 mb-0.5">
          <span className="text-xl">⚡</span>
          <div 
            className="font-display text-3xl tracking-wider"
            style={{ 
              color: isTie ? '#f59e0b' : won ? '#22c55e' : '#dc2626',
              textShadow: '2px 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            {isTie ? "TIE!" : won ? 'VICTORY!' : 'DEFEATED'}
          </div>
          <span className="text-xl">⚡</span>
        </div>
        <p className="text-xs text-gray-500 mb-1">
          {isTie ? "Great battle!" : won ? 'Congratulations!' : 'Better luck next time!'}
        </p>
        <div 
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-base font-bold"
          style={{ 
            backgroundColor: isTie ? '#fef3c7' : won ? '#dcfce7' : '#fee2e2',
            color: isTie ? '#d97706' : won ? '#16a34a' : '#dc2626'
          }}
        >
          {isTie ? '' : won ? '+' : '-'}{wager.toFixed(2)}
          <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
        </div>
      </div>

      {/* Players VS Box - compact */}
      <div className="border border-warm bg-white rounded-xl p-2 mb-2 flex-shrink-0">
        <div className="flex items-center">
          {/* Me */}
          <div className="flex-1 text-center">
            <div className={`w-10 h-10 mx-auto rounded-full overflow-hidden border-2 mb-0.5 ${won ? 'border-yellow-400 ring-1 ring-yellow-200' : 'border-gray-200'}`}>
              {myAvatar ? (
                <img src={myAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-600 text-sm font-bold">
                  {myUsername.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="text-xs font-bold text-gray-900">{won ? '👑 ' : ''}You</div>
            <div className="text-[9px] text-gray-500">{myCorrect} / {rounds} correct</div>
            <div className="text-sm font-bold text-gray-900 flex items-center justify-center gap-0.5">
              {myTotalPoints.toFixed(2)} <img src="/images/bogxcoin.png" alt="" className="w-3 h-3" />
            </div>
          </div>
          
          {/* VS */}
          <div className="px-2">
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">VS</div>
          </div>
          
          {/* Opponent */}
          <div className="flex-1 text-center">
            <div className={`w-10 h-10 mx-auto rounded-full overflow-hidden border-2 mb-0.5 ${!won && !isTie ? 'border-yellow-400 ring-1 ring-yellow-200' : 'border-gray-200'}`}>
              {opponentAvatar ? (
                <img src={opponentAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-600 text-sm font-bold">
                  {opponentUsername.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="text-xs font-bold text-gray-900">{!won && !isTie ? '👑 ' : ''}{opponentUsername}</div>
            <div className="text-[9px] text-gray-500">{oppCorrect} / {rounds} correct</div>
            <div className="text-sm font-bold text-gray-900 flex items-center justify-center gap-0.5">
              {opponentTotalPoints.toFixed(2)} <img src="/images/bogxcoin.png" alt="" className="w-3 h-3" />
            </div>
          </div>
        </div>
        
        {/* Winner message */}
        {isComplete && !isTie && (
          <div className="mt-1.5 pt-1.5 border-t border-warm text-center">
            <span className="text-xs text-gray-600">
              🏆 {won ? 'You were' : `${opponentUsername} was`} better this time.
            </span>
          </div>
        )}
      </div>

      {/* Round by Round - Horizontal Cards - compact */}
      <div className="mb-2 flex-shrink-0">
        <div className="text-[8px] font-semibold tracking-widest text-gray-500 uppercase mb-1">Round by Round</div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {Array.from({ length: rounds }).map((_, i) => {
            const myR = myResults[i];
            const oppR = opponentResults[i];
            const iWon = myR && oppR && ((myR.correct && !oppR.correct) || (myR.correct && oppR.correct && (myR.timeMs || 0) < (oppR.timeMs || 0)));
            const oppWon = myR && oppR && ((!myR.correct && oppR.correct) || (myR.correct && oppR.correct && (oppR.timeMs || 0) < (myR.timeMs || 0)));
            
            return (
              <div 
                key={i} 
                onClick={() => hasQuestions && i < questions.length && (setIsFlipped(true), setTimeout(() => setViewingQuestion(i), 150))}
                className={`flex-1 min-w-[70px] p-1.5 rounded-lg border ${myR?.correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'} ${hasQuestions ? 'cursor-pointer hover:shadow-md' : ''}`}
              >
                <div className="text-[8px] font-bold text-gray-500 uppercase text-center">R{i + 1}</div>
                <div className="flex items-center justify-center gap-0.5">
                  {myR?.correct ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <X className="w-3 h-3 text-red-500" />
                  )}
                  <span className={`text-[10px] font-semibold ${myR?.correct ? 'text-green-600' : 'text-red-500'}`}>
                    {myR?.correct ? '✓' : '✗'}
                  </span>
                </div>
                <div className="text-[9px] text-gray-500 text-center">{formatTime(myR?.timeMs)}</div>
                <div className={`text-xs font-bold text-center ${myR?.correct ? 'text-green-600' : 'text-red-400'}`}>
                  {myR?.correct ? myR.points.toFixed(2) : '0.00'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Close Match Banner - compact */}
      {isCloseMatch && (
        <div className="flex items-center gap-2 p-2 mb-2 rounded-lg bg-red-50 border border-red-200 flex-shrink-0">
          <div className="text-lg">🎯</div>
          <div className="flex-1">
            <div className="text-xs font-bold text-red-700 uppercase">Close Match</div>
            <div className="text-[10px] text-red-600">
              Missed by {diff.toFixed(2)} BOGX
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-red-600">{diff.toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* Buttons - compact */}
      <div className="mt-auto space-y-1.5 flex-shrink-0">
        {onPlayAgain && (
          <button
            onClick={onPlayAgain}
            className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs tracking-wider rounded-lg flex items-center justify-center gap-1"
          >
            REMATCH ⚔️
          </button>
        )}
        <div className="flex gap-1.5">
          {onBackToPool && (
            <button
              onClick={onBackToPool}
              className="flex-1 py-2 bg-white border border-warm text-gray-600 font-semibold text-xs rounded-lg hover:bg-gray-50"
            >
              ← POOL
            </button>
          )}
          {hasQuestions && (
            <button
              onClick={handleFlipToQuestions}
              className="flex-1 py-2 bg-white border border-warm text-gray-600 font-semibold text-xs rounded-lg hover:bg-gray-50 flex items-center justify-center gap-1"
            >
              📝 Questions
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
