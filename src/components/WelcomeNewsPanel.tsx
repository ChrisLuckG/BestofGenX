"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Cake,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Coins,
  CreditCard,
  Euro,
  FileText,
  Gamepad2,
  Hourglass,
  Landmark,
  Lightbulb,
  Lock,
  Mail,
  Minus,
  Plus,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  Vote,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import CountryFlag from "@/components/CountryFlag";
import { countryNameToCode } from "@/lib/countryFlags";
import ModalPortal from "./ModalPortal";

// ============================================================
// The welcome page shown when the welcome notification is opened.
// Layout and copy follow the reference mockup public/welcome/Main.dc.html:
// same sections, same order, same text - rendered in the app's own
// visual system (gold gradient bars, cream cards, Bebas Neue).
// ============================================================

/**
 * Warm gold gradient used for CTAs and the hero. The old middle stop (#C4772A)
 * was a desaturated brown that read as mud where the gradient was widest - the
 * retirement-home header. Ramping burnt orange straight into bright gold keeps
 * every stop saturated.
 */
const GOLD_GRADIENT = 'linear-gradient(120deg, #D4550E 0%, #E36B11 42%, #E8A33C 100%)';

/**
 * Same ramp, darkened, for gradient text on the cream cards. The bright end of
 * GOLD_GRADIENT (#E8A33C) does not carry enough contrast against #F5EDE4 to be
 * read as type.
 */
const GOLD_GRADIENT_TEXT = 'linear-gradient(120deg, #A63E0A 0%, #E36B11 55%, #C4772A 100%)';

/** Diagonal print texture - cheap nod to screen-printed 80s posters, no asset needed. */
const PRINT_TEXTURE = 'repeating-linear-gradient(135deg, rgba(245,240,232,0.07) 0 2px, transparent 2px 9px)';

/**
 * Hero background clip. The gold gradient stays on the container underneath as
 * the fallback, so a failed or still-buffering video degrades to the branded
 * fill rather than to a bare box.
 */
const HERO_VIDEO = '/videos/welcome-hero-bg.mp4';

/** Default fallback for humans vs bots until API responds. */
const DEFAULT_HUMANS = 1;
const DEFAULT_BOTS = 49;

/**
 * War chest payment targets. Placeholders like in the mockup - fill in once
 * real accounts exist. A payment button without a target renders dimmed
 * instead of linking nowhere.
 */
const PAYPAL_ME_HANDLE = ''; // e.g. 'eastercorn' -> paypal.me/eastercorn/5EUR
const CARD_CHECKOUT_URL = '';
const BANK_RECIPIENT = '';
const BANK_IBAN = '';
const WAR_CHEST_EUR = 0;
const SUPPORTERS = 0;

/** Eastercorn portrait shots for the letter modal carousel. */
const EASTERCORN_IMAGES = Array.from(
  { length: 11 },
  (_, i) => `/images/Eastercorn/eastercorn-${String(i + 1).padStart(2, '0')}.png`
);

/** Reward for correct bonus answer - same scale as other mini-games. */
const BONUS_REWARD = 0.05;

/** localStorage key to track if user already answered the bonus question today. */
const BONUS_ANSWERED_KEY = 'bogx_welcome_bonus_answered';

const BONUS_QUESTION = {
  question: 'In which year did the Berlin Wall fall?',
  options: [
    { id: 'a', letter: 'A', label: '1987' },
    { id: 'b', letter: 'B', label: '1989' },
    { id: 'c', letter: 'C', label: '1990' },
    { id: 'd', letter: 'D', label: '1991' },
  ],
  correct: 'b',
  explanation:
    'November 9, 1989. A botched press conference announced open borders and Berliners streamed through that same night.',
};

const HOW_IT_WORKS = [
  {
    icon: Calendar,
    title: "Meet today's birthdays",
    text: 'Every morning we celebrate the GenX icons born on this day — the greatest, the craziest, the most horrifying.',
  },
  {
    img: '/images/bogxcoin.png',
    title: 'Play & earn BOGX coins',
    text: 'Daily Trivia and Quiz Battles pay out coins — but you also earn by reading articles, reacting with emojis and just being around. Everything counts.',
    note: 'Real talk: coins are for glory right now, not cash. But if the community grows and the war chest fills up, who knows what the top Bogxers might get one day.',
  },
  {
    icon: Vote,
    title: 'Vote in the Rankroll',
    text: 'New ranked lists every day — best movies, worst fashion, one-hit wonders. Your votes decide the order.',
  },
  {
    icon: Trophy,
    title: 'Climb the leaderboard',
    text: 'Every coin counts toward your rank. Day, month and year boards — the daily one resets at 10:00 Berlin time.',
  },
  {
    icon: FileText,
    title: 'Read their stories',
    text: 'In between games: articles, throwbacks and videos that take you back to the years we grew up in.',
  },
];

interface BirthdayPerson {
  _id: string;
  firstname?: string;
  lastname?: string;
  born?: string;
  knownfor?: string;
  profession?: string;
  subcat?: string;
  countryBorn?: string;
  image?: string;
  hasArticle?: boolean;
  articleId?: string;
}

interface GridUser {
  _id: string;
  username: string;
  avatar?: string;
  country?: string;
  countryFlag?: string;
  coins?: number;
  joinedAt?: string;
  isBot: boolean;
}

interface WelcomeNewsPanelProps {
  /** Shown in the intro line when known. */
  username?: string;
  /** Logged in members do not need the sign-up CTA. */
  isLoggedIn?: boolean;
  /** Opens the sign-up / login flow. */
  onShowSignup?: () => void;
  /** Navigate to the Welcome Reel / feed. */
  onShowBogxers?: () => void;
  /** Navigate to the arcade (trivia/battles). */
  onShowArcade?: () => void;
  /** Navigate to the rankroll voting tab. */
  onShowRankroll?: () => void;
  /** Back to the notification list. Kept here so the host page stays a one-liner. */
  onBack?: () => void;
  /** Trigger coin animation in header (for bonus question reward). */
  onCoinAnimation?: (amount: number) => void;
}

/**
 * Large display figure with a kicker label above.
 *
 * The kicker deliberately does NOT use `font-display`: globals.css pins
 * `letter-spacing: 0.01em !important` on that class, which silently killed the
 * wide tracking a kicker needs. Inter at 10px with real 0.22em spacing is what
 * the label was always supposed to look like.
 */
function BigFigure({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#E36B11]/80 block mb-1">
        {kicker}
      </span>
      <span
        className="font-display text-5xl md:text-6xl leading-[0.85] block tabular-nums bg-clip-text text-transparent"
        style={{ backgroundImage: GOLD_GRADIENT_TEXT }}
      >
        {children}
      </span>
    </div>
  );
}

/** Cream card with the orange gradient title bar - the recurring block shape. */
function SectionCard({
  icon: Icon,
  title,
  note,
  noteNode,
  children,
  sectionRef,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  note?: string;
  noteNode?: React.ReactNode;
  children: React.ReactNode;
  sectionRef?: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div ref={sectionRef} className="bg-[#F5EDE4] border border-[#E36B11]/20 rounded-xl scroll-mt-4">
      <div className="relative overflow-hidden rounded-t-xl px-5 py-3" style={{ background: GOLD_GRADIENT }}>
        <div className="absolute inset-0" style={{ backgroundImage: PRINT_TEXTURE }} />
        <h3 className="relative font-display text-xl md:text-2xl tracking-wide text-white flex items-center gap-2 leading-none">
          <Icon className="w-5 h-5 flex-shrink-0" />
          {title}
          {noteNode ? (
            <span className="ml-auto font-sans text-xs font-bold tracking-normal normal-case">
              {noteNode}
            </span>
          ) : note ? (
            <span className="ml-auto font-sans text-xs font-bold tracking-normal normal-case">
              {note}
            </span>
          ) : null}
        </h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// Eastercorn / Noodles story. Mobile keeps its slide-in panel below the header
// (unchanged). On desktop that panel landed see-through on top of the feed, so
// from lg up it is a centred window over a dark backdrop instead.
function StoryPanel({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`lg:hidden fixed inset-x-0 bottom-0 top-16 z-[60] transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
        style={{ willChange: 'transform' }}
      >
        <div className="h-full bg-cream flex flex-col">
          <div className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3 border-b border-warm bg-cream">
            <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-[#E36B11]/10 transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h3 className="font-display text-lg tracking-wide text-gray-900">{title}</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </div>
      </div>

      {open && (
        <ModalPortal>
          <div
            className="hidden lg:flex fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm items-center justify-center p-6"
            onClick={onClose}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="bg-cream rounded-2xl shadow-2xl border border-warm w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 flex items-center border-b border-warm">
                <h3 className="font-display text-2xl tracking-wide text-gray-900">{title}</h3>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="ml-auto w-9 h-9 rounded-full hover:bg-[#E36B11]/10 flex items-center justify-center text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">{children}</div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}

export default function WelcomeNewsPanel({
  username,
  isLoggedIn: isLoggedInProp = false,
  onShowSignup,
  onShowBogxers,
  onShowArcade,
  onShowRankroll,
  onBack,
  onCoinAnimation,
}: WelcomeNewsPanelProps) {
  const { user, isLoggedIn: authLoggedIn } = useAuth();
  const isLoggedIn = isLoggedInProp || authLoggedIn;
  const userId = user?.id;

  const [birthdays, setBirthdays] = useState<BirthdayPerson[]>([]);
  const [bdayIdx, setBdayIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [bonusRewarded, setBonusRewarded] = useState(false);
  const [humans, setHumans] = useState(DEFAULT_HUMANS);
  const [bots, setBots] = useState(DEFAULT_BOTS);
  const [gridUsers, setGridUsers] = useState<GridUser[]>([]);
  const [tip, setTip] = useState(5);
  const [showBank, setShowBank] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  const [letterImgIdx, setLetterImgIdx] = useState(0);
  const [noodlesOpen, setNoodlesOpen] = useState(false);
  const [wantedOpen, setWantedOpen] = useState(false);
  const [warChest, setWarChest] = useState(0);
  const [warChestVisible, setWarChestVisible] = useState(false);
  const [humansShown, setHumansShown] = useState(0);
  const [botsShown, setBotsShown] = useState(0);
  const bornTodayRef = useRef<HTMLDivElement>(null);
  const finalRef = useRef<HTMLDivElement>(null);
  const warChestRef = useRef(0);
  const warChestElRef = useRef<HTMLDivElement>(null);
  const countsElRef = useRef<HTMLDivElement>(null);
  const countsPlayedRef = useRef(false);

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) =>
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Check if bonus was already answered today. Stored value is JSON
  // { at: ISO string, optionId } - a bare ISO string (older writes) still parses.
  useEffect(() => {
    const raw = localStorage.getItem(BONUS_ANSWERED_KEY);
    if (!raw) return;
    let at = raw;
    let optionId: string | null = null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        at = parsed.at;
        optionId = parsed.optionId ?? null;
      }
    } catch {
      // legacy: plain ISO string
    }
    if (new Date(at).toDateString() === new Date().toDateString()) {
      // Already answered today - replay their pick, no new reward
      setPicked(optionId ?? 'already');
    } else {
      localStorage.removeItem(BONUS_ANSWERED_KEY);
    }
  }, []);

  // Fetch humans vs bots counts and grid users
  useEffect(() => {
    fetch('/api/users/stats')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setHumans(data.humans || DEFAULT_HUMANS);
          setBots(data.bots || DEFAULT_BOTS);
          if (Array.isArray(data.gridUsers)) {
            setGridUsers(data.gridUsers);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/almanac?type=people&birthdayToday=true')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          // Only people who also appear in the Welcome Reel - i.e. they have a
          // published story. Raw almanac entries without an article are skipped.
          const withStory = data.data.filter((p: BirthdayPerson) => p.hasArticle);
          setBirthdays(withStory.length > 0 ? withStory : data.data);
        }
      })
      .catch(() => {});
  }, []);

  // Born-today carousel: gentle auto-advance, pauses nothing fancy -
  // manual arrows reset the timer via the same setter.
  useEffect(() => {
    if (birthdays.length <= 1) return;
    const t = setInterval(() => setBdayIdx((i) => (i + 1) % birthdays.length), 6000);
    return () => clearInterval(t);
  }, [birthdays.length]);

  // Eastercorn portrait carousel - only while the letter modal is open.
  useEffect(() => {
    if (!letterOpen) return;
    const t = setInterval(() => setLetterImgIdx((i) => (i + 1) % EASTERCORN_IMAGES.length), 4000);
    return () => clearInterval(t);
  }, [letterOpen]);

  // War chest gag counter: counts up into the green like donations are
  // coming in, then plunges into the red - because right now this hobby
  // only has running costs (~€300/month for servers, APIs, coffee).
  // Starts only once the figure is scrolled into view.
  useEffect(() => {
    const el = warChestElRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setWarChestVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!warChestVisible) return;
    const PEAK = 247;
    const FLOOR = -300;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tween = (to: number, durMs: number, done: () => void) => {
      const from = warChestRef.current;
      const start = performance.now();
      const frame = (now: number) => {
        if (cancelled) return;
        const t = Math.min(1, (now - start) / durMs);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        warChestRef.current = Math.round(from + (to - from) * eased);
        setWarChest(warChestRef.current);
        if (t < 1) requestAnimationFrame(frame);
        else done();
      };
      requestAnimationFrame(frame);
    };

    tween(PEAK, 2200, () => {
      timer = setTimeout(() => {
        tween(FLOOR, 1600, () => {});
      }, 1500);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warChestVisible]);

  // Humans/Bots figures count up once scrolled into view - same trick as the
  // war chest, but the data arrives async so the observer re-arms on `humans`.
  useEffect(() => {
    // Data arrived after the count-up already played - just settle on it.
    if (countsPlayedRef.current) {
      setHumansShown(humans);
      setBotsShown(bots);
      return;
    }
    const el = countsElRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        countsPlayedRef.current = true;
        const dur = 1200;
        const start = performance.now();
        const frame = (now: number) => {
          const t = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - t, 3);
          setHumansShown(Math.round(humans * eased));
          setBotsShown(Math.round(bots * eased));
          if (t < 1) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [humans, bots]);

  // Handle bonus question answer
  const handleBonusAnswer = async (optionId: string) => {
    if (picked) return;
    setPicked(optionId);
    localStorage.setItem(
      BONUS_ANSWERED_KEY,
      JSON.stringify({ at: new Date().toISOString(), optionId })
    );

    const isCorrect = optionId === BONUS_QUESTION.correct;
    if (!isCorrect) return;

    // Award coins for correct answer
    if (isLoggedIn && userId) {
      try {
        // Update user balance
        await fetch('/api/user/update-bogx', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, amount: BONUS_REWARD }),
        });

        // Record game result for ranking
        await fetch('/api/game-results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            cardId: 'welcome-bonus-' + new Date().toISOString().slice(0, 10),
            question: BONUS_QUESTION.question,
            userAnswer: BONUS_QUESTION.options.find((o) => o.id === optionId)?.label,
            correctAnswer: BONUS_QUESTION.options.find((o) => o.id === BONUS_QUESTION.correct)?.label,
            isCorrect: true,
            pointsChange: BONUS_REWARD,
            timeUsed: 0,
            difficulty: 1,
            skipped: false,
            timedOut: false,
          }),
        });

        setBonusRewarded(true);
        // Trigger coin animation in header
        onCoinAnimation?.(BONUS_REWARD);
        // Trigger coin refresh
        window.dispatchEvent(new CustomEvent('bogx-updated'));
      } catch (e) {
        console.error('Failed to award bonus:', e);
      }
    } else {
      // Guest: save to localStorage
      const guestCoins = parseFloat(localStorage.getItem('bogx_guest_coins') || '0');
      localStorage.setItem('bogx_guest_coins', String(Math.round((guestCoins + BONUS_REWARD) * 100) / 100));
      setBonusRewarded(true);
      // Trigger coin animation for guests too
      onCoinAnimation?.(BONUS_REWARD);
    }
  };

  const featured = birthdays[bdayIdx % Math.max(1, birthdays.length)];
  const personName = (p: BirthdayPerson) => `${p.firstname ?? ''} ${p.lastname ?? ''}`.trim();
  const bornYear = (p: BirthdayPerson) => (p.born ? p.born.substring(0, 4) : '');
  const todayLabel = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  const paypalHref = PAYPAL_ME_HANDLE ? `https://paypal.me/${PAYPAL_ME_HANDLE}/${tip}EUR` : '';
  const noodles = gridUsers.find((u) => u.username.toLowerCase() === 'noodles');

  return (
    <div className="px-4 py-4 space-y-5 overflow-x-hidden">
      {/* The top action leads INTO the community rather than back out of the page -
          a plain "Back" was the weakest possible thing to offer someone who just
          read the manifesto. Falls back to a real back link on any host that has
          no rankings target, so no surface is left without a way out. */}
      {onShowBogxers ? (
        <button
          onClick={onShowBogxers}
          className="flex items-center gap-1.5 text-[#E36B11] font-display text-sm tracking-wide group"
        >
          Show me the BOGXers
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      ) : onBack ? (
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[#E36B11] font-display text-sm tracking-wide"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
      ) : null}

      {/* ── HERO ────────────────────────────────────────────────── */}
      {/* min-height is explicit: the copy now runs the full width and so wraps
          into fewer lines than it did in the old max-w-lg column. Without a floor
          the box would collapse to whatever the text happens to need and the clip
          would lose the room it needs to read as a background. */}
      <div
        className="relative overflow-hidden rounded-xl px-6 py-10 md:px-10 md:py-14 flex items-stretch min-h-[300px] md:min-h-[380px]"
        style={{ background: GOLD_GRADIENT }}
      >
        <video
          src={HERO_VIDEO}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          autoPlay
          loop
          playsInline
        />
        {/* Legibility scrim, kept deliberately thin. Full-width copy does need
            cover on the right, but buying that with a heavy overlay hid the clip
            entirely. The contrast is carried by a text-shadow on the copy itself
            instead, which costs the background nothing. */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#1A1A1A]/75 via-[#1A1A1A]/45 to-[#2A1608]/25" />
        {/* Screen-print texture, keeps the fill from looking like a plastic banner */}
        <div className="absolute inset-0" style={{ backgroundImage: PRINT_TEXTURE }} />

        {/* The shadow is what makes the thin scrim above viable - it keeps the
            copy readable over the bright frames of the clip without darkening it.
            The whole group sits at the bottom (justify-end) so the headline stays
            attached to the copy it introduces - splitting them to opposite edges
            left the title floating on its own. The clip keeps the open top. */}
        <div className="relative w-full flex flex-col justify-end [text-shadow:0_2px_6px_rgba(0,0,0,0.75)]">
          <div className="w-fit">
            <span className="font-display text-base md:text-lg tracking-[0.35em] text-white">
              WELCOME TO
            </span>
            {/* The headline sits in an inline-size container, which has no
                intrinsic width - so w-fit sizes the block from the tagline
                below and the cqi font-size scales the headline to exactly
                that width (measured: 22.44% of the block, all breakpoints). */}
            <div className="w-full" style={{ containerType: 'inline-size' }}>
              <h2
                className="font-display font-semibold tracking-wide leading-[0.95] text-white mt-1 whitespace-nowrap"
                style={{ fontSize: '22.44cqi' }}
              >
                Best of Gen<span className="sonar-x text-[#E36B11]" style={{ fontSize: '1.15em' }}>X</span>
              </h2>
            </div>
            <p className="font-display text-xl md:text-2xl tracking-wide text-[#FFD9A8] mt-1">
              One GenXer. No company. Room for all of us.
            </p>
            {username && (
              <p className="font-display text-lg tracking-wide text-white/85 mt-1">
                Good to see you, {username}.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── DUE DATE 2090 ────────────────────────────────────────── */}
      <SectionCard icon={Hourglass} title="Due date 2090">
        <div className="space-y-4">
          <p className="text-[13px] text-gray-700 leading-relaxed">
            Some nerdy algorithm says the last GenXer switches off the lights around 2090.
            It won&rsquo;t be me. I lived the GenX lifestyle to the fullest.
          </p>
          <p className="text-[13px] text-gray-700 leading-relaxed">
            Until the lights go out, I&rsquo;m doing my part: every day I celebrate the GenX
            icons born on this day. The greatest, the craziest, the most horrifying.
          </p>
          <p className="text-[13px] text-gray-700 leading-relaxed">
            And no, this is not another celebrity page. I&rsquo;m curious about the people who
            shaped us, including the ones you remember and I&rsquo;ve never heard of. I&rsquo;d
            rather learn from you, fellow Bogxers, than retell the same famous faces for the
            hundredth time. Right now it&rsquo;s just me. Come make it us.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <button
              onClick={onShowBogxers}
              className="inline-flex items-center gap-2 text-[#E36B11] font-display text-lg tracking-wider transition-opacity hover:opacity-70"
            >
              <Cake className="w-5 h-5" />
              See who was born today
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <SectionCard icon={Lightbulb} title="How it works">
        <div className="divide-y divide-[#E36B11]/20">
          {HOW_IT_WORKS.map(({ icon: Icon, img, title, text, note }: any) => (
            <div key={title} className="py-4 first:pt-0 last:pb-0">
              {/* Title with inline icon */}
              <div className="font-display text-base tracking-wide text-gray-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg border border-[#E36B11]/20 flex items-center justify-center flex-shrink-0">
                  {img ? (
                    <img src={img} alt="" className="w-4 h-4" />
                  ) : (
                    <Icon className="w-3.5 h-3.5 text-[#E36B11]" />
                  )}
                </span>
                {title}
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mt-1.5">{text}</p>
              {note && (
                <p className="text-sm text-gray-600 italic leading-relaxed mt-1.5">{note}</p>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── BORN TODAY ───────────────────────────────────────────── */}
      <div ref={bornTodayRef} className="bg-[#F5EDE4] border border-[#E36B11]/20 rounded-xl overflow-hidden scroll-mt-4">
        <div className="relative overflow-hidden px-5 py-3" style={{ background: GOLD_GRADIENT }}>
          <div className="absolute inset-0" style={{ backgroundImage: PRINT_TEXTURE }} />
          <h3 className="relative font-display text-xl md:text-2xl tracking-wide text-white flex items-center gap-2 leading-none">
            <Cake className="w-5 h-5 flex-shrink-0" />
            Born today
            <span className="ml-auto font-display text-lg md:text-xl tracking-wider text-white bg-white/20 rounded-lg px-2.5 py-0.5">
              {todayLabel}
            </span>
          </h3>
        </div>

        {featured ? (
          <div className="p-4">
            {/* Carousel card: one person on mobile, two side-by-side on desktop,
                image stays a portrait tile so heavy photos stay readable */}
            <div className="relative rounded-xl bg-white/60 border border-[#E36B11]/15 p-4 flex items-center">
              {/* Prev / next */}
              {birthdays.length > 1 && (
                <>
                  <button
                    onClick={() => setBdayIdx((i) => (i - 1 + birthdays.length) % birthdays.length)}
                    aria-label="Previous birthday"
                    className="absolute left-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-[#E36B11]/20 text-[#E36B11] flex items-center justify-center shadow-sm hover:bg-[#FBF1E6] transition-colors z-10"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setBdayIdx((i) => (i + 1) % birthdays.length)}
                    aria-label="Next birthday"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-[#E36B11]/20 text-[#E36B11] flex items-center justify-center shadow-sm hover:bg-[#FBF1E6] transition-colors z-10"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}

              {[
                { p: featured, extra: '' },
                ...(birthdays.length > 1
                  ? [{ p: birthdays[(bdayIdx + 1) % birthdays.length], extra: 'hidden sm:flex' }]
                  : []),
              ].map(({ p, extra }, slotIdx) => (
                <div key={`${p._id}-${slotIdx}`} className={`flex-1 min-w-0 flex items-center gap-4 ${extra} ${slotIdx > 0 ? 'sm:border-l sm:border-[#E36B11]/15 sm:pl-5' : ''}`}>
                  {/* Portrait tile */}
                  <div className={`w-24 h-24 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-[#EFE7DB] flex-shrink-0 flex items-center justify-center ${slotIdx === 0 ? 'ml-8 sm:ml-10' : ''}`}>
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={personName(p)}
                        className="w-full h-full object-cover animate-[fadeIn_0.4s_ease-out]"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="font-display text-3xl text-[#E36B11]/60">
                        {personName(p).split(' ').map((n) => n[0]).join('')}
                      </span>
                    )}
                  </div>

                  {/* Text */}
                  <div className="min-w-0 flex-1 animate-[fadeIn_0.4s_ease-out]">
                    <div className="font-display text-2xl sm:text-2xl tracking-wide leading-none text-gray-900 truncate">
                      {personName(p)}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-600">
                      {p.countryBorn && (
                        <>
                          <CountryFlag flag={countryNameToCode(p.countryBorn)} className="w-4 h-3 rounded-[2px] flex-shrink-0" />
                          <span>{p.countryBorn}</span>
                          <span>·</span>
                        </>
                      )}
                      <span>Born {bornYear(p)}</span>
                    </div>
                    {(p.subcat || p.knownfor || p.profession) && (
                      <div className="text-xs text-gray-600 truncate mt-0.5">
                        {p.subcat || p.knownfor || p.profession}
                      </div>
                    )}
                    {p.articleId && onShowBogxers && (
                      <button
                        onClick={onShowBogxers}
                        className="text-xs text-[#E36B11] font-semibold hover:underline mt-1.5 inline-flex items-center gap-1"
                      >
                        Read the story <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Dots */}
            {birthdays.length > 1 && (
              <div className="flex justify-center gap-1.5 mt-3">
                {birthdays.map((p, i) => (
                  <button
                    key={p._id}
                    onClick={() => setBdayIdx(i)}
                    aria-label={`Show ${personName(p)}`}
                    className={`h-1.5 rounded-full transition-all ${
                      i === bdayIdx % birthdays.length
                        ? 'w-5 bg-[#E36B11]'
                        : 'w-1.5 bg-[#E36B11]/25 hover:bg-[#E36B11]/50'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-6">
            <p className="text-sm text-gray-600">
              Nobody in the archive today - tomorrow brings new birthdays.
            </p>
          </div>
        )}
      </div>

      {/* ── BONUS QUESTION ───────────────────────────────────────── */}
      <SectionCard
        icon={Sparkles}
        title="Bonus: quick question"
        noteNode={
          <span className="inline-flex items-center gap-1.5 bg-white/20 rounded-lg px-2.5 py-1">
            <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
            +{BONUS_REWARD.toFixed(2)} BOGX
          </span>
        }
      >
        <p className="text-base font-bold text-gray-900 leading-snug">
          {BONUS_QUESTION.question}
        </p>
        <div className="grid sm:grid-cols-2 gap-2.5 mt-4">
          {BONUS_QUESTION.options.map((opt) => {
            const isCorrect = opt.id === BONUS_QUESTION.correct;
            const isPicked = opt.id === picked;
            const cls = picked
              ? isCorrect
                ? 'border-[#2F7D4F] bg-[#EAF5EE]'
                : isPicked
                  ? 'border-[#B3261E] bg-[#FBECEA]'
                  : 'border-[#E6DED5] bg-white opacity-50'
              : 'border-[#E6DED5] bg-white hover:border-[#E36B11]';
            return (
              <button
                key={opt.id}
                onClick={() => handleBonusAnswer(opt.id)}
                disabled={!!picked}
                className={`flex items-center gap-3 min-h-[52px] px-4 py-3 rounded-xl border-[1.5px] text-left text-sm font-medium text-gray-800 transition-colors ${cls}`}
              >
                <span className="w-7 h-7 rounded-md bg-[#FBF1E6] text-[#E36B11] font-bold text-xs flex items-center justify-center flex-shrink-0">
                  {opt.letter}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>

        {picked && (
          <div className="mt-4 border-t border-[#E6DED5] pt-4 space-y-3">
            <div className="flex items-center gap-2 text-base font-bold text-gray-900">
              {picked === 'already' ? (
                'You already answered today - next question drops tomorrow.'
              ) : picked === BONUS_QUESTION.correct ? (
                    <>
                      <Coins className="w-5 h-5 text-[#E36B11]" />
                      Correct! +{BONUS_REWARD.toFixed(2)} BOGX
                      {bonusRewarded && <span className="text-xs font-normal text-green-600 ml-1">credited</span>}
                    </>
                  ) : (
                    'Close, but no. It was 1989.'
                  )}
                </div>
                <p className="text-[13px] text-gray-700 leading-relaxed">{BONUS_QUESTION.explanation}</p>
                <div className="flex flex-wrap items-center gap-3">
                  {isLoggedIn ? (
                    onShowBogxers && (
                      <button
                        onClick={onShowBogxers}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-display text-lg tracking-wider shadow-md transition-transform active:scale-[0.99]"
                        style={{ background: GOLD_GRADIENT }}
                      >
                        You&rsquo;re one of us - see the board
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )
                  ) : (
                    onShowSignup && (
                      <>
                        <button
                          onClick={onShowSignup}
                          className="inline-flex items-center gap-2 text-[#E36B11] font-display text-lg tracking-wider transition-opacity hover:opacity-70"
                        >
                          <Bot className="w-5 h-5" />
                          Keep my coin - kick a bot
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </>
                    )
                  )}
                </div>
              </div>
            )}
      </SectionCard>

      {/* ── HUMANS VS BOTS ───────────────────────────────────────── */}
      <SectionCard icon={Bot} title="Honest moment: me and a bunch of bots">
        <p className="text-[13px] text-gray-700 leading-relaxed">
          The Ranking needed players, so I hired a bunch of bots. They play like
          normal people &mdash; flagged, so you always know who&rsquo;s real. No Adidas
          budget behind this page, so a fake crowd beats an empty room. Every real
          GenXer who joins fires one of them for good. And no worries &mdash; they&rsquo;re
          dumb and easy to overtake. Help me lay them all off.
        </p>
        <div className="grid md:grid-cols-[auto_1fr] gap-6 items-start mt-6">
          <div className="flex flex-col gap-5 md:pr-6 md:border-r md:border-[#E36B11]/20 md:self-start">
            <div ref={countsElRef} className="flex gap-8 items-center">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#E36B11]/80 block mb-1">
                HUMANS
              </span>
              <span
                className="font-display text-6xl md:text-7xl leading-[0.85] block tabular-nums bg-clip-text text-transparent"
                style={{ backgroundImage: GOLD_GRADIENT_TEXT }}
              >
                {humansShown}
              </span>
            </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-400 block mb-1">
                  BOTS LEFT
                </span>
                <span className="font-display text-6xl md:text-7xl leading-[0.85] block tabular-nums text-[#B9AEA3]">
                  {botsShown}
                </span>
              </div>
            </div>
            {(isLoggedIn ? onShowBogxers : onShowSignup) && (
              <button
                onClick={isLoggedIn ? onShowBogxers : onShowSignup}
                className="hidden md:inline-flex items-center gap-2 text-[#E36B11] font-display text-lg tracking-wider transition-opacity hover:opacity-70"
              >
                <Bot className="w-5 h-5" />
                Join and kick a bot
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="space-y-3 w-full">
            <div className="grid grid-cols-10 md:grid-cols-12 gap-2">
              {Array.from({ length: 60 }, (_, i) => {
                const user = gridUsers[i];
                const isHuman = user && !user.isBot;
                const isBot = user && user.isBot;
                const isNextSeat = i === gridUsers.filter(u => !u.isBot).length && !isLoggedIn;

                // Next open seat - pulsing/sonar effect
                if (isNextSeat) {
                  return (
                    <button
                      key={i}
                      onClick={onShowSignup}
                      className="aspect-square rounded-full border-2 border-dashed border-[#E36B11] flex items-center justify-center relative cursor-pointer hover:scale-110 transition-transform"
                      title="This could be you!"
                    >
                      <span className="absolute inset-0 rounded-full border-2 border-[#E36B11] animate-ping opacity-30" />
                      <Plus className="w-3 h-3 text-[#E36B11]" />
                    </button>
                  );
                }

                // Human user with avatar and hover card
                if (isHuman) {
                  return (
                    <div
                      key={i}
                      className="aspect-square relative group cursor-pointer hover:z-20"
                    >
                      {/* Avatar circle */}
                      <div
                        className="w-full h-full rounded-full overflow-hidden transition-transform group-hover:scale-110"
                        style={{ background: GOLD_GRADIENT }}
                      >
                        {user.avatar && (
                          <img
                            src={user.avatar}
                            alt={user.username}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                      </div>
                      {/* Hover card - shows below to avoid clipping */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-30 scale-95 group-hover:scale-100">
                        {/* Arrow pointing up */}
                        <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-white border-l border-t border-[#E36B11]/20 rotate-45" />
                        <div className="bg-white rounded-xl shadow-xl border border-[#E36B11]/20 p-3 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0" style={{ background: GOLD_GRADIENT }}>
                              {user.avatar && (
                                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-display text-sm text-gray-900 truncate flex items-center gap-1.5">
                                {user.username}
                                {user.countryFlag && <CountryFlag flag={user.countryFlag} className="w-4 h-3 rounded-[2px] flex-shrink-0" />}
                              </div>
                              {user.country && (
                                <div className="text-[10px] text-gray-600 truncate">{user.country}</div>
                              )}
                            </div>
                          </div>
                          {user.joinedAt && (
                            <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-600">
                              Joined {new Date(user.joinedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Bot slot with hover card
                if (isBot) {
                  return (
                    <div
                      key={i}
                      className="aspect-square rounded-md bg-[#ECE6DF] relative group cursor-pointer hover:scale-110 hover:z-20 transition-transform flex items-center justify-center"
                    >
                      <Bot className="w-2.5 h-2.5 text-[#C9BBA9]" />
                      {/* Hover card - shows below */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-30 scale-95 group-hover:scale-100">
                        {/* Arrow pointing up */}
                        <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-gray-800 rotate-45" />
                        <div className="bg-gray-800 rounded-xl shadow-xl p-3 min-w-[130px]">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-md bg-gray-700 flex items-center justify-center flex-shrink-0">
                              <Bot className="w-4 h-4 text-gray-400" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-display text-sm text-white truncate flex items-center gap-1.5">
                                {user.username}
                                {user.countryFlag && <CountryFlag flag={user.countryFlag} className="w-4 h-3 rounded-[2px] flex-shrink-0" />}
                              </div>
                              <div className="text-[10px] text-gray-400">AI Placeholder</div>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-gray-700 text-[10px] text-center text-[#E36B11]">
                            Waiting to be kicked!
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Empty slot (shouldn't happen normally)
                return (
                  <div
                    key={i}
                    className="aspect-square rounded-md bg-[#ECE6DF]/50"
                  />
                );
              })}
            </div>
            {bots > 50 && (
              <div className="text-xs text-[#E36B11]">
                +{bots - Math.min(50, gridUsers.filter(u => u.isBot).length)} more bots to kick
              </div>
            )}
          </div>
        </div>
        {/* Mobile-only: the button belongs under the grid there; on desktop it
            lives in the numbers column instead. */}
        {(isLoggedIn ? onShowBogxers : onShowSignup) && (
          <button
            onClick={isLoggedIn ? onShowBogxers : onShowSignup}
            className="md:hidden mt-5 inline-flex items-center gap-2 text-[#E36B11] font-display text-lg tracking-wider transition-opacity hover:opacity-70"
          >
            <Bot className="w-5 h-5" />
            Join and kick a bot
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </SectionCard>

      {/* ── TAKE OVER THE WORLD ──────────────────────────────────── */}
      <SectionCard icon={Users} title="Help me take over the world">
        <p className="text-[13px] text-gray-700 leading-relaxed">
          <span className="font-display text-base tracking-wider text-[#E36B11]">STEP 1:</span>{' '}
          more of us.{' '}
          <span className="font-display text-base tracking-wider text-[#E36B11]">STEP 2:</span>{' '}
          servers and coffee.{' '}
          <span className="font-display text-base tracking-wider text-[#E36B11]">STEP 3:</span>{' '}
          world domination.
          Here&rsquo;s how you can help.
        </p>

        <div className="grid sm:grid-cols-3 gap-3.5 mt-5">
          <div className="group relative overflow-hidden border border-[#E36B11]/15 rounded-xl p-4 bg-white/50 flex flex-col items-start gap-1 transition-all duration-200 hover:border-[#E36B11]/40 hover:bg-white hover:shadow-md hover:-translate-y-0.5">
            <Gamepad2 className="absolute -right-4 -bottom-4 w-24 h-24 text-[#E36B11] opacity-[0.07] pointer-events-none transition-opacity duration-200 group-hover:opacity-[0.14]" />
            <div className="font-display text-base tracking-wide text-gray-900">Play &amp; climb the board</div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Trivia, battles, votes in the Rankroll — every coin you earn pushes
              a real GenXer up the leaderboard.
            </p>
            <button
              onClick={onShowBogxers}
              className="text-xs text-[#E36B11] font-semibold hover:underline mt-1 inline-flex items-center gap-1"
            >
              Show me the BOGXers <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="group relative overflow-hidden border border-[#E36B11]/15 rounded-xl p-4 bg-white/50 flex flex-col items-start gap-1 transition-all duration-200 hover:border-[#E36B11]/40 hover:bg-white hover:shadow-md hover:-translate-y-0.5">
            <UserPlus className="absolute -right-4 -bottom-4 w-24 h-24 text-[#E36B11] opacity-[0.07] pointer-events-none transition-opacity duration-200 group-hover:opacity-[0.14]" />
            <div className="font-display text-base tracking-wide text-gray-900">Bring one friend</div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Send your oldest friend a birthday story, or challenge them to a quiz battle.
            </p>
            <button
              onClick={() => scrollTo(finalRef)}
              className="text-xs text-[#E36B11] font-semibold hover:underline mt-1 inline-flex items-center gap-1"
            >
              Invite a friend <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="group relative overflow-hidden border border-[#E36B11]/15 rounded-xl p-4 bg-white/50 flex flex-col items-start gap-1 transition-all duration-200 hover:border-[#E36B11]/40 hover:bg-white hover:shadow-md hover:-translate-y-0.5">
            <Mail className="absolute -right-4 -bottom-4 w-24 h-24 text-[#E36B11] opacity-[0.07] pointer-events-none transition-opacity duration-200 group-hover:opacity-[0.14]" />
            <div className="font-display text-base tracking-wide text-gray-900">Have a say</div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Who am I missing? Tell me who shaped your youth. I read every message.
            </p>
            <a
              href="mailto:contact@bestofgenx.com"
              className="text-xs text-[#E36B11] font-semibold hover:underline mt-1 inline-flex items-center gap-1"
            >
              Write to me <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* War chest */}
        <div className="border-t border-[#E36B11]/20 mt-6 pt-5 space-y-4">
          <div className="font-display text-lg tracking-wide text-gray-900 flex items-center gap-1.5">
            <Euro className="w-5 h-5 text-[#E36B11]" />
            Or fill the war chest
          </div>
          <p className="text-[13px] text-gray-700 leading-relaxed">
            If you like what&rsquo;s happening here, throw a few bucks in. No paywall, no perks,
            just my eternal gratitude.
          </p>

          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-400 block mb-2">
              1 · Amount
            </span>
            <div className="flex items-center justify-between gap-1.5 p-1.5 rounded-xl border-[1.5px] border-[#E6DED5] bg-white">
              <button
                onClick={() => setTip((t) => Math.max(1, t - 1))}
                aria-label="One euro less"
                className="w-12 h-12 rounded-lg bg-[#FDF3E8] text-[#E36B11] flex items-center justify-center hover:bg-[#FBE6CF] transition-colors"
              >
                <Minus className="w-5 h-5" />
              </button>
              <div className="flex-1 text-center font-display text-4xl leading-none text-[#E36B11] tabular-nums">
                €{tip}
              </div>
              <button
                onClick={() => setTip((t) => t + 1)}
                aria-label="One euro more"
                className="w-12 h-12 rounded-lg bg-[#FDF3E8] text-[#E36B11] flex items-center justify-center hover:bg-[#FBE6CF] transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-400 block mb-2">
              2 · Pay with
            </span>
            <div className="grid gap-2.5 md:grid-cols-3">
              {paypalHref ? (
                <a
                  href={paypalHref}
                  target="_blank"
                  rel="noopener"
                  className="flex items-center justify-center gap-2.5 min-h-[56px] px-4 rounded-xl border-[1.5px] border-[#E6DED5] bg-white text-gray-700 font-bold text-sm hover:border-[#E36B11]/40 transition-colors"
                >
                  <CreditCard className="w-5 h-5 text-gray-400" />
                  PayPal
                </a>
              ) : (
                <span className="flex items-center justify-center gap-2.5 min-h-[56px] px-4 rounded-xl border-[1.5px] border-[#E6DED5] bg-white text-gray-400 font-bold text-sm cursor-default">
                  <CreditCard className="w-5 h-5" />
                  PayPal - coming soon
                </span>
              )}
              {CARD_CHECKOUT_URL ? (
                <a
                  href={CARD_CHECKOUT_URL}
                  target="_blank"
                  rel="noopener"
                  className="flex items-center justify-center gap-2.5 min-h-[56px] px-4 rounded-xl border-[1.5px] border-[#E6DED5] bg-white text-gray-700 font-bold text-sm hover:border-[#E36B11]/40 transition-colors"
                >
                  <CreditCard className="w-5 h-5 text-gray-400" />
                  Credit card
                </a>
              ) : (
                <span
                  className="flex items-center justify-center gap-2.5 min-h-[56px] px-4 rounded-xl border-[1.5px] border-[#E6DED5] bg-white text-gray-400 font-bold text-sm cursor-default"
                >
                  <CreditCard className="w-5 h-5" />
                  Credit card - coming soon
                </span>
              )}
              <button
                onClick={() => setShowBank((v) => !v)}
                className="flex items-center justify-center gap-2.5 min-h-[56px] px-4 rounded-xl border-[1.5px] border-[#E6DED5] bg-white text-gray-700 font-bold text-sm hover:border-[#E36B11]/40 transition-colors"
              >
                <Landmark className="w-5 h-5 text-gray-400" />
                Bank transfer
              </button>
            </div>

            {showBank && (
              <div className="mt-3 rounded-xl bg-[#FAF6F1] border border-[#ECE7E1] px-5 py-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-sm">
                {BANK_RECIPIENT && BANK_IBAN ? (
                  <>
                    <span className="text-gray-600">Recipient</span>
                    <span className="font-bold">{BANK_RECIPIENT}</span>
                    <span className="text-gray-600">IBAN</span>
                    <span className="font-bold">{BANK_IBAN}</span>
                    <span className="text-gray-600">Reference</span>
                    <span className="font-bold">BogX war chest</span>
                    <span className="text-gray-600">Amount</span>
                    <span className="font-bold">€{tip}</span>
                  </>
                ) : (
                  <>
                    <span className="text-gray-600">Bank details</span>
                    <span className="font-bold">
                      On request - <a href="mailto:contact@bestofgenx.com" className="text-[#E36B11] underline">write to me</a>
                    </span>
                    <span className="text-gray-600">Reference</span>
                    <span className="font-bold">BogX war chest</span>
                    <span className="text-gray-600">Amount</span>
                    <span className="font-bold">€{tip}</span>
                  </>
                )}
              </div>
            )}

            <div className="flex items-start gap-2 mt-3 text-xs text-gray-600">
              <Lock className="w-4 h-4 flex-shrink-0 mt-px" />
              <span>Secure payment. Your €{tip} is filled in for you.</span>
            </div>
          </div>

          <div className="border-t border-[#E36B11]/20 pt-5 flex flex-wrap gap-9">
            <div ref={warChestElRef}>
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#E36B11]/80 block mb-1">
                IN THE WAR CHEST
              </span>
              <span
                className={`font-display text-5xl md:text-6xl leading-[0.85] block tabular-nums transition-colors duration-500 ${
                  warChest < 0 ? 'text-[#B3261E]' : 'text-[#2F7D4F]'
                }`}
              >
                {warChest < 0 ? `-€${Math.abs(warChest)}` : `€${warChest}`}
              </span>
              <span className="text-[10px] text-gray-600 italic">
                {warChest < 0 ? 'hobby costs: servers, APIs, coffee' : ''}
              </span>
            </div>
            <BigFigure kicker="SUPPORTERS">{SUPPORTERS}</BigFigure>
          </div>
        </div>
      </SectionCard>

      {/* ── TEAM ─────────────────────────────────────────────────── */}
      <SectionCard icon={Users} title="Me and my first Bogxer">
        <p className="text-[13px] text-gray-700 leading-relaxed mb-5">
          Not completely alone anymore — Noodles joined and already writes. The empty seat is
          for you.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Eastercorn - opens the letter */}
          <button
            onClick={() => setLetterOpen(true)}
            className="border-2 border-[#E36B11] rounded-xl p-4 bg-white/50 flex flex-col items-start gap-1.5 text-left hover:bg-white/80 transition-colors"
          >
            <span
              className="w-[52px] h-[52px] rounded-full block"
              style={{ background: GOLD_GRADIENT }}
            />
            <span className="font-display text-base tracking-wide text-gray-900 flex items-center gap-1.5">
              Eastercorn · Germany
              <CountryFlag flag="DE" className="w-4 h-3 rounded-[2px] flex-shrink-0" />
            </span>
            <span className="text-[10px] font-bold tracking-[0.15em] text-[#E36B11]">
              FOUNDER · HUMAN (PROBABLY)
            </span>
            <span className="text-xs text-gray-600 leading-relaxed">
              The one in the unicorn mask. Face reveal coming when enough of you are here.
            </span>
            <span className="text-xs text-[#E36B11] font-semibold inline-flex items-center gap-1">
              Read my story <ArrowRight className="w-3 h-3" />
            </span>
          </button>

          {/* Noodles - first real author, pulled live from the user stats */}
          <button
            onClick={() => setNoodlesOpen(true)}
            className="border border-[#E36B11]/15 rounded-xl p-4 bg-white/50 flex flex-col items-start gap-1.5 text-left hover:bg-white/80 hover:border-[#E36B11]/40 transition-colors"
          >
            <div className="w-[52px] h-[52px] rounded-full overflow-hidden bg-[#FBE6CF] flex-shrink-0 flex items-center justify-center">
              {noodles?.avatar ? (
                <img
                  src={noodles.avatar}
                  alt="Noodles"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <span className="font-display text-xl text-[#E36B11]">N</span>
              )}
            </div>
            <div className="font-display text-base tracking-wide text-gray-900 flex items-center gap-1.5">
              Noodles{noodles?.country ? ` · ${noodles.country}` : ' · PH'}
              {noodles?.countryFlag && (
                <CountryFlag flag={noodles.countryFlag} className="w-4 h-3 rounded-[2px] flex-shrink-0" />
              )}
            </div>
            <div className="text-[10px] font-bold tracking-[0.15em] text-[#E36B11]">
              FIRST BOGXER · AUTHOR
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              The very first human to join — and already writing stories for the archive.
            </p>
            <span className="text-xs text-[#E36B11] font-semibold inline-flex items-center gap-1">
              Meet Noodles <ArrowRight className="w-3 h-3" />
            </span>
          </button>

          {/* The empty seat */}
          <button
            onClick={() => setWantedOpen(true)}
            className="border-2 border-dashed border-[#E2D8CD] rounded-xl p-4 bg-transparent flex flex-col items-start gap-1.5 text-left hover:border-[#E36B11]/50 transition-colors"
          >
            <span className="w-[52px] h-[52px] rounded-full border-2 border-dashed border-[#E36B11] flex items-center justify-center font-display text-2xl text-[#E36B11]">
              +
            </span>
            <span className="font-display text-base tracking-wide text-gray-900">You?</span>
            <span className="text-[10px] font-bold tracking-[0.15em] text-[#E36B11]">
              HUMAN WANTED
            </span>
            <span className="text-xs text-gray-600 leading-relaxed">
              Writers, quiz makers, people with stories. Get in touch.
            </span>
            <span className="text-xs text-[#E36B11] font-semibold inline-flex items-center gap-1">
              The honest pitch <ArrowRight className="w-3 h-3" />
            </span>
          </button>
        </div>
      </SectionCard>

      {/* ── BOGX AND AI ──────────────────────────────────────────── */}
      <SectionCard icon={Sparkles} title="BogX and AI">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="md:order-2 md:w-[40%] flex justify-center">
            <img
              src="/images/jude-law-ai.gif"
              alt="Jude Law AI"
              className="w-full md:max-w-[280px] h-40 sm:h-48 md:h-auto object-cover object-top md:object-center rounded-lg shadow-sm"
            />
          </div>

          <div className="hidden md:block w-px bg-[#E36B11]/30 self-stretch md:order-1" />

          <div className="md:w-[60%] space-y-4 md:order-0">
            <p className="text-[13px] text-gray-700 leading-relaxed">
              Let&rsquo;s be honest from the start: without AI this page wouldn&rsquo;t exist.
              Like every technology we&rsquo;ve seen come along, we absorb this one too.
            </p>
            <p className="text-[13px] text-gray-700 leading-relaxed">
              For me it&rsquo;s like break dance or beatboxing: I throw in some ideas, and my
              very own Jude Law throws out the
              rotten ones. So whatever you read here, there&rsquo;s a human soul behind it.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* ── FINAL CTA ────────────────────────────────────────────── */}
      <div
        ref={finalRef}
        className="relative overflow-hidden rounded-xl px-8 py-12 flex flex-col items-center gap-4 text-center scroll-mt-4"
        style={{ background: GOLD_GRADIENT }}
      >
        <div className="absolute inset-0" style={{ backgroundImage: PRINT_TEXTURE }} />
        <div className="relative font-display text-4xl md:text-6xl leading-[0.95] tracking-wide text-white">
          That&rsquo;s all for now. Let&rsquo;s make it us.
        </div>
        <p className="relative text-sm md:text-base text-[#FFF4E6] max-w-xl">
          Read today&rsquo;s birthdays, bring a friend, or just say hi. Every one of you makes
          this a little less of a one-man show.
        </p>
        <div className="relative flex flex-wrap justify-center gap-3">
          <button
            onClick={onShowBogxers}
            className="group inline-flex items-center gap-2 min-h-[52px] px-6 rounded-xl border-[1.5px] border-[#E6DED5] bg-white text-[#E36B11] font-display text-lg tracking-wider shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-[#E36B11] active:scale-[0.98]"
          >
            <Cake className="w-5 h-5 transition-transform group-hover:scale-110" />
            Today&rsquo;s birthdays
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          {onShowArcade && (
            <button
              onClick={onShowArcade}
              className="group inline-flex items-center gap-2 min-h-[52px] px-6 rounded-xl border-[1.5px] border-[#E6DED5] bg-white text-[#E36B11] font-display text-lg tracking-wider shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-[#E36B11] active:scale-[0.98]"
            >
              <Gamepad2 className="w-5 h-5 transition-transform group-hover:scale-110" />
              Play trivia
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
          {onShowRankroll && (
            <button
              onClick={onShowRankroll}
              className="group inline-flex items-center gap-2 min-h-[52px] px-6 rounded-xl border-[1.5px] border-[#E6DED5] bg-white text-[#E36B11] font-display text-lg tracking-wider shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-[#E36B11] active:scale-[0.98]"
            >
              <Vote className="w-5 h-5 transition-transform group-hover:scale-110" />
              Vote the Rankroll
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── EASTERCORN LETTER - Slide-in Panel ────────────────────── */}
      <StoryPanel open={letterOpen} onClose={() => setLetterOpen(false)} title={<>Hi, I&rsquo;m Eastercorn</>}>
              <div className="prose-body space-y-4">
                {/* Intro text */}
                <p>
                  There&rsquo;s no company behind BogX. No investors. No marketing team. No
                  office. Just me, a laptop, four AI sidekicks, and a unicorn mask.
                </p>
                <p>
                  <em>
                    What the hell is an Eastercorn, and why the ridiculous mask?
                  </em>{' '}
                  Fair questions. For now, this isn&rsquo;t about my face — it&rsquo;s about us.
                  When enough of you maniacs have joined, the mask comes off. Promise.
                  Until then, call me Eastercorn.
                </p>

                {/* Portrait carousel - full width on mobile */}
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#EFE7DB]">
                  <img
                    key={letterImgIdx}
                    src={EASTERCORN_IMAGES[letterImgIdx]}
                    alt="Eastercorn"
                    className="w-full h-full object-cover animate-[fadeIn_0.4s_ease-out]"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  {/* Arrows */}
                  <button
                    onClick={() => setLetterImgIdx((i) => (i - 1 + EASTERCORN_IMAGES.length) % EASTERCORN_IMAGES.length)}
                    aria-label="Previous photo"
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setLetterImgIdx((i) => (i + 1) % EASTERCORN_IMAGES.length)}
                    aria-label="Next photo"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  {/* Dots */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {EASTERCORN_IMAGES.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setLetterImgIdx(i)}
                        aria-label={`Photo ${i + 1}`}
                        className={`h-2 rounded-full transition-all ${
                          i === letterImgIdx ? 'w-5 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Rest of the text */}
                <p>
                  <em>And what the hell is an Eastercorn anyway?</em>{' '}
                  Well, it&rsquo;s a name I made
                  up. &ldquo;Easter&rdquo; stands for where I&rsquo;m from — East Germany.
                  &ldquo;Corn&rdquo; comes from the unicorn company where I spent 20 years,
                  right up until they decided they could do just fine without me. Fair
                  enough. Shit happens. Sometimes it even gives you better ideas.
                </p>
                <p>So here we are.</p>
                <p>
                  I started BogX because our generation is fading quietly into the
                  background. Fuck that.
                </p>
                <p>
                  We taped songs off the radio and got pissed when the DJ talked over the
                  intro. We waited a week to find out whether our holiday photos were
                  complete garbage. We disappeared on our bikes for an entire day and
                  somehow made it home. We survived dial-up, questionable haircuts,
                  mixtapes, MTV, arcades, video stores, and parents who had absolutely no
                  idea where we were half the time.
                </p>
                <p>Then we helped drag the world into the internet age.</p>
                <p>That deserves a place of its own.</p>
                <p>
                  I can&rsquo;t build it alone, though. So here&rsquo;s the deal: you read.
                  You argue. You vote. You tell me when something sucks. You tell me what I
                  should build next. And if you like this strange little corner of the
                  internet, bring your friends.
                </p>
                <p>We&rsquo;ll figure out the rest as we go.</p>
                <p>Very Gen X, actually.</p>
                <div
                  className="font-display text-3xl tracking-wide bg-clip-text text-transparent -rotate-2 origin-left pt-2"
                  style={{ backgroundImage: GOLD_GRADIENT_TEXT }}
                >
                  - Eastercorn
                </div>
                <a
                  href="mailto:contact@bestofgenx.com"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-[1.5px] border-[#E6DED5] bg-white text-[#E36B11] font-display text-base tracking-wider w-fit"
                >
                  <Mail className="w-4 h-4" />
                  Write to me
                </a>
              </div>
      </StoryPanel>

      {/* ── NOODLES INTRO - Slide-in Panel ────────────────────────── */}
      <StoryPanel open={noodlesOpen} onClose={() => setNoodlesOpen(false)} title={<>Hi, I&rsquo;m Noodles</>}>
            <div className="flex flex-col gap-4">
              {/* Portrait */}
              <div className="w-32 aspect-[4/5] rounded-xl overflow-hidden bg-[#EFE7DB] flex items-center justify-center float-left mr-4 mb-2">
                {noodles?.avatar ? (
                  <img
                    src={noodles.avatar}
                    alt="Noodles"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <span className="font-display text-6xl text-[#E36B11]/60">N</span>
                )}
              </div>
              
              <div className="prose-body space-y-4">
                <p>
                  Every community starts with one person who shows up first. For BogX, that was
                  Noodles. She arrived before the confetti, before there was anything to win,
                  before anyone else believed this could be a place.
                </p>
                <p>
                  From the Philippines she writes about the things we grew up with — the music,
                  the movies, the moments we all shared without ever meeting. She doesn&rsquo;t
                  wear a mask. She doesn&rsquo;t need one.
                </p>
                <p>
                  The four AI sidekicks dig through the archives. Noodles digs through memory.
                  And that&rsquo;s the difference that makes this place human.
                </p>
                <p>
                  She was the first. The seat next to her is still warm. Maybe it&rsquo;s yours.
                </p>
                <div
                  className="font-display text-3xl tracking-wide bg-clip-text text-transparent -rotate-2 origin-left"
                  style={{ backgroundImage: GOLD_GRADIENT_TEXT }}
                >
                  - Noodles
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <span className="text-xs text-gray-600 flex items-center gap-1.5">
                    Noodles · {noodles?.country || 'Philippines'}
                    {noodles?.countryFlag && (
                      <CountryFlag flag={noodles.countryFlag} className="w-4 h-3 rounded-[2px]" />
                    )}
                  </span>
                  {noodles?.joinedAt && (
                    <span className="text-xs text-gray-600">
                      Joined {new Date(noodles.joinedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                    </span>
                  )}
                  <a
                    href="mailto:contact@bestofgenx.com"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-[1.5px] border-[#E6DED5] bg-white text-[#E36B11] font-display text-base tracking-wider w-fit mt-2"
                  >
                    <Mail className="w-4 h-4" />
                    Write to me
                  </a>
                </div>
              </div>
            </div>
      </StoryPanel>

      {/* ── HUMAN WANTED INTRO ───────────────────────────────────── */}
      {wantedOpen && (
        <ModalPortal>
        <div
          className="fixed inset-0 z-50 bg-[#5A4637]/45 flex items-center justify-center p-4"
          onClick={() => setWantedOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Human wanted"
            className="bg-[#F5EDE4] border border-[#E36B11]/20 rounded-xl overflow-hidden w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative overflow-hidden px-5 py-3 flex items-center" style={{ background: GOLD_GRADIENT }}>
              <div className="absolute inset-0" style={{ backgroundImage: PRINT_TEXTURE }} />
              <h3 className="relative font-display text-xl md:text-2xl tracking-wide text-white leading-none">
                Human wanted. Seriously.
              </h3>
              <button
                onClick={() => setWantedOpen(false)}
                aria-label="Close"
                className="relative ml-auto w-11 h-11 rounded-full bg-white/25 text-white flex items-center justify-center hover:bg-white/35 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid md:grid-cols-[220px_1fr] gap-7 items-start">
              <div className="flex flex-col gap-2.5">
                <div className="aspect-[4/5] rounded-xl border-2 border-dashed border-[#E36B11]/50 bg-[#EFE7DB] flex items-center justify-center">
                  <span className="font-display text-7xl text-[#E36B11]/50">?</span>
                </div>
                <span className="text-xs text-gray-600">You? · Wherever you are</span>
                <a
                  href="mailto:contact@bestofgenx.com"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-[1.5px] border-[#E6DED5] bg-white text-[#E36B11] font-display text-base tracking-wider w-full"
                >
                  <Mail className="w-4 h-4" />
                  Write to me
                </a>
              </div>
              <div className="flex flex-col gap-3.5 min-w-0">
                <p className="text-[13px] text-gray-700 leading-relaxed">
                  BogX needs humans. Writers, quiz makers, people who remember things the
                  archives forgot. People with stories.
                </p>
                <p className="text-[13px] text-gray-700 leading-relaxed">
                  Here&rsquo;s the honest part: there is no money. No salary, no budget, no
                  fancy office in Palo Alto. Just a laptop, a unicorn mask and a dream.
                </p>
                <p className="text-[13px] text-gray-700 leading-relaxed">
                  But if this thing ever takes off — if we ever get Zuckerberg-rich —
                  everyone who was here at the start gets rich too. That&rsquo;s the deal.
                  Written in stone. Well, in pixels.
                </p>
                <p className="text-[13px] text-gray-700 leading-relaxed">
                  Until then: glory, coins, and the knowledge that you were here before
                  it was cool. Interested? Write me.
                </p>
                <div
                  className="font-display text-3xl tracking-wide bg-clip-text text-transparent -rotate-2 origin-left"
                  style={{ backgroundImage: GOLD_GRADIENT_TEXT }}
                >
                  - Eastercorn
                </div>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
