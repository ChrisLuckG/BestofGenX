"use client";

import { FileText } from "lucide-react";
import { ReactNode, isValidElement } from "react";
import PageHeader from "./PageHeader";
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
        <PageHeader
          className="flex-shrink-0"
          icon={isValidElement(icon) ? icon : FileText}
          title={title}
          onBack={onBack ? () => { sounds.click(); onBack(); } : undefined}
          right={rightAction}
        />
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-none" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {children}
      </div>
    </div>
  );
}
