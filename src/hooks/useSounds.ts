"use client";

import { useCallback, useRef, useEffect } from "react";

// Generate sounds using Web Audio API (no external files needed)
const createOscillatorSound = (
  audioContext: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume: number = 0.3
) => {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = frequency;
  oscillator.type = type;
  
  gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
};

// Singleton AudioContext
let globalAudioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  
  try {
    if (!globalAudioContext) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn("AudioContext not supported");
        return null;
      }
      globalAudioContext = new AudioContextClass();
      console.log("AudioContext created:", globalAudioContext.state);
    }
    return globalAudioContext;
  } catch (e) {
    console.error("Failed to create AudioContext:", e);
    return null;
  }
};

// Must be called from a user interaction (click/touch) to enable audio on mobile
const resumeAudioContext = async () => {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    try {
      await ctx.resume();
      console.log("AudioContext resumed successfully");
    } catch (e) {
      console.error("Failed to resume AudioContext:", e);
    }
  }
};

type SoundType = "coinWin" | "coinLose" | "correct" | "wrong" | "click" | "countdown" | "bonus" | "levelUp" | "swipe";

export function useSounds() {
  const enabledRef = useRef(true);
  const initializedRef = useRef(false);

  // Initialize audio on first user interaction
  useEffect(() => {
    const initAudio = () => {
      if (!initializedRef.current) {
        resumeAudioContext();
        initializedRef.current = true;
      }
    };
    
    document.addEventListener("click", initAudio);
    document.addEventListener("touchstart", initAudio);
    
    return () => {
      document.removeEventListener("click", initAudio);
      document.removeEventListener("touchstart", initAudio);
    };
  }, []);

  const playSound = useCallback(async (type: SoundType) => {
    if (!enabledRef.current) return;
    
    try {
      // Always try to resume first (for mobile)
      await resumeAudioContext();
      
      const ctx = getAudioContext();
      if (!ctx) {
        console.warn("No AudioContext available");
        return;
      }
      
      console.log("Playing sound:", type, "AudioContext state:", ctx.state);
    
    switch (type) {
      case "coinWin":
        // Ascending arpeggio - happy coin sound
        [523, 659, 784, 1047].forEach((freq, i) => {
          setTimeout(() => {
            createOscillatorSound(ctx, freq, 0.15, "sine", 0.5);
          }, i * 50);
        });
        break;
        
      case "coinLose":
        // Descending - sad sound
        [400, 350, 300].forEach((freq, i) => {
          setTimeout(() => {
            createOscillatorSound(ctx, freq, 0.2, "triangle", 0.4);
          }, i * 100);
        });
        break;
        
      case "correct":
        // Two-tone success
        createOscillatorSound(ctx, 523, 0.1, "sine", 0.5);
        setTimeout(() => createOscillatorSound(ctx, 784, 0.2, "sine", 0.5), 100);
        break;
        
      case "wrong":
        // Buzzer sound
        createOscillatorSound(ctx, 200, 0.3, "sawtooth", 0.4);
        break;
        
      case "click":
        // Short click
        createOscillatorSound(ctx, 800, 0.05, "sine", 0.3);
        break;
        
      case "countdown":
        // Tick sound
        createOscillatorSound(ctx, 1000, 0.08, "sine", 0.4);
        break;
        
      case "bonus":
        // Fanfare-like
        [523, 659, 784, 1047, 1319].forEach((freq, i) => {
          setTimeout(() => {
            createOscillatorSound(ctx, freq, 0.2, "sine", 0.5);
          }, i * 80);
        });
        break;
        
      case "levelUp":
        // Triumphant ascending
        [392, 494, 587, 784].forEach((freq, i) => {
          setTimeout(() => {
            createOscillatorSound(ctx, freq, 0.25, "sine", 0.2);
          }, i * 120);
        });
        break;
        
      case "swipe":
        // Whoosh-like
        createOscillatorSound(ctx, 400, 0.1, "sine", 0.08);
        setTimeout(() => createOscillatorSound(ctx, 600, 0.08, "sine", 0.05), 50);
        break;
    }
    } catch (e) {
      console.warn("Sound playback failed:", e);
    }
  }, []);

  const toggleSound = useCallback((enabled: boolean) => {
    enabledRef.current = enabled;
  }, []);

  return { playSound, toggleSound };
}
