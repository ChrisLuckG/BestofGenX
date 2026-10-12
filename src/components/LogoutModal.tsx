"use client";

import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import { X, Trophy, LogOut, Clock, Gamepad2, TrendingUp, Zap, ChevronRight, BookOpen, Vote, Star, Lock } from "lucide-react";
import { formatCurrency } from "@/utils/currency";

interface SessionEvent {
  text: string;
  highlight?: string;
}

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  username: string;
  bogxCoins: number;
  wins: number;
  gamesPlayed: number;
  currentRank?: number;
  totalPlayers?: number;
  level?: number;
  levelName?: string;
  // Session-specific data
  sessionStartTime?: number;
  sessionGamesPlayed?: number;
  sessionBogxEarned?: number;
  sessionWins?: number;
  sessionArticlesRead?: number;
  sessionVotes?: number;
  sessionRankChange?: number; // positive = moved up, negative = moved down
  playersOvertaken?: string[]; // usernames of players overtaken this session
}

// GenX fun facts for the logout screen
const GENX_FACTS = [
  "GenX invented the mixtape. You're welcome, Spotify.",
  "We were the last generation to use a rotary phone.",
  "MTV actually played music videos when we watched it.",
  "We survived dial-up internet. Nothing scares us.",
  "We're the generation that made flannel fashionable.",
  "We remember when 'viral' meant you needed a doctor.",
  "We debugged code before Stack Overflow existed.",
  "Blockbuster Friday nights were our Netflix & chill.",
  "We learned to type on actual typewriters.",
  "We're the original latchkey kids. Independence is our thing.",
];

export default function LogoutModal({
  isOpen,
  onClose,
  onLogout,
  username,
  bogxCoins,
  wins,
  gamesPlayed,
  currentRank,
  totalPlayers,
  level = 1,
  levelName = 'Rookie',
  sessionStartTime,
  sessionGamesPlayed = 0,
  sessionBogxEarned = 0,
  sessionWins = 0,
  sessionArticlesRead = 0,
  sessionVotes = 0,
  sessionRankChange = 0,
  playersOvertaken = [],
}: LogoutModalProps) {
  const [randomFact, setRandomFact] = useState('');
  
  useEffect(() => {
    if (isOpen) {
      setRandomFact(GENX_FACTS[Math.floor(Math.random() * GENX_FACTS.length)]);
    }
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  // Calculate session duration
  const sessionDuration = sessionStartTime 
    ? Math.floor((Date.now() - sessionStartTime) / 1000 / 60)
    : 0;
  
  const formatDuration = (minutes: number) => {
    if (minutes < 1) return 'Just arrived';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Build session events (like "While You Were Away" but for logout)
  const sessionEvents: SessionEvent[] = [];
  
  if (sessionBogxEarned > 0) {
    sessionEvents.push({
      text: `Earned ${formatCurrency(sessionBogxEarned)} BOGX`,
      highlight: 'this session',
    });
  } else if (sessionBogxEarned < 0) {
    sessionEvents.push({
      text: `Lost ${formatCurrency(Math.abs(sessionBogxEarned))} BOGX`,
      highlight: 'tough session!',
    });
  }
  
  if (sessionWins > 0) {
    sessionEvents.push({
      text: `Won ${sessionWins} game${sessionWins > 1 ? 's' : ''}`,
      highlight: 'Nice!',
    });
  }
  
  if (sessionRankChange > 0) {
    sessionEvents.push({
      text: `Moved up ${sessionRankChange} position${sessionRankChange > 1 ? 's' : ''}`,
      highlight: 'in the ranking',
    });
  } else if (sessionRankChange < 0) {
    sessionEvents.push({
      text: `Dropped ${Math.abs(sessionRankChange)} position${Math.abs(sessionRankChange) > 1 ? 's' : ''}`,
      highlight: 'come back stronger!',
    });
  }
  
  // Players overtaken
  playersOvertaken.slice(0, 2).forEach(player => {
    sessionEvents.push({
      text: `Overtook`,
      highlight: player,
    });
  });
  if (playersOvertaken.length > 2) {
    sessionEvents.push({
      text: `And ${playersOvertaken.length - 2} more`,
      highlight: 'players overtaken',
    });
  }
  
  if (sessionArticlesRead > 0) {
    sessionEvents.push({
      text: `Read ${sessionArticlesRead} article${sessionArticlesRead > 1 ? 's' : ''}`,
      highlight: 'knowledge is power',
    });
  }
  
  if (sessionVotes > 0) {
    sessionEvents.push({
      text: `Cast ${sessionVotes} vote${sessionVotes > 1 ? 's' : ''}`,
      highlight: 'your voice matters',
    });
  }
  
  if (sessionGamesPlayed > 0 && sessionEvents.length < 3) {
    sessionEvents.push({
      text: `Played ${sessionGamesPlayed} game${sessionGamesPlayed > 1 ? 's' : ''}`,
      highlight: 'total',
    });
  }
  
  // Add current rank if we have it
  if (currentRank && totalPlayers) {
    sessionEvents.push({
      text: `You're ranked #${currentRank}`,
      highlight: `of ${totalPlayers} players`,
    });
  }
  
  // Add level info
  if (level && levelName) {
    sessionEvents.push({
      text: `Level ${level}:`,
      highlight: levelName,
    });
  }
  
  // Fallback if no activity
  if (sessionEvents.length === 0) {
    sessionEvents.push({
      text: 'No activity yet',
      highlight: 'come back soon!',
    });
  }

  const hasSessionActivity = sessionGamesPlayed > 0 || sessionBogxEarned !== 0 || sessionArticlesRead > 0 || sessionVotes > 0;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Desktop Layout (md+) */}
      <div className="relative w-full max-w-3xl bg-cream rounded-3xl shadow-2xl overflow-hidden hidden md:block border border-warm">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center transition-colors shadow-sm"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>

        <div className="flex min-h-[380px]">
          {/* LEFT - Red branding */}
          <div className="w-[280px] flex-shrink-0 bg-gradient-to-br from-red-500 via-red-600 to-red-700 p-8 flex flex-col relative overflow-hidden">
            {/* Background - Lock icon */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.08]">
              <Lock className="w-56 h-56 text-white" />
            </div>

            {/* Logo - white BOGX text */}
            <div className="relative z-10 flex items-center gap-2 mb-6">
              <span className="font-display text-2xl text-white tracking-wide">BOG<span className="text-white">X</span></span>
            </div>

            {/* Goodbye text */}
            <div className="relative z-10 flex-1">
              <p className="text-white/70 text-xs uppercase tracking-wider mb-1">Leaving already?</p>
              <h1 className="font-display text-3xl text-white leading-tight mb-2">
                See you soon,<br />
                <span className="text-4xl">{username}!</span>
              </h1>
              <p className="text-white/80 text-sm mt-4 leading-relaxed">
                Your progress is saved. Come back anytime to continue climbing the ranks.
              </p>
            </div>

            {/* Logout button */}
            <button
              onClick={() => { onClose(); onLogout(); }}
              className="relative z-10 mt-4 w-full py-3 bg-white/20 hover:bg-white/30 text-white font-display text-lg tracking-wide rounded-xl transition-colors flex items-center justify-center gap-2 border border-white/30"
            >
              <LogOut className="w-4 h-4" />
              LOG OUT
            </button>

            <button
              onClick={onClose}
              className="relative z-10 mt-2 w-full py-2 text-white/70 hover:text-white text-xs transition-colors"
            >
              Stay logged in
            </button>
          </div>

          {/* RIGHT - Stats (like Login modal) */}
          <div className="flex-1 p-6 flex flex-col">
            {/* Session Stats Card */}
            <div className="bg-white rounded-xl border border-warm p-4 mb-4 shadow-sm">
              <div className="flex items-start gap-4">
                {/* Session Duration Icon */}
                <div className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-50 border border-red-100">
                  <Clock className="w-8 h-8 text-red-500" />
                </div>

                {/* Session Info */}
                <div className="flex-1">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">This Session</div>
                  <div className="font-display text-2xl tracking-wide text-red-500">{formatDuration(sessionDuration)}</div>
                  <div className="flex gap-4 mt-2">
                    <div className="text-xs">
                      <span className="text-gray-500">Games:</span>
                      <span className="font-bold text-gray-900 ml-1">{sessionGamesPlayed}</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-gray-500">BOGX:</span>
                      <span className={`font-bold ml-1 ${sessionBogxEarned >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {sessionBogxEarned >= 0 ? '+' : ''}{formatCurrency(sessionBogxEarned)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rank Position */}
                {currentRank && (
                  <div className="text-right flex-shrink-0 bg-cream rounded-xl px-4 py-3">
                    <div className="font-display text-2xl text-gray-900">#{currentRank}</div>
                    <div className="text-[9px] text-gray-500 uppercase">of {totalPlayers || '–'}</div>
                  </div>
                )}
              </div>

              {/* Additional session stats row */}
              <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                <div className="flex-1 text-center px-2 py-1.5 bg-gray-50 rounded-lg">
                  <Trophy className="w-3.5 h-3.5 text-red-500 mx-auto mb-0.5" />
                  <div className="text-sm font-bold text-gray-900">{sessionWins}</div>
                  <div className="text-[8px] uppercase text-gray-400">Wins</div>
                </div>
                <div className="flex-1 text-center px-2 py-1.5 bg-gray-50 rounded-lg">
                  <BookOpen className="w-3.5 h-3.5 text-red-500 mx-auto mb-0.5" />
                  <div className="text-sm font-bold text-gray-900">{sessionArticlesRead}</div>
                  <div className="text-[8px] uppercase text-gray-400">Articles</div>
                </div>
                <div className="flex-1 text-center px-2 py-1.5 bg-gray-50 rounded-lg">
                  <Vote className="w-3.5 h-3.5 text-red-500 mx-auto mb-0.5" />
                  <div className="text-sm font-bold text-gray-900">{sessionVotes}</div>
                  <div className="text-[8px] uppercase text-gray-400">Votes</div>
                </div>
                <div className="flex-1 text-center px-2 py-1.5 bg-gray-50 rounded-lg">
                  <Star className="w-3.5 h-3.5 text-red-500 mx-auto mb-0.5" />
                  <div className="text-sm font-bold text-gray-900">{level}</div>
                  <div className="text-[8px] uppercase text-gray-400">Level</div>
                </div>
              </div>
            </div>

            {/* While You Were Here (like Login's While You Were Away) */}
            <div className="bg-white rounded-xl border border-warm overflow-hidden flex-1 shadow-sm">
              <div className="px-4 py-2 border-b border-warm flex items-center gap-1.5 bg-cream/50">
                <Zap className="w-3 h-3 text-red-500" />
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">While You Were Here</span>
                <span className="ml-auto text-[10px] text-gray-400">{sessionEvents.length}</span>
              </div>
              <div className="divide-y divide-gray-100/50 max-h-[180px] overflow-y-auto">
                {sessionEvents.map((event, i) => (
                  <div key={i} className="px-4 py-1.5 flex items-center gap-2 hover:bg-cream/30 transition-colors">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-red-500" />
                    <p className="flex-1 min-w-0 text-xs text-gray-600">
                      {event.text}
                      {event.highlight && <span className="font-semibold text-red-500"> {event.highlight}</span>}
                    </p>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {/* GenX Fun Fact */}
            <div className="mt-3 px-3 py-2 bg-red-50 rounded-lg border border-red-100">
              <p className="text-[10px] text-red-700 italic text-center">"{randomFact}"</p>
            </div>

            <p className="text-center text-[10px] text-gray-400 mt-2">
              Play. Compete. Remember. <span className="font-bold text-gray-500">That's GenX.</span>
            </p>
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden md:hidden">
        {/* Header - Red gradient */}
        <div className="h-24 bg-gradient-to-br from-red-500/15 via-red-500/5 to-transparent relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 hover:bg-white border border-warm flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors shadow-sm"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2">
            <div className="w-14 h-14 rounded-2xl bg-white border border-warm shadow-md flex items-center justify-center">
              <img src="/images/genxlogo1.png" alt="Best of GenX" className="h-9 object-contain" />
            </div>
          </div>
        </div>

        <div className="px-5 pt-12 pb-5">
          <h2 className="font-display text-[24px] tracking-wide text-gray-900 leading-tight text-center mb-1">
            See you soon, {username}!
          </h2>
          <p className="text-gray-500 text-[12px] leading-relaxed text-center mb-3">
            {formatDuration(sessionDuration)} online this session
          </p>

          {/* Session stats row */}
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            <div className="rounded-xl border border-warm bg-cream/50 p-2 text-center">
              <Gamepad2 className="w-3.5 h-3.5 text-red-500 mx-auto mb-0.5" />
              <div className="font-display tracking-wide text-[16px] text-gray-900">{sessionGamesPlayed}</div>
              <div className="text-[7px] uppercase tracking-wider text-gray-400 font-bold">Games</div>
            </div>
            <div className="rounded-xl border border-warm bg-cream/50 p-2 text-center">
              <Trophy className="w-3.5 h-3.5 text-red-500 mx-auto mb-0.5" />
              <div className="font-display tracking-wide text-[16px] text-gray-900">{sessionWins}</div>
              <div className="text-[7px] uppercase tracking-wider text-gray-400 font-bold">Wins</div>
            </div>
            <div className="rounded-xl border border-warm bg-cream/50 p-2 text-center">
              <BookOpen className="w-3.5 h-3.5 text-red-500 mx-auto mb-0.5" />
              <div className="font-display tracking-wide text-[16px] text-gray-900">{sessionArticlesRead}</div>
              <div className="text-[7px] uppercase tracking-wider text-gray-400 font-bold">Read</div>
            </div>
            <div className="rounded-xl border border-warm bg-cream/50 p-2 text-center">
              <TrendingUp className="w-3.5 h-3.5 text-red-500 mx-auto mb-0.5" />
              <div className={`font-display tracking-wide text-[16px] ${sessionBogxEarned >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {sessionBogxEarned >= 0 ? '+' : ''}{formatCurrency(sessionBogxEarned)}
              </div>
              <div className="text-[7px] uppercase tracking-wider text-gray-400 font-bold">BOGX</div>
            </div>
          </div>

          {/* While You Were Here - compact list */}
          {sessionEvents.length > 0 && (
            <div className="bg-cream/50 rounded-xl border border-warm mb-3 max-h-[100px] overflow-y-auto">
              {sessionEvents.slice(0, 4).map((event, i) => (
                <div key={i} className="px-3 py-1.5 flex items-center gap-2 border-b border-warm/50 last:border-0">
                  <div className="w-1 h-1 rounded-full bg-red-500 flex-shrink-0" />
                  <p className="text-[11px] text-gray-600">
                    {event.text}
                    {event.highlight && <span className="font-semibold text-red-500"> {event.highlight}</span>}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* GenX Fun Fact */}
          <div className="mb-3 px-3 py-1.5 bg-red-50 rounded-lg border border-red-100">
            <p className="text-[9px] text-red-700 italic text-center">"{randomFact}"</p>
          </div>

          <button
            onClick={() => { onClose(); onLogout(); }}
            className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-[14px] transition-colors shadow-sm"
          >
            Log out
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 mt-1.5 text-gray-500 hover:text-gray-700 text-[12px] font-medium transition-colors"
          >
            Stay logged in
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
