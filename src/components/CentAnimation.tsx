"use client";

import { useState, useEffect } from "react";
import { formatCurrency, getCurrencySymbol } from "@/utils/currency";

interface CentAnimationProps {
  amount: number; // in cents, e.g. 50 = 0.50€
  onComplete?: () => void;
}

export default function CentAnimation({ amount, onComplete }: CentAnimationProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [showCoins, setShowCoins] = useState(true);
  const [coins, setCoins] = useState<{ id: number; x: number; delay: number }[]>([]);

  useEffect(() => {
    // Create flying coins
    const newCoins = Array.from({ length: 5 }, (_, i) => ({
      id: i,
      x: Math.random() * 60 - 30,
      delay: i * 0.1,
    }));
    setCoins(newCoins);

    // Count up animation
    const duration = 1200; // 1.2 seconds
    const steps = 30;
    const stepDuration = duration / steps;
    const increment = amount / steps;
    
    let currentStep = 0;
    const countInterval = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(amount);
        clearInterval(countInterval);
      } else {
        // Easing: start slow, speed up, slow down at end
        const progress = currentStep / steps;
        const easedProgress = progress < 0.5 
          ? 2 * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        setDisplayValue(Math.round(easedProgress * amount));
      }
    }, stepDuration);

    // Complete after animation
    const completeTimer = setTimeout(() => {
      setShowCoins(false);
      onComplete?.();
    }, 2000);

    return () => {
      clearInterval(countInterval);
      clearTimeout(completeTimer);
    };
  }, [amount, onComplete]);

  // Format cents to currency string
  const formatCents = (cents: number) => {
    return `${formatCurrency(cents)}${getCurrencySymbol()}`;
  };

  if (!showCoins) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Centered counter display */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div 
          className="bg-cream/95 backdrop-blur-sm rounded-2xl px-8 py-5 shadow-2xl border border-[#D4873A]/30"
          style={{
            animation: 'popIn 0.3s ease-out forwards'
          }}
        >
          <div className="text-center">
            <div className="text-[#D4873A] text-4xl font-black tabular-nums">
              +{formatCents(displayValue)}
            </div>
            <div className="text-gray-500 text-sm mt-1 font-medium">
              Artikel gelesen
            </div>
          </div>
        </div>
      </div>

      {/* Flying euro coins */}
      {coins.map((coin) => (
        <div
          key={coin.id}
          className="absolute left-1/2 bottom-1/3"
          style={{
            animation: 'coinFlyUp 1.2s ease-out forwards',
            animationDelay: `${coin.delay}s`,
            marginLeft: `${coin.x}px`,
          }}
        >
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-[#D4873A]"
            style={{ 
              background: 'linear-gradient(145deg, #D4873A 0%, #c06a2a 100%)',
              boxShadow: '0 4px 15px rgba(212, 240, 0, 0.5)'
            }}
          >
            <span className="text-black text-sm font-bold">{getCurrencySymbol()}</span>
          </div>
        </div>
      ))}

      <style>{`
        @keyframes popIn {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes coinFlyUp {
          0% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; }
          50% { transform: translateY(-150px) scale(0.9) rotate(180deg); opacity: 0.8; }
          100% { transform: translateY(-300px) scale(0.5) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
