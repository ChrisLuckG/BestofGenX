// Which author voice writes an automatic person article (Daily Auto). The user's rules (19.10.2026):
//   sport, men            -> Irvine Welsh
//   sport, women          -> one of the two women (Nora Ephron / Slavenka Drakulic), split per person
//   the rest, split by kind: crude / anarchic comedy and loud music (Trey Parker) -> Irvine Welsh,
//   film, TV, pop, art, tech - the mainstream showbiz men (Jon Favreau) -> Stuckrad-Barre,
//   politics -> Slavenka Drakulic (dry political irony), the other women -> Ephron or Drakulic by kind.
//   RIP articles stay "informative": a remembrance is not the place for pub jokes.
// Dependency-free (scripts/check-person-voice.ts). The ids are config/authorStyles.ts ids.

export type Gender = 'male' | 'female' | null;
export type VoiceId = 'informative' | 'irvine-welsh' | 'benjamin-stuckrad-barre' | 'nora-ephron' | 'slavenka-drakulic';

type PersonText = { _id?: unknown; profession?: string; subcat?: string; knownfor?: string; description?: string; firstname?: string; lastname?: string };

const SPORT = /football|soccer|hockey|boxing|boxer|basket|baseball|tennis|golf|cycl|athlet|sprinter|runner|swim|ski|racing|motor|formula|rugby|cricket|volley|handball|wrestl|martial|judo|karate|mma|sport|skat|surf|olymp|darts|snooker|fencing|rowing|gymnast|player|coach|goalkeeper|striker|defender|midfielder|jockey|athlete/i;
/** the loud, crude, anarchic end - Trey Parker, punk, rap, metal, stand-up */
const ROUGH = /comed|satir|animat|cartoon|south park|stand-up|standup|prank|punk|rap|hip hop|hip-hop|metal|grunge|rock|wrestl|skateboard|jackass|mtv|horror|stunt|dj\b|disc jockey/i;
const POLITICS = /politi|minister|senator|governor|mayor|diplomat|parliament|member of the|activist|president/i;
const SHOWBIZ = /actress|actor|comed|singer|music|songwriter|model|presenter|host|dancer|television|tv |film|entertainer/i;
const WOMEN_WRY = /writer|novelist|author|journalist|artist|painter|photographer|architect|scientist|professor|lawyer|director|entrepreneur|business/i;

const text = (p: PersonText) => [p.profession, p.subcat, p.knownfor, p.description].filter(Boolean).join(' | ');

/** A stable 0/1 per person, so a woman always gets the same of the two voices */
function pick2<T>(p: PersonText, a: T, b: T): T {
  const key = String(p._id ?? `${p.firstname} ${p.lastname}`);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % 2 ? b : a;
}

/** When Wikidata does not say: read it from the description ("American actress", "she") */
export function guessGenderFromText(p: PersonText): Gender {
  const t = ` ${text(p).toLowerCase()} `;
  if (/\b(actress|sportswoman|businesswoman|congresswoman|chairwoman|she|her|women's|female|queen|princess|ballerina|songstress|comedienne)\b/.test(t)) return 'female';
  if (/\b(actor|sportsman|businessman|congressman|chairman|he|his|men's|male|king|prince)\b/.test(t)) return 'male';
  return null;
}

export function voiceForPerson(p: PersonText, gender: Gender, mode: 'birthday' | 'rip' = 'birthday'): VoiceId {
  if (mode === 'rip') return 'informative';
  const t = text(p);
  const g = gender ?? guessGenderFromText(p);
  const female = g === 'female';
  if (SPORT.test(t) && !POLITICS.test(p.profession || '')) return female ? pick2(p, 'nora-ephron', 'slavenka-drakulic') : 'irvine-welsh';
  if (POLITICS.test(t)) return 'slavenka-drakulic';
  // women: showbiz (actress, comedian, singer, presenter) -> Nora Ephron first; the writers, artists, lawyers,
  // scientists are split between the two; everyone else -> Ephron
  if (female) return SHOWBIZ.test(t) ? 'nora-ephron' : WOMEN_WRY.test(t) ? pick2(p, 'slavenka-drakulic', 'nora-ephron') : 'nora-ephron';
  return ROUGH.test(t) ? 'irvine-welsh' : 'benjamin-stuckrad-barre';
}
