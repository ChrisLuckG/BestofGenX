"use client";

import { useState, useEffect } from "react";
import { Check, Package, Mail, Truck, Loader2, AlertCircle } from "lucide-react";
import { useCart } from "@/context/CartContext";
import BrandedModal from "./BrandedModal";

interface OrderData {
  oderId: string;
  items: Array<{
    productName: string;
    variantTitle: string;
    quantity: number;
    price: number;
    image?: string;
  }>;
  total: number;
  status: string;
}

interface CheckoutSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
}

export default function CheckoutSuccessModal({ isOpen, onClose, sessionId }: CheckoutSuccessModalProps) {
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentVerified, setPaymentVerified] = useState<boolean | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const { clearCart } = useCart();

  // Verify payment status with Stripe first
  useEffect(() => {
    if (!isOpen || !sessionId) return;
    
    // Prevent re-running if already verified or errored
    if (paymentVerified !== null) return;
    
    setLoading(true);

    // Timeout after 5 seconds
    const timeout = setTimeout(() => {
      setLoading(false);
      setPaymentVerified(false);
      setVerificationError('Verification timed out. Please check your email for order confirmation.');
    }, 5000);

    // First verify the session with Stripe
    fetch(`/api/shop/verify-session?session_id=${sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.isPaid) {
            setPaymentVerified(true);
            clearCart();
            
            // Then fetch order details
            return fetch(`/api/orders?sessionId=${sessionId}`)
              .then(res => res.json())
              .then(orderData => {
                if (orderData.success && orderData.order) {
                  setOrder(orderData.order);
                }
              });
          } else {
            setPaymentVerified(false);
            setVerificationError(data.paymentStatus === 'unpaid' 
              ? 'Payment was not completed. Please try again.'
              : 'Could not verify payment status.');
          }
        })
        .catch(err => {
          console.error('Verification error:', err);
          setPaymentVerified(false);
          setVerificationError('Could not verify payment. Please check your email or contact support.');
        })
        .finally(() => {
          clearTimeout(timeout);
          setLoading(false);
        });

      return () => clearTimeout(timeout);
  }, [isOpen, sessionId, clearCart, paymentVerified]);

  if (!isOpen) return null;

  return (
    <BrandedModal
      isOpen
      onClose={onClose}
      eyebrow={loading ? 'Checkout' : paymentVerified === false ? 'Checkout' : 'Thanks for your purchase'}
      title={loading ? 'Verifying payment' : paymentVerified === false ? 'Payment not completed' : 'Order confirmed!'}
      icon={loading ? Loader2 : paymentVerified === false ? AlertCircle : Check}
      accent={!loading && paymentVerified === false ? 'red' : 'orange'}
      bandFooter={!loading && paymentVerified === true && order?.oderId ? <p className="text-white/90 text-sm font-bold">#{order.oderId}</p> : undefined}
    >

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-[#E36B11] animate-spin" />
            <p className="text-gray-600 font-medium">Verifying payment...</p>
            <p className="text-gray-400 text-sm mt-1">Please wait</p>
          </div>
        )}

        {/* Payment Failed State */}
        {!loading && paymentVerified === false && (
          <div className="text-center py-6">
            <p className="text-gray-500 text-sm mb-6">{verificationError}</p>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl font-bold bg-gray-800 text-white text-sm hover:bg-gray-700 transition-all"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Success Header - only show when verified */}
        {!loading && paymentVerified === true && (
        <>

        {/* Order Items */}
        {order?.items && order.items.length > 0 && (
          <div className="mb-4 p-3 bg-white rounded-xl border border-warm">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">Your Order</p>
            <div className="space-y-2">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  {item.image && (
                    <img src={item.image} alt="" className="w-12 h-12 rounded-lg object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                    <p className="text-xs text-gray-500">{item.variantTitle} × {item.quantity}</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">€{(item.price * item.quantity).toFixed(2)}</p>
                </div>
              ))}
            </div>
            {order.total > 0 && (
              <div className="mt-3 pt-3 border-t border-warm flex justify-between">
                <span className="text-sm font-medium text-gray-600">Total</span>
                <span className="text-lg font-bold text-[#E36B11]">€{order.total.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {/* Status Steps */}
        <div className="mb-5 p-3 bg-white rounded-xl border border-warm">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-[#E36B11] flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
              <div className="w-0.5 h-6 bg-[#E36B11]" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Order Placed</p>
              <p className="text-xs text-gray-500">Payment confirmed</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                order?.status === 'processing' || order?.status === 'shipped' 
                  ? 'bg-[#E36B11]' : 'bg-gray-200'
              }`}>
                <Package className={`w-4 h-4 ${
                  order?.status === 'processing' || order?.status === 'shipped' 
                    ? 'text-white' : 'text-gray-400'
                }`} />
              </div>
              <div className={`w-0.5 h-6 ${
                order?.status === 'shipped' ? 'bg-[#E36B11]' : 'bg-gray-200'
              }`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Processing</p>
              <p className="text-xs text-gray-500">Being prepared</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                order?.status === 'shipped' ? 'bg-[#E36B11]' : 'bg-gray-200'
              }`}>
                <Truck className={`w-4 h-4 ${
                  order?.status === 'shipped' ? 'text-white' : 'text-gray-400'
                }`} />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Shipped</p>
              <p className="text-xs text-gray-500">On its way to you</p>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="space-y-2 text-sm text-center mb-5">
          <div className="flex items-center justify-center gap-2 text-gray-600">
            <Mail className="w-4 h-4 text-[#E36B11]" />
            <span>Confirmation email on its way</span>
          </div>
        </div>

        {/* Button */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl font-bold bg-[#E36B11] text-white text-sm hover:bg-[#c06a2a] transition-all"
        >
          Continue Shopping
        </button>
        </>
        )}
    </BrandedModal>
  );
}
