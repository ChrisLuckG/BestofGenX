"use client";

import { useState, useEffect } from "react";
import { Search, ChevronLeft, Swords, X, ArrowRight, Wifi, Globe, BarChart3 } from "lucide-react";
import LogoLoader from "../LogoLoader";

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

const TOPICS = [
  { id: 'sport', label: 'Sport' },
  { id: 'music', label: 'Music' },
  { id: 'film', label: 'Film' },
  { id: 'culture', label: 'Culture' },
  { id: 'fashion', label: 'Fashion' },
  { id: 'games', label: 'Games' },
  { id: 'tv', label: 'TV' },
  { id: 'art', label: 'Art' },
  { id: 'food', label: 'Food' },
];

const PLAYER_FILTERS: { id: PlayerFilter; label: string; icon: typeof Wifi }[] = [
  { id: 'online', label: 'Online', icon: Wifi },
  { id: 'country', label: 'Country', icon: Globe },
  { id: 'level', label: 'Same Level', icon: BarChart3 },
];

interface InviteFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendChallenge: (user: User, wager: number, topic: string) => void;
  currentUserId?: string;
  currentUserCountry?: string;
  currentUserPoints?: number;
  isGenerating: boolean;
}

type Step = 'search' | 'config' | 'confirm';

export default function InviteFlowModal({ 
  isOpen, 
  onClose, 
  onSendChallenge, 
  currentUserId,
  currentUserCountry,
  currentUserPoints,
  isGenerating 
}: InviteFlowModalProps) {
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

  const handleSend = () => {
    if (selectedUser) {
      onSendChallenge(selectedUser, wager, topic);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-cream border border-warm rounded-2xl w-full max-w-[340px] max-h-[85vh] overflow-hidden flex flex-col shadow-xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-warm">
          {step !== 'search' ? (
            <button onClick={handleBack} className="flex items-center gap-1 text-gray-500 hover:text-gray-900">
              <ChevronLeft className="w-4 h-4" />
              <span className="text-sm">Back</span>
            </button>
          ) : (
            <div />
          )}
          <span className="font-display text-lg tracking-wider text-gray-900 flex items-center gap-2">
            {step === 'search' && <Swords className="w-5 h-5 text-[#D4873A]" />}
            {step === 'search' ? 'INVITE' : step === 'config' ? 'SETUP BATTLE' : 'CONFIRM'}
          </span>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 hover:bg-black/5 hover:text-gray-900 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          
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
                  autoFocus
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
                          <div className="text-gray-900 font-semibold">{u.username}</div>
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
                            <div className="text-gray-900 font-semibold">{u.username}</div>
                            <div className="text-gray-600 text-xs">
                              {(u.points || 0).toFixed(2)} coins{u.country ? ` · ${u.country}` : ''}
                            </div>
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
              {/* Selected User */}
              <div className="flex items-center gap-3 p-3 bg-cream border border-warm rounded-lg mb-6">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4873A] to-[#00D4F0] flex items-center justify-center text-white font-bold overflow-hidden">
                  {selectedUser.avatar ? (
                    <img src={selectedUser.avatar} alt={selectedUser.username} className="w-full h-full object-cover" />
                  ) : (
                    selectedUser.username?.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-gray-900 font-semibold">{selectedUser.username}</div>
                  <div className="text-gray-600 text-xs">{(selectedUser.points || 0).toFixed(2)} coins</div>
                </div>
                <span className="text-gray-500 text-sm">Opponent</span>
              </div>

              {/* Wager Selection */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 bg-[#D4873A] text-white text-xs font-bold flex items-center justify-center rounded">1</span>
                  <span className="text-sm font-semibold tracking-wider text-[#D4873A] uppercase">Choose Wager</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {WAGERS.map(w => (
                    <button
                      key={w.amount}
                      onClick={() => setWager(w.amount)}
                      className={`py-3 text-center transition-colors rounded-lg ${
                        wager === w.amount
                          ? 'bg-[#D4873A] text-white'
                          : 'bg-cream border border-warm text-gray-600'
                      }`}
                    >
                      <div className="font-display text-lg">P{w.amount.toFixed(2)}</div>
                      <div className="text-[9px] text-current opacity-60">{w.rounds}R</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Topic Selection */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 bg-[#D4873A] text-white text-xs font-bold flex items-center justify-center rounded">2</span>
                  <span className="text-sm font-semibold tracking-wider text-[#D4873A] uppercase">Choose Topic</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {TOPICS.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTopic(t.id)}
                      className={`py-3 text-sm font-semibold tracking-wider transition-colors rounded-lg ${
                        topic === t.id
                          ? 'bg-[#D4873A] text-white'
                          : 'bg-cream border border-warm text-gray-600'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Continue Button */}
              <button
                onClick={handleConfirm}
                className="w-full py-4 bg-[#D4873A] text-white font-display text-base tracking-widest flex items-center justify-center gap-2 rounded-xl"
              >
                CONTINUE
              </button>
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
              </div>

              {/* Battle Details */}
              <div className="bg-cream border border-warm rounded-lg p-4 mb-6 text-left">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">Topic:</span>
                  <span className="text-gray-900 font-semibold">{selectedTopic.label}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">Wager:</span>
                  <span className="text-gray-900 font-bold">{wager.toFixed(2)} BOGX</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Rounds:</span>
                  <span className="text-gray-900 font-semibold">{rounds}</span>
                </div>
              </div>

              <p className="text-gray-600 text-sm mb-6">
                You'll play your round first. {selectedUser.username} will receive a notification to accept.
              </p>

              {/* Send Button */}
              <button
                onClick={handleSend}
                disabled={isGenerating}
                className={`w-full py-4 font-display text-base tracking-widest flex items-center justify-center gap-2 rounded-xl ${
                  isGenerating 
                    ? 'bg-[#D4873A]/50 text-white/50 cursor-wait' 
                    : 'bg-[#D4873A] text-white'
                }`}
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    SENDING...
                  </>
                ) : (
                  <>
                    <Swords className="w-5 h-5" />
                    SEND CHALLENGE
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
