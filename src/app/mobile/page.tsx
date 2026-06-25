"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Bell, Vote, X, Trophy, Swords, TrendingUp, ChevronLeft } from "lucide-react";
import { sounds } from "@/utils/sounds";
import BettingGame, { BetData } from "@/components/games/BettingGame";
import GuessGame from "@/components/games/GuessGame";
import QuizGame from "@/components/games/QuizGame";
import AdGame from "@/components/games/AdGame";
import SurpriseReel from "@/components/games/SurpriseReel";
import ComingSoonReel from "@/components/games/ComingSoonReel";
import VideoGame from "@/components/games/VideoGame";
import GoalWallGame from "@/components/games/GoalWallGame";
import Header from "@/components/Header";
import RewardsPage from "@/components/RewardsPage";
import BottomNav, { NavTab } from "@/components/BottomNav";
import RankingsPage from "@/components/RankingsPage";
import ShopPage from "@/components/ShopPage";
import TVPage from "@/components/TVPage";
import BattlesPage from "@/components/BattlesPage";
import ArcadePage from "@/components/ArcadePage";
import GenXManGame from "@/components/games/GenXManGame";
import PredictionsGame from "@/components/games/PredictionsGame";
import SoloTriviaGame from "@/components/games/SoloTriviaGame";
import ArticlesListPage from "@/components/ArticlesListPage";
import CoinAnimation from "@/components/CoinAnimation";
import LandingPage from "@/components/games/WelcomeReel";
import WelcomeBonusCard from "@/components/games/WelcomeBonusCard";
import BonusAdCard from "@/components/games/BonusAdCard";
import JustForFunModal from "@/components/JustForFunModal";
import LoginPage from "@/components/LoginPage";
import LoginRequiredModal from "@/components/LoginRequiredModal";
import JoinChallengePage from "@/components/JoinChallengePage";
import NotificationPage from "@/components/NotificationPage";
import SwipeWarningModal from "@/components/SwipeWarningModal";
import SkipPenaltyModal from "@/components/SkipPenaltyModal";
import ProfilePage from "@/components/ProfilePage";
import NoFundsModal from "@/components/NoFundsModal";
import PushNotifications from "@/components/PushNotifications";
import SummaryCard from "@/components/games/SummaryCard";
import CheckoutSuccessModal from "@/components/CheckoutSuccessModal";
import DevLockScreen from "@/components/DevLockScreen";
import InstallBanner from "@/components/InstallBanner";
import ArticlePage from "@/components/ArticlePage";
import AuthorPage from "@/components/AuthorPage";
import RankrollPage from "@/components/RankrollPage";
import RankingPollCard from "@/components/RankingPollCard";
import WelcomeBackModal, { WelcomeBackRankChange } from "@/components/WelcomeBackModal";
import { useAuth } from "@/context/AuthContext";
import { useBogxCoins } from "@/hooks/useBogxCoins";
import { usePendingWager } from "@/hooks/usePendingWager";
import { useSearchParams } from "next/navigation";

// Active bet type (for betting games)
interface ActiveBet {
  id: string;
  matchId: string;
  prediction: string;
  amount: number;
  odds: number;
  potentialWin: number;
  status: 'pending' | 'won' | 'lost';
}

const adData = {
  nike: {
    brand: "Nike",
    title: "Just Do It",
    description: "The new Nike Air Max Collection",
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800",
    videoUrl: "/videos/bball.mp4",
    duration: 5,
    question: "What team color was the player who dunked?",
    options: ["Red-White", "Blue-Gold", "Green-Black", "Purple-Yellow"],
    correctAnswer: 1,
    reward: 50,
  },
  bwin: {
    brand: "Bwin",
    title: "Live Betting",
    description: "The best platform for sports betting",
    imageUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800",
    videoUrl: "/videos/freude.mp4",
    duration: 5,
    question: "What color was the logo?",
    options: ["Orange", "Violet", "Yellow", "Green"],
    correctAnswer: 0,
    reward: 50,
    brandColor: "gold" as const,
  },
  bwin2: {
    brand: "Bwin",
    title: "Live Betting",
    description: "The best platform for sports betting",
    imageUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800",
    videoUrl: "/videos/freude.mp4",
    duration: 5,
    question: "How many people were shown in the video?",
    options: ["1", "2", "3", "4"],
    correctAnswer: 1,
    reward: 50,
    brandColor: "gold" as const,
  },
};

// New format: Card with questions array
interface QuestionVariant {
  question: string;
  options: (string | number)[];
  correctAnswer: string | number;
  highlightWords: string[];
  difficulty: number;
  difficultyText: string;
  maxReward: number;
}

interface CardFromDB {
  _id: string;
  type: string;
  theme: string;
  topic: string;
  questions: QuestionVariant[];
  timeLimit: number;
  previewImage?: string;
  playerImage?: string;
  active: boolean;
  guestCard?: boolean;
  gameDate?: string;
}

// Flattened card for display (one per difficulty)
interface CardData {
  _id: string;
  theme: string;
  topic?: string;
  maxReward: number;
  difficulty: number;
  difficultyText: string;
  question: string;
  highlightWords: string[];
  previewImage?: string;
  playerImage?: string;
  options: (string | number)[];
  correctAnswer: string | number;
  timeLimit: number;
  active: boolean;
  guestCard?: boolean;
}

export default function MobilePage() {
  const { user, isLoggedIn, guestGamesPlayed, canPlayMore, incrementGuestGames, updateUser, syncPointsToDb } = useAuth();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showRewards, setShowRewards] = useState(false);
  // Central BOGX hook - same source of truth on Desktop AND Mobile
  const { coins, setCoins } = useBogxCoins(user?.id);
  // Pending wager indicator - global source of truth (same on mobile & desktop)
  const { hasPendingWager } = usePendingWager(user?.id);
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    if (typeof window !== 'undefined') {
      // Use sessionStorage - only persists during browser session (refresh), not across visits
      const saved = sessionStorage.getItem('activeTab');
      if (saved && ['home', 'arcade', 'articles', 'voting', 'shop', 'tv', 'notifications', 'profile', 'rankings', 'battles'].includes(saved)) {
        return saved as NavTab;
      }
    }
    return "home";
  });
  const [previousTab, setPreviousTab] = useState<NavTab>("home"); // Track previous tab for toggle back
  
  // Persist activeTab to sessionStorage (only for refresh, not across browser sessions)
  useEffect(() => {
    sessionStorage.setItem('activeTab', activeTab);
  }, [activeTab]);
  const [arcadeGame, setArcadeGame] = useState<string | null>(null); // Which game is active in Arcade (e.g. 'quizzbattle')
  const [radioOpen, setRadioOpen] = useState(false);
  const eqBarsMobile = useMemo(() =>
    Array.from({ length: 40 }).map((_, i) => ({
      duration: `${(0.3 + Math.random() * 0.4).toFixed(2)}s`,
      delay: `${((i * 0.02) % 0.3).toFixed(2)}s`,
      height: `${Math.floor(30 + Math.random() * 70)}%`,
    })), []);
  const [activeStation, setActiveStation] = useState<string>('techno');
  const [showSongRequest, setShowSongRequest] = useState(false);
  const [songRequestData, setSongRequestData] = useState({ playlist: '', band: '', song: '', link: '' });
  const [songRequestSent, setSongRequestSent] = useState(false);
  
  // Radio stations - loaded from DB
  const [radioStations, setRadioStations] = useState<{_id: string; name: string; description: string; playlistId: string; imageUrl?: string}[]>([]);
  const [activeBets, setActiveBets] = useState<ActiveBet[]>([]);
  const [hasBettingBetPlaced, setHasBettingBetPlaced] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [coinAnimation, setCoinAnimation] = useState<{ show: boolean; amount: number; variant?: 'gain' | 'loss' | 'hold' }>({ show: false, amount: 0 });
  const [coinAnimKey, setCoinAnimKey] = useState(0);
  const [showJustForFun, setShowJustForFun] = useState(false);
    const [showLoginPage, setShowLoginPage] = useState(false);
  const [showLoginRequired, setShowLoginRequired] = useState(false);
  const [loginInitialView, setLoginInitialView] = useState<'login' | 'signup'>('login');
  const [showJoinChallengePage, setShowJoinChallengePage] = useState(false);
  // showNotificationPage removed - now using activeTab === 'notifications'
  const [notificationAutoEnable, setNotificationAutoEnable] = useState<'email' | 'sms' | null>(null);
  const [hasShownJustForFun, setHasShownJustForFun] = useState(false);
  const [challengeActive, setChallengeActive] = useState(false);
  const [swipeBlocked, setSwipeBlocked] = useState(false);
  const [showSwipeWarning, setShowSwipeWarning] = useState(false);
  const [pendingSwipeIndex, setPendingSwipeIndex] = useState<number | null>(null);
  const [currentReward, setCurrentReward] = useState(50);
  const [bwinQuestionIndex, setBwinQuestionIndex] = useState(0);
  const [gameKeys, setGameKeys] = useState<Record<string, number>>({});
  const [cards, setCards] = useState<CardData[]>([]);
  const [savedScrollPosition, setSavedScrollPosition] = useState(0);
  const [showSkipPenalty, setShowSkipPenalty] = useState(false);
  const [pendingSkipIndex, setPendingSkipIndex] = useState<number | null>(null);
  const [pendingNavigateTo, setPendingNavigateTo] = useState<number | null>(null);
  const [showWaitModal, setShowWaitModal] = useState(false);
  const [playedCards, setPlayedCards] = useState<Set<number>>(new Set());
  const [sessionStartCoins, setSessionStartCoins] = useState<number | null>(null);
  const [showNoFunds, setShowNoFunds] = useState(false);
  const [showPushReminder, setShowPushReminder] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [welcomeRankChange, setWelcomeRankChange] = useState<WelcomeBackRankChange | null>(null);
  const [welcomeCurrentRank, setWelcomeCurrentRank] = useState<number | null>(null);
  const [welcomeAI, setWelcomeAI] = useState<{ greeting: string; subtitle: string; fact: string; factReaction: string; callToAction: string } | null>(null);
  const [welcomeNotificationsEnabled, setWelcomeNotificationsEnabled] = useState(true);
  const [pendingChallengeCount, setPendingChallengeCount] = useState(0);
  const [activeBattleCount, setActiveBattleCount] = useState(0);
  const [showLogoutToast, setShowLogoutToast] = useState(false);
  const [pendingBattleId, setPendingBattleId] = useState<string | null>(null);
  const [pushToast, setPushToast] = useState<{ title: string; body: string; url?: string } | null>(null);
  const [openArticleId, setOpenArticleId] = useState<string | null>(null);
  const [openAuthorName, setOpenAuthorName] = useState<string | null>(null);
  const [openRankrollId, setOpenRankrollId] = useState<string | null>(null);
  const [openRankrollData, setOpenRankrollData] = useState<any>(null);
  const [rewardedArticles, setRewardedArticles] = useState<Set<string>>(new Set()); // Track which articles already gave reward
  const [feedRefreshKey, setFeedRefreshKey] = useState(0); // Increment to force feed refresh
  const [showRankingsOverlay, setShowRankingsOverlay] = useState(false); // Rankings overlay (opened via score click)
  const [rankingsTab, setRankingsTab] = useState<'ranking' | 'rewards'>('ranking'); // Tab within rankings overlay
  const [userRank, setUserRank] = useState<number | undefined>(undefined); // User's ranking position
  // Game stats for summary card
  const [gameStats, setGameStats] = useState({
    totalQuestions: 0,
    correctAnswers: 0,
    totalTime: 0, // in seconds
  });
  // Push notification status for header bell color
  const [pushEnabled, setPushEnabled] = useState(false);
  const [isGameLive, setIsGameLive] = useState(true); // Default to true to avoid blocking on SSR
  const [mounted, setMounted] = useState(false);
  const [hasJoinedChallenge, setHasJoinedChallenge] = useState(false); // Don't read localStorage on SSR
  const [hasCompletedToday, setHasCompletedToday] = useState(false); // Track if user completed today's game
  const [todaysResults, setTodaysResults] = useState<Record<string, { userAnswer: string | number | null; isCorrect: boolean; pointsChange?: number; timeUsed?: number }>>({}); // Results from DB
  const [isLoadingGameState, setIsLoadingGameState] = useState(true); // Loading state while checking DB
  const [showCompletedModal, setShowCompletedModal] = useState(false); // Show "already completed" modal
  const [showWelcomeBonus, setShowWelcomeBonus] = useState(true); // Show 500 points bonus text
  const [bonusClaimed, setBonusClaimed] = useState(false); // Track if welcome bonus was claimed
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false); // Checkout success modal
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null); // Stripe session ID
  const [currentGameNumber, setCurrentGameNumber] = useState<number | undefined>(undefined); // Current game number
  const [isBattleActive, setIsBattleActive] = useState(false); // Block tab switching during active battle
    
  const searchParams = useSearchParams();
  
  // Check for URL parameters (checkout, tab from push notification)
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    const tab = searchParams.get('tab');
    const ref = searchParams.get('ref');
    const battleParam = searchParams.get('battle');

    // Deep-link from a battle-challenge push: go straight to the battle intro
    if (battleParam) {
      setPendingBattleId(battleParam);
      setArcadeGame('quizzbattle');
      setActiveTab('arcade');
      window.history.replaceState({}, '', '/mobile');
      return;
    }

    // Capture an invite referral so it can be applied on signup
    if (ref && typeof window !== 'undefined') {
      localStorage.setItem('bogx_ref', ref);
    }
    
    if (checkout === 'success') {
      // Prevent re-triggering if already showing
      if (showCheckoutSuccess) return;
      const sessionId = searchParams.get('session_id');
      setCheckoutSessionId(sessionId);
      setShowCheckoutSuccess(true);
      setActiveTab('shop');
      window.history.replaceState({}, '', '/mobile');
    } else if (checkout === 'cancelled') {
      setActiveTab('shop');
      window.history.replaceState({}, '', '/mobile');
    } else if (tab === 'rankings') {
      // From results push notification - open rankings overlay
      setShowRankingsOverlay(true);
      setRankingsTab('ranking');
      window.history.replaceState({}, '', '/mobile');
    } else if (tab === 'battles') {
      setArcadeGame('quizzbattle');
      setActiveTab('arcade');
      window.history.replaceState({}, '', '/mobile');
    }
  }, [searchParams, showCheckoutSuccess]);
  
  // Guest limit: after 5 games, show login card
  const GUEST_LIMIT = 5;

  // Handle iOS BFCache - force reload if page is restored from cache
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        window.location.reload();
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);


  // Load current game number
  useEffect(() => {
    const loadGameNumber = async () => {
      try {
        const res = await fetch('/api/game/current');
        const data = await res.json();
        if (data.success && data.game) {
          setCurrentGameNumber(data.game.gameNumber);
        }
      } catch (error) {
        console.error('Failed to load game number:', error);
      }
    };
    loadGameNumber();
  }, []);

  // Initialize client-side state after mount to avoid hydration errors
  useEffect(() => {
    setMounted(true);
    const today = new Date().toISOString().split('T')[0];
    const userId = localStorage.getItem('oddsUserId');
    
    // Check if hasJoinedChallenge is from today - reset if new day
    const joinedDate = localStorage.getItem('hasJoinedChallengeDate');
    if (joinedDate !== today) {
      // New day - reset all daily state
      localStorage.removeItem('hasJoinedChallenge');
      localStorage.removeItem('hasGuestWelcomeBonus');
      localStorage.removeItem('savedCardIndex');
      localStorage.removeItem('savedPlayedCards');
      localStorage.removeItem('savedGameStats');
      localStorage.setItem('hasJoinedChallengeDate', today);
      setHasJoinedChallenge(false);
      setShowWelcomeBonus(true);
    } else {
      // Same day - read from localStorage (user-specific keys)
      // For guests (no userId), always start fresh - don't persist hasJoinedChallenge
      if (userId) {
        const joinedKey = `hasJoinedChallenge_${userId}`;
        const joined = localStorage.getItem(joinedKey) === 'true';
        setHasJoinedChallenge(joined);
      } else {
        // Guest - always start with false (show "Join Challenge")
        setHasJoinedChallenge(false);
      }
      
      // Check if guest already received welcome bonus today
      const hasGuestBonus = localStorage.getItem('hasGuestWelcomeBonus') === 'true';
      if (hasGuestBonus) setShowWelcomeBonus(false);

      // Restore session state for logged-in users
      // TEMPORARILY DISABLED for article testing
      if (false && userId) {
        const savedIndex = localStorage.getItem(`savedCardIndex_${userId}`);
        if (savedIndex !== null) setCurrentIndex(parseInt(savedIndex as string, 10));

        const savedPlayed = localStorage.getItem(`savedPlayedCards_${userId}`);
        if (savedPlayed) {
          try { setPlayedCards(new Set(JSON.parse(savedPlayed as string))); } catch {}
        }

        const savedStats = localStorage.getItem(`savedGameStats_${userId}`);
        if (savedStats) {
          try { setGameStats(JSON.parse(savedStats as string)); } catch {}
        }
      }
    }
    
    // Check if user already completed today's game (only for logged-in users)
    // Use user-specific key to support multiple accounts
    const completedKey = userId ? `gameCompletedDate_${userId}` : 'gameCompletedDate';
    const completedDate = localStorage.getItem(completedKey);
    if (completedDate === today && userId) {
      setHasCompletedToday(true);
      // Also set hasJoinedChallenge so cards are shown (in completed state)
      setHasJoinedChallenge(true);
    }
  }, []);

  // Load read articles ONLY from database (no localStorage)
  useEffect(() => {
    if (!mounted) return;
    
    if (user?.id) {
      // Logged in: load from DB only
      const loadReadArticles = async () => {
        try {
          const res = await fetch(`/api/user/read-article?userId=${user.id}`);
          const data = await res.json();
          const dbRead: string[] = data.readArticles || [];
          setRewardedArticles(new Set(dbRead));
        } catch (e) {
          console.error('Failed to load read articles:', e);
        }
      };
      loadReadArticles();
    } else {
      // Guest: no read tracking (they see all as unread)
      setRewardedArticles(new Set());
    }
  }, [mounted, user?.id]);

  // Re-check completion status from SERVER when user logs in
  useEffect(() => {
    if (!mounted) return;
    // For guests, no DB check needed - they always start fresh
    if (!user?.id) {
      setIsLoadingGameState(false);
      return;
    }
    
    const checkTodaysResults = async () => {
      const today = new Date().toISOString().split('T')[0];
      try {
        const res = await fetch(`/api/game-results?userId=${user.id}&date=${today}`);
        const data = await res.json();
        
        console.log('Game results from DB:', data);
        console.log('Current cards:', cards.map(c => ({ _id: c._id, question: c.question?.substring(0, 30) })));
        if (data.success && data.results && data.results.length > 0) {
          // Build results map by cardId (include pointsChange and timeUsed for daily total)
          const resultsMap: Record<string, { userAnswer: string | number | null; isCorrect: boolean; pointsChange?: number; timeUsed?: number }> = {};
          data.results.forEach((r: any) => {
            resultsMap[r.cardId] = { userAnswer: r.userAnswer, isCorrect: r.isCorrect, pointsChange: r.pointsChange, timeUsed: r.timeUsed };
          });
          setTodaysResults(resultsMap);
          setHasJoinedChallenge(true); // User has played today = already joined
        }
        setIsLoadingGameState(false);
      } catch (e) {
        console.error('Failed to check today results:', e);
        setIsLoadingGameState(false);
      }
    };
    
    checkTodaysResults();
  }, [mounted, user?.id]);

  // Check if game is live (SAME logic as WelcomeReel!)
  useEffect(() => {
    if (!mounted) return;
    
    const checkGameStatus = () => {
      const now = new Date();
      const germanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
      const germanHour = germanTime.getHours();
      // Game is LIVE from 10:00 to 09:00 next day (23 hours)
      // Pause from 09:00 to 10:00 (1 hour)
      const isLive = germanHour >= 10 || germanHour < 9;
      setIsGameLive(isLive);
      
      // Reset hasJoinedChallenge when game goes offline
      if (!isLive && hasJoinedChallenge) {
        setHasJoinedChallenge(false);
        localStorage.removeItem('hasJoinedChallenge');
      }
    };
    
    checkGameStatus();
    const interval = setInterval(checkGameStatus, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [mounted, hasJoinedChallenge]);

  // Persist session state to localStorage for logged-in users (user-specific keys)
  useEffect(() => {
    if (!mounted || !isLoggedIn || !user?.id) return;
    localStorage.setItem(`savedCardIndex_${user.id}`, String(currentIndex));
  }, [currentIndex, mounted, isLoggedIn, user?.id]);

  useEffect(() => {
    if (!mounted || !isLoggedIn || !user?.id) return;
    localStorage.setItem(`savedPlayedCards_${user.id}`, JSON.stringify(Array.from(playedCards)));
  }, [playedCards, mounted, isLoggedIn, user?.id]);

  useEffect(() => {
    if (!mounted || !isLoggedIn || !user?.id) return;
    localStorage.setItem(`savedGameStats_${user.id}`, JSON.stringify(gameStats));
  }, [gameStats, mounted, isLoggedIn, user?.id]);

  // Scroll to next unplayed card after loading game state from DB
  // TEMPORARILY DISABLED for article testing
  useEffect(() => {
    return; // DISABLED
    if (!mounted || !isLoggedIn || isLoadingGameState || !scrollContainerRef.current) return;
    if (Object.keys(todaysResults).length === 0) return; // No results yet
    
    // Find the first unplayed card
    const filteredCards = cards.filter(c => !c.guestCard);
    let nextUnplayedIndex = 0;
    let allPlayed = true;
    
    for (let i = 0; i < filteredCards.length; i++) {
      const cardId = filteredCards[i]._id;
      if (cardId && !todaysResults[cardId]) {
        nextUnplayedIndex = i + 1; // +1 because index 0 is WelcomeReel
        allPlayed = false;
        break;
      }
    }
    
    // If all cards played, go to summary card (last card in content array)
    if (allPlayed && filteredCards.length > 0) {
      // Summary card is after all quiz cards: WelcomeReel(0) + quizCards + SummaryCard
      nextUnplayedIndex = filteredCards.length + 1;
    }
    
    if (nextUnplayedIndex > 0 && scrollContainerRef.current) {
      const container = scrollContainerRef.current as HTMLDivElement;
      const itemHeight = container.clientHeight;
      if (itemHeight > 0) {
        setCurrentIndex(nextUnplayedIndex);
        container.scrollTo({ top: nextUnplayedIndex * itemHeight, behavior: 'instant' });
      }
    }
  // Only run once after loading
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingGameState, cards.length, mounted]);

  // Check if logged in user has received welcome bonus
  useEffect(() => {
    if (!mounted || !isLoggedIn || !user?.id) return;
    
    const checkWelcomeBonus = async () => {
      try {
        const res = await fetch(`/api/users/welcome-bonus?userId=${user.id}`);
        const data = await res.json();
        if (data.success && data.hasReceivedWelcomeBonus) {
          setShowWelcomeBonus(false);
        }
      } catch (error) {
        console.error('Error checking welcome bonus:', error);
      }
    };
    
    checkWelcomeBonus();
  }, [mounted, isLoggedIn, user?.id]);

  // Reset game state when login status changes (logout)
  const wasLoggedInRef = useRef(isLoggedIn);
  useEffect(() => {
    if (!mounted) return;
    
    // Detect logout (was logged in, now not)
    if (wasLoggedInRef.current && !isLoggedIn) {
      // User logged out - reset to initial state
      setHasJoinedChallenge(false);
      setHasCompletedToday(false);
      setTodaysResults({});
      setCurrentIndex(0);
      setPlayedCards(new Set());
      setGameStats({ totalQuestions: 0, correctAnswers: 0, totalTime: 0 });
      setCoins(0);
      // Clear welcome_shown keys so Welcome Screen shows on next login
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key?.startsWith('welcome_shown_')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => sessionStorage.removeItem(k));
      } catch { /* ignore */ }
      // Go to home tab with welcome reel
      setActiveTab('home');
      // Show logout toast
      setShowLogoutToast(true);
      setTimeout(() => setShowLogoutToast(false), 2000);
    }
    
    wasLoggedInRef.current = isLoggedIn;
  }, [mounted, isLoggedIn]);

  // Coins loading + syncing handled by useBogxCoins hook (server is source of truth)

  // Fetch user's ranking position
  useEffect(() => {
    if (!mounted || !isLoggedIn || !user?.id) return;
    
    const fetchUserRank = async () => {
      try {
        // Use same endpoint as RankingsPage for consistency
        const res = await fetch(`/api/rankings/snapshot?period=day`);
        const data = await res.json();
        if (data.rankings && Array.isArray(data.rankings)) {
          // Find user in rankings - compare as strings
          const myRankIndex = data.rankings.findIndex((r: any) => {
            return user.id === r._id;
          });
          if (myRankIndex !== -1) {
            // Use rank from data if available, otherwise use index + 1
            const rankData = data.rankings[myRankIndex];
            setUserRank(rankData.rank || myRankIndex + 1);
          } else {
            setUserRank(undefined); // Not in rankings yet
          }
        }
      } catch (e) {
        console.error('Failed to fetch user rank:', e);
      }
    };
    
    fetchUserRank();
    // Refresh rank every 60 seconds
    const interval = setInterval(fetchUserRank, 60000);
    return () => clearInterval(interval);
  }, [mounted, isLoggedIn, user?.id]);

  // Coins auto-sync handled by useBogxCoins hook (single source of truth: bogxCoins)
  // The old sync here used the LEGACY 'points' field and caused stale values to reappear

  // Mark game as completed when all questions are answered/skipped (only for logged-in users)
  // Check session (gameStats), DB results (todaysResults), and skipped cards (playedCards)
  useEffect(() => {
    if (!mounted || !isLoggedIn || !user?.id || hasCompletedToday) return;
    const totalCards = cards.filter(c => !c.guestCard).length;
    if (totalCards === 0) return;
    
    // Check from current session (answered + skipped)
    const completedInSession = gameStats.totalQuestions >= totalCards;
    // Check from DB results
    const completedInDb = Object.keys(todaysResults).length >= totalCards;
    // Check from playedCards (includes skipped) - offset: logged in = 2, guest = 3
    const contentIndexOffset = isLoggedIn ? 2 : 3;
    const allCardsPlayed = Array.from({ length: totalCards }, (_, i) => i + contentIndexOffset).every(idx => playedCards.has(idx));
    
    if (completedInSession || completedInDb || allCardsPlayed) {
      setHasCompletedToday(true);
    }
  }, [gameStats.totalQuestions, mounted, isLoggedIn, user?.id, cards, hasCompletedToday, todaysResults, playedCards]);

  // Deferred navigation after skip - waits for content array to re-render (e.g. SummaryCard appearing)
  useEffect(() => {
    if (pendingNavigateTo === null || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const itemHeight = container.clientHeight;
    container.scrollTo({ top: pendingNavigateTo * itemHeight, behavior: "smooth" });
    setCurrentIndex(pendingNavigateTo);
    setPendingNavigateTo(null);
  }, [playedCards.size, pendingNavigateTo]);

  // Close all overlays - prevents overlapping windows (UNIVERSAL)
  const closeAllOverlays = () => {
    setShowRewards(false);
    setShowLoginPage(false);
    setShowLoginRequired(false);
    setShowNoFunds(false);
    setShowJoinChallengePage(false);
    setRadioOpen(false);
    setOpenArticleId(null);
  };

  // Open overlay with auto-close of others (UNIVERSAL)
  type OverlayType = 'rewards' | 'notifications' | 'login' | 'noFunds' | 'radio' | 'joinChallenge';
  const openOverlay = (overlay: OverlayType, options?: { loginView?: 'login' | 'signup' }) => {
    closeAllOverlays();
    switch (overlay) {
      case 'rewards': 
        sounds.modalOpen(); 
        setShowRewards(true); 
        break;
      case 'notifications': 
        sounds.modalOpen(); 
        setNotificationAutoEnable(null); 
        setActiveTab('notifications'); 
        break;
      case 'login': 
        sounds.modalOpen(); 
        if (options?.loginView) setLoginInitialView(options.loginView);
        setShowLoginPage(true); 
        break;
      case 'noFunds': 
        sounds.error(); 
        setShowNoFunds(true); 
        break;
      case 'radio':
        sounds.modalOpen();
        setRadioOpen(true);
        break;
      case 'joinChallenge':
        sounds.modalOpen();
        setShowJoinChallengePage(true);
        break;
    }
  };

  // Toggle overlay (open if closed, close if open)
  const toggleOverlay = (overlay: 'rewards' | 'notifications') => {
    if (overlay === 'notifications') {
      // Notifications is now a tab, not an overlay
      if (activeTab === 'notifications') {
        setActiveTab('home');
      } else {
        setActiveTab('notifications');
      }
      return;
    }
    const isCurrentlyOpen = showRewards;
    if (isCurrentlyOpen) {
      closeAllOverlays();
    } else {
      openOverlay(overlay);
    }
  };

  // Load cards from API and flatten questions array
  useEffect(() => {
    const fetchCards = async () => {
      try {
        // Use German/CET timezone for date matching
        const germanTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
        const germanHour = germanTime.getHours();
        
        // Between midnight and 10:00, use yesterday's date (game from previous day still running)
        let dateToUse = germanTime;
        if (germanHour < 10) {
          dateToUse = new Date(germanTime);
          dateToUse.setDate(dateToUse.getDate() - 1);
        }
        const germanDate = dateToUse.toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' }); // YYYY-MM-DD format
        
        // Include userId for smart question selection (avoids repetition)
        const userIdParam = user?.id ? `&userId=${user.id}` : '';
        const res = await fetch(`/api/cards?date=${germanDate}${userIdParam}`);
        const data = await res.json();
        if (data.success) {
          // Flatten cards: each question variant becomes a separate card
          const flattenedCards: CardData[] = [];
          
          // Filter by active status - date already filtered by API
          data.cards.filter((c: CardFromDB) => c.active).forEach((card: CardFromDB) => {
            if (card.questions && card.questions.length > 0) {
              // Use _selectedQuestion from API if available (smart selection), otherwise random
              const selectedQuestion = (card as any)._selectedQuestion || 
                card.questions[Math.floor(Math.random() * card.questions.length)];
              flattenedCards.push({
                _id: card._id,
                theme: card.theme,
                topic: card.topic,
                maxReward: selectedQuestion.maxReward,
                difficulty: selectedQuestion.difficulty,
                difficultyText: selectedQuestion.difficultyText,
                question: selectedQuestion.question,
                highlightWords: selectedQuestion.highlightWords || [],
                previewImage: card.previewImage,
                playerImage: card.playerImage,
                options: selectedQuestion.options,
                correctAnswer: selectedQuestion.correctAnswer,
                timeLimit: card.timeLimit,
                active: card.active,
                guestCard: card.guestCard || false,
              });
            } else if ((card as any).question) {
              // Old format - single question (backwards compatibility)
              flattenedCards.push(card as unknown as CardData);
            }
          });
          
          // Keep newest cards first (API already returns sorted by createdAt desc)
          setCards(flattenedCards);
        }
      } catch (error) {
        console.error("Error fetching cards:", error);
      }
    };
    fetchCards();
  }, [user?.id]);

  // Load radio stations from DB
  useEffect(() => {
    const fetchStations = async () => {
      try {
        const res = await fetch('/api/radio-stations');
        const data = await res.json();
        if (data.success && data.stations) {
          setRadioStations(data.stations);
        }
      } catch (e) {
        console.error('Failed to load radio stations:', e);
      }
    };
    fetchStations();
  }, []);

  // Redirect to home when logged out while on profile tab
  const wasLoggedInMobileRef = useRef(isLoggedIn);
  useEffect(() => {
    if (wasLoggedInMobileRef.current && !isLoggedIn && activeTab === 'profile') {
      setActiveTab('home');
    }
    wasLoggedInMobileRef.current = isLoggedIn;
  }, [isLoggedIn]);

  // Check push notification status (only for logged-in users)
  useEffect(() => {
    const checkPushStatus = async () => {
      // Only show push as enabled if user is logged in
      if (!isLoggedIn) {
        setPushEnabled(false);
        return;
      }
      if ('Notification' in window && 'serviceWorker' in navigator) {
        try {
          const permission = Notification.permission;
          if (permission === 'granted') {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            setPushEnabled(!!subscription);
          } else {
            setPushEnabled(false);
          }
        } catch (e) {
          console.log('Error checking push status:', e);
          setPushEnabled(false);
        }
      }
    };
    checkPushStatus();
  }, [activeTab, isLoggedIn]); // Re-check when notification page closes or login status changes

  // Check if any notification is enabled (push, email, or sms) - only for logged-in users
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  
  useEffect(() => {
    const checkNotifications = () => {
      // Only show notifications as enabled if user is logged in
      if (!isLoggedIn) {
        setNotificationsEnabled(false);
        return;
      }
      const emailEnabled = localStorage.getItem('email_enabled') === 'true';
      const smsEnabled = localStorage.getItem('sms_enabled') === 'true';
      setNotificationsEnabled(pushEnabled || emailEnabled || smsEnabled);
    };
    checkNotifications();
  }, [activeTab, pushEnabled, isLoggedIn]); // Re-check when notification page closes or login changes

  // Fetch pending battle counts (invitations + active battles) on login and periodically
  useEffect(() => {
    if (!isLoggedIn || !user?.id) {
      setPendingChallengeCount(0);
      setActiveBattleCount(0);
      return;
    }
    const badgeSeenKey = `arcade_badge_seen_${user.id}`;
    const fetchBattleCounts = async () => {
      // If user already visited arcade this session, don't re-show the badge
      if (sessionStorage.getItem(badgeSeenKey)) return;
      try {
        const res = await fetch(`/api/battles?userId=${user.id}&countOnly=true`);
        const data = await res.json();
        if (data.success) {
          setPendingChallengeCount(data.pendingChallenges ?? 0);
          setActiveBattleCount(data.activeBattles ?? 0);
        }
      } catch {
        // Silently fail
      }
    };
    fetchBattleCounts();
    const interval = setInterval(fetchBattleCounts, 60000);
    return () => clearInterval(interval);
  }, [isLoggedIn, user?.id]);

  // Fetch unread notification count on login and periodically
  useEffect(() => {
    if (!isLoggedIn || !user?.id) {
      setUnreadNotifications(0);
      return;
    }
    
    const fetchCount = async () => {
      try {
        const res = await fetch(`/api/notifications/count?userId=${user.id}`);
        const data = await res.json();
        if (data.success && activeTab !== 'notifications') {
          setUnreadNotifications(data.count);
        }
      } catch (e) {
        // Silently fail
      }
    };
    
    fetchCount();
    
    // Poll every 60 seconds (reduced from 30)
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, [isLoggedIn, user?.id, activeTab]);
  
  // Clear unread count when user opens notifications tab
  useEffect(() => {
    if (activeTab === 'notifications' && isLoggedIn && user?.id) {
      // Clear badge immediately when opening notifications
      setUnreadNotifications(0);
      // Also mark as read on server
      fetch('/api/notifications/mark-read', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      }).catch(() => {});
    }
  }, [activeTab, isLoggedIn, user?.id]);
  
  // Listen for CTA events from article links
  useEffect(() => {
    const handleOpenRadio = () => {
      setRadioOpen(true);
      setShowSongRequest(true);
    };
    const handleOpenShop = () => {
      setOpenArticleId(null); // Close article first
      setActiveTab('shop');
    };
    const handleOpenArcade = () => {
      setOpenArticleId(null);
      setActiveTab('arcade');
    };
    const handleOpenTV = () => {
      setOpenArticleId(null);
      setActiveTab('tv');
    };
    const handleOpenArticles = () => {
      setOpenArticleId(null);
      setActiveTab('articles');
    };
    
    window.addEventListener('openRadio', handleOpenRadio);
    window.addEventListener('openShop', handleOpenShop);
    window.addEventListener('openArcade', handleOpenArcade);
    window.addEventListener('openTV', handleOpenTV);
    window.addEventListener('openArticles', handleOpenArticles);
    
    return () => {
      window.removeEventListener('openRadio', handleOpenRadio);
      window.removeEventListener('openShop', handleOpenShop);
      window.removeEventListener('openArcade', handleOpenArcade);
      window.removeEventListener('openTV', handleOpenTV);
      window.removeEventListener('openArticles', handleOpenArticles);
    };
  }, []);

  // Listen for push notifications from Service Worker
  useEffect(() => {
    if (!isLoggedIn) return;
    
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NEW_NOTIFICATION') {
        console.log('🔔 New notification received via SW:', event.data);
        const notifData = event.data.data;
        
        // Show toast notification on any page
        setPushToast({
          title: notifData?.title || 'New Notification',
          body: notifData?.body || 'You have a new notification',
          url: notifData?.url
        });
        
        // Auto-hide after 5 seconds
        setTimeout(() => setPushToast(null), 5000);
        
        // Update green dot if not on notifications page
        if (activeTab !== 'notifications') {
          setUnreadNotifications(prev => prev + 1);
        }
      }
    };
    
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [isLoggedIn, activeTab]);
  
  // DON'T auto-clear unread count when viewing notifications
  // Each notification must be clicked individually to be marked as read
  // The green dot stays until all notifications are clicked

  // Global push notification reminder - shows after login if push not enabled
  // Shows up to 7 times until user enables or dismisses enough times
  // Does NOT show on notification page
  useEffect(() => {
    if (!mounted || !isLoggedIn || !user?.id || pushEnabled) return;
    if (activeTab === 'notifications') return; // Don't show on notification page
    
    // Only show if app is installed (standalone mode) - otherwise InstallBanner handles it
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!isStandalone) return; // Let InstallBanner handle non-installed users
    
    // Check how many times user has dismissed the reminder
    const dismissCount = parseInt(localStorage.getItem(`push_reminder_dismissed_${user.id}`) || '0');
    if (dismissCount >= 7) return; // Stop showing after 7 dismissals
    
    // Check when we last showed the reminder (don't spam)
    const lastShown = parseInt(localStorage.getItem(`push_reminder_last_${user.id}`) || '0');
    const hoursSinceLastShown = (Date.now() - lastShown) / (1000 * 60 * 60);
    
    // Show reminder: first time, or after 2 hours since last shown
    if (lastShown === 0 || hoursSinceLastShown >= 2) {
      // Delay so page loads first
      const timer = setTimeout(() => {
        setShowPushReminder(true);
        localStorage.setItem(`push_reminder_last_${user.id}`, Date.now().toString());
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [mounted, isLoggedIn, user?.id, pushEnabled, activeTab]);

  const handleDismissPushReminder = () => {
    setShowPushReminder(false);
    if (user?.id) {
      const dismissCount = parseInt(localStorage.getItem(`push_reminder_dismissed_${user.id}`) || '0');
      localStorage.setItem(`push_reminder_dismissed_${user.id}`, (dismissCount + 1).toString());
    }
  };

  const [autoOpenNotificationSettings, setAutoOpenNotificationSettings] = useState(false);
  
  const handleEnablePushFromReminder = async () => {
    setShowPushReminder(false);
    // Navigate to notifications page and open settings directly
    setAutoOpenNotificationSettings(true);
    setActiveTab('notifications');
  };

  // Show welcome back message after login
  useEffect(() => {
    if (!mounted || !isLoggedIn || !user?.id) return;
    
    // Don't show welcome if returning from checkout
    const checkout = searchParams.get('checkout');
    if (checkout === 'success' || checkout === 'cancelled') return;
    
    // Check if we already showed welcome this session
    const sessionKey = `welcome_shown_${user.id}_${new Date().toDateString()}`;
    if (sessionStorage.getItem(sessionKey)) return;
    
    // Show welcome modal immediately, then enrich with API data as it arrives
    setShowWelcomeBack(true);
    sessionStorage.setItem(sessionKey, 'true');

    const fetchWelcomeMessage = async () => {
      try {
        const [welcomeRes, factsRes] = await Promise.all([
          fetch(`/api/user/welcome-message?userId=${user.id}`).then(r => r.json()).catch(() => null),
          fetch(`/api/daily-facts`).then(r => r.json()).catch(() => null),
        ]);

        if (welcomeRes?.success) {
          setWelcomeRankChange(welcomeRes.rankChange || null);
          setWelcomeCurrentRank(welcomeRes.currentRank ?? null);
          setWelcomeNotificationsEnabled(welcomeRes.notificationsEnabled !== false);
        }
        if (factsRes?.success && factsRes.welcome) {
          setWelcomeAI(factsRes.welcome);
        }
      } catch {
        // Data already showing, just skip enrichment
      }
    };
    
    // Preload banners and important images in background
    const preloadImages = async () => {
      const imagesToPreload = [
        // Arcade banners
        '/images/Hintergund/quizzbattle.png',
        '/images/Hintergund/solo.png',
        '/images/Hintergund/prediction.png',
        '/images/Hintergund/faceblur.png',
        '/images/Hintergund/nextplay.png',
        // Icons
        '/images/Icon/trivia1.png',
        '/images/Icon/trivia2.png',
        '/images/bogxcoin.png',
        '/images/genxlogo1.png',
        // Topic images
        '/images/topics/music.png',
        '/images/topics/movies.png',
        '/images/topics/sports.png',
        '/images/topics/tv.png',
        '/images/topics/gaming.png',
      ];
      
      // Preload in parallel without blocking
      imagesToPreload.forEach(src => {
        const img = new Image();
        img.src = src;
      });
      
      // Also preload article cover images from API
      try {
        const articlesRes = await fetch('/api/articles?limit=10');
        const articlesData = await articlesRes.json();
        if (articlesData.articles) {
          articlesData.articles.forEach((article: { coverImage?: string }) => {
            if (article.coverImage && !article.coverImage.includes('.mp4')) {
              const img = new Image();
              img.src = article.coverImage;
            }
          });
        }
      } catch (e) {
        // Ignore preload errors
      }
      
      // Preload ranking images
      try {
        const pollsRes = await fetch('/api/polls?limit=5');
        const pollsData = await pollsRes.json();
        if (pollsData.polls) {
          pollsData.polls.forEach((poll: { articleImage?: string; items?: { image?: string }[] }) => {
            if (poll.articleImage) {
              const img = new Image();
              img.src = poll.articleImage;
            }
            poll.items?.slice(0, 3).forEach((item: { image?: string }) => {
              if (item.image) {
                const img = new Image();
                img.src = item.image;
              }
            });
          });
        }
      } catch (e) {
        // Ignore preload errors
      }
    };

    // Kick off both in parallel — modal already visible
    preloadImages();
    const timer = setTimeout(fetchWelcomeMessage, 200);
    return () => clearTimeout(timer);
  }, [mounted, isLoggedIn, user?.id, user?.username, searchParams]);

  const handleBetPlaced = (bet: BetData) => {
    setActiveBets(prev => [...prev, bet as unknown as ActiveBet]);
    setHasBettingBetPlaced(true);
  };

  const handleRedeem = async (rewardId: string, cost: number) => {
    // Top-up: cost is negative, so subtracting adds coins
    if (rewardId.startsWith('topup-') || rewardId.startsWith('ad-reward-')) {
      const amount = Math.abs(cost);
      setCoins(prev => prev + amount);
      setCoinAnimation({ show: true, amount: amount });
      // Sync to database
      if (isLoggedIn && user?.id) {
        await syncPointsToDb(amount, false);
      }
    } else {
      // Regular reward redemption
      setCoins(prev => prev - cost);
      // Sync to database
      if (isLoggedIn && user?.id) {
        await syncPointsToDb(-cost, false);
      }
      alert(`🎉 ${rewardId} redeemed! You spent ${cost} coins.`);
    }
  };

  const handleChallengeStart = (reward: number) => {
    setChallengeActive(true);
    setCurrentReward(reward);
    // Increment guest games counter if not logged in
    if (!isLoggedIn) {
      incrementGuestGames();
    }
  };

  const handleAdComplete = async (correct: boolean, reward: number, timeUsed?: number, meta?: { cardId: string; question: string; correctAnswer: string | number; userAnswer: string | number | null; difficulty: number; timedOut: boolean }) => {
    setChallengeActive(false);
    // Mark card as played so user can swipe past it
    setPlayedCards(prev => new Set(prev).add(currentIndex));
    
    // Update game stats for summary card
    setGameStats(prev => ({
      totalQuestions: prev.totalQuestions + 1,
      correctAnswers: prev.correctAnswers + (correct ? 1 : 0),
      totalTime: prev.totalTime + (timeUsed || 0),
    }));
    
    const pointsChange = correct ? reward : -Math.abs(reward);
    
    // Update todaysResults immediately so SummaryCard shows correct points and time
    if (meta?.cardId) {
      setTodaysResults(prev => ({
        ...prev,
        [meta.cardId]: {
          userAnswer: meta.userAnswer,
          isCorrect: correct,
          pointsChange: pointsChange,
          timeUsed: timeUsed || 0,
        }
      }));
    }
    
    if (correct && reward > 0) {
      sounds.correct();
      setCoinAnimation({ show: true, amount: reward });
      setCoins(prev => prev + reward);
      updateUser({ wins: (user?.wins || 0) + 1 });
      if (isLoggedIn) {
        await syncPointsToDb(reward, true);
        if (user?.id && meta) {
          fetch('/api/game-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, ...meta, isCorrect: true, pointsChange: reward, timeUsed: timeUsed ?? 0 }),
          }).catch(() => {});
        }
      }
    } else if (!correct) {
      sounds.wrong();
      const penalty = Math.abs(reward);
      setCoinAnimation({ show: true, amount: -penalty });
      setCoins(prev => Math.max(0, prev - penalty));
      if (isLoggedIn) {
        await syncPointsToDb(-penalty, false);
        if (user?.id && meta) {
          fetch('/api/game-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, ...meta, isCorrect: false, pointsChange: -penalty, timeUsed: timeUsed ?? 0 }),
          }).catch(() => {});
        }
      }
    }
  };

  const handleSurpriseComplete = (reward: number) => {
    setCoinAnimation({ show: true, amount: reward });
    setCoins(prev => prev + reward);
  };

  const handleCoinAnimationComplete = () => {
    setCoinAnimation({ show: false, amount: 0 });
  };

  // Handle opening an article - points are now awarded via API in ArticlePage
  const handleOpenArticle = (articleId: string) => {
    setOpenArticleId(articleId);
    // Don't change URL - causes issues with hot reload and navigation
  };

  const videoData = {
    title: "Epic Goal",
    match: "Bayern vs Dortmund",
    description: "Watch this incredible goal and answer the question!",
    imageUrl: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800",
    duration: 5,
    question: "Who scored the goal in this clip?",
    options: ["Musiala", "Sané", "Kane", "Müller"],
    correctAnswer: 2,
    reward: 150,
  };

  const currentBwinData = bwinQuestionIndex === 0 ? adData.bwin : adData.bwin2;

  // Check if guest has reached limit
  const guestLimitReached = !isLoggedIn && guestGamesPlayed >= GUEST_LIMIT;

  // Handle bonus claim
  const handleBonusClaim = (amount: number) => {
    sounds.coins();
    setCoins(prev => {
      const newCoins = prev + amount;
      setSessionStartCoins(newCoins); // Track starting coins for accurate summary
      return newCoins;
    });
    setCoinAnimation({ show: true, amount });
    setBonusClaimed(true);
    setTimeout(() => setCoinAnimation({ show: false, amount: 0 }), 2000);
  };

  // Handle join challenge - enable swiping and give starting coins
  const handleJoinChallenge = async () => {
    setHasJoinedChallenge(true);
    setSessionStartCoins(coins); // Track starting coins for accurate summary
    const joinedKey = user?.id ? `hasJoinedChallenge_${user.id}` : 'hasJoinedChallenge';
    localStorage.setItem(joinedKey, 'true');
    
    if (isLoggedIn && user?.id) {
      // Logged in user - check DB for welcome bonus
      try {
        const res = await fetch('/api/users/welcome-bonus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id })
        });
        const data = await res.json();
        
        if (data.success && !data.alreadyReceived) {
          // First time - show welcome bonus animation
          const WELCOME_BONUS = data.bonusAmount || 5; // Already in BOGX
          const bogx = data.points; // Already in BOGX
          setCoins(bogx);
          setCoinAnimation({ show: true, amount: WELCOME_BONUS });
        } else if (data.success) {
          // Already received - just sync points (convert to BOGX)
          const bogx = data.points; // Already in BOGX
          setCoins(bogx);
        }
      } catch (error) {
        console.error('Error claiming welcome bonus:', error);
      }
    } else {
      // Guest user - give 5.00 BOGX demo (localStorage only)
      const hasGuestBonus = localStorage.getItem('hasGuestWelcomeBonus') === 'true';
      if (!hasGuestBonus) {
        const GUEST_BONUS = 5.00; // 5.00 BOGX
        setCoins(prev => prev + GUEST_BONUS);
        localStorage.setItem('hasGuestWelcomeBonus', 'true');
        setCoinAnimation({ show: true, amount: GUEST_BONUS });
      }
    }
    
    // Don't auto-scroll - user must swipe manually
  };

  // Calculate total cards for counter
  const filteredCardsForCount = isLoggedIn 
    ? cards.filter(c => !c.guestCard)
    : cards.filter(c => c.guestCard).slice(0, GUEST_LIMIT);

  // Build content array with cards from database
  // Content array - only LandingPage for now, other cards logic preserved for later
  const content = [
    // Landing page with articles - always first (and only for now)
    { type: "welcome", component: (
      <LandingPage 
        key="landing"
        onOpenArticle={handleOpenArticle}
        readArticles={rewardedArticles}
        onShowLogin={() => { closeAllOverlays(); setShowLoginRequired(true); }}
      /> 
    )},
  ];
  
  // NOTE: Quiz cards, BonusCard, SummaryCard logic preserved but disabled
  // To re-enable, uncomment the sections below:
  /*
  // Welcome Bonus Card - only for guests
  ...(!isLoggedIn ? [{ 
    type: "bonus", 
    component: <WelcomeBonusCard key="welcome-bonus" onClaim={handleBonusClaim} nextCardTheme={cards[0]?.theme} /> 
  }] : []),
  // Quiz cards, BonusAdCard, SummaryCard - see git history for full implementation
  */

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollPosition = container.scrollTop;
    const itemHeight = container.clientHeight;
    const newIndex = Math.round(scrollPosition / itemHeight);
    if (newIndex !== currentIndex) {
      // Block scroll if user hasn't joined the challenge yet (logged in users only)
      if (isLoggedIn && !hasJoinedChallenge && newIndex > 0) {
        container.scrollTo({
          top: 0,
          behavior: "smooth"
        });
        return;
      }
      // If swipe is blocked (during quiz playing), block forward scroll only
      if (swipeBlocked && newIndex > currentIndex) {
        container.scrollTo({
          top: currentIndex * itemHeight,
          behavior: "smooth"
        });
        return;
      }
      // Block forward swipe from bonus card until claimed (for guests)
      if (content[currentIndex]?.type === "bonus" && !bonusClaimed && newIndex > currentIndex) {
        container.scrollTo({
          top: currentIndex * itemHeight,
          behavior: "smooth"
        });
        return;
      }
      // Get current content for skip penalty check
      const currentContent = content[currentIndex];
      // If challenge is active, show warning and block scroll
      if (challengeActive) {
        // Check if user has enough points to swipe away (loses currentReward)
        if (coins < currentReward) {
          // Not enough points - show no funds modal
          openOverlay('noFunds');
          // Scroll back to current position
          container.scrollTo({
            top: currentIndex * itemHeight,
            behavior: "smooth"
          });
          return;
        }
        sounds.warning();
        setPendingSwipeIndex(newIndex);
        setShowSwipeWarning(true);
        // Scroll back to current position
        container.scrollTo({
          top: currentIndex * itemHeight,
          behavior: "smooth"
        });
        return;
      }
      // Skip penalty - user must pay to skip a card without playing
      // Check both playedCards (session) and todaysResults (from DB)
      // Calculate card index accounting for WelcomeReel, BonusCard (guest), and BonusAdCard
      const baseOffset = isLoggedIn ? 1 : 2; // WelcomeReel (+ BonusCard for guest)
      const adCardContentIndex = baseOffset + 2; // BonusAdCard is after 2 quiz cards
      // If current index is after BonusAdCard position, subtract 1 extra for the ad card
      const cardIndex = currentIndex >= adCardContentIndex 
        ? currentIndex - baseOffset - 1 
        : currentIndex - baseOffset;
      const currentCard = filteredCardsForCount[cardIndex];
      const alreadyPlayedInSession = playedCards.has(currentIndex);
      const alreadyPlayedInDb = currentCard?._id ? !!todaysResults[currentCard._id] : false;
      const alreadyPlayed = alreadyPlayedInSession || alreadyPlayedInDb;
      if (currentContent?.type === "quiz" && newIndex > currentIndex && !alreadyPlayed) {
        // Check if user has enough points to skip (100 penalty)
        if (coins < 100) {
          // Not enough points - show no funds modal
          openOverlay('noFunds');
          // Scroll back
          container.scrollTo({
            top: currentIndex * itemHeight,
            behavior: "smooth"
          });
          return;
        }
        // Trying to skip forward past a quiz card that hasn't been played - show penalty modal
        sounds.warning();
        setPendingSkipIndex(newIndex);
        setShowSkipPenalty(true);
        // Scroll back
        container.scrollTo({
          top: currentIndex * itemHeight,
          behavior: "smooth"
        });
        return;
      }
      sounds.swipe();
      setCurrentIndex(newIndex);
    }
  };

  const handleSwipeWarningContinue = () => {
    // User wants to swipe away - deduct points
    setCoinAnimation({ show: true, amount: -currentReward });
    setCoins(prev => Math.max(0, prev - currentReward));
    setChallengeActive(false);
    setShowSwipeWarning(false);
    // Mark card as played (swiped away counts as played for guest limit)
    setPlayedCards(prev => new Set(prev).add(currentIndex));
    // Update game stats (counts as wrong answer)
    setGameStats(prev => ({
      totalQuestions: prev.totalQuestions + 1,
      correctAnswers: prev.correctAnswers,
      totalTime: prev.totalTime,
    }));
    // Now allow the swipe
    if (pendingSwipeIndex !== null && scrollContainerRef.current) {
      const itemHeight = scrollContainerRef.current.clientHeight;
      scrollContainerRef.current.scrollTo({
        top: pendingSwipeIndex * itemHeight,
        behavior: "smooth"
      });
      setCurrentIndex(pendingSwipeIndex);
    }
    setPendingSwipeIndex(null);
  };

  const handleSwipeWarningRestart = () => {
    // User wants to restart - switch to next question and reset game
    setShowSwipeWarning(false);
    setPendingSwipeIndex(null);
    setChallengeActive(false);
    // Toggle bwin question
    setBwinQuestionIndex(prev => (prev + 1) % 2);
    // Force re-render of current game by updating its key
    setGameKeys(prev => ({
      ...prev,
      [currentIndex]: (prev[currentIndex] || 0) + 1
    }));
  };

  const handleSkipPenaltyPlay = () => {
    // User wants to play - close modal and stay on current card
    setShowSkipPenalty(false);
    setPendingSkipIndex(null);
  };

  const handleSkipPenaltySkip = async () => {
    // User wants to skip - deduct fixed 100 points penalty
    const penalty = 100;
    setCoinAnimation({ show: true, amount: -penalty });
    setCoins(prev => Math.max(0, prev - penalty));
    setShowSkipPenalty(false);
    // Mark card as "skipped" so we don't ask again
    setPlayedCards(prev => new Set(prev).add(currentIndex));
    // Update game stats (counts as skipped/wrong)
    setGameStats(prev => ({
      totalQuestions: prev.totalQuestions + 1,
      correctAnswers: prev.correctAnswers,
      totalTime: prev.totalTime,
    }));
    
    // Save skip to database for logged in users
    if (isLoggedIn && user?.id) {
      // Find the card that was skipped
      const baseOffset = 1; // WelcomeReel
      const adCardContentIndex = baseOffset + 2;
      const cardIndex = currentIndex >= adCardContentIndex 
        ? currentIndex - baseOffset - 1 
        : currentIndex - baseOffset;
      const filteredCards = cards.filter(c => !c.guestCard);
      const skippedCard = filteredCards[cardIndex];
      
      if (skippedCard?._id) {
        try {
          await fetch('/api/game/result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              oderId: user.id,
              cardId: skippedCard._id,
              userAnswer: null, // null indicates skipped
              isCorrect: false,
              pointsChange: -penalty,
              timeUsed: 0,
              skipped: true
            })
          });
          // Update local todaysResults
          setTodaysResults(prev => ({
            ...prev,
            [skippedCard._id]: { userAnswer: null, isCorrect: false, pointsChange: -penalty, timeUsed: 0 }
          }));
        } catch (e) {
          console.error('Failed to save skip result:', e);
        }
      }
      // Sync points to DB
      await syncPointsToDb(-penalty, false);
    }
    
    // Increment guest games counter if not logged in
    if (!isLoggedIn) {
      incrementGuestGames();
    }
    // Now allow the swipe - use pendingNavigateTo for deferred navigation (e.g. last card -> summary)
    if (pendingSkipIndex !== null) {
      setPendingNavigateTo(pendingSkipIndex);
    }
    setPendingSkipIndex(null);
  };

  const handleJustForFunLogin = () => {
    setShowJustForFun(false);
    setShowLoginPage(true);
  };

  const handleLogoClick = () => {
    // All users: go back to home tab and scroll to WelcomeReel
    setOpenArticleId(null); // Close any open article
    setActiveTab("home");
    setCurrentIndex(0);
    // Scroll to top
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Generate daily background based on date (changes daily for logged-in users)
  const getDailyBackground = () => {
    if (!isLoggedIn) return null;
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    const backgrounds = [
      "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)",
      "linear-gradient(135deg, #0f0f23 0%, #1a0a2e 50%, #2d1b4e 100%)",
      "linear-gradient(135deg, #1a2e1a 0%, #0f231a 50%, #0a1f1a 100%)",
      "linear-gradient(135deg, #2e1a1a 0%, #231616 50%, #1f0f0f 100%)",
      "linear-gradient(135deg, #1a1a2e 0%, #2e1a2e 50%, #1a0f2e 100%)",
    ];
    return backgrounds[dayOfYear % backgrounds.length];
  };

  const dailyBg = getDailyBackground();

  return (
    <DevLockScreen>
    <div 
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ 
        backgroundColor: '#F5F0E8',
        overscrollBehavior: 'none',
        maxWidth: '100vw',
        maxHeight: '100vh',
      }}
    >
      {/* Install PWA Banner */}
      <InstallBanner />
      
      {/* Logged-in indicator subtle glow */}
      {isLoggedIn && (
        <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#D4873A] rounded-full blur-[150px]" />
        </div>
      )}
      
      {/* Header */}
      <Header 
        coins={coins} 
        username={user?.username || "Guest"} 
        userAvatar={user?.avatar}
        userRank={userRank}
        hasPendingWager={hasPendingWager}
        rankingsOpen={showRankingsOverlay}
        onCoinsClick={() => { 
          if (showRankingsOverlay) {
            setShowRankingsOverlay(false);
          } else {
            // Close notifications/profile if open
            if (activeTab === 'notifications' || activeTab === 'profile') {
              setActiveTab('home');
            }
            setShowRankingsOverlay(true); 
            setRankingsTab('ranking'); 
          }
        }} 
        onLogoClick={handleLogoClick}
        onNotificationClick={() => { 
          setOpenArticleId(null); 
          setShowRankingsOverlay(false);
          setRadioOpen(false); // Close radio
          // If already on notifications, go back
          if (activeTab === 'notifications') {
            setActiveTab(previousTab);
          } else {
            // Save previous tab only if it's a "normal" tab
            if (!['notifications', 'profile', 'tv'].includes(activeTab)) setPreviousTab(activeTab);
            setActiveTab('notifications');
          }
        }}
        onProfileClick={() => { 
          setOpenArticleId(null); 
          setShowRankingsOverlay(false);
          setRadioOpen(false); // Close radio
          if (activeTab === 'profile') {
            setActiveTab(previousTab);
          } else {
            if (!['notifications', 'profile', 'tv'].includes(activeTab)) setPreviousTab(activeTab);
            setActiveTab('profile');
          }
        }}
        onRadioClick={() => {
          setOpenArticleId(null);
          setShowRankingsOverlay(false);
          // If radio is open, close it
          if (radioOpen) {
            setRadioOpen(false);
          } else {
            // Close other header tabs, go back to previous normal tab
            if (['notifications', 'profile', 'tv'].includes(activeTab)) {
              // Save the tab before TV/News/Profile as previous
              setActiveTab(previousTab);
            }
            setRadioOpen(true);
          }
        }}
        onTVClick={() => {
          setOpenArticleId(null);
          setShowRankingsOverlay(false);
          setRadioOpen(false); // Close radio
          if (activeTab === 'tv') {
            setActiveTab(previousTab);
          } else {
            if (!['notifications', 'profile', 'tv'].includes(activeTab)) setPreviousTab(activeTab);
            setActiveTab('tv');
          }
        }}
        notificationOpen={activeTab === 'notifications'}
        profileOpen={activeTab === 'profile'}
        radioOpen={radioOpen}
        tvOpen={activeTab === 'tv'}
        notificationsEnabled={notificationsEnabled}
        unreadCount={unreadNotifications}
        coinAnimation={coinAnimation.show ? { amount: coinAnimation.amount } : null}
      />

      {/* Coin Animation */}
      {coinAnimation.show && (
        <CoinAnimation 
          key={coinAnimKey}
          amount={coinAnimation.amount} 
          variant={coinAnimation.variant}
          onComplete={handleCoinAnimationComplete} 
        />
      )}

      {/* Rewards Page - Slide in from right */}
      <RewardsPage
        isOpen={showRewards}
        coins={coins}
        onClose={() => setShowRewards(false)}
        onRedeem={handleRedeem}
      />

      {/* Main Content Area - flex-1 to fill space between header and footer */}
      {/* Slides left when radio panel is open */}
      <div 
        className="flex-1 mt-14 overflow-hidden relative transition-transform duration-300 ease-out"
        style={{ transform: radioOpen ? 'translateX(-85%)' : undefined }}
      >
        
        {/* Rankings Overlay - opened via score click, above article */}
        {showRankingsOverlay && (
          <div className="absolute inset-0 z-[55] flex flex-col bg-cream">
            {rankingsTab === 'ranking' ? (
              <RankingsPage 
                currentUserScore={coins} 
                onShowSignup={() => { setShowRankingsOverlay(false); setLoginInitialView('signup'); setShowLoginPage(true); }} 
                onShowRewards={() => setRankingsTab('rewards')}
              />
            ) : (
              <RewardsPage
                isOpen={true}
                coins={coins}
                onClose={() => setRankingsTab('ranking')}
                onRedeem={handleRedeem}
                embedded={true}
              />
            )}
          </div>
        )}

        {/* Article Page - Overlay when open */}
        {openArticleId && !openAuthorName && (
          <div className="absolute inset-x-0 bottom-0 top-2 z-50 bg-cream">
            <ArticlePage 
              articleId={openArticleId} 
              onBack={() => {
                setOpenArticleId(null);
                // Refresh read articles from DB
                if (user?.id) {
                  fetch(`/api/user/read-article?userId=${user.id}`)
                    .then(res => res.json())
                    .then(data => {
                      const dbRead: string[] = data.readArticles || [];
                      setRewardedArticles(new Set(dbRead));
                    })
                    .catch(() => {});
                }
              }}
              onShowLogin={() => { closeAllOverlays(); setShowLoginRequired(true); }}
              onOpenAuthor={(authorName) => setOpenAuthorName(authorName)}
              onOpenArticle={(id) => setOpenArticleId(id)}
              onOpenRadio={() => { setOpenArticleId(null); setRadioOpen(true); }}
              readArticles={rewardedArticles}
              onCoinAnimation={(amount) => {
                // Points are already saved in the API, just update local state and show animation
                setCoins(prev => prev + amount);
                setCoinAnimKey(k => k + 1); // Force remount so animation always plays
                setCoinAnimation({ show: true, amount, variant: 'gain' });
                // Also update rewardedArticles immediately
                if (openArticleId) {
                  setRewardedArticles(prev => new Set([...Array.from(prev), openArticleId]));
                }
              }}
            />
          </div>
        )}

        {/* Author Page - Overlay when open (on top of article) */}
        {openAuthorName && (
          <div className="absolute inset-0 z-[60] bg-cream">
            <AuthorPage
              authorName={openAuthorName}
              onBack={() => setOpenAuthorName(null)}
              onOpenArticle={(id) => {
                setOpenAuthorName(null);
                handleOpenArticle(id);
              }}
            />
          </div>
        )}

        {/* Rankroll Detail Page - Overlay when open */}
        {openRankrollData && (
          <div className="absolute inset-0 z-50 bg-cream overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-cream border-b border-warm">
              <div className="flex items-center gap-3 px-4 py-3">
                <button 
                  onClick={() => setOpenRankrollData(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div className="flex-1 min-w-0">
                  <h1 className="font-display text-lg text-gray-900 truncate">{openRankrollData.title}</h1>
                  {openRankrollData.subtitle && (
                    <p className="text-xs text-gray-500 truncate">{openRankrollData.subtitle}</p>
                  )}
                </div>
              </div>
            </div>
            {/* Content */}
            <div className="p-4 pb-20">
              {openRankrollData.description && (
                <p className="text-sm text-gray-600 mb-4">{openRankrollData.description}</p>
              )}
              <RankingPollCard 
                poll={openRankrollData}
                onShowLogin={() => openOverlay('login', { loginView: 'login' })}
                onCoinAnimation={(amount) => {
                  setCoins(prev => prev + amount);
                  setCoinAnimation({ show: true, amount, variant: 'gain' });
                }}
              />
            </div>
          </div>
        )}

        {/* Home - Always rendered, hidden when not active */}
        <div className={`h-full absolute inset-0 ${activeTab === "home" ? "z-10" : "z-0 pointer-events-none opacity-0"}`}>
          <div
            ref={scrollContainerRef}
            data-scroll-container
            className="phone-scroll h-full overflow-y-auto"
            style={swipeBlocked ? { overflow: 'hidden', touchAction: 'none', overscrollBehavior: 'none' } : {}}
            onScroll={handleScroll}
          >
            {content.map((item, index) => (
              <div key={index} className="w-full h-full">
                {item.component}
              </div>
            ))}
          </div>
        </div>

        {/* Tab Pages - with fade transition */}
        
        {/* Articles Tab - shows list of all articles */}
        <div className={`absolute inset-0 transition-opacity duration-150 ${activeTab === "articles" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}>
          {activeTab === "articles" && (
            <ArticlesListPage onOpenArticle={handleOpenArticle} onShowLogin={() => { closeAllOverlays(); setShowLoginRequired(true); }} />
          )}
        </div>
        
        {/* Arcade Tab - shows game selection or active game */}
        <div className={`absolute inset-0 transition-opacity duration-150 ${activeTab === "arcade" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}>
          {activeTab === "arcade" && (
            arcadeGame === 'quizzbattle' ? (
              <BattlesPage 
                coins={coins} 
                setCoins={setCoins} 
                onCoinAnimation={(amount, variant) => setCoinAnimation({ show: true, amount, variant })} 
                onShowLogin={() => setShowLoginPage(true)} 
                onBattleActiveChange={setIsBattleActive} 
                pendingBattleId={pendingBattleId} 
                onPendingBattleHandled={() => setPendingBattleId(null)}
                onBack={() => setArcadeGame(null)}
                onGoToTrivia={() => setArcadeGame('trivia')}
                onGoToArticles={() => setActiveTab('articles')}
              />
            ) : arcadeGame === 'genxmen' ? (
              <GenXManGame 
                onBack={() => setArcadeGame(null)}
                onScoreUpdate={(score) => {
                  // Could add coins based on score
                }}
              />
            ) : arcadeGame === 'prediction' ? (
              <PredictionsGame 
                onBack={() => setArcadeGame(null)}
                onShowLogin={() => setShowLoginPage(true)}
              />
            ) : arcadeGame === 'trivia' ? (
              <SoloTriviaGame 
                onBack={() => setArcadeGame(null)}
                onCoinsChange={(amount) => setCoins(prev => prev + amount)}
                onCoinAnimation={(amount) => setCoinAnimation({ show: true, amount })}
              />
            ) : (
              <ArcadePage 
                onSelectGame={(game) => {
                  if (game === 'quizzbattle') {
                    setArcadeGame('quizzbattle');
                  } else if (game === 'trivia') {
                    setArcadeGame('trivia');
                  }
                }}
                onShowRankings={() => { setShowRankingsOverlay(true); setRankingsTab('ranking'); }}
                onShowBattles={() => setArcadeGame('quizzbattle')}
                battleAlertCount={pendingChallengeCount + activeBattleCount}
                userId={user?.id}
                onCoinsChange={(amount) => { setCoins(prev => prev + amount); setCoinAnimation({ show: true, amount }); }}
                onPlaySpecificBattle={(battleId) => { setPendingBattleId(battleId); setArcadeGame('quizzbattle'); }}
              />
            )
          )}
        </div>
        
        {/* Rankroll Tab (community polls/votings) */}
        <div className={`absolute inset-0 transition-opacity duration-150 ${activeTab === "voting" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}>
          {activeTab === "voting" && (
            <RankrollPage 
              onOpenArticle={handleOpenArticle}
              onOpenRankroll={async (pollId) => {
                try {
                  const res = await fetch(`/api/polls/${pollId}`);
                  const data = await res.json();
                  if (data.success && data.poll) {
                    setOpenRankrollData(data.poll);
                  }
                } catch (e) {
                  console.error('Failed to load rankroll:', e);
                }
              }}
              onCoinAnimation={(amount) => {
                setCoins(prev => prev + amount);
                setCoinAnimation({ show: true, amount, variant: 'gain' });
              }}
            />
          )}
        </div>
        
        {/* Shop Tab */}
        <div className={`absolute inset-0 transition-opacity duration-150 ${activeTab === "shop" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}>
          {activeTab === "shop" && <ShopPage coins={coins} onCoinsUsed={(amount) => { setCoins(prev => prev - amount); setCoinAnimation({ show: true, amount: -amount }); }} />}
        </div>
        
        {/* TV Tab */}
        <div className={`absolute inset-0 transition-opacity duration-150 ${activeTab === "tv" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}>
          {activeTab === "tv" && <TVPage />}
        </div>
        
        {/* Battles Tab (accessed from Arcade -> QuizzBattle) */}
        <div className={`absolute inset-0 transition-opacity duration-150 ${activeTab === "battles" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}>
          {activeTab === "battles" && <BattlesPage coins={coins} setCoins={setCoins} onCoinAnimation={(amount, variant) => setCoinAnimation({ show: true, amount, variant })} onShowLogin={() => setShowLoginPage(true)} onBattleActiveChange={setIsBattleActive} pendingBattleId={pendingBattleId} onPendingBattleHandled={() => setPendingBattleId(null)} onGoToTrivia={() => { setActiveTab('arcade'); setArcadeGame('trivia'); }} onGoToArticles={() => setActiveTab('articles')} />}
        </div>
        
        {/* Notifications Tab */}
        <div className={`absolute inset-0 transition-opacity duration-150 ${activeTab === "notifications" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}>
          {activeTab === "notifications" && (
            <NotificationPage 
              onGoToProfile={() => setActiveTab('profile')}
              onGoToBattle={(battleId) => {
                setPendingBattleId(battleId);
                setArcadeGame('quizzbattle');
                setActiveTab('arcade');
              }}
              autoEnable={notificationAutoEnable}
              onNewNotification={() => {}}
              onPointsAwarded={(amount) => {
                // Points already added by API - just show animation and refresh
                setCoinAnimation({ show: true, amount });
                sounds.coins();
                // Refresh coins from server to get updated total (convert to BOGX)
                if (user?.id) {
                  fetch(`/api/user/points?userId=${user.id}`)
                    .then(res => res.json())
                    .then(data => { 
                      if (data.success) {
                        const bogx = data.points; // Already in BOGX
                        setCoins(bogx);
                      }
                    })
                    .catch(() => {});
                }
              }}
              autoOpenSettings={autoOpenNotificationSettings}
              onSettingsClosed={() => setAutoOpenNotificationSettings(false)}
            />
          )}
        </div>
        
        {/* Profile Tab */}
        <div className={`absolute inset-0 transition-opacity duration-150 ${activeTab === "profile" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}>
          {activeTab === "profile" && (
            isLoggedIn ? <ProfilePage coins={coins} /> : <LoginPage isOpen={true} onClose={() => setActiveTab(previousTab)} onSuccess={() => {}} />
          )}
        </div>
      </div>

      {/* Radio Panel - Slides in from right */}
      <div 
        className={`fixed top-14 right-0 bottom-0 w-[85%] bg-cream z-[60] transition-transform duration-300 ease-out border-l border-warm ${
          radioOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Radio Header with Equalizer */}
          <div className="px-4 pt-4 pb-3 border-b border-warm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#D4873A] flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-base text-gray-900 tracking-wide">Radio</h3>
                <p className="text-[10px] text-gray-500">Pick a station, press play & enjoy</p>
              </div>
              <button 
                onClick={() => setRadioOpen(false)}
                className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Mini Equalizer */}
            <div className="flex items-end justify-between w-full h-5 gap-[1px]">
              {eqBarsMobile.map((bar, i) => (
                <div
                  key={i}
                  className="bg-gradient-to-t from-[#D4873A]/50 to-[#E5A55A]/30 rounded-t-sm flex-1"
                  style={{
                    animation: `eqMobile ${bar.duration} ease-in-out ${bar.delay} infinite alternate`,
                    height: bar.height,
                  }}
                />
              ))}
            </div>
            <style>{`
              @keyframes eqMobile {
                0% { height: 20%; }
                100% { height: 100%; }
              }
            `}</style>
          </div>

          {/* GenX Stations Label */}
          <div className="px-4 pt-3 pb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#D4873A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <span className="font-display text-xs text-[#D4873A] uppercase tracking-wider">GenX Stations</span>
          </div>
          
          {/* Station List */}
          <div className="flex-1 overflow-y-auto px-4" style={{ scrollbarWidth: 'none' }}>
            <div className="space-y-1">
              {radioStations.map((station) => (
                <button
                  key={station._id}
                  onClick={() => {
                    const spotifyUrl = `https://open.spotify.com/playlist/${station.playlistId}`;
                    window.open(spotifyUrl, '_blank', 'noopener,noreferrer');
                    setRadioOpen(false);
                  }}
                  className="w-full flex items-center gap-3 py-2.5 text-left group"
                >
                  {station.imageUrl ? (
                    <img 
                      src={station.imageUrl} 
                      alt={station.name}
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#D4873A] to-[#B5672A] flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-sm text-gray-900 truncate tracking-wide">
                      <span className="font-light text-gray-400">Best of GenX - </span>
                      <span className="font-bold">{station.name.replace('Best of GenX - ', '')}</span>
                    </div>
                    <div className="text-[10px] text-gray-900 truncate">{station.description}</div>
                  </div>
                  <div className="flex flex-col items-center flex-shrink-0">
                    <span className="text-[9px] text-gray-400">Open in</span>
                    <div className="flex items-center gap-0.5">
                      <svg className="w-[14px] h-[14px] text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                      </svg>
                      <span className="text-[10px] font-medium text-[#1DB954]">Spotify</span>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            
            </div>

            {/* Song Request Banner */}
            <div className="mt-4 pt-4 border-t border-warm">
              <div className="flex items-center gap-3 p-3 bg-[#D4873A]/10 rounded-xl border border-[#D4873A]/20 mb-3">
                <div className="w-10 h-10 rounded-full bg-[#D4873A] flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-display text-sm text-gray-900 tracking-wide">Suggest a Song</h4>
                  <p className="text-[10px] text-gray-500">Your wish on our playlist</p>
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="px-2 py-0.5 bg-[#D4873A]/20 rounded text-[10px] font-bold text-[#D4873A]">+50 BOGX</span>
                  <p className="text-[8px] text-gray-400 mt-0.5">if your song gets added</p>
                </div>
              </div>
              
              {!isLoggedIn ? (
                /* Sign-up prompt for non-logged-in users */
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#D4873A]/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#D4873A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <p className="text-white font-semibold text-sm mb-1">Become part of the community!</p>
                  <p className="text-gray-400 text-xs mb-4">Suggest your favorite songs for our GenX playlists.</p>
                  <button
                    onClick={() => openOverlay('login', { loginView: 'signup' })}
                    className="w-full py-2.5 rounded-lg font-bold text-sm bg-[#D4873A] text-white hover:bg-[#C4772A] transition-colors"
                  >
                    Sign up for free
                  </button>
                </div>
              ) : (
                /* Song request form for logged-in users */
                <div className="space-y-3">
                  {songRequestSent ? (
                    <div className="text-center py-4 bg-[#D4873A]/5 rounded-xl">
                      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-green-500/20 flex items-center justify-center">
                        <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="font-bold text-gray-900">Your request is underway!</p>
                      <p className="text-sm text-gray-500 mt-1">Our team will take it from here.</p>
                      <button
                        onClick={() => setSongRequestSent(false)}
                        className="mt-3 text-xs text-[#D4873A] hover:underline"
                      >
                        Suggest another song
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Playlist Select */}
                      <div className="relative">
                        <select
                          value={songRequestData.playlist}
                          onChange={(e) => setSongRequestData({...songRequestData, playlist: e.target.value})}
                          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#D4873A]/50 appearance-none"
                        >
                          <option value="">Choose a playlist...</option>
                          {radioStations.map((station) => (
                            <option key={station._id} value={station.name}>{station.name}</option>
                          ))}
                        </select>
                        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>

                      {/* Spotify Link Input */}
                      <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <input
                          type="url"
                          value={songRequestData.link}
                          onChange={async (e) => {
                            const newLink = e.target.value;
                            setSongRequestData(prev => ({...prev, link: newLink}));
                            
                            if (newLink.includes('spotify.com') && newLink.includes('track')) {
                              try {
                                const res = await fetch(`/api/spotify-info?url=${encodeURIComponent(newLink)}`);
                                const data = await res.json();
                                if (data.success) {
                                  setSongRequestData(prev => ({
                                    ...prev,
                                    song: data.song || prev.song,
                                    band: data.band || prev.band,
                                  }));
                                }
                              } catch { /* ignore */ }
                            }
                          }}
                          placeholder="Paste Spotify link..."
                          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#D4873A]/50"
                        />
                      </div>

                      {/* Track Info */}
                      {(songRequestData.band || songRequestData.song) && (
                        <div className="flex gap-2 text-xs items-center">
                          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-gray-900 font-medium truncate">{songRequestData.band} – {songRequestData.song}</span>
                        </div>
                      )}
                      {songRequestData.link && !songRequestData.band && !songRequestData.song && (
                        <div className="flex gap-2 text-xs">
                          <span className="text-[#D4873A] animate-pulse">Loading track info...</span>
                        </div>
                      )}

                      {/* Submit Button - ORANGE */}
                      <button
                        onClick={() => {
                          if (songRequestData.playlist && songRequestData.band && songRequestData.song) {
                            const payload = {
                              userId: user?.id,
                              username: user?.username,
                              playlist: songRequestData.playlist.replace('Best of GenX - ', ''),
                              band: songRequestData.band,
                              song: songRequestData.song,
                              link: songRequestData.link || null,
                            };
                            fetch('/api/song-request', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(payload),
                            }).catch((err) => console.error('Song request failed:', err));
                            setSongRequestSent(true);
                            setSongRequestData({ playlist: '', band: '', song: '', link: '' });
                          }
                        }}
                        disabled={!songRequestData.playlist || !songRequestData.band || !songRequestData.song || !songRequestData.link}
                        className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:bg-gray-300 disabled:text-gray-500 bg-[#D4873A] text-white hover:bg-[#C4772A] flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                        Send request
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation - fixed at bottom */}
      <div className="flex-shrink-0 relative z-50">
        <BottomNav 
          activeTab={activeTab} 
          onTabChange={(tab) => {
            // Close all overlays first
            closeAllOverlays();
            setShowRankingsOverlay(false);
            
            // Block tab switching during active battle
            if (isBattleActive && tab !== "battles") {
              // Show warning - can't leave during battle
              return;
            }
            
            // Save scroll position when leaving home
            if (activeTab === "home" && tab !== "home" && scrollContainerRef.current) {
              setSavedScrollPosition(scrollContainerRef.current.scrollTop);
            }
            
            // Close any open article/overlay when switching tabs
            setOpenArticleId(null);
            // Reset arcade game when leaving arcade tab
            if (activeTab === 'arcade' && tab !== 'arcade') {
              setArcadeGame(null);
            }
            // Mark battle badge as seen when entering arcade (won't re-show on refresh)
            if (tab === 'arcade') {
              if (user?.id) sessionStorage.setItem(`arcade_badge_seen_${user.id}`, '1');
              setPendingChallengeCount(0);
              setActiveBattleCount(0);
            }
            
            // Track previous tab before switching (for login close behavior)
            setPreviousTab(activeTab);
            
            // Set tab first, then restore scroll
            setActiveTab(tab);
            
            // Restore scroll position when returning to home
            if (tab === "home" && activeTab !== "home") {
              // Use requestAnimationFrame to ensure DOM is updated
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollTop = savedScrollPosition;
                  }
                });
              });
            }
          }} 
          userAvatar={isLoggedIn ? user?.avatar : undefined}
          lockedToTab={isBattleActive ? "battles" : undefined}
          battleAlertCount={pendingChallengeCount + activeBattleCount}
        />
      </div>

      {/* Wait Modal - shown when trying to swipe before game starts */}
      {showWaitModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setShowWaitModal(false)}
        >
          <div 
            className="bg-gray-900 border border-[#D4873A]/50 rounded-2xl p-6 mx-4 max-w-sm text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#D4873A]/20 flex items-center justify-center">
              <span className="text-3xl">{isGameLive ? '⏳' : '😴'}</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              {isGameLive ? 'Hold On!' : 'Shhh... Nap Time!'}
            </h2>
            <p className="text-white/70 text-sm mb-4">
              {isGameLive 
                ? 'Start the game first by clicking the challenge box above. Complete the 3-2-1 countdown to unlock swiping!'
                : 'Even Gen X legends need their beauty sleep! 💤 Daily challenges run from 10:00 to 21:00 CET. Set an alarm and come back refreshed!'
              }
            </p>
            <button
              onClick={() => setShowWaitModal(false)}
              className="w-full py-3 bg-[#D4873A] hover:bg-[#c4e000] rounded-xl font-bold text-black transition-colors"
            >
              {isGameLive ? 'Got it!' : 'Sweet Dreams! 🌙'}
            </button>
          </div>
        </div>
      )}

      {/* Just For Fun Modal */}
      <JustForFunModal 
        isOpen={showJustForFun} 
        onClose={() => setShowJustForFun(false)} 
        onLogin={handleJustForFunLogin}
      />

      {/* Login Modal - for inline use */}

    <LoginRequiredModal
      isOpen={showLoginRequired}
      onClose={() => setShowLoginRequired(false)}
      onLogin={() => { setShowLoginRequired(false); setLoginInitialView('login'); setShowLoginPage(true); }}
      onRegister={() => { setShowLoginRequired(false); setLoginInitialView('signup'); setShowLoginPage(true); }}
    />

    {/* Login Page - Slide in from right */}
    <LoginPage 
      isOpen={showLoginPage}
      onClose={() => setShowLoginPage(false)}
      initialView={loginInitialView}
      onSuccess={() => {
        setShowLoginPage(false);
        // Enable swiping after login - but don't auto-join, let them see ARE YOU READY
        setActiveTab("home");
      }}
    />

    {/* Join Challenge Page - Prize info before joining */}
    <JoinChallengePage
      isOpen={showJoinChallengePage}
      onClose={() => setShowJoinChallengePage(false)}
      onShowLogin={() => {
        setShowJoinChallengePage(false);
        setLoginInitialView('login');
        openOverlay('login');
      }}
      onShowSignUp={() => {
        setShowJoinChallengePage(false);
        setLoginInitialView('signup');
        openOverlay('login');
      }}
      onJoinAsGuest={() => {
        setShowJoinChallengePage(false);
        handleJoinChallenge();
      }}
      onOpenShop={() => {
        setShowJoinChallengePage(false);
        setActiveTab('shop');
      }}
    />

      {/* Swipe Warning Modal */}
      <SwipeWarningModal
        isOpen={showSwipeWarning}
        onContinue={handleSwipeWarningContinue}
        onRestart={handleSwipeWarningRestart}
        reward={currentReward}
      />

      {/* Skip Penalty Modal */}
      <SkipPenaltyModal
        isOpen={showSkipPenalty}
        onPlay={handleSkipPenaltyPlay}
        onSkip={handleSkipPenaltySkip}
        reward={currentReward}
      />

      {/* No Funds Modal */}
      <NoFundsModal
        isOpen={showNoFunds}
        onClose={() => setShowNoFunds(false)}
        onTopUp={() => {
          setShowNoFunds(false);
          // Open Rewards page
          setShowRewards(true);
        }}
        onPlayTrivia={() => {
          setShowNoFunds(false);
          // Navigate to Solo Trivia
          setActiveTab('arcade');
        }}
        onReadArticles={() => {
          setShowNoFunds(false);
          // Navigate to News/Articles
          setActiveTab('articles');
        }}
        onWatchAd={() => {
          // Add 100 points for watching ad
          const adReward = 100;
          setCoins(prev => prev + adReward);
          setCoinAnimation({ show: true, amount: adReward });
          setShowNoFunds(false);
          // Sync to database
          if (isLoggedIn && user?.id) {
            syncPointsToDb(adReward, false);
          }
        }}
      />

      {/* Checkout Success Modal */}
      <CheckoutSuccessModal
        isOpen={showCheckoutSuccess}
        onClose={() => {
          setShowCheckoutSuccess(false);
          setCheckoutSessionId(null);
        }}
        sessionId={checkoutSessionId || undefined}
      />

      {/* Global Push Reminder - Matches InstallBanner style exactly */}
      {showPushReminder && (
        <div 
          className={`fixed left-0 right-0 z-[40] transition-all duration-300 ease-out ${
            showPushReminder ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
          }`}
          style={{ bottom: '64px' }}
        >
          <div className="bg-gradient-to-r from-[#D4873A] via-[#E5994A] to-[#D4873A] shadow-xl border-t border-white/20">
            <div className="flex items-center gap-4 px-4 py-3.5">
              {/* Icon */}
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0 shadow-inner">
                <Bell className="w-6 h-6 text-white" />
              </div>
              
              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-base drop-shadow-sm">Never miss a reward</p>
                <p className="text-white/80 text-xs font-medium">
                  Enable notifications & earn <span className="font-bold">+0.10 BOGX</span>
                </p>
              </div>
              
              {/* Action Button */}
              <button
                onClick={handleEnablePushFromReminder}
                className="px-4 py-2.5 bg-white text-[#D4873A] text-sm font-bold rounded-xl flex items-center gap-1.5 hover:bg-white/90 transition-colors flex-shrink-0 shadow-lg"
              >
                <Bell className="w-4 h-4" />
                Enable
              </button>
              
              {/* Close Button */}
              <button
                onClick={handleDismissPushReminder}
                className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Toast */}
      {showLogoutToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] animate-fadeIn">
          <div className="bg-[#1a1a1a]/95 backdrop-blur-md border border-white/20 rounded-lg px-4 py-2 shadow-lg">
            <p className="text-white text-sm">✓ Logged out successfully</p>
          </div>
        </div>
      )}

      {/* Push Notification Toast - shows on any page */}
      {pushToast && (
        <div 
          className="fixed top-4 left-4 right-4 z-[250] animate-slideDown cursor-pointer"
          onClick={() => {
            setPushToast(null);
            if (pushToast.url?.includes('notifications')) {
              setActiveTab('notifications');
            } else if (pushToast.url?.includes('battles')) {
              setArcadeGame('quizzbattle');
              setActiveTab('arcade');
            }
          }}
        >
          <div className="bg-gradient-to-r from-[#1a1a1a] to-[#252525] backdrop-blur-md border border-[#D4873A]/50 rounded-xl p-4 shadow-2xl flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[#D4873A]/20 flex items-center justify-center flex-shrink-0">
              <img src="/images/genxlogo1.png" alt="" className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">{pushToast.title}</p>
              <p className="text-white/60 text-xs mt-0.5 line-clamp-2">{pushToast.body}</p>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setPushToast(null); }}
              className="text-white/40 hover:text-white/60 text-lg"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Welcome Back Modal */}
      {(() => {
        const playedCount = Object.keys(todaysResults).length;
        const totalCards = cards.filter(c => !c.guestCard).length;
        const hasStarted = playedCount > 0;
        const isComplete = totalCards > 0 && playedCount >= totalCards;

        const handlePrimary = () => {
          setShowWelcomeBack(false);
          if (hasStarted && !isComplete) {
            const filteredCards = cards.filter(c => !c.guestCard);
            let nextCardIndex = 0;
            for (let i = 0; i < filteredCards.length; i++) {
              if (!todaysResults[filteredCards[i]._id]) {
                nextCardIndex = i;
                break;
              }
            }
            const baseOffset = 1;
            const adCardPosition = 2;
            const contentIndex = baseOffset + (nextCardIndex >= adCardPosition ? nextCardIndex + 1 : nextCardIndex);
            setActiveTab('home');
            setCurrentIndex(contentIndex);
          }
        };

        return (
          <WelcomeBackModal
            isOpen={showWelcomeBack}
            onClose={() => setShowWelcomeBack(false)}
            username={user?.username || 'there'}
            currentRank={welcomeCurrentRank}
            rankChange={welcomeRankChange}
            welcomeAI={welcomeAI}
            notificationsEnabled={welcomeNotificationsEnabled}
            unreadCount={unreadNotifications}
            playedCount={playedCount}
            totalCards={totalCards}
            pendingChallengeCount={pendingChallengeCount}
            activeBattleCount={activeBattleCount}
            onPrimaryAction={handlePrimary}
            onEnableNotifications={() => {
              setShowWelcomeBack(false);
              setActiveTab('notifications');
            }}
            onGoToBattles={() => {
              setArcadeGame('quizzbattle');
              setActiveTab('arcade');
            }}
          />
        );
      })()}

    </div>
    </DevLockScreen>
  );
}
