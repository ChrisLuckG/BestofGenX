"use client";

import { useState, useEffect, useRef } from "react";
import { Play, ChevronUp, Eye, Gift, HelpCircle, X } from "lucide-react";
import { sounds } from "@/utils/sounds";

interface BonusAdCardProps {
  adData?: {
    _id?: string;
    title: string;
    description?: string;
    previewImage: string;
    videoUrl?: string;
    duration: number; // in seconds
    maxReward: number;
  };
  nextCardTheme?: string;
  onComplete?: (reward: number) => void;
  onStart?: (reward: number) => void;
  onBlockSwipe?: (blocked: boolean) => void;
  disabled?: boolean;
  currentCard?: number;
  totalCards?: number;
  alreadyPlayed?: boolean;
  earnedReward?: number;
}

export default function BonusAdCard({
  adData,
  nextCardTheme,
  onComplete,
  onStart,
  onBlockSwipe,
  disabled = false,
  currentCard = 0,
  totalCards = 0,
  alreadyPlayed = false,
  earnedReward = 0,
}: BonusAdCardProps) {
  const [gameState, setGameState] = useState<"preview" | "watching" | "result">("preview");
  const [currentPoints, setCurrentPoints] = useState(0);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [watchProgress, setWatchProgress] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Default fallback data
  const defaultData = {
    title: "BONUS AD",
    description: "Watch & Earn BOGX!",
    previewImage: "/images/ad-preview.jpg",
    videoUrl: "/videos/sample-ad.mp4",
    duration: 10,
    maxReward: 100,
  };

  const data = adData || defaultData;

  // If already played, show result
  useEffect(() => {
    if (alreadyPlayed && gameState !== "result") {
      setEarnedPoints(earnedReward);
      setCurrentPoints(earnedReward);
      setWatchProgress(100);
      setGameState("result");
    }
  }, [alreadyPlayed, earnedReward, gameState]);

  // Block swipe during watching
  useEffect(() => {
    onBlockSwipe?.(gameState === "watching");
  }, [gameState, onBlockSwipe]);

  // Timer: 0 → 100 points while watching
  useEffect(() => {
    if (gameState !== "watching") return;

    const duration = data.duration * 1000; // ms
    const maxReward = data.maxReward;
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const points = Math.floor(progress * maxReward);

      setWatchProgress(progress * 100);
      setCurrentPoints(points);

      if (progress >= 1) {
        clearInterval(interval);
        handleComplete(maxReward);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [gameState, data.duration, data.maxReward]);

  const handleStart = () => {
    if (disabled || alreadyPlayed) return;
    sounds.click();
    setGameState("watching");
    onStart?.(data.maxReward);
    
    // Start video if available
    if (videoRef.current) {
      videoRef.current.play();
    }
  };

  const handleComplete = (points: number) => {
    sounds.coins();
    setEarnedPoints(points);
    setGameState("result");
    onComplete?.(points);
  };

  const handleSkip = () => {
    // User can skip early but gets current points
    sounds.click();
    handleComplete(currentPoints);
  };

  // Theme config
  const themeConfig = {
    label: "BONUS",
    color: "text-[#E36B11]",
    icon: Gift,
  };

  const isWin = earnedPoints > 0;

  return (
    <div className="w-full h-full relative overflow-hidden flex flex-col px-3 pb-2 pt-4 items-center" style={{ backgroundColor: '#000000', maxHeight: '100%' }}>
      {/* ==================== PREVIEW STATE ==================== */}
      {gameState === "preview" && !alreadyPlayed && (
        <div className="flex-1 w-full flex flex-col overflow-hidden border border-[#E36B11]/30 min-h-0" style={{ backgroundColor: '#0a0a0a' }}>
          <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Background - First frame of video or preview image */}
            <div className="absolute inset-0">
              {data.videoUrl ? (
                <video
                  src={data.videoUrl}
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <img src={data.previewImage} alt="Preview" className="w-full h-full object-cover" />
              )}
              {/* Light gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/50" />
            </div>
            
            {/* Top Bar - BONUS badge + Help icon */}
            <div className="relative z-10 px-4 pt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-[#E36B11]" />
                <span className="text-xs uppercase tracking-wider text-[#E36B11] font-bold">BONUS CARD</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 px-2 py-1 bg-[#E36B11]/20 border border-[#E36B11]/30">
                  <span className="text-[#E36B11] text-xs font-bold">+{data.maxReward} PTS</span>
                </div>
                <button 
                  onClick={() => { sounds.click(); setIsFlipped(true); }}
                  className="w-8 h-8 flex items-center justify-center bg-cream/10 border border-white/20 rounded-full hover:bg-cream/20 transition-colors"
                >
                  <HelpCircle className="w-4 h-4 text-white/60" />
                </button>
              </div>
            </div>
            
            {/* Spacer to push content down */}
            <div className="flex-1" />

            {/* Content Panel - same structure as QuizGame preview */}
            <div className="relative z-10 mx-4 mb-3">
              <div className="p-5 border border-[#E36B11]/30 bg-black/60 backdrop-blur-sm flex flex-col justify-end" style={{ minHeight: '320px' }}>
                
                {/* Badge + Theme */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-[#E36B11]/20 border border-[#E36B11]/30 text-[10px] text-[#E36B11] uppercase tracking-wider">Bonus</span>
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-[#E36B11] mb-1">WATCH & EARN</div>
                  <div className="font-display text-[28px] leading-none text-white tracking-wide">{data.title}</div>
                </div>

                {/* Reward Info - similar to difficulty buttons */}
                <div className="grid grid-cols-1 gap-2 mb-3">
                  <div className="p-4 border border-[#E36B11] bg-[#E36B11]/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.2em] text-[#E36B11]">
                          {data.duration} Seconds
                        </div>
                        <div className="font-display text-[26px] leading-none mt-2 text-white">
                          +{data.maxReward}
                        </div>
                        <div className="text-[11px] text-white/50 mt-1.5">
                          0 → {data.maxReward} points
                        </div>
                      </div>
                      <Gift className="w-10 h-10 text-[#E36B11]" />
                    </div>
                  </div>
                </div>

                {/* Play Button - same style as QuizGame */}
                <button
                  onClick={handleStart}
                  disabled={disabled}
                  className="w-full h-16 flex items-center justify-center gap-2 transition-all active:scale-[0.98] bg-[#E36B11] text-white disabled:opacity-50"
                >
                  <Play className="w-5 h-5 text-white" />
                  <span className="font-display text-[22px] tracking-[0.15em]">WATCH NOW</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== WATCHING STATE ==================== */}
      {gameState === "watching" && (
        <div className="flex-1 w-full flex flex-col overflow-hidden border border-[#E36B11]/30 min-h-0" style={{ backgroundColor: '#0a0a0a' }}>
          <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Video or Image Background - full visible */}
            <div className="absolute inset-0">
              {data.videoUrl ? (
                <video
                  ref={videoRef}
                  src={data.videoUrl}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <img src={data.previewImage} alt="Ad" className="w-full h-full object-cover" />
              )}
              {/* Only gradient at bottom for overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            </div>
            
            {/* Top Bar - BONUS badge */}
            <div className="relative z-10 px-4 pt-4 flex items-center justify-between">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-sm">
                <Eye className="w-4 h-4 text-[#E36B11] animate-pulse" />
                <span className="text-xs font-bold text-white">WATCHING</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-sm">
                <span className="font-display text-xl text-[#E36B11]">{currentPoints}</span>
                <span className="text-white/50 text-xs">PTS</span>
              </div>
            </div>
            
            {/* Spacer - video visible here */}
            <div className="flex-1" />

            {/* Bottom Panel - compact like QuizGame playing state */}
            <div className="relative z-10 mx-4 mb-3">
              <div className="p-4 border border-[#E36B11]/30 bg-black/60 backdrop-blur-sm">
                {/* Progress bar */}
                <div className="flex gap-0.5 mb-3">
                  {[...Array(10)].map((_, i) => {
                    const filled = i < Math.floor(watchProgress / 10);
                    return (
                      <div key={i} className={`h-3 flex-1 transition-colors duration-150 ${filled ? 'bg-[#E36B11]' : 'bg-cream/20'}`} />
                    );
                  })}
                </div>
                
                {/* Timer + Points */}
                <div className="flex items-center justify-between mb-3">
                  <div className="text-white/60 text-sm">
                    {Math.ceil(data.duration - (watchProgress / 100) * data.duration)}s remaining
                  </div>
                  <div className="text-[#E36B11] font-bold">
                    {currentPoints} / {data.maxReward} PTS
                  </div>
                </div>

                {/* Skip Button */}
                <button
                  onClick={handleSkip}
                  className="w-full h-12 flex items-center justify-center gap-2 bg-cream/10 border border-white/20 text-white/60 font-bold hover:bg-cream/20 transition-all"
                >
                  <span className="font-display text-[16px] tracking-[0.1em]">SKIP & COLLECT {currentPoints} PTS</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== RESULT STATE ==================== */}
      {(gameState === "result" || alreadyPlayed) && (
        <div className="flex-1 w-full flex flex-col overflow-hidden border border-[#E36B11]/30 min-h-0" style={{ backgroundColor: '#0a0a0a' }}>
          <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Background Video - looping */}
            <div className="absolute inset-0">
              {data.videoUrl ? (
                <video
                  src={data.videoUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <img src={data.previewImage} alt="Preview" className="w-full h-full object-cover" />
              )}
              {/* Light gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/50" />
            </div>
            
            {/* Top Bar - BONUS badge */}
            <div className="relative z-10 px-4 pt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-[#E36B11]" />
                <span className="text-xs uppercase tracking-wider text-[#E36B11] font-bold">BONUS CARD</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 bg-[#E36B11]/20 border border-[#E36B11]/30">
                <span className="text-[#E36B11] text-xs font-bold">+{earnedPoints} PTS</span>
              </div>
            </div>
            
            {/* Spacer */}
            <div className="flex-1" />

            {/* Result Panel - same structure as QuizGame */}
            <div className="relative z-10 mx-4 mb-3">
              <div className="p-5 border border-[#E36B11]/30 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center" style={{ minHeight: '320px' }}>
                {/* Result Icon */}
                <div className="w-20 h-20 border-4 border-[#E36B11] bg-[#E36B11]/10 flex items-center justify-center mb-4" style={{ boxShadow: '0 0 30px rgba(212, 240, 0, 0.4)' }}>
                  <Gift className="w-10 h-10 text-[#E36B11]" />
                </div>

                {/* Result Text */}
                <h2 className="text-[#E36B11] font-display text-4xl mb-2">BONUS EARNED!</h2>
                
                {/* Points */}
                <div className="flex items-center gap-2 mb-6">
                  <span className="font-display text-5xl text-[#E36B11]">+{earnedPoints}</span>
                  <span className="text-white/50 text-lg">PTS</span>
                </div>

                {/* Progress Bar */}
                <div className="w-full">
                  <div className="flex gap-0.5">
                    {[...Array(10)].map((_, i) => {
                      const filled = i < Math.floor((earnedPoints / data.maxReward) * 10);
                      return (
                        <div key={i} className={`h-3 flex-1 ${filled ? 'bg-[#E36B11]' : 'bg-cream/20'}`} />
                      );
                    })}
                  </div>
                  <p className="text-center text-white/50 text-xs mt-2">
                    {earnedPoints === data.maxReward ? "Maximum bonus earned!" : `${earnedPoints} of ${data.maxReward} points`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom indicator - FIXED height for all states like QuizGame */}
      <div className="h-[40px] flex flex-col items-center justify-center">
        {gameState === "watching" ? (
          <>
            <Eye className="w-4 h-4 text-[#E36B11] animate-pulse" />
            <span className="text-white/40 text-[9px] tracking-widest">KEEP WATCHING</span>
          </>
        ) : (
          <>
            <div className="animate-bounce">
              <ChevronUp className="w-4 h-4 text-[#E36B11]" />
            </div>
            <span className="text-white/40 text-[9px] tracking-widest">SWIPE UP FOR NEXT CARD</span>
          </>
        )}
      </div>

      {/* ==================== FLIPPED INFO VIEW ==================== */}
      {isFlipped && (
        <div className="absolute inset-0 z-50 bg-black flex flex-col px-3 pb-2 pt-4">
          <div className="flex-1 w-full flex flex-col overflow-hidden border border-[#E36B11]/30" style={{ backgroundColor: '#0a0a0a' }}>
            {/* Header */}
            <div className="px-4 pt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#E36B11]" />
                <span className="text-xs uppercase tracking-wider text-[#E36B11] font-bold">HOW IT WORKS</span>
              </div>
              <button 
                onClick={() => { sounds.click(); setIsFlipped(false); }}
                className="w-8 h-8 flex items-center justify-center bg-cream/10 border border-white/20 rounded-full hover:bg-cream/20 transition-colors"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 flex flex-col justify-center px-6 py-8">
              <h2 className="text-2xl font-bold text-white mb-6 text-center">Watch & Earn</h2>
              
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#E36B11]/20 border border-[#E36B11]/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#E36B11] font-bold">1</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">Tap "Watch Now"</p>
                    <p className="text-white/50 text-sm">Start the bonus video to begin earning BOGX</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#E36B11]/20 border border-[#E36B11]/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#E36B11] font-bold">2</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">Watch the video</p>
                    <p className="text-white/50 text-sm">BOGX increase as you watch - the longer you watch, the more you earn!</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#E36B11]/20 border border-[#E36B11]/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#E36B11] font-bold">3</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">Collect your reward</p>
                    <p className="text-white/50 text-sm">Watch until the end for maximum {data.maxReward} BOGX!</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Back button */}
            <div className="px-4 pb-4">
              <button
                onClick={() => { sounds.click(); setIsFlipped(false); }}
                className="w-full py-4 bg-[#E36B11] text-white font-bold text-lg"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
