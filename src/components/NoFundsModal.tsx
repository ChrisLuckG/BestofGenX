"use client";

import { X, Lightbulb, BookOpen, Play, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/utils/currency";

interface NoFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTopUp: () => void;
  onWatchAd?: () => void;
  requiredAmount?: number;
  currentBalance?: number;
  onReadArticles?: () => void;
  onWatchVideos?: () => void;
  onPlayTrivia?: () => void;
}

export default function NoFundsModal({ 
  isOpen, 
  onClose, 
  onTopUp, 
  onWatchAd,
  requiredAmount = 0.50,
  currentBalance = 0,
  onReadArticles,
  onWatchVideos,
  onPlayTrivia
}: NoFundsModalProps) {
  if (!isOpen) return null;

  const missingAmount = Math.max(0, requiredAmount - currentBalance);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-cream rounded-2xl max-w-sm w-full shadow-xl relative overflow-hidden">
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition-all border border-warm z-10"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>

        {/* Header with BOGX coin */}
        <div className="pt-8 pb-4 text-center">
          <img 
            src="/images/bogxcoin.png" 
            alt="BOGX" 
            className="w-20 h-20 mx-auto mb-4"
          />
          
          <h2 className="font-display text-2xl tracking-wide text-gray-900 mb-2">
            NOT ENOUGH COINS
          </h2>
          <p className="text-gray-500 text-sm">
            You need {formatCurrency(requiredAmount)} BOGX to join this battle.
          </p>
        </div>

        {/* Balance Box */}
        <div className="mx-4 mb-4">
          <div className="flex bg-[#D4873A]/5 rounded-xl divide-x divide-[#D4873A]/10">
            <div className="flex-1 py-3 text-center">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Your balance</div>
              <div className="font-display text-xl text-gray-900">{formatCurrency(currentBalance)} <span className="text-sm text-gray-500">BOGX</span></div>
            </div>
            <div className="flex-1 py-3 text-center">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Missing</div>
              <div className="font-display text-xl text-[#D4873A]">{formatCurrency(missingAmount)} <span className="text-sm text-gray-500">BOGX</span></div>
            </div>
          </div>
        </div>

        {/* Earn coins section */}
        <div className="mx-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-[#D4873A]/10 rounded-lg flex items-center justify-center">
              <Lightbulb className="w-4 h-4 text-[#D4873A]" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Earn coins and join the action!</p>
              <p className="text-[10px] text-gray-500">Here are some quick ways to get BOGX.</p>
            </div>
          </div>

          {/* Earn options */}
          <div className="space-y-2">
            {/* Read articles */}
            <button
              onClick={onReadArticles || onTopUp}
              className="w-full p-3 bg-[#D4873A]/5 rounded-xl flex items-center gap-3 hover:bg-[#D4873A]/10 transition-all"
            >
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-warm">
                <BookOpen className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-gray-900 text-sm">Read articles</p>
                <p className="text-[10px] text-gray-500">Earn per article</p>
              </div>
              <div className="flex items-center gap-1 text-[#D4873A] font-bold text-sm">
                +0,05 <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </button>

            {/* Watch videos */}
            <button
              onClick={onWatchVideos || onWatchAd || onTopUp}
              className="w-full p-3 bg-[#D4873A]/5 rounded-xl flex items-center gap-3 hover:bg-[#D4873A]/10 transition-all"
            >
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-warm">
                <Play className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-gray-900 text-sm">Watch videos</p>
                <p className="text-[10px] text-gray-500">Watch 1 video</p>
              </div>
              <div className="flex items-center gap-1 text-[#D4873A] font-bold text-sm">
                +0,10 <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </button>

            {/* Play trivia */}
            <button
              onClick={onPlayTrivia || onTopUp}
              className="w-full p-3 bg-[#D4873A]/5 rounded-xl flex items-center gap-3 hover:bg-[#D4873A]/10 transition-all"
            >
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-warm">
                <img src="/images/Icon/trivia2.png" alt="" className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-gray-900 text-sm">Play trivia</p>
                <p className="text-[10px] text-gray-500">Earn up to 0.15 per question</p>
              </div>
              <div className="flex items-center gap-1 text-[#D4873A] font-bold text-sm">
                +0,05-0,15 <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-4 pb-4 space-y-2">
          <button
            onClick={onTopUp}
            className="w-full py-3.5 bg-[#D4873A] rounded-xl font-bold text-white transition-all hover:bg-[#C4772A]"
          >
            EARN BOGX
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 text-gray-500 font-medium text-sm transition-all hover:text-gray-700"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
