import { useEffect, useRef } from 'react';

/**
 * Intercepts the browser/system back button (Android, browser back).
 * When `isOpen` is true, pushes a history entry. If the user hits back,
 * `onBack` is called instead of leaving the app/page.
 *
 * Strategy: push a marker on open. On user back press, popstate fires and we
 * call onBack. On programmatic close (app button), we leave the marker in
 * history - the user's next back press will harmlessly pop it (no listener).
 *
 * Usage:
 *   useBackButton(isOverlayOpen, () => setOverlayOpen(false));
 */
export function useBackButton(isOpen: boolean, onBack: () => void) {
  // Stable ref so the effect doesn't re-run when onBack identity changes
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === 'undefined') return;

    const stateMarker = { __overlay: Date.now() + Math.random() };
    let didPushState = false;

    // Only push state if current state isn't already our marker (avoid stacking)
    const currentState = window.history.state as { __overlay?: number } | null;
    if (!currentState || !currentState.__overlay) {
      window.history.pushState(stateMarker, '');
      didPushState = true;
    }

    const handlePopState = () => {
      onBackRef.current();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // We intentionally do NOT call history.back() here. Doing so triggers
      // a popstate that React Strict Mode (or rapid re-renders) can't
      // distinguish from a real user back press, causing infinite close loops.
      // The dummy entry remains in history; user's next back press is a no-op.
      void didPushState;
    };
  }, [isOpen]);
}
