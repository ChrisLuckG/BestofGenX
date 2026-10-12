"use client";

import { useState, useEffect, useRef } from "react";
import { Check, X, HelpCircle, Clock, Trophy, Dumbbell, Music, Film, Landmark, Gamepad2, Tv, Timer, Play, ChevronLeft, Loader2, ArrowRight, Brain, PlusCircle, MinusCircle, Shield, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import GenXLoader from "@/components/GenXLoader";
import BackButton from "@/components/BackButton";
// Shared with QuizzBattle so both games start the same way.
import PreparingScreen from "@/components/games/PreparingScreen";
import { formatCurrency } from "@/utils/currency";
import { rankingDayKey } from "@/lib/berlinTime";
import { getTopicColor } from "@/lib/categories";
import { useCountUp } from "@/hooks/useCountUp";

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

/**
 * /api/trivia/categories answers with the stored theme strings - "TV & MOVIES",
 * "POLITIK", "GAMING" - not with the slugs CATEGORY_ICONS/CATEGORY_IMAGES are
 * keyed by. Every lookup therefore missed and four of the six tiles fell back to
 * the "?" icon and to the Mixed artwork, which is what made the categories
 * indistinguishable. Resolved here once instead of at each call site.
 */
const THEME_TO_SLUG: Record<string, string> = {
  'all': 'all',
  'mixed': 'all',
  'music': 'music',
  'sport': 'sports',
  'sports': 'sports',
  'tv & movies': 'movies',
  'tv&movies': 'movies',
  'movies': 'movies',
  'film': 'movies',
  'tv': 'movies',
  'gaming': 'gaming',
  'games': 'gaming',
  'politik': 'politik',
  'politics': 'politik',
  'history': 'history',
};

const categorySlug = (cat: string): string =>
  THEME_TO_SLUG[(cat || '').trim().toLowerCase()] || (cat || '').trim().toLowerCase();

/** Page background of the setup screen. */
const CREAM = '#F5F0E8';

/**
 * Radius of the concave fillets where the stake tab flares into the panel.
 * 16 rather than 12: the original's curve is visibly wider and softer.
 */
const TAB_RADIUS = 16;

/**
 * Line width of the stake tab and its panel. Every offset of the cut-out patch
 * and the fillets is derived from it - they were hard-coded for 2px, and
 * thinning only the borders left the panel line running through under the tab.
 */
const FRAME_W = 1.5;

/**
 * How far inactive stake tiles stop above the panel line. The fillet curve
 * sweeps through this space; at 16px radius it is only ~2px out from the tab
 * at 8px height, so it never reaches the neighbour tile above the gap.
 */
const TILE_GAP = 8;

/**
 * Flatten a translucent accent tint onto an opaque background.
 *
 * The tab has to COVER the panel's top border to read as connected, and a cover
 * strip only works if its colour is opaque: stacking another `${accent}0f` over
 * the panel would show as a darker band exactly where the seam should vanish.
 */
const mixHex = (fg: string, bg: string, alpha: number): string => {
  const parse = (hex: string) => {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
  };
  const [fr, fg_, fb] = parse(fg);
  const [br, bg_, bb] = parse(bg);
  const ch = (f: number, b: number) => Math.round(f * alpha + b * (1 - alpha));
  return `#${[ch(fr, br), ch(fg_, bg_), ch(fb, bb)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
};

const categoryIcon = (cat: string): LucideIcon => {
  const slug = categorySlug(cat);
  if (slug === 'gaming') return Gamepad2;
  if (slug === 'politik') return Landmark;
  return CATEGORY_ICONS[slug] || CATEGORY_ICONS[cat] || CATEGORY_ICONS[cat?.toUpperCase()] || HelpCircle;
};

// Category images (custom artwork by Fatih)
const CATEGORY_IMAGES: Record<string, string> = {
  'all': '/images/categories/all.png',
  'music': '/images/categories/music.png',
  'sports': '/images/categories/sports.png',
  'movies': '/images/categories/movies.png',
  'gaming': '/images/categories/gaming.png',
  'politik': '/images/categories/politik.png',
};

// Default categories - MUST match fixedOrder in loadCategories()
const DEFAULT_CATEGORIES = ['all', 'music', 'sports', 'movies', 'gaming', 'politik'];

/** Accent used by the preparing screen; matches the game's own orange. */
const TRIVIA_ACCENT = '#E36B11';
const QUESTION_COUNT = 5; // Fixed 5 questions
const POINT_OPTIONS = [0.10, 0.20, 0.30, 0.40, 0.50] as const;
const PENALTY_RATE = 0.20; // 20% of max points
export const DAILY_GAME_LIMIT = 5; // Max games per day

// Key for the localStorage counter. Must be the same ranking day the server
// counts, otherwise the guest allowance and the logged-in allowance reset at
// different moments - this used to be the browser's local midnight, so simply
// changing the system timezone handed out a fresh set of games.
const getTodayKey = () => rankingDayKey();

/**
 * True while AuthProvider is still restoring a saved session.
 *
 * AuthProvider starts with `user = null` and only reads localStorage in a mount
 * effect, so the FIRST render of this component reports `isLoggedIn === false`
 * even for a logged-in player. Checking the same key it restores from is what
 * tells the two cases apart - a real guest from a session that is still in
 * flight.
 */
const sessionRestorePending = (): boolean => {
  try {
    return !!localStorage.getItem('sporttock_user');
  } catch {
    return false;
  }
};

/**
 * Hard ceiling on that wait. AuthProvider's restore resolves within a tick, but
 * a corrupt `sporttock_user` makes its JSON.parse throw and `user` then stays
 * null forever - without this the Start button would be locked permanently.
 */
const SESSION_WAIT_MS = 4000;

export default function SoloTriviaGame({ onBack, onCoinsChange, onCoinAnimation, embedded = false }: SoloTriviaGameProps) {
  const { user, isLoggedIn } = useAuth();
  const [phase, setPhase] = useState<GamePhase>('setup');
  const [maxPoints, setMaxPoints] = useState<number>(0.30);
  // Chrome floors border widths to whole device pixels, gradients and offsets
  // it does not - so a raw 1.5px drew a 1px line with 1.5px fillets at 100%
  // zoom and the joints kinked. Snap the width the same way the border is.
  const [frameW, setFrameW] = useState(FRAME_W);
  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    setFrameW(Math.max(1, Math.floor(FRAME_W * dpr)) / dpr);
  }, []);
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
  const [reviewingQuestion, setReviewingQuestion] = useState<number | null>(null);
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
  
  // Load daily game count on mount.
  //
  // `limitLoading` must stay TRUE until the AUTHORITATIVE count is in, because
  // it is the only thing disabling Start. The guest branch used to run on the
  // first render - before AuthProvider had restored the session - publish the
  // localStorage count and clear the flag. For the second or two until the
  // server answered, Start was enabled against a count that was often 0: on a
  // fresh browser or another device that localStorage key does not exist, so a
  // player who had already used all 5 games got a full extra set on the
  // primary earning path.
  useEffect(() => {
    let cancelled = false;
    let waitTimer: NodeJS.Timeout | null = null;

    const readLocalCount = () => {
      try {
        const stored = localStorage.getItem(`trivia_games_${getTodayKey()}`);
        return stored ? parseInt(stored, 10) || 0 : 0;
      } catch {
        return 0;
      }
    };

    const publishLocalCount = () => {
      if (cancelled) return;
      setGamesPlayedToday(readLocalCount());
      setLimitLoading(false);
    };

    const loadGamesPlayed = async () => {
      setLimitLoading(true);

      if (isLoggedIn && user?.id) {
        try {
          const res = await fetch(`/api/user/daily-trivia-count?userId=${user.id}`);
          const data = await res.json();
          if (cancelled) return;
          // `success: false` used to leave the count at its initial 0 - i.e.
          // five fresh games - instead of falling back like the throw path.
          if (data.success) setGamesPlayedToday(data.count || 0);
          else setGamesPlayedToday(readLocalCount());
          setLimitLoading(false);
        } catch {
          publishLocalCount();
        }
        return;
      }

      // Not logged in YET vs. actually a guest: with a saved session still
      // being restored, hold the flag rather than answer from localStorage.
      if (sessionRestorePending()) {
        waitTimer = setTimeout(publishLocalCount, SESSION_WAIT_MS);
        return;
      }

      publishLocalCount();
    };

    loadGamesPlayed();
    return () => {
      cancelled = true;
      if (waitTimer) clearTimeout(waitTimer);
    };
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
          // Normalize themes using categorySlug to handle "TV & MOVIES" -> "movies" etc.
          const normalizedCategories = data.themes.map((t: string) => categorySlug(t));
          const uniqueSet = new Set<string>(normalizedCategories);
          // Always use DEFAULT_CATEGORIES order - no API reordering
          // This prevents jumping when API returns categories in different order
          setCategories(DEFAULT_CATEGORIES);
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
    // The disabled attribute on the button is presentation, not enforcement:
    // this is the one place that actually has to refuse. Starting while the
    // count is still unknown means `canPlay` is being judged against the
    // initial 0, which is a free extra game.
    if (limitLoading) return;

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

  // Unified Header Component - same structure as QuizzBattle's header (back
  // arrow + accent icon + title/subtitle). It was missing the icon that Battle,
  // Arcade and every other section header carry, which is a big part of why this
  // screen read as plainer/less "game-like" next to Battle Setup.
  // Color adapts to selected category - used by inline headers in each phase.
  const headerColor = selectedCategory ? getTopicColor(selectedCategory) : TRIVIA_ACCENT;

  // Result figures ramp up when the screen appears. Computed HERE, above the
  // phase branches: inside `if (phase === 'result')` these would be conditional
  // hook calls and React would lose the hook order on every phase change.
  const resultAccuracy = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  const isResult = phase === 'result';
  const animAccuracy = useCountUp(resultAccuracy, isResult);
  const animNet = useCountUp(totalEarnings, isResult);
  const animGains = useCountUp(totalGains, isResult);
  const animLosses = useCountUp(totalLosses, isResult);

  // Result Phase - with question review
  if (phase === 'result') {
    const accuracy = resultAccuracy;
    const resultColor = accuracy >= 80 ? '#10b981' : accuracy >= 50 ? '#E36B11' : '#ef4444';
    const resultText = accuracy >= 80 ? 'EXCELLENT!' : accuracy >= 50 ? 'GOOD JOB!' : 'KEEP TRYING!';
    const lastQuestion = questions[questions.length - 1];
    const CategoryIcon = lastQuestion ? (CATEGORY_ICONS[lastQuestion.category] || CATEGORY_ICONS[lastQuestion.category?.toUpperCase()] || HelpCircle) : HelpCircle;
    
    // Question review view
    if (reviewingQuestion !== null && questions[reviewingQuestion]) {
      const q = questions[reviewingQuestion];
      const wasCorrect = answerHistory[reviewingQuestion] === 'correct';
      
      return (
        <div className="flex flex-col h-full min-h-full bg-cream items-center">
          {/* Centered container with max width */}
          <div className="w-full max-w-4xl flex flex-col flex-1">
          <div className="flex-1 m-2 sm:m-4 border border-warm bg-cream rounded-2xl flex flex-col p-4 sm:p-6 shadow-lg min-h-0 overflow-y-auto animate-[cardIn_0.4s_ease-out]">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <button 
                onClick={() => setReviewingQuestion(null)}
                className="px-4 py-2 rounded-lg bg-[#E36B11] text-white font-display text-sm flex items-center gap-2 hover:bg-[#C4772A] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Results
              </button>
              <span className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm uppercase tracking-wider font-display">
                Q{reviewingQuestion + 1}/{questions.length}
              </span>
            </div>
            
            {/* Question */}
            <div className="text-center mb-6 px-4">
              <p className="text-xl sm:text-2xl font-display text-gray-900 leading-relaxed">{q.question}</p>
            </div>
            
            {/* Answers - 2x2 grid */}
            <div className="grid grid-cols-2 gap-3">
              {q.options.map((option, i) => {
                const isCorrectAnswer = i === q.correctIndex;
                const isWrongSelection = !wasCorrect && i === q.correctIndex ? false : (!isCorrectAnswer && answerHistory[reviewingQuestion] !== 'correct');
                
                return (
                  <div 
                    key={i}
                    className={`relative p-4 rounded-xl border-2 flex items-center justify-center text-center ${
                      isCorrectAnswer 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-warm bg-white'
                    }`}
                  >
                    <span className={`font-display text-lg ${isCorrectAnswer ? 'text-green-700' : 'text-gray-700'}`}>
                      {option}
                    </span>
                    {isCorrectAnswer && (
                      <Check className="absolute top-2 right-2 w-5 h-5 text-green-500" />
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Navigation - clickable question numbers */}
            <div className="flex items-center justify-center gap-2 mt-6">
              {questions.map((_, i) => {
                const isActive = reviewingQuestion === i;
                const isCorrect = answerHistory[i] === 'correct';
                return (
                  <button
                    key={i}
                    onClick={() => setReviewingQuestion(i)}
                    className={`w-10 h-10 rounded-xl text-sm font-display flex items-center justify-center transition-all ${
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
          </div>{/* Close max-w-4xl container */}
        </div>
      );
    }
    
    return (
      <div className="flex flex-col h-full min-h-full bg-cream items-center">
        {/* Centered container with max width */}
        <div className="w-full max-w-4xl flex flex-col flex-1">
        {/* overflow-y-auto so a short viewport scrolls instead of clipping the
            buttons - the wrapper now pins a definite height. */}
        <div className="flex-1 m-2 sm:m-4 border border-warm bg-cream rounded-2xl flex flex-col p-4 sm:p-6 shadow-lg min-h-0 overflow-y-auto animate-[cardIn_0.4s_ease-out]">
          
          {/* Header with Back button, Category (centered) and RESULT title */}
          <div className="flex items-center justify-between mb-4 animate-[fadeIn_0.3s_ease-out]">
            <button
              onClick={onBack}
              className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 font-display text-xs text-gray-600 tracking-wider transition-colors flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to arcade
            </button>
            <span 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white uppercase tracking-wider font-display"
              style={{ backgroundColor: headerColor }}
            >
              <CategoryIcon className="w-3.5 h-3.5" />
              {lastQuestion?.category || 'Trivia'}
            </span>
            <span className="font-display text-lg sm:text-xl tracking-[0.15em] text-gray-400">RESULT</span>
          </div>
          <div className="mt-2 rounded-xl border border-warm bg-white/40 px-4 py-4 sm:px-5 sm:py-5 animate-[cardIn_0.45s_ease-out]">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="shrink-0">
                <div
                  className="font-display text-4xl sm:text-5xl leading-none tabular-nums animate-[headlineIn_0.5s_ease-out]"
                  style={{ color: resultColor }}
                >
                  {Math.round(animAccuracy)}%
                </div>
                <div className="font-display text-[11px] sm:text-xs tracking-wide text-gray-500 mt-1">
                  {correctCount} of {questions.length} correct
                </div>
              </div>
              {/* LED bar - same style as countdown, driven by animAccuracy */}
              <div className="flex-1 flex items-center gap-3 min-w-0">
                <div className="flex-1 flex gap-1">
                  {[...Array(10)].map((_, i) => {
                    const threshold = (i + 1) * 10;
                    const isActive = animAccuracy >= threshold;
                    return (
                      <span
                        key={i}
                        className="h-3 sm:h-4 flex-1 rounded transition-all duration-300"
                        style={{
                          backgroundColor: isActive ? resultColor : '#E5E0D8',
                          boxShadow: isActive ? `0 0 6px ${resultColor}` : 'none'
                        }}
                      />
                    );
                  })}
                </div>
                <span className="font-display text-[11px] text-gray-500 tabular-nums shrink-0">{Math.round(animAccuracy)}%</span>
              </div>
            </div>
            <div
              className="font-display text-sm tracking-wider mt-3 animate-[fadeInUp_0.5s_ease-out_0.5s_backwards]"
              style={{ color: resultColor }}
            >
              {resultText}
            </div>
          </div>

          {/* Coins - net first, the two components underneath */}
          <div className="mt-3 rounded-xl border border-warm bg-white/40 px-4 py-4 sm:px-5 flex items-center gap-4 animate-[cardIn_0.45s_ease-out_0.1s_backwards]">
            <img src="/images/bogxcoin.png" alt="" className="w-11 h-11 sm:w-12 sm:h-12 shrink-0 animate-[popIcon_0.45s_ease-out_0.15s_backwards]" />
            <div className="min-w-0">
              <div className={`font-display text-2xl sm:text-3xl leading-none tabular-nums ${totalEarnings >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {animNet >= 0 ? '+' : '-'}{formatCurrency(Math.abs(animNet))} BOGX
              </div>
              <div className="font-display text-[11px] sm:text-xs tracking-wide mt-1.5 tabular-nums">
                <span className="text-green-600">+{formatCurrency(animGains)} earned</span>
                <span className="text-gray-400"> · </span>
                <span className="text-red-500">-{formatCurrency(animLosses)} penalties</span>
              </div>
            </div>
          </div>

          {/* QUESTIONS - tile per question with its outcome. Tiles and their
              icons come in one after another so the round replays itself in
              order instead of the whole row appearing at once. */}
          <div className="flex flex-col mt-4 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
            <span className="font-display text-[10px] text-gray-500 tracking-[0.12em]">Questions</span>
            <div className="grid grid-cols-5 gap-2 sm:gap-3 mt-2">
              {questions.map((_, i) => {
                const isCorrect = answerHistory[i] === 'correct';
                const tileDelay = 0.35 + i * 0.09;
                return (
                  <button
                    key={i}
                    onClick={() => setReviewingQuestion(i)}
                    className={`rounded-xl border flex flex-col items-center justify-center gap-2 py-3 transition-transform hover:scale-[1.03] ${
                      isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                    }`}
                    style={{ animation: `chipIn 0.35s ease-out ${tileDelay}s backwards` }}
                  >
                    <span className={`font-display text-[11px] sm:text-xs ${isCorrect ? 'text-green-700' : 'text-red-600'}`}>
                      Q{i + 1}
                    </span>
                    <span
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                        isCorrect ? 'bg-green-100' : 'bg-red-100'
                      }`}
                      style={{ animation: `popIcon 0.35s ease-out ${tileDelay + 0.12}s backwards` }}
                    >
                      {isCorrect
                        ? <Check className="w-4 h-4 text-green-600" />
                        : <X className="w-4 h-4 text-red-500" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Buttons - last in, after the tiles have finished */}
          <div
            className="flex items-center gap-3 mt-4 pt-4"
            style={{ borderTop: '1px solid rgba(0,0,0,0.07)', animation: 'fadeInUp 0.45s ease-out 0.85s backwards' }}
          >
            {/* Jumps straight to the first wrong answer - the reason to open the
                review at all. With a clean round there is nothing to correct,
                so it reviews from Q1 instead. */}
            <button
              onClick={() => {
                const firstWrong = answerHistory.findIndex((a) => a !== 'correct');
                setReviewingQuestion(firstWrong >= 0 ? firstWrong : 0);
              }}
              className="flex-1 py-3 border border-warm bg-cream hover:bg-white text-gray-600 font-display text-xs sm:text-sm tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              {wrongCount > 0 ? 'Review mistakes' : 'Review answers'}
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
                setReviewingQuestion(null);
              }}
              className="group flex-1 py-3 text-white font-display text-xs sm:text-sm tracking-widest rounded-xl transition-all flex items-center justify-center relative hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]"
              style={{ background: `linear-gradient(135deg, ${resultColor}dd 0%, ${resultColor} 100%)` }}
            >
              Play again
              <ArrowRight className="w-4 h-4 absolute right-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
        </div>{/* Close max-w-4xl container */}
      </div>
    );
  }

  // Countdown Phase - Solo layout (no opponent) - SAME AS PLAYING PHASE
  if (phase === 'countdown' && currentQuestion) {
    const isGo = countdown === 0;
    const CategoryIcon = CATEGORY_ICONS[currentQuestion.category] || CATEGORY_ICONS[currentQuestion.category?.toUpperCase()] || HelpCircle;
    
    return (
      <div className="flex flex-col h-full min-h-full bg-cream items-center">
        {/* Centered container with max width */}
        <div className="w-full max-w-4xl flex flex-col flex-1">
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
              <div className="font-display text-[9px] sm:text-xs text-gray-500 tabular-nums">
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
                  : 'linear-gradient(135deg, #B0B8C4dd 0%, #B0B8C4 100%)',
                boxShadow: isGo 
                  ? '0 0 25px rgba(16,185,129,0.6), inset 0 0 0 2px rgba(16,185,129,0.4)' 
                  : '0 0 20px rgba(176,184,196,0.4), inset 0 0 0 2px rgba(176,184,196,0.4)',
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
                      backgroundColor: isActive ? (isGo ? '#10b981' : '#B0B8C4') : '#E5E0D8',
                      boxShadow: isActive ? `0 0 8px ${isGo ? '#10b981' : '#B0B8C4'}` : 'none'
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
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
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
        </div>{/* Close max-w-4xl container */}
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
    // Use the category color, not hardcoded orange
    const preparingColor = selectedCategory ? getTopicColor(selectedCategory) : TRIVIA_ACCENT;

    return (
      <div className="w-full h-full min-h-full flex-1 flex flex-col items-center" style={{ backgroundColor: '#F5F0E8' }}>
        {/* Centered container with max width */}
        <div className="w-full max-w-4xl flex flex-col flex-1">
        {/* Back returns to the category selection, not out of the game - the player
            is mid-setup here, not mid-round. Inline header to ensure click handler works. */}
        <div className="px-4 pt-4 pb-3 border-b border-warm bg-cream">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => { setPhase('setup'); setQuestions([]); }} 
              className="p-1 rounded transition-colors"
              style={{ backgroundColor: `${preparingColor}15` }}
            >
              <ChevronLeft className="w-5 h-5" style={{ color: preparingColor }} />
            </button>
            <Brain className="w-5 h-5" style={{ color: preparingColor }} />
            <div>
              <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">Solo Trivia</span>
              <span className="text-[10px] text-gray-500 -mt-0.5 block">Answer fast, earn coins.</span>
            </div>
          </div>
        </div>
        <PreparingScreen
          topicColor={preparingColor}
          TopicIcon={CategoryIcon}
          topicId={selectedCategory ? categorySlug(selectedCategory) : undefined}
          topicLabel={categoryName}
          // Battle shows a "3 ROUNDS" pill under the heading here; Solo Trivia
          // never passed this prop even though the component supports it, so
          // the ring looked plainer next to Battle's for no real reason.
          rounds={QUESTION_COUNT}
          subtitle={`Loading ${QUESTION_COUNT} questions`}
          readySubtitle={`${QUESTION_COUNT} questions ready`}
          // Holds the ring short of full until the questions have really arrived.
          dataReady={!loading && questions.length > 0}
          onStart={runCountdown}
        >
          {/* Round Info Card - same height as setup screen's info panel */}
          <div className="w-full max-w-sm sm:max-w-none bg-cream border border-warm rounded-xl p-3 sm:p-4 mb-4">
            {/* Desktop: 4 columns like setup screen */}
            <div className="hidden sm:flex sm:items-stretch sm:justify-center text-center">
              {/* Per correct answer */}
              <div className="flex-1 flex flex-col items-center justify-center py-2 px-3">
                <div className="flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4 text-green-500" />
                  <span className="font-display text-base text-green-600 tabular-nums">+{maxPoints.toFixed(2)}</span>
                </div>
                <span className="font-display text-[10px] tracking-wide text-gray-500 mt-0.5">Per correct answer</span>
              </div>
              
              {/* Separator */}
              <div className="w-px self-stretch my-1" style={{ backgroundColor: `${preparingColor}20` }} />
              
              {/* Per wrong answer */}
              <div className="flex-1 flex flex-col items-center justify-center py-2 px-3">
                <div className="flex items-center gap-1.5">
                  <MinusCircle className="w-4 h-4 text-red-500" />
                  <span className="font-display text-base text-red-500 tabular-nums">-{wrongPenalty.toFixed(2)}</span>
                </div>
                <span className="font-display text-[10px] tracking-wide text-gray-500 mt-0.5">Per wrong answer</span>
              </div>
              
              {/* Separator */}
              <div className="w-px self-stretch my-1" style={{ backgroundColor: `${preparingColor}20` }} />
              
              {/* Max win */}
              <div className="flex-1 flex flex-col items-center justify-center py-2 px-3">
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span className="font-display text-base text-green-600 tabular-nums">+{(maxPoints * QUESTION_COUNT).toFixed(2)}</span>
                </div>
                <span className="font-display text-[10px] tracking-wide text-gray-500 mt-0.5">Max win (5 correct)</span>
              </div>
              
              {/* Separator */}
              <div className="w-px self-stretch my-1" style={{ backgroundColor: `${preparingColor}20` }} />
              
              {/* Max loss */}
              <div className="flex-1 flex flex-col items-center justify-center py-2 px-3">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-red-400" />
                  <span className="font-display text-base text-red-500 tabular-nums">-{(wrongPenalty * QUESTION_COUNT).toFixed(2)}</span>
                </div>
                <span className="font-display text-[10px] tracking-wide text-gray-500 mt-0.5">Max loss (5 wrong)</span>
              </div>
            </div>
            
            {/* Mobile: compact 2x2 grid with icons */}
            <div className="sm:hidden">
              {/* Correct / Wrong side by side */}
              <div className="flex">
                <div className="flex-1 flex flex-col items-center py-1.5">
                  <div className="flex items-center gap-1">
                    <PlusCircle className="w-3.5 h-3.5 text-green-500" />
                    <span className="font-display text-sm text-green-600 tabular-nums">+{maxPoints.toFixed(2)}</span>
                  </div>
                  <span className="font-display text-[8px] tracking-wide text-gray-500 mt-0.5">Per correct</span>
                </div>
                <div className="w-px" style={{ backgroundColor: `${preparingColor}20` }} />
                <div className="flex-1 flex flex-col items-center py-1.5">
                  <div className="flex items-center gap-1">
                    <MinusCircle className="w-3.5 h-3.5 text-red-500" />
                    <span className="font-display text-sm text-red-500 tabular-nums">-{wrongPenalty.toFixed(2)}</span>
                  </div>
                  <span className="font-display text-[8px] tracking-wide text-gray-500 mt-0.5">Per wrong</span>
                </div>
              </div>
              
              {/* Divider */}
              <div className="mt-1 pt-1 flex" style={{ borderTop: `1px solid ${preparingColor}20` }}>
                <div className="flex-1 flex flex-col items-center py-1.5">
                  <div className="flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span className="font-display text-sm text-green-600 tabular-nums">+{(maxPoints * QUESTION_COUNT).toFixed(2)}</span>
                  </div>
                  <span className="font-display text-[8px] tracking-wide text-gray-500 mt-0.5">Max win (5 correct)</span>
                </div>
                <div className="w-px" style={{ backgroundColor: `${preparingColor}20` }} />
                <div className="flex-1 flex flex-col items-center py-1.5">
                  <div className="flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-red-400" />
                    <span className="font-display text-sm text-red-500 tabular-nums">-{(wrongPenalty * QUESTION_COUNT).toFixed(2)}</span>
                  </div>
                  <span className="font-display text-[8px] tracking-wide text-gray-500 mt-0.5">Max loss (5 wrong)</span>
                </div>
              </div>
            </div>
            
            {/* Footer line - same as setup screen */}
            <p className="font-display text-[9px] sm:text-xs tracking-wide text-gray-500 text-center mt-1.5 pt-1.5 sm:mt-4 sm:pt-3" style={{ borderTop: `1px solid ${preparingColor}30` }}>5 Questions · 10 sec each · Faster = more points</p>
          </div>
        </PreparingScreen>
        </div>{/* Close max-w-4xl container */}
      </div>
    );
  }

  // Setup Phase - Redesigned like QuizzBattle
  if (phase === 'setup') {
    // Accent color based on selected category
    const accentColor = selectedCategory ? getTopicColor(selectedCategory) : '#E36B11';
    // Shared by the stake panel AND the selected tab, so the tab can cover the
    // panel's top border with the exact same colour and the seam disappears.
    const panelFill = mixHex(accentColor, CREAM, 0.06);
    // One frame colour for the tab and the panel it flows into - they have to
    // match in BOTH states, or the tab's sides meet a different-coloured edge.
    // Muted while step 2 is still inert, so the dimmed block does not shout.
    const frameColor = selectedCategory ? accentColor : `${accentColor}30`;
    // Which stake tile is the tab - the panel squares the corner underneath it
    // when it sits at either end of the row.
    const activeStakeIndex = POINT_OPTIONS.findIndex((p) => p === maxPoints);
    // Quarter-circle fillet joining the tab's side border to the panel's top
    // border. Half-pixel ramps on each stop keep the arc from looking jagged.
    const filletGradient = (at: string) =>
      `radial-gradient(circle at ${at}, transparent ${TAB_RADIUS - frameW - 0.5}px, ${frameColor} ${TAB_RADIUS - frameW}px, ${frameColor} ${TAB_RADIUS - 0.5}px, ${panelFill} ${TAB_RADIUS}px)`;

    return (
      <div className="w-full h-full min-h-full flex-1 flex flex-col items-center relative" style={{ backgroundColor: CREAM }}>
        {/* Centered container with max width for consistent layout */}
        <div className="w-full max-w-4xl flex flex-col flex-1">
        {/* Inline header to ensure click handler works */}
        <div className="relative px-4 pt-4 pb-3 border-b border-warm bg-cream">
          {limitLoading && (
            <div className="absolute left-0 right-0 -bottom-px h-0.5 overflow-hidden" style={{ backgroundColor: `${accentColor}20` }}>
              <div
                className="h-full w-2/5 rounded-full animate-[loadingBar_1.1s_ease-in-out_infinite]"
                style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
              />
            </div>
          )}
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack} 
              className="p-1 rounded transition-colors"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              <ChevronLeft className="w-5 h-5" style={{ color: accentColor }} />
            </button>
            <Brain className="w-5 h-5" style={{ color: accentColor }} />
            <div>
              <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">Solo Trivia</span>
              <span className="text-[10px] text-gray-500 -mt-0.5 block">Answer fast, earn coins.</span>
            </div>
            {/* Remaining games belong next to the title, not under the Start
                button: it is a precondition for playing, so it has to be
                readable BEFORE scrolling through category and stake - at the
                bottom it was only found after the decision was already made. */}
            <div
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap"
              style={canPlay || limitLoading ? { backgroundColor: `${accentColor}15`, color: accentColor } : { backgroundColor: '#fee2e2', color: '#dc2626' }}
              aria-busy={limitLoading}
            >
              {limitLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
                  <span className="relative block h-2.5 w-24 rounded-full overflow-hidden" style={{ backgroundColor: `${accentColor}25` }}>
                    <span
                      className="absolute inset-0 -translate-x-full animate-[shimmer_1.2s_infinite]"
                      style={{ background: `linear-gradient(90deg, transparent, ${accentColor}55, transparent)` }}
                    />
                  </span>
                  <span className="sr-only">Loading games left today</span>
                </>
              ) : (
                <span key="limit" className="flex items-center gap-1.5 animate-[fadeIn_0.3s_ease-out]">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  {canPlay ? `${gamesRemaining} games left today` : 'No games left today'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* min-h-0 is what makes overflow-y-auto work here. A flex item's
            min-height defaults to `auto`, so without it this box refuses to
            shrink below its content, grows past the viewport and the parent
            clips it instead of scrolling - the setup screen was cut off on
            mobile once the category grid and the stake panel got taller. */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: 'none' }}>
          {/* Step 1: Choose Category - 4x4 Grid */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span 
                className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                style={{ backgroundColor: accentColor }}
              >1</span>
              <span className="font-display text-base text-gray-900 uppercase">Choose Category</span>
            </div>
            {/* Horizontal swipeable row on mobile, 3-column grid on larger screens */}
            <div className="flex gap-2 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
              {(categories.length > 0 ? categories : DEFAULT_CATEGORIES).map((cat: string) => {
                const slug = categorySlug(cat);
                const Icon = categoryIcon(cat);
                const displayName = slug === 'all' ? 'Mixed' : cat.charAt(0).toUpperCase() + cat.slice(1);
                const imageUrl = CATEGORY_IMAGES[slug] || CATEGORY_IMAGES['all'];
                const catColor = getTopicColor(slug);
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className="group hover-shine relative flex-shrink-0 w-28 h-20 sm:w-auto sm:h-24 rounded-xl transition-all border-2 overflow-hidden"
                    style={{
                      borderColor: isSelected ? catColor : 'transparent',
                      boxShadow: isSelected ? `0 0 0 3px ${catColor}33` : 'none',
                    }}
                  >
                    {/* Artwork */}
                    <div 
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-110"
                      style={{ backgroundImage: `url(${imageUrl})` }}
                    />
                    {/* Gradient overlay - uses category color when selected */}
                    <div 
                      className="absolute inset-0 transition-all duration-300"
                      style={{
                        background: isSelected 
                          ? `linear-gradient(to top, ${catColor} 0%, ${catColor}cc 40%, ${catColor}99 100%)`
                          : 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)'
                      }}
                    />
                    {/* Checkmark badge */}
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5 z-20 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white flex items-center justify-center shadow">
                        <Check className="w-3 h-3 sm:w-4 sm:h-4" strokeWidth={3} style={{ color: catColor }} />
                      </span>
                    )}
                    {/* Icon next to the label */}
                    <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5">
                      <Icon className="w-4 h-4 sm:w-6 sm:h-6 text-white/90 drop-shadow" />
                      <span 
                        className={`font-display uppercase tracking-wider text-white drop-shadow-lg transition-all duration-300 group-hover:translate-x-1 ${
                          isSelected ? 'text-sm sm:text-xl font-bold' : 'text-xs sm:text-base'
                        }`}
                      >{displayName}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Choose Points Value - disabled until category selected */}
          <div className={`mt-4 transition-opacity ${selectedCategory ? '' : 'opacity-40 pointer-events-none'}`}>
            <div className="flex items-center gap-2 mb-3">
              <span 
                className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                style={{ backgroundColor: selectedCategory ? accentColor : '#9ca3af' }}
              >2</span>
              <span className="font-display text-base text-gray-900 uppercase">Choose Correct Answer Value</span>
            </div>
            {/* The selected value is a TAB that hangs into the panel below: it
                drops its bottom corners and its bottom border and overlaps the
                panel's top edge by 2px, so the two read as one shape. That is
                what ties a chosen stake to the numbers it produces - as two
                separate boxes with a gap between them, the panel looked like
                unrelated info rather than the consequence of the pick. */}
            {/* No overflow-x here on purpose: `overflow-x: auto` forces the Y axis
                to a non-visible value too, which clipped the 2px cover strip the
                tab hangs below itself. The tiles shrink instead of scrolling.
                No negative margin on the ROW either: that pulled every tile over
                the panel's top border, and since the inactive tiles are
                translucent the border showed through dimmed under them and at
                full strength in the gaps - the row grew little purple drips.
                Only the active tab may reach into the panel. */}
            <div className="relative z-10 flex gap-1.5 sm:gap-2">
              {POINT_OPTIONS.map((points) => {
                const penalty = Math.round(points * PENALTY_RATE * 100) / 100;
                // The tab exists in BOTH states: 0.30 is a real default stake and
                // the panel below already shows its numbers, so hiding the tab
                // while the block is dimmed left the panel looking unattached.
                // It is the frame COLOUR that conveys "not active yet".
                const isActive = maxPoints === points;
                return (
                  <button
                    key={points}
                    onClick={() => {
                      setMaxPoints(points);
                      setWrongPenalty(penalty);
                      setCurrentPoints(points);
                    }}
                    disabled={!selectedCategory}
                    // Active tab: rounded TOP, straight sides running all the way
                    // down. The rounding at the bottom is NOT on the tab itself -
                    // it is the two concave fillets below, which flare OUTWARD
                    // into the panel. A rounded-xl bottom curved the sides INWARD
                    // instead, so the tab pinched in where it should widen.
                    // Inactive tiles stop TILE_GAP short of the panel line, the
                    // active one runs down to it (the row stretches every tile to
                    // the same height, the margin only shortens the inactive ones).
                    // Flush inactive tiles sat right on the line and crowded the
                    // fillet; the gap is the free space the curve sweeps through.
                    className={`relative flex-1 min-w-0 px-1 py-2 sm:p-3 flex flex-col items-center text-center transition-all ${
                      isActive ? 'rounded-t-xl rounded-b-none' : 'rounded-xl'
                    }`}
                    style={{
                      // The border is always 1.5px (transparent when unselected), so
                      // picking a value cannot change the tile's width and shift the row.
                      borderWidth: frameW,
                      borderStyle: 'solid',
                      borderColor: isActive ? frameColor : 'transparent',
                      // Bottom edge is dropped on the active tab so it opens into
                      // the panel rather than closing itself off above it.
                      borderBottomColor: 'transparent',
                      // Opaque and identical to the panel fill - see mixHex.
                      backgroundColor: isActive ? panelFill : `${accentColor}08`,
                      marginBottom: isActive ? 0 : TILE_GAP,
                    }}
                  >
                    <div className="flex items-center gap-0.5">
                      <img src="/images/bogxcoin.png" alt="" className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="font-display text-base sm:text-xl text-gray-900">{formatCurrency(points)}</span>
                    </div>
                    <span className="font-display text-[8px] sm:text-[9px] text-red-500 mt-0.5 tabular-nums">-{formatCurrency(penalty)}</span>
                    {/* Cuts the panel's top border open under the tab.
                        Offsets on an absolutely positioned child are measured from
                        the PADDING box: bottom -4 / height 4 spans the tab's own
                        2px bottom border plus the panel's 2px border below it.
                        left/right 0 = inside the tab's side borders, which stay. */}
                    {isActive && (
                      <span
                        aria-hidden
                        className="absolute pointer-events-none"
                        style={{ left: 0, right: 0, bottom: -2 * frameW, height: 2 * frameW, backgroundColor: panelFill }}
                      />
                    )}
                    {/* Concave fillets: the tab's side border bends OUTWARD into
                        the panel's top border along a quarter circle.
                        Each is an r x r square whose radial gradient is centred on
                        its OUTER top corner: inside r-2 -> transparent (the gap
                        between tiles), r-2..r -> the 2px frame arc, beyond r ->
                        panel fill. At the square's top edge the arc band lands
                        exactly on the tab's 2px side border, at its bottom edge on
                        the panel's 2px top border, so both join tangentially.
                        Skipped on the outer side of the first/last tile: there is
                        no panel to flare into, the side runs straight down into the
                        panel's squared corner instead. */}
                    {/* On the outer side the transparent bottom border takes half
                        of the bottom corner's diagonal with it, leaving a visible
                        notch where the side meets the panel's squared corner. The
                        2x4 patch re-draws that corner in the frame colour.
                        Verified headless in Chrome for first/middle/last. */}
                    {isActive && (activeStakeIndex !== 0 ? (
                      <span
                        aria-hidden
                        className="absolute pointer-events-none"
                        style={{
                          left: -TAB_RADIUS, bottom: -2 * frameW, width: TAB_RADIUS, height: TAB_RADIUS,
                          background: filletGradient('0 0'),
                        }}
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="absolute pointer-events-none"
                        style={{ left: -frameW, bottom: -2 * frameW, width: frameW, height: 2 * frameW, backgroundColor: frameColor }}
                      />
                    ))}
                    {isActive && (activeStakeIndex !== POINT_OPTIONS.length - 1 ? (
                      <span
                        aria-hidden
                        className="absolute pointer-events-none"
                        style={{
                          right: -TAB_RADIUS, bottom: -2 * frameW, width: TAB_RADIUS, height: TAB_RADIUS,
                          background: filletGradient('100% 0'),
                        }}
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="absolute pointer-events-none"
                        style={{ right: -frameW, bottom: -2 * frameW, width: frameW, height: 2 * frameW, backgroundColor: frameColor }}
                      />
                    ))}
                  </button>
                );
              })}
            </div>

          {/* Info Box - the numbers the selected stake produces. Full accent
              border only once a category is chosen, so the tab above continues
              into the same colour; while the block is still inert it stays a
              faint tint instead of shouting in the accent colour.

              The corner under an outer tab is squared: the first/last tile's
              side border is flush with the panel's edge, so a 12px radius curved
              away from it and the frame visibly tore open there. */}
          <div 
            className={`p-2 sm:p-5 rounded-xl ${
              activeStakeIndex === 0 ? 'rounded-tl-none' : ''
            } ${activeStakeIndex === POINT_OPTIONS.length - 1 ? 'rounded-tr-none' : ''}`}
            style={{ 
              backgroundColor: panelFill,
              border: `${frameW}px solid ${frameColor}`,
            }}
          >
            {/* Desktop: 4 columns with icons like original */}
            <div className="hidden sm:flex sm:items-stretch sm:justify-center text-center">
              {/* Per correct answer */}
              <div className="flex-1 flex flex-col items-center justify-center py-2 px-3">
                <div className="flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4 text-green-500" />
                  <span className="font-display text-base text-green-600 tabular-nums">+{formatCurrency(displayCorrect)}</span>
                </div>
                <span className="font-display text-[10px] tracking-wide text-gray-500 mt-0.5">Per correct answer</span>
              </div>
              
              {/* Separator */}
              <div className="w-px self-stretch my-1" style={{ backgroundColor: `${accentColor}20` }} />
              
              {/* Per wrong answer */}
              <div className="flex-1 flex flex-col items-center justify-center py-2 px-3">
                <div className="flex items-center gap-1.5">
                  <MinusCircle className="w-4 h-4 text-red-500" />
                  <span className="font-display text-base text-red-500 tabular-nums">-{formatCurrency(displayWrong)}</span>
                </div>
                <span className="font-display text-[10px] tracking-wide text-gray-500 mt-0.5">Per wrong answer</span>
              </div>
              
              {/* Separator */}
              <div className="w-px self-stretch my-1" style={{ backgroundColor: `${accentColor}20` }} />
              
              {/* Max win */}
              <div className="flex-1 flex flex-col items-center justify-center py-2 px-3">
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span className="font-display text-base text-green-600 tabular-nums">+{formatCurrency(displayMaxWin)}</span>
                </div>
                <span className="font-display text-[10px] tracking-wide text-gray-500 mt-0.5">Max win (5 correct)</span>
              </div>
              
              {/* Separator */}
              <div className="w-px self-stretch my-1" style={{ backgroundColor: `${accentColor}20` }} />
              
              {/* Max loss */}
              <div className="flex-1 flex flex-col items-center justify-center py-2 px-3">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-red-400" />
                  <span className="font-display text-base text-red-500 tabular-nums">-{formatCurrency(displayMaxLoss)}</span>
                </div>
                <span className="font-display text-[10px] tracking-wide text-gray-500 mt-0.5">Max loss (5 wrong)</span>
              </div>
            </div>
            
            {/* Mobile layout - 2x2 grid compact with icons */}
            <div className="sm:hidden">
              {/* Correct / Wrong side by side */}
              <div className="flex">
                <div className="flex-1 flex flex-col items-center py-1.5">
                  <div className="flex items-center gap-1">
                    <PlusCircle className="w-3.5 h-3.5 text-green-500" />
                    <span className="font-display text-sm text-green-600 tabular-nums">+{formatCurrency(displayCorrect)}</span>
                  </div>
                  <span className="font-display text-[8px] tracking-wide text-gray-500 mt-0.5">Per correct</span>
                </div>
                <div className="w-px" style={{ backgroundColor: `${accentColor}20` }} />
                <div className="flex-1 flex flex-col items-center py-1.5">
                  <div className="flex items-center gap-1">
                    <MinusCircle className="w-3.5 h-3.5 text-red-500" />
                    <span className="font-display text-sm text-red-500 tabular-nums">-{formatCurrency(displayWrong)}</span>
                  </div>
                  <span className="font-display text-[8px] tracking-wide text-gray-500 mt-0.5">Per wrong</span>
                </div>
              </div>
              
              {/* Divider */}
              <div className="mt-1 pt-1 flex" style={{ borderTop: `1px solid ${accentColor}20` }}>
                <div className="flex-1 flex flex-col items-center py-1.5">
                  <div className="flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span className="font-display text-sm text-green-600 tabular-nums">+{formatCurrency(displayMaxWin)}</span>
                  </div>
                  <span className="font-display text-[8px] tracking-wide text-gray-500 mt-0.5">Max win (5 correct)</span>
                </div>
                <div className="w-px" style={{ backgroundColor: `${accentColor}20` }} />
                <div className="flex-1 flex flex-col items-center py-1.5">
                  <div className="flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-red-400" />
                    <span className="font-display text-sm text-red-500 tabular-nums">-{formatCurrency(displayMaxLoss)}</span>
                  </div>
                  <span className="font-display text-[8px] tracking-wide text-gray-500 mt-0.5">Max loss (5 wrong)</span>
                </div>
              </div>
            </div>
            
            <p className="font-display text-[9px] sm:text-xs tracking-wide text-gray-500 text-center mt-1.5 pt-1.5 sm:mt-4 sm:pt-3" style={{ borderTop: `1px solid ${accentColor}30` }}>5 Questions · 10 sec each · Faster = more points</p>
          </div>
          {/* Closes the step-2 wrapper. The panel lives INSIDE it so tab row and
              panel share one opacity group while inert: with an opacity-40 on
              each, the tab's cover strip was itself 40% and only half hid the
              panel border under it, so the seam came back in the dimmed state. */}
          </div>

          {/* Daily games remaining moved into the header next to the title. */}

          {/* Start Button - full width of the panel above, the primary action
              of the whole screen. hover:scale is toned down to 1.01: at full
              width a 2% grow pushed the edges visibly past the panel. */}
          <div className="flex flex-col items-center mt-4 gap-3">
            <button
              onClick={startGame}
              disabled={loading || !canPlay || limitLoading || !selectedCategory}
              /* `limitLoading` is part of the ready test here too. Without it
                 the button looked fully enabled (orange, hover scale) while the
                 allowance was still unknown, so it invited the very click the
                 disabled attribute then swallowed. */
              className={`w-full py-3.5 rounded-2xl text-white font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 whitespace-nowrap ${
                canPlay && selectedCategory && !limitLoading ? 'hover:scale-[1.01] active:scale-[0.99]' : 'opacity-50 cursor-not-allowed'
              } disabled:opacity-50`}
              style={{
                background: canPlay && selectedCategory && !limitLoading
                  ? `linear-gradient(135deg, ${accentColor}cc 0%, ${accentColor} 50%, ${accentColor}99 100%)`
                  : '#9CA3AF'
              }}
            >
              {limitLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Play className="w-5 h-5" />
              )}
              {limitLoading
                ? 'CHECKING GAMES LEFT'
                : !selectedCategory ? 'SELECT CATEGORY' : canPlay ? 'START GAME' : 'TOMORROW'}
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
            <button style={{ color: accentColor }} className="hover:underline">How it works</button>
          </div>
        </div>
        </div>{/* Close max-w-4xl container */}
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
      <div className="flex flex-col h-full min-h-full bg-cream items-center">
        {/* Centered container with max width */}
        <div className="w-full max-w-4xl flex flex-col flex-1">
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
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
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
        </div>{/* Close max-w-4xl container */}
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
