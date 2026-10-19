// Where a push notification (or any "open this in the app" link) leads. ALWAYS into the app, never to a
// standalone page: "/?..." hits the device redirect (app/page.tsx), which keeps the parameters and sends
// a phone to /mobile and a computer to /desktop; both shells read the same parameters and open the
// screen (an article in the app, where people can comment, vote and play on). A running app gets the
// same URL by postMessage from the service worker (public/sw.js).
//
// Before: "/article/<id>" opened the bare standalone article page, "/battles" and "/notifications" were
// 404s, and "/mobile?..." put a desktop user into the phone layout.
// Dependency-free; scripts/check-push-links.ts makes sure every push uses these.

export const appLink = {
  home: () => '/',
  article: (id: string) => `/?article=${encodeURIComponent(id)}`,
  /** A battle challenge: opens the challenge (confirm before playing) */
  battle: (id: string) => `/?battle=${encodeURIComponent(id)}`,
  battles: () => '/?tab=battles',
  notifications: () => '/?tab=notifications',
  rankings: () => '/?tab=rankings',
  arcade: () => '/?tab=arcade',
  /** Radio / song requests */
  radio: () => '/?tab=radio',
  /** GenX TV (desktop; the phone app opens its feed) */
  tv: () => '/?tab=tv',
} as const;
