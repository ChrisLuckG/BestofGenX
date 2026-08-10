"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { 
  Plus, ChevronLeft, ChevronRight, Swords, Check, X, Clock, HelpCircle, Trophy, Coins, Users,
  Dumbbell, Music, Film, Landmark, Shirt, Gamepad2, Tv, Palette, UtensilsCrossed, Play, Lock, LayoutGrid,
  Target, Zap, RefreshCcw, Shield, Loader2
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import LogoLoader from "@/components/LogoLoader";
import BackButton from "@/components/BackButton";
import CountryFlag from "@/components/CountryFlag";
import { incrementGamePlayCount } from "@/utils/gameIntro";
import AlertModal from "@/components/AlertModal";
import { useAlert } from "@/hooks/useAlert";
import InviteFlowModal from "@/components/battles/InviteFlowModal";
import { formatCurrency, getCurrencySymbol } from "@/utils/currency";
import { sounds } from "@/utils/sounds";
import { compareBattleResults } from "@/utils/battleWinner";
import OpenBattlesModal from "@/components/OpenBattlesModal";

// Types
interface BattleUser {
  _id: string;
  username: string;
  avatar: string;
  country: string;
  countryFlag: string;
  points: number;
  isBot?: boolean;
}

interface Battle {
  _id: string;
  creator: BattleUser;
  opponent?: BattleUser;
  topic: string;
  wager: number;
  rounds: number;
  status: 'open' | 'active' | 'completed' | 'cancelled';
  questions: {
    cardId?: string;
    question: string;
    answers: string[]; 
    correctIndex: number;
    points: number;
  }[];
  creatorResults: { round: number; correct: boolean; timeMs: number; points: number; }[];
  opponentResults: { round: number; correct: boolean; timeMs: number; points: number; }[];
  creatorTotalPoints: number;
  opponentTotalPoints: number;
  winner?: string;
  isPrivate?: boolean;
  challengedUser?: string;
  createdAt: string;
}

interface RoundResult {
  correct: boolean;
  timeMs: number;
  points: number;
  answerIndex?: number;
}

// Topic config - each category has its own color
const TOPICS: { id: string; label: string; icon: LucideIcon; color: string }[] = [
  { id: 'sport', label: 'Sport', icon: Dumbbell, color: '#22C55E' },    // Green
  { id: 'music', label: 'Music', icon: Music, color: '#8B5CF6' },       // Purple
  { id: 'film', label: 'Film', icon: Film, color: '#3B82F6' },          // Blue
  { id: 'culture', label: 'Culture', icon: Landmark, color: '#F59E0B' }, // Amber
  { id: 'fashion', label: 'Fashion', icon: Shirt, color: '#EC4899' },   // Pink
  { id: 'games', label: 'Games', icon: Gamepad2, color: '#10B981' },    // Emerald
  { id: 'tv', label: 'TV', icon: Tv, color: '#EF4444' },                // Red
  { id: 'art', label: 'Art', icon: Palette, color: '#6366F1' },         // Indigo
  { id: 'food', label: 'Food', icon: UtensilsCrossed, color: '#F97316' }, // Orange
];

const WAGERS = [
  { amount: 0.10, rounds: 3 },
  { amount: 0.25, rounds: 3 },
  { amount: 0.50, rounds: 5 },
  { amount: 0.75, rounds: 5 },
  { amount: 1.00, rounds: 5 },
];

const GAME_TYPES = [
  { id: 'quiz', label: 'Quiz Battle', icon: '⚡', available: true },
  { id: 'poker', label: 'Poker', icon: '🃏', available: false },
  { id: 'rps', label: 'Rock Paper Scissors', icon: '✊', available: false },
  { id: 'dice', label: 'Dice Duel', icon: '🎲', available: false },
];

type GameScreen = 'setup' | 'pool' | 'intro' | 'countdown' | 'quiz' | 'inter' | 'result';

// Country code to flag emoji mapping
const FLAG_MAP: Record<string, string> = {
  'DE': '🇩🇪', 'US': '🇺🇸', 'GB': '🇬🇧', 'UK': '🇬🇧', 'FR': '🇫🇷', 'ES': '🇪🇸',
  'IT': '🇮🇹', 'JP': '🇯🇵', 'BR': '🇧🇷', 'NL': '🇳🇱', 'SE': '🇸🇪', 'PL': '🇵🇱',
  'AT': '🇦🇹', 'CH': '🇨🇭', 'CA': '🇨🇦', 'AU': '🇦🇺', 'MX': '🇲🇽', 'AR': '🇦🇷',
  'PT': '🇵🇹', 'BE': '🇧🇪', 'NO': '🇳🇴', 'DK': '🇩🇰', 'FI': '🇫🇮', 'IE': '🇮🇪',
  'KR': '🇰🇷', 'IN': '🇮🇳', 'RU': '🇷🇺', 'CN': '🇨🇳', 'ZA': '🇿🇦', 'TR': '🇹🇷',
};

const getFlag = (flag: string | undefined): string => {
  if (!flag) return '�🇪';
  // If already an emoji (longer than 2 chars), return as is
  if (flag.length > 2) return flag;
  // Look up in map
  const code = flag.toUpperCase();
  return FLAG_MAP[code] || '🏳️';
};

interface BattlePageProps {
  coins: number;
  setCoins: (fn: (prev: number) => number) => void;
  onCoinAnimation?: (amount: number, variant?: 'gain' | 'loss' | 'hold') => void;
  viewBattleId?: string | null; // Battle ID to view from notification
  onBattleViewed?: () => void; // Callback when battle has been viewed
  onShowLogin?: () => void; // Callback to show login page
  onBattleActiveChange?: (isActive: boolean) => void; // Notify parent when battle is active
  pendingBattleId?: string | null; // Battle ID to accept from notification
  onPendingBattleHandled?: () => void; // Callback when pending battle has been handled
  onBack?: () => void; // Callback to go back to Arcade
  embedded?: boolean; // If true, render modals inline (for desktop)
  onGoToTrivia?: () => void; // Navigate to solo trivia
  onGoToArticles?: () => void; // Navigate to articles
  isDesktop?: boolean; // If true, desktop layout
  skipSetup?: boolean; // If true, skip setup screen and go directly to pool
}

// Check if game is on break (9:00-10:00 CET - daily reset period)
const isGameOnBreak = () => {
  const now = new Date();
  const germanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  const hour = germanTime.getHours();
  return hour >= 9 && hour < 10;
};

export default function BattlePage({ coins, setCoins, onCoinAnimation, viewBattleId, onBattleViewed, onShowLogin, onBattleActiveChange, pendingBattleId, onPendingBattleHandled, onBack, embedded = false, isDesktop = false, onGoToTrivia, onGoToArticles, skipSetup = false }: BattlePageProps) {
  const { user, isLoggedIn } = useAuth();
  
  // Check if game is on break (9:00-10:00)
  const [isOnBreak, setIsOnBreak] = useState(isGameOnBreak());
  
  // Update break status every 10 seconds (so it updates quickly at 10:00)
  useEffect(() => {
    const check = () => setIsOnBreak(isGameOnBreak());
    check();
    const interval = setInterval(check, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);
  
  // Screen state - start with pool if skipSetup is true, or if a battle was passed in via
  // pendingBattleId (e.g. clicking "Play Now" from Open Battles), skip setup
  // and go straight to the intro screen instead of flashing setup first.
  const [screen, setScreen] = useState<GameScreen>(pendingBattleId ? 'intro' : (skipSetup ? 'pool' : 'setup'));
  const [selectedGameType, setSelectedGameType] = useState('quiz');
  const [topicFilter, setTopicFilter] = useState('all');
  const [wagerFilter, setWagerFilter] = useState<number | 'all'>('all');
  const topicScrollRef = useRef<HTMLDivElement>(null);
  
  // Create panel
  const [showCreate, setShowCreate] = useState(false);
  const [createWager, setCreateWager] = useState(0.10);
  const [createTopic, setCreateTopic] = useState('sport');
  
  // Challenge modal
  const [showChallengeModal, setShowChallengeModal] = useState(false);

  // Open Battles modal (same as ArcadePage)
  const [showOpenBattles, setShowOpenBattles] = useState(false);
  const [liveBattleCount, setLiveBattleCount] = useState(0);

  // Refresh battle count for Open Battles badge
  const refreshBattleCount = () => {
    if (!user?.id) return;
    fetch(`/api/battles?userId=${user.id}&countOnly=true`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setLiveBattleCount((data.pendingChallenges ?? 0) + (data.activeBattles ?? 0) + (data.myOpenBattles ?? 0));
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    refreshBattleCount();
  }, [user?.id]);

  // Game intro modal removed - now using setup screen like Solo Trivia
  
  // Own battle cancel modal
  const [selectedOwnBattle, setSelectedOwnBattle] = useState<Battle | null>(null);
  
  // Quick battle preview popup
  const [quickPreviewBattle, setQuickPreviewBattle] = useState<Battle | null>(null);
  
  // Accepting battle loading state
  const [isAccepting, setIsAccepting] = useState(false);
  
  // Battles
  const [battles, setBattles] = useState<Battle[]>([]);
  const [currentBattle, setCurrentBattle] = useState<Battle | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Quiz state
  const [currentRound, setCurrentRound] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(10000);
  const [currentPoints, setCurrentPoints] = useState(0.30);
  const [myResults, setMyResults] = useState<RoundResult[]>([]);
  const [opponentResults, setOpponentResults] = useState<RoundResult[]>([]);
  const [myTotalPoints, setMyTotalPoints] = useState(0);
  const [opponentTotalPoints, setOpponentTotalPoints] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isCreator, setIsCreator] = useState(false); // Track if current player is the creator
  
  // Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const myResultsRef = useRef<RoundResult[]>([]);
  const opponentResultsRef = useRef<RoundResult[]>([]);
  const currentBattleRef = useRef<Battle | null>(null);
  const currentRoundRef = useRef<number>(0);
  
  // Keep refs in sync with state
  useEffect(() => {
    myResultsRef.current = myResults;
  }, [myResults]);
  
  useEffect(() => {
    opponentResultsRef.current = opponentResults;
  }, [opponentResults]);
  
  useEffect(() => {
    currentBattleRef.current = currentBattle;
  }, [currentBattle]);
  
  useEffect(() => {
    currentRoundRef.current = currentRound;
  }, [currentRound]);
  
  // Alert Modal
  const { alertState, showAlert, hideAlert } = useAlert();

  // Cleanup timer on unmount or screen change
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // Stop timer when leaving quiz screen
  useEffect(() => {
    if (screen !== 'quiz' && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [screen]);

  // Notify parent when battle is active (to block tab switching)
  const isBattleActive = screen === 'countdown' || screen === 'quiz' || screen === 'inter';
  useEffect(() => {
    onBattleActiveChange?.(isBattleActive);
  }, [isBattleActive, onBattleActiveChange]);

  // Warn user before leaving page during active battle
  useEffect(() => {
    if (!isBattleActive) return;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'You have an active battle! Leaving will forfeit your wager.';
      return e.returnValue;
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isBattleActive]);

  // Load battles and trigger bot activity
  useEffect(() => {
    loadBattles();
    
    // Trigger bot activity in background (creates natural feeling)
    fetch('/api/battles/trigger-bots', { method: 'POST' })
      .catch(() => {}); // Ignore errors silently
  }, []);

  // Load specific battle from notification
  useEffect(() => {
    if (viewBattleId && user?.id) {
      loadBattleById(viewBattleId);
    }
  }, [viewBattleId, user?.id]);

  // Handle pending battle from notification (Accept & Play)
  useEffect(() => {
    if (pendingBattleId && user?.id && isLoggedIn) {
      // Load and show the battle intro
      const loadPendingBattle = async () => {
        try {
          const res = await fetch(`/api/battles/${pendingBattleId}`);
          const data = await res.json();
          if (data.success && data.battle) {
            const battle = data.battle;
            // Check if user has enough coins
            if (coins < toBOGX(battle.wager)) {
              showAlert('coins', `You need ${formatCurrency(toBOGX(battle.wager))} coins to accept this challenge!`);
              onPendingBattleHandled?.();
              return;
            }
            // "Play Now" is a single decisive action — accept (if needed) and
            // start the battle immediately instead of showing a redundant
            // intro/confirmation screen first.
            setCurrentBattle(battle);
            beginBattle(battle);
          }
        } catch (error) {
          console.error('Failed to load pending battle:', error);
        }
        onPendingBattleHandled?.();
      };
      loadPendingBattle();
    }
  }, [pendingBattleId, user?.id, isLoggedIn]);

  const loadBattleById = async (battleId: string) => {
    try {
      const res = await fetch(`/api/battles/${battleId}`);
      const data = await res.json();
      if (data.success && data.battle) {
        const battle = data.battle;
        setCurrentBattle(battle);
        
        // Determine if user is creator or opponent
        const isCreator = battle.creator._id === user?.id || battle.creator === user?.id;
        setIsCreator(isCreator);
        
        // Load results
        if (isCreator) {
          setMyResults(battle.creatorResults || []);
          setOpponentResults(battle.opponentResults || []);
          setMyTotalPoints(battle.creatorTotalPoints || 0);
          setOpponentTotalPoints(battle.opponentTotalPoints || 0);
        } else {
          setMyResults(battle.opponentResults || []);
          setOpponentResults(battle.creatorResults || []);
          setMyTotalPoints(battle.opponentTotalPoints || 0);
          setOpponentTotalPoints(battle.creatorTotalPoints || 0);
        }
        
        // Show result screen
        setScreen('result');
        
        // Clear the viewBattleId
        onBattleViewed?.();
      }
    } catch (error) {
      console.error('Failed to load battle:', error);
    }
  };

  // Auto-refresh battles every 30 seconds when on pool screen
  useEffect(() => {
    if (screen !== 'pool') return;
    
    const interval = setInterval(() => {
      loadBattles(true); // Silent refresh
    }, 30000); // 30 seconds instead of 10
    
    return () => clearInterval(interval);
  }, [screen]);

  const loadBattles = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      // Add cache-busting, user ID for private battles, and no-cache headers
      const userParam = user?.id ? `&userId=${user.id}` : '';
      const res = await fetch(`/api/battles?t=${Date.now()}${userParam}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      const data = await res.json();
      if (data.success) {
        setBattles(data.battles);
      }
    } catch (error) {
      console.error('Failed to load battles:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Filter battles
  const filteredBattles = battles.filter(b => {
    if (b.status !== 'open') return false;
    if (topicFilter !== 'all' && b.topic !== topicFilter) return false;
    if (wagerFilter !== 'all' && b.wager !== wagerFilter) return false;
    return true;
  });

  // Create battle and start playing immediately
  const [isGenerating, setIsGenerating] = useState(false);
  
  const handleCreateBattle = async (isInvite: boolean = false) => {
    if (!user) return;
    
    setIsGenerating(true);
    
    try {
      // First sync coins from DB to ensure we have accurate balance
      const syncRes = await fetch(`/api/user/points?userId=${user.id}`);
      const syncData = await syncRes.json();
      if (syncData.success) {
        const dbCoins = syncData.bogxCoins;
        if (dbCoins < createWager) {
          setIsGenerating(false);
          setCoins(() => dbCoins); // Sync local coins with DB
          showAlert('coins', `Not enough coins. You have ${dbCoins.toFixed(2)} BOGX.`);
          return;
        }
        // Update local coins to match DB
        setCoins(() => dbCoins);
      }
      
      const rounds = createWager >= 0.15 ? 5 : 3;
      const res = await fetch('/api/battles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: user.id,
          topic: createTopic,
          wager: createWager,
          rounds,
          isPrivate: isInvite, // Private battles don't show in pool
          source: isInvite ? 'handleCreateBattle:invite' : 'handleCreateBattle:startBattleButton'
        })
      });
      
      const data = await res.json();
      console.log('Battle create response:', data);
      setIsGenerating(false);
      
      if (data.success && data.battle) {
        setShowCreate(false);
        // Wager already deducted on server - parked on hold (not lost)
        onCoinAnimation?.(-createWager, 'hold');
        // Sync coins + pending wager indicator instantly (mobile & desktop)
        window.dispatchEvent(new CustomEvent('bogx-updated'));
        
        // Helper to start the game
        const startGame = () => {
          setCurrentBattle(data.battle);
          setIsCreator(true);
          setMyResults([]);
          setOpponentResults([]);
          setMyTotalPoints(0);
          setOpponentTotalPoints(0);
          setCurrentRound(0);
          setScreen('countdown');
          setCountdown(3);
          runCountdown();
        };
        
        if (isInvite) {
          // Show share dialog instead of playing immediately
          const battleUrl = `${window.location.origin}/battle/${data.battle._id}`;
          
          // Try native share first (mobile)
          if (navigator.share) {
            try {
              await navigator.share({
                title: 'Battle Challenge! 🎮',
                text: `${user.username} challenges you to a ${createTopic.toUpperCase()} battle for ${createWager.toFixed(2)} BOGX!`,
                url: battleUrl
              });
            } catch (e) {
              // User cancelled or share failed, copy to clipboard
              await navigator.clipboard.writeText(battleUrl);
            }
          } else {
            // Desktop: copy to clipboard
            await navigator.clipboard.writeText(battleUrl);
          }
          
          // Show ready screen
          showAlert('success', 'Invite link shared! Now play your round.', {
            buttonText: 'READY? GO!',
            onButtonClick: startGame
          });
        } else {
          // Normal flow: Show ready screen before starting
          const battleId = data.battle._id;
          const topicConfig = TOPICS.find(t => t.id === createTopic);
          
          showAlert('success', `Your ${topicConfig?.label || createTopic} battle is ready!`, {
            title: 'BATTLE CREATED! ⚔️',
            buttonText: 'READY? GO!',
            onButtonClick: startGame,
            secondaryButtonText: 'CANCEL BATTLE',
            onSecondaryButtonClick: () => handleCancelBattle(battleId),
            details: [
              `💰 Wager: ${createWager.toFixed(2)} BOGX`,
              `🎯 Winner takes all (${(createWager * 2).toFixed(2)} BOGX)`,
              `⏳ Waiting for opponent to accept`,
              `❌ Cancel anytime before someone joins`
            ]
          });
        }
      } else {
        showAlert('error', data.error || 'Failed to create battle');
      }
    } catch (error) {
      console.error('Failed to create battle:', error);
      setIsGenerating(false);
      showAlert('error', 'Failed to create battle. Please try again.');
    }
  };

  // Challenge a specific user
  const handleChallengeUser = async (targetUser: any) => {
    setShowChallengeModal(false);
    setIsGenerating(true);
    
    try {
      // First sync coins from DB to ensure we have accurate balance
      const syncRes = await fetch(`/api/user/points?userId=${user?.id}`);
      const syncData = await syncRes.json();
      if (syncData.success) {
        const dbCoins = syncData.bogxCoins;
        if (dbCoins < createWager) {
          setIsGenerating(false);
          setCoins(() => dbCoins); // Sync local coins with DB
          showAlert('coins', `Not enough coins. You have ${dbCoins.toFixed(2)} BOGX.`);
          return;
        }
        // Update local coins to match DB
        setCoins(() => dbCoins);
      }
      
      const rounds = createWager >= 0.15 ? 5 : 3;
      const res = await fetch('/api/battles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: user?.id,
          topic: createTopic,
          wager: createWager,
          rounds,
          isPrivate: true,
          challengedUserId: targetUser._id, // Direct challenge
          source: 'handleChallengeUser'
        })
      });
      
      const data = await res.json();
      console.log('Challenge response:', data);
      setIsGenerating(false);
      
      if (data.success && data.battle) {
        setShowCreate(false);
        // Wager already deducted on server - parked on hold (not lost)
        onCoinAnimation?.(-createWager, 'hold');
        // Sync coins + pending wager indicator instantly (mobile & desktop)
        window.dispatchEvent(new CustomEvent('bogx-updated'));
        
        // Start the game IMMEDIATELY - no optional button
        setCurrentBattle(data.battle);
        setIsCreator(true);
        setMyResults([]);
        setOpponentResults([]);
        setMyTotalPoints(0);
        setOpponentTotalPoints(0);
        setCurrentRound(0);
        setScreen('countdown');
        setCountdown(3);
        runCountdown();
        
        // Show info that challenge was sent (non-blocking)
        showAlert('success', `Challenge sent to ${targetUser.username}! Play your rounds now.`);
      } else {
        showAlert('error', data.error || 'Failed to create challenge');
      }
    } catch (error) {
      console.error('Challenge failed:', error);
      setIsGenerating(false);
      showAlert('error', 'Failed to send challenge. Please try again.');
    }
  };

  // Show battle intro (just preview, don't accept yet)
  const showBattleIntro = (battle: Battle) => {
    if (isOnBreak) {
      showAlert('info', 'Battles are disabled during the break (9:00-10:00).');
      return;
    }
    
    // Guests can only play against bots
    if (!isLoggedIn) {
      const isCreatorBot = battle.creator?.isBot === true;
      if (!isCreatorBot) {
        showAlert('login', 'Please login to challenge real players! As a guest, you can only play against bots.', {
          buttonText: 'LOGIN',
          onButtonClick: onShowLogin
        });
        return;
      }
    }
    
    if (coins < toBOGX(battle.wager)) {
      showAlert('coins', `You need ${formatCurrency(toBOGX(battle.wager))} coins to join this battle!`);
      return;
    }
    
    setCurrentBattle(battle);
    // Pre-set isCreator based on who created the battle
    const creatorField: any = battle.creator;
    const iAmCreator = creatorField?._id === user?.id || creatorField === user?.id;
    setIsCreator(iAmCreator);
    setScreen('intro');
  };

  // Accept battle (called when clicking ACCEPT THE CHALLENGE).
  // Takes the battle explicitly instead of reading currentBattle from state,
  // since callers may invoke this synchronously right after setCurrentBattle
  // (before the state update has propagated) — using stale state here would
  // accept the WRONG battle or silently no-op.
  const handleAcceptBattle = async (battle: Battle): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const res = await fetch(`/api/battles/${battle._id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opponentId: user.id })
      });
      
      const data = await res.json();
      console.log('Accept response:', data);
      
      if (data.success) {
        setCurrentBattle(data.battle);
        // Wager already deducted on server - update local coins and trigger animation
        const wagerAmount = toBOGX(battle.wager);
        setCoins(prev => prev - wagerAmount);
        onCoinAnimation?.(-wagerAmount, 'hold');
        // Sync coins + pending wager indicator instantly (mobile & desktop)
        window.dispatchEvent(new CustomEvent('bogx-updated'));
        return true;
      } else {
        // Friendly error messages based on reason
        let alertType: 'error' | 'coins' = 'error';
        let message = 'This battle is no longer available.';
        if (data.error === 'Battle is not open') {
          message = 'Oops! Someone was faster 🏃💨 This battle was already taken.';
        } else if (data.error === 'Cannot accept own battle') {
          message = "You can't battle yourself! 😅 Challenge someone else.";
        } else if (data.error === 'Not enough coins') {
          alertType = 'coins';
          const available = data.details?.available ?? '?';
          message = `You need ${formatCurrency(toBOGX(battle.wager))} coins but only have ${formatCurrency(available)} in your account. Try refreshing the page to sync your coins.`;
          // Force sync coins from server
          if (data.details?.available !== undefined) {
            setCoins(() => data.details.available);
          }
        } else if (data.error) {
          message = data.error;
        }
        showAlert(alertType, message);
        // Battle not available anymore - go back to pool and refresh
        setCurrentBattle(null);
        setScreen('pool');
        loadBattles();
        return false;
      }
    } catch (error) {
      console.error('Failed to accept battle:', error);
      showAlert('error', 'Connection error 📡 Please try again.');
      setCurrentBattle(null);
      setScreen('pool');
      loadBattles();
      return false;
    }
  };

  // Decline a private challenge - refunds creator
  const handleDeclineChallenge = async () => {
    if (!currentBattle || !user) return;
    
    try {
      const res = await fetch(`/api/battles/${currentBattle._id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oderId: user.id })
      });
      
      const data = await res.json();
      
      if (data.success) {
        showAlert('success', 'Challenge declined. The challenger has been refunded.');
        setCurrentBattle(null);
        setScreen('pool');
        loadBattles();
      } else {
        showAlert('error', data.error || 'Failed to decline challenge');
      }
    } catch (error) {
      console.error('Failed to decline challenge:', error);
      showAlert('error', 'Connection error 📡 Please try again.');
    }
  };

  // Begin gameplay for a given battle. If it's still 'open', accept it first
  // (joining as opponent). If it's already 'active' (e.g. opened via
  // pendingBattleId for a battle you already matched into — either as
  // creator or opponent), skip the accept call entirely: calling accept on
  // an already-active battle always fails with "Battle is not open", which
  // was incorrectly surfaced to the user as "Someone was faster" even though
  // nothing was actually stolen.
  // Takes the battle explicitly (rather than reading currentBattle from
  // closure) so it can be called immediately after loading a fresh battle,
  // without waiting for a state update to propagate.
  const beginBattle = async (battle: Battle) => {
    if (!user) return;
    const alreadyActive = battle.status === 'active';
    // Defensive check: creator may be a populated object OR a raw ID string
    // depending on the code path that loaded this battle.
    const creatorField: any = battle.creator;
    const iAmCreator = creatorField?._id === user.id || creatorField === user.id;

    if (!alreadyActive) {
      // Show accepting modal
      setIsAccepting(true);

      // First accept the battle via API
      const accepted = await handleAcceptBattle(battle);

      if (!accepted) {
        setIsAccepting(false);
        return;
      }

      // Small delay for visual feedback
      await new Promise(r => setTimeout(r, 800));
      setIsAccepting(false);
    }

    // Determine role correctly instead of assuming opponent
    setIsCreator(iAmCreator);
    setCurrentRound(0);
    setMyResults([]);
    // Load the OTHER player's existing results (if any) as "opponent" progress
    // Normalize old points (>1) to BOGX (<1) - legacy data had points like 100, 150
    const otherResults = iAmCreator ? battle.opponentResults : battle.creatorResults;
    const otherTotalPoints = iAmCreator ? battle.opponentTotalPoints : battle.creatorTotalPoints;
    if (otherResults && otherResults.length > 0) {
      const normalizedResults = otherResults.map(r => ({
        correct: r.correct,
        timeMs: r.timeMs,
        points: r.points > 1 ? r.points / 1000 : r.points // Convert legacy points to BOGX
      }));
      setOpponentResults(normalizedResults);
      const totalPts = otherTotalPoints || 0;
      setOpponentTotalPoints(totalPts > 1 ? totalPts / 1000 : totalPts);
    } else {
      setOpponentResults([]);
      setOpponentTotalPoints(0);
    }
    setMyTotalPoints(0);
    setScreen('countdown');
    runCountdown();
  };

  // Called from the intro screen's "START BATTLE" button (browsing the open
  // pool and previewing before committing).
  const startBattle = async () => {
    if (!currentBattle) return;
    await beginBattle(currentBattle);
  };

  // Countdown
  const runCountdown = () => {
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimeout(() => {
            setScreen('quiz');
            startRound();
          }, 700);
          return 0;
        }
        return prev - 1;
      });
    }, 900);
  };

  // Start round
  const startRound = () => {
    // Clear any existing timer first
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setTimeLeft(10000);
    setCurrentPoints(0.30);
    setSelectedAnswer(null);
    setShowAnswer(false);
    startTimeRef.current = Date.now();
    
    // Timer
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(10000 - elapsed, 0);
      setTimeLeft(remaining);
      
      // Points decrease over time, scaling all the way down to 0 at timeout
      const pct = remaining / 10000;
      setCurrentPoints(Math.round(0.30 * pct * 100) / 100);
      
      if (remaining <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        handleTimeout();
      }
    }, 50);
  };

  // Handle answer selection
  const handleAnswer = (index: number) => {
    if (selectedAnswer !== null || !currentBattle) return;
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setSelectedAnswer(index);
    setShowAnswer(true);
    
    const question = currentBattle.questions[currentRound];
    const correct = index === question.correctIndex;
    const timeMs = Date.now() - startTimeRef.current;
    const points = correct ? currentPoints : 0;
    
    // Save result with answerIndex
    const result: RoundResult = { correct, timeMs, points, answerIndex: index };
    const newResults = [...myResults, result];
    setMyResults(newResults);
    myResultsRef.current = newResults; // Update ref immediately
    setMyTotalPoints(prev => prev + points);
    
    // Track question in history so it won't repeat
    if (user?.id && question.cardId) {
      fetch('/api/questions/smart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          cardId: question.cardId,
          questionText: question.question,
          correct,
          context: 'battle',
          battleId: currentBattle._id,
        }),
      }).catch(() => {}); // Fire and forget
    }
    
    // Simulate opponent (bot)
    simulateOpponent();
    
    // Stay on quiz screen, show "Next Round" button for both Creator and Opponent
  };

  // Handle timeout - uses refs to avoid stale closures
  const handleTimeout = () => {
    const battle = currentBattleRef.current;
    if (!battle) {
      console.log('handleTimeout: no currentBattle');
      return;
    }
    
    // Use refs to get current values (avoids stale closure)
    const currentResults = myResultsRef.current;
    const round = currentRoundRef.current;
    console.log('handleTimeout called, currentRound:', round, 'myResults:', currentResults.length);
    
    // Play timeout sound
    sounds.wrong();
    
    setSelectedAnswer(-1); // No answer (will show "TIME'S UP!")
    setShowAnswer(true);
    
    const result: RoundResult = { correct: false, timeMs: 10000, points: 0, answerIndex: -1 };
    const newResults = [...currentResults, result];
    setMyResults(newResults);
    myResultsRef.current = newResults; // Update ref immediately
    
    console.log('handleTimeout: newResults length:', newResults.length);
    
    simulateOpponent();
    
    // Stay on quiz screen, show "Next Round" button for both Creator and Opponent
  };

  // Simulate opponent (bot) answer - only when playing as opponent against a bot
  const simulateOpponent = () => {
    if (!currentBattle) return;
    
    // If creator is playing, no opponent yet - don't simulate
    if (isCreator) return;
    
    // If opponent already has results (from creator's saved game), don't simulate
    // Use ref to avoid stale state producing extra simulated rounds
    if (opponentResultsRef.current.length >= currentBattle.rounds) return;
    
    // Only simulate if opponent is a bot
    if (!currentBattle.creator?.isBot) return;
    
    // Bot skill based on their rank/points (simplified)
    const botSkill = 0.6 + Math.random() * 0.3; // 60-90% accuracy
    const correct = Math.random() < botSkill;
    const timeMs = 2000 + Math.random() * 6000; // 2-8 seconds
    const pct = Math.max(10000 - timeMs, 0) / 10000;
    const points = correct ? Math.round(0.30 * pct * 100) / 100 : 0;
    
    const result: RoundResult = { correct, timeMs, points };
    const newOpp = [...opponentResultsRef.current, result];
    opponentResultsRef.current = newOpp; // Update ref immediately
    setOpponentResults(newOpp);
    setOpponentTotalPoints(prev => prev + points);
  };

  // Next round - pass the latest results to avoid stale state
  const nextRound = (latestResults?: RoundResult[]) => {
    // Use refs to avoid stale closures
    const battle = currentBattleRef.current;
    const round = currentRoundRef.current;
    
    if (!battle) {
      console.log('nextRound: no battle');
      return;
    }
    
    // Use passed results or ref (passed results are more accurate)
    const resultsCount = latestResults ? latestResults.length : myResultsRef.current.length + 1;
    
    const nextIdx = round + 1;
    console.log('nextRound: nextIdx=', nextIdx, 'rounds=', battle.rounds, 'resultsCount=', resultsCount);
    
    if (nextIdx >= battle.rounds) {
      // All rounds complete
      console.log('Battle complete! isCreator:', isCreator);
      
      if (isCreator) {
        // Creator finished - save and go back (no result screen)
        completeBattle(latestResults);
      } else {
        // Opponent finished - show result screen
        setScreen('result');
        completeBattle(latestResults);
      }
    } else {
      // Go directly to next round after a short delay (no inter-screen)
      console.log('Going to next round directly');
      setTimeout(() => {
        setCurrentRound(prev => prev + 1);
        setScreen('countdown');
        runCountdown();
      }, 1500); // 1.5 second delay to see result
    }
  };

  // Continue from inter-round (kept for backwards compatibility)
  const continueFromInter = () => {
    setCurrentRound(prev => prev + 1);
    setScreen('countdown');
    runCountdown();
  };

  // Complete battle - save results to server
  const completeBattle = async (latestResults?: RoundResult[]) => {
    if (!currentBattle || !user) return;
    
    // Use passed results if available (more accurate than state)
    const resultsToSubmit = latestResults || myResults;
    
    console.log(`Submitting battle results: ${resultsToSubmit.length} rounds`);
    // Count this battle as a play (intro auto-opens only for first-timers)
    incrementGamePlayCount("quizzbattle");
    
    // Format results for API
    const formattedResults = resultsToSubmit.map((r, i) => ({
      round: i,
      correct: r.correct,
      timeMs: r.timeMs,
      points: r.points,
      answerIndex: r.answerIndex
    }));
    
    // When playing against a bot, the bot (creator) never actually played on the server.
    // Send the locally-simulated bot results so the server can save them and determine
    // the winner correctly (otherwise both sides are 0 => false tie + refund).
    const creatorIsBot = !isCreator && (currentBattle.creator as any)?.isBot;
    const botResults = creatorIsBot
      ? opponentResultsRef.current.map((r, i) => ({
          round: i,
          correct: r.correct,
          timeMs: r.timeMs,
          points: r.points,
          answerIndex: r.answerIndex
        }))
      : undefined;
    
    try {
      const res = await fetch(`/api/battles/${currentBattle._id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: user.id,
          results: formattedResults,
          isCreator: isCreator,
          botResults
        })
      });
      
      const data = await res.json();
      
      if (isCreator) {
        // Creator finished - show success and go back to pool
        const challengedUser = currentBattle.challengedUser as any;
        const challengedName = challengedUser?.username || challengedUser;
        if (currentBattle.isPrivate && challengedName) {
          // Private challenge - show who was challenged
          showAlert('success', `Your answers are saved! 🎯 Waiting for ${challengedName} to accept your challenge.`);
        } else {
          // Public battle - generic message
          showAlert('success', 'Your answers are saved! 🎯 Now wait for an opponent to challenge you.');
        }
        setScreen('pool');
        setCurrentBattle(null);
        loadBattles();
      } else {
        // Opponent finished - battle is complete, show result.
        // Use refs (not stale state) to compute the authoritative outcome.
        // Winner = most correct answers; tie-break by fastest total time.
        const cmp = compareBattleResults(resultsToSubmit, opponentResultsRef.current);
        const won = cmp > 0;
        const isTie = cmp === 0;
        
        // Wager was already deducted when accepting.
        // Winner gets both wagers (2x), tie gets wager back, loser gets nothing.
        // Server handles the actual point changes - just trigger animation.
        const wagerChange = isTie ? toBOGX(currentBattle.wager) : (won ? toBOGX(currentBattle.wager) * 2 : 0);
        
        if (wagerChange > 0) {
          onCoinAnimation?.(wagerChange);
        }
        
        // Notify leaderboard/rankings to refresh instantly
        window.dispatchEvent(new CustomEvent('bogx-updated'));
      }
    } catch (error) {
      console.error('Failed to save battle result:', error);
      showAlert('error', 'Failed to save results. Please try again.');
    }
  };

  // Back to pool
  const backToPool = () => {
    setScreen('pool');
    setCurrentBattle(null);
    loadBattles();
  };

  // See results with animation (triggers win/loss animation)
  const seeResultsWithAnimation = () => {
    if (currentBattle) {
      // Winner = most correct answers; tie-break by fastest total time.
      const cmp = compareBattleResults(myResultsRef.current, opponentResultsRef.current);
      if (cmp < 0) {
        // User lost - trigger negative coin animation (wager already deducted, this is visual)
        onCoinAnimation?.(-toBOGX(currentBattle.wager));
      } else if (cmp > 0) {
        // User won - trigger positive coin animation (winnings)
        onCoinAnimation?.(toBOGX(currentBattle.wager) * 2);
      }
    }
    // Then show results
    nextRound(myResultsRef.current);
  };

  // Cancel own battle
  const handleCancelBattle = async (battleId: string) => {
    // Find the battle to get the wager amount for animation
    const battle = battles.find(b => b._id === battleId) || currentBattle;
    const wagerAmount = battle?.wager || 0.10; // Default to minimum wager if not found
    
    try {
      const res = await fetch(`/api/battles/${battleId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id })
      });
      
      const data = await res.json();
      if (data.success) {
        // Server refunds coins - use actual refunded amount from API
        const refundedAmount = data.refunded || wagerAmount;
        onCoinAnimation?.(refundedAmount);
        showAlert('success', `Battle cancelled. +${formatCurrency(refundedAmount)} coins refunded! 💰`);
        loadBattles();
      } else {
        showAlert('error', data.error || 'Failed to cancel battle');
      }
    } catch (error) {
      console.error('Cancel battle failed:', error);
      showAlert('error', 'Failed to cancel battle');
    }
  };

  // Get topic config
  const getTopicConfig = (topicId: string) => {
    return TOPICS.find(t => t.id === topicId) || TOPICS[0];
  };

  // All wagers are stored directly in BOGX coins (0.10, 0.25, 0.50, ...)
  const toBOGX = (wager: number) => wager;

  // Render based on screen
  const renderScreen = () => {
    switch (screen) {
      case 'setup':
        return renderSetupScreen();
      case 'pool':
        return renderPoolScreen();
      case 'intro':
        return renderIntroScreen();
      case 'countdown':
        return renderCountdownScreen();
      case 'quiz':
        return renderQuizScreen();
      case 'inter':
        return renderResultScreen(); // Unified screen for both inter-round and final result
      case 'result':
        return renderResultScreen();
      default:
        return renderSetupScreen();
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // SETUP SCREEN - Redesigned with online players indicator
  // ═══════════════════════════════════════════════════════════════
  const [onlinePlayers, setOnlinePlayers] = useState(0);
  const [onlineLoading, setOnlineLoading] = useState(true);
  const [selectedRounds, setSelectedRounds] = useState<3 | 5>(3);
  
  // Fetch online players count - real data only, no fake numbers
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

  const renderSetupScreen = () => (
    <div className="flex flex-col h-full min-h-full flex-1" style={{ backgroundColor: '#F5F0E8' }}>
      {/* Header - exact copy from ArcadePage */}
      <div className="px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#A855F7]/5 to-transparent">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-1 hover:bg-[#A855F7]/10 rounded transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
          )}
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">QuizzBattle</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">Challenge players, win their wager.</span>
          </div>
          {/* Open battles button - purple, opens modal like ArcadePage */}
          <button
            onClick={() => user?.id ? setShowOpenBattles(true) : onShowLogin?.()}
            className="battle-header-btn ml-auto relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#A855F7]/40 bg-[#A855F7]/10 hover:bg-[#A855F7]/20 transition-colors"
          >
            <Swords className="w-4 h-4 text-[#A855F7]" />
            <span className="text-xs font-bold text-[#A855F7]">Open Battles</span>
            {liveBattleCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] font-black shadow animate-pulse">
                {liveBattleCount > 9 ? '9+' : liveBattleCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: 'none' }}>
        {/* Hero Banner - in rounded box */}
        <div 
          className="relative overflow-hidden bg-cover bg-center rounded-2xl"
          style={{ backgroundImage: "url('/images/Hintergund/battle.png')", minHeight: '240px' }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          {/* Online Players Badge - top right of banner */}
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <div className="relative">
              <img src={user?.avatar || '/images/default-avatar.png'} alt="" className="w-5 h-5 rounded-full border-2 border-white" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white" />
            </div>
            {onlineLoading ? (
              <div className="w-4 h-3 bg-white/30 rounded animate-pulse" />
            ) : (
              <span className="text-xs font-bold text-white">{onlinePlayers.toLocaleString()}</span>
            )}
            <span className="text-[10px] text-white/80 uppercase">Online</span>
          </div>
          <div className="relative px-6 py-8">
            <span className="inline-block px-3 py-1 bg-[#A855F7] text-white font-bold uppercase tracking-wider rounded-full mb-4 text-[10px]">
              Multiplayer
            </span>
            <h2 className="font-display text-white leading-tight mb-2 text-2xl md:text-3xl">
              CHALLENGE PLAYERS<br/>
              <span className="text-[#A855F7]">WIN THEIR WAGER</span>
            </h2>
            <div className="flex items-center gap-2 mt-4 text-white/90 text-[10px]">
              <span className="flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-full"><Users className="w-3 h-3" /> 3 or 5 Rounds</span>
              <span className="flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-full"><Clock className="w-3 h-3" /> 10 Sec</span>
              <span className="flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-full"><Trophy className="w-3 h-3" /> High Score Wins</span>
            </div>
          </div>
        </div>

        {/* Start Button - centered */}
        <div className="flex justify-center mt-6">
          <button
            onClick={() => { incrementGamePlayCount("quizzbattle"); setScreen('pool'); }}
            className="px-20 py-4 rounded-2xl text-white font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #C084FC 0%, #A855F7 50%, #9333EA 100%)' }}
          >
            <Swords className="w-5 h-5" />
            START BATTLE
          </button>
        </div>

        {/* Fair Play */}
        <div className="flex items-center justify-center gap-3 mt-4 text-xs text-gray-500 pb-4">
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-green-500" />
            Fair play guaranteed
          </span>
          <span className="text-gray-400">•</span>
          <span className="flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5 text-[#A855F7]" />
            Winner takes 2x wager
          </span>
          <span className="text-gray-400">•</span>
          <span className="flex items-center gap-1">
            <RefreshCcw className="w-3.5 h-3.5 text-[#A855F7]" />
            Tie = coins back
          </span>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // POOL SCREEN
  // ═══════════════════════════════════════════════════════════════
  const renderPoolScreen = () => (
    <div className="relative flex flex-col h-full min-h-full overflow-hidden" style={{ backgroundColor: '#F5F0E8' }}>
      {/* Header - same style as Setup Screen */}
      <div className="px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#A855F7]/5 to-transparent">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-1 hover:bg-[#A855F7]/10 rounded transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
          )}
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">QuizzBattle</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">Challenge others, win coins.</span>
          </div>
          {/* Right side buttons */}
          <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              if (isOnBreak) {
                showAlert('info', 'Battles are disabled during the break (9:00-10:00).');
                return;
              }
              if (!isLoggedIn) {
                showAlert('login', 'Please login to invite friends!', {
                  buttonText: 'LOGIN',
                  onButtonClick: onShowLogin
                });
                return;
              }
              setShowChallengeModal(true);
            }}
            disabled={isOnBreak}
            className={`flex flex-col items-center px-2 py-1.5 border rounded-lg text-[10px] font-semibold tracking-wider transition-colors ${
              isOnBreak
                ? 'border-warm text-gray-300 cursor-not-allowed'
                : 'border-gray-300 text-gray-600 hover:border-[#A855F7] hover:text-[#A855F7]'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>INVITE</span>
          </button>
          <button
            onClick={() => {
              if (isOnBreak) {
                showAlert('info', 'Battles are disabled during the break (9:00-10:00).');
                return;
              }
              if (!isLoggedIn) {
                showAlert('login', 'Please login to create battles!', {
                  buttonText: 'LOGIN',
                  onButtonClick: onShowLogin
                });
                return;
              }
              // Pre-select the current topic filter when opening create panel
              if (!showCreate && topicFilter !== 'all') {
                setCreateTopic(topicFilter);
              }
              setShowCreate(!showCreate);
            }}
            disabled={isOnBreak}
            className={`flex flex-col items-center px-2 py-1.5 rounded-lg text-[10px] font-semibold tracking-wider transition-colors ${
              isOnBreak
                ? 'bg-skeleton-light text-gray-600 cursor-not-allowed'
                : 'bg-[#A855F7] text-white hover:bg-[#9333EA]'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>CREATE</span>
          </button>
          </div>
        </div>
      </div>

      {/* Topic Filter */}
      <div className="flex items-center gap-1 px-2 py-3 border-b border-warm">
        {/* Scrollable Topics */}
        <div 
          ref={topicScrollRef}
          className="flex gap-2 overflow-x-auto flex-1" 
          style={{ scrollbarWidth: 'none' }}
        >
          <button
            onClick={() => setTopicFilter('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all border ${
              topicFilter === 'all' ? 'bg-[#A855F7] text-white border-[#A855F7]' : 'bg-cream text-gray-700 hover:bg-[#A855F7]/10 border-warm'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="text-xs font-semibold">All</span>
          </button>
          {TOPICS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTopicFilter(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all border ${
                  topicFilter === t.id ? 'bg-[#A855F7] text-white border-[#A855F7]' : 'bg-cream text-gray-700 hover:bg-[#A855F7]/10 border-warm'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs font-semibold">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Wager Filter Buttons */}
      <div className="min-w-0 w-full overflow-hidden border-b border-warm">
        <div className="flex gap-2 px-3 py-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setWagerFilter('all')}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
              wagerFilter === 'all' ? 'bg-[#A855F7] text-white border-[#A855F7]' : 'bg-cream text-gray-700 hover:bg-[#A855F7]/10 border-warm'
            }`}
          >
            <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
            All
          </button>
          {WAGERS.map(w => (
            <button
              key={w.amount}
              onClick={() => setWagerFilter(w.amount)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                wagerFilter === w.amount ? 'bg-[#A855F7] text-white border-[#A855F7]' : 'bg-cream text-gray-700 hover:bg-[#A855F7]/10 border-warm'
              }`}
            >
              <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
              {formatCurrency(w.amount)}
            </button>
          ))}
        </div>
      </div>
      
      {/* Create Battle Fullscreen */}
      {showCreate && (
        <div className="absolute inset-0 z-[100] overflow-y-auto" style={{ backgroundColor: '#F5F0E8', scrollbarWidth: 'none' }}>
          {/* Header - same height as QuizzBattle header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-3 pt-4 pb-3 border-b border-warm bg-[#F5F0E8]">
            <div className="flex items-center gap-2">
              <BackButton onClick={() => setShowCreate(false)} className="-ml-1" />
              <img src="/images/Icon/trivia1.png" alt="" className="w-5 h-5 object-contain" />
              <div>
                <span className="font-display text-lg tracking-wider text-gray-900">Create Battle</span>
                <p className="text-[10px] text-gray-500 -mt-0.5 whitespace-nowrap">Set wager and topic.</p>
              </div>
            </div>
            {/* Invisible placeholder to match pool header height */}
            <div className="flex items-center gap-2 flex-shrink-0 opacity-0 pointer-events-none">
              <div className="flex flex-col items-center px-2 py-1.5">
                <Swords className="w-3.5 h-3.5" />
                <span className="text-[10px]">INVITE</span>
              </div>
              <div className="flex flex-col items-center px-2 py-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span className="text-[10px]">CREATE</span>
              </div>
            </div>
          </div>
          
          <div className="p-4">
            {/* Step 1: Wager */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 bg-[#A855F7] rounded text-white text-xs font-bold flex items-center justify-center">1</span>
                <span className="text-sm font-semibold tracking-wider text-[#A855F7] uppercase">Choose Wager</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {WAGERS.map(w => (
                  <button
                    key={w.amount}
                    onClick={() => setCreateWager(w.amount)}
                    className={`py-3 text-center rounded-xl transition-colors ${
                      createWager === w.amount
                        ? 'bg-[#A855F7] text-white'
                        : 'bg-cream border border-warm text-gray-600'
                    }`}
                  >
                    <div className="font-display text-lg">{formatCurrency(w.amount)}{getCurrencySymbol()}</div>
                    <div className="text-[9px] text-current opacity-60">{w.rounds}R</div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Step 2: Topic */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 bg-[#A855F7] rounded text-white text-xs font-bold flex items-center justify-center">2</span>
                <span className="text-sm font-semibold tracking-wider text-[#A855F7] uppercase">Choose Topic</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {TOPICS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setCreateTopic(t.id)}
                    className={`py-3 text-sm font-semibold tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2 ${
                      createTopic === t.id
                        ? 'bg-[#A855F7] text-white'
                        : 'bg-cream border border-warm text-gray-600'
                    }`}
                  >
                    <t.icon className="w-4 h-4" /> {t.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Step 3: Battle Type */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 bg-[#A855F7] rounded text-white text-xs font-bold flex items-center justify-center">3</span>
                <span className="text-sm font-semibold tracking-wider text-[#A855F7] uppercase">Start Battle</span>
              </div>
              <button
                onClick={() => handleCreateBattle(false)}
                disabled={isGenerating}
                className={`w-full py-4 rounded-xl font-display text-base tracking-widest flex items-center justify-center gap-2 ${
                  isGenerating 
                    ? 'bg-[#A855F7]/50 text-white/50 cursor-wait' 
                    : 'bg-[#A855F7] text-white'
                }`}
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    GENERATING...
                  </>
                ) : (
                  <>
                    <Swords className="w-5 h-5" />
                    OPEN BATTLE
                  </>
                )}
              </button>
              <p className="text-center text-gray-600 text-xs mt-2">Anyone can accept your challenge</p>
            </div>
          </div>
        </div>
      )}


      {/* Battle List */}
      <div className={`flex-1 overflow-y-auto overflow-x-hidden p-4 ${isDesktop ? 'grid grid-cols-3 gap-3 auto-rows-max' : 'space-y-2'}`} style={{ scrollbarWidth: 'none' }}>
        {loading ? (
          // Skeleton Loading
          <>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className={`p-4 bg-cream border border-warm rounded-xl animate-pulse ${isDesktop ? '' : 'mb-2'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-skeleton" />
                  <div className="flex-1">
                    <div className="w-24 h-4 bg-skeleton rounded mb-1" />
                    <div className="w-16 h-3 bg-skeleton-light rounded" />
                  </div>
                  <div className="w-16 h-6 bg-skeleton rounded" />
                </div>
                <div className="flex gap-2">
                  <div className="w-20 h-6 bg-skeleton-light rounded" />
                  <div className="w-16 h-6 bg-skeleton-light rounded" />
                </div>
              </div>
            ))}
          </>
        ) : isOnBreak ? (
          <div className={`flex flex-col items-center justify-center h-full px-4 ${isDesktop ? 'col-span-3' : ''}`}>
            <div className="flex items-center gap-3 mb-6">
              <img src="/images/coffee-break.svg" alt="" className="w-10 h-10" />
              <div>
                <p className="font-display text-xl tracking-wider text-[#A855F7]">DAILY BREAK</p>
                <p className="text-gray-500 text-xs">9:00 - 10:00 AM</p>
              </div>
            </div>
            
            <p className="text-gray-600 text-sm mb-4">Relax! We're preparing the next round.</p>
            
            <div className="flex items-center gap-2 text-[#A855F7] text-sm animate-pulse">
              <span>⚡</span>
              <span>Back at 10:00 AM</span>
            </div>
          </div>
        ) : filteredBattles.length === 0 ? (
            <div className={`flex flex-col items-center justify-center py-16 px-4 ${isDesktop ? 'col-span-3' : ''}`}>
              <Swords className="w-16 h-16 text-gray-200 mb-4" />
              <p className="text-gray-500 text-lg font-semibold mb-2">No open battles</p>
              <p className="text-gray-600 text-sm text-center mb-6">Be the first to create a challenge!</p>
              <div className="flex gap-2">
                <button
                  onClick={() => loadBattles()}
                  className="px-3 py-2 bg-cream border border-warm text-gray-600 text-sm font-semibold hover:bg-skeleton-light transition-colors flex items-center gap-2 rounded-lg"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    if (!isLoggedIn) {
                      showAlert('login', 'Please login to invite friends!', {
                        buttonText: 'LOGIN',
                        onButtonClick: onShowLogin
                      });
                      return;
                    }
                    setShowChallengeModal(true);
                  }}
                  className="px-3 py-2 border border-gray-300 text-gray-700 text-sm font-semibold hover:border-[#A855F7] hover:text-[#A855F7] transition-colors rounded-lg"
                >
                  ⚔️ Invite
                </button>
                <button
                  onClick={() => {
                    if (!isLoggedIn) {
                      showAlert('login', 'Please login to create battles!', {
                        buttonText: 'LOGIN',
                        onButtonClick: onShowLogin
                      });
                      return;
                    }
                    // Pre-select the current topic filter when opening create panel
                    if (topicFilter !== 'all') {
                      setCreateTopic(topicFilter);
                    }
                    setShowCreate(true);
                  }}
                  className="px-3 py-2 bg-[#A855F7] text-white text-sm font-semibold hover:bg-[#9333EA] transition-colors flex items-center gap-1 rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                  Create
                </button>
              </div>
            </div>
        ) : (
          filteredBattles.map((battle: Battle) => {
            const topic = getTopicConfig(battle.topic);
            const isMyBattle = battle.creator._id === user?.id;
            const creatorCoins = (battle.creator as any).bogxCoins || 0;
            const creatorRank = (battle.creator as any).rank || '-';
            
            // Format created time
            const createdDate = new Date(battle.createdAt);
            const now = new Date();
            const diffMs = now.getTime() - createdDate.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);
            let timeAgo = '';
            if (diffMins < 1) timeAgo = 'just now';
            else if (diffMins < 60) timeAgo = `${diffMins}m ago`;
            else if (diffHours < 24) timeAgo = `${diffHours}h ago`;
            else timeAgo = `${diffDays}d ago`;
            
            // Format full date
            const fullDate = createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const fullTime = createdDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            
            return isDesktop ? (
              <div
                key={battle._id}
                onClick={() => isMyBattle ? setSelectedOwnBattle(battle) : setQuickPreviewBattle(battle)}
                className={`group p-5 border-2 rounded-2xl cursor-pointer transform transition-all duration-300 ease-out hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl ${
                  isMyBattle 
                    ? 'border-[#A855F7]/40 bg-[#A855F7]/5 hover:bg-[#A855F7]/10 hover:border-[#A855F7] hover:shadow-[#A855F7]/20' 
                    : 'border-warm bg-cream hover:border-[#A855F7] hover:shadow-[#A855F7]/15'
                }`}
              >
                {/* Top Row: Avatar + Name */}
                <div className="flex items-start gap-4">
                  <div className="relative flex-shrink-0">
                    <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-[#A855F7]/30 group-hover:border-[#A855F7] transition-colors duration-300">
                      <img src={battle.creator.avatar} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <div className="absolute -bottom-1 left-0">
                      <CountryFlag flag={battle.creator.countryFlag} className="w-7 h-5 rounded shadow-sm" />
                    </div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-cream animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0 pt-2">
                    <div className="font-display text-2xl text-gray-900 tracking-wide leading-tight group-hover:text-[#A855F7] transition-colors duration-200">{battle.creator.username}</div>
                    <div className="text-sm text-gray-500 flex items-center gap-2">
                      <span>Rank #{creatorRank}</span>
                      <span className="flex items-center gap-1">
                        <img src="/images/bogxcoin.png" alt="" className="w-3.5 h-3.5 group-hover:animate-bounce" />
                        {formatCurrency(creatorCoins)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Middle Row: Rounds + Time + Wager */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-warm group-hover:border-[#A855F7]/30 transition-colors duration-300">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#A855F7]" />
                    <span className="font-bold text-gray-900">{battle.rounds}</span>
                    <span className="text-gray-500 text-sm">Rounds</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-xl text-[#A855F7] group-hover:scale-110 transition-transform duration-200">{formatCurrency(toBOGX(battle.wager))}</span>
                    <img src="/images/bogxcoin.png" alt="BOGX" className="w-5 h-5 group-hover:rotate-12 transition-transform duration-200" />
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#A855F7] group-hover:translate-x-1 transition-all duration-200" />
                  </div>
                </div>
                
                {/* Topic Badge Row */}
                <div className="flex items-center gap-3 mt-3">
                  <span 
                    className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-white group-hover:scale-105 transition-transform duration-200"
                    style={{ backgroundColor: topic.color }}
                  >
                    {topic.icon && <topic.icon className="w-3 h-3" />}
                    {topic.label}
                  </span>
                  {isMyBattle && (
                    <>
                      <span className="text-[10px] font-bold tracking-wider text-[#A855F7] bg-[#A855F7]/10 px-2.5 py-1.5 rounded-lg animate-pulse">
                        YOUR BATTLE
                      </span>
                      {battle.isPrivate && (
                        <span className="text-[10px] font-bold tracking-wider text-purple-600 bg-purple-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1">
                          <Lock className="w-3 h-3" /> PRIVATE
                        </span>
                      )}
                    </>
                  )}
                </div>
                
                {/* Date/Time Footer */}
                <div className="mt-3 pt-3 border-t border-warm group-hover:border-[#A855F7]/30 transition-colors duration-300 flex items-center gap-2 text-gray-400 text-xs">
                  <Clock className="w-3.5 h-3.5 group-hover:animate-spin" style={{ animationDuration: '3s' }} />
                  <span>{fullDate} • {fullTime}</span>
                </div>
              </div>
            ) : (
              /* Mobile Card - Original compact design */
              <div
                key={battle._id}
                onClick={() => isMyBattle ? setSelectedOwnBattle(battle) : setQuickPreviewBattle(battle)}
                className={`p-4 border-2 rounded-2xl transition-all cursor-pointer ${
                  isMyBattle 
                    ? 'border-[#A855F7]/40 bg-[#A855F7]/5 hover:bg-[#A855F7]/10' 
                    : 'border-warm bg-cream hover:border-[#A855F7]/30 hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#A855F7]/30">
                      <img src={battle.creator.avatar} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-cream" />
                    <div className="absolute -bottom-1 -left-1">
                      <CountryFlag flag={battle.creator.countryFlag} className="w-5 h-4 rounded-sm shadow-sm" />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-xl font-display text-gray-900 leading-tight tracking-wide">{battle.creator.username}</div>
                    <div className="text-[11px] text-gray-500 leading-tight flex items-center gap-2">
                      <span>Rank #{creatorRank}</span>
                      <span className="flex items-center gap-0.5">
                        <img src="/images/bogxcoin.png" alt="" className="w-3 h-3" />
                        {formatCurrency(creatorCoins)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span 
                        className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded flex items-center gap-1 text-white"
                        style={{ backgroundColor: topic.color }}
                      >
                        {topic.icon && <topic.icon className="w-2.5 h-2.5" />}
                        {topic.label}
                      </span>
                      <span className="text-[10px] text-gray-400">· {battle.rounds} Rounds</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="font-display text-xl text-[#A855F7]">{formatCurrency(toBOGX(battle.wager))}</span>
                    <img src="/images/bogxcoin.png" alt="BOGX" className="w-5 h-5" />
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                  </div>
                </div>
                
                {isMyBattle && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#A855F7]/20">
                    {battle.isPrivate && (
                      <span className="text-[10px] font-bold tracking-wider text-purple-600 bg-purple-100 px-2 py-1 rounded-lg flex items-center gap-1">
                        <Lock className="w-3 h-3" /> PRIVATE
                      </span>
                    )}
                    <span className="text-[10px] font-bold tracking-wider text-[#A855F7] bg-[#A855F7]/10 px-2 py-1 rounded-lg">
                      YOUR BATTLE
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // INTRO SCREEN
  // ═══════════════════════════════════════════════════════════════
  const renderIntroScreen = () => {
    // Show loading state while battle is being fetched (e.g. from pendingBattleId)
    if (!currentBattle) {
      return (
        <div className="flex flex-col h-full bg-cream items-center justify-center">
          <LogoLoader />
          <p className="text-gray-500 text-sm mt-4">Loading battle...</p>
        </div>
      );
    }
    const topic = getTopicConfig(currentBattle.topic);
    const potAmount = toBOGX(currentBattle.wager) * 2;
    
    return (
      <div className="flex flex-col h-full bg-cream">
        {/* Header - same style as Pool Screen */}
        <div className="px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#A855F7]/5 to-transparent">
          <div className="flex items-center gap-3">
            <button onClick={backToPool} className="p-1 hover:bg-[#A855F7]/10 rounded transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">QuizzBattle</span>
              <span className="text-[10px] text-gray-500 -mt-0.5 block">Challenge players, win their wager.</span>
            </div>
          </div>
        </div>

        {/* Battle Background Image - same as Setup Screen */}
        <div 
          className="relative bg-cover bg-center battle-vs-banner"
          style={{ backgroundImage: "url('/images/Hintergund/battle.png')" }}
        >
          {/* Dark overlay for better text contrast */}
          <div className="absolute inset-0 bg-black/40" />
          {/* VS Section */}
          <div className="relative px-4 py-4">
            {/* VS Row */}
            <div className="relative flex items-start justify-between">
              {/* You */}
              <div className="flex flex-col items-center">
                <div className="relative mb-1">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-lg battle-vs-avatar">
                    <img src={user?.avatar || 'https://i.pravatar.cc/80?img=47'} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 drop-shadow-lg"><CountryFlag flag={user?.countryFlag || 'DE'} className="w-6 h-5 rounded-sm" /></div>
                </div>
                <div className="font-display text-base tracking-wider uppercase text-white battle-vs-name">You</div>
                <div className="px-2 py-0.5 bg-white/30 backdrop-blur-sm rounded text-[10px] text-white font-bold battle-vs-rank">RANK #22</div>
              </div>

              {/* VS + POT in center */}
              <div className="flex flex-col items-center justify-center">
                <div className="text-white/80 text-xs uppercase tracking-widest font-semibold mb-1">WIN THE POT</div>
                <div className="flex items-center gap-2 mb-1">
                  <img src="/images/bogxcoin.png" alt="BOGX" className="w-8 h-8" />
                  <span className="font-display text-4xl text-white battle-vs-pot drop-shadow-lg">{formatCurrency(potAmount)}</span>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 mt-2">
                  <div className="text-white text-xs font-semibold flex items-center gap-3">
                    <span>{formatCurrency(toBOGX(currentBattle.wager))} from you</span>
                    <span className="text-white/50">+</span>
                    <span>{formatCurrency(toBOGX(currentBattle.wager))} from opponent</span>
                  </div>
                </div>
              </div>

              {/* Opponent */}
              <div className="flex flex-col items-center">
                <div className="relative mb-1">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white/50 shadow-lg battle-vs-avatar">
                    <img src={currentBattle.creator.avatar} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 drop-shadow-lg"><CountryFlag flag={currentBattle.creator.countryFlag} className="w-6 h-5 rounded-sm" /></div>
                </div>
                <div className="font-display text-base tracking-wider uppercase text-white battle-vs-name">{currentBattle.creator.username}</div>
                <div className="px-2 py-0.5 bg-white/20 rounded text-[10px] text-white font-bold battle-vs-rank">RANK #5</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pt-3">
          {/* Topic Banner */}
          <div className="flex items-center gap-3 bg-cream border border-warm rounded-xl p-3 mb-3 shadow-sm battle-topic-banner">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#A855F7] to-[#7C3AED] flex items-center justify-center flex-shrink-0 battle-topic-image">
              <topic.icon className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="font-display text-lg tracking-wider text-gray-900 uppercase">{topic.label} Trivia</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><HelpCircle className="w-3.5 h-3.5" /> <span className="font-bold text-gray-900">{currentBattle.rounds}</span> Rounds</span>
                <span className="flex items-center gap-1"><Coins className="w-3.5 h-3.5" /> <span className="font-bold text-[#A855F7]">{formatCurrency(potAmount)}</span> Pot</span>
                <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> Rank <span className="font-bold text-gray-900">#5</span></span>
              </div>
            </div>
          </div>

          {/* Rules */}
          <div className="bg-[#A855F7]/5 border border-[#A855F7]/10 rounded-xl p-3 mb-3">
            <div className="flex items-center gap-2 text-gray-700 text-sm mb-2">
              <div className="w-6 h-6 bg-[#A855F7]/20 rounded flex items-center justify-center">
                <Coins className="w-3.5 h-3.5 text-[#A855F7]" />
              </div>
              <span>Your wager is <span className="font-bold">locked</span> until the battle ends.</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700 text-sm">
              <div className="w-6 h-6 bg-[#A855F7]/20 rounded flex items-center justify-center">
                <Trophy className="w-3.5 h-3.5 text-[#A855F7]" />
              </div>
              <span className="font-bold">Winner takes the full pot.</span>
            </div>
          </div>

          {/* Accept Button */}
          <button
            onClick={() => {
              if (!user) {
                onShowLogin?.();
                return;
              }
              startBattle();
            }}
            className="w-full py-3 bg-[#A855F7] hover:bg-[#9333EA] text-white font-display text-sm tracking-widest flex flex-col items-center justify-center rounded-xl shadow-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4" />
              {user ? 'START BATTLE' : 'LOGIN TO BATTLE'}
            </div>
            <span className="text-[10px] text-white/70 font-normal">ENTRY: {formatCurrency(toBOGX(currentBattle.wager))} BOGX</span>
          </button>
          
          {/* Decline Button - only for private challenges */}
          {currentBattle.isPrivate && currentBattle.challengedUser === user?.id && (
            <button
              onClick={handleDeclineChallenge}
              className="w-full py-2 mt-2 text-red-400 font-display text-xs tracking-widest hover:text-red-300 transition-colors"
            >
              DECLINE CHALLENGE
            </button>
          )}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // COUNTDOWN SCREEN - Card style like Reel Quiz
  // ═══════════════════════════════════════════════════════════════
  const renderCountdownScreen = () => {
    if (!currentBattle) return null;
    const question = currentBattle.questions[currentRound];
    const topic = getTopicConfig(currentBattle.topic);
    
    return (
      <div className="flex flex-col h-full p-4 bg-cream">
        {/* Card Container - same style as Reel Quiz */}
        <div className="flex-1 border border-warm bg-cream rounded-xl flex flex-col p-5 shadow-sm">
          
          {/* Header: Players + Progress */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full overflow-hidden border-2 border-[#E36B11]">
                <img src={user?.avatar || 'https://i.pravatar.cc/80?img=47'} alt="" className="w-full h-full object-cover" />
              </div>
              <span className="text-xs font-semibold text-gray-900">You</span>
            </div>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: currentBattle.rounds }).map((_, i) => {
                let color = 'bg-skeleton';
                if (i < myResults.length) {
                  color = myResults[i].correct ? 'bg-[#E36B11]' : 'bg-red-500';
                } else if (i === currentRound) {
                  color = 'bg-[#E36B11]/50';
                }
                return <div key={i} className={`w-4 h-1 rounded ${color}`} />;
              })}
            </div>
            <div className="flex items-center gap-2 flex-row-reverse">
              {isCreator ? (
                <>
                  <div className="w-6 h-6 rounded-full border-2 border-warm bg-cream flex items-center justify-center">
                    <span className="text-gray-600 text-[10px] font-bold">?</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-600">???</span>
                </>
              ) : (
                <>
                  <div className="w-6 h-6 rounded-full overflow-hidden border-2 border-warm">
                    <img src={currentBattle.creator.avatar} alt="" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-xs font-semibold text-gray-900">{currentBattle.creator.username}</span>
                </>
              )}
            </div>
          </div>

          {/* Topic Badge */}
          <div className="mb-4">
            <span className="px-2 py-0.5 bg-cream border border-warm rounded text-[10px] text-gray-600 uppercase tracking-wider">
              <topic.icon className="w-3 h-3 inline" /> {topic.label} · Round {currentRound + 1}/{currentBattle.rounds}
            </span>
          </div>

          {/* Timer Row - same height as quiz screen timer row */}
          <div className="flex items-center justify-between gap-2 mb-4 h-[44px]">
            <div className="flex items-center gap-1">
              <div 
                key={countdown} 
                className="w-11 h-11 border-2 border-[#E36B11] bg-[#E36B11]/10 rounded-lg flex items-center justify-center"
              >
                <span className="font-display text-2xl text-gray-900">
                  {countdown === 0 ? 'GO' : countdown}
                </span>
              </div>
              <span className="text-gray-600 text-[10px]">SEC</span>
            </div>
            <div className="flex-1 px-1">
              <div className="flex gap-0.5">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="h-4 flex-1 rounded bg-skeleton" />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-display text-2xl text-gray-900">0,30</span>
              <img src="/images/bogxcoin.png" alt="BOGX" className="w-5 h-5" />
            </div>
          </div>

          {/* Question Container - same size as quiz screen */}
          <div className="border border-warm bg-cream rounded-xl px-4 py-4 mb-4 flex items-center justify-center min-h-[100px]">
            <h2 className="text-gray-900 text-base font-bold text-center leading-snug">
              {question?.question}
            </h2>
          </div>

          {/* Placeholder Answers - same size as quiz screen buttons */}
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="px-2 py-3 min-h-[64px] bg-cream border border-warm rounded-lg flex items-center justify-center">
                <span className="text-gray-300 text-sm">···</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // QUIZ SCREEN - Card style like Reel Quiz
  // ═══════════════════════════════════════════════════════════════
  const renderQuizScreen = () => {
    if (!currentBattle) return null;
    const question = currentBattle.questions[currentRound];
    const topic = getTopicConfig(currentBattle.topic);
    const timeSeconds = Math.ceil(timeLeft / 1000);
    const timePct = timeLeft / 10000;
    const filledSegments = Math.round(timePct * 10);
    
    return (
      <div className="flex flex-col h-full p-4 bg-cream">
        {/* Card Container */}
        <div className="flex-1 border border-warm bg-cream rounded-xl flex flex-col p-5 shadow-sm">
          
          {/* Header: Players + Progress */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full overflow-hidden border-2 border-[#E36B11]">
                <img src={user?.avatar || 'https://i.pravatar.cc/80?img=47'} alt="" className="w-full h-full object-cover" />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-900">You</span>
                <div className="font-display text-sm text-gray-900">{formatCurrency(myTotalPoints)}</div>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: currentBattle.rounds }).map((_, i) => {
                let color = 'bg-skeleton';
                if (i < myResults.length) {
                  color = myResults[i].correct ? 'bg-[#E36B11]' : 'bg-red-500';
                } else if (i === currentRound) {
                  color = 'bg-[#E36B11]/50';
                }
                return <div key={i} className={`w-4 h-1 rounded ${color}`} />;
              })}
            </div>
            <div className="flex items-center gap-2 flex-row-reverse">
              {isCreator ? (
                <>
                  <div className="w-6 h-6 rounded-full border-2 border-warm bg-cream flex items-center justify-center">
                    <span className="text-gray-600 text-[10px] font-bold">?</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-gray-600">???</span>
                    <div className="font-display text-sm text-gray-300">?</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-6 h-6 rounded-full overflow-hidden border-2 border-warm">
                    <img src={currentBattle.creator.avatar} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-gray-900">{currentBattle.creator.username}</span>
                    <div className="font-display text-sm text-gray-600">{formatCurrency(opponentTotalPoints)}</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Topic Badge */}
          <div className="mb-3">
            <span className="px-2 py-0.5 bg-cream border border-warm rounded text-[10px] text-gray-600 uppercase tracking-wider">
              <topic.icon className="w-3 h-3 inline" /> {topic.label} · Round {currentRound + 1}/{currentBattle.rounds}
            </span>
          </div>

          {/* Timer Row with LED segments - color transitions from gold to red */}
          {(() => {
            // Calculate color based on time remaining (gold -> orange -> red)
            const timerColor = timePct > 0.5 
              ? '#E36B11' // Gold when > 50%
              : timePct > 0.25 
                ? '#E05A00' // Orange when 25-50%
                : '#DC2626'; // Red when < 25%
            return (
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
            );
          })()}

          {/* Question Container - fixed height to prevent jumping */}
          <div className="border border-warm bg-cream rounded-xl px-4 py-4 mb-4 flex items-center justify-center min-h-[100px]">
            <h2 className="text-gray-900 text-base font-bold text-center leading-snug">
              {question?.question}
            </h2>
          </div>

          {/* Answers - fixed height buttons for consistency (2 lines) */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {question?.answers.map((answer, i) => {
              let className = 'px-2 py-3 min-h-[64px] text-sm font-bold flex items-center justify-center text-center transition-all rounded-lg';
              
              if (showAnswer) {
                if (i === question.correctIndex) {
                  className += ' bg-[#E36B11] text-white border-2 border-[#E36B11]';
                } else if (i === selectedAnswer && !myResults[currentRound]?.correct) {
                  className += ' bg-red-500 text-white border-2 border-red-500';
                } else {
                  className += ' bg-cream border border-warm text-gray-600';
                }
              } else {
                className += ' bg-cream text-gray-900 border border-warm hover:bg-cream hover:border-gray-300 cursor-pointer';
              }
              
              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={showAnswer}
                  className={className}
                >
                  <span className="line-clamp-2">{answer}</span>
                </button>
              );
            })}
          </div>

          {/* Result Banner + Next Button - 2 column grid, always visible */}
          <div className="grid grid-cols-2 gap-2 mt-auto">
            {/* Result Banner - always rendered, visibility controlled by opacity */}
            <div className={`py-4 px-4 rounded-xl flex items-center justify-center gap-2 transition-opacity ${
              showAnswer ? 'opacity-100' : 'opacity-0'
            } ${
              selectedAnswer === -1 
                ? 'bg-red-500' 
                : myResults[currentRound]?.correct 
                  ? 'bg-[#E36B11]' 
                  : 'bg-red-500'
            }`}>
              {selectedAnswer === -1 ? (
                <>
                  <Clock className="w-5 h-5 text-white" />
                  <span className="font-display text-base tracking-wider text-white">TIME'S UP!</span>
                </>
              ) : myResults[currentRound]?.correct ? (
                <>
                  <Check className="w-5 h-5 text-white" />
                  <span className="font-display text-base tracking-wider text-white">+{formatCurrency(myResults[currentRound]?.points || 0)}</span>
                  <img src="/images/bogxcoin.png" alt="BOGX" className="w-5 h-5" />
                </>
              ) : (
                <>
                  <X className="w-5 h-5 text-white" />
                  <span className="font-display text-base tracking-wider text-white">WRONG!</span>
                </>
              )}
            </div>
            {/* Next Button - always rendered, visibility controlled by opacity */}
            <button
              onClick={() => showAnswer ? (currentRound < currentBattle.rounds - 1 ? continueFromInter() : (isCreator ? completeBattle(myResultsRef.current) : seeResultsWithAnimation())) : null}
              disabled={!showAnswer}
              className={`py-4 bg-[#E36B11] text-white font-display tracking-widest rounded-xl flex items-center justify-center gap-2 transition-opacity ${
                showAnswer ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {currentRound < currentBattle.rounds - 1 ? 'NEXT →' : (isCreator ? 'SUBMIT ✓' : 'RESULTS')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // RESULT/INTER SCREEN - Unified for both mid-game and final results
  // ═══════════════════════════════════════════════════════════════
  const renderResultScreen = () => {
    if (!currentBattle) return null;
    const topic = getTopicConfig(currentBattle.topic);
    const isComplete = myResults.length >= currentBattle.rounds;
    // Winner = most correct answers; tie-break by fastest total time.
    const cmp = compareBattleResults(myResults, opponentResults);
    const won = cmp > 0;
    const leading = cmp >= 0;
    const diff = Math.abs(myTotalPoints - opponentTotalPoints);
    const myCorrect = myResults.filter(r => r.correct).length;
    const oppCorrect = opponentResults.filter(r => r.correct).length;
    
    return (
      <div className="flex flex-col h-full p-4 bg-cream">
        {/* Card Container */}
        <div className="flex-1 border border-warm bg-cream rounded-xl flex flex-col p-5 overflow-y-auto shadow-sm">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="px-2 py-0.5 bg-cream border border-warm rounded text-[10px] text-gray-600 uppercase tracking-wider">
              <topic.icon className="w-3 h-3 inline" /> {topic.label}
            </span>
            <span className="text-[10px] text-gray-600 uppercase tracking-wider">
              {isComplete ? 'Battle Complete' : `After Round ${myResults.length}`}
            </span>
          </div>

          {/* Result/Status */}
          <div className="text-center mb-6">
            {isComplete ? (
              <>
                <div 
                  className="font-display text-4xl tracking-wider mb-1"
                  style={{ color: won ? '#22c55e' : '#ef4444' }}
                >
                  {won ? 'YOU WIN!' : 'YOU LOSE'}
                </div>
                <div 
                  className="font-display text-lg tracking-wider flex items-center gap-1"
                  style={{ color: won ? '#22c55e' : '#ef4444' }}
                >
                  {won ? '+' : '-'}{formatCurrency(toBOGX(currentBattle.wager))} <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                </div>
              </>
            ) : (
              <>
                <div 
                  className="font-display text-4xl tracking-wider mb-1 text-gray-900"
                >
                  ROUND {myResults.length} DONE!
                </div>
                <div className="text-sm text-gray-500">
                  Your score: {formatCurrency(myTotalPoints)} {getCurrencySymbol()}
                </div>
              </>
            )}
          </div>

          {/* Players - Only show full details when battle is complete */}
          {isComplete ? (
            <div className="border border-warm rounded-xl bg-cream mb-4">
              <div className="flex items-center gap-3 p-3 border-b border-warm">
                <div className={`w-8 h-8 rounded-full overflow-hidden border-2 ${leading ? 'border-[#E36B11]' : 'border-warm'}`}>
                  <img src={user?.avatar} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900">{won ? '👑 ' : ''}You</div>
                  <div className="text-[10px] text-gray-400">{formatCurrency(myTotalPoints)} BOGX</div>
                </div>
                <div className="text-right">
                  <div className={`font-display text-2xl leading-none ${leading ? 'text-green-600' : 'text-gray-400'}`}>
                    {myCorrect}<span className="text-sm text-gray-400">/{myResults.length}</span>
                  </div>
                  <div className="text-[8px] uppercase tracking-widest text-gray-400 font-semibold">Correct</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3">
                {isCreator ? (
                  <>
                    <div className="w-8 h-8 rounded-full border-2 border-warm bg-cream flex items-center justify-center">
                      <span className="text-gray-600 font-bold">?</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-600">Waiting for opponent...</div>
                      <div className="text-[10px] text-gray-300">? BOGX</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-2xl leading-none text-gray-300">?<span className="text-sm">/?</span></div>
                      <div className="text-[8px] uppercase tracking-widest text-gray-300 font-semibold">Correct</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={`w-8 h-8 rounded-full overflow-hidden border-2 ${!leading ? 'border-[#E36B11]' : 'border-warm'}`}>
                      <img src={currentBattle.creator.avatar} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900">{!won ? '👑 ' : ''}{currentBattle.creator.username}</div>
                      <div className="text-[10px] text-gray-400">{formatCurrency(opponentTotalPoints)} BOGX</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-display text-2xl leading-none ${!leading ? 'text-green-600' : 'text-gray-400'}`}>
                        {oppCorrect}<span className="text-sm text-gray-400">/{opponentResults.length}</span>
                      </div>
                      <div className="text-[8px] uppercase tracking-widest text-gray-400 font-semibold">Correct</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            // During game - only show own progress
            <div className="border border-warm rounded-xl bg-cream mb-4 p-4 text-center">
              <div className="text-gray-500 text-sm mb-2">Your Progress</div>
              <div className="font-display text-3xl text-gray-900 mb-1">{formatCurrency(myTotalPoints)} {getCurrencySymbol()}</div>
              <div className="text-gray-600 text-xs">{myCorrect}/{myResults.length} correct</div>
            </div>
          )}

          {/* Round by Round Scoreboard - Only show when battle is complete */}
          {isComplete && (
            <div className="mb-4">
              <div className="text-[9px] font-semibold tracking-widest text-gray-600 uppercase mb-2">
                Round by Round
              </div>
              <table className="w-full border border-warm bg-cream rounded-lg text-sm overflow-hidden">
                <thead>
                  <tr className="bg-cream">
                    <th className="p-2 text-left text-[9px] font-semibold tracking-wider text-gray-600"></th>
                    {Array.from({ length: currentBattle.rounds }).map((_, i) => (
                      <th key={i} className={`p-2 text-center text-[9px] font-semibold tracking-wider ${i < myResults.length ? 'text-gray-500' : 'text-gray-300'}`}>
                        R{i + 1}
                      </th>
                    ))}
                    <th className="p-2 text-center text-[9px] font-semibold tracking-wider text-gray-600 border-l border-warm">
                      TOT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-warm">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <img src={user?.avatar} alt="" className="w-5 h-5 rounded-full" />
                        <span className="text-xs font-semibold text-gray-900">You</span>
                      </div>
                    </td>
                    {Array.from({ length: currentBattle.rounds }).map((_, i) => {
                      const r = myResults[i];
                      return (
                        <td key={i} className={`p-2 text-center ${r ? (r.correct ? 'text-green-600' : 'text-red-500') : 'text-gray-300'}`}>
                          {r ? (r.correct ? formatCurrency(r.points) : '—') : '·'}
                        </td>
                      );
                    })}
                    <td className={`p-2 text-center font-display text-lg border-l border-warm ${leading ? 'text-green-600' : 'text-gray-600'}`}>
                      {formatCurrency(myTotalPoints)}
                    </td>
                  </tr>
                  <tr className="border-t border-warm">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        {isCreator ? (
                          <>
                            <div className="w-5 h-5 rounded-full bg-cream flex items-center justify-center">
                              <span className="text-gray-600 text-[10px] font-bold">?</span>
                            </div>
                            <span className="text-xs font-semibold text-gray-600">???</span>
                          </>
                        ) : (
                          <>
                            <img src={currentBattle.creator.avatar} alt="" className="w-5 h-5 rounded-full" />
                            <span className="text-xs font-semibold text-gray-900">{currentBattle.creator.username}</span>
                          </>
                        )}
                      </div>
                    </td>
                    {Array.from({ length: currentBattle.rounds }).map((_, i) => {
                      if (isCreator) {
                        return <td key={i} className="p-2 text-center text-gray-300">?</td>;
                      }
                      const r = opponentResults[i];
                      return (
                        <td key={i} className={`p-2 text-center ${r ? (r.correct ? 'text-green-600' : 'text-red-500') : 'text-gray-300'}`}>
                          {r ? (r.correct ? formatCurrency(r.points) : '—') : '·'}
                        </td>
                      );
                    })}
                    <td className={`p-2 text-center font-display text-lg border-l border-warm ${isCreator ? 'text-gray-300' : (!leading ? 'text-green-600' : 'text-gray-600')}`}>
                      {isCreator ? '?' : formatCurrency(opponentTotalPoints)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Buttons - different for inter vs final */}
          {isComplete ? (
            <div className="flex gap-2">
              <button
                onClick={backToPool}
                className="flex-1 py-3 bg-cream border border-warm text-gray-600 font-display text-sm tracking-widest rounded-xl"
              >
                ← POOL
              </button>
              <button
                onClick={startBattle}
                className="flex-1 py-3 bg-[#E36B11] text-white font-display text-sm tracking-widest rounded-xl"
              >
                REMATCH ⚔
              </button>
            </div>
          ) : (
            <button
              onClick={continueFromInter}
              className="w-full py-4 bg-[#E36B11] text-white font-display tracking-widest rounded-xl"
            >
              ROUND {myResults.length + 1} →
            </button>
          )}
        </div>
      </div>
    );
  };

  // Emergency reset function
  const emergencyReset = () => {
    setScreen('pool');
    setCurrentBattle(null);
    setMyResults([]);
    setOpponentResults([]);
    setMyTotalPoints(0);
    setOpponentTotalPoints(0);
    setCurrentRound(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    loadBattles();
  };

  return (
    <div className="w-full h-full flex flex-col bg-cream overflow-hidden relative">
      {renderScreen()}
      
      
      {/* Accepting Battle Modal */}
      {isAccepting && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-cream border-2 border-[#E36B11] rounded-2xl w-full max-w-[300px] p-8 text-center shadow-2xl">
            {/* Animated Swords */}
            <div className="relative w-20 h-20 mx-auto mb-4">
              <Swords className="w-20 h-20 text-[#E36B11] animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-[#E36B11]/30 border-t-[#E36B11] rounded-full animate-spin" />
              </div>
            </div>
            
            <h3 className="font-display text-xl tracking-wider mb-2 text-gray-900">
              ENTERING ARENA
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              Preparing your battle...
            </p>
            
            {/* Coin deduction animation hint */}
            <div className="flex items-center justify-center gap-2 text-[#E36B11] font-bold">
              <Coins className="w-5 h-5 animate-bounce" />
              <span>-{formatCurrency(toBOGX(currentBattle?.wager || 0))}</span>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Alert Modal */}
      <AlertModal
        show={alertState.show}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        buttonText={alertState.buttonText}
        onClose={hideAlert}
        onButtonClick={alertState.onButtonClick}
        secondaryButtonText={alertState.secondaryButtonText}
        onSecondaryButtonClick={alertState.onSecondaryButtonClick}
        details={alertState.details}
        embedded={embedded}
        onPlayTrivia={onGoToTrivia}
        onReadArticles={onGoToArticles}
      />

      {/* Game intro modal removed - now using setup screen */}

      {/* Invite Flow Modal - Full challenge flow */}
      <InviteFlowModal
        isOpen={showChallengeModal}
        onClose={() => setShowChallengeModal(false)}
        onSendChallenge={async (targetUser, wager, topic) => {
          // Use the selected wager and topic from the modal
          setCreateWager(wager);
          setCreateTopic(topic);
          handleChallengeUser(targetUser);
          return { success: true };
        }}
        onChallengeStarted={(battle) => {
          // Handle when challenge battle starts
          setShowChallengeModal(false);
        }}
        currentUserId={user?.id}
        currentUserCountry={user?.country}
        currentUserPoints={coins}
        isGenerating={isGenerating}
      />

      {/* Own Battle Cancel Modal */}
      {selectedOwnBattle && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedOwnBattle(null)}
          />
          <div className="relative bg-cream border border-warm rounded-2xl w-full max-w-[340px] p-6 text-center shadow-xl">
            <h3 className="font-display text-xl tracking-wider mb-2 text-gray-900">
              YOUR BATTLE
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {(() => { const T = getTopicConfig(selectedOwnBattle.topic); return <><T.icon className="w-4 h-4 inline" /> {T.label}</>; })()} · {selectedOwnBattle.rounds} rounds · {formatCurrency(toBOGX(selectedOwnBattle.wager))} <img src="/images/bogxcoin.png" alt="" className="w-4 h-4 inline" />
            </p>
            
            {selectedOwnBattle.isPrivate && (
              <div className="mb-4 py-2 px-3 bg-purple-50 border border-purple-200 rounded-lg text-purple-600 text-sm">
                Private Challenge
              </div>
            )}
            
            <p className="text-gray-600 text-xs mb-6">
              Waiting for opponent... Cancel to get your {formatCurrency(toBOGX(selectedOwnBattle.wager))} BOGX back.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedOwnBattle(null)}
                className="flex-1 py-3 border border-warm text-gray-600 font-display text-sm tracking-wider rounded-xl"
              >
                CLOSE
              </button>
              <button
                onClick={() => {
                  handleCancelBattle(selectedOwnBattle._id);
                  setSelectedOwnBattle(null);
                }}
                className="flex-1 py-3 bg-red-500 text-white font-display text-sm tracking-wider rounded-xl"
              >
                CANCEL BATTLE
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Open Battles Modal - purple for BattlesPage */}
      {user?.id && (
        <OpenBattlesModal
          isOpen={showOpenBattles}
          onClose={() => { setShowOpenBattles(false); refreshBattleCount(); }}
          userId={user.id}
          onPlayBattle={(battleId) => { setShowOpenBattles(false); loadBattles(); }}
          onCoinsChange={(amount) => setCoins(prev => prev + amount)}
          accentColor="purple"
        />
      )}

      {/* Quick Battle Preview Popup (Desktop) */}
      {quickPreviewBattle && (() => {
        const battle = quickPreviewBattle;
        const topic = getTopicConfig(battle.topic);
        const creatorCoins = (battle.creator as any).bogxCoins || 0;
        const creatorRank = (battle.creator as any).rank || '-';
        const createdDate = new Date(battle.createdAt);
        const fullDate = createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const fullTime = createdDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        
        return createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setQuickPreviewBattle(null)} />
            <div className="relative bg-cream border-2 border-[#A855F7] rounded-2xl w-full max-w-[360px] p-5 shadow-2xl">
              {/* Close button */}
              <button 
                onClick={() => setQuickPreviewBattle(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
              
              {/* Avatar + Info */}
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-3 border-[#A855F7]/40">
                    <img src={battle.creator.avatar} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -bottom-1 left-0">
                    <CountryFlag flag={battle.creator.countryFlag} className="w-5 h-4 rounded shadow-sm" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-cream" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-xl text-gray-900 tracking-wide">{battle.creator.username}</div>
                  <div className="text-sm text-gray-500 flex items-center gap-2">
                    <span>Rank #{creatorRank}</span>
                    <span className="flex items-center gap-1">
                      <img src="/images/bogxcoin.png" alt="" className="w-3 h-3" />
                      {formatCurrency(creatorCoins)}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Battle Info */}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-warm">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#A855F7]" />
                  <span className="font-bold text-gray-900">{battle.rounds}</span>
                  <span className="text-gray-500 text-sm">Rounds</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-display text-lg text-[#A855F7]">{formatCurrency(toBOGX(battle.wager))}</span>
                  <img src="/images/bogxcoin.png" alt="BOGX" className="w-4 h-4" />
                </div>
                <span 
                  className="text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-lg flex items-center gap-1 text-white ml-auto"
                  style={{ backgroundColor: topic.color }}
                >
                  {topic.icon && <topic.icon className="w-3 h-3" />}
                  {topic.label}
                </span>
              </div>
              
              {/* Date */}
              <div className="flex items-center gap-2 mt-3 text-gray-400 text-xs">
                <Clock className="w-3 h-3" />
                <span>{fullDate} • {fullTime}</span>
              </div>
              
              {/* Action Button */}
              <button
                onClick={async () => {
                  if (isOnBreak) {
                    showAlert('info', 'Battles are disabled during the break (9:00-10:00).');
                    return;
                  }
                  if (!isLoggedIn && battle.creator?.isBot !== true) {
                    showAlert('login', 'Please login to challenge real players! As a guest, you can only play against bots.', {
                      buttonText: 'LOGIN',
                      onButtonClick: onShowLogin
                    });
                    return;
                  }
                  if (coins < toBOGX(battle.wager)) {
                    showAlert('coins', `You need ${formatCurrency(toBOGX(battle.wager))} coins to join this battle!`);
                    return;
                  }
                  setQuickPreviewBattle(null);
                  setCurrentBattle(battle);
                  await beginBattle(battle);
                }}
                disabled={isAccepting}
                className="w-full mt-4 py-3 bg-[#A855F7] hover:bg-[#9333EA] text-white font-display text-sm tracking-wider rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {isAccepting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Swords className="w-4 h-4" />
                    START BATTLE
                  </>
                )}
              </button>
            </div>
          </div>,
          document.body
        );
      })()}

    </div>
  );
}
