"use client";

import { useState } from "react";
import { X, CreditCard, Check, ShieldCheck } from "lucide-react";
import LogoLoader from "./LogoLoader";

interface PaymentPackage {
  points: number;
  price: string;
  priceValue: number; // in cents
}

interface PaymentModalProps {
  isOpen: boolean;
  package_: PaymentPackage | null;
  onClose: () => void;
  onSuccess: (points: number) => void;
}

export default function PaymentModal({ isOpen, package_, onClose, onSuccess }: PaymentModalProps) {
  const [step, setStep] = useState<'confirm' | 'processing' | 'success'>('confirm');
  const [selectedMethod, setSelectedMethod] = useState<'card' | 'paypal' | 'apple'>('card');

  if (!isOpen || !package_) return null;

  const handlePurchase = async () => {
    setStep('processing');
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // TODO: Integrate real payment provider (Stripe, PayPal, etc.)
    // For now, we'll just add the points
    
    setStep('success');
    
    // Auto close after success
    setTimeout(() => {
      onSuccess(package_.points);
      setStep('confirm');
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => step === 'confirm' && onClose()}
      />
      
      {/* Modal */}
      <div className="relative w-[90%] max-w-sm bg-cream rounded-2xl shadow-xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-warm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#D4873A] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">P</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900">Buy BOGX</h2>
          </div>
          {step === 'confirm' && (
            <button 
              onClick={onClose}
              className="p-1.5 bg-cream rounded-full hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          
          {step === 'confirm' && (
            <>
              {/* Package Info */}
              <div className="bg-[#D4873A]/10 p-4 rounded-xl border border-[#D4873A]/30 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider">You're buying</p>
                    <p className="text-2xl font-black text-gray-900">{package_.points.toLocaleString()} <span className="text-sm font-normal text-gray-500">BOGX</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-500 text-xs uppercase tracking-wider">Price</p>
                    <p className="text-2xl font-black text-[#D4873A]">{package_.price}</p>
                  </div>
                </div>
              </div>

              {/* Payment Methods */}
              <p className="text-[#D4873A] text-[10px] mb-2 uppercase tracking-widest font-semibold">Payment Method</p>
              <div className="space-y-2 mb-4">
                <button
                  onClick={() => setSelectedMethod('card')}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    selectedMethod === 'card' 
                      ? 'bg-[#D4873A]/10 border-[#D4873A]' 
                      : 'bg-cream border-warm hover:bg-cream'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    selectedMethod === 'card' ? 'bg-[#D4873A]/20' : 'bg-cream border border-warm'
                  }`}>
                    <CreditCard className={`w-5 h-5 ${selectedMethod === 'card' ? 'text-[#D4873A]' : 'text-gray-500'}`} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-gray-900 font-medium text-sm">Credit / Debit Card</p>
                    <p className="text-gray-600 text-xs">Visa, Mastercard, AMEX</p>
                  </div>
                  {selectedMethod === 'card' && (
                    <div className="w-5 h-5 bg-[#D4873A] rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>

                <button
                  onClick={() => setSelectedMethod('paypal')}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    selectedMethod === 'paypal' 
                      ? 'bg-[#D4873A]/10 border-[#D4873A]' 
                      : 'bg-cream border-warm hover:bg-cream'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    selectedMethod === 'paypal' ? 'bg-[#D4873A]/20' : 'bg-cream border border-warm'
                  }`}>
                    <span className={`text-lg font-bold ${selectedMethod === 'paypal' ? 'text-[#D4873A]' : 'text-gray-500'}`}>P</span>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-gray-900 font-medium text-sm">PayPal</p>
                    <p className="text-gray-600 text-xs">Fast & secure</p>
                  </div>
                  {selectedMethod === 'paypal' && (
                    <div className="w-5 h-5 bg-[#D4873A] rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>

                <button
                  onClick={() => setSelectedMethod('apple')}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    selectedMethod === 'apple' 
                      ? 'bg-[#D4873A]/10 border-[#D4873A]' 
                      : 'bg-cream border-warm hover:bg-cream'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    selectedMethod === 'apple' ? 'bg-[#D4873A]/20' : 'bg-cream border border-warm'
                  }`}>
                    <span className="text-lg">⌘</span>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-gray-900 font-medium text-sm">Apple Pay</p>
                    <p className="text-gray-600 text-xs">Quick checkout</p>
                  </div>
                  {selectedMethod === 'apple' && (
                    <div className="w-5 h-5 bg-[#D4873A] rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              </div>

              {/* Security Note */}
              <div className="flex items-center justify-center gap-2 text-gray-600 text-[10px] mb-4">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Secure payment powered by Stripe</span>
              </div>

              {/* Purchase Button */}
              <button
                onClick={handlePurchase}
                className="w-full py-4 bg-[#D4873A] rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#c4e000] transition-all"
              >
                Pay {package_.price}
              </button>
            </>
          )}

          {step === 'processing' && (
            <div className="py-12 flex flex-col items-center">
              <LogoLoader size="lg" />
              <p className="text-gray-900 font-bold mt-6">Processing Payment...</p>
              <p className="text-gray-500 text-sm mt-1">Please wait</p>
            </div>
          )}

          {step === 'success' && (
            <div className="py-12 flex flex-col items-center">
              <div className="w-16 h-16 bg-[#D4873A]/20 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-[#D4873A]" />
              </div>
              <p className="text-gray-900 font-bold mt-6">Payment Successful!</p>
              <p className="text-[#D4873A] text-xl font-black mt-2">+{package_.points.toLocaleString()} BOGX</p>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}
