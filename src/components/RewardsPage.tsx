"use client";

import { useState, useEffect } from "react";
import { Gift, X, Check, Lock, Trophy, Tv, Ticket, Gamepad2, Star, Plane, Car, Clock, CreditCard, Shirt, Monitor, Coins, ChevronLeft, ChevronRight } from "lucide-react";
import RewardDetailPage from "./RewardDetailPage";
import PaymentModal from "./PaymentModal";
import RewardedAdButton from "./RewardedAdButton";
import LogoLoader from "./LogoLoader";
import { formatCurrency, getCurrencySymbol } from "@/utils/currency";

interface RewardsPageProps {
  isOpen: boolean;
  coins: number;
  onClose: () => void;
  onRedeem: (rewardId: string, cost: number) => void;
  embedded?: boolean; // If true, render without slide-in animation (for embedding in other views)
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
  shopProductId?: string;
  shopVariantId?: string;
  requiresShipping?: boolean;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Gift, Trophy, Tv, Ticket, Gamepad2, Star, Plane, Car, Shirt, Monitor
};

// Calculate time until end of period
const getTimeUntil = (type: "day" | "month" | "year") => {
  const now = new Date();
  let end: Date;
  
  if (type === "day") {
    end = new Date(now);
    end.setHours(24, 0, 0, 0);
  } else if (type === "month") {
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else {
    end = new Date(now.getFullYear() + 1, 0, 1);
  }
  
  const diff = end.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  return { days, hours };
};

// Format number as Euro
const formatPoints = (num: number) => {
  return formatCurrency(num);
};

export default function RewardsPage({ isOpen, coins, onClose, onRedeem, embedded = false }: RewardsPageProps) {
  const [dayTime, setDayTime] = useState({ days: 0, hours: 0 });
  const [monthTime, setMonthTime] = useState({ days: 0, hours: 0 });
  const [yearTime, setYearTime] = useState({ days: 0, hours: 0 });
  const [mounted, setMounted] = useState(false);
  const [dbRewards, setDbRewards] = useState<RewardData[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch rewards from database
  useEffect(() => {
    const fetchRewards = async () => {
      try {
        const res = await fetch('/api/rewards');
        const data = await res.json();
        if (data.success) {
          setDbRewards(data.rewards);
        }
      } catch (error) {
        console.error('Failed to fetch rewards:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRewards();
  }, []);

  useEffect(() => {
    setMounted(true);
    setDayTime(getTimeUntil("day"));
    setMonthTime(getTimeUntil("month"));
    setYearTime(getTimeUntil("year"));
    
    const timer = setInterval(() => {
      setDayTime(getTimeUntil("day"));
      setMonthTime(getTimeUntil("month"));
      setYearTime(getTimeUntil("year"));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Use DB rewards only
  const displayRewards = dbRewards;
  
  // Selected reward for detail page
  const [selectedReward, setSelectedReward] = useState<RewardData | null>(null);
  
  // Payment modal state
  const [paymentPackage, setPaymentPackage] = useState<{ points: number; price: string; priceValue: number } | null>(null);

  const handlePaymentSuccess = (points: number) => {
    // Add points to user's balance
    onRedeem(`topup-${points}`, -points); // negative cost = add points
  };

  if (!isOpen) return null;

  return (
    <>
    {/* Reward Detail Page */}
    <RewardDetailPage
      isOpen={selectedReward !== null}
      reward={selectedReward}
      coins={coins}
      onClose={() => setSelectedReward(null)}
      onRedeem={onRedeem}
    />
    <div 
      className={embedded ? "flex flex-col h-full min-h-full bg-cream overflow-hidden" : "fixed z-40 flex flex-col"}
      style={embedded ? {} : { backgroundColor: '#F5F0E8', top: 48, bottom: 90, left: 0, right: 0 }}
    >
      {/* Header - same style as Rankings */}
      {embedded ? (
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm">
          <button 
            onClick={onClose}
            className="flex items-center gap-2 text-gray-600"
          >
            <Trophy className="w-5 h-5" />
            <span className="font-display text-lg tracking-wider">Ranking</span>
          </button>
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-[#D4873A]" />
            <span className="font-display text-lg tracking-wider text-gray-900">Rewards</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 border-b border-warm flex-shrink-0" style={{ backgroundColor: '#F5F0E8' }}>
          <button 
            onClick={onClose}
            className="flex items-center gap-2 text-gray-700 hover:text-[#D4873A] transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
            <span className="text-base font-bold">Back</span>
          </button>
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-[#D4873A]" />
            <h1 className="text-lg font-bold text-gray-900">Rewards</h1>
          </div>
          <div className="w-16" />
        </div>
      )}

      {/* Quick Top Up Buttons */}
      <div className="p-3 border-b border-warm" style={{ backgroundColor: '#F5F0E8' }}>
        <p className="text-[10px] text-[#D4873A] mb-2 text-center uppercase tracking-wider font-semibold">Top Up</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { points: 0.50, price: '0,50€', priceValue: 50 },
            { points: 1.00, price: '1,00€', priceValue: 100 },
            { points: 2.50, price: '2,50€', priceValue: 250 },
            { points: 5.00, price: '5,00€', priceValue: 500 },
            { points: 10.00, price: '10,00€', priceValue: 1000 },
            { points: 25.00, price: '25,00€', priceValue: 2500 },
          ].map((pkg) => (
            <button
              key={pkg.points}
              onClick={() => setPaymentPackage(pkg)}
              className="flex flex-col items-center py-2 px-1 rounded-xl bg-cream border border-[#D4873A]/20 hover:bg-[#D4873A]/10 hover:border-[#D4873A]/50 transition-all hover:scale-105"
            >
              <span className="text-gray-900 font-bold text-sm">+{formatCurrency(pkg.points)}{getCurrencySymbol()}</span>
              <span className="text-[10px] text-[#D4873A]">{pkg.price}</span>
            </button>
          ))}
        </div>
        
        {/* Watch Ad for Free Points */}
        <div className="mt-3">
          <p className="text-[10px] text-[#D4873A] mb-2 text-center uppercase tracking-wider font-semibold">Or Earn Free</p>
          <RewardedAdButton 
            onReward={(points) => onRedeem(`ad-reward-${Date.now()}`, -points)}
          />
        </div>
      </div>

      {/* Rewards List */}
      <div className="flex-1 overflow-y-auto p-4 pb-8 space-y-3 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', backgroundColor: '#F5F0E8' }}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LogoLoader size="lg" />
          </div>
        ) : displayRewards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="relative">
              <Gift className="w-16 h-16 text-gray-200 animate-pulse" />
              <div className="absolute inset-0 bg-cream rounded-full blur-xl" />
            </div>
            <p className="text-gray-500 text-sm mt-4">No rewards available yet</p>
            <p className="text-gray-600 text-xs mt-1">Check back soon!</p>
          </div>
        ) : displayRewards.map((reward, index) => {
          const canAfford = coins >= reward.cost;
          const IconComponent = iconMap[reward.icon] || Gift;
          const progress = Math.min((coins / reward.cost) * 100, 100);
          
          return (
            <div
              key={reward._id}
              onClick={() => setSelectedReward(reward)}
              className={`relative p-4 rounded-xl border transition-all duration-300 transform hover:scale-[1.02] cursor-pointer ${
                canAfford
                  ? "border-[#D4873A]/50 bg-gradient-to-r from-[#D4873A]/10 to-white hover:border-[#D4873A] hover:shadow-lg hover:shadow-[#D4873A]/20"
                  : "border-warm bg-cream"
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Progress bar background */}
              {!canAfford && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-cream overflow-hidden rounded-b-xl">
                  <div 
                    className="h-full bg-[#D4873A] transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
              
              {/* Glow effect for affordable */}
              {canAfford && (
                <div className="absolute inset-0 bg-gradient-to-r from-[#D4873A]/20 to-transparent animate-pulse rounded-xl" style={{ animationDuration: '3s' }} />
              )}
              
              <div className="relative flex items-center gap-3">
                {/* Icon with Badge */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                    canAfford 
                      ? 'bg-[#D4873A] shadow-lg shadow-[#D4873A]/30 animate-pulse' 
                      : reward.category === 'premium' ? 'bg-[#D4873A]/20' : 'bg-cream'
                  }`}>
                    <IconComponent className={`w-6 h-6 ${canAfford ? 'text-black' : 'text-gray-600'}`} />
                    {canAfford && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#D4873A] rounded-full animate-ping" />
                    )}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                    reward.category === 'premium' 
                      ? 'bg-[#D4873A]/20 text-[#D4873A] border border-[#D4873A]/30' 
                      : 'bg-cream text-gray-500'
                  }`}>
                    {reward.partner}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className={`font-bold text-sm whitespace-nowrap ${canAfford ? 'text-gray-900' : 'text-gray-600'}`}>
                    {reward.name}
                  </h3>
                  <p className="text-[11px] text-gray-600 mt-0.5 truncate">{reward.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-1">
                      <span className={`text-sm font-black ${canAfford ? 'text-amber-500' : 'text-gray-600'}`}>
                        {formatPoints(reward.cost)} {getCurrencySymbol()}
                      </span>
                    </div>
                    {!canAfford && (
                      <span className="text-[10px] text-[#D4873A] bg-[#D4873A]/10 px-2 py-0.5 rounded">
                        {formatPoints(reward.cost - coins)} {getCurrencySymbol()} more
                      </span>
                    )}
                  </div>
                </div>

                {/* View Details Arrow */}
                <div className="flex items-center gap-2">
                  <div className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 ${
                    canAfford
                      ? "bg-[#D4873A] text-white"
                      : "bg-cream text-gray-600 border border-warm"
                  }`}>
                    {canAfford ? (
                      <span className="flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Claim
                      </span>
                    ) : (
                      <span>{Math.round(progress)}%</span>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
    
    {/* Payment Modal */}
    <PaymentModal
      isOpen={paymentPackage !== null}
      package_={paymentPackage}
      onClose={() => setPaymentPackage(null)}
      onSuccess={handlePaymentSuccess}
    />
    </>
  );
}
