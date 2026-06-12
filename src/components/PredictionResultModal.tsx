"use client";

import React from "react";
import { X, Target, Check, Calendar, Trophy, Frown } from "lucide-react";

export interface PredictionResultOption {
  id: string;
  label: string;
}

export interface PredictionResultData {
  question: string;
  options: PredictionResultOption[];
  userOptionId: string;
  correctOptionId: string | null;
  pointsAwarded: number;
  pointsReward: number;
  resolvedAt?: string | Date | null;
  won: boolean;
  /** Optional admin note shown under the outcome */
  adminNote?: string;
}

interface PredictionResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PredictionResultData | null;
  onPointsAwarded?: (amount: number) => void;
}

function formatResolved(d?: string | Date | null) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Shown when a user clicks a resolved-prediction notification. Mirrors the
// QuizBattle result modal style but tailored to a single-choice prediction.
export default function PredictionResultModal({ isOpen, onClose, data, onPointsAwarded }: PredictionResultModalProps) {
  // Trigger coin animation when modal opens with a win
  const hasTriggeredRef = React.useRef(false);
  React.useEffect(() => {
    if (isOpen && data && data.won && data.pointsAwarded > 0 && onPointsAwarded && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      onPointsAwarded(data.pointsAwarded);
    }
    if (!isOpen) {
      hasTriggeredRef.current = false;
    }
  }, [isOpen, data, onPointsAwarded]);

  if (!isOpen || !data) return null;

  const correctOption = data.options.find((o) => o.id === data.correctOptionId);
  const userOption = data.options.find((o) => o.id === data.userOptionId);
  const won = data.won;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-5">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className={`h-24 relative ${won ? "bg-gradient-to-br from-green-500/15 via-green-500/5 to-transparent" : "bg-gradient-to-br from-red-500/15 via-red-500/5 to-transparent"}`}>
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 hover:bg-white border border-warm flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors shadow-sm"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2">
            <div className={`w-14 h-14 rounded-2xl bg-white border border-warm shadow-md flex items-center justify-center`}>
              {won ? <Trophy className="w-7 h-7 text-green-500" /> : <Frown className="w-7 h-7 text-red-500" />}
            </div>
          </div>
        </div>

        <div className="px-6 pt-12 pb-6">
          <h2 className={`font-display text-[24px] tracking-wide leading-tight text-center mb-1 ${won ? "text-green-600" : "text-red-600"}`}>
            {won ? "Prediction won" : "Prediction lost"}
          </h2>
          <p className="text-gray-500 text-[13px] leading-relaxed text-center mb-5">
            {data.question}
          </p>

          {/* Outcome row */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-xl border border-warm bg-cream px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5 flex items-center gap-1">
                <Target className="w-3 h-3" /> Your pick
              </div>
              <div className={`text-[14px] font-bold ${won ? "text-green-600" : "text-gray-900"}`}>
                {userOption?.label || "—"}
              </div>
            </div>
            <div className="rounded-xl border border-green-500/30 bg-green-500/5 px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-wider text-green-700 mb-0.5 flex items-center gap-1">
                <Check className="w-3 h-3" /> Correct outcome
              </div>
              <div className="text-[14px] font-bold text-green-700">
                {correctOption?.label || "—"}
              </div>
            </div>
          </div>

          {/* Points + resolved date */}
          <div className="rounded-xl border border-warm bg-cream px-3 py-2.5 mb-3">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-gray-500">BOGX {won ? "earned" : "missed"}</span>
              <span className={`font-bold tabular-nums ${won ? "text-green-600" : "text-gray-400"}`}>
                {won ? `+${data.pointsAwarded || data.pointsReward}` : `0 / +${data.pointsReward}`}
              </span>
            </div>
            {data.resolvedAt && (
              <div className="flex items-center justify-between text-[12px] mt-1.5 text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Resolved
                </span>
                <span>{formatResolved(data.resolvedAt)}</span>
              </div>
            )}
          </div>

          {/* Optional admin note */}
          {data.adminNote && (
            <div className="rounded-xl border border-[#D4873A]/30 bg-[#D4873A]/5 px-3 py-2.5 mb-3">
              <div className="text-[10px] uppercase tracking-wider text-[#D4873A] mb-0.5">
                From the editors
              </div>
              <p className="text-[13px] text-gray-700 leading-relaxed">{data.adminNote}</p>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full py-3 bg-[#D4873A] hover:bg-[#C4772A] text-white font-bold rounded-xl text-[14px] transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
