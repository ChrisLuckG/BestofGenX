"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search, Swords, X, ArrowRight, Wifi, Globe, BarChart3, Trophy, Check, Hash, Mail } from "lucide-react";
import LogoLoader from "../LogoLoader";
import BackButton from "../BackButton";
import CountryFlag from "../CountryFlag";
import { useAuth } from "@/context/AuthContext";

interface User {
  _id: string;
  username: string;
  avatar?: string;
  points?: number;
  country?: string;
  countryFlag?: string;
}

type PlayerFilter = 'online' | 'country' | 'level';

// BOGX wager amounts
const WAGERS = [
  { amount: 0.10, rounds: 3 },
  { amount: 0.25, rounds: 3 },
  { amount: 0.50, rounds: 5 },
  { amount: 0.75, rounds: 5 },
  { amount: 1.00, rounds: 5 },
];

// NOTE: culture, art, food removed - not enough DB questions for these themes yet
const TOPICS = [
  { id: 'sport',   label: 'Sport',   emoji: '⚽' },
  { id: 'music',   label: 'Music',   emoji: '🎵' },
  { id: 'film',    label: 'Film',    emoji: '🎬' },
  { id: 'fashion', label: 'Fashion', emoji: '👗' },
  { id: 'games',   label: 'Games',   emoji: '🎮' },
  { id: 'tv',      label: 'TV',      emoji: '📺' },
];

const PLAYER_FILTERS: { id: PlayerFilter; label: string; icon: typeof Wifi }[] = [
  { id: 'online', label: 'Online', icon: Wifi },
  { id: 'country', label: 'Country', icon: Globe },
  { id: 'level', label: 'Same Level', icon: BarChart3 },
];

interface InviteFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendChallenge: (user: User, wager: number, topic: string) => Promise<{ success: boolean; battle?: any }>;
  onChallengeStarted: (battle: any) => void;
  currentUserId?: string;
  currentUserCountry?: string;
  currentUserPoints?: number;
  isGenerating: boolean;
}

type Step = 'search' | 'config' | 'confirm' | 'success';

export default function InviteFlowModal({ 
  isOpen, 
  onClose, 
  onSendChallenge, 
  onChallengeStarted,
  currentUserId,
  currentUserCountry,
  currentUserPoints,
  isGenerating 
}: InviteFlowModalProps) {
  const { user: currentUser } = useAuth();
  const [step, setStep] = useState<Step>('search');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [wager, setWager] = useState(0.25);
  const [topic, setTopic] = useState('sport');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [onlinePlayers, setOnlinePlayers] = useState<User[]>([]);
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [playerFilter, setPlayerFilter] = useState<PlayerFilter>('online');

  // Success step: staggered "preparing" checklist before revealing the final state
  const [checklistIndex, setChecklistIndex] = useState(0);
  const [sentBattle, setSentBattle] = useState<any>(null);

  // Advance the checklist items 0 -> 1 -> 2 automatically while we wait for the
  // real API response (indeterminate). Index 3 (final "sent" screen) is only set
  // once the request actually completes - see handleSend.
  useEffect(() => {
    if (step !== 'success' || checklistIndex >= 2) return;
    const t = setTimeout(() => setChecklistIndex((i) => Math.min(i + 1, 2)), 450);
    return () => clearTimeout(t);
  }, [step, checklistIndex]);

  // Final "sent" screen stays open until the user clicks READY - see the READY button below

  // Search users
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const searchUsers = async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}&exclude=${currentUserId || ''}`);
        const data = await res.json();
        if (data.success) {
          setSearchResults(data.users || []);
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, currentUserId]);

  // Load online players when modal opens
  useEffect(() => {
    if (isOpen && step === 'search') {
      loadOnlinePlayers();
    }
  }, [isOpen, step]);

  const loadOnlinePlayers = async () => {
    setLoadingOnline(true);
    try {
      const res = await fetch(`/api/users/online?exclude=${currentUserId || ''}&limit=10`);
      const data = await res.json();
      if (data.success) {
        setOnlinePlayers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to load online players:', error);
    } finally {
      setLoadingOnline(false);
    }
  };

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep('search');
      setSelectedUser(null);
      setSearchQuery('');
      setSearchResults([]);
      setWager(0.25);
      setTopic('sport');
      setPlayerFilter('online');
      setChecklistIndex(0);
      setSentBattle(null);
    }
  }, [isOpen]);

  // Apply the active filter to the online players list
  const filteredPlayers = onlinePlayers.filter((u) => {
    if (playerFilter === 'country') {
      return currentUserCountry && u.country === currentUserCountry;
    }
    if (playerFilter === 'level') {
      const mine = currentUserPoints || 0;
      if (mine <= 0) return true;
      // "Same level" = within 40% of your points
      return Math.abs((u.points || 0) - mine) <= mine * 0.4;
    }
    return true; // online
  });

  if (!isOpen) return null;

  const rounds = wager >= 1 ? 5 : 3;
  const selectedTopic = TOPICS.find(t => t.id === topic) || TOPICS[0];

  const handleBack = () => {
    if (step === 'config') {
      setStep('search');
      setSelectedUser(null);
    } else if (step === 'confirm') {
      setStep('config');
    }
  };

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setStep('config');
  };

  const handleConfirm = () => {
    setStep('confirm');
  };

  const handleSend = async () => {
    if (!selectedUser) return;
    // Jump to the dedicated "sending" screen immediately - no spinner-in-button state needed
    setSentBattle(null);
    setChecklistIndex(0);
    setStep('success');
    const result = await onSendChallenge(selectedUser, wager, topic);
    if (result.success) {
      setSentBattle(result.battle);
      setChecklistIndex(3); // reveal the final "Challenge Sent!" screen
    } else {
      // Parent already shows its own alert (coins/error) - go back to confirm
      setStep('confirm');
    }
  };

  const modal = (
    <>
      {/* Backdrop – separate element so it truly covers sidebar */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={() => { if (step !== 'success') onClose(); }}
      />
      {/* Modal */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', pointerEvents: 'none' }}>
      <div className="relative bg-cream border border-warm rounded-2xl w-full max-w-[340px] lg:max-w-[720px] max-h-[90vh] overflow-hidden flex flex-col shadow-xl" style={{ pointerEvents: 'auto' }}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-warm">
          {step !== 'search' && step !== 'success' ? (
            <BackButton onClick={handleBack} label={true} />
          ) : (
            <div />
          )}
          <span className="font-display text-lg tracking-wider text-gray-900 flex items-center gap-2">
            {step === 'search' && <Swords className="w-5 h-5 text-[#D4873A]" />}
            {step === 'search' ? 'INVITE' : step === 'config' ? 'SETUP BATTLE' : step === 'confirm' ? 'CONFIRM' : 'CHALLENGE SENT'}
          </span>
          {step !== 'success' ? (
            <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center bg-black/5 border border-warm text-gray-700 hover:bg-black/10 hover:text-[#D4873A] transition-colors">
              <X className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-9 h-9" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          
          {/* Step 1: Search User */}
          {step === 'search' && (
            <>
              {/* Friendly intro */}
              <div className="text-center mb-4">
                <p className="text-gray-600 text-sm">Challenge a friend to a battle!</p>
                <p className="text-gray-600 text-xs mt-1">Search by username or pick from online players</p>
              </div>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by username..."
                  className="w-full bg-cream border border-warm rounded-lg py-3 pl-10 pr-4 text-gray-900 placeholder:text-gray-600 focus:outline-none focus:border-[#D4873A]"
                />
              </div>
              
              {/* Search Results */}
              {searchQuery.length >= 2 && (
                <div className="space-y-1 mb-4">
                  {isSearching ? (
                    <div className="flex justify-center py-6">
                      <LogoLoader size="sm" />
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((u) => (
                      <button
                        key={u._id}
                        onClick={() => handleSelectUser(u)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-[#D4873A]/5 transition-colors border border-warm hover:border-[#D4873A]/30 rounded-lg"
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4873A] to-[#00D4F0] flex items-center justify-center text-white font-bold overflow-hidden">
                          {u.avatar ? (
                            <img src={u.avatar} alt={u.username} className="w-full h-full object-cover" />
                          ) : (
                            u.username?.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-1.5">
                            <div className="text-gray-900 font-semibold">{u.username}</div>
                            {u.countryFlag && <CountryFlag flag={u.countryFlag} className="w-4 h-3 rounded-[2px]" />}
                          </div>
                          <div className="text-gray-600 text-xs">{(u.points || 0).toFixed(2)} coins</div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-500" />
                      </button>
                    ))
                  ) : (
                    <div className="text-center text-gray-600 py-4">No users found</div>
                  )}
                </div>
              )}

              {/* Player Filters + List */}
              {searchQuery.length < 2 && (
                <div className="mt-2">
                  {/* Flat filter chips */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {PLAYER_FILTERS.map((f) => {
                      const Icon = f.icon;
                      const active = playerFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => setPlayerFilter(f.id)}
                          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                            active
                              ? 'bg-[#D4873A] text-white border-[#D4873A]'
                              : 'bg-cream text-gray-600 border-warm hover:border-[#D4873A]/40'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {f.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {loadingOnline ? (
                      <div className="flex justify-center py-4">
                        <LogoLoader size="sm" />
                      </div>
                    ) : filteredPlayers.length > 0 ? (
                      filteredPlayers.map((u) => (
                        <button
                          key={u._id}
                          onClick={() => handleSelectUser(u)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-[#D4873A]/5 transition-colors border border-warm hover:border-[#D4873A]/30 rounded-lg"
                        >
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4873A] to-[#00D4F0] flex items-center justify-center text-white font-bold overflow-hidden">
                              {u.avatar ? (
                                <img src={u.avatar} alt={u.username} className="w-full h-full object-cover" />
                              ) : (
                                u.username?.charAt(0).toUpperCase()
                              )}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
                          </div>
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-1.5">
                              <div className="text-gray-900 font-semibold">{u.username}</div>
                              {u.countryFlag && <CountryFlag flag={u.countryFlag} className="w-4 h-3 rounded-[2px]" />}
                            </div>
                            <div className="text-gray-600 text-xs">{(u.points || 0).toFixed(2)} coins</div>
                          </div>
                          <Swords className="w-4 h-4 text-gray-600" />
                        </button>
                      ))
                    ) : (
                      <div className="text-center text-gray-600 py-6 text-sm">
                        {playerFilter === 'country'
                          ? 'No online players from your country right now'
                          : playerFilter === 'level'
                            ? 'No online players at your level right now'
                            : 'No players online right now'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Step 2: Configure Battle */}
          {step === 'config' && selectedUser && (
            <>
            <div className="lg:flex lg:gap-0 lg:items-stretch">

              {/* LEFT COLUMN: VS Banner + Wager */}
              <div className="lg:w-1/2 lg:border-r lg:border-warm lg:pr-6 mb-5 lg:mb-0">
                {/* VS Banner */}
                <div className="flex items-center gap-4 mb-5 bg-gradient-to-r from-[#D4873A]/10 to-transparent border border-[#D4873A]/20 rounded-xl p-4">
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#D4873A]">
                      {currentUser?.avatar
                        ? <img src={currentUser.avatar} alt={currentUser.username} className="w-full h-full object-cover" />
                        : <div className="w-full h-full bg-[#D4873A] flex items-center justify-center text-white font-bold text-lg">{currentUser?.username?.charAt(0).toUpperCase() || 'Y'}</div>
                      }
                    </div>
                    <div className="text-xs font-bold text-gray-900 mt-1 max-w-[80px] truncate text-center">You</div>
                    <div className="flex items-center gap-1 text-[10px] text-gray-500">
                      <img src="/images/bogxcoin.png" alt="" className="w-3 h-3" />
                      {(currentUserPoints || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <span className="font-display text-3xl text-[#D4873A] tracking-wider">VS</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-gray-300">
                      {selectedUser.avatar
                        ? <img src={selectedUser.avatar} alt={selectedUser.username} className="w-full h-full object-cover" />
                        : <div className="w-full h-full bg-[#D4873A] flex items-center justify-center text-white font-bold text-lg">{selectedUser.username?.charAt(0).toUpperCase()}</div>
                      }
                    </div>
                    <div className="text-xs font-bold text-gray-900 mt-1 max-w-[80px] truncate text-center">{selectedUser.username}</div>
                    <div className="flex items-center gap-1 text-[10px] text-gray-500">
                      <img src="/images/bogxcoin.png" alt="" className="w-3 h-3" />
                      {(selectedUser.points || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Wager Selection */}
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="w-5 h-5 bg-[#D4873A] text-white text-[10px] font-bold flex items-center justify-center rounded">1</span>
                    <span className="text-xs font-bold tracking-widest text-[#D4873A] uppercase">Choose Wager</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {WAGERS.map(w => (
                      <button
                        key={w.amount}
                        onClick={() => setWager(w.amount)}
                        className={`py-3 text-center transition-all rounded-xl border-2 ${
                          wager === w.amount
                            ? 'bg-[#D4873A] border-[#D4873A] text-white shadow-md shadow-[#D4873A]/30'
                            : 'bg-cream border-warm text-gray-700 hover:border-[#D4873A]/40'
                        }`}
                      >
                        <div className="font-display text-sm font-bold">{w.amount.toFixed(2)}</div>
                        <div className="text-[9px] opacity-60">{w.rounds}R</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Topics only */}
              <div className="lg:w-1/2 lg:pl-6 flex flex-col">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-5 h-5 bg-[#D4873A] text-white text-[10px] font-bold flex items-center justify-center rounded">2</span>
                  <span className="text-xs font-bold tracking-widest text-[#D4873A] uppercase">Choose Topic</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 flex-1" style={{ gridAutoRows: '1fr' }}>
                  {TOPICS.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTopic(t.id)}
                      className={`flex items-center justify-center gap-1.5 px-2 py-2 text-sm font-semibold transition-all rounded-xl border-2 w-full h-full ${
                        topic === t.id
                          ? 'bg-[#D4873A] border-[#D4873A] text-white shadow-md shadow-[#D4873A]/30'
                          : 'bg-cream border-warm text-gray-700 hover:border-[#D4873A]/40'
                      }`}
                    >
                      <span className="text-base">{t.emoji}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Prize Info + START BATTLE – full width below both columns */}
            <div className="border-t border-warm mt-5 pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Trophy className="w-4 h-4 text-[#D4873A]" />
                  <div>
                    <div className="font-semibold text-gray-700">Winner takes all</div>
                    <div>The winner gets the total pot.</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Estimated Prize</div>
                  <div className="flex items-center gap-1 justify-end">
                    <img src="/images/bogxcoin.png" alt="BOGX" className="w-4 h-4" />
                    <span className="font-bold text-[#D4873A]">{(wager * 2).toFixed(2)} coins</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleConfirm}
                className="w-full py-3.5 bg-[#D4873A] hover:bg-[#c57730] text-white font-display text-sm tracking-widest flex items-center justify-center gap-2 rounded-xl shadow-lg shadow-[#D4873A]/30 transition-colors"
              >
                <Swords className="w-4 h-4" />
                START BATTLE
              </button>
              <p className="text-center text-[10px] text-gray-400 mt-2">🔒 Fair play enabled. Good luck!</p>
            </div>
            </>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && selectedUser && (
            <div className="text-center">
              {/* User Avatar */}
              <div className="flex flex-col items-center mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#D4873A] to-[#00D4F0] flex items-center justify-center text-white font-bold text-3xl mb-3 overflow-hidden">
                  {selectedUser.avatar ? (
                    <img src={selectedUser.avatar} alt={selectedUser.username} className="w-full h-full object-cover" />
                  ) : (
                    selectedUser.username?.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="text-gray-900 font-semibold text-xl">{selectedUser.username}</div>
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                  <img src="/images/bogxcoin.png" alt="" className="w-3.5 h-3.5" />
                  {(selectedUser.points || 0).toFixed(2)} coins
                </div>
              </div>

              {/* Battle Details */}
              <div className="bg-cream border border-warm rounded-xl mb-4 text-left divide-y divide-warm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5 text-gray-500">
                    <span className="w-7 h-7 rounded-lg bg-[#D4873A]/10 flex items-center justify-center text-sm">{selectedTopic.emoji}</span>
                    <span>Topic</span>
                  </div>
                  <span className="text-gray-900 font-semibold">{selectedTopic.label}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5 text-gray-500">
                    <span className="w-7 h-7 rounded-lg bg-[#D4873A]/10 flex items-center justify-center">
                      <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                    </span>
                    <span>Wager</span>
                  </div>
                  <span className="text-gray-900 font-semibold">{wager.toFixed(2)} BOGX</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5 text-gray-500">
                    <span className="w-7 h-7 rounded-lg bg-[#D4873A]/10 flex items-center justify-center">
                      <Hash className="w-3.5 h-3.5 text-[#D4873A]" />
                    </span>
                    <span>Rounds</span>
                  </div>
                  <span className="text-gray-900 font-semibold">Best of {rounds}</span>
                </div>
              </div>

              {/* Prize Pool - highlighted, separate from the plain detail rows */}
              <div className="flex items-center justify-between bg-[#D4873A]/10 border border-[#D4873A]/25 rounded-xl px-4 py-3 mb-6">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Trophy className="w-4 h-4 text-[#D4873A]" />
                  <span className="font-semibold">Prize Pool</span>
                  <span className="text-gray-400">· Winner takes all</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <img src="/images/bogxcoin.png" alt="BOGX" className="w-4 h-4" />
                  <span className="font-display text-[#D4873A] font-bold">{(wager * 2).toFixed(2)} BOGX</span>
                </div>
              </div>

              <p className="text-gray-600 text-xs mb-6">
                You'll play your round first. {selectedUser.username} will be notified and has 48h to accept.
              </p>

              {/* Send Button - clicking hands off to the dedicated sending screen, no spinner needed here */}
              <button
                onClick={handleSend}
                className="w-full py-4 bg-[#D4873A] text-white font-display text-base tracking-widest flex items-center justify-center gap-2 rounded-xl"
              >
                <Swords className="w-5 h-5" />
                SEND CHALLENGE
              </button>
            </div>
          )}

          {/* Step 4: Success - stays in the same modal, then hands off to the game.
              First shows a "preparing" screen with a progress bar + checklist, then the final confirmation. */}
          {step === 'success' && selectedUser && (
            <div className="text-center py-4">
              {checklistIndex < 3 ? (
                <>
                  {/* Centerpiece icon with starburst rays behind it */}
                  <div className="relative w-24 h-24 mx-auto mb-5 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-[#D4873A]/10 animate-pulse" />
                    {[0, 45, 90, 135].map((deg) => (
                      <div
                        key={deg}
                        className="absolute inset-0"
                        style={{ transform: `rotate(${deg}deg)` }}
                      >
                        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-0.5 h-3 bg-[#D4873A]/30 rounded-full" />
                        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-0.5 h-3 bg-[#D4873A]/30 rounded-full" />
                      </div>
                    ))}
                    <div className="relative w-16 h-16 rounded-full bg-[#D4873A] flex items-center justify-center shadow-lg shadow-[#D4873A]/40">
                      <Swords className="w-7 h-7 text-white" />
                    </div>
                  </div>

                  <h3 className="font-display text-lg text-gray-900 mb-1 tracking-wider">SENDING CHALLENGE...</h3>
                  <p className="text-gray-500 text-xs mb-5">We're setting everything up. Sit tight!</p>

                  {/* Progress bar tied to checklist progress */}
                  <div className="max-w-[260px] mx-auto h-1.5 bg-black/10 rounded-full overflow-hidden mb-6">
                    <div
                      className="h-full bg-[#D4873A] rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${Math.min(100, (checklistIndex / 3) * 90 + 10)}%` }}
                    />
                  </div>

                  <div className="max-w-[240px] mx-auto space-y-3 text-left">
                    {['Creating battle', 'Locking wager', `Notifying ${selectedUser.username}`].map((label, i) => (
                      <div key={label} className="flex items-center gap-2.5">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
                          checklistIndex > i ? 'bg-[#D4873A]' : 'bg-black/10'
                        }`}>
                          {checklistIndex > i ? (
                            <Check className="w-3 h-3 text-white" />
                          ) : checklistIndex === i ? (
                            <div className="w-2.5 h-2.5 border-2 border-[#D4873A] border-t-transparent rounded-full animate-spin" />
                          ) : null}
                        </div>
                        <span className={`text-sm transition-colors ${checklistIndex >= i ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-2">
                  {/* Checkmark with confetti dots scattered around it */}
                  <div className="relative w-20 h-20 mx-auto mb-4">
                    <span className="absolute -top-1 -right-2 w-2.5 h-2.5 rounded-full bg-[#00D4F0]/60" />
                    <span className="absolute -top-2 left-2 w-1.5 h-1.5 rounded-full bg-[#D4873A]/60" />
                    <span className="absolute top-1/2 -right-4 w-2 h-2 rounded-full bg-green-400/60" />
                    <span className="absolute -bottom-0.5 -left-1 w-2 h-2 rounded-full bg-[#D4873A]/40" />
                    <span className="absolute -bottom-1 right-0 w-1.5 h-1.5 rounded-full bg-[#D4873A]/30" />
                    <div className="w-20 h-20 rounded-full bg-[#D4873A]/10 border-2 border-[#D4873A]/25 flex items-center justify-center">
                      <Check className="w-10 h-10 text-[#D4873A]" strokeWidth={2} />
                    </div>
                  </div>
                  <h3 className="font-display text-xl text-gray-900 mb-1 tracking-wider">CHALLENGE SENT!</h3>
                  <p className="text-gray-600 text-sm mb-5">
                    {selectedUser.username} has been notified.
                  </p>

                  {/* Prize Pool card */}
                  <div className="max-w-[280px] mx-auto flex items-center justify-between bg-[#D4873A]/10 border border-[#D4873A]/25 rounded-xl px-4 py-3 mb-4">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Trophy className="w-4 h-4 text-[#D4873A]" />
                      <span className="font-semibold">Prize Pool</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <img src="/images/bogxcoin.png" alt="BOGX" className="w-4 h-4" />
                      <span className="font-display text-[#D4873A] font-bold">{(wager * 2).toFixed(2)} BOGX</span>
                    </div>
                  </div>

                  {/* What's next */}
                  <div className="max-w-[280px] mx-auto flex items-start gap-2.5 bg-cream border border-warm rounded-xl px-4 py-3 text-left mb-5">
                    <Mail className="w-4 h-4 text-[#D4873A] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold text-gray-700">What's next?</div>
                      <div className="text-xs text-gray-500">Your round starts now. Play your best!</div>
                    </div>
                  </div>

                  <button
                    onClick={() => onChallengeStarted(sentBattle)}
                    className="w-full max-w-[280px] mx-auto py-3.5 bg-[#D4873A] hover:bg-[#c57730] text-white font-display text-sm tracking-widest flex items-center justify-center gap-2 rounded-xl shadow-lg shadow-[#D4873A]/30 transition-colors"
                  >
                    READY? GO!
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}
