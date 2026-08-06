"use client";

import { useState } from "react";
import { ShoppingCart, Trash2, Plus, Minus, ShoppingBag, CreditCard, Check, Coins } from "lucide-react";
import PageTemplate from "@/components/PageTemplate";
import LogoLoader from "@/components/LogoLoader";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";

interface CartPageProps {
  onBack: () => void;
  onContinueShopping: () => void;
  userCoins?: number;
  onCoinsUsed?: (amount: number) => void;
}

// BOGX to EUR conversion (1 BOGX = 1 EUR)
const BOGX_PER_EUR = 1;

export default function CartPage({ onBack, onContinueShopping, userCoins = 0, onCoinsUsed }: CartPageProps) {
  const { items, removeFromCart, updateQuantity, totalItems, totalPrice, clearCart } = useCart();
  const { user } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'points'>('cash');
  
  // Calculate BOGX needed for purchase (1 BOGX = 1 EUR)
  const bogxNeeded = Math.ceil(totalPrice * BOGX_PER_EUR);
  const hasEnoughPoints = userCoins >= bogxNeeded;

  const handleCheckout = async () => {
    if (items.length === 0) return;
    
    // Check points if paying with points
    if (paymentMethod === 'points') {
      if (!hasEnoughPoints) {
        alert(`Not enough BOGX! You need ${bogxNeeded.toLocaleString()} BOGX but have ${userCoins.toLocaleString()}.`);
        return;
      }
      if (!user?.id) {
        alert('Please login to pay with points.');
        return;
      }
    }
    
    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/shop/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cartItems: items.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
          paymentMethod,
          userId: user?.id,
          pointsToDeduct: paymentMethod === 'points' ? bogxNeeded : 0,
          returnPath: typeof window !== 'undefined' ? window.location.pathname : '/mobile',
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        if (paymentMethod === 'points') {
          // Deduct points locally
          onCoinsUsed?.(bogxNeeded);
          clearCart();
          alert('🎉 Order placed successfully! Your points have been deducted.');
          onContinueShopping();
        } else if (data.url) {
          // Redirect to Stripe checkout for payment
          window.location.href = data.url;
        }
      } else {
        alert(data.error || 'Checkout failed');
      }
    } catch (err) {
      alert('Failed to start checkout');
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <PageTemplate 
      title={`Cart (${totalItems})`}
      icon={<ShoppingCart className="w-5 h-5 text-[#E36B11]" />}
      onBack={onBack}
    >
      {/* Processing Modal Overlay */}
      {checkoutLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-cream rounded-2xl p-8 mx-6 shadow-2xl border border-warm max-w-sm w-full text-center">
            <LogoLoader size="md" />
            <h3 className="font-display text-xl text-gray-900 mt-4 mb-2">Processing Order</h3>
            <p className="text-gray-500 text-sm">Please wait while we redirect you to checkout...</p>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <ShoppingBag className="w-16 h-16 text-gray-200 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
          <p className="text-gray-500 text-sm text-center mb-6">Add some products to get started</p>
          <button
            onClick={onContinueShopping}
            className="px-6 py-3 rounded-xl bg-[#E36B11] text-white font-bold"
          >
            Continue Shopping
          </button>
        </div>
      ) : (
        <>
          {/* Cart Items */}
          <div className="mx-3 mt-2 space-y-3">
            {items.map((item) => (
              <div 
                key={`${item.productId}-${item.variantId}`}
                className="flex gap-3 p-3 rounded-xl bg-cream border border-warm"
              >
                {/* Image */}
                <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                  <img src={item.image} alt={item.productName} className="w-full h-full object-cover" />
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-gray-900 font-bold text-sm truncate">{item.productName}</h3>
                  <p className="text-gray-500 text-xs">{item.variantTitle}</p>
                  <p className="text-[#E36B11] font-bold mt-1">{item.price.toFixed(2)}€</p>
                </div>
                
                {/* Quantity & Delete */}
                <div className="flex flex-col items-end justify-between">
                  <button
                    onClick={() => removeFromCart(item.productId, item.variantId)}
                    className="p-1.5 text-gray-600 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  
                  <div className="flex items-center gap-2 bg-cream rounded-lg border border-warm">
                    <button
                      onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
                      className="p-1.5 text-gray-500 hover:text-gray-700"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-gray-900 font-medium text-sm w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                      className="p-1.5 text-gray-500 hover:text-gray-700"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Payment Method Selection */}
          <div className="mx-3 mt-4 p-4 bg-cream rounded-xl border border-warm">
            <p className="text-[#E36B11] text-[10px] mb-3 uppercase tracking-widest font-semibold">Payment Method</p>
            
            <div className="space-y-2 mb-4">
              {/* Cash Payment */}
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  paymentMethod === 'cash' 
                    ? 'bg-[#E36B11]/10 border-[#E36B11]' 
                    : 'bg-cream border-warm hover:bg-cream'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
                  paymentMethod === 'cash' ? 'border-[#E36B11] bg-[#E36B11]/10' : 'border-warm bg-cream'
                }`}>
                  <CreditCard className={`w-5 h-5 ${paymentMethod === 'cash' ? 'text-[#E36B11]' : 'text-gray-600'}`} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-gray-900 font-medium text-sm">Pay with Cash</p>
                  <p className="text-gray-600 text-xs">Credit card, PayPal, etc.</p>
                </div>
                {paymentMethod === 'cash' && (
                  <div className="w-5 h-5 rounded bg-[#E36B11] flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>

              {/* Points Payment */}
              <button
                onClick={() => setPaymentMethod('points')}
                disabled={!user}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  paymentMethod === 'points' 
                    ? 'bg-[#E36B11]/10 border-[#E36B11]' 
                    : 'bg-cream border-warm hover:bg-cream'
                } ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
                  paymentMethod === 'points' ? 'border-[#E36B11] bg-[#E36B11]/10' : 'border-warm bg-cream'
                }`}>
                  <Coins className={`w-5 h-5 ${paymentMethod === 'points' ? 'text-[#E36B11]' : 'text-gray-600'}`} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-gray-900 font-medium text-sm">Pay with BOGX</p>
                  <p className={`text-xs ${hasEnoughPoints ? 'text-[#E36B11]' : 'text-red-400'}`}>
                    {bogxNeeded.toLocaleString()} BOGX needed · You have {userCoins.toLocaleString()} BOGX
                  </p>
                </div>
                {paymentMethod === 'points' && (
                  <div className="w-5 h-5 rounded bg-[#E36B11] flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            </div>

            {/* Points warning if not enough */}
            {paymentMethod === 'points' && !hasEnoughPoints && (
              <div className="mb-4 p-2 rounded-lg bg-red-50 border border-red-200 text-red-500 text-xs text-center">
                Not enough coins! You need {(bogxNeeded - userCoins).toLocaleString()} more.
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="mx-3 mt-3 p-4 bg-cream rounded-xl border border-warm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-500">Subtotal ({totalItems} items)</span>
              <span className="text-gray-900 font-bold">{totalPrice.toFixed(2)}€</span>
            </div>
            {paymentMethod === 'points' && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-500">BOGX equivalent</span>
                <span className="text-[#E36B11] font-bold">{bogxNeeded.toLocaleString()} BOGX</span>
              </div>
            )}
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-500">Shipping</span>
              <span className="text-gray-600 text-sm">Calculated at checkout</span>
            </div>
            
            <button
              onClick={handleCheckout}
              disabled={checkoutLoading || (paymentMethod === 'points' && !hasEnoughPoints)}
              className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 bg-[#E36B11] hover:bg-[#c06a2a] text-white disabled:opacity-50 text-lg"
            >
              {paymentMethod === 'points' ? (
                <Coins className="w-6 h-6" />
              ) : (
                <ShoppingCart className="w-6 h-6" />
              )}
              {paymentMethod === 'points' 
                ? `Pay ${bogxNeeded.toLocaleString()} BOGX` 
                : `Checkout · ${totalPrice.toFixed(2)}€`}
            </button>
          </div>

          {/* Continue Shopping */}
          <div className="mx-3 mt-3 mb-4">
            <button
              onClick={onContinueShopping}
              className="w-full py-3 rounded-xl font-medium text-gray-500 hover:text-gray-700 border border-warm hover:border-gray-300"
            >
              Continue Shopping
            </button>
          </div>
        </>
      )}
    </PageTemplate>
  );
}
