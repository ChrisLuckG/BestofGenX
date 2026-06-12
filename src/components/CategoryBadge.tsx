"use client";

// Category labels mapping
const CATEGORY_LABELS: Record<string, string> = {
  // Main categories
  'articles': 'Articles',
  'shop': 'Shop',
  'rewind': 'Rewind',
  'arcade': 'Arcade',
  // Sub categories
  'movies-tv': 'Movies & TV',
  'music': 'Music',
  'gaming': 'Gaming',
  'sports': 'Sports',
  'tech': 'Tech',
  'fashion': 'Fashion',
  'food': 'Food',
  'travel': 'Travel',
  'culture': 'Culture',
  'lifestyle': 'Lifestyle',
};

interface CategoryBadgeProps {
  category: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function CategoryBadge({ category, size = 'md', className = '' }: CategoryBadgeProps) {
  const label = CATEGORY_LABELS[category] || category;
  
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[8px]',
    md: 'px-2 py-1 text-[9px]',
    lg: 'px-3 py-1.5 text-[10px]',
  };

  return (
    <span 
      className={`
        inline-flex items-center 
        bg-[#D4873A]/70 backdrop-blur-sm border border-[#D4873A] 
        text-white font-bold uppercase tracking-wider rounded-sm
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {label}
    </span>
  );
}
