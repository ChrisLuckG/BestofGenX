// Central country -> flag helpers.
// Used by the articles API (to persist personCountryCode) and by the UI
// (as a fallback for older articles that were saved without a code).
// Complete list of all countries with ISO 3166-1 alpha-2 codes.

export const COUNTRY_TO_CODE: Record<string, string> = {
  // North America
  'United States': 'US', 'USA': 'US', 'America': 'US', 'United States of America': 'US',
  'Canada': 'CA', 'Kanada': 'CA',
  'Mexico': 'MX', 'Mexiko': 'MX',

  // Central America
  'Guatemala': 'GT',
  'Belize': 'BZ',
  'Honduras': 'HN',
  'El Salvador': 'SV',
  'Nicaragua': 'NI',
  'Costa Rica': 'CR',
  'Panama': 'PA',

  // Caribbean
  'Cuba': 'CU', 'Kuba': 'CU',
  'Jamaica': 'JM', 'Jamaika': 'JM',
  'Haiti': 'HT',
  'Dominican Republic': 'DO', 'Dominikanische Republik': 'DO',
  'Puerto Rico': 'PR',
  'Trinidad and Tobago': 'TT', 'Trinidad': 'TT', 'Tobago': 'TT',
  'Barbados': 'BB',
  'Bahamas': 'BS', 'The Bahamas': 'BS',
  'Saint Lucia': 'LC', 'St. Lucia': 'LC',
  'Grenada': 'GD',
  'Saint Vincent and the Grenadines': 'VC', 'St. Vincent': 'VC',
  'Antigua and Barbuda': 'AG', 'Antigua': 'AG',
  'Dominica': 'DM',
  'Saint Kitts and Nevis': 'KN', 'St. Kitts': 'KN',
  'Aruba': 'AW',
  'Curaçao': 'CW', 'Curacao': 'CW',
  'Cayman Islands': 'KY',
  'Bermuda': 'BM',
  'Virgin Islands': 'VI', 'US Virgin Islands': 'VI',
  'British Virgin Islands': 'VG',
  'Turks and Caicos': 'TC',
  'Guadeloupe': 'GP',
  'Martinique': 'MQ',

  // South America
  'Brazil': 'BR', 'Brasilien': 'BR',
  'Argentina': 'AR', 'Argentinien': 'AR',
  'Colombia': 'CO', 'Kolumbien': 'CO',
  'Peru': 'PE',
  'Venezuela': 'VE',
  'Chile': 'CL',
  'Ecuador': 'EC',
  'Bolivia': 'BO', 'Bolivien': 'BO',
  'Paraguay': 'PY',
  'Uruguay': 'UY',
  'Guyana': 'GY',
  'Suriname': 'SR',
  'French Guiana': 'GF',

  // Western Europe
  'United Kingdom': 'GB', 'UK': 'GB', 'Britain': 'GB', 'Great Britain': 'GB',
  'England': 'gb-eng',
  'Scotland': 'gb-sct', 'Schottland': 'gb-sct',
  'Wales': 'gb-wls',
  'Northern Ireland': 'gb-nir', 'Nordirland': 'gb-nir',
  'Ireland': 'IE', 'Irland': 'IE',
  'France': 'FR', 'Frankreich': 'FR',
  'Germany': 'DE', 'Deutschland': 'DE',
  'Netherlands': 'NL', 'Holland': 'NL', 'Niederlande': 'NL',
  'Belgium': 'BE', 'Belgien': 'BE',
  'Luxembourg': 'LU', 'Luxemburg': 'LU',
  'Switzerland': 'CH', 'Schweiz': 'CH',
  'Austria': 'AT', 'Österreich': 'AT',
  'Liechtenstein': 'LI',
  'Monaco': 'MC',
  'Andorra': 'AD',

  // Southern Europe
  'Spain': 'ES', 'Spanien': 'ES',
  'Portugal': 'PT',
  'Italy': 'IT', 'Italien': 'IT',
  'Greece': 'GR', 'Griechenland': 'GR',
  'Malta': 'MT',
  'San Marino': 'SM',
  'Vatican': 'VA', 'Vatican City': 'VA',
  'Gibraltar': 'GI',

  // Northern Europe
  'Sweden': 'SE', 'Schweden': 'SE',
  'Norway': 'NO', 'Norwegen': 'NO',
  'Denmark': 'DK', 'Dänemark': 'DK',
  'Finland': 'FI', 'Finnland': 'FI',
  'Iceland': 'IS', 'Island': 'IS',
  'Faroe Islands': 'FO', 'Färöer': 'FO',
  'Greenland': 'GL', 'Grönland': 'GL',

  // Eastern Europe
  'Poland': 'PL', 'Polen': 'PL',
  'Czech Republic': 'CZ', 'Czechia': 'CZ', 'Tschechien': 'CZ',
  'Slovakia': 'SK', 'Slowakei': 'SK',
  'Hungary': 'HU', 'Ungarn': 'HU',
  'Romania': 'RO', 'Rumänien': 'RO',
  'Bulgaria': 'BG', 'Bulgarien': 'BG',
  'Ukraine': 'UA',
  'Belarus': 'BY', 'Weißrussland': 'BY',
  'Moldova': 'MD', 'Moldawien': 'MD',
  'Russia': 'RU', 'Russland': 'RU', 'Russian Federation': 'RU',
  'Estonia': 'EE', 'Estland': 'EE',
  'Latvia': 'LV', 'Lettland': 'LV',
  'Lithuania': 'LT', 'Litauen': 'LT',

  // Balkans
  'Croatia': 'HR', 'Kroatien': 'HR',
  'Slovenia': 'SI', 'Slowenien': 'SI',
  'Serbia': 'RS', 'Serbien': 'RS',
  'Bosnia and Herzegovina': 'BA', 'Bosnia': 'BA', 'Bosnien': 'BA',
  'Montenegro': 'ME',
  'North Macedonia': 'MK', 'Macedonia': 'MK', 'Nordmazedonien': 'MK',
  'Albania': 'AL', 'Albanien': 'AL',
  'Kosovo': 'XK',

  // Turkey & Cyprus
  'Turkey': 'TR', 'Türkei': 'TR', 'Türkiye': 'TR',
  'Cyprus': 'CY', 'Zypern': 'CY',

  // Caucasus
  'Georgia': 'GE', 'Georgien': 'GE',
  'Armenia': 'AM', 'Armenien': 'AM',
  'Azerbaijan': 'AZ', 'Aserbaidschan': 'AZ',

  // Middle East
  'Israel': 'IL',
  'Palestine': 'PS', 'Palestinian Territories': 'PS',
  'Lebanon': 'LB', 'Libanon': 'LB',
  'Syria': 'SY', 'Syrien': 'SY',
  'Jordan': 'JO', 'Jordanien': 'JO',
  'Iraq': 'IQ', 'Irak': 'IQ',
  'Iran': 'IR',
  'Saudi Arabia': 'SA', 'Saudi-Arabien': 'SA',
  'Yemen': 'YE', 'Jemen': 'YE',
  'Oman': 'OM',
  'United Arab Emirates': 'AE', 'UAE': 'AE', 'Vereinigte Arabische Emirate': 'AE',
  'Qatar': 'QA', 'Katar': 'QA',
  'Bahrain': 'BH',
  'Kuwait': 'KW',

  // Central Asia
  'Kazakhstan': 'KZ', 'Kasachstan': 'KZ',
  'Uzbekistan': 'UZ', 'Usbekistan': 'UZ',
  'Turkmenistan': 'TM',
  'Tajikistan': 'TJ', 'Tadschikistan': 'TJ',
  'Kyrgyzstan': 'KG', 'Kirgisistan': 'KG',
  'Afghanistan': 'AF',

  // South Asia
  'India': 'IN', 'Indien': 'IN',
  'Pakistan': 'PK',
  'Bangladesh': 'BD', 'Bangladesch': 'BD',
  'Sri Lanka': 'LK',
  'Nepal': 'NP',
  'Bhutan': 'BT',
  'Maldives': 'MV', 'Malediven': 'MV',

  // East Asia
  'China': 'CN',
  'Japan': 'JP',
  'South Korea': 'KR', 'Korea': 'KR', 'Republic of Korea': 'KR',
  'North Korea': 'KP',
  'Taiwan': 'TW',
  'Hong Kong': 'HK', 'Hongkong': 'HK',
  'Macau': 'MO', 'Macao': 'MO',
  'Mongolia': 'MN', 'Mongolei': 'MN',

  // Southeast Asia
  'Thailand': 'TH',
  'Vietnam': 'VN',
  'Philippines': 'PH', 'Philippinen': 'PH',
  'Indonesia': 'ID', 'Indonesien': 'ID',
  'Malaysia': 'MY',
  'Singapore': 'SG', 'Singapur': 'SG',
  'Myanmar': 'MM', 'Burma': 'MM',
  'Cambodia': 'KH', 'Kambodscha': 'KH',
  'Laos': 'LA',
  'Brunei': 'BN',
  'East Timor': 'TL', 'Timor-Leste': 'TL',

  // Oceania
  'Australia': 'AU', 'Australien': 'AU',
  'New Zealand': 'NZ', 'Neuseeland': 'NZ',
  'Papua New Guinea': 'PG', 'Papua-Neuguinea': 'PG',
  'Fiji': 'FJ', 'Fidschi': 'FJ',
  'Samoa': 'WS',
  'Tonga': 'TO',
  'Vanuatu': 'VU',
  'Solomon Islands': 'SB', 'Salomonen': 'SB',
  'Micronesia': 'FM',
  'Palau': 'PW',
  'Marshall Islands': 'MH',
  'Kiribati': 'KI',
  'Nauru': 'NR',
  'Tuvalu': 'TV',
  'New Caledonia': 'NC', 'Neukaledonien': 'NC',
  'French Polynesia': 'PF', 'Französisch-Polynesien': 'PF',
  'Guam': 'GU',

  // North Africa
  'Egypt': 'EG', 'Ägypten': 'EG',
  'Libya': 'LY', 'Libyen': 'LY',
  'Tunisia': 'TN', 'Tunesien': 'TN',
  'Algeria': 'DZ', 'Algerien': 'DZ',
  'Morocco': 'MA', 'Marokko': 'MA',
  'Sudan': 'SD',
  'South Sudan': 'SS', 'Südsudan': 'SS',

  // West Africa
  'Nigeria': 'NG',
  'Ghana': 'GH',
  'Senegal': 'SN',
  'Ivory Coast': 'CI', "Côte d'Ivoire": 'CI', 'Elfenbeinküste': 'CI',
  'Mali': 'ML',
  'Burkina Faso': 'BF',
  'Niger': 'NE',
  'Guinea': 'GN',
  'Benin': 'BJ',
  'Togo': 'TG',
  'Sierra Leone': 'SL',
  'Liberia': 'LR',
  'Mauritania': 'MR', 'Mauretanien': 'MR',
  'Gambia': 'GM',
  'Guinea-Bissau': 'GW',
  'Cape Verde': 'CV', 'Cabo Verde': 'CV', 'Kap Verde': 'CV',

  // Central Africa
  'Cameroon': 'CM', 'Kamerun': 'CM',
  'Central African Republic': 'CF', 'Zentralafrikanische Republik': 'CF',
  'Chad': 'TD', 'Tschad': 'TD',
  'Congo': 'CG', 'Republic of the Congo': 'CG', 'Kongo': 'CG',
  'DR Congo': 'CD', 'Democratic Republic of the Congo': 'CD', 'DRC': 'CD',
  'Gabon': 'GA', 'Gabun': 'GA',
  'Equatorial Guinea': 'GQ', 'Äquatorialguinea': 'GQ',
  'São Tomé and Príncipe': 'ST',

  // East Africa
  'Kenya': 'KE', 'Kenia': 'KE',
  'Tanzania': 'TZ', 'Tansania': 'TZ',
  'Uganda': 'UG',
  'Rwanda': 'RW', 'Ruanda': 'RW',
  'Burundi': 'BI',
  'Ethiopia': 'ET', 'Äthiopien': 'ET',
  'Eritrea': 'ER',
  'Djibouti': 'DJ', 'Dschibuti': 'DJ',
  'Somalia': 'SO',
  'Seychelles': 'SC', 'Seychellen': 'SC',
  'Comoros': 'KM', 'Komoren': 'KM',
  'Mauritius': 'MU',
  'Madagascar': 'MG', 'Madagaskar': 'MG',
  'Réunion': 'RE', 'Reunion': 'RE',
  'Mayotte': 'YT',

  // Southern Africa
  'South Africa': 'ZA', 'Südafrika': 'ZA',
  'Namibia': 'NA', 'Namibien': 'NA',
  'Botswana': 'BW', 'Botsuana': 'BW',
  'Zimbabwe': 'ZW', 'Simbabwe': 'ZW',
  'Zambia': 'ZM', 'Sambia': 'ZM',
  'Malawi': 'MW',
  'Mozambique': 'MZ', 'Mosambik': 'MZ',
  'Angola': 'AO',
  'Lesotho': 'LS',
  'Eswatini': 'SZ', 'Swaziland': 'SZ',
};

// Legacy/incorrect codes that were persisted before the mapping was fixed.
// 'NI' is Nicaragua in ISO 3166-1, but was used for Northern Ireland.
const CODE_ALIASES: Record<string, string> = {
  ni: 'gb-nir',
};

// Nationalities/demonyms - AI reporters often write "Finnish singer" or answer
// COUNTRY: Finnish instead of Finland.
const DEMONYM_TO_CODE: Record<string, string> = {
  // North America
  american: 'US', canadian: 'CA', mexican: 'MX',
  
  // Central America & Caribbean
  guatemalan: 'GT', honduran: 'HN', salvadoran: 'SV', nicaraguan: 'NI',
  'costa rican': 'CR', panamanian: 'PA', cuban: 'CU', jamaican: 'JM',
  haitian: 'HT', dominican: 'DO', 'puerto rican': 'PR',
  trinidadian: 'TT', trinbagonian: 'TT', barbadian: 'BB', bahamian: 'BS',
  
  // South America
  brazilian: 'BR', argentinian: 'AR', argentine: 'AR', colombian: 'CO',
  peruvian: 'PE', venezuelan: 'VE', chilean: 'CL', ecuadorian: 'EC',
  bolivian: 'BO', paraguayan: 'PY', uruguayan: 'UY', guyanese: 'GY',
  surinamese: 'SR',
  
  // Western Europe
  british: 'GB', english: 'gb-eng', scottish: 'gb-sct', welsh: 'gb-wls',
  'northern irish': 'gb-nir', irish: 'IE', french: 'FR', german: 'DE',
  dutch: 'NL', belgian: 'BE', luxembourgish: 'LU', swiss: 'CH',
  austrian: 'AT', monegasque: 'MC', andorran: 'AD',
  
  // Southern Europe
  spanish: 'ES', portuguese: 'PT', italian: 'IT', greek: 'GR', maltese: 'MT',
  
  // Northern Europe
  swedish: 'SE', norwegian: 'NO', danish: 'DK', finnish: 'FI', icelandic: 'IS',
  
  // Eastern Europe
  polish: 'PL', czech: 'CZ', slovak: 'SK', hungarian: 'HU', romanian: 'RO',
  bulgarian: 'BG', ukrainian: 'UA', belarusian: 'BY', moldovan: 'MD',
  russian: 'RU', estonian: 'EE', latvian: 'LV', lithuanian: 'LT',
  
  // Balkans
  croatian: 'HR', slovenian: 'SI', serbian: 'RS', bosnian: 'BA',
  montenegrin: 'ME', macedonian: 'MK', albanian: 'AL', kosovar: 'XK',
  
  // Turkey & Cyprus
  turkish: 'TR', cypriot: 'CY',
  
  // Caucasus
  georgian: 'GE', armenian: 'AM', azerbaijani: 'AZ',
  
  // Middle East
  israeli: 'IL', palestinian: 'PS', lebanese: 'LB', syrian: 'SY',
  jordanian: 'JO', iraqi: 'IQ', iranian: 'IR', saudi: 'SA', yemeni: 'YE',
  omani: 'OM', emirati: 'AE', qatari: 'QA', bahraini: 'BH', kuwaiti: 'KW',
  
  // Central Asia
  kazakh: 'KZ', uzbek: 'UZ', turkmen: 'TM', tajik: 'TJ', kyrgyz: 'KG', afghan: 'AF',
  
  // South Asia
  indian: 'IN', pakistani: 'PK', bangladeshi: 'BD', 'sri lankan': 'LK',
  nepali: 'NP', nepalese: 'NP', bhutanese: 'BT', maldivian: 'MV',
  
  // East Asia
  chinese: 'CN', japanese: 'JP', korean: 'KR', 'south korean': 'KR',
  'north korean': 'KP', taiwanese: 'TW', mongolian: 'MN',
  
  // Southeast Asia
  thai: 'TH', vietnamese: 'VN', filipino: 'PH', indonesian: 'ID',
  malaysian: 'MY', singaporean: 'SG', burmese: 'MM', cambodian: 'KH',
  laotian: 'LA', bruneian: 'BN',
  
  // Oceania
  australian: 'AU', 'new zealander': 'NZ', kiwi: 'NZ', fijian: 'FJ',
  samoan: 'WS', tongan: 'TO',
  
  // North Africa
  egyptian: 'EG', libyan: 'LY', tunisian: 'TN', algerian: 'DZ', moroccan: 'MA',
  sudanese: 'SD',
  
  // West Africa
  nigerian: 'NG', ghanaian: 'GH', senegalese: 'SN', ivorian: 'CI',
  malian: 'ML', 'burkinabé': 'BF', nigerien: 'NE', guinean: 'GN',
  beninese: 'BJ', togolese: 'TG', liberian: 'LR', gambian: 'GM',
  
  // Central Africa
  cameroonian: 'CM', chadian: 'TD', congolese: 'CG', gabonese: 'GA',
  
  // East Africa
  kenyan: 'KE', tanzanian: 'TZ', ugandan: 'UG', rwandan: 'RW',
  burundian: 'BI', ethiopian: 'ET', eritrean: 'ER', somali: 'SO',
  mauritian: 'MU', malagasy: 'MG',
  
  // Southern Africa
  'south african': 'ZA', namibian: 'NA', botswanan: 'BW', zimbabwean: 'ZW',
  zambian: 'ZM', malawian: 'MW', mozambican: 'MZ', angolan: 'AO',
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
