"use client";

import { useState } from "react";
import { Gift, X, ChevronLeft, Coins, Check, Lock, Star, Trophy, Tv, Ticket, Gamepad2, Plane, Car, Shirt, Monitor, MapPin } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import GenXLoader from "./GenXLoader";

interface RewardData {
  _id: string;
  name: string;
  description: string;
  longDescription?: string;
  cost: number;
  partner: string;
  icon: string;
  category: 'premium' | 'standard' | 'starter';
  active: boolean;
  image?: string;
  howToRedeem?: string;
  terms?: string;
  shopProductId?: string;
  shopVariantId?: string;
  requiresShipping?: boolean;
}

interface ShippingAddress {
  name: string;
  street: string;
  city: string;
  zip: string;
  country: string;
}

interface RewardDetailPageProps {
  isOpen: boolean;
  reward: RewardData | null;
  coins: number;
  onClose: () => void;
  onRedeem: (rewardId: string, cost: number) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Gift, Trophy, Tv, Ticket, Gamepad2, Star, Plane, Car, Shirt, Monitor
};

const formatPoints = (num: number) => {
  return num.toLocaleString('de-DE');
};

export default function RewardDetailPage({ isOpen, reward, coins, onClose, onRedeem }: RewardDetailPageProps) {
  const { user } = useAuth();
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    name: '',
    street: '',
    city: '',
    zip: '',
    country: 'Germany',
  });
  const [orderError, setOrderError] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(false);

  if (!isOpen || !reward) return null;

  const canAfford = coins >= reward.cost;
  const progress = Math.min((coins / reward.cost) * 100, 100);
  const IconComponent = iconMap[reward.icon] || Gift;
  const isShopReward = !!reward.shopProductId;

  const handleRedeem = async () => {
    // If this is a shop reward that requires shipping, show shipping form
    if (isShopReward && reward.requiresShipping && !showShippingForm) {
      setShowShippingForm(true);
      return;
    }

    setIsRedeeming(true);
    setOrderError('');

    try {
      if (isShopReward) {
        // Place order via API
        const res = await fetch('/api/rewards/redeem-shop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.id,
            rewardId: reward._id,
            productId: reward.shopProductId,
            variantId: reward.shopVariantId,
            shippingAddress: reward.requiresShipping ? shippingAddress : null,
            email: user?.email,
          }),
        });

        const data = await res.json();

        if (!data.success) {
          throw new Error(data.error || 'Order failed');
        }

        setOrderSuccess(true);
        onRedeem(reward._id, reward.cost);
        
        // Close after showing success
        setTimeout(() => {
          setOrderSuccess(false);
          setShowShippingForm(false);
          onClose();
        }, 2000);
      } else {
        // Regular reward redemption
        await new Promise(resolve => setTimeout(resolve, 1000));
        onRedeem(reward._id, reward.cost);
        setShowConfirm(false);
        onClose();
      }
    } catch (error: any) {
      setOrderError(error.message || 'Failed to place order');
    } finally {
      setIsRedeeming(false);
    }
  };

  const isShippingValid = !reward.requiresShipping || (
    shippingAddress.name.trim() !== '' &&
    shippingAddress.street.trim() !== '' &&
    shippingAddress.city.trim() !== '' &&
    shippingAddress.zip.trim() !== ''
  );

  return (
    <div 
      className="fixed z-50 flex flex-col"
      style={{ backgroundColor: '#000000', top: 48, bottom: 90, left: 0, right: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10 flex-shrink-0 bg-black/80 backdrop-blur-lg">
        <button 
          onClick={onClose}
          className="flex items-center gap-2 text-white hover:text-[#D4873A] transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
          <span className="text-base font-bold">Back</span>
        </button>
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-yellow-400" />
          <span className="font-bold text-yellow-400">{formatPoints(coins)}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {/* Hero Image */}
        <div className="relative h-64 bg-gradient-to-b from-[#D4873A]/30 to-black overflow-hidden">
          {reward.image ? (
            <img 
              src={reward.image} 
              alt={reward.name}
              className="w-full h-full object-cover opacity-80"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="relative">
                <IconComponent className="w-24 h-24 text-white/20" />
                <div className="absolute inset-0 bg-[#D4873A]/20 rounded-full blur-3xl" />
              </div>
            </div>
          )}
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
          
          {/* Category Badge */}
          <div className="absolute top-4 right-4">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              reward.category === 'premium' 
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                : reward.category === 'starter'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : 'bg-cream/10 text-white/70 border border-white/20'
            }`}>
              {reward.category.toUpperCase()}
            </span>
          </div>
          
          {/* Partner Badge */}
          <div className="absolute bottom-4 left-4">
            <span className="px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-sm font-medium text-white border border-white/20">
              {reward.partner}
            </span>
          </div>
        </div>

        {/* Info Section */}
        <div className="p-6 -mt-8 relative">
          {/* Title & Cost */}
          <div className="bg-gray-900/80 backdrop-blur-lg  p-5 border border-white/10 mb-4">
            <h1 className="text-2xl font-black text-white mb-2">{reward.name}</h1>
            <p className="text-white/60 text-sm mb-4">{reward.description}</p>
            
            {/* Cost Display */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-6 h-6 text-yellow-400" />
                <span className="text-2xl font-black text-yellow-400">{formatPoints(reward.cost)}</span>
                <span className="text-white/40 text-sm">BOGX</span>
              </div>
              
              {!canAfford && (
                <div className="text-right">
                  <p className="text-[#D4873A] text-sm font-bold">{formatPoints(reward.cost - coins)} more needed</p>
                  <div className="w-32 h-2 bg-cream/10 rounded-full mt-1 overflow-hidden">
                    <div 
                      className="h-full bg-[#D4873A] rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Long Description */}
          {reward.longDescription && (
            <div className="bg-gray-900/50  p-5 border border-white/10 mb-4">
              <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400" />
                About this Reward
              </h2>
              <p className="text-white/70 text-sm leading-relaxed whitespace-pre-line">
                {reward.longDescription}
              </p>
            </div>
          )}

          {/* How to Redeem */}
          {reward.howToRedeem && (
            <div className="bg-gray-900/50  p-5 border border-white/10 mb-4">
              <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <Gift className="w-5 h-5 text-[#D4873A]" />
                How to Redeem
              </h2>
              <p className="text-white/70 text-sm leading-relaxed whitespace-pre-line">
                {reward.howToRedeem}
              </p>
            </div>
          )}

          {/* Terms */}
          {reward.terms && (
            <div className="bg-gray-900/50  p-5 border border-white/10 mb-4">
              <h2 className="text-sm font-bold text-white/50 mb-2">Terms & Conditions</h2>
              <p className="text-white/40 text-xs leading-relaxed whitespace-pre-line">
                {reward.terms}
              </p>
            </div>
          )}

          {/* Spacer for button */}
          <div className="h-16" />
        </div>
      </div>

      {/* Shipping Form Modal */}
      {showShippingForm && (
        <div className="absolute inset-0 z-60 bg-black/90 flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-white/10">
            <button 
              onClick={() => setShowShippingForm(false)}
              className="flex items-center gap-2 text-white hover:text-[#D4873A] transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
              <span className="text-base font-bold">Back</span>
            </button>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#D4873A]" />
              <span className="font-bold text-white">Shipping Address</span>
            </div>
            <div className="w-16" />
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {orderSuccess ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                  <Check className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Order Placed!</h2>
                <p className="text-white/60 text-center">Your reward is on its way. Check your email for confirmation.</p>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-white/60 text-sm mb-1 block">Full Name</label>
                  <input
                    type="text"
                    value={shippingAddress.name}
                    onChange={(e) => setShippingAddress(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 bg-cream/5 border border-white/20  text-white focus:border-[#D4873A] focus:outline-none"
                    placeholder="Max Mustermann"
                  />
                </div>
                <div>
                  <label className="text-white/60 text-sm mb-1 block">Street & Number</label>
                  <input
                    type="text"
                    value={shippingAddress.street}
                    onChange={(e) => setShippingAddress(prev => ({ ...prev, street: e.target.value }))}
                    className="w-full px-4 py-3 bg-cream/5 border border-white/20  text-white focus:border-[#D4873A] focus:outline-none"
                    placeholder="Musterstraße 123"
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-white/60 text-sm mb-1 block">ZIP Code</label>
                    <input
                      type="text"
                      value={shippingAddress.zip}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, zip: e.target.value }))}
                      className="w-full px-4 py-3 bg-cream/5 border border-white/20  text-white focus:border-[#D4873A] focus:outline-none"
                      placeholder="12345"
                    />
                  </div>
                  <div className="flex-[2]">
                    <label className="text-white/60 text-sm mb-1 block">City</label>
                    <input
                      type="text"
                      value={shippingAddress.city}
                      onChange={(e) => setShippingAddress(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full px-4 py-3 bg-cream/5 border border-white/20  text-white focus:border-[#D4873A] focus:outline-none"
                      placeholder="Berlin"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-white/60 text-sm mb-1 block">Country</label>
                  <select
                    value={shippingAddress.country}
                    onChange={(e) => setShippingAddress(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full px-4 py-3 bg-cream/5 border border-white/20  text-white focus:border-[#D4873A] focus:outline-none"
                  >
                    <option value="Germany">Germany</option>
                    <option value="Austria">Austria</option>
                    <option value="Switzerland">Switzerland</option>
                  </select>
                </div>

                {orderError && (
                  <div className="bg-red-500/20 border border-red-500/50  p-3">
                    <p className="text-red-400 text-sm">{orderError}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {!orderSuccess && (
            <div className="p-4 border-t border-white/10">
              <button
                onClick={handleRedeem}
                disabled={isRedeeming || !isShippingValid}
                className={`w-full py-3  font-bold transition-all flex items-center justify-center gap-2 ${
                  isShippingValid
                    ? "bg-[#D4873A] text-white"
                    : "bg-cream/10 text-white/40"
                }`}
              >
                {isRedeeming ? (
                  <GenXLoader size="sm" />
                ) : (
                  <>
                    <Gift className="w-5 h-5" />
                    Place Order
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Fixed Bottom Button */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black via-black/80 to-transparent pt-4">
        {!showConfirm ? (
          <button
            onClick={() => canAfford && setShowConfirm(true)}
            disabled={!canAfford}
            className={`w-full py-2.5  font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              canAfford
                ? "bg-[#D4873A] text-white hover:bg-[#c4e000] active:scale-[0.98]"
                : "bg-cream/10 text-white/40 border border-white/10 cursor-not-allowed"
            }`}
          >
            {canAfford ? (
              <>
                {isShopReward ? <Shirt className="w-4 h-4" /> : <Gift className="w-4 h-4" />}
                {isShopReward ? 'Order Now' : 'Redeem'} for {formatPoints(reward.cost)} Points
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Need {formatPoints(reward.cost - coins)} more
              </>
            )}
          </button>
        ) : (
          <div className="bg-gray-900  p-4 border border-[#D4873A]/50">
            <p className="text-white text-center mb-4">
              {isShopReward ? 'Order' : 'Redeem'} <span className="font-bold text-[#D4873A]">{reward.name}</span> for <span className="font-bold text-yellow-400">{formatPoints(reward.cost)}</span> points?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3  bg-cream/10 text-white font-bold hover:bg-cream/20 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleRedeem}
                disabled={isRedeeming}
                className="flex-1 py-3 bg-[#D4873A] text-white font-bold hover:bg-[#c4e000] transition-all flex items-center justify-center gap-2"
              >
                {isRedeeming ? (
                  <GenXLoader size="sm" />
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Confirm
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
