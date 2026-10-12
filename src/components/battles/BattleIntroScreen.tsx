"use client";

import { Swords, HelpCircle, Coins, Trophy, Play } from "lucide-react";
import CountryFlag from "@/components/CountryFlag";
import BackButton from "@/components/BackButton";
import { formatCurrency } from "@/utils/currency";
import { Battle, getTopicConfig, toBOGX } from "./types";

interface BattleIntroScreenProps {
  battle: Battle;
  userAvatar?: string;
  userCountryFlag?: string;
  userId?: string;
  onBack: () => void;
  onStart: () => void;
  onDecline?: () => void;
  onShowLogin?: () => void;
}

export default function BattleIntroScreen({
  battle,
  userAvatar,
  userCountryFlag,
  userId,
  onBack,
  onStart,
  onDecline,
  onShowLogin,
}: BattleIntroScreenProps) {
  const topic = getTopicConfig(battle.topic);
  const potAmount = toBOGX(battle.wager) * 2;
  const isPrivateChallenge = battle.isPrivate && battle.challengedUser === userId;

  return (
    <div className="flex flex-col h-full bg-cream">
      {/* Main Card */}
      <div className="flex-1 m-4 border border-warm bg-cream rounded-2xl flex flex-col overflow-hidden shadow-lg animate-[cardIn_0.4s_ease-out]">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-warm flex items-center gap-3">
          <BackButton onClick={onBack} />
          <Swords className="w-5 h-5 text-[#A855F7]" />
          <div>
            <span className="font-display text-xl tracking-wider text-gray-900">QuizzBattle</span>
            <p className="text-xs text-gray-500">Challenge players, win their wager.</p>
          </div>
        </div>

        {/* VS Section - Horizontal layout like standalone */}
        <div className="flex items-stretch border-b border-warm">
          {/* You */}
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 border-r border-warm animate-[slideInLeft_0.4s_0.1s_ease-out_backwards]">
            <div className="relative">
              <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-[#A855F7] shadow-lg animate-[ringPulse_1.6s_ease-in-out_infinite]">
                <img src={userAvatar || 'https://i.pravatar.cc/80?img=47'} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                <CountryFlag flag={userCountryFlag || 'DE'} className="w-7 h-5 rounded shadow-md" />
              </div>
            </div>
            <div className="text-center">
              <div className="font-display text-xl tracking-wider text-gray-900">You</div>
              <div className="px-3 py-1 bg-[#A855F7] rounded-lg text-xs text-white font-bold mt-1">CHALLENGER</div>
            </div>
          </div>

          {/* VS Center */}
          <div className="flex flex-col items-center justify-center gap-4 px-8 py-6 bg-gray-100">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 border border-warm rounded-xl text-sm text-gray-600 uppercase tracking-wider font-bold animate-[chipIn_0.3s_0.2s_ease-out_backwards]">
              <topic.icon className="w-4 h-4" /> {topic.label}
            </span>
            <div className="font-display text-4xl text-gray-500 tracking-wider animate-[headlineIn_0.5s_0.1s_ease-out_backwards]">VS</div>
            <div className="text-center animate-[popScale_0.5s_0.2s_ease-out_backwards]">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Winner Takes</div>
              <div className="flex items-center justify-center gap-2">
                <span className="font-display text-3xl text-[#C9A227]">{formatCurrency(potAmount)}</span>
                <img src="/images/bogxcoin.png" alt="BOGX" className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Opponent */}
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 border-l border-warm animate-[slideInRightBattle_0.4s_0.1s_ease-out_backwards]">
            <div className="relative">
              <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-warm shadow-lg">
                <img src={battle.creator.avatar} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                <CountryFlag flag={battle.creator.countryFlag} className="w-7 h-5 rounded shadow-md" />
              </div>
            </div>
            <div className="text-center">
              <div className="font-display text-xl tracking-wider text-gray-900">{battle.creator.username}</div>
              <div className="px-3 py-1 bg-gray-200 rounded-lg text-xs text-gray-600 font-bold mt-1">DEFENDER</div>
            </div>
          </div>
        </div>

        {/* Battle Info */}
        <div className="p-6 flex-1 flex flex-col">
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 mb-6 animate-[fadeInUp_0.4s_0.2s_ease-out_backwards]">
            <div className="bg-gray-100 border border-warm rounded-xl p-4 text-center">
              <HelpCircle className="w-6 h-6 text-gray-500 mx-auto mb-2" />
              <div className="font-display text-2xl text-gray-900">{battle.rounds}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Rounds</div>
            </div>
            <div className="bg-gray-100 border border-warm rounded-xl p-4 text-center">
              <Coins className="w-6 h-6 text-gray-500 mx-auto mb-2" />
              <div className="font-display text-2xl text-[#C9A227]">{formatCurrency(toBOGX(battle.wager))}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Your Entry</div>
            </div>
            <div className="bg-gray-100 border border-warm rounded-xl p-4 text-center">
              <Trophy className="w-6 h-6 text-gray-500 mx-auto mb-2" />
              <div className="font-display text-2xl text-[#C9A227]">{formatCurrency(potAmount)}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Win Pot</div>
            </div>
          </div>

          {/* Rules */}
          <div className="bg-gray-100 rounded-xl p-4 mb-6 animate-[fadeInUp_0.4s_0.3s_ease-out_backwards]">
            <div className="flex items-center gap-3 text-gray-700 text-sm mb-3">
              <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                <Coins className="w-4 h-4 text-gray-500" />
              </div>
              <span>Your wager is <span className="font-bold">locked</span> until the battle ends.</span>
            </div>
            <div className="flex items-center gap-3 text-gray-700 text-sm">
              <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                <Trophy className="w-4 h-4 text-gray-500" />
              </div>
              <span><span className="font-bold">Winner takes the full pot.</span> Fastest correct answers win ties.</span>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Buttons */}
          <div className="animate-[fadeInUp_0.4s_0.4s_ease-out_backwards]">
            <button
              onClick={() => {
                if (!userId) {
                  onShowLogin?.();
                  return;
                }
                onStart();
              }}
              className="w-full py-4 bg-[#A855F7] hover:bg-[#9333EA] text-white font-display text-lg tracking-widest flex items-center justify-center gap-3 rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.99]"
            >
              <Play className="w-5 h-5" />
              {userId ? 'ACCEPT CHALLENGE' : 'LOGIN TO BATTLE'}
            </button>
            <div className="text-center text-sm text-gray-500 mt-2">
              Entry: {formatCurrency(toBOGX(battle.wager))} BOGX
            </div>
            
            {/* Decline Button - only for private challenges */}
            {isPrivateChallenge && onDecline && (
              <button
                onClick={onDecline}
                className="w-full py-3 mt-3 text-red-500 font-display text-sm tracking-widest hover:bg-red-50 rounded-xl transition-colors"
              >
                DECLINE CHALLENGE
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
