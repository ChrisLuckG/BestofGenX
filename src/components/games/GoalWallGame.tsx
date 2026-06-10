"use client";

import { useState, useRef, useEffect } from "react";
import { Target, Coins, Play, Trophy, X } from "lucide-react";

interface GoalWallGameProps {
  onComplete?: (correct: boolean, reward: number) => void;
  onStart?: (reward: number) => void;
  disabled?: boolean;
}

interface Hole {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  points: number;
}

export default function GoalWallGame({ onComplete, onStart, disabled = false }: GoalWallGameProps) {
  const [phase, setPhase] = useState<"intro" | "aiming" | "shooting" | "result">("intro");
  const [ballPosition, setBallPosition] = useState({ x: 50, y: 85 });
  const [targetPosition, setTargetPosition] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [shotResult, setShotResult] = useState<{ hit: boolean; points: number; holeId: number | null }>({ hit: false, points: 0, holeId: null });
  const [isAnimating, setIsAnimating] = useState(false);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  
  const maxReward = 150;

  // Torwand mit runden Löchern - mittlere Größe
  const holes: Hole[] = [
    // Obere Ecken - schwieriger, mehr Punkte
    { id: 1, x: 3, y: 5, width: 20, height: 22, points: 15 },
    { id: 2, x: 77, y: 5, width: 20, height: 22, points: 15 },
    // Untere Ecken - etwas einfacher
    { id: 3, x: 3, y: 53, width: 20, height: 22, points: 10 },
    { id: 4, x: 77, y: 53, width: 20, height: 22, points: 10 },
  ];

  const handleStart = () => {
    setPhase("aiming");
    onStart?.(maxReward);
  };

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (phase !== "aiming" || isAnimating) return;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging || phase !== "aiming" || !gameAreaRef.current) return;
    
    const rect = gameAreaRef.current.getBoundingClientRect();
    let clientX: number, clientY: number;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    
    // Begrenzen auf Torbereich (obere 80%)
    setTargetPosition({
      x: Math.max(5, Math.min(95, x)),
      y: Math.max(10, Math.min(75, y))
    });
  };

  const handleTouchEnd = () => {
    if (!isDragging || phase !== "aiming") return;
    setIsDragging(false);
    shoot();
  };

  const shoot = () => {
    setPhase("shooting");
    setIsAnimating(true);
    
    // Ball zur Zielposition animieren
    const startX = ballPosition.x;
    const startY = ballPosition.y;
    const endX = targetPosition.x;
    const endY = targetPosition.y;
    
    let progress = 0;
    const duration = 500;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      progress = Math.min(elapsed / duration, 1);
      
      // Easing für realistischere Bewegung
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      setBallPosition({
        x: startX + (endX - startX) * easeOut,
        y: startY + (endY - startY) * easeOut
      });
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Prüfen ob Loch getroffen
        checkHit(endX, endY);
      }
    };
    
    requestAnimationFrame(animate);
  };

  const checkHit = (x: number, y: number) => {
    let hitHole: Hole | null = null;
    
    for (const hole of holes) {
      if (
        x >= hole.x && 
        x <= hole.x + hole.width &&
        y >= hole.y && 
        y <= hole.y + hole.height
      ) {
        hitHole = hole;
        break;
      }
    }
    
    if (hitHole) {
      setShotResult({ hit: true, points: hitHole.points, holeId: hitHole.id });
    } else {
      setShotResult({ hit: false, points: -5, holeId: null });
    }
    
    setTimeout(() => {
      setIsAnimating(false);
      setPhase("result");
      // Bei Treffer: Punkte gewinnen, bei Miss: 5 Punkte verlieren
      onComplete?.(hitHole !== null, hitHole ? hitHole.points : -5);
    }, 500);
  };

  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Background - Stadion */}
      <div className="absolute inset-0 bg-gradient-to-b from-green-900 via-green-800 to-green-700" />
      
      {/* Rasen-Textur */}
      <div className="absolute inset-0 opacity-30">
        <div className="w-full h-full" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 20px)'
        }} />
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 w-full h-full flex flex-col">
        {/* Top Badge */}
        <div className="px-3 pt-5 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full">
            <Target className="w-4 h-4 text-sport" />
            <span className="text-xs font-bold text-white">GOAL WALL</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-sport rounded-full">
            <Coins className="w-4 h-4 text-white" />
            <span className="text-sm font-black text-white">+{maxReward}</span>
          </div>
        </div>

        {/* Game Area */}
        <div className="flex-1 flex flex-col justify-center p-4">
          {/* Intro Phase */}
          {phase === "intro" && (
            <div className="flex flex-col items-center">
              {/* Tor Preview */}
              <div className="w-full max-w-[280px] aspect-[4/3] bg-cream/10  border-4 border-white/30 relative mb-6 overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-6xl">🥅</span>
                </div>
                {/* Löcher andeuten - 4 Ecken RUND */}
                <div className="absolute top-[5%] left-[3%] w-[20%] h-[22%] bg-black/60 rounded-full flex items-center justify-center border-2 border-white/40">
                  <span className="text-sport font-bold text-sm">15</span>
                </div>
                <div className="absolute top-[5%] right-[3%] w-[20%] h-[22%] bg-black/60 rounded-full flex items-center justify-center border-2 border-white/40">
                  <span className="text-sport font-bold text-sm">15</span>
                </div>
                <div className="absolute bottom-[23%] left-[3%] w-[20%] h-[22%] bg-black/60 rounded-full flex items-center justify-center border-2 border-white/40">
                  <span className="text-yellow-400 font-bold text-sm">10</span>
                </div>
                <div className="absolute bottom-[23%] right-[3%] w-[20%] h-[22%] bg-black/60 rounded-full flex items-center justify-center border-2 border-white/40">
                  <span className="text-yellow-400 font-bold text-sm">10</span>
                </div>
              </div>

              <h2 className="text-white font-bold text-xl mb-2 text-center">Goal Wall Shooting</h2>
              <p className="text-white/70 text-sm text-center mb-6">
                Drag to aim, release to shoot!<br/>
                Hit the holes to win points!
              </p>

              <button
                onClick={handleStart}
                disabled={disabled}
                className="w-20 h-20 rounded-full bg-sport hover:bg-sport-dark hover:scale-110 transition-all flex items-center justify-center shadow-2xl"
              >
                <Play className="w-10 h-10 text-white ml-1" fill="white" />
              </button>
            </div>
          )}

          {/* Aiming/Shooting Phase */}
          {(phase === "aiming" || phase === "shooting") && (
            <div className="flex flex-col items-center">
              {/* Zielanzeige OBEN - sichtbar über dem Daumen */}
              {phase === "aiming" && (
                <div className="mb-2 px-4 py-2 bg-black/70 backdrop-blur-sm rounded-full flex items-center gap-3">
                  <span className="text-white/60 text-sm">Aiming at:</span>
                  {(() => {
                    const targetHole = holes.find(hole => 
                      targetPosition.x >= hole.x && 
                      targetPosition.x <= hole.x + hole.width &&
                      targetPosition.y >= hole.y && 
                      targetPosition.y <= hole.y + hole.height
                    );
                    return targetHole ? (
                      <span className="text-green-400 font-bold text-lg">+{targetHole.points} ✓</span>
                    ) : (
                      <span className="text-red-400 font-bold text-sm">No target</span>
                    );
                  })()}
                </div>
              )}
              
              <div 
                ref={gameAreaRef}
                className="w-full max-w-[320px] mx-auto aspect-[3/4] relative touch-none select-none"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleTouchStart}
                onMouseMove={handleTouchMove}
                onMouseUp={handleTouchEnd}
                onMouseLeave={() => isDragging && handleTouchEnd()}
              >
              {/* Tor */}
              <div className="absolute top-0 left-0 right-0 h-[80%] border-4 border-white rounded-t-lg bg-black/20">
                {/* Tornetz-Muster */}
                <div className="absolute inset-0 opacity-20" style={{
                  backgroundImage: 'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
                  backgroundSize: '20px 20px'
                }} />
                
                {/* Löcher - RUND wie echte Torwand */}
                {holes.map((hole) => {
                  const isHit = shotResult.holeId === hole.id;
                  const isTopRow = hole.y < 30;
                  return (
                    <div
                      key={hole.id}
                      className={`absolute rounded-full flex flex-col items-center justify-center transition-all duration-300 ${
                        isHit 
                          ? 'bg-sport ring-4 ring-sport/50 scale-110' 
                          : 'bg-black/90 border-4 border-white/60'
                      }`}
                      style={{
                        left: `${hole.x}%`,
                        top: `${hole.y}%`,
                        width: `${hole.width}%`,
                        height: `${hole.height}%`
                      }}
                    >
                      <span className={`font-black text-base ${isTopRow ? 'text-sport' : 'text-yellow-400'}`}>
                        {hole.points}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Schussbereich */}
              <div className="absolute bottom-0 left-0 right-0 h-[20%] bg-green-600/50 rounded-b-lg flex items-center justify-center">
                <span className="text-white/50 text-xs font-bold">SHOOT FROM HERE</span>
              </div>

              {/* Ziellinie */}
              {phase === "aiming" && isDragging && (
                <div 
                  className="absolute w-0.5 bg-cream/30 pointer-events-none"
                  style={{
                    left: `${ballPosition.x}%`,
                    bottom: `${100 - ballPosition.y}%`,
                    height: `${ballPosition.y - targetPosition.y}%`,
                    transform: 'translateX(-50%)',
                  }}
                />
              )}

              {/* Zielkreuz */}
              {phase === "aiming" && (
                (() => {
                  // Prüfen ob Ziel über einem Loch ist
                  const targetHole = holes.find(hole => 
                    targetPosition.x >= hole.x && 
                    targetPosition.x <= hole.x + hole.width &&
                    targetPosition.y >= hole.y && 
                    targetPosition.y <= hole.y + hole.height
                  );
                  const isOnTarget = !!targetHole;
                  
                  return (
                    <div 
                      className={`absolute w-10 h-10 pointer-events-none transition-all ${isOnTarget ? 'scale-125' : ''}`}
                      style={{
                        left: `${targetPosition.x}%`,
                        top: `${targetPosition.y}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                    >
                      <div className={`w-full h-full border-3 rounded-full ${isOnTarget ? 'border-green-400 bg-green-400/20' : 'border-sport animate-pulse'}`} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className={`w-3 h-3 rounded-full ${isOnTarget ? 'bg-green-400' : 'bg-sport'}`} />
                      </div>
                      {isOnTarget && (
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-green-500 px-2 py-0.5 rounded text-xs font-bold text-white whitespace-nowrap">
                          +{targetHole.points}!
                        </div>
                      )}
                    </div>
                  );
                })()
              )}

              {/* Ball */}
              <div 
                className="absolute w-8 h-8 pointer-events-none transition-all"
                style={{
                  left: `${ballPosition.x}%`,
                  top: `${ballPosition.y}%`,
                  transform: 'translate(-50%, -50%)',
                  transition: phase === "shooting" ? 'none' : 'all 0.1s'
                }}
              >
                <span className="text-3xl">⚽</span>
              </div>

              {/* Anleitung */}
              {phase === "aiming" && !isDragging && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-black/70 backdrop-blur-sm px-4 py-2 rounded-full">
                    <p className="text-white text-sm font-bold">👆 Drag to aim</p>
                  </div>
                </div>
              )}
              </div>
            </div>
          )}

          {/* Result Phase */}
          {phase === "result" && (
            <div className="flex flex-col items-center">
              {shotResult.hit ? (
                <>
                  <div className="w-20 h-20 rounded-full bg-sport/30 flex items-center justify-center mb-4 animate-bounce">
                    <Trophy className="w-10 h-10 text-sport" />
                  </div>
                  <h2 className="text-white font-bold text-2xl mb-2">GOAL! 🎉</h2>
                  <p className="text-sport font-black text-4xl mb-2">+{shotResult.points}</p>
                  <p className="text-white/70 text-sm mb-6">You hit the target!</p>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-full bg-red-500/30 flex items-center justify-center mb-4">
                    <X className="w-10 h-10 text-red-400" />
                  </div>
                  <h2 className="text-white font-bold text-2xl mb-2">MISSED!</h2>
                  <p className="text-red-400 font-black text-xl mb-2">-5 P</p>
                  <p className="text-white/70 text-sm mb-6">Try again!</p>
                </>
              )}
              
              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setPhase("aiming");
                    setBallPosition({ x: 50, y: 85 });
                    setTargetPosition({ x: 50, y: 50 });
                    setShotResult({ hit: false, points: 0, holeId: null });
                    onStart?.(maxReward);
                  }}
                  className="px-5 py-3 bg-sport hover:bg-sport-dark  font-bold text-white transition-all flex items-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  Play Again
                </button>
                <button
                  onClick={() => {
                    setPhase("intro");
                    setBallPosition({ x: 50, y: 85 });
                    setTargetPosition({ x: 50, y: 50 });
                    setShotResult({ hit: false, points: 0, holeId: null });
                  }}
                  className="px-5 py-3 bg-cream/10 hover:bg-cream/20 border border-white/30  font-bold text-white transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
