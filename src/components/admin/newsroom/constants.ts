import { FileText, ListOrdered, Tv, Radio } from "lucide-react";

// Region constants
export const REPORTER_REGIONS = [
  { value: 'north-america', label: 'North America' },
  { value: 'south-america', label: 'South America' },
  { value: 'europe', label: 'Europe' },
  { value: 'asia', label: 'Asia' },
  { value: 'oceania', label: 'Oceania' },
  { value: 'africa', label: 'Africa' },
  { value: 'middle-east', label: 'Middle East' },
  { value: 'global', label: 'Global' },
];

// Departments
export const DEPARTMENTS = [
  { id: 'authors', label: 'Authors' },
  { id: 'it', label: 'IT' },
  { id: 'marketing', label: 'Marketing' },
] as const;

export type DepartmentId = typeof DEPARTMENTS[number]['id'];

// Department themes
export const DEPT_THEME: Record<DepartmentId, {
  tabActive: string;
  accentText: string;
  dot: string;
  rosterActive: string;
  rosterActiveSub: string;
  pieceActive: string;
  pieceCompletedActive: string;
  pieceCompletedInactive: string;
  hoverBorder: string;
  hoverText: string;
  sendBtn: string;
  focusBorder: string;
}> = {
  authors: {
    tabActive: 'bg-[#E36B11] text-black',
    accentText: 'text-[#E36B11]',
    dot: 'bg-[#E36B11]',
    rosterActive: 'bg-[#E36B11] border-[#E36B11] text-black',
    rosterActiveSub: 'text-black/70',
    pieceActive: 'bg-[#E36B11] border-[#E36B11] text-black',
    pieceCompletedActive: 'bg-green-600 border-green-600 text-white',
    pieceCompletedInactive: 'bg-green-900/30 border-green-800 text-green-400',
    hoverBorder: 'hover:border-[#E36B11]',
    hoverText: 'hover:text-[#E36B11]',
    sendBtn: 'bg-[#E36B11] hover:bg-[#c07830] text-black',
    focusBorder: 'focus:border-[#E36B11]',
  },
  it: {
    tabActive: 'bg-blue-500 text-white',
    accentText: 'text-blue-400',
    dot: 'bg-blue-500',
    rosterActive: 'bg-blue-500 border-blue-500 text-white',
    rosterActiveSub: 'text-white/70',
    pieceActive: 'bg-blue-500 border-blue-500 text-white',
    pieceCompletedActive: 'bg-green-600 border-green-600 text-white',
    pieceCompletedInactive: 'bg-green-900/30 border-green-800 text-green-400',
    hoverBorder: 'hover:border-blue-500',
    hoverText: 'hover:text-blue-400',
    sendBtn: 'bg-blue-500 hover:bg-blue-600 text-white',
    focusBorder: 'focus:border-blue-500',
  },
  marketing: {
    tabActive: 'bg-purple-500 text-white',
    accentText: 'text-purple-400',
    dot: 'bg-purple-500',
    rosterActive: 'bg-purple-500 border-purple-500 text-white',
    rosterActiveSub: 'text-white/70',
    pieceActive: 'bg-purple-500 border-purple-500 text-white',
    pieceCompletedActive: 'bg-green-600 border-green-600 text-white',
    pieceCompletedInactive: 'bg-green-900/30 border-green-800 text-green-400',
    hoverBorder: 'hover:border-purple-500',
    hoverText: 'hover:text-purple-400',
    sendBtn: 'bg-purple-500 hover:bg-purple-600 text-white',
    focusBorder: 'focus:border-purple-500',
  },
};

// Content types
export const CONTENT_TYPES = [
  { id: 'article', label: 'Article', icon: FileText },
  { id: 'rankroll', label: 'Rankroll', icon: ListOrdered },
  { id: 'tv', label: 'TV', icon: Tv },
  { id: 'radio', label: 'Radio', icon: Radio },
] as const;

// Color cycle for reporters
export const COLOR_CYCLE = [
  { bg: 'bg-amber-400', text: 'text-amber-400' },
  { bg: 'bg-emerald-400', text: 'text-emerald-400' },
  { bg: 'bg-sky-400', text: 'text-sky-400' },
  { bg: 'bg-rose-400', text: 'text-rose-400' },
  { bg: 'bg-violet-400', text: 'text-violet-400' },
  { bg: 'bg-orange-400', text: 'text-orange-400' },
  { bg: 'bg-teal-400', text: 'text-teal-400' },
];

// Prompt suggestions
export const PROMPT_SUGGESTIONS = [
  "Who has a birthday today?",
  "Find a GenX celebrity born today",
  "Who died on this day?",
  "What happened on this day in history?",
];

// Template prompts for quick selection
export const PROMPT_TEMPLATES = [
  { id: 'birthday', label: '🎂 Birthday', category: '', prompt: 'Find a GenX celebrity (born 1965-1980) who has a birthday TODAY. Search your region/continent.' },
  { id: 'rip', label: '🕯️ RIP', category: '', prompt: 'Find a GenX celebrity (born 1965-1980) who DIED on this day (any year). This is for a memorial/RIP article.' },
  { id: 'movie-tv', label: '📺 Movie/TV', category: 'movies-tv', prompt: 'Find a GenX actor/actress (born 1965-1980) who has a birthday TODAY.' },
  { id: 'music', label: '🎵 Music', category: 'music', prompt: 'Find a GenX musician/singer (born 1965-1980) who has a birthday TODAY.' },
  { id: 'sport', label: '🏆 Sport', category: 'sports', prompt: 'Find a GenX athlete (born 1965-1980) who has a birthday TODAY.' },
  { id: 'history', label: '📜 History', category: '', prompt: 'What significant event happened ON THIS DAY in history that would interest Generation X?' },
  { id: 'band', label: '🎸 Band', category: 'music', prompt: 'Find a band/group formed in the 80s or 90s that has an anniversary TODAY.' },
  { id: 'album', label: '💿 Album', category: 'music', prompt: 'Find a classic album released ON THIS DAY that Generation X would remember.' },
  { id: 'tv-series', label: '📺 TV Series', category: 'movies-tv', prompt: 'Find a TV series from the 80s/90s that premiered or had a finale ON THIS DAY.' },
  { id: 'game', label: '🎮 Game', category: 'gaming', prompt: 'Find a classic video game released ON THIS DAY that Generation X played.' },
];

// Search categories for filtering
export const SEARCH_CATEGORIES = [
  { id: '', label: '🔍 All Categories' },
  { id: 'sports', label: '🏆 Sports' },
  { id: 'music', label: '🎵 Music' },
  { id: 'movies-tv', label: '📺 Movies/TV' },
  { id: 'gaming', label: '🎮 Gaming' },
  { id: 'politics', label: '🏛️ Politics' },
  { id: 'lifestyle', label: '✨ Lifestyle' },
  { id: 'tech', label: '💻 Tech' },
];

// Search countries for filtering
export const SEARCH_COUNTRIES = [
  { id: '', label: '🌍 All Countries' },
  { id: 'US', label: '🇺🇸 USA' },
  { id: 'UK', label: '🇬🇧 UK' },
  { id: 'DE', label: '🇩🇪 Germany' },
  { id: 'FR', label: '🇫🇷 France' },
  { id: 'IT', label: '🇮🇹 Italy' },
  { id: 'ES', label: '🇪🇸 Spain' },
  { id: 'PT', label: '🇵🇹 Portugal' },
  { id: 'NL', label: '🇳🇱 Netherlands' },
  { id: 'BE', label: '🇧🇪 Belgium' },
  { id: 'AT', label: '🇦🇹 Austria' },
  { id: 'CH', label: '🇨🇭 Switzerland' },
  { id: 'PL', label: '🇵🇱 Poland' },
  { id: 'SE', label: '🇸🇪 Sweden' },
  { id: 'NO', label: '🇳🇴 Norway' },
  { id: 'DK', label: '🇩🇰 Denmark' },
  { id: 'FI', label: '🇫🇮 Finland' },
  { id: 'IE', label: '🇮🇪 Ireland' },
  { id: 'CA', label: '🇨🇦 Canada' },
  { id: 'MX', label: '🇲🇽 Mexico' },
  { id: 'BR', label: '🇧🇷 Brazil' },
  { id: 'AR', label: '🇦🇷 Argentina' },
  { id: 'CL', label: '🇨🇱 Chile' },
  { id: 'CO', label: '🇨🇴 Colombia' },
  { id: 'JP', label: '🇯🇵 Japan' },
  { id: 'KR', label: '🇰🇷 South Korea' },
  { id: 'CN', label: '🇨🇳 China' },
  { id: 'IN', label: '🇮🇳 India' },
  { id: 'AU', label: '🇦🇺 Australia' },
  { id: 'NZ', label: '🇳🇿 New Zealand' },
  { id: 'ZA', label: '🇿🇦 South Africa' },
  { id: 'EG', label: '🇪🇬 Egypt' },
  { id: 'NG', label: '🇳🇬 Nigeria' },
  { id: 'IL', label: '🇮🇱 Israel' },
  { id: 'TR', label: '🇹🇷 Turkey' },
  { id: 'SA', label: '🇸🇦 Saudi Arabia' },
  { id: 'AE', label: '🇦🇪 UAE' },
  { id: 'TH', label: '🇹🇭 Thailand' },
  { id: 'PH', label: '🇵🇭 Philippines' },
  { id: 'ID', label: '🇮🇩 Indonesia' },
  { id: 'MY', label: '🇲🇾 Malaysia' },
  { id: 'SG', label: '🇸🇬 Singapore' },
  { id: 'VN', label: '🇻🇳 Vietnam' },
];
