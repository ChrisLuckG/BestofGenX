"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, Volume2, VolumeX, Pause, Play, Heart, Trophy, Zap, Crosshair, Coins, Clock } from "lucide-react";
import BackButton from "@/components/BackButton";
import CountryFlag from "@/components/CountryFlag";

interface BogxInvadersGameProps {
  onBack: () => void;
  onCoinsChange?: (amount: number) => void;
  isLoggedIn?: boolean;
  userId?: string;
  onShowLogin?: () => void;
}

// Game constants
const TOKEN_PER_KILL = 0.01;
const TOKEN_BOSS_KILL = 0.05;
const COMBO_WINDOW = 75;
const WAVE_TIME = 30; // seconds per wave

// Player combo lines
const PLAYER_COMBO_LINES = [
  'COMBO!', 'RADICAL!', 'TUBULAR!', 'GNARLY!', 'BOOM!',
  'NAILED IT!', 'ON FIRE!', 'UNSTOPPABLE!', 'LEGENDARY!'
];

// Leaderboard row type
type LeaderboardRow = { userId: string; username: string; avatar: string; countryFlag?: string; score: number; rank: number };

// TEMP DUMMY DATA (design preview) - keeps the ranking table full so the
// layout never collapses. Real scores are merged on top. Remove for production.
const DUMMY_NAMES = ['NeonRider', 'PixelQueen', 'MaxTurbo', 'StarFox88', 'RetroKid', 'ComboKing', 'ZapMaster', 'LaserLisa', 'VoidWalker', 'BitCrusher'];
const DUMMY_FLAGS = ['🇺🇸', '🇩🇪', '🇬🇧', '🇫🇷', '🇯🇵', '🇧🇷', '🇨🇦', '🇮🇹', '🇪🇸', '🇳🇱'];

// Build a full 10-row leaderboard: real entries first, dummies fill the rest.
function buildLeaderboard(real: LeaderboardRow[] = []): LeaderboardRow[] {
  const lastScore = real.length > 0 ? real[real.length - 1].score : 100;
  const padded: LeaderboardRow[] = [...real];
  for (let i = real.length; i < 10; i++) {
    padded.push({
      userId: `dummy-${i}`,
      username: DUMMY_NAMES[i % DUMMY_NAMES.length],
      avatar: '/images/default-avatar.png',
      countryFlag: DUMMY_FLAGS[i % DUMMY_FLAGS.length],
      score: Math.max(1, lastScore - (i - real.length + 1) * 12 - Math.floor(Math.random() * 6)),
      rank: i + 1,
    });
  }
  return padded;
}

// Boss lines
const BOSS_LINES = [
  'BACK IN MY DAY...', 'KIDS THESE DAYS!', 'OK BOOMER YOURSELF!',
  'I WANT MY MTV!', 'BE KIND, REWIND!', "DON'T HAVE A COW!",
  'WHERE IS THE REMOTE?!', 'MY WALKMAN WORKS!'
];

export default function BogxInvadersGame({ 
  onBack, 
  onCoinsChange, 
  isLoggedIn = false, 
  userId,
  onShowLogin 
}: BogxInvadersGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const shipImgRef = useRef<HTMLImageElement | null>(null);
  
  const [gameState, setGameState] = useState<'start' | 'intro' | 'playing' | 'paused' | 'gameover'>('start');
  const [score, setScore] = useState(0);
  const [tokens, setTokens] = useState(0);
  const [lives, setLives] = useState(3);
  const [wave, setWave] = useState(1);
  const [timeLeft, setTimeLeft] = useState(WAVE_TIME);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [highScore, setHighScore] = useState(0);
  const [canvasSize, setCanvasSize] = useState({ width: 480, height: 560 });
  const [flyingCoins, setFlyingCoins] = useState<{id: number; x: number; y: number; amount: number}[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>(() => buildLeaderboard([]));
  const coinIdRef = useRef(0);
  // True when the next 'playing' transition is a resume from pause (keep state)
  const resumeRef = useRef(false);
  // True while the cursor has left the play area (shows a red "come back" alert)
  const [outOfBounds, setOutOfBounds] = useState(false);
  
  // Audio context for sound effects
  const audioCtxRef = useRef<AudioContext | null>(null);
  
  // Refs for callbacks to avoid dependency issues
  const onCoinsChangeRef = useRef(onCoinsChange);
  const isLoggedInRef = useRef(isLoggedIn);
  const userIdRef = useRef(userId);
  const soundEnabledRef = useRef(soundEnabled);
  const highScoreRef = useRef(highScore);
  
  // Load ship image
  useEffect(() => {
    const img = new Image();
    img.onload = () => { shipImgRef.current = img; };
    img.onerror = () => { console.error('Failed to load xspace.png ship image'); };
    img.src = '/images/xspace.png';
  }, []);

  // Keep refs updated
  useEffect(() => { onCoinsChangeRef.current = onCoinsChange; }, [onCoinsChange]);
  useEffect(() => { isLoggedInRef.current = isLoggedIn; }, [isLoggedIn]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { highScoreRef.current = highScore; }, [highScore]);
  
  // Load high score
  useEffect(() => {
    if (isLoggedIn && userId) {
      fetch(`/api/arcade/score?userId=${userId}&game=bogx-invaders`)
        .then(r => r.json())
        .then(data => {
          if (data.highScore) setHighScore(data.highScore);
        })
        .catch(() => {});
    } else {
      const saved = localStorage.getItem('bogx-invaders-highscore');
      if (saved) setHighScore(parseInt(saved));
    }
  }, [isLoggedIn, userId]);

  // Responsive canvas sizing - different for mobile vs desktop
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const isMobile = containerWidth < 640;
      
      if (isMobile) {
        // Mobile: use full container, taller aspect ratio
        const width = containerWidth;
        const height = Math.min(containerHeight, width * 1.2); // taller on mobile
        setCanvasSize({ width, height });
      } else {
        // Desktop: limit max width to 600px, constrain height
        const maxWidth = 600;
        const width = Math.min(containerWidth, maxWidth);
        const aspectRatio = 0.75; // slightly taller
        const height = Math.min(width * aspectRatio, containerHeight);
        setCanvasSize({ width, height });
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Initialize audio
  const ensureAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        audioCtxRef.current = null;
      }
    }
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, []);

  // Sound effects
  const playTone = useCallback((freq: number, duration: number, type: OscillatorType = 'square', gainVal = 0.08) => {
    if (!soundEnabledRef.current || !audioCtxRef.current) return;
    const osc = audioCtxRef.current.createOscillator();
    const gain = audioCtxRef.current.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = gainVal;
    osc.connect(gain);
    gain.connect(audioCtxRef.current.destination);
    const now = audioCtxRef.current.currentTime;
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
  }, []);

  const sfxFire = useCallback(() => playTone(880, 0.05, 'square', 0.04), []);
  const sfxKill = useCallback(() => { playTone(520, 0.09, 'square', 0.07); playTone(780, 0.09, 'square', 0.05); }, []);
  const sfxBossHit = useCallback(() => playTone(220, 0.08, 'sawtooth', 0.06), []);
  const sfxBossDown = useCallback(() => {
    [180, 140, 100, 70].forEach((f, i) => setTimeout(() => playTone(f, 0.25, 'sawtooth', 0.1), i * 60));
  }, []);
  const sfxHurt = useCallback(() => playTone(140, 0.18, 'sawtooth', 0.09), []);
  const sfxWave = useCallback(() => { playTone(660, 0.12, 'triangle', 0.06); playTone(990, 0.15, 'triangle', 0.05); }, []);
  const sfxCombo = useCallback(() => playTone(1100, 0.06, 'sine', 0.05), []);
  const sfxAlarm = useCallback(() => {
    playTone(800, 0.12, 'square', 0.08);
    setTimeout(() => playTone(600, 0.12, 'square', 0.08), 120);
    setTimeout(() => playTone(800, 0.12, 'square', 0.08), 240);
  }, []);

  // Spawn flying coin animation (outside canvas, flies to wallet)
  const spawnFlyingCoin = useCallback((canvasX: number, canvasY: number, amount: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    // Convert canvas coords to screen coords
    const screenX = rect.left + (canvasX / canvas.width) * rect.width;
    const screenY = rect.top + (canvasY / canvas.height) * rect.height;
    
    coinIdRef.current += 1;
    const newCoin = { id: coinIdRef.current, x: screenX, y: screenY, amount };
    setFlyingCoins(prev => [...prev, newCoin]);
    
    // Remove after animation
    setTimeout(() => {
      setFlyingCoins(prev => prev.filter(c => c.id !== newCoin.id));
    }, 800);
  }, []);

  // Award coins (real-time)
  const awardCoins = useCallback((amount: number) => {
    // Always update UI
    setTokens(prev => {
      const newTotal = prev + amount;
      return Math.round(newTotal * 100) / 100;
    });
    onCoinsChangeRef.current?.(amount);
    
    // Only track for logged in users - use awardBogx via API
    if (isLoggedInRef.current && userIdRef.current) {
      fetch('/api/arcade/award', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userIdRef.current,
          game: 'bogx-invaders',
          amount: amount,
          metadata: { type: 'kill' }
        })
      }).catch(() => {});
    }
  }, []);

  // Main game loop
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const isMobile = W < 640;
    // Mobile: scale based on width, Desktop: much smaller elements
    const scale = isMobile ? W / 480 : Math.min(W / 900, H / 650);

    // Reuse the existing game object when resuming from pause so play continues
    // exactly where it left off instead of rebuilding a fresh game.
    const resuming = resumeRef.current && !!gameRef.current;
    resumeRef.current = false;

    // Game state — fresh template (also used as the type source for `game`)
    const freshGame = {
      player: { x: W / 2 - 24 * scale, y: H - 50 * scale, w: 48 * scale, h: 24 * scale, speed: 5 * scale },
      bullets: [] as any[],
      enemyBullets: [] as any[],
      enemies: [] as any[],
      particles: [] as any[],
      floatingTexts: [] as any[],
      stars: [] as any[],
      enemyDir: 1,
      enemySpeed: 0.6 * scale,
      fireCooldown: 0,
      shake: 0,
      hitFlash: 0,
      levelFlash: 0,
      combo: 0,
      comboTimer: 0,
      waveText: null as any,
      bossSpeech: null as any,
      playerSpeech: null as any,
      mouseX: W / 2,
      currentWave: wave,
      currentScore: score,
      currentLives: lives,
      waveStartTime: performance.now(),
      lastShownTime: WAVE_TIME,
      dying: false,
      deathTimer: 0,
      deathReason: 'life' as 'time' | 'life',
      entering: false,
      // Marching formation origin; each enemy holds a slot offset (ox/oy) from it.
      formX: 0,
      formY: 0,
      // All non-boss slot offsets in the grid (used to repack toward the boss).
      slots: [] as { ox: number; oy: number }[],
    };

    // On resume, keep the exact paused state; otherwise use the fresh template.
    const game: typeof freshGame = resuming ? gameRef.current : freshGame;

    // Initialize stars (fresh game only)
    if (!resuming) {
      for (let i = 0; i < 100; i++) {
        game.stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          size: Math.random() * 2 + 0.5,
          speed: Math.random() * 0.5 + 0.2,
          brightness: Math.random()
        });
      }
    }

    // Build wave — slot-based formation. Each enemy stores a slot offset
    // (ox/oy) relative to the marching origin (formX/formY). Killing a wheel
    // frees its slot and survivors repack toward the boss (see packTowardBoss).
    const buildWave = (n: number) => {
      game.enemies = [];
      game.slots = [];
      const cols = 7, rows = Math.min(3 + Math.floor(n / 2), 6);
      const gapX = 46 * scale, gapY = 40 * scale;
      const startX = 40 * scale, startY = 50 * scale;
      const bossCol = Math.floor(cols / 2);

      game.formX = startX;
      game.formY = startY;
      game.enemyDir = 1;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const ox = c * gapX, oy = r * gapY;
          const isBoss = r === 0 && c === bossCol;
          if (!isBoss) game.slots.push({ ox, oy });
          game.enemies.push({
            ox, oy,
            // Current offset — starts above the screen for the fly-in, eases to ox/oy.
            cx: ox,
            cy: oy - H - r * 40 * scale,
            x: startX + ox,
            y: startY + (oy - H - r * 40 * scale),
            r: isBoss ? 24 * scale : 14 * scale,
            hp: isBoss ? 3 + n * 2 : 1,
            maxHp: isBoss ? 3 + n * 2 : 1,
            alive: true,
            wobble: Math.random() * Math.PI * 2,
            isBoss,
            shieldFlash: 0,
          });
        }
      }

      // Fly-in phase: enemies descend from above before combat begins.
      game.entering = true;
      
      game.bossSpeech = { 
        text: BOSS_LINES[Math.floor(Math.random() * BOSS_LINES.length)], 
        life: 1 
      };
      game.enemySpeed = (0.6 + n * 0.15) * scale;
      // Reset wave timer
      game.waveStartTime = performance.now();
      game.lastShownTime = WAVE_TIME;
      setTimeLeft(WAVE_TIME);
    };

    if (resuming) {
      // Continue the current wave's countdown from where it was paused.
      game.waveStartTime = performance.now() - (WAVE_TIME - game.lastShownTime) * 1000;
    } else {
      buildWave(game.currentWave);
      gameRef.current = game;
    }

    // Spawn particles
    const spawnBurst = (x: number, y: number, colors: string[], count: number, speedMin: number, speedMax: number) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = (speedMin + Math.random() * (speedMax - speedMin)) * scale;
        game.particles.push({
          x, y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          life: 1,
          decay: 0.03 + Math.random() * 0.03,
          size: (2 + Math.random() * 3) * scale,
          color: colors[Math.floor(Math.random() * colors.length)]
        });
      }
    };

    // Spawn floating text - flies up toward wallet
    const spawnFloatingText = (x: number, y: number, text: string, color: string) => {
      game.floatingTexts.push({ 
        x, 
        y, 
        text, 
        color, 
        life: 1.5,  // Longer life
        vy: -2.5 * scale,  // Faster upward
        vx: (W / 2 - x) * 0.008  // Slight drift toward center (wallet)
      });
    };

    // Register kill and combo
    const registerKill = () => {
      if (game.comboTimer > 0) {
        game.combo += 1;
      } else {
        game.combo = 1;
      }
      game.comboTimer = COMBO_WINDOW;
      
      if (game.combo > 1) {
        sfxCombo();
        game.playerSpeech = {
          text: PLAYER_COMBO_LINES[Math.floor(Math.random() * PLAYER_COMBO_LINES.length)],
          life: 1
        };
      }
      return game.combo;
    };

    // Fire bullet
    const fire = () => {
      if (game.fireCooldown > 0) return;
      game.bullets.push({ x: game.player.x + game.player.w / 2, y: game.player.y });
      spawnBurst(game.player.x + game.player.w / 2, game.player.y, ['#f5871f'], 4, 0.5, 1.5);
      sfxFire();
      game.fireCooldown = 10;
    };

    // Begin the death sequence: burst the ship, show a banner, THEN game over.
    // This gives the player a beat instead of the instant "GAME OVER" flip.
    const beginDeath = (reason: 'time' | 'life') => {
      if (game.dying) return;
      game.dying = true;
      game.deathTimer = 78; // ~1.3s at 60fps
      game.deathReason = reason;
      // Big ship explosion at the player position
      spawnBurst(
        game.player.x + game.player.w / 2,
        game.player.y + game.player.h / 2,
        ['#f5871f', '#8b5cf6', '#e5484d', '#f4efe4', '#760b79'],
        70, 2, 9
      );
      game.shake = 22;
      game.hitFlash = 1;
      sfxBossDown();
    };

    // Finalize (save high score + submit to leaderboard + show game over screen)
    const finalizeGameOver = () => {
      setGameState('gameover');

      // Save high score
      if (game.currentScore > highScoreRef.current) {
        setHighScore(game.currentScore);
        highScoreRef.current = game.currentScore;
        if (!isLoggedInRef.current || !userIdRef.current) {
          localStorage.setItem('bogx-invaders-highscore', game.currentScore.toString());
        }
      }
      // Always submit score to leaderboard for logged-in users (even if not a personal best)
      if (isLoggedInRef.current && userIdRef.current) {
        fetch('/api/arcade/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userIdRef.current,
            game: 'bogx-invaders',
            score: game.currentScore,
            wave: game.currentWave,
          })
        }).catch(() => {});
      }
    };

    // Lose life
    const loseLife = () => {
      game.currentLives -= 1;
      setLives(game.currentLives);
      game.hitFlash = 1;
      game.shake = 10;
      game.combo = 0;
      game.comboTimer = 0;
      sfxHurt();
      spawnBurst(game.player.x + game.player.w / 2, game.player.y + game.player.h / 2, ['#e5484d', '#f4efe4'], 18, 1.5, 5);
      
      if (game.currentLives <= 0) {
        beginDeath('life');
      }
    };

    // Main update loop
    const update = () => {
      if (gameState !== 'playing') return;

      // Death sequence: freeze the game, keep animating the ship explosion +
      // a banner, then flip to the real Game Over screen once the timer runs out.
      if (game.dying) {
        game.deathTimer -= 1;
        ctx.clearRect(0, 0, W, H);

        const dsx = game.shake > 0 ? (Math.random() - 0.5) * game.shake : 0;
        const dsy = game.shake > 0 ? (Math.random() - 0.5) * game.shake : 0;
        game.shake *= 0.85;
        if (game.shake < 0.3) game.shake = 0;

        ctx.save();
        ctx.translate(dsx, dsy);

        // Update + draw explosion particles
        game.particles.forEach(p => {
          p.x += p.vx; p.y += p.vy;
          p.vx *= 0.94; p.vy *= 0.94;
          p.life -= p.decay;
        });
        game.particles = game.particles.filter(p => p.life > 0);
        game.particles.forEach(p => {
          ctx.globalAlpha = Math.max(p.life, 0);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Banner
        ctx.textAlign = 'center';
        ctx.font = `900 ${30 * scale}px Arial`;
        ctx.fillStyle = '#e5484d';
        ctx.fillText(game.deathReason === 'time' ? 'TIME UP!' : 'SHIP DOWN!', W / 2, H / 2);
        ctx.restore();

        if (game.hitFlash > 0) {
          ctx.fillStyle = `rgba(229, 72, 77, ${game.hitFlash * 0.35})`;
          ctx.fillRect(0, 0, W, H);
          game.hitFlash -= 0.03;
        }

        if (game.deathTimer <= 0) {
          finalizeGameOver();
          return;
        }
        animFrameRef.current = requestAnimationFrame(update);
        return;
      }

      ctx.clearRect(0, 0, W, H);

      // Screen shake
      const sx = game.shake > 0 ? (Math.random() - 0.5) * game.shake : 0;
      const sy = game.shake > 0 ? (Math.random() - 0.5) * game.shake : 0;
      game.shake *= 0.85;
      if (game.shake < 0.3) game.shake = 0;
      
      ctx.save();
      ctx.translate(sx, sy);

      // Clear canvas (transparent - uses page background)
      ctx.clearRect(0, 0, W, H);
      
      // NOTE: Background stars & grid removed - the CSS starfield behind the
      // transparent canvas provides a seamless space background across the
      // whole area (sides + play field) so no rectangle is visible.

      // Wave timer - 30s per wave; running out ends the game immediately.
      // Frozen during the fly-in so the countdown only starts once enemies land.
      if (!game.entering) {
        const elapsed = (performance.now() - game.waveStartTime) / 1000;
        const remaining = Math.max(0, WAVE_TIME - elapsed);
        const remainingCeil = Math.ceil(remaining);
        if (remainingCeil !== game.lastShownTime) {
          game.lastShownTime = remainingCeil;
          setTimeLeft(remainingCeil);
        }
        if (remaining <= 0) {
          setTimeLeft(0);
          game.shake = 12;
          beginDeath('time');
          return;
        }
      }

      // Player movement (smooth follow mouse)
      const targetX = game.mouseX - game.player.w / 2;
      game.player.x += (targetX - game.player.x) * 0.15;
      game.player.x = Math.max(0, Math.min(W - game.player.w, game.player.x));

      // March the whole formation horizontally (only once the fly-in is done).
      if (!game.entering) {
        game.formX += game.enemySpeed * game.enemyDir;
      }

      // Ease every wheel toward its slot offset and update absolute position.
      // This single loop drives BOTH the fly-in (cy rises from off-screen) and
      // the "fill the gap toward the boss" repacking (cx/cy slide to new slot).
      let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
      let settled = true;
      game.enemies.forEach(e => {
        if (!e.alive) return;
        e.wobble += 0.05;
        e.cx += (e.ox - e.cx) * 0.15;
        e.cy += (e.oy - e.cy) * 0.15;
        if (Math.abs(e.oy - e.cy) > 1.5 || Math.abs(e.ox - e.cx) > 1.5) settled = false;
        e.x = game.formX + e.cx;
        e.y = game.formY + e.cy;
        minX = Math.min(minX, e.x);
        maxX = Math.max(maxX, e.x);
        maxY = Math.max(maxY, e.y);
      });

      // Fly-in completes once every wheel has reached its slot.
      if (game.entering && settled) {
        game.entering = false;
        // Start the 30s wave countdown only after the fly-in completes.
        game.waveStartTime = performance.now();
        game.lastShownTime = WAVE_TIME;
        setTimeLeft(WAVE_TIME);
      }

      // Edge bounce + step down (formation-wide, only while marching).
      if (!game.entering && (maxX > W - 20 * scale || minX < 20 * scale)) {
        game.enemyDir *= -1;
        game.formY += 16 * scale;
      }

      // Enemy fire
      if (!game.entering && Math.random() < 0.02 + game.currentWave * 0.002) {
        const alive = game.enemies.filter(e => e.alive);
        if (alive.length) {
          const shooter = alive[Math.floor(Math.random() * alive.length)];
          game.enemyBullets.push({ x: shooter.x, y: shooter.y + 10 * scale, speed: 4 * scale });
        }
      }

      // Update bullets
      game.bullets.forEach(b => b.y -= 8 * scale);
      game.bullets = game.bullets.filter(b => b.y > -10);
      game.enemyBullets.forEach(b => b.y += b.speed);
      game.enemyBullets = game.enemyBullets.filter(b => b.y < H + 10);

      // Collision: player bullets vs enemies
      game.bullets.forEach(b => {
        game.enemies.forEach(e => {
          if (e.alive && Math.abs(b.x - e.x) < e.r && Math.abs(b.y - e.y) < e.r) {
            b.y = -999;
            e.hp -= 1;

            if (e.hp > 0) {
              if (e.isBoss) {
                e.shieldFlash = 1;
                spawnBurst(e.x, e.y, ['#8b5cf6', '#f4efe4'], 8, 1, 2.5);
                sfxBossHit();
                if (Math.random() < 0.25) {
                  game.bossSpeech = {
                    text: BOSS_LINES[Math.floor(Math.random() * BOSS_LINES.length)],
                    life: 1
                  };
                }
              } else {
                spawnBurst(e.x, e.y, ['#f5871f', '#f4efe4'], 6, 1, 2.5);
                sfxBossHit();
              }
              game.shake = Math.max(game.shake, 2);
              return;
            }

            e.alive = false;
            const isBoss = e.isBoss;
            registerKill();
            
            // Simple reward: 0.01 per kill, 0.05 for boss - NO multipliers
            const tokenGain = isBoss ? TOKEN_BOSS_KILL : TOKEN_PER_KILL;
            
            // Score is fixed per kill - NO combo multiplier
            const scoreGain = isBoss ? 5 : 1;
            game.currentScore += scoreGain;
            setScore(game.currentScore);
            
            // Award coins in real-time!
            awardCoins(tokenGain);
            
            // Spawn flying coin that goes to wallet (outside canvas)
            spawnFlyingCoin(e.x, e.y, tokenGain);

            if (isBoss) {
              spawnBurst(e.x, e.y, ['#D4873A', '#8b5cf6', '#e5484d'], 34, 2, 6);
              spawnFloatingText(e.x, e.y - 16 * scale, `+${tokenGain.toFixed(2)} BOGX!`, '#16a34a');
              game.shake = Math.max(game.shake, 9);
              sfxBossDown();
            } else {
              spawnBurst(e.x, e.y, ['#D4873A', '#8b5cf6'], 14, 1, 4);
              spawnFloatingText(e.x, e.y - 10 * scale, `+${tokenGain.toFixed(2)}`, '#16a34a');
              game.shake = Math.max(game.shake, 4);
              sfxKill();
            }
          }
        });
      });

      // Collision: enemy bullets vs player
      game.enemyBullets.forEach(b => {
        if (b.y > game.player.y && b.y < game.player.y + game.player.h &&
            b.x > game.player.x && b.x < game.player.x + game.player.w) {
          b.y = H + 999;
          loseLife();
        }
      });

      // Enemies reaching bottom
      if (maxY > game.player.y - 20 * scale && game.enemies.some(e => e.alive)) {
        loseLife();
        buildWave(game.currentWave);
      }

      // Update particles
      game.particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.life -= p.decay;
      });
      game.particles = game.particles.filter(p => p.life > 0);

      // Update floating texts - fly toward wallet (top of screen)
      game.floatingTexts.forEach(t => {
        t.y += t.vy;
        t.x += t.vx || 0;
        t.vy *= 0.97;  // Slower deceleration = flies further
        t.life -= 0.012;  // Slower fade = visible longer
      });
      game.floatingTexts = game.floatingTexts.filter(t => t.life > 0 && t.y > -50);

      // Update effects
      if (game.hitFlash > 0) game.hitFlash -= 0.04;
      game.enemies.forEach(e => { if (e.shieldFlash > 0) e.shieldFlash -= 0.06; });

      // Draw enemies
      game.enemies.forEach(e => {
        if (!e.alive) return;
        
        ctx.save();
        ctx.translate(e.x, e.y);
        
        if (e.isBoss) {
          // Boss: Hamster in wheel with comb-over
          const runPhase = e.wobble * 3;
          const legSwing = Math.sin(runPhase);
          
          // Wheel
          ctx.strokeStyle = '#8b5cf6';
          ctx.lineWidth = 3 * scale;
          ctx.beginPath();
          ctx.arc(0, 0, e.r, 0, Math.PI * 2);
          ctx.stroke();
          
          for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3 + e.wobble;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * e.r * 0.15, Math.sin(a) * e.r * 0.15);
            ctx.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
            ctx.stroke();
          }
          
          // Body
          ctx.fillStyle = '#d9a066';
          ctx.beginPath();
          ctx.ellipse(0, e.r * 0.15, e.r * 0.5, e.r * 0.36, 0, 0, Math.PI * 2);
          ctx.fill();
          
          // Legs
          ctx.fillStyle = '#c98a4b';
          ctx.beginPath();
          ctx.ellipse(-e.r * 0.22, e.r * 0.42 + legSwing * 3, e.r * 0.14, e.r * 0.1, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(e.r * 0.22, e.r * 0.42 - legSwing * 3, e.r * 0.14, e.r * 0.1, 0, 0, Math.PI * 2);
          ctx.fill();
          
          // Head
          ctx.fillStyle = '#e8b98a';
          ctx.beginPath();
          ctx.arc(0, -e.r * 0.28, e.r * 0.4, 0, Math.PI * 2);
          ctx.fill();
          
          // Ears
          ctx.fillStyle = '#c98a4b';
          ctx.beginPath();
          ctx.arc(-e.r * 0.28, -e.r * 0.5, e.r * 0.13, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(e.r * 0.28, -e.r * 0.5, e.r * 0.13, 0, Math.PI * 2);
          ctx.fill();
          
          // Comb-over
          ctx.strokeStyle = '#c9c9c9';
          ctx.lineWidth = 2.5 * scale;
          ctx.lineCap = 'round';
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(-e.r * 0.32, -e.r * 0.55 + i * 2.5);
            ctx.quadraticCurveTo(0, -e.r * 0.72, e.r * 0.34, -e.r * 0.48 + i * 2.5);
            ctx.stroke();
          }
          
          // Sunglasses
          ctx.fillStyle = '#141118';
          ctx.fillRect(-e.r * 0.36, -e.r * 0.34, e.r * 0.3, e.r * 0.2);
          ctx.fillRect(e.r * 0.06, -e.r * 0.34, e.r * 0.3, e.r * 0.2);
          ctx.fillRect(-e.r * 0.06, -e.r * 0.28, e.r * 0.12, e.r * 0.05);
          
          // Tie
          ctx.fillStyle = '#e5484d';
          ctx.beginPath();
          ctx.moveTo(-e.r * 0.08, -e.r * 0.05);
          ctx.lineTo(e.r * 0.08, -e.r * 0.05);
          ctx.lineTo(0, e.r * 0.14);
          ctx.closePath();
          ctx.fill();
          
          // Health ring
          ctx.strokeStyle = 'rgba(244,239,228,0.25)';
          ctx.lineWidth = 4 * scale;
          ctx.beginPath();
          ctx.arc(0, 0, e.r + 8 * scale, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = '#f5871f';
          ctx.beginPath();
          ctx.arc(0, 0, e.r + 8 * scale, -Math.PI / 2, -Math.PI / 2 + (e.hp / e.maxHp) * Math.PI * 2);
          ctx.stroke();
          
          // Shield flash
          if (e.shieldFlash > 0) {
            const shieldR = e.r + 14 * scale + (1 - e.shieldFlash) * 6 * scale;
            ctx.globalAlpha = e.shieldFlash;
            ctx.strokeStyle = '#8b5cf6';
            ctx.lineWidth = 3 * scale;
            ctx.beginPath();
            ctx.arc(0, 0, shieldR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        } else {
          // Regular enemy: hamster wheel
          ctx.strokeStyle = '#8b5cf6';
          ctx.lineWidth = 3 * scale;
          ctx.beginPath();
          ctx.arc(0, 0, e.r, 0, Math.PI * 2);
          ctx.stroke();
          
          for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2 + e.wobble;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
            ctx.stroke();
          }
          
          ctx.fillStyle = '#f5871f';
          ctx.beginPath();
          ctx.arc(0, 0, 3 * scale, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.restore();
      });

      // Draw bullets
      ctx.fillStyle = '#f5871f';
      game.bullets.forEach(b => {
        ctx.fillRect(b.x - 2 * scale, b.y - 8 * scale, 4 * scale, 12 * scale);
      });
      
      ctx.fillStyle = '#e5484d';
      game.enemyBullets.forEach(b => {
        ctx.fillRect(b.x - 2 * scale, b.y - 8 * scale, 4 * scale, 12 * scale);
      });

      // Draw particles
      game.particles.forEach(p => {
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Draw floating texts
      ctx.textAlign = 'center';
      game.floatingTexts.forEach(t => {
        ctx.globalAlpha = Math.max(t.life, 0);
        ctx.font = `900 ${13 * scale}px Arial`;
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);
      });
      ctx.globalAlpha = 1;

      // Draw player - X-shaped spaceship image
      ctx.save();
      ctx.translate(game.player.x + game.player.w / 2, game.player.y + game.player.h / 2);
      if (shipImgRef.current) {
        const shipSize = 56 * scale;
        ctx.drawImage(shipImgRef.current, -shipSize / 2, -shipSize / 2, shipSize, shipSize);
      } else {
        // Fallback: crossed BOGX bats
        ctx.strokeStyle = '#f5871f';
        ctx.lineWidth = 6 * scale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-20 * scale, -12 * scale);
        ctx.lineTo(20 * scale, 12 * scale);
        ctx.moveTo(20 * scale, -12 * scale);
        ctx.lineTo(-20 * scale, 12 * scale);
        ctx.stroke();
        ctx.fillStyle = '#8b5cf6';
        ctx.beginPath();
        ctx.arc(0, 0, 6 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Wave clear check
      const boss = game.enemies.find(e => e.isBoss);
      if (boss && !boss.alive) {
        spawnBurst(W / 2, H / 2, ['#f5871f', '#8b5cf6'], 30, 1, 6);
        game.waveText = { text: `WAVE ${game.currentWave} CLEAR!`, life: 1 };
        game.levelFlash = 1;
        sfxWave();
        game.currentWave += 1;
        setWave(game.currentWave);
        buildWave(game.currentWave);
      }

      // Wave clear banner
      if (game.waveText) {
        ctx.globalAlpha = Math.min(game.waveText.life, 1);
        ctx.fillStyle = '#D4873A';
        ctx.font = `900 ${22 * scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(game.waveText.text, W / 2, H / 2);
        ctx.globalAlpha = 1;
        game.waveText.life -= 0.02;
        if (game.waveText.life <= 0) game.waveText = null;
      }

      // Boss speech bubble
      if (game.bossSpeech && boss?.alive) {
        ctx.globalAlpha = Math.min(game.bossSpeech.life * 1.3, 1);
        ctx.font = `900 ${12 * scale}px Arial`;
        ctx.textAlign = 'center';
        const textW = ctx.measureText(game.bossSpeech.text).width;
        const halfBubble = textW / 2 + 10 * scale;
        // Clamp both horizontal and vertical so bubble stays within canvas
        const bx = Math.max(halfBubble + 2, Math.min(W - halfBubble - 2, boss.x));
        const by = Math.max(20 * scale, boss.y - boss.r - 30 * scale);
        
        ctx.fillStyle = '#1a1622';
        ctx.beginPath();
        ctx.roundRect(bx - halfBubble, by - 14 * scale, textW + 20 * scale, 26 * scale, 6 * scale);
        ctx.fill();
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 2 * scale;
        ctx.stroke();
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText(game.bossSpeech.text, bx, by + 4 * scale);
        ctx.globalAlpha = 1;
        
        game.bossSpeech.life -= 0.005;
        if (game.bossSpeech.life <= 0) game.bossSpeech = null;
      }

      // Player combo speech
      if (game.playerSpeech) {
        ctx.globalAlpha = Math.min(game.playerSpeech.life * 1.3, 1);
        ctx.font = `900 ${14 * scale}px Arial`;
        ctx.textAlign = 'center';
        const py = game.player.y - 26 * scale;
        const textW = ctx.measureText(game.playerSpeech.text).width;
        const halfBubble = textW / 2 + 10 * scale;
        // Clamp horizontal position so bubble stays fully within canvas
        const px = Math.max(halfBubble + 2, Math.min(W - halfBubble - 2, game.player.x + game.player.w / 2));
        
        ctx.fillStyle = '#1a1622';
        ctx.beginPath();
        ctx.roundRect(px - halfBubble, py - 14 * scale, textW + 20 * scale, 26 * scale, 6 * scale);
        ctx.fill();
        ctx.strokeStyle = '#f5871f';
        ctx.lineWidth = 2 * scale;
        ctx.stroke();
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText(game.playerSpeech.text, px, py + 4 * scale);
        ctx.globalAlpha = 1;
        
        game.playerSpeech.life -= 0.008;
        if (game.playerSpeech.life <= 0) game.playerSpeech = null;
      }

      ctx.restore();

      // Hit flash overlay
      if (game.hitFlash > 0) {
        ctx.fillStyle = `rgba(229, 72, 77, ${game.hitFlash * 0.35})`;
        ctx.fillRect(0, 0, W, H);
      }

      // Level flash
      if (game.levelFlash > 0) {
        ctx.fillStyle = `rgba(244, 239, 228, ${game.levelFlash * 0.5})`;
        ctx.fillRect(0, 0, W, H);
        game.levelFlash -= 0.05;
      }

      // Cooldowns
      if (game.fireCooldown > 0) game.fireCooldown--;
      if (game.comboTimer > 0) game.comboTimer--;
      else game.combo = 0;

      animFrameRef.current = requestAnimationFrame(update);
    };

    // Input handlers
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      game.mouseX = (e.clientX - rect.left) * (W / rect.width);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      game.mouseX = (touch.clientX - rect.left) * (W / rect.width);
    };

    // Cursor left / re-entered the play area → toggle the "come back" alert.
    const handleMouseLeave = () => { setOutOfBounds(true); sfxAlarm(); };
    const handleMouseEnter = () => setOutOfBounds(false);

    const handleClick = () => fire();
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      game.mouseX = (touch.clientX - rect.left) * (W / rect.width);
      fire();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        fire();
      }
      if (e.code === 'ArrowLeft') game.mouseX -= 20 * scale;
      if (e.code === 'ArrowRight') game.mouseX += 20 * scale;
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('mouseenter', handleMouseEnter);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    animFrameRef.current = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('mouseenter', handleMouseEnter);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('keydown', handleKeyDown);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  // Fetch leaderboard - always keeps a full 10-row table (dummies) so the
  // design never collapses; real scores are merged in as they load.
  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/arcade/leaderboard?game=bogx-invaders&limit=10');
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(buildLeaderboard(data.leaderboard || []));
      }
    } catch (e) {
      console.error('Failed to fetch leaderboard:', e);
    }
  };

  // Load leaderboard when game over + clear canvas so only space shows behind it
  useEffect(() => {
    if (gameState === 'gameover') {
      fetchLeaderboard();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [gameState]);

  // Start game - play a short "ship flies in" intro, then go live
  const startGame = () => {
    ensureAudio();
    setScore(0);
    setTokens(0);
    setLives(3);
    setWave(1);
    setTimeLeft(WAVE_TIME);
    setOutOfBounds(false);
    setGameState('intro');
    sfxWave();
    setTimeout(() => setGameState('playing'), 1150);
  };

  // Toggle pause
  const togglePause = () => {
    setGameState(prev => {
      if (prev === 'playing') return 'paused';
      // Resuming: keep the saved game state instead of rebuilding.
      resumeRef.current = true;
      return 'playing';
    });
  };

  // Resume from the pause overlay (keep saved state).
  const resumeGame = () => {
    resumeRef.current = true;
    setOutOfBounds(false);
    setGameState('playing');
  };

  // Prevent page scroll while game component is mounted
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Start Screen - built into the space (dark, starfield, nebula)
  if (gameState === 'start') {
    return (
      <div
        className="w-full h-full flex flex-col overflow-hidden relative"
        style={{ background: 'radial-gradient(ellipse at 50% 40%, #2a1a3a 0%, #1a1228 45%, #0d0818 100%)' }}
      >
        {/* Space nebula glows */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 15% 30%, rgba(139, 92, 246, 0.18) 0%, transparent 35%), radial-gradient(circle at 85% 70%, rgba(212, 135, 58, 0.14) 0%, transparent 35%), radial-gradient(circle at 75% 20%, rgba(118, 11, 121, 0.15) 0%, transparent 30%)' }}
        />
        {/* Starfield */}
        <div className="absolute inset-0 pointer-events-none bogx-starfield" />

        {/* Header */}
        <div className="relative px-4 pt-4 pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1 hover:bg-white/10 rounded transition-colors">
              <ChevronLeft className="w-5 h-5 text-white/70" />
            </button>
            <div>
              <span className="font-display text-lg tracking-wider text-white block leading-none">BOGX Invaders</span>
              <span className="text-[10px] text-white/50 -mt-0.5 block">Shoot enemies, earn BOGX coins.</span>
            </div>
          </div>
        </div>

        {/* Body: LEFT game sidebar (preview) + main content */}
        <div className="relative flex-1 flex overflow-hidden">

          {/* LEFT sidebar - same HUD as gameplay (BOGX / Wave+Timer / Lives) */}
          <aside className="hidden lg:flex w-56 flex-shrink-0 flex-col items-center justify-start gap-4 px-4 pt-6 border-r border-white/10">
            {/* BOGX - fresh run always starts at 0.00 */}
            <div className="bogx-shine w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-center">
              <p className="text-white/40 text-[10px] uppercase tracking-widest mb-1.5">BOGX</p>
              <div className="flex items-center justify-center gap-1.5">
                <img src="/images/bogxcoin.png" alt="" className="w-8 h-8" />
                <span className="font-display text-3xl text-white leading-none">0.00</span>
              </div>
            </div>

            {/* WAVE + TIME ring (preview: wave 1, full timer) */}
            <div className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-center">
              <div className="relative w-24 h-24 mx-auto">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                  <circle cx="50" cy="50" r="44" fill="none" stroke="#760b79" strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 44} strokeDashoffset={0} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                  <span className="text-white/40 text-[9px] uppercase tracking-widest">Wave</span>
                  <span className="font-display text-3xl text-white">1</span>
                  <span className="text-xs font-bold mt-0.5 text-white/70">{WAVE_TIME}s</span>
                </div>
              </div>
            </div>

            {/* LIVES (preview: 3) */}
            <div className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-center">
              <p className="text-white/40 text-[10px] uppercase tracking-widest mb-2">Lives</p>
              <div className="flex items-center justify-center gap-1.5">
                {[...Array(3)].map((_, i) => (
                  <Heart key={i} className="w-6 h-6 text-red-500 fill-red-500" />
                ))}
              </div>
            </div>
          </aside>

          {/* MAIN content */}
          <div className="relative flex-1 overflow-y-auto px-5 py-6 flex flex-col items-center justify-center" style={{ scrollbarWidth: 'none' }}>
            {/* Decorative ship - UPPER-LEFT empty area (red zone) */}
            <img
              src="/images/xspace.png"
              alt=""
              className="hidden xl:block bogx-float absolute top-[100px] left-2 w-56 h-56 pointer-events-none z-0 drop-shadow-[0_0_30px_rgba(139,92,246,0.55)]"
            />
            <div className="relative z-10 w-full max-w-xl flex flex-col items-center text-center">
              <span className="inline-block px-3 py-1 bg-[#760b79] text-white font-bold uppercase tracking-wider rounded-full text-[10px]">
                Single Player
              </span>
              <h2 className="font-display text-white leading-tight mt-4 text-3xl md:text-4xl">
                SHOOT THE WHEELS<br/>
                <span className="inline-flex items-center gap-2 align-middle">
                  EARN <span className="text-[#760b79]">BOGX COINS</span>
                  <img src="/images/bogxcoin.png" alt="" className="w-8 h-8 md:w-9 md:h-9 inline-block" />
                </span>
              </h2>

              {/* Badges */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-white/90 text-[10px]">
                <span className="flex items-center gap-1 bg-white/10 border border-white/10 px-2.5 py-1 rounded-full"><Crosshair className="w-3 h-3 text-[#760b79]" /> Arcade Shooter</span>
                <span className="flex items-center gap-1 bg-white/10 border border-white/10 px-2.5 py-1 rounded-full"><img src="/images/bogxcoin.png" alt="" className="w-3 h-3" /> +0.01 per kill</span>
                <span className="flex items-center gap-1 bg-white/10 border border-white/10 px-2.5 py-1 rounded-full"><Trophy className="w-3 h-3 text-[#760b79]" /> Beat the Boss</span>
              </div>

              {/* Feature cards */}
              <div className="w-full bg-white/5 rounded-2xl border border-white/10 mt-6 grid grid-cols-3 divide-x divide-white/10">
                <div className="py-4 px-3 text-center">
                  <Crosshair className="w-6 h-6 mx-auto text-[#760b79] mb-1" />
                  <p className="font-display text-xs text-white">SHOOT</p>
                  <p className="text-[10px] text-white/50">Destroy enemies</p>
                </div>
                <div className="py-4 px-3 text-center">
                  <Coins className="w-6 h-6 mx-auto text-[#760b79] mb-1" />
                  <p className="font-display text-xs text-white">EARN</p>
                  <p className="text-[10px] text-white/50">+0.01 BOGX/kill</p>
                </div>
                <div className="py-4 px-3 text-center">
                  <Trophy className="w-6 h-6 mx-auto text-[#760b79] mb-1" />
                  <p className="font-display text-xs text-white">BOSS</p>
                  <p className="text-[10px] text-white/50">+0.05 BOGX</p>
                </div>
              </div>

              {/* Controls */}
              <div className="w-full bg-white/5 rounded-2xl border border-white/10 mt-4 grid grid-cols-2 divide-x divide-white/10">
                <div className="py-3 px-3 text-center">
                  <span className="font-display text-sm text-white/80 uppercase">Movement</span>
                  <p className="text-sm text-white/60 mt-1">
                    {typeof window !== 'undefined' && 'ontouchstart' in window ? '👆 Drag left/right' : '🖱️ Move mouse (or arrows)'}
                  </p>
                </div>
                <div className="py-3 px-3 text-center">
                  <span className="font-display text-sm text-white/80 uppercase">Shoot</span>
                  <p className="text-sm text-white/60 mt-1">
                    {typeof window !== 'undefined' && 'ontouchstart' in window ? '👆 Tap screen' : '⌨️ Space (or left click)'}
                  </p>
                </div>
              </div>

              {/* Start button */}
              <button
                onClick={startGame}
                className="mt-6 px-16 py-4 rounded-2xl bg-[#760b79] hover:bg-[#5e0961] text-white font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5 fill-white" /> START GAME
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden relative"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #2a1a3a 0%, #1a1228 45%, #0d0818 100%)' }}
    >
      {/* Header - dark space theme, matches start screen for seamless transition */}
      <div className="relative z-10 px-4 pt-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 hover:bg-white/10 rounded transition-colors">
            <ChevronLeft className="w-5 h-5 text-white/70" />
          </button>
          <div>
            <span className="font-display text-lg tracking-wider text-white block leading-none">BOGX Invaders</span>
            <span className="text-[10px] text-white/50 -mt-0.5 block">Shoot enemies, earn BOGX coins.</span>
          </div>
          
          <div className="ml-auto flex items-center gap-2">
            <button 
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D4873A]/40 bg-[#D4873A]/10 hover:bg-[#D4873A]/20 transition-colors"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-[#D4873A]" /> : <VolumeX className="w-4 h-4 text-[#D4873A]" />}
              <span className="text-xs font-bold text-[#D4873A]">{soundEnabled ? 'Sound' : 'Muted'}</span>
            </button>
            {gameState === 'playing' && (
              <button 
                onClick={togglePause}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D4873A]/40 bg-[#D4873A]/10 hover:bg-[#D4873A]/20 transition-colors"
              >
                <Pause className="w-4 h-4 text-[#D4873A]" />
                <span className="text-xs font-bold text-[#D4873A]">Pause</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Game Canvas - space background fills empty space around fixed-size game */}
      <div 
        ref={containerRef} 
        className="flex-1 flex items-center justify-center relative overflow-hidden"
      >
        {/* Space nebula glows */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{ 
            background: 'radial-gradient(circle at 15% 30%, rgba(139, 92, 246, 0.18) 0%, transparent 35%), radial-gradient(circle at 85% 70%, rgba(212, 135, 58, 0.14) 0%, transparent 35%), radial-gradient(circle at 75% 20%, rgba(118, 11, 121, 0.15) 0%, transparent 30%)'
          }}
        />
        {/* Starfield */}
        <div className="absolute inset-0 pointer-events-none bogx-starfield" />

        {/* Live stats - LEFT side panel (desktop, fills empty space). Right stays free for ads. */}
        {gameState !== 'gameover' && (
          <div className="hidden lg:flex absolute left-0 top-0 bottom-0 w-[calc((100%-600px)/2)] flex-col items-center justify-start gap-4 px-4 pt-6 pointer-events-none z-10">
            {/* BOGX - top */}
            <div className="bogx-shine w-full max-w-[150px] bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-center backdrop-blur-[2px]">
              <p className="text-white/40 text-[10px] uppercase tracking-widest mb-1.5">BOGX</p>
              <div className="flex items-center justify-center gap-1.5">
                <img src="/images/bogxcoin.png" alt="" className="w-8 h-8" />
                <span className="font-display text-3xl text-[#D4873A] leading-none">{tokens.toFixed(2)}</span>
              </div>
            </div>

            {/* WAVE + TIME combined as a ring timer */}
            <div className="w-full max-w-[150px] bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-center backdrop-blur-[2px]">
              <div className="relative w-24 h-24 mx-auto">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                  <circle
                    cx="50" cy="50" r="44" fill="none"
                    stroke={timeLeft <= 5 ? '#e5484d' : '#a78bfa'}
                    strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 44}
                    strokeDashoffset={2 * Math.PI * 44 * (1 - Math.max(0, Math.min(1, timeLeft / WAVE_TIME)))}
                    style={{ transition: 'stroke-dashoffset 0.3s linear' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                  <span className="text-white/40 text-[9px] uppercase tracking-widest">Wave</span>
                  <span className="font-display text-3xl text-[#a78bfa]">{wave}</span>
                  <span className={`text-xs font-bold mt-0.5 ${timeLeft <= 5 ? 'text-[#e5484d]' : 'text-white/70'}`}>{timeLeft}s</span>
                </div>
              </div>
            </div>

            {/* LIVES */}
            <div className="w-full max-w-[150px] bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-center backdrop-blur-[2px]">
              <p className="text-white/40 text-[10px] uppercase tracking-widest mb-2">Lives</p>
              <div className="flex items-center justify-center gap-1.5">
                {[...Array(3)].map((_, i) => (
                  <Heart key={i} className={`w-6 h-6 ${i < lives ? 'text-red-500 fill-red-500' : 'text-white/15'}`} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Live stats - compact TOP overlay (mobile/tablet, no side space) */}
        {gameState !== 'gameover' && (
          <div className="lg:hidden absolute top-2 left-2 right-2 flex items-center justify-between px-3 py-1.5 rounded-xl bg-black/30 backdrop-blur-sm border border-white/10 pointer-events-none z-10">
            <div className="flex items-center gap-1.5 text-white">
              <Zap className="w-4 h-4 text-[#a78bfa]" />
              <span className="font-bold text-sm">W{wave}</span>
            </div>
            <div className={`flex items-center gap-1.5 ${timeLeft <= 5 ? 'text-[#e5484d]' : 'text-white'}`}>
              <Clock className="w-4 h-4" />
              <span className="font-bold text-sm">{timeLeft}s</span>
            </div>
            <div className="flex items-center gap-1">
              {[...Array(3)].map((_, i) => (
                <Heart key={i} className={`w-4 h-4 ${i < lives ? 'text-red-500 fill-red-500' : 'text-white/20'}`} />
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-white">
              <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
              <span className="font-bold text-sm">{tokens.toFixed(2)}</span>
            </div>
          </div>
        )}
        {/* Game area - transparent so space background flows through seamlessly */}
        <div 
          className="relative flex items-center justify-center" 
          style={{ width: canvasSize.width, height: canvasSize.height }}
        >
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            style={{ touchAction: 'none', width: canvasSize.width, height: canvasSize.height }}
          />
          
          {/* Intro - ship flies in from the bottom */}
          {gameState === 'intro' && (
            <div className="absolute inset-0 flex items-end justify-center pb-6 pointer-events-none overflow-hidden">
              <div className="relative bogx-ship-in flex flex-col items-center">
                <img src="/images/xspace.png" alt="" className="w-16 h-16 drop-shadow-[0_0_20px_rgba(245,135,31,0.8)]" />
                {/* engine thrust */}
                <div className="bogx-thrust mt-0.5 w-2 h-8 rounded-full origin-top" style={{ background: 'linear-gradient(to bottom, #f5871f, #8b5cf6, transparent)' }} />
              </div>
            </div>
          )}

          {/* Paused Screen - transparent, sits in space */}
          {gameState === 'paused' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
              <h2 className="font-display text-2xl text-white mb-4 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">PAUSED</h2>
              <button
                onClick={resumeGame}
                className="flex items-center gap-2 px-6 py-2 bg-[#760b79] hover:bg-[#5e0961] text-white font-bold rounded-lg shadow-md"
              >
                <Play className="w-4 h-4" /> RESUME
              </button>
            </div>
          )}

          {/* Out-of-bounds alert - cursor left the play area during a live game */}
          {outOfBounds && gameState === 'playing' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30 bg-[#e5484d]/25 animate-pulse">
              <div className="flex flex-col items-center text-center px-6">
                <span className="text-4xl mb-2">🚨</span>
                <h2 className="font-display text-xl md:text-2xl text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                  CAPTAIN, COME BACK<br/>ON THE BRIDGE!
                </h2>
                <p className="text-white/80 text-xs mt-2">Move your cursor back into the play area</p>
              </div>
            </div>
          )}
        </div>

        {/* Game Over Page - single column: ship-pimped stats on top, ranking below */}
        {gameState === 'gameover' && (
          <div className="absolute inset-0 z-20 overflow-y-auto">
            <div className="min-h-full flex flex-col items-center justify-center w-full max-w-lg mx-auto px-5 py-4">

              {/* GAME OVER + ship-pimped stats */}
              <h2 className="font-display text-2xl md:text-3xl text-[#e5484d] tracking-wider">GAME OVER</h2>
              {tokens > highScore / 100 && highScore > 0 && (
                <p className="text-[#D4873A] text-[11px] mt-0.5 animate-pulse font-bold">🎉 NEW BEST! 🎉</p>
              )}

              {/* Ship + flanking stats - with continuous shine sweep */}
              <div className="bogx-shine relative w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 mt-2">
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 45%, rgba(139,92,246,0.25) 0%, transparent 55%)' }} />
                <div className="relative flex items-center justify-between gap-2">
                  <div className="text-center flex-1">
                    <p className="text-white/40 text-[10px] uppercase tracking-widest mb-1">BOGX</p>
                    <div className="flex items-center justify-center gap-1.5">
                      <img src="/images/bogxcoin.png" alt="" className="w-8 h-8" />
                      <p className="font-display text-3xl text-[#D4873A] leading-none">{tokens.toFixed(2)}</p>
                    </div>
                    {isLoggedIn ? (
                      <p className="text-green-400 text-[10px] font-bold mt-1">EARNED!</p>
                    ) : (
                      <p className="text-white/40 text-[10px] mt-1">(not saved)</p>
                    )}
                  </div>
                  <img src="/images/xspace.png" alt="" className="w-20 h-20 flex-shrink-0 drop-shadow-[0_0_16px_rgba(139,92,246,0.6)]" />
                  <div className="text-center flex-1">
                    <p className="text-white/40 text-[10px] uppercase tracking-widest mb-1">Wave</p>
                    <p className="font-display text-3xl text-[#a78bfa] leading-none">{wave}</p>
                  </div>
                </div>
              </div>

              {/* Ranking table */}
              <div className="w-full bg-white/5 border border-white/10 rounded-2xl overflow-hidden mt-3">
                <div className="flex items-center justify-center gap-2 py-2 border-b border-white/10 bg-white/5">
                  <Trophy className="w-3.5 h-3.5 text-[#D4873A]" />
                  <h3 className="font-display text-xs text-white tracking-wider">TOP 10 PLAYERS</h3>
                </div>
                <div className="divide-y divide-white/5">
                  <div className="flex items-center gap-3 px-4 py-1.5 text-[9px] uppercase tracking-wider text-white/40">
                    <span className="w-7 text-center">Rank</span>
                    <span className="flex-1 text-left">Player</span>
                    <span className="w-20 text-right">BOGX</span>
                  </div>
                  {leaderboard.map((player, i) => {
                    const isMe = userId && player.userId === userId;
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                    return (
                      <div
                        key={player.userId || i}
                        className={`flex items-center gap-3 px-4 py-1.5 text-sm ${isMe ? 'bg-[#D4873A]/15' : ''}`}
                      >
                        <span className={`w-7 text-center font-bold ${i === 0 ? 'text-[#D4873A]' : i === 1 ? 'text-white/70' : i === 2 ? 'text-amber-500' : 'text-white/40'}`}>
                          {medal || i + 1}
                        </span>
                        <div className="flex-1 flex items-center gap-2 min-w-0">
                          <div className="relative flex-shrink-0">
                            <img src={player.avatar || '/images/default-avatar.png'} alt="" className="w-5 h-5 rounded-full" />
                            {player.countryFlag && (
                              <CountryFlag flag={player.countryFlag} className="absolute -bottom-1 -right-1 w-3 h-2 rounded-[1px] border border-[#0d0818] object-cover" />
                            )}
                          </div>
                          <span className={`truncate text-left text-xs ${isMe ? 'text-[#D4873A] font-bold' : 'text-white/85'}`}>
                            {player.username}{isMe ? ' (You)' : ''}
                          </span>
                        </div>
                        <div className="w-20 flex items-center justify-end gap-1">
                          <img src="/images/bogxcoin.png" alt="" className="w-3.5 h-3.5" />
                          <span className="font-bold text-[#D4873A]">{(player.score / 100).toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col items-center gap-2 mt-3 w-full">
                {!isLoggedIn && (
                  <button
                    onClick={onShowLogin}
                    className="px-5 py-2 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-sm font-bold rounded-lg shadow-md"
                  >
                    Login to save & earn BOGX!
                  </button>
                )}
                <div className="flex items-center gap-3">
                  <button
                    onClick={onBack}
                    className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg"
                  >
                    Back
                  </button>
                  <button
                    onClick={startGame}
                    className="px-8 py-2.5 bg-[#D4873A] hover:bg-[#C4772A] text-white font-bold rounded-lg shadow-md"
                  >
                    PLAY AGAIN
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      
      {/* Flying coins animation */}
      {flyingCoins.map(coin => {
        const targetX = window.innerWidth / 2;
        const targetY = 25;
        const dx = targetX - coin.x;
        const dy = targetY - coin.y;
        
        return (
          <span
            key={coin.id}
            style={{
              position: 'fixed',
              left: coin.x,
              top: coin.y,
              zIndex: 9999,
              color: '#16a34a',
              fontWeight: 'bold',
              fontSize: '14px',
              pointerEvents: 'none',
              textShadow: '0 1px 2px rgba(0,0,0,0.2)',
              animation: `flyToWallet${coin.id} 0.8s ease-out forwards`,
            }}
          >
            +{coin.amount.toFixed(2)}
            <style>{`
              @keyframes flyToWallet${coin.id} {
                0% { transform: translate(0, 0) scale(1.2); opacity: 1; }
                80% { opacity: 1; }
                100% { transform: translate(${dx}px, ${dy}px) scale(0.6); opacity: 0; }
              }
            `}</style>
          </span>
        );
      })}
    </div>
  );
}
