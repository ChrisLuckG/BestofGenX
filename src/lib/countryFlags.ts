// Central country -> flag helpers.
// Used by the articles API (to persist personCountryCode) and by the UI
// (as a fallback for older articles that were saved without a code).

export const COUNTRY_TO_CODE: Record<string, string> = {
  'United States': 'US', 'USA': 'US', 'America': 'US',
  'United Kingdom': 'GB', 'UK': 'GB', 'Britain': 'GB',
  'Germany': 'DE', 'Deutschland': 'DE',
  'France': 'FR', 'Frankreich': 'FR',
  'Italy': 'IT', 'Italien': 'IT',
  'Spain': 'ES', 'Spanien': 'ES',
  'Canada': 'CA', 'Kanada': 'CA',
  'Australia': 'AU', 'Australien': 'AU',
  'Japan': 'JP',
  'China': 'CN',
  'South Korea': 'KR', 'Korea': 'KR',
  'Brazil': 'BR', 'Brasilien': 'BR',
  'Mexico': 'MX', 'Mexiko': 'MX',
  'Argentina': 'AR', 'Argentinien': 'AR',
  'Netherlands': 'NL', 'Holland': 'NL',
  'Belgium': 'BE', 'Belgien': 'BE',
  'Sweden': 'SE', 'Schweden': 'SE',
  'Norway': 'NO', 'Norwegen': 'NO',
  'Denmark': 'DK', 'Dänemark': 'DK',
  'Finland': 'FI', 'Finnland': 'FI',
  'Poland': 'PL', 'Polen': 'PL',
  'Russia': 'RU', 'Russland': 'RU',
  'Austria': 'AT', 'Österreich': 'AT',
  'Switzerland': 'CH', 'Schweiz': 'CH',
  'Ireland': 'IE', 'Irland': 'IE',
  'Northern Ireland': 'gb-nir', 'Nordirland': 'gb-nir',
  'Scotland': 'gb-sct', 'Schottland': 'gb-sct',
  'Wales': 'gb-wls',
  'England': 'gb-eng',
  'Portugal': 'PT',
  'Greece': 'GR', 'Griechenland': 'GR',
  'Turkey': 'TR', 'Türkei': 'TR',
  'India': 'IN', 'Indien': 'IN',
  'South Africa': 'ZA', 'Südafrika': 'ZA',
  'New Zealand': 'NZ', 'Neuseeland': 'NZ',
  'Jamaica': 'JM', 'Jamaika': 'JM',
  'Cuba': 'CU', 'Kuba': 'CU',
  'Puerto Rico': 'PR',
  'Cameroon': 'CM', 'Kamerun': 'CM',
  'Nigeria': 'NG',
  'Ghana': 'GH',
  'Senegal': 'SN',
  'Iceland': 'IS', 'Island': 'IS',
  'Croatia': 'HR', 'Kroatien': 'HR',
  'Serbia': 'RS', 'Serbien': 'RS',
  'Ukraine': 'UA',
  'Czech Republic': 'CZ', 'Tschechien': 'CZ',
  'Hungary': 'HU', 'Ungarn': 'HU',
  'Romania': 'RO', 'Rumänien': 'RO',
  'Colombia': 'CO', 'Kolumbien': 'CO',
  'Chile': 'CL',
  'Peru': 'PE',
  'Venezuela': 'VE',
  'Saudi Arabia': 'SA', 'Saudi-Arabien': 'SA',
  'United Arab Emirates': 'AE', 'UAE': 'AE', 'Vereinigte Arabische Emirate': 'AE',
  'Israel': 'IL',
  'Egypt': 'EG', 'Ägypten': 'EG',
  'Morocco': 'MA', 'Marokko': 'MA',
  'Algeria': 'DZ', 'Algerien': 'DZ',
  'Tunisia': 'TN', 'Tunesien': 'TN',
  'Libya': 'LY', 'Libyen': 'LY',
  'Iran': 'IR',
  'Iraq': 'IQ', 'Irak': 'IQ',
  'Pakistan': 'PK',
  'Bangladesh': 'BD', 'Bangladesch': 'BD',
  'Thailand': 'TH',
  'Vietnam': 'VN',
  'Philippines': 'PH', 'Philippinen': 'PH',
  'Indonesia': 'ID', 'Indonesien': 'ID',
  'Malaysia': 'MY',
  'Singapore': 'SG', 'Singapur': 'SG',
  'Taiwan': 'TW',
  'Hong Kong': 'HK', 'Hongkong': 'HK',
};

// Legacy/incorrect codes that were persisted before the mapping was fixed.
// 'NI' is Nicaragua in ISO 3166-1, but was used for Northern Ireland.
const CODE_ALIASES: Record<string, string> = {
  ni: 'gb-nir',
};

// Nationalities/demonyms - AI reporters often write "Finnish singer" or answer
// COUNTRY: Finnish instead of Finland.
const DEMONYM_TO_CODE: Record<string, string> = {
  american: 'US', british: 'GB', english: 'gb-eng', scottish: 'gb-sct', welsh: 'gb-wls',
  'northern irish': 'gb-nir', irish: 'IE', german: 'DE', austrian: 'AT', swiss: 'CH',
  french: 'FR', italian: 'IT', spanish: 'ES', portuguese: 'PT', dutch: 'NL', belgian: 'BE',
  swedish: 'SE', norwegian: 'NO', danish: 'DK', finnish: 'FI', icelandic: 'IS',
  polish: 'PL', czech: 'CZ', hungarian: 'HU', romanian: 'RO', greek: 'GR', turkish: 'TR',
  russian: 'RU', ukrainian: 'UA', croatian: 'HR', serbian: 'RS',
  canadian: 'CA', mexican: 'MX', brazilian: 'BR', argentinian: 'AR', argentine: 'AR',
  colombian: 'CO', chilean: 'CL', peruvian: 'PE', venezuelan: 'VE', cuban: 'CU', jamaican: 'JM',
  japanese: 'JP', chinese: 'CN', korean: 'KR', 'south korean': 'KR', indian: 'IN',
  thai: 'TH', vietnamese: 'VN', filipino: 'PH', indonesian: 'ID', malaysian: 'MY',
  singaporean: 'SG', taiwanese: 'TW', pakistani: 'PK', bangladeshi: 'BD',
  australian: 'AU', 'new zealander': 'NZ',
  'south african': 'ZA', nigerian: 'NG', ghanaian: 'GH', senegalese: 'SN', cameroonian: 'CM',
  egyptian: 'EG', moroccan: 'MA', algerian: 'DZ', tunisian: 'TN', libyan: 'LY',
  israeli: 'IL', iranian: 'IR', iraqi: 'IQ', saudi: 'SA',
};

// Case-insensitive lookup table, built once from the canonical map above.
const LOWER_COUNTRY_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_TO_CODE).map(([name, code]) => [name.toLowerCase(), code])
);

export function countryNameToCode(name?: string | null): string {
  if (!name) return '';
  // Tolerate casing, whitespace and trailing punctuation from AI output
  const key = name.trim().replace(/[.,;:!?]+$/, '').toLowerCase();
  if (!key) return '';
  return LOWER_COUNTRY_TO_CODE[key] || DEMONYM_TO_CODE[key] || '';
}

/**
 * Resolve a flag image URL from a country code and/or country name.
 * Falls back to deriving the code from the name for legacy records
 * that were saved without a personCountryCode.
 */
export function getFlagUrl(
  code?: string | null,
  countryName?: string | null,
  size: string = '48x36'
): string {
  const raw = (code || countryNameToCode(countryName)).toLowerCase();
  if (!raw) return '';
  const resolved = CODE_ALIASES[raw] || raw;
  return `https://flagcdn.com/${size}/${resolved}.png`;
}
