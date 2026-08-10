"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ShoppingCart, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useCart } from "@/context/CartContext";

interface Variant {
  id: number;
  title: string;
  price: string;
  available: boolean;
  image?: string;
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

// Map color names to hex values for visual swatches (Zalando-style)
const COLOR_HEX: Record<string, string> = {
  'black': '#1a1a1a',
  'solid black triblend': '#1a1a1a',
  'charcoal': '#36454f',
  'charcoal-black triblend': '#2d3436',
  'grey': '#808080',
  'gray': '#808080',
  'grey triblend': '#808080',
  'white': '#ffffff',
  'solid white triblend': '#f5f5f5',
  'white fleck triblend': '#f8f8f8',
  'navy': '#000080',
  'navy blazer': '#1f2f4d',
  'blue': '#2563eb',
  'red': '#dc2626',
  'maroon': '#800000',
  'brown': '#8b4513',
  'brown triblend': '#8b4513',
  'tan': '#d2b48c',
  'tan triblend': '#d2b48c',
  'oatmeal': '#f5f0e1',
  'oatmeal triblend': '#f5f0e1',
  'clay': '#b66a50',
  'clay triblend': '#b66a50',
  'emerald': '#50c878',
  'emerald triblend': '#50c878',
  'mustard': '#ffdb58',
  'mustard triblend': '#ffdb58',
  'green': '#16a34a',
  'olive': '#808000',
  'purple': '#7c3aed',
  'pink': '#ec4899',
  'orange': '#f97316',
  'yellow': '#eab308',
  'gold': '#ffd700',
  'silver': '#c0c0c0',
  'heather': '#9ca3af',
};

const getColorHex = (colorName: string): string => {
  const lower = colorName.toLowerCase().trim();
  if (COLOR_HEX[lower]) return COLOR_HEX[lower];
  // Try partial match
  for (const [key, hex] of Object.entries(COLOR_HEX)) {
    if (lower.includes(key) || key.includes(lower)) return hex;
  }
  return '#9ca3af'; // fallback gray
};

// Standard size order for sorting
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];

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

  // Parse variants into color → size groups (Zalando-style)
  const { colors, colorSizeMap, hasColorChoice, hasSizeChoice } = useMemo(() => {
    const colorSet = new Set<string>();
    const sizeSet = new Set<string>();
    const map: Record<string, { size: string; variant: Variant }[]> = {};
    
    (product.variants || []).forEach(v => {
      let color = '__single__';

      // Printful names variants "<Product name> - <Color> / <Size>".
      // Strip the product name prefix, then split on the LAST slash so multi-word
      // colours ("Charcoal-Black Triblend") stay intact.
      let rest = v.title.trim();
      if (rest.toLowerCase().startsWith(product.name.trim().toLowerCase())) {
        rest = rest.slice(product.name.trim().length);
      }
      rest = rest.replace(/^[\s\-–/]+/, '');

      const lastSlash = rest.lastIndexOf('/');
      let size = rest;
      if (lastSlash !== -1) {
        const left = rest.slice(0, lastSlash).trim();
        size = rest.slice(lastSlash + 1).trim();
        if (left) color = left;
      }
      
      // Skip if the "size" is just the product name (no real size info)
      const isRealSize = SIZE_ORDER.includes(size.toUpperCase()) ||
                         /^\d+(\.\d+)?$/.test(size) || // numeric sizes
                         size.length <= 4; // short codes like "S", "M", "L", "XL"
      
      // If it's not a real size and there's no color split, this is a single-variant product
      if (!isRealSize && color === '__single__') {
        // Mark as single variant with no selection needed
        colorSet.add('__none__');
        if (!map['__none__']) map['__none__'] = [];
        map['__none__'].push({ size: '__auto__', variant: v });
        return;
      }
      
      colorSet.add(color);
      sizeSet.add(size);
      
      if (!map[color]) map[color] = [];
      map[color].push({ size, variant: v });
    });
    
    // Sort sizes by standard order
    Object.values(map).forEach(arr => {
      arr.sort((a, b) => {
        const ai = SIZE_ORDER.indexOf(a.size);
        const bi = SIZE_ORDER.indexOf(b.size);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.size.localeCompare(b.size);
      });
    });
    
    // Check if this is a "no selection needed" product
    const isSingleVariantProduct = colorSet.has('__none__') && colorSet.size === 1;
    
    return {
      colors: Array.from(colorSet),
      colorSizeMap: map,
      // Show the colour row only when there are several real colour names
      hasColorChoice: colorSet.size > 1 && !colorSet.has('__single__') && !colorSet.has('__none__'),
      hasSizeChoice: sizeSet.size > 1 && !isSingleVariantProduct,
      isSingleVariantProduct,
    };
  }, [product.variants, product.name]);

  const sizesForColor = useMemo(() => {
    const colorKey = hasColorChoice ? selectedColor : colors[0];
    if (!colorKey || !colorSizeMap[colorKey]) return [];
    return colorSizeMap[colorKey];
  }, [selectedColor, hasColorChoice, colors, colorSizeMap]);

  // Destructure isSingleVariantProduct from the memo
  const isSingleVariantProduct = colors.includes('__none__') && colors.length === 1;

  // Auto-select variant for single-variant products (no user selection needed)
  useEffect(() => {
    if (isSingleVariantProduct && colorSizeMap['__none__']?.[0]?.variant) {
      setSelectedVariant(colorSizeMap['__none__'][0].variant);
    }
  }, [isSingleVariantProduct, colorSizeMap]);

  // Auto-select first color if only one or none selected
  useEffect(() => {
    if (!isSingleVariantProduct && colors.length > 0 && !selectedColor) {
      setSelectedColor(colors[0]);
    }
  }, [colors, selectedColor, isSingleVariantProduct]);

  // When color changes, reset size
  useEffect(() => {
    if (!isSingleVariantProduct) {
      setSelectedSize(null);
      setSelectedVariant(null);
    }
  }, [selectedColor, isSingleVariantProduct]);

  // When size chosen, find the variant
  useEffect(() => {
    if (isSingleVariantProduct || !selectedSize) return;
    const colorKey = hasColorChoice ? selectedColor : colors[0];
    if (!colorKey || !colorSizeMap[colorKey]) return;
    const match = colorSizeMap[colorKey].find(s => s.size === selectedSize);
    setSelectedVariant(match?.variant || null);
  }, [selectedSize, selectedColor, hasColorChoice, colors, colorSizeMap, isSingleVariantProduct]);

  const images = product.images || [product.image];

  // Show the mockup of the picked colour
  useEffect(() => {
    if (!selectedColor || !colorSizeMap[selectedColor]) return;
    const colorImage = colorSizeMap[selectedColor].find(s => s.variant.image)?.variant.image;
    if (!colorImage) return;
    const idx = images.indexOf(colorImage);
    if (idx !== -1) setSelectedImageIndex(idx);
  }, [selectedColor, colorSizeMap, images]);

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

      {/* Variants — Zalando-style: Color swatches + Size buttons */}
      {/* Hide for single-variant products (e.g. "BOGX -Bulls" with no real sizes) */}
      {product.variants && product.variants.length > 0 && !isSingleVariantProduct && (
        <div data-variant-select className="mx-3 mt-4 p-4 bg-cream rounded-xl border border-warm transition-all space-y-5">

          {/* Step 1: Color swatches (only if multiple colors) */}
          {hasColorChoice && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-900 text-sm font-semibold">
                  Color
                </p>
                {selectedColor && selectedColor !== '__single__' && (
                  <span className="text-gray-600 text-sm">{selectedColor}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {colors.filter(c => c !== '__single__').map(color => {
                  const hex = getColorHex(color);
                  const isSelected = selectedColor === color;
                  const isLight = hex === '#ffffff' || hex === '#f5f5f5' || hex === '#f8f8f8' || hex === '#f5f0e1';
                  return (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      title={color}
                      className={`relative w-10 h-10 rounded-full transition-all ${
                        isSelected 
                          ? 'ring-2 ring-offset-2 ring-[#E36B11]' 
                          : 'hover:ring-2 hover:ring-offset-1 hover:ring-gray-300'
                      } ${isLight ? 'border border-gray-300' : ''}`}
                      style={{ backgroundColor: hex }}
                    >
                      {isSelected && (
                        <Check className={`absolute inset-0 m-auto w-5 h-5 ${isLight ? 'text-gray-800' : 'text-white'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Size buttons */}
          {sizesForColor.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-900 text-sm font-semibold">
                  Size
                </p>
                {selectedSize && (
                  <span className="text-gray-600 text-sm">{selectedSize}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {sizesForColor.map(({ size, variant }) => {
                  const isSelected = selectedSize === size;
                  const isAvailable = variant.available;
                  return (
                    <button
                      key={variant.id}
                      onClick={() => isAvailable && setSelectedSize(size)}
                      disabled={!isAvailable}
                      className={`min-w-[48px] px-3 py-2.5 rounded-lg text-sm font-semibold transition-all border ${
                        isSelected
                          ? 'bg-gray-900 text-white border-gray-900'
                          : isAvailable
                            ? 'bg-white text-gray-900 border-gray-300 hover:border-gray-900'
                            : 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed relative'
                      }`}
                    >
                      {size}
                      {!isAvailable && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="w-full h-[1px] bg-gray-300 rotate-[-20deg]" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {!selectedSize && sizesForColor.length > 0 && (
                <p className="text-[#E36B11] text-xs mt-2 font-medium">Please select a size</p>
              )}
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
