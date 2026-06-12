// Central language configuration - use everywhere for consistency
export const LANGUAGES = [
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'de', label: 'Deutsch', flag: '🇩🇪' },
] as const;

export type LanguageId = typeof LANGUAGES[number]['id'];

// Default language
export const DEFAULT_LANGUAGE: LanguageId = 'en';

// Helper to find language by id
export const getLanguageById = (id: string) => LANGUAGES.find(l => l.id === id);
