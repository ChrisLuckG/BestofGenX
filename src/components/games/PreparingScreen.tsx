"use client";

import { useEffect, useState } from "react";
import { Check, Clock, Play, Layers, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CountryFlag from "@/components/CountryFlag";
import ShineSweep from "@/components/ShineSweep";

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
  /**
   * Topic name shown as a pill next to the rounds pill ("Music", "Sport", ...).
   * Battle used to carry this in a second card below the banner, which repeated
   * both avatars and the VS a second time just to label the topic.
   */
  topicLabel?: string;
  /** Number of questions/rounds in the game. */
  rounds?: number;
  /** Player 1 (you) info for VS display when ready */
  player1?: { username: string; avatar?: string; country?: string; countryFlag?: string };
  /** Player 2 (opponent) info for VS display when ready */
  player2?: { username: string; avatar?: string; country?: string; countryFlag?: string };
  /** Label on the start button. "START BATTLE" reads better than a bare START. */
  startLabel?: string;
  /** Called when user clicks CANCEL (only shown if provided). */
  onCancel?: () => void;
  /** Label on the cancel button. */
  cancelLabel?: string;
}

/**
 * Background art per topic. Missing entries mean "no image", not a fallback.
 * Exported because the invite flow's step 3 scoreboard has to use the very same
 * artwork - otherwise the banner changes appearance on the step 3 -> 4 move.
 */
export const TOPIC_BACKGROUNDS: Record<string, string> = {
  // Solo Trivia category images (new artwork from Fatih)
  all: '/images/categories/all.png',
  mixed: '/images/categories/all.png',
  music: '/images/categories/music.png',
  sport: '/images/categories/sports.png',
  sports: '/images/categories/sports.png',
  film: '/images/categories/movies.png',
  movies: '/images/categories/movies.png',
  tv: '/images/categories/movies.png',
  'tv & movies': '/images/categories/movies.png',
  'tv&movies': '/images/categories/movies.png',
  'movies-tv': '/images/categories/movies.png',
  games: '/images/categories/gaming.png',
  gaming: '/images/categories/gaming.png',
  politik: '/images/categories/politik.png',
  politics: '/images/categories/politik.png',
  // Legacy topic images (fallback)
  fashion: '/images/topics/fashion.png',
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
  topicLabel,
  rounds,
  player1,
  player2,
  startLabel = 'START',
  onCancel,
  cancelLabel = 'CANCEL',
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
  /**
   * The matchup state has its own layout: a LIGHT card with the topic pill
   * centred above a large VS, the rounds pill below it, and each player's
   * avatar, name and country in a column. The filled topic-colour banner it
   * replaces forced white-on-colour text, which is why names and country could
   * not carry any weight there.
   *
   * Driven by the PRESENCE of both players, not by `isComplete`: the loading
   * state used to be a completely different card (artwork, ring, heading), so
   * the whole screen re-flowed the moment the questions arrived. Now only the
   * middle column swaps - ring while loading, VS when ready - and nothing else
   * moves.
   */
  const vsLayout = !!player1 && !!player2;

  /** One player column of the matchup. */
  const playerColumn = (
    p: { username: string; avatar?: string; country?: string; countryFlag?: string },
    isYou: boolean,
  ) => (
    <div className="flex-1 min-w-0 flex flex-col items-center">
      <div className="relative">
        <div
          className="w-16 h-16 md:w-[120px] md:h-[120px] rounded-full overflow-hidden bg-white flex-shrink-0"
          style={{ borderWidth: isYou ? 3 : 2, borderStyle: 'solid', borderColor: isYou ? (backgroundImage ? 'white' : topicColor) : (backgroundImage ? 'rgba(255,255,255,0.5)' : '#E5DDD0') }}
        >
          {p.avatar ? (
            <img src={p.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-display text-xl md:text-4xl text-gray-400">
              {p.username?.[0]?.toUpperCase() || '?'}
            </div>
          )}
        </div>
        {/* Marks which side is you - the names alone do not say it. */}
        {isYou && (
          <span
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-white font-display text-[9px] md:text-[11px] tracking-wider whitespace-nowrap"
            style={{ backgroundColor: backgroundImage ? 'rgba(255,255,255,0.3)' : topicColor }}
          >
            YOU
          </span>
        )}
      </div>
      <span 
        className="w-full text-center font-display text-sm md:text-2xl truncate mt-3 md:mt-4 leading-none"
        style={{ color: backgroundImage ? 'white' : '#111827' }}
      >
        {p.username}
      </span>
      {p.country && (
        <span className="flex items-center justify-center gap-1.5 mt-1.5 min-w-0">
          <CountryFlag flag={p.countryFlag} className="w-4 h-3 rounded-[2px] shrink-0" />
          <span 
            className="font-display text-[10px] md:text-sm tracking-wide truncate"
            style={{ color: backgroundImage ? 'rgba(255,255,255,0.8)' : '#6B7280' }}
          >
            {p.country}
          </span>
        </span>
      )}
    </div>
  );

  return (
    /* min-h-0 + overflow-y-auto: without min-h-0 a flex item will not shrink
       below its content, so on a short phone the start button fell outside the
       parent and nothing scrolled. */
    <div className="preparing-screen flex flex-col items-center pt-4 md:pt-8 px-4 flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
      {/* Status Card with Icon and Text - compact to match setup screen */}
      <div
        className={`relative overflow-hidden w-full rounded-xl p-4 md:p-6 mb-3 transition-all duration-300 shadow-lg ${
          backgroundImage ? '' : 'bg-cream border border-warm'
        }`}
      >
        {/* Topic artwork - shown for both Solo Trivia and Battles */}
        {backgroundImage && (
          <>
            <div
              className={`absolute inset-0 bg-cover bg-center rounded-xl ${isComplete ? 'opacity-40' : ''}`}
              style={{ backgroundImage: `url('${backgroundImage}')` }}
            />
            {/* Dark gradient overlay for text readability */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/70 via-black/40 to-black/30" />
          </>
        )}
        {/* Occasional soft glint across the hero once it is ready */}
        <ShineSweep active={isComplete} intensity={0.18} minDelayMs={6000} maxDelayMs={12000} firstDelayMs={1800} />
        <div className="relative flex flex-col items-center">
          {/* Solo Trivia: Split layout with text left, animation right */}
          {!vsLayout && backgroundImage && (
            <div className="w-full flex items-center justify-between px-4 md:px-8 py-6 md:py-10">
              {/* Left side: Text - fixed width so it doesn't shift */}
              <div className="flex flex-col items-start flex-1 min-w-0">
                <h2
                  className="font-display text-xl md:text-3xl tracking-wider mb-1"
                  style={{ color: 'white' }}
                >
                  {isComplete ? 'READY TO PLAY' : (
                    <>
                      LOADING
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="inline-block"
                          style={{ animation: 'loadingDot 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
                        >.</span>
                      ))}
                    </>
                  )}
                </h2>
                <p
                  className="font-display text-sm md:text-lg tracking-wide mb-3 opacity-90 flex items-center gap-2"
                  style={{ color: 'white' }}
                >
                  {isComplete ? readySubtitle : subtitle}
                  {topicLabel && (
                    <span
                      className="px-2 py-0.5 rounded font-display text-xs md:text-sm tracking-wide uppercase"
                      style={{ backgroundColor: topicColor, color: 'white' }}
                    >
                      {topicLabel}
                    </span>
                  )}
                </p>
                {/* Rounds pill */}
                {rounds && (
                  <div
                    className="px-4 py-1.5 rounded font-display text-sm tracking-wide"
                    style={{ backgroundColor: 'rgba(255,255,255,0.25)', color: 'white' }}
                  >
                    {rounds} ROUNDS
                  </div>
                )}
              </div>

              {/* Right side: Pixel Loading Animation - unified for all categories */}
              <div className="w-28 h-28 md:w-36 md:h-36 flex items-center justify-center flex-shrink-0">
                {isComplete ? (
                  /* Checkmark when ready */
                  <div className="w-20 h-20 md:w-28 md:h-28 rounded-full bg-white/20 flex items-center justify-center animate-[popIcon_0.4s_ease-out]">
                    <Check className="w-12 h-12 md:w-16 md:h-16 text-white" />
                  </div>
                ) : (
                  /* Equalizer bars - scale from the bottom, staggered */
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-end gap-1.5 h-14 md:h-20">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="w-3.5 h-full md:w-5 bg-white rounded-sm origin-bottom shadow-[0_0_12px_rgba(255,255,255,0.45)]"
                          style={{
                            animation: 'eqBar 0.9s ease-in-out infinite',
                            animationDelay: `${i * 0.12}s`,
                          }}
                        />
                      ))}
                    </div>
                    <span className="font-display text-base md:text-xl text-white tabular-nums tracking-wider">{shownProgress}%</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VS Scoreboard when complete, Progress ring when loading.
              Avatar ABOVE the name, one column per player - mirrors the scoreboard on
              invite steps 2 and 3. All three pieces on a single line squeezed each
              other on mobile. */}
          {vsLayout ? (
            <div className="w-full">
              {/* Topic above the VS, centred - it describes the matchup, not
                  either player. */}
              {topicLabel && (
                <div className="flex justify-center">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 md:px-4 py-1 md:py-1.5 rounded font-display text-xs md:text-sm tracking-wide uppercase animate-[chipIn_0.3s_ease-out]"
                    style={{ backgroundColor: topicColor, color: 'white' }}
                  >
                    {TopicIcon && <TopicIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                    {topicLabel}
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between w-full gap-1 md:gap-4 px-1 md:px-6 mt-3 md:mt-4">
                {playerColumn(player1!, true)}

                {/* Middle column: the progress ring while loading, the VS once
                    ready. Both are boxed to the SAME height so the two players
                    either side do not shift when the swap happens. */}
                <div className="shrink-0 flex flex-col items-center pt-3 md:pt-6">
                  <div className="h-10 md:h-[60px] flex items-center justify-center">
                    {isComplete ? (
                      <div className="relative flex items-center justify-center">
                        {/* Faint speed smear behind the VS. Blurred and skewed on
                            purpose: an unblurred gradient box showed its own hard
                            vertical edges and read as a grey rectangle, not motion. */}
                        <span
                          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 md:w-44 h-7 md:h-12 pointer-events-none -skew-x-12 blur-[6px] md:blur-[8px]"
                          style={{
                            background: backgroundImage 
                              ? `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 45%, rgba(255,255,255,0.1) 60%, transparent 100%)`
                              : `linear-gradient(90deg, transparent 0%, ${topicColor}26 45%, ${topicColor}1a 60%, transparent 100%)`,
                          }}
                        />
                        <span
                          className="relative font-display text-3xl md:text-6xl leading-none italic animate-[popIcon_0.4s_ease-out]"
                          style={{ color: backgroundImage ? 'white' : topicColor }}
                        >
                          VS
                        </span>
                      </div>
                    ) : (
                      <div className="relative w-10 h-10 md:w-[56px] md:h-[56px] flex items-center justify-center">
                        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r="36" fill="none" stroke={backgroundImage ? 'rgba(255,255,255,0.3)' : `${topicColor}26`} strokeWidth="5" />
                          <circle
                            cx="40"
                            cy="40"
                            r="36"
                            fill="none"
                            stroke={backgroundImage ? 'white' : topicColor}
                            strokeWidth="5"
                            strokeLinecap="round"
                            strokeDasharray={`${progress * 2.26} 226`}
                            className="transition-all duration-100"
                          />
                        </svg>
                        <span
                          className="relative font-display text-[10px] md:text-sm tracking-wide tabular-nums"
                          style={{ color: backgroundImage ? 'white' : topicColor }}
                        >
                          {shownProgress}%
                        </span>
                      </div>
                    )}
                  </div>
                  {rounds && (
                    <span 
                      className="inline-flex items-center gap-1.5 px-3 py-1 md:py-1.5 mt-3 md:mt-5 rounded font-display text-[10px] md:text-sm tracking-wide whitespace-nowrap animate-[chipIn_0.3s_ease-out]"
                      style={{ backgroundColor: backgroundImage ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.055)', color: backgroundImage ? 'white' : '#4B5563' }}
                    >
                      <Layers className="w-3 h-3 md:w-4 md:h-4 shrink-0" />
                      {rounds} Rounds
                    </span>
                  )}
                </div>

                {playerColumn(player2!, false)}
              </div>
            </div>
          ) : !backgroundImage ? (
            <>
              <div className="relative mb-1 md:mb-2">
                <div
                  className="w-14 h-14 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-colors duration-300"
                  style={{ borderWidth: 2, borderColor: `${topicColor}30` }}
                >
                  <svg className="absolute w-14 h-14 md:w-20 md:h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle
                      cx="40"
                      cy="40"
                      r="38"
                      fill="none"
                      stroke={topicColor}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${progress * 2.39} 239`}
                      className="transition-all duration-100"
                    />
                  </svg>
                  {isComplete ? (
                    <Check className="w-7 h-7 md:w-10 md:h-10" style={{ color: topicColor }} />
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

              {/* Heading and subtitle for non-image layout */}
              <h2
                className="font-display text-lg md:text-xl tracking-wider mb-0.5 transition-colors duration-300"
                style={{ color: '#111827' }}
              >
                {isComplete ? 'READY TO PLAY' : 'PREPARING QUESTIONS'}
              </h2>
              <p
                className="font-display text-sm md:text-base text-center tracking-wide transition-colors duration-300"
                style={{ color: '#111827' }}
              >
                {isComplete ? readySubtitle : subtitle}
              </p>
              {(rounds || topicLabel) && (
                <div className="flex items-center gap-2 mt-2">
                  {topicLabel && (
                    <div
                      className="px-3 py-1 rounded font-display text-sm tracking-wide uppercase"
                      style={{ backgroundColor: topicColor, color: 'white' }}
                    >
                      {topicLabel}
                    </div>
                  )}
                  {rounds && (
                    <div
                      className="px-3 py-1 rounded font-display text-sm tracking-wide"
                      style={{ backgroundColor: `${topicColor}20`, color: topicColor }}
                    >
                      {rounds} Rounds
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}


        </div>
      </div>

      {children}

      {/* Buttons - Cancel (if provided) + Start */}
      {!hideStartButton && (
        <div className="w-full max-w-sm md:max-w-none flex gap-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex-1 py-3.5 md:py-4 rounded-xl font-display text-base md:text-lg tracking-wider transition-all border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-400 active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <X className="w-5 h-5" />
              {cancelLabel}
            </button>
          )}
          <button
            onClick={isComplete ? onStart : undefined}
            disabled={!isComplete}
            className={`${isComplete ? 'hover-shine' : ''} relative overflow-hidden flex-1 py-3.5 md:py-4 rounded-xl font-display text-base md:text-lg tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 border ${
              isComplete ? 'text-white hover:scale-[1.01] active:scale-[0.99] border-transparent' : 'text-gray-400 cursor-not-allowed bg-cream border-warm'
            }`}
            style={{ background: isComplete ? topicColor : undefined }}
          >
            <ShineSweep active={isComplete} intensity={0.4} minDelayMs={3000} maxDelayMs={6500} firstDelayMs={700} />
            {isComplete ? (
              <>
                {/* Play glyph in a rounded square, so the primary action reads as
                    a button rather than as a line of text. */}
                <span className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <Play className="w-4 h-4 md:w-5 md:h-5 fill-white ml-0.5" />
                </span>
                {startLabel}
              </>
            ) : (
              <>
                <Clock className="w-5 h-5" />
                READY?
              </>
            )}
          </button>
        </div>
      )}

      {footer && <div className="mt-3 text-center w-full max-w-sm md:max-w-none">{footer}</div>}
    </div>
  );
}
