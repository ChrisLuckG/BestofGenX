"use client";

import { useState } from "react";
import { Trophy, Clock, TrendingUp, Check, X, Calendar, Flame, Gift, ChevronRight, Zap } from "lucide-react";
import PageTemplate from "@/components/PageTemplate";

export interface ActiveBet {
  id: string;
  type: "prediction" | "guess" | "quiz";
  title: string;
  selection: string;
  amount: number;
  odds?: number;
  timestamp: Date;
  status: "pending" | "won" | "lost";
  matchInfo?: string;
}

interface ChallengesPageProps {
  activeBets: ActiveBet[];
  onClearBet?: (id: string) => void;
  onBack?: () => void;
}

// Challenge data
const ongoingChallenge = {
  month: "MAY 2024",
  title: "BATTLE LEGENDS",
  description: "Win battles, earn points and become a legend.",
  endsIn: "12D 18H 34M",
  prizes: [
    { place: 1, coins: 1000, extra: "+ Exclusive Title" },
    { place: 2, coins: 500, extra: "+ Exclusive Title" },
    { place: 3, coins: 250, extra: "+ Exclusive Title" },
  ]
};

const upcomingChallenges = [
  { month: "JUNE 2024", title: "GOAL GETTERS", description: "Score goals and climb to the top.", startsIn: "15D 07H", image: "🌅" },
  { month: "JULY 2024", title: "SUMMER SHOWDOWN", description: "Compete all summer long.", startsIn: "45D 07H", image: "🏝️" },
  { month: "AUGUST 2024", title: "CHAMPIONS ARENA", description: "Only the best can survive.", startsIn: "76D 07H", image: "🏟️" },
];

const completedChallenges = [
  { month: "APRIL 2024", title: "SPRING SHOWDOWN", description: "The battle for glory in spring.", winners: ["👤", "👤", "👤"] },
  { month: "MARCH 2024", title: "FOOTBALL FEVER", description: "Score goals, earn points.", winners: ["👤", "👤", "👤"] },
  { month: "FEBRUARY 2024", title: "WINTER WARRIORS", description: "Survive the cold, dominate all.", winners: ["👤", "👤", "👤"] },
];

export default function ChallengesPage({ activeBets, onClearBet, onBack }: ChallengesPageProps) {
  const [showPrizes, setShowPrizes] = useState(false);
  const pendingBets = activeBets.filter(b => b.status === "pending");
  const completedBets = activeBets.filter(b => b.status !== "pending");

  return (
    <PageTemplate title="Challenges" icon={<Zap className="w-5 h-5 text-[#D4873A]" />} onBack={onBack}>
      <div className="p-4 space-y-4">
        {/* March Challenge Banner */}
        <div className="bg-sport/20 border border-sport/50  p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-sport/30 flex items-center justify-center flex-shrink-0">
              <Flame className="w-5 h-5 text-sport" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sport font-bold text-sm">March Challenge</span>
                <span className="px-2 py-0.5 bg-sport/30 rounded-full text-[10px] font-bold text-sport">ACTIVE</span>
              </div>
              <p className="text-white/70 text-xs mb-2">
                Play daily challenges and collect as many coins as possible! Top 10 players win exclusive prizes.
              </p>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-sport" />
                  <span className="text-sport font-bold text-xs">12 days left</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-3 h-3 text-[#D4873A]" />
                  <span className="text-[#D4873A] font-bold text-xs">Top 10 = Prize</span>
                </div>
              </div>
              
              {/* Prize List Link */}
              <button
                onClick={() => setShowPrizes(true)}
                className="w-full flex items-center justify-between p-2.5 bg-[#D4873A]/20 hover:bg-[#D4873A]/30 border border-[#D4873A]/50 rounded-lg transition-all"
              >
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-[#D4873A]" />
                  <span className="text-[#D4873A] font-bold text-sm">View Prize List</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#D4873A]" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Prize List Modal */}
        {showPrizes && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
            <div className="bg-black rounded-2xl w-full max-w-[340px] border border-white/10 overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-[#D4873A]" />
                  <h3 className="font-bold text-lg">March Prizes</h3>
                </div>
                <button
                  onClick={() => setShowPrizes(false)}
                  className="w-8 h-8 rounded-full bg-cream/10 flex items-center justify-center hover:bg-cream/20"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                {/* Platz 1 */}
                <div className="flex items-center gap-3 p-3 bg-[#D4873A]/20 border border-[#D4873A]/50 ">
                  <div className="w-10 h-10 rounded-full bg-[#D4873A]/30 flex items-center justify-center">
                    <span className="text-xl">🥇</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-[#D4873A]">1st Place</p>
                    <p className="text-white text-sm">Original Jersey + 5,000 Coins</p>
                  </div>
                  <span className="text-[#D4873A] font-bold text-xs">50.000 Pts</span>
                </div>
                
                {/* Platz 2 */}
                <div className="flex items-center gap-3 p-3 bg-gray-400/20 border border-gray-400/50 ">
                  <div className="w-10 h-10 rounded-full bg-gray-400/30 flex items-center justify-center">
                    <span className="text-xl">🥈</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-300">2nd Place</p>
                    <p className="text-white text-sm">Fan Scarf + 3,000 Coins</p>
                  </div>
                  <span className="text-gray-300 font-bold text-xs">35.000 Pts</span>
                </div>
                
                {/* Platz 3 */}
                <div className="flex items-center gap-3 p-3 bg-orange-500/20 border border-orange-500/50 ">
                  <div className="w-10 h-10 rounded-full bg-orange-500/30 flex items-center justify-center">
                    <span className="text-xl">🥉</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-orange-400">3rd Place</p>
                    <p className="text-white text-sm">Cap + 2,000 Coins</p>
                  </div>
                  <span className="text-orange-400 font-bold text-xs">25.000 Pts</span>
                </div>
                
                {/* Platz 4-10 */}
                <div className="flex items-center gap-3 p-3 bg-cream/5 border border-white/10 ">
                  <div className="w-10 h-10 rounded-full bg-cream/10 flex items-center justify-center">
                    <span className="text-xl">🎁</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-white">4th-10th Place</p>
                    <p className="text-white/70 text-sm">1,000 Coins</p>
                  </div>
                  <span className="text-white/60 font-bold text-xs">10.000 Pts</span>
                </div>
              </div>
              
              <div className="p-4 border-t border-white/10 bg-sport/10">
                <p className="text-center text-white/60 text-xs">
                  Points are earned by completing challenges
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Active Bets */}
        {pendingBets.length > 0 && (
          <div>
            <h3 className="text-base font-bold text-sport mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Active Challenges ({pendingBets.length})
            </h3>
            <div className="space-y-3">
              {pendingBets.map((bet) => (
                <div
                  key={bet.id}
                  className="p-4  bg-cream/5 border border-white/10"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm px-3 py-1 bg-sport/20 text-sport rounded-full font-bold">
                          {bet.type === "prediction" ? "PREDICTION" : bet.type === "guess" ? "GUESS" : "QUIZ"}
                        </span>
                        <span className="text-sm text-gray-600">
                          {new Date(bet.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="font-bold text-base mb-1">{bet.title}</p>
                      <p className="text-sm text-gray-600">{bet.matchInfo}</p>
                      <div className="flex items-center gap-4 mt-3">
                        <span className="text-sm text-white/80">
                          Selection: <span className="font-bold text-sport">{bet.selection}</span>
                        </span>
                        {bet.odds && (
                          <span className="text-sm text-white/80">
                            Odds: <span className="font-bold">{bet.odds}x</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sport font-bold text-xl">{bet.amount}</p>
                      <p className="text-xs text-gray-600">Coins</p>
                      {bet.odds && (
                        <p className="text-sm text-gray-600 mt-1">
                          Win: <span className="text-sport-gold font-bold">{Math.round(bet.amount * bet.odds)}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-sport rounded-full animate-pulse" />
                      <span className="text-sm text-sport font-medium">Challenge in progress...</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed Bets */}
        {completedBets.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-600 mb-2 flex items-center gap-2">
              <Check className="w-4 h-4" />
              Completed ({completedBets.length})
            </h3>
            <div className="space-y-2">
              {completedBets.map((bet) => (
                <div
                  key={bet.id}
                  className={`p-3  border ${
                    bet.status === "won" 
                      ? "bg-sport/10 border-sport/30" 
                      : "bg-cream/5 border-white/10 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">{bet.title}</p>
                      <p className="text-xs text-gray-600">{bet.selection}</p>
                    </div>
                    <div className="text-right">
                      {bet.status === "won" ? (
                        <p className="text-sport font-bold">+{Math.round(bet.amount * (bet.odds || 1))}</p>
                      ) : (
                        <p className="text-gray-500 font-bold">-{bet.amount}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {activeBets.length === 0 && (
          <div className="h-full flex items-center justify-center text-center">
            <div>
              <span className="text-5xl mb-4 block">🎯</span>
              <h3 className="text-lg font-bold mb-2">No active challenges</h3>
              <p className="text-gray-600 text-sm">
                Scroll through the feed and start challenges!
              </p>
            </div>
          </div>
        )}
      </div>
    </PageTemplate>
  );
}
