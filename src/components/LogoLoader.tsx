"use client";

import { useState, useEffect } from "react";

// Fun Gen X loading messages
const LOADING_MESSAGES = [
  "Loading the good stuff...",
  "Rewinding the tape...",
  "Adjusting the antenna...",
  "Almost there...",
  "Warming up the CRT...",
  "Finding the remote...",
  "Blowing into the cartridge...",
  "Tuning in...",
  "Setting the VCR...",
  "Hang tight...",
  "Worth the wait...",
  "Getting nostalgic...",
  "Preparing awesomeness...",
  "Loading memories...",
];

interface LogoLoaderProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  showMessages?: boolean; // Show rotating fun messages
}

export default function LogoLoader({ size = "md", text, showMessages = false }: LogoLoaderProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [dots, setDots] = useState("");
  const [glowIntensity, setGlowIntensity] = useState(0.5);

  // Rotate messages every 2 seconds
  useEffect(() => {
    if (!showMessages) return;
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [showMessages]);

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? "" : prev + ".");
    }, 400);
    return () => clearInterval(interval);
  }, []);

  // Pulse glow intensity
  useEffect(() => {
    const interval = setInterval(() => {
      setGlowIntensity(prev => prev === 0.5 ? 0.8 : 0.5);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-20 h-20",
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const displayText = showMessages ? LOADING_MESSAGES[messageIndex] : text;

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      {/* Logo with pulse animation */}
      <div className="relative">
        {/* Glow effect - pulsing */}
        <div 
          className={`absolute inset-0 ${sizeClasses[size]} bg-[#D4873A] rounded-full blur-xl transition-opacity duration-500`}
          style={{ opacity: glowIntensity }}
        />
        
        {/* Outer spinning ring */}
        <div className={`absolute -inset-2 border border-[#D4873A]/20 rounded-full animate-spin`} style={{ animationDuration: '3s' }} />
        
        {/* Logo */}
        <div className={`relative ${sizeClasses[size]} animate-bounce`} style={{ animationDuration: '1.5s' }}>
          <img 
            src="/images/genxlogo1.png" 
            alt="Best of Gen X" 
            className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(212,240,0,0.8)]"
          />
        </div>
        
        {/* Inner spinning ring */}
        <div className={`absolute inset-0 ${sizeClasses[size]} border-2 border-transparent border-t-[#D4873A] border-r-[#D4873A]/50 rounded-full animate-spin`} />
        
        {/* Reverse spinning ring */}
        <div 
          className={`absolute -inset-1 border border-transparent border-b-[#D4873A]/30 border-l-[#D4873A]/10 rounded-full`}
          style={{ animation: 'spin 2s linear infinite reverse' }}
        />
      </div>
      
      {/* Loading text with fade transition */}
      {displayText && (
        <p 
          className={`${textSizeClasses[size]} font-bold text-[#D4873A]/80 text-center transition-all duration-300`}
          key={messageIndex}
          style={{ animation: showMessages ? 'fadeInUp 0.3s ease-out' : undefined }}
        >
          {displayText}
        </p>
      )}
      
      {/* Progress bar style dots */}
      <div className="flex gap-1.5 items-center">
        {[0, 1, 2, 3, 4].map((i) => (
          <div 
            key={i}
            className="w-2 h-2 rounded-full transition-all duration-300"
            style={{
              backgroundColor: i <= dots.length + 1 ? '#D4873A' : 'rgba(212, 240, 0, 0.2)',
              transform: i === dots.length ? 'scale(1.3)' : 'scale(1)',
              boxShadow: i <= dots.length + 1 ? '0 0 8px rgba(212, 240, 0, 0.6)' : 'none'
            }}
          />
        ))}
      </div>

      {/* CSS for fade animation */}
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
