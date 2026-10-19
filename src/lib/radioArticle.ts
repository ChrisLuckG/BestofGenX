// The Community Radio article: what it is built from and how it is asked for.
//
// One definition for the Articles tab's Radio window (RadioModal) and for Daily Auto, so that a
// refinement of the brief reaches both. Dependency-free: client and server can import it.
//
// The article itself is written by /api/editorial/chat with `articleMode: true` and
// `skipYoutube: true` (a music piece: Spotify embeds instead of a YouTube search, @username
// highlighting) plus `spotifyLinks`. Nothing here touches YouTube, so the radio article does
// not spend any of the daily YouTube search quota.

export interface RadioSong {
  username: string;
  playlist: string;
  band: string;
  song: string;
  link?: string;
  coverImage?: string;
}

/** Tag Daily Auto puts on the radio articles it makes, to find the previous one. */
export const RADIO_TAG = 'community-radio';

/** Songs the model gets to write about, as `spotifyLinks` for the chat route. */
export const radioSpotifyLinks = (songs: RadioSong[]) =>
  songs.map(s => ({ song: s.song, band: s.band, link: s.link, coverImage: s.coverImage }));

export function buildRadioPrompt(songs: RadioSong[]): string {
  const songList = songs
    .map(r => `- "${r.song}" by ${r.band} (requested by @${r.username} for ${r.playlist})${r.link ? ` [SPOTIFY: ${r.link}]` : ''}`)
    .join('\n');

  return `Write a "Community Radio" article celebrating the songs our readers requested this month.

SONG REQUESTS FROM OUR COMMUNITY:
${songList}

Write an engaging article that:
1. Thanks our community for their great taste in music
2. Groups songs by genre/mood/era if possible
3. Tells a short story or fun fact about 3-5 of the most interesting songs
4. Mentions the usernames who requested them (they'll love seeing their name!)
5. Encourages more song requests

IMPORTANT FORMATTING:
- For each section, use "spotifyEmbed" instead of "youtubeSearch"
- Use the SPOTIFY links provided above (the [SPOTIFY: ...] URLs)
- DO NOT search for YouTube videos - this is a MUSIC article with Spotify embeds only

Tone: Warm, appreciative, music-nerd enthusiastic. Like a DJ thanking callers.
Category: music
Length: 800-1200 words

IMPORTANT: Generate a full article, NOT a birthday proposal. This is about the SONGS listed above.`;
}

// ---- Daily Auto: which songs, and whether it is time ---------------------------------------

/** An automatic run needs at least this many NEW songs; a person at the modal decides for themselves. */
export const RADIO_MIN_SONGS = 3;
/** At most one automatic radio article per this many days (the slot may be on every day). */
export const RADIO_MIN_DAYS = 7;
/** With no earlier radio article to measure from, only songs added this recently count. */
export const RADIO_FIRST_RUN_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Which songs go into the next radio article - or why nothing is made.
 *  - manual (Run now / Rerun): everything marked "Added", exactly what the Radio window uses
 *  - automatic: only songs added AFTER the previous radio article (the earlier articles all reused
 *    the same songs), no more than one article a week, and at least RADIO_MIN_SONGS new songs
 */
export function planRadio(
  songs: (RadioSong & { updatedAt?: Date | string })[],
  previousAt: Date | null,
  now: Date,
  manual: boolean,
): { songs: RadioSong[]; skip: string | null } {
  if (manual) {
    return songs.length ? { songs, skip: null } : { songs: [], skip: 'No songs are marked "Added"' };
  }
  if (previousAt && now.getTime() - previousAt.getTime() < RADIO_MIN_DAYS * DAY_MS) {
    const days = Math.max(0, Math.floor((now.getTime() - previousAt.getTime()) / DAY_MS));
    return { songs: [], skip: `the last radio article is only ${days} day${days === 1 ? '' : 's'} old (one a week)` };
  }
  const since = previousAt ?? new Date(now.getTime() - RADIO_FIRST_RUN_DAYS * DAY_MS);
  const fresh = songs.filter(s => s.updatedAt && new Date(s.updatedAt).getTime() > since.getTime());
  if (fresh.length < RADIO_MIN_SONGS) {
    return { songs: [], skip: `only ${fresh.length} new song${fresh.length === 1 ? '' : 's'} since ${since.toISOString().slice(0, 10)} (need ${RADIO_MIN_SONGS})` };
  }
  return { songs: fresh, skip: null };
}
