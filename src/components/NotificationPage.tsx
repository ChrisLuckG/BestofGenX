"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, Check, Zap, Clock, Trophy, Settings, Swords, Trash2, TrendingUp, Target, Music } from "lucide-react";
import { sounds } from "@/utils/sounds";
import { useAuth } from "@/context/AuthContext";
import LogoLoader from "./LogoLoader";
import BackButton from "./BackButton";
import BattleResultCard from "./BattleResultCard";
import PredictionResultModal, { PredictionResultData } from "./PredictionResultModal";
import { NewsSkeleton } from "@/components/desktop/DesktopSkeletons";

interface PredictionOption {
  id: string;
  label: string;
}

interface Notification {
  id: string;
  type: 'battle_result' | 'battle_accepted' | 'battle_challenge' | 'ranking' | 'test' | 'system' | 'prediction_result' | 'song_approved' | 'song_rejected' | 'song_in_progress';
  title: string;
  message: string;
  avatar?: string;
  battleId?: string;
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
  myResults: { correct: boolean; points: number; answerIndex?: number }[];
  opponentResults: { correct: boolean; points: number }[];
  questions?: BattleQuestion[];
}

interface NotificationPageProps {
  isOpen?: boolean; // Optional - defaults to true for standalone page
  onClose?: () => void; // Optional - not needed for standalone page
  onGoToProfile?: () => void;
  onGoToBattle?: (battleId: string) => void; // Navigate to battle and start it
  autoEnable?: 'email' | 'sms' | null;
  onPointsAwarded?: (amount: number) => void; // Trigger coin animation
  autoOpenSettings?: boolean; // Open settings view directly
  onSettingsClosed?: () => void; // Called when settings view is closed
}

// Simple Notification Item with X button
function NotificationItem({ 
  notif, 
  onDismiss, 
  onClick, 
  timeAgo, 
  isUnread 
}: { 
  notif: Notification; 
  onDismiss: () => void; 
  onClick: () => void;
  timeAgo: (date: string) => string;
  isUnread: boolean;
}) {
  return (
    <div className={`relative flex items-start gap-3 p-3 rounded-xl border transition-colors ${
      isUnread 
        ? 'bg-[#D4873A]/10 border-[#D4873A]/30 hover:bg-[#D4873A]/15' 
        : 'bg-cream border-warm hover:bg-cream'
    }`}>
      {/* Trash Button to dismiss */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-50 rounded transition-colors"
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
            <img src={notif.avatar} alt="" className="w-10 h-10 rounded-full" />
          ) : (
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
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
                        : 'bg-[#D4873A]/20'
            }`}>
              {notif.type === 'battle_result' ? (
                <Trophy className={`w-5 h-5 ${
                  notif.title.includes('Won') ? 'text-green-400' : notif.title.includes('Lost') ? 'text-red-400' : 'text-yellow-400'
                }`} />
              ) : notif.type === 'prediction_result' ? (
                <Target className={`w-5 h-5 ${notif.won ? 'text-green-500' : 'text-red-500'}`} />
              ) : notif.type === 'song_approved' ? (
                <Music className="w-5 h-5 text-green-500" />
              ) : notif.type === 'song_rejected' ? (
                <Music className="w-5 h-5 text-red-500" />
              ) : notif.type === 'song_in_progress' ? (
                <Music className="w-5 h-5 text-blue-500" />
              ) : (
                <Swords className="w-5 h-5 text-[#D4873A]" />
              )}
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-sm text-gray-900">{notif.title}</span>
            <span className="text-xs text-gray-600 flex-shrink-0">{timeAgo(notif.createdAt)}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{notif.message}</p>
        </div>
      </button>
    </div>
  );
}

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

export default function NotificationPage({ isOpen = true, onClose, onGoToProfile, onGoToBattle, autoEnable, onNewNotification, onPointsAwarded, autoOpenSettings, onSettingsClosed }: NotificationPageProps & { onNewNotification?: () => void }) {
  const { user, isLoggedIn } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  
  // Update showSettings when autoOpenSettings prop changes or on mount
  useEffect(() => {
    if (autoOpenSettings) {
      // Small delay to ensure component is fully mounted
      setTimeout(() => setShowSettings(true), 100);
    }
  }, [autoOpenSettings]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true); // Only true on first load
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [selectedBattle, setSelectedBattle] = useState<BattleResult | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<any | null>(null);
  const [selectedPredictionResult, setSelectedPredictionResult] = useState<PredictionResultData | null>(null);
  const [loadingBattle, setLoadingBattle] = useState(false);
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());
  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());
  const [testPushLoading, setTestPushLoading] = useState(false);
  
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
  const [reminderNewMatch, setReminderNewMatch] = useState(false); // Default: off until push enabled
  const [reminder1h, setReminder1h] = useState(false); // Default: off until push enabled
  const [reminderEnd, setReminderEnd] = useState(false); // Reminder when game ends
  
  // Email notification states
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailNewMatch, setEmailNewMatch] = useState(false);
  const [email1h, setEmail1h] = useState(false);
  const [emailResults, setEmailResults] = useState(false);
  
  // SMS notification states
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsNewMatch, setSmsNewMatch] = useState(false);
  const [sms1h, setSms1h] = useState(false);
  const [smsResults, setSmsResults] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  
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
    }
  }, [isOpen, isLoggedIn, user?.id, showSettings]);

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

  // Format time ago
  const timeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diff = Math.floor((now.getTime() - then.getTime()) / 1000);
    
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  // Load battle details for modal
  const loadBattleDetails = async (battleId: string) => {
    if (!user?.id) return;
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
        });
      }
    } catch (error) {
      console.error('Failed to load battle:', error);
    } finally {
      setLoadingBattle(false);
    }
  };

  // Load challenge details for modal
  const loadChallengeDetails = async (battleId: string) => {
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
      // Only load reminder preferences if push is actually enabled
      if (isPushGranted) {
        const savedNewMatch = localStorage.getItem('reminder_new_match');
        setReminderNewMatch(savedNewMatch === null ? true : savedNewMatch === 'true');
        
        const saved1h = localStorage.getItem('reminder_1h');
        setReminder1h(saved1h === null ? true : saved1h === 'true');
        
        const savedEnd = localStorage.getItem('reminder_end');
        setReminderEnd(savedEnd === 'true');
      }
    });
    
    // Load email preferences
    const savedEmailEnabled = localStorage.getItem('email_enabled');
    setEmailEnabled(savedEmailEnabled === 'true');
    if (savedEmailEnabled === 'true') {
      setEmailNewMatch(localStorage.getItem('email_new_match') === 'true');
      setEmail1h(localStorage.getItem('email_1h') === 'true');
      setEmailResults(localStorage.getItem('email_results') === 'true');
    }
    
    // Load SMS preferences
    const savedSmsEnabled = localStorage.getItem('sms_enabled');
    setSmsEnabled(savedSmsEnabled === 'true');
    if (savedSmsEnabled === 'true') {
      setSmsNewMatch(localStorage.getItem('sms_new_match') === 'true');
      setSms1h(localStorage.getItem('sms_1h') === 'true');
      setSmsResults(localStorage.getItem('sms_results') === 'true');
    }
  }, [isLoggedIn]);

  // Auto-enable email or SMS when opened from SummaryCard
  useEffect(() => {
    if (!isOpen || !autoEnable || !isLoggedIn || !user?.id) return;
    
    const enableNotification = async () => {
      if (autoEnable === 'email' && !emailEnabled) {
        setEmailEnabled(true);
        setEmailNewMatch(true);
        setEmail1h(true);
        setEmailResults(true);
        localStorage.setItem('email_enabled', 'true');
        localStorage.setItem('email_new_match', 'true');
        localStorage.setItem('email_1h', 'true');
        localStorage.setItem('email_results', 'true');
        // Save to backend
        try {
          await fetch('/api/user/update-notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, notifyEmail: true }),
          });
        } catch (error) {
          console.error('Failed to save email preference:', error);
        }
      } else if (autoEnable === 'sms' && !smsEnabled) {
        setSmsEnabled(true);
        setSmsNewMatch(true);
        setSms1h(true);
        setSmsResults(true);
        localStorage.setItem('sms_enabled', 'true');
        localStorage.setItem('sms_new_match', 'true');
        localStorage.setItem('sms_1h', 'true');
        localStorage.setItem('sms_results', 'true');
        // Save to backend
        try {
          await fetch('/api/user/update-notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, notifySms: true }),
          });
        } catch (error) {
          console.error('Failed to save SMS preference:', error);
        }
      }
    };
    
    enableNotification();
  }, [isOpen, autoEnable, isLoggedIn, user?.id]);

  // Save reminder preferences
  const toggleReminderNewMatch = () => {
    const newValue = !reminderNewMatch;
    setReminderNewMatch(newValue);
    localStorage.setItem('reminder_new_match', String(newValue));
  };

  const toggleReminder1h = () => {
    const newValue = !reminder1h;
    setReminder1h(newValue);
    localStorage.setItem('reminder_1h', String(newValue));
  };

  const toggleReminderEnd = () => {
    const newValue = !reminderEnd;
    setReminderEnd(newValue);
    localStorage.setItem('reminder_end', String(newValue));
  };

  // Email toggle functions
  const toggleEmailEnabled = async () => {
    if (!isLoggedIn || !user?.id) return;
    const newValue = !emailEnabled;
    setEmailEnabled(newValue);
    localStorage.setItem('email_enabled', String(newValue));
    if (newValue) {
      setEmailNewMatch(true);
      localStorage.setItem('email_new_match', 'true');
    }
    // Save to backend
    try {
      await fetch('/api/user/update-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, notifyEmail: newValue }),
      });
    } catch (error) {
      console.error('Failed to save email preference:', error);
    }
  };

  const toggleEmailNewMatch = () => {
    const newValue = !emailNewMatch;
    setEmailNewMatch(newValue);
    localStorage.setItem('email_new_match', String(newValue));
  };

  const toggleEmail1h = () => {
    const newValue = !email1h;
    setEmail1h(newValue);
    localStorage.setItem('email_1h', String(newValue));
  };

  const toggleEmailResults = () => {
    const newValue = !emailResults;
    setEmailResults(newValue);
    localStorage.setItem('email_results', String(newValue));
  };

  // SMS toggle functions
  const toggleSmsEnabled = async () => {
    if (!isLoggedIn || !user?.id) return;
    // Check if user has phone number
    if (!user?.phone && !smsEnabled) {
      setShowPhoneModal(true);
      return;
    }
    const newValue = !smsEnabled;
    setSmsEnabled(newValue);
    localStorage.setItem('sms_enabled', String(newValue));
    if (newValue) {
      setSmsNewMatch(true);
      localStorage.setItem('sms_new_match', 'true');
    }
    // Save to backend
    try {
      await fetch('/api/user/update-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, notifySms: newValue }),
      });
    } catch (error) {
      console.error('Failed to save SMS preference:', error);
    }
  };

  const toggleSmsNewMatch = () => {
    const newValue = !smsNewMatch;
    setSmsNewMatch(newValue);
    localStorage.setItem('sms_new_match', String(newValue));
  };

  const toggleSms1h = () => {
    const newValue = !sms1h;
    setSms1h(newValue);
    localStorage.setItem('sms_1h', String(newValue));
  };

  const toggleSmsResults = () => {
    const newValue = !smsResults;
    setSmsResults(newValue);
    localStorage.setItem('sms_results', String(newValue));
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
      }
    } catch (error) {
      console.error('Push toggle error:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to toggle push notifications: ${msg}`);
    } finally {
      setPushLoading(false);
    }
  };

  return (
    <div 
      className={`flex flex-col h-full overflow-hidden ${isOpen ? '' : 'hidden'}`}
      style={{ backgroundColor: '#F5F0E8' }}
    >
      {/* Header - fixed */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm flex-shrink-0">
        {showSettings ? (
          <BackButton onClick={() => { 
            sounds.click(); 
            setShowSettings(false);
            if (onSettingsClosed) onSettingsClosed();
          }} />
        ) : (
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-[#D4873A]" />
            <div>
              <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">GenX News</span>
              <span className="text-[10px] text-gray-500 -mt-0.5 block">Updates & notifications</span>
            </div>
          </div>
        )}
        {showSettings ? (
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-[#D4873A]" />
            <div>
              <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">Settings</span>
              <span className="text-[10px] text-gray-500 -mt-0.5 block">Customize your experience</span>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => { sounds.click(); setShowSettings(true); }}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5 text-gray-500" />
          </button>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: '#F5F0E8' }}>
      
      {/* NOTIFICATION LIST VIEW */}
      {!showSettings && (
        <div className="px-4 py-3 space-y-2">
          {/* Guest - Full page message */}
          {!isLoggedIn && (
            <div className="flex flex-col items-center justify-center py-4 px-4">
              <div className="flex items-center gap-2 mb-1">
                <Bell className="w-6 h-6 text-[#D4873A]" />
                <h3 className="font-display text-2xl text-gray-900 tracking-wide">NEVER MISS A REWARD</h3>
              </div>
              <p className="text-gray-500 text-sm text-center max-w-[300px] mb-4">
                Enable notifications and claim <span className="font-bold text-[#D4873A]">+0.10 BOGX</span>
              </p>
              <div className="w-full max-w-[300px] space-y-2 mb-4">
                <div className="flex items-center gap-3 p-3 bg-cream rounded-xl border border-warm">
                  <div className="w-10 h-10 bg-[#D4873A]/10 rounded-xl flex items-center justify-center">
                    <Swords className="w-5 h-5 text-[#D4873A]" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-900">Battle results</span>
                    <p className="text-xs text-gray-500">Get notified when battles end</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-cream rounded-xl border border-warm">
                  <div className="w-10 h-10 bg-[#D4873A]/10 rounded-xl flex items-center justify-center">
                    <Target className="w-5 h-5 text-[#D4873A]" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-900">Prediction outcomes</span>
                    <p className="text-xs text-gray-500">See if your predictions were correct</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-cream rounded-xl border border-warm">
                  <div className="w-10 h-10 bg-[#D4873A]/10 rounded-xl flex items-center justify-center">
                    <Music className="w-5 h-5 text-[#D4873A]" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-900">Song request updates</span>
                    <p className="text-xs text-gray-500">Know when your song is played</p>
                  </div>
                </div>
              </div>
              <button
                onClick={onGoToProfile}
                className="w-full max-w-[300px] py-3 bg-[#D4873A] text-white font-bold rounded-lg flex items-center justify-center gap-2"
              >
                <Bell className="w-5 h-5" />
                ENABLE & EARN 0.10 BOGX
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
          {!loadingNotifications && notifications.filter(n => !dismissedNotifications.has(n.id)).length === 0 && isLoggedIn && !pushEnabled && (
            <div className="flex flex-col items-center justify-center py-4 px-4">
              <div className="flex items-center gap-2 mb-1">
                <Bell className="w-6 h-6 text-[#D4873A]" />
                <h3 className="font-display text-2xl text-gray-900 tracking-wide">NEVER MISS A REWARD</h3>
              </div>
              <p className="text-gray-500 text-sm text-center max-w-[300px] mb-4">
                Enable notifications and claim <span className="font-bold text-[#D4873A]">+0.10 BOGX</span>
              </p>
              <div className="w-full max-w-[300px] space-y-2 mb-5">
                <div className="flex items-center gap-3 p-3 bg-cream rounded-xl border border-warm">
                  <div className="w-10 h-10 bg-[#D4873A]/10 rounded-xl flex items-center justify-center">
                    <Swords className="w-5 h-5 text-[#D4873A]" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-900">Battle results</span>
                    <p className="text-xs text-gray-500">Get notified when battles end</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-cream rounded-xl border border-warm">
                  <div className="w-10 h-10 bg-[#D4873A]/10 rounded-xl flex items-center justify-center">
                    <Target className="w-5 h-5 text-[#D4873A]" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-900">Prediction outcomes</span>
                    <p className="text-xs text-gray-500">See if your predictions were correct</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-cream rounded-xl border border-warm">
                  <div className="w-10 h-10 bg-[#D4873A]/10 rounded-xl flex items-center justify-center">
                    <Music className="w-5 h-5 text-[#D4873A]" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-900">Song request updates</span>
                    <p className="text-xs text-gray-500">Know when your song is played</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                disabled={pushLoading}
                className="w-full max-w-[300px] py-3 bg-[#D4873A] text-white font-bold rounded-lg flex items-center justify-center gap-2"
              >
                <Bell className="w-5 h-5" />
                ENABLE & EARN 0.10 BOGX
              </button>
              <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
                <Settings className="w-3 h-3" />
                No spam. Only important updates.
              </p>
            </div>
          )}
          
          {/* Empty State - Push enabled but no notifications */}
          {!loadingNotifications && notifications.filter(n => !dismissedNotifications.has(n.id)).length === 0 && isLoggedIn && pushEnabled && (
            <div className="flex flex-col items-center justify-center py-4 px-4">
              <div className="flex items-center gap-2 mb-1">
                <Check className="w-6 h-6 text-[#D4873A]" />
                <h3 className="font-display text-2xl text-gray-900 tracking-wide">NOTHING NEW... YET</h3>
              </div>
              <p className="text-gray-500 text-sm text-center max-w-[300px] mb-4">
                We'll keep you posted on battles, predictions and rewards.
              </p>
              <div className="w-full max-w-[300px] space-y-2">
                <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-warm">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <Swords className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-900">Battle results</span>
                    <p className="text-xs text-gray-500">Get notified when battles end</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-warm">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <Target className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-900">Prediction outcomes</span>
                    <p className="text-xs text-gray-500">See if your predictions were correct</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-warm">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <Music className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gray-900">Song request updates</span>
                    <p className="text-xs text-gray-500">Know when your song is played</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Notification Items */}
          {notifications.filter(n => !dismissedNotifications.has(n.id)).map((notif) => (
            <NotificationItem
              key={notif.id}
              notif={notif}
              isUnread={!notif.read && !readNotifications.has(notif.id)}
              onDismiss={() => {
                // Update local state - also mark as read
                setDismissedNotifications(prev => {
                  const newSet = new Set(prev);
                  newSet.add(notif.id);
                  return newSet;
                });
                setReadNotifications(prev => {
                  const newSet = new Set(prev);
                  newSet.add(notif.id);
                  return newSet;
                });
                // Persist to database
                if (user?.id) {
                  fetch('/api/notifications/dismiss', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, notificationId: notif.id })
                  }).catch(() => {});
                }
              }}
              onClick={() => {
                // Mark as read locally (removes highlight but keeps message)
                setReadNotifications(prev => {
                  const newSet = new Set(prev);
                  newSet.add(notif.id);
                  return newSet;
                });
                
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
                } else if (notif.battleId) {
                  if (notif.type === 'battle_result') {
                    loadBattleDetails(notif.battleId);
                  } else if (notif.type === 'battle_challenge') {
                    loadChallengeDetails(notif.battleId);
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
              <Bell className="w-5 h-5 text-[#D4873A] fill-[#D4873A]" />
            ) : (
              <BellOff className="w-5 h-5 text-gray-600" />
            )}
            <div className="text-left">
              <span className="text-sm font-medium text-gray-900 block">Push Notifications</span>
              <span className="text-xs text-gray-600">Master switch for all notifications</span>
            </div>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors ${pushEnabled && isLoggedIn ? 'bg-green-500' : 'bg-skeleton-light'} relative`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-cream transition-all ${pushEnabled && isLoggedIn ? 'right-1' : 'left-1'}`} />
          </div>
        </button>

        {/* New Match Started */}
        <button 
          onClick={toggleReminderNewMatch}
          disabled={!pushEnabled || !isLoggedIn}
          className={`w-full flex items-center justify-between py-3 px-4 bg-cream rounded-xl transition-colors ${!pushEnabled || !isLoggedIn ? 'opacity-40' : 'hover:bg-cream'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#D4873A]/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-[#D4873A]" />
            </div>
            <div className="text-left">
              <span className="text-sm font-medium text-gray-900 block">New Match Started</span>
              <span className="text-xs text-gray-600">Get notified when a new game begins</span>
            </div>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors ${reminderNewMatch && pushEnabled ? 'bg-green-500' : 'bg-skeleton-light'} relative`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-cream transition-all ${reminderNewMatch && pushEnabled ? 'right-1' : 'left-1'}`} />
          </div>
        </button>

        {/* 1 Hour Before - separate option */}
        <button 
          onClick={toggleReminder1h}
          disabled={!pushEnabled || !isLoggedIn}
          className={`w-full flex items-center justify-between py-3 px-4 bg-cream rounded-xl transition-colors ${!pushEnabled || !isLoggedIn ? 'opacity-40' : 'hover:bg-cream'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-left">
              <span className="text-sm font-medium text-gray-900 block">1 Hour Reminder</span>
              <span className="text-xs text-gray-600">Get notified before game starts</span>
            </div>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors ${reminder1h && pushEnabled ? 'bg-green-500' : 'bg-skeleton-light'} relative`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-cream transition-all ${reminder1h && pushEnabled ? 'right-1' : 'left-1'}`} />
          </div>
        </button>

        {/* Game Ending Reminder */}
        <button 
          onClick={toggleReminderEnd}
          disabled={!pushEnabled || !isLoggedIn}
          className={`w-full flex items-center justify-between py-3 px-4 bg-cream rounded-xl transition-colors ${!pushEnabled || !isLoggedIn ? 'opacity-40' : 'hover:bg-cream'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-yellow-500" />
            </div>
            <div className="text-left">
              <span className="text-sm font-medium text-gray-900 block">Results Ready</span>
              <span className="text-xs text-gray-600">Get notified when game ended & results are in</span>
            </div>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors ${reminderEnd && pushEnabled ? 'bg-green-500' : 'bg-skeleton-light'} relative`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-cream transition-all ${reminderEnd && pushEnabled ? 'right-1' : 'left-1'}`} />
          </div>
        </button>

      </div>

      {/* Battle Notifications Section */}
      <div className="px-4 py-3 border-b border-warm/50 space-y-3">
        <p className="text-[#D4873A] text-[10px] uppercase tracking-wider px-1 font-semibold">Battle Notifications</p>
        
        {/* Battle Results */}
        <button 
          onClick={() => {/* TODO: implement */}}
          disabled={!pushEnabled || !isLoggedIn}
          className={`w-full flex items-center justify-between py-3 px-4 bg-cream transition-colors ${!pushEnabled || !isLoggedIn ? 'opacity-40' : 'hover:bg-cream'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-left">
              <span className="text-sm font-medium text-gray-900 block">Battle Results</span>
              <span className="text-xs text-gray-500">Win/lose notifications</span>
            </div>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors ${pushEnabled ? 'bg-green-600' : 'bg-skeleton-light'} relative`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-cream transition-all ${pushEnabled ? 'right-1' : 'left-1'}`} />
          </div>
        </button>

        {/* Challenge Accepted */}
        <button 
          onClick={() => {/* TODO: implement */}}
          disabled={!pushEnabled || !isLoggedIn}
          className={`w-full flex items-center justify-between py-3 px-4 bg-cream transition-colors ${!pushEnabled || !isLoggedIn ? 'opacity-40' : 'hover:bg-cream'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
              <Swords className="w-4 h-4 text-red-400" />
            </div>
            <div className="text-left">
              <span className="text-sm font-medium text-gray-900 block">Challenge Accepted</span>
              <span className="text-xs text-gray-500">When someone accepts your battle</span>
            </div>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors ${pushEnabled ? 'bg-green-600' : 'bg-skeleton-light'} relative`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-cream transition-all ${pushEnabled ? 'right-1' : 'left-1'}`} />
          </div>
        </button>

        {/* Ranking Changes */}
        <button 
          onClick={() => {/* TODO: implement */}}
          disabled={!pushEnabled || !isLoggedIn}
          className={`w-full flex items-center justify-between py-3 px-4 bg-cream transition-colors ${!pushEnabled || !isLoggedIn ? 'opacity-40' : 'hover:bg-cream'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-left">
              <span className="text-sm font-medium text-gray-900 block">Ranking Changes</span>
              <span className="text-xs text-gray-500">When your rank changes</span>
            </div>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors ${pushEnabled ? 'bg-green-600' : 'bg-skeleton-light'} relative`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-cream transition-all ${pushEnabled ? 'right-1' : 'left-1'}`} />
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

      {/* Battle Result Modal */}
      {(selectedBattle || loadingBattle) && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => !loadingBattle && setSelectedBattle(null)}
        >
          {/* Blurry background - light theme */}
          <div className="absolute inset-0 bg-cream/90 backdrop-blur-md" />
          
          {/* Loading */}
          {loadingBattle && (
            <div className="relative z-10">
              <LogoLoader size="md" text="Loading..." />
            </div>
          )}
          
          {/* Result Card - using same component as BattlesPage */}
          {selectedBattle && !loadingBattle && (
            <div 
              className="relative z-10 w-full max-w-sm mx-4 my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <BattleResultCard
                topic={selectedBattle.topic}
                wager={selectedBattle.wager}
                rounds={selectedBattle.rounds}
                myResults={selectedBattle.myResults}
                opponentResults={selectedBattle.opponentResults}
                myTotalPoints={selectedBattle.myPoints}
                opponentTotalPoints={selectedBattle.opponentPoints}
                myAvatar={selectedBattle.myAvatar}
                myUsername="You"
                opponentAvatar={selectedBattle.opponentAvatar}
                opponentUsername={selectedBattle.opponentUsername}
                onClose={() => setSelectedBattle(null)}
                showButtons={true}
                forceComplete={true}
                questions={selectedBattle.questions}
              />
            </div>
          )}
          
          {/* Challenge Details Card */}
          {selectedChallenge && !loadingBattle && (
            <div 
              className="relative z-10 w-full max-w-sm mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-b from-zinc-900 to-black border border-[#D4873A]/30 rounded-2xl p-6">
                {/* Header */}
                <div className="text-center mb-6">
                  <Swords className="w-10 h-10 text-[#D4873A] mx-auto mb-2" />
                  <h3 className="text-xl font-bold text-white">Battle Challenge!</h3>
                </div>
                
                {/* Challenger Info */}
                <div className="flex items-center gap-4 mb-6 p-4 bg-cream rounded-xl">
                  {selectedChallenge.challengerAvatar ? (
                    <img src={selectedChallenge.challengerAvatar} alt="" className="w-14 h-14 rounded-full border-2 border-[#D4873A]" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-[#D4873A]/20 flex items-center justify-center border-2 border-[#D4873A]">
                      <span className="text-xl">👤</span>
                    </div>
                  )}
                  <div>
                    <p className="text-white font-bold text-lg">{selectedChallenge.challengerUsername}</p>
                    <p className="text-white/50 text-sm">Rank #{selectedChallenge.challengerRank}</p>
                    <p className="text-white/40 text-xs">{selectedChallenge.challengerWins} wins • {selectedChallenge.challengerGamesPlayed} games</p>
                  </div>
                </div>
                
                {/* Battle Details */}
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/60">Topic</span>
                    <span className="text-white font-semibold uppercase">{selectedChallenge.topic}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/60">Rounds</span>
                    <span className="text-white font-semibold">{selectedChallenge.rounds}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-white/60">Wager</span>
                    <span className="text-[#D4873A] font-bold text-lg">P{selectedChallenge.wager}</span>
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
                    className="w-full py-3 bg-[#D4873A] text-white font-bold rounded-lg flex items-center justify-center gap-2"
                  >
                    <Swords className="w-5 h-5" />
                    Accept & Play Now!
                  </button>
                  <button
                    onClick={() => setSelectedChallenge(null)}
                    className="w-full py-2 text-white/50 text-sm"
                  >
                    Maybe Later
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
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
            className="relative w-full max-w-lg bg-gradient-to-b from-zinc-900 to-black border-t border-[#D4873A]/30 rounded-t-3xl p-6 pb-10 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            style={{
              animation: 'slideUp 0.3s ease-out',
            }}
          >
            {/* Handle */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1 bg-skeleton-light rounded-full" />
            
            {/* Icon */}
            <div className="flex justify-center mb-6 mt-4">
              <div className="w-20 h-20 rounded-full bg-[#D4873A]/20 flex items-center justify-center">
                <Bell className="w-10 h-10 text-[#D4873A]" />
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
                  <Zap className="w-5 h-5 text-blue-400" />
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
                className="w-full py-4 bg-[#D4873A] text-white font-bold text-lg rounded-xl hover:bg-[#c5e000] transition-colors flex items-center justify-center gap-2"
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
