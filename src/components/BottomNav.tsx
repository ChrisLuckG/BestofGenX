"use client";

import { Play, FileText, Swords, Vote, ShoppingBag, Trophy, User, Tv } from "lucide-react";
import { sounds } from "@/utils/sounds";

export type NavTab = "home" | "feed" | "articles" | "arcade" | "voting" | "shop" | "rankings" | "profile" | "notifications" | "battles" | "tv" | "rewards" | "radio";

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  userAvatar?: string;
  profileHighlighted?: boolean;
  lockedToTab?: NavTab; // Lock navigation to this tab (e.g. during active battle)
}

const tabs = [
  { id: "home" as NavTab, label: "Feed", icon: Play },
  { id: "arcade" as NavTab, label: "Arcade", image: "/images/Icon/trivia1.png", imageActive: "/images/Icon/trivia2.png" },
  { id: "articles" as NavTab, label: "Articles", icon: FileText },
  { id: "voting" as NavTab, label: "Rankroll", icon: Vote },
  { id: "shop" as NavTab, label: "Shop", icon: ShoppingBag },
];

export default function BottomNav({ activeTab, onTabChange, userAvatar, profileHighlighted, lockedToTab }: BottomNavProps) {
  return (
    <div className="flex-shrink-0 flex items-center bg-cream border-t border-warm" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}>
      {tabs.map((tab, index) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        
        // Check if this tab is locked (disabled during active battle)
        const isLocked = lockedToTab && tab.id !== lockedToTab;
        
        return (
          <div key={tab.id} className="flex-1 flex items-center justify-center">
            {/* Separator before item (except first) */}
            {index > 0 && <div className="w-px h-6 bg-gray-300 -ml-px" />}
            
            <button
              onClick={() => { if (isLocked) return; sounds.click(); onTabChange(tab.id); }}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-all ${
                isLocked ? "opacity-30 cursor-not-allowed" : ""
              }`}
            >
              {tab.image ? (
                <img 
                  src={isActive && tab.imageActive ? tab.imageActive : tab.image} 
                  alt="" 
                  className={`w-6 h-6 object-contain transition-all ${isActive ? '' : 'opacity-70'}`}
                  style={{ filter: isActive ? 'none' : 'contrast(1.5)' }}
                />
              ) : Icon ? (
                <Icon className={`w-6 h-6 ${isActive ? 'text-[#D4873A]' : 'text-gray-700'}`} />
              ) : null}
              <span className={`text-[10px] font-bold`} style={{ color: isActive ? '#D4873A' : '#374151' }}>
                {tab.label}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
