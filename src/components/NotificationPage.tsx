"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Bell, BellOff, Check, Trophy, Settings, Swords, Trash2, Target, Music, X, ThumbsUp, Newspaper, Brain, Vote, ChevronLeft } from "lucide-react";
import { WELCOME_NOTIFICATION_ID, WELCOME_GUEST_DISMISSED_KEY, WELCOME_TITLE, welcomeMessage } from "@/lib/welcomeNotification";
import { sounds } from "@/utils/sounds";
import { useAuth } from "@/context/AuthContext";
import LogoLoader from "./LogoLoader";
import BackButton from "./BackButton";
import { BattleResultScreen } from "./battles";
import PredictionResultModal, { PredictionResultData } from "./PredictionResultModal";
import { NewsSkeleton } from "@/components/desktop/DesktopSkeletons";
import CoinAnimation from "./CoinAnimation";

interface PredictionOption {
  id: string;
  label: string;
}

interface Notification {
  id: string;
  type: 'battle_result' | 'battle_accepted' | 'battle_challenge' | 'ranking' | 'test' | 'system' | 'prediction_result' | 'song_approved' | 'song_rejected' | 'song_in_progress' | 'comment_like' | 'welcome';
  title: string;
  message: string;
  avatar?: string;
  battleId?: string;
  articleId?: string;
  wager?: number;
  topic?: string;
  createdAt: string;
  read: boolean;
  // Prediction-result fields (populated by /api/notifications when type === 'prediction_result')
  predictionId?: string;
  predictionQuestion?: string;
  predictionOptions?: PredictionOption[];
  predictionCorrectOptionId?: string | null;
  userOptionId?: string;
  userOptionLabel?: string;
  correctOptionLabel?: string;
  pointsAwarded?: number;
  pointsReward?: number;
  resolvedAt?: string;
  won?: boolean;
}

interface BattleQuestion {
  question: string;
  answers: string[];
  correctIndex: number;
}

interface BattleResult {
  id: string;
  topic: string;
  wager: number;
  rounds: number;
  myPoints: number;
  opponentPoints: number;
  myAvatar?: string;
  opponentAvatar?: string;
  opponentUsername: string;
  myResults: { correct: boolean; points: number; timeMs?: number; answerIndex?: number }[];
  opponentResults: { correct: boolean; points: number; timeMs?: number }[];
  questions?: BattleQuestion[];
  // Full battle object for BattleResultScreen
  battle?: any;
  isCreator?: boolean;
}

interface NotificationPageProps {
  isOpen?: boolean; // Optional - defaults to true for standalone page
  onClose?: () => void; // Optional - not needed for standalone page
  onGoToProfile?: () => void;
  onGoToBattle?: (battleId: string) => void; // Navigate to battle and start it
  onOpenArticle?: (articleId: string) => void; // Open the article a comment belongs to
  onShowChallenge?: (battleId: string, notificationId?: string) => void; // Show challenge in content area (desktop)
  onShowBattleResult?: (battleId: string) => void; // Show battle result in content area (desktop)
  autoEnable?: 'email' | 'sms' | null;
  onPointsAwarded?: (amount: number) => void; // Trigger coin animation
  autoOpenSettings?: boolean; // Open settings view directly
  onSettingsClosed?: () => void; // Called when settings view is closed
  onChallengeDeclined?: (notificationId?: string) => void; // Called when a battle challenge is declined, with notification ID
  compact?: boolean; // Compact mode for sidebar widget - shows only first 5 notifications
  onViewAll?: () => void; // Called when "View All" is clicked in compact mode
  onOpenSettings?: () => void; // Called when bell icon is clicked in compact mode to open notification settings
  // Opens the "Battle Challenge!" confirm modal for this battle as soon as the
  // page mounts. Used for a deep link from a raw OS push notification, which has
  // no notification-list item to click through - it must land on the SAME
  // confirm-before-you-play step a manual click on the notification gets,
  // instead of skipping straight into an accepted, wagered battle.
  initialChallengeId?: string | null;
  onInitialChallengeHandled?: () => void;
}

// Simple Notification Item with X button
function NotificationItem({ 
  notif, 
  onDismiss, 
  onClick, 
  timeAgo, 
  isUnread,
  compact = false,
  isActive = false
}: { 
  notif: Notification; 
  onDismiss: () => void; 
  onClick: () => void;
  timeAgo: (date: string) => string;
  isUnread: boolean;
  compact?: boolean;
  isActive?: boolean;
}) {
  // Hover = orange row + cream text. `text-white` is cream by design here:
  // tailwind.config.ts remaps `white` to #F5F0E8, and that is wanted - cream on
  // orange, never pure white.
  //
  // The catch: cream text is invisible if the row does NOT turn orange, which is
  // exactly how this broke. So the fill is applied twice on purpose - via
  // `hover:bg-[#E36B11]` here and via `.news-item:hover` in globals.css. The row
  // background also uses `bg-[#F5F0E8]` instead of `.bg-cream`, because that
  // unlayered class kept beating the hover utility.

  // Compact mode: two-line layout for sidebar widget
  // Row 1: avatar | title | date | trash
  // Row 2: message text
  if (compact) {
    return (
      <div 
        className={`relative p-2 rounded-lg border transition-all duration-200 cursor-pointer group ${
          isActive
            ? 'bg-[#E36B11] border-[#E36B11]'
            : isUnread
              ? 'news-item bg-[#E36B11]/10 border-[#E36B11]/30 hover:bg-[#E36B11] hover:border-[#E36B11]'
              : 'news-item bg-[#F5F0E8] border-warm hover:bg-[#E36B11] hover:border-[#E36B11]'
        }`}
        onClick={onClick}
      >
        {/* Row 1: avatar | title | date | trash */}
        <div className="flex items-center gap-2">
          {/* Small avatar with orange border */}
          {notif.avatar ? (
            <img src={notif.avatar} alt="" className={`w-5 h-5 rounded-full flex-shrink-0 border transition-colors ${isActive ? 'border-white' : 'border-[#E36B11] group-hover:border-white'}`} />
          ) : (
            <div className={`w-5 h-5 rounded-full flex-shrink-0 border transition-colors ${isActive ? 'border-white bg-white/20' : 'bg-gray-200 border-[#E36B11] group-hover:border-white group-hover:bg-white/20'}`} />
          )}
          
          {/* Title */}
          <span className={`font-display text-sm tracking-wide truncate flex-1 transition-colors ${isActive ? 'text-white' : 'text-gray-900 group-hover:text-white'}`}>{notif.title}</span>
          
          {/* Date */}
          <span className={`font-display text-[10px] tracking-wide flex-shrink-0 transition-colors ${isActive ? 'text-white/70' : 'text-gray-400 group-hover:text-white/70'}`}>{timeAgo(notif.createdAt)}</span>
          
          {/* Trash Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className={`w-5 h-5 flex items-center justify-center rounded transition-colors flex-shrink-0 ${isActive ? 'text-white/70 hover:text-white hover:bg-white/20' : 'text-gray-400 hover:text-red-400 hover:bg-red-50 group-hover:text-white/70 group-hover:hover:text-white group-hover:hover:bg-white/20'}`}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
        
        {/* Row 2: message text - starts at same position as avatar */}
        <p className={`font-display text-[11px] tracking-wide truncate mt-0.5 transition-colors flex items-center gap-0.5 ${isActive ? 'text-white/80' : 'text-gray-500 group-hover:text-white/80'}`}>
          {notif.message.includes('BOGX') ? (
            <>
              {notif.message.split('BOGX')[0]}
              <img src="/images/bogxcoin.png" alt="BOGX" className="w-3 h-3 inline-block" />
              {notif.message.split('BOGX')[1]}
            </>
          ) : (
            notif.message
          )}
        </p>
      </div>
    );
  }

  // Full mode: original layout - same hover style as compact (sidebar)
  return (
    <div 
      className={`relative flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer group ${
        isActive
          ? 'bg-[#E36B11] border-[#E36B11]'
          : isUnread
            ? 'news-item bg-[#E36B11]/10 border-[#E36B11]/30 hover:bg-[#E36B11] hover:border-[#E36B11]'
            : 'news-item bg-[#F5F0E8] border-warm hover:bg-[#E36B11] hover:border-[#E36B11]'
      }`}
      onClick={onClick}
    >
      {/* Trash Button to dismiss */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-50 group-hover:text-white/80 rounded transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
      
      {/* Clickable content */}
      <button 
        onClick={onClick}
        className="flex items-start gap-3 flex-1 text-left pr-6"
      >
        {/* Icon/Avatar */}
        <div className="flex-shrink-0">
          {notif.avatar ? (
            <img src={notif.avatar} alt="" className="w-10 h-10 rounded-full border-2 border-transparent transition-colors group-hover:border-white" />
          ) : (
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              notif.type === 'battle_result' 
                ? (notif.title.includes('Won') ? 'bg-green-500/20' : notif.title.includes('Lost') ? 'bg-red-500/20' : 'bg-yellow-500/20')
                : notif.type === 'prediction_result'
                  ? (notif.won ? 'bg-green-500/20' : 'bg-red-500/20')
                  : notif.type === 'song_approved'
                    ? 'bg-green-500/20'
                    : notif.type === 'song_rejected'
                      ? 'bg-red-500/20'
                      : notif.type === 'song_in_progress'
                        ? 'bg-blue-500/20'
                        : 'bg-[#E36B11]/20'
            }`}>
              {notif.type === 'battle_result' ? (
                <Trophy className={`w-5 h-5 transition-colors group-hover:text-white ${
                  notif.title.includes('Won') ? 'text-green-400' : notif.title.includes('Lost') ? 'text-red-400' : 'text-yellow-400'
                }`} />
              ) : notif.type === 'prediction_result' ? (
                <Target className={`w-5 h-5 transition-colors group-hover:text-white ${notif.won ? 'text-green-500' : 'text-red-500'}`} />
              ) : notif.type === 'song_approved' ? (
                <Music className="w-5 h-5 text-green-500 transition-colors group-hover:text-white" />
              ) : notif.type === 'song_rejected' ? (
                <Music className="w-5 h-5 text-red-500 transition-colors group-hover:text-white" />
              ) : notif.type === 'song_in_progress' ? (
                <Music className="w-5 h-5 text-blue-500 transition-colors group-hover:text-white" />
              ) : notif.type === 'comment_like' ? (
                <ThumbsUp className="w-5 h-5 text-[#E36B11] transition-colors group-hover:text-white" />
              ) : (
                <Swords className="w-5 h-5 text-[#E36B11] transition-colors group-hover:text-white" />
              )}
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-base tracking-wide text-gray-900 transition-colors group-hover:text-white">{notif.title}</span>
            <span className="font-display text-xs tracking-wide text-gray-600 flex-shrink-0 transition-colors group-hover:text-white/80">{timeAgo(notif.createdAt)}</span>
          </div>
          <p className="font-display text-sm tracking-wide text-gray-500 mt-0.5 flex items-center gap-1 flex-wrap transition-colors group-hover:text-white/90">
            {notif.message.includes('BOGX') ? (
              <>
                {notif.message.split('BOGX')[0]}
                <img src="/images/bogxcoin.png" alt="BOGX" className="w-3.5 h-3.5 inline-block" />
                {notif.message.split('BOGX')[1]}
              </>
            ) : (
              notif.message
            )}
          </p>
        </div>
      </button>
    </div>
  );
}

// Set by the compact widget so the full page opens the welcome body on mount
const WELCOME_OPEN_FLAG = 'bogx-open-welcome';

// Helper: Convert base64 VAPID key to Uint8Array (required by iOS Safari)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function NotificationPage({ isOpen = true, onClose, onGoToProfile, onGoToBattle, onShowBattleResult, onOpenArticle, onShowChallenge, autoEnable, onNewNotification, onPointsAwarded, autoOpenSettings, onSettingsClosed, onChallengeDeclined, compact = false, onViewAll, onOpenSettings, initialChallengeId, onInitialChallengeHandled }: NotificationPageProps & { onNewNotification?: () => void }) {
  const { user, isLoggedIn } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  
  // Reset showSettings when component mounts (unless autoOpenSettings is true)
  useEffect(() => {
    if (autoOpenSettings) {
      // Small delay to ensure component is fully mounted
      setTimeout(() => setShowSettings(true), 100);
    } else {
      // Reset to notifications view when opening
      setShowSettings(false);
    }
  }, [autoOpenSettings]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false); // Start false, set true when loading
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [selectedBattle, setSelectedBattle] = useState<BattleResult | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<any | null>(null);
  const [selectedPredictionResult, setSelectedPredictionResult] = useState<PredictionResultData | null>(null);
  const [selectedWelcome, setSelectedWelcome] = useState(false); // Show welcome message in body

  // The widget sets a flag before navigating here, because this instance is not
  // mounted yet at click time and a window event would arrive before the listener.
  useEffect(() => {
    if (compact) return;
    try {
      if (sessionStorage.getItem(WELCOME_OPEN_FLAG)) {
        sessionStorage.removeItem(WELCOME_OPEN_FLAG);
        setSelectedWelcome(true);
      }
    } catch { /* private mode */ }
  }, [compact]);
  const [loadingBattle, setLoadingBattle] = useState(false);
  const [decliningChallenge, setDecliningChallenge] = useState(false);
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());
  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null);
  const [testPushLoading, setTestPushLoading] = useState(false);

  // Guests have no notifications row, so the welcome message is built client-side
  // and its dismissal is remembered in localStorage instead of on the user.
  const [guestWelcomeDismissed, setGuestWelcomeDismissed] = useState(true);
  useEffect(() => {
    if (isLoggedIn) return;
    try {
      setGuestWelcomeDismissed(!!localStorage.getItem(WELCOME_GUEST_DISMISSED_KEY));
    } catch {
      setGuestWelcomeDismissed(false); // private mode: show it, just don't persist
    }
  }, [isLoggedIn]);

  // The list to render: server notifications for members, the local welcome for guests
  const displayNotifications: Notification[] = isLoggedIn
    ? notifications
    : guestWelcomeDismissed
      ? []
      : [{
          id: WELCOME_NOTIFICATION_ID,
          type: 'welcome',
          title: WELCOME_TITLE,
          message: welcomeMessage(),
          avatar: '/images/genxlogo1.png',
          read: true,
          createdAt: new Date().toISOString(),
        }];
  
  // Send test push notification
  const sendTestPush = async () => {
    if (!user?.id || testPushLoading) return;
    setTestPushLoading(true);
    try {
      const res = await fetch('/api/test-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      if (data.success) {
        // Reload notifications to show the new test notification
        await loadNotifications();
        // Mark as read immediately so no green dot appears
        if (data.notificationId) {
          setReadNotifications(prev => {
            const newSet = new Set(prev);
            newSet.add(`notif-${data.notificationId}`);
            return newSet;
          });
        }
        // Show feedback so user knows what happened
        if (data.pushSent) {
          alert('✅ Push sent! Check your phone\'s notification area.');
        } else if (data.pushError) {
          alert(`⚠️ Notification added to list, but push not sent:\n\n${data.pushError}`);
        }
      }
    } catch (e) {
      console.error('Test push error:', e);
    } finally {
      setTestPushLoading(false);
    }
  };
  
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushRewardClaimed, setPushRewardClaimed] = useState(false);
  const [showRewardAnimation, setShowRewardAnimation] = useState(false);
  
  // Individual notification toggles (all default to true when push is enabled)
  const [notifyBattleRequest, setNotifyBattleRequest] = useState(true);
  const [notifyBattleResult, setNotifyBattleResult] = useState(true);
  const [notifyCommentLike, setNotifyCommentLike] = useState(true);
  
  // Push notification explanation modal (only shown when user clicks enable)
  const [showPushModal, setShowPushModal] = useState(false);

  // Load notifications when opened + auto-refresh every 10 seconds
  useEffect(() => {
    if (isOpen && isLoggedIn && user?.id && !showSettings) {
      loadNotifications();
      
      // Auto-refresh notifications every 10 seconds for real-time feel (silent, no loading spinner)
      const interval = setInterval(() => {
        loadNotifications(true);
      }, 10000);
      
      return () => clearInterval(interval);
    } else if (!isLoggedIn) {
      // Not logged in - stop loading spinner
      setLoadingNotifications(false);
    }
  }, [isOpen, isLoggedIn, user?.id, showSettings]);

  // Listen for notification-read events from other instances (widget <-> full page sync)
  useEffect(() => {
    const handleNotificationRead = (e: CustomEvent) => {
      const { notificationId } = e.detail;
      if (notificationId) {
        setReadNotifications(prev => {
          const newSet = new Set(prev);
          newSet.add(notificationId);
          return newSet;
        });
      }
    };
    
    window.addEventListener('notification-read', handleNotificationRead as EventListener);
    return () => window.removeEventListener('notification-read', handleNotificationRead as EventListener);
  }, []);

  // The parent closed a notification detail view (BACK) - drop the highlight
  useEffect(() => {
    const clearActive = () => { setActiveNotificationId(null); setSelectedWelcome(false); };
    window.addEventListener('notification-view-closed', clearActive);
    return () => window.removeEventListener('notification-view-closed', clearActive);
  }, []);

  // Push was toggled in another instance (settings page vs news widget) - the
  // bell has to reflect it immediately instead of only after a page refresh.
  useEffect(() => {
    const onPushStatus = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail?.enabled === 'boolean') setPushEnabled(detail.enabled);
    };
    window.addEventListener('push-status-changed', onPushStatus);
    return () => window.removeEventListener('push-status-changed', onPushStatus);
  }, []);

  const loadNotifications = async (silent: boolean = false) => {
    if (!user?.id) return;
    // Only show loading on first load, not on background refreshes
    if (!silent && !hasLoadedOnce) {
      setLoadingNotifications(true);
    }
    try {
      const res = await fetch(`/api/notifications?userId=${user.id}`);
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications);
        // Initialize readNotifications from notifications that are already read
        const alreadyRead = data.notifications
          .filter((n: any) => n.read)
          .map((n: any) => n.id);
        if (alreadyRead.length > 0) {
          setReadNotifications(prev => {
            const newSet = new Set(prev);
            alreadyRead.forEach((id: string) => newSet.add(id));
            return newSet;
          });
        }
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoadingNotifications(false);
      setHasLoadedOnce(true);
    }
  };

  /**
   * Timestamp for a notification.
   *
   * "40h ago" made the reader do arithmetic to work out which day something happened,
   * so anything older than today shows the real date. Today keeps the clock time -
   * the one case where the relative wording added nothing over it anyway.
   */
  const timeAgo = (date: string) => {
    const then = new Date(date);
    if (isNaN(then.getTime())) return '';

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const time = then.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    if (then >= startOfToday) return time;
    if (then >= startOfYesterday) return `Yesterday ${time}`;

    const sameYear = then.getFullYear() === now.getFullYear();
    return then.toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      ...(sameYear ? {} : { year: 'numeric' }),
    });
  };

  // Load battle details for modal (or navigate to content area on desktop)
  const loadBattleDetails = async (battleId: string) => {
    if (!user?.id) return;
    
    // If onShowBattleResult callback is provided (desktop), use it instead of modal
    if (onShowBattleResult) {
      onShowBattleResult(battleId);
      return;
    }
    
    setLoadingBattle(true);
    try {
      const res = await fetch(`/api/battles/${battleId}`);
      const data = await res.json();
      if (data.success && data.battle) {
        const battle = data.battle;
        const isCreator = battle.creator._id === user.id || battle.creator === user.id;
        const opponent = isCreator ? battle.opponent : battle.creator;
        
        // Get results
        const myResults = (isCreator ? battle.creatorResults : battle.opponentResults) || [];
        const oppResults = (isCreator ? battle.opponentResults : battle.creatorResults) || [];
        
        // Calculate total points from results (more reliable than stored totals)
        const myPoints = myResults.reduce((sum: number, r: any) => sum + (r.points || 0), 0);
        const oppPoints = oppResults.reduce((sum: number, r: any) => sum + (r.points || 0), 0);
        
        // Build a Battle object for BattleResultScreen
        // Ensure creator and opponent have proper avatar/username data
        // The API populates these fields, but we need fallbacks
        const creatorData = battle.creator?._id 
          ? battle.creator 
          : { _id: battle.creator, username: 'Player 1', avatar: '/images/default-avatar.png' };
        
        const opponentData = battle.opponent?._id 
          ? battle.opponent 
          : battle.opponent 
            ? { _id: battle.opponent, username: 'Player 2', avatar: '/images/default-avatar.png' }
            : { _id: 'unknown', username: 'Opponent', avatar: '/images/default-avatar.png' };
        
        const battleObj = {
          _id: battle._id,
          creator: creatorData,
          opponent: opponentData,
          topic: battle.topic,
          wager: battle.wager,
          rounds: battle.rounds || 3,
          status: battle.status,
          questions: battle.questions || [],
          creatorResults: battle.creatorResults || [],
          opponentResults: battle.opponentResults || [],
          creatorTotalPoints: battle.creatorTotalPoints || 0,
          opponentTotalPoints: battle.opponentTotalPoints || 0,
          // Needed by BattleResultScreen to tell a forfeit apart from a 0:0 draw
          winner: battle.winner,
          forfeitedBy: battle.forfeitedBy,
        };
        
        setSelectedBattle({
          id: battle._id,
          topic: battle.topic,
          wager: battle.wager,
          rounds: battle.rounds || 3,
          myPoints,
          opponentPoints: oppPoints,
          myAvatar: user.avatar,
          opponentAvatar: opponent?.avatar,
          opponentUsername: opponent?.username || 'Opponent',
          myResults,
          opponentResults: oppResults,
          questions: battle.questions || [],
          battle: battleObj,
          isCreator,
        });
      }
    } catch (error) {
      console.error('Failed to load battle:', error);
    } finally {
      setLoadingBattle(false);
    }
  };

  // Load challenge details for modal
  const loadChallengeDetails = async (battleId: string, notificationId?: string) => {
    if (!user?.id) return;
    setLoadingBattle(true);
    try {
      const res = await fetch(`/api/battles/${battleId}`);
      const data = await res.json();
      if (data.success && data.battle) {
        const battle = data.battle;
        const challenger = battle.creator;
        
        setSelectedChallenge({
          id: battle._id,
          notificationId, // Store notification ID for deletion after decline
          topic: battle.topic,
          wager: battle.wager,
          rounds: battle.rounds || 3,
          challengerUsername: challenger?.username || 'Unknown',
          challengerAvatar: challenger?.avatar,
          challengerRank: challenger?.rank || '?',
          challengerWins: challenger?.wins || 0,
          challengerGamesPlayed: challenger?.gamesPlayed || 0,
          createdAt: battle.createdAt,
        });
      }
    } catch (error) {
      console.error('Failed to load challenge:', error);
    } finally {
      setLoadingBattle(false);
    }
  };

  // Deep link from a battle-challenge push notification: open the same confirm
  // modal a manual click on the notification would, instead of skipping it.
  useEffect(() => {
    if (initialChallengeId && user?.id) {
      loadChallengeDetails(initialChallengeId);
      onInitialChallengeHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialChallengeId, user?.id]);

  // Decline a battle challenge - refunds the creator and deletes notification
  const handleDeclineChallenge = async () => {
    if (!selectedChallenge || !user?.id || decliningChallenge) return;
    setDecliningChallenge(true);
    try {
      const res = await fetch(`/api/battles/${selectedChallenge.id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oderId: user.id })
      });
      const data = await res.json();
      if (data.success) {
        // Also delete the notification
        if (selectedChallenge.notificationId) {
          // Extract MongoDB ID (remove 'notif-' prefix if present)
          const mongoId = selectedChallenge.notificationId.startsWith('notif-') 
            ? selectedChallenge.notificationId.replace('notif-', '') 
            : selectedChallenge.notificationId;
          await fetch(`/api/notifications/${mongoId}`, { method: 'DELETE' });
          // Remove from local list
          setNotifications(prev => prev.filter(n => n.id !== selectedChallenge.notificationId));
        }
        setSelectedChallenge(null);
        // Notify parent to update pending challenge count (Trivia badge) and refresh sidebar
        onChallengeDeclined?.(selectedChallenge.notificationId);
      } else {
        console.error('Failed to decline challenge:', data.error);
      }
    } catch (error) {
      console.error('Failed to decline challenge:', error);
    } finally {
      setDecliningChallenge(false);
    }
  };

  // Check if push is already enabled on mount
  useEffect(() => {
    // Check both: permission granted AND active subscription
    const checkPushStatus = async () => {
      if (!isLoggedIn || !('Notification' in window) || Notification.permission !== 'granted') {
        setPushEnabled(false);
        return false;
      }
      // Verify there's an actual push subscription, not just permission
      try {
        const registration = await navigator.serviceWorker.getRegistration('/sw.js');
        if (!registration) {
          setPushEnabled(false);
          return false;
        }
        const subscription = await registration.pushManager.getSubscription();
        const isReallySubscribed = !!subscription;
        setPushEnabled(isReallySubscribed);
        return isReallySubscribed;
      } catch {
        setPushEnabled(false);
        return false;
      }
    };
    
    checkPushStatus().then(isPushGranted => {
      // Load notification preferences if push is enabled
      if (isPushGranted) {
        const savedBattleRequest = localStorage.getItem('notify_battle_request');
        setNotifyBattleRequest(savedBattleRequest === null ? true : savedBattleRequest === 'true');
        
        const savedBattleResult = localStorage.getItem('notify_battle_result');
        setNotifyBattleResult(savedBattleResult === null ? true : savedBattleResult === 'true');
        
        const savedCommentLike = localStorage.getItem('notify_comment_like');
        setNotifyCommentLike(savedCommentLike === null ? true : savedCommentLike === 'true');
      }
    });
    
    // Check if push reward was already claimed
    const rewardClaimed = localStorage.getItem('push_reward_claimed');
    setPushRewardClaimed(rewardClaimed === 'true');
  }, [isLoggedIn]);

  // Toggle individual notification types
  const toggleBattleRequest = () => {
    const newValue = !notifyBattleRequest;
    setNotifyBattleRequest(newValue);
    localStorage.setItem('notify_battle_request', String(newValue));
  };

  const toggleBattleResult = () => {
    const newValue = !notifyBattleResult;
    setNotifyBattleResult(newValue);
    localStorage.setItem('notify_battle_result', String(newValue));
  };

  const toggleCommentLike = () => {
    const newValue = !notifyCommentLike;
    setNotifyCommentLike(newValue);
    localStorage.setItem('notify_comment_like', String(newValue));
  };

  // Toggle push notifications
  const togglePush = async () => {
    if (!user?.id) {
      alert('Please login to enable push notifications');
      return;
    }

    // iOS Safari only supports push in PWA mode (Add to Home Screen, iOS 16.4+)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);
    if (isIOS && !isStandalone) {
      alert('To enable notifications on iPhone:\n\n1. Tap the Share button\n2. Choose "Add to Home Screen"\n3. Open the app from your Home Screen\n4. Then enable notifications here\n\n(Requires iOS 16.4 or later)');
      return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push notifications are not supported in this browser.');
      return;
    }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      alert('Push notifications are not configured (missing VAPID key). Contact support.');
      return;
    }

    setPushLoading(true);

    try {
      if (!pushEnabled) {
        // Request permission and subscribe
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          alert('Please allow notifications in your browser settings');
          setPushLoading(false);
          return;
        }

        // Ensure service worker is registered (layout.tsx registers it, but be defensive)
        let registration = await navigator.serviceWorker.getRegistration('/sw.js');
        if (!registration) {
          registration = await navigator.serviceWorker.register('/sw.js');
        }
        await navigator.serviceWorker.ready;

        // Reuse existing subscription if any (avoids duplicate subscriptions)
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            // CRITICAL: iOS Safari requires Uint8Array, NOT a string
            applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
          });
        }

        // Save to server
        const res = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            subscription: subscription.toJSON(),
          }),
        });

        if (!res.ok) {
          throw new Error('Failed to save subscription on server');
        }

        setPushEnabled(true);
        window.dispatchEvent(new CustomEvent('push-status-changed', { detail: { enabled: true } }));
        
        // Give reward if first time enabling (0.50 BOGX)
        if (!pushRewardClaimed) {
          try {
            const rewardRes = await fetch('/api/user/update-bogx', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                userId: user.id, 
                amount: 0.50,
                source: 'push_notification_reward',
                description: 'Push notifications enabled bonus'
              }),
            });
            if (rewardRes.ok) {
              setPushRewardClaimed(true);
              localStorage.setItem('push_reward_claimed', 'true');
              setShowRewardAnimation(true);
              // Play sound
              sounds.coins();
              // Hide animation after 3 seconds
              setTimeout(() => setShowRewardAnimation(false), 3000);
              // Trigger points update in parent
              if (onPointsAwarded) {
                onPointsAwarded(0.50);
              }
              // Notify all coin displays to refresh (Header, Rankings, etc.)
              window.dispatchEvent(new CustomEvent('bogx-updated'));
            }
          } catch (e) {
            console.error('Failed to award push reward:', e);
          }
        }
      } else {
        // Unsubscribe
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
        }

        // Remove from server
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });

        setPushEnabled(false);
        window.dispatchEvent(new CustomEvent('push-status-changed', { detail: { enabled: false } }));
      }
    } catch (error) {
      console.error('Push toggle error:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to toggle push notifications: ${msg}`);
    } finally {
      setPushLoading(false);
    }
  };

  // Shared dismiss handler for both compact and full mode
  // Deletes the notification from the database permanently
  const handleDismissNotification = async (notif: Notification) => {
    // Guests only have the local welcome message - remember it and skip the API
    if (!isLoggedIn) {
      if (notif.id === WELCOME_NOTIFICATION_ID) {
        setGuestWelcomeDismissed(true);
        try { localStorage.setItem(WELCOME_GUEST_DISMISSED_KEY, '1'); } catch { /* private mode */ }
      }
      return;
    }
    if (!user?.id) return;
    
    // Optimistically remove from local state first
    setNotifications(prev => prev.filter(n => n.id !== notif.id));
    
    try {
      // Delete notification - pass userId for virtual notifications (battle-result, prediction-result)
      // The API will handle both DB notifications and virtual ones
      const res = await fetch(`/api/notifications/${encodeURIComponent(notif.id)}?userId=${user.id}`, { 
        method: 'DELETE' 
      });
      const data = await res.json();
      
      if (!data.success) {
        console.error('[Notification] Failed to delete:', data.error);
      }
    } catch (error) {
      console.error('[Notification] Delete error:', error);
    }
  };

  // COMPACT MODE - Sidebar widget version (uses same NotificationItem component)
  if (compact) {
    const visibleNotifications = displayNotifications.filter(n => !dismissedNotifications.has(n.id)).slice(0, 5);
    const unreadCount = displayNotifications.filter(n => !n.read && !dismissedNotifications.has(n.id)).length;
    
    return (
      <div className="bg-[#F5F0E8] rounded-xl border border-warm overflow-hidden shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-warm">
          <div className="flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-[#E36B11]" />
            <span className="font-display text-sm tracking-wider uppercase text-gray-900">News</span>
            {unreadCount > 0 && (
              <span className="min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <button 
            onClick={onOpenSettings} 
            className={`p-1.5 rounded-full transition-colors ${pushEnabled ? 'bg-[#E36B11]/20' : 'hover:bg-[#E36B11]/10'}`}
          >
            <Bell className={`w-4 h-4 ${pushEnabled ? 'text-[#E36B11] fill-[#E36B11]' : 'text-[#E36B11]'}`} />
          </button>
        </div>
        {/* Notifications list - max 5 visible, then scroll (hidden scrollbar) */}
        <div className="px-2 py-2 space-y-2 max-h-[320px] overflow-y-auto scrollbar-hide">
          {loadingNotifications ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-[#E36B11]/30 border-t-[#E36B11] rounded-full animate-spin" />
            </div>
          ) : visibleNotifications.length === 0 ? (
            <div className="py-8 px-4 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#E36B11]/10 flex items-center justify-center">
                <Bell className="w-6 h-6 text-[#E36B11]/40" />
              </div>
              <p className="text-sm font-medium text-gray-600">All caught up!</p>
              <p className="text-xs text-gray-400 mt-1">No new notifications</p>
            </div>
          ) : (
            visibleNotifications.map((notif) => (
              <NotificationItem
                key={notif.id}
                notif={notif}
                isUnread={!notif.read && !readNotifications.has(notif.id)}
                isActive={activeNotificationId === notif.id}
                onDismiss={() => handleDismissNotification(notif)}
                onClick={() => {
                  // Set as active notification
                  setActiveNotificationId(notif.id);
                  
                  // Mark as read locally
                  setReadNotifications(prev => {
                    const newSet = new Set(prev);
                    newSet.add(notif.id);
                    return newSet;
                  });
                  
                  // Dispatch event so other instances (widget/full page) sync
                  window.dispatchEvent(new CustomEvent('notification-read', { detail: { notificationId: notif.id } }));
                  
                  // Mark as read on server
                  if (user?.id) {
                    fetch('/api/notifications/mark-single-read', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: user.id, notificationId: notif.id })
                    }).catch(() => {});
                  }
                  
                  // Convert battleId to string if it's an ObjectId
                  const battleIdStr = notif.battleId ? String(notif.battleId) : null;
                  
                  if (battleIdStr && notif.type === 'battle_challenge') {
                    // Prefer showing it inline in the content area (desktop)
                    if (onShowChallenge) {
                      onShowChallenge(battleIdStr, notif.id);
                    } else {
                      setActiveNotificationId(null);
                      loadChallengeDetails(battleIdStr, notif.id);
                    }
                  } else if (battleIdStr && notif.type === 'battle_result') {
                    // Show battle result directly
                    onShowBattleResult?.(battleIdStr);
                  } else if (notif.type === 'comment_like') {
                    // Open the article the comment belongs to
                    if (notif.articleId) {
                      onOpenArticle?.(String(notif.articleId));
                    } else {
                      setActiveNotificationId(null);
                      onViewAll?.();
                    }
                  } else if (notif.type === 'welcome') {
                    // Open the full news page with the welcome message expanded.
                    // The flag is read by the full-page instance on mount, because
                    // it is not mounted yet when this click happens.
                    setActiveNotificationId(null);
                    try { sessionStorage.setItem(WELCOME_OPEN_FLAG, '1'); } catch {}
                    onViewAll?.();
                  } else {
                    // Default: open full notifications page
                    setActiveNotificationId(null); // Clear active when navigating away
                    onViewAll?.();
                  }
                }}
                timeAgo={timeAgo}
                compact={true}
              />
            ))
          )}
        </div>
        {/* Footer with View All */}
        <button 
          onClick={onViewAll}
          className="w-full flex items-center justify-center py-2.5 border-t border-warm hover:bg-[#E36B11]/5 transition-colors"
        >
          <span className="text-xs font-semibold text-[#E36B11] uppercase">View All</span>
        </button>
        
        {/* Battle Challenge Modal - same as full version */}
        {selectedChallenge && (
          <div 
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            onClick={() => setSelectedChallenge(null)}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div 
              className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-4">
                <Swords className="w-10 h-10 text-[#E36B11] mx-auto mb-2" />
                <h3 className="font-bold text-gray-900 text-lg">Battle Challenge!</h3>
                <p className="text-sm text-gray-600 mt-1">
                  <strong>{selectedChallenge.challengerUsername}</strong> challenges you to a {selectedChallenge.topic.toUpperCase()} battle for <strong>{selectedChallenge.wager.toFixed(2)} BOGX</strong>
                </p>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    const battleId = selectedChallenge.id;
                    setSelectedChallenge(null);
                    if (onGoToBattle) onGoToBattle(battleId);
                  }}
                  className="w-full py-2.5 bg-[#E36B11] text-white font-semibold rounded-lg hover:bg-[#C4772A] transition-colors"
                >
                  Accept & Play Now!
                </button>
                <button
                  onClick={handleDeclineChallenge}
                  disabled={decliningChallenge}
                  className="w-full py-2.5 text-red-500 hover:text-red-600 font-semibold text-sm transition-colors disabled:opacity-50"
                >
                  {decliningChallenge ? 'Declining...' : 'Decline Challenge'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // FULL MODE - Regular notification page
  return (
    <div 
      className={`flex flex-col h-full overflow-hidden ${isOpen ? '' : 'hidden'}`}
      style={{ backgroundColor: '#F5F0E8' }}
    >
      {/* Reward Animation */}
      {showRewardAnimation && (
        <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center">
          <CoinAnimation amount={0.50} variant="gain" onComplete={() => setShowRewardAnimation(false)} />
        </div>
      )}
      {/* Header - fixed */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm flex-shrink-0">
        <div className="flex items-center gap-3">
          {showSettings ? (
            <BackButton onClick={() => { 
              sounds.click(); 
              setShowSettings(false);
              if (onSettingsClosed) onSettingsClosed();
            }} />
          ) : (
            <Bell className="w-5 h-5 text-[#E36B11]" />
          )}
          {showSettings ? (
            <>
              <Settings className="w-5 h-5 text-[#E36B11]" />
              <div>
                <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">SETTINGS</span>
                <span className="text-[10px] text-gray-500 -mt-0.5 block">Customize your experience</span>
              </div>
            </>
          ) : (
            <div>
              <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">NEWS</span>
              <span className="text-[10px] text-gray-500 -mt-0.5 block">Updates & notifications</span>
            </div>
          )}
        </div>
        {!showSettings && (
          <button 
            onClick={() => { sounds.click(); setShowSettings(true); }}
            className="p-2.5 bg-[#E36B11]/10 hover:bg-[#E36B11]/20 rounded-xl transition-colors"
          >
            <Settings className="w-5 h-5 text-[#E36B11]" />
          </button>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: '#F5F0E8' }}>
      
      {/* BATTLE RESULT VIEW - shown inline when a battle is selected */}
      {!showSettings && selectedBattle && selectedBattle.battle && !loadingBattle && (
        <div className="h-full">
          <BattleResultScreen
            battle={selectedBattle.battle}
            myResults={selectedBattle.myResults.map(r => ({ ...r, timeMs: r.timeMs || 0 }))}
            opponentResults={selectedBattle.opponentResults.map(r => ({ ...r, timeMs: r.timeMs || 0 }))}
            myTotalPoints={selectedBattle.myPoints}
            opponentTotalPoints={selectedBattle.opponentPoints}
            isCreator={selectedBattle.isCreator || false}
            userAvatar={selectedBattle.myAvatar}
            onBackToPool={() => setSelectedBattle(null)}
            onRematch={() => setSelectedBattle(null)}
            onContinue={() => setSelectedBattle(null)}
            isMobile={true}
          />
        </div>
      )}
      
      {/* LOADING BATTLE */}
      {!showSettings && loadingBattle && (
        <div className="flex items-center justify-center h-full min-h-[300px]">
          <LogoLoader size="md" text="Loading battle..." />
        </div>
      )}

      {/* NOTIFICATION LIST VIEW */}
      {!showSettings && !selectedBattle && !selectedWelcome && !loadingBattle && (
        <div className="px-4 py-3 space-y-2">
          {/* Guest - Full page message, once the welcome message is dismissed */}
          {!isLoggedIn && displayNotifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-4 px-4">
              <div className="flex items-center gap-2 mb-1">
                <Bell className="w-6 h-6 text-[#E36B11]" />
                <h3 className="font-display text-2xl text-gray-900 tracking-wide">NEVER MISS A REWARD</h3>
              </div>
              <p className="text-gray-500 text-sm text-center max-w-[300px] mb-4">
                Enable notifications and claim <span className="font-bold text-[#E36B11]">+0.50 BOGX</span>
              </p>
              <div className="w-full max-w-[300px] space-y-2 mb-4">
                <div className="flex items-center gap-3 p-3 bg-cream rounded-xl border border-warm">
                  <div className="w-10 h-10 bg-[#E36B11]/10 rounded-xl flex items-center justify-center">
                    <Swords className="w-5 h-5 text-[#E36B11]" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-900">Battle results</span>
                    <p className="text-xs text-gray-500">Get notified when battles end</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-cream rounded-xl border border-warm">
                  <div className="w-10 h-10 bg-[#E36B11]/10 rounded-xl flex items-center justify-center">
                    <Target className="w-5 h-5 text-[#E36B11]" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-900">Prediction outcomes</span>
                    <p className="text-xs text-gray-500">See if your predictions were correct</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-cream rounded-xl border border-warm">
                  <div className="w-10 h-10 bg-[#E36B11]/10 rounded-xl flex items-center justify-center">
                    <Music className="w-5 h-5 text-[#E36B11]" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-900">Song request updates</span>
                    <p className="text-xs text-gray-500">Know when your song is played</p>
                  </div>
                </div>
              </div>
              <button
                onClick={onGoToProfile}
                className="w-full max-w-[300px] py-3 bg-[#E36B11] text-white font-bold rounded-lg flex items-center justify-center gap-2"
              >
                <Bell className="w-5 h-5" />
                ENABLE & EARN 0.50 BOGX
              </button>
              <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
                <Settings className="w-3 h-3" />
                No spam. Only important updates.
              </p>
            </div>
          )}
          
          {/* Loading - only for logged in users */}
          {loadingNotifications && isLoggedIn && (
            <NewsSkeleton />
          )}
          
          {/* Empty State - Push NOT enabled */}
          {!loadingNotifications && displayNotifications.filter(n => !dismissedNotifications.has(n.id)).length === 0 && isLoggedIn && !pushEnabled && (
            <div className="flex flex-col items-center justify-center py-4 px-4">
              <div className="flex items-center gap-2 mb-1">
                <Bell className="w-6 h-6 text-[#E36B11]" />
                <h3 className="font-display text-2xl text-gray-900 tracking-wide">NEVER MISS A REWARD</h3>
              </div>
              {!pushRewardClaimed ? (
                <p className="text-gray-500 text-sm text-center max-w-[300px] mb-4">
                  Enable notifications and claim <span className="font-bold text-[#E36B11]">+0.50 BOGX</span>
                </p>
              ) : (
                <p className="text-gray-500 text-sm text-center max-w-[300px] mb-4">
                  Stay updated on battles, results and more
                </p>
              )}
              <div className="w-full max-w-[300px] space-y-2 mb-5">
                <div className="flex items-center gap-3 p-3 bg-cream rounded-xl border border-warm">
                  <div className="w-10 h-10 bg-[#E36B11]/10 rounded-xl flex items-center justify-center">
                    <Swords className="w-5 h-5 text-[#E36B11]" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-900">Battle Request</span>
                    <p className="text-xs text-gray-500">When someone invites you</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-cream rounded-xl border border-warm">
                  <div className="w-10 h-10 bg-[#E36B11]/10 rounded-xl flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-[#E36B11]" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-900">Battle Result</span>
                    <p className="text-xs text-gray-500">When a battle is finished</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-cream rounded-xl border border-warm">
                  <div className="w-10 h-10 bg-[#E36B11]/10 rounded-xl flex items-center justify-center">
                    <ThumbsUp className="w-5 h-5 text-[#E36B11]" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-900">Comment Like</span>
                    <p className="text-xs text-gray-500">When someone likes your comment</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                disabled={pushLoading}
                className="w-full max-w-[300px] py-3 bg-[#E36B11] text-white font-bold rounded-lg flex items-center justify-center gap-2"
              >
                <Bell className="w-5 h-5" />
                {pushRewardClaimed ? 'ENABLE NOTIFICATIONS' : 'ENABLE & EARN 0.50 BOGX'}
              </button>
              <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
                <Settings className="w-3 h-3" />
                No spam. Only important updates.
              </p>
            </div>
          )}
          
          {/* Empty State - Push enabled but no notifications */}
          {!loadingNotifications && displayNotifications.filter(n => !dismissedNotifications.has(n.id)).length === 0 && isLoggedIn && pushEnabled && (
            <div className="flex flex-col items-center justify-center py-4 px-4">
              <div className="flex items-center gap-2 mb-1">
                <Check className="w-6 h-6 text-green-500" />
                <h3 className="font-display text-2xl text-gray-900 tracking-wide">ALL CAUGHT UP!</h3>
              </div>
              <p className="text-gray-500 text-sm text-center max-w-[300px] mb-4">
                We'll notify you when something happens.
              </p>
              <div className="w-full max-w-[300px] space-y-2">
                <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-green-200">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <Swords className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-900">Battle Request</span>
                    <p className="text-xs text-gray-500">When someone invites you</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-green-200">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-900">Battle Result</span>
                    <p className="text-xs text-gray-500">When a battle is finished</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-green-200">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <ThumbsUp className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-900">Comment Like</span>
                    <p className="text-xs text-gray-500">When someone likes your comment</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Notification Items */}
          {displayNotifications.filter(n => !dismissedNotifications.has(n.id)).map((notif) => (
            <NotificationItem
              key={notif.id}
              notif={notif}
              isUnread={!notif.read && !readNotifications.has(notif.id)}
              isActive={activeNotificationId === notif.id}
              onDismiss={() => handleDismissNotification(notif)}
              onClick={() => {
                // Mark as read locally (removes highlight but keeps message)
                setReadNotifications(prev => {
                  const newSet = new Set(prev);
                  newSet.add(notif.id);
                  return newSet;
                });
                
                // Dispatch event so other instances (widget/full page) sync
                window.dispatchEvent(new CustomEvent('notification-read', { detail: { notificationId: notif.id } }));
                
                // Mark as read on server (NOT dismiss - just mark read)
                if (user?.id) {
                  fetch('/api/notifications/mark-single-read', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, notificationId: notif.id })
                  }).catch(() => {});
                }
                
                // Open detail view based on type
                // Note: Points are awarded when notification is created, not on click
                if (notif.type === 'song_approved') {
                  // Just show the notification - points already awarded on server
                } else if (notif.type === 'welcome') {
                  setSelectedWelcome(true);
                } else if (notif.type === 'prediction_result' && notif.predictionQuestion && notif.predictionOptions) {
                  setSelectedPredictionResult({
                    question: notif.predictionQuestion,
                    options: notif.predictionOptions,
                    userOptionId: notif.userOptionId || '',
                    correctOptionId: notif.predictionCorrectOptionId ?? null,
                    pointsAwarded: notif.pointsAwarded || 0,
                    pointsReward: notif.pointsReward || 0,
                    resolvedAt: notif.resolvedAt,
                    won: !!notif.won,
                  });
                } else if (notif.type === 'comment_like' && notif.articleId) {
                  onOpenArticle?.(String(notif.articleId));
                } else if (notif.battleId) {
                  if (notif.type === 'battle_result') {
                    if (onShowBattleResult) onShowBattleResult(String(notif.battleId));
                    else loadBattleDetails(notif.battleId);
                  } else if (notif.type === 'battle_challenge') {
                    if (onShowChallenge) onShowChallenge(String(notif.battleId), notif.id);
                    else loadChallengeDetails(notif.battleId, notif.id);
                  } else if (notif.type === 'battle_accepted') {
                    loadBattleDetails(notif.battleId);
                  }
                }
              }}
              timeAgo={timeAgo}
            />
          ))}
        </div>
      )}
      
      {/* SETTINGS VIEW */}
      {showSettings && (
      <div className="pb-4">
      <div className="px-4 py-3 border-b border-warm/50 space-y-3">
        {/* Guest Warning */}
        {!isLoggedIn && (
          <div className="py-3 px-4 bg-yellow-50 border border-yellow-200 rounded-xl">
            <p className="text-sm text-yellow-600 text-center">
              🔒 Please login to enable push notifications
            </p>
          </div>
        )}

        {/* Master Push Toggle - enables all notifications */}
        <button 
          onClick={() => togglePush()}
          disabled={pushLoading || !isLoggedIn}
          className={`w-full flex items-center justify-between py-3 px-4 bg-cream rounded-xl transition-colors disabled:opacity-50 ${!isLoggedIn ? 'opacity-40' : ''}`}
        >
          <div className="flex items-center gap-3">
            {pushLoading ? (
              <LogoLoader size="sm" />
            ) : pushEnabled && isLoggedIn ? (
              <Bell className="w-5 h-5 text-[#E36B11] fill-[#E36B11]" />
            ) : (
              <BellOff className="w-5 h-5 text-gray-600" />
            )}
            <div className="text-left">
              <span className="text-sm font-medium text-gray-900 block">Push Notifications</span>
              <span className="text-xs text-gray-600">Master switch for all notifications</span>
            </div>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors ${pushEnabled && isLoggedIn ? 'bg-green-500' : 'bg-gray-300'} relative`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${pushEnabled && isLoggedIn ? 'right-1' : 'left-1'}`} />
          </div>
        </button>

        </div>

      {/* Individual notification toggles */}
      <div className="px-4 py-3 space-y-3">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Choose what to receive:</p>
        
        {/* Battle Request Toggle */}
        <button 
          onClick={toggleBattleRequest}
          disabled={!pushEnabled || !isLoggedIn}
          className={`w-full flex items-center justify-between py-3 px-4 bg-cream rounded-xl transition-colors ${!pushEnabled || !isLoggedIn ? 'opacity-40' : 'hover:bg-cream'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#E36B11]/20 flex items-center justify-center">
              <Swords className="w-4 h-4 text-[#E36B11]" />
            </div>
            <div className="text-left">
              <span className="text-sm font-medium text-gray-900 block">Battle Request</span>
              <span className="text-xs text-gray-500">When someone invites you</span>
            </div>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors ${notifyBattleRequest && pushEnabled ? 'bg-green-500' : 'bg-gray-300'} relative`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${notifyBattleRequest && pushEnabled ? 'right-1' : 'left-1'}`} />
          </div>
        </button>

        {/* Battle Result Toggle */}
        <button 
          onClick={toggleBattleResult}
          disabled={!pushEnabled || !isLoggedIn}
          className={`w-full flex items-center justify-between py-3 px-4 bg-cream rounded-xl transition-colors ${!pushEnabled || !isLoggedIn ? 'opacity-40' : 'hover:bg-cream'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#E36B11]/20 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-[#E36B11]" />
            </div>
            <div className="text-left">
              <span className="text-sm font-medium text-gray-900 block">Battle Result</span>
              <span className="text-xs text-gray-500">When a battle is finished</span>
            </div>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors ${notifyBattleResult && pushEnabled ? 'bg-green-500' : 'bg-gray-300'} relative`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${notifyBattleResult && pushEnabled ? 'right-1' : 'left-1'}`} />
          </div>
        </button>

        {/* Comment Like Toggle */}
        <button 
          onClick={toggleCommentLike}
          disabled={!pushEnabled || !isLoggedIn}
          className={`w-full flex items-center justify-between py-3 px-4 bg-cream rounded-xl transition-colors ${!pushEnabled || !isLoggedIn ? 'opacity-40' : 'hover:bg-cream'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#E36B11]/20 flex items-center justify-center">
              <ThumbsUp className="w-4 h-4 text-[#E36B11]" />
            </div>
            <div className="text-left">
              <span className="text-sm font-medium text-gray-900 block">Comment Like</span>
              <span className="text-xs text-gray-500">When someone likes your comment</span>
            </div>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors ${notifyCommentLike && pushEnabled ? 'bg-green-500' : 'bg-gray-300'} relative`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${notifyCommentLike && pushEnabled ? 'right-1' : 'left-1'}`} />
          </div>
        </button>
      </div>

      </div>
      )}
      
      </div>{/* End Scrollable Content */}

      {/* Prediction Result Modal */}
      <PredictionResultModal
        isOpen={selectedPredictionResult !== null}
        data={selectedPredictionResult}
        onClose={() => setSelectedPredictionResult(null)}
        onPointsAwarded={onPointsAwarded}
      />

      {/* Challenge Modal - rendered via portal so they always
          escape any ancestor stacking context (e.g. Desktop's <main> is capped
          at z-0, which would otherwise trap a nested "fixed z-50" modal behind
          the sticky header and make it invisible/unclickable). 
          NOTE: Battle results are now shown inline, not as a modal. */}
      {typeof document !== 'undefined' && createPortal(
        <>
      {/* Challenge Modal wrapper */}
      {selectedChallenge && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          onClick={() => setSelectedChallenge(null)}
        >
          {/* Blurry background - light theme */}
          <div className="absolute inset-0 bg-cream/90 backdrop-blur-md" />
          
          {/* Challenge Details Card */}
          {selectedChallenge && (
            <div 
              className="relative z-10 w-full max-w-sm mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-[#F5F0E8] border-2 border-[#E5DDD0] rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5DDD0]">
                  <div className="flex items-center gap-2">
                    <Swords className="w-5 h-5 text-[#E36B11]" />
                    <h3 className="font-bold text-gray-900 text-lg">Battle Challenge!</h3>
                  </div>
                  <button 
                    onClick={() => setSelectedChallenge(null)}
                    className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5">
                  {/* Challenger Info */}
                  <div className="flex items-center gap-4 mb-5 p-4 bg-white rounded-xl border border-[#E5DDD0]">
                    {selectedChallenge.challengerAvatar ? (
                      <img src={selectedChallenge.challengerAvatar} alt="" className="w-14 h-14 rounded-full border-2 border-[#E36B11]" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-[#E36B11]/10 flex items-center justify-center border-2 border-[#E36B11]">
                        <span className="text-xl">👤</span>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-900 font-bold text-lg">{selectedChallenge.challengerUsername}</p>
                      <p className="text-gray-500 text-sm">Rank #{selectedChallenge.challengerRank}</p>
                      <p className="text-gray-400 text-xs">{selectedChallenge.challengerWins} wins • {selectedChallenge.challengerGamesPlayed} games</p>
                    </div>
                  </div>
                  
                  {/* Battle Details */}
                  <div className="space-y-1 mb-5">
                    <div className="flex justify-between items-center py-2.5 border-b border-[#E5DDD0]">
                      <span className="text-gray-500">Topic</span>
                      <span className="text-gray-900 font-semibold uppercase">{selectedChallenge.topic}</span>
                    </div>
                    <div className="flex justify-between items-center py-2.5 border-b border-[#E5DDD0]">
                      <span className="text-gray-500">Rounds</span>
                      <span className="text-gray-900 font-semibold">{selectedChallenge.rounds}</span>
                    </div>
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-gray-500">Wager</span>
                      <span className="text-[#E36B11] font-bold text-lg flex items-center gap-1">
                        {Number(selectedChallenge.wager).toFixed(2)}
                        <img src="/images/bogxcoin.png" alt="BOGX" className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        const battleId = selectedChallenge.id;
                        setSelectedChallenge(null);
                        if (onGoToBattle) {
                          onGoToBattle(battleId);
                        } else {
                          window.location.href = `/mobile?tab=battles&battle=${battleId}`;
                        }
                      }}
                      className="w-full py-3 bg-[#E36B11] hover:bg-[#c47830] text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <Swords className="w-5 h-5" />
                      Accept & Play Now!
                    </button>
                    <button
                      onClick={handleDeclineChallenge}
                      disabled={decliningChallenge}
                      className="w-full py-2.5 text-red-500 hover:text-red-600 font-semibold text-sm transition-colors disabled:opacity-50"
                    >
                      {decliningChallenge ? 'Declining...' : 'Decline Challenge'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
        </>,
        document.body
      )}

      {/* Push Notification Explanation Modal - Bottom Sheet */}
      {showPushModal && (
        <div 
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={() => setShowPushModal(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          
          {/* Bottom Sheet */}
          <div 
            className="relative w-full max-w-lg bg-gradient-to-b from-zinc-900 to-black border-t border-[#E36B11]/30 rounded-t-3xl p-6 pb-10 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            style={{
              animation: 'slideUp 0.3s ease-out',
            }}
          >
            {/* Handle */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1 bg-gray-300 rounded-full" />
            
            {/* Icon */}
            <div className="flex justify-center mb-6 mt-4">
              <div className="w-20 h-20 rounded-full bg-[#E36B11]/20 flex items-center justify-center">
                <Bell className="w-10 h-10 text-[#E36B11]" />
              </div>
            </div>
            
            {/* Title */}
            <h2 className="text-2xl font-bold text-white text-center mb-3">
              Enable Notifications?
            </h2>
            
            {/* Description */}
            <p className="text-white/60 text-center mb-6 leading-relaxed">
              Stay in the game! Get notified when:
            </p>
            
            {/* Benefits List */}
            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3 bg-cream rounded-lg p-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <Swords className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">Battle Results</p>
                  <p className="text-white/40 text-xs">Know instantly when you win or lose</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 bg-cream rounded-lg p-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Swords className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">Challenge Accepted</p>
                  <p className="text-white/40 text-xs">Someone accepted your battle challenge</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 bg-cream rounded-lg p-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">Don't Miss Out</p>
                  <p className="text-white/40 text-xs">Time-sensitive battles & bonus rewards</p>
                </div>
              </div>
            </div>
            
            {/* Buttons */}
            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowPushModal(false);
                  togglePush();
                }}
                disabled={pushLoading}
                className="w-full py-4 bg-[#E36B11] text-white font-bold text-lg rounded-xl hover:bg-[#c5e000] transition-colors flex items-center justify-center gap-2"
              >
                {pushLoading ? (
                  <LogoLoader size="sm" />
                ) : (
                  <>
                    <Bell className="w-5 h-5" />
                    Enable Notifications
                  </>
                )}
              </button>
              
              <button
                onClick={() => setShowPushModal(false)}
                className="w-full py-3 text-white/40 font-medium hover:text-white/60 transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
