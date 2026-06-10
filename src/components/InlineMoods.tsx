"use client";

interface InlineMoodsProps {
  count: number;
  size?: 'xs' | 'sm' | 'md';
}

const SIZES = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4', 
  md: 'w-5 h-5',
};

const TEXT_SIZES = {
  xs: 'text-[8px]',
  sm: 'text-xs',
  md: 'text-sm',
};

// Use actual mood images from /images/moods/
const MOOD_IMAGES = [
  '/images/moods/rockstar.png',
  '/images/moods/goth.png',
];

export default function InlineMoods({ count, size = 'sm' }: InlineMoodsProps) {
  const imgSize = SIZES[size];
  const textSize = TEXT_SIZES[size];
  
  return (
    <span className="flex items-center gap-1">
      <span className="flex items-center -space-x-1">
        {MOOD_IMAGES.map((src, i) => (
          <img key={i} src={src} alt="" className={`${imgSize} rounded-full`} />
        ))}
      </span>
      <span className={`font-medium ${textSize}`}>{count}</span>
    </span>
  );
}
