// Which author voice writes which automatic person article (lib/personVoice.ts) - the user's rules of 19.10.2026,
// with the real people they were named for. Pure, no database.   npx tsx scripts/check-person-voice.ts
import fs from 'fs';

let failed = 0;
const eq = (n: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${ok ? '' : `\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`}`); };

(async () => {
  const { voiceForPerson, guessGenderFromText } = await import('../src/lib/personVoice');
  const { AUTHOR_STYLES } = await import('../src/config/authorStyles');
  const ids = AUTHOR_STYLES.map((s: { id: string }) => s.id);

  // as they are in the database
  const trey = { _id: 'a1', profession: 'Music', subcat: 'American actor', knownfor: 'Trey Parker, American actor, animator, producer, and screenwriter' };
  const favreau = { _id: 'a2', profession: 'Actor', subcat: 'Film', knownfor: 'Swingers' };
  const natasha = { _id: 'a3', profession: 'Comedy', subcat: 'Comedy', knownfor: 'American actress and writer (born 1980)' };
  const olivia = { _id: 'a4', profession: 'Music', subcat: 'Music', knownfor: 'Maltese singer' };
  const pelikan = { _id: 'a5', profession: 'Politik', subcat: 'Politik', knownfor: 'Czech lawyer and politician' };
  const vivas = { _id: 'a6', profession: 'football', knownfor: 'Argentine footballer' };
  const sprinterW = { _id: 'a7', profession: 'athletics', knownfor: 'Australian sprinter' };

  eq('Trey Parker -> Irvine Welsh (as the user said)', voiceForPerson(trey, 'male'), 'irvine-welsh');
  eq('Jon Favreau -> Stuckrad-Barre (as the user said)', voiceForPerson(favreau, 'male'), 'benjamin-stuckrad-barre');
  eq('sport, a man (Nelson Vivas) -> Irvine Welsh', voiceForPerson(vivas, 'male'), 'irvine-welsh');
  const w = voiceForPerson(sprinterW, 'female');
  eq('sport, a woman -> one of the two women', ['nora-ephron', 'slavenka-drakulic'].includes(w), true);
  eq('...and always the same one for the same person', voiceForPerson(sprinterW, 'female'), w);
  const women = Array.from({ length: 40 }, (_, i) => voiceForPerson({ _id: `w${i}`, profession: 'tennis', knownfor: 'tennis player' }, 'female'));
  eq('...and both women get sportswomen (split)', [women.includes('nora-ephron'), women.includes('slavenka-drakulic')], [true, true]);
  eq('a politician -> Slavenka Drakulic', voiceForPerson(pelikan, 'male'), 'slavenka-drakulic');
  eq('an actress / comedian (Natasha Rothwell) -> Nora Ephron', voiceForPerson(natasha, 'female'), 'nora-ephron');
  eq('a singer, woman (Olivia Lewis) -> Nora Ephron', voiceForPerson(olivia, 'female'), 'nora-ephron');
  eq('a rapper / punk, man -> Irvine Welsh', voiceForPerson({ profession: 'Music', knownfor: 'American rapper' }, 'male'), 'irvine-welsh');
  eq('a tech founder, man -> Stuckrad-Barre', voiceForPerson({ profession: 'Tech', knownfor: 'American entrepreneur' }, 'male'), 'benjamin-stuckrad-barre');
  eq('RIP stays informative - whoever it is', [voiceForPerson(vivas, 'male', 'rip'), voiceForPerson(natasha, 'female', 'rip')], ['informative', 'informative']);
  eq('every voice handed out exists in config/authorStyles.ts', [trey, favreau, natasha, olivia, pelikan, vivas, sprinterW].every(p => ids.includes(voiceForPerson(p, null))), true);

  eq('gender from the description when Wikidata does not know', [guessGenderFromText(natasha), guessGenderFromText(trey), guessGenderFromText(olivia)], ['female', 'male', null]);
  eq('without gender: "actress" in the text still makes Natasha Rothwell a woman', voiceForPerson(natasha, null), 'nora-ephron');

  const da = fs.readFileSync('src/lib/dailyAuto.ts', 'utf8');
  eq('Daily Auto picks the voice per person, passes it as tone and stores it as aiTone', /voice = voiceForPerson\(/.test(da) && /tone: voice/.test(da) && /aiTone: voice/.test(da), true);

  console.log(failed ? `\n${failed} FAILED` : '\nall ok');
  process.exit(failed ? 1 : 0);
})();
