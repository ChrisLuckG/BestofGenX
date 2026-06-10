"use client";

import { useState, useEffect, useRef } from "react";
import BettingGame, { BetData } from "./games/BettingGame";
import GuessGame from "./games/GuessGame";
import QuizGame from "./games/QuizGame";
import AdGame from "./games/AdGame";
import SurpriseReel from "./games/SurpriseReel";
import ComingSoonReel from "./games/ComingSoonReel";
import VideoGame from "./games/VideoGame";
import GoalWallGame from "./games/GoalWallGame";
import Header from "./Header";
import RewardsPage from "./RewardsPage";
import BottomNav, { NavTab } from "./BottomNav";
import RankingsPage from "./RankingsPage";
import ShopPage from "./ShopPage";
import CoinAnimation from "./CoinAnimation";
import WelcomeReel from "./games/WelcomeReel";
import JustForFunModal from "./JustForFunModal";
import SwipeWarningModal from "./SwipeWarningModal";

interface PhoneEmulatorProps {
  onIndexChange?: (index: number) => void;
  externalIndex?: { index: number; timestamp: number };
}

export const contentLabels = [
  { type: "welcome", label: "Welcome", emoji: "🎉" },
  { type: "prediction", label: "Prediction", emoji: "⚡" },
  { type: "ad", label: "Ad Challenge", emoji: "�" },
  { type: "quiz", label: "Quiz", emoji: "🧠" },
  { type: "ad", label: "Ad Challenge", emoji: "📺" },
  { type: "quiz", label: "Quiz", emoji: "🧠" },
  { type: "video", label: "Video Challenge", emoji: "🎬" },
  { type: "surprise", label: "Surprise", emoji: "🎁" },
  { type: "gaming", label: "Gaming", emoji: "🎮" },
];

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

export default function PhoneEmulator({ onIndexChange, externalIndex }: PhoneEmulatorProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showRewards, setShowRewards] = useState(false);
  const [coins, setCoins] = useState(0);
  const [activeTab, setActiveTab] = useState<NavTab>("home");
  const [activeBets, setActiveBets] = useState<BetData[]>([]);
  const [hasBettingBetPlaced, setHasBettingBetPlaced] = useState(false);
  const [lastTimestamp, setLastTimestamp] = useState<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [coinAnimation, setCoinAnimation] = useState<{ show: boolean; amount: number }>({ show: false, amount: 0 });
  const [showJustForFun, setShowJustForFun] = useState(false);
    const [hasShownJustForFun, setHasShownJustForFun] = useState(false);
  const [challengeActive, setChallengeActive] = useState(false);
  const [showSwipeWarning, setShowSwipeWarning] = useState(false);
  const [pendingSwipeIndex, setPendingSwipeIndex] = useState<number | null>(null);
  const [currentReward, setCurrentReward] = useState(50);
  const [bwinQuestionIndex, setBwinQuestionIndex] = useState(0);
  const [gameKeys, setGameKeys] = useState<Record<string, number>>({});

  // Sync with external index when it changes
  useEffect(() => {
    if (externalIndex && externalIndex.timestamp !== lastTimestamp) {
      setCurrentIndex(externalIndex.index);
      setActiveTab("home");
      setLastTimestamp(externalIndex.timestamp);
      
      // Scroll to the correct position
      setTimeout(() => {
        if (scrollContainerRef.current) {
          const itemHeight = scrollContainerRef.current.clientHeight;
          scrollContainerRef.current.scrollTo({
            top: externalIndex.index * itemHeight,
            behavior: "smooth"
          });
        }
      }, 100);
    }
  }, [externalIndex, lastTimestamp]);

  const handleBetPlaced = (bet: BetData) => {
    setActiveBets(prev => [...prev, bet]);
    setHasBettingBetPlaced(true);
  };

  const handleRedeem = (rewardId: string, cost: number) => {
    setCoins(prev => prev - cost);
    alert(`🎉 ${rewardId} redeemed! You spent ${cost} coins.`);
  };

  const handleChallengeStart = (reward: number) => {
    setChallengeActive(true);
    setCurrentReward(reward);
  };

  const handleAdComplete = (correct: boolean, reward: number) => {
    setChallengeActive(false);
    if (correct) {
      setCoinAnimation({ show: true, amount: reward });
      setCoins(prev => prev + reward);
    } else {
      // Falsche Antwort: Punkte abziehen (reward kann bereits negativ sein)
      const penalty = reward < 0 ? reward : -reward;
      setCoinAnimation({ show: true, amount: penalty });
      setCoins(prev => Math.max(0, prev + penalty));
    }
  };

  const handleSurpriseComplete = (reward: number) => {
    setCoinAnimation({ show: true, amount: reward });
    setCoins(prev => prev + reward);
  };

  const handleCoinAnimationComplete = () => {
    setCoinAnimation({ show: false, amount: 0 });
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

  const content = [
    { type: "welcome", component: <WelcomeReel key={`welcome-${gameKeys[0] || 0}`} /> },
    { type: "prediction", component: <BettingGame key={`betting-${gameKeys[1] || 0}`} onBetPlaced={handleBetPlaced} hasBetPlaced={hasBettingBetPlaced} /> },
    { type: "ad", component: <AdGame key={`ad1-${gameKeys[2] || 0}`} adData={adData.nike} onComplete={handleAdComplete} onStart={handleChallengeStart} /> },
    { type: "quiz", component: <GuessGame key={`guess-${gameKeys[3] || 0}`} onComplete={handleAdComplete} onStart={handleChallengeStart} /> },
    { type: "ad", component: <AdGame key={`ad2-${gameKeys[4] || 0}-${bwinQuestionIndex}`} adData={currentBwinData} onComplete={handleAdComplete} onStart={handleChallengeStart} /> },
    { type: "quiz", component: <QuizGame key={`quiz-${gameKeys[5] || 0}`} onComplete={handleAdComplete} onStart={handleChallengeStart} /> },
    { type: "video", component: <VideoGame key={`video-${gameKeys[6] || 0}`} videoData={videoData} onComplete={handleAdComplete} onStart={handleChallengeStart} /> },
    { type: "surprise", component: <SurpriseReel key={`surprise-${gameKeys[7] || 0}`} onComplete={handleSurpriseComplete} /> },
    { type: "gaming", component: <GoalWallGame key={`goalwall-${gameKeys[8] || 0}`} onComplete={handleAdComplete} onStart={handleChallengeStart} /> },
  ];

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollPosition = container.scrollTop;
    const itemHeight = container.clientHeight;
    const newIndex = Math.round(scrollPosition / itemHeight);
    if (newIndex !== currentIndex) {
      // If challenge is active, show warning and block scroll
      if (challengeActive) {
        setPendingSwipeIndex(newIndex);
        setShowSwipeWarning(true);
        // Scroll back to current position
        container.scrollTo({
          top: currentIndex * itemHeight,
          behavior: "smooth"
        });
        return;
      }
      // Show JustForFun popup on first swipe from Welcome (index 0 to 1)
      if (currentIndex === 0 && newIndex === 1 && !hasShownJustForFun) {
        setShowJustForFun(true);
        setHasShownJustForFun(true);
      }
      setCurrentIndex(newIndex);
      onIndexChange?.(newIndex);
    }
  };

  const handleSwipeWarningContinue = () => {
    // User wants to swipe away - deduct points
    setCoinAnimation({ show: true, amount: -currentReward });
    setCoins(prev => Math.max(0, prev - currentReward));
    setChallengeActive(false);
    setShowSwipeWarning(false);
    // Now allow the swipe
    if (pendingSwipeIndex !== null && scrollContainerRef.current) {
      const itemHeight = scrollContainerRef.current.clientHeight;
      scrollContainerRef.current.scrollTo({
        top: pendingSwipeIndex * itemHeight,
        behavior: "smooth"
      });
      setCurrentIndex(pendingSwipeIndex);
      onIndexChange?.(pendingSwipeIndex);
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

  const handleJustForFunLogin = () => {
    setShowJustForFun(false);
    // Login handled by parent component
  };

  const handleLogoClick = () => {
    // Reset everything
    setCoins(0);
    setCurrentIndex(0);
    setActiveTab("home");
    setActiveBets([]);
    setHasBettingBetPlaced(false);
    setChallengeActive(false);
    setHasShownJustForFun(false);
    setBwinQuestionIndex(0);
    // Force re-render all games
    setGameKeys({
      0: (gameKeys[0] || 0) + 1,
      1: (gameKeys[1] || 0) + 1,
      2: (gameKeys[2] || 0) + 1,
      3: (gameKeys[3] || 0) + 1,
      4: (gameKeys[4] || 0) + 1,
      5: (gameKeys[5] || 0) + 1,
      6: (gameKeys[6] || 0) + 1,
      7: (gameKeys[7] || 0) + 1,
      8: (gameKeys[8] || 0) + 1,
    });
    // Scroll to top
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="phone-frame">
      <div className="phone-screen w-[320px] h-[680px] md:w-[375px] md:h-[812px] relative flex flex-col overflow-hidden">
        {/* Header */}
        <Header coins={coins} username="Max" onCoinsClick={() => setShowRewards(true)} onLogoClick={handleLogoClick} />

        {/* Coin Animation */}
        {coinAnimation.show && (
          <CoinAnimation 
            amount={coinAnimation.amount} 
            onComplete={handleCoinAnimationComplete} 
          />
        )}

        {/* Rewards Page Overlay */}
        <RewardsPage
          isOpen={showRewards}
          coins={coins}
          onClose={() => setShowRewards(false)}
          onRedeem={handleRedeem}
        />

        {/* Main Content Area */}
        <div className="flex-1 mt-[48px] overflow-hidden relative">
          {/* Home - Always rendered, hidden when not active */}
          <div
            ref={scrollContainerRef}
            className={`snap-container phone-scroll h-full absolute inset-0 ${activeTab === "home" ? "visible" : "invisible"}`}
            onScroll={handleScroll}
          >
            {content.map((item, index) => (
              <div key={index} className="snap-item w-full h-full">
                {item.component}
              </div>
            ))}
          </div>

          {activeTab === "rankings" && (
            <RankingsPage currentUserScore={coins} />
          )}

          {activeTab === "shop" && (
            <ShopPage />
          )}

          
          {activeTab === "profile" && (
            <div className="h-full flex items-center justify-center text-center p-8">
              <div>
                <div className="w-20 h-20 rounded-full bg-sport flex items-center justify-center text-3xl font-bold mx-auto mb-4">
                  M
                </div>
                <h2 className="text-xl font-bold mb-1">Max</h2>
                <p className="text-gray-400 text-sm mb-4">Mitglied seit 2024</p>
                <div className="text-sport-gold font-bold text-2xl">{coins.toLocaleString()} Coins</div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Home Indicator */}
        <div className="phone-home-indicator" />

        {/* Just For Fun Modal */}
        <JustForFunModal 
          isOpen={showJustForFun} 
          onClose={() => setShowJustForFun(false)} 
          onLogin={handleJustForFunLogin}
        />

        
        {/* Swipe Warning Modal */}
        <SwipeWarningModal
          isOpen={showSwipeWarning}
          onContinue={handleSwipeWarningContinue}
          onRestart={handleSwipeWarningRestart}
          reward={currentReward}
        />
      </div>
    </div>
  );
}
