"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ShoppingCart, ChevronLeft, ChevronRight, Check } from "lucide-react";
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
  images?: string[];
  variants?: Variant[];
  category: "apparel" | "accessories" | "drinkware";
  printifyUrl?: string;
}

interface ProductDetailInlineProps {
  product: Product;
  onClose: () => void;
}

export default function ProductDetailInline({ product, onClose }: ProductDetailInlineProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const lastTouchDistance = useRef<number | null>(null);
  const { addToCart } = useCart();

  // Parse variants into color → size groups
  const colors = useMemo(() => {
    const seen = new Set<string>();
    return (product.variants || []).reduce<string[]>((acc, v) => {
      const color = v.title.includes(' / ') ? v.title.split(' / ')[0] : '__single__';
      if (!seen.has(color)) { seen.add(color); acc.push(color); }
      return acc;
    }, []);
  }, [product.variants]);

  const hasColorChoice = colors.length > 1 && colors[0] !== '__single__';

  const sizesForColor = useMemo(() => {
    const colorKey = hasColorChoice ? selectedColor : colors[0];
    if (!colorKey) return [];
    return (product.variants || []).filter(v =>
      colorKey === '__single__' ? true : v.title.startsWith(colorKey + ' / ')
    );
  }, [selectedColor, hasColorChoice, colors, product.variants]);

  // Auto-select color if only one
  useEffect(() => {
    if (!hasColorChoice && colors.length > 0) setSelectedColor(colors[0]);
  }, [hasColorChoice, colors]);

  // When color changes, reset size
  useEffect(() => {
    setSelectedSize(null);
    setSelectedVariant(null);
  }, [selectedColor]);

  // When size chosen, find the variant
  useEffect(() => {
    if (!selectedSize) return;
    const colorKey = hasColorChoice ? selectedColor : colors[0];
    const match = (product.variants || []).find(v =>
      colorKey === '__single__' ? v.title === selectedSize : v.title === `${colorKey} / ${selectedSize}`
    );
    setSelectedVariant(match || null);
  }, [selectedSize, selectedColor, hasColorChoice, colors, product.variants]);

  const images = product.images || [product.image];

  // Reset zoom when image changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [selectedImageIndex]);

  const handleAddToCart = () => {
    // Use selected variant, or auto-select first available if only one option
    let variant = selectedVariant;
    if (!variant && product.variants && product.variants.length > 0) {
      // If only one variant, auto-select it
      if (product.variants.length === 1) {
        variant = product.variants[0];
        setSelectedVariant(variant);
      } else {
        // Multiple variants - highlight the selection area
        const selectArea = document.querySelector('[data-variant-select]');
        if (selectArea) {
          selectArea.classList.add('ring-2', 'ring-red-500');
          setTimeout(() => selectArea.classList.remove('ring-2', 'ring-red-500'), 2000);
        }
        return;
      }
    }
    
    if (!variant) return;

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

  return (
    <div className="pb-4">
      {/* Back Button */}
      <div className="flex items-center px-3 pt-4 pb-3 border-b border-warm">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E36B11] rounded-lg text-white text-sm font-semibold hover:bg-[#c06a2a] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      {/* Main Image with Pinch-to-Zoom */}
      <div 
        className="relative mx-3 mt-3 overflow-hidden bg-gray-800 border border-[#E36B11]/20 rounded-xl"
        onTouchStart={(e) => {
          if (e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            lastTouchDistance.current = Math.hypot(
              touch2.clientX - touch1.clientX,
              touch2.clientY - touch1.clientY
            );
          } else if (e.touches.length === 1 && scale > 1) {
            setIsDragging(true);
            setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2) {
            e.preventDefault();
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const distance = Math.hypot(
              touch2.clientX - touch1.clientX,
              touch2.clientY - touch1.clientY
            );
            if (lastTouchDistance.current !== null) {
              const delta = distance - lastTouchDistance.current;
              const newScale = Math.min(Math.max(scale + delta * 0.01, 1), 4);
              setScale(newScale);
              if (newScale === 1) setPosition({ x: 0, y: 0 });
            }
            lastTouchDistance.current = distance;
          } else if (e.touches.length === 1 && scale > 1 && isDragging) {
            const touch = e.touches[0];
            const deltaX = touch.clientX - dragStart.x;
            const deltaY = touch.clientY - dragStart.y;
            setPosition({ x: position.x + deltaX, y: position.y + deltaY });
            setDragStart({ x: touch.clientX, y: touch.clientY });
          }
        }}
        onTouchEnd={() => {
          lastTouchDistance.current = null;
          setIsDragging(false);
        }}
      >
        <div className="aspect-square overflow-hidden">
          <img 
            src={images[selectedImageIndex]} 
            alt={product.name}
            className="w-full h-full object-cover select-none"
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              touchAction: 'none',
            }}
            draggable={false}
          />
        </div>
        
        {/* Image Navigation Arrows - only when not zoomed */}
        {images.length > 1 && scale === 1 && (
          <>
            <button 
              onClick={prevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white hover:bg-black/70 rounded-full"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={nextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white hover:bg-black/70 rounded-full"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            
            {/* Image Counter */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 rounded-full">
              <span className="text-white text-xs">{selectedImageIndex + 1} / {images.length}</span>
            </div>
          </>
        )}
        
        {/* Zoom indicator */}
        {scale > 1 && (
          <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 rounded text-white text-xs font-medium">
            {Math.round(scale * 100)}%
          </div>
        )}
        
        {/* Reset zoom button when zoomed */}
        {scale > 1 && (
          <button 
            onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }}
            className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/70 hover:bg-black/90 rounded-lg text-white text-xs font-medium"
          >
            Reset
          </button>
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
                  ? 'border-[#E36B11]' 
                  : 'border-warm opacity-70 hover:opacity-100'
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
      </div>

      {/* Variants — 2-step Color → Size */}
      {product.variants && product.variants.length > 0 && (
        <div data-variant-select className="mx-3 mt-4 p-4 bg-cream rounded-xl border border-warm transition-all space-y-4">

          {/* Step 1: Color (only if multiple colors) */}
          {hasColorChoice && (
            <div>
              <p className="text-gray-500 text-xs mb-2 uppercase tracking-wider font-medium">
                Color{selectedColor ? <span className="text-gray-900 normal-case tracking-normal ml-1">— {selectedColor}</span> : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                {colors.map(color => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                      selectedColor === color
                        ? 'bg-[#E36B11] text-white border-[#E36B11]'
                        : 'bg-cream text-gray-700 border-warm hover:bg-[#E36B11]/10'
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Size */}
          {sizesForColor.length > 0 && (
            <div>
              <p className="text-gray-500 text-xs mb-2 uppercase tracking-wider font-medium">Size</p>
              <div className="flex flex-wrap gap-2">
                {sizesForColor.map(variant => {
                  const sizeLabel = variant.title.includes(' / ')
                    ? variant.title.split(' / ').slice(1).join(' / ')
                    : variant.title;
                  const isSelected = selectedSize === sizeLabel;
                  return (
                    <button
                      key={variant.id}
                      onClick={() => setSelectedSize(sizeLabel)}
                      disabled={!variant.available}
                      className={`w-14 py-2 rounded-lg text-sm font-bold transition-all border ${
                        isSelected
                          ? 'bg-[#E36B11] text-white border-[#E36B11]'
                          : variant.available
                            ? 'bg-cream text-gray-700 border-warm hover:bg-[#E36B11]/10'
                            : 'bg-cream/50 text-gray-300 border-warm cursor-not-allowed line-through'
                      }`}
                    >
                      {sizeLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
            {(() => {
              const priceStr = selectedVariant?.price || product.variants?.[0]?.price || product.price.replace('€', '');
              const price = parseFloat(priceStr) || 0;
              const total = price * quantity;
              return (
                <>
                  <span className="text-2xl font-black text-[#E36B11]">
                    €{total.toFixed(2)}
                  </span>
                  <p className="text-gray-500 text-sm font-medium">
                    or {(total * 500).toLocaleString()} BOGX
                  </p>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Add to Cart */}
      <div className="mx-3 mt-4">
        <button
          onClick={handleAddToCart}
          disabled={addedToCart}
          className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-lg ${
            addedToCart 
              ? 'bg-[#E36B11] text-white' 
              : 'bg-[#E36B11] text-white hover:bg-[#c06a2a]'
          }`}
        >
          {addedToCart ? (
            <>
              <Check className="w-6 h-6" />
              Added!
            </>
          ) : (
            <>
              <ShoppingCart className="w-6 h-6" />
              Add to Cart
            </>
          )}
        </button>
      </div>
    </div>
  );
}
