"use client";

import { RefreshCw, Check, AlertCircle } from "lucide-react";
import { Proposal } from "./types";
import { COLOR_CYCLE } from "./constants";

interface ProposalGridProps {
  proposals: Proposal[];
  roster: { id: string; name: string; avatar?: string }[];
  onSelect: (proposal: Proposal) => void;
  onRetry: (reporterId: string, reporterName: string, isRIP: boolean) => void;
  pendingReporters: Record<string, boolean>;
}

export default function ProposalGrid({
  proposals,
  roster,
  onSelect,
  onRetry,
  pendingReporters,
}: ProposalGridProps) {
  function colorFor(personId: string) {
    const idx = roster.findIndex(p => p.id === personId);
    return COLOR_CYCLE[idx % COLOR_CYCLE.length];
  }

  const hasEvents = proposals.some(p => p.isEvent);

  return (
    <div className="space-y-3">
      {/* Section headers if mixed content */}
      {hasEvents && (
        <div className="text-[10px] uppercase tracking-widest text-gray-500 font-mono">
          📅 Events & 🎂 Birthdays
        </div>
      )}

      {/* Proposal cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {proposals.map((p, idx) => {
          const isPending = pendingReporters[p.reporterId];
          
          // Error card
          if (p.isError) {
            return (
              <div
                key={`${p.reporterId}-${idx}`}
                className="bg-red-950/30 border border-red-800/50 rounded-lg p-3 flex flex-col"
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={14} className="text-red-400" />
                  <span className="text-xs text-red-400 font-medium">{p.reporterName}</span>
                </div>
                <p className="text-xs text-red-300/70 mb-3 flex-1">{p.description || 'Could not find a match'}</p>
                <button
                  onClick={() => onRetry(p.reporterId, p.reporterName, p.isRIP || false)}
                  disabled={isPending}
                  className="w-full px-2 py-1.5 bg-red-800/50 hover:bg-red-700/50 rounded text-xs font-medium text-red-200 flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {isPending ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  Try Again
                </button>
              </div>
            );
          }

          // Event card
          if (p.isEvent) {
            return (
              <div
                key={`${p.reporterId}-${idx}`}
                className="bg-blue-950/30 border border-blue-800/50 rounded-lg p-3 flex flex-col"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] bg-blue-600/30 text-blue-300 px-1.5 py-0.5 rounded">📅 Event</span>
                  <span className="text-[10px] text-gray-500">{p.birthday}</span>
                </div>
                <h4 className="text-sm font-bold text-white mb-1 leading-tight" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  {p.name}
                </h4>
                {p.category && (
                  <span className="text-[10px] text-blue-400 mb-1">{p.category}</span>
                )}
                <p className="text-xs text-gray-400 mb-3 flex-1 line-clamp-2">{p.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">{p.reporterName}</span>
                  <button
                    onClick={() => onSelect(p)}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs font-bold text-white flex items-center gap-1"
                  >
                    <Check size={12} /> Select
                  </button>
                </div>
              </div>
            );
          }

          // Person card (Birthday or RIP)
          return (
            <div
              key={`${p.reporterId}-${idx}`}
              className={`rounded-lg p-3 flex flex-col ${
                p.isRIP 
                  ? 'bg-gray-900/80 border border-gray-700' 
                  : 'bg-gray-800/50 border border-gray-700/50'
              }`}
            >
              {/* Header with flag and date */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  {p.isRIP && <span className="text-[10px]">🕯️</span>}
                  <span className="text-[10px] text-gray-500">{p.country}</span>
                </div>
                <span className="text-[10px] text-gray-500">
                  {p.isRIP ? `✝ ${p.deathday}` : `🎂 ${p.birthday}`}
                </span>
              </div>

              {/* Name */}
              <h4 className="text-sm font-bold text-white mb-1 leading-tight" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                {p.name}
              </h4>

              {/* Category badge */}
              {p.category && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded w-fit mb-1 ${
                  p.isRIP ? 'bg-gray-700 text-gray-300' : 'bg-[#E36B11]/20 text-[#E36B11]'
                }`}>
                  {p.category}
                </span>
              )}

              {/* RIP cause */}
              {p.isRIP && p.causeOfDeath && (
                <p className="text-[10px] text-gray-500 mb-1">† {p.causeOfDeath}</p>
              )}

              {/* Description */}
              <p className="text-xs text-gray-400 mb-3 flex-1 line-clamp-2">{p.description}</p>

              {/* Footer */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 min-w-0">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-black shrink-0 ${colorFor(p.reporterId).bg}`}>
                    {p.reporterName.split(' ').map(n => n[0]).join('')}
                  </div>
                  <span className="text-[10px] text-gray-500 truncate">{p.reporterName.split(' ')[0]}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onRetry(p.reporterId, p.reporterName, p.isRIP || false)}
                    disabled={isPending}
                    className="p-1 text-gray-500 hover:text-white disabled:opacity-50"
                    title="Try again"
                  >
                    <RefreshCw size={12} className={isPending ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={() => onSelect(p)}
                    className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 ${
                      p.isRIP 
                        ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                        : 'bg-[#E36B11] hover:bg-[#c07830] text-black'
                    }`}
                  >
                    <Check size={12} /> Select
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
