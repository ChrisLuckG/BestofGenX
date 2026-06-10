"use client";

import { useState, useEffect } from "react";
import { Play, CheckCircle, XCircle, Coins, Eye } from "lucide-react";

interface AdGameProps {
  adData: {
    brand: string;
    title: string;
    description: string;
    imageUrl: string;
    videoUrl?: string;
    duration: number;
    question: string;
    options: string[];
    correctAnswer: number;
    reward: number;
    brandColor?: "red" | "gold";
  };
  onComplete?: (correct: boolean, reward: number) => void;
  onStart?: (reward: number) => void;
  disabled?: boolean;
}

export default function AdGame({ adData, onComplete, onStart, disabled }: AdGameProps) {
  const [phase, setPhase] = useState<"intro" | "watching" | "question" | "result">("intro");
  const [watchProgress, setWatchProgress] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  
  const isGold = adData.brandColor === "gold";
  const accentColor = isGold ? "text-yellow-400" : "text-sport";
  const accentBg = isGold ? "bg-yellow-400" : "bg-sport";
  const accentBgLight = isGold ? "bg-yellow-400/20" : "bg-sport/20";
  const accentBorder = isGold ? "border-yellow-400/50" : "border-sport/50";

  useEffect(() => {
    if (phase === "watching") {
      const duration = adData.duration || 5;
      const increment = 100 / (duration * 10);
      const interval = setInterval(() => {
        setWatchProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + increment;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [phase, adData.duration]);

  useEffect(() => {
    if (watchProgress >= 100 && phase === "watching") {
      setPhase("question");
    }
  }, [watchProgress, phase]);

  const handleStartWatching = () => {
    setPhase("watching");
    onStart?.(adData.reward);
  };

  const handleAnswer = (index: number) => {
    setSelectedAnswer(index);
    const correct = index === adData.correctAnswer;
    setIsCorrect(correct);
    setPhase("result");
    onComplete?.(correct, adData.reward);
  };

  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Fullscreen Background Image */}
      <img 
        src={adData.imageUrl} 
        alt={adData.brand}
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#00003C] via-[#00003C]/70 to-[#00003C]/40" />

      {/* Content Overlay */}
      <div className="relative z-10 w-full h-full flex flex-col">
        {/* Top Badge */}
        <div className="px-3 pt-5 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full">
            <Eye className={`w-4 h-4 ${accentColor}`} />
            <span className="text-xs font-bold text-white">AD CHALLENGE</span>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 ${accentBg} rounded-full`}>
            <Coins className="w-4 h-4 text-white" />
            <span className="text-sm font-black text-white">+{adData.reward}</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col justify-end p-4 pb-6">
          {/* Intro Phase */}
          {phase === "intro" && (
            <>
              {/* Center Play Button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={handleStartWatching}
                  className={`w-24 h-24 rounded-full ${isGold ? 'bg-yellow-400/90 hover:bg-yellow-400' : 'bg-sport/90 hover:bg-sport'} hover:scale-110 transition-all flex items-center justify-center shadow-2xl`}
                >
                  <Play className="w-12 h-12 text-white ml-1" fill="white" />
                </button>
              </div>
              
              {/* Bottom Content */}
              <div>
                <p className="text-white/60 text-sm mb-1">Ad by</p>
                <h2 className="text-3xl font-black text-white mb-2">{adData.brand}</h2>
                <p className="text-white/80 text-lg mb-1">{adData.title}</p>
                <p className="text-white/60 text-sm mb-6">{adData.description}</p>
                
                {/* Reward Highlight */}
                <div className={`${accentBgLight} backdrop-blur-sm border ${accentBorder}  p-4`}>
                  <div className="flex items-center justify-center gap-3">
                    <Coins className={`w-7 h-7 ${accentColor}`} />
                    <div>
                      <p className={`${accentColor} font-black text-xl`}>+{adData.reward} P</p>
                      <p className="text-white/60 text-[10px]">Watch the video & answer the question!</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Watching Phase */}
          {phase === "watching" && (
            <>
              {/* Video Player - Fullscreen */}
              {adData.videoUrl && (
                <div className="absolute inset-0 z-20">
                  <video
                    src={adData.videoUrl}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              
              {/* Top Labels over Video */}
              <div className="absolute top-0 left-0 right-0 z-30 px-3 pt-5 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full">
                  <Eye className={`w-4 h-4 ${accentColor}`} />
                  <span className="text-xs font-bold text-white">AD CHALLENGE</span>
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 ${accentBg} rounded-full`}>
                  <Coins className="w-4 h-4 text-white" />
                  <span className="text-sm font-black text-white">+{adData.reward}</span>
                </div>
              </div>
              
              {/* Pay Attention - oberhalb der Progress Bar */}
              <div className="absolute bottom-28 left-0 right-0 z-30 flex justify-center pointer-events-none">
                <div className="bg-black/60 backdrop-blur-sm px-6 py-3 rounded-full animate-pulse">
                  <span className="text-white font-bold text-lg">👀 Pay Attention!</span>
                </div>
              </div>
              
              {/* Progress Bar at Bottom */}
              <div className="absolute bottom-0 left-0 right-0 z-30 p-4 pb-6">
                <div className="bg-black/50 backdrop-blur-sm  p-4">
                  <div className="flex items-center justify-between text-sm text-white mb-2">
                    <span className="font-bold">Ad playing...</span>
                    <span className="font-bold">{Math.ceil((100 - watchProgress) / (100 / adData.duration))}s</span>
                  </div>
                  <div className="w-full h-2 bg-cream/20 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${accentBg} transition-all`}
                      style={{ width: `${watchProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Question Phase */}
          {phase === "question" && (
            <div className="flex flex-col h-full">
              {/* Question Box - Top */}
              <div className="bg-black/70 backdrop-blur-sm  p-4 mb-4">
                <h2 className="text-white font-bold text-lg">{adData.question}</h2>
              </div>
              
              {/* Answers - Middle */}
              <div className="space-y-2 flex-1">
                {adData.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedAnswer(index)}
                    className={`w-full py-3 px-4  backdrop-blur-sm border-2 transition-all text-left font-medium text-white ${
                      selectedAnswer === index
                        ? "bg-sport/30 border-sport"
                        : "bg-black/50 border-white/20 hover:border-sport hover:bg-sport/20"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              {/* CTA Button - Bottom */}
              <button
                onClick={() => selectedAnswer !== null && handleAnswer(selectedAnswer)}
                disabled={selectedAnswer === null}
                className={`w-full py-3  font-bold transition-all mt-4 ${
                  selectedAnswer === null
                    ? "bg-cream/10 text-gray-500"
                    : "bg-sport hover:bg-sport-dark text-white"
                }`}
              >
                {selectedAnswer !== null ? "Confirm answer" : "Select an answer"}
              </button>
            </div>
          )}

          {/* Result Phase */}
          {phase === "result" && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
              <div className={`w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center backdrop-blur-sm ${
                isCorrect ? "bg-sport/30 border-2 border-sport" : "bg-cream/10 border-2 border-white/20"
              }`}>
                {isCorrect ? (
                  <CheckCircle className="w-12 h-12 text-sport" />
                ) : (
                  <XCircle className="w-12 h-12 text-white/60" />
                )}
              </div>
              <h2 className={`text-3xl font-black mb-2 ${isCorrect ? "text-sport" : "text-white/60"}`}>
                {isCorrect ? "CORRECT!" : "WRONG"}
              </h2>
              {isCorrect ? (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Coins className="w-8 h-8 text-sport" />
                  <p className="text-sport font-black text-3xl">+{adData.reward} P</p>
                </div>
              ) : (
                <p className="text-white/60 text-sm mb-4">
                  Correct answer: {adData.options[adData.correctAnswer]}
                </p>
              )}
              <div className="bg-black/50 backdrop-blur-sm  p-3">
                <p className="text-white/60 text-xs">Ad by</p>
                <p className="text-white font-bold">{adData.brand}</p>
              </div>
              
              {/* Swipe Indicator */}
              <div className="flex flex-col items-center gap-1 mt-[82px] animate-bounce">
                <span className="text-white text-sm font-bold">Swipe down to continue</span>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
