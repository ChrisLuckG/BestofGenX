"use client";

import { useState, useEffect } from "react";
import { ChevronRight, CheckCircle, BookOpen } from "lucide-react";

interface QuizAnswer {
  id: string;
  text: string;
  emoji?: string;
  resultType: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  image?: string;
  answers: QuizAnswer[];
}

interface ResultType {
  id: string;
  label: string;
  emoji?: string;
  description?: string;
  votes: number;
}

interface QuizPoll {
  _id: string;
  title: string;
  subtitle?: string;
  image?: string;
  questions: QuizQuestion[];
  resultTypes: ResultType[];
  totalVotes: number;
  status: 'active' | 'closed' | 'draft';
  linkedArticleId?: string;
}

export interface QuizPollProps {
  poll: QuizPoll;
  userId?: string;
  visitorId?: string;
  onComplete?: (resultType: string) => void;
  onOpenArticle?: (articleId: string) => void;
}

export default function QuizPollCard({ poll, userId, visitorId, onComplete, onOpenArticle }: QuizPollProps) {
  const [isStarted, setIsStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { answerId: string; resultType: string }>>({}); // questionId -> { answerId, resultType }
  const [isComplete, setIsComplete] = useState(false);
  const [result, setResult] = useState<ResultType | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Check if user already completed this quiz
  useEffect(() => {
    const checkVote = async () => {
      if (!userId && !visitorId) return;
      
      try {
        const params = new URLSearchParams();
        if (userId) params.set('userId', userId);
        if (visitorId) params.set('visitorId', visitorId);
        
        const res = await fetch(`/api/polls/${poll._id}/vote?${params}`);
        const data = await res.json();
        
        if (data.success && data.hasVoted) {
          setHasVoted(true);
          setShowResults(true);
        }
      } catch (e) {
        console.error('Failed to check vote status:', e);
      }
    };
    
    checkVote();
  }, [poll._id, userId, visitorId]);

  const handleAnswer = (questionId: string, answerId: string, resultType: string) => {
    // Use combination of questionId + answerId to ensure uniqueness
    const uniqueAnswerId = `${questionId}_${answerId}`;
    const newAnswers = { ...answers, [questionId]: { answerId: uniqueAnswerId, resultType } };
    setAnswers(newAnswers);
    
    // Move to next question or calculate result
    if (currentQuestion < poll.questions.length - 1) {
      setTimeout(() => setCurrentQuestion(currentQuestion + 1), 300);
    } else {
      // Calculate result
      calculateResult(newAnswers);
    }
  };

  const calculateResult = async (allAnswers: Record<string, { answerId: string; resultType: string }>) => {
    // Count which resultType was selected most
    const counts: Record<string, number> = {};
    Object.values(allAnswers).forEach(({ resultType }) => {
      counts[resultType] = (counts[resultType] || 0) + 1;
    });
    
    // Find the winner
    let maxCount = 0;
    let winningType = '';
    Object.entries(counts).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count;
        winningType = type;
      }
    });
    
    const winningResult = poll.resultTypes.find(r => r.id === winningType);
    setResult(winningResult || null);
    setIsComplete(true);
    
    // Submit vote
    try {
      await fetch(`/api/polls/${poll._id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionId: winningType, // Use resultType as optionId
          userId,
          visitorId,
        }),
      });
      
      setHasVoted(true);
      onComplete?.(winningType);
    } catch (e) {
      console.error('Failed to submit quiz result:', e);
    }
    
    // Show results after a moment
    setTimeout(() => setShowResults(true), 1500);
  };

  // Calculate percentages for results display
  const getPercentage = (resultType: ResultType) => {
    if (poll.totalVotes === 0) return 0;
    return Math.round((resultType.votes / poll.totalVotes) * 100);
  };

  const question = poll.questions[currentQuestion];
  const progress = ((currentQuestion + (isComplete ? 1 : 0)) / poll.questions.length) * 100;

  // Compact preview - before starting
  if (!isStarted && !hasVoted) {
    return (
      <div className="bg-cream border border-warm rounded-xl overflow-hidden" style={{ fontFamily: 'var(--font-sans-lv), "DM Sans", system-ui, sans-serif' }}>
        <div className="flex items-center gap-3 p-4">
          {poll.image && (
            <img src={poll.image} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0 overflow-hidden">
            <span className="text-xs font-bold text-[#D4873A] uppercase tracking-wider">SELF-TEST</span>
            <h3 className="font-display text-lg text-gray-900 leading-tight line-clamp-2 uppercase">{poll.title}</h3>
            {poll.subtitle && <p className="text-sm text-gray-700 line-clamp-1">{poll.subtitle}</p>}
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-gray-600">{poll.questions.length} questions · {poll.totalVotes} participants</p>
              {poll.linkedArticleId && onOpenArticle && (
                <>
                  <span className="text-gray-300">·</span>
                  <button
                    onClick={() => onOpenArticle(String(poll.linkedArticleId))}
                    className="text-xs text-[#D4873A] hover:underline flex items-center gap-1"
                  >
                    <BookOpen className="w-3 h-3" />
                    Read story
                  </button>
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => setIsStarted(true)}
            className="px-3 py-1.5 bg-[#D4873A] text-white text-sm font-bold rounded-lg hover:bg-[#a8c400] transition-colors flex-shrink-0"
          >
            Start
          </button>
        </div>
      </div>
    );
  }

  // Show results view
  if (showResults) {
    return (
      <div className="bg-cream border border-warm rounded-xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-warm">
          <span className="text-[10px] font-bold text-[#D4873A] uppercase tracking-wider">SELF-TEST</span>
          <h3 className="font-bold text-gray-900">{poll.title}</h3>
        </div>

        {/* Results */}
        <div className="p-4">
          {result && (
            <div className="text-center mb-4 p-4 bg-[#D4873A]/10 rounded-xl">
              <span className="text-4xl mb-2 block">{result.emoji}</span>
              <div className="font-bold text-lg text-gray-900">You are: {result.label}</div>
              {result.description && (
                <p className="text-sm text-gray-500 mt-1">{result.description}</p>
              )}
            </div>
          )}

          {/* All results with percentages */}
          <div className="space-y-2">
            {poll.resultTypes.map((rt) => {
              const percentage = getPercentage(rt);
              const isWinner = result?.id === rt.id;
              
              return (
                <div
                  key={rt.id}
                  className={`relative overflow-hidden rounded-lg border p-3 ${
                    isWinner ? 'border-[#D4873A] bg-[#D4873A]/5' : 'border-warm'
                  }`}
                >
                  {/* Progress bar */}
                  <div 
                    className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                      isWinner ? 'bg-[#D4873A]/20' : 'bg-cream'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                  
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {rt.emoji && <span className="text-xl">{rt.emoji}</span>}
                      <span className={`font-medium ${isWinner ? 'text-gray-900' : 'text-gray-600'}`}>
                        {rt.label}
                      </span>
                      {isWinner && <CheckCircle className="w-4 h-4 text-[#D4873A]" />}
                    </div>
                    <span className={`text-sm font-bold ${isWinner ? 'text-[#D4873A]' : 'text-gray-600'}`}>
                      {percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-600">
            <span>{poll.totalVotes} people took this test</span>
            {poll.linkedArticleId && onOpenArticle && (
              <>
                <span className="text-gray-300">·</span>
                <button
                  onClick={() => onOpenArticle(String(poll.linkedArticleId))}
                  className="text-[#D4873A] hover:underline flex items-center gap-1"
                >
                  <BookOpen className="w-3 h-3" />
                  Read story
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Quiz in progress
  return (
    <div className="bg-cream border border-warm rounded-xl overflow-hidden">
      {/* Header - always visible, compact after first question */}
      {currentQuestion === 0 && poll.image ? (
        <div className="relative h-32 overflow-hidden">
          <img src={poll.image} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3">
            <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider">SELF-TEST</span>
            <h3 className="font-display text-xl text-white leading-tight uppercase">{poll.title}</h3>
            {poll.subtitle && <p className="text-sm text-white/80">{poll.subtitle}</p>}
          </div>
        </div>
      ) : (
        <div className="px-4 pt-3 pb-2 border-b border-warm">
          <span className="text-xs font-bold text-[#D4873A] uppercase tracking-wider">SELF-TEST</span>
          <h3 className="font-bold text-gray-900 text-xl leading-tight">{poll.title}</h3>
        </div>
      )}

      {/* Progress bar */}
      <div className="h-1 bg-cream">
        <div 
          className="h-full bg-[#D4873A] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-600">
            Question {currentQuestion + 1} of {poll.questions.length}
          </span>
        </div>

        {question.image && (
          <div className="mb-3 rounded-lg overflow-hidden">
            <img src={question.image} alt="" className="w-full h-32 object-cover" />
          </div>
        )}

        <h4 className="font-bold text-gray-900 mb-4">{question.question}</h4>

        {/* Answers */}
        <div className="space-y-2">
          {question.answers.map((answer, answerIndex) => {
            // Use currentQuestion index + answer index for truly unique identification
            const questionKey = `q${currentQuestion}`;
            const answerKey = `q${currentQuestion}_a${answerIndex}`;
            const currentAnswer = answers[questionKey];
            const isSelected = currentAnswer?.answerId === answerKey;
            const isAnswered = !!currentAnswer;
            
            return (
              <button
                key={answerKey}
                onClick={() => {
                  if (isAnswered) return;
                  const newAnswers = { ...answers, [questionKey]: { answerId: answerKey, resultType: answer.resultType } };
                  setAnswers(newAnswers);
                  
                  if (currentQuestion < poll.questions.length - 1) {
                    setTimeout(() => setCurrentQuestion(currentQuestion + 1), 300);
                  } else {
                    calculateResult(newAnswers);
                  }
                }}
                disabled={isAnswered}
                className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                  isSelected
                    ? 'border-[#D4873A] bg-[#D4873A]/10'
                    : 'border-warm hover:border-[#D4873A] hover:bg-[#D4873A]/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  {answer.emoji && <span className="text-xl">{answer.emoji}</span>}
                  <span className="text-gray-700">{answer.text}</span>
                </div>
                {isSelected ? (
                  <CheckCircle className="w-5 h-5 text-[#D4873A]" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-300" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Calculating result overlay */}
      {isComplete && !showResults && (
        <div className="absolute inset-0 bg-cream/90 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#D4873A] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-600 font-medium">Calculating your result...</p>
          </div>
        </div>
      )}
    </div>
  );
}
