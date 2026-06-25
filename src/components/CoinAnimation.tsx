"use client";

import { useState, useEffect } from "react";
import { getCurrencySymbol } from "@/utils/currency";

interface CoinAnimationProps {
  amount: number;
  /** 'gain' = coins fly up, 'loss' = red alarm down, 'hold' = wager parked (gold, gentle) */
  variant?: 'gain' | 'loss' | 'hold';
  onComplete?: () => void;
  /** Desktop mode = bigger, more impactful animation */
  isDesktop?: boolean;
}

export default function CoinAnimation({ amount, variant, onComplete, isDesktop = false }: CoinAnimationProps) {
  const [coins, setCoins] = useState<{ id: number; x: number; delay: number }[]>([]);
  const effectiveVariant: 'gain' | 'loss' | 'hold' = variant ?? (amount < 0 ? 'loss' : 'gain');
  const isNegative = effectiveVariant === 'loss';
  const isHold = effectiveVariant === 'hold';

  // Desktop = more coins, bigger spread
  const coinCount = isDesktop ? 12 : 6;
  const spreadX = isDesktop ? 80 : 40;

  useEffect(() => {
    // Create multiple coins with random positions and delays
    const newCoins = Array.from({ length: coinCount }, (_, i) => ({
      id: i,
      x: Math.random() * spreadX - spreadX / 2,
      delay: i * (isDesktop ? 0.05 : 0.08),
    }));
    setCoins(newCoins);

    // Call onComplete after animation finishes
    const completeTimer = setTimeout(() => {
      onComplete?.();
    }, 1200);

    return () => {
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  // Hold = wager parked: GOLD coins gently settle (no alarm, not "lost")
  if (isHold) {
    return (
      <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
        {/* Soft gold glow */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at top center, rgba(212,135,58,0.25) 0%, rgba(212,135,58,0.08) 50%, transparent 70%)',
            animation: 'goldGlow 1s ease-out forwards',
          }}
        />
        {/* BOGX coins gently parking */}
        {coins.map((coin) => (
          <div
            key={coin.id}
            className="absolute left-1/2 top-12"
            style={{
              animation: 'coinPark 1.1s ease-out forwards',
              animationDelay: `${coin.delay}s`,
              marginLeft: `${coin.x}px`,
            }}
          >
            <img 
              src="/images/bogxcoin.png" 
              alt="" 
              className="w-8 h-8"
              style={{ 
                filter: 'drop-shadow(0 0 8px rgba(212,135,58,0.6))',
              }}
            />
          </div>
        ))}
        {/* "On hold" label */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-28 px-3 py-1 rounded-full bg-[#D4873A]/90 text-white text-xs font-bold tracking-wide"
          style={{ animation: 'goldGlow 1.4s ease-out forwards' }}
        >
          {Math.abs(amount)} {getCurrencySymbol()} on hold
        </div>
        <style>{`
          @keyframes coinPark {
            0% { transform: translateY(0) scale(1.1); opacity: 0; }
            30% { opacity: 1; }
            100% { transform: translateY(70px) scale(0.95); opacity: 0.9; }
          }
          @keyframes goldGlow {
            0% { opacity: 0; }
            30% { opacity: 1; }
            100% { opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  // Negative amount = BOGX coins flying DOWN from header with RED glow
  if (isNegative) {
    const coinSize = isDesktop ? 'w-14 h-14' : 'w-10 h-10';
    return (
      <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
        {/* Red flash overlay - ALARM! */}
        <div 
          className="absolute inset-0"
          style={{ 
            background: 'radial-gradient(circle at top center, rgba(255,0,0,0.4) 0%, rgba(255,0,0,0.1) 50%, transparent 70%)',
            animation: 'redFlash 0.8s ease-out forwards' 
          }}
        />
        
        {/* Flying BOGX coins DOWN from header with red glow */}
        {coins.map((coin) => (
          <div
            key={coin.id}
            className="absolute left-1/2 top-12"
            style={{
              animation: 'coinDown 1s ease-in forwards',
              animationDelay: `${coin.delay}s`,
              marginLeft: `${coin.x * 1.5}px`,
            }}
          >
            <img 
              src="/images/bogxcoin.png" 
              alt="" 
              className={coinSize}
              style={{ 
                filter: 'drop-shadow(0 0 10px rgba(255,0,0,0.7))',
                opacity: 0.8,
              }}
            />
          </div>
        ))}
        <style>{`
          @keyframes coinDown {
            0% { transform: translateY(0) scale(1.2) rotate(0deg); opacity: 1; }
            50% { transform: translateY(200px) scale(1) rotate(180deg); opacity: 0.8; }
            100% { transform: translateY(${isDesktop ? '500px' : '400px'}) scale(0.3) rotate(360deg); opacity: 0; }
          }
          @keyframes redFlash {
            0% { opacity: 0.4; }
            50% { opacity: 0.2; }
            100% { opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  // Positive amount = coins flying UP to header
  const displayAmount = Math.abs(amount).toFixed(2).replace('.', ',');
  
  if (isDesktop) {
    // DESKTOP: Bigger coins flying up to header score box with amount label
    return (
      <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
        {/* Amount label - appears briefly in center */}
        <div 
          className="absolute left-1/2 top-1/2 -translate-x-1/2"
          style={{ animation: 'desktopAmountPop 1.4s ease-out forwards' }}
        >
          <span className="text-4xl font-bold text-[#C9A227]" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
            +{displayAmount}
          </span>
        </div>
        
        {/* Flying BOGX coins to header - start from center, fly to header */}
        {coins.map((coin) => (
          <div
            key={coin.id}
            className="absolute left-1/2 top-1/2"
            style={{
              animation: 'desktopCoinUp 1.2s ease-out forwards',
              animationDelay: `${coin.delay}s`,
              marginLeft: `${coin.x}px`,
            }}
          >
            <img 
              src="/images/bogxcoin.png" 
              alt="" 
              className="w-14 h-14"
              style={{ 
                filter: 'drop-shadow(0 0 8px rgba(212,135,58,0.6))',
              }}
            />
          </div>
        ))}
        
        <style>{`
          @keyframes desktopCoinUp {
            0% { transform: translateY(0) scale(0.6) rotate(0deg); opacity: 0; }
            20% { opacity: 1; transform: translateY(-20px) scale(1.2) rotate(30deg); }
            100% { transform: translateY(-45vh) scale(0.5) rotate(360deg); opacity: 0; }
          }
          @keyframes desktopAmountPop {
            0% { transform: translate(-50%, 0) scale(0.5); opacity: 0; }
            15% { transform: translate(-50%, -40px) scale(1.3); opacity: 1; }
            40% { transform: translate(-50%, -70px) scale(1); opacity: 1; }
            100% { transform: translate(-50%, -120px) scale(0.8); opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  // MOBILE: BOGX coin flying up to header with amount label
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {/* Amount label - appears briefly in center */}
      <div 
        className="absolute left-1/2 bottom-1/3 -translate-x-1/2"
        style={{ animation: 'amountPop 1.2s ease-out forwards' }}
      >
        <span className="text-2xl font-bold text-[#C9A227]" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
          +{displayAmount}
        </span>
      </div>
      
      {/* Flying BOGX coins to header */}
      {coins.map((coin) => (
        <div
          key={coin.id}
          className="absolute left-1/2 bottom-1/3"
          style={{
            animation: 'mobileCoinUp 1s ease-out forwards',
            animationDelay: `${coin.delay}s`,
            marginLeft: `${coin.x}px`,
          }}
        >
          <img 
            src="/images/bogxcoin.png" 
            alt="" 
            className="w-10 h-10"
            style={{ 
              filter: 'drop-shadow(0 0 6px rgba(212,135,58,0.6))',
            }}
          />
        </div>
      ))}
      <style>{`
        @keyframes mobileCoinUp {
          0% { transform: translateY(0) scale(0.5) rotate(0deg); opacity: 0; }
          20% { opacity: 1; transform: translateY(-20px) scale(1) rotate(30deg); }
          100% { transform: translateY(-55vh) scale(0.4) rotate(360deg); opacity: 0; }
        }
        @keyframes amountPop {
          0% { transform: translate(-50%, 0) scale(0.5); opacity: 0; }
          15% { transform: translate(-50%, -30px) scale(1.2); opacity: 1; }
          40% { transform: translate(-50%, -50px) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -80px) scale(0.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
