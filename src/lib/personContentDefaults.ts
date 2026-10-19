// How an article / rankroll about a Person is set up by default.
//
// One definition for the Menschen tab ("Create Article" / "Create Rankroll") and for
// Daily Auto, so that refining the recipe in one place changes both. Dependency-free:
// importable from client components and server code.
interface PersonLike {
  firstname: string;
  lastname?: string;
  profession?: string;
  countryBorn?: string;
  knownfor?: string;
}

/** Options sent to /api/almanac/article. */
export const ARTICLE_DEFAULT_OPTIONS = {
  topic: '',
  language: 'English',
  length: 'long (~600 words)',
  tone: 'informative',
  extra: '',
};

export const personFullName = (p: PersonLike) => `${p.firstname} ${p.lastname || ''}`.trim();

export function articleTagsForPerson(p: PersonLike): string[] {
  return [p.profession, 'Gen X', p.countryBorn].filter((t): t is string => !!t);
}

/**
 * Topic for the rankroll generator. Deliberately WITHOUT a leading count
 * ("Top 10 ..."): the generator decides how many entries a subject genuinely
 * supports, and a hardcoded number produced titles that promised 10 while only 9
 * items were delivered.
 */
export function rankrollTopicForPerson(p: PersonLike): string {
  const topic = p.knownfor || p.profession || 'career highlights';
  return `Iconic ${topic} moments by ${personFullName(p)}`;
}
