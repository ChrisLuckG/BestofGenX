// ONE type scale for the profile screens on desktop: "Player Profile" (PlayerCard, isDesktop)
// and the own "Profile" (ProfilePage, lg: and up).
//
// It follows what the rest of the desktop app already uses: the page title is text-lg (18px,
// PageHeader), the rank list and the sidebar widgets sit between 10 and 14px, the biggest
// figures elsewhere are text-xl. The profile cards used to reach text-5xl (PlayerCard) and
// text-4xl (ProfilePage), then text-3xl after a first correction - still far above the
// page around them. The biggest figure here is text-xl now.
//
// Mobile keeps its own sizes and is deliberately not part of this scale.
//
//   caption    DAY / MONTH / BOGX captions, section captions, row sub-lines     11px
//   secondary  deltas (+1,37)                                                   12px
//   title      list-row titles, country                                         14px
//   heading    section headings (Stats, Account), level name, main button       16px
//   strong     list-row values, level percentage                                18px
//   hero       username, BOGX balance, the rank triple, the main stats triple   20px
//
// Tailwind only generates classes it can read as whole strings, so these are literal.
// ProfilePage cannot use the constants directly (it needs the lg: prefix) and spells out
// the same steps - keep the two in step.
export const PROFILE_TYPE = {
  caption: 'text-[11px]',
  secondary: 'text-xs',
  title: 'text-sm',
  heading: 'text-base',
  strong: 'text-lg',
  hero: 'text-xl',
} as const;
