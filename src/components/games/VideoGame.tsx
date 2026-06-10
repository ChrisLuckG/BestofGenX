"use client";

import { useState, useEffect } from "react";
import { Play, CheckCircle, XCircle, Coins, Film, Clock } from "lucide-react";

interface VideoGameProps {
  videoData: {
    title: string;
    match: string;
    description: string;
    imageUrl: string;
    duration: number;
    question: string;
    options: string[];
    correctAnswer: number;
    reward: number;
  };
  onComplete?: (correct: boolean, reward: number) => void;
  onStart?: (reward: number) => void;
}

export default function VideoGame({ videoData, onComplete, onStart }: VideoGameProps) {
  const [phase, setPhase] = useState<"intro" | "watching" | "question" | "result" | "timeout">("intro");
  const [watchProgress, setWatchProgress] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [timeLeft, setTimeLeft] = useState(10);

  useEffect(() => {
    if (phase === "watching" && watchProgress < 100) {
      const interval = setInterval(() => {
        setWatchProgress(prev => prev + (100 / (videoData.duration * 10)));
      }, 100);
      return () => clearInterval(interval);
    }
  }, [phase, videoData.duration]);

  useEffect(() => {
    if (watchProgress >= 100 && phase === "watching") {
      setPhase("question");
      setTimeLeft(10);
    }
  }, [watchProgress, phase]);

  // Timer for question phase
  useEffect(() => {
    if (phase === "question" && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && phase === "question") {
      setPhase("timeout");
      onComplete?.(false, videoData.reward);
    }
  }, [timeLeft, phase]);

  const handleStartWatching = () => {
    setPhase("watching");
    onStart?.(videoData.reward);
  };

  const handleAnswer = (index: number) => {
    setSelectedAnswer(index);
    const correct = index === videoData.correctAnswer;
    setIsCorrect(correct);
    setPhase("result");
    onComplete?.(correct, videoData.reward);
  };

  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Fullscreen Background Image */}
      <img 
        src={videoData.imageUrl} 
        alt={videoData.title}
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#00003C] via-[#00003C]/70 to-[#00003C]/40" />

      {/* Content Overlay */}
      <div className="relative z-10 w-full h-full flex flex-col">
        {/* Top Badge */}
        <div className="px-3 pt-5 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full">
            <Film className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-bold text-white">VIDEO CHALLENGE</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 rounded-full">
            <Coins className="w-4 h-4 text-white" />
            <span className="text-sm font-black text-white">+{videoData.reward}</span>
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
                  className="w-24 h-24 rounded-full bg-yellow-500/90 hover:bg-yellow-500 hover:scale-110 transition-all flex items-center justify-center shadow-2xl"
                >
                  <Play className="w-12 h-12 text-white ml-1" fill="white" />
                </button>
              </div>
              
              {/* Bottom Content */}
              <div>
                <p className="text-yellow-400 text-sm mb-1 font-bold">⚽ {videoData.match}</p>
                <h2 className="text-3xl font-black text-white mb-2">{videoData.title}</h2>
                <p className="text-white/80 text-lg mb-1">{videoData.description}</p>
                
                {/* Reward Highlight */}
                <div className="bg-yellow-500/20 backdrop-blur-sm border border-yellow-500/50  p-4 mt-4">
                  <div className="flex items-center justify-center gap-3">
                    <Coins className="w-7 h-7 text-yellow-400" />
                    <div>
                      <p className="text-yellow-400 font-black text-xl">+{videoData.reward} P</p>
                      <p className="text-white/60 text-[10px]">Watch the clip & answer the question!</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Watching Phase */}
          {phase === "watching" && (
            <div>
              <div className="text-center mb-4">
                <p className="text-white/60 text-sm">Pay attention!</p>
                <p className="text-white font-bold text-xl">{videoData.match}</p>
              </div>
              
              {/* Progress Bar */}
              <div className="bg-black/50 backdrop-blur-sm  p-4">
                <div className="flex items-center justify-between text-sm text-white mb-2">
                  <span className="font-bold">Video playing...</span>
                  <span className="font-bold">{Math.ceil((100 - watchProgress) / (100 / videoData.duration))}s</span>
                </div>
                <div className="w-full h-2 bg-cream/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-yellow-500 transition-all"
                    style={{ width: `${watchProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Question Phase */}
          {phase === "question" && (
            <div className="flex flex-col h-full">
              {/* Timer - Above Question */}
              <div className={`flex items-center justify-center gap-2 px-4 py-2 mb-2 rounded-full mx-auto ${timeLeft <= 3 ? 'bg-red-500/30' : 'bg-cream/10'}`}>
                <Clock className={`w-5 h-5 ${timeLeft <= 3 ? 'text-red-400' : 'text-white/60'}`} />
                <span className={`text-lg font-bold ${timeLeft <= 3 ? 'text-red-400' : 'text-white'}`}>{timeLeft}s</span>
              </div>
              
              {/* Question Box */}
              <div className="bg-black/70 backdrop-blur-sm  p-4 mb-4">
                <h2 className="text-white font-bold text-lg text-center">{videoData.question}</h2>
              </div>
              
              {/* Answers - Middle */}
              <div className="space-y-2 flex-1">
                {videoData.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedAnswer(index)}
                    className={`w-full py-3 px-4  backdrop-blur-sm border-2 transition-all text-left font-medium text-white ${
                      selectedAnswer === index
                        ? "bg-yellow-500/30 border-yellow-500"
                        : "bg-black/50 border-white/20 hover:border-yellow-500 hover:bg-yellow-500/20"
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
                    : "bg-yellow-500 hover:bg-yellow-600 text-white"
                }`}
              >
                {selectedAnswer !== null ? "Confirm answer" : "Select an answer"}
              </button>
            </div>
          )}

          {/* Timeout Phase */}
          {phase === "timeout" && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center backdrop-blur-sm bg-red-500/30 border-2 border-red-500">
                  <Clock className="w-12 h-12 text-red-400" />
                </div>
                <h2 className="text-3xl font-black mb-2 text-red-400">TIME'S UP!</h2>
                <p className="text-white/60 text-sm mb-4">
                  Correct answer: {videoData.options[videoData.correctAnswer]}
                </p>
                <div className="bg-black/50 backdrop-blur-sm  p-3">
                  <p className="text-white/60 text-xs">Highlight from</p>
                  <p className="text-white font-bold">{videoData.match}</p>
                </div>
              </div>
            </div>
          )}

          {/* Result Phase */}
          {phase === "result" && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
              <div className={`w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center backdrop-blur-sm ${
                isCorrect ? "bg-yellow-500/30 border-2 border-yellow-500" : "bg-cream/10 border-2 border-white/20"
              }`}>
                {isCorrect ? (
                  <CheckCircle className="w-12 h-12 text-yellow-400" />
                ) : (
                  <XCircle className="w-12 h-12 text-white/60" />
                )}
              </div>
              <h2 className={`text-3xl font-black mb-2 ${isCorrect ? "text-yellow-400" : "text-white/60"}`}>
                {isCorrect ? "CORRECT!" : "WRONG"}
              </h2>
              {isCorrect ? (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Coins className="w-8 h-8 text-yellow-400" />
                  <p className="text-yellow-400 font-black text-3xl">+{videoData.reward} P</p>
                </div>
              ) : (
                <p className="text-white/60 text-sm mb-4">
                  Correct answer: {videoData.options[videoData.correctAnswer]}
                </p>
              )}
              <div className="bg-black/50 backdrop-blur-sm  p-3">
                <p className="text-white/60 text-xs">Highlight from</p>
                <p className="text-white font-bold">{videoData.match}</p>
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
