/**
 * Continent grouping for the editorial search filters.
 *
 * Two lookup directions are needed:
 *  - UI/prompt: continent id → readable label + the country names to search in.
 *  - Validation: a country name coming back from a reporter or from Wikidata
 *    (`countryLabel`, English) → its continent, so a "Europe" search can reject
 *    an American proposal.
 *
 * Country names are the English Wikidata/Wikipedia spellings because that is
 * what both the SPARQL results and the reporters produce. Common alternative
 * spellings are included so matching does not silently fail.
 */

export interface Continent {
  id: string;
  label: string;
  /** English country names belonging to this continent. */
  countries: string[];
}

export const CONTINENTS: Continent[] = [
  {
    id: 'europe',
    label: '🇪🇺 Europe',
    countries: [
      'United Kingdom', 'England', 'Scotland', 'Wales', 'Northern Ireland', 'Great Britain',
      'Ireland', 'Germany', 'West Germany', 'East Germany', 'France', 'Italy', 'Spain',
      'Portugal', 'Netherlands', 'Belgium', 'Luxembourg', 'Austria', 'Switzerland',
      'Sweden', 'Norway', 'Denmark', 'Finland', 'Iceland', 'Poland', 'Czech Republic',
      'Czechia', 'Czechoslovakia', 'Slovakia', 'Hungary', 'Romania', 'Bulgaria', 'Greece',
      'Croatia', 'Serbia', 'Slovenia', 'Bosnia and Herzegovina', 'Montenegro',
      'North Macedonia', 'Macedonia', 'Albania', 'Yugoslavia', 'Estonia', 'Latvia',
      'Lithuania', 'Belarus', 'Ukraine', 'Moldova', 'Russia', 'Soviet Union', 'Malta',
      'Cyprus', 'Monaco', 'Andorra', 'Liechtenstein', 'San Marino',
    ],
  },
  {
    id: 'north-america',
    label: '🌎 North America',
    countries: [
      'United States', 'United States of America', 'USA', 'Canada', 'Mexico',
      'Cuba', 'Jamaica', 'Haiti', 'Dominican Republic', 'Puerto Rico', 'Bahamas',
      'Trinidad and Tobago', 'Barbados', 'Guatemala', 'Honduras', 'El Salvador',
      'Nicaragua', 'Costa Rica', 'Panama', 'Belize',
    ],
  },
  {
    id: 'south-america',
    label: '🌎 South America',
    countries: [
      'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Venezuela', 'Ecuador',
      'Bolivia', 'Paraguay', 'Uruguay', 'Guyana', 'Suriname',
    ],
  },
  {
    id: 'asia',
    label: '🌏 Asia',
    countries: [
      'Japan', 'China', "People's Republic of China", 'South Korea', 'North Korea',
      'Taiwan', 'Hong Kong', 'India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal',
      'Thailand', 'Vietnam', 'Philippines', 'Indonesia', 'Malaysia', 'Singapore',
      'Cambodia', 'Laos', 'Myanmar', 'Mongolia', 'Kazakhstan', 'Uzbekistan',
      'Turkey', 'Israel', 'Iran', 'Iraq', 'Saudi Arabia', 'United Arab Emirates',
      'Lebanon', 'Jordan', 'Syria', 'Kuwait', 'Qatar', 'Bahrain', 'Oman', 'Yemen',
      'Armenia', 'Georgia', 'Azerbaijan', 'Afghanistan',
    ],
  },
  {
    id: 'africa',
    label: '🌍 Africa',
    countries: [
      'South Africa', 'Egypt', 'Nigeria', 'Kenya', 'Morocco', 'Algeria', 'Tunisia',
      'Libya', 'Ghana', 'Ethiopia', 'Tanzania', 'Uganda', 'Senegal', 'Ivory Coast',
      "Côte d'Ivoire", 'Cameroon', 'Zimbabwe', 'Zambia', 'Mozambique', 'Angola',
      'Botswana', 'Namibia', 'Sudan', 'Somalia', 'Rwanda', 'Mali', 'Burkina Faso',
      'Democratic Republic of the Congo', 'Republic of the Congo',
    ],
  },
  {
    id: 'oceania',
    label: '🌏 Oceania',
    countries: [
      'Australia', 'New Zealand', 'Fiji', 'Papua New Guinea', 'Samoa', 'Tonga',
    ],
  },
];

/**
 * The countries offered in the editorial COUNTRY dropdown.
 *
 * Single source of truth: the dropdown, the code → full-name lookup used in the
 * prompts and the continent grouping all read from here. Previously each place
 * kept its own partial map, so picking e.g. Austria produced the literal prompt
 * "from AT".
 */
export interface EditorialCountry {
  code: string;
  name: string;
  flag: string;
  continent: string;
}

export const EDITORIAL_COUNTRIES: EditorialCountry[] = [
  // North America
  { code: 'US', name: 'United States', flag: '🇺🇸', continent: 'north-america' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', continent: 'north-america' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', continent: 'north-america' },
  { code: 'CU', name: 'Cuba', flag: '🇨🇺', continent: 'north-america' },
  { code: 'JM', name: 'Jamaica', flag: '🇯🇲', continent: 'north-america' },
  // South America
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', continent: 'south-america' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', continent: 'south-america' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴', continent: 'south-america' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', continent: 'south-america' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪', continent: 'south-america' },
  // Europe
  { code: 'UK', name: 'United Kingdom', flag: '🇬🇧', continent: 'europe' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', continent: 'europe' },
  { code: 'FR', name: 'France', flag: '🇫🇷', continent: 'europe' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', continent: 'europe' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', continent: 'europe' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', continent: 'europe' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', continent: 'europe' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪', continent: 'europe' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹', continent: 'europe' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', continent: 'europe' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', continent: 'europe' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴', continent: 'europe' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰', continent: 'europe' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮', continent: 'europe' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱', continent: 'europe' },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿', continent: 'europe' },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺', continent: 'europe' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷', continent: 'europe' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪', continent: 'europe' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺', continent: 'europe' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦', continent: 'europe' },
  // Asia
  { code: 'JP', name: 'Japan', flag: '🇯🇵', continent: 'asia' },
  { code: 'CN', name: 'China', flag: '🇨🇳', continent: 'asia' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', continent: 'asia' },
  { code: 'IN', name: 'India', flag: '🇮🇳', continent: 'asia' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭', continent: 'asia' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭', continent: 'asia' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩', continent: 'asia' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', continent: 'asia' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼', continent: 'asia' },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰', continent: 'asia' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱', continent: 'asia' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷', continent: 'asia' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', continent: 'asia' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', continent: 'asia' },
  // Oceania
  { code: 'AU', name: 'Australia', flag: '🇦🇺', continent: 'oceania' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', continent: 'oceania' },
  // Africa
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', continent: 'africa' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', continent: 'africa' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', continent: 'africa' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', continent: 'africa' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦', continent: 'africa' },
];

const countryByCode = new Map(EDITORIAL_COUNTRIES.map(c => [c.code.toUpperCase(), c]));

/** Country code → full English name. Falls back to the input when unknown. */
export function countryNameFromCode(code?: string | null): string {
  if (!code) return '';
  return countryByCode.get(code.toUpperCase())?.name || code;
}

/** Countries of one continent, for building grouped dropdowns. */
export function countriesOfContinent(continentId: string): EditorialCountry[] {
  return EDITORIAL_COUNTRIES.filter(c => c.continent === continentId);
}

const byId = new Map(CONTINENTS.map(c => [c.id, c]));

/** Country name (lowercased) → continent id. */
const countryToContinent = new Map<string, string>();
for (const c of CONTINENTS) {
  for (const country of c.countries) {
    countryToContinent.set(country.toLowerCase(), c.id);
  }
}

// Precomputed for the substring fallback in continentOfCountry().
const countryNamesByLength = Array.from(countryToContinent.keys()).sort(
  (a, b) => b.length - a.length
);

export function getContinent(id?: string | null): Continent | undefined {
  return id ? byId.get(id.toLowerCase()) : undefined;
}

export function getContinentLabel(id?: string | null): string {
  // Labels carry a leading emoji for the UI; strip it for prompt/plain-text use.
  const label = getContinent(id)?.label ?? '';
  return label.replace(/^[^A-Za-z]+/, '').trim();
}

/**
 * Resolves a free-form country string to a continent id.
 * Reporters write things like "USA", "Germany (West Germany)" or "England, UK",
 * so an exact map hit is tried first and a substring match second.
 */
export function continentOfCountry(country?: string | null): string | undefined {
  if (!country) return undefined;
  const raw = country.trim().toLowerCase();
  if (!raw) return undefined;

  const direct = countryToContinent.get(raw);
  if (direct) return direct;

  // "England, UK" / "Germany (Berlin)" — check each known country as substring.
  // Longest name first so "Guinea" cannot shadow "Papua New Guinea".
  for (const name of countryNamesByLength) {
    if (raw.includes(name)) return countryToContinent.get(name);
  }
  return undefined;
}

/** True when `country` is known to belong to `continentId`. */
export function isCountryInContinent(country: string | null | undefined, continentId: string): boolean {
  const resolved = continentOfCountry(country);
  return !!resolved && resolved === continentId.toLowerCase();
}
