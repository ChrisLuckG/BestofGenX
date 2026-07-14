"use client";

import { Swords, HelpCircle, Coins, Trophy } from "lucide-react";
import BackButton from "@/components/BackButton";
import CountryFlag from "@/components/CountryFlag";
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
      {/* Header - separate from background image */}
      <div className="px-3 pt-4 pb-3 border-b border-warm">
        <div className="flex items-center gap-2">
          <BackButton onClick={onBack} className="-ml-1" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900">QuizzBattle</span>
            <p className="text-[10px] text-gray-500 -mt-0.5">Challenge players, win their wager.</p>
          </div>
        </div>
      </div>

      {/* Battle Background Image */}
      <div 
        className="relative bg-cover bg-center"
        style={{ backgroundImage: "url('/images/battle.png')" }}
      >
        {/* VS Section */}
        <div className="relative px-4 py-4">
          {/* VS Row */}
          <div className="relative flex items-start justify-between">
            {/* You */}
            <div className="flex flex-col items-center">
              <div className="relative mb-1">
                <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-[#A855F7] shadow-lg">
                  <img src={userAvatar || 'https://i.pravatar.cc/80?img=47'} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 drop-shadow-lg">
                  <CountryFlag flag={userCountryFlag || 'DE'} className="w-6 h-5 rounded-sm" />
                </div>
              </div>
              <div className="font-display text-base tracking-wider uppercase text-white">You</div>
              <div className="px-2 py-0.5 bg-[#A855F7] rounded text-[10px] text-white font-bold">RANK #22</div>
            </div>

            {/* VS + POT in center */}
            <div className="flex flex-col items-center">
              <div className="text-white/70 text-[10px] uppercase tracking-wider">POT</div>
              <div className="flex items-center gap-1">
                <span className="font-display text-3xl text-white">{formatCurrency(potAmount)}</span>
                <img src="/images/bogxcoin.png" alt="BOGX" className="w-5 h-5" />
              </div>
              <div className="text-white/60 text-xs uppercase">BOGX</div>
              <div className="text-[#A855F7] text-[10px] mt-1 font-semibold">
                {formatCurrency(toBOGX(battle.wager))} from you • {formatCurrency(toBOGX(battle.wager))} from opponent
              </div>
            </div>

            {/* Opponent */}
            <div className="flex flex-col items-center">
              <div className="relative mb-1">
                <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white/50 shadow-lg">
                  <img src={battle.creator.avatar} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 drop-shadow-lg">
                  <CountryFlag flag={battle.creator.countryFlag} className="w-6 h-5 rounded-sm" />
                </div>
              </div>
              <div className="font-display text-base tracking-wider uppercase text-white">{battle.creator.username}</div>
              <div className="px-2 py-0.5 bg-white/20 rounded text-[10px] text-white font-bold">RANK #5</div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-3 battle-intro-content">
        {/* Topic Banner */}
        <div className="flex items-center gap-3 bg-cream border border-warm rounded-xl p-3 mb-3 shadow-sm battle-topic-banner">
          <div className="battle-topic-image w-20 h-16 rounded-lg overflow-hidden flex-shrink-0 relative" style={{ background: topic.color + '20', border: `1.5px solid ${topic.color}40` }}>
            <img
              src={`/images/topics/${battle.topic}.png`}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            {/* Fallback icon shown behind image */}
            <div className="absolute inset-0 flex items-center justify-center">
              <topic.icon className="w-8 h-8" style={{ color: topic.color }} />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <topic.icon className="w-5 h-5 text-[#A855F7]" />
              <span className="font-display text-lg tracking-wider text-gray-900 uppercase">{topic.label} Trivia</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><HelpCircle className="w-3.5 h-3.5" /> <span className="font-bold text-gray-900">{battle.rounds}</span> Rounds</span>
              <span className="flex items-center gap-1"><Coins className="w-3.5 h-3.5" /> <span className="font-bold text-[#A855F7]">{formatCurrency(potAmount)}</span> Pot</span>
              <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> Rank <span className="font-bold text-gray-900">#5</span></span>
            </div>
          </div>
        </div>

        {/* Rules */}
        <div className="bg-[#A855F7]/5 border border-[#A855F7]/10 rounded-xl p-3 mb-3">
          <div className="flex items-center gap-2 text-gray-700 text-sm mb-2">
            <div className="w-6 h-6 bg-[#A855F7]/20 rounded flex items-center justify-center">
              <Coins className="w-3.5 h-3.5 text-[#A855F7]" />
            </div>
            <span>Your wager is <span className="font-bold">locked</span> until the battle ends.</span>
          </div>
          <div className="flex items-center gap-2 text-gray-700 text-sm">
            <div className="w-6 h-6 bg-[#A855F7]/20 rounded flex items-center justify-center">
              <Trophy className="w-3.5 h-3.5 text-[#A855F7]" />
            </div>
            <span className="font-bold">Winner takes the full pot.</span>
          </div>
        </div>

        {/* Accept Button */}
        <button
          onClick={() => {
            if (!userId) {
              onShowLogin?.();
              return;
            }
            onStart();
          }}
          className="w-full py-3 bg-[#A855F7] hover:bg-[#C4772A] text-white font-display text-sm tracking-widest flex flex-col items-center justify-center rounded-xl shadow-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4" />
            {userId ? 'START BATTLE' : 'LOGIN TO BATTLE'}
          </div>
          <span className="text-[10px] text-white/70 font-normal">ENTRY: {formatCurrency(toBOGX(battle.wager))} BOGX</span>
        </button>
        
        {/* Decline Button - only for private challenges */}
        {isPrivateChallenge && onDecline && (
          <button
            onClick={onDecline}
            className="w-full py-2 mt-2 text-red-400 font-display text-xs tracking-widest hover:text-red-300 transition-colors"
          >
            DECLINE CHALLENGE
          </button>
        )}
      </div>
    </div>
  );
}
