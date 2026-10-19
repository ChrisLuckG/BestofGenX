'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Bell, Swords, Trophy, TrendingUp } from 'lucide-react';
import BrandedModal, { ModalActions } from "./BrandedModal";
import BrandedConfirmModal from "./BrandedConfirmModal";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

interface NotificationSettings {
  battleResults: boolean;
  battleAccepted: boolean;
  ranking: boolean;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotifications({ showSettings = false, onClose }: { showSettings?: boolean; onClose?: () => void }) {
  const { user, isLoggedIn } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
    battleResults: true,
    battleAccepted: true,
    ranking: true
  });
  const [loadingSettings, setLoadingSettings] = useState(false);

  useEffect(() => {
    // Check if push notifications are supported
    // Note: iOS Safari requires the app to be added to home screen (PWA) for push to work
    const checkSupport = async () => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        // Check if running as PWA on iOS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                            (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
        
        if (isIOS && !isStandalone) {
          // iOS but not installed as PWA - push won't work
          console.log('iOS detected but not running as PWA - push notifications limited');
          setIsSupported(false);
          return;
        }
        
        setIsSupported(true);
        checkSubscription();
      }
    };
    checkSupport();
  }, []);

  // Removed automatic prompt - only show via small inline banner in WelcomeBackModal

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (e) {
      console.log('Error checking subscription:', e);
    }
  };

  // Load notification settings when showing settings panel
  useEffect(() => {
    if (showSettings && user?.id) {
      loadSettings();
    }
  }, [showSettings, user?.id]);

  const loadSettings = async () => {
    if (!user?.id) return;
    setLoadingSettings(true);
    try {
      const res = await fetch(`/api/user/notifications?userId=${user.id}`);
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
      }
    } catch (e) {
      console.error('Failed to load notification settings:', e);
    } finally {
      setLoadingSettings(false);
    }
  };

  const updateSetting = async (key: keyof NotificationSettings, value: boolean) => {
    if (!user?.id) return;
    
    // Optimistic update
    setSettings(prev => ({ ...prev, [key]: value }));
    
    try {
      await fetch('/api/user/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          settings: { [key]: value }
        })
      });
    } catch (e) {
      console.error('Failed to update notification setting:', e);
      // Revert on error
      setSettings(prev => ({ ...prev, [key]: !value }));
    }
  };

  const subscribe = async () => {
    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Notification permission denied');
        setShowPrompt(false);
        return;
      }

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource
      });

      // Send subscription to server
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          subscription: subscription.toJSON()
        })
      });

      if (res.ok) {
        setIsSubscribed(true);
        setShowPrompt(false);
        // Keep the news widget / settings bell in sync without a refresh
        window.dispatchEvent(new CustomEvent('push-status-changed', { detail: { enabled: true } }));
        console.log('Push subscription saved');
      }
    } catch (e) {
      console.error('Error subscribing to push:', e);
    }
  };

  const dismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('push_prompt_dismissed', 'true');
  };

  // Settings Panel
  if (showSettings) {
    return (
      <BrandedConfirmModal
        isOpen
        onClose={() => onClose?.()}
        onConfirm={() => onClose?.()}
        eyebrow="Settings"
        title="Notifications"
        icon={Bell}
        message="Manage all notification settings in the Notifications tab → Settings."
        confirmText="DONE"
      />
    );
  }

  // Prompt
  if (!showPrompt || !isLoggedIn) return null;

  return (
    <BrandedModal isOpen onClose={dismiss} eyebrow="Stay in the game" title="Enable notifications?" icon={Bell}>
        <p className="text-gray-700 text-sm md:text-base mb-3">Get notified when:</p>
        {/* Benefits List */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 bg-cream border border-warm rounded-xl p-3">
            <div className="w-10 h-10 border border-warm bg-cream rounded-lg flex items-center justify-center flex-shrink-0">
              <Swords className="w-5 h-5 text-gray-700" />
            </div>
            <div>
              <p className="text-gray-900 font-medium text-sm">Battle Results</p>
              <p className="text-gray-600 text-xs">Know instantly when you win or lose</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-cream border border-warm rounded-xl p-3">
            <div className="w-10 h-10 border border-warm bg-cream rounded-lg flex items-center justify-center flex-shrink-0">
              <Trophy className="w-5 h-5 text-gray-700" />
            </div>
            <div>
              <p className="text-gray-900 font-medium text-sm">Challenge Accepted</p>
              <p className="text-gray-600 text-xs">Someone accepted your battle challenge</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-cream border border-warm rounded-xl p-3">
            <div className="w-10 h-10 border border-warm bg-cream rounded-lg flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-gray-700" />
            </div>
            <div>
              <p className="text-gray-900 font-medium text-sm">Ranking Changes</p>
              <p className="text-gray-600 text-xs">Track your position on the leaderboard</p>
            </div>
          </div>
        </div>
        

        <ModalActions confirmText="ENABLE NOTIFICATIONS" confirmIcon={Bell} onConfirm={subscribe} cancelText="Maybe later" onCancel={dismiss} />
    </BrandedModal>
  );
}
