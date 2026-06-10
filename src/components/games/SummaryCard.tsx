"use client";

import { useState, useEffect } from "react";
import { Clock, Target, Check, Bell, Mail, MessageCircle, X, Phone, TrendingUp } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency, getCurrencySymbol } from "@/utils/currency";

interface SummaryCardProps {
  totalQuestions: number;
  correctAnswers: number;
  totalPoints: number;
  averageTime: number; // in seconds
  rank?: number;
  totalPlayers?: number;
  onViewRankings?: () => void;
  onGoToProfile?: () => void;
  onOpenNotifications?: (autoEnable?: 'email' | 'sms') => void;
  onShowLogin?: () => void;
  onShowJoinChallenge?: () => void;
  isLastCard?: boolean;
  isLoggedIn?: boolean;
}

// Calculate time until 10:00 AM German time tomorrow
function getTimeUntilNextGame() {
  const now = new Date();
  const germanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  
  // Next game is at 10:00 AM German time tomorrow
  const nextGame = new Date(germanTime);
  nextGame.setDate(nextGame.getDate() + 1);
  nextGame.setHours(10, 0, 0, 0);
  
  // Convert back to local time for countdown
  const nextGameUTC = new Date(nextGame.toLocaleString('en-US', { timeZone: 'UTC' }));
  const diff = nextGameUTC.getTime() - now.getTime();
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return { hours: Math.max(0, hours), minutes: Math.max(0, minutes), seconds: Math.max(0, seconds) };
}

export default function SummaryCard({
  totalQuestions,
  correctAnswers,
  totalPoints,
  averageTime,
  rank = 1,
  totalPlayers = 100,
  onViewRankings,
  onGoToProfile,
  onOpenNotifications,
  onShowLogin,
  onShowJoinChallenge,
  isLastCard = false,
  isLoggedIn = false
}: SummaryCardProps) {
  const { user } = useAuth();
  const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  const wrongAnswers = totalQuestions - correctAnswers;
  
  // Animated counters
  const [animatedPoints, setAnimatedPoints] = useState(0);
  const [animatedAccuracy, setAnimatedAccuracy] = useState(0);
  const [animatedCorrect, setAnimatedCorrect] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  
  // Countdown timer
  const [timeUntilNext, setTimeUntilNext] = useState(getTimeUntilNextGame());
  
  // Notification states
  const [pushEnabled, setPushEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  // Check notification status on mount (use same keys as NotificationPage)
  useEffect(() => {
    // Push: only enabled if logged in AND permission granted AND reminder enabled
    if (isLoggedIn && 'Notification' in window && Notification.permission === 'granted') {
      const savedPush = localStorage.getItem('reminder_new_match');
      setPushEnabled(savedPush === 'true' || savedPush === null); // Default true if granted
    } else {
      setPushEnabled(false);
    }
    // Email: check email_enabled key from NotificationPage
    const savedEmail = localStorage.getItem('email_enabled');
    setEmailEnabled(savedEmail === 'true');
    // SMS: check sms_enabled key from NotificationPage
    const savedSms = localStorage.getItem('sms_enabled');
    setSmsEnabled(savedSms === 'true');
  }, [isLoggedIn]);

  // Update countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeUntilNext(getTimeUntilNextGame());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle push notification enable
  const handleEnablePush = async () => {
    setPushLoading(true);
    try {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          localStorage.setItem('reminder_new_match', 'true');
          setPushEnabled(true);
        }
      }
    } catch (error) {
      console.error('Notification error:', error);
    } finally {
      setPushLoading(false);
    }
  };

  // Handle email notification toggle
  const handleToggleEmail = async () => {
    // If not enabled, open NotificationPage to enable with all options
    if (!emailEnabled && onOpenNotifications) {
      onOpenNotifications('email');
      return;
    }
    // If already enabled, just toggle off
    const newState = !emailEnabled;
    setEmailEnabled(newState);
    localStorage.setItem('email_enabled', newState ? 'true' : 'false');
    // Save to backend
    if (user?.id) {
      try {
        await fetch('/api/user/update-notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, notifyEmail: newState }),
        });
      } catch (error) {
        console.error('Failed to save email preference:', error);
      }
    }
  };

  // Handle SMS/WhatsApp notification toggle
  const handleToggleSms = async () => {
    // Check if user has phone number
    if (!user?.phone && !smsEnabled) {
      setShowPhoneModal(true);
      return;
    }
    // If not enabled, open NotificationPage to enable with all options
    if (!smsEnabled && onOpenNotifications) {
      onOpenNotifications('sms');
      return;
    }
    // If already enabled, just toggle off
    const newState = !smsEnabled;
    setSmsEnabled(newState);
    localStorage.setItem('sms_enabled', newState ? 'true' : 'false');
    // Save to backend
    if (user?.id) {
      try {
        await fetch('/api/user/update-notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, notifySms: newState }),
        });
      } catch (error) {
        console.error('Failed to save SMS preference:', error);
      }
    }
  };

  // Animate on mount
  useEffect(() => {
    // Staggered reveal
    setTimeout(() => setShowContent(true), 200);
    setTimeout(() => setShowStats(true), 500);
    setTimeout(() => setShowProgress(true), 800);
    
    // Count up animations (handle negative points correctly)
    const duration = 1500;
    const steps = 30;
    const pointsStep = totalPoints / steps;
    const accuracyStep = accuracy / steps;
    const correctStep = correctAnswers / steps;
    
    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      // For points: handle both positive and negative values
      const targetPoints = Math.round(pointsStep * currentStep);
      setAnimatedPoints(totalPoints >= 0 
        ? Math.min(targetPoints, totalPoints) 
        : Math.max(targetPoints, totalPoints));
      setAnimatedAccuracy(Math.min(Math.round(accuracyStep * currentStep), accuracy));
      setAnimatedCorrect(Math.min(Math.round(correctStep * currentStep), correctAnswers));
      
      if (currentStep >= steps) {
        clearInterval(interval);
      }
    }, duration / steps);
    
    return () => clearInterval(interval);
  }, [totalPoints, accuracy, correctAnswers]);

  // Color theme based on performance
  const getThemeColor = () => {
    if (totalPoints >= 100) return { primary: '#22c55e', bg: 'green', video: totalPoints >= 200 ? '/videos/CRUSHED.mp4' : '/videos/niceprof.mp4' };
    if (totalPoints >= 0) return { primary: '#eab308', bg: 'yellow', video: '/videos/doubledow.mp4' };
    return { primary: '#ef4444', bg: 'red', video: totalPoints >= -100 ? '/videos/next.mp4' : '/videos/Last.mp4' };
  };
  const theme = getThemeColor();

  return (
    <div className="w-full h-full relative overflow-hidden flex flex-col px-3 pb-2 pt-4 items-center" style={{ backgroundColor: '#000000', maxHeight: '100%' }}>
      
      {/* Main Card */}
      <div className={`flex-1 w-full flex flex-col overflow-hidden min-h-0 transition-all duration-500 ${showContent ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`} style={{ backgroundColor: '#000000', borderColor: `${theme.primary}50`, borderWidth: '1px' }}>
        {/* Video Background for entire card - 0.5x speed */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          src={theme.video}
          ref={(el) => { if (el) el.playbackRate = 0.5; }}
        />
        {/* Gradient overlay for text contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-black/80 z-[1]" />
        
        <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden z-[2]">
          
          {/* Header */}
          <div className={`relative z-10 px-4 pt-3 text-center transition-all duration-500 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
            <p className="text-white/40 text-[9px] tracking-[0.2em] mb-1">{isLoggedIn ? 'DAILY CHALLENGE' : 'FREE TRIAL'}</p>
            <div className="flex items-center justify-center gap-2">
              {!isLoggedIn && <Check className="w-5 h-5 text-white/50" />}
              <h1 className="text-xl font-black text-white">{isLoggedIn ? 'GAME COMPLETED' : 'TRIAL ENDED'}</h1>
            </div>
          </div>
          
          {/* Points Display */}
          <div className={`relative z-10 mx-3 my-3 text-center transition-all duration-700 delay-200 ${showStats ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
            {/* Headline */}
            <p 
              className="text-[10px] font-bold tracking-widest mb-2"
              style={{ color: theme.primary }}
            >
              {totalPoints >= 200 ? 'YOU CRUSHED IT' : totalPoints >= 100 ? 'NICE PROFIT' : totalPoints >= 0 ? 'TIME TO DOUBLE DOWN' : totalPoints >= -100 ? 'TIME TO WIN IT BACK' : 'REVENGE TIME'}
            </p>
            
            {/* Points Number */}
            <div className="mb-2">
              <span 
                className="text-4xl font-black"
                style={{ color: theme.primary, textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}
              >
                {animatedPoints >= 0 ? '+' : ''}{formatCurrency(animatedPoints)}{getCurrencySymbol()}
              </span>
            </div>
            
            {/* Motivational subtext */}
            <p className="text-white/90 text-[11px] font-medium" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
              {totalPoints >= 200 
                ? "At this rate, you'll be #1 in 2 weeks" 
                : totalPoints >= 100 
                  ? "Keep this up and watch your rank climb" 
                  : totalPoints >= 0 
                    ? "One good day away from the leaderboard"
                    : totalPoints >= -100 
                      ? "Tomorrow is your comeback story"
                      : "Champions are made from setbacks"}
            </p>
          </div>
          
          {/* Stats Row */}
          <div className={`relative z-10 px-3 transition-all duration-500 delay-400 ${showStats ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex gap-2">
              {/* Accuracy + Correct combined */}
              <div 
                className="flex-1 bg-black/60 backdrop-blur-sm p-2.5 text-center"
                style={{ borderColor: `${theme.primary}40`, borderWidth: '1px' }}
              >
                <Target className="w-4 h-4 mx-auto mb-1" style={{ color: theme.primary }} />
                <p className="text-[8px] text-white/70">ACCURACY</p>
                <p className="text-lg font-black text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>{animatedCorrect}/{totalQuestions}</p>
                <p className="text-[9px] text-white/70">{animatedAccuracy}%</p>
              </div>
              
              {/* Average Answer Time */}
              <div 
                className="flex-1 bg-black/60 backdrop-blur-sm p-2.5 text-center"
                style={{ borderColor: `${theme.primary}40`, borderWidth: '1px' }}
              >
                <Clock className="w-4 h-4 mx-auto mb-1" style={{ color: theme.primary }} />
                <p className="text-[8px] text-white/70">AVG TIME</p>
                <p className="text-lg font-black text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>{averageTime.toFixed(1)}s</p>
              </div>
              
              {/* Better than X% */}
              <div 
                className="flex-1 backdrop-blur-sm p-2.5 text-center"
                style={{ 
                  backgroundColor: `${theme.primary}20`,
                  borderColor: `${theme.primary}50`, 
                  borderWidth: '1px' 
                }}
              >
                <TrendingUp className="w-4 h-4 mx-auto mb-1" style={{ color: theme.primary }} />
                <p className="text-[8px] text-white/70">BETTER THAN</p>
                <p className="text-lg font-black" style={{ color: theme.primary, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>{Math.min(99, Math.round(accuracy * 0.9))}%</p>
                <p className="text-[9px] text-white/70">of players</p>
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className={`relative z-10 px-3 py-2 transition-all duration-500 delay-600 ${showProgress ? 'opacity-100' : 'opacity-0'}`}>
            <div 
              className="bg-black/60 backdrop-blur-sm p-2.5"
              style={{ borderColor: `${theme.primary}40`, borderWidth: '1px' }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-white/80 text-[10px]">✓ {correctAnswers}</span>
                  <span className="text-white/80 text-[10px]">✗ {wrongAnswers}</span>
                </div>
                <span className="text-white/70 text-[10px]">{correctAnswers}/{totalQuestions}</span>
              </div>
              <div className="h-2 bg-cream/20 overflow-hidden">
                <div 
                  className="h-full transition-all duration-1000 ease-out"
                  style={{ width: showProgress ? `${accuracy}%` : '0%', backgroundColor: theme.primary }}
                />
              </div>
            </div>
          </div>
          
          {/* Next game countdown + Notify (logged in) OR Login CTA (guests) */}
          <div className={`relative z-10 px-3 pb-3 transition-all duration-500 delay-800 ${showProgress ? 'opacity-100' : 'opacity-0'}`}>
            {isLoggedIn ? (
              /* Logged in users: Countdown + Notifications */
              <div className="bg-cream/5 border border-white/10 p-3">
                <p className="text-white/50 text-[9px] text-center mb-2">NEXT CHALLENGE IN</p>
                
                {/* Countdown Timer */}
                <div className="flex justify-center gap-2 mb-3">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-[#D4873A]/10 border border-[#D4873A]/30 flex items-center justify-center">
                      <span className="text-xl font-black text-white">{String(timeUntilNext.hours).padStart(2, '0')}</span>
                    </div>
                    <span className="text-[8px] text-white/40 mt-1">HOURS</span>
                  </div>
                  <span className="text-xl font-black text-[#D4873A]/50 mt-3">:</span>
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-[#D4873A]/10 border border-[#D4873A]/30 flex items-center justify-center">
                      <span className="text-xl font-black text-white">{String(timeUntilNext.minutes).padStart(2, '0')}</span>
                    </div>
                    <span className="text-[8px] text-white/40 mt-1">MINS</span>
                  </div>
                  <span className="text-xl font-black text-[#D4873A]/50 mt-3">:</span>
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-[#D4873A]/20 border border-[#D4873A]/50 flex items-center justify-center">
                      <span className="text-xl font-black text-[#D4873A]">{String(timeUntilNext.seconds).padStart(2, '0')}</span>
                    </div>
                    <span className="text-[8px] text-[#D4873A]/60 mt-1">SECS</span>
                  </div>
                </div>
                
                {/* Notification Options */}
                <p className="text-white/50 text-[9px] text-center mb-2">GET NOTIFIED</p>
                <div className="flex gap-2">
                  {/* Push Notification */}
                  <button
                    onClick={pushEnabled ? undefined : handleEnablePush}
                    disabled={pushLoading}
                    className={`flex-1 py-2 font-bold text-[10px] flex items-center justify-center gap-1.5 transition-all ${
                      pushEnabled 
                        ? 'bg-green-500/20 border border-green-500/30 text-green-400' 
                        : 'bg-cream/10 border border-white/20 hover:bg-cream/20 text-white'
                    }`}
                  >
                    {pushEnabled ? <Check className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
                    {pushLoading ? '...' : pushEnabled ? 'PUSH ON' : 'PUSH'}
                  </button>
                  
                  {/* Email Notification */}
                  <button
                    onClick={handleToggleEmail}
                    className={`flex-1 py-2 font-bold text-[10px] flex items-center justify-center gap-1.5 transition-all ${
                      emailEnabled 
                        ? 'bg-green-500/20 border border-green-500/30 text-green-400' 
                        : 'bg-cream/10 border border-white/20 hover:bg-cream/20 text-white'
                    }`}
                  >
                    {emailEnabled ? <Check className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                    {emailEnabled ? 'EMAIL ON' : 'EMAIL'}
                  </button>
                  
                  {/* SMS/WhatsApp Notification */}
                  <button
                    onClick={handleToggleSms}
                    className={`flex-1 py-2 font-bold text-[10px] flex items-center justify-center gap-1.5 transition-all ${
                      smsEnabled 
                        ? 'bg-green-500/20 border border-green-500/30 text-green-400' 
                        : 'bg-cream/10 border border-white/20 hover:bg-cream/20 text-white'
                    }`}
                  >
                    {smsEnabled ? <Check className="w-3 h-3" /> : <MessageCircle className="w-3 h-3" />}
                    {smsEnabled ? 'SMS ON' : 'SMS'}
                  </button>
                </div>
              </div>
            ) : (
              /* Guests: Login CTA - themed to performance */
              <div 
                className="p-4 backdrop-blur-sm"
                style={{ 
                  background: `linear-gradient(to bottom, ${theme.primary}30, ${theme.primary}10)`,
                  borderColor: `${theme.primary}50`,
                  borderWidth: '1px'
                }}
              >
                <p className="text-white/70 text-[10px] text-center mb-1">YOUR POINTS ARE NOT SAVED</p>
                <p className="text-white text-sm font-bold text-center mb-3">CREATE AN ACCOUNT TO KEEP PLAYING</p>
                
                <button
                  onClick={onShowJoinChallenge || onShowLogin}
                  className="w-full py-3 font-black text-sm text-white transition-all active:scale-95"
                  style={{ backgroundColor: theme.primary }}
                >
                  JOIN CHALLENGE
                </button>
                
                <p className="text-white/50 text-[9px] text-center mt-2">
                  Save progress • Compete in rankings • Win prizes
                </p>
              </div>
            )}
          </div>
          
        </div>
      </div>
      
      {/* Phone Number Required Modal */}
      {showPhoneModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/20 p-5 mx-4 max-w-sm w-full">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-[#D4873A]/20 flex items-center justify-center">
                <Phone className="w-6 h-6 text-[#D4873A]" />
              </div>
              <button 
                onClick={() => setShowPhoneModal(false)}
                className="p-1 hover:bg-cream/10 transition-colors"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>
            
            <h3 className="text-lg font-bold text-white mb-2">Phone Number Required</h3>
            <p className="text-white/60 text-sm mb-4">
              To receive SMS notifications, please add your phone number in your profile settings first.
            </p>
            
            <button
              onClick={() => {
                setShowPhoneModal(false);
                if (onGoToProfile) {
                  onGoToProfile();
                }
              }}
              className="w-full py-3 bg-[#D4873A] text-white font-bold text-sm hover:bg-[#d10445] transition-colors"
            >
              GO TO PROFILE
            </button>
          </div>
        </div>
      )}
      
    </div>
  );
}
