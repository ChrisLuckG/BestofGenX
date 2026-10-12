"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { 
  Plus, ChevronLeft, ChevronRight, ChevronDown, Swords, Check, X, Clock, HelpCircle, Trophy, Coins, Users,
  Dumbbell, Music, Film, Landmark, Shirt, Gamepad2, Tv, Palette, UtensilsCrossed, Play, Lock, LayoutGrid,
  Target, Zap, RefreshCcw, Shield, Loader2, Search, ArrowRight, ArrowLeft, Globe, BarChart3, Bell, Info
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
import { type ChallengeTarget, rematchTargetFor } from "@/components/battles/types";
import { formatCurrency, getCurrencySymbol } from "@/utils/currency";
import { sounds } from "@/utils/sounds";
import { compareBattleResults } from "@/utils/battleWinner";
import { useCountUp } from "@/hooks/useCountUp";
import OpenBattlesModal from "@/components/OpenBattlesModal";
// Shared with Solo Trivia so both games start the same way.
import PreparingScreen, { TOPIC_BACKGROUNDS } from "@/components/games/PreparingScreen";
import { getTopicColor } from "@/lib/categories";

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
  /** Round was opened but never answered (reload / lost connection) - scored as wrong. */
  abandoned?: boolean;
}

// Topic config - 5 official categories only.
// Colours come from @/lib/categories (the single source of truth shared with the
// Welcome Reel and the article cards) - do not inline hex values here, that is
// how Music ended up green in the reel and purple in the battles.
const TOPICS: { id: string; label: string; icon: LucideIcon; color: string }[] = [
  { id: 'music', label: 'Music', icon: Music, color: getTopicColor('music') },
  { id: 'sport', label: 'Sport', icon: Dumbbell, color: getTopicColor('sport') },
  { id: 'film', label: 'Movies', icon: Film, color: getTopicColor('film') }, // includes TV
  { id: 'games', label: 'Gaming', icon: Gamepad2, color: getTopicColor('games') },
  { id: 'politik', label: 'Politik', icon: Landmark, color: getTopicColor('politik') },
];

const WAGERS = [
  { amount: 0.25, rounds: 3 },
  { amount: 0.50, rounds: 3 },
  { amount: 0.75, rounds: 3 },
  { amount: 1.00, rounds: 5 },
  { amount: 2.50, rounds: 5 },
  { amount: 5.00, rounds: 5 },
];

const GAME_TYPES = [
  { id: 'quiz', label: 'Quiz Battle', icon: '⚡', available: true },
  { id: 'poker', label: 'Poker', icon: '🃏', available: false },
  { id: 'rps', label: 'Rock Paper Scissors', icon: '✊', available: false },
  { id: 'dice', label: 'Dice Duel', icon: '🎲', available: false },
];

type GameScreen = 'setup' | 'pool' | 'invite' | 'intro' | 'preparing' | 'countdown' | 'quiz' | 'inter' | 'result' | 'invitation-sent';

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
  // Pre-selected player to challenge. With topic + wager it is a REMATCH: the
  // challenge is sent straight away instead of opening the invite flow.
  challengeTarget?: ChallengeTarget | null;
  onChallengeTargetHandled?: () => void; // Callback when challenge target has been handled
}

// Check if game is on break (9:55-10:00 CET - 5 minute daily reset)
const isGameOnBreak = () => {
  const now = new Date();
  const germanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  const hour = germanTime.getHours();
  const minute = germanTime.getMinutes();
  return hour === 9 && minute >= 55;
};

export default function BattlePage({ coins, setCoins, onCoinAnimation, viewBattleId, onBattleViewed, onShowLogin, onBattleActiveChange, pendingBattleId, onPendingBattleHandled, onBack, embedded = false, isDesktop = false, onGoToTrivia, onGoToArticles, skipSetup = false, challengeTarget, onChallengeTargetHandled }: BattlePageProps) {
  const { user, isLoggedIn } = useAuth();
  
  // Check if game is on break (9:55-10:00)
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
  // challengeTarget takes priority: without this, mounting with skipSetup=true
  // (always true on desktop) briefly showed the Open Battles pool screen before
  // the challengeTarget effect below could redirect to the invite flow - a
  // visible flash between clicking "Challenge" and landing on the right step.
  const [screen, setScreen] = useState<GameScreen>(
    challengeTarget ? 'invite' : pendingBattleId ? 'intro' : (skipSetup ? 'pool' : 'setup')
  );
  const [selectedGameType, setSelectedGameType] = useState('quiz');
  const [topicFilter, setTopicFilter] = useState('all');
  const [wagerFilter, setWagerFilter] = useState<number | 'all'>('all');
  const topicScrollRef = useRef<HTMLDivElement>(null);
  
  // Create panel
  const [showCreate, setShowCreate] = useState(false);
  const [createWager, setCreateWager] = useState(0.25);
  const [createTopic, setCreateTopic] = useState('sport');
  // Step 2 of the invite flow picks a topic but does NOT advance on the tap -
  // the step is confirmed with its own button, like the wager step. `createTopic`
  // defaults to 'sport', so it cannot double as "has the user chosen yet": null
  // here means nothing is selected and the Continue button stays disabled.
  const [pendingTopic, setPendingTopic] = useState<string | null>(null);
  // Scoreboard player info (rank, wallet, battle record), keyed by user id.
  const [scoreboardInfo, setScoreboardInfo] = useState<Record<string, {
    rank: number; coins: number; battleWins: number; battleLosses: number;
  }>>({});
  // Direct record between the two players on the scoreboard.
  const [scoreboardH2H, setScoreboardH2H] = useState<{
    wins: Record<string, number>; ties: number; total: number;
  } | null>(null);
  
  // Challenge modal (legacy - now using invite screen)
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  
  // Invite screen state. Seeded from challengeTarget for the same reason as
  // `screen` above - starting at step 1 (pick a player) and only advancing once
  // the effect below runs would flash the player list for a frame first.
  const [inviteStep, setInviteStep] = useState<1 | 2 | 3 | 4>(
    challengeTarget ? (challengeTarget.topic && challengeTarget.wager ? 4 : 2) : 1
  ); // 1=player, 2=topic, 3=wager, 4=preparing (a rematch starts at 4)
  const [sentBattleId, setSentBattleId] = useState<string | null>(null);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [inviteSearchResults, setInviteSearchResults] = useState<any[]>([]);
  const [inviteOnlinePlayers, setInviteOnlinePlayers] = useState<any[]>([]);
  const [invitePlayerFilter, setInvitePlayerFilter] = useState<'all' | 'online' | 'country' | 'level'>('all');
  const [inviteSelectedCountries, setInviteSelectedCountries] = useState<string[]>([]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [inviteIsSearching, setInviteIsSearching] = useState(false);
  const [inviteLoadingOnline, setInviteLoadingOnline] = useState(false);
  const [selectedInviteUser, setSelectedInviteUser] = useState<any>(
    challengeTarget ? { _id: challengeTarget.id, username: challengeTarget.username, avatar: challengeTarget.avatar, countryFlag: challengeTarget.countryFlag } : null
  );

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
  
  // Result-screen figures, ramped up like Solo Trivia's result page. Derived
  // HERE rather than inside renderResultScreen(): that helper only runs for one
  // screen value, so hooks called in it would be conditional and React would
  // lose the hook order on every screen change.
  const resultMyCorrect = myResults.filter(r => r.correct).length;
  const resultOppCorrect = opponentResults.filter(r => r.correct).length;
  const resultRounds = currentBattle?.rounds || 0;
  const resultComplete = resultRounds > 0 && myResults.length >= resultRounds;
  const resultAnimating = screen === 'result' && resultComplete;
  const resultCmp = compareBattleResults(myResults, opponentResults);
  // `wager` IS the BOGX amount - the local toBOGX() below is the identity
  // function. Not calling it here because it is declared further down in the
  // component body, so referencing it at this point hits the TDZ.
  const resultWagerBogx = currentBattle?.wager ?? 0;
  // A draw returns the wager, so nothing is won or lost.
  const resultCoinDelta = resultCmp === 0 ? 0 : resultCmp > 0 ? resultWagerBogx : -resultWagerBogx;
  const animResultAccuracy = useCountUp(
    resultRounds > 0 ? Math.round((resultMyCorrect / resultRounds) * 100) : 0,
    resultAnimating,
  );
  const animResultCoins = useCountUp(resultCoinDelta, resultAnimating);
  const animResultMyScore = useCountUp(resultMyCorrect, resultAnimating, 700);
  const animResultOppScore = useCountUp(resultOppCorrect, resultAnimating, 700);

  // Animated prize pool for Create Battle screen
  const animPrizePool = useCountUp(createWager * 2, showCreate, 400);

  /** Section label, identical to Solo Trivia's RESULT / QUESTIONS headings. */
  const resultSectionLabel = 'font-display text-[10px] text-gray-500 tracking-[0.12em]';

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
  
  // Inline toast (non-blocking, no blur)
  const [inlineToast, setInlineToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const showInlineToast = (message: string, type: 'success' | 'info' = 'success') => {
    setInlineToast({ message, type });
    setTimeout(() => setInlineToast(null), 4000);
  };

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

  // Give up (forfeit) an in-progress battle - opponent gets the full pot
  const [showGiveUpConfirm, setShowGiveUpConfirm] = useState(false);
  const [givingUp, setGivingUp] = useState(false);
  /** True once START was pressed for the current battle - the wager is then committed. */
  const [hasStartedBattle, setHasStartedBattle] = useState(false);

  const handleGiveUp = async () => {
    if (!currentBattle || !user?.id) return;
    setGivingUp(true);
    try {
      const res = await fetch(`/api/battles/${currentBattle._id}/forfeit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oderId: user.id }),
      });
      const data = await res.json();
      if (!data.success) {
        showAlert('error', data.error || 'Could not give up this battle.');
        return;
      }
      window.dispatchEvent(new CustomEvent('bogx-updated'));
      showAlert(
        'info',
        data.cancelled
          ? 'Battle cancelled — your wager was refunded.'
          : `You gave up. ${data.winner || 'Your opponent'} receives the full pot.`,
        { title: data.cancelled ? 'CANCELLED' : 'BATTLE FORFEITED' }
      );
      setCurrentBattle(null);
      setScreen('pool');
      loadBattles();
    } catch {
      showAlert('error', 'Connection error. Please try again.');
    } finally {
      setGivingUp(false);
      setShowGiveUpConfirm(false);
    }
  };

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

  // Handle pending battle set by a caller that already got explicit confirmation
  // from the user (the "Accept & Play Now!" challenge modal, or "Play Now" on an
  // open pool battle) - so going straight into gameplay here is the promise those
  // buttons made, not a surprise. A raw push-notification tap must NOT set
  // pendingBattleId directly for that reason; see mobile/page.tsx, which routes it
  // through the same challenge-confirmation modal first.
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
              showAlert('coins', `You need ${formatCurrency(toBOGX(battle.wager))} coins to accept this challenge!`, { balance: coins, required: toBOGX(battle.wager) });
              onPendingBattleHandled?.();
              return;
            }
            // "Play Now" / "Accept & Play Now!" is a single decisive action the
            // user already confirmed elsewhere — accept (if needed) and start the
            // battle immediately instead of showing a redundant second confirmation.
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
          showAlert('coins', `You need ${createWager.toFixed(2)} BOGX to open this battle.`, { balance: dbCoins, required: createWager });
          return;
        }
        // Update local coins to match DB
        setCoins(() => dbCoins);
      }
      
      const rounds = createWager >= 1.00 ? 5 : 3;
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
                title: 'Battle Challenge!',
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
  // wager and topic are passed directly to avoid React state async issues
  const handleChallengeUser = async (targetUser: any, wager?: number, topic?: string) => {
    setShowChallengeModal(false);
    setIsGenerating(true);
    
    // Use passed values or fall back to state (for backwards compatibility)
    const effectiveWager = wager ?? createWager;
    const effectiveTopic = topic ?? createTopic;
    
    try {
      // First sync coins from DB to ensure we have accurate balance
      const syncRes = await fetch(`/api/user/points?userId=${user?.id}`);
      const syncData = await syncRes.json();
      if (syncData.success) {
        const dbCoins = syncData.bogxCoins;
        if (dbCoins < effectiveWager) {
          setIsGenerating(false);
          setCoins(() => dbCoins); // Sync local coins with DB
          showAlert('coins', `You need ${effectiveWager.toFixed(2)} BOGX for this challenge.`, { balance: dbCoins, required: effectiveWager });
          return;
        }
        // Update local coins to match DB
        setCoins(() => dbCoins);
      }
      
      const rounds = effectiveWager >= 1.00 ? 5 : 3;
      const res = await fetch('/api/battles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: user?.id,
          topic: effectiveTopic,
          wager: effectiveWager,
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
        onCoinAnimation?.(-effectiveWager, 'hold');
        // Sync coins + pending wager indicator instantly (mobile & desktop)
        window.dispatchEvent(new CustomEvent('bogx-updated'));
        
        // Save battle and go to Step 4 (Challenge Sent screen)
        setCurrentBattle(data.battle);
        setSentBattleId(data.battle._id);
        setInviteStep(4);
        setIsCreator(true);
        setMyResults([]);
        setOpponentResults([]);
        setMyTotalPoints(0);
        setOpponentTotalPoints(0);
        setCurrentRound(0);
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
      showAlert('info', 'Battles are disabled during the break (9:55-10:00).');
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
      showAlert('coins', `You need ${formatCurrency(toBOGX(battle.wager))} coins to join this battle!`, { balance: coins, required: toBOGX(battle.wager) });
      return;
    }
    
    setCurrentBattle(battle);
    // Pre-set isCreator based on who created the battle
    const creatorField: any = battle.creator;
    const iAmCreator = creatorField?._id === user?.id || creatorField === user?.id;
    setIsCreator(iAmCreator);
    // Pass the battle explicitly. Calling startBattle() here read `currentBattle`
    // from state one line after setCurrentBattle, i.e. still the PREVIOUS value:
    //  - first click of a session (null) -> beginBattle bailed out silently, so no
    //    accept happened at all. The preparing screen was already up, its ring
    //    completed, and START offered a battle the user had never joined - no wager
    //    deducted, no wager chip, and "You are not part of this battle" on give up.
    //  - later clicks -> it accepted the PREVIOUSLY selected battle instead, which is
    //    why a 0,75 wager got deducted while the screen showed a 0,25 battle.
    beginBattle(battle);
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
        // Wager already deducted on server. Show it going out with the 'hold' variant
        // (parked, not lost) - the same signal the create/invite paths give, so joining
        // a battle from the pool doesn't silently take coins.
        //
        // Deliberately no setCoins here: the animation writes the new display value and
        // the 'bogx-updated' sync writes the authoritative one. Doing both made the
        // counter deduct the wager twice before the next sync corrected it.
        onCoinAnimation?.(-toBOGX(battle.wager), 'hold');
        // Sync coins + pending wager indicator instantly (mobile & desktop)
        window.dispatchEvent(new CustomEvent('bogx-updated'));
        return true;
      } else {
        // Friendly error messages based on reason
        let alertType: 'error' | 'coins' = 'error';
        let message = 'This battle is no longer available.';
        let alertOptions: { balance?: number; required?: number } | undefined;
        if (data.error === 'Battle is not open') {
          message = 'Oops! Someone was faster 🏃💨 This battle was already taken.';
        } else if (data.error === 'Cannot accept own battle') {
          message = "You can't battle yourself! 😅 Challenge someone else.";
        } else if (data.error === 'Not enough coins') {
          alertType = 'coins';
          const available = data.details?.available;
          message = `You need ${formatCurrency(toBOGX(battle.wager))} coins to join this battle!`;
          alertOptions = { balance: available ?? coins, required: toBOGX(battle.wager) };
          // Force sync coins from server
          if (available !== undefined) {
            setCoins(() => available);
          }
        } else if (data.error) {
          message = data.error;
        }
        showAlert(alertType, message, alertOptions);
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
        // Declining releases the challenger's wager - resync so their WAGER chip
        // and balance are correct without waiting for the next poll.
        window.dispatchEvent(new CustomEvent('bogx-updated'));
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
    // Guests have no account to deduct a wager from, so there is nothing to accept.
    // Returning silently here left the preparing screen up: its ring completed, START
    // appeared, and the player was offered a battle they had never joined - no wager,
    // no wager chip, and "You are not part of this battle" on give up. Any early exit
    // from this function must send the user back to the pool.
    if (!user) {
      console.error('beginBattle: no user');
      showAlert('login', 'Please login to play battles!', {
        buttonText: 'LOGIN',
        onButtonClick: onShowLogin,
      });
      setCurrentBattle(null);
      setScreen('pool');
      return;
    }
    const alreadyActive = battle.status === 'active';
    // Defensive check: creator may be a populated object OR a raw ID string
    // depending on the code path that loaded this battle.
    const creatorField: any = battle.creator;
    const iAmCreator = creatorField?._id === user.id || creatorField === user.id;

    // An already-active battle is only playable if YOU are one of the two players.
    // Skipping the accept call for every active battle meant a battle between two
    // OTHER players (stale pendingBattleId, a bot battle, or an open battle someone
    // else grabbed first) dropped you straight into playing it. Nothing complained
    // until submit/forfeit, where the server correctly answered
    // "You are not part of this battle" — after the rounds had been played.
    if (alreadyActive) {
      const opponentField: any = battle.opponent;
      const iAmOpponent = opponentField?._id === user.id || opponentField === user.id;
      if (!iAmCreator && !iAmOpponent) {
        showAlert('info', 'This battle is already being played by two other players.');
        setCurrentBattle(null);
        setScreen('pool');
        loadBattles();
        return;
      }
    }

    if (!alreadyActive) {
      // Show preparing screen while accepting
      setScreen('preparing');
      setIsAccepting(true);

      // First accept the battle via API
      const accepted = await handleAcceptBattle(battle);

      if (!accepted) {
        setIsAccepting(false);
        setScreen('pool');
        return;
      }

      // Battle accepted - preparing screen will show START button after ring completes
      setIsAccepting(false);
    } else {
      // Already active - still show preparing screen for consistency
      setScreen('preparing');
    }

    // Determine role correctly instead of assuming opponent
    setIsCreator(iAmCreator);
    setHasStartedBattle(false);
    
    // Load MY existing results and resume from where I left off. The server is asked
    // to reconcile first: a round that was opened but never answered is closed as
    // wrong there, so it is NOT handed back out. Reading battle.creatorResults
    // directly would skip that and re-serve the question the player walked out of.
    let myExistingResults = (iAmCreator ? battle.creatorResults : battle.opponentResults) || [];
    let myExistingTotalPoints = (iAmCreator ? battle.creatorTotalPoints : battle.opponentTotalPoints) || 0;
    if (user?.id) {
      try {
        const resumeRes = await fetch(`/api/battles/${battle._id}/round`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, action: 'resume' }),
        });
        const resumeData = await resumeRes.json();
        if (resumeData.success && Array.isArray(resumeData.results)) {
          myExistingResults = resumeData.results;
          myExistingTotalPoints = resumeData.totalPoints ?? myExistingTotalPoints;
        }
      } catch (err) {
        console.error('Failed to reconcile abandoned rounds:', err);
      }
    }
    if (myExistingResults.length > 0) {
      const normalizedMyResults = myExistingResults.map((r: any) => ({
        correct: r.correct,
        timeMs: r.timeMs,
        points: r.points > 1 ? r.points / 1000 : r.points,
        answerIndex: r.answerIndex,
        abandoned: r.abandoned,
      }));
      setMyResults(normalizedMyResults);
      myResultsRef.current = normalizedMyResults;
      setMyTotalPoints(myExistingTotalPoints > 1 ? myExistingTotalPoints / 1000 : myExistingTotalPoints);
      // Resume at the next unanswered round
      currentRoundRef.current = normalizedMyResults.length;
      setCurrentRound(normalizedMyResults.length);
    } else {
      setMyResults([]);
      myResultsRef.current = [];
      setMyTotalPoints(0);
      currentRoundRef.current = 0;
      setCurrentRound(0);
    }
    
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
      opponentResultsRef.current = normalizedResults;
      const totalPts = otherTotalPoints || 0;
      setOpponentTotalPoints(totalPts > 1 ? totalPts / 1000 : totalPts);
    } else if (!iAmCreator && (battle.creator as any)?.isBot && myExistingResults.length > 0) {
      // Resuming a bot battle. Bot rounds are simulated client-side only, so a reload
      // loses them - submitting an empty bot scoreboard would hand a 0:0 tie (and a
      // refund) to a player who walked out of every round. Play the bot's rounds now.
      const simulated = Array.from({ length: battle.rounds }).map(() => {
        const correct = Math.random() < 0.6 + Math.random() * 0.3;
        const timeMs = 2000 + Math.random() * 6000;
        const pct = Math.max(10000 - timeMs, 0) / 10000;
        return {
          correct,
          timeMs,
          points: correct ? Math.round(0.30 * pct * 100) / 100 : 0,
        };
      });
      setOpponentResults(simulated);
      opponentResultsRef.current = simulated;
      setOpponentTotalPoints(simulated.reduce((s, r) => s + r.points, 0));
    } else {
      setOpponentResults([]);
      opponentResultsRef.current = [];
      setOpponentTotalPoints(0);
    }

    // Every round was already closed (all of them abandoned, or the tab was lost
    // after the last answer). There is no question left to show, so finish the
    // battle instead of dropping the player into an empty quiz screen. State set
    // above has not committed yet, hence the explicit overrides.
    if (myResultsRef.current.length >= battle.rounds) {
      setScreen(iAmCreator ? 'invitation-sent' : 'result');
      completeBattle(myResultsRef.current, battle, iAmCreator);
      return;
    }
    // Don't start countdown here - wait for user to click START on preparing screen
  };
  
  /**
   * Arm the current battle: from here on, backing out is a forfeit rather than a
   * free cancel. Recorded on the server (see /api/battles/[id]/start) so a reload
   * or a direct /forfeit call can't pretend the battle was never started.
   */
  const markBattleStarted = () => {
    if (hasStartedBattle || !currentBattle || !user?.id) return;
    setHasStartedBattle(true);
    // Fire-and-forget: the countdown must not wait on the network. If the call fails
    // the player simply stays in the pre-start state, which errs in their favour.
    fetch(`/api/battles/${currentBattle._id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    }).catch(err => console.error('Failed to mark battle as started:', err));
  };

  /**
   * Back out of the preparing screen.
   *
   * The wager was already deducted by the accept/create call, so plain
   * `setScreen('pool')` left it locked in a battle the player had walked away from -
   * the coins were simply gone from their spendable balance with only the WAGER chip
   * hinting at it. Since the battle is not armed yet (no START), /forfeit takes its
   * CANCEL path and refunds both players.
   */
  const leavePreparing = async () => {
    if (!currentBattle || !user?.id || hasStartedBattle) {
      setScreen('pool');
      return;
    }
    setGivingUp(true);
    try {
      const res = await fetch(`/api/battles/${currentBattle._id}/forfeit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oderId: user.id }),
      });
      const data = await res.json();
      // Only animate what the server actually gave back. On the (unexpected) forfeit
      // path nothing is refunded, so showing a credit would be a lie. `reopened` is
      // the pool case: the battle stays alive for its creator, our wager comes back.
      if (data.success && (data.cancelled || data.reopened)) {
        onCoinAnimation?.(data.refunded ?? toBOGX(currentBattle.wager), 'hold');
      }
    } catch (error) {
      console.error('Failed to cancel battle on leaving preparing screen:', error);
    } finally {
      setGivingUp(false);
      window.dispatchEvent(new CustomEvent('bogx-updated'));
      setCurrentBattle(null);
      setScreen('pool');
      loadBattles();
    }
  };

  // Called when user clicks START on the preparing screen.
  const startFromPreparing = () => {
    setScreen('countdown');
    setCountdown(3);
    runCountdown();
  };

  // Called from the intro screen's "START BATTLE" button (browsing the open
  // pool and previewing before committing).
  const startBattle = async () => {
    if (!currentBattle) {
      // Only reachable from screens that already have a battle loaded. Bailing out
      // silently here is what hid the showBattleIntro bug for so long.
      console.error('startBattle called without a currentBattle');
      return;
    }
    await beginBattle(currentBattle);
  };

  // Countdown
  //
  // This is the single choke point every "the game is now live" path goes through
  // (preparing screen START, invite flow, auto-start on accept), so the wager is
  // committed here rather than in one specific button handler - otherwise a path
  // that skips the preparing screen would leave the battle refundable.
  const runCountdown = () => {
    markBattleStarted();
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
    
    // Tell the server this round is now open. Without this record a reload cannot be
    // told apart from never having reached the round, and the question could be
    // replayed until it was answered correctly.
    const battleForStart = currentBattleRef.current;
    if (user?.id && battleForStart) {
      fetch(`/api/battles/${battleForStart._id}/round`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          action: 'start',
          round: currentRoundRef.current,
        }),
      }).catch(err => console.error('Failed to mark round as started:', err));
    }
    
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
    
    // Save round result to server immediately (prevents refresh cheating)
    if (user?.id) {
      fetch(`/api/battles/${currentBattle._id}/round`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          round: currentRound,
          correct,
          timeMs,
          points,
          answerIndex: index,
        }),
      }).catch(err => console.error('Failed to save round:', err));
    }
    
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
    
    // Save timeout result to server immediately (prevents refresh cheating)
    if (user?.id && battle) {
      fetch(`/api/battles/${battle._id}/round`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          round,
          correct: false,
          timeMs: 10000,
          points: 0,
          answerIndex: -1,
        }),
      }).catch(err => console.error('Failed to save timeout round:', err));
    }
    
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
        // Keep the ref in step immediately - it is otherwise only synced by an
        // effect, and startRound() reports the round number to the server from it.
        currentRoundRef.current = nextIdx;
        setCurrentRound(nextIdx);
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

  // Complete battle - save results to server.
  // battleOverride/isCreatorOverride exist for the same reason beginBattle takes the
  // battle explicitly: when this is called in the same tick as setCurrentBattle /
  // setIsCreator (resuming a battle whose rounds are all already closed), the state
  // read from the closure is still the previous one - null, which silently dropped
  // the submit and left the battle active forever.
  const completeBattle = async (
    latestResults?: RoundResult[],
    battleOverride?: Battle,
    isCreatorOverride?: boolean
  ) => {
    const activeBattle = battleOverride || currentBattle;
    const iAmCreator = isCreatorOverride ?? isCreator;
    if (!activeBattle || !user) return;
    
    // Use passed results if available (more accurate than state)
    const resultsToSubmit = latestResults || myResults;
    
    console.log(`Submitting battle results: ${resultsToSubmit.length} rounds`);
    // Count this battle as a play (intro auto-opens only for first-timers)
    incrementGamePlayCount("quizzbattle");
    
    // Format results for API
    // abandoned must be carried through: submit REPLACES the stored results, so
    // dropping the flag here would erase the reason a round was lost and the result
    // view would show a reload as an ordinary wrong answer.
    const formattedResults = resultsToSubmit.map((r, i) => ({
      round: i,
      correct: r.correct,
      timeMs: r.timeMs,
      points: r.points,
      answerIndex: r.answerIndex,
      abandoned: r.abandoned
    }));
    
    // When playing against a bot, the bot (creator) never actually played on the server.
    // Send the locally-simulated bot results so the server can save them and determine
    // the winner correctly (otherwise both sides are 0 => false tie + refund).
    const creatorIsBot = !iAmCreator && (activeBattle.creator as any)?.isBot;
    const botResults = creatorIsBot
      ? opponentResultsRef.current.map((r, i) => ({
          round: i,
          correct: r.correct,
          timeMs: r.timeMs,
          points: r.points,
          answerIndex: r.answerIndex
        }))
      : undefined;
    
    // Submitting is the only chance to persist a finished game, so a single
    // hiccup (dev server recompiling, flaky connection) must not lose the round.
    const submit = () => fetch(`/api/battles/${activeBattle._id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: user.id,
        results: formattedResults,
        isCreator: iAmCreator,
        botResults
      })
    });

    try {
      let res: Response;
      try {
        res = await submit();
      } catch {
        await new Promise(r => setTimeout(r, 1000));
        res = await submit();
      }

      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || `Submit failed (${res.status})`);
      }
      
      // Vs a bot opponent (direct challenge / rematch) the server answers for the
      // bot and settles the battle right away, so the creator gets the result too.
      const settledNow = iAmCreator && data.battle?.status === 'completed';
      if (settledNow) {
        const botSide: RoundResult[] = (data.battle.opponentResults || []).map((r: any) => ({
          correct: r.correct, timeMs: r.timeMs, points: r.points, answerIndex: r.answerIndex,
        }));
        opponentResultsRef.current = botSide;
        setOpponentResults(botSide);
        setOpponentTotalPoints(data.battle.opponentTotalPoints || 0);
        setCurrentBattle(prev => prev ? { ...prev, status: 'completed', opponent: data.battle.opponent || prev.opponent } : prev);
        setScreen('result');
      }

      if (iAmCreator && !settledNow) {
        // Creator finished - show invitation sent screen (no blur popup)
        setScreen('invitation-sent');
      } else {
        // Battle is complete, show result.
        // Use refs (not stale state) to compute the authoritative outcome.
        // Winner = most correct answers; tie-break by fastest total time.
        const cmp = compareBattleResults(resultsToSubmit, opponentResultsRef.current);
        const won = cmp > 0;
        const isTie = cmp === 0;
        
        // Wager was already deducted when accepting.
        // Winner gets both wagers (2x), tie gets wager back, loser gets nothing.
        // Server handles the actual point changes - trigger animation for all outcomes.
        if (won) {
          // Won: show winnings (2x wager)
          onCoinAnimation?.(toBOGX(activeBattle.wager) * 2);
        } else if (isTie) {
          // Tie: wager returned (neutral, but show it)
          onCoinAnimation?.(toBOGX(activeBattle.wager), 'hold');
        } else {
          // Lost: show loss (wager was already deducted, this is visual feedback)
          onCoinAnimation?.(-toBOGX(activeBattle.wager), 'loss');
        }
        
        // Update coins immediately so the wager indicator disappears
        if (data.newBalance !== undefined) {
          setCoins(data.newBalance);
        }
        
        // Notify leaderboard/rankings to refresh instantly
        window.dispatchEvent(new CustomEvent('bogx-updated'));
      }
    } catch (error: any) {
      console.error('Failed to save battle result:', error);
      showAlert('error', `Failed to save results: ${error?.message || 'connection problem'}. Please try again.`);
    }
  };

  // Back to pool
  const backToPool = () => {
    setScreen('pool');
    setCurrentBattle(null);
    loadBattles();
  };

  // See results - animation is handled in completeBattle to avoid double-triggering
  const seeResultsWithAnimation = () => {
    // Animation is triggered in completeBattle after server confirms the result.
    // Previously this also triggered animation, causing TWO animations to play.
    nextRound(myResultsRef.current);
  };

  // Cancel own battle
  const handleCancelBattle = async (battleId: string) => {
    // Find the battle to get the wager amount for animation
    const battle = battles.find(b => b._id === battleId) || currentBattle;
    const wagerAmount = battle?.wager || 0.25; // Default to minimum wager if not found
    
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
        // Without this the balance AND the WAGER chip keep the pre-cancel values
        // until the next 30s poll: the wager was already released on the server,
        // so the header claimed coins were still locked in a battle that no screen
        // could show any more.
        window.dispatchEvent(new CustomEvent('bogx-updated'));
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
      case 'invite':
        return renderInviteScreen();
      case 'intro':
        return renderIntroScreen();
      case 'preparing':
        return renderPreparingScreen();
      case 'countdown':
        return renderCountdownScreen();
      case 'quiz':
        return renderQuizScreen();
      case 'inter':
        return renderResultScreen(); // Unified screen for both inter-round and final result
      case 'result':
        return renderResultScreen();
      case 'invitation-sent':
        return renderInvitationSentScreen();
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

  // ═══════════════════════════════════════════════════════════════
  // INVITATION SENT SCREEN - Shows after creator submits answers
  // ═══════════════════════════════════════════════════════════════
  const renderInvitationSentScreen = () => {
    if (!currentBattle) return null;
    const challengedUser = currentBattle.challengedUser as any;
    const challengedName = challengedUser?.username || 'Opponent';
    const challengedAvatar = challengedUser?.avatar;
    const isPrivateChallenge = currentBattle.isPrivate;
    const topic = getTopicConfig(currentBattle.topic);
    const myCorrectCount = myResults.filter(r => r.correct).length;
    const potAmount = toBOGX(currentBattle.wager) * 2;

    return (
      <div className="flex flex-col h-full bg-cream p-2 sm:p-4">
        {/* Main Card - same frame as the quiz screen */}
        <div className="flex-1 border border-warm bg-cream rounded-2xl flex flex-col p-4 sm:p-6 shadow-lg animate-[cardIn_0.4s_ease-out] min-h-0">

          {/* Players Bar - identical to quiz screen */}
          <div className="relative flex items-stretch border border-warm rounded-xl bg-cream overflow-hidden mb-4">
            {/* You */}
            <div className="flex-1 min-w-0 flex flex-col items-center gap-1 p-2 sm:p-4 border-r border-warm animate-[slideInLeft_0.4s_ease-out_backwards]">
              <div className="w-8 h-8 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 sm:border-3 flex-shrink-0" style={{ borderColor: topic.color }}>
                <img src={user?.avatar || 'https://i.pravatar.cc/80?img=47'} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="font-bold text-[10px] sm:text-lg text-gray-900 truncate">You</div>
              <div className="font-display text-xl sm:text-4xl tracking-wide" style={{ color: topic.color }}>{myCorrectCount}</div>
            </div>

            {/* VS Center */}
            <div className="flex flex-col items-center justify-center gap-1 sm:gap-2 px-1 sm:px-4 py-2 sm:py-4">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg text-[8px] sm:text-[10px] uppercase tracking-wider font-bold whitespace-nowrap" style={{ backgroundColor: `${topic.color}15`, color: topic.color }}>
                <topic.icon className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {topic.label}
              </span>
              <span className="font-display text-xs sm:text-lg text-gray-400 tracking-wider">VS</span>
              <div className="flex gap-1 sm:gap-2">
                {Array.from({ length: currentBattle.rounds }).map((_, i) => {
                  const result = myResults[i];
                  const color = result ? (result.correct ? '#10b981' : '#ef4444') : '#e5e7eb';
                  return (
                    <span
                      key={i}
                      className="min-w-[24px] h-6 sm:min-w-[36px] sm:h-8 px-1.5 sm:px-2 rounded-md flex items-center justify-center font-display text-[10px] sm:text-xs tracking-wider text-white"
                      style={{ background: color }}
                    >
                      R{i + 1}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Opponent - waiting */}
            <div className="flex-1 min-w-0 flex flex-col items-center gap-1 p-2 sm:p-4 border-l border-warm animate-[slideInRightBattle_0.4s_ease-out_backwards]">
              <div
                className="w-8 h-8 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 sm:border-3 border-warm flex-shrink-0 relative"
                style={{ animation: 'challengeReceive 2.4s ease-in-out infinite' }}
              >
                {challengedAvatar ? (
                  <img src={challengedAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <HelpCircle className="w-4 h-4 sm:w-7 sm:h-7 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="font-bold text-[10px] sm:text-lg text-gray-900 truncate text-center max-w-[80px] sm:max-w-none">
                {isPrivateChallenge ? challengedName : 'Opponent'}
              </div>
              <div className="font-display text-xl sm:text-4xl text-gray-300 tracking-wide">-</div>
            </div>
          </div>

          {/* Status banner - takes the place of the question card */}
          <div className={`relative border border-green-500/30 bg-green-500/5 rounded-xl p-4 sm:p-5 ${isPrivateChallenge ? 'pb-9 sm:pb-10' : ''} mb-4 flex items-center gap-4 overflow-hidden`}>
            {/* Notification animation - runs in its own lane below the text so it
                never travels through the words */}
            {isPrivateChallenge && (
              <div className="pointer-events-none absolute inset-0 z-0">
                {/* faint path */}
                <div
                  className="absolute bottom-4 left-[10%] right-[10%] h-px border-t border-dashed border-green-500/30"
                  style={{ animation: 'challengeTrail 2.4s ease-in-out infinite' }}
                />
                {/* flying bell */}
                <div
                  className="absolute bottom-4 w-5 h-5 rounded-full bg-green-500/10 border border-green-500/40 flex items-center justify-center"
                  style={{ animation: 'challengeFly 2.4s ease-in-out infinite' }}
                >
                  <Bell className="w-2.5 h-2.5 text-green-600" />
                </div>
              </div>
            )}
            <div className="relative z-10 w-9 h-9 rounded-full border border-green-500/40 bg-green-500/10 flex items-center justify-center flex-shrink-0">
              <Check className="w-4 h-4 text-green-600" strokeWidth={2.5} />
            </div>
            <div className="relative z-10 min-w-0">
              <h2 className="font-display text-lg sm:text-2xl text-gray-900 leading-none mb-1">
                {isPrivateChallenge ? 'CHALLENGE SENT!' : 'BATTLE CREATED!'}
              </h2>
              <p className="text-gray-600 text-xs sm:text-sm">
                {isPrivateChallenge
                  ? `Your rounds are locked in. ${challengedName} has 24h to answer.`
                  : 'Your rounds are locked in. Waiting for an opponent to join.'}
              </p>
            </div>
          </div>

          {/* Info tiles - distributed like the answer grid */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
            <div className="border border-warm rounded-xl p-3 sm:p-4 bg-cream">
              <div className="text-[9px] sm:text-[10px] tracking-widest text-gray-500 uppercase mb-1">Your Score</div>
              <div className="font-display text-lg sm:text-2xl text-gray-900">{myCorrectCount}/{currentBattle.rounds}</div>
            </div>
            <div className="border border-warm rounded-xl p-3 sm:p-4 bg-cream">
              <div className="text-[9px] sm:text-[10px] tracking-widest text-gray-500 uppercase mb-1">Pot</div>
              <div className="font-display text-lg sm:text-2xl flex items-center gap-1.5" style={{ color: topic.color }}>
                <img src="/images/bogxcoin.png" alt="" className="w-5 h-5" />
                {formatCurrency(potAmount)}
              </div>
            </div>
            <div className="border border-warm rounded-xl p-3 sm:p-4 bg-cream">
              <div className="text-[9px] sm:text-[10px] tracking-widest text-gray-500 uppercase mb-1">Status</div>
              <div className="font-bold text-sm sm:text-base text-gray-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#6B7280]" />
                Waiting
              </div>
            </div>
            <div className="border border-warm rounded-xl p-3 sm:p-4 bg-cream">
              <div className="text-[9px] sm:text-[10px] tracking-widest text-gray-500 uppercase mb-1">Notification</div>
              <div className="font-bold text-sm sm:text-base text-gray-900 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-[#E36B11]" />
                On response
              </div>
            </div>
          </div>

          {/* Footer actions - bottom of the card like the quiz footer */}
          <div className="mt-auto flex items-center justify-between gap-3 pt-2">
            <span className="text-xs text-gray-500 hidden sm:block">You can start another battle while you wait.</span>
            <button
              onClick={() => {
                setScreen('pool');
                setCurrentBattle(null);
                loadBattles();
              }}
              className="ml-auto px-6 py-3 bg-[#6B7280] text-white font-bold text-sm rounded-xl hover:bg-[#5B6270] transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              BACK TO BATTLES
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSetupScreen = () => (
    <div className="flex flex-col h-full min-h-full flex-1" style={{ backgroundColor: '#F5F0E8' }}>
      {/* Header - exact copy from ArcadePage */}
      <div className="px-4 pt-4 pb-3 border-b border-warm bg-cream">
        <div className="flex items-center gap-3">
          {onBack && <BackButton onClick={onBack} />}
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">QuizzBattle</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">Challenge players, win their wager.</span>
          </div>
          {/* Open battles button - purple, opens modal like ArcadePage */}
          <button
            onClick={() => user?.id ? setShowOpenBattles(true) : onShowLogin?.()}
            className="battle-header-btn ml-auto relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#6B7280]/40 bg-[#6B7280]/10 hover:bg-[#6B7280]/20 transition-colors"
          >
            <Swords className="w-4 h-4 text-[#6B7280]" />
            <span className="text-xs font-bold text-[#6B7280]">Open Battles</span>
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
            <span className="inline-block px-3 py-1 bg-[#6B7280] text-white font-bold uppercase tracking-wider rounded-full mb-4 text-[10px]">
              Multiplayer
            </span>
            <h2 className="font-display text-white leading-tight mb-2 text-2xl md:text-3xl">
              CHALLENGE PLAYERS<br/>
              <span className="text-[#6B7280]">WIN THEIR WAGER</span>
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
            style={{ background: 'linear-gradient(135deg, #C084FC 0%, #6B7280 50%, #9333EA 100%)' }}
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
            <Trophy className="w-3.5 h-3.5 text-[#6B7280]" />
            Winner takes 2x wager
          </span>
          <span className="text-gray-400">•</span>
          <span className="flex items-center gap-1">
            <RefreshCcw className="w-3.5 h-3.5 text-[#6B7280]" />
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
      {/* Header - same style as Solo Trivia */}
      <div className="px-4 pt-4 pb-3 border-b border-warm bg-cream">
        <div className="relative flex items-center gap-3">
          {onBack && <BackButton onClick={onBack} />}
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">QUIZZBATTLE</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">Challenge others, win coins.</span>
          </div>
          {/* Right side buttons - absolute so their height never grows the header */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          <button
            onClick={() => {
              if (isOnBreak) {
                showAlert('info', 'Battles are disabled during the break (9:55-10:00).');
                return;
              }
              if (!isLoggedIn) {
                showAlert('login', 'Please login to invite friends!', {
                  buttonText: 'LOGIN',
                  onButtonClick: onShowLogin
                });
                return;
              }
              // Navigate to invite screen instead of modal
              setSelectedInviteUser(null);
              setInviteSearchQuery('');
              setInviteSearchResults([]);
              setScreen('invite');
            }}
            disabled={isOnBreak}
            className={`flex items-center gap-1.5 px-3 py-3 border rounded-lg text-[10px] font-semibold tracking-wider transition-colors ${
              isOnBreak
                ? 'border-warm text-gray-300 cursor-not-allowed'
                : 'border-gray-300 text-gray-600 hover:border-[#6B7280] hover:text-[#6B7280]'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>INVITE</span>
          </button>
          <button
            onClick={() => {
              if (isOnBreak) {
                showAlert('info', 'Battles are disabled during the break (9:55-10:00).');
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
            className={`flex items-center gap-1.5 px-3 py-3 rounded-lg text-[10px] font-semibold tracking-wider transition-colors text-white hover:opacity-90 ${
              isOnBreak ? 'bg-skeleton-light text-gray-600 cursor-not-allowed' : ''
            }`}
            style={!isOnBreak ? { backgroundColor: topicFilter !== 'all' ? TOPICS.find(t => t.id === topicFilter)?.color || '#6B7280' : '#6B7280' } : {}}
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
              topicFilter === 'all' ? 'text-white border-transparent bg-gray-500' : 'bg-cream text-gray-500 hover:opacity-80 border-warm'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="font-display text-sm tracking-wider">All</span>
          </button>
          {TOPICS.map(t => {
            const Icon = t.icon;
            const isActive = topicFilter === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTopicFilter(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all border ${
                  isActive ? 'text-white border-transparent' : 'bg-cream text-gray-500 hover:opacity-80 border-warm'
                }`}
                style={isActive ? { backgroundColor: t.color } : {}}
              >
                <Icon className="w-4 h-4" />
                <span className="font-display text-sm tracking-wider">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Wager Filter Buttons */}
      <div className="min-w-0 w-full overflow-hidden border-b border-warm">
        <div className="flex gap-2 px-3 py-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {(() => {
            const activeColor = topicFilter !== 'all' ? TOPICS.find(t => t.id === topicFilter)?.color || '#6B7280' : '#6B7280';
            return (
              <>
                <button
                  onClick={() => setWagerFilter('all')}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg font-display text-sm tracking-wider whitespace-nowrap transition-all border ${
                    wagerFilter === 'all' ? 'text-white border-transparent' : 'bg-cream text-gray-500 hover:opacity-80 border-warm'
                  }`}
                  style={wagerFilter === 'all' ? { backgroundColor: activeColor } : {}}
                >
                  <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                  All
                </button>
                {WAGERS.map(w => (
                  <button
                    key={w.amount}
                    onClick={() => setWagerFilter(w.amount)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg font-display text-sm tracking-wider whitespace-nowrap transition-all border ${
                      wagerFilter === w.amount ? 'text-white border-transparent' : 'bg-cream text-gray-500 hover:opacity-80 border-warm'
                    }`}
                    style={wagerFilter === w.amount ? { backgroundColor: activeColor } : {}}
                  >
                    <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                    {formatCurrency(w.amount)}
                  </button>
                ))}
              </>
            );
          })()}
        </div>
      </div>
      
      {/* Create Battle Fullscreen */}
      {showCreate && (() => {
        const selectedTopic = TOPICS.find(t => t.id === createTopic);
        const topicColor = selectedTopic?.color || '#6B7280';
        const TopicIcon = selectedTopic?.icon || Target;
        return (
        <div className="absolute inset-0 z-[100] overflow-y-auto" style={{ backgroundColor: '#F5F0E8', scrollbarWidth: 'none' }}>
          {/* Header - adapts to selected topic color */}
          <div className="sticky top-0 z-10 px-4 pt-4 pb-3 border-b border-warm bg-cream transition-colors">
            <div className="flex items-center gap-3">
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-black/5 rounded transition-colors">
                <ChevronLeft className="w-5 h-5" style={{ color: topicColor }} />
              </button>
              <TopicIcon className="w-5 h-5" style={{ color: topicColor }} />
              <div>
                <span className="font-display text-lg tracking-wider block leading-none transition-colors" style={{ color: topicColor }}>CREATE BATTLE</span>
                <span className="text-[10px] text-gray-500 -mt-0.5 block">Set wager and topic.</span>
              </div>
            </div>
          </div>
          
          <div className="p-4">
            {/* Step 1: Topic - same as Solo Trivia */}
            <div className="mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Target className="w-4 h-4" style={{ color: topicColor }} />
                <span className="font-display text-base tracking-wider transition-colors" style={{ color: topicColor }}>CHOOSE TOPIC</span>
              </div>
              {/* 3 columns with category images - same style as Solo Trivia */}
              <div className="grid grid-cols-3 gap-2">
                {TOPICS.map(t => {
                  const isSelected = createTopic === t.id;
                  const bgImage = TOPIC_BACKGROUNDS[t.id];
                  return (
                    <button
                      key={t.id}
                      onClick={() => setCreateTopic(t.id)}
                      className="group relative h-20 sm:h-24 rounded-xl transition-all border-2 overflow-hidden"
                      style={{
                        borderColor: isSelected ? t.color : 'transparent',
                        boxShadow: isSelected ? `0 0 0 3px ${t.color}33` : 'none',
                      }}
                    >
                      {/* Artwork */}
                      {bgImage && (
                        <div 
                          className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-110"
                          style={{ backgroundImage: `url('${bgImage}')` }}
                        />
                      )}
                      {/* Gradient overlay - uses category color when selected */}
                      <div 
                        className="absolute inset-0 transition-all duration-300"
                        style={{
                          background: isSelected 
                            ? `linear-gradient(to top, ${t.color} 0%, ${t.color}cc 40%, ${t.color}99 100%)`
                            : 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)'
                        }}
                      />
                      {/* Checkmark badge */}
                      {isSelected && (
                        <span className="absolute top-1.5 right-1.5 z-20 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white flex items-center justify-center shadow">
                          <Check className="w-3 h-3 sm:w-4 sm:h-4" strokeWidth={3} style={{ color: t.color }} />
                        </span>
                      )}
                      {/* Icon + label at bottom left */}
                      <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5">
                        <t.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white/90 drop-shadow" />
                        <span 
                          className={`font-display uppercase tracking-wider text-white drop-shadow-lg transition-all duration-300 group-hover:translate-x-1 ${
                            isSelected ? 'text-sm sm:text-base font-bold' : 'text-xs sm:text-sm'
                          }`}
                        >{t.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Wager - uses topic color */}
            <div className="mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                <span className="font-display text-base tracking-wider transition-colors" style={{ color: topicColor }}>SELECT WAGER</span>
                    </div>
                    {/* 3x2 Grid - compact for mobile */}
                    <div className="grid grid-cols-3 gap-2">
                      {WAGERS.map(w => {
                        const isSelected = createWager === w.amount;
                        return (
                          <button
                            key={w.amount}
                            onClick={() => setCreateWager(w.amount)}
                            className={`relative py-2.5 px-2 rounded-xl transition-all duration-200 ${
                              isSelected
                                ? 'text-white shadow-lg'
                                : 'bg-white border border-warm active:scale-[0.98]'
                            }`}
                            style={isSelected 
                              ? { backgroundColor: topicColor } 
                              : { color: topicColor }
                            }
                          >
                            <div className="flex items-center justify-center gap-1.5 mb-0.5">
                              <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                              <span className="font-display text-lg tracking-wide">
                                {formatCurrency(w.amount)}
                              </span>
                            </div>
                            <div 
                              className="text-[10px] font-bold tracking-wider"
                              style={{ color: isSelected ? 'rgba(255,255,255,0.8)' : `${topicColor}99` }}
                            >
                              {w.rounds} Rounds
                            </div>
                            {isSelected && (
                              <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                                <Check className="w-2.5 h-2.5" style={{ color: topicColor }} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
            
            {/* Prize Pool Preview */}
            <div 
              className="flex items-center justify-between px-3 py-2 rounded-xl mb-3 border transition-colors"
              style={{ backgroundColor: `${topicColor}15`, borderColor: `${topicColor}30` }}
            >
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4" style={{ color: topicColor }} />
                <span className="text-xs font-bold text-gray-700">Prize Pool</span>
              </div>
              <div className="flex items-center gap-1.5">
                <img src="/images/bogxcoin.png" alt="" className="w-5 h-5" />
                <span className="font-display text-xl tabular-nums transition-colors" style={{ color: topicColor }}>{formatCurrency(animPrizePool)}</span>
              </div>
            </div>
            
            {/* Cancel + Start Battle Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-3.5 rounded-xl font-display text-base tracking-widest border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-400 active:scale-[0.99] flex items-center justify-center gap-2 transition-all"
              >
                <X className="w-5 h-5" />
                CANCEL
              </button>
              <button
                onClick={() => handleCreateBattle(false)}
                disabled={isGenerating}
                className={`flex-1 py-3.5 rounded-xl font-display text-base tracking-widest flex items-center justify-center gap-2 transition-all ${
                  isGenerating 
                    ? 'text-white/50 cursor-wait' 
                    : 'text-white shadow-lg active:scale-[0.99] active:brightness-90'
                }`}
                style={{ backgroundColor: isGenerating ? `${topicColor}80` : topicColor }}
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    GENERATING...
                  </>
                ) : (
                  <>
                    <Swords className="w-5 h-5" />
                    OPEN {selectedTopic?.label?.toUpperCase() || 'BATTLE'} BATTLE
                  </>
                )}
              </button>
            </div>
            <p className="text-center text-gray-400 text-[10px] mt-2">Anyone can accept your challenge</p>
          </div>
        </div>
        );
      })()}


      {/* Battle List */}
      <div className={`flex-1 overflow-y-auto overflow-x-hidden p-3 ${isDesktop ? 'grid grid-cols-4 gap-2.5 auto-rows-max' : 'space-y-2'}`} style={{ scrollbarWidth: 'none' }}>
        {loading ? (
          // Skeleton Loading
          <>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <div key={i} className={`p-3 bg-cream border border-warm rounded-xl animate-pulse ${isDesktop ? '' : 'mb-2'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-14 h-14 rounded-full bg-skeleton" />
                  <div className="flex-1">
                    <div className="w-24 h-4 bg-skeleton rounded mb-1" />
                    <div className="w-16 h-3 bg-skeleton-light rounded" />
                  </div>
                </div>
                <div className="flex justify-between items-center mb-2 pt-2 border-t border-warm/50">
                  <div className="w-16 h-4 bg-skeleton-light rounded" />
                  <div className="w-14 h-4 bg-skeleton rounded" />
                </div>
                <div className="flex gap-2">
                  <div className="w-16 h-5 bg-skeleton rounded" />
                  <div className="w-12 h-5 bg-skeleton-light rounded" />
                </div>
                <div className="mt-2 pt-2 border-t border-warm/50">
                  <div className="w-28 h-3 bg-skeleton-light rounded" />
                </div>
              </div>
            ))}
          </>
        ) : isOnBreak ? (
          <div className={`relative overflow-hidden ${isDesktop ? 'col-span-3' : ''}`} style={{ minHeight: '400px' }}>
            {/* Background image */}
            <div 
              className="absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: 'url(/images/Hintergund/break.png)' }}
            />
            
            {/* Content */}
            <div className="relative flex flex-col items-center justify-center text-center px-6 h-full" style={{ paddingTop: '200px', paddingBottom: '80px' }}>
              <div className="flex items-center gap-3 mb-2">
                <img src="/images/coffee-break.svg" alt="" className="w-8 h-8" />
                <div className="text-left">
                  <h3 className="font-display text-base font-bold text-[#6B7280] uppercase tracking-wide">Daily Break</h3>
                  <p className="text-[11px] text-gray-500">9:55 – 10:00 AM</p>
                </div>
              </div>
              
              <p className="text-lg text-gray-800 font-semibold mb-2 mt-4">Relax! We're preparing the next round.</p>
              <p className="text-sm text-gray-500 mb-6 max-w-[320px]">Take a short break and come back at 10:00 for new questions and exciting challenges.</p>
              
              {/* Back at 10:00 card */}
              <div className="flex items-center gap-3 px-5 py-3 bg-white/90 rounded-xl border border-[#6B7280]/20 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-[#6B7280]/15 flex items-center justify-center">
                  <span className="text-[#6B7280] text-lg">⚡</span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-[#6B7280]">Back at 10:00 AM</p>
                  <p className="text-[10px] text-gray-500">New round, new chances to win!</p>
                </div>
              </div>
            </div>
          </div>
        ) : filteredBattles.length === 0 ? (
            (() => {
              // Find alternative battles
              const openBattles = battles.filter(b => b.status === 'open');
              
              // If wager filter is active, find battles with lower wagers in same category
              const lowerWagerBattles = wagerFilter !== 'all' && topicFilter !== 'all'
                ? openBattles.filter(b => b.topic === topicFilter && b.wager < wagerFilter).slice(0, 3)
                : [];
              
              // If topic filter is active, find battles in other categories
              const otherCategoryBattles = topicFilter !== 'all'
                ? openBattles.filter(b => b.topic !== topicFilter).slice(0, 3)
                : [];
              
              const activeColor = topicFilter !== 'all' ? TOPICS.find(t => t.id === topicFilter)?.color || '#6B7280' : '#6B7280';
              
              return (
                <div className={`flex flex-col items-center justify-center py-12 px-4 ${isDesktop ? 'col-span-4' : ''}`}>
                  <Swords className="w-12 h-12 text-gray-200 mb-3" />
                  <p className="text-gray-500 font-display text-lg tracking-wide mb-1">No open battles</p>
                  <p className="text-gray-400 text-sm text-center mb-4">Be the first to create a challenge!</p>
                  
                  <div className="flex gap-2 mb-6">
                    <button
                      onClick={() => loadBattles()}
                      className="px-3 py-2 bg-cream border border-warm text-gray-600 text-sm font-display tracking-wide hover:bg-skeleton-light transition-colors flex items-center gap-2 rounded-lg"
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
                        setSelectedInviteUser(null);
                        setInviteSearchQuery('');
                        setInviteSearchResults([]);
                        setScreen('invite');
                      }}
                      className="px-3 py-2 border border-gray-300 text-gray-700 text-sm font-display tracking-wide hover:opacity-80 transition-colors rounded-lg"
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
                        if (topicFilter !== 'all') {
                          setCreateTopic(topicFilter);
                        }
                        setShowCreate(true);
                      }}
                      className="px-3 py-2 text-white text-sm font-display tracking-wide hover:opacity-90 transition-colors flex items-center gap-1 rounded-lg"
                      style={{ backgroundColor: activeColor }}
                    >
                      <Plus className="w-4 h-4" />
                      Create
                    </button>
                  </div>
                  
                </div>
              );
            })()
        ) : (
          filteredBattles.map((battle: Battle) => {
            const topic = getTopicConfig(battle.topic);
            const isMyBattle = battle.creator._id === user?.id;
            // For your own invitations show WHO you challenged, not yourself
            const challengedInfo = (battle.challengedUser && typeof battle.challengedUser === 'object')
              ? (battle.challengedUser as any)
              : null;
            const displayUser: any = (isMyBattle && challengedInfo) ? challengedInfo : battle.creator;
            const creatorCoins = displayUser.bogxCoins || 0;
            const creatorRank = displayUser.rank || '-';
            
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
                onClick={() => { if (isMyBattle) { setSelectedOwnBattle(battle); } else { showBattleIntro(battle); } }}
                className={`group p-3 border rounded-xl cursor-pointer transform transition-all duration-200 ease-out hover:scale-[1.01] hover:-translate-y-0.5 hover:shadow-lg ${
                  isMyBattle 
                    ? 'bg-gray-50' 
                    : 'border-warm bg-cream'
                }`}
                style={{
                  borderColor: isMyBattle ? `${topic.color}40` : undefined
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = topic.color;
                  e.currentTarget.style.boxShadow = `0 8px 20px -5px ${topic.color}20`;
                  e.currentTarget.style.backgroundColor = `${topic.color}08`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = isMyBattle ? `${topic.color}40` : '#E5E0D8';
                  e.currentTarget.style.boxShadow = '';
                  e.currentTarget.style.backgroundColor = '';
                }}
              >
                {/* Top Row: Avatar + Name */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <div 
                      className="w-14 h-14 rounded-full overflow-hidden border-3 transition-colors duration-200"
                      style={{ borderColor: `${topic.color}40` }}
                    >
                      <img src={displayUser.avatar} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                    </div>
                    <div className="absolute -bottom-0.5 -left-0.5">
                      <CountryFlag flag={displayUser.countryFlag} className="w-5 h-4 rounded-sm shadow-sm" />
                    </div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-cream" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-lg text-gray-900 tracking-wide leading-tight truncate">
                      {isMyBattle && challengedInfo && <span className="text-gray-400 text-xs mr-1">vs</span>}
                      {displayUser.username}
                    </div>
                    <div className="font-display text-xs text-gray-500 flex items-center gap-1.5 tracking-wide">
                      <span>Rank #{creatorRank}</span>
                      <span className="flex items-center gap-0.5">
                        <img src="/images/bogxcoin.png" alt="" className="w-3 h-3" />
                        {formatCurrency(creatorCoins)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Middle Row: Rounds + Wager */}
                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-warm/50">
                  <div className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" style={{ color: topic.color }} />
                    <span className="font-display text-gray-900 text-sm">{battle.rounds}</span>
                    <span className="font-display text-gray-500 text-xs tracking-wide">Rounds</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-display text-base text-gray-900">{formatCurrency(toBOGX(battle.wager))}</span>
                    <img src="/images/bogxcoin.png" alt="BOGX" className="w-4 h-4" />
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:translate-x-0.5 transition-transform duration-200" />
                  </div>
                </div>
                
                {/* Topic Badge Row */}
                <div className="flex items-center gap-2 mt-2.5">
                  <span 
                    className="text-[9px] font-bold tracking-wider uppercase px-2 py-1 rounded flex items-center gap-1 text-white"
                    style={{ backgroundColor: topic.color }}
                  >
                    {topic.icon && <topic.icon className="w-2.5 h-2.5" />}
                    {topic.label}
                  </span>
                  {isMyBattle && (
                    <span className="text-[9px] font-bold tracking-wider bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      YOURS
                    </span>
                  )}
                  {battle.isPrivate && (
                    <Lock className="w-3 h-3 text-gray-400" />
                  )}
                </div>
                
                {/* Date/Time Footer */}
                <div className="mt-2 pt-2 border-t border-warm/50 flex items-center gap-1.5 text-gray-400 text-[10px]">
                  <Clock className="w-3 h-3" />
                  <span>{fullDate} • {fullTime}</span>
                </div>
              </div>
            ) : (
              /* Mobile Card - Original compact design */
              <div
                key={battle._id}
                onClick={() => { if (isMyBattle) { setSelectedOwnBattle(battle); } else { showBattleIntro(battle); } }}
                className={`p-4 border-2 rounded-2xl transition-all cursor-pointer ${
                  isMyBattle 
                    ? 'bg-gray-50' 
                    : 'border-warm bg-cream hover:shadow-md'
                }`}
                style={{
                  borderColor: isMyBattle ? `${topic.color}60` : undefined
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2" style={{ borderColor: `${topic.color}50` }}>
                      <img src={displayUser.avatar} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-cream" />
                    <div className="absolute -bottom-1 -left-1">
                      <CountryFlag flag={displayUser.countryFlag} className="w-5 h-4 rounded-sm shadow-sm" />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-xl font-display text-gray-900 leading-tight tracking-wide">
                      {isMyBattle && challengedInfo && <span className="text-gray-400 text-xs mr-1">vs</span>}
                      {displayUser.username}
                    </div>
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
                    <span className="font-display text-xl text-gray-900">{formatCurrency(toBOGX(battle.wager))}</span>
                    <img src="/images/bogxcoin.png" alt="BOGX" className="w-5 h-5" />
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                  </div>
                </div>
                
                {isMyBattle && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: `${topic.color}20` }}>
                    {battle.isPrivate && (
                      <span className="text-[10px] font-bold tracking-wider px-2 py-1 rounded-lg flex items-center gap-1" style={{ color: topic.color, backgroundColor: `${topic.color}15` }}>
                        <Lock className="w-3 h-3" /> PRIVATE
                      </span>
                    )}
                    <span className="text-[10px] font-bold tracking-wider px-2 py-1 rounded-lg" style={{ color: topic.color, backgroundColor: `${topic.color}15` }}>
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
  // INVITE SCREEN - Same style as Create Battle
  // ═══════════════════════════════════════════════════════════════
  
  // Fetch online players for invite screen
  useEffect(() => {
    if (screen !== 'invite') return;
    
    const fetchPlayers = async () => {
      setInviteLoadingOnline(true);
      try {
        const filterParam = invitePlayerFilter === 'online' ? '&filter=online' : '';
        const res = await fetch(`/api/users/online?limit=50&exclude=${user?.id || ''}${filterParam}`);
        const data = await res.json();
        if (data.success) {
          // Filter by selected filter
          let players = data.users || [];
          // Exclude self (backup in case API didn't)
          players = players.filter((p: any) => p._id !== user?.id);
          if (invitePlayerFilter === 'online') {
            players = players.filter((p: any) => p.isOnline);
          }
          // Filter by selected countries
          // countryFlag can be emoji (🇩🇪) or ISO code (DE)
          if (inviteSelectedCountries.length > 0) {
            const flagEmojiToCode = (flag: string): string | null => {
              if (!flag) return null;
              if (flag.length === 2 && flag.charCodeAt(0) < 127) return flag.toUpperCase();
              const cps = Array.from(flag).map(c => c.codePointAt(0) ?? 0);
              if (cps.length >= 2 && cps[0] >= 0x1f1e6 && cps[0] <= 0x1f1ff) {
                const a = String.fromCharCode(cps[0] - 0x1f1e6 + 65);
                const b = String.fromCharCode(cps[1] - 0x1f1e6 + 65);
                return a + b;
              }
              return null;
            };
            players = players.filter((p: any) => {
              const code = flagEmojiToCode(p.countryFlag);
              return code && inviteSelectedCountries.includes(code);
            });
          }
          setInviteOnlinePlayers(players);
        }
      } catch {
        setInviteOnlinePlayers([]);
      } finally {
        setInviteLoadingOnline(false);
      }
    };
    
    fetchPlayers();
  }, [screen, invitePlayerFilter, inviteSelectedCountries, user?.id, user?.country]);
  
  // Search users for invite
  useEffect(() => {
    if (screen !== 'invite' || !inviteSearchQuery.trim()) {
      setInviteSearchResults([]);
      return;
    }
    
    const searchUsers = async () => {
      setInviteIsSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(inviteSearchQuery)}&exclude=${user?.id || ''}`);
        const data = await res.json();
        if (data.success) {
          setInviteSearchResults(data.users || []);
        }
      } catch {
        setInviteSearchResults([]);
      } finally {
        setInviteIsSearching(false);
      }
    };
    
    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [screen, inviteSearchQuery, user?.id]);
  
  // Reset invite step when entering invite screen
  useEffect(() => {
    if (screen === 'invite') {
      setInviteStep(1);
      setSelectedInviteUser(null);
    }
  }, [screen]);

  // Rematch: same opponent, topic and wager, sent straight away. Lands on the same
  // step 4 (preparing) as "PREPARE QUESTIONS" in the invite flow - the challenger
  // answers first, then the opponent is notified (a bot answers immediately).
  const startRematch = (target: ChallengeTarget) => {
    if (!target.topic || !target.wager) return;
    const invitee = { _id: target.id, username: target.username, avatar: target.avatar, countryFlag: target.countryFlag };
    setCreateTopic(target.topic);
    setCreateWager(target.wager);
    setSelectedInviteUser(invitee);
    setScreen('invite');
    setInviteStep(4);
    handleChallengeUser(invitee, target.wager, target.topic);
  };

  // Each target object is acted on once. Without this guard a dev-mode double
  // effect (or a re-render before the parent clears the prop) would send the
  // rematch twice and park two wagers.
  const handledTargetRef = useRef<ChallengeTarget | null>(null);

  // Handle pre-selected challenge target (PlayerCard "Challenge", or a rematch)
  useEffect(() => {
    if (challengeTarget && user?.id && handledTargetRef.current !== challengeTarget) {
      handledTargetRef.current = challengeTarget;
      if (challengeTarget.topic && challengeTarget.wager) {
        startRematch(challengeTarget);
      } else {
        // Pre-select the player and go to invite flow step 2 (topic selection).
        // avatar/countryFlag come along so the rest of the flow (preview, VS
        // banner, preparing screen) shows the real photo instead of a monogram.
        setSelectedInviteUser({ _id: challengeTarget.id, username: challengeTarget.username, avatar: challengeTarget.avatar, countryFlag: challengeTarget.countryFlag });
        setInviteStep(2);
        setScreen('invite');
      }
      onChallengeTargetHandled?.();
    }
  }, [challengeTarget, user?.id, onChallengeTargetHandled]);

  // Rank / balance / battle record for the two players on the scoreboard.
  // Keyed by user id so the banner can render both sides from one request.
  useEffect(() => {
    const opponentId = selectedInviteUser?._id;
    if (!opponentId || !user?.id || inviteStep < 2) return;
    let cancelled = false;
    fetch(`/api/users/battle-info?ids=${user.id},${opponentId}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled || !data.success) return;
        const byId: Record<string, any> = {};
        for (const p of data.players || []) byId[p._id] = p;
        setScoreboardInfo(byId);
        setScoreboardH2H(data.h2h ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedInviteUser?._id, user?.id, inviteStep]);

  const handleSelectPlayer = (player: any) => {
    setSelectedInviteUser(player);
    setPendingTopic(null);
    setInviteStep(2);
  };

  // Selection only - step 2 is confirmed by handleConfirmTopic below.
  const handleSelectTopic = (topicId: string) => {
    setPendingTopic(topicId);
  };

  const handleConfirmTopic = () => {
    if (!pendingTopic) return;
    setCreateTopic(pendingTopic);
    setInviteStep(3);
  };

  const handleInviteBack = async () => {
    if (inviteStep === 1) {
      setScreen('pool');
    } else if (inviteStep === 4) {
      // Cancel the battle and refund the wager before going back
      if (currentBattle && user?.id && !hasStartedBattle) {
        setGivingUp(true);
        try {
          const res = await fetch(`/api/battles/${currentBattle._id}/forfeit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oderId: user.id }),
          });
          const data = await res.json();
          if (data.success && data.cancelled) {
            onCoinAnimation?.(data.refunded ?? toBOGX(currentBattle.wager), 'hold');
          }
        } catch (error) {
          console.error('Failed to cancel battle:', error);
        } finally {
          setGivingUp(false);
          window.dispatchEvent(new CustomEvent('bogx-updated'));
          setCurrentBattle(null);
          setSentBattleId(null);
          loadBattles();
        }
      }
      // Go back to Choose Wager (step 3)
      setInviteStep(3);
    } else {
      // Returning to step 2 must keep the topic selected, otherwise the tile
      // highlight and the Continue button reset for no visible reason.
      if (inviteStep === 3) setPendingTopic(createTopic);
      setInviteStep((inviteStep - 1) as 1 | 2 | 3 | 4);
    }
  };

  // Rank + wallet under a scoreboard name. Renders nothing until the data is in, so
  // the banner never shows a "#—" placeholder that then jumps.
  //
  // The overall battle record used to sit here as "60W 103L", which was both cryptic
  // and irrelevant next to THIS opponent - it moved into the head-to-head pill in the
  // middle of the scoreboard, where a win count actually means something.
  const ScoreboardInfo = ({ userId }: { userId?: string }) => {
    const info = userId ? scoreboardInfo[userId] : undefined;
    if (!info) return null;
    return (
      <div className="flex items-center justify-center gap-1.5 md:gap-2">
        <span className="flex items-center gap-0.5 px-1.5 py-0.5 md:px-2 rounded-md bg-white/25 font-display text-[11px] md:text-base text-white tracking-wider leading-none">
          <Trophy className="w-2.5 h-2.5 md:w-3.5 md:h-3.5" />
          {info.rank}
        </span>
        <span className="flex items-center gap-1 font-display text-[11px] md:text-base text-white tracking-wider leading-none">
          <img src="/images/bogxcoin.png" alt="" className="w-3 h-3 md:w-4 md:h-4" />
          {formatCurrency(info.coins)}
        </span>
      </div>
    );
  };

  // One side of the scoreboard: avatar, name and stats STACKED in their own column.
  // Laid out horizontally (avatar next to name next to stats) everything fought for
  // the same line and got squeezed on mobile - name truncated to 70px while the rank
  // and balance shrank to 9px next to it.
  const ScoreboardSide = ({ userId, username, avatar }: { userId?: string; username?: string; avatar?: string }) => (
    <div className="flex-1 min-w-0 flex flex-col items-center gap-1 md:gap-2">
      <div className="w-12 h-12 md:w-[72px] md:h-[72px] rounded-full overflow-hidden border-2 border-white/40 shadow-lg flex-shrink-0">
        {avatar ? (
          <img src={avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-white/20 flex items-center justify-center text-white font-display text-lg md:text-2xl">
            {username?.[0]?.toUpperCase() || '?'}
          </div>
        )}
      </div>
      <span className="w-full text-center font-display text-sm md:text-2xl text-white tracking-wider truncate leading-none">
        {username?.toUpperCase() || 'YOU'}
      </span>
      <ScoreboardInfo userId={userId} />
    </div>
  );

  // Match facts as a fixed three-slot strip along the bottom of the scoreboard.
  //
  // These used to be pills stacked under the VS, added one per step (topic on 2,
  // head-to-head, rounds on 3). The centre column therefore grew with every click and
  // pushed the players around - the layout was different on every screen. The slots
  // now always exist and only their VALUES fill in, so nothing moves.
  const ScoreboardMeta = ({ meId, opponentId, topicLabel, rounds }: {
    meId?: string;
    opponentId?: string;
    topicLabel?: string | null;
    rounds?: number | null;
  }) => {
    const mine = meId ? scoreboardH2H?.wins[meId] ?? 0 : 0;
    const theirs = opponentId ? scoreboardH2H?.wins[opponentId] ?? 0 : 0;
    const h2h = !scoreboardH2H ? '—' : scoreboardH2H.total > 0 ? `${mine} : ${theirs}` : 'First time';

    const cells: { label: string; value: string }[] = [
      { label: 'Topic', value: topicLabel || '—' },
      { label: 'Head 2 Head', value: h2h },
      { label: 'Rounds', value: rounds ? String(rounds) : '—' },
    ];

    return (
      <div className="relative mt-2 md:mt-4 pt-2 md:pt-3 border-t border-white/20 flex items-stretch">
        {cells.map((cell, i) => (
          <div
            key={cell.label}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 ${
              i > 0 ? 'border-l border-white/15' : ''
            }`}
          >
            <span className="font-display text-[7px] md:text-[9px] text-white/60 uppercase tracking-widest whitespace-nowrap">
              {cell.label}
            </span>
            <span className="font-display text-[11px] md:text-base text-white uppercase tracking-wider leading-none truncate max-w-full">
              {cell.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderInviteScreen = () => {
    // Neutral until the topic is actually settled. `createTopic` defaults to
    // 'sport', so keying this off step 2 would already paint the header red while
    // the user is still choosing.
    const headerColor = inviteStep >= 3 ? getTopicColor(createTopic) : '#6B7280';
    return (
    <div className="flex flex-col h-full min-h-full flex-1" style={{ backgroundColor: '#F5F0E8' }}>
      {/* Header - neutral cream like every other section header. The topic colour
          it used to take (headerColor) is still carried by the content below; only
          the header bar itself is no longer tinted. */}
      <div className="px-4 pt-4 pb-3 border-b border-warm bg-cream">
        <div className="flex items-center gap-3">
          <button onClick={handleInviteBack} className="p-1 rounded transition-colors hover:bg-black/5">
            <ChevronLeft className="w-5 h-5 transition-colors" style={{ color: headerColor }} />
          </button>
          <Swords className="w-5 h-5 transition-colors" style={{ color: headerColor }} />
          <div className="flex-1">
            {/* Title and step counter take the topic colour from step 3 on, like
                the icon and the back arrow. Steps 1-2 stay neutral (gray-900 /
                gray-500) because no topic is settled yet. */}
            <span
              className="font-display text-lg tracking-wider block leading-none transition-colors"
              style={{ color: inviteStep >= 3 ? headerColor : '#111827' }}
            >
              {inviteStep === 1 && 'Select Player'}
              {inviteStep === 2 && 'Choose Topic'}
              {inviteStep === 3 && 'Choose Wager'}
              {inviteStep === 4 && 'Battle Setup'}
            </span>
            <span
              className="font-display text-[11px] tracking-wide block transition-colors"
              style={{ color: inviteStep >= 3 ? `${headerColor}B3` : '#6B7280' }}
            >
              {inviteStep === 4 ? 'Preparing questions' : `Step ${inviteStep} of 3`}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Step 1: Select Player */}
        {inviteStep === 1 && (
          <>
            {/* Filter Tabs + Search in one row */}
            <div className="relative flex gap-2 mb-3">
              {/* Online Filter */}
              <button
                onClick={() => setInvitePlayerFilter(invitePlayerFilter === 'online' ? 'all' : 'online')}
                className={`py-2 px-3 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  invitePlayerFilter === 'online'
                    ? 'bg-[#6B7280] text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${invitePlayerFilter === 'online' ? 'bg-green-400' : 'bg-green-500'}`} /> Online
              </button>
              
              {/* Country Filter with Dropdown */}
              <div>
                <button
                  onClick={() => setShowCountryPicker(!showCountryPicker)}
                  className={`py-2 px-3 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    inviteSelectedCountries.length > 0
                      ? 'bg-[#6B7280] text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  {inviteSelectedCountries.length > 0 ? `${inviteSelectedCountries.length} Countries` : 'Country'}
                  <ChevronDown className="w-3 h-3" />
                </button>
                
                {/* Country Picker Dropdown - Full width, no scroll */}
                {showCountryPicker && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 overflow-visible">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-gray-100">
                      <span className="text-xs font-display font-medium text-gray-900">SELECT COUNTRIES</span>
                      {inviteSelectedCountries.length > 0 && (
                        <button
                          onClick={() => setInviteSelectedCountries([])}
                          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                        >
                          Clear all ({inviteSelectedCountries.length})
                        </button>
                      )}
                    </div>
                    
                    {/* Country Grid - responsive, fixed layout */}
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1">
                      {[
                        { code: 'DE', name: 'Germany' },
                        { code: 'AT', name: 'Austria' },
                        { code: 'CH', name: 'Switzerland' },
                        { code: 'GB', name: 'UK' },
                        { code: 'FR', name: 'France' },
                        { code: 'IT', name: 'Italy' },
                        { code: 'ES', name: 'Spain' },
                        { code: 'PT', name: 'Portugal' },
                        { code: 'NL', name: 'Netherlands' },
                        { code: 'BE', name: 'Belgium' },
                        { code: 'PL', name: 'Poland' },
                        { code: 'SE', name: 'Sweden' },
                        { code: 'NO', name: 'Norway' },
                        { code: 'DK', name: 'Denmark' },
                        { code: 'FI', name: 'Finland' },
                        { code: 'IE', name: 'Ireland' },
                        { code: 'US', name: 'USA' },
                        { code: 'CA', name: 'Canada' },
                        { code: 'MX', name: 'Mexico' },
                        { code: 'BR', name: 'Brazil' },
                        { code: 'AR', name: 'Argentina' },
                        { code: 'AU', name: 'Australia' },
                        { code: 'NZ', name: 'New Zealand' },
                        { code: 'JP', name: 'Japan' },
                      ].map(country => {
                        const isSelected = inviteSelectedCountries.includes(country.code);
                        return (
                          <button
                            key={country.code}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isSelected) {
                                setInviteSelectedCountries(inviteSelectedCountries.filter(c => c !== country.code));
                              } else {
                                setInviteSelectedCountries([...inviteSelectedCountries, country.code]);
                              }
                            }}
                            className={`flex items-center gap-1 px-1 py-1 rounded text-left transition-all border ${
                              isSelected 
                                ? 'bg-[#6B7280] text-white border-[#6B7280]' 
                                : 'bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <CountryFlag flag={country.code} className="w-4 h-3 rounded-[2px] flex-shrink-0" />
                            <span className={`text-[10px] truncate ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                              {country.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Level Filter */}
              <button
                onClick={() => setInvitePlayerFilter(invitePlayerFilter === 'level' ? 'all' : 'level')}
                className={`py-2 px-3 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  invitePlayerFilter === 'level'
                    ? 'bg-[#6B7280] text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" /> Level
              </button>
              
              {/* Search Input */}
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by username..."
                  value={inviteSearchQuery}
                  onChange={(e) => setInviteSearchQuery(e.target.value)}
                  className="w-full h-full pl-9 pr-3 py-2 rounded-lg border border-warm bg-cream text-xs focus:outline-none focus:border-[#6B7280]"
                />
              </div>
            </div>
            
            {/* Click outside to close country picker */}
            {showCountryPicker && (
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowCountryPicker(false)}
              />
            )}
            
            {/* Player List - cards on desktop, list on mobile */}
            <div className="overflow-y-auto" style={{ scrollbarWidth: 'none', maxHeight: 'calc(100vh - 280px)' }}>
              {inviteLoadingOnline || inviteIsSearching ? (
                // Skeleton loading placeholders
                <div className={`${isDesktop ? 'grid grid-cols-4 gap-2.5' : 'bg-white border border-warm rounded-xl overflow-hidden shadow-sm divide-y divide-warm/30'}`}>
                  {Array.from({ length: isDesktop ? 12 : 8 }).map((_, i) => (
                    <div key={i} className={`animate-pulse ${isDesktop ? 'p-3 bg-cream border border-warm rounded-xl' : 'flex items-center gap-3 px-3 py-2.5'}`}>
                      {isDesktop ? (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-10 h-10 rounded-full bg-skeleton" />
                            <div className="flex-1 space-y-1">
                              <div className="h-3 w-20 bg-skeleton rounded" />
                              <div className="h-2 w-14 bg-skeleton-light rounded" />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-9 h-9 rounded-full bg-skeleton" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 w-24 bg-skeleton rounded" />
                            <div className="h-2 w-16 bg-skeleton-light rounded" />
                          </div>
                          <div className="h-3 w-12 bg-skeleton rounded" />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (inviteSearchQuery ? inviteSearchResults : inviteOnlinePlayers).length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">No players found</div>
              ) : isDesktop ? (
                // Desktop: Card grid like battle pool
                <div className="grid grid-cols-4 gap-2.5">
                  {(inviteSearchQuery ? inviteSearchResults : inviteOnlinePlayers).map((player: any) => {
                    const isOnline = player.isOnline;
                    const totalBattles = (player.battlesWon || 0) + (player.battlesLost || 0);
                    const winRate = totalBattles > 0 ? Math.round((player.battlesWon / totalBattles) * 100) : 0;
                    const h2h = player.h2h;
                    return (
                      <button
                        key={player._id}
                        onClick={() => handleSelectPlayer(player)}
                        className={`relative p-3 bg-cream border-2 rounded-xl transition-all duration-200 active:scale-[0.97] text-left group ${
                          isOnline 
                            ? 'border-warm hover:border-[#6B7280] hover:bg-white hover:shadow-xl hover:-translate-y-1' 
                            : 'border-gray-200 opacity-50 hover:opacity-70'
                        }`}
                      >
                        {/* Online indicator - subtle line top right corner */}
                        {isOnline && (
                          <div className="absolute top-0 right-0 w-6 h-1 bg-green-500 rounded-bl rounded-tr-xl" />
                        )}
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-warm bg-white flex-shrink-0 group-hover:border-[#6B7280] transition-colors">
                            {player.avatar ? (
                              <img src={player.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-bold">
                                {player.username?.[0]?.toUpperCase() || '?'}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              {player.countryFlag && <CountryFlag flag={player.countryFlag} className="w-4 h-3 flex-shrink-0" />}
                              <span className="font-display text-sm tracking-wide text-gray-900 truncate group-hover:text-[#6B7280] transition-colors">{player.username}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <span className="font-medium">#{player.rank || '—'}</span>
                              <span className="flex items-center gap-0.5">
                                <img src="/images/bogxcoin.png" alt="" className="w-3 h-3" />
                                {(player.points ?? player.bogxCoins ?? 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                        {/* Stats row - always show */}
                        <div className="flex items-center justify-between text-[10px] text-gray-500 border-t border-warm/50 pt-2 mt-1">
                          {/* Battle stats */}
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-0.5">
                              <Swords className="w-3 h-3" />
                              {totalBattles}
                            </span>
                            {totalBattles > 0 && (
                              <span className={`font-medium ${winRate >= 50 ? 'text-green-600' : 'text-gray-500'}`}>
                                {winRate}%
                              </span>
                            )}
                          </div>
                          {/* H2H - form circles like football */}
                          {h2h && (h2h.wins > 0 || h2h.losses > 0) ? (() => {
                            const results: ('W' | 'L')[] = [];
                            for (let i = 0; i < h2h.wins; i++) results.push('W');
                            for (let i = 0; i < h2h.losses; i++) results.push('L');
                            const display = results.slice(0, 5);
                            return (
                              <div className="flex items-center gap-0.5">
                                {display.map((r, i) => (
                                  <div
                                    key={i}
                                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${
                                      r === 'W' ? 'bg-green-500' : 'bg-red-500'
                                    }`}
                                  >
                                    {r}
                                  </div>
                                ))}
                              </div>
                            );
                          })() : (
                            <span className="text-gray-400 italic">No H2H yet</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                // Mobile: List view
                <div className="bg-white border border-warm rounded-xl overflow-hidden shadow-sm">
                  {(inviteSearchQuery ? inviteSearchResults : inviteOnlinePlayers).map((player: any) => (
                    <button
                      key={player._id}
                      onClick={() => handleSelectPlayer(player)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 border-b border-warm/30 last:border-b-0 transition-colors hover:bg-[#6B7280]/5"
                    >
                      <div className="w-9 h-9 rounded-full overflow-hidden border border-warm bg-cream flex-shrink-0">
                        {player.avatar ? (
                          <img src={player.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-bold">
                            {player.username?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 flex items-center gap-2 text-left min-w-0">
                        <span className="font-display text-[13px] tracking-wide text-gray-900 truncate">{player.username}</span>
                        {player.countryFlag && <CountryFlag flag={player.countryFlag} className="w-4 h-3 flex-shrink-0" />}
                        {player.isOnline && <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />}
                        <span className="ml-auto flex items-center gap-1 font-display text-sm tracking-wide text-gray-700 flex-shrink-0">
                          <img src="/images/bogxcoin.png" alt="" className="w-3.5 h-3.5" />
                          {(player.points ?? player.bogxCoins ?? 0).toFixed(2)}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Step 2: Choose Topic */}
        {inviteStep === 2 && (() => {
          const picked = TOPICS.find(t => t.id === pendingTopic);
          const stepColor = picked?.color || '#6B7280';
          return (
          <>
            {/* VS Banner - the same scoreboard the wager step (3) and the hero of
                step 4 show, so the matchup is established from the moment a player
                is picked and does not appear out of nowhere one step later. Until a
                topic is chosen the colour stays neutral and the topic pill is a
                dashed placeholder, so nothing moves when step 3 fills it in. */}
            {selectedInviteUser && (
              <div 
                className="relative rounded-xl p-3 md:p-5 mb-3 md:mb-4 overflow-hidden shadow-lg flex flex-col justify-center min-h-[150px] md:min-h-[196px] transition-colors duration-300"
                style={{ backgroundColor: stepColor }}
              >
                {picked && TOPIC_BACKGROUNDS[picked.id] && (
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-20"
                    style={{ backgroundImage: `url('${TOPIC_BACKGROUNDS[picked.id]}')` }}
                  />
                )}
                <div className="relative">
                  <div className="flex items-center justify-between gap-1 md:gap-4 px-1 md:px-6">
                    <ScoreboardSide userId={user?.id} username={user?.username} avatar={user?.avatar} />
                    <span className="font-display text-2xl md:text-5xl text-white/80 tracking-wider leading-none shrink-0">VS</span>
                    <ScoreboardSide
                      userId={selectedInviteUser._id}
                      username={selectedInviteUser.username}
                      avatar={selectedInviteUser.avatar}
                    />
                  </div>
                  {/* Rounds stay empty here - the wager on the next step decides them. */}
                  <ScoreboardMeta
                    meId={user?.id}
                    opponentId={selectedInviteUser._id}
                    topicLabel={picked?.label}
                    rounds={null}
                  />
                </div>
              </div>
            )}
            
            {/* Section title - same shape as the wager step's "SELECT WAGER" */}
            <div className="flex items-center gap-1.5 mb-2">
              <Target className="w-4 h-4 text-gray-600" />
              <span className="font-display text-base tracking-wider text-gray-900">SELECT TOPIC</span>
            </div>

            {/* Same style as Solo Trivia category selection */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {TOPICS.map((t) => {
                const Icon = t.icon;
                const isSelected = pendingTopic === t.id;
                const bgImage = TOPIC_BACKGROUNDS[t.id];
                return (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTopic(t.id)}
                    className="group relative h-20 sm:h-24 rounded-xl transition-all border-2 overflow-hidden"
                    style={{
                      borderColor: isSelected ? t.color : 'transparent',
                      boxShadow: isSelected ? `0 0 0 3px ${t.color}33` : 'none',
                    }}
                  >
                    {/* Artwork */}
                    {bgImage && (
                      <div 
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-110"
                        style={{ backgroundImage: `url('${bgImage}')` }}
                      />
                    )}
                    {/* Gradient overlay - uses category color when selected */}
                    <div 
                      className="absolute inset-0 transition-all duration-300"
                      style={{
                        background: isSelected 
                          ? `linear-gradient(to top, ${t.color} 0%, ${t.color}cc 40%, ${t.color}99 100%)`
                          : 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)'
                      }}
                    />
                    {/* Checkmark badge */}
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5 z-20 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white flex items-center justify-center shadow">
                        <Check className="w-3 h-3 sm:w-4 sm:h-4" strokeWidth={3} style={{ color: t.color }} />
                      </span>
                    )}
                    {/* Icon + label at bottom left */}
                    <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5">
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white/90 drop-shadow" />
                      <span 
                        className={`font-display uppercase tracking-wider text-white drop-shadow-lg transition-all duration-300 group-hover:translate-x-1 ${
                          isSelected ? 'text-sm sm:text-base font-bold' : 'text-xs sm:text-sm'
                        }`}
                      >{t.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Confirm button - same shape as the wager step's PREPARE QUESTIONS,
                disabled until a topic is actually selected. */}
            <button
              onClick={handleConfirmTopic}
              disabled={!pendingTopic}
              className={`w-full py-3.5 rounded-xl text-white font-display text-lg tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 ${
                pendingTopic ? 'active:scale-[0.99] active:brightness-90' : 'opacity-50 cursor-not-allowed'
              }`}
              style={{ backgroundColor: pendingTopic ? stepColor : '#9CA3AF' }}
            >
              {pendingTopic ? 'CONTINUE' : 'SELECT TOPIC'}
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
          );
        })()}

        {/* Step 3: Choose Wager - Bebas Neue Mobile Design */}
        {inviteStep === 3 && (() => {
          const selectedTopic = TOPICS.find(t => t.id === createTopic);
          const topicColor = selectedTopic?.color || '#6B7280';
          return (
          <>
            {/* VS Banner. Mirrors the step 4 hero (PreparingScreen) on purpose -
                same artwork, padding, avatar sizes, avatar/name arrangement and
                the rounds pill in the same spot - so moving between step 3 and 4
                neither resizes nor shifts the scoreboard. The min-height matches
                the hero, which is taller because of its heading and subtitle. */}
            <div 
              className="relative rounded-xl p-3 md:p-5 mb-3 md:mb-4 overflow-hidden shadow-lg flex flex-col justify-center min-h-[150px] md:min-h-[196px]"
              style={{ backgroundColor: topicColor }}
            >
              {TOPIC_BACKGROUNDS[createTopic] && (
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-20"
                  style={{ backgroundImage: `url('${TOPIC_BACKGROUNDS[createTopic]}')` }}
                />
              )}
              <div className="relative">
                <div className="flex items-center justify-between gap-1 md:gap-4 px-1 md:px-6">
                  <ScoreboardSide userId={user?.id} username={user?.username} avatar={user?.avatar} />
                  <span className="font-display text-2xl md:text-5xl text-white/80 tracking-wider leading-none shrink-0">VS</span>
                  <ScoreboardSide
                    userId={selectedInviteUser?._id}
                    username={selectedInviteUser?.username}
                    avatar={selectedInviteUser?.avatar}
                  />
                </div>
                {/* Same three slots as step 2 - only the values differ, so the scoreboard
                    does not change shape between the two screens. */}
                <ScoreboardMeta
                  meId={user?.id}
                  opponentId={selectedInviteUser?._id}
                  topicLabel={selectedTopic?.label}
                  rounds={createWager >= 1.00 ? 5 : 3}
                />
              </div>
            </div>
            
            {/* Section Title - uses topic color */}
            <div className="flex items-center gap-1.5 mb-2">
              <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
              <span className="font-display text-base tracking-wider" style={{ color: topicColor }}>SELECT WAGER</span>
            </div>
            
            {/* Wager Grid - 3x2 compact, uses topic color */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {WAGERS.map(w => {
                const isSelected = createWager === w.amount;
                return (
                  <button
                    key={w.amount}
                    onClick={() => setCreateWager(w.amount)}
                    className={`relative py-2.5 px-2 rounded-xl transition-all duration-200 ${
                      isSelected
                        ? 'text-white shadow-lg'
                        : 'bg-white border border-warm active:scale-[0.98]'
                    }`}
                    style={isSelected ? { backgroundColor: topicColor } : { color: topicColor }}
                  >
                    <div className="flex items-center justify-center gap-1.5 mb-0.5">
                      <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                      <span className="font-display text-lg tracking-wide">
                        {formatCurrency(w.amount)}
                      </span>
                    </div>
                    <div className={`text-[10px] font-bold tracking-wider ${isSelected ? 'text-white/80' : 'opacity-60'}`}>
                      {w.rounds} Rounds
                    </div>
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5" style={{ color: topicColor }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            
            {/* Prize Pool - compact, uses topic color */}
            {(() => {
              const selectedTopic = TOPICS.find(t => t.id === createTopic);
              const topicColor = selectedTopic?.color || '#6B7280';
              return (
                <>
                  <div 
                    className="flex items-center justify-between px-3 py-2 rounded-xl mb-3 border"
                    style={{ backgroundColor: `${topicColor}15`, borderColor: `${topicColor}30` }}
                  >
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4" style={{ color: topicColor }} />
                      <span className="text-xs font-bold text-gray-700">Prize Pool</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <img src="/images/bogxcoin.png" alt="" className="w-5 h-5" />
                      <span className="font-display text-xl tabular-nums" style={{ color: topicColor }}>{formatCurrency(animPrizePool)}</span>
                    </div>
                  </div>
                  
                  {/* Prepare Questions Button */}
                  <button
                    onClick={() => {
                      if (isGenerating) return; // Prevent double-click
                      setInviteStep(4);
                      handleChallengeUser(selectedInviteUser, createWager, createTopic);
                    }}
                    disabled={isGenerating}
                    className={`w-full py-3.5 rounded-xl text-white font-display text-lg tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 active:scale-[0.99] active:brightness-90 ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={{ backgroundColor: topicColor }}
                  >
                    <Play className="w-5 h-5" />
                    {isGenerating ? 'PREPARING...' : 'PREPARE QUESTIONS'}
                  </button>
                  
                  <p className="text-center text-[10px] text-gray-400 mt-2">
                    Answer first, then {selectedInviteUser?.username} gets notified
                  </p>
                </>
              );
            })()}
          </>
        );
        })()}

        {/* Step 4: Preparing Questions - loading animation with topic icon */}
        {inviteStep === 4 && selectedInviteUser && (() => {
          const selectedTopic = TOPICS.find(t => t.id === createTopic);
          const topicColor = selectedTopic?.color || '#6B7280';
          const TopicIcon = selectedTopic?.icon;
          return (
            // -mx-4 cancels PreparingScreen's own px-4: together with the invite
            // container's px-4 the step 4 content sat 32px in while steps 1-3 sit
            // at 16px, so the whole view shifted sideways on the step change.
            <div className="-mx-4 flex flex-col flex-1">
            <PreparingScreen 
              topicColor={topicColor}
              TopicIcon={TopicIcon}
              topicId={createTopic}
              topicLabel={selectedTopic?.label}
              rounds={createWager >= 1.00 ? 5 : 3}
              player1={{ username: user?.username || 'You', avatar: user?.avatar, country: user?.country, countryFlag: user?.countryFlag }}
              player2={{ username: selectedInviteUser.username, avatar: selectedInviteUser.avatar, country: selectedInviteUser.country, countryFlag: selectedInviteUser.countryFlag }}
              subtitle={`Setting up your battle against ${selectedInviteUser.username}`}
              readySubtitle={`Your battle against ${selectedInviteUser.username} is ready`}
              onStart={() => {
                setScreen('countdown');
                setCountdown(3);
                runCountdown();
              }}
              footer={
                <p className="font-display text-sm tracking-wide text-gray-900 flex items-center justify-center gap-1.5">
                  Answer your questions first. 
                  <Bell className="w-3.5 h-3.5 inline" />
                  {selectedInviteUser.username} gets notified and has 24h to respond.
                </p>
              }
            >
              {/* Battle Info Card. Reduced to the prize pool: the banner above
                  already shows both players, and the footer below already says
                  that the opponent gets notified and has 24h - this card used
                  to repeat the avatar, the name AND the notification line. */}
              <div className="w-full bg-cream border border-warm rounded-xl p-4 mb-6">
                <div className="flex items-center justify-center gap-2">
                  <span className="font-display text-sm tracking-wide text-gray-900">Prize Pool</span>
                  <img src="/images/bogxcoin.png" alt="" className="w-6 h-6" />
                  <span className="font-display text-2xl tabular-nums" style={{ color: topicColor }}>{formatCurrency(animPrizePool)}</span>
                </div>
              </div>
            </PreparingScreen>
            </div>
          );
        })()}
        
        {/* Carousel Step Indicators - bottom of body */}
        {inviteStep < 4 && (
          <div className="flex justify-center gap-2 mt-auto pt-4">
            {[1, 2, 3].map(s => (
              <div
                key={s}
                className="w-2.5 h-2.5 rounded-full transition-colors"
                style={{
                  backgroundColor: s === inviteStep
                    ? headerColor
                    : s < inviteStep ? `${headerColor}80` : '#D1D5DB',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // INTRO SCREEN
  // ═══════════════════════════════════════════════════════════════
  const renderIntroScreen = () => {
    // Show loading state while battle is being fetched (e.g. from pendingBattleId)
    if (!currentBattle) {
      return (
        <div className="flex flex-col h-full min-h-[70vh] bg-cream items-center justify-center">
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
        <div className="px-4 pt-4 pb-3 border-b border-warm bg-cream">
          <div className="flex items-center gap-3">
            <BackButton onClick={backToPool} />
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
            <div 
              className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 battle-topic-image"
              style={{ background: `linear-gradient(135deg, ${topic.color}dd 0%, ${topic.color} 100%)` }}
            >
              <topic.icon className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="font-display text-lg tracking-wider text-gray-900 uppercase">{topic.label} Trivia</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><HelpCircle className="w-3.5 h-3.5" /> <span className="font-bold text-gray-900">{currentBattle.rounds}</span> Rounds</span>
                <span className="flex items-center gap-1"><Coins className="w-3.5 h-3.5" /> <span className="font-bold" style={{ color: topic.color }}>{formatCurrency(potAmount)}</span> Pot</span>
                <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> Rank <span className="font-bold text-gray-900">#5</span></span>
              </div>
            </div>
          </div>

          {/* Rules */}
          <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: `${topic.color}08`, borderColor: `${topic.color}15`, borderWidth: 1 }}>
            <div className="flex items-center gap-2 text-gray-700 text-sm mb-2">
              <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: `${topic.color}20` }}>
                <Coins className="w-3.5 h-3.5" style={{ color: topic.color }} />
              </div>
              <span>Your wager is <span className="font-bold">locked</span> until the battle ends.</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700 text-sm">
              <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: `${topic.color}20` }}>
                <Trophy className="w-3.5 h-3.5" style={{ color: topic.color }} />
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
            className="w-full py-3 text-white font-display text-sm tracking-widest flex flex-col items-center justify-center rounded-xl shadow-lg transition-colors hover:opacity-90"
            style={{ backgroundColor: topic.color }}
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
  // PREPARING SCREEN - Shows while accepting battle, user clicks START
  // ═══════════════════════════════════════════════════════════════
  const renderPreparingScreen = () => {
    if (!currentBattle) return null;
    const topic = getTopicConfig(currentBattle.topic);
    const opponent = isCreator 
      ? (currentBattle.opponent || currentBattle.challengedUser as any) 
      : currentBattle.creator;

    return (
      <div className="w-full h-full min-h-full flex-1 flex flex-col" style={{ backgroundColor: '#F5F0E8' }}>
        {/* Header - neutral cream like every other section header */}
        <div className="px-4 pt-4 pb-3 border-b border-warm bg-cream">
          <div className="flex items-center gap-3">
            <button
              onClick={leavePreparing}
              disabled={givingUp}
              className="p-1 rounded transition-colors disabled:opacity-50 hover:bg-black/5"
            >
              {givingUp ? (
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: topic.color }} />
              ) : (
                <ChevronLeft className="w-5 h-5" style={{ color: topic.color }} />
              )}
            </button>
            <Swords className="w-5 h-5" style={{ color: topic.color }} />
            <div>
              <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">QuizzBattle</span>
              <span className="text-[10px] text-gray-500 -mt-0.5 block">Get ready to battle!</span>
            </div>
          </div>
        </div>
        <PreparingScreen
          topicColor={topic.color}
          TopicIcon={topic.icon}
          topicId={topic.id}
          topicLabel={topic.label}
          rounds={currentBattle?.rounds || 5}
          player1={{ username: user?.username || 'You', avatar: user?.avatar, country: user?.country, countryFlag: user?.countryFlag }}
          player2={{ username: opponent?.username || 'Opponent', avatar: opponent?.avatar, country: opponent?.country, countryFlag: opponent?.countryFlag }}
          subtitle={`Preparing battle against ${opponent?.username || 'Opponent'}`}
          readySubtitle={`Battle against ${opponent?.username || 'Opponent'} is ready`}
          dataReady={!isAccepting}
          startLabel="START BATTLE"
          onStart={startFromPreparing}
          onCancel={leavePreparing}
          cancelLabel="CANCEL"
        >
          {/* The Players Card that used to sit here is gone: the banner above
              already shows both avatars, both names and the VS. It only existed
              to label the topic and the round count, which the banner now
              carries as pills (topicLabel/rounds). */}

          {/* Wager -> Prize. The arrow between the two halves is the point of
              this card: the second number is not a separate fact, it is what
              the first one turns into if you win. */}
          <div className="w-full max-w-sm sm:max-w-none bg-cream border border-warm rounded-xl p-3 sm:p-4 mb-3">
            <div className="flex items-center">
              {/* Your Wager */}
              <div className="flex-1 min-w-0 flex flex-col items-center justify-center py-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 shrink-0" />
                  <span className="font-display text-[10px] sm:text-xs text-gray-500 tracking-wider">Your Wager</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-display text-xl sm:text-3xl text-gray-800 tabular-nums">{formatCurrency(toBOGX(currentBattle.wager))}</span>
                  <img src="/images/bogxcoin.png" alt="" className="w-4 h-4 sm:w-6 sm:h-6" />
                </div>
              </div>

              {/* Divider + direction */}
              <div className="shrink-0 flex items-center px-1 sm:px-3">
                <div className="w-px h-10 sm:h-12 bg-warm" />
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mx-1.5 sm:mx-3 shrink-0" />
                <div className="w-px h-10 sm:h-12 bg-warm" />
              </div>

              {/* Winner takes */}
              <div className="flex-1 min-w-0 flex flex-col items-center justify-center py-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" style={{ color: topic.color }} />
                  <span className="font-display text-[10px] sm:text-xs tracking-wider" style={{ color: topic.color }}>Winner Takes</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-display text-xl sm:text-3xl tabular-nums" style={{ color: topic.color }}>{formatCurrency(toBOGX(currentBattle.wager * 2))}</span>
                  <img src="/images/bogxcoin.png" alt="" className="w-4 h-4 sm:w-6 sm:h-6" />
                </div>
              </div>
            </div>
          </div>

          {/* Spells out where the second number comes from - without it "winner
              takes 1,00" on a 0,50 wager looks like free money. */}
          <div className="w-full max-w-sm sm:max-w-none bg-black/[0.035] border border-warm rounded-xl px-3 py-2.5 mb-4 flex items-center justify-center gap-2">
            <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="font-display text-[11px] sm:text-xs tracking-wide text-gray-500">Winner receives the full pot (both wagers).</span>
          </div>
        </PreparingScreen>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // COUNTDOWN SCREEN - Redesigned with standalone animations
  // ═══════════════════════════════════════════════════════════════
  const renderCountdownScreen = () => {
    if (!currentBattle) return null;
    const question = currentBattle.questions[currentRound];
    const topic = getTopicConfig(currentBattle.topic);
    const myCorrectCount = myResults.filter(r => r.correct).length;
    const isGo = countdown === 0;
    
    return (
      <div className="flex flex-col h-full bg-cream p-2 sm:p-4">
        {/* Main Card - fills available height */}
        <div className="flex-1 border border-warm bg-cream rounded-2xl flex flex-col p-4 sm:p-6 shadow-lg animate-[cardIn_0.4s_ease-out] min-h-0">
          
          {/* Players Bar - Compact on mobile */}
          <div className="flex items-stretch border border-warm rounded-xl bg-cream overflow-hidden mb-4">
            {/* You */}
            <div className="flex-1 min-w-0 flex flex-col items-center gap-1 p-2 sm:p-4 border-r border-warm animate-[slideInLeft_0.4s_ease-out_backwards]">
              <div className="w-8 h-8 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 sm:border-3 flex-shrink-0" style={{ borderColor: topic.color }}>
                <img src={user?.avatar || 'https://i.pravatar.cc/80?img=47'} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="font-bold text-[10px] sm:text-lg text-gray-900 truncate">You</div>
              <div className="font-display text-xl sm:text-4xl tracking-wide" style={{ color: topic.color }}>{myCorrectCount}</div>
            </div>

            {/* VS Center */}
            <div className="flex flex-col items-center justify-center gap-1 sm:gap-2 px-1 sm:px-4 py-2 sm:py-4">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg text-[8px] sm:text-[10px] uppercase tracking-wider font-bold whitespace-nowrap" style={{ backgroundColor: `${topic.color}15`, color: topic.color }}>
                <topic.icon className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {topic.label}
              </span>
              <span className="font-display text-xs sm:text-lg text-gray-400 tracking-wider">VS</span>
              {/* Round dots */}
              <div className="flex gap-1 sm:gap-2">
                {Array.from({ length: currentBattle.rounds }).map((_, i) => {
                  const result = myResults[i];
                  const color = result ? (result.correct ? '#10b981' : '#ef4444') : (i === currentRound ? '#9ca3af' : '#e5e7eb');
                  const opacity = i === currentRound && !result ? '0.5' : '1';
                  return (
                    <span 
                      key={i} 
                      className="min-w-[24px] h-6 sm:min-w-[36px] sm:h-8 px-1.5 sm:px-2 rounded-md flex items-center justify-center font-display text-[10px] sm:text-xs tracking-wider text-white"
                      style={{ background: color, opacity }}
                    >
                      R{i + 1}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Opponent */}
            <div className="flex-1 min-w-0 flex flex-col items-center gap-1 p-2 sm:p-4 border-l border-warm animate-[slideInRightBattle_0.4s_ease-out_backwards]">
              <div className="w-8 h-8 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 sm:border-3 border-warm flex-shrink-0">
                {isCreator ? (
                  <img src={currentBattle.opponent?.avatar || (currentBattle.challengedUser as any)?.avatar || 'https://i.pravatar.cc/80?img=12'} alt="" className="w-full h-full object-cover" />
                ) : (
                  <img src={currentBattle.creator.avatar} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="font-bold text-[10px] sm:text-lg text-gray-900 truncate text-center max-w-[80px] sm:max-w-none">
                {isCreator 
                  ? (currentBattle.opponent?.username || (currentBattle.challengedUser as any)?.username || 'Opponent') 
                  : currentBattle.creator.username}
              </div>
              <div className="font-display text-xl sm:text-4xl text-gray-400 tracking-wide">?</div>
            </div>
          </div>

          {/* Timer Row - GET READY / GO style - Same as Solo Trivia */}
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
                      backgroundColor: isActive ? (isGo ? '#10b981' : '#9CA3AF') : '#E5E0D8',
                      boxShadow: isActive ? `0 0 8px ${isGo ? '#10b981' : '#9CA3AF'}` : 'none'
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

          {/* Question Card - no animation, always visible */}
          <div className="border border-warm bg-cream rounded-xl p-4 sm:p-6 mb-4 sm:mb-5 flex items-center justify-center min-h-[90px] sm:min-h-[120px]">
            <h2 className="font-display text-xl sm:text-2xl text-gray-900 text-center leading-snug tracking-wide">
              {question?.question}
            </h2>
          </div>

          {/* Placeholder Answers - 2x2 Grid with "..." */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mb-3 sm:mb-4">
            {[0, 1, 2, 3].map((i) => {
              const delay = `${i * 0.08}s`;
              return (
                <div 
                  key={i} 
                  className="rounded-lg sm:rounded-xl p-3 sm:p-4 min-h-[56px] sm:min-h-[72px] text-sm sm:text-lg font-display tracking-wide flex items-center justify-center text-center bg-cream border-2 border-dashed border-warm text-gray-400 animate-[fadeInUp_0.4s_ease-out_backwards]"
                  style={{ animationDelay: delay }}
                >
                  ···
                </div>
              );
            })}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Feedback Row - Always visible */}
          <div className="flex flex-row items-center justify-between gap-3 sm:gap-4 mt-4 sm:mt-0">
            <div className="px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl font-bold text-sm sm:text-base flex items-center gap-2 bg-gray-200 text-gray-600">
              {isGo ? 'Go!' : 'Get ready…'}
            </div>
            <button
              disabled
              className="px-5 sm:px-8 py-3 sm:py-3.5 bg-gray-200 text-gray-400 font-display text-sm sm:text-base tracking-widest rounded-xl flex items-center gap-2 cursor-not-allowed flex-shrink-0"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // QUIZ SCREEN - Redesigned with standalone layout and animations
  // ═══════════════════════════════════════════════════════════════
  const renderQuizScreen = () => {
    if (!currentBattle) return null;
    const question = currentBattle.questions[currentRound];
    const topic = getTopicConfig(currentBattle.topic);
    const timeSecondsRaw = timeLeft / 1000;
    const timeSecondsDisplay = Math.ceil(timeSecondsRaw); // For display: whole numbers
    const timePct = timeLeft / 10000;
    const filledSegments = Math.round(timePct * 8); // 8 segments like standalone
    const myCorrectCount = myResults.filter(r => r.correct).length;
    const potAmount = toBOGX(currentBattle.wager) * 2;
    
    // Calculate color based on time remaining: >5s gray, 5-3s yellow, <3s red
    const timerColor = timeSecondsRaw > 5 
      ? '#6B7280' 
      : timeSecondsRaw > 3 
        ? '#EAB308' 
        : '#DC2626';
    
    return (
      <div className="flex flex-col h-full bg-cream p-2 sm:p-4">
        {/* Main Card - fills available height */}
        <div className="flex-1 border border-warm bg-cream rounded-2xl flex flex-col p-4 sm:p-6 shadow-lg animate-[cardIn_0.4s_ease-out] min-h-0">
          
          {/* Players Bar - Compact on mobile */}
          <div className="flex items-stretch border border-warm rounded-xl bg-cream overflow-hidden mb-4">
            {/* You */}
            <div className="flex-1 min-w-0 flex flex-col items-center gap-1 p-2 sm:p-4 border-r border-warm animate-[slideInLeft_0.4s_ease-out_backwards]">
              <div className="w-8 h-8 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 sm:border-3 flex-shrink-0" style={{ borderColor: topic.color }}>
                <img src={user?.avatar || 'https://i.pravatar.cc/80?img=47'} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="font-bold text-[10px] sm:text-lg text-gray-900 truncate">You</div>
              <div className="font-display text-xl sm:text-4xl tracking-wide" style={{ color: topic.color }}>{myCorrectCount}</div>
            </div>

            {/* VS Center */}
            <div className="flex flex-col items-center justify-center gap-1 sm:gap-2 px-1 sm:px-4 py-2 sm:py-4">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg text-[8px] sm:text-[10px] uppercase tracking-wider font-bold whitespace-nowrap" style={{ backgroundColor: `${topic.color}15`, color: topic.color }}>
                <topic.icon className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {topic.label}
              </span>
              <span className="font-display text-xs sm:text-lg text-gray-400 tracking-wider">VS</span>
              {/* Round dots */}
              <div className="flex gap-1 sm:gap-2">
                {Array.from({ length: currentBattle.rounds }).map((_, i) => {
                  const result = myResults[i];
                  const color = result ? (result.correct ? '#10b981' : '#ef4444') : (i === currentRound ? '#9ca3af' : '#e5e7eb');
                  const opacity = i === currentRound && !result ? '0.5' : '1';
                  return (
                    <span 
                      key={i} 
                      className="min-w-[24px] h-6 sm:min-w-[36px] sm:h-8 px-1.5 sm:px-2 rounded-md flex items-center justify-center font-display text-[10px] sm:text-xs tracking-wider text-white"
                      style={{ background: color, opacity }}
                    >
                      R{i + 1}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Opponent */}
            <div className="flex-1 min-w-0 flex flex-col items-center gap-1 p-2 sm:p-4 border-l border-warm animate-[slideInRightBattle_0.4s_ease-out_backwards]">
              <div className="w-8 h-8 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 sm:border-3 border-warm flex-shrink-0">
                {isCreator ? (
                  <img src={currentBattle.opponent?.avatar || (currentBattle.challengedUser as any)?.avatar || 'https://i.pravatar.cc/80?img=12'} alt="" className="w-full h-full object-cover" />
                ) : (
                  <img src={currentBattle.creator.avatar} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="font-bold text-[10px] sm:text-lg text-gray-900 truncate text-center max-w-[80px] sm:max-w-none">
                {isCreator 
                  ? (currentBattle.opponent?.username || (currentBattle.challengedUser as any)?.username || 'Opponent') 
                  : currentBattle.creator.username}
              </div>
              <div className="font-display text-xl sm:text-4xl text-gray-400 tracking-wide">?</div>
            </div>
          </div>

          {/* Timer Row - LED style like standalone */}
          <div className="flex items-center gap-2.5 sm:gap-4 mb-4 sm:mb-5">
            <div 
              className={`w-12 h-12 sm:w-16 sm:h-16 rounded-lg sm:rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
                timeSecondsDisplay <= 3 ? 'animate-timer-pulse' : ''
              }`}
              style={{ 
                background: `linear-gradient(135deg, ${timerColor}dd 0%, ${timerColor} 100%)`,
                boxShadow: `inset 0 0 0 2px ${timerColor}40`
              }}
            >
              <span className="font-display text-lg sm:text-2xl text-white animate-[ledPulse_1.6s_ease-in-out_infinite]">
                {String(timeSecondsDisplay).padStart(2, '0')}
              </span>
              <span className="font-display text-[7px] sm:text-[9px] text-white/80 tracking-widest">SEC</span>
            </div>
            <div className="flex-1 flex gap-1 sm:gap-1.5">
              {[...Array(8)].map((_, i) => (
                <span 
                  key={i} 
                  className="h-2.5 sm:h-4 flex-1 rounded transition-all duration-300"
                  style={{ backgroundColor: i < filledSegments ? timerColor : '#E5E0D8' }}
                />
              ))}
            </div>
            {/* Right side: Always show the timer (same as left side, same color) */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <span className="font-display text-xl sm:text-3xl tabular-nums w-7 sm:w-10 text-right" style={{ color: timerColor }}>{timeSecondsDisplay}</span>
              <span className="font-display text-xs sm:text-sm" style={{ color: timerColor, opacity: 0.6 }}>sec</span>
            </div>
          </div>

          {/* Question Card - no animation, always visible */}
          <div className="border border-warm bg-cream rounded-xl p-4 sm:p-6 mb-4 sm:mb-5 flex items-center justify-center min-h-[90px] sm:min-h-[120px]">
            <h2 className="font-display text-xl sm:text-2xl text-gray-900 text-center leading-snug tracking-wide">
              {question?.question}
            </h2>
          </div>

          {/* Answer Buttons - 2x2 Grid */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mb-3 sm:mb-4">
            {question?.answers.map((answer, i) => {
              const delay = `${i * 0.08}s`;
              let className = 'rounded-lg sm:rounded-xl p-3 sm:p-4 min-h-[56px] sm:min-h-[72px] text-base sm:text-xl font-display tracking-wide flex items-center justify-center text-center transition-all cursor-pointer';
              
              if (showAnswer) {
                if (i === question.correctIndex) {
                  // Green for correct
                  className += ' bg-green-500 text-white border-2 border-green-500';
                } else if (i === selectedAnswer && !myResults[currentRound]?.correct) {
                  // Red for wrong
                  className += ' bg-red-500 text-white border-2 border-red-500';
                } else {
                  className += ' bg-cream border-2 border-warm text-gray-400 opacity-60';
                }
              } else {
                className += ' bg-cream text-gray-900 border-2 border-warm hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]';
              }
              
              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={showAnswer}
                  className={`${className} animate-[fadeInUp_0.4s_ease-out_backwards]`}
                  style={{ animationDelay: delay }}
                >
                  <span className="line-clamp-2">{answer}</span>
                </button>
              );
            })}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Feedback + Next Button - Always visible, side by side */}
          <div className="flex flex-row items-center justify-between gap-3 sm:gap-4 mt-4 sm:mt-0">
            {/* Feedback Tag - Always visible */}
            <div 
              className="px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl font-bold text-sm sm:text-base flex items-center gap-2 transition-all"
              style={{
                background: !showAnswer ? '#e5e7eb' : 
                  selectedAnswer === -1 ? '#ef4444' : 
                  myResults[currentRound]?.correct ? '#10b981' : '#ef4444',
                color: showAnswer ? 'white' : '#9ca3af'
              }}
            >
              {!showAnswer ? (
                'Pick an answer'
              ) : selectedAnswer === -1 ? (
                <>
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                  Time's up!
                </>
              ) : myResults[currentRound]?.correct ? (
                <>
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 animate-[popIcon_0.35s_ease-out]" />
                  Correct — +{formatCurrency(myResults[currentRound]?.points || 0)}
                </>
              ) : (
                <>
                  <X className="w-4 h-4 sm:w-5 sm:h-5 animate-[popIcon_0.35s_ease-out]" />
                  Wrong!
                </>
              )}
            </div>

            {/* Next Button - Always visible, gray before answer */}
            <button
              onClick={() => showAnswer ? (currentRound < currentBattle.rounds - 1 ? continueFromInter() : (isCreator ? completeBattle(myResultsRef.current) : seeResultsWithAnimation())) : null}
              disabled={!showAnswer}
              className={`px-5 sm:px-8 py-3 sm:py-3.5 font-display text-sm sm:text-base tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all flex-shrink-0 ${
                showAnswer 
                  ? 'bg-gray-500 text-white hover:bg-gray-600 cursor-pointer' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {currentRound < currentBattle.rounds - 1 ? 'Next' : (isCreator ? 'Submit' : 'Results')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Give up - deliberately small and low-contrast so it isn't hit by accident */}
          <button
            onClick={() => setShowGiveUpConfirm(true)}
            disabled={givingUp}
            className="mx-auto mt-3 flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" />
            Give up
          </button>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // RESULT/INTER SCREEN - Redesigned with standalone layout and animations
  // ═══════════════════════════════════════════════════════════════
  const renderResultScreen = () => {
    if (!currentBattle) return null;
    const topic = getTopicConfig(currentBattle.topic);
    const isComplete = myResults.length >= currentBattle.rounds;
    // Winner = most correct answers; tie-break by fastest total time.
    const cmp = compareBattleResults(myResults, opponentResults);
    const won = cmp > 0;
    const isDraw = cmp === 0;
    const myCorrect = myResults.filter(r => r.correct).length;
    const oppCorrect = opponentResults.filter(r => r.correct).length;
    // The other player from MY side. The creator normally never reaches this
    // screen before the opponent has played, so their side stays hidden ('?') -
    // except vs a bot (e.g. a rematch), which answers the moment the creator submits.
    const oppUser = isCreator ? currentBattle.opponent : currentBattle.creator;
    const oppHidden = isCreator && opponentResults.length === 0;

    // Plain-language reason for the outcome - same wording as BattleResultScreen.
    // Not shown to the creator while the opponent hasn't played yet.
    const opponentName = oppUser?.username || 'Your opponent';
    const myTotalMs = myResults.reduce((sum, r) => sum + (r.timeMs || 0), 0);
    const oppTotalMs = opponentResults.reduce((sum, r) => sum + (r.timeMs || 0), 0);
    const outcomeNote = oppHidden ? null : (() => {
      if (myCorrect !== oppCorrect) {
        const diff = Math.abs(myCorrect - oppCorrect);
        return `${won ? 'You were' : `${opponentName} was`} ${diff} correct answer${diff === 1 ? '' : 's'} ahead.`;
      }
      if (myCorrect === 0) return 'Neither of you got a single answer right — your wager came back.';
      // Gap from the ROUNDED totals shown in the table, so note and table agree
      const shownGap = Math.abs(Number((myTotalMs / 1000).toFixed(1)) - Number((oppTotalMs / 1000).toFixed(1)));
      const gapMs = Math.abs(myTotalMs - oppTotalMs);
      if (gapMs === 0) return `Both ${myCorrect}/${currentBattle.rounds} and exactly the same time — your wager came back.`;
      const gap = shownGap === 0 ? `${Math.round(gapMs)}ms` : `${shownGap.toFixed(1)}s`;
      return `Both ${myCorrect}/${currentBattle.rounds} correct — ${won ? 'you were' : `${opponentName} was`} ${gap} faster over all ${currentBattle.rounds} rounds.`;
    })();
    
    // The result cards colour themselves from won/isDraw directly - the old
    // resultColor/resultBandBg pair died with the solid colour band.
    
    return (
      <div className="flex flex-col h-full bg-cream p-2 sm:p-4">
        {/* Main Card - fills available height */}
        <div className="flex-1 border border-warm bg-cream rounded-2xl flex flex-col p-4 sm:p-6 shadow-lg animate-[cardIn_0.4s_ease-out] min-h-0 overflow-y-auto">
          
          {/* Header Row - topic pill like the Outcome screen (BattleResultScreen) */}
          <div className="flex items-center justify-between mb-4 flex-shrink-0 animate-[fadeIn_0.3s_ease-out]">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg uppercase tracking-wider font-bold"
              style={{ backgroundColor: `${topic.color}15`, color: topic.color, border: `1px solid ${topic.color}30` }}
            >
              <topic.icon className="w-3.5 h-3.5" /> {topic.label}
            </span>
            {!isComplete && (
              <span className="text-sm text-gray-500 font-bold tracking-wider uppercase">
                Round {myResults.length}/{currentBattle.rounds}
              </span>
            )}
          </div>

          {/* Inter-round banner */}
          {!isComplete && (
            <div className="bg-[#6B7280] py-4 sm:py-5 px-4 rounded-xl text-center mb-4 flex-shrink-0 animate-[headlineIn_0.5s_ease-out_backwards]">
              <span className="font-display text-xl sm:text-2xl text-white tracking-wider">
                ROUND {myResults.length} COMPLETE
              </span>
              <div className="text-white/80 text-sm mt-1">
                Your score: {formatCurrency(myTotalPoints)}
              </div>
            </div>
          )}

          {/* Players Comparison - Compact on mobile. Labelled and on bg-white/40
              so every card on this page shares one surface, like Solo Trivia. */}
          {isComplete && <span className={`${resultSectionLabel} block mb-2 flex-shrink-0`}>Players</span>}
          <div className="flex items-stretch border border-warm rounded-xl bg-white/40 overflow-hidden mb-4 flex-shrink-0">
            {/* You */}
            <div className="flex-1 min-w-0 flex items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-5 border-r border-warm animate-[slideInLeft_0.4s_0.2s_ease-out_backwards]">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 border-warm flex-shrink-0">
                  <img src={user?.avatar || 'https://i.pravatar.cc/80?img=47'} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="font-bold text-sm sm:text-base text-gray-900 truncate">You</span>
                    {won && <span className="px-1 sm:px-2 py-0.5 text-white text-[7px] sm:text-[10px] font-bold rounded tracking-wider" style={{ backgroundColor: '#166534' }}>WINNER</span>}
                  </div>
                  <div className="font-display text-[11px] sm:text-xl tracking-wide text-gray-600">{myCorrect}/{currentBattle.rounds} CORRECT</div>
                </div>
              </div>
              <div className="font-display text-2xl sm:text-4xl tracking-wide flex-shrink-0 text-gray-800">{myCorrect}</div>
            </div>

            {/* VS Center. The R1/R2/R3 chips that used to sit here are gone:
                they encoded per-round win/loss in three unlabelled colours
                (grey meant "both the same", which nothing explained), and the
                Round by Round table below shows the same rounds with the
                actual points for both players. */}
            <div className="flex flex-col items-center justify-center px-1.5 sm:px-4 py-2 sm:py-5">
              <span className="font-display text-sm sm:text-xl text-gray-400">VS</span>
            </div>

            {/* Opponent */}
            <div className="flex-1 min-w-0 flex items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-5 border-l border-warm animate-[slideInRightBattle_0.4s_0.2s_ease-out_backwards]">
              <div className="font-display text-2xl sm:text-4xl text-gray-600 tracking-wide flex-shrink-0">
                {oppHidden ? '?' : oppCorrect}
              </div>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="min-w-0 text-right">
                  <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                    {!won && !isDraw && !oppHidden && <span className="px-1 sm:px-2 py-0.5 text-white text-[7px] sm:text-[10px] font-bold rounded tracking-wider" style={{ backgroundColor: '#166534' }}>WINNER</span>}
                    <span className="font-bold text-sm sm:text-base text-gray-900 truncate">{oppHidden ? '???' : oppUser?.username}</span>
                  </div>
                  <div className="font-display text-[11px] sm:text-xl text-gray-500 tracking-wide">
                    {oppHidden ? '?/?' : `${oppCorrect}/${currentBattle.rounds}`} CORRECT
                  </div>
                </div>
                <div className="w-9 h-9 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 border-warm flex-shrink-0">
                  {oppHidden ? (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xs sm:text-xl">?</div>
                  ) : (
                    <img src={oppUser?.avatar} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* RESULT + coins in ONE card, same as the Outcome screen
              (BattleResultScreen): verdict + LED bar on top, coins below. The
              big X : Y score is gone - it repeated the Players row underneath. */}
          {isComplete && (
            <>
              <span className={`${resultSectionLabel} flex-shrink-0 animate-[fadeIn_0.4s_ease-out]`}>Result</span>
              <div className="mt-2 mb-4 rounded-xl border border-warm bg-white/40 px-3 py-3 sm:px-5 sm:py-4 flex-shrink-0 animate-[cardIn_0.45s_ease-out]">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div
                    className="font-display text-base sm:text-lg tracking-wider flex items-center gap-2 shrink-0 animate-[fadeInUp_0.4s_ease-out]"
                    style={{ color: won ? '#166534' : isDraw ? '#E36B11' : '#dc2626' }}
                  >
                    {won && <Trophy className="w-5 h-5 sm:w-6 sm:h-6 animate-[popIcon_0.35s_ease-out] shrink-0" />}
                    {won ? 'YOU WIN!' : isDraw ? 'DRAW' : 'YOU LOSE'}
                  </div>
                  <div className="flex-1 flex items-center gap-3 min-w-0">
                    <div className="flex-1 flex gap-1">
                      {[...Array(10)].map((_, i) => {
                        const isActive = animResultAccuracy >= (i + 1) * 10;
                        const ledColor = won ? '#166534' : isDraw ? '#E36B11' : '#dc2626';
                        return (
                          <span
                            key={i}
                            className="h-2.5 sm:h-3 flex-1 rounded transition-all duration-300"
                            style={{ backgroundColor: isActive ? ledColor : '#E5E0D8', boxShadow: isActive ? `0 0 6px ${ledColor}` : 'none' }}
                          />
                        );
                      })}
                    </div>
                    <span className="font-display text-[10px] sm:text-[11px] text-gray-500 tabular-nums shrink-0">
                      {myCorrect}/{currentBattle.rounds} · {Math.round(animResultAccuracy)}%
                    </span>
                  </div>
                </div>

                <div className="border-t border-warm my-2.5 sm:my-3" />

                <div className="flex items-center gap-3">
                  <img
                    src="/images/bogxcoin.png"
                    alt=""
                    className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 animate-[popIcon_0.45s_ease-out_0.15s_backwards]"
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className="font-display text-lg sm:text-2xl leading-none tabular-nums"
                      style={{ color: won ? '#166534' : isDraw ? '#E36B11' : '#dc2626' }}
                    >
                      {isDraw
                        ? `${formatCurrency(resultWagerBogx)} BOGX`
                        : `${animResultCoins >= 0 ? '+' : '-'}${formatCurrency(Math.abs(animResultCoins))} BOGX`}
                    </div>
                    <div className="font-display text-[9px] sm:text-[11px] tracking-wide mt-1 text-gray-500 tabular-nums">
                      {isDraw ? (
                        <>wager returned · nothing won or lost</>
                      ) : (
                        <>
                          <span>{formatCurrency(resultWagerBogx)} wagered</span>
                          <span className="text-gray-400"> · </span>
                          <span>{formatCurrency(resultWagerBogx * 2)} pot</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}


          {/* Round by Round Scoreboard - Table layout like standalone */}
          {isComplete && (
            <div className="mb-4 flex-shrink-0 animate-[fadeInUp_0.4s_0.3s_ease-out_backwards]">
              <div className={`${resultSectionLabel} mb-2`}>
                Round by Round
              </div>
              <div className="rounded-xl border border-warm bg-white/40 p-3 sm:p-4">
              <table className="w-full table-fixed">
                <thead>
                  <tr>
                    <th className="text-left pb-2 w-[26%]"></th>
                    {Array.from({ length: currentBattle.rounds }).map((_, i) => (
                      <th key={i} className="text-center pb-2 font-display text-[10px] sm:text-xs text-gray-400 tracking-wider">R{i + 1}</th>
                    ))}
                    <th className="text-center pb-2 font-display text-[10px] sm:text-xs text-gray-400 tracking-wider w-[18%]">TOT</th>
                  </tr>
                </thead>
                <tbody>
                  {/* You row */}
                  <tr>
                    <td className="py-2 pr-2 sm:pr-4">
                      <span className="font-bold text-gray-900 text-xs sm:text-sm uppercase truncate block">You</span>
                    </td>
                    {Array.from({ length: currentBattle.rounds }).map((_, i) => {
                      const r = myResults[i];
                      const bgColor = r ? (r.correct ? 'bg-[#166534]' : 'bg-red-500/15') : 'bg-gray-100';
                      const textColor = r ? (r.correct ? 'text-white' : 'text-red-500') : 'text-gray-400';
                      return (
                        <td key={i} className="py-2 px-0.5 sm:px-1">
                          <div className={`${bgColor} ${textColor} rounded-lg py-2 sm:py-3 px-0.5 sm:px-2 text-center font-display text-[11px] sm:text-base`}>
                            {r ? (r.correct ? formatCurrency(r.points) : '—') : '—'}
                          </div>
                        </td>
                      );
                    })}
                    {(() => {
                      const myTotalTime = myResults.reduce((sum, r) => sum + (r.timeMs || 0), 0) / 1000;
                      const oppTotalTime = opponentResults.reduce((sum, r) => sum + (r.timeMs || 0), 0) / 1000;
                      const isTie = myCorrect === oppCorrect;
                      const wonByTime = isTie && myTotalTime < oppTotalTime;
                      return (
                        <td className={`py-2 pl-1 sm:pl-4 text-center ${won ? 'text-[#6B7280]' : 'text-gray-600'}`}>
                          <div className="font-display text-xs sm:text-lg">{formatCurrency(myTotalPoints)}</div>
                          {isTie && (
                            <div className={`text-[9px] sm:text-xs ${wonByTime ? 'text-[#6B7280] font-bold' : 'text-gray-400'}`}>
                              ⏱ {myTotalTime.toFixed(1)}s
                            </div>
                          )}
                        </td>
                      );
                    })()}
                  </tr>
                  {/* Opponent row */}
                  <tr>
                    <td className="py-2 pr-2 sm:pr-4">
                      <span className="font-bold text-gray-900 text-xs sm:text-sm uppercase truncate block">
                        {oppHidden ? '???' : oppUser?.username}
                      </span>
                    </td>
                    {Array.from({ length: currentBattle.rounds }).map((_, i) => {
                      if (oppHidden) {
                        return (
                          <td key={i} className="py-2 px-0.5 sm:px-1">
                            <div className="bg-gray-100 text-gray-400 rounded-lg py-2 sm:py-3 px-0.5 sm:px-2 text-center font-display text-[11px] sm:text-base">?</div>
                          </td>
                        );
                      }
                      const r = opponentResults[i];
                      const bgColor = r ? (r.correct ? 'bg-[#166534]' : 'bg-red-500/15') : 'bg-gray-100';
                      const textColor = r ? (r.correct ? 'text-white' : 'text-red-500') : 'text-gray-400';
                      return (
                        <td key={i} className="py-2 px-0.5 sm:px-1">
                          <div className={`${bgColor} ${textColor} rounded-lg py-2 sm:py-3 px-0.5 sm:px-2 text-center font-display text-[11px] sm:text-base`}>
                            {r ? (r.correct ? formatCurrency(r.points) : '—') : '—'}
                          </div>
                        </td>
                      );
                    })}
                    {(() => {
                      const myTotalTime = myResults.reduce((sum, r) => sum + (r.timeMs || 0), 0) / 1000;
                      const oppTotalTime = opponentResults.reduce((sum, r) => sum + (r.timeMs || 0), 0) / 1000;
                      const isTie = myCorrect === oppCorrect;
                      const oppWonByTime = isTie && oppTotalTime < myTotalTime;
                      return (
                        <td className={`py-2 pl-1 sm:pl-4 text-center ${!won && !isDraw && !oppHidden ? 'text-[#6B7280]' : 'text-gray-600'}`}>
                          <div className="font-display text-xs sm:text-lg">{oppHidden ? '?' : formatCurrency(opponentTotalPoints)}</div>
                          {isTie && !oppHidden && (
                            <div className={`text-[9px] sm:text-xs ${oppWonByTime ? 'text-[#6B7280] font-bold' : 'text-gray-400'}`}>
                              ⏱ {oppTotalTime.toFixed(1)}s
                            </div>
                          )}
                        </td>
                      );
                    })()}
                  </tr>
                </tbody>
              </table>
              {outcomeNote && (
                <>
                  <div className="border-t border-warm my-2.5 sm:my-3" />
                  <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-gray-600 leading-snug">
                    <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 shrink-0" />
                    <p>{outcomeNote}</p>
                  </div>
                </>
              )}
              </div>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Buttons - ORIGINAL LOGIC PRESERVED, no extra padding since card has p-6 */}
          <div className="pt-4 border-t border-warm flex-shrink-0 animate-[fadeInUp_0.4s_0.4s_ease-out_backwards]">
            {isComplete ? (
              /* Same pair as Solo Trivia: outlined secondary left, filled
                 primary right with the icon pinned to the edge. */
              <div className="flex items-center gap-3">
                <button
                  onClick={backToPool}
                  className="flex-1 py-3 border border-warm bg-cream hover:bg-white text-gray-600 font-display text-sm tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Pool
                </button>
                <button
                  onClick={() => {
                    const target = rematchTargetFor(currentBattle, isCreator);
                    if (target) startRematch(target);
                  }}
                  className="group flex-1 py-3 text-white font-display text-sm tracking-widest rounded-xl flex items-center justify-center relative transition-all hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]"
                  style={{ background: `linear-gradient(135deg, ${topic.color}dd 0%, ${topic.color} 100%)` }}
                >
                  Rematch
                  <Swords className="w-4 h-4 absolute right-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            ) : (
              <button
                onClick={continueFromInter}
                className="w-full py-4 bg-[#6B7280] text-white font-display text-lg tracking-widest rounded-xl flex items-center justify-center gap-2 hover:bg-[#9333EA] transition-colors"
              >
                Round {myResults.length + 1}
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>
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

      
      {/* Inline Toast (non-blocking, no blur) */}
      {inlineToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg ${
            inlineToast.type === 'success' 
              ? 'bg-green-500 text-white' 
              : 'bg-blue-500 text-white'
          }`}>
            {inlineToast.type === 'success' && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span className="font-medium">{inlineToast.message}</span>
            <button onClick={() => setInlineToast(null)} className="ml-2 opacity-70 hover:opacity-100">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
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
        balance={alertState.balance}
        required={alertState.required}
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
          // Pass wager and topic directly to avoid React state async issues
          setCreateWager(wager);
          setCreateTopic(topic);
          handleChallengeUser(targetUser, wager, topic);
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

      {/* Give Up Confirmation */}
      {showGiveUpConfirm && currentBattle && (() => {
        // "Nobody joined yet" is derived from the ROLE, not from currentBattle.opponent:
        // that field is regularly missing on the locally cached object (pool entry kept
        // after accept, populate variations between endpoints), which made the dialog
        // claim an empty battle while the player was mid-game against someone.
        // If you are not the creator, then you ARE the opponent — someone joined.
        const creatorId = (currentBattle.creator as any)?._id ?? (currentBattle.creator as any);
        const iAmCreator = String(creatorId) === String(user?.id);
        const nobodyJoined = iAmCreator && !currentBattle.opponent;

        // Same rule as /api/battles/[id]/forfeit: a refund only happens while the
        // battle is NOT armed. Pressing START commits the wager, even before the
        // first answer — otherwise players could burn their opponent's battle for
        // free and leave a pile of armed-but-unplayed games behind.
        const isFreeCancel = nobodyJoined || (!hasStartedBattle && myResults.length === 0);
        return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowGiveUpConfirm(false)}
          />
          <div className="relative bg-cream border border-warm rounded-2xl w-full max-w-[340px] p-6 text-center shadow-xl">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <X className="w-6 h-6 text-red-500" strokeWidth={2.5} />
            </div>
            <h3 className="font-display text-xl tracking-wider mb-2 text-gray-900">
              {/* Only a real forfeit costs the wager - the refund cases are cancels,
                  and leaving a battle you joined from the pool just releases it. */}
              {!isFreeCancel
                ? 'GIVE UP?'
                : !iAmCreator && !(currentBattle as any).challengedUser
                  ? 'LEAVE BATTLE?'
                  : 'CANCEL BATTLE?'}
            </h3>
            {/* Mirrors /api/battles/[id]/forfeit exactly. Branching on `status` alone
                was wrong: a battle you are already playing can still carry a stale
                'open' status locally, which claimed "nobody has joined yet" while an
                opponent was right there on screen. */}
            <p className="text-gray-600 text-sm mb-6">
              {nobodyJoined ? (
                <>
                  Nobody has joined yet, so the battle is cancelled and your{' '}
                  <span className="font-display text-base text-gray-900">
                    {formatCurrency(toBOGX(currentBattle.wager))}
                  </span>{' '}
                  <img src="/images/bogxcoin.png" alt="" className="w-4 h-4 inline align-text-bottom" /> wager is refunded.
                </>
              ) : isFreeCancel && !iAmCreator && !(currentBattle as any).challengedUser ? (
                <>
                  {/* Joined from the pool: the battle belongs to its creator and goes
                      back to being open, so promising "the battle is cancelled" here
                      would describe the old behaviour that deleted it for everyone. */}
                  You haven&apos;t started yet, so the battle goes back to the pool and
                  your{' '}
                  <span className="font-display text-base text-gray-900">
                    {formatCurrency(toBOGX(currentBattle.wager))}
                  </span>{' '}
                  <img src="/images/bogxcoin.png" alt="" className="w-4 h-4 inline align-text-bottom" /> wager is refunded.
                </>
              ) : isFreeCancel ? (
                <>
                  You haven&apos;t started yet, so the battle is cancelled and
                  both players get their{' '}
                  <span className="font-display text-base text-gray-900">
                    {formatCurrency(toBOGX(currentBattle.wager))}
                  </span>{' '}
                  <img src="/images/bogxcoin.png" alt="" className="w-4 h-4 inline align-text-bottom" /> wager back. Nobody loses.
                </>
              ) : (
                <>
                  Your opponent wins the full pot of{' '}
                  <span className="font-display text-base text-gray-900">
                    {formatCurrency(toBOGX(currentBattle.wager) * 2)}
                  </span>{' '}
                  <img src="/images/bogxcoin.png" alt="" className="w-4 h-4 inline align-text-bottom" />. This cannot be undone.
                </>
              )}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowGiveUpConfirm(false)}
                disabled={givingUp}
                className="flex-1 py-3 border border-warm text-gray-600 font-display text-sm tracking-wider rounded-xl disabled:opacity-50"
              >
                KEEP PLAYING
              </button>
              <button
                onClick={handleGiveUp}
                disabled={givingUp}
                className="flex-1 py-3 bg-red-500 text-white font-display text-sm tracking-wider rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {givingUp ? 'PLEASE WAIT…' : (isFreeCancel ? 'CANCEL' : 'GIVE UP')}
              </button>
            </div>
          </div>
        </div>,
        document.body
        );
      })()}

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
          onPlayBattle={async (battleId) => {
            setShowOpenBattles(false);
            try {
              const res = await fetch(`/api/battles/${battleId}`);
              const data = await res.json();
              if (data.success && data.battle) {
                const battle = data.battle;
                setCurrentBattle(battle);
                beginBattle(battle);
              }
            } catch (error) {
              console.error('Failed to load battle:', error);
            }
          }}
          onCoinsChange={(amount, variant) => { setCoins(prev => prev + amount); onCoinAnimation?.(amount, variant); }}
          accentColor="purple"
          onCountChange={setLiveBattleCount}
          currentlyPlayingBattleId={currentBattle?._id}
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
            <div className="relative bg-cream border-2 rounded-2xl w-full max-w-[360px] p-5 shadow-2xl" style={{ borderColor: topic.color }}>
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
                  <div className="w-16 h-16 rounded-full overflow-hidden border-3" style={{ borderColor: `${topic.color}40` }}>
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
                  <Users className="w-4 h-4" style={{ color: topic.color }} />
                  <span className="font-bold text-gray-900">{battle.rounds}</span>
                  <span className="text-gray-500 text-sm">Rounds</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-display text-lg text-gray-900">{formatCurrency(toBOGX(battle.wager))}</span>
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
                    showAlert('info', 'Battles are disabled during the break (9:55-10:00).');
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
                className="w-full mt-4 py-3 bg-[#6B7280] hover:bg-[#9333EA] text-white font-display text-sm tracking-wider rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
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
