// The editor's "Generate" (/api/generate-article) uses the house prompt files; this keeps the chosen writing style
// the ONLY voice in them. Dependency-free (scripts/check-author-styles.ts tests it).
/**
 * article-prompt.txt carries its OWN old set of author voices (Sedaris, Palahniuk, Hunter S. Thompson ...) and
 * tells the model to "check your reporter profile" - the editor has no reporter, so the model picked any voice and
 * the one chosen in the Style field lost. That section and those lines go; the chosen style's brief
 * (lib/authorStylePrompts.ts - the one definition) is the only voice. "Informative" also loses the "every article
 * must be funny" demands, which contradict it.
 */
export function promptForStyle(raw: string, hasVoice: boolean): string {
  const SEP = '================================================================================';
  // drop the section whose header is "YOUR VOICE IS MANDATORY" (header between two separators, body up to the next separator)
  const parts = raw.split(SEP);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (/YOUR VOICE IS MANDATORY/.test(parts[i])) { i++; continue; } // skip header + its body
    out.push(parts[i]);
  }
  return out.join(SEP)
    .split('\n')
    .filter(l => !/reporter profile|^If you're [A-Z]/i.test(l))
    .filter(l => hasVoice || !/no humor|LAUGH or at least SMIRK|ENTERTAINING AND FUNNY|Boring = death/i.test(l))
    .join('\n');
}
