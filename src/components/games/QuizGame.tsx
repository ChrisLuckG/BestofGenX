"use client";

import { useState, useEffect, useRef } from "react";
import { sounds } from "@/utils/sounds";
import { formatCurrency, getCurrencySymbol } from "@/utils/currency";
import { HelpCircle, Clock, Star, Play, ChevronUp, Heart, Share2, MessageCircle, Dribbble, Music, Film, Tv, Gamepad2, RotateCcw, Check, X } from "lucide-react";

interface CardData {
  _id?: string;
  theme: string;
  topic?: string;
  maxReward: number;
  difficulty: number;
  difficultyText: string;
  question: string;
  highlightWords: string[];
  previewImage?: string;
  playerImage?: string;
  options: (string | number)[];
  correctAnswer: string | number;
  timeLimit: number;
}

interface GameMeta {
  cardId: string;
  question: string;
  correctAnswer: string | number;
  userAnswer: string | number | null;
  difficulty: number;
  timedOut: boolean;
}

interface QuizGameProps {
  cardData?: CardData;
  nextCardTheme?: string;
  onComplete?: (correct: boolean, reward: number, timeUsed?: number, meta?: GameMeta) => void;
  onStart?: (reward: number) => void;
  onBlockSwipe?: (blocked: boolean) => void;
  onNoFunds?: () => void;
  currentScore?: number;
  disabled?: boolean;
  currentCard?: number;
  totalCards?: number;
  alreadyPlayed?: boolean;
  previousAnswer?: string | number | null;
  wasCorrect?: boolean;
  cardResults?: (boolean | undefined)[]; // Array of results for each card (true=correct, false=wrong, undefined=not played)
}

export default function QuizGame({ cardData, nextCardTheme, onComplete, onStart, onBlockSwipe, onNoFunds, currentScore = 0, disabled = false, currentCard = 0, totalCards = 0, alreadyPlayed = false, previousAnswer = null, wasCorrect = false, cardResults = [] }: QuizGameProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | number | null>(null);
  const [gameState, setGameState] = useState<"preview" | "countdown" | "playing" | "result">("preview");
  
  // If already played, show result state with previous answer
  useEffect(() => {
    console.log('QuizGame useEffect - alreadyPlayed:', alreadyPlayed, 'previousAnswer:', previousAnswer, 'gameState:', gameState);
    if (alreadyPlayed && gameState !== "result") {
      console.log('Setting to result state!');
      setSelectedAnswer(previousAnswer);
      setGameState("result");
    }
  }, [alreadyPlayed, previousAnswer, gameState]);
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(10);
  const [currentPoints, setCurrentPoints] = useState(100);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [frozenPoints, setFrozenPoints] = useState(0); // Points at moment of answer for flip view
  const [multiplier, setMultiplier] = useState<1 | 2 | 3 | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [shuffledOptions, setShuffledOptions] = useState<(string | number)[]>([]);
  const [showFlippedView, setShowFlippedView] = useState(false);

  // Default fallback data if no cardData provided
  const defaultData: CardData = {
    theme: "FOOTBALL",
    topic: "WORLD CUP 90s",
    maxReward: 200,
    difficulty: 4,
    difficultyText: "For real 90s football legends",
    question: "How many goals did Ronaldo score in the 1998 World Cup?",
    highlightWords: ["Ronaldo", "1998 World Cup"],
    previewImage: "/images/football.png",
    playerImage: "/images/rona.png",
    options: [3, 4, 5, 6],
    correctAnswer: 4,
    timeLimit: 10,
  };

  const gameData = cardData || defaultData;

  // Shuffle options once per card load (Fisher-Yates)
  useEffect(() => {
    const opts = [...gameData.options];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    setShuffledOptions(opts);
  }, [gameData.question]);

  // Get theme icon, label and colors based on theme
  const getThemeConfig = (theme: string) => {
    const themeUpper = theme?.toUpperCase() || "SPORTS";
    switch (themeUpper) {
      case "MUSIC":
        return { 
          icon: Music, 
          label: "MUSIC", 
          color: "text-pink-400",
          bgColor: "bg-pink-500",
          bgColorTransparent: "bg-pink-500/40",
          bgHover: "hover:bg-pink-600",
          borderColor: "border-pink-500",
          gradient: "from-pink-500 to-pink-700",
          glow: "0 0 20px rgba(236, 72, 153, 0.4)"
        };
      case "MOVIES":
        return { 
          icon: Film, 
          label: "MOVIES", 
          color: "text-[#E36B11]",
          bgColor: "bg-[#E36B11]",
          bgColorTransparent: "bg-[#E36B11]/40",
          bgHover: "hover:bg-[#a8c000]",
          borderColor: "border-[#E36B11]",
          gradient: "from-[#E36B11] to-[#a8c000]",
          glow: "0 0 20px rgba(212, 240, 0, 0.4)"
        };
      case "TV SHOWS":
        return { 
          icon: Tv, 
          label: "TV SHOWS", 
          color: "text-purple-400",
          bgColor: "bg-purple-500",
          bgColorTransparent: "bg-purple-500/40",
          bgHover: "hover:bg-purple-600",
          borderColor: "border-purple-500",
          gradient: "from-purple-500 to-purple-700",
          glow: "0 0 20px rgba(192, 132, 252, 0.4)"
        };
      case "GAMING":
        return { 
          icon: Gamepad2, 
          label: "GAMING", 
          color: "text-green-400",
          bgColor: "bg-green-500",
          bgColorTransparent: "bg-green-500/40",
          bgHover: "hover:bg-green-600",
          borderColor: "border-green-500",
          gradient: "from-green-500 to-green-700",
          glow: "0 0 20px rgba(74, 222, 128, 0.4)"
        };
      case "FASHION":
        return { 
          icon: Star, 
          label: "FASHION", 
          color: "text-fuchsia-400",
          bgColor: "bg-fuchsia-500",
          bgColorTransparent: "bg-fuchsia-500/40",
          bgHover: "hover:bg-fuchsia-600",
          borderColor: "border-fuchsia-500",
          gradient: "from-fuchsia-500 to-fuchsia-700",
          glow: "0 0 20px rgba(232, 121, 249, 0.4)"
        };
      case "TECHNOLOGY":
        return { 
          icon: Gamepad2, 
          label: "TECHNOLOGY", 
          color: "text-blue-400",
          bgColor: "bg-blue-500",
          bgColorTransparent: "bg-blue-500/40",
          bgHover: "hover:bg-blue-600",
          borderColor: "border-blue-500",
          gradient: "from-blue-500 to-blue-700",
          glow: "0 0 20px rgba(59, 130, 246, 0.4)"
        };
      case "CELEBRITIES":
        return { 
          icon: Star, 
          label: "CELEBRITIES", 
          color: "text-[#E36B11]",
          bgColor: "bg-[#E36B11]",
          bgColorTransparent: "bg-[#E36B11]/40",
          bgHover: "hover:bg-[#a8c000]",
          borderColor: "border-[#E36B11]",
          gradient: "from-[#E36B11] to-[#a8c000]",
          glow: "0 0 20px rgba(212, 240, 0, 0.4)"
        };
      case "SPORTS":
      case "SPORT":
      case "FOOTBALL":
      default:
        return { 
          icon: Dribbble, 
          label: "SPORT", 
          color: "text-cyan-400",
          bgColor: "bg-cyan-500",
          bgColorTransparent: "bg-cyan-500/40",
          bgHover: "hover:bg-cyan-600",
          borderColor: "border-cyan-500",
          gradient: "from-cyan-500 to-cyan-700",
          glow: "0 0 20px rgba(34, 211, 238, 0.4)"
        };
    }
  };

  const themeConfig = getThemeConfig(gameData.theme);

  // Reset state when card changes
  useEffect(() => {
    setGameState("preview");
    setMultiplier(null);
    setSelectedAnswer(null);
    setCountdown(3);
    setTimeLeft(10);
    setEarnedPoints(0);
  }, [cardData]);

  // Countdown Effect (3, 2, 1)
  useEffect(() => {
    if (gameState === "countdown" && countdown > 0) {
      sounds.countdown(countdown);
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (gameState === "countdown" && countdown === 0) {
      sounds.go();
      setGameState("playing");
    }
  }, [countdown, gameState]);

  // Game Timer Effect - smooth millisecond updates
  useEffect(() => {
    if (gameState === "playing" && timeLeft > 0) {
      const interval = 50; // Update every 50ms for smooth countdown
      const timer = setTimeout(() => {
        const newTimeLeft = Math.max(0, timeLeft - interval / 1000);
        setTimeLeft(newTimeLeft);
        // Points decrease linearly based on multiplier (100/200/300 max)
        const maxReward = multiplier ? 100 * multiplier : 100;
        const newPoints = Math.round((newTimeLeft / gameData.timeLimit) * maxReward);
        setCurrentPoints(newPoints);
      }, interval);
      return () => clearTimeout(timer);
    } else if (timeLeft <= 0 && gameState === "playing" && selectedAnswer === null) {
      // Timeout = same penalty as wrong answer
      sounds.error();
      const penalty = multiplier === 1 ? 10 : multiplier === 2 ? 50 : 100;
      setFrozenPoints(0); // Timeout = 0 points left
      setCurrentPoints(0);
      setEarnedPoints(-penalty);
      setGameState("result");
      onBlockSwipe?.(false);
      const timeUsed = gameData.timeLimit;
      onComplete?.(false, -penalty, timeUsed, {
        cardId: gameData._id || 'unknown',
        question: gameData.question,
        correctAnswer: gameData.correctAnswer,
        userAnswer: null,
        difficulty: multiplier ?? 1,
        timedOut: true,
      });
    }
  }, [timeLeft, gameState, selectedAnswer, multiplier]);

  const startGame = () => {
    if (!multiplier) return; // Must select multiplier first
    
    // Check if user has enough points (at least 1 point to play)
    if (currentScore <= 0) {
      onNoFunds?.();
      return;
    }
    
    const basePoints = 100;
    const maxReward = basePoints * multiplier;
    setGameState("countdown");
    setCountdown(3);
    setTimeLeft(gameData.timeLimit);
    setCurrentPoints(maxReward);
    setSelectedAnswer(null);
    setEarnedPoints(0);
    setStartTime(Date.now()); // Track start time
    onStart?.(maxReward);
    onBlockSwipe?.(true);
  };

  // Get difficulty text based on multiplier
  const getDifficultyInfo = (mult: number | null) => {
    switch (mult) {
      case 1: return { text: "EASY", color: "text-green-400", bgColor: "bg-green-500/20", borderColor: "border-green-500" };
      case 2: return { text: "MEDIUM", color: "text-[#E36B11]", bgColor: "bg-[#E36B11]/20", borderColor: "border-[#E36B11]" };
      case 3: return { text: "HARD", color: "text-red-400", bgColor: "bg-red-500/20", borderColor: "border-red-500" };
      default: return { text: "SELECT", color: "text-white/50", bgColor: "bg-cream/5", borderColor: "border-white/20" };
    }
  };

  const difficultyInfo = getDifficultyInfo(multiplier);

  const handleAnswer = (answer: string | number) => {
    if (gameState !== "playing" || selectedAnswer !== null) return;
    setSelectedAnswer(answer);
    
    const isCorrect = answer === gameData.correctAnswer;
    const pointsAtAnswer = currentPoints;
    const maxReward = multiplier ? 100 * multiplier : 100;
    // Custom penalties: Easy=-10, Medium=-50, Hard=-100
    const penalty = multiplier === 1 ? 10 : multiplier === 2 ? 50 : 100;
    setEarnedPoints(isCorrect ? pointsAtAnswer : -penalty);
    setFrozenPoints(pointsAtAnswer); // Save points at moment of answer for flip view

    // Immediate tap sound
    sounds.click();
    // Reveal sound after short delay
    setTimeout(() => {
      if (isCorrect) sounds.correct(); else sounds.wrong();
    }, 300);

    const meta: GameMeta = {
      cardId: gameData._id || 'unknown',
      question: gameData.question,
      correctAnswer: gameData.correctAnswer,
      userAnswer: answer,
      difficulty: multiplier ?? 1,
      timedOut: false,
    };
    
    setTimeout(() => {
      setGameState("result");
      onBlockSwipe?.(false);
      const timeUsed = gameData.timeLimit - timeLeft;
      if (isCorrect && pointsAtAnswer > 0) {
        onComplete?.(true, pointsAtAnswer, timeUsed, meta);
      } else {
        onComplete?.(false, -penalty, timeUsed, meta);
      }
    }, 500);
  };

  // For alreadyPlayed, use wasCorrect prop; otherwise calculate from selectedAnswer
  const isCorrect = alreadyPlayed ? wasCorrect : selectedAnswer === gameData.correctAnswer;
  const isTimeout = timeLeft === 0 && selectedAnswer === null;
  const isWin = alreadyPlayed ? wasCorrect : (isCorrect && earnedPoints > 0);
  // Use previousAnswer for display if alreadyPlayed
  const displayAnswer = alreadyPlayed ? previousAnswer : selectedAnswer;

  const formatQuestion = (question: string) => {
    return question;
  };

  return (
    <div className="w-full h-full relative overflow-hidden flex flex-col px-3 pb-2 pt-4 items-center" style={{ backgroundColor: '#000000', maxHeight: '100%' }}>
      
      {/* ==================== PREVIEW STATE ==================== */}
      {/* If alreadyPlayed, skip preview and show result directly */}
      {gameState === "preview" && !alreadyPlayed && (
        <div className="flex-1 w-full flex flex-col overflow-hidden border border-[#E36B11]/30 min-h-0" style={{ backgroundColor: '#0a0a0a' }}>
          {/* Card Background Image - IDENTICAL to all states */}
          <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="absolute inset-0">
              <img 
                src={gameData.previewImage}
                alt="Preview"
                className="w-full object-cover"
                style={{ height: '85%', objectPosition: 'center 20%' }}
              />
              {/* Gradient overlay - dark at top and bottom, visible in middle */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/40 to-transparent" style={{ height: '45%' }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 from-0% via-black/50 via-30% to-transparent to-50%" />
            </div>

            {/* Top Bar - Progress bar only */}
            <div className="relative z-10 px-4 pt-4 flex items-center justify-end">
              <div className="flex gap-0.5">
                {totalCards > 0 && Array.from({ length: totalCards }, (_, i) => {
                  const isCurrentCard = i + 1 === currentCard;
                  const isPlayed = i + 1 < currentCard;
                  const result = cardResults[i]; // true=correct, false=wrong, undefined=not played
                  let bgColor = 'bg-cream/30'; // Not played - neutral
                  if (isPlayed && result === true) bgColor = 'bg-[#E36B11]'; // Played & correct - green
                  else if (isPlayed && result === false) bgColor = 'bg-red-500'; // Played & wrong - red
                  else if (isCurrentCard) bgColor = 'bg-cream/60'; // Current card - brighter but neutral
                  
                  return (
                    <div key={i} className={`w-4 h-1 ${bgColor}`} />
                  );
                })}
              </div>
            </div>

            {/* Spacer to push content down */}
            <div className="flex-1" />

            {/* Content Panel - Neon green border - fixed height, content at bottom */}
            <div className="relative z-10 mx-4 mb-3">
              <div className="p-5 border border-[#E36B11]/30 bg-black/80 backdrop-blur-md flex flex-col justify-end" style={{ minHeight: '320px' }}>
                
                {/* Quiz Badge + Theme & Topic - 2 Column Layout */}
                <div className="mb-4 flex gap-3">
                  {/* Left Column - Quiz Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-cream/10 border border-white/20 text-[10px] text-white/80 uppercase tracking-wider">Quiz</span>
                    </div>
                    <div className={`text-[10px] uppercase tracking-[0.25em] ${themeConfig.color} mb-1`}>{themeConfig.label}</div>
                    <div className="font-display text-[28px] leading-none text-white tracking-wide">{gameData.topic}</div>
                  </div>
                  
                  {/* Right Column - Skip Penalty Warning */}
                  <div className="flex-shrink-0 px-2.5 py-1.5 bg-red-500/10 border border-red-500/25 flex flex-col items-center justify-center">
                    <span className="text-[7px] text-red-400/60 uppercase tracking-[0.15em]">Swipe</span>
                    <span className="text-[7px] text-red-400/60 uppercase tracking-[0.15em] mb-0.5">Penalty</span>
                    <span className="text-base font-bold text-red-500/90">−100</span>
                  </div>
                </div>

                {/* Multiplier Selection - 3 Neon Green Shades: Easy=dunkel, Hard=hell - TALLER buttons */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[1, 2, 3].map((mult) => {
                    const isSelected = multiplier === mult;
                    const maxWin = 100 * mult;
                    const penalty = mult === 1 ? 10 : mult === 2 ? 50 : 100;
                    const label = mult === 1 ? 'Easy' : mult === 2 ? 'Medium' : 'Hard';
                    // 3 Neon-Grün Stufen: Easy=dunkel, Medium=mittel, Hard=hell/leuchtend
                    const neonShade = mult === 1 ? '#608000' : mult === 2 ? '#9ABF00' : '#E36B11';
                    return (
                      <button
                        key={mult}
                        onClick={() => { 
                          if (mult === 1) sounds.difficultyEasy();
                          else if (mult === 2) sounds.difficultyMedium();
                          else sounds.difficultyHard();
                          setMultiplier(mult as 1 | 2 | 3);
                        }}
                        className={`p-4 text-left border transition-colors ${
                          isSelected 
                            ? '' 
                            : 'border-white/20 bg-black/40'
                        }`}
                        style={isSelected ? { borderColor: neonShade, backgroundColor: `${neonShade}30` } : {}}
                      >
                        <div 
                          className={`text-[11px] uppercase tracking-[0.2em] ${isSelected ? '' : 'text-white/50'}`}
                          style={isSelected ? { color: neonShade } : {}}
                        >
                          {label}
                        </div>
                        <div className={`font-display text-[26px] leading-none mt-2 ${isSelected ? 'text-white' : 'text-white/70'}`}>
                          +{maxWin}
                        </div>
                        <div className="text-[11px] text-red-500 mt-1.5">
                          −{penalty} miss
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Play Button - adapts to selected difficulty shade */}
                <button
                  onClick={startGame}
                  disabled={!multiplier}
                  className={`w-full h-16 flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                    !multiplier ? 'bg-cream/10 text-white/30 cursor-not-allowed' : ''
                  }`}
                  style={multiplier ? { 
                    backgroundColor: multiplier === 1 ? '#608000' : multiplier === 2 ? '#9ABF00' : '#E36B11',
                    color: '#000'
                  } : {}}
                >
                  <Play className={`w-5 h-5 ${multiplier ? 'text-black' : 'text-white/30'}`} />
                  <span className="font-display text-[22px] tracking-[0.15em]">
                    {multiplier ? 'PLAY' : 'SELECT'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== COUNTDOWN & PLAYING STATE (same layout) ==================== */}
      {(gameState === "countdown" || gameState === "playing") && (
        <div className="flex-1 w-full flex flex-col overflow-hidden border border-[#E36B11]/30 min-h-0" style={{ backgroundColor: '#0a0a0a' }}>
          <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Background Image - SAME for countdown and playing */}
            <div className="absolute inset-0">
              <img src={gameData.previewImage} alt="Preview" className="w-full object-cover" style={{ height: '85%', objectPosition: 'center 20%' }} />
              {/* Gradient overlay - dark at top and bottom, visible in middle */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/40 to-transparent" style={{ height: '45%' }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 from-0% via-black/50 via-30% to-transparent to-50%" />
            </div>
            
            {/* Top Bar - Progress bar only */}
            <div className="relative z-10 px-4 pt-4 flex items-center justify-end">
              <div className="flex gap-0.5">
                {totalCards > 0 && Array.from({ length: totalCards }, (_, i) => {
                  const isCurrentCard = i + 1 === currentCard;
                  const isPlayed = i + 1 < currentCard;
                  const result = cardResults[i];
                  let bgColor = 'bg-cream/30'; // Not played - neutral
                  if (isPlayed && result === true) bgColor = 'bg-[#E36B11]'; // Played & correct - green
                  else if (isPlayed && result === false) bgColor = 'bg-red-500'; // Played & wrong - red
                  else if (isCurrentCard) bgColor = 'bg-cream/60'; // Current card - brighter but neutral
                  return (
                    <div key={i} className={`w-4 h-1 ${bgColor}`} />
                  );
                })}
              </div>
            </div>
            
            {/* Spacer pushes content to bottom */}
            <div className="flex-1" />

            {/* Question Panel - at bottom, FIXED height 340px (same as result) */}
            <div className="relative z-10 px-4 pb-3">
              {gameState === "countdown" ? (
                /* Countdown: Show question with countdown badge and placeholder answers */
                <div className="p-5 border border-[#E36B11]/30 bg-black/80 backdrop-blur-md flex flex-col" style={{ height: '420px' }}>
                  {/* Theme + Difficulty header */}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs uppercase tracking-wider ${themeConfig.color}`}>{themeConfig.label}</span>
                    <span className="text-[#E36B11] text-xs uppercase tracking-wider">
                      {multiplier === 1 ? '★ Easy' : multiplier === 2 ? '★★ Medium' : '★★★ Hard'}
                    </span>
                  </div>
                  
                  {/* Spacer pushes content down */}
                  <div className="flex-1" />
                  
                  {/* Countdown Badge - Neon Green */}
                  <div className="flex justify-center mb-4">
                    <div 
                      key={countdown} 
                      className="w-16 h-16 border-4 border-[#E36B11] flex items-center justify-center bg-black/60"
                      style={{ boxShadow: '0 0 30px rgba(212, 240, 0, 0.4)' }}
                    >
                      <span className="text-[#E36B11] font-display text-4xl">
                        {countdown}
                      </span>
                    </div>
                  </div>
                  
                  {/* Question in container - FIXED height for consistent design */}
                  <div className="border border-white/20 bg-black/40 px-4 mb-4 h-[120px] flex items-center justify-center">
                    <h2 className="text-white text-base font-bold text-center leading-snug" dangerouslySetInnerHTML={{ __html: formatQuestion(gameData.question) }} />
                  </div>
                  
                  {/* Placeholder answers - exact same size as real buttons */}
                  <div className="grid grid-cols-2 grid-rows-2 gap-2 mt-auto">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="px-2 py-4 text-sm font-bold flex items-center justify-center text-center bg-cream/5 border border-[#E36B11]/20">&nbsp;</div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Playing: Show timer bar and real answers */
                <>
                  {(() => {
                    const actualMaxReward = multiplier ? 100 * multiplier : 100;
                    const percent = currentPoints / actualMaxReward;
                    const colorClass = percent >= 0.7 ? 'green' : percent >= 0.4 ? 'yellow' : 'red';
                    const borderClass = colorClass === 'green' ? 'border-green-500' : colorClass === 'yellow' ? 'border-yellow-500' : 'border-red-500';
                    const bgClass = colorClass === 'green' ? 'bg-green-500/20' : colorClass === 'yellow' ? 'bg-yellow-500/20' : 'bg-red-500/20';
                    const textClass = colorClass === 'green' ? 'text-green-400' : colorClass === 'yellow' ? 'text-yellow-400' : 'text-red-400';
                    const ledColor = colorClass === 'green' ? 'bg-green-500' : colorClass === 'yellow' ? 'bg-yellow-500' : 'bg-red-500';
                    const filledSegments = Math.round(percent * 10);
                    
                    return (
                      <div className="p-5 border border-[#E36B11]/30 bg-black/80 backdrop-blur-md flex flex-col" style={{ height: '420px' }}>
                        {/* Theme + Difficulty header */}
                        <div className="flex items-center justify-between">
                          <span className={`text-xs uppercase tracking-wider ${themeConfig.color}`}>{themeConfig.label}</span>
                          <span className="text-[#E36B11] text-xs uppercase tracking-wider">
                            {multiplier === 1 ? '★ Easy' : multiplier === 2 ? '★★ Medium' : '★★★ Hard'}
                          </span>
                        </div>
                        
                        {/* Spacer pushes content down */}
                        <div className="flex-1" />
                        
                        {/* Timer Row with LED segments */}
                        <div className="flex items-center justify-between gap-2 mb-4">
                          <div className="flex items-center gap-1">
                            <div className="w-11 h-11 border-2 border-[#E36B11] bg-[#E36B11]/10 flex items-center justify-center">
                              <span className="font-display text-2xl text-[#E36B11]">{String(Math.ceil(timeLeft)).padStart(2, '0')}</span>
                            </div>
                            <span className="text-white/50 text-[10px]">SEC</span>
                          </div>
                          <div className="flex-1 px-1">
                            <div className="flex gap-0.5">
                              {[...Array(10)].map((_, i) => (
                                <div key={i} className={`h-4 flex-1 transition-colors duration-150 ${i < filledSegments ? 'bg-[#E36B11]' : 'bg-cream/20'}`} />
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-display text-2xl text-[#E36B11]">{formatCurrency(currentPoints)}</span>
                            <span className="text-white/50 text-[10px]">{getCurrencySymbol()}</span>
                          </div>
                        </div>
                        
                        {/* Question in container - FIXED height for consistent design */}
                        <div className="border border-white/20 bg-black/40 px-4 mb-4 h-[120px] flex items-center justify-center">
                          <h2 className="text-white text-base font-bold text-center leading-snug" dangerouslySetInnerHTML={{ __html: formatQuestion(gameData.question) }} />
                        </div>
                        
                        {/* Real answers */}
                        <div className="grid grid-cols-2 grid-rows-2 gap-2 mt-auto">
                          {(shuffledOptions.length > 0 ? shuffledOptions : gameData.options).map((option) => (
                            <button
                              key={option}
                              onClick={() => handleAnswer(option)}
                              disabled={selectedAnswer !== null}
                              className={`px-2 py-4 text-sm font-bold transition-all flex items-center justify-center text-center ${
                                selectedAnswer === option
                                  ? option === gameData.correctAnswer ? "bg-[#E36B11] text-white border-2 border-[#E36B11]" : "bg-red-500 text-white border-2 border-red-500"
                                  : "bg-cream/5 text-white/90 border border-[#E36B11]/20 hover:bg-[#E36B11]/10 hover:border-[#E36B11]/40"
                              }`}
                            ><span className="line-clamp-2">{option}</span></button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== RESULT STATE ==================== */}
      {/* Show result if gameState is result OR if alreadyPlayed (even if gameState is still preview) */}
      {(gameState === "result" || alreadyPlayed) && (
        <div className="flex-1 w-full flex flex-col overflow-hidden border border-[#E36B11]/30 min-h-0" style={{ backgroundColor: '#0a0a0a' }}>
          <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Background image */}
            <div className="absolute inset-0">
              <img src={gameData.previewImage} alt="Preview" className="w-full object-cover" style={{ height: '85%', objectPosition: 'center 20%' }} />
              {/* Gradient overlay - dark at top and bottom, visible in middle */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/40 to-transparent" style={{ height: '45%' }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 from-0% via-black/50 via-30% to-transparent to-50%" />
            </div>
            
            {/* Top Bar - Progress bar only */}
            <div className="relative z-10 px-4 pt-4 flex items-center justify-end">
              <div className="flex gap-0.5">
                {totalCards > 0 && Array.from({ length: totalCards }, (_, i) => {
                  const isCurrentCard = i + 1 === currentCard;
                  const isPlayed = i + 1 < currentCard;
                  const result = cardResults[i];
                  let bgColor = 'bg-cream/30'; // Not played - neutral
                  if (isCurrentCard) bgColor = isWin ? 'bg-[#E36B11]' : 'bg-red-500'; // Current card shows result
                  else if (isPlayed && result === true) bgColor = 'bg-[#E36B11]'; // Played & correct - green
                  else if (isPlayed && result === false) bgColor = 'bg-red-500'; // Played & wrong - red
                  return (
                    <div key={i} className={`w-4 h-1 ${bgColor}`} />
                  );
                })}
              </div>
            </div>
            
            {/* Spacer pushes content to bottom */}
            <div className="flex-1" />
            
            {/* Result Panel - with 3D flip effect */}
            <div className="relative z-10 px-4 pb-3" style={{ perspective: '1000px' }}>
              <div 
                className="relative transition-transform duration-500"
                style={{ 
                  transformStyle: 'preserve-3d',
                  transform: showFlippedView ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  height: '420px'
                }}
              >
                {/* Front Side - Result */}
                <div 
                  onClick={() => setShowFlippedView(true)}
                  className="absolute inset-0 p-5 border border-[#E36B11]/30 bg-black/80 backdrop-blur-md flex flex-col cursor-pointer"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  {/* Header: Theme left, Flip icon right */}
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-xs uppercase tracking-wider ${themeConfig.color}`}>{themeConfig.label}</span>
                    <button 
                      onClick={() => setShowFlippedView(true)}
                      className="p-2 hover:bg-cream/10 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4 text-white/60" />
                    </button>
                  </div>
                  
                  {/* Spacer */}
                  <div className="flex-1" />
                  
                  {/* Result in container */}
                  <div className="border border-white/20 bg-black/40 p-4 mb-4">
                    {/* My Answer with small icon */}
                    <div className="flex items-center justify-center gap-2 mb-2">
                      {isWin ? (
                        <Check className="w-5 h-5 text-[#E36B11]" />
                      ) : (
                        <X className="w-5 h-5 text-red-500" />
                      )}
                      <span className={`font-bold text-lg ${isWin ? 'text-[#E36B11]' : 'text-red-500'}`}>
                        {displayAnswer || 'No Answer'}
                      </span>
                    </div>
                    
                    {/* CORRECT / WRONG */}
                    <h2 className="font-display text-3xl tracking-wider text-white text-center">
                      {isWin ? 'CORRECT' : 'WRONG'}
                    </h2>
                    
                    {/* Points */}
                    <p className={`font-display text-4xl mt-1 text-center ${isWin ? 'text-[#E36B11]' : 'text-red-500'}`}>
                      {isWin ? `+${formatCurrency(earnedPoints)}` : formatCurrency(earnedPoints)} <span className="text-lg text-white/50">{getCurrencySymbol()}</span>
                    </p>
                  </div>
                  
                  {/* Stats rows - minimal lines */}
                  <div className="space-y-0 border-t border-white/10 mt-4">
                    <div className="flex justify-between items-center py-3 border-b border-white/10">
                      <span className="text-white/40 text-xs tracking-widest">ANSWER TIME</span>
                      <span className="text-white font-bold">{(gameData.timeLimit - timeLeft).toFixed(2)}s</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-white/10">
                      <span className="text-white/40 text-xs tracking-widest">DIFFICULTY</span>
                      <span className="text-white font-bold">{multiplier === 1 ? '★ EASY' : multiplier === 2 ? '★★ MEDIUM' : '★★★ HARD'}</span>
                    </div>
                    <div className="flex justify-between items-center py-3">
                      <span className="text-white/40 text-xs tracking-widest">CORRECT ANSWER</span>
                      <span className="text-white font-black text-right max-w-[60%] truncate">{gameData.correctAnswer}</span>
                    </div>
                  </div>
                  
                  {isTimeout && <p className="text-red-400 font-bold text-center mt-3 text-sm">⏱ TIME'S UP!</p>}
                  
                  {/* Report Wrong Answer Button */}
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await fetch('/api/reports', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            type: 'wrong_answer',
                            questionId: gameData._id,
                            question: gameData.question,
                            claimedAnswer: gameData.correctAnswer,
                            userAnswer: selectedAnswer,
                          }),
                        });
                        alert('Thanks! We will review this question.');
                      } catch {
                        alert('Failed to report. Please try again.');
                      }
                    }}
                    className="mt-3 text-xs text-white/40 hover:text-red-400 transition-colors flex items-center justify-center gap-1"
                  >
                    <HelpCircle className="w-3 h-3" />
                    Report Wrong Answer
                  </button>
                </div>
                
                {/* Back Side - Question & Answers */}
                <div 
                  onClick={() => setShowFlippedView(false)}
                  className="absolute inset-0 p-5 border border-[#E36B11]/30 bg-black/80 backdrop-blur-md flex flex-col cursor-pointer"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  {/* Header: Theme left, Flip icon right */}
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-xs uppercase tracking-wider ${themeConfig.color}`}>{themeConfig.label}</span>
                    <button 
                      onClick={() => setShowFlippedView(false)}
                      className="p-2 hover:bg-cream/10 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4 text-white/60" />
                    </button>
                  </div>
                  
                  {/* Timer Row - frozen state from when answered */}
                  {(() => {
                    const actualMaxReward = multiplier ? 100 * multiplier : 100;
                    const frozenPercent = frozenPoints / actualMaxReward;
                    const frozenSegments = Math.round(frozenPercent * 10);
                    return (
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-1">
                          <div className="w-11 h-11 border-2 border-[#E36B11] bg-[#E36B11]/10 flex items-center justify-center">
                            <span className="font-display text-2xl text-[#E36B11]">{String(Math.ceil(timeLeft)).padStart(2, '0')}</span>
                          </div>
                          <span className="text-white/50 text-[10px]">SEC</span>
                        </div>
                        <div className="flex-1 px-1">
                          <div className="flex gap-0.5">
                            {[...Array(10)].map((_, i) => (
                              <div key={i} className={`h-4 flex-1 ${i < frozenSegments ? 'bg-[#E36B11]' : 'bg-cream/20'}`} />
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-display text-2xl text-[#E36B11]">{formatCurrency(frozenPoints)}</span>
                          <span className="text-white/50 text-[10px]">{getCurrencySymbol()}</span>
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* Question in container - FIXED height for consistent design */}
                  <div className="border border-white/20 bg-black/40 px-4 mb-4 h-[120px] flex items-center justify-center">
                    <h2 className="text-white text-base font-bold text-center leading-snug" dangerouslySetInnerHTML={{ __html: formatQuestion(gameData.question) }} />
                  </div>
                  
                  {/* Answers Grid */}
                  <div className="grid grid-cols-2 grid-rows-2 gap-2 mt-auto">
                    {shuffledOptions.map((option, idx) => {
                      const isCorrect = option === gameData.correctAnswer;
                      const wasSelected = option === displayAnswer;
                      return (
                        <div 
                          key={idx}
                          className={`px-2 py-4 text-sm font-bold flex items-center justify-center text-center border ${
                            isCorrect 
                              ? 'bg-[#E36B11]/20 border-[#E36B11] text-[#E36B11]' 
                              : wasSelected && !isCorrect
                                ? 'bg-red-500/20 border-red-500 text-red-400'
                                : 'bg-cream/5 border-white/20 text-white/50'
                          }`}
                        >
                          <span className="line-clamp-2">{option}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom indicator - FIXED height for all states to prevent layout jumping */}
      <div className="h-[40px] flex flex-col items-center justify-center">
        {(gameState === "preview" || gameState === "result") ? (
          <>
            <div className="animate-bounce">
              <ChevronUp className={`w-4 h-4 ${
                nextCardTheme === "MUSIC" ? "text-pink-400" :
                nextCardTheme === "MOVIES" ? "text-yellow-400" :
                nextCardTheme === "TV SHOWS" ? "text-purple-400" :
                nextCardTheme === "GAMING" ? "text-green-400" :
                nextCardTheme === "SPORTS" ? "text-cyan-400" :
                "text-[#E36B11]"
              }`} />
            </div>
            <span className="text-white/40 text-[9px] tracking-widest">SWIPE UP FOR NEXT CARD</span>
          </>
        ) : (
          <>
            <Clock className="w-4 h-4 text-[#E36B11] animate-pulse" />
            <span className="text-white/40 text-[9px] tracking-widest">ANSWER TO CONTINUE</span>
          </>
        )}
      </div>

    </div>
  );
}
