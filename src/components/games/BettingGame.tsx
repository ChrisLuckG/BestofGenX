"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Coins, Trophy, Zap, Radio, ExternalLink } from "lucide-react";

export interface BetData {
  id: string;
  type: "prediction";
  title: string;
  selection: string;
  amount: number;
  odds: number;
  timestamp: Date;
  status: "pending" | "won" | "lost";
  matchInfo: string;
}

interface BettingGameProps {
  onBetPlaced?: (bet: BetData) => void;
  hasBetPlaced?: boolean;
  disabled?: boolean;
}

export default function BettingGame({ onBetPlaced, hasBetPlaced = false, disabled = false }: BettingGameProps) {
  const [selectedTeam, setSelectedTeam] = useState<"home" | "away" | null>(null);
  const [betAmount, setBetAmount] = useState(100);
  const [result, setResult] = useState<"win" | "lose" | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [betPlaced, setBetPlaced] = useState(hasBetPlaced);

  const match = {
    home: { name: "Bayern", odds: 1.85, logo: "🔴" },
    away: { name: "Dortmund", odds: 2.10, logo: "🟡" },
    league: "Bundesliga",
    time: "20:30",
    isLive: true,
    currentScore: "1 : 1",
    minute: "67'",
    bettingPartner: {
      name: "Bwin",
      url: "https://www.bwin.com",
      logo: "🎰",
    },
  };

  const handleBet = () => {
    if (!selectedTeam) return;
    
    // Wette an Parent melden
    if (onBetPlaced && !betPlaced) {
      const selectedTeamData = selectedTeam === "home" ? match.home : match.away;
      onBetPlaced({
        id: `bet-${Date.now()}`,
        type: "prediction",
        title: `${match.home.name} vs ${match.away.name}`,
        selection: selectedTeamData.name,
        amount: betAmount,
        odds: selectedTeamData.odds,
        timestamp: new Date(),
        status: "pending",
        matchInfo: `${match.league} • ${match.minute}`,
      });
      setBetPlaced(true);
    }
    
    setIsRevealing(true);
    
    setTimeout(() => {
      const won = Math.random() > 0.5;
      setResult(won ? "win" : "lose");
      setIsRevealing(false);
    }, 1500);
  };

  
  const baseReward = 100;
  const potentialWin = selectedTeam ? Math.round(baseReward * (selectedTeam === "home" ? match.home.odds : match.away.odds)) : baseReward;

  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Fullscreen Background Image */}
      <img 
        src="https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?w=800"
        alt="Stadium"
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#00003C] via-[#00003C]/80 to-[#00003C]/50" />

      {/* Content Overlay */}
      <div className="relative z-10 w-full h-full flex flex-col">
        {/* Top Badge */}
        <div className="px-3 pt-5 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full">
            <Zap className="w-4 h-4 text-sport" />
            <span className="text-xs font-bold text-white">PREDICTION</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-sport rounded-full">
            <Coins className="w-4 h-4 text-white" />
            <span className="text-sm font-black text-white">+{potentialWin}</span>
          </div>
        </div>

        {/* Live Score - With spacing */}
        {match.isLive && (
          <div className="px-3 mt-2 mb-3">
            <div className="w-full flex items-center justify-between px-4 py-2 bg-black/50 backdrop-blur-sm ">
              <span className="text-2xl">{match.home.logo}</span>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1">
                  <Radio className="w-2.5 h-2.5 text-sport animate-pulse" />
                  <span className="text-[10px] font-bold text-sport">LIVE</span>
                </div>
                <span className="text-2xl font-black text-white">{match.currentScore}</span>
                <p className="text-white/60 text-[10px]">{match.league} • {match.minute}</p>
              </div>
              <span className="text-2xl">{match.away.logo}</span>
            </div>
          </div>
        )}

        {/* Who wins? - Separate, positioned lower */}
        <div className="flex items-center justify-center pt-4 pb-3">
          <h2 className="text-2xl font-black text-white text-center">Who wins?</h2>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col justify-between p-4 pt-0">
          {/* Teams - Compact */}
          {!betPlaced && (
            <div className="flex flex-col w-full">
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => !result && setSelectedTeam("home")}
                  className={`relative flex-1 p-3  backdrop-blur-sm transition-all ${
                    selectedTeam === "home"
                      ? "bg-sport/30 border-2 border-sport"
                      : "bg-black/40 border-2 border-white/20 hover:border-white/40"
                  }`}
                >
                  <div className="flex flex-col items-center gap-1 text-center">
                    <span className="text-2xl">{match.home.logo}</span>
                    <span className="font-bold text-white text-sm">{match.home.name}</span>
                    <span className="text-sport font-bold text-xs">{match.home.odds}x</span>
                  </div>
                </button>

                <span className="text-white/40 font-bold text-xs">VS</span>

                <button
                  onClick={() => !result && setSelectedTeam("away")}
                  className={`relative flex-1 p-3  backdrop-blur-sm transition-all ${
                    selectedTeam === "away"
                      ? "bg-sport/30 border-2 border-sport"
                      : "bg-black/40 border-2 border-white/20 hover:border-white/40"
                  }`}
                >
                  <div className="flex flex-col items-center gap-1 text-center">
                    <span className="text-2xl">{match.away.logo}</span>
                    <span className="font-bold text-white text-sm">{match.away.name}</span>
                    <span className="text-sport font-bold text-xs">{match.away.odds}x</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* CTA Button */}
          {!betPlaced && (
            <button
              onClick={handleBet}
              disabled={!selectedTeam || isRevealing}
              className={`w-full py-3  font-bold transition-all ${
                !selectedTeam
                  ? "bg-cream/10 text-gray-500"
                  : isRevealing
                  ? "bg-sport/50 animate-pulse text-white"
                  : "bg-sport hover:bg-sport-dark text-white"
              }`}
            >
              {isRevealing ? "Starting challenge..." : selectedTeam ? "Start Challenge" : "Select a team"}
            </button>
          )}

          {/* Result */}
          {betPlaced && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sport/30 border-2 border-sport mb-3">
                  <Trophy className="w-8 h-8 text-sport" />
                </div>
                <p className="text-white font-bold text-xl mb-1">Challenge started!</p>
                <p className="text-white/70 text-base">Your pick: {selectedTeam === "home" ? match.home.name : match.away.name}</p>
                
                {/* Info Banner mit Pfeil */}
                <div className="mt-6 p-4 bg-cream/10 backdrop-blur-sm  border border-white/20">
                  <p className="text-white font-bold text-base mb-2">
                    Find active challenges in the Challenges tab
                  </p>
                  <div className="flex justify-center ml-[116px] animate-bounce">
                    <svg className="w-6 h-6 text-sport" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Reward Highlight - FIXED AT BOTTOM */}
        <div className="flex-shrink-0 p-4 pt-0">
          <div className="bg-sport/20 backdrop-blur-sm border border-sport/50  p-3">
            <div className="flex items-center justify-center gap-3">
              <Coins className="w-7 h-7 text-sport" />
              <div>
                <p className="text-sport font-black text-xl">+{potentialWin} P</p>
                <p className="text-white/60 text-[10px]">
                  {betPlaced ? "Potential win" : "Select a team & start the challenge!"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
