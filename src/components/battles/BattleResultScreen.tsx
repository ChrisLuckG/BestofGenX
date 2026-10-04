"use client";

import { useState } from "react";
import { Trophy, ChevronLeft, ChevronRight, ArrowRight, Swords, X, Check, Share2 } from "lucide-react";
import { Battle, RoundResult, getTopicConfig, toBOGX } from "./types";
import { formatCurrency, getCurrencySymbol } from "@/utils/currency";
import { compareBattleResults } from "@/utils/battleWinner";

interface BattleResultScreenProps {
  battle: Battle;
  myResults: RoundResult[];
  opponentResults: RoundResult[];
  myTotalPoints: number;
  opponentTotalPoints: number;
  isCreator: boolean;
  userAvatar?: string;
  onBackToPool: () => void;
  onRematch: () => void;
  onContinue: () => void;
  isMobile?: boolean; // Mobile-optimized layout
}

export default function BattleResultScreen({
  battle,
  myResults,
  opponentResults,
  myTotalPoints,
  opponentTotalPoints,
  isCreator,
  userAvatar,
  onBackToPool,
  onRematch,
  onContinue,
  isMobile = false,
}: BattleResultScreenProps) {
  const [viewingQuestion, setViewingQuestion] = useState<number | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const topic = getTopicConfig(battle.topic);
  const hasQuestions = battle.questions && battle.questions.length > 0;
  
  // Format time. Falls back to milliseconds precision when the value would be
  // indistinguishable from the value it's compared against (e.g. both "2.3s").
  const formatTime = (ms?: number, compareMs?: number) => {
    if (!ms) return '-';
    const tied = compareMs != null && compareMs !== ms
      && (ms / 1000).toFixed(1) === (compareMs / 1000).toFixed(1);
    return `${(ms / 1000).toFixed(tied ? 3 : 1)}s`;
  };
  // Forfeit detection: check if battle was forfeited and by whom
  // For old battles without forfeitedBy, infer from: completed + winner + empty results
  const myUserId = String(isCreator ? battle.creator._id : battle.opponent?._id || '');
  const opponentUserId = String(isCreator ? battle.opponent?._id : battle.creator._id || '');
  
  // Normalize IDs to strings for comparison (winner/forfeitedBy may be ObjectId or string)
  const winnerId = battle.winner ? String(typeof battle.winner === 'object' ? (battle.winner as any)?._id : battle.winner) : null;
  const forfeiterId = battle.forfeitedBy ? String(typeof battle.forfeitedBy === 'object' ? (battle.forfeitedBy as any)?._id : battle.forfeitedBy) : null;
  
  // Explicit forfeit (new battles)
  const iForfeited = !!forfeiterId && forfeiterId === myUserId;
  const opponentForfeited = !!forfeiterId && forfeiterId === opponentUserId;
  
  // Inferred forfeit (old battles): completed with winner but results don't justify it
  const battleCompleted = battle.status === 'completed';
  const hasWinner = !!winnerId;
  const iWon = !!winnerId && winnerId === myUserId;
  const myResultsEmpty = myResults.length === 0;
  const oppResultsEmpty = opponentResults.length === 0;
  
  // If battle is completed with a winner but both sides have 0 results (or equal empty),
  // someone forfeited. The loser is whoever is NOT the winner.
  const bothEmpty = myResultsEmpty && oppResultsEmpty;
  const inferredIForfeited = battleCompleted && hasWinner && !iWon && (myResultsEmpty || bothEmpty);
  const inferredOppForfeited = battleCompleted && hasWinner && iWon && (oppResultsEmpty || bothEmpty);
  
  const isForfeit = iForfeited || opponentForfeited || inferredIForfeited || inferredOppForfeited;
  const actuallyIForfeited = iForfeited || inferredIForfeited;
  const actuallyOppForfeited = opponentForfeited || inferredOppForfeited;
  
  // A battle is complete when all rounds are played OR it was forfeited/completed
  // For forfeits: battle.status === 'completed' but results may be empty
  const isComplete = myResults.length >= battle.rounds || battle.status === 'completed';
  
  // Winner = most correct answers; tie-break by fastest total time.
  // For forfeits: the winner is set by the server, use that directly
  const cmp = compareBattleResults(myResults, opponentResults);
  const wonByScore = cmp > 0;
  const wonByForfeit = actuallyOppForfeited;
  const lostByForfeit = actuallyIForfeited;
  const won = lostByForfeit ? false : (wonByForfeit || wonByScore);
  const isDraw = !isForfeit && cmp === 0;
  const myCorrect = myResults.filter(r => r.correct).length;
  const oppCorrect = opponentResults.filter(r => r.correct).length;
  // Opponent data is only hidden while they still have to play - once the
  // battle is completed (or they finished all their rounds) everything is revealed.
  // Partial results are persisted per answer, so this must compare against the
  // round count rather than merely check for a non-empty array - otherwise an
  // opponent still mid-battle has their score revealed.
  const opponentHasPlayed = battle.status === 'completed' || opponentResults.length >= battle.rounds;
  
  // Shown so it's transparent WHY a winner was picked when points look tied
  const myTotalTime = myResults.reduce((sum, r: any) => sum + (r.timeMs || 0), 0);
  const oppTotalTime = opponentResults.reduce((sum, r: any) => sum + (r.timeMs || 0), 0);

  // Colors based on result - use topic color for wins
  const resultColor = won ? topic.color : '#ef4444';
  const resultBandBg = won ? `bg-opacity-10` : 'bg-red-500/10';

  // Plain-language reason for the outcome. The scoreboard alone can't explain a
  // win on equal answers (decided by time) or a pot lost without a single answer.
  const opponentName = (isCreator ? battle.opponent : battle.creator)?.username || 'Your opponent';
  const timeGap = Math.abs(myTotalTime - oppTotalTime);
  // Derived from the ROUNDED totals shown in the TOT column, otherwise the note
  // contradicts the table: 11.74s vs 15.64s renders as "11.7 / 15.7" but the raw
  // gap is 3.90s, which reads like a different number than the visible 4.0s.
  const formatGap = (ms: number) => {
    const shown = Math.abs(
      Number((myTotalTime / 1000).toFixed(1)) - Number((oppTotalTime / 1000).toFixed(1))
    );
    // Identical at one decimal → fall back to ms, same as the per-round times do
    if (shown === 0) return `${Math.round(ms)}ms`;
    return `${shown.toFixed(1)}s`;
  };
  const outcomeNote = (() => {
    if (isForfeit) {
      const playedRounds = actuallyIForfeited ? myResults.length : opponentResults.length;
      const who = actuallyIForfeited ? 'You' : opponentName;
      if (playedRounds === 0) return `${who} left before answering a single question — the full pot went to the other side.`;
      return `${who} gave up after ${playedRounds} of ${battle.rounds} rounds — the full pot went to the other side.`;
    }
    if (myCorrect !== oppCorrect) {
      const diff = Math.abs(myCorrect - oppCorrect);
      return `${won ? 'You were' : `${opponentName} was`} ${diff} correct answer${diff === 1 ? '' : 's'} ahead.`;
    }
    // Equal number of correct answers from here on
    if (myCorrect === 0) return 'Neither of you got a single answer right — your wager came back.';
    if (timeGap === 0) return `Both ${myCorrect}/${battle.rounds} and exactly the same time — your wager came back.`;
    return `Both ${myCorrect}/${battle.rounds} correct — ${won ? 'you were' : `${opponentName} was`} ${formatGap(timeGap)} faster over all ${battle.rounds} rounds.`;
  })();

  // Question viewer (flipped view) - same height as results
  if (viewingQuestion !== null && hasQuestions) {
    const q = battle.questions![viewingQuestion];
    const myResult = myResults[viewingQuestion];
    const correctIndex = q?.correctIndex;
    
    return (
      <div className="flex flex-col h-full bg-cream">
        <div 
          className={`flex-1 ${isMobile ? 'm-2 p-3' : 'm-4 p-6'} border border-warm bg-cream rounded-2xl flex flex-col overflow-y-auto shadow-lg`}
          style={{ animation: 'flipIn 0.3s ease-out' }}
        >
          <style jsx>{`
            @keyframes flipIn {
              0% { transform: perspective(1000px) rotateY(-90deg); opacity: 0; }
              50% { opacity: 0; }
              100% { transform: perspective(1000px) rotateY(0deg); opacity: 1; }
            }
          `}</style>
          
          {/* Header */}
          <div className={`flex items-center justify-between ${isMobile ? 'mb-3' : 'mb-6'}`}>
            <button 
              onClick={() => { setIsFlipped(false); setTimeout(() => setViewingQuestion(null), 150); }}
              className={`${isMobile ? 'px-4 py-2 text-lg' : 'px-4 py-2 text-sm'} rounded-lg bg-[#E36B11] text-white font-display flex items-center gap-2 hover:bg-[#C4772A] transition-colors`}
            >
              <ChevronLeft className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
              Results
            </button>
            <span className={`${isMobile ? 'px-3 py-1.5 text-lg' : 'px-3 py-1.5 text-sm'} bg-[#E36B11]/10 text-[#E36B11] rounded-lg uppercase tracking-wider font-display`}>
              Q{viewingQuestion + 1}/{battle.rounds}
            </span>
          </div>
          
          {/* Separator */}
          {isMobile && <div className="border-b border-warm my-3" />}
          
          {/* Question */}
          <div className={`text-center ${isMobile ? 'mb-3 px-2' : 'mb-6 px-4'}`}>
            <p className={`${isMobile ? 'text-2xl' : 'text-xl'} font-display text-gray-900 leading-relaxed`}>{q?.question}</p>
          </div>
          
          {/* Answers - 2x2 grid on mobile */}
          <div className={`${isMobile ? 'grid grid-cols-2 gap-2 flex-1' : 'space-y-3 mb-6'}`}>
            {q?.answers.map((answer, i) => {
              const isCorrect = i === correctIndex;
              const myAnswerIdx = myResult?.answerIndex;
              const wasMyAnswer = typeof myAnswerIdx === 'number' && myAnswerIdx >= 0 && myAnswerIdx === i;
              const isWrongSelection = wasMyAnswer && !isCorrect;
              
              // Opponent's answer
              const oppResult = opponentResults[viewingQuestion];
              const oppAnswerIdx = oppResult?.answerIndex;
              const wasOppAnswer = !isCreator && typeof oppAnswerIdx === 'number' && oppAnswerIdx >= 0 && oppAnswerIdx === i;
              
              return (
                <div 
                  key={i}
                  className={`${isMobile ? 'relative px-1 py-0.5 pb-2 rounded border' : 'p-4 rounded-xl border-2 flex items-center gap-4'} ${
                    isCorrect 
                      ? 'border-green-500 bg-green-50' 
                      : isWrongSelection
                        ? 'border-red-500 bg-red-50'
                        : 'border-warm bg-white'
                  }`}
                >
                  {isMobile ? (
                    <>
                      {/* Answer text */}
                      <span className={`text-xl font-display leading-tight block ${isCorrect ? 'text-green-700' : isWrongSelection ? 'text-red-600' : 'text-gray-800'}`}>
                        {answer}
                      </span>
                      {/* Letter badge - bottom left */}
                      <span className={`absolute bottom-0.5 left-0.5 w-8 h-8 rounded-lg flex items-center justify-center text-lg font-display ${
                        isCorrect ? 'bg-green-500 text-white' : isWrongSelection ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      {/* Time - bottom right */}
                      {wasMyAnswer && myResult?.timeMs && (
                        <span className={`absolute bottom-1 right-1.5 text-xl font-display ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                          {formatTime(myResult.timeMs)}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-base font-bold flex-shrink-0 ${
                        isCorrect ? 'bg-green-500 text-white' : isWrongSelection ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className={`text-base ${isCorrect ? 'text-green-700 font-semibold' : isWrongSelection ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
                          {answer}
                        </span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {wasMyAnswer && myResult?.timeMs && (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold ${isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                              You • {formatTime(myResult.timeMs)}
                              {isCorrect && <span className="text-[#E36B11]">+{myResult.points}</span>}
                            </span>
                          )}
                          {wasOppAnswer && oppResult?.timeMs && (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold ${isCorrect ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                              {battle.creator.username} • {formatTime(oppResult.timeMs)}
                              {isCorrect && <span className="text-[#E36B11]">+{oppResult.points}</span>}
                            </span>
                          )}
                        </div>
                      </div>
                      {isCorrect && <Check className="w-6 h-6 text-green-500 flex-shrink-0" />}
                      {isWrongSelection && <X className="w-6 h-6 text-red-500 flex-shrink-0" />}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Spacer - only on desktop */}
          {!isMobile && <div className="flex-1" />}
          
          {/* Navigation - clickable question numbers */}
          <div className={`flex items-center justify-center ${isMobile ? 'gap-2 mt-4' : 'gap-3'}`}>
            {Array.from({ length: battle.rounds }).map((_, i) => {
              const r = myResults[i];
              const isActive = viewingQuestion === i;
              const isCorrect = r?.correct;
              return (
                <button
                  key={i}
                  onClick={() => setViewingQuestion(i)}
                  className={`${isMobile ? 'w-10 h-10 rounded-xl text-sm' : 'w-12 h-12 rounded-xl text-lg'} font-display flex items-center justify-center transition-all ${
                    isActive 
                      ? 'bg-[#E36B11] text-white scale-110 shadow-lg' 
                      : isCorrect 
                        ? 'bg-green-100 text-green-600 border-2 border-green-300 hover:scale-105' 
                        : 'bg-red-100 text-red-600 border-2 border-red-300 hover:scale-105'
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-cream">
      {/* Results View */}
      <div 
        className={`flex-1 ${isMobile ? 'm-2 p-3' : 'm-4 p-6'} border border-warm bg-cream rounded-2xl flex flex-col overflow-y-auto shadow-lg`}
        style={{ animation: isFlipped ? undefined : 'flipBack 0.3s ease-out' }}
      >
        <style jsx>{`
          @keyframes flipBack {
            0% { transform: perspective(1000px) rotateY(90deg); opacity: 0; }
            50% { opacity: 0; }
            100% { transform: perspective(1000px) rotateY(0deg); opacity: 1; }
          }
        `}</style>
        
        {/* Header - only show on desktop */}
        {!isMobile && (
          <div className="flex items-center justify-between mb-6">
            <span 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg uppercase tracking-wider font-bold"
              style={{ backgroundColor: `${topic.color}15`, borderColor: `${topic.color}30`, color: topic.color, border: `1px solid ${topic.color}30` }}
            >
              <topic.icon className="w-3.5 h-3.5" /> {topic.label}
            </span>
            {isComplete ? (
              <button
                onClick={() => {
                  const opponentData = isCreator ? battle.opponent : battle.creator;
                  const text = `I just ${won ? 'won' : 'played'} a ${topic.label} battle on BOGX! ${myCorrect}/${battle.rounds} correct vs ${oppCorrect}/${battle.rounds}. Challenge me! 🎮`;
                  if (navigator.share) {
                    navigator.share({ title: 'BOGX Battle Result', text, url: window.location.origin });
                  } else {
                    navigator.clipboard.writeText(text + ' ' + window.location.origin);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:text-[#E36B11] hover:bg-[#E36B11]/10 rounded-lg transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span className="font-semibold uppercase tracking-wider">Share</span>
              </button>
            ) : (
              <span className="text-sm text-gray-500 font-bold tracking-wider uppercase">
                Round {myResults.length}/{battle.rounds}
              </span>
            )}
          </div>
        )}

        {/* Result Banner with animation */}
        {isComplete && (
          <div 
            className={`flex flex-row flex-nowrap items-center ${isMobile ? 'justify-between' : 'justify-center'} gap-3 sm:gap-4 ${isMobile ? 'py-3 px-3' : 'py-3 sm:py-4 px-4 sm:px-6'} rounded-xl mb-4 ${isMobile ? '' : 'mx-[-8px]'}`}
            style={{ backgroundColor: won ? 'rgba(34, 197, 94, 0.1)' : isDraw ? 'rgba(227, 107, 17, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}
          >
            {/* Topic badge - only on mobile, left side */}
            {isMobile && (
              <span 
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-display rounded-lg uppercase tracking-wider flex-shrink-0"
                style={{ backgroundColor: `${topic.color}15`, color: topic.color, border: `1px solid ${topic.color}30` }}
              >
                <topic.icon className="w-4 h-4" /> {topic.label}
              </span>
            )}
            {/* Center content */}
            <div className="flex items-center gap-2">
              {won && !isForfeit && <Trophy className={`${isMobile ? 'w-8 h-8' : 'w-5 h-5 sm:w-7 sm:h-7'} animate-[popIcon_0.35s_ease-out] flex-shrink-0`} style={{ color: '#166534' }} />}
              {isForfeit && <span className={`${isMobile ? 'text-2xl' : 'text-lg sm:text-2xl'} animate-[popIcon_0.35s_ease-out] flex-shrink-0 leading-none`}>🏳️</span>}
              {isDraw && (
                <span
                  className={`font-display ${isMobile ? 'text-3xl' : 'text-xl sm:text-3xl'} animate-[popIcon_0.35s_ease-out] flex-shrink-0 leading-none`}
                  style={{ color: '#E36B11' }}
                >
                  =
                </span>
              )}
              <span 
                className={`font-display ${isMobile ? 'text-2xl' : 'text-lg sm:text-3xl'} tracking-wider whitespace-nowrap`}
                style={{ color: won ? '#166534' : isDraw ? '#E36B11' : '#dc2626' }}
              >
                {won ? 'YOU WIN!' : isDraw ? 'DRAW' : 'YOU LOSE'}
              </span>
              {/* Reason on the same line - a forfeit is not a 0:0 result */}
              {isForfeit && (
                <span
                  className={`font-display ${isMobile ? 'text-sm' : 'text-xs sm:text-base'} tracking-wide whitespace-nowrap`}
                  style={{ color: won ? '#166534' : '#dc2626', opacity: 0.75 }}
                >
                  {actuallyIForfeited ? '· YOU GAVE UP' : '· OPPONENT GAVE UP'}
                </span>
              )}
            </div>
            {/* BOGX amount - right side on mobile. A draw returns the wager, so
                it's shown as "back" instead of a plain amount that reads like a loss. */}
            <span 
              className={`font-display ${isMobile ? 'text-xl' : 'text-base sm:text-2xl'} tracking-wider flex items-center gap-1.5 whitespace-nowrap flex-shrink-0`}
              style={{ color: won ? '#166534' : isDraw ? '#E36B11' : '#dc2626' }}
            >
              {won ? '+' : isDraw ? '' : '-'}{formatCurrency(toBOGX(battle.wager))}
              <img src="/images/bogxcoin.png" alt="BOGX" className={`${isMobile ? 'w-6 h-6' : 'w-4 h-4 sm:w-5 sm:h-5'}`} />
              {isDraw && <span className={`${isMobile ? 'text-sm' : 'text-xs sm:text-sm'} tracking-wide`}>BACK</span>}
            </span>
          </div>
        )}

        {/* Players Comparison - Vertical on mobile, horizontal on desktop */}
        {isMobile ? (
          <div className="border border-warm rounded-xl bg-cream overflow-hidden mb-3">
            {/* You */}
            <div className="flex items-center justify-between p-2.5 border-b border-warm" style={won ? { backgroundColor: `${topic.color}08` } : {}}>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full overflow-hidden border-2 flex-shrink-0" style={won ? { borderColor: topic.color } : { borderColor: '#E5DDD0' }}>
                  <img src={userAvatar} alt="" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-sm text-gray-900">You</span>
                    {won && <span className="px-1 py-0.5 text-white text-[7px] font-bold rounded" style={{ backgroundColor: topic.color }}>WIN</span>}
                  </div>
                  <div className="font-display text-[10px] text-gray-500">{myCorrect}/{battle.rounds} correct</div>
                </div>
              </div>
              <div className="font-display text-2xl" style={{ color: won ? topic.color : '#9ca3af' }}>{myCorrect}</div>
            </div>
            
            {/* Opponent */}
            {(() => {
              const opponentData = isCreator ? battle.opponent : battle.creator;
              const opponentWon = !won && !isDraw;
              const opponentName = opponentData?.username || 'Opponent';
              const opponentAvatar = opponentData?.avatar;
              
              return (
                <div className="flex items-center justify-between p-2.5" style={opponentWon ? { backgroundColor: `${topic.color}08` } : {}}>
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full overflow-hidden border-2 flex-shrink-0" style={opponentWon ? { borderColor: topic.color } : { borderColor: '#E5DDD0' }}>
                      {opponentAvatar ? (
                        <img src={opponentAvatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xs">
                          {opponentName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-sm text-gray-900 truncate max-w-[120px]">{opponentName}</span>
                        {opponentWon && <span className="px-1 py-0.5 text-white text-[7px] font-bold rounded" style={{ backgroundColor: topic.color }}>WIN</span>}
                      </div>
                      <div className="font-display text-[10px] text-gray-500">{oppCorrect}/{battle.rounds} correct</div>
                    </div>
                  </div>
                  <div className="font-display text-2xl" style={{ color: opponentWon ? topic.color : '#9ca3af' }}>{oppCorrect}</div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="flex items-stretch border border-warm rounded-xl bg-cream overflow-hidden mb-6">
            {/* You */}
            <div className="flex-1 flex items-center justify-between gap-3 p-5 border-r border-warm animate-[slideInLeft_0.4s_0.2s_ease-out_backwards]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-14 rounded-full overflow-hidden border-3 flex-shrink-0 border-warm">
                  <img src={userAvatar} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-gray-900 truncate">You</span>
                    {won && <span className="px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded tracking-wider">WINNER</span>}
                  </div>
                  <div className="font-display text-xl tracking-wide text-gray-600">{myCorrect}/{battle.rounds} CORRECT</div>
                </div>
              </div>
              <div className="font-display text-4xl tracking-wide flex-shrink-0 text-gray-800">{myCorrect}</div>
            </div>

            {/* VS Center */}
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-5">
              <span 
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] uppercase tracking-wider font-bold whitespace-nowrap"
                style={{ backgroundColor: `${topic.color}15`, color: topic.color }}
              >
                <topic.icon className="w-3 h-3" /> {topic.label}
              </span>
              <span className="font-display text-xl text-gray-400">VS</span>
              <div className="flex gap-1 sm:gap-2">
                {Array.from({ length: battle.rounds }).map((_, i) => {
                  const myR = myResults[i];
                  const color = myR ? (myR.correct ? '#10b981' : '#ef4444') : '#e5e7eb';
                  const isClickable = hasQuestions && i < battle.questions!.length;
                  return (
                    <span 
                      key={i}
                      onClick={() => isClickable && (setIsFlipped(true), setTimeout(() => setViewingQuestion(i), 150))}
                      className={`min-w-[24px] h-6 sm:min-w-[36px] sm:h-8 px-1.5 sm:px-2 rounded-md flex items-center justify-center font-display text-[10px] sm:text-xs tracking-wider text-white animate-[chipIn_0.3s_ease-out] ${isClickable ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
                      style={{ background: color }}
                    >
                      R{i + 1}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Opponent */}
            {(() => {
              const opponentData = isCreator ? battle.opponent : battle.creator;
              const hideOpponent = !opponentHasPlayed;
              const opponentName = opponentData?.username || 'Opponent';
              return (
                <div className="flex-1 flex items-center justify-between gap-3 p-5 border-l border-warm animate-[slideInRightBattle_0.4s_0.2s_ease-out_backwards]">
                  <div className="font-display text-4xl text-gray-600 tracking-wide flex-shrink-0">
                    {hideOpponent ? '?' : oppCorrect}
                  </div>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!won && !isDraw && !hideOpponent && <span className="px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded tracking-wider">WINNER</span>}
                        <span className="font-bold text-base text-gray-900 truncate">{hideOpponent ? '???' : opponentName}</span>
                      </div>
                      <div className="font-display text-xl text-gray-500 tracking-wide">
                        {hideOpponent ? '?/?' : `${oppCorrect}/${battle.rounds}`} CORRECT
                      </div>
                    </div>
                    <div className="w-14 h-14 rounded-full overflow-hidden border-3 flex-shrink-0 border-warm">
                      {hideOpponent || !opponentData?.avatar ? (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xl">
                          {hideOpponent ? '?' : opponentName.charAt(0).toUpperCase()}
                        </div>
                      ) : (
                        <img src={opponentData.avatar} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Round by Round - Grid layout. Skipped when nobody answered anything
            (forfeit before the first question): a table of dashes says nothing. */}
        {isComplete && !bothEmpty && (
          <div className={`${isMobile ? 'mb-4' : 'mb-6'} animate-[fadeInUp_0.4s_0.3s_ease-out_backwards]`}>
            <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold tracking-widest text-gray-500 uppercase mb-2`}>
              Round by Round
            </div>
            
            {/* Header Row */}
            <div className={`grid ${isMobile ? 'gap-1' : 'gap-2'} mb-2`} style={{ gridTemplateColumns: isMobile ? `70px repeat(${battle.rounds}, 1fr) 50px` : `100px repeat(${battle.rounds}, 1fr) 70px` }}>
              <div></div>
              {Array.from({ length: battle.rounds }).map((_, i) => (
                <div key={i} className={`text-center font-display ${isMobile ? 'text-[10px]' : 'text-sm'} text-gray-400 tracking-wider`}>R{i + 1}</div>
              ))}
              <div className={`text-center font-display ${isMobile ? 'text-[10px]' : 'text-sm'} text-gray-400 tracking-wider`}>TOT</div>
            </div>

            {/* Your Row */}
            <div className={`grid ${isMobile ? 'gap-1' : 'gap-2'} mb-1 items-center`} style={{ gridTemplateColumns: isMobile ? `70px repeat(${battle.rounds}, 1fr) 50px` : `100px repeat(${battle.rounds}, 1fr) 70px` }}>
              <div className={`font-bold ${isMobile ? 'text-xs' : 'text-base'} text-gray-900`}>You</div>
              {Array.from({ length: battle.rounds }).map((_, i) => {
                const r = myResults[i];
                // An abandoned round is a loss, but for a different reason than a wrong
                // answer - amber rather than red, so "I reloaded and lost that one" is
                // not silently presented as "I answered and got it wrong".
                const bgColor = r
                  ? r.abandoned
                    ? 'rgba(245, 158, 11, 0.18)'
                    : r.correct ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.15)'
                  : '#f3f4f6';
                const isClickable = hasQuestions && i < battle.questions!.length;
                return (
                  <div 
                    key={i} 
                    onClick={() => isClickable && (setIsFlipped(true), setTimeout(() => setViewingQuestion(i), 150))}
                    title={r?.abandoned ? 'Round left open (reload or lost connection) - counted as wrong' : undefined}
                    className={`rounded-lg text-center ${isMobile ? 'py-1.5' : 'py-2'} ${isClickable ? 'cursor-pointer hover:shadow-md hover:scale-105 transition-all' : ''}`}
                    style={{ backgroundColor: bgColor }}
                  >
                    <div className={`font-display ${isMobile ? 'text-xs' : 'text-base'} ${isMobile ? 'text-gray-900' : ''}`} style={isMobile ? {} : { color: r ? (r.abandoned ? '#B45309' : r.correct ? '#10b981' : '#ef4444') : '#9ca3af' }}>
                      {r ? (r.abandoned ? 'OUT' : r.correct ? formatCurrency(r.points) : '—') : '—'}
                    </div>
                    {!isMobile && r?.timeMs && !r.abandoned && <div className="text-[10px] text-gray-400">{formatTime(r.timeMs, opponentResults[i]?.timeMs)}</div>}
                  </div>
                );
              })}
              {/* Total - highlight winner in green */}
              <div 
                className={`text-center font-display ${isMobile ? 'text-sm' : 'text-base'} rounded-lg ${isMobile ? 'py-1.5' : 'py-2'}`}
                style={{ 
                  backgroundColor: won || isDraw ? 'rgba(16, 185, 129, 0.15)' : undefined,
                  color: won || isDraw ? '#10b981' : '#1f2937',
                  fontWeight: won || isDraw ? 700 : 400
                }}
              >
                {formatCurrency(myTotalPoints)}
                {!isMobile && myTotalTime > 0 && <div className="text-[10px] font-sans font-normal normal-case text-gray-400">{formatTime(myTotalTime, oppTotalTime)}</div>}
              </div>
            </div>

            {/* Opponent Row */}
            {(() => {
              // For mobile (completed battles from notifications), always show opponent data
              const opponentData = isCreator ? battle.opponent : battle.creator;
              const hideOpponentResults = !opponentHasPlayed; // Only hide while the opponent still has to play
              return (
                <div className={`grid ${isMobile ? 'gap-1' : 'gap-2'} items-center`} style={{ gridTemplateColumns: isMobile ? `70px repeat(${battle.rounds}, 1fr) 50px` : `100px repeat(${battle.rounds}, 1fr) 70px` }}>
                  <div className={`font-bold ${isMobile ? 'text-xs' : 'text-base'} text-gray-900 truncate`}>{hideOpponentResults ? '???' : (opponentData?.username || 'Opponent')}</div>
                  {Array.from({ length: battle.rounds }).map((_, i) => {
                    if (hideOpponentResults) {
                      return (
                        <div key={i} className={`rounded-lg bg-gray-100 text-center ${isMobile ? 'py-1.5' : 'py-2'}`}>
                          <div className={`font-display ${isMobile ? 'text-xs' : 'text-base'} text-gray-400`}>?</div>
                        </div>
                      );
                    }
                    const r = opponentResults[i];
                    const bgColor = r
                      ? r.abandoned
                        ? 'rgba(245, 158, 11, 0.18)'
                        : r.correct ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.15)'
                      : '#f3f4f6';
                    return (
                      <div
                        key={i}
                        title={r?.abandoned ? 'Round left open (reload or lost connection) - counted as wrong' : undefined}
                        className={`rounded-lg text-center ${isMobile ? 'py-1.5' : 'py-2'} animate-[chipIn_0.3s_ease-out]`}
                        style={{ backgroundColor: bgColor }}
                      >
                        <div className={`font-display ${isMobile ? 'text-xs' : 'text-base'} ${isMobile ? 'text-gray-900' : ''}`} style={isMobile ? {} : { color: r ? (r.abandoned ? '#B45309' : r.correct ? '#10b981' : '#ef4444') : '#9ca3af' }}>
                          {r ? (r.abandoned ? 'OUT' : r.correct ? formatCurrency(r.points) : '—') : '—'}
                        </div>
                        {!isMobile && r?.timeMs && !r.abandoned && <div className="text-[10px] text-gray-400">{formatTime(r.timeMs, myResults[i]?.timeMs)}</div>}
                      </div>
                    );
                  })}
                  {/* Total - highlight winner in green (opponent won if we lost) */}
                  <div 
                    className={`text-center font-display ${isMobile ? 'text-sm' : 'text-base'} rounded-lg ${isMobile ? 'py-1.5' : 'py-2'}`}
                    style={{ 
                      backgroundColor: !won && !isDraw ? 'rgba(16, 185, 129, 0.15)' : undefined,
                      color: !won && !isDraw ? '#10b981' : '#6b7280',
                      fontWeight: !won && !isDraw ? 700 : 400
                    }}
                  >
                    {hideOpponentResults ? '?' : formatCurrency(opponentTotalPoints)}
                    {!isMobile && !hideOpponentResults && oppTotalTime > 0 && <div className="text-[10px] font-sans font-normal normal-case text-gray-400">{formatTime(oppTotalTime, myTotalTime)}</div>}
                  </div>
                </div>
              );
            })()}

            {/* Legend - only when it applies, so a clean game gets no extra noise */}
            {(myResults.some((r: any) => r.abandoned) || (opponentHasPlayed && opponentResults.some((r: any) => r.abandoned))) && (
              <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-500 mt-2 flex items-center gap-1.5`}>
                <span className="px-1.5 py-0.5 rounded font-display" style={{ backgroundColor: 'rgba(245, 158, 11, 0.18)', color: '#B45309' }}>OUT</span>
                Round left open - page reloaded or connection lost. Counted as wrong.
              </p>
            )}
          </div>
        )}

        {/* Outcome explanation. Replaces the old "Questions" button - the rounds in
            the table above are clickable, so a second entry point was redundant. */}
        {isComplete && (
          <div className={`mb-4 px-3 ${isMobile ? 'py-2' : 'py-2.5'} rounded-xl bg-white/60 border border-warm`}>
            <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600 text-center leading-snug`}>
              {outcomeNote}
            </p>
            {hasQuestions && !bothEmpty && (
              <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-400 text-center mt-1`}>
                Tap a round above to see the question
              </p>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Buttons */}
        {isComplete ? (
          <div className={`grid grid-cols-2 ${isMobile ? 'gap-2' : 'gap-3'}`}>
            <button
              onClick={onBackToPool}
              className={`${isMobile ? 'py-3 px-4 text-sm' : 'py-4 px-6 text-base'} bg-cream border-2 border-warm text-gray-600 font-display tracking-widest rounded-xl flex items-center justify-center gap-2 hover:opacity-80 transition-all`}
            >
              <ChevronLeft className={isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
              Back
            </button>
            <button
              onClick={onRematch}
              className={`${isMobile ? 'py-3 px-4 text-sm' : 'py-4 px-6 text-base'} bg-[#E36B11] text-white font-display tracking-widest rounded-xl flex items-center justify-center gap-2 hover:bg-[#C4772A] transition-all`}
            >
              Rematch
              <Swords className={isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            </button>
          </div>
        ) : (
          <button
            onClick={onContinue}
            className={`w-full ${isMobile ? 'py-3 text-base' : 'py-4 text-lg'} bg-[#E36B11] text-white font-display tracking-widest rounded-xl flex items-center justify-center gap-2 hover:bg-[#C4772A] transition-all`}
          >
            LET'S GO
            <ArrowRight className={isMobile ? 'w-4 h-4' : 'w-5 h-5'} />
          </button>
        )}
      </div>
    </div>
  );
}
