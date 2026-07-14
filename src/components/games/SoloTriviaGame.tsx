"use client";

import { useState, useEffect, useRef } from "react";
import { Check, X, HelpCircle, Clock, Trophy, Dumbbell, Music, Film, Landmark, Gamepad2, Tv, Timer, Play, ChevronLeft } from "lucide-react";
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
const WRONG_PENALTY = 0.03; // -0.03 BOGX for wrong answer (10% of max)

export default function SoloTriviaGame({ onBack, onCoinsChange, onCoinAnimation, embedded = false }: SoloTriviaGameProps) {
  const { user, isLoggedIn } = useAuth();
  const [phase, setPhase] = useState<GamePhase>('setup');
  const [questionCount, setQuestionCount] = useState<5 | 10 | 15 | 20>(10);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [categoriesLoading, setCategoriesLoading] = useState(true);
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
  
  // Online players count
  const [onlinePlayers, setOnlinePlayers] = useState(0);
  const [onlineLoading, setOnlineLoading] = useState(true);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const questionsRef = useRef<Question[]>([]);
  
  // Fetch online players count (heartbeat is now global in AuthContext)
  useEffect(() => {
    const fetchOnline = async () => {
      setOnlineLoading(true);
      try {
        const res = await fetch('/api/users/online?limit=100');
        const data = await res.json();
        if (data.success) {
          setOnlinePlayers(data.users?.length || 0);
        }
      } catch {
        setOnlinePlayers(0);
      } finally {
        setOnlineLoading(false);
      }
    };
    fetchOnline();
    const interval = setInterval(fetchOnline, 30000);
    return () => clearInterval(interval);
  }, []);

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
    
    // Trigger coin animation and update header for timeout penalty
    onCoinAnimation?.(-WRONG_PENALTY);
    onCoinsChange?.(-WRONG_PENALTY);
    
    // Deduct penalty from DB and track played question
    const currentQ = questions[currentIndex];
    if (!isLoggedIn) {
      // Guest: save coins to localStorage
      const guestCoins = parseFloat(localStorage.getItem('bogx_guest_coins') || '0');
      localStorage.setItem('bogx_guest_coins', String(Math.round((guestCoins - WRONG_PENALTY) * 100) / 100));
    } else if (isLoggedIn && user?.id) {
      try {
        await fetch('/api/user/update-bogx', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, amount: -WRONG_PENALTY, skipGameResult: true }),
        });
        
        // Save GameResult for ranking system (timeout)
        await fetch('/api/game-results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            cardId: currentQ?.cardId || 'trivia-' + Date.now(),
            question: currentQ?.question || '',
            userAnswer: null,
            correctAnswer: currentQ?.options?.[currentQ?.correctIndex] || '',
            isCorrect: false,
            pointsChange: -WRONG_PENALTY,
            timeUsed: 10,
            difficulty: 1,
            skipped: false,
            timedOut: true,
          }),
        });
        
        // Notify leaderboard/rankings to refresh instantly
        window.dispatchEvent(new CustomEvent('bogx-updated'));
        
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
      setCategoriesLoading(true);
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
      } finally {
        setCategoriesLoading(false);
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

    // Trigger coin animation and update header
    onCoinAnimation?.(points);
    onCoinsChange?.(points);

    // Save to DB if logged in, or persist locally for guests
    if (!isLoggedIn) {
      const guestCoins = parseFloat(localStorage.getItem('bogx_guest_coins') || '0');
      localStorage.setItem('bogx_guest_coins', String(Math.round((guestCoins + points) * 100) / 100));
    } else if (isLoggedIn && user?.id) {
      try {
        // Update coins (skip auto GameResult since we save manually below)
        await fetch('/api/user/update-bogx', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, amount: points, skipGameResult: true }),
        });
        
        // Save GameResult for ranking system
        await fetch('/api/game-results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            cardId: currentQ.cardId || 'trivia-' + Date.now(),
            question: currentQ.question,
            userAnswer: currentQ.options[answerIndex],
            correctAnswer: currentQ.options[currentQ.correctIndex],
            isCorrect,
            pointsChange: points,
            timeUsed: Math.round((10000 - timeLeft) / 1000),
            difficulty: 1,
            skipped: false,
            timedOut: false,
          }),
        });
        
        // Notify leaderboard/rankings to refresh instantly
        window.dispatchEvent(new CustomEvent('bogx-updated'));
        
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
    setTimeout(async () => {
      const qs = questionsRef.current;
      setCurrentIndex(prev => {
        if (prev + 1 >= qs.length) {
          setPhase('result');
          // Update game stats when game ends
          if (isLoggedIn && user?.id) {
            // Calculate if won (more than 50% correct)
            const totalCorrect = correctCount + (isCorrect ? 1 : 0);
            const won = totalCorrect > qs.length / 2;
            fetch('/api/user/game-stats', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: user.id, won }),
            }).catch(e => console.error('Failed to update game stats:', e));
          }
          return prev;
        }
        runCountdown();
        return prev + 1;
      });
    }, 1500);
  };

  const currentQuestion = questions[currentIndex];

  // Unified Header Component - same as QuizzBattle (no online indicator for single player)
  const GameHeader = ({ showBack = true }: { showBack?: boolean }) => (
    <div className="px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#D4873A]/5 to-transparent">
      <div className="flex items-center gap-3">
        {showBack && (
          <button onClick={onBack} className="p-1 hover:bg-[#D4873A]/10 rounded transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
        )}
        <div>
          <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">Solo Trivia</span>
          <span className="text-[10px] text-gray-500 -mt-0.5 block">Answer fast, earn coins.</span>
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

  // Setup Phase - Redesigned like QuizzBattle
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

        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: 'none' }}>
          {/* Hero Banner - in rounded box */}
          <div 
            className="relative overflow-hidden bg-cover bg-center rounded-2xl"
            style={{ backgroundImage: "url('/images/Hintergund/solo.png')", minHeight: '240px' }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
            <div className="relative px-6 py-8">
              <span className="inline-block px-3 py-1 bg-[#D4873A] text-white font-bold uppercase tracking-wider rounded-full mb-4 text-[10px]">
                Solo Trivia
              </span>
              <h2 className="font-display text-white leading-tight mb-2 text-2xl md:text-3xl">
                WIN BOGX COINS<br/>
                IN <span className="text-[#D4873A]">60</span> SECONDS
              </h2>
              <div className="flex items-center gap-3 mt-4 text-white/90 text-[10px]">
                <span className="flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-full"><span className="text-[#D4873A]">⚡</span> Answer fast</span>
                <span className="flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-full"><img src="/images/bogxcoin.png" alt="" className="w-3 h-3" /> Earn coins</span>
                <span className="flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-full"><Trophy className="w-3 h-3" /> Climb ranks</span>
              </div>
            </div>
          </div>

          {/* Step 1: Choose Questions - 4 options in boxes */}
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-5 h-5 bg-[#D4873A] rounded-full text-white text-[10px] font-bold flex items-center justify-center">1</span>
              <span className="font-display text-base text-gray-900 uppercase">Choose Number of Questions</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {([5, 10, 15, 20] as const).map((count) => (
                <button
                  key={count}
                  onClick={() => setQuestionCount(count)}
                  className={`bg-[#D4873A]/5 rounded-2xl border p-4 flex flex-col items-center text-center transition-all ${
                    questionCount === count
                      ? 'border-[#D4873A] border-2'
                      : 'border-[#D4873A]/20 hover:border-[#D4873A]/40'
                  }`}
                >
                  <div className="flex items-center gap-1 mb-1">
                    <img src="/images/bogxcoin.png" alt="" className="w-5 h-5" />
                    <span className="font-display text-2xl text-gray-900">{count}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">Questions</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Choose Category */}
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-5 h-5 bg-[#D4873A] rounded-full text-white text-[10px] font-bold flex items-center justify-center">2</span>
              <span className="font-display text-base text-gray-900 uppercase">Choose Category</span>
            </div>
            <div className="relative">
              {/* Left scroll button */}
              <button 
                onClick={() => {
                  const container = document.getElementById('category-scroll');
                  if (container) container.scrollBy({ left: -150, behavior: 'smooth' });
                }}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 border border-[#D4873A]/20 rounded-full shadow-md flex items-center justify-center hover:bg-[#D4873A]/10 transition-colors"
              >
                <span className="text-[#D4873A] text-sm">‹</span>
              </button>
              
              <div id="category-scroll" className="flex gap-2 overflow-x-auto pb-1 px-10 scroll-smooth" style={{ scrollbarWidth: 'none' }}>
                {categoriesLoading ? (
                  // Skeleton loader for categories
                  <>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex-shrink-0 py-1.5 px-6 rounded-lg bg-[#D4873A]/10 animate-pulse h-7 w-20" />
                    ))}
                  </>
                ) : (
                  categories.map((cat: string) => {
                    const Icon = CATEGORY_ICONS[cat] || CATEGORY_ICONS[cat.toUpperCase()] || HelpCircle;
                    const displayName = cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1);
                    return (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`flex-shrink-0 py-1.5 px-3 text-[10px] uppercase tracking-wider font-medium rounded-lg transition-all flex items-center gap-1 whitespace-nowrap border ${
                          selectedCategory === cat
                            ? 'bg-[#D4873A] text-white border-[#D4873A]'
                            : 'bg-[#D4873A]/5 text-gray-700 border-[#D4873A]/20 hover:border-[#D4873A]/40'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" /> {displayName}
                      </button>
                    );
                  })
                )}
              </div>
              
              {/* Right scroll button */}
              <button 
                onClick={() => {
                  const container = document.getElementById('category-scroll');
                  if (container) container.scrollBy({ left: 150, behavior: 'smooth' });
                }}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 border border-[#D4873A]/20 rounded-full shadow-md flex items-center justify-center hover:bg-[#D4873A]/10 transition-colors"
              >
                <span className="text-[#D4873A] text-sm">›</span>
              </button>
            </div>
          </div>

          {/* Max Win / Wrong Penalty / How it Works - in one box with dividers */}
          <div className="bg-[#D4873A]/5 rounded-2xl border border-[#D4873A]/20 mt-4 grid grid-cols-3 divide-x divide-[#D4873A]/20">
            <div className="py-4 px-3 text-center">
              <span className="font-display text-sm text-gray-700 uppercase">Correct Answer</span>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <span className="text-green-500 font-bold">+</span>
                <img src="/images/bogxcoin.png" alt="BOGX" className="w-6 h-6" />
                <span className="font-display text-2xl text-green-600">{formatCurrency(MAX_POINTS)}</span>
                <span className="text-xs text-gray-500">max</span>
              </div>
              <p className="text-[9px] text-gray-700 mt-1">Faster = more points</p>
            </div>
            <div className="py-4 px-3 text-center">
              <span className="font-display text-sm text-gray-700 uppercase">Wrong / Time Up</span>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <span className="text-red-500 font-bold">-</span>
                <img src="/images/bogxcoin.png" alt="BOGX" className="w-6 h-6" />
                <span className="font-display text-2xl text-red-500">{formatCurrency(WRONG_PENALTY)}</span>
              </div>
              <p className="text-[9px] text-gray-700 mt-1">Per wrong or timeout</p>
            </div>
            <div className="py-4 px-3 text-center">
              <span className="font-display text-sm text-gray-700 uppercase">How it Works</span>
              <div className="mt-2 text-[10px] text-gray-700 space-y-1">
                <p className="flex items-center justify-center gap-1"><Timer className="w-3 h-3 text-[#D4873A]" /> 10 sec per question</p>
                <p className="flex items-center justify-center gap-1"><Trophy className="w-3 h-3 text-[#D4873A]" /> Max: {formatCurrency(questionCount * MAX_POINTS)} BOGX</p>
              </div>
            </div>
          </div>

          {/* Start Button - centered, narrower */}
          <div className="flex flex-col items-center mt-5 gap-3">
            <button
              onClick={startGame}
              disabled={loading}
              className="px-20 py-4 rounded-2xl text-white font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #E8A54B 0%, #D4873A 50%, #C4772A 100%)' }}
            >
              <Play className="w-5 h-5" />
              START GAME
            </button>
            {error && (
              <p className="text-red-500 text-sm text-center px-4">{error}</p>
            )}
          </div>

          {/* Fair Play */}
          <div className="flex items-center justify-center gap-3 mt-4 text-xs text-gray-500 pb-4">
            <span className="flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-green-500" />
              Fair play guaranteed
            </span>
            <button className="text-[#D4873A] hover:underline">How it works</button>
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
