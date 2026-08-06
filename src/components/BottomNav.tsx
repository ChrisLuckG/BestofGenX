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
  battleAlertCount?: number; // Pending challenges + active battles
}

const tabs = [
  { id: "home" as NavTab, label: "Feed", icon: Play },
  { id: "arcade" as NavTab, label: "Arcade", image: "/images/Icon/trivia1.png", imageActive: "/images/Icon/trivia2.png" },
  { id: "articles" as NavTab, label: "Articles", icon: FileText },
  { id: "voting" as NavTab, label: "Rankroll", icon: Vote },
  { id: "shop" as NavTab, label: "Shop", icon: ShoppingBag },
];

export default function BottomNav({ activeTab, onTabChange, userAvatar, profileHighlighted, lockedToTab, battleAlertCount = 0 }: BottomNavProps) {
  return (
    <div className="flex-shrink-0 flex items-center bg-cream border-t border-warm" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}>
      {tabs.map((tab, index) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const isArcade = tab.id === 'arcade';
        const showBattleBadge = isArcade && battleAlertCount > 0 && !isActive;
        
        // Check if this tab is locked (disabled during active battle)
        const isLocked = lockedToTab && tab.id !== lockedToTab;
        
        return (
          <div key={tab.id} className="flex-1 flex items-center justify-center">
            {/* Separator before item (except first) */}
            {index > 0 && <div className="w-px h-6 bg-gray-300 -ml-px" />}
            
            <button
              onClick={() => { if (isLocked) return; sounds.click(); onTabChange(tab.id); }}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-all relative ${
                isLocked ? "opacity-30 cursor-not-allowed" : ""
              }`}
            >
              {tab.image ? (
                <div className="relative">
                  <img 
                    src={isActive && tab.imageActive ? tab.imageActive : tab.image} 
                    alt="" 
                    className={`w-6 h-6 object-contain transition-all ${isActive ? '' : 'opacity-70'}`}
                    style={{ filter: isActive ? 'none' : 'contrast(1.5)' }}
                  />
                  {showBattleBadge && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] font-black shadow animate-pulse">
                      {battleAlertCount > 9 ? '9+' : battleAlertCount}
                    </span>
                  )}
                </div>
              ) : Icon ? (
                <Icon className={`w-6 h-6 ${isActive ? 'text-[#E36B11]' : 'text-gray-700'}`} />
              ) : null}
              <span className={`text-[10px] font-bold`} style={{ color: isActive ? '#E36B11' : '#374151' }}>
                {tab.label}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
