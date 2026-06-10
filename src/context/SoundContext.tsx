"use client";

import { createContext, useContext, ReactNode } from "react";
import { useSounds } from "@/hooks/useSounds";

interface SoundContextType {
  playSound: (type: "coinWin" | "coinLose" | "correct" | "wrong" | "click" | "countdown" | "bonus" | "levelUp" | "swipe") => void;
  toggleSound: (enabled: boolean) => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

export function SoundProvider({ children }: { children: ReactNode }) {
  const { playSound, toggleSound } = useSounds();

  return (
    <SoundContext.Provider value={{ playSound, toggleSound }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  const context = useContext(SoundContext);
  if (context === undefined) {
    throw new Error("useSound must be used within a SoundProvider");
  }
  return context;
}
