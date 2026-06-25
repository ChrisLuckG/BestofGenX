// Central mood configuration - change icons here to update everywhere
// Images are in /public/images/moods/
export const GENX_MOODS = [
  { id: 'whatever', image: '/images/moods/goth.png', label: 'Whatever' },
  { id: 'meh', image: '/images/moods/grunge.png', label: 'Meh' },
  { id: 'ok', image: '/images/moods/newwave.png', label: 'Fair Enough' },
  { id: 'cool', image: '/images/moods/rockstar.png', label: 'Cool' },
  { id: 'fire', image: '/images/moods/skater.png', label: 'Hall of Fame' },
];

// Default mood shown when no reactions exist
export const DEFAULT_MOOD = GENX_MOODS[2]; // 'ok' - yellow smiley (Fair Enough)

// Helper to find mood by id
export const getMoodById = (id: string) => GENX_MOODS.find(m => m.id === id);
