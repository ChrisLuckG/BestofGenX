"use client";

import { useState, useEffect, useRef } from "react";
import { Check, X, HelpCircle, Clock, Trophy, Dumbbell, Music, Film, Landmark, Gamepad2, Tv, Timer, Play, ChevronLeft, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import GenXLoader from "@/components/GenXLoader";
import BackButton from "@/components/BackButton";
// Shared with QuizzBattle so both games start the same way.
import PreparingScreen from "@/components/games/PreparingScreen";
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

// 'preparing' is a full screen, not an overlay: the blurred modal that used to sit
// on top of the setup page read as an interruption instead of as part of starting
// the game, and it looked nothing like QuizzBattle.
type GamePhase = 'setup' | 'preparing' | 'countdown' | 'playing' | 'result';

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

// Category images (Unsplash)
// 5 official categories only
const CATEGORY_IMAGES: Record<string, string> = {
  'all': 'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=100&h=100&fit=crop',
  'music': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop',
  'sports': 'https://images.unsplash.com/photo-1461896836934-480b97cb9b5a?w=100&h=100&fit=crop',
  'movies': 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=100&h=100&fit=crop',
  'gaming': 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=100&h=100&fit=crop',
  'politik': 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=100&h=100&fit=crop',
};

// Default categories (5 official only)
const DEFAULT_CATEGORIES = ['all', 'music', 'sports', 'movies', 'gaming', 'politik'];

/** Accent used by the preparing screen; matches the game's own orange. */
const TRIVIA_ACCENT = '#E36B11';
const QUESTION_COUNT = 5; // Fixed 5 questions
const POINT_OPTIONS = [0.10, 0.20, 0.30, 0.40, 0.50] as const;
const PENALTY_RATE = 0.20; // 20% of max points
const DAILY_GAME_LIMIT = 5; // Max games per day

// Helper to get today's date key for localStorage
const getTodayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export default function SoloTriviaGame({ onBack, onCoinsChange, onCoinAnimation, embedded = false }: SoloTriviaGameProps) {
  const { user, isLoggedIn } = useAuth();
  const [phase, setPhase] = useState<GamePhase>('setup');
  const [maxPoints, setMaxPoints] = useState<number>(0.30);
  const [wrongPenalty, setWrongPenalty] = useState<number>(0.06); // 20% of 0.30
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null); // null = not selected yet
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
  const [currentPoints, setCurrentPoints] = useState(maxPoints);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalGains, setTotalGains] = useState(0);
  const [totalLosses, setTotalLosses] = useState(0);
  const [reviewQuestion, setReviewQuestion] = useState<number | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<(number | null)[]>([]);
  
  // Daily game limit tracking
  const [gamesPlayedToday, setGamesPlayedToday] = useState(0);
  const [limitLoading, setLimitLoading] = useState(true);
  
  // Animated display values for info box
  const [displayCorrect, setDisplayCorrect] = useState(0.30);
  const [displayWrong, setDisplayWrong] = useState(0.06);
  const [displayMaxWin, setDisplayMaxWin] = useState(1.50);
  const [displayMaxLoss, setDisplayMaxLoss] = useState(0.30);
  
  // Animated score display with color
  const [displayScore, setDisplayScore] = useState(0);
  const [scoreColor, setScoreColor] = useState<'green' | 'red' | 'black'>('black');
  
  // Online players count
  const [onlinePlayers, setOnlinePlayers] = useState(0);
  const [onlineLoading, setOnlineLoading] = useState(true);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const questionsRef = useRef<Question[]>([]);
  
  // Load daily game count on mount
  useEffect(() => {
    const loadGamesPlayed = async () => {
      setLimitLoading(true);
      const todayKey = getTodayKey();
      
      if (isLoggedIn && user?.id) {
        // For logged-in users, fetch from server
        try {
          const res = await fetch(`/api/user/daily-trivia-count?userId=${user.id}`);
          const data = await res.json();
          if (data.success) {
            setGamesPlayedToday(data.count || 0);
          }
        } catch {
          // Fallback to localStorage
          const stored = localStorage.getItem(`trivia_games_${todayKey}`);
          setGamesPlayedToday(stored ? parseInt(stored, 10) : 0);
        }
      } else {
        // For guests, use localStorage
        const stored = localStorage.getItem(`trivia_games_${todayKey}`);
        setGamesPlayedToday(stored ? parseInt(stored, 10) : 0);
      }
      setLimitLoading(false);
    };
    loadGamesPlayed();
  }, [isLoggedIn, user?.id]);
  
  // Increment game count when a game completes
  const incrementGameCount = async () => {
    const todayKey = getTodayKey();
    const newCount = gamesPlayedToday + 1;
    setGamesPlayedToday(newCount);
    
    // Always save to localStorage as backup
    localStorage.setItem(`trivia_games_${todayKey}`, String(newCount));
    
    if (isLoggedIn && user?.id) {
      // Also save to server for logged-in users
      try {
        await fetch('/api/user/daily-trivia-count', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });
      } catch {
        // localStorage backup is already saved
      }
    }
  };
  
  const gamesRemaining = DAILY_GAME_LIMIT - gamesPlayedToday;
  const canPlay = gamesRemaining > 0;
  
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

  // Animate values when maxPoints changes
  useEffect(() => {
    const targetCorrect = maxPoints;
    const targetWrong = wrongPenalty;
    const targetMaxWin = QUESTION_COUNT * maxPoints;
    const targetMaxLoss = QUESTION_COUNT * wrongPenalty;
    
    const duration = 300; // ms
    const steps = 20;
    const stepTime = duration / steps;
    
    const startCorrect = displayCorrect;
    const startWrong = displayWrong;
    const startMaxWin = displayMaxWin;
    const startMaxLoss = displayMaxLoss;
    
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const progress = step / steps;
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      
      setDisplayCorrect(startCorrect + (targetCorrect - startCorrect) * eased);
      setDisplayWrong(startWrong + (targetWrong - startWrong) * eased);
      setDisplayMaxWin(startMaxWin + (targetMaxWin - startMaxWin) * eased);
      setDisplayMaxLoss(startMaxLoss + (targetMaxLoss - startMaxLoss) * eased);
      
      if (step >= steps) {
        clearInterval(interval);
        // Ensure exact final values
        setDisplayCorrect(targetCorrect);
        setDisplayWrong(targetWrong);
        setDisplayMaxWin(targetMaxWin);
        setDisplayMaxLoss(targetMaxLoss);
      }
    }, stepTime);
    
    return () => clearInterval(interval);
  }, [maxPoints, wrongPenalty]);

  // Animate score counting up/down with color
  const prevEarningsRef = useRef(totalEarnings);
  useEffect(() => {
    if (totalEarnings !== prevEarningsRef.current) {
      const startValue = prevEarningsRef.current;
      const endValue = totalEarnings;
      const isGain = endValue > startValue;
      const diff = Math.abs(endValue - startValue);
      
      // Set color based on gain/loss
      setScoreColor(isGain ? 'green' : 'red');
      
      // Animate the number
      const duration = 400; // ms
      const steps = 15;
      const stepTime = duration / steps;
      let step = 0;
      
      const interval = setInterval(() => {
        step++;
        const progress = step / steps;
        // Ease out
        const eased = 1 - Math.pow(1 - progress, 2);
        const currentValue = startValue + (endValue - startValue) * eased;
        setDisplayScore(currentValue);
        
        if (step >= steps) {
          clearInterval(interval);
          setDisplayScore(endValue);
          prevEarningsRef.current = endValue;
          
          // Reset to black after a short delay
          setTimeout(() => {
            setScoreColor('black');
          }, 300);
        }
      }, stepTime);
      
      return () => clearInterval(interval);
    }
  }, [totalEarnings]);

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
          // Show "GO" for 1 second before starting
          setTimeout(() => {
            setPhase('playing');
            startRound();
          }, 1000);
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
    setCurrentPoints(maxPoints);
    setSelectedAnswer(null);
    setShowResult(false);
    startTimeRef.current = Date.now();
    
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(10000 - elapsed, 0);
      setTimeLeft(remaining);
      
      const pct = remaining / 10000;
      setCurrentPoints(Math.round(maxPoints * pct * 100) / 100);
      
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
    setSelectedAnswers(prev => [...prev, -1]); // Save timeout as -1
    setWrongCount(prev => prev + 1);
    setTotalEarnings(prev => prev - wrongPenalty);
    setTotalLosses(prev => prev + wrongPenalty);
    setAnswerHistory(prev => [...prev, 'wrong']);
    
    // Trigger coin animation and update header for timeout penalty
    onCoinAnimation?.(-wrongPenalty);
    onCoinsChange?.(-wrongPenalty);
    
    // Deduct penalty from DB and track played question
    const currentQ = questions[currentIndex];
    if (!isLoggedIn) {
      // Guest: save coins to localStorage
      const guestCoins = parseFloat(localStorage.getItem('bogx_guest_coins') || '0');
      localStorage.setItem('bogx_guest_coins', String(Math.round((guestCoins - wrongPenalty) * 100) / 100));
    } else if (isLoggedIn && user?.id) {
      try {
        await fetch('/api/user/update-bogx', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, amount: -wrongPenalty, skipGameResult: true }),
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
            pointsChange: -wrongPenalty,
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
    
    // Don't auto-advance - wait for user to click NEXT button
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
          const dbCategories: string[] = data.themes.map((t: string) => t.toLowerCase());
          const uniqueSet = new Set<string>(dbCategories);
          // Fixed order - always show in this sequence
          const fixedOrder = ['all', 'sports', 'music', 'politik', 'gaming', 'movies'];
          const sortedCategories = fixedOrder.filter(cat => cat === 'all' || uniqueSet.has(cat));
          // Add any remaining categories not in fixed order
          const remaining = Array.from(uniqueSet).filter((cat: string) => !fixedOrder.includes(cat)).sort();
          setCategories([...sortedCategories, ...remaining]);
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
    // Check daily limit
    if (!canPlay) {
      setError(`You've reached your daily limit of ${DAILY_GAME_LIMIT} games. Come back tomorrow!`);
      return;
    }
    
    setLoading(true);
    setError(null);
    setAnswerHistory([]);
    // Show the preparing screen immediately; the fetch below decides when its ring
    // may complete. Failures fall back to the setup page with the error.
    setPhase('preparing');
    try {
      // Use smart questions API that avoids recently played questions
      const params = new URLSearchParams({
        userId: user?.id || 'guest',
        count: String(QUESTION_COUNT),
        context: 'game',
      });
      if (selectedCategory && selectedCategory !== 'all') {
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
          setPhase('setup');
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
        // No auto-start: the countdown now runs when the player presses START on
        // the preparing screen, same as QuizzBattle.
      } else {
        setLoading(false);
        setPhase('setup');
        const categoryName = selectedCategory ? selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1) : 'selected category';
        setError(`No questions available for "${categoryName}". Try "Mixed" or another category.`);
      }
    } catch (e) {
      console.error('Failed to generate trivia:', e);
      setLoading(false);
      setPhase('setup');
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
    const points = isCorrect ? currentPoints : -wrongPenalty;
    
    // Save selected answer for review
    setSelectedAnswers(prev => [...prev, answerIndex]);
    
    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
      setTotalEarnings(prev => prev + points);
      setTotalGains(prev => prev + currentPoints);
      setAnswerHistory(prev => [...prev, 'correct']);
    } else {
      setWrongCount(prev => prev + 1);
      setTotalEarnings(prev => prev - wrongPenalty);
      setTotalLosses(prev => prev + wrongPenalty);
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

    // Don't auto-advance - wait for user to click NEXT button
  };

  // Function to go to next question (called by NEXT button)
  const goToNextQuestion = () => {
    const qs = questionsRef.current;
    if (currentIndex + 1 >= qs.length) {
      setPhase('result');
      // Increment daily game count
      incrementGameCount();
      // Update game stats when game ends
      if (isLoggedIn && user?.id) {
        const won = correctCount > qs.length / 2;
        fetch('/api/user/game-stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, won }),
        }).catch(e => console.error('Failed to update game stats:', e));
      }
    } else {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      runCountdown();
    }
  };

  const currentQuestion = questions[currentIndex];

  // Unified Header Component - same as QuizzBattle (no online indicator for single player)
  const GameHeader = ({ showBack = true, onBackOverride }: { showBack?: boolean; onBackOverride?: () => void }) => (
    <div className="px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#E36B11]/5 to-transparent">
      <div className="flex items-center gap-3">
        {showBack && (
          <button onClick={onBackOverride || onBack} className="p-1 hover:bg-[#E36B11]/10 rounded transition-colors">
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

  // Result Phase - Same container size as quiz
  if (phase === 'result') {
    const accuracy = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    
    return (
      <div className="flex flex-col h-full min-h-full bg-cream p-4">
        {/* Main Card - Same size as quiz */}
        <div className="flex-1 border border-warm bg-cream rounded-2xl flex flex-col p-6 shadow-lg min-h-0">
          
          {/* Result Header */}
          <div className="text-center mb-6">
            <span className="inline-block px-4 py-1.5 bg-[#E36B11]/10 border border-[#E36B11]/30 rounded-lg text-xs text-[#E36B11] uppercase tracking-widest font-bold mb-4">
              Game Complete
            </span>
            <h2 className="font-display text-4xl tracking-wider text-gray-900 mb-2">
              {accuracy >= 80 ? 'EXCELLENT!' : accuracy >= 50 ? 'GOOD JOB!' : 'KEEP TRYING!'}
            </h2>
            <p className="text-gray-500 text-sm uppercase tracking-wider">
              {correctCount} / {questions.length || QUESTION_COUNT} correct · {accuracy}% accuracy
            </p>
          </div>

          {/* Stats Grid - fills space */}
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            {/* Earnings Card */}
            <div className={`w-full max-w-sm py-6 px-8 rounded-xl flex items-center justify-center gap-4 ${
              totalEarnings >= 0 ? 'bg-[#10b981]/10 border-2 border-[#10b981]/30' : 'bg-red-50 border-2 border-red-200'
            }`}>
              <img src="/images/bogxcoin.png" alt="" className="w-16 h-16" />
              <div className="text-left">
                <span className={`font-display text-5xl block ${
                  totalEarnings >= 0 ? 'text-[#10b981]' : 'text-red-500'
                }`}>
                  {totalEarnings >= 0 ? '+' : ''}{formatCurrency(totalEarnings)}
                </span>
                <p className="text-gray-500 text-xs uppercase tracking-wider mt-1">
                  <span className="text-green-600">+{formatCurrency(totalGains)}</span>
                  {' / '}
                  <span className="text-red-500">-{formatCurrency(totalLosses)}</span>
                </p>
              </div>
            </div>
            
            {/* Correct/Wrong Stats */}
            <div className="flex gap-12">
              <div className="text-center">
                <div className="w-20 h-20 rounded-xl bg-green-100 border-2 border-green-300 flex items-center justify-center mb-2">
                  <span className="font-display text-4xl text-green-600">{correctCount}</span>
                </div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Correct</p>
              </div>
              <div className="text-center">
                <div className="w-20 h-20 rounded-xl bg-red-100 border-2 border-red-300 flex items-center justify-center mb-2">
                  <span className="font-display text-4xl text-red-500">{wrongCount}</span>
                </div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Wrong</p>
              </div>
            </div>
          </div>

          {/* Buttons at bottom - same style as quiz */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onBack}
              className="flex-1 py-4 border-2 border-warm bg-cream hover:bg-gray-50 text-gray-700 font-display text-base tracking-widest rounded-xl transition-all"
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
                setTotalGains(0);
                setTotalLosses(0);
                setAnswerHistory([]);
              }}
              className="flex-1 py-4 bg-gray-500 hover:bg-gray-600 text-white font-display text-base tracking-widest rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              Play Again
              <Play className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Countdown Phase - Solo layout (no opponent) - SAME AS PLAYING PHASE
  if (phase === 'countdown' && currentQuestion) {
    const isGo = countdown === 0;
    const CategoryIcon = CATEGORY_ICONS[currentQuestion.category] || CATEGORY_ICONS[currentQuestion.category?.toUpperCase()] || HelpCircle;
    
    return (
      <div className="flex flex-col h-full min-h-full bg-cream">
        {/* Main Card - fills available height */}
        <div className="flex-1 m-2 sm:m-4 border border-warm bg-cream rounded-2xl flex flex-col p-4 sm:p-6 shadow-lg min-h-0">
          
          {/* Status Bar - Same structure as BattleQuizScreen */}
          <div className="flex items-stretch border border-warm rounded-xl bg-cream overflow-hidden mb-4 sm:mb-5">
            {/* You */}
            <div className="flex-1 min-w-0 flex flex-col items-center gap-1 p-2 sm:p-4 border-r border-warm">
              <div className="w-8 h-8 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 sm:border-3 flex-shrink-0 border-warm">
                <img src={user?.avatar || 'https://i.pravatar.cc/80?img=47'} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="font-display text-sm sm:text-xl text-gray-900 truncate tracking-wide">You</div>
              <div className="font-display text-xl sm:text-4xl tracking-wide text-gray-800">{correctCount}</div>
            </div>

            {/* Center - Topic + Question indicators */}
            <div className="flex flex-col items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-4 py-2 sm:py-4">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-lg text-[10px] text-gray-600 uppercase tracking-wider font-bold whitespace-nowrap">
                <CategoryIcon className="w-3 h-3" /> {currentQuestion.category || 'Trivia'}
              </span>
              <span className="font-display text-xs sm:text-lg text-gray-400 tracking-wider">Q{currentIndex + 1}/{questions.length}</span>
              {/* Question dots */}
              <div className="flex gap-1 sm:gap-2">
                {Array.from({ length: questions.length }).map((_, i) => {
                  const result = answerHistory[i];
                  const color = result ? (result === 'correct' ? '#10b981' : '#ef4444') : (i === currentIndex ? '#9ca3af' : '#e5e7eb');
                  const opacity = i === currentIndex && !result ? '0.5' : '1';
                  return (
                    <span 
                      key={i} 
                      className="min-w-[24px] h-6 sm:min-w-[36px] sm:h-8 px-1.5 sm:px-2 rounded-md flex items-center justify-center font-display text-[10px] sm:text-xs tracking-wider text-white"
                      style={{ background: color, opacity }}
                    >
                      Q{i + 1}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Earnings */}
            <div className="flex-1 min-w-0 flex flex-col items-center gap-1 p-2 sm:p-4 border-l border-warm">
              <img src="/images/bogxcoin.png" alt="" className="w-8 h-8 sm:w-14 sm:h-14 flex-shrink-0" />
              <div className={`font-display text-sm sm:text-xl tracking-wide ${totalEarnings >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
                {totalEarnings >= 0 ? '+' : ''}{formatCurrency(totalEarnings)}
              </div>
              <div className="text-[9px] sm:text-xs text-gray-500">
                <span className="text-green-600">+{formatCurrency(totalGains)}</span>
                {' / '}
                <span className="text-red-500">-{formatCurrency(totalLosses)}</span>
              </div>
            </div>
          </div>

          {/* Timer Row - GET READY / GO style */}
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
              {currentQuestion.question}
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

  // Preparing Phase - same screen as QuizzBattle, not an overlay
  if (phase === 'preparing') {
    const cat = selectedCategory || 'all';
    const CategoryIcon =
      CATEGORY_ICONS[cat] || CATEGORY_ICONS[cat.toUpperCase()] || HelpCircle;
    const categoryName =
      cat === 'all' ? 'Mixed questions' : cat.charAt(0).toUpperCase() + cat.slice(1);

    return (
      <div className="w-full h-full min-h-full flex-1 flex flex-col" style={{ backgroundColor: '#F5F0E8' }}>
        {/* Back returns to the category selection, not out of the game - the player
            is mid-setup here, not mid-round. */}
        <GameHeader onBackOverride={() => { setPhase('setup'); setQuestions([]); }} />
        <PreparingScreen
          topicColor={TRIVIA_ACCENT}
          TopicIcon={CategoryIcon}
          topicId={selectedCategory || undefined}
          subtitle={`Loading ${QUESTION_COUNT} questions · ${categoryName}`}
          readySubtitle={`${QUESTION_COUNT} questions ready · ${categoryName}`}
          // Holds the ring short of full until the questions have really arrived.
          dataReady={!loading && questions.length > 0}
          onStart={runCountdown}
        >
          {/* Round Info Card */}
          <div className="w-full max-w-sm bg-cream border border-warm rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${TRIVIA_ACCENT}1A` }}
              >
                <CategoryIcon className="w-5 h-5" style={{ color: TRIVIA_ACCENT }} />
              </div>
              <div className="flex-1">
                <div className="font-display text-base tracking-wide text-gray-900">{categoryName}</div>
                <div className="text-[11px] text-gray-400">{QUESTION_COUNT} questions · 10 sec each</div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1.5 justify-end">
                  <img src="/images/bogxcoin.png" alt="" className="w-5 h-5" />
                  <span className="font-display text-xl" style={{ color: TRIVIA_ACCENT }}>
                    {(maxPoints * QUESTION_COUNT).toFixed(2)}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400">Max win</div>
              </div>
            </div>
          </div>
        </PreparingScreen>
      </div>
    );
  }

  // Setup Phase - Redesigned like QuizzBattle
  if (phase === 'setup') {
    return (
      <div className="w-full h-full min-h-full flex-1 flex flex-col relative" style={{ backgroundColor: '#F5F0E8' }}>
        <GameHeader />

        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: 'none' }}>
          {/* Step 1: Choose Category - 4x4 Grid */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-5 h-5 bg-[#E36B11] rounded-full text-white text-[10px] font-bold flex items-center justify-center">1</span>
              <span className="font-display text-base text-gray-900 uppercase">Choose Category</span>
            </div>
            {/* Mobile: horizontal slider, Desktop: 4-column grid */}
            <div className="flex gap-2 overflow-x-auto pb-2 sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0" style={{ scrollbarWidth: 'none' }}>
              {(categories.length > 0 ? categories : DEFAULT_CATEGORIES).map((cat: string) => {
                const Icon = CATEGORY_ICONS[cat] || CATEGORY_ICONS[cat.toUpperCase()] || HelpCircle;
                const displayName = cat === 'all' ? 'Mixed' : cat.charAt(0).toUpperCase() + cat.slice(1);
                const imageUrl = CATEGORY_IMAGES[cat.toLowerCase()] || CATEGORY_IMAGES['all'];
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`group relative flex-shrink-0 px-4 py-2.5 sm:px-0 sm:py-0 sm:h-24 rounded-xl transition-all border-2 overflow-hidden flex items-center justify-center gap-2 ${
                      selectedCategory === cat
                        ? 'border-[#E36B11] bg-[#E36B11]/10 ring-2 ring-[#E36B11]/30'
                        : 'border-transparent sm:border-[#E36B11]/20 bg-[#E36B11]/5 hover:border-[#E36B11]/40'
                    }`}
                  >
                    {/* Desktop only: background image */}
                    <div 
                      className="absolute inset-0 hidden sm:block bg-cover bg-center transition-transform duration-300 group-hover:scale-110"
                      style={{ backgroundImage: `url(${imageUrl})` }}
                    />
                    {/* Gradient overlay - darker on hover */}
                    <div className={`absolute inset-0 hidden sm:block transition-all duration-300 ${
                      selectedCategory === cat 
                        ? 'bg-gradient-to-t from-[#E36B11]/90 via-[#E36B11]/40 to-[#E36B11]/20'
                        : 'bg-gradient-to-t from-black/70 via-black/20 to-transparent group-hover:from-black/80 group-hover:via-black/40 group-hover:to-black/20'
                    }`} />
                    {/* Mobile: icon + text, Desktop: bottom-left text only */}
                    <Icon className="relative z-10 w-5 h-5 sm:hidden text-[#E36B11]" />
                    <span className={`relative z-10 font-display text-base uppercase tracking-wider text-[#E36B11] sm:absolute sm:bottom-2 sm:left-2 sm:text-white sm:drop-shadow-lg transition-transform duration-300 sm:group-hover:translate-x-1 ${
                      selectedCategory === cat ? 'sm:text-white' : ''
                    }`}>{displayName}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Choose Points Value - disabled until category selected */}
          <div className={`mt-4 transition-opacity ${selectedCategory ? '' : 'opacity-40 pointer-events-none'}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${selectedCategory ? 'bg-[#E36B11]' : 'bg-gray-400'}`}>2</span>
              <span className="font-display text-base text-gray-900 uppercase">Choose Correct Answer Value</span>
            </div>
            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {POINT_OPTIONS.map((points) => {
                const penalty = Math.round(points * PENALTY_RATE * 100) / 100;
                return (
                  <button
                    key={points}
                    onClick={() => {
                      setMaxPoints(points);
                      setWrongPenalty(penalty);
                      setCurrentPoints(points);
                    }}
                    disabled={!selectedCategory}
                    className={`flex-1 min-w-[60px] rounded-xl border-2 p-2 sm:p-3 flex flex-col items-center text-center transition-all ${
                      maxPoints === points
                        ? 'border-[#E36B11] bg-[#E36B11]/10'
                        : 'border-transparent sm:border-[#E36B11]/20 bg-[#E36B11]/5 hover:border-[#E36B11]/40'
                    }`}
                  >
                    <div className="flex items-center gap-0.5">
                      <img src="/images/bogxcoin.png" alt="" className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="font-display text-base sm:text-xl text-gray-900">{formatCurrency(points)}</span>
                    </div>
                    <span className="text-[8px] sm:text-[9px] text-red-500 mt-0.5">-{formatCurrency(penalty)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Info Box - How it Works */}
          <div className="bg-[#E36B11]/5 rounded-xl border border-[#E36B11]/20 mt-3 p-2 sm:p-5">
            {/* Mobile: 2 rows with Correct/Wrong side by side, then Max Win/Loss */}
            {/* Desktop: 4 columns */}
            <div className="hidden sm:flex sm:items-center sm:justify-center gap-4 text-center">
              {/* Desktop layout - 4 items with separator between Wrong and Max Win */}
              <div className="flex-1">
                <span className="font-display text-xs text-gray-500 uppercase">Correct</span>
                <div className="flex items-center justify-center gap-1 mt-1.5">
                  <img src="/images/bogxcoin.png" alt="" className="w-6 h-6" />
                  <span className="text-green-500 font-bold text-xl">+</span>
                  <span className="font-display text-3xl text-green-600 tabular-nums">{formatCurrency(displayCorrect)}</span>
                </div>
                <span className="text-[9px] text-gray-400">max per answer</span>
              </div>
              <div className="flex-1">
                <span className="font-display text-xs text-gray-500 uppercase">Wrong</span>
                <div className="flex items-center justify-center gap-1 mt-1.5">
                  <img src="/images/bogxcoin.png" alt="" className="w-6 h-6" />
                  <span className="text-red-500 font-bold text-xl">-</span>
                  <span className="font-display text-3xl text-red-500 tabular-nums">{formatCurrency(displayWrong)}</span>
                </div>
                <span className="text-[9px] text-gray-400">per wrong/timeout</span>
              </div>
              
              {/* Separator */}
              <div className="w-px h-16 bg-[#E36B11]/20 mx-2" />
              
              <div className="flex-1">
                <span className="font-display text-xs text-gray-500 uppercase">Max Win</span>
                <div className="flex items-center justify-center gap-1 mt-1.5">
                  <img src="/images/bogxcoin.png" alt="" className="w-6 h-6" />
                  <span className="text-green-500 font-bold text-xl">+</span>
                  <span className="font-display text-3xl text-green-600 tabular-nums">{formatCurrency(displayMaxWin)}</span>
                </div>
                <span className="text-[9px] text-gray-400">5 correct</span>
              </div>
              <div className="flex-1">
                <span className="font-display text-xs text-gray-500 uppercase">Max Loss</span>
                <div className="flex items-center justify-center gap-1 mt-1.5">
                  <img src="/images/bogxcoin.png" alt="" className="w-6 h-6" />
                  <span className="text-red-500 font-bold text-xl">-</span>
                  <span className="font-display text-3xl text-red-500 tabular-nums">{formatCurrency(displayMaxLoss)}</span>
                </div>
                <span className="text-[9px] text-gray-400">5 wrong</span>
              </div>
            </div>
            
            {/* Mobile layout - 2x2 grid compact */}
            <div className="sm:hidden">
              {/* Correct / Wrong side by side */}
              <div className="flex gap-2">
                <div className="flex-1 text-center">
                  <span className="text-[9px] text-gray-500 uppercase">Correct</span>
                  <div className="flex items-center justify-center gap-0.5">
                    <span className="text-green-500 font-bold text-sm">+</span>
                    <span className="font-display text-base text-green-600 tabular-nums">{formatCurrency(displayCorrect)}</span>
                    <img src="/images/bogxcoin.png" alt="" className="w-3 h-3" />
                  </div>
                </div>
                <div className="w-px bg-[#E36B11]/20" />
                <div className="flex-1 text-center">
                  <span className="text-[9px] text-gray-500 uppercase">Wrong</span>
                  <div className="flex items-center justify-center gap-0.5">
                    <span className="text-red-500 font-bold text-sm">-</span>
                    <span className="font-display text-base text-red-500 tabular-nums">{formatCurrency(displayWrong)}</span>
                    <img src="/images/bogxcoin.png" alt="" className="w-3 h-3" />
                  </div>
                </div>
              </div>
              
              {/* Divider */}
              <div className="border-t border-[#E36B11]/20 mt-1.5 pt-1.5 flex gap-2">
                <div className="flex-1 text-center">
                  <span className="text-[9px] text-gray-500 uppercase">Max Win</span>
                  <div className="flex items-center justify-center gap-0.5">
                    <span className="text-green-500 font-bold text-sm">+</span>
                    <span className="font-display text-base text-green-600 tabular-nums">{formatCurrency(displayMaxWin)}</span>
                    <img src="/images/bogxcoin.png" alt="" className="w-3 h-3" />
                  </div>
                </div>
                <div className="w-px bg-[#E36B11]/20" />
                <div className="flex-1 text-center">
                  <span className="text-[9px] text-gray-500 uppercase">Max Loss</span>
                  <div className="flex items-center justify-center gap-0.5">
                    <span className="text-red-500 font-bold text-sm">-</span>
                    <span className="font-display text-base text-red-500 tabular-nums">{formatCurrency(displayMaxLoss)}</span>
                    <img src="/images/bogxcoin.png" alt="" className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </div>
            
            <p className="text-[9px] sm:text-xs text-gray-500 text-center mt-1.5 pt-1.5 sm:mt-4 sm:pt-3 border-t border-[#E36B11]/20">5 Questions · 10 sec each · Faster = more points</p>
          </div>

          {/* Daily Games Remaining */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
              canPlay 
                ? 'bg-[#E36B11]/10 text-[#E36B11]' 
                : 'bg-red-100 text-red-600'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              {limitLoading ? '...' : canPlay ? `${gamesRemaining} games left today` : 'No games left today'}
            </div>
          </div>

          {/* Start Button - centered, narrower - disabled until category selected */}
          <div className="flex flex-col items-center mt-4 gap-3">
            <button
              onClick={startGame}
              disabled={loading || !canPlay || limitLoading || !selectedCategory}
              className={`px-20 py-4 rounded-2xl text-white font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${
                canPlay && selectedCategory ? 'hover:scale-[1.02] active:scale-[0.98]' : 'opacity-50 cursor-not-allowed'
              } disabled:opacity-50`}
              style={{ background: canPlay && selectedCategory ? 'linear-gradient(135deg, #E8A54B 0%, #E36B11 50%, #C4772A 100%)' : '#9CA3AF' }}
            >
              <Play className="w-5 h-5" />
              {!selectedCategory ? 'SELECT CATEGORY FIRST' : canPlay ? 'START GAME' : 'COME BACK TOMORROW'}
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
            <button className="text-[#E36B11] hover:underline">How it works</button>
          </div>
        </div>
      </div>
    );
  }

  // Playing Phase - Solo layout (no opponent)
  if (phase === 'playing' && currentQuestion) {
    const timeSeconds = Math.ceil(timeLeft / 1000);
    const timePct = timeLeft / 10000;
    const filledSegments = Math.round(timePct * 8);
    // Timer color: >5s gray, 5-3s yellow, <3s red (same as QuizBattle)
    const timeSecondsRaw = timeLeft / 1000;
    const timerColor = timeSecondsRaw > 5 
      ? '#6B7280' 
      : timeSecondsRaw > 3 
        ? '#EAB308' 
        : '#DC2626';
    const CategoryIcon = CATEGORY_ICONS[currentQuestion.category] || CATEGORY_ICONS[currentQuestion.category?.toUpperCase()] || HelpCircle;
    
    return (
      <div className="flex flex-col h-full min-h-full bg-cream">
        {/* Main Card - fills available height */}
        <div className="flex-1 m-2 sm:m-4 border border-warm bg-cream rounded-2xl flex flex-col p-4 sm:p-6 shadow-lg min-h-0">
          
          {/* Status Bar - Same structure as BattleQuizScreen */}
          <div className="flex items-stretch border border-warm rounded-xl bg-cream overflow-hidden mb-4 sm:mb-5">
            {/* You */}
            <div className="flex-1 min-w-0 flex flex-col items-center gap-1 p-2 sm:p-4 border-r border-warm">
              <div className="w-8 h-8 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 sm:border-3 flex-shrink-0 border-warm">
                <img src={user?.avatar || 'https://i.pravatar.cc/80?img=47'} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="font-display text-sm sm:text-xl text-gray-900 truncate tracking-wide">You</div>
              <div className="font-display text-xl sm:text-4xl tracking-wide text-gray-800">{correctCount}</div>
            </div>

            {/* Center - Topic + Question indicators */}
            <div className="flex flex-col items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-4 py-2 sm:py-4">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-lg text-[10px] text-gray-600 uppercase tracking-wider font-bold whitespace-nowrap">
                <CategoryIcon className="w-3 h-3" /> {currentQuestion.category || 'Trivia'}
              </span>
              <span className="font-display text-xs sm:text-lg text-gray-400 tracking-wider">Q{currentIndex + 1}/{questions.length}</span>
              {/* Question dots */}
              <div className="flex gap-1 sm:gap-2">
                {Array.from({ length: questions.length }).map((_, i) => {
                  const result = answerHistory[i];
                  const isCurrentQuestion = i === currentIndex && !result;
                  const color = result ? (result === 'correct' ? '#10b981' : '#ef4444') : (i === currentIndex ? '#6B7280' : '#e5e7eb');
                  const isClickable = i < answerHistory.length;
                  return (
                    <span 
                      key={i} 
                      onClick={() => isClickable && setReviewQuestion(reviewQuestion === i ? null : i)}
                      className={`min-w-[24px] h-6 sm:min-w-[36px] sm:h-8 px-1.5 sm:px-2 rounded-md flex items-center justify-center font-display text-[10px] sm:text-xs tracking-wider text-white transition-all ${
                        isClickable ? 'cursor-pointer hover:scale-110' : ''
                      } ${
                        reviewQuestion === i ? 'ring-2 ring-offset-1 ring-gray-900' : ''
                      } ${
                        isCurrentQuestion ? 'animate-pulse ring-2 ring-[#6B7280]/50 shadow-lg' : ''
                      }`}
                      style={{ 
                        background: color,
                        boxShadow: isCurrentQuestion ? '0 0 12px rgba(107, 114, 128, 0.5)' : undefined
                      }}
                    >
                      Q{i + 1}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Earnings */}
            <div className="flex-1 min-w-0 flex flex-col items-center gap-1 p-2 sm:p-4 border-l border-warm">
              <img 
                src="/images/bogxcoin.png" 
                alt="" 
                className="w-10 h-10 sm:w-16 sm:h-16 flex-shrink-0"
                key={`coin-${totalEarnings}`}
                style={{ animation: 'coinPop 0.4s ease-out' }}
              />
              <div 
                className={`font-display text-lg sm:text-3xl font-bold tracking-wide tabular-nums transition-colors duration-300 ${
                  scoreColor === 'green' 
                    ? 'text-green-500' 
                    : scoreColor === 'red' 
                      ? 'text-red-500' 
                      : displayScore >= 0 
                        ? 'text-gray-900' 
                        : 'text-red-500'
                }`}
                style={{ 
                  textShadow: scoreColor === 'green' 
                    ? '0 0 12px rgba(34,197,94,0.5)' 
                    : scoreColor === 'red' 
                      ? '0 0 12px rgba(239,68,68,0.5)' 
                      : 'none'
                }}
              >
                {displayScore >= 0 ? '+' : ''}{formatCurrency(displayScore)}
              </div>
              <div className="text-[10px] sm:text-sm text-gray-500 flex items-center gap-1 font-semibold">
                <span 
                  key={`gains-${totalGains}`}
                  className="text-green-600 tabular-nums"
                  style={{ animation: 'scorePop 0.3s ease-out' }}
                >
                  +{formatCurrency(totalGains)}
                </span>
                {' / '}
                <span 
                  key={`losses-${totalLosses}`}
                  className="text-red-500 tabular-nums"
                  style={{ animation: 'scorePop 0.3s ease-out' }}
                >
                  -{formatCurrency(totalLosses)}
                </span>
              </div>
            </div>
          </div>
          
          {/* Scoreboard animations */}
          <style jsx>{`
            @keyframes scorePop {
              0% { transform: scale(1.4); opacity: 0; }
              50% { transform: scale(1.1); }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes coinPop {
              0% { transform: scale(1) rotate(0deg); }
              25% { transform: scale(1.2) rotate(-10deg); }
              50% { transform: scale(1.3) rotate(10deg); }
              75% { transform: scale(1.1) rotate(-5deg); }
              100% { transform: scale(1) rotate(0deg); }
            }
          `}</style>

          {/* Timer Row - LED style like Battle */}
          <div className="flex items-center gap-2.5 sm:gap-4 mb-4 sm:mb-5">
            <div 
              key={timeSeconds}
              className={`w-12 h-12 sm:w-16 sm:h-16 rounded-lg sm:rounded-xl flex flex-col items-center justify-center flex-shrink-0 transition-all duration-200 ${
                timeSeconds <= 3 ? 'animate-pulse scale-110' : ''
              }`}
              style={{ 
                background: `linear-gradient(135deg, ${timerColor}dd 0%, ${timerColor} 100%)`,
                boxShadow: timeSeconds <= 3 
                  ? `0 0 20px ${timerColor}60, inset 0 0 0 2px ${timerColor}40`
                  : `inset 0 0 0 2px ${timerColor}40`,
                animation: 'popIn 0.3s ease-out'
              }}
            >
              <span 
                className="font-display text-lg sm:text-2xl text-white tabular-nums"
                style={{ 
                  animation: 'popNumber 0.3s ease-out',
                  textShadow: timeSeconds <= 3 ? '0 0 10px rgba(255,255,255,0.5)' : 'none'
                }}
              >
                {String(timeSeconds).padStart(2, '0')}
              </span>
              <span className="font-display text-[7px] sm:text-[9px] text-white/80 tracking-widest">SEC</span>
            </div>
            <div className="flex-1 flex gap-1 sm:gap-1.5">
              {[...Array(8)].map((_, i) => (
                <span 
                  key={i} 
                  className="h-2.5 sm:h-4 flex-1 rounded transition-all duration-300"
                  style={{ 
                    backgroundColor: i < filledSegments ? timerColor : '#E5E0D8',
                    boxShadow: i < filledSegments && timeSeconds <= 3 ? `0 0 8px ${timerColor}` : 'none'
                  }}
                />
              ))}
            </div>
            {/* Right side: Points - pulses when low time */}
            <div className={`flex items-center gap-1.5 sm:gap-2 flex-shrink-0 min-w-[70px] sm:min-w-[90px] justify-end ${
              timeSeconds <= 3 ? 'animate-pulse' : ''
            }`}>
              <span 
                className="font-display text-xl sm:text-3xl tabular-nums transition-all duration-200" 
                style={{ 
                  color: timerColor,
                  textShadow: timeSeconds <= 3 ? `0 0 10px ${timerColor}60` : 'none'
                }}
              >
                {formatCurrency(currentPoints)}
              </span>
              <img 
                src="/images/bogxcoin.png" 
                alt="BOGX" 
                className={`w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-200 ${
                  timeSeconds <= 3 ? 'animate-spin' : ''
                }`}
                style={{ animationDuration: '2s' }}
              />
            </div>
          </div>
          
          {/* CSS for pop animations */}
          <style jsx>{`
            @keyframes popIn {
              0% { transform: scale(0.8); opacity: 0.5; }
              50% { transform: scale(1.1); }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes popNumber {
              0% { transform: scale(1.3); opacity: 0; }
              100% { transform: scale(1); opacity: 1; }
            }
          `}</style>

          {/* Question Card */}
          <div className="border border-warm bg-cream rounded-xl p-4 sm:p-6 mb-4 sm:mb-5 flex items-center justify-center min-h-[80px] sm:min-h-[120px]">
            <h2 className="font-display text-lg sm:text-2xl text-gray-900 text-center leading-snug tracking-wide">
              {currentQuestion.question}
            </h2>
          </div>

          {/* Answers - 2x2 grid with Battle animations */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 flex-1">
            {currentQuestion.options.map((option, i) => {
              const delay = `${i * 0.08}s`;
              let className = 'rounded-xl p-3 sm:p-4 min-h-[60px] sm:min-h-[72px] text-base sm:text-lg font-display tracking-wide flex items-center justify-center text-center transition-all cursor-pointer';
              let showIcon = false;
              let iconType: 'check' | 'x' | null = null;
              
              if (showResult) {
                if (i === currentQuestion.correctIndex) {
                  className += ' bg-[#10b981] text-white border-2 border-[#10b981]';
                  showIcon = true;
                  iconType = 'check';
                } else if (i === selectedAnswer && selectedAnswer !== currentQuestion.correctIndex) {
                  className += ' bg-red-500 text-white border-2 border-red-500';
                  showIcon = true;
                  iconType = 'x';
                } else {
                  className += ' bg-cream border-2 border-warm text-gray-400 opacity-60';
                }
              } else {
                className += ' bg-cream text-gray-900 border-2 border-warm hover:border-gray-400 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]';
              }
              
              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={showResult}
                  className={`${className} animate-[fadeInUp_0.4s_ease-out_backwards]`}
                  style={{ animationDelay: delay }}
                >
                  <span className="line-clamp-2">{option}</span>
                </button>
              );
            })}
          </div>

          {/* Feedback + Next Button Row - Always visible */}
          <div className="flex items-center justify-between gap-2 sm:gap-4 min-h-[48px] sm:min-h-[56px] mt-3 sm:mt-4">
            {/* Feedback Tag - gray when waiting, colored after answer */}
            <div 
              className="px-3 sm:px-5 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-base flex items-center gap-2 transition-all"
              style={{
                background: !showResult ? '#e5e7eb' : 
                  selectedAnswer === -1 ? '#ef4444' : 
                  selectedAnswer === currentQuestion.correctIndex ? '#10b981' : '#ef4444',
                color: !showResult ? '#9ca3af' : 'white'
              }}
            >
              {!showResult ? (
                'Pick an answer'
              ) : selectedAnswer === -1 ? (
                <>
                  <Clock className="w-5 h-5" />
                  Time's up
                  <img src="/images/bogxcoin.png" alt="" className="w-4 h-4 mx-1 brightness-0 invert" />
                  -{formatCurrency(wrongPenalty)}
                </>
              ) : selectedAnswer === currentQuestion.correctIndex ? (
                <>
                  <Check className="w-5 h-5 animate-[popIcon_0.35s_ease-out]" />
                  Correct
                  <img src="/images/bogxcoin.png" alt="" className="w-4 h-4 mx-1 brightness-0 invert" />
                  +{formatCurrency(currentPoints)}
                </>
              ) : (
                <>
                  <X className="w-5 h-5 animate-[popIcon_0.35s_ease-out]" />
                  Wrong
                  <img src="/images/bogxcoin.png" alt="" className="w-4 h-4 mx-1 brightness-0 invert" />
                  -{formatCurrency(wrongPenalty)}
                </>
              )}
            </div>

            {/* Next Button - gray when waiting, dark gray after answer */}
            <button
              onClick={goToNextQuestion}
              disabled={!showResult}
              className={`px-8 py-3 font-display text-base tracking-widest rounded-xl flex items-center gap-2 transition-all ${
                showResult 
                  ? 'bg-gray-500 text-white hover:bg-gray-600 cursor-pointer' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {currentIndex + 1 >= questions.length ? 'Results' : 'Next'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Review past question when clicking Q indicator */}
          {reviewQuestion !== null && questions[reviewQuestion] && (
            <div className="mt-4 border-t border-warm pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500 uppercase tracking-wider">Review Q{reviewQuestion + 1}</span>
                <button onClick={() => setReviewQuestion(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="border border-warm bg-cream/50 rounded-xl p-4 mb-3">
                <p className="font-display text-lg text-gray-900 text-center">{questions[reviewQuestion].question}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {questions[reviewQuestion].options.map((option, i) => {
                  const wasSelected = selectedAnswers[reviewQuestion] === i;
                  const isCorrect = i === questions[reviewQuestion].correctIndex;
                  let bgClass = 'bg-cream border-warm text-gray-400';
                  if (isCorrect) bgClass = 'bg-[#10b981] border-[#10b981] text-white';
                  else if (wasSelected) bgClass = 'bg-red-500 border-red-500 text-white';
                  return (
                    <div key={i} className={`p-3 rounded-xl border-2 text-sm font-display text-center ${bgClass}`}>
                      {option}
                      {isCorrect && <Check className="w-4 h-4 inline ml-1" />}
                      {wasSelected && !isCorrect && <X className="w-4 h-4 inline ml-1" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
          className="px-6 py-2 bg-[#E36B11] text-white font-bold rounded-lg"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
