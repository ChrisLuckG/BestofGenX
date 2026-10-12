"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Camera, Edit2, Trophy, Coins, Target, LogOut, Lock, ChevronRight, User, Eye, EyeOff, X, Globe, FileText, Shield, HelpCircle, Phone, Check, Mail, Building, Bell, Share2, Upload, ArrowUp } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import PushNotifications from "./PushNotifications";
import InviteModal from "./InviteModal";
import CountryFlag from "./CountryFlag";
import LogoutModal from "./LogoutModal";
import { formatCurrency, getCurrencySymbol } from "@/utils/currency";
import { COUNTRIES } from "@/utils/countries";
import { ProfileSkeleton } from "@/components/desktop/DesktopSkeletons";

// Animated counter hook - starts after delay to ensure visibility
function useAnimatedCounter(target: number, duration: number = 1000, decimals: number = 0) {
  const [count, setCount] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);
  
  // Re-trigger animation on mount and when target changes significantly
  useEffect(() => {
    // Small delay to ensure component is painted
    const timer = setTimeout(() => {
      setAnimationKey(prev => prev + 1);
    }, 300);
    return () => clearTimeout(timer);
  }, []);
  
  useEffect(() => {
    if (animationKey === 0) return; // Don't animate on initial render
    if (target === 0) { setCount(0); return; }
    
    setCount(0); // Reset to 0 before animating
    
    const startTime = Date.now();
    const multiplier = Math.pow(10, decimals);
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round((target * eased) * multiplier) / multiplier;
      setCount(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [animationKey, target, duration, decimals]);
  
  return count;
}

// Country options - imported from central list
const countries = COUNTRIES;

// Avatar options are loaded from /public/images/Profil via /api/avatars,
// so dropping a new image into that folder makes it available automatically.

interface ProfilePageProps {
  coins: number;
}

export default function ProfilePage({ coins }: ProfilePageProps) {
  const { user, isLoggedIn, logout, updateUser } = useAuth();
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState(user?.username || "");
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  
  // Phone number state
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(user?.phone || "");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneSuccess, setPhoneSuccess] = useState(false);

  // Avatar upload
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Avatar options from /public/images/Profil (auto-updates when new files are added)
  const [avatarOptions, setAvatarOptions] = useState<string[]>([]);
  useEffect(() => {
    if (!showAvatarPicker || avatarOptions.length > 0) return;
    fetch('/api/avatars')
      .then(res => res.json())
      .then(data => { if (data.success) setAvatarOptions(data.avatars || []); })
      .catch(() => {});
  }, [showAvatarPicker, avatarOptions.length]);

  // Logout "See you soon" modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Invite friends modal
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Session tracking for logout modal
  const [sessionStartTime] = useState(() => {
    // Try to get from sessionStorage, or set new
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('bogx_session_start');
      if (stored) return parseInt(stored, 10);
      const now = Date.now();
      sessionStorage.setItem('bogx_session_start', now.toString());
      return now;
    }
    return Date.now();
  });
  
  const [sessionStartStats] = useState(() => {
    // Capture stats at session start
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('bogx_session_stats');
      if (stored) return JSON.parse(stored);
      const stats = {
        bogxCoins: user?.bogxCoins || 0,
        gamesPlayed: user?.gamesPlayed || 0,
        wins: user?.wins || 0,
      };
      sessionStorage.setItem('bogx_session_stats', JSON.stringify(stats));
      return stats;
    }
    return { bogxCoins: 0, gamesPlayed: 0, wins: 0 };
  });

  // Initial loading state for skeleton
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Show skeleton briefly then reveal content with animations
    const timer = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  // Calculate real stats (with safe defaults for hooks)
  const gamesPlayed = user?.gamesPlayed || 0;
  const wins = user?.wins || 0;
  const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
  const streak = (user as any)?.streak || 0;

  // Animated counters - MUST be called before any early returns
  const animatedCoins = useAnimatedCounter(coins, 1000, 2);
  const animatedWins = useAnimatedCounter(wins, 800);
  const animatedGames = useAnimatedCounter(gamesPlayed, 1000);
  const animatedWinRate = useAnimatedCounter(winRate, 1200);
  const animatedStreak = useAnimatedCounter(streak, 600);

  // User's rank positions (daily/monthly/annually)
  const [userRank, setUserRank] = useState<number | null>(null);
  const [dailyRank, setDailyRank] = useState<number | null>(null);
  const [dailyPoints, setDailyPoints] = useState(0);
  const [monthlyRank, setMonthlyRank] = useState<number | null>(null);
  const [monthlyPoints, setMonthlyPoints] = useState(0);
  const [annuallyRank, setAnnuallyRank] = useState<number | null>(null);
  const [annuallyPoints, setAnnuallyPoints] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/users/${user.id}/stats`)
      .then(res => res.json())
      .then(data => {
        if (data.rank) setUserRank(data.rank);
        if (data.dailyRank) setDailyRank(data.dailyRank);
        if (data.dailyPoints) setDailyPoints(data.dailyPoints);
        if (data.monthlyRank) setMonthlyRank(data.monthlyRank);
        if (data.monthlyPoints) setMonthlyPoints(data.monthlyPoints);
        if (data.annuallyRank) setAnnuallyRank(data.annuallyRank);
        if (data.annuallyPoints) setAnnuallyPoints(data.annuallyPoints);
      })
      .catch(() => {});
  }, [user?.id]);

  // How the user earned their BOGX, derived server-side from the GameResult ledger
  const [earningsExpanded, setEarningsExpanded] = useState(false);
  const [earnings, setEarnings] = useState<{
    breakdown: { key: string; label: string; icon: string; count: number; earned: number; lost: number; total: number }[];
    totalEarned: number;
    totalSpent: number;
    wallet: number;
    drift: number;
  } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetch(`/api/user/earnings-breakdown?userId=${user.id}`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data.success) {
          setEarnings({
            breakdown: data.breakdown || [],
            totalEarned: data.totalEarned || 0,
            totalSpent: data.totalSpent || 0,
            wallet: data.wallet || 0,
            drift: data.drift || 0,
          });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  // Category strengths - loaded from API
  const [categoryStrengths, setCategoryStrengths] = useState<{ name: string; key: string; correct: number; total: number; pct: number }[]>([]);
  const [categoryStrengthsLoading, setCategoryStrengthsLoading] = useState(false);
  const [categoryStrengthsExpanded, setCategoryStrengthsExpanded] = useState(false);

  useEffect(() => {
    if (!user?.id || !categoryStrengthsExpanded || categoryStrengths.length > 0) return;
    setCategoryStrengthsLoading(true);
    fetch(`/api/user/category-strengths?userId=${user.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setCategoryStrengths(data.strengths || []);
      })
      .catch(() => {})
      .finally(() => setCategoryStrengthsLoading(false));
  }, [user?.id, categoryStrengthsExpanded, categoryStrengths.length]);

  if (!isLoggedIn || !user) {
    // This should never show - user gets redirected to home when logged out
    return null;
  }

  if (isLoading) {
    return (
      <div className="h-full min-h-full bg-[#F5F0E8]">
        <ProfileSkeleton />
      </div>
    );
  }

  const handleAvatarSelect = async (avatarUrl: string) => {
    // Update locally first
    updateUser({ avatar: avatarUrl });
    setShowAvatarPicker(false);
    
    // Sync to database
    if (user?.id) {
      try {
        await fetch('/api/user/update-avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, avatar: avatarUrl }),
        });
      } catch (error) {
        console.error('Failed to sync avatar:', error);
      }
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      if (data.success && data.url) {
        await handleAvatarSelect(data.url);
      } else {
        alert('Upload failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed');
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleUsernameUpdate = () => {
    if (newUsername.trim()) {
      updateUser({ username: newUsername.trim() });
      setIsEditing(false);
    }
  };

  const handleCountrySelect = async (country: typeof countries[0]) => {
    // Update locally first
    updateUser({ country: country.name, countryFlag: country.flag });
    setShowCountryPicker(false);
    
    // Sync to database
    if (user?.id) {
      try {
        await fetch('/api/user/update-country', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, country: country.name, countryFlag: country.flag }),
        });
      } catch (error) {
        console.error('Failed to sync country:', error);
      }
    }
  };

  const handlePasswordChange = async () => {
    setPasswordError("");
    setPasswordSuccess("");
    
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    
    try {
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          currentPassword,
          newPassword,
        }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setPasswordSuccess("Password changed successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          setShowPasswordModal(false);
          setPasswordSuccess("");
        }, 1500);
      } else {
        setPasswordError(data.error || "Failed to change password");
      }
    } catch {
      setPasswordError("Connection error");
    }
  };

  const stats = [
    { label: "Balance", value: `${formatCurrency(coins)} ${getCurrencySymbol()}`, icon: Coins, color: "text-gray-900" },
    { label: "Games Played", value: gamesPlayed, icon: Target, color: "text-gray-900" },
    { label: "Wins", value: wins, icon: Trophy, color: "text-gray-900" },
    { label: "Win Rate", value: gamesPlayed > 0 ? `${winRate}%` : "-", icon: Trophy, color: "text-gray-900" },
  ];

  // Member since date (placeholder - would come from user data)
  const memberSince = 'March 2026';

  return (
    <div className="w-full h-full min-h-full flex flex-col bg-cream overflow-hidden">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        
        {/* Hero Card - Profile Header - Compact */}
        <div className="mx-4 mt-4 bg-cream rounded-2xl shadow-sm border border-warm overflow-hidden">
          {/* Background gradient header */}
          <div className="h-14 bg-gradient-to-br from-[#E36B11]/25 via-[#E36B11]/10 to-transparent" />
          
          <div className="px-4 pb-4 -mt-8 relative">

            
            {/* Top row: Avatar + Name + Score */}
            <div className="flex items-end gap-3">
              {/* Avatar with rank badge */}
              <button 
                onClick={() => setShowAvatarPicker(true)}
                className="relative flex-shrink-0"
              >
                <div className="w-[72px] h-[72px] rounded-full p-0.5 bg-gradient-to-br from-[#E36B11] to-[#E36B11]/70 shadow-md">
                  <div className="w-full h-full rounded-full overflow-hidden border-2 border-white bg-white">
                    <img src={user.avatar || "https://i.pravatar.cc/150?img=33"} alt="" className="w-full h-full object-cover" />
                  </div>
                </div>
                {/* Rank Badge */}
                {userRank && (
                  <div className={`absolute -top-0.5 -right-0.5 w-7 h-7 rounded-full flex items-center justify-center shadow-sm border-2 border-white ${
                    userRank === 1 ? 'bg-gradient-to-br from-yellow-400 to-amber-600' :
                    userRank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                    userRank === 3 ? 'bg-gradient-to-br from-amber-600 to-amber-800' :
                    'bg-[#E36B11]'
                  }`}>
                    <span className="text-[10px] font-black text-white">#{userRank}</span>
                  </div>
                )}
              </button>
              
              {/* Name & Country */}
              <div className="pb-0.5 flex-1 min-w-0">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="bg-cream border border-[#E36B11]/30 rounded-lg px-2 py-0.5 text-gray-900 text-base font-display w-32"
                      autoFocus
                    />
                    <button onClick={handleUsernameUpdate} className="px-2 py-0.5 bg-[#E36B11] rounded text-white text-xs font-bold">Save</button>
                    <button onClick={() => setIsEditing(false)} className="px-2 py-0.5 bg-cream rounded text-gray-600 text-xs">Cancel</button>
                  </div>
                ) : (
                  <h2 className="text-lg font-display font-black text-gray-900 truncate">{user.username}</h2>
                )}
                <div className="flex items-center gap-1 mt-0.5">
                  <CountryFlag flag={user.countryFlag || 'DE'} className="w-4 h-3 rounded-[2px]" />
                  {/* text-gray-500 at 12px read as barely-there on this card's pale
                      cream/orange-wash background - text-gray-700 actually reads. */}
                  <span className="text-xs text-gray-700">{user.country || 'World'}</span>
                </div>
              </div>
              
              {/* BOGX Balance - prominent on right */}
              <div className="flex items-center gap-1.5 pb-0.5">
                <img src="/images/bogxcoin.png" alt="" className="w-6 h-6" />
                <div className="text-right">
                  <span className="text-xl font-display font-black text-[#E36B11]">{formatCurrency(animatedCoins)}</span>
                  <div className="text-[8px] font-display font-bold tracking-widest uppercase text-gray-600">BOGX</div>
                </div>
              </div>
            </div>

            {/* Rankings Row - Daily / Monthly / Annually */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-warm/50">
              <div className="text-center">
                <div className="text-sm font-display font-bold uppercase tracking-wide text-gray-900">Daily</div>
                <div className="flex items-center justify-center gap-1">
                  {dailyRank && <ArrowUp className="w-4 h-4 text-green-500" />}
                  <span className="text-xl font-display font-black text-gray-900 leading-tight">
                    {dailyRank ? `#${dailyRank}` : '—'}
                  </span>
                </div>
                {dailyPoints > 0 && (
                  <div className="text-xs font-display text-green-600 font-semibold">+{formatCurrency(dailyPoints)}</div>
                )}
              </div>
              <div className="text-center border-x border-warm/50">
                <div className="text-sm font-display font-bold uppercase tracking-wide text-gray-900">Monthly</div>
                <div className="flex items-center justify-center gap-1">
                  {monthlyRank && <ArrowUp className="w-4 h-4 text-green-500" />}
                  <span className="text-xl font-display font-black text-gray-900 leading-tight">
                    {monthlyRank ? `#${monthlyRank}` : '—'}
                  </span>
                </div>
                {monthlyPoints > 0 && (
                  <div className="text-xs font-display text-green-600 font-semibold">+{formatCurrency(monthlyPoints)}</div>
                )}
              </div>
              <div className="text-center">
                <div className="text-sm font-display font-bold uppercase tracking-wide text-gray-900">Annually</div>
                <div className="flex items-center justify-center gap-1">
                  {annuallyRank && <ArrowUp className="w-4 h-4 text-green-500" />}
                  <span className="text-xl font-display font-black text-gray-900 leading-tight">
                    {annuallyRank ? `#${annuallyRank}` : '—'}
                  </span>
                </div>
                {annuallyPoints > 0 && (
                  <div className="text-xs font-display text-green-600 font-semibold">+{formatCurrency(annuallyPoints)}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Author Earnings - only for authors/admins */}
        {(user?.isAuthor || user?.isAdmin) && (
          <div className="mx-4 mt-3 bg-cream rounded-2xl shadow-sm border border-warm p-3">
            <div className="flex items-center justify-center gap-2">
              <FileText className="w-4 h-4 text-gray-900" />
              <span className="font-display text-xl text-gray-900">{formatCurrency(user.authorEarnings || 0)}</span>
              <span className="text-[8px] font-display font-semibold tracking-widest uppercase text-gray-600">AUTHOR EARNINGS</span>
            </div>
          </div>
        )}

        {/* BOGX Breakdown Card - collapsible, how the user earned their coins.
            The card is ALWAYS rendered so the layout never jumps: while loading it
            shows placeholder rows of the same height as the real ones. */}
        <div className="mx-4 mt-3 bg-cream rounded-2xl shadow-sm border border-warm p-4">
          <button
            onClick={() => setEarningsExpanded(prev => !prev)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="text-sm font-display font-medium text-gray-900 flex items-center gap-1.5">
              <img src="/images/bogxcoin.png" alt="BOGX" className="w-4 h-4" /> How You Earned Your BOGX
            </div>
            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${earningsExpanded ? 'rotate-90' : ''}`} />
          </button>

          {earningsExpanded && !earnings ? (
            /* Loading skeleton - compact */
            <div className="mt-2 space-y-1 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 py-1">
                  <div className="w-4 h-4 rounded bg-skeleton flex-shrink-0" />
                  <div className="h-3 bg-skeleton rounded flex-1" style={{ maxWidth: `${60 + ((i * 17) % 30)}%` }} />
                  <div className="h-3 w-12 bg-skeleton rounded flex-shrink-0" />
                </div>
              ))}
            </div>
          ) : earningsExpanded && earnings && earnings.breakdown.length === 0 ? (
            <div className="py-4 text-center animate-lv-fade-up mt-2">
              <div className="text-xs text-gray-400">No BOGX earned yet</div>
            </div>
          ) : earningsExpanded && earnings ? (
          <div className="animate-lv-fade-up mt-2">
            {/* Compact breakdown list with separators */}
            <div className="divide-y divide-warm/30">
              {earnings.breakdown.map(item => (
                <div key={item.key} className="flex items-center gap-2 py-2">
                  <span className="text-sm leading-none w-4 text-center">{item.icon}</span>
                  <span className="text-xs text-gray-700 flex-1 truncate">{item.label}</span>
                  {item.count > 0 && <span className="text-[10px] text-gray-400 tabular-nums">{item.count}x</span>}
                  <span className={`text-xs font-bold tabular-nums min-w-[50px] text-right ${item.total < 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {item.total > 0 ? '+' : ''}{formatCurrency(item.total)}
                  </span>
                </div>
              ))}
            </div>

            {/* Summary row - compact */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-warm/50">
              <div className="flex items-center gap-3 text-[10px] tabular-nums">
                <span className="text-green-600 font-semibold">+{formatCurrency(earnings.totalEarned)}</span>
                {earnings.totalSpent > 0 && (
                  <span className="text-red-500 font-semibold">-{formatCurrency(earnings.totalSpent)}</span>
                )}
              </div>
              <span className="text-sm font-bold text-gray-900 tabular-nums">
                {formatCurrency(earnings.wallet)} {getCurrencySymbol()}
              </span>
            </div>
          </div>
          ) : null}
        </div>

        {/* Stats Card - collapsible, combines Wins/Accuracy/Games + Category Strengths */}
        <div className="mx-4 mt-3 bg-cream rounded-2xl shadow-sm border border-warm p-4">
          <button
            onClick={() => setCategoryStrengthsExpanded(prev => !prev)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="text-sm font-display font-medium text-gray-900 flex items-center gap-1.5">
              <Target className="w-4 h-4" /> Stats
            </div>
            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${categoryStrengthsExpanded ? 'rotate-90' : ''}`} />
          </button>

          {categoryStrengthsExpanded && (
            <div className="mt-3 animate-lv-fade-up">
              {/* Quick Stats Row */}
              <div className="grid grid-cols-3 gap-2 pb-3 mb-3 border-b border-warm/50">
                <div className="text-center">
                  <span className="font-display text-lg text-gray-900 block">{animatedWins}</span>
                  <span className="text-[8px] font-semibold tracking-widest uppercase text-gray-500">Wins</span>
                </div>
                <div className="text-center border-x border-warm/50">
                  <span className="font-display text-lg text-gray-900 block">{animatedWinRate}%</span>
                  <span className="text-[8px] font-semibold tracking-widest uppercase text-gray-500">Accuracy</span>
                </div>
                <div className="text-center">
                  <span className="font-display text-lg text-gray-900 block">{animatedGames}</span>
                  <span className="text-[8px] font-semibold tracking-widest uppercase text-gray-500">Games</span>
                </div>
              </div>

              {/* Category Strengths */}
              <div className="space-y-2.5">
                {categoryStrengthsLoading ? (
                  <>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 animate-pulse">
                        <div className="h-3 w-16 bg-skeleton rounded" />
                        <div className="flex-1 h-[6px] bg-skeleton rounded-full" />
                        <div className="h-3 w-8 bg-skeleton rounded" />
                      </div>
                    ))}
                  </>
                ) : categoryStrengths.length === 0 ? (
                  <div className="py-4 text-center">
                    <div className="text-xs text-gray-400">
                      Play more trivia to see category strengths
                    </div>
                  </div>
                ) : (
                  categoryStrengths.map(cat => (
                    <div key={cat.key} className="flex items-center gap-3">
                      <span className="text-xs font-semibold tracking-wide uppercase text-gray-700 min-w-[64px]">{cat.name}</span>
                      <div className="flex-1 h-[6px] bg-cream rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#E36B11] to-[#FFB800] rounded-full transition-all duration-700" style={{ width: `${cat.pct}%` }} />
                      </div>
                      <span className="text-[11px] font-bold text-gray-700 min-w-[36px] text-right">{cat.pct}%</span>
                      <span className="text-[9px] text-gray-400 min-w-[40px] text-right">{cat.correct}/{cat.total}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Settings Card */}
        <div className="mx-4 mt-3 bg-cream rounded-2xl shadow-sm border border-warm overflow-hidden">
          <div className="px-4 py-3 border-b border-warm/60">
            <div className="text-sm font-display font-medium text-gray-900">Settings</div>
          </div>
          <div className="divide-y divide-warm/60">
            <button 
              onClick={() => setShowCountryPicker(true)}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-cream transition-colors"
            >
              <div className="flex items-center gap-3">
                <CountryFlag flag={user.countryFlag || 'DE'} className="w-6 h-5 rounded-sm" />
                <span className="text-sm font-display font-medium text-gray-900">Country</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <span>{user.country || 'World'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>
            
            <button 
              onClick={() => setShowNotificationSettings(true)}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-cream transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-gray-900" />
                </div>
                <span className="text-sm font-display font-medium text-gray-900">Notifications</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </button>
            
            <button className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-cream transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-gray-900" />
                </div>
                <span className="text-sm font-display font-medium text-gray-900">Language</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <span>EN</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>
            
            <button 
              onClick={() => setShowPasswordModal(true)}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-cream transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-gray-900" />
                </div>
                <span className="text-sm font-display font-medium text-gray-900">Privacy & Security</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Admin Button */}
        {user.isAdmin && (
          <div className="mx-4 mt-3">
            <a 
              href="/admin"
              className="w-full flex items-center justify-center gap-2 p-3 bg-cream border border-[#E36B11]/40 rounded-2xl shadow-sm hover:bg-[#E36B11]/5 transition-colors"
            >
              <Shield className="w-4 h-4 text-gray-900" />
              <span className="text-gray-900 text-sm font-bold">Admin Panel</span>
            </a>
          </div>
        )}

        {/* Invite Friends Button */}
        <div className="mx-4 mt-3">
          <button
            onClick={() => setShowInviteModal(true)}
            className="w-full flex items-center justify-center gap-2 p-3.5 bg-cream border border-warm rounded-2xl shadow-sm hover:bg-[#E36B11]/5 transition-colors"
          >
            <Share2 className="w-4 h-4 text-gray-900" />
            <span className="text-gray-900 text-sm font-bold">Invite friends &middot; +5.00 BOGX each</span>
          </button>
        </div>

        {/* Logout Button */}
        <div className="mx-4 mt-3">
          <button 
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center justify-center gap-2 p-3.5 bg-cream border border-red-200 rounded-2xl shadow-sm hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4 text-red-500" />
            <span className="text-red-500 text-sm font-bold">Log out</span>
          </button>
        </div>

        {/* Spacer */}
        <div className="h-8" />
      </div>

      {/* Invite Friends Modal */}
      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        userId={user.id}
        username={user.username}
      />

      {/* Logout Modal - extracted to separate component */}
      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onLogout={() => {
          // Clear session tracking on logout
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('bogx_session_start');
            sessionStorage.removeItem('bogx_session_stats');
            sessionStorage.removeItem('bogx_session_articles');
            sessionStorage.removeItem('bogx_session_votes');
          }
          logout();
        }}
        username={user.username}
        bogxCoins={user.bogxCoins || 0}
        wins={user.wins || 0}
        gamesPlayed={user.gamesPlayed || 0}
        sessionStartTime={sessionStartTime}
        sessionGamesPlayed={(user.gamesPlayed || 0) - (sessionStartStats.gamesPlayed || 0)}
        sessionBogxEarned={(user.bogxCoins || 0) - (sessionStartStats.bogxCoins || 0)}
        sessionWins={(user.wins || 0) - (sessionStartStats.wins || 0)}
        sessionArticlesRead={typeof window !== 'undefined' ? parseInt(sessionStorage.getItem('bogx_session_articles') || '0', 10) : 0}
        sessionVotes={typeof window !== 'undefined' ? parseInt(sessionStorage.getItem('bogx_session_votes') || '0', 10) : 0}
      />

      {/* Avatar Picker Modal - rendered via portal to escape stacking contexts */}
      {showAvatarPicker && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4 text-center">Choose Avatar</h2>
            
            {/* Upload your own */}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="w-full py-3 mb-4 bg-[#E36B11] text-white font-bold rounded-xl hover:bg-[#C4772A] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isUploadingAvatar ? (
                <span>Uploading...</span>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Upload Your Photo
                </>
              )}
            </button>

            <p className="text-center text-gray-400 text-xs mb-3">Or choose from below</p>

            <div className="grid grid-cols-5 gap-3 mb-4 justify-items-center">
              {avatarOptions.length === 0 && (
                <p className="col-span-5 text-center text-gray-400 text-xs py-4">Loading avatars...</p>
              )}
              {avatarOptions.map((avatar, index) => (
                <button
                  key={index}
                  onClick={() => handleAvatarSelect(avatar)}
                  className={`w-16 h-16 rounded-full overflow-hidden border-2 transition-all hover:scale-110 ${
                    user.avatar === avatar ? 'border-[#E36B11]' : 'border-warm'
                  }`}
                >
                  <img src={avatar} alt={`Avatar ${index + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowAvatarPicker(false)}
              className="w-full py-3 bg-gray-700 text-white font-bold rounded-xl hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Country Picker Modal - portal so it covers header/sidebars */}
      {showCountryPicker && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-cream rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">Select Country</h2>
            
            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
              {countries.map((country) => (
                <button
                  key={country.code}
                  onClick={() => handleCountrySelect(country)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                    user.country === country.name 
                      ? 'bg-[#E36B11]/20 border-2 border-[#E36B11]' 
                      : 'bg-cream hover:bg-cream'
                  }`}
                >
                  <CountryFlag flag={country.code} className="w-8 h-6 rounded-sm" />
                  <span className="text-gray-900 font-medium">{country.name}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowCountryPicker(false)}
              className="w-full py-3 bg-cream text-gray-700 font-bold rounded-xl hover:bg-skeleton-light transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Password Change Modal - portal so it covers header/sidebars */}
      {showPasswordModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-[9999] p-4 pt-16 overflow-y-auto">
          <div className="bg-cream rounded-2xl p-6 max-w-sm w-full shadow-xl mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Change Password</h2>
              <button onClick={() => setShowPasswordModal(false)}>
                <X className="w-5 h-5 text-gray-600 hover:text-gray-600" />
              </button>
            </div>
            
            {passwordError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-500 text-sm text-center">{passwordError}</p>
              </div>
            )}
            
            {passwordSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl">
                <p className="text-green-500 text-sm text-center">{passwordSuccess}</p>
              </div>
            )}
            
            <div className="space-y-3">
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current Password"
                  className="w-full px-4 py-3 bg-cream border border-warm rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#E36B11] outline-none text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600"
                >
                  {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New Password"
                  className="w-full px-4 py-3 bg-cream border border-warm rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#E36B11] outline-none text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600"
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm New Password"
                className="w-full px-4 py-3 bg-cream border border-warm rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#E36B11] outline-none text-base"
              />
            </div>
            
            <button
              onClick={handlePasswordChange}
              className="w-full mt-4 py-3 bg-[#E36B11] hover:bg-[#c4e000] rounded-xl text-white font-bold transition-colors"
            >
              Update Password
            </button>
          </div>
        </div>,
        document.body
      )}
      
      {/* Phone Number Modal - portal so it covers header/sidebars */}
      {showPhoneModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-cream rounded-2xl shadow-xl p-5 w-full max-w-[340px]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Phone Number</h2>
              <button onClick={() => {
                setShowPhoneModal(false);
                setPhoneSuccess(false);
              }}>
                <X className="w-5 h-5 text-gray-600 hover:text-gray-600" />
              </button>
            </div>
            
            <p className="text-gray-500 text-sm mb-4">
              Add your phone number to receive SMS notifications for new challenges.
            </p>
            
            {phoneSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <p className="text-green-500 text-sm">Phone number saved!</p>
              </div>
            )}
            
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+49 123 456789"
                className="w-full pl-10 pr-4 py-3 bg-cream border border-warm rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#E36B11] outline-none text-base"
              />
            </div>
            
            <button
              onClick={async () => {
                if (!phoneNumber.trim()) return;
                setPhoneSaving(true);
                try {
                  const res = await fetch('/api/user/update-phone', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, phone: phoneNumber }),
                  });
                  if (res.ok) {
                    updateUser({ phone: phoneNumber });
                    setPhoneSuccess(true);
                    setTimeout(() => {
                      setShowPhoneModal(false);
                      setPhoneSuccess(false);
                    }, 1500);
                  }
                } catch (error) {
                  console.error('Failed to save phone:', error);
                } finally {
                  setPhoneSaving(false);
                }
              }}
              disabled={phoneSaving || !phoneNumber.trim()}
              className="w-full mt-4 py-3 bg-[#E36B11] hover:bg-[#c4e000] rounded-xl text-white font-bold transition-colors disabled:opacity-50"
            >
              {phoneSaving ? 'Saving...' : 'Save Phone Number'}
            </button>
          </div>
        </div>,
        document.body
      )}
      
      {/* Notification Settings Modal */}
      <PushNotifications 
        showSettings={showNotificationSettings} 
        onClose={() => setShowNotificationSettings(false)} 
      />
    </div>
  );
}
