"use client";

import { ReactNode } from "react";

interface DesktopContentWrapperProps {
  children: ReactNode;
  backgroundImage?: string;
  transparent?: boolean;
}

// Wrapper that applies consistent desktop styling to any content
export default function DesktopContentWrapper({ children, backgroundImage, transparent }: DesktopContentWrapperProps) {
  return (
    <div 
      className={`h-full flex flex-col overflow-hidden desktop-content-override ${transparent ? '' : backgroundImage ? 'bg-cover bg-center bg-no-repeat' : 'bg-[#F5F0E8]'}`}
      style={backgroundImage ? { backgroundImage: `url(${backgroundImage})`, minHeight: '100%' } : undefined}
    >
      {children}
      <style jsx global>{`
        /* Override mobile styles for desktop content */
        .desktop-content-override .bg-cream {
          background-color: transparent !important;
        }
        .desktop-content-override > div > .bg-cream:first-child {
          background: linear-gradient(to bottom, rgba(212, 135, 58, 0.05), transparent) !important;
        }
        .desktop-content-override .bg-white {
          background-color: #F5F0E8 !important;
        }
        .desktop-content-override [class*="bg-white\\/"] {
          background-color: rgba(245, 240, 232, 0.5) !important;
        }
      `}</style>
    </div>
  );
}
