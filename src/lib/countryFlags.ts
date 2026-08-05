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
};

// Legacy/incorrect codes that were persisted before the mapping was fixed.
// 'NI' is Nicaragua in ISO 3166-1, but was used for Northern Ireland.
const CODE_ALIASES: Record<string, string> = {
  ni: 'gb-nir',
};

export function countryNameToCode(name?: string | null): string {
  if (!name) return '';
  return COUNTRY_TO_CODE[name.trim()] || '';
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
