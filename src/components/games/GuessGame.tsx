"use client";

import { useState, useEffect, useRef } from "react";
import { HelpCircle, Clock, Star, Play, ChevronUp, Heart, Share2, MessageCircle, Dribbble } from "lucide-react";

interface GuessGameProps {
  onComplete?: (correct: boolean, reward: number) => void;
  onStart?: (reward: number) => void;
  disabled?: boolean;
}

export default function GuessGame({ onComplete, onStart, disabled = false }: GuessGameProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [gameState, setGameState] = useState<"preview" | "playing" | "result">("preview");
  const [timeLeft, setTimeLeft] = useState(10);
  const [currentPoints, setCurrentPoints] = useState(100);
  const [showCoinAnimation, setShowCoinAnimation] = useState(false);
  const coinAnimationRef = useRef<HTMLDivElement>(null);

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = 'Check out this quiz on Best of GenX!';
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch (e) {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      alert('Link copied!');
    }
  };

  const gameData = {
    theme: "FOOTBALL",
    topic: "WORLD CUP 90s",
    maxReward: 200,
    difficulty: 4, // out of 5 stars
    difficultyText: "For real 90s football legends",
    question: "How many goals did Ronaldo score in the 1998 World Cup?",
    highlightWords: ["Ronaldo", "1998 World Cup"],
    playerImage: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800",
    options: [3, 4, 5, 6],
    correctAnswer: 4,
    timeLimit: 10,
  };

  // Timer effect
  useEffect(() => {
    if (gameState === "playing" && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
        // Points decrease over time
        const pointsPerSecond = gameData.maxReward / gameData.timeLimit;
        setCurrentPoints(Math.max(0, Math.round(gameData.maxReward - (gameData.timeLimit - timeLeft + 1) * pointsPerSecond * 0.4)));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && gameState === "playing") {
      // Time's up - wrong answer
      setGameState("result");
      onComplete?.(false, gameData.maxReward);
    }
  }, [timeLeft, gameState]);

  const startGame = () => {
    setGameState("playing");
    setTimeLeft(gameData.timeLimit);
    setCurrentPoints(gameData.maxReward);
    onStart?.(gameData.maxReward);
  };

  const handleAnswer = (answer: number) => {
    if (gameState !== "playing" || selectedAnswer !== null) return;
    setSelectedAnswer(answer);
    
    const isCorrect = answer === gameData.correctAnswer;
    
    setTimeout(() => {
      setGameState("result");
      if (isCorrect) {
        setShowCoinAnimation(true);
        onComplete?.(true, currentPoints);
      } else {
        onComplete?.(false, gameData.maxReward);
      }
    }, 500);
  };

  const isCorrect = selectedAnswer === gameData.correctAnswer;

  // Format question with highlighted words
  const formatQuestion = (question: string) => {
    let result = question;
    gameData.highlightWords.forEach(word => {
      result = result.replace(word, `<span class="text-[#E36B11]">${word}</span>`);
    });
    return result;
  };

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ backgroundColor: '#000000' }}>
      {/* Background Image */}
      <div className="absolute inset-0">
        <img 
          src={gameData.playerImage}
          alt="Player"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />
      </div>

      {/* ==================== PREVIEW STATE ==================== */}
      {gameState === "preview" && (
        <div className="relative z-10 w-full h-full flex flex-col">
          {/* Top Badges */}
          <div className="px-4 pt-4 flex items-center justify-between">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full">
              <HelpCircle className="w-4 h-4 text-[#E36B11]" />
              <span className="text-xs font-bold text-white">GUESS CARD</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full">
              <Clock className="w-4 h-4 text-white" />
              <span className="text-sm font-bold text-white">{gameData.timeLimit}s</span>
            </div>
          </div>

          {/* Center Content */}
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            {/* Theme Badge */}
            <div className="mb-2">
              <span className="text-[#E36B11] text-xs tracking-widest">THEME</span>
            </div>
            
            {/* Theme Title with Icon */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">⚽</span>
              <h1 className="text-4xl font-black text-white italic" style={{ fontFamily: 'Impact, sans-serif' }}>
                {gameData.theme}
              </h1>
            </div>

            {/* Topic */}
            <div className="mb-6">
              <span className="text-[#E36B11] text-xs tracking-widest">TOPIC</span>
              <h2 className="text-white font-bold text-xl">{gameData.topic}</h2>
            </div>

            {/* Reward Box */}
            <div className="bg-gradient-to-r from-[#E36B11]/20 to-[#E36B11]/10 border border-[#E36B11]/50 rounded-full px-6 py-3 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-white/60 text-sm">YOU CAN WIN</span>
                <div className="flex items-center gap-1">
                  <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
                    <span className="text-black text-xs font-bold">$</span>
                  </div>
                  <span className="text-white font-black text-lg">+{gameData.maxReward} BOGX</span>
                </div>
              </div>
            </div>

            {/* Difficulty */}
            <div className="text-center mb-2">
              <span className="text-[#E36B11] text-xs tracking-widest">DIFFICULTY</span>
              <div className="flex items-center justify-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star 
                    key={star} 
                    className={`w-5 h-5 ${star <= gameData.difficulty ? "text-yellow-400 fill-yellow-400" : "text-white/30"}`} 
                  />
                ))}
              </div>
              <p className="text-white/50 text-xs mt-1">{gameData.difficultyText}</p>
            </div>
          </div>

          {/* Bottom Buttons */}
          <div className="px-4 pb-4 space-y-2">
            <button
              onClick={startGame}
              className="w-full bg-gradient-to-r from-[#E36B11] to-[#d00440] hover:from-[#d00440] hover:to-[#b00030] rounded-full py-4 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] shadow-lg shadow-[#E36B11]/30"
            >
              <Play className="w-5 h-5 text-white fill-white" />
              <span className="text-white font-black text-lg">PLAY NOW</span>
            </button>
            <button className="w-full bg-cream/10 hover:bg-cream/20 border border-white/20 rounded-full py-3 transition-all">
              <span className="text-white font-bold">SKIP THIS CARD</span>
            </button>
          </div>

          {/* Swipe Indicator */}
          <div className="pb-4 flex flex-col items-center">
            <ChevronUp className="w-5 h-5 text-white/40" />
            <span className="text-white/40 text-[10px] tracking-widest">SWIPE UP FOR NEXT CARD</span>
          </div>
        </div>
      )}

      {/* ==================== PLAYING STATE ==================== */}
      {gameState === "playing" && (
        <div className="relative z-10 w-full h-full flex flex-col">
          {/* Top Badges */}
          <div className="px-4 pt-4 flex items-center justify-between">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full">
              <Dribbble className="w-4 h-4 text-[#E36B11]" />
              <span className="text-xs font-bold text-white">SPORT</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full">
              <HelpCircle className="w-4 h-4 text-[#E36B11]" />
              <span className="text-xs font-bold text-white">GUESS CARD</span>
            </div>
          </div>

          {/* Question */}
          <div className="px-6 pt-4">
            <h2 
              className="text-white text-2xl font-bold text-center leading-tight"
              dangerouslySetInnerHTML={{ __html: formatQuestion(gameData.question) }}
            />
          </div>

          {/* Player Image Area */}
          <div className="flex-1 relative">
            {/* Social Icons on right */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4">
              <button className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center">
                  <span className="text-lg">+100</span>
                </div>
              </button>
              <button className="flex flex-col items-center">
                <Heart className="w-6 h-6 text-white" />
                <span className="text-white text-xs mt-1">245</span>
              </button>
              <button className="flex flex-col items-center">
                <MessageCircle className="w-6 h-6 text-white" />
                <span className="text-white text-xs mt-1">32</span>
              </button>
              <button onClick={handleShare} className="flex flex-col items-center">
                <Share2 className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>

          {/* Answer Options */}
          <div className="px-4 pb-2">
            <div className="grid grid-cols-2 gap-2">
              {gameData.options.map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer(option)}
                  disabled={selectedAnswer !== null}
                  className={`py-4  text-xl font-black transition-all ${
                    selectedAnswer === option
                      ? option === gameData.correctAnswer
                        ? "bg-green-500 text-white"
                        : "bg-[#E36B11] text-white"
                      : "bg-cream/10 text-white hover:bg-cream/20 border border-white/20"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Timer & Points Bar */}
          <div className="px-4 pb-4">
            <div className="bg-black/50 backdrop-blur-sm  p-3 border border-yellow-500/50">
              <div className="flex items-center justify-between">
                {/* Timer */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full border-2 border-white/30 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <span className="text-white font-black text-lg">{String(timeLeft).padStart(2, '0')}s</span>
                    <p className="text-white/50 text-[8px]">TIME LEFT</p>
                  </div>
                </div>

                {/* Points Bar */}
                <div className="flex-1 mx-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-yellow-400 font-bold text-sm">{gameData.maxReward}</span>
                    <span className="text-white/50 text-xs">BOGX</span>
                  </div>
                  <div className="h-2 bg-cream/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-400 to-yellow-400 transition-all duration-300"
                      style={{ width: `${(currentPoints / gameData.maxReward) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Current Points */}
                <div className="text-right">
                  <span className="text-[#E36B11] font-black text-lg">{currentPoints}</span>
                  <span className="text-white/50 text-xs ml-1">BOGX</span>
                  <p className="text-white/50 text-[8px]">POSSIBLE</p>
                </div>
              </div>
              <p className="text-white/40 text-[10px] text-center mt-2">BOGX decrease the longer you take!</p>
            </div>
          </div>

          {/* Swipe Indicator */}
          <div className="pb-2 flex flex-col items-center">
            <ChevronUp className="w-5 h-5 text-[#E36B11]" />
            <span className="text-white/40 text-[10px] tracking-widest">SWIPE UP FOR NEXT CARD</span>
          </div>
        </div>
      )}

      {/* ==================== RESULT STATE ==================== */}
      {gameState === "result" && (
        <div className="relative z-10 w-full h-full flex flex-col">
          {/* Top Badges */}
          <div className="px-4 pt-4 flex items-center justify-between">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full">
              <HelpCircle className="w-4 h-4 text-[#E36B11]" />
              <span className="text-xs font-bold text-white">GUESS CARD</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full">
              <Clock className="w-4 h-4 text-white" />
              <span className="text-sm font-bold text-white">{String(timeLeft).padStart(2, '0')}s</span>
            </div>
          </div>

          {/* Result Message */}
          <div className="px-6 pt-4 text-center">
            {isCorrect ? (
              <>
                <h1 className="text-4xl font-black text-yellow-400 mb-1" style={{ textShadow: '0 0 20px rgba(250, 204, 21, 0.5)' }}>
                  YOU WON!
                </h1>
                <p className="text-white/60">Correct answer!</p>
              </>
            ) : (
              <>
                <h1 className="text-4xl font-black text-red-500 mb-1">
                  {timeLeft === 0 ? "TIME'S UP!" : "WRONG!"}
                </h1>
                <p className="text-white/60">The correct answer was {gameData.correctAnswer}</p>
              </>
            )}
          </div>

          {/* Coin Animation Path */}
          {showCoinAnimation && isCorrect && (
            <div className="absolute inset-0 pointer-events-none z-50">
              {/* Animated coins flying to header */}
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-4 h-4 rounded-full bg-yellow-400 animate-coin-fly"
                  style={{
                    left: '50%',
                    top: '60%',
                    animationDelay: `${i * 0.1}s`,
                    boxShadow: '0 0 10px rgba(250, 204, 21, 0.8)',
                  }}
                />
              ))}
              {/* Golden trail effect */}
              <div className="absolute left-1/2 top-1/2 w-1 h-40 bg-gradient-to-t from-yellow-400/0 via-yellow-400 to-yellow-400/0 animate-pulse" 
                   style={{ transform: 'translateX(-50%) rotate(-45deg)' }} />
            </div>
          )}

          {/* Player Image Area */}
          <div className="flex-1 relative">
            {/* Social Icons on right */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4">
              <button className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-black/30 flex items-center justify-center">
                  <span className="text-lg">+100</span>
                </div>
              </button>
              <button className="flex flex-col items-center">
                <Heart className="w-6 h-6 text-white" />
                <span className="text-white text-xs mt-1">245</span>
              </button>
              <button className="flex flex-col items-center">
                <MessageCircle className="w-6 h-6 text-white" />
                <span className="text-white text-xs mt-1">32</span>
              </button>
              <button onClick={handleShare} className="flex flex-col items-center">
                <Share2 className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* Confetti effect for correct answer */}
            {isCorrect && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(20)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 animate-confetti"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: '-10px',
                      backgroundColor: ['#ec4899', '#8b5cf6', '#06b6d4', '#fbbf24', '#22c55e'][Math.floor(Math.random() * 5)],
                      animationDelay: `${Math.random() * 2}s`,
                      animationDuration: `${2 + Math.random() * 2}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Correct Answer Display */}
          <div className="px-4 pb-2">
            <div className={`py-4  text-xl font-black text-center ${
              isCorrect ? "bg-green-500/20 border-2 border-green-500 text-green-400" : "bg-red-500/20 border-2 border-red-500 text-red-400"
            }`}>
              {gameData.correctAnswer}
            </div>
          </div>

          {/* Result Points Bar */}
          <div className="px-4 pb-4">
            <div className={` p-3 border ${isCorrect ? "bg-green-500/10 border-green-500/50" : "bg-red-500/10 border-red-500/50"}`}>
              <div className="flex items-center justify-between">
                {/* Timer */}
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${isCorrect ? "border-green-500 bg-green-500/20" : "border-red-500 bg-red-500/20"}`}>
                    <Clock className={`w-4 h-4 ${isCorrect ? "text-green-400" : "text-red-400"}`} />
                  </div>
                  <div>
                    <span className="text-white font-black text-lg">{String(timeLeft).padStart(2, '0')}s</span>
                  </div>
                </div>

                {/* Points Earned */}
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center">
                    <span className="text-black text-xs font-bold">$</span>
                  </div>
                  <span className={`font-black text-xl ${isCorrect ? "text-green-400" : "text-red-400"}`}>
                    {isCorrect ? `+${currentPoints}` : "+0"}
                  </span>
                  <span className="text-white/50 text-sm">BOGX</span>
                </div>
              </div>
            </div>
          </div>

          {/* Swipe Indicator */}
          <div className="pb-2 flex flex-col items-center">
            <ChevronUp className="w-5 h-5 text-[#E36B11]" />
            <span className="text-white/40 text-[10px] tracking-widest">SWIPE UP FOR NEXT CARD</span>
          </div>
        </div>
      )}

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes coin-fly {
          0% {
            transform: translate(-50%, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -400px) scale(0.5);
            opacity: 0;
          }
        }
        .animate-coin-fly {
          animation: coin-fly 1s ease-out forwards;
        }
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti 3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
