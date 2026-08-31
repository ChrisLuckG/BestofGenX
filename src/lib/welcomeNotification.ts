// The welcome notification is virtual: it is not a Notification row, so it also
// reaches accounts created before it existed - and guests, who have no row at all.
// Client-safe: no DB imports, so client components can use it too.
export const WELCOME_NOTIFICATION_ID = 'welcome-message';

// Guests cannot store a dismissal server-side, so it lives in localStorage
export const WELCOME_GUEST_DISMISSED_KEY = 'bogx-welcome-dismissed';

export const WELCOME_TITLE = 'Welcome to Best of GenX!';

export function welcomeMessage(username?: string): string {
  const greeting = username ? `Hey ${username}!` : 'Welcome!';
  return `${greeting} Play trivia, battle other players, vote on rankings and climb the daily leaderboard.`;
}
