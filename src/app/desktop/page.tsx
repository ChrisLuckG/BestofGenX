"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Play, FileText, Gamepad2, Vote, ShoppingBag, Trophy, Tv, Radio, Bell, User, Users, X, ChevronRight, Gift } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import GenXLoader from "@/components/GenXLoader";
import { formatCurrency, getCurrencySymbol } from "@/utils/currency";

// Import real components
import { NavTab } from "@/components/BottomNav";
import TVPage from "@/components/TVPage";
import ArcadePage from "@/components/ArcadePage";
import DesktopArcadePage from "@/components/desktop/DesktopArcadePage";
import BattlesPage from "@/components/BattlesPage";
import ArticlePage from "@/components/ArticlePage";
import DesktopRankrollPage from "@/components/desktop/DesktopRankrollPage";
import DesktopArticlesPage from "@/components/desktop/DesktopArticlesPage";
import DesktopFeedPage from "@/components/desktop/DesktopFeedPage";
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
import CoinAnimation from "@/components/CoinAnimation";
import DesktopRewardsPage from "@/components/desktop/DesktopRewardsPage";
import DesktopContentWrapper from "@/components/desktop/DesktopContentWrapper";
import DesktopBattlesPage from "@/components/desktop/DesktopBattlesPage";
import DesktopRankWidget from "@/components/desktop/DesktopRankWidget";
import RadioPage from "@/components/RadioPage";
import WelcomeBackModal, { WelcomeBackRankChange } from "@/components/WelcomeBackModal";

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
  const { user, isLoggedIn } = useAuth();
  const [mounted, setMounted] = useState(false);
  
  const [coins, setCoins] = useState(0);
  const [activeTab, setActiveTab] = useState<NavTab>("feed");
  const [arcadeGame, setArcadeGame] = useState<string | null>(null);
  const [showLoginPage, setShowLoginPage] = useState(false);
  const [openArticleId, setOpenArticleId] = useState<string | null>(null);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0); // Increment to force feed refresh
  const [coinAnimation, setCoinAnimation] = useState<{ show: boolean; amount: number; variant?: 'gain' | 'loss' | 'hold' }>({ show: false, amount: 0 });
  
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
  const [pendingBattleId, setPendingBattleId] = useState<string | null>(null);
  const [radioStations, setRadioStations] = useState<{_id: string; name: string; description: string; playlistId: string}[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [readArticles, setReadArticles] = useState<Set<string>>(new Set());
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Welcome back modal state
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [welcomeRankChange, setWelcomeRankChange] = useState<WelcomeBackRankChange | null>(null);
  const [welcomeCurrentRank, setWelcomeCurrentRank] = useState<number | null>(null);
  const [welcomeNotificationsEnabled, setWelcomeNotificationsEnabled] = useState(true);
  const [welcomeAI, setWelcomeAI] = useState<{ greeting: string; subtitle: string; fact: string; factReaction: string; callToAction: string } | null>(null);
  
  // Sidebar data
  const [rankings, setRankings] = useState<any[]>([]);
  const [shopProducts, setShopProducts] = useState<any[]>([]);
  const [tvVideos, setTvVideos] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
    loadAllData();
  }, []);

  useEffect(() => {
    // Use bogxCoins, or convert legacy points to BOGX, take the higher value
    const bogx = user?.bogxCoins || 0;
    const legacyBogx = (user?.coins || 0) / 100;
    setCoins(Math.max(bogx, legacyBogx));
  }, [user?.bogxCoins, user?.coins]);

  // Load user rank and read articles when user is available
  useEffect(() => {
    if (user?.id) {
      // Load user rank
      fetch(`/api/rankings/user-rank?userId=${user.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.rank) setUserRank(data.rank);
        })
        .catch(() => {});
      
      // Load read articles ONLY from DB (no localStorage for logged-in users)
      fetch(`/api/user/read-article?userId=${user.id}`)
        .then(res => res.json())
        .then(data => {
          const dbRead: string[] = data.readArticles || [];
          setReadArticles(new Set<string>(dbRead));
        })
        .catch(() => {});
    } else {
      // Guest: no read tracking (they see all as unread)
      setReadArticles(new Set());
    }
  }, [user?.id]);

  // Show welcome back message after login
  useEffect(() => {
    if (!mounted || !isLoggedIn || !user?.id) return;
    
    // Check if we already showed welcome this session
    const sessionKey = `welcome_shown_${user.id}_${new Date().toDateString()}`;
    if (sessionStorage.getItem(sessionKey)) return;
    
    // Fetch personalized welcome data (rank change) + AI daily facts in parallel
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

        setShowWelcomeBack(true);
        sessionStorage.setItem(sessionKey, 'true');
      } catch (e) {
        // Still show welcome even if AI fails
        setShowWelcomeBack(true);
        sessionStorage.setItem(sessionKey, 'true');
      }
    };
    
    fetchWelcomeMessage();
  }, [mounted, isLoggedIn, user?.id]);

  const loadAllData = async () => {
    try {
      const [radioRes, rankRes, shopRes, tvRes] = await Promise.all([
        fetch('/api/radio-stations'),
        fetch('/api/rankings?period=day'),
        fetch('/api/shop/products'),
        fetch('/api/tv?limit=3'),
      ]);
      
      const [radioData, rankData, shopData, tvData] = await Promise.all([
        radioRes.json(),
        rankRes.json(),
        shopRes.json(),
        tvRes.json(),
      ]);
      
      if (radioData.success) setRadioStations(radioData.stations || []);
      if (rankData.rankings) {
        // Take top 10 for leaderboard widget
        setRankings(rankData.rankings.slice(0, 10));
        if (user?.id) {
          const idx = rankData.rankings.findIndex((r: any) => r._id === user.id);
          if (idx >= 0) setUserRank(idx + 1);
        }
      }
      if (shopData.success) setShopProducts(shopData.products?.slice(0, 3) || []);
      if (tvData.success) {
        // Show only videos with featuredPosition 1, 2, 3 in order
        const allVideos = tvData.videos || [];
        const featured = allVideos
          .filter((v: any) => v.featuredPosition)
          .sort((a: any, b: any) => a.featuredPosition - b.featuredPosition);
        setTvVideos(featured);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleTabChange = (tab: NavTab) => {
    if (isBattleActive) return;
    setActiveTab(tab);
    setArcadeGame(null);
    setOpenArticleId(null); // Close any open article when changing tabs
  };

  // Listen for CTA banner clicks from ArticlePage
  useEffect(() => {
    const handleOpenShop = () => { setOpenArticleId(null); handleTabChange('shop'); };
    const handleOpenArcade = () => { setOpenArticleId(null); handleTabChange('arcade'); };
    const handleOpenRadio = () => { setOpenArticleId(null); handleTabChange('radio'); };
    const handleOpenTV = () => { setOpenArticleId(null); handleTabChange('tv'); };
    const handleOpenArticles = () => { setOpenArticleId(null); handleTabChange('articles'); };

    window.addEventListener('openShop', handleOpenShop);
    window.addEventListener('openArcade', handleOpenArcade);
    window.addEventListener('openRadio', handleOpenRadio);
    window.addEventListener('openTV', handleOpenTV);
    window.addEventListener('openArticles', handleOpenArticles);

    return () => {
      window.removeEventListener('openShop', handleOpenShop);
      window.removeEventListener('openArcade', handleOpenArcade);
      window.removeEventListener('openRadio', handleOpenRadio);
      window.removeEventListener('openTV', handleOpenTV);
      window.removeEventListener('openArticles', handleOpenArticles);
    };
  }, []);

  // Redirect to login page for non-logged-in users - immediate redirect
  useEffect(() => {
    if (mounted && !isLoggedIn) {
      router.replace('/');
    }
  }, [mounted, isLoggedIn, router]);

  // Show nothing while redirecting (transparent)
  if (!mounted || !isLoggedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* ===== HEADER – matches mobile design system ===== */}
      <div className="sticky top-0 z-50 pt-4 px-6 bg-cream">
        <header className="max-w-[1500px] mx-auto bg-[#FDFBF7] border border-warm rounded-xl shadow-sm">
          <div className="h-[72px] flex items-center px-6">
            {/* LEFT – Logo (same width as left sidebar ~240px) */}
            <div className="w-60 flex-shrink-0 flex items-center">
              <button onClick={() => handleTabChange('home')} className="flex-shrink-0 hover:opacity-80 transition-opacity">
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
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className="relative flex flex-col items-center px-2.5 py-2.5 rounded-xl group hover:bg-[#D4873A]/5 transition-all"
                    >
                      <Icon className={`w-6 h-6 transition-colors ${
                        isActive ? 'text-[#D4873A]' : 'text-gray-900 group-hover:text-[#D4873A]'
                      }`} />
                      <span className={`font-display text-[11px] tracking-widest uppercase leading-none mt-1.5 transition-colors ${
                        isActive ? 'text-[#D4873A]' : 'text-gray-900 group-hover:text-[#D4873A]'
                      }`}>
                        {tab.label}
                      </span>
                      {isActive && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-full max-w-[80%] h-0.5 bg-[#D4873A] rounded-full" />}
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
                  onClick={() => handleTabChange('rankings')}
                />
              </div>
            </div>

            {/* RIGHT – Actions (same width as right sidebar ~240px) - z-30 so they overlay score button */}
            <div className="w-60 flex-shrink-0 flex items-center justify-end gap-0 relative z-30">
              {[
                { key: 'tv', icon: Tv, label: 'TV', onClick: () => handleTabChange('tv'), active: activeTab === 'tv' },
                { key: 'radio', icon: Radio, label: 'RADIO', onClick: () => handleTabChange('radio'), active: activeTab === 'radio' },
                { key: 'news', icon: Bell, label: 'NEWS', onClick: () => handleTabChange('notifications'), active: activeTab === 'notifications' },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={item.key} className="flex items-center">
                    {i > 0 && <div className="w-px h-8 bg-warm mx-1" />}
                    <button onClick={item.onClick} className={`flex flex-col items-center px-2.5 py-2.5 rounded-xl transition-all group hover:bg-[#D4873A]/5`}>
                      <Icon className={`w-6 h-6 transition-colors ${item.active ? 'text-[#D4873A]' : 'text-gray-900 group-hover:text-[#D4873A]'}`} />
                      <span className={`font-display text-[11px] tracking-widest leading-none mt-1.5 transition-colors ${item.active ? 'text-[#D4873A]' : 'text-gray-900 group-hover:text-[#D4873A]'}`}>{item.label}</span>
                    </button>
                  </div>
                );
              })}
              <div className="w-px h-8 bg-warm mx-1" />
              <button
                onClick={() => isLoggedIn ? handleTabChange('profile') : setShowLoginPage(true)}
                className={`flex flex-col items-center px-2.5 py-2.5 rounded-xl transition-all group ${activeTab === 'profile' ? 'bg-[#D4873A]/10' : 'hover:bg-[#D4873A]/5'}`}
              >
                <div className={`w-6 h-6 rounded-full overflow-hidden border-2 transition-colors ${activeTab === 'profile' ? 'border-[#D4873A]' : 'border-gray-300 group-hover:border-[#D4873A]'}`}>
                  {user?.avatar ? (
                    <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-skeleton-light flex items-center justify-center">
                      <User className="w-4 h-4 text-gray-900 group-hover:text-[#D4873A] transition-colors" />
                    </div>
                  )}
                </div>
                <span className={`font-display text-[11px] tracking-widest leading-none mt-1.5 transition-colors ${activeTab === 'profile' ? 'text-[#D4873A]' : 'text-gray-900 group-hover:text-[#D4873A]'}`}>PROFILE</span>
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
              <div className="absolute inset-0 bg-[#FDFBF7]/0" />
              <div className="relative flex items-center justify-between px-4 py-3 border-b border-warm">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#D4873A]" />
                  <span className="font-display text-sm tracking-wider uppercase text-gray-900">Leaderboard</span>
                </div>
                <button onClick={() => handleTabChange('rankings')} className="text-[10px] font-semibold text-[#D4873A] hover:underline uppercase">View All</button>
              </div>
              <div className="relative divide-y divide-warm/50">
                {rankings.slice(0, 10).map((r, i) => (
                  <button key={r._id} onClick={() => { setSelectedPlayerId(r._id); handleTabChange('rankings'); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/70 transition-colors">
                    {/* Rank number */}
                    <span className={`text-sm font-bold tabular-nums w-4 text-center ${
                      i === 0 ? 'text-[#D4873A]' :
                      i < 3 ? 'text-[#D4873A]/60' :
                      'text-gray-400'
                    }`}>{i + 1}</span>
                    {/* Avatar with country flag */}
                    <div className="relative flex-shrink-0">
                      <div className={`w-8 h-8 rounded-full overflow-hidden border ${i === 0 ? 'border-[#D4873A]' : 'border-warm'}`}>
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
                      <span className="font-display text-[13px] tracking-wide font-semibold tabular-nums text-[#D4873A]">{formatCurrency(r.bogxCoins || r.points / 100)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* GenX TV */}
            <div className="bg-[#FDFBF7] rounded-xl border border-warm overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-warm">
                <div className="flex items-center gap-2">
                  <Tv className="w-4 h-4 text-[#D4873A]" />
                  <span className="font-display text-sm tracking-wider uppercase text-gray-900">GenX TV</span>
                </div>
                <button onClick={() => handleTabChange('tv')} className="text-[10px] font-semibold text-[#D4873A] hover:underline uppercase">View All</button>
              </div>
              <div className="p-3 space-y-3">
                {tvVideos.map((video) => (
                  <button 
                    key={video._id}
                    onClick={() => window.open(video.youtubeId ? `https://www.youtube.com/watch?v=${video.youtubeId}` : video.youtubeUrl, '_blank')}
                    className="block w-full text-left group"
                  >
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-skeleton">
                      <img 
                        src={video.thumbnail || (video.youtubeId ? `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg` : '')} 
                        alt="" 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      {/* Gradient overlay for text */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                      {/* Play button on hover */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-[#D4873A]/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                          <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                        </div>
                      </div>
                      {/* Title + Info inside image */}
                      <div className="absolute bottom-0 left-0 right-0 px-3 py-2">
                        {/* Category on top */}
                        {video.category && (
                          <span className="font-display text-[10px] text-[#D4873A] tracking-wider uppercase drop-shadow-lg">{video.category}</span>
                        )}
                        {/* Title + Flag */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="font-display text-sm text-white tracking-wide line-clamp-1 leading-tight group-hover:text-[#D4873A] transition-colors drop-shadow-lg">{video.title}</p>
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
          <main className="flex-1 min-w-0">
            <div 
              ref={contentRef}
              data-content-scroll
              className="relative rounded-xl border border-warm overflow-y-auto shadow-sm min-h-[calc(100vh-108px)] scrollbar-hide bg-[#FDFBF7]"
            >
              {/* Content Tabs */}
              {activeTab === "feed" && !openArticleId && <WelcomeReel onOpenArticle={(id: string) => { setOpenArticleId(id); contentRef.current?.scrollTo(0, 0); }} readArticles={readArticles} isDesktop={true} onShowLogin={() => setShowLoginPage(true)} />}
              {openArticleId && <ArticlePage articleId={openArticleId} onBack={() => {
                setOpenArticleId(null);
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
              }} onShowLogin={() => setShowLoginPage(true)} isDesktop={true} onCoinAnimation={(amount) => {
                // Mark article as read immediately in UI
                setReadArticles(prev => { const next = new Set(Array.from(prev)); next.add(openArticleId); return next; });
                // Show animation + animate coins counting up
                setCoinAnimation({ show: true, amount, variant: 'gain' });
                animateCoins(amount);
              }} />}
              {activeTab === "arcade" && (
                arcadeGame === 'quizzbattle' ? (
                  <DesktopBattlesPage coins={coins} setCoins={setCoins} onCoinAnimation={(amount, variant) => setCoinAnimation({ show: true, amount, variant })} onShowLogin={() => setShowLoginPage(true)} onBattleActiveChange={setIsBattleActive} pendingBattleId={pendingBattleId} onPendingBattleHandled={() => setPendingBattleId(null)} onBack={() => setArcadeGame(null)} />
                ) : arcadeGame === 'genxmen' ? (
                  <GenXManGame onBack={() => setArcadeGame(null)} onScoreUpdate={() => {}} />
                ) : arcadeGame === 'prediction' ? (
                  <DesktopContentWrapper><PredictionsGame onBack={() => setArcadeGame(null)} onShowLogin={() => setShowLoginPage(true)} embedded={true} /></DesktopContentWrapper>
                ) : arcadeGame === 'trivia' ? (
                  <div className="h-full min-h-full flex flex-col bg-[#FDFBF7]">
                    <SoloTriviaGame onBack={() => setArcadeGame(null)} onCoinsChange={(amount) => animateCoins(amount)} onCoinAnimation={(amount) => setCoinAnimation({ show: true, amount })} embedded={true} />
                  </div>
                ) : (
                  <DesktopContentWrapper><DesktopArcadePage onSelectGame={(game) => setArcadeGame(game)} onShowRankings={() => handleTabChange('rankings')} /></DesktopContentWrapper>
                )
              )}
              {activeTab === "articles" && !openArticleId && <DesktopArticlesPage onOpenArticle={(id: string) => { setOpenArticleId(id); contentRef.current?.scrollTo(0, 0); }} />}
              {activeTab === "voting" && !openArticleId && <DesktopRankrollPage onOpenArticle={(id: string) => { setOpenArticleId(id); contentRef.current?.scrollTo(0, 0); }} onShowLogin={() => setShowLoginPage(true)} onCoinAnimation={(amount) => { animateCoins(amount); setCoinAnimation({ show: true, amount }); }} />}
              {activeTab === "shop" && <DesktopContentWrapper><ShopPage coins={coins} onCoinsUsed={(amount) => { setCoins(prev => prev - amount); setCoinAnimation({ show: true, amount: -amount }); }} /></DesktopContentWrapper>}
              {activeTab === "tv" && <DesktopContentWrapper><TVPage /></DesktopContentWrapper>}
              {activeTab === "radio" && <DesktopContentWrapper transparent><RadioPage isDesktop={true} /></DesktopContentWrapper>}
              {activeTab === "notifications" && <DesktopContentWrapper transparent><NotificationPage onGoToProfile={() => handleTabChange('profile')} onGoToBattle={(id) => { setPendingBattleId(id); setArcadeGame('quizzbattle'); handleTabChange('arcade'); }} onPointsAwarded={(amount) => setCoinAnimation({ show: true, amount })} /></DesktopContentWrapper>}
              {activeTab === "profile" && (isLoggedIn ? <DesktopContentWrapper><ProfilePage coins={coins} /></DesktopContentWrapper> : <DesktopLoginPage onClose={() => handleTabChange("feed")} onSuccess={() => {}} showBack={true} />)}
              {activeTab === "rankings" && <DesktopRankingsPage currentUserScore={coins} onBack={() => handleTabChange('home')} onShowSignup={() => setShowLoginPage(true)} onShowRewards={() => handleTabChange('rewards')} selectedPlayerId={selectedPlayerId} onPlayerClose={() => setSelectedPlayerId(null)} />}
              {activeTab === "rewards" && <DesktopRewardsPage coins={coins} onClose={() => handleTabChange('rankings')} onRedeem={(rewardId: string, cost: number) => { const change = -cost; setCoins(prev => prev + change); setCoinAnimation({ show: true, amount: change }); }} />}
            </div>
          </main>

          {/* RIGHT SIDEBAR */}
          <aside className="w-60 flex-shrink-0 hidden xl:block space-y-5">
            {/* Trivia CTA - links to Trivia tab, not directly to game */}
            <button
              onClick={() => { handleTabChange('arcade'); setArcadeGame(null); }}
              className="w-full rounded-xl border border-warm overflow-hidden text-left group hover:brightness-105 transition-all shadow-sm relative bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: 'url(/images/battle.png)' }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#D4873A] via-[#D4873A]/90 to-transparent" />
              <div className="relative p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Gamepad2 className="w-5 h-5 text-white" />
                  <span className="font-display text-lg tracking-wider uppercase text-white">Arcade</span>
                </div>
                <p className="text-xs text-white/80 mb-3">Test your knowledge & win BOGX.</p>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#D4873A] bg-white px-3 py-1.5 rounded-lg">
                  PLAY NOW <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </button>

            {/* Shop */}
            <div className="bg-[#FDFBF7] rounded-xl border border-warm overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-warm">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#D4873A]" />
                  <span className="font-display text-sm tracking-wider uppercase text-gray-900">Shop</span>
                </div>
                <button onClick={() => handleTabChange('shop')} className="text-[10px] font-semibold text-[#D4873A] hover:underline uppercase">View All</button>
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
                      <p className="text-sm font-semibold text-[#D4873A]">{product.price}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Rewards - with gift box decoration */}
            <button
              onClick={() => handleTabChange('rewards')}
              className="w-full rounded-xl border border-warm overflow-hidden text-left group hover:brightness-105 transition-all shadow-sm relative bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: 'url(/images/reward.png)' }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#FFF8E7] via-[#FFF8E7]/90 to-transparent" />
              <div className="relative p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Gift className="w-4 h-4 text-[#D4873A]" />
                  <span className="font-display text-sm tracking-wider uppercase text-gray-900">Rewards</span>
                </div>
                <p className="text-[11px] text-gray-600 mb-2">Earn free points & claim prizes.</p>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-[#D4873A] px-2.5 py-1 rounded-md group-hover:bg-[#C4772A] transition-colors">
                  CLAIM NOW <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </button>

            {/* Radio - with background image and equalizer */}
            <div className="rounded-xl border border-warm overflow-hidden shadow-sm relative bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/images/radio.png)' }}>
              <div className="relative z-10">
                {/* Header with Equalizer */}
                <div className="px-4 pt-4 pb-3 border-b border-white/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-[#D4873A]" />
                      <span className="font-display text-sm tracking-wider uppercase text-gray-800">Radio</span>
                    </div>
                    <button onClick={() => handleTabChange('radio')} className="text-[10px] font-semibold text-[#D4873A] hover:underline uppercase">View All</button>
                  </div>
                  {/* Mini Equalizer */}
                  <div className="flex items-end justify-between w-full h-6 gap-[2px]">
                    {Array.from({ length: 30 }).map((_, i) => (
                      <div
                        key={i}
                        className="bg-gradient-to-t from-[#D4873A]/50 to-[#E5A55A]/30 rounded-t-sm flex-1"
                        style={{
                          animation: `eqSidebar ${0.3 + Math.random() * 0.4}s ease-in-out infinite alternate`,
                          animationDelay: `${(i * 0.03) % 0.3}s`,
                          height: `${30 + Math.random() * 70}%`,
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
                      <div className="w-6 h-6 rounded-full bg-[#D4873A]/80 flex items-center justify-center flex-shrink-0">
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
          <a href="/impressum" className="hover:text-[#D4873A] transition-colors">Impressum</a>
          <a href="/datenschutz" className="hover:text-[#D4873A] transition-colors">Datenschutz</a>
          <a href="/agb" className="hover:text-[#D4873A] transition-colors">AGB</a>
          <a href="/karriere" className="hover:text-[#D4873A] transition-colors">Karriere</a>
          <a href="/kontakt" className="hover:text-[#D4873A] transition-colors">Kontakt</a>
          <a href="/presse" className="hover:text-[#D4873A] transition-colors">Presse</a>
        </div>
        
        {/* Social Links */}
        <div className="flex justify-center gap-4 mb-6">
          <a href="https://instagram.com/bestofgenx" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-[#D4873A]/10 flex items-center justify-center text-[#D4873A] hover:bg-[#D4873A]/20 transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
          </a>
          <a href="https://linkedin.com/company/bestofgenx" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-[#D4873A]/10 flex items-center justify-center text-[#D4873A] hover:bg-[#D4873A]/20 transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          </a>
          <a href="https://facebook.com/bestofgenx" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-[#D4873A]/10 flex items-center justify-center text-[#D4873A] hover:bg-[#D4873A]/20 transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          </a>
          <a href="mailto:contact@bestofgenx.com" className="w-10 h-10 rounded-full bg-[#D4873A]/10 flex items-center justify-center text-[#D4873A] hover:bg-[#D4873A]/20 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          </a>
        </div>
        
        {/* Copyright */}
        <p className="text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Best of GenX. All rights reserved.
        </p>
        
        {/* Made with love - using Lucide Heart icon instead of emoji */}
        <p className="text-center text-[10px] text-gray-300 mt-2 flex items-center justify-center gap-1">
          Made with <svg className="w-3 h-3 text-[#D4873A]" fill="currentColor" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> for Generation X
        </p>
      </footer>

      {/* ===== OVERLAYS ===== */}

      {/* Login Modal */}
      {showLoginPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowLoginPage(false)}>
          <div className="w-full max-w-md mx-4 bg-[#FDFBF7] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <DesktopLoginPage onClose={() => setShowLoginPage(false)} onSuccess={() => setShowLoginPage(false)} showBack={true} />
          </div>
        </div>
      )}

      {/* Coin Animation - Desktop mode for bigger, more impactful animation */}
      {coinAnimation.show && <CoinAnimation amount={coinAnimation.amount} variant={coinAnimation.variant} isDesktop={true} onComplete={() => setCoinAnimation({ show: false, amount: 0 })} />}

      {/* Welcome Back Modal */}
      {showWelcomeBack && (
        <WelcomeBackModal
          isOpen={showWelcomeBack}
          onClose={() => setShowWelcomeBack(false)}
          username={user?.username || 'there'}
          currentRank={welcomeCurrentRank}
          rankChange={welcomeRankChange}
          welcomeAI={welcomeAI}
          notificationsEnabled={welcomeNotificationsEnabled}
          unreadCount={0}
          playedCount={0}
          totalCards={0}
          onPrimaryAction={() => setShowWelcomeBack(false)}
          onEnableNotifications={() => {
            setShowWelcomeBack(false);
            setActiveTab('notifications');
          }}
        />
      )}
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
