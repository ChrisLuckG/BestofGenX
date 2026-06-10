"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Play, Pause, RotateCcw, ChevronLeft, ChevronRight, ChevronDown, RotateCw } from "lucide-react";

interface NeonDropProps {
  onBack: () => void;
  onScoreUpdate?: (score: number) => void;
}

const COLS = 10;
const ROWS = 20;

// Synthwave neon colors
const COLORS = [
  null,
  '#ff00ff', // pink
  '#00ffff', // cyan
  '#ff0080', // hot pink
  '#8000ff', // purple
  '#00ff80', // neon green
  '#ffff00', // yellow
  '#ff8000', // orange
];

// 7 standard shapes - the shapes themselves are not trademarked
const SHAPES: number[][][] = [
  [[1, 1, 1, 1]],                          // I
  [[2, 2], [2, 2]],                        // O
  [[0, 3, 0], [3, 3, 3]],                  // T
  [[0, 4, 4], [4, 4, 0]],                  // S
  [[5, 5, 0], [0, 5, 5]],                  // Z
  [[6, 0, 0], [6, 6, 6]],                  // J
  [[0, 0, 7], [7, 7, 7]],                  // L
];

type Board = number[][];
type Piece = { shape: number[][]; row: number; col: number };

const createBoard = (): Board =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(0));

// Renders the board with fixed pixel cell sizes calculated from viewport
function BoardView({ displayBoard }: { displayBoard: Board }) {
  const [cellSize, setCellSize] = useState(24);
  
  useEffect(() => {
    const calc = () => {
      // Reserve space: ~80px each side for stats, 60px top, 100px bottom for controls
      const availW = window.innerWidth - 200;
      const availH = window.innerHeight - 180;
      const byW = Math.floor(availW / COLS);
      const byH = Math.floor(availH / ROWS);
      const size = Math.max(12, Math.min(byW, byH, 32));
      setCellSize(size);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  const boardWidth = cellSize * COLS;
  const boardHeight = cellSize * ROWS;

  return (
    <div
      className="bg-black border-2 border-fuchsia-500 rounded-lg overflow-hidden shadow-[0_0_30px_rgba(255,0,255,0.5)]"
      style={{
        width: boardWidth + 4,
        height: boardHeight + 4,
        padding: 0,
        boxSizing: 'content-box',
      }}
    >
      <div
        style={{
          width: boardWidth,
          height: boardHeight,
          position: 'relative',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        {displayBoard.map((row, r) =>
          row.map((cell, c) => (
            <div
              key={`${r}-${c}`}
              style={{
                position: 'absolute',
                left: c * cellSize,
                top: r * cellSize,
                width: cellSize,
                height: cellSize,
                background: cell ? COLORS[cell]! : 'transparent',
                boxShadow: cell ? `inset 0 0 6px rgba(255,255,255,0.5), 0 0 ${cellSize / 3}px ${COLORS[cell]}` : 'none',
                borderRadius: cell ? 2 : 0,
                boxSizing: 'border-box',
                border: cell ? 'none' : '1px solid rgba(255,255,255,0.04)',
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

const randomPiece = (): Piece => {
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  return {
    shape: shape.map(r => [...r]),
    row: 0,
    col: Math.floor((COLS - shape[0].length) / 2),
  };
};

const rotateMatrix = (m: number[][]): number[][] => {
  const rows = m.length;
  const cols = m[0].length;
  const out: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out[c][rows - 1 - r] = m[r][c];
    }
  }
  return out;
};

const collides = (board: Board, piece: Piece): boolean => {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;
      const nr = piece.row + r;
      const nc = piece.col + c;
      if (nc < 0 || nc >= COLS || nr >= ROWS) return true;
      if (nr >= 0 && board[nr][nc]) return true;
    }
  }
  return false;
};

const merge = (board: Board, piece: Piece): Board => {
  const next = board.map(row => [...row]);
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (piece.shape[r][c] && piece.row + r >= 0) {
        next[piece.row + r][piece.col + c] = piece.shape[r][c];
      }
    }
  }
  return next;
};

const clearLines = (board: Board): { board: Board; cleared: number } => {
  const remaining = board.filter(row => row.some(cell => !cell));
  const cleared = ROWS - remaining.length;
  const newRows = Array.from({ length: cleared }, () => Array(COLS).fill(0));
  return { board: [...newRows, ...remaining], cleared };
};

export default function NeonDrop({ onBack, onScoreUpdate }: NeonDropProps) {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameover'>('menu');
  const [board, setBoard] = useState<Board>(createBoard);
  const [piece, setPiece] = useState<Piece | null>(null);
  const [nextPiece, setNextPiece] = useState<Piece>(randomPiece);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use refs for synchronous access in game loop
  const boardRef = useRef<Board>(board);
  const pieceRef = useRef<Piece | null>(piece);
  const nextPieceRef = useRef<Piece>(nextPiece);
  const lockingRef = useRef(false);
  const levelRef = useRef(level);
  const gameStateRef = useRef(gameState);

  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { pieceRef.current = piece; }, [piece]);
  useEffect(() => { nextPieceRef.current = nextPiece; }, [nextPiece]);
  useEffect(() => { levelRef.current = level; }, [level]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // Atomic lock: merge piece into board, clear lines, spawn next
  const lockAndSpawn = useCallback((finalPiece: Piece) => {
    if (lockingRef.current) return;
    lockingRef.current = true;

    const merged = merge(boardRef.current, finalPiece);
    const { board: cleared, cleared: lineCount } = clearLines(merged);
    
    boardRef.current = cleared;
    setBoard(cleared);

    if (lineCount > 0) {
      setLines(l => l + lineCount);
      const points = [0, 100, 300, 500, 800][lineCount] * levelRef.current;
      setScore(s => s + points);
    } else {
      setScore(s => s + 5);
    }

    // Spawn next piece
    const newPiece = nextPieceRef.current;
    if (collides(cleared, newPiece)) {
      pieceRef.current = null;
      setPiece(null);
      setGameState('gameover');
      lockingRef.current = false;
      return;
    }
    pieceRef.current = newPiece;
    setPiece(newPiece);
    const fresh = randomPiece();
    nextPieceRef.current = fresh;
    setNextPiece(fresh);
    lockingRef.current = false;
  }, []);

  // Move piece (left/right/down)
  const tryMove = useCallback((dr: number, dc: number): boolean => {
    if (!pieceRef.current || lockingRef.current) return false;
    const next = { ...pieceRef.current, row: pieceRef.current.row + dr, col: pieceRef.current.col + dc };
    if (!collides(boardRef.current, next)) {
      pieceRef.current = next;
      setPiece(next);
      return true;
    }
    return false;
  }, []);

  // Rotate
  const tryRotate = useCallback(() => {
    if (!pieceRef.current || lockingRef.current) return;
    const rotated = { ...pieceRef.current, shape: rotateMatrix(pieceRef.current.shape) };
    const kicks = [0, -1, 1, -2, 2];
    for (const k of kicks) {
      const test = { ...rotated, col: rotated.col + k };
      if (!collides(boardRef.current, test)) {
        pieceRef.current = test;
        setPiece(test);
        return;
      }
    }
  }, []);

  // Cooldown to prevent double-fire from touch+mouse events
  const lastActionRef = useRef(0);
  
  // Hard drop - atomic with cooldown
  const hardDrop = useCallback(() => {
    const now = Date.now();
    if (now - lastActionRef.current < 200) return;
    lastActionRef.current = now;
    if (!pieceRef.current || lockingRef.current) return;
    let p = pieceRef.current;
    let dropDistance = 0;
    while (true) {
      const next = { ...p, row: p.row + 1 };
      if (collides(boardRef.current, next)) break;
      p = next;
      dropDistance++;
    }
    setScore(s => s + dropDistance * 2);
    lockAndSpawn(p);
  }, [lockAndSpawn]);

  // Gravity
  useEffect(() => {
    if (gameState !== 'playing') return;
    const speed = Math.max(800 - (level - 1) * 60, 100);
    const interval = setInterval(() => {
      if (gameStateRef.current !== 'playing' || lockingRef.current || !pieceRef.current) return;
      const next = { ...pieceRef.current, row: pieceRef.current.row + 1 };
      if (collides(boardRef.current, next)) {
        lockAndSpawn(pieceRef.current);
      } else {
        pieceRef.current = next;
        setPiece(next);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [gameState, level, lockAndSpawn]);

  // Update level based on lines
  useEffect(() => {
    setLevel(Math.floor(lines / 10) + 1);
  }, [lines]);

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); tryMove(0, -1); break;
        case 'ArrowRight': e.preventDefault(); tryMove(0, 1); break;
        case 'ArrowDown': e.preventDefault(); tryMove(1, 0); break;
        case 'ArrowUp': case 'x': case 'X': e.preventDefault(); tryRotate(); break;
        case ' ': e.preventDefault(); hardDrop(); break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState, tryMove, tryRotate, hardDrop]);

  // Fullscreen
  const enterFullscreen = async () => {
    try {
      const elem = containerRef.current || document.documentElement;
      if (elem.requestFullscreen) await elem.requestFullscreen();
      else if ((elem as any).webkitRequestFullscreen) await (elem as any).webkitRequestFullscreen();
    } catch {}
  };

  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {}
  };

  const startGame = async () => {
    await enterFullscreen();
    const fresh = createBoard();
    const first = randomPiece();
    const next = randomPiece();
    boardRef.current = fresh;
    pieceRef.current = first;
    nextPieceRef.current = next;
    lockingRef.current = false;
    setBoard(fresh);
    setScore(0);
    setLines(0);
    setLevel(1);
    setPiece(first);
    setNextPiece(next);
    setGameState('playing');
  };

  const handleBack = async () => {
    await exitFullscreen();
    onBack();
  };

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Render board with active piece
  const displayBoard: Board = board.map(row => [...row]);
  if (piece) {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c] && piece.row + r >= 0) {
          displayBoard[piece.row + r][piece.col + c] = piece.shape[r][c];
        }
      }
    }
  }

  // Render preview piece
  const renderMiniShape = (p: Piece) => {
    const rows = p.shape.length;
    const cols = p.shape[0].length;
    return (
      <div
        className="grid gap-0.5"
        style={{
          gridTemplateColumns: `repeat(${cols}, 16px)`,
          gridTemplateRows: `repeat(${rows}, 16px)`,
        }}
      >
        {p.shape.flatMap((row, r) =>
          row.map((cell, c) => (
            <div
              key={`${r}-${c}`}
              className="w-4 h-4"
              style={{
                background: cell ? COLORS[cell]! : 'transparent',
                boxShadow: cell ? `0 0 8px ${COLORS[cell]}` : 'none',
                borderRadius: 2,
              }}
            />
          ))
        )}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        width: '100vw', height: '100vh',
        zIndex: 2147483647,
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #1a0033 0%, #000019 100%)',
      }}
    >
      {/* Synthwave grid background */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,0,255,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,255,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2 bg-black/50 backdrop-blur-sm border-b border-fuchsia-500/30">
        <button onClick={handleBack} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700">
          <X className="w-5 h-5 text-white" />
        </button>
        <div className="text-center">
          <div className="text-fuchsia-400 font-bold text-xs tracking-[0.3em]">NEON DROP</div>
        </div>
        {gameState === 'playing' ? (
          <button onClick={() => setGameState('paused')} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700">
            <Pause className="w-5 h-5 text-white" />
          </button>
        ) : <div className="w-9" />}
      </div>

      {/* Main Game Layout */}
      <div className="w-full h-full flex flex-col items-center justify-center pt-12 pb-2 px-2 relative z-10">
        <div className="flex flex-row items-start gap-3 w-full justify-center">
          
          {/* Left Stats */}
          <div className="flex flex-col gap-3 text-white">
            <div className="bg-black/60 border border-cyan-500/50 rounded-lg p-2 min-w-[80px]">
              <div className="text-cyan-400 text-[10px] uppercase tracking-wider">Score</div>
              <div className="text-white font-mono text-lg">{score}</div>
            </div>
            <div className="bg-black/60 border border-fuchsia-500/50 rounded-lg p-2 min-w-[80px]">
              <div className="text-fuchsia-400 text-[10px] uppercase tracking-wider">Lines</div>
              <div className="text-white font-mono text-lg">{lines}</div>
            </div>
            <div className="bg-black/60 border border-yellow-500/50 rounded-lg p-2 min-w-[80px]">
              <div className="text-yellow-400 text-[10px] uppercase tracking-wider">Level</div>
              <div className="text-white font-mono text-lg">{level}</div>
            </div>
          </div>

          {/* Game Board */}
          <BoardView displayBoard={displayBoard} />

          {/* Right - Next + Controls hint */}
          <div className="flex flex-col gap-3 text-white">
            <div className="bg-black/60 border border-purple-500/50 rounded-lg p-2 min-w-[80px]">
              <div className="text-purple-400 text-[10px] uppercase tracking-wider mb-1">Next</div>
              <div className="flex items-center justify-center h-12">
                {gameState === 'playing' && renderMiniShape(nextPiece)}
              </div>
            </div>
          </div>
        </div>

        {/* Touch Controls */}
        {gameState === 'playing' && (
          <div className="flex items-center gap-4 mt-3">
            <button
              onPointerDown={(e) => { e.preventDefault(); tryMove(0, -1); }}
              className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 border-2 border-cyan-300 flex items-center justify-center active:scale-90 shadow-lg shadow-cyan-500/50 touch-none select-none"
            >
              <ChevronLeft className="w-7 h-7 text-white pointer-events-none" />
            </button>
            <button
              onPointerDown={(e) => { e.preventDefault(); tryRotate(); }}
              className="w-14 h-14 rounded-xl bg-gradient-to-br from-fuchsia-500 to-fuchsia-700 border-2 border-fuchsia-300 flex items-center justify-center active:scale-90 shadow-lg shadow-fuchsia-500/50 touch-none select-none"
            >
              <RotateCw className="w-6 h-6 text-white pointer-events-none" />
            </button>
            <button
              onPointerDown={(e) => { e.preventDefault(); hardDrop(); }}
              className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 border-2 border-yellow-300 flex items-center justify-center active:scale-90 shadow-lg shadow-yellow-500/50 touch-none select-none"
            >
              <ChevronDown className="w-7 h-7 text-white pointer-events-none" />
            </button>
            <button
              onPointerDown={(e) => { e.preventDefault(); tryMove(0, 1); }}
              className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 border-2 border-cyan-300 flex items-center justify-center active:scale-90 shadow-lg shadow-cyan-500/50 touch-none select-none"
            >
              <ChevronRight className="w-7 h-7 text-white pointer-events-none" />
            </button>
          </div>
        )}
      </div>

      {/* Menu Overlay */}
      {gameState === 'menu' && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center gap-4 p-6 z-30">
          <div className="text-center">
            <h1 className="text-5xl font-black tracking-[0.2em]" style={{
              background: 'linear-gradient(90deg, #ff00ff, #00ffff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 20px rgba(255,0,255,0.5))',
            }}>
              NEON
            </h1>
            <h1 className="text-5xl font-black tracking-[0.2em]" style={{
              background: 'linear-gradient(90deg, #00ffff, #ff00ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 20px rgba(0,255,255,0.5))',
            }}>
              DROP
            </h1>
            <p className="text-fuchsia-400 text-xs tracking-[0.3em] mt-2">SYNTHWAVE PUZZLE</p>
          </div>
          
          <div className="bg-black/50 border border-fuchsia-500/30 rounded-xl p-4 max-w-md">
            <p className="text-white text-sm text-center mb-3">
              Stapele Blöcke und vervollständige Linien.<br/>
              Volle Linien verschwinden!
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
              <div className="flex items-center gap-2">
                <ChevronLeft className="w-4 h-4 text-cyan-400" />
                <span>Links</span>
              </div>
              <div className="flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-cyan-400" />
                <span>Rechts</span>
              </div>
              <div className="flex items-center gap-2">
                <RotateCw className="w-4 h-4 text-fuchsia-400" />
                <span>Drehen</span>
              </div>
              <div className="flex items-center gap-2">
                <ChevronDown className="w-4 h-4 text-yellow-400" />
                <span>Fallen</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={startGame}
            className="px-10 py-4 bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white font-bold text-xl rounded-lg flex items-center gap-2 mt-2 active:scale-95 shadow-lg shadow-fuchsia-500/50"
          >
            <Play className="w-6 h-6" />
            START
          </button>
        </div>
      )}

      {/* Paused */}
      {gameState === 'paused' && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-6 z-30 backdrop-blur-sm">
          <h2 className="text-3xl font-bold text-fuchsia-400 tracking-widest">PAUSED</h2>
          <button
            onClick={() => setGameState('playing')}
            className="px-8 py-4 bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white font-bold text-xl rounded-lg flex items-center gap-2"
          >
            <Play className="w-6 h-6" />
            RESUME
          </button>
          <button onClick={handleBack} className="px-6 py-2 bg-gray-700 text-white font-bold rounded-lg">
            QUIT
          </button>
        </div>
      )}

      {/* Game Over */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center gap-6 z-30 backdrop-blur-sm">
          <h2 className="text-4xl font-bold text-fuchsia-500 tracking-widest" style={{
            filter: 'drop-shadow(0 0 20px rgba(255,0,255,0.8))',
          }}>GAME OVER</h2>
          <div className="text-center">
            <p className="text-cyan-400 text-sm tracking-widest mb-1">SCORE</p>
            <p className="text-5xl text-white font-mono font-bold">{score}</p>
            <p className="text-gray-400 text-sm mt-2">{lines} Lines · Level {level}</p>
          </div>
          <button
            onClick={startGame}
            className="px-8 py-4 bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white font-bold text-xl rounded-lg flex items-center gap-2"
          >
            <RotateCcw className="w-6 h-6" />
            NOCHMAL
          </button>
          <button onClick={handleBack} className="px-6 py-2 bg-gray-700 text-white font-bold rounded-lg">
            QUIT
          </button>
        </div>
      )}
    </div>
  );
}
