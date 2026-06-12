// Central author/writing style configuration - use everywhere for consistency
export const AUTHOR_STYLES = [
  { id: 'informative', label: 'Sachlich', emoji: '📰', description: 'Factual, objective, encyclopedia-style' },
  { id: 'irvine-welsh', label: 'Irvine Welsh', emoji: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', description: 'Scottish dialect, raw, Trainspotting-style' },
  { id: 'charles-bukowski', label: 'Charles Bukowski', emoji: '🥃', description: 'Gritty, raw, poetic realism' },
  { id: 'benjamin-stuckrad-barre', label: 'Stuckrad-Barré', emoji: '🇩🇪', description: 'German pop literature, witty, ironic' },
  { id: 'hunter-thompson', label: 'Hunter S. Thompson', emoji: '🦇', description: 'Gonzo journalism, wild, subjective' },
  { id: 'bret-easton-ellis', label: 'Bret Easton Ellis', emoji: '💊', description: 'Minimalist, detached, 80s excess' },
  { id: 'douglas-coupland', label: 'Douglas Coupland', emoji: '📺', description: 'Gen X voice, pop culture, ironic' },
] as const;

export type AuthorStyleId = typeof AUTHOR_STYLES[number]['id'];

// Default style
export const DEFAULT_AUTHOR_STYLE: AuthorStyleId = 'informative';

// Helper to find style by id
export const getAuthorStyleById = (id: string) => AUTHOR_STYLES.find(s => s.id === id);
