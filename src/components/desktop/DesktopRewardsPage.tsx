"use client";

import { useState, useEffect, useCallback } from "react";
import { Gift, Trophy, ChevronLeft, ChevronRight, Crown, Calendar, Star, Shirt, Coffee, ShoppingBag } from "lucide-react";
import PageHeader, { HeaderButton } from "@/components/PageHeader";
import RewardDetailPage from "@/components/RewardDetailPage";
import LogoLoader from "@/components/LogoLoader";
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
    image: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&q=80', // Runner/athlete
  },
  {
    id: 'monthly',
    title: 'Monthly Legend',
    subtitle: 'Dominate the month',
    prize: '50.00',
    icon: Trophy,
    gradient: 'from-[#1a1a2e] to-[#0f3460]',
    accent: '#FFD700',
    image: 'https://images.unsplash.com/photo-1461896836934- voices-of-the-80s?w=800&q=80', // Trophy/victory
  },
  {
    id: 'annual',
    title: 'Annual Champion',
    subtitle: 'The ultimate GenX title',
    prize: '500.00',
    icon: Crown,
    gradient: 'from-[#1a1a2e] to-[#2d132c]',
    accent: '#E36B11',
    image: 'https://images.unsplash.com/photo-1533228876829-65c94e7b5025?w=800&q=80', // Crown/champion
  },
];

export default function DesktopRewardsPage({ coins, onClose, onRedeem }: DesktopRewardsPageProps) {
  const [dbRewards, setDbRewards] = useState<RewardData[]>([]);
  const [shopProducts, setShopProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopLoading, setShopLoading] = useState(true);
  const [selectedReward, setSelectedReward] = useState<RewardData | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Auto-advance carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroBanners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Fetch rewards
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

  // Fetch shop products
  useEffect(() => {
    let mounted = true;
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/shop/products');
        const data = await res.json();
        if (mounted && data.success && Array.isArray(data.products)) {
          setShopProducts(data.products.slice(0, 6)); // Show first 6 products
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
      {/* Header - same style as Rankings, with toggle */}
      <PageHeader
        icon={Gift}
        title="Rewards"
        subtitle="Redeem your BOGX coins"
        right={<HeaderButton icon={Trophy} label="Ranking" onClick={onClose} />}
      />

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        
        {/* Hero Carousel Section */}
        <div className="px-6 pt-6">
          <div className="relative rounded-2xl overflow-hidden" style={{ height: '200px' }}>
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
                  <div className="relative h-full p-8 flex items-center justify-between">
                    {/* Left content */}
                    <div className="flex-1 z-10">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-6 h-6" style={{ color: banner.accent }} />
                        <span className="text-xs uppercase tracking-widest text-gray-300 font-medium">
                          {banner.id === 'daily' ? 'Every Day' : banner.id === 'monthly' ? 'Every Month' : 'Every Year'}
                        </span>
                      </div>
                      <h2 className="font-display text-3xl text-white mb-1">{banner.title}</h2>
                      <p className="text-gray-300 text-sm mb-4">{banner.subtitle}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm">Prize Pool:</span>
                        <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full border border-white/20">
                          <img src="/images/bogxcoin.png" alt="" className="w-5 h-5" />
                          <span className="font-display text-xl text-white">{banner.prize}</span>
                          <span className="text-gray-300 text-sm">BOGX</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Right decoration */}
                    <div className="relative w-32 h-32 flex items-center justify-center">
                      <div 
                        className="absolute inset-0 rounded-full opacity-30 blur-2xl"
                        style={{ backgroundColor: banner.accent }}
                      />
                      <Icon className="w-20 h-20 opacity-40" style={{ color: banner.accent }} />
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Navigation arrows */}
            <button
              onClick={prevSlide}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center transition-colors z-20"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center transition-colors z-20"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
            
            {/* Dots indicator */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
              {heroBanners.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentSlide ? 'bg-white w-6' : 'bg-white/40 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Shop Products Section */}
        <div className="px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-gray-600" />
              <h2 className="font-display text-sm uppercase tracking-wider text-gray-900">Redeem with BOGX</h2>
            </div>
            <a 
              href="/mobile?tab=shop" 
              className="text-xs font-display text-[#E36B11] hover:underline"
            >
              View All →
            </a>
          </div>
          
          {shopLoading ? (
            <div className="flex justify-center py-8">
              <LogoLoader size="md" />
            </div>
          ) : shopProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              No products available
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {shopProducts.map((product) => {
                const priceNum = parseFloat(product.price.replace('€', '').replace(',', '.'));
                const bogxPrice = Math.round(priceNum * 500);
                const canAfford = coins >= bogxPrice / 500;
                
                return (
                  <div
                    key={product.id}
                    className={`bg-cream rounded-xl border overflow-hidden transition-all hover:shadow-md ${
                      canAfford ? 'border-warm hover:border-[#E36B11]/30' : 'border-warm/50 opacity-60'
                    }`}
                  >
                    <div className="aspect-square bg-white relative overflow-hidden">
                      <img 
                        src={product.image} 
                        alt={product.name}
                        className="w-full h-full object-cover mix-blend-multiply"
                      />
                      {/* Category badge */}
                      <div className="absolute top-2 left-2">
                        {product.category === 'apparel' && <Shirt className="w-4 h-4 text-gray-400" />}
                        {product.category === 'drinkware' && <Coffee className="w-4 h-4 text-gray-400" />}
                        {product.category === 'accessories' && <ShoppingBag className="w-4 h-4 text-gray-400" />}
                      </div>
                    </div>
                    <div className="p-3">
                      <h3 className="text-xs font-semibold text-gray-900 truncate">{product.name}</h3>
                      <div className="flex items-center gap-1 mt-1.5">
                        <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                        <span className={`font-display text-sm ${canAfford ? 'text-[#E36B11]' : 'text-gray-400'}`}>
                          {bogxPrice.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">or {product.price}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Available Rewards Section */}
        <div className="px-6 pb-8">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-4 h-4 text-[#E36B11]" />
            <h2 className="font-display text-sm uppercase tracking-wider text-gray-900">Partner Rewards</h2>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <LogoLoader size="md" />
            </div>
          ) : dbRewards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-cream rounded-xl border border-warm">
              <Gift className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">No partner rewards available</p>
              <p className="text-gray-400 text-xs mt-1">Check back soon!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dbRewards.map((reward) => {
                const canAfford = coins >= reward.cost;
                
                return (
                  <button
                    key={reward._id}
                    onClick={() => setSelectedReward(reward)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      canAfford 
                        ? 'bg-cream border-warm hover:border-[#E36B11]/30 hover:shadow-sm' 
                        : 'bg-cream/50 border-warm/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        reward.category === 'premium' 
                          ? 'bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200' 
                          : 'bg-gray-100 border border-gray-200'
                      }`}>
                        <Gift className={`w-6 h-6 ${reward.category === 'premium' ? 'text-amber-600' : 'text-gray-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900 text-sm">{reward.name}</h4>
                          {reward.category === 'premium' && (
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-1">{reward.description}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{reward.partner}</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          <img src="/images/bogxcoin.png" alt="" className="w-5 h-5" />
                          <span className={`font-display text-lg ${canAfford ? 'text-[#E36B11]' : 'text-gray-400'}`}>
                            {formatCurrency(reward.cost)}
                          </span>
                        </div>
                        {!canAfford && (
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {formatCurrency(reward.cost - coins)} more needed
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
  );
}
