// Diagnostic: which container names actually resolve to auto-fill slugs?
// A container whose name matches no category keyword regex AND has no theme
// mapping resolves to [] - it silently shows nothing, which looks identical to
// "there are no articles yet".
import { getAutoFillSlugs } from '../src/lib/categories';

const containers: [string, string | undefined][] = [
  ['BOGXERS', undefined],
  ['History', 'bogx'],
  ['Fussball', undefined],
  ['EisHockey', undefined],
  ['Trivia', 'arcade'],
  ['Sport', undefined],
  ['Lifestyle', undefined],
  ['Politics', undefined],
  ['RIP', 'slate'],
];

let broken = 0;
for (const [name, theme] of containers) {
  const slugs = getAutoFillSlugs(name, theme);
  if (!slugs.length) broken++;
  console.log(
    (slugs.length ? '  ok  ' : ' EMPTY ') +
      name.padEnd(12) +
      ' theme=' + String(theme ?? '-').padEnd(8) +
      ' -> ' + JSON.stringify(slugs)
  );
}
console.log(`\n${broken} of ${containers.length} containers resolve to NO slugs.`);
