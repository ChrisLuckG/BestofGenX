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
        /* There used to be a rule here tinting the first .bg-cream child with
           linear-gradient(rgba(212,135,58,0.05), transparent). It only ever hit
           section headers, and once those were switched from bg-[#E36B11]/5 to
           bg-cream it started applying to every wrapped page - Trivia, TV, Shop -
           so those headers kept a warm gradient while the unwrapped ones (Feed,
           Articles, Rankroll) were flat. Removed to make all headers identical. */
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
