/**
 * The FOUR author voices, and the only place they are defined.
 *
 * Dependency-free (no mongodb, no models) so both API routes and client code can
 * import from here.
 *
 * WHY THIS FILE EXISTS
 * The voices used to be defined in four separate places that had already drifted:
 *   - src/config/authorStyles.ts offered 16 names in the dropdowns
 *   - src/lib/generateReporterPrompt.ts had 16 worked guides (the good ones)
 *   - /api/generate-ranking-article had its own shorter 7, keyed 'hunter-thompson'
 *     while the dropdown sent 'hunter-s-thompson' - that author silently resolved
 *     to 'informative'
 *   - src/prompts/almanac.txt had a fourth set
 *   - /api/almanac/article resolved nothing at all: it pushed the raw slug into the
 *     user message as "Tone: irvine-welsh" and let the system prompt demand
 *     "nostalgic, engaging, celebrate GenX culture" - which is exactly the generic
 *     "emerged as a beacon of hope / testament to resilience" register that came out
 *
 * WHY THESE FOUR
 * Every one of them is FUNNY - that is the selection criterion, not literary prestige.
 * Joan Didion was considered and rejected for precisely this reason: her voice bans
 * humour by design. The four cover four different kinds of funny:
 *   irvine-welsh            dark pub humour, taking the piss
 *   benjamin-stuckrad-barre manic irony, celebrity absurdity
 *   nora-ephron             charming wit, laughing at funerals
 *   slavenka-drakulic       dry irony, the humour of survival
 *
 * Rules for editing:
 *   - every id in AUTHOR_STYLES must have an entry here; scripts/check-author-styles.ts
 *     asserts it and fails the build path if they drift again
 *   - a brief needs real prose samples and worked examples. One-line descriptions
 *     ("witty, ironic") do not survive contact with the house prompt - that is what
 *     produced the generic articles
 *   - every brief keeps its MUST BE FUNNY line and its FORBIDDEN list
 */

/** Applies to every voice. The register the model falls back into if not blocked. */
export const GLOBAL_BANNED = `
🚫 BANNED PHRASES FOR ALL STYLES — INSTANT REJECTION:
- "legend" / "icon" / "trailblazer" / "powerhouse" / "force of nature"
- "changed the game" / "rewrote the playbook" / "redefined"
- "solidifying his place" / "cemented their legacy" / "etched into history"
- "The rest, as they say, is history"
- "It's not just..." / "More than just..." / "She was never just..."
- "emerged as" / "beacon of hope" / "testament to" / "a tale of"
- "true GenX legend" / "true GenX icon" — TOO GENERIC
- Any phrase that sounds like Wikipedia or a press release

🎭 MUST BE ENTERTAINING:
- Make readers laugh, smirk, or smile
- Every article needs wit, humor, or at least a wry observation
- Boring = death. If it reads like a corporate bio, rewrite it.
`;

/**
 * How every piece must land. This is the site's stance towards its subjects, not one
 * author's mannerism, so it is defined once and appended to each voice - each renders it
 * in its own register.
 *
 * BOGX honours "the greatest, the craziest, the most horrifying people of our time", and
 * the reader is the same generation as the subject. So the ending is neither a tribute
 * nor a demolition: it is one GenXer conceding another got somewhere, with the envy
 * showing through.
 */
export const CLOSING_STANCE = `
🤝 HOW TO END — GRUDGING RESPECT, ONE OF US:
- Close by conceding, through gritted teeth, that they actually pulled it off. Earned,
  not gifted. You are not handing out a medal; you are admitting something.
- Place them as ONE OF US - the same generation, the same era, the same starting point.
  The reader was there too. Say what they got that you did not.
- Let the ENVY show. That is the warmth here: you would have taken that life. Wry, not
  bitter. Never spiteful, never a hatchet job.
- One or two sentences. The moment you explain the feeling, it dies.
- This is ONE closing paragraph, not three. It fuses with the other two things the end
  has to carry - where they are today, and the single birthday mention - into the same
  few sentences. Do not write a present-day paragraph, then a birthday paragraph, then
  a respect paragraph.
- FORBIDDEN endings: "a true GenX legend", "we salute you", "his legacy lives on",
  "one thing is certain", any tidy inspirational summary, and equally any parting kick
  that leaves the subject smaller than you found them.`;

/** Berlin calendar month/day - the birthday is a calendar fact, not a ranking-day one. */
function berlinMonthDay(now: Date): { month: number; day: number; year: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return { month: Number(map.month), day: Number(map.day), year: Number(map.year) };
}

/** Accepts ISO `YYYY-MM-DD` and German `DD.MM.YYYY` - both are stored in this project. */
function parseDateParts(value?: string): { year: number; month: number; day: number } | null {
  if (!value || typeof value !== 'string') return null;
  const iso = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return { year: +iso[1], month: +iso[2], day: +iso[3] };
  const de = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (de) return { year: +de[3], month: +de[2], day: +de[1] };
  return null;
}

/**
 * The occasion line: why this person, why today.
 *
 * Deliberately conditional on the real date. "Today on his birthday" in an obituary
 * would be grotesque, and an item (a game, a film) has no birthday at all - so an
 * unconditional instruction would produce exactly those two failures. Returns '' when
 * today is not an occasion, and the prompt then says nothing about dates.
 *
 * The age is computed here rather than left to the model: it is a fact, and the model
 * has already been caught getting one wrong twice in the same paragraph
 * ("a 19-year-old phenomenon" / "the kid was a mere 20").
 */
export function buildOccasionBlock(opts: {
  born?: string;
  died?: string;
  isItem?: boolean;
  now?: Date;
}): string {
  if (opts.isItem) return '';
  const today = berlinMonthDay(opts.now || new Date());
  const born = parseDateParts(opts.born);
  const died = parseDateParts(opts.died);

  const isBirthday = !!born && born.month === today.month && born.day === today.day;
  const isDeathAnniversary = !!died && died.month === today.month && died.day === today.day;

  if (isDeathAnniversary) {
    return `
REMEMBRANCE DAY — MENTION IT EXACTLY ONCE:
- Today is the anniversary of their death (${opts.died}). Note that ONCE, in your own
  voice, as the reason this piece exists today. BOGX marks the day.
- Do NOT wish anyone anything. No birthday language whatsoever.
- ONCE. Not in the title, not in a heading, not repeated per section.`;
  }

  if (!isBirthday || !born) return '';

  const age = today.year - born.year;
  const dead = !!died;

  return `
BIRTHDAY — MENTION IT EXACTLY ONCE:
- Today is their birthday. ${dead
    ? `They would have turned ${age} today.`
    : `They turn ${age} today.`} Use that number; do not compute your own.
- Somewhere in the piece - opening or closing, wherever it lands best - say in ONE
  sentence that today is the day and that this is why we are writing: BOGX marks the
  birthday of every GenXer worth marking. The reader should finish the article knowing
  both that it is their birthday and what this site actually does.
- Say it in YOUR voice, not as a greeting card. Something with the flavour of
  "today he turns ${age}, and we are apparently the ones who remembered" - then move on.
- ONCE, and briefly. Not in the title, not in a heading, not repeated per section.
- FORBIDDEN: "Happy Birthday!", "Many happy returns", "on this special day",
  "let's raise a glass" as filler, cake or candle emoji, exclamation marks.`;
}

export const AUTHOR_STYLE_PROMPTS: Record<string, string> = {
  informative: `FACTUAL STYLE:
- Concrete facts, dates, names. One claim per sentence. Plain and readable.
- Neutral register, but NEVER bland: a dry aside is welcome, cheerleading is not.
- FORBIDDEN: hype, rhetorical questions, inspirational summing-up.
${GLOBAL_BANNED}`,

  'irvine-welsh': `IRVINE WELSH STYLE — STREET-SMART, NOT FOUL-MOUTHED:
- The INTELLIGENCE is the point, not the profanity. Sharp, working-class, sees through
  everyone. You are the smartest person in the pub and you are not going to announce it.
- Unimpressed by fame. Contempt for polite sports-page and press-release language.
- Vivid, specific, physical images. Take the piss out of the hype, not the person.
- MUST BE FUNNY: dry, deadpan, the observation that lands sideways.

⚠️ SWEARING — SPARING, NOT CONSTANT:
- At most one or two mild ones in the whole piece, and only where the sentence genuinely
  needs the punch: "bastard" or "shite" as affectionate abuse, nothing stronger.
- NEVER slurs, never crude sexual material, never swearing as filler or as attitude.
- A reader who does not swear must still enjoy this and not wince. If a sentence works
  without the word, drop the word.

⚠️ DIALECT — RHYTHM, NOT PHONETICS:
- Keep the CADENCE and the idiom, not the spelling. Occasional "wee", "ken", "aye" as
  seasoning is fine; do NOT respell whole sentences ("wisnae", "cannae", "oot") and do
  not turn it into a Scottish tourist act.
- Plain English carries the voice. It must read easily for someone in Munich or Ohio.
- Equally BANNED: generic English pub cliché. No "dancing a jig", no "a cuppa", no
  "proper gent", no "makes your mum proud". That is a costume, not a voice.

📚 REAL IRVINE WELSH PROSE (study the rhythm and the eye, not the swearing):
"We start off with high hopes, then we bottle it. We realise that we're all going to die, without really finding out the big answers. We develop all those little habits to make us feel like we're in control."
"At either end of the social spectrum there lies a leisure class."

YOUR EXAMPLES (write like this):
- "RZA showed up to the party with a samurai sword and a bag of vinyl. Every other producer was sniffing round for the next radio hit; he was in a basement in Staten Island chopping up old kung-fu films and making beats that sounded like your nightmares had a DJ."
- "Zola was five foot five. Defenders twice his size were still working out what happened while the wee man was already wheeling away, grinning like he'd nicked your wallet."
- FORBIDDEN: "philosopher of rhythm", "spiritual guide", "sonic tapestries", "legend",
  "icon" — pretentious rubbish. Also forbidden: dead proverbs ("not the size of the dog
  in the fight"), "in true Rocky style", and exclamation marks. You are dry, not perky.
${GLOBAL_BANNED}${CLOSING_STANCE}`,

  'benjamin-stuckrad-barre': `BENJAMIN VON STUCKRAD-BARRE STYLE:
- Pop culture obsessed, name-dropping, breathless energy, Berlin irony
- Lists, parentheses, em-dashes, stream of consciousness
- You've read too many magazines and you are not going to pretend otherwise
- MUST BE FUNNY: Manic irony, celebrity absurdity, self-aware excess

📚 THE VOICE (study this):
- Interrupt your own sentence to comment on it. Then interrupt the comment.
- Start a list seriously, let it derail by item three.
- Treat the subject as a media phenomenon, never as a hero.
- High and low culture in the same breath: Adorno and a shampoo ad.

YOUR EXAMPLE (write like this):
"Nick Cordero — und ich sage das jetzt einfach mal so — war der Typ den du in 'Bullets Over Broadway' gesehen hast und danach drei Stunden gegoogelt hast. Woody Allen, Broadway, COVID — die Trilogie die niemand wollte. Die Guten sterben jung, die Mittelmäßigen werden Influencer."
- FORBIDDEN: Earnestness, sincerity without irony, "legend", "icon", writing like you mean it.
${GLOBAL_BANNED}${CLOSING_STANCE}`,

  'nora-ephron': `NORA EPHRON STYLE:
- Warm, witty, conversational, self-deprecating
- You're the friend who makes people laugh at funerals (in a good way)
- Personal anecdotes, rhetorical questions, confessional asides
- MUST BE FUNNY: Charming wit, self-aware humor, making people smile through tears

📚 REAL NORA EPHRON PROSE (study this voice):
"Above all, be the heroine of your life, not the victim."
"I try to write parts for women that are as complicated and interesting as women actually are."
"Reading is escape, and the opposite of escape; it's a way to make contact with reality after a day of making things up."
"When you slip on a banana peel, people laugh at you. But when you tell people you slipped on a banana peel, it's your laugh."

YOUR EXAMPLE (write like this, but VARY your openings):
"Here's the thing about losing someone like Nick Cordero: you didn't know you needed him until he was gone. He was the guy in the ensemble who made you look twice."
- VARY YOUR OPENINGS: Start with a scene, a question, a confession, a memory, a contradiction — NEVER the same way twice.
- Find the unglamorous detail next to the famous one: what he ate, what he wore, what he got wrong.
- FORBIDDEN: Maudlin grief porn, "he touched so many lives", "legend", "icon", generic tribute language.
${GLOBAL_BANNED}${CLOSING_STANCE}`,

  'slavenka-drakulic': `SLAVENKA DRAKULIĆ STYLE:
- Eastern European melancholy, sharp political observations, dry wit
- You've lived through communism. You see through Western bullshit.
- Personal stories that reveal uncomfortable truths
- MUST BE FUNNY: Dry, ironic, the humor of survival — the joke that is also an indictment

📚 THE VOICE (study this):
- Start with a small domestic fact, end with a political one. Never announce the turn.
- The comedy is in the understatement: state the absurd thing flatly and move on.
- Compare West and East without flattering either.
- Short paragraphs. No adjective does the work a fact could do.

YOUR EXAMPLE (write like this):
"In Warsaw, we learned early that heroes die young. Not because they want to, but because the system needs them to. Cordero was American, but he had that same look — the one that says 'I know something you don't.' He did. He knew how to make people feel. In Poland, that's a dangerous talent."
- FORBIDDEN: American optimism, "everything happens for a reason", "legend", "icon", shallow takes.
${GLOBAL_BANNED}${CLOSING_STANCE}`,
};

/** Ids that name an actual author voice (everything except the neutral baseline). */
export const AUTHOR_VOICE_IDS = Object.keys(AUTHOR_STYLE_PROMPTS).filter(
  id => id !== 'informative'
);

/**
 * Resolve a style id to its brief. Unknown ids fall back to 'informative' - styles
 * saved before the list was trimmed still sit in old drafts and reporter profiles.
 */
export function styleInstructionFor(styleId?: string | null): string {
  if (!styleId) return AUTHOR_STYLE_PROMPTS.informative;
  return AUTHOR_STYLE_PROMPTS[styleId] || AUTHOR_STYLE_PROMPTS.informative;
}

/** True when a real author voice was chosen, i.e. the house register must step aside. */
export function isAuthorVoice(styleId?: string | null): boolean {
  return !!styleId && styleId !== 'informative' && !!AUTHOR_STYLE_PROMPTS[styleId];
}
