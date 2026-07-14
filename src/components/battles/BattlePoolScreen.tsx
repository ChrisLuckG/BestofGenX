"use client";

import { useRef } from "react";
import { Swords, Plus, ChevronLeft, ChevronRight, LayoutGrid, Lock, Clock } from "lucide-react";
import BackButton from "@/components/BackButton";
import CountryFlag from "@/components/CountryFlag";
import { formatCurrency, getCurrencySymbol } from "@/utils/currency";
import { Battle, TOPICS, WAGERS, getTopicConfig, toBOGX } from "./types";

interface BattlePoolScreenProps {
  battles: Battle[];
  loading: boolean;
  isOnBreak: boolean;
  isLoggedIn: boolean;
  user?: { id?: string; avatar?: string };
  topicFilter: string;
  wagerFilter: string | number;
  showCreate: boolean;
  createWager: number;
  createTopic: string;
  isGenerating: boolean;
  onBack?: () => void;
  onTopicFilterChange: (topic: string) => void;
  onWagerFilterChange: (wager: string | number) => void;
  onShowCreate: (show: boolean) => void;
  onCreateWagerChange: (wager: number) => void;
  onCreateTopicChange: (topic: string) => void;
  onCreateBattle: (isPrivate: boolean) => void;
  onShowChallengeModal: () => void;
  onSelectBattle: (battle: Battle) => void;
  onSelectOwnBattle: (battle: Battle) => void;
  onRefresh: () => void;
  onShowLogin?: () => void;
  showAlert: (type: string, message: string, options?: any) => void;
}

export default function BattlePoolScreen({
  battles,
  loading,
  isOnBreak,
  isLoggedIn,
  user,
  topicFilter,
  wagerFilter,
  showCreate,
  createWager,
  createTopic,
  isGenerating,
  onBack,
  onTopicFilterChange,
  onWagerFilterChange,
  onShowCreate,
  onCreateWagerChange,
  onCreateTopicChange,
  onCreateBattle,
  onShowChallengeModal,
  onSelectBattle,
  onSelectOwnBattle,
  onRefresh,
  onShowLogin,
  showAlert,
}: BattlePoolScreenProps) {
  const topicScrollRef = useRef<HTMLDivElement>(null);

  // Filter battles
  const filteredBattles = battles.filter(b => {
    if (topicFilter !== 'all' && b.topic !== topicFilter) return false;
    if (wagerFilter !== 'all' && toBOGX(b.wager) !== wagerFilter) return false;
    return true;
  });

  return (
    <div className="relative flex flex-col h-full min-h-full" style={{ backgroundColor: '#F5F0E8' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-4 pb-3 border-b border-warm">
        <div className="flex items-center gap-2">
          {onBack && <BackButton onClick={onBack} className="-ml-1" />}
          <img src="/images/Icon/trivia1.png" alt="" className="w-5 h-5 object-contain" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900">QuizzBattle</span>
            <p className="text-[10px] text-gray-900 -mt-0.5 whitespace-nowrap">Challenge others, win coins.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => {
              if (isOnBreak) {
                showAlert('info', 'Battles are disabled during the break (9:00-10:00).');
                return;
              }
              if (!isLoggedIn) {
                showAlert('login', 'Please login to invite friends!', { buttonText: 'LOGIN', onButtonClick: onShowLogin });
                return;
              }
              onShowChallengeModal();
            }}
            disabled={isOnBreak}
            className={`flex flex-col items-center px-2 py-1.5 border rounded-lg text-[10px] font-semibold tracking-wider transition-colors ${
              isOnBreak ? 'border-warm text-gray-300 cursor-not-allowed' : 'border-gray-300 text-gray-600 hover:border-[#A855F7] hover:text-[#A855F7]'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>INVITE</span>
          </button>
          <button
            onClick={() => {
              if (isOnBreak) {
                showAlert('info', 'Battles are disabled during the break (9:00-10:00).');
                return;
              }
              if (!isLoggedIn) {
                showAlert('login', 'Please login to create battles!', { buttonText: 'LOGIN', onButtonClick: onShowLogin });
                return;
              }
              onShowCreate(!showCreate);
            }}
            disabled={isOnBreak}
            className={`flex flex-col items-center px-2 py-1.5 rounded-lg text-[10px] font-semibold tracking-wider transition-colors ${
              isOnBreak ? 'bg-skeleton-light text-gray-600 cursor-not-allowed' : 'bg-[#A855F7] text-white hover:bg-[#c06a2a]'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>CREATE</span>
          </button>
        </div>
      </div>

      {/* Topic Filter */}
      <div className="flex items-center gap-1 px-2 py-3 border-b border-warm">
        <button
          onClick={() => topicScrollRef.current?.scrollBy({ left: -150, behavior: 'smooth' })}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-500 hover:border-[#A855F7] hover:text-[#A855F7] transition-colors shadow-sm"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div ref={topicScrollRef} className="flex gap-2 overflow-x-auto flex-1" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => onTopicFilterChange('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all border ${
              topicFilter === 'all' ? 'bg-[#A855F7] text-white border-[#A855F7]' : 'bg-cream text-gray-700 hover:bg-[#A855F7]/10 border-warm'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="text-xs font-semibold">All</span>
          </button>
          {TOPICS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => onTopicFilterChange(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all border ${
                  topicFilter === t.id ? 'bg-[#A855F7] text-white border-[#A855F7]' : 'bg-cream text-gray-700 hover:bg-[#A855F7]/10 border-warm'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs font-semibold">{t.label}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => topicScrollRef.current?.scrollBy({ left: 150, behavior: 'smooth' })}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-500 hover:border-[#A855F7] hover:text-[#A855F7] transition-colors shadow-sm"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Wager Filter */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-warm overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <button
          onClick={() => onWagerFilterChange('all')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl whitespace-nowrap transition-all border flex-shrink-0 ${
            wagerFilter === 'all' ? 'bg-[#A855F7] text-white border-[#A855F7]' : 'bg-cream text-gray-700 hover:bg-[#A855F7]/10 border-warm'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold">All Wagers</span>
        </button>
        {WAGERS.map(w => (
          <button
            key={w.amount}
            onClick={() => onWagerFilterChange(w.amount)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl whitespace-nowrap transition-all border flex-shrink-0 ${
              wagerFilter === w.amount ? 'bg-[#A855F7] text-white border-[#A855F7]' : 'bg-cream text-gray-700 hover:bg-[#A855F7]/10 border-warm'
            }`}
          >
            <img src="/images/bogxcoin.png" alt="" className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">{formatCurrency(w.amount)}</span>
          </button>
        ))}
      </div>

      {/* Create Battle Fullscreen */}
      {showCreate && (
        <div className="absolute inset-0 z-[100] overflow-y-auto" style={{ backgroundColor: '#F5F0E8', scrollbarWidth: 'none' }}>
          <div className="sticky top-0 z-10 flex items-center justify-between px-3 pt-4 pb-3 border-b border-warm bg-[#F5F0E8]">
            <div className="flex items-center gap-2">
              <BackButton onClick={() => onShowCreate(false)} className="-ml-1" />
              <img src="/images/Icon/trivia1.png" alt="" className="w-5 h-5 object-contain" />
              <div>
                <span className="font-display text-lg tracking-wider text-gray-900">Create Battle</span>
                <p className="text-[10px] text-gray-500 -mt-0.5 whitespace-nowrap">Set wager and topic.</p>
              </div>
            </div>
          </div>
          <div className="p-4">
            {/* Step 1: Wager */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 bg-[#A855F7] rounded text-white text-xs font-bold flex items-center justify-center">1</span>
                <span className="text-sm font-semibold tracking-wider text-[#A855F7] uppercase">Choose Wager</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {WAGERS.map(w => (
                  <button
                    key={w.amount}
                    onClick={() => onCreateWagerChange(w.amount)}
                    className={`py-3 text-center rounded-xl transition-colors ${
                      createWager === w.amount ? 'bg-[#A855F7] text-white' : 'bg-cream border border-warm text-gray-600'
                    }`}
                  >
                    <div className="font-display text-lg">{formatCurrency(w.amount)}{getCurrencySymbol()}</div>
                    <div className="text-[9px] text-current opacity-60">{w.rounds}R</div>
                  </button>
                ))}
              </div>
            </div>
            {/* Step 2: Topic */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 bg-[#A855F7] rounded text-white text-xs font-bold flex items-center justify-center">2</span>
                <span className="text-sm font-semibold tracking-wider text-[#A855F7] uppercase">Choose Topic</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {TOPICS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => onCreateTopicChange(t.id)}
                    className={`py-3 text-sm font-semibold tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2 ${
                      createTopic === t.id ? 'bg-[#A855F7] text-white' : 'bg-cream border border-warm text-gray-600'
                    }`}
                  >
                    <t.icon className="w-4 h-4" /> {t.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Step 3: Start */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 bg-[#A855F7] rounded text-white text-xs font-bold flex items-center justify-center">3</span>
                <span className="text-sm font-semibold tracking-wider text-[#A855F7] uppercase">Start Battle</span>
              </div>
              <button
                onClick={() => onCreateBattle(false)}
                disabled={isGenerating}
                className={`w-full py-4 rounded-xl font-display text-base tracking-widest flex items-center justify-center gap-2 ${
                  isGenerating ? 'bg-[#A855F7]/50 text-white/50 cursor-wait' : 'bg-[#A855F7] text-white'
                }`}
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    GENERATING...
                  </>
                ) : (
                  <>
                    <Swords className="w-5 h-5" />
                    OPEN BATTLE
                  </>
                )}
              </button>
              <p className="text-center text-gray-600 text-xs mt-2">Anyone can accept your challenge</p>
            </div>
          </div>
        </div>
      )}

      {/* Battle List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2" style={{ scrollbarWidth: 'none' }}>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 bg-cream border border-warm rounded-xl animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-skeleton" />
                  <div className="flex-1">
                    <div className="w-24 h-4 bg-skeleton rounded mb-1" />
                    <div className="w-16 h-3 bg-skeleton-light rounded" />
                  </div>
                  <div className="w-16 h-6 bg-skeleton rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : isOnBreak ? (
          <div className="flex flex-col items-center justify-center h-full px-4">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-10 h-10 text-[#A855F7]" />
              <div>
                <p className="font-display text-xl tracking-wider text-[#A855F7]">DAILY BREAK</p>
                <p className="text-gray-500 text-xs">9:00 - 10:00 AM</p>
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-4">Relax! We're preparing the next round.</p>
            <div className="flex items-center gap-2 text-[#A855F7] text-sm animate-pulse">
              <span>⚡</span>
              <span>Back at 10:00 AM</span>
            </div>
          </div>
        ) : filteredBattles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <Swords className="w-16 h-16 text-gray-200 mb-4" />
            <p className="text-gray-500 text-lg font-semibold mb-2">No open battles</p>
            <p className="text-gray-600 text-sm text-center mb-6">Be the first to create a challenge!</p>
            <div className="flex gap-2">
              <button onClick={onRefresh} className="px-3 py-2 bg-cream border border-warm text-gray-600 text-sm font-semibold hover:bg-skeleton-light transition-colors flex items-center gap-2 rounded-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={() => {
                  if (!isLoggedIn) {
                    showAlert('login', 'Please login to invite friends!', { buttonText: 'LOGIN', onButtonClick: onShowLogin });
                    return;
                  }
                  onShowChallengeModal();
                }}
                className="px-3 py-2 border border-gray-300 text-gray-700 text-sm font-semibold hover:border-[#A855F7] hover:text-[#A855F7] transition-colors rounded-lg"
              >
                ⚔️ Invite
              </button>
              <button
                onClick={() => {
                  if (!isLoggedIn) {
                    showAlert('login', 'Please login to create battles!', { buttonText: 'LOGIN', onButtonClick: onShowLogin });
                    return;
                  }
                  onShowCreate(true);
                }}
                className="px-3 py-2 bg-[#A855F7] text-white text-sm font-semibold hover:bg-[#c5e000] transition-colors flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Create
              </button>
            </div>
          </div>
        ) : (
          filteredBattles.map((battle: Battle) => {
            const topic = getTopicConfig(battle.topic);
            const isMyBattle = battle.creator._id === user?.id;
            const creatorRank = (battle.creator as any).rank || '-';
            
            return (
              <div
                key={battle._id}
                onClick={() => isMyBattle ? onSelectOwnBattle(battle) : onSelectBattle(battle)}
                className={`p-4 border-2 rounded-2xl transition-all cursor-pointer ${
                  isMyBattle 
                    ? 'border-[#A855F7]/40 bg-[#A855F7]/5 hover:bg-[#A855F7]/10' 
                    : 'border-warm bg-cream hover:border-[#A855F7]/30 hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#A855F7]/30">
                      <img src={battle.creator.avatar} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-cream" />
                    <div className="absolute -bottom-1 -left-1">
                      <CountryFlag flag={battle.creator.countryFlag} className="w-5 h-4 rounded-sm shadow-sm" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xl font-display text-gray-900 leading-tight tracking-wide">{battle.creator.username}</div>
                    <div className="text-[11px] text-gray-500 leading-tight">Rank #{creatorRank}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span 
                        className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded flex items-center gap-1 text-white"
                        style={{ backgroundColor: topic.color }}
                      >
                        {topic.icon && <topic.icon className="w-2.5 h-2.5" />}
                        {topic.label}
                      </span>
                      <span className="text-[10px] text-gray-400">· {battle.rounds} Rounds · Sealed</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="font-display text-xl text-[#A855F7]">{formatCurrency(toBOGX(battle.wager))}</span>
                    <img src="/images/bogxcoin.png" alt="BOGX" className="w-5 h-5" />
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                  </div>
                </div>
                {isMyBattle && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#A855F7]/20">
                    {battle.isPrivate && (
                      <span className="text-[10px] font-bold tracking-wider text-purple-600 bg-purple-100 px-2 py-1 rounded-lg flex items-center gap-1">
                        <Lock className="w-3 h-3" /> PRIVATE
                      </span>
                    )}
                    <span className="text-[10px] font-bold tracking-wider text-[#A855F7] bg-[#A855F7]/10 px-2 py-1 rounded-lg">
                      YOUR BATTLE
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
