"use client";

import { useState, useEffect } from "react";
import { Search, Swords, X, ArrowRight, Wifi, Globe, BarChart3, Trophy, Check, Hash, Mail, Dumbbell, Music, Film, Landmark, Shirt, Gamepad2, Tv, Palette, UtensilsCrossed } from "lucide-react";
import BrandedModal from "../BrandedModal";
import type { LucideIcon } from "lucide-react";
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

type PlayerFilter = 'all' | 'online' | 'country' | 'level';

// BOGX wager amounts - 3 rounds for ≤0.75, 5 rounds for >0.75
const WAGERS = [
  { amount: 0.25, rounds: 3 },
  { amount: 0.50, rounds: 3 },
  { amount: 0.75, rounds: 3 },
  { amount: 1.00, rounds: 5 },
  { amount: 2.50, rounds: 5 },
  { amount: 5.00, rounds: 5 },
];

const TOPICS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'sport',   label: 'Sport',   icon: Dumbbell },
  { id: 'music',   label: 'Music',   icon: Music },
  { id: 'film',    label: 'Film',    icon: Film },
  { id: 'culture', label: 'Culture', icon: Landmark },
  { id: 'fashion', label: 'Fashion', icon: Shirt },
  { id: 'games',   label: 'Games',   icon: Gamepad2 },
  { id: 'tv',      label: 'TV',      icon: Tv },
  { id: 'art',     label: 'Art',     icon: Palette },
  { id: 'food',    label: 'Food',    icon: UtensilsCrossed },
];

const PLAYER_FILTERS: { id: PlayerFilter; label: string; icon: typeof Wifi }[] = [
  { id: 'all', label: 'All', icon: Globe },
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
  // Use currentUserId prop or fall back to auth context
  const myUserId = currentUserId || currentUser?.id;
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
  const [playerFilter, setPlayerFilter] = useState<PlayerFilter>('all');

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
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}&exclude=${myUserId || ''}`);
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
  }, [searchQuery, myUserId]);

  // Load online players when modal opens
  useEffect(() => {
    if (isOpen && step === 'search') {
      loadOnlinePlayers();
    }
  }, [isOpen, step]);

  const loadOnlinePlayers = async (filter: PlayerFilter = 'all') => {
    setLoadingOnline(true);
    try {
      const filterParam = filter === 'online' ? '&filter=online' : '';
      const res = await fetch(`/api/users/online?exclude=${myUserId || ''}&limit=20${filterParam}`);
      const data = await res.json();
      if (data.success) {
        setOnlinePlayers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to load players:', error);
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
      setPlayerFilter('all');
      setChecklistIndex(0);
      setSentBattle(null);
    }
  }, [isOpen]);

  // Apply the active filter to the players list
  const filteredPlayers = onlinePlayers.filter((u) => {
    // Don't show current user
    if (u._id === myUserId) return false;
    
    if (playerFilter === 'online') {
      return (u as any).isOnline === true;
    }
    if (playerFilter === 'country') {
      return currentUserCountry && u.country === currentUserCountry;
    }
    if (playerFilter === 'level') {
      const mine = currentUserPoints ?? 0;
      if (mine <= 0) return true;
      // "Same level" = within 40% of your points
      return Math.abs((u.points ?? 0) - mine) <= mine * 0.4;
    }
    return true; // all
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

  // The branded modal like every other dialog (colour band left, content right) - see BrandedModal
  const modal = (
    <BrandedModal
      isOpen
      onClose={onClose}
      locked={step === 'success'}
      size="lg"
      eyebrow="Challenge a player"
      title={step === 'search' ? 'Invite' : step === 'config' ? 'Setup battle' : step === 'confirm' ? 'Confirm' : 'Challenge sent'}
      icon={Swords}
    >
          {step !== 'search' && step !== 'success' && (
            <div className="-mt-1 mb-3"><BackButton onClick={handleBack} label={true} /></div>
          )}
          
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
                  className="w-full bg-cream border border-warm rounded-lg py-3 pl-10 pr-4 text-gray-900 placeholder:text-gray-600 focus:outline-none focus:border-[#E36B11]"
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
                        className="w-full flex items-center gap-3 p-3 hover:bg-[#E36B11]/5 transition-colors border border-warm hover:border-[#E36B11]/30 rounded-lg"
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E36B11] to-[#00D4F0] flex items-center justify-center text-white font-bold overflow-hidden">
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
                          <div className="flex items-center gap-1.5 text-gray-700 text-sm font-bold">
                            <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                            {(u.points ?? 0).toFixed(2)}
                          </div>
                        </div>
                        {(u as any).isOnline && <span className="w-2 h-2 bg-green-500 rounded-full" />}
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
                          onClick={() => {
                            setPlayerFilter(f.id);
                            if (f.id === 'online' || f.id === 'all') {
                              loadOnlinePlayers(f.id);
                            }
                          }}
                          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                            active
                              ? 'bg-[#E36B11] text-white border-[#E36B11]'
                              : 'bg-cream text-gray-600 border-warm hover:border-[#E36B11]/40'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {f.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-1 max-h-60 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#E36B11 #F5F0E8' }}>
                    {loadingOnline ? (
                      <div className="flex justify-center py-4">
                        <LogoLoader size="sm" />
                      </div>
                    ) : filteredPlayers.length > 0 ? (
                      filteredPlayers.map((u) => (
                        <button
                          key={u._id}
                          onClick={() => handleSelectUser(u)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-[#E36B11]/5 transition-colors border border-warm hover:border-[#E36B11]/30 rounded-lg"
                        >
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E36B11] to-[#00D4F0] flex items-center justify-center text-white font-bold overflow-hidden">
                              {u.avatar ? (
                                <img src={u.avatar} alt={u.username} className="w-full h-full object-cover" />
                              ) : (
                                u.username?.charAt(0).toUpperCase()
                              )}
                            </div>
                            {(u as any).isOnline && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />}
                          </div>
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-1.5">
                              <div className="text-gray-900 font-semibold">{u.username}</div>
                              {u.countryFlag && <CountryFlag flag={u.countryFlag} className="w-4 h-3 rounded-[2px]" />}
                            </div>
                            <div className="flex items-center gap-1.5 text-gray-700 text-sm font-bold">
                              <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                              {(u.points ?? 0).toFixed(2)}
                            </div>
                          </div>
                          <Swords className="w-4 h-4 text-gray-600" />
                        </button>
                      ))
                    ) : (
                      <div className="text-center text-gray-600 py-6 text-sm">
                        {playerFilter === 'country'
                          ? 'No players from your country found'
                          : playerFilter === 'level'
                            ? 'No players at your level found'
                            : playerFilter === 'online'
                              ? 'No players online right now'
                              : 'No players found'}
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
                <div className="flex items-center gap-4 mb-5 bg-gradient-to-r from-[#E36B11]/10 to-transparent border border-[#E36B11]/20 rounded-xl p-4">
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#E36B11]">
                      {currentUser?.avatar
                        ? <img src={currentUser.avatar} alt={currentUser.username} className="w-full h-full object-cover" />
                        : <div className="w-full h-full bg-[#E36B11] flex items-center justify-center text-white font-bold text-lg">{currentUser?.username?.charAt(0).toUpperCase() || 'Y'}</div>
                      }
                    </div>
                    <div className="text-xs font-bold text-gray-900 mt-1 max-w-[80px] truncate text-center">You</div>
                    <div className="flex items-center gap-1 text-[10px] text-gray-500">
                      <img src="/images/bogxcoin.png" alt="" className="w-3 h-3" />
                      {(currentUserPoints || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <span className="font-display text-3xl text-[#E36B11] tracking-wider">VS</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-gray-300">
                      {selectedUser.avatar
                        ? <img src={selectedUser.avatar} alt={selectedUser.username} className="w-full h-full object-cover" />
                        : <div className="w-full h-full bg-[#E36B11] flex items-center justify-center text-white font-bold text-lg">{selectedUser.username?.charAt(0).toUpperCase()}</div>
                      }
                    </div>
                    <div className="text-xs font-bold text-gray-900 mt-1 max-w-[80px] truncate text-center">{selectedUser.username}</div>
                    <div className="flex items-center gap-1 text-[10px] text-gray-500">
                      <img src="/images/bogxcoin.png" alt="" className="w-3 h-3" />
                      {(selectedUser.points ?? 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Topic Selection - Step 1 */}
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-5 h-5 bg-[#E36B11] text-white text-[10px] font-bold flex items-center justify-center rounded">1</span>
                  <span className="text-xs font-bold tracking-widest text-[#E36B11] uppercase">Choose Topic</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 mb-4">
                  {TOPICS.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTopic(t.id)}
                      className={`flex items-center justify-center gap-1.5 px-2 py-2 text-sm font-semibold transition-all rounded-xl border-2 ${
                        topic === t.id
                          ? 'bg-[#E36B11] border-[#E36B11] text-white shadow-md shadow-[#E36B11]/30'
                          : 'bg-cream border-warm text-gray-700 hover:border-[#E36B11]/40'
                      }`}
                    >
                      <t.icon className="w-4 h-4" />
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* RIGHT COLUMN: Wager - Step 2 */}
              <div className="lg:w-1/2 lg:pl-6 flex flex-col">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-5 h-5 bg-[#E36B11] text-white text-[10px] font-bold flex items-center justify-center rounded">2</span>
                  <span className="text-xs font-bold tracking-widest text-[#E36B11] uppercase">Choose Wager</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {WAGERS.map(w => (
                    <button
                      key={w.amount}
                      onClick={() => setWager(w.amount)}
                      className={`py-3 text-center transition-all rounded-xl border-2 ${
                        wager === w.amount
                          ? 'bg-[#E36B11] border-[#E36B11] text-white shadow-md shadow-[#E36B11]/30'
                          : 'bg-cream border-warm text-gray-700 hover:border-[#E36B11]/40'
                      }`}
                    >
                      <div className="font-display text-sm font-bold">{w.amount.toFixed(2)}</div>
                      <div className="text-[9px] opacity-60">{w.rounds}R</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Prize Info + START BATTLE – full width below both columns */}
            <div className="border-t border-warm mt-5 pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Trophy className="w-4 h-4 text-[#E36B11]" />
                  <div>
                    <div className="font-semibold text-gray-700">Winner takes all</div>
                    <div>The winner gets the total pot.</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Estimated Prize</div>
                  <div className="flex items-center gap-1 justify-end">
                    <img src="/images/bogxcoin.png" alt="BOGX" className="w-4 h-4" />
                    <span className="font-bold text-[#E36B11]">{(wager * 2).toFixed(2)} coins</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleConfirm}
                className="w-full py-3.5 bg-[#E36B11] hover:bg-[#c57730] text-white font-display text-sm tracking-widest flex items-center justify-center gap-2 rounded-xl shadow-lg shadow-[#E36B11]/30 transition-colors"
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
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#E36B11] to-[#00D4F0] flex items-center justify-center text-white font-bold text-3xl mb-3 overflow-hidden">
                  {selectedUser.avatar ? (
                    <img src={selectedUser.avatar} alt={selectedUser.username} className="w-full h-full object-cover" />
                  ) : (
                    selectedUser.username?.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="text-gray-900 font-semibold text-xl">{selectedUser.username}</div>
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                  <img src="/images/bogxcoin.png" alt="" className="w-3.5 h-3.5" />
                  {(selectedUser.points ?? 0).toFixed(2)} coins
                </div>
              </div>

              {/* Battle Details */}
              <div className="bg-cream border border-warm rounded-xl mb-4 text-left divide-y divide-warm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5 text-gray-500">
                    <span className="w-7 h-7 rounded-lg bg-[#E36B11]/10 flex items-center justify-center">
                      <selectedTopic.icon className="w-4 h-4 text-[#E36B11]" />
                    </span>
                    <span>Topic</span>
                  </div>
                  <span className="text-gray-900 font-semibold">{selectedTopic.label}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5 text-gray-500">
                    <span className="w-7 h-7 rounded-lg bg-[#E36B11]/10 flex items-center justify-center">
                      <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                    </span>
                    <span>Wager</span>
                  </div>
                  <span className="text-gray-900 font-semibold">{wager.toFixed(2)} BOGX</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5 text-gray-500">
                    <span className="w-7 h-7 rounded-lg bg-[#E36B11]/10 flex items-center justify-center">
                      <Hash className="w-3.5 h-3.5 text-[#E36B11]" />
                    </span>
                    <span>Rounds</span>
                  </div>
                  <span className="text-gray-900 font-semibold">Best of {rounds}</span>
                </div>
              </div>

              {/* Prize Pool - highlighted, separate from the plain detail rows */}
              <div className="flex items-center justify-between bg-[#E36B11]/10 border border-[#E36B11]/25 rounded-xl px-4 py-3 mb-6">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Trophy className="w-4 h-4 text-[#E36B11]" />
                  <span className="font-semibold">Prize Pool</span>
                  <span className="text-gray-400">· Winner takes all</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <img src="/images/bogxcoin.png" alt="BOGX" className="w-4 h-4" />
                  <span className="font-display text-[#E36B11] font-bold">{(wager * 2).toFixed(2)} BOGX</span>
                </div>
              </div>

              <p className="text-gray-600 text-xs mb-6">
                You'll play your round first. {selectedUser.username} will be notified and has 48h to accept.
              </p>

              {/* Send Button - clicking hands off to the dedicated sending screen, no spinner needed here */}
              <button
                onClick={handleSend}
                className="w-full py-4 bg-[#E36B11] text-white font-display text-base tracking-widest flex items-center justify-center gap-2 rounded-xl"
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
                    <div className="absolute inset-0 rounded-full bg-[#E36B11]/10 animate-pulse" />
                    {[0, 45, 90, 135].map((deg) => (
                      <div
                        key={deg}
                        className="absolute inset-0"
                        style={{ transform: `rotate(${deg}deg)` }}
                      >
                        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-0.5 h-3 bg-[#E36B11]/30 rounded-full" />
                        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-0.5 h-3 bg-[#E36B11]/30 rounded-full" />
                      </div>
                    ))}
                    <div className="relative w-16 h-16 rounded-full bg-[#E36B11] flex items-center justify-center shadow-lg shadow-[#E36B11]/40">
                      <Swords className="w-7 h-7 text-white" />
                    </div>
                  </div>

                  <h3 className="font-display text-lg text-gray-900 mb-1 tracking-wider">SENDING CHALLENGE...</h3>
                  <p className="text-gray-500 text-xs mb-5">We're setting everything up. Sit tight!</p>

                  {/* Progress bar tied to checklist progress */}
                  <div className="max-w-[260px] mx-auto h-1.5 bg-black/10 rounded-full overflow-hidden mb-6">
                    <div
                      className="h-full bg-[#E36B11] rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${Math.min(100, (checklistIndex / 3) * 90 + 10)}%` }}
                    />
                  </div>

                  <div className="max-w-[240px] mx-auto space-y-3 text-left">
                    {['Creating battle', 'Locking wager', `Notifying ${selectedUser.username}`].map((label, i) => (
                      <div key={label} className="flex items-center gap-2.5">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
                          checklistIndex > i ? 'bg-[#E36B11]' : 'bg-black/10'
                        }`}>
                          {checklistIndex > i ? (
                            <Check className="w-3 h-3 text-white" />
                          ) : checklistIndex === i ? (
                            <div className="w-2.5 h-2.5 border-2 border-[#E36B11] border-t-transparent rounded-full animate-spin" />
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
                    <span className="absolute -top-2 left-2 w-1.5 h-1.5 rounded-full bg-[#E36B11]/60" />
                    <span className="absolute top-1/2 -right-4 w-2 h-2 rounded-full bg-green-400/60" />
                    <span className="absolute -bottom-0.5 -left-1 w-2 h-2 rounded-full bg-[#E36B11]/40" />
                    <span className="absolute -bottom-1 right-0 w-1.5 h-1.5 rounded-full bg-[#E36B11]/30" />
                    <div className="w-20 h-20 rounded-full bg-[#E36B11]/10 border-2 border-[#E36B11]/25 flex items-center justify-center">
                      <Check className="w-10 h-10 text-[#E36B11]" strokeWidth={2} />
                    </div>
                  </div>
                  <h3 className="font-display text-xl text-gray-900 mb-1 tracking-wider">CHALLENGE SENT!</h3>
                  <p className="text-gray-600 text-sm mb-5">
                    {selectedUser.username} has been notified.
                  </p>

                  {/* Prize Pool card */}
                  <div className="max-w-[280px] mx-auto flex items-center justify-between bg-[#E36B11]/10 border border-[#E36B11]/25 rounded-xl px-4 py-3 mb-4">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Trophy className="w-4 h-4 text-[#E36B11]" />
                      <span className="font-semibold">Prize Pool</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <img src="/images/bogxcoin.png" alt="BOGX" className="w-4 h-4" />
                      <span className="font-display text-[#E36B11] font-bold">{(wager * 2).toFixed(2)} BOGX</span>
                    </div>
                  </div>

                  {/* What's next */}
                  <div className="max-w-[280px] mx-auto flex items-start gap-2.5 bg-cream border border-warm rounded-xl px-4 py-3 text-left mb-5">
                    <Mail className="w-4 h-4 text-[#E36B11] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold text-gray-700">What's next?</div>
                      <div className="text-xs text-gray-500">Your round starts now. Play your best!</div>
                    </div>
                  </div>

                  <button
                    onClick={() => onChallengeStarted(sentBattle)}
                    className="w-full max-w-[280px] mx-auto py-3.5 bg-[#E36B11] hover:bg-[#c57730] text-white font-display text-sm tracking-widest flex items-center justify-center gap-2 rounded-xl shadow-lg shadow-[#E36B11]/30 transition-colors"
                  >
                    READY? GO!
                  </button>
                </div>
              )}
            </div>
          )}
    </BrandedModal>
  );

  return modal;
}
