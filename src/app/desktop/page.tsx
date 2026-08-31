"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Play, FileText, Brain, Vote, ShoppingBag, Trophy, Tv, Radio, Bell, User, Users, X, ChevronLeft, ChevronRight, Gift, Clock, Trash2, Swords } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useBogxCoins } from "@/hooks/useBogxCoins";
import { usePendingWager } from "@/hooks/usePendingWager";
import GenXLoader from "@/components/GenXLoader";
import { formatCurrency, getCurrencySymbol } from "@/utils/currency";
import { getUserLevel, getLevelIndex, getLevelProgress, getBogxToNextLevel, LEVELS } from "@/utils/levels";

// Import real components
import { NavTab } from "@/components/BottomNav";
import TVPage from "@/components/TVPage";
import ArcadePage from "@/components/ArcadePage";
import DesktopArcadePage from "@/components/desktop/DesktopArcadePage";
import BattlesPage from "@/components/BattlesPage";
import ArticlePage from "@/components/ArticlePage";
import DesktopRankrollPage from "@/components/desktop/DesktopRankrollPage";
import DesktopRankingDetailPage from "@/components/desktop/DesktopRankingDetailPage";
import DesktopArticlesPage from "@/components/desktop/DesktopArticlesPage";
import WelcomeReel from "@/components/games/WelcomeReel";
import ShopPage from "@/components/ShopPage";
import ProfilePage from "@/components/ProfilePage";
import NotificationPage from "@/components/NotificationPage";
import DesktopRankingsPage from "@/components/desktop/DesktopRankingsPage";
import LoginPage from "@/components/LoginPage";
import DesktopLoginPage from "@/components/desktop/DesktopLoginPage";
import PredictionsGame from "@/components/games/PredictionsGame";
import GenXManGame from "@/components/games/GenXManGame";
import SoloTriviaGame from "@/components/games/SoloTriviaGame";
import BogxInvadersGame from "@/components/games/BogxInvadersGame";
import CoinAnimation from "@/components/CoinAnimation";
import DesktopRewardsPage from "@/components/desktop/DesktopRewardsPage";
import DesktopContentWrapper from "@/components/desktop/DesktopContentWrapper";
import DesktopBattlesPage from "@/components/desktop/DesktopBattlesPage";
import BattleResultScreen from "@/components/battles/BattleResultScreen";
import DesktopRankWidget from "@/components/desktop/DesktopRankWidget";
import OpenBattlesModal from "@/components/OpenBattlesModal";
import CommunitySoundPage from "@/components/CommunitySoundPage";
import WelcomeBackModal, { WelcomeBackRankChange } from "@/components/WelcomeBackModal";
import CheckoutSuccessModal from "@/components/CheckoutSuccessModal";
import StaticPageInline from "@/components/StaticPageInline";
import PlayerCard from "@/components/PlayerCard";
import { useLiveRankings } from "@/hooks/useLiveRankings";

// Navigation tabs
const navTabs = [
  { id: "feed" as NavTab, label: "Feed", icon: Play },
  { id: "arcade" as NavTab, label: "Trivia", icon: Brain },
  { id: "articles" as NavTab, label: "Articles", icon: FileText },
  { id: "voting" as NavTab, label: "Rankroll", icon: Vote },
];

export default function DesktopPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoggedIn } = useAuth();
  const [mounted, setMounted] = useState(false);
  
  // Central BOGX hook - same source of truth on Desktop AND Mobile
  const { coins, setCoins } = useBogxCoins(user?.id);
  // Always-current balance for animateCoins, which needs the starting value
  // without capturing a stale `coins` from the render it was created in.
  const coinsRef = useRef(coins);
  coinsRef.current = coins;
  const [activeTab, setActiveTab] = useState<NavTab>("feed");
  const [previousTab, setPreviousTab] = useState<NavTab>("feed");
  const [tabRestored, setTabRestored] = useState(false);
  const [articlesCategoryFilter, setArticlesCategoryFilter] = useState<string>('all');
  const [openNotificationSettings, setOpenNotificationSettings] = useState(false);
  const [previousTabBeforeSettings, setPreviousTabBeforeSettings] = useState<NavTab | null>(null);
  
  // Preload arcade banner images early so they're ready when user visits Trivia
  useEffect(() => {
    const preloadImages = [
      '/images/Hintergund/battle.png',
      '/images/Hintergund/solo.png',
    ];
    preloadImages.forEach((src) => {
      const img = document.createElement('img');
      img.src = src;
    });
  }, []);
  
  // Restore activeTab from sessionStorage after mount (SSR-safe)
  useEffect(() => {
    if (tabRestored) return;
    const saved = sessionStorage.getItem('desktopActiveTab');
    if (saved && ['feed', 'arcade', 'articles', 'voting', 'shop', 'tv', 'radio', 'notifications', 'profile', 'rankings'].includes(saved)) {
      setActiveTab(saved as NavTab);
    }
    setTabRestored(true);
  }, [tabRestored]);
  
  // Persist activeTab to sessionStorage
  useEffect(() => {
    if (!tabRestored) return;
    sessionStorage.setItem('desktopActiveTab', activeTab);
  }, [activeTab, tabRestored]);
  
  const [arcadeGame, setArcadeGame] = useState<string | null>(null);
  const [showLoginPage, setShowLoginPage] = useState(false);
  const [showOpenBattlesModal, setShowOpenBattlesModal] = useState(false);
  const [openArticleId, setOpenArticleId] = useState<string | null>(null);
  const [showCommunitySound, setShowCommunitySound] = useState(false);
  const [openRankrollId, setOpenRankrollId] = useState<string | null>(null);
  const [openRankrollData, setOpenRankrollData] = useState<any>(null);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0); // Increment to force feed refresh
  const [staticPageSlug, setStaticPageSlug] = useState<string | null>(null);
  const [coinAnimation, setCoinAnimation] = useState<{ show: boolean; amount: number; variant?: 'gain' | 'loss' | 'hold' }>({ show: false, amount: 0 });
  const [coinAnimKey, setCoinAnimKey] = useState(0);
  
  // Animate coins counting up/down step by step.
  //
  // Absolute, not relative: every tick writes start + progress instead of adding to
  // whatever is displayed right now. With `setCoins(prev => prev + step)` a server
  // sync landing mid-animation had the remaining steps added on top of an already
  // credited balance, so the counter overshot (96.71 -> 96.75) before the next sync
  // pulled it back to the correct 96.73.
  const animateCoins = (amount: number) => {
    if (amount === 0) return;
    const steps = Math.min(Math.abs(Math.round(amount * 100)), 20); // Max 20 steps
    const stepDuration = 1500 / steps; // Total ~1.5s animation
    const start = coinsRef.current;
    const target = Math.round((start + amount) * 100) / 100;

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      const value = currentStep >= steps ? target : start + (amount * currentStep) / steps;
      setCoins(Math.round(value * 100) / 100);
      if (currentStep >= steps) clearInterval(interval);
    }, stepDuration);
  };
  // Stable reference so memoized children (e.g. WelcomeReel) don't re-render on every page render
  const triggerCoinGain = useCallback((amount: number) => {
    setCoinAnimKey(k => k + 1);
    setCoinAnimation({ show: true, amount, variant: 'gain' });
  }, []);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [isBattleActive, setIsBattleActive] = useState(false);
  // Pending wager indicator - global source of truth (same on mobile & desktop)
  const { hasPendingWager, pendingAmount } = usePendingWager(user?.id);
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  const [pendingBattleId, setPendingBattleId] = useState<string | null>(null);
  const [showBattleResultId, setShowBattleResultId] = useState<string | null>(null); // Battle result to show in content area
  const [showChallenge, setShowChallenge] = useState<{ battleId: string; notificationId?: string } | null>(null); // Challenge to show in content area
  const [challengeTarget, setChallengeTarget] = useState<{ id: string; username: string } | null>(null); // Pre-selected player to challenge
  const [radioStations, setRadioStations] = useState<{_id: string; name: string; description: string; playlistId: string}[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [leaderboardCountdown, setLeaderboardCountdown] = useState('');
  const [isBreakTime, setIsBreakTime] = useState(false);
  const [breakCountdown, setBreakCountdown] = useState('');
  const [countdownMs, setCountdownMs] = useState(0); // Centiseconds for sub-1-hour display
  const [readArticles, setReadArticles] = useState<Set<string>>(new Set());
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Welcome back modal state
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [welcomeRankChange, setWelcomeRankChange] = useState<WelcomeBackRankChange | null>(null);
  const [welcomeCurrentRank, setWelcomeCurrentRank] = useState<number | null>(null);
  const [welcomeTotalPoints, setWelcomeTotalPoints] = useState(0);
  const [welcomePointsToday, setWelcomePointsToday] = useState(0);
  const [welcomePointsToNext, setWelcomePointsToNext] = useState(0);
  const [welcomeStreak, setWelcomeStreak] = useState(0);
  const [welcomeEvents, setWelcomeEvents] = useState<any[]>([]);
  const [welcomeLastSeenAt, setWelcomeLastSeenAt] = useState<string | null>(null);
  const [welcomeDailyReward, setWelcomeDailyReward] = useState(false);
  const [pendingChallengeCount, setPendingChallengeCount] = useState(0);
  const [activeBattleCount, setActiveBattleCount] = useState(0);
  const [currentLeader, setCurrentLeader] = useState<string | null>(null);
  const [welcomeLevel, setWelcomeLevel] = useState(1);
  const [welcomeLevelName, setWelcomeLevelName] = useState('Rookie');
  const [welcomeLevelProgress, setWelcomeLevelProgress] = useState(0);
  const [welcomePointsToNextLevel, setWelcomePointsToNextLevel] = useState(0);
  const [welcomeAvatar, setWelcomeAvatar] = useState<string | undefined>(undefined);
  const [welcomeLoading, setWelcomeLoading] = useState(true);
  
  // Fetch pending battle counts on login
  useEffect(() => {
    if (!isLoggedIn || !user?.id) {
      setPendingChallengeCount(0);
      setActiveBattleCount(0);
      return;
    }
    const fetchBattleCounts = async () => {
      // Always refresh — the badge should reflect the true pending count
      // at all times, even after the user has already visited Arcade once.
      try {
        const res = await fetch(`/api/battles?userId=${user.id}&countOnly=true`);
        const data = await res.json();
        if (data.success) {
          setPendingChallengeCount(data.pendingChallenges ?? 0);
          setActiveBattleCount(data.activeBattles ?? 0);
        }
      } catch { /* silently fail */ }
    };
    fetchBattleCounts();
    // Poll frequently so the badge clears as soon as a battle is finished
    const interval = setInterval(fetchBattleCounts, 10000);
    // Also refresh when the tab regains focus
    window.addEventListener('focus', fetchBattleCounts);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', fetchBattleCounts);
    };
    // arcadeGame/activeTab in deps: refetch when a game view is opened or closed
  }, [isLoggedIn, user?.id, arcadeGame, activeTab]);

  // Sidebar data with loading states
  const [rankings, setRankings] = useState<any[]>([]);
  const [rankingsLoading, setRankingsLoading] = useState(true);
  const [rankingsLimit, setRankingsLimit] = useState(50); // Fetch more from API but display limited
  const [rankingsHasMore, setRankingsHasMore] = useState(true); // Whether there are more rankings to load
  const [rankingsLoadingMore, setRankingsLoadingMore] = useState(false); // Loading more indicator
  const [visibleRankingsCount, setVisibleRankingsCount] = useState(10); // Start with top 10, show more on click
  const leaderboardScrollRef = useRef<HTMLDivElement>(null);
  const [leaderboardDayOffset, setLeaderboardDayOffset] = useState(0); // 0 = today, -1 = yesterday, etc.
  const [scrubProgress, setScrubProgress] = useState<number | null>(null); // null = live, 0-100 = scrubbing
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const scrubDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [pointChanges, setPointChanges] = useState<Record<string, number>>({}); // Track point changes for animations
  // Load rank changes from localStorage on mount
  const [rankChanges, setRankChanges] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('leaderboard-rank-changes');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  const prevRankingsRef = useRef<any[]>([]);
  const [shopProducts, setShopProducts] = useState<any[]>([]);
  const [tvVideos, setTvVideos] = useState<any[]>([]);
  const [tvLoading, setTvLoading] = useState(true);
  
  // Live rankings for the widget - uses the same hook as the leaderboard for consistent change arrows.
  // The date MUST be stable: a fresh `new Date()` per render would change the
  // hook's dependencies every render and re-fetch in an endless loop.
  const widgetToday = useMemo(() => new Date(), []);
  const { currentUserEntry: dailyUserEntry } = useLiveRankings({ period: 'day', selectedDate: widgetToday, userId: user?.id });
  const { currentUserEntry: monthlyUserEntry } = useLiveRankings({ period: 'month', selectedDate: widgetToday, userId: user?.id });
  const { currentUserEntry: yearlyUserEntry } = useLiveRankings({ period: 'year', selectedDate: widgetToday, userId: user?.id });
  
  const scoreRankPositions = {
    dailyRank: dailyUserEntry?.rank || 0,
    monthlyRank: monthlyUserEntry?.rank || 0,
    yearlyRank: yearlyUserEntry?.rank || 0,
    dailyChange: dailyUserEntry?.change,
    monthlyChange: monthlyUserEntry?.change,
    yearlyChange: yearlyUserEntry?.change,
  };
  

  // Pre-compute equalizer bar values once to avoid Math.random() in render
  const eqBarsSidebar = useMemo(() =>
    Array.from({ length: 30 }).map((_, i) => ({
      duration: `${(0.3 + Math.random() * 0.4).toFixed(2)}s`,
      delay: `${((i * 0.03) % 0.3).toFixed(2)}s`,
      height: `${Math.floor(30 + Math.random() * 70)}%`,
    })), []);

  useEffect(() => {
    setMounted(true);
    loadAllData();
  }, []);

  // Check for checkout success/cancelled URL params
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (checkout === 'success') {
      const sessionId = searchParams.get('session_id');
      setCheckoutSessionId(sessionId);
      setShowCheckoutSuccess(true);
      setActiveTab('shop');
      // Clean URL
      window.history.replaceState({}, '', '/desktop');
    } else if (checkout === 'cancelled') {
      setActiveTab('shop');
      window.history.replaceState({}, '', '/desktop');
    }
    
    // Restore article from URL on page load/refresh
    const articleId = searchParams.get('article');
    if (articleId && !openArticleId) {
      setOpenArticleId(articleId);
    }
  }, [searchParams]);

  // Coins loading + syncing handled by useBogxCoins hook

  // Load user rank and read articles when user is available
  useEffect(() => {
    const loadUserRank = () => {
      if (!user?.id) return;
      fetch(`/api/rankings/snapshot?period=day`)
        .then(res => res.json())
        .then(data => {
          if (data.rankings && Array.isArray(data.rankings)) {
            const myRankIndex = data.rankings.findIndex((r: any) => r._id === user.id);
            if (myRankIndex !== -1) {
              const rankData = data.rankings[myRankIndex];
              setUserRank(rankData.rank || myRankIndex + 1);
            }
          }
        })
        .catch(() => {});
    };
    
    if (user?.id) {
      loadUserRank();
      
      // Refresh rank + leaderboard instantly when BOGX changes (no page refresh needed)
      // Use silent mode to avoid showing loading spinner during gameplay
      // Note: scoreRankPositions now comes from useLiveRankings which auto-refreshes
      const onBogxUpdate = () => {
        loadUserRank();
        loadLeaderboard(leaderboardDayOffset, true); // silent=true for smooth updates
      };
      window.addEventListener('bogx-updated', onBogxUpdate);
      // cleanup happens below via combined return
      
      // Load read articles ONLY from DB (no localStorage for logged-in users)
      fetch(`/api/user/read-article?userId=${user.id}`)
        .then(res => res.json())
        .then(data => {
          const dbRead: string[] = data.readArticles || [];
          setReadArticles(new Set<string>(dbRead));
        })
        .catch(() => {});
      
      return () => window.removeEventListener('bogx-updated', onBogxUpdate);
    } else {
      // Guest: no read tracking (they see all as unread)
      setReadArticles(new Set());
    }
  }, [user?.id]);

  // Show welcome back message ONLY right after an actual login action — not on every
  // page load/refresh/new-tab while already authenticated via persisted localStorage.
  useEffect(() => {
    if (!mounted || !isLoggedIn || !user?.id) return;
    
    // Don't show welcome if returning from checkout
    const checkout = searchParams.get('checkout');
    if (checkout === 'success' || checkout === 'cancelled') return;
    
    // Only fires if login() just set this flag (a real login action just happened).
    if (sessionStorage.getItem('bogx_just_logged_in') !== '1') return;
    sessionStorage.removeItem('bogx_just_logged_in');
    
    // Show modal immediately with loading state, then fetch data
    setWelcomeLoading(true);
    setShowWelcomeBack(true);
    
    // Fetch personalized welcome data + current leader in parallel
    const fetchWelcomeMessage = async () => {
      try {
        const [welcomeRes, leaderRes] = await Promise.all([
          fetch(`/api/user/welcome-message?userId=${user.id}`).then(r => r.json()).catch(() => null),
          fetch(`/api/leaderboard?period=today&limit=5`).then(r => r.json()).catch(() => null),
        ]);

        if (welcomeRes?.success) {
          setWelcomeRankChange(welcomeRes.rankChange || null);
          setWelcomeCurrentRank(welcomeRes.currentRank ?? null);
          setWelcomeTotalPoints(welcomeRes.totalPoints ?? 0);
          setWelcomePointsToday(welcomeRes.pointsToday ?? 0);
          setWelcomePointsToNext(welcomeRes.pointsToNextRank ?? 0);
          setWelcomeStreak(welcomeRes.streak ?? 0);
          setWelcomeEvents(welcomeRes.whileAwayEvents ?? []);
          setWelcomeLastSeenAt(welcomeRes.lastSeenAt ?? null);
          setWelcomeDailyReward(welcomeRes.dailyRewardReady ?? false);
          // Level data — compute from the LIVE client-side bogxCoins (same source
          // the Rankings page uses) instead of the server snapshot, so the two
          // screens can never disagree on the percentage.
          const liveBogx = user.bogxCoins ?? welcomeRes.totalPoints ?? 0;
          const liveLevelIndex = getLevelIndex(liveBogx);
          setWelcomeLevel(liveLevelIndex + 1);
          setWelcomeLevelName(LEVELS[liveLevelIndex]?.name ?? 'Rookie');
          setWelcomeLevelProgress(getLevelProgress(liveBogx));
          setWelcomePointsToNextLevel(getBogxToNextLevel(liveBogx));
          setWelcomeAvatar(welcomeRes.avatar || undefined);
        }
        if (leaderRes?.success && leaderRes.leaderboard?.[0]) {
          setCurrentLeader(leaderRes.leaderboard[0].username || null);
        }
      } catch (e) {
        // Data fetch failed, but modal is already showing
      } finally {
        setWelcomeLoading(false);
      }
    };
    
    fetchWelcomeMessage();
  }, [mounted, isLoggedIn, user?.id, searchParams]);

  // Load leaderboard data - supports day navigation and timeline scrubbing
  // silent=true means no loading spinner (for live score updates during gameplay)
  // untilTime: 0-100 progress percentage for timeline scrubbing (null = live)
  // limit: how many rankings to fetch (default 20, increases on scroll)
  const loadLeaderboard = async (dayOffset: number = 0, silent: boolean = false, untilTime: number | null = null, limit: number = 20) => {
    if (!silent) setRankingsLoading(true);
    try {
      const now = new Date();
      const berlinTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
      const berlinHour = berlinTime.getHours();
      const berlinMinute = berlinTime.getMinutes();
      // Break is now only 5 minutes: 9:55-10:00
      const inBreak = berlinHour === 9 && berlinMinute >= 55;
      
      // Calculate target date based on offset
      const targetDate = new Date(berlinTime);
      targetDate.setDate(targetDate.getDate() + dayOffset);
      
      // If viewing today (offset 0) and in break time, show yesterday instead
      const effectiveOffset = (dayOffset === 0 && inBreak) ? -1 : dayOffset;
      const effectiveDate = new Date(berlinTime);
      effectiveDate.setDate(effectiveDate.getDate() + effectiveOffset);
      
      let url = `/api/rankings/snapshot?period=day&limit=${limit}`;
      if (effectiveOffset !== 0 || inBreak) {
        const dateStr = effectiveDate.toISOString().split('T')[0];
        url = `/api/rankings/snapshot?period=day&date=${dateStr}&limit=${limit}`;
      }
      
      // Add untilTime parameter for timeline scrubbing
      if (untilTime !== null && dayOffset === 0 && !inBreak) {
        url += `&untilTime=${untilTime}`;
      }
      
      const res = await fetch(url);
      const data = await res.json();
      if (data.rankings) {
        const newRankings = data.rankings.slice(0, limit);
        
        // Check if there are more rankings to load
        setRankingsHasMore(data.rankings.length >= limit);
        
        // Calculate point and rank changes for animations (only for live updates, not scrubbing)
        if (silent && prevRankingsRef.current.length > 0 && scrubProgress === null) {
          const pointDiffs: Record<string, number> = {};
          const rankDiffs: Record<string, number> = {};
          
          newRankings.slice(0, 20).forEach((r: any, newIndex: number) => {
            const prevIndex = prevRankingsRef.current.findIndex((p: any) => p._id === r._id);
            const prev = prevIndex !== -1 ? prevRankingsRef.current[prevIndex] : null;
            
            if (prev) {
              // Point change
              const pointDiff = (r.bogxCoins ?? r.points ?? 0) - (prev.bogxCoins ?? prev.points ?? 0);
              if (pointDiff !== 0) {
                pointDiffs[r._id] = pointDiff;
              }
              
              // Rank change (positive = moved up, negative = moved down)
              if (prevIndex !== newIndex) {
                rankDiffs[r._id] = prevIndex - newIndex; // e.g., was #3, now #1 = 3-1 = +2 (moved up 2)
              }
            } else {
              // New entry in top 20
              rankDiffs[r._id] = 99; // Special value for "new"
            }
          });
          
          if (Object.keys(pointDiffs).length > 0) {
            setPointChanges(pointDiffs);
            setTimeout(() => setPointChanges({}), 2000);
          }
          
          if (Object.keys(rankDiffs).length > 0) {
            // Merge with existing rank changes and save to localStorage
            setRankChanges(prev => {
              const updated = { ...prev, ...rankDiffs };
              localStorage.setItem('leaderboard-rank-changes', JSON.stringify(updated));
              return updated;
            });
          }
        }
        
        prevRankingsRef.current = newRankings;
        setRankings(newRankings);
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      if (!silent) setRankingsLoading(false);
      setRankingsLoadingMore(false);
    }
  };
  
  // Load more rankings when scrolling
  const loadMoreRankings = useCallback(() => {
    if (rankingsLoadingMore || !rankingsHasMore) return;
    setRankingsLoadingMore(true);
    const newLimit = rankingsLimit + 20;
    setRankingsLimit(newLimit);
    loadLeaderboard(leaderboardDayOffset, true, null, newLimit);
  }, [rankingsLoadingMore, rankingsHasMore, rankingsLimit, leaderboardDayOffset]);
  
  // Reload leaderboard when day offset changes or break time status changes
  useEffect(() => {
    // Clear rankings immediately when break ends to avoid showing stale data
    if (!isBreakTime && leaderboardDayOffset === 0) {
      setRankings([]);
    }
    // Reset limit when changing days
    setRankingsLimit(20);
    setRankingsHasMore(true);
    loadLeaderboard(leaderboardDayOffset, false, null, 20);
  }, [leaderboardDayOffset, isBreakTime]);
  
  // Poll leaderboard every 5 seconds for live updates
  useEffect(() => {
    if (isBreakTime || leaderboardDayOffset !== 0) return; // Only poll for today's live leaderboard
    const interval = setInterval(() => {
      loadLeaderboard(0, true, null, rankingsLimit); // silent=true for smooth updates, use current limit
    }, 5000); // Every 5 seconds for smooth live updates
    return () => clearInterval(interval);
  }, [isBreakTime, leaderboardDayOffset, rankingsLimit]);
  
  // Countdown logic - handles both game time and break time
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const berlinTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
      const berlinHour = berlinTime.getHours();
      const berlinMinute = berlinTime.getMinutes();
      const berlinSecond = berlinTime.getSeconds();
      
      // Check if we're in break time (9:55 - 10:00, only 5 minutes)
      const inBreak = berlinHour === 9 && berlinMinute >= 55;
      setIsBreakTime(inBreak);
      
      if (inBreak) {
        // Countdown to 10:00 (game start) - only 5 minutes max
        const totalSeconds = (59 - berlinMinute) * 60 + (60 - berlinSecond);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        setBreakCountdown(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else if (rankings.length > 0) {
        // Countdown to 9:55 (game end / break start)
        let totalSeconds;
        if (berlinHour < 9 || (berlinHour === 9 && berlinMinute < 55)) {
          // Before 9:55
          const targetMinutes = 9 * 60 + 55; // 9:55 in minutes
          const currentMinutes = berlinHour * 60 + berlinMinute;
          totalSeconds = (targetMinutes - currentMinutes - 1) * 60 + (60 - berlinSecond);
        } else {
          // After 10:00, countdown to next day 9:55
          totalSeconds = (24 - berlinHour + 9) * 3600 + (55 - berlinMinute - 1) * 60 + (60 - berlinSecond);
        }
        
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        setLeaderboardCountdown(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [rankings.length]);
  
  // Fast timer for centiseconds when under 1 hour remaining
  useEffect(() => {
    const cd = isBreakTime ? breakCountdown : leaderboardCountdown;
    if (!cd) return;
    const [h] = cd.split(':').map(v => parseInt(v, 10) || 0);
    
    // Only run fast timer when under 1 hour
    if (h > 0) return;
    
    const fastInterval = setInterval(() => {
      setCountdownMs(Math.floor((Date.now() % 1000) / 10));
    }, 50); // Update every 50ms for smooth animation
    
    return () => clearInterval(fastInterval);
  }, [leaderboardCountdown, breakCountdown, isBreakTime]);

  const loadAllData = async () => {
    // Load each widget independently so they can show their own loading states
    
    // Rankings
    fetch('/api/rankings/snapshot?period=day')
      .then(res => res.json())
      .then(data => {
        if (data.rankings) {
          setRankings(data.rankings.slice(0, 10));
        }
      })
      .catch(() => {})
      .finally(() => setRankingsLoading(false));
    
    // TV Videos
    fetch('/api/tv?limit=3')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const allVideos = data.videos || [];
          const featured = allVideos
            .filter((v: any) => v.featuredPosition)
            .sort((a: any, b: any) => a.featuredPosition - b.featuredPosition);
          setTvVideos(featured);
        }
      })
      .catch(() => {})
      .finally(() => setTvLoading(false));
    
    // Radio stations
    fetch('/api/radio-stations')
      .then(res => res.json())
      .then(data => {
        if (data.success) setRadioStations(data.stations || []);
      })
      .catch(() => {});
    
    // Shop products
    fetch('/api/shop/products')
      .then(res => res.json())
      .then(data => {
        if (data.success) setShopProducts(data.products?.slice(0, 3) || []);
      })
      .catch(() => {});
  };

  // Scrolls the view back to the top.
  //
  // The content wrapper uses `min-h-[calc(100vh-108px)]`, i.e. a MINIMUM height,
  // so with `overflow-y-auto` it never becomes its own scroll container - it just
  // grows and the WINDOW scrolls instead. Calling scrollTo on the wrapper alone
  // (which is what happened before) therefore did nothing, and switching tabs
  // kept the scroll position of the previous page.
  // Both are reset so this keeps working if the layout ever becomes a real
  // inner-scroll container.
  const scrollViewToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    contentRef.current?.scrollTo(0, 0);
  }, []);

  // Runs whenever the visible view changes - not just tab clicks, but also
  // opening/closing an article, a player profile, a static page, a rankroll or an
  // arcade game. This covers every code path, including the ones that set state
  // directly instead of going through handleTabChange (logout redirect, profile
  // login). Runs after render so a shorter new page can't leave a stale offset.
  useEffect(() => {
    scrollViewToTop();
  }, [
    activeTab,
    openArticleId,
    selectedPlayerId,
    staticPageSlug,
    arcadeGame,
    showCommunitySound,
    openRankrollData?._id,
    scrollViewToTop,
  ]);

  const handleTabChange = (tab: NavTab) => {
    if (isBattleActive) return;
    setPreviousTab(activeTab);
    setActiveTab(tab);
    setArcadeGame(null);
    setOpenArticleId(null);
    setOpenRankrollData(null);
    setShowCommunitySound(false);
    setStaticPageSlug(null); // Close static page when changing tabs
    setSelectedPlayerId(null); // Close player profile when changing tabs
    setShowBattleResultId(null); // Close battle result when changing tabs
    setShowChallenge(null); // Close challenge when changing tabs
    window.dispatchEvent(new CustomEvent('notification-view-closed')); // Drop news highlight
    scrollViewToTop();
  };

  // Where the user was before opening a notification detail view, so BACK can
  // restore the exact same view instead of falling back to the default tab.
  const notificationOriginRef = useRef<{ tab: NavTab; arcadeGame: string | null; articleId: string | null } | null>(null);

  const openNotificationView = (open: () => void) => {
    notificationOriginRef.current = { tab: activeTab, arcadeGame, articleId: openArticleId };
    open();
  };

  const closeNotificationView = () => {
    setShowBattleResultId(null);
    setShowChallenge(null);
    // Let the news widget / notification page drop the highlighted item
    window.dispatchEvent(new CustomEvent('notification-view-closed'));
    const origin = notificationOriginRef.current;
    if (origin) {
      setActiveTab(origin.tab);
      setArcadeGame(origin.arcadeGame);
      setOpenArticleId(origin.articleId);
      notificationOriginRef.current = null;
    }
  };

  // Logout redirect: if on profile tab and logged out → go to feed
  const wasLoggedInDesktopRef = useRef(isLoggedIn);
  useEffect(() => {
    if (wasLoggedInDesktopRef.current && !isLoggedIn && activeTab === 'profile') {
      setActiveTab('feed');
    }
    wasLoggedInDesktopRef.current = isLoggedIn;
  }, [isLoggedIn]);

  // Listen for CTA banner clicks from ArticlePage
  useEffect(() => {
    const handleOpenShop = () => { setOpenArticleId(null); handleTabChange('shop'); };
    const handleOpenArcade = () => { setOpenArticleId(null); handleTabChange('arcade'); };
    const handleOpenRadio = () => { setOpenArticleId(null); handleTabChange('radio'); };
    const handleOpenTV = () => { setOpenArticleId(null); handleTabChange('tv'); };
    const handleOpenArticles = (e: Event) => { 
      const customEvent = e as CustomEvent;
      const category = customEvent.detail?.category;
      setOpenArticleId(null); 
      if (category) {
        setArticlesCategoryFilter(category);
      }
      handleTabChange('articles'); 
    };
    const handleOpenRankroll = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const pollId = customEvent.detail?.pollId;
      setOpenArticleId(null);
      if (pollId) {
        try {
          const res = await fetch(`/api/polls/${pollId}`);
          const data = await res.json();
          if (data.success && data.poll) {
            setOpenRankrollData(data.poll);
            handleTabChange('voting');
          }
        } catch (err) {
          console.error('Failed to load rankroll:', err);
        }
      } else {
        handleTabChange('voting');
      }
    };

    window.addEventListener('openShop', handleOpenShop);
    window.addEventListener('openArcade', handleOpenArcade);
    window.addEventListener('openRadio', handleOpenRadio);
    window.addEventListener('openTV', handleOpenTV);
    window.addEventListener('openArticles', handleOpenArticles);
    window.addEventListener('openRankroll', handleOpenRankroll);

    return () => {
      window.removeEventListener('openShop', handleOpenShop);
      window.removeEventListener('openArcade', handleOpenArcade);
      window.removeEventListener('openRadio', handleOpenRadio);
      window.removeEventListener('openTV', handleOpenTV);
      window.removeEventListener('openArticles', handleOpenArticles);
      window.removeEventListener('openRankroll', handleOpenRankroll);
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const siteAccess = localStorage.getItem('bogx_site_access');
    const sitePassword = process.env.NEXT_PUBLIC_SITE_PASSWORD || 'bogx2025';
    if (siteAccess !== sitePassword) {
      router.replace('/');
    }
  }, [mounted, isLoggedIn, router]);

  // Memoized callbacks to prevent re-renders
  const handleOpenArticle = useCallback((id: string) => {
    setOpenArticleId(id);
    // Update URL so refresh keeps the article open
    window.history.pushState({}, '', `/desktop?article=${id}`);
    contentRef.current?.scrollTo(0, 0);
  }, []);

  const handleShowLogin = useCallback(() => {
    setShowLoginPage(true);
  }, []);

  const handleOpenCommunitySound = useCallback(() => {
    setShowCommunitySound(true);
    // Scroll after React re-renders with new content
    contentRef.current?.scrollTo(0, 0);
    window.scrollTo(0, 0);
    setTimeout(() => {
      contentRef.current?.scrollTo(0, 0);
      window.scrollTo(0, 0);
    }, 50);
    requestAnimationFrame(() => {
      contentRef.current?.scrollTo(0, 0);
    });
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* ===== HEADER – matches mobile design system ===== */}
      <div className="sticky top-0 z-50 pt-4 px-6 bg-cream">
        <header className="max-w-[1500px] mx-auto bg-[#F5F0E8] border border-warm rounded-xl shadow-sm">
          <div className="h-[72px] flex items-center px-6">
            {/* LEFT – Logo (same width as left sidebar ~240px) */}
            <div className="w-60 flex-shrink-0 flex items-center">
              <button onClick={() => handleTabChange('feed')} className="flex-shrink-0 hover:opacity-80 transition-opacity">
                <Image src="/images/genxlogo1.png" alt="Best of GenX" width={120} height={48} className="h-12 w-auto" />
              </button>
            </div>

            {/* CENTER – Nav + Score Widget in flow */}
            <div className="flex-1 flex items-center">
              {/* Nav – aligned with content area */}
              <nav className="flex items-center gap-3 ml-8">
                {navTabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const Icon = tab.icon;
                  const battleAlertCount = pendingChallengeCount + activeBattleCount;
                  const showBattleBadge = tab.id === 'arcade' && battleAlertCount > 0 && !isActive;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className="relative flex flex-col items-center px-2.5 py-2.5 rounded-xl group hover:bg-[#E36B11]/5 transition-all"
                    >
                      <div className="relative">
                        <Icon className={`w-6 h-6 transition-colors ${
                          isActive ? 'text-[#E36B11]' : 'text-gray-900 group-hover:text-[#E36B11]'
                        }`} />
                        {showBattleBadge && (
                          <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] font-black shadow animate-pulse">
                            {battleAlertCount > 9 ? '9+' : battleAlertCount}
                          </span>
                        )}
                      </div>
                      <span className={`font-display text-[11px] tracking-widest uppercase leading-none mt-1.5 transition-colors ${
                        isActive ? 'text-[#E36B11]' : 'text-gray-900 group-hover:text-[#E36B11]'
                      }`}>
                        {tab.label}
                      </span>
                      {isActive && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-full max-w-[80%] h-0.5 bg-[#E36B11] rounded-full" />}
                    </button>
                  );
                })}
              </nav>
              
              {/* Rank & Coins Widget – slightly more to center */}
              <div className="ml-16">
                <DesktopRankWidget 
                  rank={userRank} 
                  coins={coins} 
                  isActive={activeTab === 'rankings' || activeTab === 'rewards'}
                  hasPendingWager={hasPendingWager}
                  pendingAmount={pendingAmount}
                  dailyRank={scoreRankPositions.dailyRank}
                  monthlyRank={scoreRankPositions.monthlyRank}
                  yearlyRank={scoreRankPositions.yearlyRank}
                  dailyChange={scoreRankPositions.dailyChange}
                  monthlyChange={scoreRankPositions.monthlyChange}
                  yearlyChange={scoreRankPositions.yearlyChange}
                  onClick={() => handleTabChange('rankings')}
                  onWagerClick={() => setShowOpenBattlesModal(true)}
                  animateDelta={coinAnimation.show ? coinAnimation.amount : undefined}
                  animateKey={coinAnimKey}
                  isBreakTime={isBreakTime}
                  breakCountdown={breakCountdown}
                  isLoggedIn={isLoggedIn}
                  onShowLogin={() => { setPreviousTab(activeTab); setActiveTab('profile'); setShowLoginPage(true); }}
                />
              </div>
            </div>

            {/* RIGHT – Profile only (TV, Radio, News moved to right sidebar widgets) */}
            <div className="w-60 flex-shrink-0 flex items-center justify-end gap-0 relative z-30">
              <button
                onClick={() => isLoggedIn ? handleTabChange('profile') : (() => { setPreviousTab(activeTab); setActiveTab('profile'); setShowLoginPage(true); })()}
                className={`flex flex-col items-center px-2.5 py-2.5 rounded-xl transition-all group ${activeTab === 'profile' ? 'bg-[#E36B11]/10' : 'hover:bg-[#E36B11]/5'}`}
              >
                <div className={`w-6 h-6 rounded-full overflow-hidden border-2 transition-colors ${activeTab === 'profile' ? 'border-[#E36B11]' : 'border-gray-300 group-hover:border-[#E36B11]'}`}>
                  {user?.avatar ? (
                    <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-skeleton-light flex items-center justify-center">
                      <User className="w-4 h-4 text-gray-900 group-hover:text-[#E36B11] transition-colors" />
                    </div>
                  )}
                </div>
                <span className={`font-display text-[11px] tracking-widest leading-none mt-1.5 transition-colors ${activeTab === 'profile' ? 'text-[#E36B11]' : 'text-gray-900 group-hover:text-[#E36B11]'}`}>PROFILE</span>
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* ===== MAIN LAYOUT ===== */}
      <div className="max-w-[1500px] mx-auto px-6 py-6">
        <div className="flex gap-6">
          {/* LEFT SIDEBAR */}
          <aside className="w-60 flex-shrink-0 hidden lg:block space-y-5">
            {/* Leaderboard */}
            <div className="rounded-xl border border-warm overflow-hidden shadow-sm relative" style={{ backgroundImage: 'url(/images/leader.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
              <div className="absolute inset-0 bg-[#F5F0E8]/0 pointer-events-none" />
              {/* Header with Day Navigation */}
              <div className="relative px-4 pt-4 pb-2 bg-[#F5F0E8]">
                <div className="flex items-center justify-between">
                  {/* Left arrow - go to previous day */}
                  <button
                    onClick={() => { setLeaderboardDayOffset(prev => prev - 1); setVisibleRankingsCount(10); }}
                    disabled={leaderboardDayOffset <= -7}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[#E36B11]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  
                  {/* Day label */}
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-center">
                      <span className="font-display text-2xl font-bold leading-none tracking-tight uppercase text-[#1A2238]">
                        {(() => {
                          if (leaderboardDayOffset === 0) return 'Today';
                          if (leaderboardDayOffset === -1) return 'Yesterday';
                          const date = new Date();
                          date.setDate(date.getDate() + leaderboardDayOffset);
                          return date.toLocaleDateString('en-US', { weekday: 'long' });
                        })()}
                      </span>
                      <span className="text-[10px] text-gray-500 mt-0.5">
                        {(() => {
                          const date = new Date();
                          date.setDate(date.getDate() + leaderboardDayOffset);
                          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        })()}
                      </span>
                    </div>
                  </div>
                  
                  {/* Right arrow - go to next day (disabled if already at today) */}
                  <button
                    onClick={() => { setLeaderboardDayOffset(prev => prev + 1); setVisibleRankingsCount(10); }}
                    disabled={leaderboardDayOffset >= 0}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[#E36B11]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>
              {/* Countdown row - only show for today */}
              {(() => {
                if (leaderboardDayOffset !== 0) return null; // Hide countdown when viewing past days
                const cd = isBreakTime ? breakCountdown : leaderboardCountdown;
                if (!cd || (!isBreakTime && rankings.length === 0)) return null;
                const [h, m, s] = cd.split(':').map((v) => parseInt(v, 10) || 0);
                const remaining = h * 3600 + m * 60 + s;
                // Break time: 5 minutes (9:55-10:00), otherwise ~24 hours (until 9:55)
                const total = isBreakTime ? 300 : 24 * 3600;
                const progress = Math.min(100, Math.max(0, (1 - remaining / total) * 100));
                
                // Calculate display time based on scrub position
                const displayProgress = scrubProgress !== null ? scrubProgress : progress;
                const elapsedSeconds = Math.floor((displayProgress / 100) * total);
                const elapsedHours = Math.floor(elapsedSeconds / 3600);
                const elapsedMinutes = Math.floor((elapsedSeconds % 3600) / 60);
                const elapsedSecs = elapsedSeconds % 60;
                
                // When less than 1 hour remaining, switch to MIN:SEC:MS format
                const isUnderOneHour = h === 0 && !scrubProgress;
                
                const displayTime = scrubProgress !== null 
                  ? `${elapsedHours.toString().padStart(2, '0')}:${elapsedMinutes.toString().padStart(2, '0')}:${elapsedSecs.toString().padStart(2, '0')}`
                  : isUnderOneHour
                    ? `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${(99 - countdownMs).toString().padStart(2, '0')}`
                    : cd;
                
                const timeLabels = isUnderOneHour ? ['MIN', 'SEC', 'MS'] : ['HRS', 'MIN', 'SEC'];
                
                const isScrubbing = scrubProgress !== null;
                // Color scheme: orange for normal, amber for break, purple for scrubbing
                const accentColor = isScrubbing ? 'text-purple-500' : isBreakTime ? 'text-amber-500' : 'text-[#E36B11]';
                const accentBg = isScrubbing ? 'bg-purple-500' : isBreakTime ? 'bg-amber-500' : 'bg-[#E36B11]';
                const accentGlow = isScrubbing ? 'shadow-[0_0_6px_rgba(168,85,247,0.7)]' : isBreakTime ? 'shadow-[0_0_6px_rgba(245,158,11,0.7)]' : 'shadow-[0_0_6px_rgba(227,107,17,0.7)]';
                const accentPing = isScrubbing ? 'bg-purple-500/40' : isBreakTime ? 'bg-amber-500/40' : 'bg-[#E36B11]/40';
                const accentPulse = isScrubbing ? 'bg-purple-500/25' : isBreakTime ? 'bg-amber-500/25' : 'bg-[#E36B11]/25';
                
                return (
                  <div className="relative px-3 pb-2.5 bg-[#F5F0E8]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Clock className={`w-5 h-5 flex-shrink-0 ${accentColor}`} />
                      <span className="font-display text-xs leading-[1.1] text-gray-500 uppercase tracking-wide flex-shrink-0">
                        {isScrubbing ? <>Time<br/>elapsed</> : isBreakTime ? <>Next<br/>game in</> : <>Matchday<br/>ends in</>}
                      </span>
                      {/* Timer */}
                      <div className="ml-auto flex items-center flex-shrink-0">
                        {displayTime.split(':').map((part, idx) => (
                          <div key={idx} className="flex items-center">
                            <div className="flex flex-col items-center">
                              <span className={`font-display text-2xl font-bold leading-none tabular-nums ${accentColor}`}>{part}</span>
                              <span className="font-display text-[6px] leading-none text-gray-500 uppercase tracking-wide mt-0.5">{timeLabels[idx]}</span>
                            </div>
                            {idx < 2 && <span className={`font-display text-2xl font-bold leading-none mx-0.5 self-start ${accentColor}`}>:</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Progress timeline - full width, draggable */}
                    <div 
                      ref={timelineRef}
                      className="mt-3 -mx-3 relative h-4 px-1 cursor-pointer group"
                      onMouseDown={(e) => {
                        setIsDraggingTimeline(true);
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                        const newProgress = x * 100;
                        setScrubProgress(newProgress);
                        // Debounce API call
                        if (scrubDebounceRef.current) clearTimeout(scrubDebounceRef.current);
                        scrubDebounceRef.current = setTimeout(() => loadLeaderboard(0, true, newProgress), 150);
                      }}
                      onMouseMove={(e) => {
                        if (!isDraggingTimeline) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                        const newProgress = x * 100;
                        setScrubProgress(newProgress);
                        // Debounce API call
                        if (scrubDebounceRef.current) clearTimeout(scrubDebounceRef.current);
                        scrubDebounceRef.current = setTimeout(() => loadLeaderboard(0, true, newProgress), 150);
                      }}
                      onMouseUp={() => {
                        setIsDraggingTimeline(false);
                        // Return to live after drag ends
                        setTimeout(() => {
                          setScrubProgress(null);
                          loadLeaderboard(0, true);
                        }, 1500); // Show scrubbed result for 1.5s before returning to live
                      }}
                      onMouseLeave={() => {
                        if (isDraggingTimeline) {
                          setIsDraggingTimeline(false);
                          // Return to live after drag ends
                          setTimeout(() => {
                            setScrubProgress(null);
                            loadLeaderboard(0, true);
                          }, 1500);
                        }
                      }}
                    >
                      <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 h-[1.5px] bg-gray-300 rounded-full" />
                      <div className={`absolute left-1 top-1/2 -translate-y-1/2 h-[1.5px] ${accentBg} rounded-full transition-all`} style={{ width: `calc(${scrubProgress !== null ? scrubProgress : progress}% - 8px)` }} />
                      {/* Sonar/pulse marker - draggable */}
                      <div 
                        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all ${isDraggingTimeline ? 'scale-150' : 'group-hover:scale-125'}`} 
                        style={{ left: `calc(${Math.max(2, Math.min(98, scrubProgress !== null ? scrubProgress : progress))}%)` }}
                      >
                        {scrubProgress === null && (
                          <>
                            <span className={`absolute inset-0 -m-1 rounded-full ${accentPing} animate-ping`} />
                            <span className={`absolute inset-0 -m-0.5 rounded-full ${accentPulse} animate-pulse`} />
                          </>
                        )}
                        <span className={`relative block w-2 h-2 ${accentBg} rounded-full ${accentGlow} ${scrubProgress !== null ? 'ring-2 ring-current/30' : ''}`} />
                      </div>
                      {/* Scrubbing indicator */}
                      {scrubProgress !== null && (
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-[#E36B11] bg-white px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                          {Math.round(scrubProgress)}% of day
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
              {/* Break info - show instead of empty rankings when viewing Today during break */}
              {isBreakTime && leaderboardDayOffset === 0 ? (
                <div className="relative">
                  {/* Same height as 10 ranking slots */}
                  <div className="flex flex-col items-center text-center px-4 py-4" style={{ height: '400px' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base grayscale opacity-70">☕</span>
                      <h3 className="font-display text-sm font-bold text-gray-900 uppercase tracking-wide">Daily Reset</h3>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-3">9:55 – 10:00 Berlin Time</p>
                    
                    {/* Info cards */}
                    <div className="w-full space-y-2 text-center">
                      <div className="rounded-lg p-3 border border-warm/60">
                        <p className="font-display text-sm text-gray-900 uppercase tracking-wide mb-1">Rankings Reset</p>
                        <p className="text-xs text-gray-500">Yesterday's winners are locked in. Today's leaderboard starts fresh at 10:00.</p>
                      </div>
                      <div className="rounded-lg p-3 border border-warm/60">
                        <p className="font-display text-sm text-gray-900 uppercase tracking-wide mb-1">Games Paused</p>
                        <p className="text-xs text-gray-500">Trivia and battles are unavailable during break. Back at 10:00!</p>
                      </div>
                      <div className="rounded-lg p-3 border border-warm/60">
                        <p className="font-display text-sm text-gray-900 uppercase tracking-wide mb-1">Earn Points</p>
                        <p className="text-xs text-gray-500">You can still earn coins by voting, reading articles, and other activities.</p>
                      </div>
                    </div>
                    
                  </div>
                </div>
              ) : (
              /* Rankings list - full height, no scroll limit */
              <div 
                ref={leaderboardScrollRef}
                className="relative divide-y divide-warm/50"
              >
                {/* Loading spinner overlay for initial load or day change */}
                {rankingsLoading && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <div className="w-6 h-6 border-2 border-[#E36B11]/30 border-t-[#E36B11] rounded-full animate-spin" />
                  </div>
                )}
                {
                  // Show 20 skeleton slots while loading, then show actual rankings
                  rankingsLoading ? (
                    Array.from({ length: 20 }).map((_, i) => (
                      <div key={`skeleton-${i}`} className="w-full flex items-center gap-3 px-4 py-2.5 animate-pulse">
                        <span className="text-sm font-bold tabular-nums w-4 text-center text-[#E36B11]/40">{i + 1}</span>
                        <div className="w-8 h-8 rounded-full bg-warm" />
                        <div className="flex-1 h-3 rounded bg-warm" />
                        <div className="w-8 h-3 rounded bg-warm" />
                      </div>
                    ))
                  ) : (
                    <>
                      {rankings.slice(0, visibleRankingsCount).map((r, i) => (
                        <button key={r._id} onClick={() => setSelectedPlayerId(r._id)} className="group w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#E36B11] transition-all duration-200 rounded-lg">
                          {/* Rank number with change indicator */}
                          <div className="flex items-center gap-0.5 w-6">
                            <span className={`text-sm font-bold tabular-nums text-center transition-colors group-hover:text-white ${
                              i === 0 ? 'text-gray-900' :
                              i < 3 ? 'text-gray-700' :
                              'text-gray-400'
                            }`}>{i + 1}</span>
                            {/* Rank change arrow - always visible */}
                            {rankChanges[r._id] > 0 && (
                              <span className="text-[9px] font-semibold text-green-600 group-hover:text-green-200">↑</span>
                            )}
                            {rankChanges[r._id] < 0 && (
                              <span className="text-[9px] font-semibold text-red-500 group-hover:text-red-200">↓</span>
                            )}
                            {!rankChanges[r._id] && (
                              <span className="text-[9px] text-gray-300 group-hover:text-white/50">—</span>
                            )}
                          </div>
                          {/* Avatar with country flag */}
                          <div className="relative flex-shrink-0">
                            <div className={`w-8 h-8 rounded-full overflow-hidden border transition-colors ${i === 0 ? 'border-gray-900 group-hover:border-white' : 'border-warm group-hover:border-white'}`}>
                              {r.avatar ? (
                                <img src={r.avatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-skeleton-light flex items-center justify-center group-hover:bg-white/20">
                                  <span className="text-sm font-semibold text-gray-500 group-hover:text-white">{r.username?.[0]?.toUpperCase() || '?'}</span>
                                </div>
                              )}
                            </div>
                            <CountryFlag flag={r.countryFlag} className="absolute -bottom-1 -right-1 w-4 h-3 rounded-[2px] border border-cream object-cover shadow-sm" />
                          </div>
                          {/* Username */}
                          <span className="flex-1 text-left font-display text-[13px] tracking-wide font-normal text-gray-800 truncate transition-colors group-hover:text-white">{r.username}</span>
                          {/* BOGX Coins - with transition for smooth score updates */}
                          <div className="flex items-center gap-1 transition-all duration-300 relative">
                            <img src="/images/bogxcoin.png" alt="" className="w-4 h-4 group-hover:brightness-125" />
                            <span className="font-display text-[13px] tracking-wide font-normal tabular-nums text-gray-900 transition-colors group-hover:text-white">{formatCurrency(r.points)}</span>
                            {/* Point change animation */}
                            {pointChanges[r._id] && (
                              <span 
                                className={`absolute -right-1 -top-3 text-[10px] font-bold animate-bounce ${
                                  pointChanges[r._id] > 0 ? 'text-green-500' : 'text-red-500'
                                }`}
                                style={{ animation: 'fadeSlideUp 2s ease-out forwards' }}
                              >
                                {pointChanges[r._id] > 0 ? '+' : ''}{formatCurrency(pointChanges[r._id])}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                      {/* View More button - shows when there are more rankings to display */}
                      {visibleRankingsCount < rankings.length && (
                        <button
                          onClick={() => setVisibleRankingsCount(prev => Math.min(prev + 10, rankings.length))}
                          className="w-full py-2.5 text-center text-[11px] font-semibold text-[#E36B11] hover:bg-[#E36B11]/5 transition-colors"
                        >
                          View More
                        </button>
                      )}
                      {/* Loading more indicator */}
                      {rankingsLoadingMore && (
                        <div className="w-full flex items-center justify-center py-3">
                          <div className="w-5 h-5 border-2 border-[#E36B11]/30 border-t-[#E36B11] rounded-full animate-spin" />
                        </div>
                      )}
                    </>
                  )
                }
              </div>
              )}
              {/* View All Rankings Page button - shows when all rankings are visible (end of list) */}
              {visibleRankingsCount >= rankings.length && rankings.length > 0 && (
                <button 
                  onClick={() => { setSelectedPlayerId(null); handleTabChange('rankings'); }} 
                  className="relative z-10 w-full py-2 text-center text-[10px] font-semibold text-gray-700 hover:bg-gray-100 transition-colors uppercase tracking-wider flex items-center justify-center gap-1 border-t border-warm cursor-pointer"
                >
                  View All
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>

          </aside>

          {/* MAIN CONTENT */}
          <main className="flex-1 min-w-0 relative z-0">
            <div 
              ref={contentRef}
              data-content-scroll
              className="relative rounded-xl border border-warm overflow-y-auto shadow-sm min-h-[calc(100vh-108px)] scrollbar-hide bg-[#F5F0E8] isolate"
            >
              {/* Static Page View */}
              {staticPageSlug && <StaticPageInline slug={staticPageSlug} defaultTitle={staticPageSlug} onClose={() => { setStaticPageSlug(null); contentRef.current?.scrollTo(0, 0); }} />}
              {/* Battle Result inline view - exclusive, replaces all tab content */}
              {!staticPageSlug && !selectedPlayerId && showBattleResultId && (
                <DesktopContentWrapper>
                  <BattleResultInline battleId={showBattleResultId} userId={user?.id} userAvatar={user?.avatar} onBack={closeNotificationView} />
                </DesktopContentWrapper>
              )}
              {/* Battle Challenge inline view - exclusive, replaces all tab content */}
              {!staticPageSlug && !selectedPlayerId && !showBattleResultId && showChallenge && (
                <DesktopContentWrapper>
                  <BattleChallengeInline
                    battleId={showChallenge.battleId}
                    notificationId={showChallenge.notificationId}
                    userId={user?.id}
                    onAccept={(id) => { setShowChallenge(null); notificationOriginRef.current = null; handleTabChange('arcade'); setArcadeGame('quizzbattle'); setPendingBattleId(id); }}
                    onDeclined={() => { setPendingChallengeCount(prev => Math.max(0, prev - 1)); closeNotificationView(); }}
                    onBack={closeNotificationView}
                    onAlreadyPlayed={(id) => { setShowChallenge(null); setShowBattleResultId(id); }}
                  />
                </DesktopContentWrapper>
              )}
              {/* Content Tabs */}
              {!showBattleResultId && !showChallenge && <>
              {!staticPageSlug && !selectedPlayerId && activeTab === "feed" && !openArticleId && !showCommunitySound && <WelcomeReel onOpenArticle={handleOpenArticle} readArticles={readArticles} isDesktop={true} onShowLogin={handleShowLogin} onOpenCommunitySound={handleOpenCommunitySound} onCoinAnimation={triggerCoinGain} />}
              {!staticPageSlug && !selectedPlayerId && showCommunitySound && <CommunitySoundPage isDesktop={true} onBack={() => setShowCommunitySound(false)} onOpenRadio={() => { setShowCommunitySound(false); handleTabChange('radio'); }} />}
              {!staticPageSlug && !selectedPlayerId && openArticleId && <ArticlePage articleId={openArticleId} onBack={() => {
                setOpenArticleId(null);
                // Clear article from URL
                window.history.pushState({}, '', '/desktop');
                // Refresh read articles from DB after viewing
                if (user?.id) {
                  fetch(`/api/user/read-article?userId=${user.id}`)
                    .then(res => res.json())
                    .then(data => {
                      const dbRead: string[] = data.readArticles || [];
                      setReadArticles(new Set<string>(dbRead));
                    })
                    .catch(() => {});
                }
              }} onShowLogin={() => setShowLoginPage(true)} isDesktop={true} readArticles={readArticles} onOpenRadio={() => handleTabChange('radio')} onOpenArticle={(id: string) => { setOpenArticleId(id); contentRef.current?.scrollTo(0, 0); }} onCoinAnimation={(amount) => {
                // Mark article as read immediately in UI
                setReadArticles(prev => { const next = new Set(Array.from(prev)); next.add(openArticleId); return next; });
                // Show animation + animate coins counting up
                setCoinAnimKey(k => k + 1);
                setCoinAnimation({ show: true, amount, variant: 'gain' });
                animateCoins(amount);
              }} />}
              {!staticPageSlug && !selectedPlayerId && activeTab === "arcade" && (
                arcadeGame === 'quizzbattle' ? (
                  <DesktopBattlesPage coins={coins} setCoins={setCoins} onCoinAnimation={(amount, variant) => { setCoinAnimKey(k => k + 1); setCoinAnimation({ show: true, amount, variant }); }} onShowLogin={() => setShowLoginPage(true)} onBattleActiveChange={setIsBattleActive} pendingBattleId={pendingBattleId} onPendingBattleHandled={() => setPendingBattleId(null)} onBack={() => setArcadeGame(null)} challengeTarget={challengeTarget} onChallengeTargetHandled={() => setChallengeTarget(null)} />
                ) : arcadeGame === 'genxmen' ? (
                  <GenXManGame onBack={() => setArcadeGame(null)} onScoreUpdate={() => {}} />
                ) : arcadeGame === 'prediction' ? (
                  <DesktopContentWrapper><PredictionsGame onBack={() => setArcadeGame(null)} onShowLogin={() => setShowLoginPage(true)} embedded={true} /></DesktopContentWrapper>
                ) : arcadeGame === 'trivia' ? (
                  <div className="h-full min-h-full flex flex-col bg-[#F5F0E8]">
                    <SoloTriviaGame onBack={() => setArcadeGame(null)} onCoinsChange={(amount) => animateCoins(amount)} onCoinAnimation={(amount) => { setCoinAnimKey(k => k + 1); setCoinAnimation({ show: true, amount }); }} embedded={true} />
                  </div>
                ) : arcadeGame === 'bogxinvaders' ? (
                  <div className="h-[calc(100vh-108px)] flex flex-col">
                    <BogxInvadersGame onBack={() => setArcadeGame(null)} onCoinsChange={(amount) => animateCoins(amount)} isLoggedIn={isLoggedIn} userId={user?.id} onShowLogin={() => setShowLoginPage(true)} />
                  </div>
                ) : (
                  <DesktopContentWrapper><DesktopArcadePage onSelectGame={(game) => setArcadeGame(game)} onShowRankings={() => handleTabChange('rankings')} userId={user?.id} onCoinsChange={(amount) => animateCoins(amount)} onShowLogin={() => setShowLoginPage(true)} onPlaySpecificBattle={(battleId) => { setPendingBattleId(battleId); setArcadeGame('quizzbattle'); }} /></DesktopContentWrapper>
                )
              )}
              {/* Opening an article unmounts this list, so the category filter is
                  cleared here too - otherwise initialCategory would restore the
                  old category on the way back instead of "All Categories". */}
              {!staticPageSlug && !selectedPlayerId && activeTab === "articles" && !openArticleId && <DesktopArticlesPage onOpenArticle={(id: string) => { setOpenArticleId(id); setArticlesCategoryFilter('all'); contentRef.current?.scrollTo(0, 0); }} onShowLogin={() => setShowLoginPage(true)} onCoinAnimation={(amount) => { setCoinAnimKey(k => k + 1); setCoinAnimation({ show: true, amount, variant: 'gain' }); }} initialCategory={articlesCategoryFilter} />}
              {!staticPageSlug && !selectedPlayerId && activeTab === "voting" && !openArticleId && !openRankrollData && <DesktopRankrollPage onOpenArticle={(id: string) => { setOpenArticleId(id); contentRef.current?.scrollTo(0, 0); }} onOpenRankroll={(poll: any) => { setOpenRankrollData(poll); contentRef.current?.scrollTo(0, 0); }} onShowLogin={() => setShowLoginPage(true)} onCoinAnimation={(amount) => { animateCoins(amount); setCoinAnimKey(k => k + 1); setCoinAnimation({ show: true, amount }); }} />}
              {!staticPageSlug && !selectedPlayerId && activeTab === "voting" && openRankrollData && <DesktopRankingDetailPage poll={openRankrollData} onBack={() => setOpenRankrollData(null)} onOpenArticle={(id: string) => { setOpenArticleId(id); }} onShowLogin={() => setShowLoginPage(true)} onCoinAnimation={(amount) => { animateCoins(amount); setCoinAnimKey(k => k + 1); setCoinAnimation({ show: true, amount }); }} />}
              {!staticPageSlug && !selectedPlayerId && activeTab === "shop" && <DesktopContentWrapper><ShopPage coins={coins} onCoinsUsed={(amount) => { setCoins(prev => prev - amount); setCoinAnimKey(k => k + 1); setCoinAnimation({ show: true, amount: -amount }); }} /></DesktopContentWrapper>}
              {!staticPageSlug && !selectedPlayerId && activeTab === "tv" && <DesktopContentWrapper><TVPage /></DesktopContentWrapper>}
              {!staticPageSlug && !selectedPlayerId && activeTab === "radio" && <DesktopContentWrapper transparent><CommunitySoundPage isDesktop={true} onBack={() => handleTabChange('feed')} /></DesktopContentWrapper>}
              {!staticPageSlug && !selectedPlayerId && activeTab === "notifications" && !showBattleResultId && <DesktopContentWrapper transparent><NotificationPage onGoToProfile={() => handleTabChange('profile')} onGoToBattle={(id) => { handleTabChange('arcade'); setArcadeGame('quizzbattle'); setPendingBattleId(id); }} onShowBattleResult={(id) => openNotificationView(() => setShowBattleResultId(id))} onShowChallenge={(battleId, notificationId) => openNotificationView(() => setShowChallenge({ battleId, notificationId }))} onOpenArticle={(id) => { setOpenArticleId(id); contentRef.current?.scrollTo(0, 0); }} onPointsAwarded={(amount) => { setCoinAnimKey(k => k + 1); setCoinAnimation({ show: true, amount }); }} onChallengeDeclined={() => setPendingChallengeCount(prev => Math.max(0, prev - 1))} autoOpenSettings={openNotificationSettings} onSettingsClosed={() => { setOpenNotificationSettings(false); if (previousTabBeforeSettings) { handleTabChange(previousTabBeforeSettings); setPreviousTabBeforeSettings(null); } }} /></DesktopContentWrapper>}
              {!staticPageSlug && !selectedPlayerId && activeTab === "profile" && (isLoggedIn ? <DesktopContentWrapper><ProfilePage coins={coins} /></DesktopContentWrapper> : <DesktopLoginPage onClose={() => handleTabChange("feed")} onSuccess={() => {}} showBack={true} />)}
              {!staticPageSlug && activeTab === "rankings" && !selectedPlayerId && <DesktopRankingsPage currentUserScore={coins} onBack={() => handleTabChange('home')} onShowSignup={() => setShowLoginPage(true)} onShowRewards={() => handleTabChange('rewards')} selectedPlayerId={null} onPlayerClose={() => {}} />}
              {/* Player Profile - renders in content area, back returns to current tab */}
              {!staticPageSlug && selectedPlayerId && (
                <PlayerCard
                  isOpen={true}
                  playerId={selectedPlayerId}
                  onClose={() => setSelectedPlayerId(null)}
                  isDesktop={true}
                  currentUserId={user?.id}
                  onChallenge={(playerId, username) => {
                    setSelectedPlayerId(null);
                    handleTabChange('arcade');
                    setArcadeGame('quizzbattle');
                    // Store the challenged player so BattlesPage can pre-select them
                    setChallengeTarget({ id: playerId, username });
                  }}
                />
              )}
              {!staticPageSlug && !selectedPlayerId && activeTab === "rewards" && <DesktopRewardsPage coins={coins} onClose={() => handleTabChange('rankings')} onRedeem={(rewardId: string, cost: number) => { const change = -cost; setCoins(prev => prev + change); setCoinAnimKey(k => k + 1); setCoinAnimation({ show: true, amount: change }); }} />}
              </>}
            </div>
          </main>

          {/* RIGHT SIDEBAR */}
          <aside className="w-60 flex-shrink-0 hidden xl:block space-y-5">
            {/* 1. News Widget - compact version of NotificationPage */}
            <NotificationPage 
              compact={true} 
              onViewAll={() => { setShowBattleResultId(null); setShowChallenge(null); handleTabChange('notifications'); }}
              onOpenSettings={() => { setShowBattleResultId(null); setShowChallenge(null); setOpenNotificationSettings(true); setPreviousTabBeforeSettings(activeTab); handleTabChange('notifications'); }}
              onGoToBattle={(id) => { setShowBattleResultId(null); setShowChallenge(null); handleTabChange('arcade'); setArcadeGame('quizzbattle'); setPendingBattleId(id); }}
              onShowBattleResult={(id) => openNotificationView(() => { setShowChallenge(null); setShowBattleResultId(id); })}
              onShowChallenge={(battleId, notificationId) => openNotificationView(() => { setShowBattleResultId(null); setShowChallenge({ battleId, notificationId }); })}
              onOpenArticle={(id) => { setShowBattleResultId(null); setShowChallenge(null); setOpenArticleId(id); contentRef.current?.scrollTo(0, 0); }}
              onGoToProfile={() => { setShowBattleResultId(null); setShowChallenge(null); handleTabChange('profile'); }}
              onChallengeDeclined={() => setPendingChallengeCount(prev => Math.max(0, prev - 1))}
            />

            {/* 2. Radio Banner */}
            <button
              onClick={() => handleTabChange('radio')}
              className="group w-full rounded-xl border border-warm overflow-hidden shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200"
            >
              <img 
                src="/images/Banner/radio.png" 
                alt="Radio" 
                className="w-full h-auto object-cover group-hover:brightness-110 transition-all duration-200"
              />
            </button>

            {/* 3. GenX TV - entire banner is clickable, leads to TV section */}
            <button
              onClick={() => handleTabChange('tv')}
              className="w-full bg-[#F5F0E8] rounded-xl border border-warm overflow-hidden shadow-sm text-left group hover:border-[#E36B11]/50 transition-colors"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-warm">
                <div className="flex items-center gap-2">
                  <Tv className="w-4 h-4 text-[#E36B11]" />
                  <span className="font-display text-sm tracking-wider uppercase text-gray-900">GenX TV</span>
                </div>
                <span className="text-[10px] font-semibold text-[#E36B11] uppercase group-hover:underline">View All</span>
              </div>
              <div className="p-3 space-y-3">
                {tvLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-[#E36B11]/30 border-t-[#E36B11] rounded-full animate-spin" />
                  </div>
                ) : tvVideos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 px-4">
                    <Tv className="w-8 h-8 text-[#E36B11]/30 mb-2" />
                    <p className="text-xs text-gray-500 text-center">No videos yet</p>
                  </div>
                ) : tvVideos.map((video) => (
                  <div 
                    key={video._id}
                    className="block w-full text-left"
                  >
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-skeleton group-hover:ring-2 group-hover:ring-[#E36B11]/30 transition-all">
                      <img 
                        src={video.thumbnail || (video.youtubeId ? `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg` : '')} 
                        alt="" 
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      {/* Gradient overlay for text */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                      {/* Play button - always visible as hint */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-[#E36B11]/90 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity shadow-lg">
                          <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                        </div>
                      </div>
                      {/* Title + Info inside image */}
                      <div className="absolute bottom-0 left-0 right-0 px-3 py-2">
                        {/* Category on top */}
                        {video.category && (
                          <span className="font-display text-[10px] text-[#E36B11] tracking-wider uppercase drop-shadow-lg">{video.category}</span>
                        )}
                        {/* Title + Flag */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="font-display text-sm text-white tracking-wide line-clamp-1 leading-tight drop-shadow-lg">{video.title}</p>
                          {video.language && (
                            <img 
                              src={`https://flagcdn.com/24x18/${video.language === 'de' ? 'de' : 'gb'}.png`}
                              alt=""
                              className="w-4 h-3 rounded-[2px] flex-shrink-0"
                            />
                          )}
                        </div>
                      </div>
                      {video.duration && <span className="absolute top-2 right-2 text-[10px] font-bold bg-black/80 text-white px-1.5 py-0.5 rounded">{video.duration}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </button>

            {/* 4. Rewards */}
            <button
              onClick={() => handleTabChange('rewards')}
              className="w-full rounded-xl border border-warm overflow-hidden text-left group hover:brightness-105 transition-all shadow-sm relative bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: 'url(/images/reward.png)' }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#FFF8E7] via-[#FFF8E7]/90 to-transparent" />
              <div className="relative p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Gift className="w-4 h-4 text-[#E36B11]" />
                  <span className="font-display text-sm tracking-wider uppercase text-gray-900">Rewards</span>
                </div>
                <p className="text-[11px] text-gray-600 mb-2">Earn free points & claim prizes.</p>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-[#E36B11] px-2.5 py-1 rounded-md group-hover:bg-[#C4772A] transition-colors">
                  CLAIM NOW <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </button>

            {/* Arcade */}
            <button
              onClick={() => { handleTabChange('arcade'); setArcadeGame(null); }}
              className="w-full rounded-xl border border-warm overflow-hidden text-left group hover:brightness-105 transition-all shadow-sm relative bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: 'url(/images/battle.png)' }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#E36B11] via-[#E36B11]/90 to-transparent" />
              <div className="relative p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Brain className="w-5 h-5 text-white" />
                  <span className="font-display text-lg tracking-wider uppercase text-white">Trivia</span>
                </div>
                <p className="text-xs text-white/80 mb-3">Test your GenX knowledge & win BOGX.</p>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#E36B11] bg-white px-3 py-1.5 rounded-lg">
                  PLAY NOW <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </button>

            {/* Shop Widget */}
            <button
              onClick={() => handleTabChange('shop')}
              className="w-full rounded-xl border border-warm bg-gradient-to-b from-[#FFFDF9] to-[#FDF8F0] p-4 text-left group hover:border-[#E36B11]/30 transition-all shadow-sm"
            >
              <div className="flex items-center gap-2 mb-2">
                <ShoppingBag className="w-5 h-5 text-[#E36B11]" />
                <span className="font-display text-sm tracking-wider uppercase text-gray-900">Shop</span>
              </div>
              <p className="text-[11px] text-gray-600 mb-3">Exclusive GenX merchandise & collectibles.</p>
              {shopProducts.length > 0 ? (
                <div className="flex gap-2 mb-2">
                  {shopProducts.slice(0, 3).map((product: any, i: number) => (
                    <div key={i} className="w-12 h-12 rounded-lg bg-white border border-warm overflow-hidden">
                      <img src={product.thumbnail || product.image} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              ) : null}
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-[#E36B11] px-2.5 py-1 rounded-md group-hover:bg-[#C4772A] transition-colors">
                BROWSE SHOP <ChevronRight className="w-3 h-3" />
              </span>
            </button>
          </aside>
        </div>
      </div>

      {/* ===== FOOTER ===== */}
      <footer className="max-w-[1500px] mx-auto px-6 py-12 mt-8 border-t border-warm">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <a href="/about" className="hover:opacity-60 transition-opacity">
            <img src="/images/genxlogo1.png" alt="Best of GenX" className="h-8 opacity-40" />
          </a>
        </div>
        
        {/* Links */}
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-gray-500 mb-6">
          <button onClick={() => { setStaticPageSlug('impressum'); contentRef.current?.scrollTo(0, 0); window.scrollTo(0, 0); }} className="hover:text-[#E36B11] transition-colors">Impressum</button>
          <button onClick={() => { setStaticPageSlug('datenschutz'); contentRef.current?.scrollTo(0, 0); window.scrollTo(0, 0); }} className="hover:text-[#E36B11] transition-colors">Datenschutz</button>
          <button onClick={() => { setStaticPageSlug('agb'); contentRef.current?.scrollTo(0, 0); window.scrollTo(0, 0); }} className="hover:text-[#E36B11] transition-colors">AGB</button>
          <button onClick={() => { setStaticPageSlug('karriere'); contentRef.current?.scrollTo(0, 0); window.scrollTo(0, 0); }} className="hover:text-[#E36B11] transition-colors">Karriere</button>
          <button onClick={() => { setStaticPageSlug('kontakt'); contentRef.current?.scrollTo(0, 0); window.scrollTo(0, 0); }} className="hover:text-[#E36B11] transition-colors">Kontakt</button>
          <button onClick={() => { setStaticPageSlug('presse'); contentRef.current?.scrollTo(0, 0); window.scrollTo(0, 0); }} className="hover:text-[#E36B11] transition-colors">Presse</button>
        </div>
        
        {/* Social Links */}
        <div className="flex justify-center gap-4 mb-6">
          <a href="https://instagram.com/bestofgenx" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-[#E36B11]/10 flex items-center justify-center text-[#E36B11] hover:bg-[#E36B11]/20 transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
          </a>
          <a href="https://linkedin.com/company/bestofgenx" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-[#E36B11]/10 flex items-center justify-center text-[#E36B11] hover:bg-[#E36B11]/20 transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          </a>
          <a href="https://facebook.com/bestofgenx" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-[#E36B11]/10 flex items-center justify-center text-[#E36B11] hover:bg-[#E36B11]/20 transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          </a>
          <a href="mailto:contact@bestofgenx.com" className="w-10 h-10 rounded-full bg-[#E36B11]/10 flex items-center justify-center text-[#E36B11] hover:bg-[#E36B11]/20 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          </a>
        </div>
        
        {/* Copyright */}
        <p className="text-center text-xs text-gray-400">
          © {new Date().getFullYear()} <span className="font-display tracking-wide">Best of GenX</span>. All rights reserved.
        </p>
        
        {/* Made with love - using Lucide Heart icon instead of emoji */}
        <p className="text-center text-[10px] text-gray-300 mt-2 flex items-center justify-center gap-1">
          Made with <svg className="w-3 h-3 text-[#E36B11]" fill="currentColor" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> for Generation X
        </p>
      </footer>

      {/* ===== OVERLAYS ===== */}

      {/* Login Modal - fixed height based on tallest view (Signup wizard) */}
      {showLoginPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) { setShowLoginPage(false); setActiveTab(previousTab); } }}>
          <div className="relative w-full max-w-md mx-4 bg-[#F5F0E8] rounded-2xl shadow-2xl overflow-hidden" style={{ height: '820px', maxHeight: '90vh' }}>
            <DesktopLoginPage onClose={() => { setShowLoginPage(false); setActiveTab(previousTab); }} onSuccess={() => setShowLoginPage(false)} isModal={true} />
          </div>
        </div>
      )}

      {/* Coin Animation - Desktop mode for bigger, more impactful animation */}
      {coinAnimation.show && <CoinAnimation key={coinAnimKey} amount={coinAnimation.amount} variant={coinAnimation.variant} isDesktop={true} onComplete={() => setCoinAnimation({ show: false, amount: 0 })} />}



      {/* Welcome Back Modal */}
      {showWelcomeBack && (
        <WelcomeBackModal
          isOpen={showWelcomeBack}
          onClose={() => setShowWelcomeBack(false)}
          loading={welcomeLoading}
          username={user?.username || 'there'}
          avatar={welcomeAvatar}
          currentRank={welcomeCurrentRank}
          rankChange={welcomeRankChange}
          totalPoints={welcomeTotalPoints}
          pointsToday={welcomePointsToday}
          pointsToNextRank={welcomePointsToNext}
          nextRankPosition={welcomeCurrentRank ? welcomeCurrentRank - 1 : undefined}
          streak={welcomeStreak}
          whileAwayEvents={welcomeEvents}
          lastSeenAt={welcomeLastSeenAt}
          dailyRewardReady={welcomeDailyReward}
          pendingChallengeCount={pendingChallengeCount}
          activeBattleCount={activeBattleCount}
          currentLeader={currentLeader}
          level={welcomeLevel}
          levelName={welcomeLevelName}
          levelProgress={welcomeLevelProgress}
          pointsToNextLevel={welcomePointsToNextLevel}
          onPrimaryAction={() => setShowWelcomeBack(false)}
          onGoToBattles={() => {
            setShowWelcomeBack(false);
            setArcadeGame('quizzbattle');
            setActiveTab('arcade');
          }}
        />
      )}

      {/* Checkout Success Modal */}
      <CheckoutSuccessModal
        isOpen={showCheckoutSuccess}
        onClose={() => setShowCheckoutSuccess(false)}
        sessionId={checkoutSessionId || undefined}
      />

      {/* Open Battles Modal - triggered by clicking wager in header */}
      <OpenBattlesModal
        isOpen={showOpenBattlesModal}
        onClose={() => setShowOpenBattlesModal(false)}
        userId={user?.id || ''}
        onPlayBattle={(battleId) => {
          setShowOpenBattlesModal(false);
          setPendingBattleId(battleId);
          handleTabChange('battles');
        }}
        onCoinsChange={(amount, variant) => {
          setCoins(prev => prev + amount);
          setCoinAnimKey(k => k + 1);
          setCoinAnimation({ show: true, amount, variant: variant ?? (amount > 0 ? 'gain' : 'loss') });
        }}
        onShowLogin={() => setShowLoginPage(true)}
        accentColor="purple"
      />

    </div>
  );
}

// Convert a flag emoji (regional indicators) to ISO 3166-1 alpha-2 code.
// Windows can't render flag emojis, so we map to real flag images via flagcdn.
function flagEmojiToCode(flag?: string): string | null {
  if (!flag) return null;
  const cps = Array.from(flag).map((c) => c.codePointAt(0) ?? 0);
  if (cps.length >= 2 && cps[0] >= 0x1f1e6 && cps[0] <= 0x1f1ff && cps[1] >= 0x1f1e6 && cps[1] <= 0x1f1ff) {
    const a = String.fromCharCode(cps[0] - 0x1f1e6 + 65);
    const b = String.fromCharCode(cps[1] - 0x1f1e6 + 65);
    return (a + b).toLowerCase();
  }
  return null;
}

function CountryFlag({ flag, className }: { flag?: string; className?: string }) {
  const code = flagEmojiToCode(flag);
  if (!code) return null;
  return (
    <img
      src={`https://flagcdn.com/24x18/${code}.png`}
      srcSet={`https://flagcdn.com/48x36/${code}.png 2x`}
      alt=""
      className={className}
    />
  );
}

// Inline Battle Challenge component for desktop content area (no modal)
function BattleChallengeInline({ battleId, notificationId, userId, onAccept, onDeclined, onBack, onAlreadyPlayed }: {
  battleId: string;
  notificationId?: string;
  userId?: string;
  onAccept: (battleId: string) => void;
  onDeclined: () => void;
  onBack: () => void;
  onAlreadyPlayed: (battleId: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [battle, setBattle] = useState<any>(null);
  const [declining, setDeclining] = useState(false);

  useEffect(() => {
    if (!battleId) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/battles/${battleId}`);
        const data = await res.json();
        if (data.success && data.battle) {
          // Challenge already played out (stale notification) - show the result instead
          if (data.battle.status === 'completed') {
            onAlreadyPlayed(battleId);
            return;
          }
          setBattle(data.battle);
        }
      } catch {
        setBattle(null);
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleId]);

  const handleDecline = async () => {
    if (!userId || declining) return;
    setDeclining(true);
    try {
      const res = await fetch(`/api/battles/${battleId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oderId: userId })
      });
      const data = await res.json();
      if (data.success && notificationId) {
        const mongoId = notificationId.startsWith('notif-') ? notificationId.replace('notif-', '') : notificationId;
        await fetch(`/api/notifications/${mongoId}`, { method: 'DELETE' });
      }
      onDeclined();
    } catch {
      // Network error - keep the view open so the user can retry
    } finally {
      setDeclining(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-5 animate-pulse">
        <div className="h-8 w-40 bg-skeleton rounded-lg" />
        <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-warm">
          <div className="w-14 h-14 rounded-full bg-skeleton" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-skeleton rounded" />
            <div className="h-3 w-24 bg-skeleton-light rounded" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-10 bg-skeleton rounded-lg" />
          <div className="h-10 bg-skeleton rounded-lg" />
          <div className="h-10 bg-skeleton rounded-lg" />
        </div>
        <div className="h-12 bg-skeleton rounded-xl" />
      </div>
    );
  }

  if (!battle) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Challenge not found</p>
        <button onClick={onBack} className="mt-4 text-[#E36B11] font-semibold">← Back</button>
      </div>
    );
  }

  const challenger = battle.creator || {};
  const isStale = battle.status === 'cancelled' || battle.status === 'expired';
  const inProgress = battle.status === 'active';

  return (
    <div className="p-6">
      <button onClick={onBack} className="mb-4 text-sm font-display tracking-wide text-gray-500 hover:text-[#E36B11] transition-colors">
        ‹ BACK
      </button>

      <div className="text-center mb-6">
        <Swords className="w-10 h-10 text-[#E36B11] mx-auto mb-2" />
        <h2 className="font-display text-2xl tracking-wider text-gray-900">BATTLE CHALLENGE</h2>
        {inProgress && <p className="text-sm text-gray-500 mt-1">You already accepted this - finish it to see the result</p>}
        {isStale && <p className="text-sm text-red-500 mt-1">This challenge is no longer available</p>}
      </div>

      {/* Challenger */}
      <div className="flex items-center gap-4 mb-5 p-4 bg-white rounded-xl border border-warm">
        {challenger.avatar ? (
          <img src={challenger.avatar} alt="" className="w-14 h-14 rounded-full border-2 border-[#E36B11]" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-[#E36B11]/10 flex items-center justify-center border-2 border-[#E36B11] font-bold text-[#E36B11]">
            {(challenger.username || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-gray-900 font-bold text-lg">{challenger.username || 'Unknown'}</p>
          <p className="text-gray-500 text-sm">Rank #{challenger.rank ?? '?'}</p>
          <p className="text-gray-400 text-xs">{challenger.wins || 0} wins • {challenger.gamesPlayed || 0} games</p>
        </div>
      </div>

      {/* Details */}
      <div className="bg-white rounded-xl border border-warm px-4 mb-5 text-sm">
        <div className="flex justify-between items-center py-2.5 border-b border-warm">
          <span className="text-gray-500">Topic</span>
          <span className="text-gray-900 font-semibold uppercase">{battle.topic}</span>
        </div>
        <div className="flex justify-between items-center py-2.5 border-b border-warm">
          <span className="text-gray-500">Rounds</span>
          <span className="text-gray-900 font-semibold">{battle.rounds || 3}</span>
        </div>
        <div className="flex justify-between items-center py-2.5">
          <span className="text-gray-500">Wager</span>
          <span className="text-[#E36B11] font-bold text-lg flex items-center gap-1">
            {Number(battle.wager).toFixed(2)}
            <img src="/images/bogxcoin.png" alt="BOGX" className="w-4 h-4" />
          </span>
        </div>
      </div>

      {isStale ? (
        <button
          onClick={onBack}
          className="w-full py-3.5 bg-white border border-warm text-gray-700 font-display tracking-wider rounded-xl hover:bg-[#F5F0E8] transition-colors"
        >
          BACK
        </button>
      ) : (
        <>
          <button
            onClick={() => onAccept(battleId)}
            className="w-full py-3.5 bg-[#E36B11] text-white font-display tracking-wider rounded-xl hover:bg-[#C4772A] transition-colors"
          >
            {inProgress ? 'CONTINUE BATTLE' : 'ACCEPT & PLAY NOW'}
          </button>
          {!inProgress && (
            <button
              onClick={handleDecline}
              disabled={declining}
              className="w-full py-3 mt-2 text-red-500 hover:text-red-600 font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {declining ? 'Declining...' : 'Decline Challenge'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// Inline Battle Result component for desktop content area
function BattleResultInline({ battleId, userId, userAvatar, onBack }: { battleId: string; userId?: string; userAvatar?: string; onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [battle, setBattle] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!battleId || !userId) return;
    
    const loadBattle = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/battles/${battleId}`);
        const data = await res.json();
        if (data.success && data.battle) {
          setBattle(data.battle);
        } else {
          setError('Battle not found');
        }
      } catch (e) {
        setError('Failed to load battle');
      } finally {
        setLoading(false);
      }
    };
    
    loadBattle();
  }, [battleId, userId]);

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-8 w-24 bg-skeleton rounded-lg" />
          <div className="h-6 w-32 bg-skeleton rounded" />
        </div>
        
        {/* Result banner skeleton */}
        <div className="h-20 bg-skeleton rounded-2xl" />
        
        {/* Players section skeleton */}
        <div className="bg-white rounded-xl p-4 border border-warm">
          <div className="flex items-center justify-between">
            {/* Player 1 */}
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-skeleton" />
              <div className="space-y-2">
                <div className="h-4 w-20 bg-skeleton rounded" />
                <div className="h-3 w-16 bg-skeleton-light rounded" />
              </div>
            </div>
            {/* VS */}
            <div className="h-8 w-16 bg-skeleton rounded" />
            {/* Player 2 */}
            <div className="flex items-center gap-3">
              <div className="space-y-2 text-right">
                <div className="h-4 w-20 bg-skeleton rounded ml-auto" />
                <div className="h-3 w-16 bg-skeleton-light rounded ml-auto" />
              </div>
              <div className="w-14 h-14 rounded-full bg-skeleton" />
            </div>
          </div>
        </div>
        
        {/* Round by round skeleton */}
        <div className="space-y-3">
          <div className="h-5 w-32 bg-skeleton rounded" />
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-12 bg-skeleton rounded-lg" />
            ))}
          </div>
        </div>
        
        {/* Buttons skeleton */}
        <div className="flex gap-3 pt-4">
          <div className="h-12 flex-1 bg-skeleton rounded-xl" />
          <div className="h-12 flex-1 bg-skeleton rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !battle) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">{error || 'Battle not found'}</p>
        <button onClick={onBack} className="mt-4 text-[#E36B11] font-semibold">← Back</button>
      </div>
    );
  }

  const isCreator = battle.creator._id === userId || battle.creator === userId;
  const opponent = isCreator ? battle.opponent : battle.creator;
  const myResults = (isCreator ? battle.creatorResults : battle.opponentResults) || [];
  const oppResults = (isCreator ? battle.opponentResults : battle.creatorResults) || [];
  const myPoints = myResults.reduce((sum: number, r: any) => sum + (r.points || 0), 0);
  const oppPoints = oppResults.reduce((sum: number, r: any) => sum + (r.points || 0), 0);

  return (
    <BattleResultScreen
      battle={{
        _id: battle._id,
        topic: battle.topic,
        wager: battle.wager,
        rounds: battle.rounds || 3,
        status: battle.status,
        creator: battle.creator,
        opponent: battle.opponent,
        questions: battle.questions || [],
        creatorResults: battle.creatorResults || [],
        opponentResults: battle.opponentResults || [],
        creatorTotalPoints: battle.creatorTotalPoints || 0,
        opponentTotalPoints: battle.opponentTotalPoints || 0,
        // Needed by BattleResultScreen to tell a forfeit apart from a 0:0 draw
        winner: battle.winner,
        forfeitedBy: battle.forfeitedBy,
      }}
      myResults={myResults}
      opponentResults={oppResults}
      myTotalPoints={myPoints}
      opponentTotalPoints={oppPoints}
      isCreator={isCreator}
      userAvatar={userAvatar}
      onBackToPool={onBack}
      onRematch={() => {}}
      onContinue={onBack}
    />
  );
}
