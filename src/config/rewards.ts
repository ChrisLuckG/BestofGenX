// BOGX reward amounts.
//
// These live here because BOTH sides need them: the API routes award the amount,
// and the UI now plays the coin animation immediately on click instead of waiting
// for the response. If the client guessed the amount it would drift from the
// server the moment one of them changes, so there is exactly one source.
export const REACTION_REWARD = 0.01; // per article, once per user
export const VIDEO_REWARD = 0.02; // per embedded video, once per user
