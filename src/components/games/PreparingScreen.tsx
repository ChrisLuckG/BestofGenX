"use client";

import { useEffect, useState } from "react";
import { Check, Clock, Play } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Shared "preparing questions" screen used before a game starts.
 *
 * Lives here because QuizzBattle and Solo Trivia must feel identical: Solo Trivia
 * used to cover its setup page with a blurred modal instead, which read as an
 * interruption rather than as part of starting a game.
 *
 * The ring is deliberately NOT a real progress bar - there is nothing meaningful to
 * measure. It paces the wait. When a caller does have real loading to wait for it
 * passes `dataReady={false}`, and the ring holds just short of full until the data
 * arrives, so the screen never claims to be ready before it is.
 */

interface PreparingScreenProps {
  /** Accent colour, usually the topic/category colour. */
  topicColor?: string;
  /** Icon shown inside the ring while loading. */
  TopicIcon?: LucideIcon;
  /** Line under the heading while loading. */
  subtitle: string;
  /** Line under the heading once ready. */
  readySubtitle: string;
  /**
   * False while the caller is still fetching. The ring stops at HOLD_AT_PERCENT
   * until this turns true. Defaults to true for callers with nothing to wait for.
   */
  dataReady?: boolean;
  /** Total time for the ring to fill, in ms. */
  durationMs?: number;
  /** Fired once when the screen reaches the ready state. */
  onReady?: () => void;
  /** Called when user clicks START. Optional if hideStartButton is true. */
  onStart?: () => void;
  /** Info card between the status card and the button. */
  children?: React.ReactNode;
  /** Small print below the button (e.g. "your opponent has 24h to respond"). */
  footer?: React.ReactNode;
  /** Hide the START button entirely (e.g. when accepting a battle and countdown starts automatically). */
  hideStartButton?: boolean;
  /**
   * Topic id (music, sport, film, ...). Used to pick the banner background image
   * from /images/topics. Unknown ids simply get no image.
   */
  topicId?: string;
  /** Number of questions/rounds in the game. */
  rounds?: number;
  /** Player 1 (you) info for VS display when ready */
  player1?: { username: string; avatar?: string };
  /** Player 2 (opponent) info for VS display when ready */
  player2?: { username: string; avatar?: string };
}

/**
 * Background art per topic. Missing entries mean "no image", not a fallback.
 * Exported because the invite flow's step 3 scoreboard has to use the very same
 * artwork - otherwise the banner changes appearance on the step 3 -> 4 move.
 */
export const TOPIC_BACKGROUNDS: Record<string, string> = {
  music: '/images/topics/music.png',
  sport: '/images/topics/sport.png',
  sports: '/images/topics/sport.png',
  film: '/images/topics/film.png',
  movies: '/images/topics/film.png',
  tv: '/images/topics/tv.png',
  games: '/images/topics/games.png',
  gaming: '/images/topics/games.png',
  fashion: '/images/topics/fashion.png',
  politik: '/images/topics/culture.png',
  politics: '/images/topics/culture.png',
};

/** Where the ring waits when the caller is still loading. */
const HOLD_AT_PERCENT = 92;

export default function PreparingScreen({
  topicColor = '#6B7280',
  TopicIcon,
  subtitle,
  readySubtitle,
  dataReady = true,
  durationMs = 3000,
  onReady,
  onStart,
  children,
  footer,
  hideStartButton = false,
  topicId,
  rounds,
  player1,
  player2,
}: PreparingScreenProps) {
  const [progress, setProgress] = useState(0);
  const isComplete = progress >= 100;

  useEffect(() => {
    const stepMs = 100;
    const increment = 100 / (durationMs / stepMs);

    const interval = setInterval(() => {
      setProgress(prev => {
        // Hold short of the finish line while the caller is still loading.
        const ceiling = dataReady ? 100 : HOLD_AT_PERCENT;
        const next = Math.min(prev + increment, ceiling);
        return next;
      });
    }, stepMs);

    return () => clearInterval(interval);
  }, [durationMs, dataReady]);

  // Separate effect so onReady fires exactly once, regardless of how often the
  // progress effect re-runs when dataReady flips.
  useEffect(() => {
    if (isComplete) onReady?.();
  }, [isComplete, onReady]);

  const shownProgress = Math.round(progress);
  const backgroundImage = topicId ? TOPIC_BACKGROUNDS[topicId.toLowerCase()] : undefined;

  return (
    <div className="preparing-screen flex flex-col items-center pt-4 md:pt-8 px-4 flex-1">
      {/* Status Card with Icon and Text - matching question card style */}
      <div
        className={`relative overflow-hidden w-full max-w-sm md:max-w-none rounded-xl p-3 md:p-5 mb-3 md:mb-4 transition-all duration-300 shadow-lg ${
          isComplete ? '' : 'bg-cream border border-warm'
        }`}
        style={isComplete ? {
          backgroundColor: topicColor,
          borderWidth: 1,
          borderColor: topicColor,
        } : undefined}
      >
        {/* Topic artwork - faded so the ring and text stay readable. Once complete the
            card is filled with the topic colour, so the art rides on top of it instead. */}
        {backgroundImage && (
          <>
            <div
              className={`absolute inset-0 bg-cover bg-center ${isComplete ? 'opacity-20' : 'opacity-[0.18]'}`}
              style={{ backgroundImage: `url('${backgroundImage}')` }}
            />
            {!isComplete && (
              <div className="absolute inset-0 bg-gradient-to-t from-[#F5F0E8] via-[#F5F0E8]/70 to-transparent" />
            )}
          </>
        )}
        <div className="relative flex flex-col items-center">
          {/* VS Scoreboard when complete, Progress ring when loading.
              Avatar ABOVE the name, one column per player - mirrors the scoreboard on
              invite steps 2 and 3. All three pieces on a single line squeezed each
              other on mobile. */}
          {isComplete && player1 && player2 ? (
            <div className="flex items-center justify-between w-full gap-1 md:gap-4 px-1 md:px-6 mb-2">
              <div className="flex-1 min-w-0 flex flex-col items-center gap-1 md:gap-2">
                <div className="w-12 h-12 md:w-[72px] md:h-[72px] rounded-full overflow-hidden border-2 border-white/40 bg-white/20 flex-shrink-0">
                  {player1.avatar ? (
                    <img src={player1.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white font-display text-lg md:text-2xl">
                      {player1.username?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>
                <span className="w-full text-center font-display text-sm md:text-2xl text-white truncate leading-none">{player1.username}</span>
              </div>
              
              {/* VS */}
              <div className="font-display text-2xl md:text-5xl text-white/80 shrink-0 leading-none">VS</div>
              
              <div className="flex-1 min-w-0 flex flex-col items-center gap-1 md:gap-2">
                <div className="w-12 h-12 md:w-[72px] md:h-[72px] rounded-full overflow-hidden border-2 border-white/40 bg-white/20 flex-shrink-0">
                  {player2.avatar ? (
                    <img src={player2.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white font-display text-lg md:text-2xl">
                      {player2.username?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>
                <span className="w-full text-center font-display text-sm md:text-2xl text-white truncate leading-none">{player2.username}</span>
              </div>
            </div>
          ) : (
            <>
              <div className="relative mb-1 md:mb-2">
                <div
                  className="w-14 h-14 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-colors duration-300"
                  style={{ borderWidth: 2, borderColor: isComplete ? 'rgba(255,255,255,0.4)' : `${topicColor}30` }}
                >
                  <svg className="absolute w-14 h-14 md:w-20 md:h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle
                      cx="40"
                      cy="40"
                      r="38"
                      fill="none"
                      stroke={isComplete ? 'white' : topicColor}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${progress * 2.39} 239`}
                      className="transition-all duration-100"
                    />
                  </svg>
                  {isComplete ? (
                    <Check className="w-7 h-7 md:w-10 md:h-10 text-white" />
                  ) : (
                    TopicIcon && <TopicIcon className="w-7 h-7 md:w-10 md:h-10 animate-pulse" style={{ color: topicColor }} />
                  )}
                </div>
              </div>

              {/* Percentage in normal flow so it never overlaps the ring or the heading */}
              <div className="h-4 md:h-5 flex items-center justify-center mb-1">
                {!isComplete && (
                  <span
                    className="text-xs md:text-sm font-display tracking-wider"
                    style={{ color: topicColor }}
                  >
                    {shownProgress}%
                  </span>
                )}
              </div>
            </>
          )}

          <h2
            className="font-display text-lg md:text-xl tracking-wider mb-0.5 transition-colors duration-300"
            style={{ color: isComplete ? 'white' : '#111827' }}
          >
            {isComplete ? 'READY TO PLAY' : 'PREPARING QUESTIONS'}
          </h2>
          <p
            className="font-display text-sm md:text-base text-center tracking-wide transition-colors duration-300"
            style={{ color: isComplete ? 'rgba(255,255,255,0.9)' : '#111827' }}
          >
            {isComplete ? readySubtitle : subtitle}
          </p>
          {rounds && (
            <div 
              className="mt-2 px-3 py-1 rounded-full font-display text-sm tracking-wide"
              style={{ 
                backgroundColor: isComplete ? 'rgba(255,255,255,0.2)' : `${topicColor}20`,
                color: isComplete ? 'white' : topicColor 
              }}
            >
              {rounds} Rounds
            </div>
          )}
        </div>
      </div>

      {children}

      {/* Button - READY? while loading, START when complete (green to match status card) */}
      {!hideStartButton && (
        <button
          onClick={isComplete ? onStart : undefined}
          disabled={!isComplete}
          className={`w-full max-w-sm md:max-w-none py-3 md:py-5 rounded-xl font-display text-base md:text-xl tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 border ${
            isComplete ? 'text-white hover:scale-[1.02] active:scale-[0.98] border-transparent' : 'text-gray-400 cursor-not-allowed bg-cream border-warm'
          }`}
          style={{ background: isComplete ? topicColor : undefined }}
        >
          {isComplete ? (
            <>
              <Play className="w-5 h-5" />
              START
            </>
          ) : (
            <>
              <Clock className="w-5 h-5" />
              READY?
            </>
          )}
        </button>
      )}

      {footer && <div className="mt-3 text-center w-full max-w-sm md:max-w-none">{footer}</div>}
    </div>
  );
}
