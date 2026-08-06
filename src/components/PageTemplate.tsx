"use client";

import { ChevronLeft } from "lucide-react";
import { ReactNode } from "react";
import { sounds } from "@/utils/sounds";

interface PageTemplateProps {
  title: string;
  icon?: ReactNode;
  onBack?: () => void;
  children: ReactNode;
  rightAction?: ReactNode;
  noPadding?: boolean;
  hideHeader?: boolean;
}

export default function PageTemplate({ title, icon, onBack, children, rightAction, noPadding, hideHeader }: PageTemplateProps) {
  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-cream">
      {/* Header - Fixed */}
      {!hideHeader && (
      <div className="flex items-center justify-between px-3 pt-4 pb-3 border-b border-warm flex-shrink-0 sticky top-0 z-50 bg-cream">
        {onBack ? (
          <button 
            onClick={() => { sounds.click(); onBack(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E36B11] rounded-lg text-white text-sm font-semibold hover:bg-[#c06a2a] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        ) : (
          <div className="w-16" />
        )}
        <div className="flex items-center gap-2">
          {icon}
          <h1 className="text-lg font-bold text-gray-900">{title}</h1>
        </div>
        <div className="w-16 flex justify-end">
          {rightAction}
        </div>
      </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-none" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {children}
      </div>
    </div>
  );
}
