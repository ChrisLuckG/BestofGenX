// Central author/writing style configuration - use everywhere for consistency
export const AUTHOR_STYLES = [
  { id: 'informative', label: 'Informative', emoji: '📰', description: 'Factual, objective, encyclopedia-style' },
  { id: 'nick-hornby', label: 'Nick Hornby', emoji: '⚽', description: 'Conversational, witty, pop culture obsessed' },
  { id: 'hunter-s-thompson', label: 'Hunter S. Thompson', emoji: '🦇', description: 'Gonzo journalism, wild, intense' },
  { id: 'nora-ephron', label: 'Nora Ephron', emoji: '💕', description: 'Warm, observant, romantic comedy voice' },
  { id: 'charles-bukowski', label: 'Charles Bukowski', emoji: '🥃', description: 'Gritty, raw, poetic realism' },
  { id: 'murakami', label: 'Haruki Murakami', emoji: '🐱', description: 'Dreamy, surreal, melancholic' },
  { id: 'irvine-welsh', label: 'Irvine Welsh', emoji: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', description: 'Scottish dialect, raw, Trainspotting-style' },
  { id: 'joan-didion', label: 'Joan Didion', emoji: '�', description: 'Precise, cool, California noir' },
  { id: 'david-sedaris', label: 'David Sedaris', emoji: '😂', description: 'Humorous, self-deprecating, observational' },
  { id: 'tom-wolfe', label: 'Tom Wolfe', emoji: '🎩', description: 'Flamboyant, detailed, New Journalism' },
  { id: 'zadie-smith', label: 'Zadie Smith', emoji: '🇬🇧', description: 'Sharp, multicultural, London voice' },
  { id: 'slavenka-drakulic', label: 'Slavenka Drakulić', emoji: '🇭🇷', description: 'Political, Eastern European perspective' },
  { id: 'benjamin-stuckrad-barre', label: 'Stuckrad-Barré', emoji: '🇩🇪', description: 'German pop literature, witty, ironic' },
  { id: 'bret-easton-ellis', label: 'Bret Easton Ellis', emoji: '💊', description: 'Minimalist, detached, 80s excess' },
  { id: 'chuck-palahniuk', label: 'Chuck Palahniuk', emoji: '🧼', description: 'Dark, transgressive, Fight Club style' },
  { id: 'douglas-coupland', label: 'Douglas Coupland', emoji: '📺', description: 'Gen X voice, pop culture, ironic' },
] as const;

export type AuthorStyleId = typeof AUTHOR_STYLES[number]['id'];

// Default style
export const DEFAULT_AUTHOR_STYLE: AuthorStyleId = 'informative';

// Helper to find style by id
export const getAuthorStyleById = (id: string) => AUTHOR_STYLES.find(s => s.id === id);
