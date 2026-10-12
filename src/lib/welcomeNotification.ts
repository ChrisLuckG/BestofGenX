// The welcome notification is virtual: it is not a Notification row, so it also
// reaches accounts created before it existed - and guests, who have no row at all.
// Client-safe: no DB imports, so client components can use it too.
export const WELCOME_NOTIFICATION_ID = 'welcome-message';

// Guests cannot store a dismissal server-side, so it lives in localStorage
export const WELCOME_GUEST_DISMISSED_KEY = 'bogx-welcome-dismissed';

// Read and dismissed are NOT the same thing: reading only clears the unread
// badge and the highlight, the message stays in the list. Dismissing removes it.
// Members get this via the server's `readIds`; guests have no row, so it is
// remembered locally.
export const WELCOME_GUEST_READ_KEY = 'bogx-welcome-read';

// Track if user has seen the welcome page on first visit.
// Once they've seen it once, we don't auto-show it again.
export const WELCOME_SEEN_KEY = 'bogx-welcome-seen';

/**
 * Check if this is the user's first visit (welcome page not yet seen).
 * Returns true if the welcome page should be auto-shown.
 */
export function isFirstVisit(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !localStorage.getItem(WELCOME_SEEN_KEY);
  } catch {
    return false; // Private mode or localStorage blocked
  }
}

/**
 * Mark the welcome page as seen so it won't auto-show again.
 */
export function markWelcomeSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WELCOME_SEEN_KEY, 'true');
  } catch {
    // Private mode - ignore
  }
}

export const WELCOME_TITLE = 'Welcome to Best of GenX!';

export function welcomeMessage(username?: string): string {
  const greeting = username ? `Hey ${username}!` : 'Welcome!';
  return `${greeting} Play trivia, battle other players, vote on rankings and climb the daily leaderboard.`;
}
