"use client";

import { useState, useEffect } from "react";
import { X, Download, Smartphone, Zap, Bell, Maximize } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const REFRESH_COUNT_KEY = 'bogx_refresh_count';
const REFRESH_COUNT_KEY_IOS = 'bogx_refresh_count_ios';
const BANNER_DISMISSED_KEY = 'bogx_banner_dismissed';
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

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

type BannerType = 'install' | 'notifications' | null;

export default function InstallBanner() {
  const { user, isLoggedIn } = useAuth();
  const [bannerType, setBannerType] = useState<BannerType>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if dismissed this session
    const dismissed = sessionStorage.getItem(BANNER_DISMISSED_KEY);
    if (dismissed) {
      return;
    }

    // Check if already installed (standalone mode) - multiple detection methods
    const standaloneMedia = window.matchMedia('(display-mode: standalone)');
    const fullscreenMedia = window.matchMedia('(display-mode: fullscreen)');
    const minimalUiMedia = window.matchMedia('(display-mode: minimal-ui)');
    
    const isStandalone = standaloneMedia.matches || 
                        fullscreenMedia.matches ||
                        minimalUiMedia.matches ||
                        (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
                        document.referrer.includes('android-app://');
    
    // Check if user has previously installed (localStorage flag set when install prompt accepted)
    const wasInstalled = localStorage.getItem('bogx_app_installed') === 'true';
    
    if (isStandalone) {
      // Running in standalone mode - mark as installed for future reference
      localStorage.setItem('bogx_app_installed', 'true');
      console.log('App is running in standalone mode');
      return;
    }

    let justUninstalled = false;
    if (wasInstalled) {
      // Not in standalone mode but flag says installed → app was uninstalled
      // Clear the stale flag so the install banner can show again
      localStorage.removeItem('bogx_app_installed');
      localStorage.removeItem(REFRESH_COUNT_KEY);
      localStorage.removeItem(REFRESH_COUNT_KEY_IOS);
      justUninstalled = true;
      console.log('App was uninstalled — resetting install flags');
    }

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Show immediately after uninstall detection; otherwise every 3rd load (non-iOS) / 20th (iOS)
    if (!justUninstalled) {
      const countKey = iOS ? REFRESH_COUNT_KEY_IOS : REFRESH_COUNT_KEY;
      const showInterval = iOS ? 20 : 3;
      const currentCount = parseInt(localStorage.getItem(countKey) || '0', 10);
      const newCount = currentCount + 1;
      localStorage.setItem(countKey, newCount.toString());

      const shouldShow = newCount % showInterval === 0;
      if (!shouldShow) {
        return;
      }
    }

    // Decide which banner to show
    const decideBanner = async () => {
      // Show install banner
      if (iOS) {
        setBannerType('install');
        setTimeout(() => setIsVisible(true), 100);
      } else {
          // Listen for install prompt
          const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setBannerType('install');
            setTimeout(() => setIsVisible(true), 100);
          };
          window.addEventListener('beforeinstallprompt', handleBeforeInstall);
          
          // Fallback for browsers that don't fire beforeinstallprompt
          setTimeout(() => {
            if (!deferredPrompt && !bannerType) {
              setBannerType('install');
              setTimeout(() => setIsVisible(true), 100);
            }
          }, 1500);
          
          return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      }
    };

    decideBanner();
  }, [isLoggedIn]);

  // Separate effect for notification banner (when already installed)
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    
    if (isStandalone && isLoggedIn && 'Notification' in window && Notification.permission === 'default') {
      // Installed but no notification permission - show notification banner
      setBannerType('notifications');
      setTimeout(() => setIsVisible(true), 100);
    }
  }, [isLoggedIn]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        // Mark as installed so banner won't show again
        localStorage.setItem('bogx_app_installed', 'true');
        handleDismiss();
      }
      setDeferredPrompt(null);
    }
  };

  const handleEnableNotifications = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource
        });
        
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user?.id, subscription: subscription.toJSON() })
        });
      }
      handleDismiss();
    } catch (e) {
      console.error('Error enabling notifications:', e);
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    setTimeout(() => setBannerType(null), 300);
  };

  if (!bannerType) return null;

  return (
    <div 
      className={`fixed left-0 right-0 z-[40] transition-transform duration-300 ease-out ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ bottom: '64px' }}
    >
      <div className="bg-gradient-to-r from-[#D4873A] via-[#E5994A] to-[#D4873A] shadow-xl border-t border-white/20">
        <div className="flex items-center gap-4 px-4 py-3.5">
          {/* Icon */}
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0 shadow-inner">
            {bannerType === 'install' ? (
              <Smartphone className="w-6 h-6 text-white" />
            ) : (
              <Bell className="w-6 h-6 text-white" />
            )}
          </div>
          
          {/* Text */}
          <div className="flex-1 min-w-0">
            {bannerType === 'install' ? (
              <>
                <p className="text-white font-bold text-base drop-shadow-sm">Install Best of GenX</p>
                <p className="text-white/80 text-xs font-medium">
                  {isIOS
                    ? 'Tap Share → Add to Home Screen'
                    : deferredPrompt
                      ? 'Add to your home screen for the best experience'
                      : 'Tap ⋮ menu → Install app / Add to Home screen'}
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/70 font-semibold">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Faster
                  </span>
                  <span className="flex items-center gap-1">
                    <Bell className="w-3 h-3" /> Notifications
                  </span>
                  <span className="flex items-center gap-1">
                    <Maximize className="w-3 h-3" /> Fullscreen
                  </span>
                </div>
              </>
            ) : (
              <>
                <p className="text-white font-bold text-base drop-shadow-sm">Enable Notifications</p>
                <p className="text-white/80 text-xs font-medium">
                  Get notified about battles, rankings & more
                </p>
              </>
            )}
          </div>
          
          {/* Action Button */}
          {bannerType === 'install' && !isIOS && deferredPrompt && (
            <button
              onClick={handleInstall}
              className="px-4 py-2.5 bg-white text-[#D4873A] text-sm font-bold rounded-xl flex items-center gap-1.5 hover:bg-white/90 transition-colors flex-shrink-0 shadow-lg"
            >
              <Download className="w-4 h-4" />
              Install
            </button>
          )}
          {bannerType === 'notifications' && (
            <button
              onClick={handleEnableNotifications}
              className="px-4 py-2.5 bg-white text-[#D4873A] text-sm font-bold rounded-xl flex items-center gap-1.5 hover:bg-white/90 transition-colors flex-shrink-0 shadow-lg"
            >
              <Bell className="w-4 h-4" />
              Enable
            </button>
          )}
          
          {/* Close Button */}
          <button
            onClick={handleDismiss}
            className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
