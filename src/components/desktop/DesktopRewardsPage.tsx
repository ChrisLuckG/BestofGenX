"use client";

import { useState, useEffect } from "react";
import { Gift, Trophy, Tv, Ticket, Gamepad2, Star, Plane, Car, Shirt, Monitor, Sparkles, Play, ChevronRight, Zap } from "lucide-react";
import RewardDetailPage from "@/components/RewardDetailPage";
import RewardedAdButton from "@/components/RewardedAdButton";
import { RewardsSkeleton } from "./DesktopSkeletons";
import { formatCurrency } from "@/utils/currency";

interface DesktopRewardsPageProps {
  coins: number;
  onClose: () => void;
  onRedeem: (rewardId: string, cost: number) => void;
}

interface RewardData {
  _id: string;
  name: string;
  description: string;
  longDescription?: string;
  cost: number;
  partner: string;
  icon: string;
  category: 'premium' | 'standard' | 'starter';
  image?: string;
  howToRedeem?: string;
  terms?: string;
  active: boolean;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Gift, Trophy, Tv, Ticket, Gamepad2, Star, Plane, Car, Shirt, Monitor
};

export default function DesktopRewardsPage({ coins, onClose, onRedeem }: DesktopRewardsPageProps) {
  const [dbRewards, setDbRewards] = useState<RewardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReward, setSelectedReward] = useState<RewardData | null>(null);

  useEffect(() => {
    const fetchRewards = async () => {
      try {
        const res = await fetch('/api/rewards');
        const data = await res.json();
        if (data.success) {
          setDbRewards(data.rewards.filter((r: RewardData) => r.active));
        }
      } catch (e) {
        console.error('Failed to fetch rewards:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchRewards();
  }, []);

  const displayRewards = dbRewards;
  const premiumRewards = displayRewards.filter(r => r.category === 'premium');
  const otherRewards = displayRewards.filter(r => r.category !== 'premium');

  if (selectedReward) {
    return (
      <RewardDetailPage
        isOpen={true}
        reward={selectedReward}
        coins={coins}
        onClose={() => setSelectedReward(null)}
        onRedeem={onRedeem}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#F5F0E8] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-[#F5F0E8]">
        <button 
          onClick={onClose}
          className="flex items-center gap-2 text-gray-600 hover:text-[#E36B11] transition-colors"
        >
          <Trophy className="w-5 h-5" />
          <span className="font-display text-lg tracking-wider">Ranking</span>
        </button>
        <div className="flex items-center gap-3">
          <Gift className="w-5 h-5 text-[#E36B11]" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">Rewards</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">Redeem your BOGX coins</span>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#E36B11] via-[#FF8C42] to-[#FFB366]">
          {/* Decorative elements */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-4 left-8 w-20 h-20 rounded-full bg-white/30 blur-xl" />
            <div className="absolute bottom-4 right-12 w-32 h-32 rounded-full bg-white/20 blur-2xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-white/10 blur-3xl" />
          </div>
          
          {/* Floating coins decoration */}
          <div className="absolute top-6 right-6 opacity-20">
            <img src="/images/bogxcoin.png" alt="" className="w-12 h-12 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '3s' }} />
          </div>
          <div className="absolute bottom-8 left-6 opacity-15">
            <img src="/images/bogxcoin.png" alt="" className="w-8 h-8 animate-bounce" style={{ animationDelay: '500ms', animationDuration: '2.5s' }} />
          </div>
          
          <div className="relative px-6 py-8">
            {/* Balance Card */}
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-5 border border-white/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-xs uppercase tracking-wider font-medium">Your Balance</p>
                  <div className="flex items-center gap-2 mt-1">
                    <img src="/images/bogxcoin.png" alt="" className="w-8 h-8" />
                    <span className="font-display text-4xl text-white tracking-tight">{formatCurrency(coins)}</span>
                  </div>
                  <p className="text-white/60 text-xs mt-1">BOGX Coins</p>
                </div>
                <div className="text-right">
                  <Sparkles className="w-10 h-10 text-white/40" />
                </div>
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <Gift className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-white/60 text-[10px] uppercase">Available</p>
                    <p className="text-white font-bold">{displayRewards.length} Rewards</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-white/60 text-[10px] uppercase">Can Afford</p>
                    <p className="text-white font-bold">{displayRewards.filter(r => coins >= r.cost).length} Items</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Earn Free BOGX Section */}
        <div className="px-4 py-4">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <Play className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Watch & Earn</h3>
                  <p className="text-white/80 text-xs">Watch a short video for free BOGX</p>
                </div>
              </div>
              <RewardedAdButton 
                onReward={(points: number) => onRedeem(`ad-reward-${Date.now()}`, -points)}
              />
            </div>
          </div>
        </div>

        {/* Premium Rewards */}
        {premiumRewards.length > 0 && (
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-amber-500" />
              <h2 className="font-display text-sm uppercase tracking-wider text-gray-900">Premium Rewards</h2>
            </div>
            <div className="space-y-3">
              {premiumRewards.map((reward) => {
                const IconComponent = iconMap[reward.icon] || Gift;
                const canAfford = coins >= reward.cost;
                
                return (
                  <button
                    key={reward._id}
                    onClick={() => setSelectedReward(reward)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                      canAfford 
                        ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 hover:border-amber-400 hover:shadow-lg' 
                        : 'bg-gray-50 border-gray-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                        <IconComponent className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900">{reward.name}</h4>
                        <p className="text-xs text-gray-500 line-clamp-1">{reward.description}</p>
                        <p className="text-[10px] text-amber-600 font-medium mt-0.5">{reward.partner}</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          <img src="/images/bogxcoin.png" alt="" className="w-5 h-5" />
                          <span className={`font-display text-xl ${canAfford ? 'text-amber-600' : 'text-gray-400'}`}>
                            {formatCurrency(reward.cost)}
                          </span>
                        </div>
                        {!canAfford && (
                          <p className="text-[10px] text-red-400 mt-0.5">{formatCurrency(reward.cost - coins)} more</p>
                        )}
                        <ChevronRight className={`w-4 h-4 mt-1 ml-auto ${canAfford ? 'text-amber-400' : 'text-gray-300'}`} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* All Rewards */}
        <div className="px-4 pb-8">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="w-4 h-4 text-[#E36B11]" />
            <h2 className="font-display text-sm uppercase tracking-wider text-gray-900">All Rewards</h2>
          </div>
          
          {loading ? (
            <RewardsSkeleton />
          ) : otherRewards.length === 0 && premiumRewards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-cream rounded-2xl border border-warm">
              <Gift className="w-16 h-16 text-[#E36B11]/20 mb-4" />
              <p className="text-gray-500 text-sm">No rewards available right now.</p>
              <p className="text-gray-400 text-xs mt-1">Check back soon!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {otherRewards.map((reward) => {
                const IconComponent = iconMap[reward.icon] || Gift;
                const canAfford = coins >= reward.cost;
                
                return (
                  <button
                    key={reward._id}
                    onClick={() => setSelectedReward(reward)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      canAfford 
                        ? 'bg-cream border-warm hover:border-[#E36B11]/30 hover:shadow-md' 
                        : 'bg-cream/50 border-warm/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                        reward.category === 'standard' ? 'bg-gradient-to-br from-[#E36B11] to-[#E5A55A]' :
                        'bg-gradient-to-br from-gray-400 to-gray-500'
                      }`}>
                        <IconComponent className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 text-sm">{reward.name}</h4>
                        <p className="text-[11px] text-gray-500 line-clamp-1">{reward.description}</p>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div>
                          <div className="flex items-center gap-1 justify-end">
                            <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                            <span className={`font-display text-base ${canAfford ? 'text-[#E36B11]' : 'text-gray-400'}`}>
                              {formatCurrency(reward.cost)}
                            </span>
                          </div>
                          {!canAfford && (
                            <p className="text-[9px] text-red-400">{formatCurrency(reward.cost - coins)} more</p>
                          )}
                        </div>
                        <ChevronRight className={`w-4 h-4 ${canAfford ? 'text-[#E36B11]/40' : 'text-gray-300'}`} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
