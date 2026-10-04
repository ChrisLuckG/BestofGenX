// Central author/writing style configuration - use everywhere for consistency.
//
// Deliberately FOUR author voices plus the neutral baseline. The list used to offer 16
// names while only 7 had an actual voice brief, so nine of them silently produced house
// voice - picking "Murakami" and picking "Informative" gave the same article.
//
// Selection criterion is HUMOUR, not literary prestige: every one of the four has a
// MUST BE FUNNY clause in its brief. Joan Didion was considered and rejected because
// her voice bans humour by design.
//
// Every id here must have a brief in src/lib/authorStylePrompts.ts;
// scripts/check-author-styles.ts asserts that the two lists match.
//
// 'informative' is NOT an author - it is "no voice, just report it", and it stays the
// default. Removing it would break DEFAULT_AUTHOR_STYLE and the `|| 'informative'`
// fallbacks in the generation routes.
// No emoji field on purpose. The dropdowns used to prefix every entry with one, and the
// country flags did not even render as flags in the admin selects - they came out as
// letter boxes ("DE Stuckrad-Barré", "HR Slavenka Drakulić"). The label alone is what
// identifies an author.
export const AUTHOR_STYLES = [
  { id: 'informative', label: 'Informative', description: 'Factual, plain, no cheerleading' },
  { id: 'irvine-welsh', label: 'Irvine Welsh', description: 'Dark pub humour, raw, takes the piss' },
  { id: 'benjamin-stuckrad-barre', label: 'Stuckrad-Barré', description: 'Manic irony, name-dropping, Berlin pop' },
  { id: 'nora-ephron', label: 'Nora Ephron', description: 'Charming wit, warm, laughs at funerals' },
  { id: 'slavenka-drakulic', label: 'Slavenka Drakulić', description: 'Dry irony, political, humour of survival' },
] as const;

export type AuthorStyleId = typeof AUTHOR_STYLES[number]['id'];

// Default style
export const DEFAULT_AUTHOR_STYLE: AuthorStyleId = 'informative';

// Helper to find style by id
export const getAuthorStyleById = (id: string) => AUTHOR_STYLES.find(s => s.id === id);
