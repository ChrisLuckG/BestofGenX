"use client";

import { useState, useEffect } from "react";
import { Gift, Trophy, Tv, Ticket, Gamepad2, Star, Plane, Car, Shirt, Monitor, ChevronLeft, Crown } from "lucide-react";
import RewardDetailPage from "@/components/RewardDetailPage";
import RewardedAdButton from "@/components/RewardedAdButton";
import { RewardsSkeleton } from "./DesktopSkeletons";
import { formatCurrency } from "@/utils/currency";

// Membership tiers
const MEMBERSHIP_TIERS = [
  { level: 5, name: 'Rookie', minCoins: 0, maxCoins: 19.99, color: '#9CA3AF' },
  { level: 4, name: 'Slacker', minCoins: 20, maxCoins: 39.99, color: '#A78BFA' },
  { level: 3, name: 'Radical', minCoins: 40, maxCoins: 79.99, color: '#60A5FA' },
  { level: 2, name: 'Legendary', minCoins: 80, maxCoins: 149.99, color: '#FBBF24' },
  { level: 1, name: 'Icon', minCoins: 150, maxCoins: Infinity, color: '#F472B6' },
];

function getMembershipTier(coins: number) {
  return MEMBERSHIP_TIERS.find(t => coins >= t.minCoins && coins <= t.maxCoins) || MEMBERSHIP_TIERS[0];
}

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
  
  const currentTier = getMembershipTier(coins);
  const nextTier = MEMBERSHIP_TIERS.find(t => t.level === currentTier.level - 1);
  const progressToNext = nextTier ? Math.min(100, ((coins - currentTier.minCoins) / (nextTier.minCoins - currentTier.minCoins)) * 100) : 100;

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
        {/* Header - Desktop warm style */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#D4873A]/5 to-transparent">
          <button 
            onClick={onClose}
            className="flex items-center gap-2 text-gray-600 hover:text-[#D4873A] transition-colors"
          >
            <Trophy className="w-5 h-5" />
            <span className="font-display text-lg tracking-wider">Ranking</span>
          </button>
          <div className="flex items-center gap-3">
            <Gift className="w-5 h-5 text-[#D4873A]" />
            <div>
              <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">Rewards</span>
              <span className="text-[10px] text-gray-500 -mt-0.5 block">Redeem your BOGX coins</span>
            </div>
          </div>
        </div>

        {/* Membership Status */}
        <div className="p-4 border-b border-warm bg-gradient-to-b from-[#D4873A]/[0.02] to-transparent">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: currentTier.color + '20' }}
              >
                <Crown className="w-6 h-6" style={{ color: currentTier.color }} />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Your Status</p>
                <p className="font-bold text-lg" style={{ color: currentTier.color }}>{currentTier.name}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5 justify-end">
                <img src="/images/bogxcoin.png" alt="" className="w-5 h-5" />
                <span className="font-bold text-xl text-[#D4873A]">{formatCurrency(coins)}</span>
              </div>
              <p className="text-[10px] text-gray-500">Coins</p>
            </div>
          </div>
          
          {/* Progress to next tier */}
          {nextTier && (
            <div className="mt-3">
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-gray-500">Progress to {nextTier.name}</span>
                <span style={{ color: nextTier.color }}>{formatCurrency(nextTier.minCoins)} BOGX</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${progressToNext}%`,
                    backgroundColor: nextTier.color 
                  }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                {formatCurrency(nextTier.minCoins - coins)} more to reach {nextTier.name}
              </p>
            </div>
          )}
          
          {/* All Tiers */}
          <div className="mt-4 pt-3 border-t border-warm">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Membership Tiers</p>
            <div className="flex gap-1">
              {MEMBERSHIP_TIERS.slice().reverse().map((tier) => (
                <div 
                  key={tier.level}
                  className={`flex-1 py-1.5 px-1 rounded-lg text-center text-[10px] font-semibold transition-all ${
                    tier.level === currentTier.level 
                      ? 'ring-2 ring-offset-1' 
                      : 'opacity-50'
                  }`}
                  style={{ 
                    backgroundColor: tier.color + '20',
                    color: tier.color,
                    boxShadow: tier.level === currentTier.level ? `0 0 0 2px ${tier.color}` : 'none'
                  }}
                >
                  {tier.name}
                </div>
              ))}
            </div>
          </div>
          
          {/* Earn Free */}
          <div className="mt-4">
            <p className="text-[10px] text-[#D4873A] mb-2 text-center uppercase tracking-wider font-semibold">Earn Free BOGX</p>
            <RewardedAdButton 
              onReward={(points: number) => onRedeem(`ad-reward-${Date.now()}`, -points)}
            />
          </div>
        </div>

        {/* Rewards List */}
        <div className="flex-1 overflow-y-auto p-4 pb-8 space-y-3 bg-gradient-to-b from-transparent to-[#D4873A]/[0.03]" style={{ scrollbarWidth: 'none' }}>
          {loading ? (
            <RewardsSkeleton />
          ) : displayRewards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Gift className="w-16 h-16 text-[#D4873A]/20 mb-4" />
              <p className="text-gray-500 text-sm">No rewards available right now.</p>
              <p className="text-gray-400 text-xs mt-1">Check back soon!</p>
            </div>
          ) : (
            displayRewards.map((reward) => {
              const IconComponent = iconMap[reward.icon] || Gift;
              const canAfford = coins >= reward.cost;
              
              return (
                <button
                  key={reward._id}
                  onClick={() => setSelectedReward(reward)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    canAfford 
                      ? 'bg-cream border-warm hover:border-[#D4873A]/30 hover:shadow-md' 
                      : 'bg-cream/50 border-warm/50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      reward.category === 'premium' ? 'bg-gradient-to-br from-[#FFB800] to-[#FF8C00]' :
                      reward.category === 'standard' ? 'bg-gradient-to-br from-[#D4873A] to-[#E5A55A]' :
                      'bg-gradient-to-br from-gray-400 to-gray-500'
                    }`}>
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900">{reward.name}</h4>
                      <p className="text-xs text-gray-500 line-clamp-1">{reward.description}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{reward.partner}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                        <span className={`font-display text-lg ${canAfford ? 'text-[#D4873A]' : 'text-gray-400'}`}>
                          {formatCurrency(reward.cost)}
                        </span>
                      </div>
                      {!canAfford && (
                        <p className="text-[10px] text-red-400">{formatCurrency(reward.cost - coins)} more</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
  );
}
