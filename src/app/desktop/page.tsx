"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Play, FileText, Gamepad2, Vote, ShoppingBag, Trophy, Tv, Radio, Bell, User, Users, X, ChevronRight, Gift, Clock } from "lucide-react";
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
import DesktopRankWidget from "@/components/desktop/DesktopRankWidget";
import RadioPage from "@/components/RadioPage";
import CommunitySoundPage from "@/components/CommunitySoundPage";
import WelcomeBackModal, { WelcomeBackRankChange } from "@/components/WelcomeBackModal";
import CheckoutSuccessModal from "@/components/CheckoutSuccessModal";
import StaticPageInline from "@/components/StaticPageInline";

// Navigation tabs
const navTabs = [
  { id: "feed" as NavTab, label: "Feed", icon: Play },
  { id: "arcade" as NavTab, label: "Arcade", icon: Gamepad2 },
  { id: "articles" as NavTab, label: "Articles", icon: FileText },
  { id: "voting" as NavTab, label: "Rankroll", icon: Vote },
  { id: "shop" as NavTab, label: "Shop", icon: ShoppingBag },
];

export default function DesktopPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoggedIn } = useAuth();
  const [mounted, setMounted] = useState(false);
  
  // Central BOGX hook - same source of truth on Desktop AND Mobile
  const { coins, setCoins } = useBogxCoins(user?.id);
  const [activeTab, setActiveTab] = useState<NavTab>("feed");
  const [previousTab, setPreviousTab] = useState<NavTab>("feed");
  const [tabRestored, setTabRestored] = useState(false);
  
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
  const [openArticleId, setOpenArticleId] = useState<string | null>(null);
  const [showCommunitySound, setShowCommunitySound] = useState(false);
  const [openRankrollId, setOpenRankrollId] = useState<string | null>(null);
  const [openRankrollData, setOpenRankrollData] = useState<any>(null);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0); // Increment to force feed refresh
  const [staticPageSlug, setStaticPageSlug] = useState<string | null>(null);
  const [coinAnimation, setCoinAnimation] = useState<{ show: boolean; amount: number; variant?: 'gain' | 'loss' | 'hold' }>({ show: false, amount: 0 });
  const [coinAnimKey, setCoinAnimKey] = useState(0);
  
  // Animate coins counting up/down step by step
  const animateCoins = (amount: number) => {
    if (amount === 0) return;
    const steps = Math.min(Math.abs(Math.round(amount * 100)), 20); // Max 20 steps
    const stepAmount = amount / steps;
    const stepDuration = 1500 / steps; // Total ~1.5s animation
    
    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      setCoins(prev => prev + stepAmount);
      if (currentStep >= steps) {
        clearInterval(interval);
      }
    }, stepDuration);
  };
  const [userRank, setUserRank] = useState<number | null>(null);
  const [isBattleActive, setIsBattleActive] = useState(false);
  // Pending wager indicator - global source of truth (same on mobile & desktop)
  const { hasPendingWager } = usePendingWager(user?.id);
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(false);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  const [pendingBattleId, setPendingBattleId] = useState<string | null>(null);
  const [radioStations, setRadioStations] = useState<{_id: string; name: string; description: string; playlistId: string}[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [leaderboardCountdown, setLeaderboardCountdown] = useState('');
  const [isBreakTime, setIsBreakTime] = useState(false);
  const [breakCountdown, setBreakCountdown] = useState('');
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
    const interval = setInterval(fetchBattleCounts, 60000);
    return () => clearInterval(interval);
  }, [isLoggedIn, user?.id]);

  // Sidebar data with loading states
  const [rankings, setRankings] = useState<any[]>([]);
  const [rankingsLoading, setRankingsLoading] = useState(true);
  const [shopProducts, setShopProducts] = useState<any[]>([]);
  const [tvVideos, setTvVideos] = useState<any[]>([]);
  const [tvLoading, setTvLoading] = useState(true);
  
  // Unread notifications count for badge
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Pre-compute equalizer bar values once to avoid Math.random() in render
  const eqBarsSidebar = useMemo(() =>
    Array.from({ length: 30 }).map((_, i) => ({
      duration: `${(0.3 + Math.random() * 0.4).toFixed(2)}s`,
      delay: `${((i * 0.03) % 0.3).toFixed(2)}s`,
      height: `${Math.floor(30 + Math.random() * 70)}%`,
    })), []);

  // Fetch unread notifications count using the dedicated count API
  const fetchUnreadCount = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/notifications/count?userId=${user.id}`);
      const data = await res.json();
      if (data.success) {
        setUnreadNotifications(data.count || 0);
      }
    } catch (e) {
      console.error('Failed to fetch unread notifications:', e);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!user?.id) return;
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      setUnreadNotifications(0);
    } catch (e) {
      console.error('Failed to mark notifications as read:', e);
    }
  };

  useEffect(() => {
    setMounted(true);
    loadAllData();
  }, []);
  
  // Poll for unread notifications every 30 seconds
  useEffect(() => {
    if (!user?.id) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);
  
  // Mark as read when viewing notifications tab
  useEffect(() => {
    if (activeTab === 'notifications' && user?.id) {
      markAllAsRead();
    }
  }, [activeTab, user?.id]);

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
      const onBogxUpdate = () => {
        loadUserRank();
        loadLeaderboard();
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

  // Load leaderboard data - during break time, load yesterday's winners
  const loadLeaderboard = async () => {
    setRankingsLoading(true);
    try {
      // Check if we're in break time (9:00 - 10:00 Berlin)
      const now = new Date();
      const berlinTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
      const berlinHour = berlinTime.getHours();
      const inBreak = berlinHour === 9;
      
      let url = '/api/rankings/snapshot?period=day';
      if (inBreak) {
        // During break, get yesterday's final rankings
        const yesterday = new Date(berlinTime);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        url = `/api/rankings/snapshot?period=day&date=${yesterdayStr}`;
      }
      
      const res = await fetch(url);
      const data = await res.json();
      if (data.rankings) {
        setRankings(data.rankings.slice(0, 10));
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setRankingsLoading(false);
    }
  };

  // Countdown logic - handles both game time and break time
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const berlinTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
      const berlinHour = berlinTime.getHours();
      const berlinMinute = berlinTime.getMinutes();
      const berlinSecond = berlinTime.getSeconds();
      
      // Check if we're in break time (9:00 - 10:00)
      const inBreak = berlinHour === 9;
      setIsBreakTime(inBreak);
      
      if (inBreak) {
        // Countdown to 10:00 (game start)
        const totalSeconds = (59 - berlinMinute) * 60 + (60 - berlinSecond);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        setBreakCountdown(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else if (rankings.length > 0) {
        // Countdown to 9:00 (game end)
        let totalSeconds;
        if (berlinHour < 9) {
          totalSeconds = (9 - berlinHour - 1) * 3600 + (60 - berlinMinute - 1) * 60 + (60 - berlinSecond);
        } else {
          totalSeconds = (24 - berlinHour + 8) * 3600 + (60 - berlinMinute - 1) * 60 + (60 - berlinSecond);
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

  const handleTabChange = (tab: NavTab) => {
    if (isBattleActive) return;
    setPreviousTab(activeTab);
    setActiveTab(tab);
    setArcadeGame(null);
    setOpenArticleId(null);
    setOpenRankrollData(null);
    setShowCommunitySound(false);
    setStaticPageSlug(null); // Close static page when changing tabs
    // Scroll to top when changing tabs
    contentRef.current?.scrollTo(0, 0);
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
    const handleOpenArticles = () => { setOpenArticleId(null); handleTabChange('articles'); };
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
    contentRef.current?.scrollTo(0, 0);
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
              
              {/* Rank & Coins Widget – directly after nav, in flow */}
              <div className="ml-12">
                <DesktopRankWidget 
                  rank={userRank} 
                  coins={coins} 
                  isActive={activeTab === 'rankings'}
                  hasPendingWager={hasPendingWager}
                  onClick={() => handleTabChange('rankings')}
                />
              </div>
            </div>

            {/* RIGHT – Actions (same width as right sidebar ~240px) - z-30 so they overlay score button */}
            <div className="w-60 flex-shrink-0 flex items-center justify-end gap-0 relative z-30">
              {[
                { key: 'tv', icon: Tv, label: 'TV', onClick: () => handleTabChange('tv'), active: activeTab === 'tv', badge: 0 },
                { key: 'radio', icon: Radio, label: 'RADIO', onClick: () => handleTabChange('radio'), active: activeTab === 'radio', badge: 0 },
                { key: 'news', icon: Bell, label: 'NEWS', onClick: () => handleTabChange('notifications'), active: activeTab === 'notifications', badge: unreadNotifications },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={item.key} className="flex items-center">
                    {i > 0 && <div className="w-px h-8 bg-warm mx-1" />}
                    <button onClick={item.onClick} className={`flex flex-col items-center px-2.5 py-2.5 rounded-xl transition-all group hover:bg-[#E36B11]/5 relative`}>
                      <div className="relative">
                        <Icon className={`w-6 h-6 transition-colors ${item.active ? 'text-[#E36B11]' : 'text-gray-900 group-hover:text-[#E36B11]'}`} />
                        {item.badge > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                            {item.badge > 9 ? '9+' : item.badge}
                          </span>
                        )}
                      </div>
                      <span className={`font-display text-[11px] tracking-widest leading-none mt-1.5 transition-colors ${item.active ? 'text-[#E36B11]' : 'text-gray-900 group-hover:text-[#E36B11]'}`}>{item.label}</span>
                    </button>
                  </div>
                );
              })}
              <div className="w-px h-8 bg-warm mx-1" />
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
              <div className="absolute inset-0 bg-[#F5F0E8]/0" />
              <div className="relative px-4 py-3 border-b border-warm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-[#E36B11]" />
                    <span className="font-display text-sm tracking-wider uppercase text-gray-900">
                      {isBreakTime ? "Yesterday's Winners" : 'Today'}
                    </span>
                    {rankingsLoading && (
                      <div className="w-3 h-3 border-2 border-[#E36B11]/30 border-t-[#E36B11] rounded-full animate-spin" />
                    )}
                  </div>
                  <button onClick={() => handleTabChange('rankings')} className="text-[10px] font-semibold text-[#E36B11] hover:underline uppercase">View All</button>
                </div>
                {/* Break time countdown */}
                {isBreakTime && (
                  <div className="flex items-center justify-center gap-2 py-2 mt-2 bg-[#FDF6E9] rounded-lg border border-[#E36B11]/20">
                    <img src="/images/coffee-break.svg" alt="" className="w-5 h-5" />
                    <span className="text-xs text-[#8B4513] font-medium">Nächstes Spiel in</span>
                    <span className="font-mono text-base font-bold text-[#E36B11] tabular-nums">{breakCountdown}</span>
                  </div>
                )}
                {/* Game countdown - only show if there are rankings and not break time */}
                {!isBreakTime && rankings.length > 0 && (
                  <div className="flex items-center justify-center gap-2 py-1.5 mt-2 bg-warm/30 rounded-lg">
                    <Clock className="w-3.5 h-3.5 text-[#E36B11]" />
                    <span className="text-[10px] text-gray-600">Matchday ends in</span>
                    <span className="font-mono text-sm font-bold text-[#E36B11] tabular-nums">{leaderboardCountdown}</span>
                  </div>
                )}
              </div>
              <div className="relative divide-y divide-warm/50">
                {
                  // Always show all 10 slots immediately (layout never collapses to a spinner).
                  // While loading, every slot shows a pulsing skeleton instead of real data.
                  Array.from({ length: 10 }).map((_, i) => {
                    if (rankingsLoading) {
                      return (
                        <div key={`skeleton-${i}`} className="w-full flex items-center gap-3 px-4 py-2.5 animate-pulse">
                          <span className="text-sm font-bold tabular-nums w-4 text-center text-[#E36B11]/40">{i + 1}</span>
                          <div className="w-8 h-8 rounded-full bg-warm" />
                          <div className="flex-1 h-3 rounded bg-warm" />
                          <div className="w-8 h-3 rounded bg-warm" />
                        </div>
                      );
                    }
                    const r = rankings[i];
                    if (r) {
                      return (
                        <button key={r._id} onClick={() => { setSelectedPlayerId(r._id); handleTabChange('rankings'); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/70 transition-colors">
                          {/* Rank number */}
                          <span className={`text-sm font-bold tabular-nums w-4 text-center ${
                            i === 0 ? 'text-[#E36B11]' :
                            i < 3 ? 'text-[#E36B11]/60' :
                            'text-gray-400'
                          }`}>{i + 1}</span>
                          {/* Avatar with country flag */}
                          <div className="relative flex-shrink-0">
                            <div className={`w-8 h-8 rounded-full overflow-hidden border ${i === 0 ? 'border-[#E36B11]' : 'border-warm'}`}>
                              {r.avatar ? (
                                <img src={r.avatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-skeleton-light flex items-center justify-center">
                                  <span className="text-sm font-semibold text-gray-500">{r.username?.[0]?.toUpperCase() || '?'}</span>
                                </div>
                              )}
                            </div>
                            <CountryFlag flag={r.countryFlag} className="absolute -bottom-1 -right-1 w-4 h-3 rounded-[2px] border border-cream object-cover shadow-sm" />
                          </div>
                          {/* Username */}
                          <span className="flex-1 text-left font-display text-[13px] tracking-wide font-normal text-gray-800 truncate">{r.username}</span>
                          {/* BOGX Coins */}
                          <div className="flex items-center gap-1">
                            <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                            <span className="font-display text-[13px] tracking-wide font-semibold tabular-nums text-[#E36B11]">{formatCurrency(r.bogxCoins || r.points)}</span>
                          </div>
                        </button>
                      );
                    }
                    // Placeholder for empty slot
                    return (
                      <div key={`empty-${i}`} className="w-full flex items-center gap-3 px-4 py-2.5">
                        <span className="text-sm font-bold tabular-nums w-4 text-center text-[#E36B11]/60">{i + 1}</span>
                        <div className="w-8 h-8 rounded-full bg-warm border border-warm flex items-center justify-center">
                          <span className="text-sm font-semibold text-[#E36B11]">?</span>
                        </div>
                        <span className="flex-1 text-left font-display text-[13px] tracking-wide text-gray-800">—</span>
                        <div className="flex items-center gap-1">
                          <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                          <span className="font-display text-[13px] tracking-wide font-semibold text-[#E36B11]">—</span>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            </div>

            {/* GenX TV */}
            <div className="bg-[#F5F0E8] rounded-xl border border-warm overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-warm">
                <div className="flex items-center gap-2">
                  <Tv className="w-4 h-4 text-[#E36B11]" />
                  <span className="font-display text-sm tracking-wider uppercase text-gray-900">GenX TV</span>
                </div>
                <button onClick={() => handleTabChange('tv')} className="text-[10px] font-semibold text-[#E36B11] hover:underline uppercase">View All</button>
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
                  <button 
                    key={video._id}
                    onClick={() => window.open(video.youtubeId ? `https://www.youtube.com/watch?v=${video.youtubeId}` : video.youtubeUrl, '_blank')}
                    className="block w-full text-left group"
                  >
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-skeleton">
                      <img 
                        src={video.thumbnail || (video.youtubeId ? `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg` : '')} 
                        alt="" 
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      {/* Gradient overlay for text */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                      {/* Play button on hover */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-[#E36B11]/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
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
                          <p className="font-display text-sm text-white tracking-wide line-clamp-1 leading-tight group-hover:text-[#E36B11] transition-colors drop-shadow-lg">{video.title}</p>
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
                  </button>
                ))}
              </div>
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
              {/* Content Tabs */}
              {!staticPageSlug && activeTab === "feed" && !openArticleId && !showCommunitySound && <WelcomeReel onOpenArticle={handleOpenArticle} readArticles={readArticles} isDesktop={true} onShowLogin={handleShowLogin} onOpenCommunitySound={handleOpenCommunitySound} />}
              {!staticPageSlug && showCommunitySound && <CommunitySoundPage isDesktop={true} onBack={() => setShowCommunitySound(false)} onOpenRadio={() => { setShowCommunitySound(false); handleTabChange('radio'); }} />}
              {!staticPageSlug && openArticleId && <ArticlePage articleId={openArticleId} onBack={() => {
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
              {!staticPageSlug && activeTab === "arcade" && (
                arcadeGame === 'quizzbattle' ? (
                  <DesktopBattlesPage coins={coins} setCoins={setCoins} onCoinAnimation={(amount, variant) => { setCoinAnimKey(k => k + 1); setCoinAnimation({ show: true, amount, variant }); }} onShowLogin={() => setShowLoginPage(true)} onBattleActiveChange={setIsBattleActive} pendingBattleId={pendingBattleId} onPendingBattleHandled={() => setPendingBattleId(null)} onBack={() => setArcadeGame(null)} />
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
              {!staticPageSlug && activeTab === "articles" && !openArticleId && <DesktopArticlesPage onOpenArticle={(id: string) => { setOpenArticleId(id); contentRef.current?.scrollTo(0, 0); }} onShowLogin={() => setShowLoginPage(true)} />}
              {!staticPageSlug && activeTab === "voting" && !openArticleId && !openRankrollData && <DesktopRankrollPage onOpenArticle={(id: string) => { setOpenArticleId(id); contentRef.current?.scrollTo(0, 0); }} onOpenRankroll={(poll: any) => { setOpenRankrollData(poll); contentRef.current?.scrollTo(0, 0); }} onShowLogin={() => setShowLoginPage(true)} onCoinAnimation={(amount) => { animateCoins(amount); setCoinAnimKey(k => k + 1); setCoinAnimation({ show: true, amount }); }} />}
              {!staticPageSlug && activeTab === "voting" && openRankrollData && <DesktopRankingDetailPage poll={openRankrollData} onBack={() => setOpenRankrollData(null)} onOpenArticle={(id: string) => { setOpenArticleId(id); }} onShowLogin={() => setShowLoginPage(true)} onCoinAnimation={(amount) => { animateCoins(amount); setCoinAnimKey(k => k + 1); setCoinAnimation({ show: true, amount }); }} />}
              {!staticPageSlug && activeTab === "shop" && <DesktopContentWrapper><ShopPage coins={coins} onCoinsUsed={(amount) => { setCoins(prev => prev - amount); setCoinAnimKey(k => k + 1); setCoinAnimation({ show: true, amount: -amount }); }} /></DesktopContentWrapper>}
              {!staticPageSlug && activeTab === "tv" && <DesktopContentWrapper><TVPage /></DesktopContentWrapper>}
              {!staticPageSlug && activeTab === "radio" && <DesktopContentWrapper transparent><RadioPage isDesktop={true} /></DesktopContentWrapper>}
              {!staticPageSlug && activeTab === "notifications" && <DesktopContentWrapper transparent><NotificationPage onGoToProfile={() => handleTabChange('profile')} onGoToBattle={(id) => { handleTabChange('arcade'); setArcadeGame('quizzbattle'); setPendingBattleId(id); }} onPointsAwarded={(amount) => { setCoinAnimKey(k => k + 1); setCoinAnimation({ show: true, amount }); }} /></DesktopContentWrapper>}
              {!staticPageSlug && activeTab === "profile" && (isLoggedIn ? <DesktopContentWrapper><ProfilePage coins={coins} /></DesktopContentWrapper> : <DesktopLoginPage onClose={() => handleTabChange("feed")} onSuccess={() => {}} showBack={true} />)}
              {!staticPageSlug && activeTab === "rankings" && <DesktopRankingsPage currentUserScore={coins} onBack={() => handleTabChange('home')} onShowSignup={() => setShowLoginPage(true)} onShowRewards={() => handleTabChange('rewards')} selectedPlayerId={selectedPlayerId} onPlayerClose={() => setSelectedPlayerId(null)} />}
              {!staticPageSlug && activeTab === "rewards" && <DesktopRewardsPage coins={coins} onClose={() => handleTabChange('rankings')} onRedeem={(rewardId: string, cost: number) => { const change = -cost; setCoins(prev => prev + change); setCoinAnimKey(k => k + 1); setCoinAnimation({ show: true, amount: change }); }} />}
            </div>
          </main>

          {/* RIGHT SIDEBAR */}
          <aside className="w-60 flex-shrink-0 hidden xl:block space-y-5">
            {/* Radio - with background image and equalizer */}
            <div className="rounded-xl border border-warm overflow-hidden shadow-sm relative bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/images/radio.png)' }}>
              <div className="relative">
                {/* Header with Equalizer */}
                <div className="px-4 pt-4 pb-3 border-b border-white/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-[#E36B11]" />
                      <span className="font-display text-sm tracking-wider uppercase text-gray-800">Radio</span>
                    </div>
                    <button onClick={() => handleTabChange('radio')} className="text-[10px] font-semibold text-[#E36B11] hover:underline uppercase">View All</button>
                  </div>
                  {/* Mini Equalizer */}
                  <div className="flex items-end justify-between w-full h-6 gap-[2px]">
                    {eqBarsSidebar.map((bar, i) => (
                      <div
                        key={i}
                        className="bg-gradient-to-t from-[#E36B11]/50 to-[#E5A55A]/30 rounded-t-sm flex-1"
                        style={{
                          animation: `eqSidebar ${bar.duration} ease-in-out ${bar.delay} infinite alternate`,
                          height: bar.height,
                        }}
                      />
                    ))}
                  </div>
                  <style>{`
                    @keyframes eqSidebar {
                      0% { height: 20%; }
                      100% { height: 100%; }
                    }
                  `}</style>
                </div>
                <div className="py-1">
                  {radioStations.slice(0, 4).map((station) => (
                    <button
                      key={station._id}
                      onClick={() => window.open(`https://open.spotify.com/playlist/${station.playlistId}`, '_blank')}
                      className="w-full flex items-center gap-3 py-2 px-4 hover:bg-white/40 transition-colors text-left group"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#E36B11]/80 flex items-center justify-center flex-shrink-0">
                        <Play className="w-3 h-3 text-white fill-white ml-0.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-gray-800 truncate leading-tight">{station.name}</p>
                        {station.description && <p className="text-[11px] text-gray-600 truncate">{station.description}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Shop */}
            <div className="bg-[#F5F0E8] rounded-xl border border-warm overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-warm">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#E36B11]" />
                  <span className="font-display text-sm tracking-wider uppercase text-gray-900">Shop</span>
                </div>
                <button onClick={() => handleTabChange('shop')} className="text-[10px] font-semibold text-[#E36B11] hover:underline uppercase">View All</button>
              </div>
              <div className="p-3 space-y-2">
                {shopProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleTabChange('shop')}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/70 transition-colors text-left group"
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-white border border-warm flex-shrink-0">
                      <img src={product.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-800 truncate leading-tight">{product.name}</p>
                      <p className="text-sm font-semibold text-[#E36B11]">{product.price}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Rewards */}
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
                  <Gamepad2 className="w-5 h-5 text-white" />
                  <span className="font-display text-lg tracking-wider uppercase text-white">Arcade</span>
                </div>
                <p className="text-xs text-white/80 mb-3">Test your knowledge & win BOGX.</p>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#E36B11] bg-white px-3 py-1.5 rounded-lg">
                  PLAY NOW <ChevronRight className="w-3 h-3" />
                </span>
              </div>
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
          © {new Date().getFullYear()} Best of GenX. All rights reserved.
        </p>
        
        {/* Made with love - using Lucide Heart icon instead of emoji */}
        <p className="text-center text-[10px] text-gray-300 mt-2 flex items-center justify-center gap-1">
          Made with <svg className="w-3 h-3 text-[#E36B11]" fill="currentColor" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> for Generation X
        </p>
      </footer>

      {/* ===== OVERLAYS ===== */}

      {/* Login Modal */}
      {showLoginPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) { setShowLoginPage(false); setActiveTab(previousTab); } }}>
          <div className="relative w-full max-w-md mx-4 bg-[#F5F0E8] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
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
