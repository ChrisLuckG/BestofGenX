"use client";

import { useState, useEffect, useRef } from "react";
import { Check, X, HelpCircle, Clock, Trophy, Dumbbell, Music, Film, Landmark, Gamepad2, Tv, Timer, Play } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import GenXLoader from "@/components/GenXLoader";
import BackButton from "@/components/BackButton";
import { formatCurrency } from "@/utils/currency";

interface SoloTriviaGameProps {
  onBack: () => void;
  onCoinsChange?: (amount: number) => void;
  onCoinAnimation?: (amount: number) => void;
  embedded?: boolean;
}

interface Question {
  question: string;
  options: string[];
  correctIndex: number;
  category: string;
  cardId?: string; // For tracking played questions
}

type GamePhase = 'setup' | 'countdown' | 'playing' | 'result';

// Icon mapping for categories
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'all': HelpCircle,
  'music': Music,
  'MUSIC': Music,
  'film': Film,
  'FILM': Film,
  'movies': Film,
  'sport': Dumbbell,
  'SPORT': Dumbbell,
  'sports': Dumbbell,
  'history': Landmark,
  'HISTORY': Landmark,
  'science': Gamepad2,
  'SCIENCE': Gamepad2,
  'tv': Tv,
  'TV': Tv,
};

// Default categories (shown if DB is empty)
const DEFAULT_CATEGORIES = ['all', 'music', 'film', 'sport'];

const MAX_POINTS = 0.30; // Start at 0.30 BOGX, decreases over time
const WRONG_PENALTY = 0.01; // -0.01 BOGX for wrong answer

export default function SoloTriviaGame({ onBack, onCoinsChange, onCoinAnimation, embedded = false }: SoloTriviaGameProps) {
  const { user, isLoggedIn } = useAuth();
  const [phase, setPhase] = useState<GamePhase>('setup');
  const [questionCount, setQuestionCount] = useState<10 | 20>(10);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [answerHistory, setAnswerHistory] = useState<('correct' | 'wrong')[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(10000); // 10 seconds in ms
  const [currentPoints, setCurrentPoints] = useState(MAX_POINTS);
  const [totalEarnings, setTotalEarnings] = useState(0);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const questionsRef = useRef<Question[]>([]);

  // Run countdown before showing answers
  const runCountdown = () => {
    setCountdown(3);
    setPhase('countdown');
    
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          setTimeout(() => {
            setPhase('playing');
            startRound();
          }, 300);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Start round timer
  const startRound = () => {
    // Safety check - use ref to get current questions
    const qs = questionsRef.current;
    if (!qs || qs.length === 0) {
      setPhase('result');
      return;
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setTimeLeft(10000);
    setCurrentPoints(MAX_POINTS);
    setSelectedAnswer(null);
    setShowResult(false);
    startTimeRef.current = Date.now();
    
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(10000 - elapsed, 0);
      setTimeLeft(remaining);
      
      const pct = remaining / 10000;
      setCurrentPoints(Math.round(MAX_POINTS * pct * 100) / 100);
      
      if (remaining <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        handleTimeout();
      }
    }, 50);
  };

  const handleTimeout = async () => {
    // Stop all timers immediately
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    
    setSelectedAnswer(-1);
    setShowResult(true);
    setWrongCount(prev => prev + 1);
    setTotalEarnings(prev => prev - WRONG_PENALTY);
    setAnswerHistory(prev => [...prev, 'wrong']);
    
    // Trigger coin animation for timeout penalty
    onCoinAnimation?.(-WRONG_PENALTY);
    
    // Deduct penalty from DB and track played question
    const currentQ = questions[currentIndex];
    if (isLoggedIn && user?.id) {
      try {
        await fetch('/api/user/update-bogx', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, amount: -WRONG_PENALTY }),
        });
        onCoinsChange?.(-WRONG_PENALTY);
        
        // Track played question so it won't repeat soon
        if (currentQ?.cardId) {
          await fetch('/api/questions/smart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              cardId: currentQ.cardId,
              questionText: currentQ.question,
              correct: false,
              context: 'game',
            }),
          });
        }
      } catch (e) {
        console.error('Failed to update coins:', e);
      }
    }
    
    setTimeout(() => {
      // Use ref to avoid closure issues - questionsRef always has current value
      const qs = questionsRef.current;
      if (!qs || qs.length === 0) {
        setPhase('result');
        return;
      }
      
      setCurrentIndex(prev => {
        if (prev + 1 >= qs.length) {
          setPhase('result');
          return prev;
        }
        runCountdown();
        return prev + 1;
      });
    }, 1500);
  };

  // Load categories from DB
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await fetch('/api/trivia/categories');
        const data = await res.json();
        if (data.success && data.themes) {
          // Normalize themes to lowercase and add 'all'
          const dbCategories = data.themes.map((t: string) => t.toLowerCase());
          const uniqueCategories = ['all', ...Array.from(new Set(dbCategories))] as string[];
          setCategories(uniqueCategories);
          setCategoryCounts(data.counts || {});
        }
      } catch (e) {
        console.error('Failed to load categories:', e);
      }
    };
    loadCategories();
  }, []);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  const startGame = async () => {
    setLoading(true);
    setError(null);
    setAnswerHistory([]);
    try {
      // Use smart questions API that avoids recently played questions
      const params = new URLSearchParams({
        userId: user?.id || 'guest',
        count: String(questionCount),
        context: 'game',
      });
      if (selectedCategory !== 'all') {
        params.set('theme', selectedCategory.toUpperCase());
      }
      
      const res = await fetch(`/api/questions/smart?${params.toString()}`);
      const data = await res.json();
      if (data.success && data.questions && data.questions.length > 0) {
        // Transform smart questions to trivia format
        const transformedQuestions = data.questions.map((card: any) => {
          const variant = card.questions?.[0];
          if (!variant) return null;
          
          const options = variant.options.map((o: any) => String(o));
          let correctIndex = options.findIndex((o: string) => o === String(variant.correctAnswer));
          if (correctIndex === -1) correctIndex = 0;
          
          return {
            question: variant.question,
            options,
            correctIndex,
            category: card.theme || 'General',
            cardId: card._id?.toString(),
          };
        }).filter(Boolean);
        
        if (transformedQuestions.length === 0) {
          setLoading(false);
          setError('No valid questions found. Please try again.');
          return;
        }
        
        setQuestions(transformedQuestions);
        questionsRef.current = transformedQuestions; // Keep ref in sync
        setCurrentIndex(0);
        setCorrectCount(0);
        setWrongCount(0);
        setTotalEarnings(0);
        setLoading(false);
        runCountdown();
      } else {
        setLoading(false);
        const categoryName = selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1);
        setError(`No questions available for "${categoryName}". Try "All" or another category.`);
      }
    } catch (e) {
      console.error('Failed to generate trivia:', e);
      setLoading(false);
      setError('Failed to load questions. Please try again.');
    }
  };

  const handleAnswer = async (answerIndex: number) => {
    if (showResult) return;
    
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setSelectedAnswer(answerIndex);
    setShowResult(true);

    const currentQ = questions[currentIndex];
    const isCorrect = answerIndex === currentQ.correctIndex;
    const points = isCorrect ? currentPoints : -WRONG_PENALTY;
    
    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
      setTotalEarnings(prev => prev + points);
      setAnswerHistory(prev => [...prev, 'correct']);
    } else {
      setWrongCount(prev => prev + 1);
      setTotalEarnings(prev => prev - WRONG_PENALTY);
      setAnswerHistory(prev => [...prev, 'wrong']);
    }

    // Trigger coin animation
    onCoinAnimation?.(points);

    // Save to DB if logged in
    if (isLoggedIn && user?.id) {
      try {
        // Update coins
        await fetch('/api/user/update-bogx', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, amount: points }),
        });
        onCoinsChange?.(points);
        
        // Track played question so it won't repeat soon
        if (currentQ.cardId) {
          await fetch('/api/questions/smart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              cardId: currentQ.cardId,
              questionText: currentQ.question,
              correct: isCorrect,
              context: 'game',
            }),
          });
        }
      } catch (e) {
        console.error('Failed to update coins:', e);
      }
    }

    // Move to next question after delay - use ref to avoid closure issues
    setTimeout(() => {
      const qs = questionsRef.current;
      setCurrentIndex(prev => {
        if (prev + 1 >= qs.length) {
          setPhase('result');
          return prev;
        }
        runCountdown();
        return prev + 1;
      });
    }, 1500);
  };

  const currentQuestion = questions[currentIndex];

  // Unified Header Component - same on all phases
  const GameHeader = ({ showBack = true }: { showBack?: boolean }) => (
    <div className="px-3 pt-4 pb-3 border-b border-warm">
      <div className="flex items-center gap-2">
        {showBack && <BackButton onClick={onBack} className="-ml-1" />}
        <div>
          <span className="font-display text-lg tracking-wider text-gray-900">Solo Trivia</span>
          <p className="text-[10px] text-gray-500 -mt-0.5">Answer fast, earn coins.</p>
        </div>
      </div>
    </div>
  );

  // Result Phase - check FIRST before playing phase
  if (phase === 'result') {
    const accuracy = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    
    return (
      <div className="flex flex-col h-full min-h-full" style={{ backgroundColor: '#F5F0E8' }}>
        <GameHeader />
        
        {/* Card Container */}
        <div className="flex-1 p-4 flex flex-col">
          <div className="flex-1 border border-warm bg-cream rounded-xl flex flex-col p-6 shadow-sm">
          
            {/* Center Content */}
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              {/* Result Badge */}
              <div className="mb-4">
                <span className="px-4 py-1.5 bg-[#D4873A]/10 border border-[#D4873A]/30 rounded text-xs text-[#D4873A] uppercase tracking-widest font-bold">
                  Result
                </span>
              </div>
              
              {/* Title */}
              <h2 className="font-display text-4xl tracking-wider text-gray-900 mb-3">
                {accuracy >= 80 ? 'EXCELLENT!' : accuracy >= 50 ? 'GOOD JOB!' : 'KEEP TRYING!'}
              </h2>
              <p className="text-gray-500 text-sm mb-8 uppercase tracking-wider">
                {correctCount} / {questions.length || questionCount} correct · {accuracy}% accuracy
              </p>
              
              {/* Earnings Display - Big Coin */}
              <div className={`py-5 px-10 rounded-xl mb-8 flex items-center gap-4 ${
                totalEarnings >= 0 ? 'bg-[#D4873A]/10 border border-[#D4873A]/20' : 'bg-red-50 border border-red-200'
              }`}>
                <img src="/images/bogxcoin.png" alt="" className="w-14 h-14" />
                <div className="text-left">
                  <span className={`font-display text-4xl block ${
                    totalEarnings >= 0 ? 'text-[#D4873A]' : 'text-red-500'
                  }`}>
                    {totalEarnings > 0 ? '+' : ''}{formatCurrency(totalEarnings)}
                  </span>
                  <p className="text-gray-500 text-xs uppercase tracking-wider">Coins earned</p>
                </div>
              </div>
              
              {/* Stats Row - Simple */}
              <div className="flex gap-8 mb-4">
                <div className="text-center">
                  <span className="font-display text-3xl text-green-600 block">{correctCount}</span>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Correct</p>
                </div>
                <div className="text-center">
                  <span className="font-display text-3xl text-red-500 block">{wrongCount}</span>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Wrong</p>
                </div>
              </div>
            </div>

            {/* Buttons at bottom */}
            <div className="flex gap-3">
              <button
                onClick={onBack}
                className="flex-1 py-3 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg transition-all uppercase tracking-wider text-sm"
              >
                Back
              </button>
              <button
                onClick={() => {
                  setPhase('setup');
                  setQuestions([]);
                  setCorrectCount(0);
                  setWrongCount(0);
                  setTotalEarnings(0);
                  setAnswerHistory([]);
                }}
                className="flex-1 py-3 bg-[#D4873A] hover:bg-[#C4772A] text-white font-semibold rounded-lg transition-colors uppercase tracking-wider text-sm"
              >
                Play Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Countdown Phase - show question, hide answers
  if (phase === 'countdown' && currentQuestion) {
    
    return (
      <div className="flex flex-col h-full min-h-full" style={{ backgroundColor: '#F5F0E8' }}>
        <GameHeader showBack={false} />
        
        {/* Card Container */}
        <div className="flex-1 p-4 flex flex-col">
          <div className="flex-1 border border-warm bg-cream rounded-xl flex flex-col p-5 shadow-sm">
          
            {/* Progress Bar */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-gray-900">Question {currentIndex + 1}/{questions.length}</span>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: questions.length }).map((_, i) => {
                  let color = 'bg-gray-300';
                  if (i < answerHistory.length) {
                    color = answerHistory[i] === 'correct' ? 'bg-green-500' : 'bg-red-500';
                  } else if (i === currentIndex) {
                    color = 'bg-[#D4873A]/50';
                  }
                  return <div key={i} className={`w-3 h-1 rounded ${color}`} />;
                })}
              </div>
              <div className="flex items-center gap-1">
                <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                <span className="font-display text-sm text-[#D4873A]">{formatCurrency(totalEarnings)}</span>
              </div>
            </div>

            {/* Category Badge */}
            <div className="mb-3">
              <span className="px-2 py-0.5 bg-cream border border-warm rounded text-[10px] text-gray-600 uppercase tracking-wider">
                {currentQuestion.category || 'General'}
              </span>
            </div>

            {/* Countdown Timer */}
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-1">
                <div className="w-11 h-11 border-2 border-[#D4873A] bg-[#D4873A]/10 rounded-lg flex items-center justify-center">
                  <span className="font-display text-2xl text-gray-900">
                    {countdown === 0 ? 'GO' : countdown}
                  </span>
                </div>
                <span className="text-gray-600 text-[10px]">SEC</span>
              </div>
              <div className="flex-1 px-1">
                <div className="flex gap-0.5">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="h-4 flex-1 rounded bg-gray-200" />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-display text-2xl text-gray-900">{formatCurrency(MAX_POINTS)}</span>
                <img src="/images/bogxcoin.png" alt="BOGX" className="w-5 h-5" />
              </div>
            </div>

            {/* Question */}
            <div className="border border-warm bg-cream rounded-xl px-4 py-4 mb-4 flex items-center justify-center min-h-[100px]">
              <h2 className="text-gray-900 text-base font-bold text-center leading-snug">
                {currentQuestion.question}
              </h2>
            </div>

            {/* Hidden Answers */}
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="px-2 py-3 min-h-[64px] bg-cream border border-warm rounded-lg flex items-center justify-center">
                  <span className="text-gray-300 text-sm">···</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Setup Phase
  if (phase === 'setup') {
    return (
      <div className="w-full h-full min-h-full flex-1 flex flex-col relative" style={{ backgroundColor: '#F5F0E8' }}>
        <GameHeader />

        {/* Loading Modal */}
        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-cream rounded-2xl p-8 mx-4 shadow-2xl border border-warm max-w-sm w-full">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-[#D4873A]/10 flex items-center justify-center mb-4">
                  <div className="w-10 h-10 border-3 border-[#D4873A]/30 border-t-[#D4873A] rounded-full animate-spin" />
                </div>
                <h3 className="font-display text-xl tracking-wider text-gray-900 mb-2">Preparing Questions</h3>
                <p className="text-gray-500 text-sm text-center">
                  Loading {questionCount} trivia questions{selectedCategory !== 'all' ? ` about ${selectedCategory}` : ''}...
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#D4873A] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#D4873A] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#D4873A] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {/* Hero Banner - using solo.png background */}
          <div 
            className={`relative overflow-hidden mb-4 bg-cover bg-center cursor-pointer ${embedded ? 'min-h-[280px]' : ''}`}
            style={{ backgroundImage: "url('/images/Hintergund/solo.png')" }}
            onClick={() => { if (!loading) startGame(); }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
            <div className={`relative px-4 ${embedded ? 'py-8' : 'py-4'}`}>
              <span className={`inline-block px-3 py-1 bg-[#D4873A] text-white font-bold uppercase tracking-wider rounded-full mb-2 ${embedded ? 'text-xs' : 'text-[10px]'}`}>
                Solo Trivia
              </span>
              <h2 className={`font-display text-white leading-tight mb-1 ${embedded ? 'text-3xl' : 'text-2xl'}`}>
                WIN BOGX COINS<br/>
                IN <span className="text-[#D4873A]">60</span> SECONDS
              </h2>
              <div className={`flex items-center gap-4 mt-2 text-white/80 ${embedded ? 'text-xs' : 'text-[11px]'}`}>
                <span className="flex items-center gap-1"><span className="text-[#D4873A]">⚡</span> Answer fast</span>
                <span className="flex items-center gap-1"><img src="/images/bogxcoin.png" alt="" className="w-3.5 h-3.5" /> Earn coins</span>
                <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5 text-[#D4873A]" /> Climb ranks</span>
              </div>
            </div>
          </div>

          <div className="px-4">
            {/* Step 1: Choose Questions */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 bg-[#D4873A] rounded-full text-white text-[10px] font-bold flex items-center justify-center">1</span>
                <span className="text-sm font-bold tracking-wider text-gray-800 uppercase">Choose Questions</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {/* 10 Questions Card */}
                <button
                  onClick={() => setQuestionCount(10)}
                  className={`relative py-2.5 text-center rounded-xl transition-all ${
                    questionCount === 10
                      ? 'bg-[#D4873A]/10 border-2 border-[#D4873A]'
                      : 'bg-[#D4873A]/5 border-2 border-transparent'
                  }`}
                >
                  {questionCount === 10 && (
                    <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-[#D4873A] rounded-full flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                  <div className="font-display text-3xl leading-none text-[#D4873A]">10</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-600">Questions</div>
                </button>
                {/* 20 Questions Card */}
                <button
                  onClick={() => setQuestionCount(20)}
                  className={`relative py-2.5 text-center rounded-xl transition-all ${
                    questionCount === 20
                      ? 'bg-[#D4873A]/10 border-2 border-[#D4873A]'
                      : 'bg-[#D4873A]/5 border-2 border-transparent'
                  }`}
                >
                  {questionCount === 20 && (
                    <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-[#D4873A] rounded-full flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                  <div className="font-display text-3xl leading-none text-gray-800">20</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-600">Questions</div>
                </button>
              </div>
            </div>

            {/* Step 2: Choose Category - Horizontal scroll like screenshot */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 bg-[#D4873A] rounded-full text-white text-[10px] font-bold flex items-center justify-center">2</span>
                <span className="text-sm font-bold tracking-wider text-gray-800 uppercase">Choose Category</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
                {categories.map((cat: string) => {
                  const Icon = CATEGORY_ICONS[cat] || CATEGORY_ICONS[cat.toUpperCase()] || HelpCircle;
                  const displayName = cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1);
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`flex-shrink-0 py-1.5 px-2.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-1 whitespace-nowrap ${
                        selectedCategory === cat
                          ? 'bg-[#D4873A] text-white'
                          : 'bg-[#D4873A]/5 text-gray-700'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" /> {displayName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Start Game */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 bg-[#D4873A] rounded-full text-white text-[10px] font-bold flex items-center justify-center">3</span>
                <span className="text-sm font-bold tracking-wider text-gray-800 uppercase">Start Game</span>
              </div>
              
              {/* Start banner with coins - fully clickable */}
              <button
                onClick={startGame}
                disabled={loading}
                className="w-full bg-[#D4873A]/10 border border-[#D4873A]/20 rounded-xl p-3 flex items-center gap-3 relative overflow-hidden disabled:opacity-50 hover:bg-[#D4873A]/15 transition-colors cursor-pointer"
              >
                <img src="/images/bogxcoin.png" alt="" className="w-8 h-8 relative z-10" />
                <div className="flex-1 relative z-10 text-left">
                  <p className="text-gray-700 text-sm font-medium">
                    Answer fast! Win up to <span className="text-[#D4873A] font-bold">{formatCurrency(questionCount * MAX_POINTS)} BOGX</span>
                  </p>
                </div>
                <div className="w-9 h-9 bg-[#D4873A] rounded-full flex items-center justify-center shadow-lg relative z-10">
                  <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                </div>
              </button>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // Playing Phase - QuizzBattle style
  if (phase === 'playing' && currentQuestion) {
    const timeSeconds = Math.ceil(timeLeft / 1000);
    const timePct = timeLeft / 10000;
    const filledSegments = Math.round(timePct * 10);
    const timerColor = timePct > 0.5 ? '#D4873A' : timePct > 0.25 ? '#E05A00' : '#DC2626';
    
    return (
      <div className="flex flex-col h-full min-h-full" style={{ backgroundColor: '#F5F0E8' }}>
        <GameHeader showBack={false} />
        
        {/* Card Container */}
        <div className="flex-1 p-4 flex flex-col">
          <div className="flex-1 border border-warm bg-cream rounded-xl flex flex-col p-5 shadow-sm">
          
            {/* Progress Bar */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-gray-900">Question {currentIndex + 1}/{questions.length}</span>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: questions.length }).map((_, i) => {
                  let color = 'bg-gray-300';
                  if (i < answerHistory.length) {
                    // Already answered - show green for correct, red for wrong
                    color = answerHistory[i] === 'correct' ? 'bg-green-500' : 'bg-red-500';
                  } else if (i === currentIndex) {
                    color = 'bg-[#D4873A]/50';
                  }
                  return <div key={i} className={`w-3 h-1 rounded ${color}`} />;
                })}
              </div>
              <div className="flex items-center gap-1">
                <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                <span className="font-display text-sm text-[#D4873A]">{formatCurrency(totalEarnings)}</span>
              </div>
            </div>

          {/* Category Badge */}
          <div className="mb-3">
            <span className="px-2 py-0.5 bg-cream border border-warm rounded text-[10px] text-gray-600 uppercase tracking-wider">
              {currentQuestion.category}
            </span>
          </div>

          {/* Timer Row with LED segments */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-1">
              <div 
                className="w-11 h-11 border-2 rounded-lg flex items-center justify-center transition-colors duration-300"
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
              {currentQuestion.question}
            </h2>
          </div>

          {/* Answers - 2x2 grid like QuizzBattle */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {currentQuestion.options.map((option, i) => {
              let className = 'px-2 py-3 min-h-[64px] text-sm font-bold flex items-center justify-center text-center transition-all rounded-lg';
              
              if (showResult) {
                if (i === currentQuestion.correctIndex) {
                  className += ' bg-[#D4873A] text-white border-2 border-[#D4873A]';
                } else if (i === selectedAnswer) {
                  className += ' bg-red-500 text-white border-2 border-red-500';
                } else {
                  className += ' bg-cream border border-warm text-gray-600';
                }
              } else {
                className += ' bg-cream text-gray-900 border border-warm hover:border-gray-300 cursor-pointer';
              }
              
              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={showResult}
                  className={className}
                >
                  <span className="line-clamp-2">{option}</span>
                </button>
              );
            })}
          </div>

          {/* Result Banner - AFTER answers so layout stays stable */}
          <div className="min-h-[44px] flex items-stretch mt-auto">
            {showResult && (
              <div className={`w-full py-2 px-4 rounded-lg flex items-center justify-center gap-2 ${
                selectedAnswer === -1 
                  ? 'bg-red-500' 
                  : selectedAnswer === currentQuestion.correctIndex 
                    ? 'bg-[#D4873A]' 
                    : 'bg-red-500'
              }`}>
                {selectedAnswer === -1 ? (
                  <>
                    <Clock className="w-5 h-5 text-white" />
                    <span className="font-display text-lg tracking-wider text-white">TIME'S UP!</span>
                  </>
                ) : selectedAnswer === currentQuestion.correctIndex ? (
                  <>
                    <Check className="w-5 h-5 text-white" />
                    <span className="font-display text-lg tracking-wider text-white">CORRECT! +{formatCurrency(currentPoints)}</span>
                    <img src="/images/bogxcoin.png" alt="BOGX" className="w-5 h-5" />
                  </>
                ) : (
                  <>
                    <X className="w-5 h-5 text-white" />
                    <span className="font-display text-lg tracking-wider text-white">WRONG!</span>
                  </>
                )}
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback - this should never happen, but if it does, stop timers and show error
  // This catches the case where phase is 'playing' but currentQuestion is undefined
  if (timerRef.current) {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }
  if (countdownRef.current) {
    clearInterval(countdownRef.current);
    countdownRef.current = null;
  }
  
  return (
    <div className="w-full h-full min-h-full flex flex-col items-center justify-center bg-cream">
      <div className="text-center px-6">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <X className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="font-display text-xl text-gray-900 mb-2">Something went wrong</h3>
        <p className="text-gray-500 text-sm mb-4">The game encountered an error. Please try again.</p>
        <button
          onClick={onBack}
          className="px-6 py-2 bg-[#D4873A] text-white font-bold rounded-lg"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
