"use client";

import { useState, useEffect, useCallback } from "react";
import { Gift, ChevronLeft, ChevronRight, Crown, Calendar, Trophy, Star, Shirt, Coffee, ShoppingBag } from "lucide-react";
import RewardDetailPage from "./RewardDetailPage";
import PaymentModal from "./PaymentModal";
import LogoLoader from "./LogoLoader";
import { formatCurrency, getCurrencySymbol } from "@/utils/currency";

interface RewardsPageProps {
  isOpen: boolean;
  coins: number;
  onClose: () => void;
  onRedeem: (rewardId: string, cost: number) => void;
  embedded?: boolean;
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

interface ShopProduct {
  id: string;
  name: string;
  price: string;
  image: string;
  category: string;
}

// Hero banner data for the carousel
const heroBanners = [
  {
    id: 'daily',
    title: 'Daily Champion',
    subtitle: 'Win the day, claim glory',
    prize: '5.00',
    icon: Calendar,
    gradient: 'from-[#1a1a2e] to-[#16213e]',
    accent: '#E36B11',
    image: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=600&q=80',
  },
  {
    id: 'monthly',
    title: 'Monthly Legend',
    subtitle: 'Dominate the month',
    prize: '50.00',
    icon: Trophy,
    gradient: 'from-[#1a1a2e] to-[#0f3460]',
    accent: '#FFD700',
    image: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=600&q=80',
  },
  {
    id: 'annual',
    title: 'Annual Champion',
    subtitle: 'The ultimate GenX title',
    prize: '500.00',
    icon: Crown,
    gradient: 'from-[#1a1a2e] to-[#2d132c]',
    accent: '#E36B11',
    image: 'https://images.unsplash.com/photo-1533228876829-65c94e7b5025?w=600&q=80',
  },
];

export default function RewardsPage({ isOpen, coins, onClose, onRedeem, embedded = false }: RewardsPageProps) {
  const [dbRewards, setDbRewards] = useState<RewardData[]>([]);
  const [shopProducts, setShopProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopLoading, setShopLoading] = useState(true);
  const [selectedReward, setSelectedReward] = useState<RewardData | null>(null);
  const [paymentPackage, setPaymentPackage] = useState<{ points: number; price: string; priceValue: number } | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Auto-advance carousel
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroBanners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Fetch rewards from database
  useEffect(() => {
    const fetchRewards = async () => {
      try {
        const res = await fetch('/api/rewards');
        const data = await res.json();
        if (data.success) {
          setDbRewards(data.rewards.filter((r: RewardData) => r.active));
        }
      } catch (error) {
        console.error('Failed to fetch rewards:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRewards();
  }, []);

  // Fetch shop products
  useEffect(() => {
    let mounted = true;
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/shop/products');
        const data = await res.json();
        if (mounted && data.success && Array.isArray(data.products)) {
          setShopProducts(data.products.slice(0, 4)); // Show first 4 products on mobile
        }
      } catch (e) {
        console.error('Failed to fetch shop products:', e);
      } finally {
        if (mounted) {
          setShopLoading(false);
        }
      }
    };
    fetchProducts();
    return () => { mounted = false; };
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % heroBanners.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + heroBanners.length) % heroBanners.length);
  }, []);

  const handlePaymentSuccess = (points: number) => {
    onRedeem(`topup-${points}`, -points);
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
        className={embedded ? "flex flex-col h-full min-h-full bg-[#F5F0E8] overflow-hidden" : "fixed z-40 flex flex-col"}
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
              <Gift className="w-5 h-5 text-[#E36B11]" />
              <span className="font-display text-lg tracking-wider text-gray-900">Rewards</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 border-b border-warm flex-shrink-0" style={{ backgroundColor: '#F5F0E8' }}>
            <button 
              onClick={onClose}
              className="flex items-center gap-2 text-gray-700 hover:text-[#E36B11] transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
              <span className="text-base font-bold">Back</span>
            </button>
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-[#E36B11]" />
              <h1 className="text-lg font-bold text-gray-900">Rewards</h1>
            </div>
            <div className="w-16" />
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          
          {/* Hero Carousel Section */}
          <div className="px-4 pt-4">
            <div className="relative rounded-xl overflow-hidden" style={{ height: '160px' }}>
              {/* Slides */}
              {heroBanners.map((banner, index) => {
                const Icon = banner.icon;
                const isActive = index === currentSlide;
                
                return (
                  <div
                    key={banner.id}
                    className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                      isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'
                    }`}
                    style={{ pointerEvents: isActive ? 'auto' : 'none' }}
                  >
                    {/* Background image with overlay */}
                    <div className="absolute inset-0">
                      <img 
                        src={banner.image} 
                        alt="" 
                        className="w-full h-full object-cover"
                      />
                      <div className={`absolute inset-0 bg-gradient-to-r ${banner.gradient} opacity-90`} />
                    </div>
                    
                    {/* Content */}
                    <div className="relative h-full p-5 flex items-center justify-between">
                      {/* Left content */}
                      <div className="flex-1 z-10">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className="w-4 h-4" style={{ color: banner.accent }} />
                          <span className="text-[10px] uppercase tracking-widest text-gray-300 font-medium">
                            {banner.id === 'daily' ? 'Every Day' : banner.id === 'monthly' ? 'Every Month' : 'Every Year'}
                          </span>
                        </div>
                        <h2 className="font-display text-xl text-white mb-0.5">{banner.title}</h2>
                        <p className="text-gray-300 text-xs mb-3">{banner.subtitle}</p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400 text-[10px]">Prize:</span>
                          <div className="flex items-center gap-1 bg-white/10 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/20">
                            <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                            <span className="font-display text-base text-white">{banner.prize}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Right decoration */}
                      <div className="relative w-20 h-20 flex items-center justify-center">
                        <div 
                          className="absolute inset-0 rounded-full opacity-30 blur-xl"
                          style={{ backgroundColor: banner.accent }}
                        />
                        <Icon className="w-12 h-12 opacity-40" style={{ color: banner.accent }} />
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Navigation arrows */}
              <button
                onClick={prevSlide}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/30 flex items-center justify-center z-20"
              >
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={nextSlide}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/30 flex items-center justify-center z-20"
              >
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
              
              {/* Dots indicator */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                {heroBanners.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      index === currentSlide ? 'bg-white w-4' : 'bg-white/40'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Shop Products Section */}
          <div className="px-4 py-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-gray-600" />
                <h2 className="font-display text-xs uppercase tracking-wider text-gray-900">Redeem with BOGX</h2>
              </div>
              <button 
                onClick={onClose}
                className="text-[10px] font-display text-[#E36B11]"
              >
                View All →
              </button>
            </div>
            
            {shopLoading ? (
              <div className="flex justify-center py-6">
                <LogoLoader size="sm" />
              </div>
            ) : shopProducts.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-xs">
                No products available
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {shopProducts.map((product) => {
                  const priceNum = parseFloat(product.price.replace('€', '').replace(',', '.'));
                  const bogxPrice = Math.round(priceNum * 500);
                  const canAfford = coins >= bogxPrice / 500;
                  
                  return (
                    <div
                      key={product.id}
                      className={`bg-cream rounded-xl border overflow-hidden ${
                        canAfford ? 'border-warm' : 'border-warm/50 opacity-60'
                      }`}
                    >
                      <div className="aspect-square bg-white relative overflow-hidden">
                        <img 
                          src={product.image} 
                          alt={product.name}
                          className="w-full h-full object-cover mix-blend-multiply"
                        />
                        <div className="absolute top-1.5 left-1.5">
                          {product.category === 'apparel' && <Shirt className="w-3 h-3 text-gray-400" />}
                          {product.category === 'drinkware' && <Coffee className="w-3 h-3 text-gray-400" />}
                          {product.category === 'accessories' && <ShoppingBag className="w-3 h-3 text-gray-400" />}
                        </div>
                      </div>
                      <div className="p-2.5">
                        <h3 className="text-[11px] font-semibold text-gray-900 truncate">{product.name}</h3>
                        <div className="flex items-center gap-1 mt-1">
                          <img src="/images/bogxcoin.png" alt="" className="w-3.5 h-3.5" />
                          <span className={`font-display text-sm ${canAfford ? 'text-[#E36B11]' : 'text-gray-400'}`}>
                            {bogxPrice.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[9px] text-gray-400">or {product.price}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Partner Rewards Section */}
          <div className="px-4 pb-8">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="w-4 h-4 text-[#E36B11]" />
              <h2 className="font-display text-xs uppercase tracking-wider text-gray-900">Partner Rewards</h2>
            </div>
            
            {loading ? (
              <div className="flex justify-center py-6">
                <LogoLoader size="sm" />
              </div>
            ) : dbRewards.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center bg-cream rounded-xl border border-warm">
                <Gift className="w-10 h-10 text-gray-300 mb-2" />
                <p className="text-gray-500 text-xs">No partner rewards available</p>
                <p className="text-gray-400 text-[10px] mt-0.5">Check back soon!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dbRewards.map((reward) => {
                  const canAfford = coins >= reward.cost;
                  
                  return (
                    <button
                      key={reward._id}
                      onClick={() => setSelectedReward(reward)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        canAfford 
                          ? 'bg-cream border-warm active:scale-[0.98]' 
                          : 'bg-cream/50 border-warm/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          reward.category === 'premium' 
                            ? 'bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200' 
                            : 'bg-gray-100 border border-gray-200'
                        }`}>
                          <Gift className={`w-5 h-5 ${reward.category === 'premium' ? 'text-amber-600' : 'text-gray-500'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-semibold text-gray-900 text-xs truncate">{reward.name}</h4>
                            {reward.category === 'premium' && (
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-[10px] text-gray-500 truncate">{reward.description}</p>
                          <p className="text-[9px] text-gray-400">{reward.partner}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="flex items-center gap-1 justify-end">
                            <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                            <span className={`font-display text-sm ${canAfford ? 'text-[#E36B11]' : 'text-gray-400'}`}>
                              {formatCurrency(reward.cost)}
                            </span>
                          </div>
                          {!canAfford && (
                            <p className="text-[9px] text-gray-400">
                              {formatCurrency(reward.cost - coins)} more
                            </p>
                          )}
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
