"use client";

import { useState, useEffect } from "react";
import { ShoppingBag, Shirt, Coffee, Package, ShoppingCart, ChevronRight, Star, Heart } from "lucide-react";
import ProductDetailInline from "@/components/ProductDetailInline";
import CartPage from "@/components/CartPage";
import LogoLoader from "@/components/LogoLoader";
import { useCart } from "@/context/CartContext";

interface Variant {
  id: number;
  title: string;
  price: string;
  available: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: string;
  image: string;
  images?: string[]; // All mockup images
  variants?: Variant[]; // Available sizes/colors
  category: "apparel" | "accessories" | "drinkware";
  printifyUrl?: string;
}

const allCategories = [
  { id: "all", label: "All", icon: Package },
  { id: "apparel", label: "Apparel", icon: Shirt },
  { id: "drinkware", label: "Drinkware", icon: Coffee },
  { id: "accessories", label: "Accessories", icon: ShoppingBag },
];

interface ShopPageProps {
  coins?: number;
  onCoinsUsed?: (amount: number) => void;
}

export default function ShopPage({ coins = 0, onCoinsUsed }: ShopPageProps) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { totalItems } = useCart();

  // Fetch products from Printful API
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/shop/products');
        const data = await res.json();
        
        if (data.success) {
          setProducts(data.products);
        } else {
          setError(data.error || 'Failed to load products');
        }
      } catch (err) {
        setError('Failed to connect to shop');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const filteredProducts = activeCategory === "all" 
    ? products 
    : products.filter((p: Product) => p.category === activeCategory);

  // Show CartPage
  if (showCart) {
    return (
      <CartPage 
        onBack={() => setShowCart(false)}
        onContinueShopping={() => setShowCart(false)}
        userCoins={coins}
        onCoinsUsed={onCoinsUsed}
      />
    );
  }

  return (
    <div className="w-full h-full min-h-full flex flex-col overflow-hidden bg-cream">
      {/* Header - exactly like Rankings */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#D4873A]/5 to-transparent">
        <div className="flex items-center gap-3">
          <ShoppingBag className="w-5 h-5 text-[#D4873A]" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">Shop</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">GenX merch & collectibles</span>
          </div>
        </div>
        <button 
          onClick={() => setShowCart(true)}
          className="relative flex items-center gap-2 px-3 py-2 bg-[#D4873A] rounded-lg text-white text-xs font-semibold tracking-wider hover:bg-[#c06a2a] transition-colors"
        >
          <ShoppingCart className="w-4 h-4" />
          CART
          {totalItems > 0 && (
            <span className="w-5 h-5 bg-white rounded-full text-[#D4873A] text-xs font-bold flex items-center justify-center">
              {totalItems}
            </span>
          )}
        </button>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>

      {/* Product Detail View - Shows inline when product selected */}
      {selectedProduct ? (
        <ProductDetailInline 
          product={selectedProduct} 
          onClose={() => setSelectedProduct(null)} 
        />
      ) : (
        <>
          {/* Hero Banner */}
          <div className="mx-3 mt-3 rounded-2xl overflow-hidden relative aspect-[2.5/1]">
            <img 
              src="/images/Hintergund/shop-banner.png" 
              alt="" 
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            {/* Text on right side */}
            <div className="absolute inset-0 flex items-center justify-end pr-8">
              <div className="text-right">
                <h2 className="font-display text-2xl md:text-5xl text-white leading-tight" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                  WEAR YOUR <span className="text-[#D4873A]">GENERATION.</span>
                </h2>
                <p className="text-white/80 text-xs mt-2" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                  Official BestofGenX Merch & Collectibles
                </p>
              </div>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 mx-3 mt-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {allCategories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all border ${
                    isActive 
                      ? "bg-[#D4873A] text-white border-[#D4873A]" 
                      : "bg-cream text-gray-700 hover:bg-[#D4873A]/10 border-warm"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-semibold">{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Loading State - Skeleton */}
          {loading && (
            <div className="grid grid-cols-2 gap-3 mx-3 mt-4 pb-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-cream overflow-hidden rounded-xl border border-warm animate-pulse">
                  <div className="aspect-square bg-skeleton" />
                  <div className="p-3">
                    <div className="w-3/4 h-4 bg-skeleton rounded mb-2" />
                    <div className="w-1/2 h-5 bg-skeleton rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="mx-3 mt-4 p-6 bg-red-50 border border-red-200 rounded-xl text-center">
              <ShoppingBag className="w-10 h-10 text-red-300 mx-auto mb-3" />
              <p className="text-red-500 text-sm font-medium mb-2">Connection Error</p>
              <p className="text-gray-500 text-xs mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-cream text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && products.length === 0 && (
            <div className="mx-3 mt-4 p-8 bg-cream border border-warm rounded-xl text-center">
              <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 text-sm">No products available yet</p>
            </div>
          )}

          {/* Bestsellers Section */}
          {!loading && !error && products.length > 0 && (
          <>
            <div className="flex items-center justify-between mx-3 mt-4 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔥</span>
                <span className="font-display text-base tracking-wide text-gray-900">BESTSELLERS</span>
              </div>
              <button className="text-[#D4873A] text-xs font-semibold flex items-center gap-0.5">
                SEE ALL <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mx-3 pb-4">
              {filteredProducts.map((product: Product, index: number) => {
                // Assign badges based on index for demo
                const badges = ['BESTSELLER', 'TOP RATED', 'NEW', 'LIMITED'];
                const badgeColors: Record<string, string> = {
                  'BESTSELLER': 'bg-[#D4873A]',
                  'TOP RATED': 'bg-[#D4873A]',
                  'NEW': 'bg-[#D4873A]',
                  'LIMITED': 'bg-[#D4873A]',
                };
                const badge = badges[index % badges.length];
                
                return (
                  <div 
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className="bg-cream border border-warm overflow-hidden rounded-xl shadow-sm transition-all cursor-pointer active:scale-95 relative"
                  >
                    {/* Badge */}
                    <div className={`absolute top-2 left-2 z-10 px-2 py-0.5 ${badgeColors[badge]} rounded text-white text-[9px] font-bold flex items-center gap-1`}>
                      {badge === 'BESTSELLER' && '🔥'}
                      {badge === 'TOP RATED' && <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />}
                      {badge}
                    </div>
                    
                    {/* Wishlist */}
                    <button 
                      className="absolute top-2 right-2 z-10 w-7 h-7 bg-[#D4873A]/20 backdrop-blur-sm rounded-full flex items-center justify-center"
                      onClick={(e) => { e.stopPropagation(); }}
                    >
                      <Heart className="w-4 h-4 text-[#D4873A]" />
                    </button>

                    {/* Product Image */}
                    <div className="aspect-square relative bg-cream overflow-hidden">
                      <img 
                        src={product.image} 
                        alt={product.name}
                        className="w-full h-full object-cover mix-blend-multiply"
                      />
                    </div>

                    {/* Product Info */}
                    <div className="p-3">
                      <h3 className="text-gray-900 font-bold text-xs truncate">{product.name}</h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="flex">
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} className="w-2.5 h-2.5 fill-[#D4873A] text-[#D4873A]" />
                          ))}
                        </div>
                        <span className="text-gray-500 text-[9px]">({(product as any).reviewCount || 0})</span>
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-[#D4873A] font-bold text-sm">{product.price}</span>
                      </div>
                      <span className="text-gray-500 text-[10px]">
                        or {(parseFloat(product.price.replace('€', '').replace(',', '.')) * 500).toLocaleString()} BOGX
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
          )}
        </>
      )}
      </div>
    </div>
  );
}
