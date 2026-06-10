"use client";

import { useState } from "react";
import { ShoppingBag, ShoppingCart, ChevronLeft, ChevronRight, Check } from "lucide-react";
import PageTemplate from "@/components/PageTemplate";
import GenXLoader from "./GenXLoader";
import { useCart } from "@/context/CartContext";
import CartPage from "@/components/CartPage";

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
  images?: string[];
  variants?: Variant[];
  category: "apparel" | "accessories" | "drinkware";
  printifyUrl?: string;
}

interface ProductDetailPageProps {
  product: Product;
  onBack: () => void;
}

export default function ProductDetailPage({ product, onBack }: ProductDetailPageProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const { addToCart, totalItems } = useCart();

  const images = product.images || [product.image];

  const handleAddToCart = () => {
    const variant = selectedVariant || product.variants?.[0];
    if (!variant) {
      alert('Please select a size');
      return;
    }

    addToCart({
      productId: product.id,
      productName: product.name,
      variantId: variant.id,
      variantTitle: variant.title,
      price: parseFloat(variant.price),
      quantity: quantity,
      image: product.image,
    });

    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const nextImage = () => {
    setSelectedImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setSelectedImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Show CartPage
  if (showCart) {
    return (
      <CartPage 
        onBack={() => setShowCart(false)}
        onContinueShopping={() => setShowCart(false)}
      />
    );
  }

  return (
    <PageTemplate 
      title="Best of GenX Merch" 
      icon={<ShoppingBag className="w-5 h-5 text-[#D4873A]" />}
      onBack={onBack}
      rightAction={
        <button 
          onClick={() => setShowCart(true)}
          className="relative p-2"
        >
          <ShoppingCart className="w-6 h-6 text-gray-700" />
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#D4873A] rounded-full text-white text-xs font-bold flex items-center justify-center">
              {totalItems}
            </span>
          )}
        </button>
      }
    >
      {/* Main Image with Navigation */}
      <div className="relative mx-3 mt-2  overflow-hidden bg-gray-800">
        <div className="aspect-square">
          <img 
            src={images[selectedImageIndex]} 
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
        
        {/* Image Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button 
              onClick={prevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={nextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            
            {/* Image Counter */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 rounded-full">
              <span className="text-white text-xs">{selectedImageIndex + 1} / {images.length}</span>
            </div>
          </>
        )}
      </div>

      {/* Image Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 mx-3 mt-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {images.map((img, index) => (
            <button
              key={index}
              onClick={() => setSelectedImageIndex(index)}
              className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                selectedImageIndex === index 
                  ? 'border-[#D4873A]' 
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Product Info */}
      <div className="mx-3 mt-4 p-4 bg-cream rounded-xl border border-warm">
        <h1 className="text-xl font-bold text-gray-900">{product.name}</h1>
        <p className="text-gray-600 text-sm mt-2">{product.description}</p>
        
        <div className="flex items-center gap-2 mt-3">
          <span className="px-2 py-1 bg-[#D4873A]/10 rounded-lg text-[#D4873A] text-xs uppercase font-medium">
            {product.category}
          </span>
        </div>
      </div>

      {/* Variants (Sizes) */}
      {product.variants && product.variants.length > 0 && (
        <div className="mx-3 mt-4 p-4 bg-cream rounded-xl border border-warm">
          <p className="text-gray-500 text-xs mb-3 uppercase tracking-wider font-medium">Select Size</p>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((variant) => (
              <button
                key={variant.id}
                onClick={() => setSelectedVariant(variant)}
                disabled={!variant.available}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                  selectedVariant?.id === variant.id
                    ? 'bg-[#D4873A] text-white border-[#D4873A]'
                    : variant.available
                      ? 'bg-cream text-gray-700 border-warm hover:bg-[#D4873A]/10'
                      : 'bg-cream/50 text-gray-300 border-warm cursor-not-allowed line-through'
                }`}
              >
                {variant.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quantity & Price */}
      <div className="mx-3 mt-4 p-4 bg-cream rounded-xl border border-warm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-xs mb-1 font-medium">Quantity</p>
            <div className="flex items-center gap-3 bg-cream rounded-lg border border-warm px-2">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="p-2 text-gray-500 hover:text-gray-900"
              >
                -
              </button>
              <span className="text-gray-900 font-bold w-8 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                className="p-2 text-gray-500 hover:text-gray-900"
              >
                +
              </button>
            </div>
          </div>
          <div className="text-right">
            <p className="text-gray-500 text-xs font-medium">Total</p>
            <span className="text-2xl font-black text-[#D4873A]">
              €{((parseFloat(selectedVariant?.price || product.price.replace('€', '')) * quantity)).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Add to Cart */}
      <div className="mx-3 mt-4 mb-4">
        <button
          onClick={handleAddToCart}
          disabled={addedToCart}
          className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-lg ${
            addedToCart 
              ? 'bg-green-500 text-white' 
              : 'bg-[#D4873A] hover:bg-[#c06a2a] text-white'
          }`}
        >
          {addedToCart ? (
            <>
              <Check className="w-6 h-6" />
              Added to Cart!
            </>
          ) : (
            <>
              <ShoppingCart className="w-6 h-6" />
              Add to Cart
            </>
          )}
        </button>
      </div>
    </PageTemplate>
  );
}
