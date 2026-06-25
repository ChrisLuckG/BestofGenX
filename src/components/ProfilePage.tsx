"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, Edit2, Trophy, Coins, Target, LogOut, Lock, ChevronRight, User, Eye, EyeOff, X, Globe, FileText, Shield, HelpCircle, Phone, Check, Mail, Building, Bell, Share2, Upload } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import PushNotifications from "./PushNotifications";
import InviteModal from "./InviteModal";
import CountryFlag from "./CountryFlag";
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

// Avatar options - 90s/00s themed
const avatarOptions = [
  "https://i.pravatar.cc/150?img=1",
  "https://i.pravatar.cc/150?img=2",
  "https://i.pravatar.cc/150?img=3",
  "https://i.pravatar.cc/150?img=4",
  "https://i.pravatar.cc/150?img=5",
  "https://i.pravatar.cc/150?img=8",
  "https://i.pravatar.cc/150?img=11",
  "https://i.pravatar.cc/150?img=12",
  "https://i.pravatar.cc/150?img=13",
  "https://i.pravatar.cc/150?img=14",
  "https://i.pravatar.cc/150?img=15",
  "https://i.pravatar.cc/150?img=16",
];

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

  // Logout "See you soon" modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Invite friends modal
  const [showInviteModal, setShowInviteModal] = useState(false);

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
    { label: "Balance", value: `${formatCurrency(coins)} ${getCurrencySymbol()}`, icon: Coins, color: "text-[#D4873A]" },
    { label: "Games Played", value: gamesPlayed, icon: Target, color: "text-cyan-400" },
    { label: "Wins", value: wins, icon: Trophy, color: "text-green-400" },
    { label: "Win Rate", value: gamesPlayed > 0 ? `${winRate}%` : "-", icon: Trophy, color: "text-[#D4873A]" },
  ];

  // Member since date (placeholder - would come from user data)
  const memberSince = 'March 2026';

  // Category strengths (placeholder - would come from API)
  const categoryStrengths = [
    { name: 'Music', pct: 70 },
    { name: 'Sport', pct: 60 },
    { name: 'Film', pct: 45 },
    { name: 'Culture', pct: 30 },
  ];

  return (
    <div className="w-full h-full min-h-full flex flex-col bg-cream overflow-hidden">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        
        {/* Hero Card - Profile Header */}
        <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm border border-warm overflow-hidden">
          {/* Background gradient header */}
          <div className="h-16 bg-gradient-to-br from-[#D4873A]/20 via-[#D4873A]/10 to-transparent" />
          
          <div className="px-5 pb-5 -mt-10 relative">
            {/* Edit Button */}
            <button 
              onClick={() => setIsEditing(true)}
              className="absolute top-3 right-3 w-8 h-8 bg-white border border-warm rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-cream shadow-sm"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            
            {/* Avatar */}
            <button 
              onClick={() => setShowAvatarPicker(true)}
              className="relative mb-3"
            >
              <div className="w-[80px] h-[80px] rounded-full overflow-hidden border-4 border-white shadow-md">
                <img src={user.avatar || "https://i.pravatar.cc/150?img=33"} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white" />
            </button>
            
            {/* Name */}
            {isEditing ? (
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="bg-cream border border-[#D4873A]/30 rounded-lg px-2 py-1 text-gray-900 text-lg font-display w-40"
                  autoFocus
                />
                <button onClick={handleUsernameUpdate} className="px-2 py-1 bg-[#D4873A] rounded text-white text-xs font-bold">Save</button>
                <button onClick={() => setIsEditing(false)} className="px-2 py-1 bg-cream rounded text-gray-600 text-xs">Cancel</button>
              </div>
            ) : (
              <div className="font-display text-[26px] tracking-wide text-gray-900 leading-tight mb-1 flex items-center gap-2">
                <CountryFlag flag={user.countryFlag || 'DE'} className="w-6 h-5 rounded-sm" />
                <span>{user.username}</span>
              </div>
            )}
            
            {/* Meta - badges style */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="px-2.5 py-1 bg-[#D4873A] text-white text-[10px] font-bold rounded-lg shadow-sm">
                Rank #22
              </span>
              <span className="px-2 py-0.5 bg-cream text-gray-700 text-[10px] font-semibold rounded-md border border-warm">
                {user.country || 'World'}
              </span>
              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-md border border-orange-300 flex items-center gap-1">
                <Target className="w-3 h-3" /> {animatedStreak} day streak
              </span>
            </div>
            <div className="text-[10px] text-gray-400 mt-2">
              Member since {memberSince}
            </div>
          </div>
        </div>

        {/* Stats Card */}
        <div className="mx-4 mt-3 bg-white rounded-2xl shadow-sm border border-warm overflow-hidden">
          <div className={`grid ${(user?.isAuthor || user?.isAdmin) ? 'grid-cols-5' : 'grid-cols-4'} divide-x divide-warm`}>
            <div className="p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <img src="/images/bogxcoin.png" alt="BOGX" className="w-5 h-5" />
                <span className="font-display text-xl text-[#D4873A]">{formatCurrency(animatedCoins)}</span>
              </div>
              <span className="text-[8px] font-semibold tracking-widest uppercase text-gray-500 mt-0.5 block">BOGX</span>
            </div>
            {(user?.isAuthor || user?.isAdmin) && (
              <div className="p-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  <FileText className="w-4 h-4 text-purple-500" />
                  <span className="font-display text-xl text-purple-500">{formatCurrency(user.authorEarnings || 0)}</span>
                </div>
                <span className="text-[8px] font-semibold tracking-widest uppercase text-gray-500 mt-0.5 block">Author</span>
              </div>
            )}
            <div className="p-3 text-center">
              <span className="font-display text-xl text-[#FFB800] block">{animatedWins}</span>
              <span className="text-[8px] font-semibold tracking-widest uppercase text-gray-500 mt-0.5 block">Wins</span>
            </div>
            <div className="p-3 text-center">
              <span className="font-display text-xl text-gray-900 block">{animatedWinRate}%</span>
              <span className="text-[8px] font-semibold tracking-widest uppercase text-gray-500 mt-0.5 block">Accuracy</span>
            </div>
            <div className="p-3 text-center">
              <span className="font-display text-xl text-gray-900 block">{animatedGames}</span>
              <span className="text-[8px] font-semibold tracking-widest uppercase text-gray-500 mt-0.5 block">Games</span>
            </div>
          </div>
        </div>

        {/* Winner Badges Card */}
        <div className="mx-4 mt-3 bg-white rounded-2xl shadow-sm border border-warm p-4">
          <div className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mb-3 flex items-center gap-1.5">
            <Trophy className="w-3 h-3" /> Winner Badges
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="px-3 py-1.5 bg-cream border border-warm rounded-lg text-[10px] font-semibold tracking-widest uppercase text-gray-700">★ Daily ×3</div>
            <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-[10px] font-semibold tracking-widest uppercase text-blue-600">★★ Weekly ×1</div>
            <div className="px-3 py-1.5 bg-cream border border-warm rounded-lg text-[10px] font-semibold tracking-widest uppercase text-gray-400 opacity-60">★★★ Monthly</div>
            <div className="px-3 py-1.5 bg-cream border border-warm rounded-lg text-[10px] font-semibold tracking-widest uppercase text-gray-400 opacity-60">★★★★ Annual</div>
          </div>
        </div>

        {/* Category Strengths Card */}
        <div className="mx-4 mt-3 bg-white rounded-2xl shadow-sm border border-warm p-4">
          <div className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mb-3 flex items-center gap-1.5">
            <Target className="w-3 h-3" /> Category Strengths
          </div>
          <div className="space-y-3">
            {categoryStrengths.map(cat => (
              <div key={cat.name} className="flex items-center gap-3">
                <span className="text-xs font-semibold tracking-wide uppercase text-gray-700 min-w-[64px]">{cat.name}</span>
                <div className="flex-1 h-[6px] bg-cream rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#D4873A] to-[#FFB800] rounded-full transition-all duration-700" style={{ width: `${cat.pct}%` }} />
                </div>
                <span className="text-[11px] font-bold text-gray-700 min-w-[36px] text-right">{cat.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Settings Card */}
        <div className="mx-4 mt-3 bg-white rounded-2xl shadow-sm border border-warm overflow-hidden">
          <div className="px-4 py-3 border-b border-warm/60">
            <div className="text-[10px] font-bold tracking-widest uppercase text-gray-500">Settings</div>
          </div>
          <div className="divide-y divide-warm/60">
            <button 
              onClick={() => setShowCountryPicker(true)}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-cream transition-colors"
            >
              <div className="flex items-center gap-3">
                <CountryFlag flag={user.countryFlag || 'DE'} className="w-6 h-5 rounded-sm" />
                <span className="text-sm font-medium text-gray-900">Country</span>
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
                <div className="w-7 h-7 rounded-lg bg-[#D4873A]/10 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-[#D4873A]" />
                </div>
                <span className="text-sm font-medium text-gray-900">Notifications</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </button>
            
            <button className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-cream transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-sm font-medium text-gray-900">Language</span>
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
                <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-sm font-medium text-gray-900">Privacy & Security</span>
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
              className="w-full flex items-center justify-center gap-2 p-3 bg-white border border-[#D4873A]/40 rounded-2xl shadow-sm hover:bg-[#D4873A]/5 transition-colors"
            >
              <Shield className="w-4 h-4 text-[#D4873A]" />
              <span className="text-[#D4873A] text-sm font-bold">Admin Panel</span>
            </a>
          </div>
        )}

        {/* Invite Friends Button */}
        <div className="mx-4 mt-3">
          <button
            onClick={() => setShowInviteModal(true)}
            className="w-full flex items-center justify-center gap-2 p-3.5 bg-white border border-warm rounded-2xl shadow-sm hover:bg-[#D4873A]/5 transition-colors"
          >
            <Share2 className="w-4 h-4 text-[#D4873A]" />
            <span className="text-[#D4873A] text-sm font-bold">Invite friends &middot; +5.00 BOGX each</span>
          </button>
        </div>

        {/* Logout Button */}
        <div className="mx-4 mt-3">
          <button 
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center justify-center gap-2 p-3.5 bg-white border border-red-200 rounded-2xl shadow-sm hover:bg-red-50 transition-colors"
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

      {/* Logout "See you soon" Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-5">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
            onClick={() => setShowLogoutModal(false)}
          />
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="h-24 bg-gradient-to-br from-[#D4873A]/15 via-[#D4873A]/5 to-transparent relative">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 hover:bg-white border border-warm flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors shadow-sm"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute -bottom-7 left-1/2 -translate-x-1/2">
                <div className="w-14 h-14 rounded-2xl bg-white border border-warm shadow-md flex items-center justify-center">
                  <img src="/images/genxlogo1.png" alt="Best of GenX" className="h-9 object-contain" />
                </div>
              </div>
            </div>

            <div className="px-7 pt-12 pb-7">
              <h2 className="font-display text-[26px] tracking-wide text-gray-900 leading-tight text-center mb-1">
                See you soon, {user.username}!
              </h2>
              <p className="text-gray-500 text-[13px] leading-relaxed text-center mb-5">
                Here's a quick look at where you stand before you go.
              </p>

              {/* Session info */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                <div className="rounded-2xl border border-warm bg-cream/50 p-3 text-center">
                  <img src="/images/bogxcoin.png" alt="BOGX" className="w-4 h-4 mx-auto mb-1" />
                  <div className="text-[15px] font-black text-gray-900">{formatCurrency(animatedCoins)}</div>
                  <div className="text-[9px] uppercase tracking-wider text-gray-400 font-bold">BOGX</div>
                </div>
                <div className="rounded-2xl border border-warm bg-cream/50 p-3 text-center">
                  <Trophy className="w-4 h-4 text-[#D4873A] mx-auto mb-1" />
                  <div className="text-[15px] font-black text-gray-900">{animatedWins}</div>
                  <div className="text-[9px] uppercase tracking-wider text-gray-400 font-bold">Wins</div>
                </div>
                <div className="rounded-2xl border border-warm bg-cream/50 p-3 text-center">
                  <Target className="w-4 h-4 text-[#D4873A] mx-auto mb-1" />
                  <div className="text-[15px] font-black text-gray-900">{animatedGames}</div>
                  <div className="text-[9px] uppercase tracking-wider text-gray-400 font-bold">Games</div>
                </div>
              </div>

              <button
                onClick={() => { setShowLogoutModal(false); logout(); }}
                className="w-full py-3.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-[15px] transition-colors shadow-sm"
              >
                Log out
              </button>
              <button
                onClick={() => setShowLogoutModal(false)}
                className="w-full py-2.5 mt-2 text-gray-500 hover:text-gray-700 text-[13px] font-medium transition-colors"
              >
                Stay logged in
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Avatar Picker Modal */}
      {showAvatarPicker && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl border border-gray-700">
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
              className="w-full py-3 mb-4 bg-[#D4873A] text-white font-bold rounded-xl hover:bg-[#C4772A] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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

            <div className="grid grid-cols-4 gap-3 mb-4">
              {avatarOptions.map((avatar, index) => (
                <button
                  key={index}
                  onClick={() => handleAvatarSelect(avatar)}
                  className={`w-16 h-16 rounded-full overflow-hidden border-2 transition-all hover:scale-110 ${
                    user.avatar === avatar ? 'border-[#D4873A]' : 'border-warm'
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
        </div>
      )}

      {/* Country Picker Modal */}
      {showCountryPicker && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-cream rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">Select Country</h2>
            
            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
              {countries.map((country) => (
                <button
                  key={country.code}
                  onClick={() => handleCountrySelect(country)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                    user.country === country.name 
                      ? 'bg-[#D4873A]/20 border-2 border-[#D4873A]' 
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
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-16 overflow-y-auto">
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
                  className="w-full px-4 py-3 bg-cream border border-warm rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#D4873A] outline-none text-base"
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
                  className="w-full px-4 py-3 bg-cream border border-warm rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#D4873A] outline-none text-base"
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
                className="w-full px-4 py-3 bg-cream border border-warm rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#D4873A] outline-none text-base"
              />
            </div>
            
            <button
              onClick={handlePasswordChange}
              className="w-full mt-4 py-3 bg-[#D4873A] hover:bg-[#c4e000] rounded-xl text-white font-bold transition-colors"
            >
              Update Password
            </button>
          </div>
        </div>
      )}
      
      {/* Phone Number Modal */}
      {showPhoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
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
                className="w-full pl-10 pr-4 py-3 bg-cream border border-warm rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#D4873A] outline-none text-base"
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
              className="w-full mt-4 py-3 bg-[#D4873A] hover:bg-[#c4e000] rounded-xl text-white font-bold transition-colors disabled:opacity-50"
            >
              {phoneSaving ? 'Saving...' : 'Save Phone Number'}
            </button>
          </div>
        </div>
      )}
      
      {/* Notification Settings Modal */}
      <PushNotifications 
        showSettings={showNotificationSettings} 
        onClose={() => setShowNotificationSettings(false)} 
      />
    </div>
  );
}
