// Interest / data-completeness score of a Person (0-100), originally from bestofgenx.
//
// The score is NOT stored - it is computed from the fields present. This is the single
// definition: the Menschen tab shows and filters by it, and Daily Auto uses the same
// number to decide who is good enough to get an article. (scripts/cleanup-low-score-
// people.ts replicates it as a Mongo aggregation and must be kept in step by hand.)
//
// Dependency-free so client and server code can both import it.
export interface ScoredPerson {
  knownfor?: string;
  subcat?: string;
  profession?: string;
  nationality?: string;
  countryBorn?: string;
  image?: string;
  born?: string;
  cityBorn?: string;
  died?: string;
  causeOfDeath?: string;
  countryDied?: string;
  cityDied?: string;
}

export function interestScore(p: ScoredPerson): number {
  let score = 0;
  if (p.knownfor) score += 25;
  if (p.subcat) score += 10;
  if (p.profession && p.profession !== 'Other') score += 10;
  if (p.nationality && p.nationality !== p.countryBorn) score += 5;
  if (p.image) score += 15;
  if (p.born) score += 15;
  if (p.cityBorn) score += 10;
  if (p.died) {
    if (p.causeOfDeath) score += 5;
    if (p.countryDied) score += 5;
    if (p.cityDied) score += 5;
  }
  return Math.min(100, score);
}
