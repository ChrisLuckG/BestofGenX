"use client";

import { getCategoryLabel } from "@/lib/categories";

interface CategoryBadgeProps {
  category: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  countryCode?: string;
  countryName?: string;
}

export default function CategoryBadge({ category, size = 'md', className = '', countryCode, countryName }: CategoryBadgeProps) {
  const label = getCategoryLabel(category) || category;
  
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[8px]',
    md: 'px-2 py-1 text-[9px]',
    lg: 'px-3 py-1.5 text-[10px]',
  };

  const flagSizes = {
    sm: { width: 32, height: 24, imgClass: 'w-7 h-5' },
    md: { width: 40, height: 30, imgClass: 'w-8 h-6' },
    lg: { width: 48, height: 36, imgClass: 'w-10 h-[30px]' },
  };

  const flagSize = flagSizes[size];

  return (
    <div className="inline-flex items-center gap-1.5">
      {/* Flag first (if exists) - no background, just the flag */}
      {countryCode && (
        <span 
          className="inline-flex items-center justify-center group/flag relative"
          title={countryName}
        >
          <img 
            src={`https://flagcdn.com/${flagSize.width}x${flagSize.height}/${countryCode.toLowerCase()}.png`}
            alt={countryName || ''}
            className={`${flagSize.imgClass} object-cover rounded-sm shadow-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]`}
            style={{ border: '1px solid rgba(255,255,255,0.5)' }}
          />
          {/* Tooltip on hover */}
          {countryName && (
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black/90 text-white text-[10px] font-medium rounded whitespace-nowrap opacity-0 group-hover/flag:opacity-100 transition-opacity pointer-events-none z-50">
              {countryName}
            </span>
          )}
        </span>
      )}
      {/* Category */}
      <span 
        className={`
          inline-flex items-center 
          bg-[#D4873A] backdrop-blur-sm border border-[#D4873A] 
          text-white font-bold uppercase tracking-wider rounded-sm
          ${sizeClasses[size]}
          ${className}
        `}
      >
        {label}
      </span>
    </div>
  );
}
