"use client";

import { useState, useEffect, useRef } from "react";
import { 
  X, Send, Loader2, ListOrdered, FileText, Tv, Radio, Plus, Check, ChevronDown, 
  CheckCircle, AlertCircle, Users, Sparkles, ExternalLink, User, Eye, Pencil, Save,
  RefreshCw, Trash2, Calendar, Square, BookOpen, Play, RotateCcw, Video, Music
} from "lucide-react";
import BlockEditor from "@/components/admin/BlockEditor";
import ImagePickerModal from "@/components/admin/ImagePickerModal";
import CountryFlag from "@/components/CountryFlag";
import RankrollTab from "@/components/admin/RankrollTab";

// Region constants (duplicated from ReporterProfile to avoid mongoose import on client)
const REPORTER_REGIONS = [
  { value: 'north-america', label: 'North America' },
  { value: 'south-america', label: 'South America' },
  { value: 'europe', label: 'Europe' },
  { value: 'asia', label: 'Asia' },
  { value: 'oceania', label: 'Oceania' },
  { value: 'africa', label: 'Africa' },
  { value: 'middle-east', label: 'Middle East' },
  { value: 'global', label: 'Global' },
];

// ---- Types ----------------------------------------------------------------

interface Reporter {
  _id: string;
  username: string;
  displayName?: string;
  avatar?: string;
}

interface ReporterProfile {
  _id: string;
  userId: string;
  role: string;
  region?: string;
  nationality: string;
  specialty?: string;
  responsibilities?: string;
  writingStyle?: string;
  personality?: string;
  user?: Reporter;
}

// Proposal from a reporter
interface Proposal {
  name: string;
  birthday: string;
  deathday?: string; // For RIP - when they died
  causeOfDeath?: string; // For RIP - how they died
  country: string;
  profession: string;
  description: string;
  reporterId: string;
  reporterName: string;
  reporterSpecialty?: string;
  category?: string; // sports, music, movies-tv, etc.
  isRIP?: boolean; // True if this is a death anniversary, not birthday
  isEvent?: boolean; // True if this is an ON THIS DAY event, not a person
  isError?: boolean; // True if reporter couldn't find anyone
  errorReason?: string; // Why the proposal failed
  savedToMenschen?: boolean; // True if successfully saved to Menschen DB
}

interface ConferenceMessage {
  id: string;
  from: 'me' | 'system' | 'result' | 'article-preview' | 'menschen-check' | 'proposals' | string;
  name?: string;
  text: string;
  avatar?: string;
  // For result messages
  resultType?: 'article' | 'rankroll' | 'menschen';
  // For proposals (selectable cards)
  proposals?: Proposal[];
  // For article preview (before activation)
  articlePreview?: {
    title: string;
    subtitle?: string;
    content: string;
    coverImage?: string;
    category?: string;
    tags?: string[];
    reporterId: string;
  };
  // For Menschen check (before saving)
  menschenCheck?: {
    name: string;
    birthday: string;
    country: string;
    profession: string;
    reporterId: string;
  };
  activated?: boolean;
  articleDraftId?: string;
  articlePersonName?: string; // Person name for Rankroll button
  menschenSaved?: boolean;
}

interface Piece {
  id: string;
  type: 'article' | 'rankroll' | 'tv' | 'radio' | 'history';
  date: string;
  completed: boolean;
  messages: ConferenceMessage[];
  activeReporterIds: string[];
}

interface NewsroomConferenceProps {
  reporters?: Reporter[];
  reporterProfiles?: Record<string, ReporterProfile>;
  userId?: string;
  onClose?: () => void;
  onGoToArticles?: () => void;
  onRankrollProposed?: (title: string, description: string) => void;
}

// ---- Constants ------------------------------------------------------------

const CONTENT_TYPES = [
  { id: "article", label: "Article", icon: FileText },
  { id: "rankroll", label: "Rankroll", icon: ListOrdered },
  { id: "tv", label: "TV", icon: Tv },
  { id: "radio", label: "Radio", icon: Radio },
  { id: "history", label: "History", icon: BookOpen },
] as const;

const DEPARTMENTS = [
  { id: "authors", label: "Authors" },
  { id: "it", label: "IT" },
  { id: "marketing", label: "Marketing" },
] as const;

const DEPT_THEME: Record<string, {
  tabActive: string;
  dot: string;
  accentText: string;
  rosterActive: string;
  rosterActiveSub: string;
  pieceActive: string;
  pieceCompletedInactive: string;
  resultBox: string;
  resultText: string;
  resultBtn: string;
  sendBtn: string;
  focusBorder: string;
  hoverBorder: string;
  hoverText: string;
}> = {
  authors: {
    tabActive: "bg-green-500 text-black",
    dot: "bg-green-500",
    accentText: "text-green-500",
    rosterActive: "bg-green-500 border-green-400",
    rosterActiveSub: "text-green-950",
    pieceActive: "bg-green-500 border-green-400 text-black",
    pieceCompletedInactive: "bg-green-900 border-green-700 text-green-300 hover:bg-green-800",
    resultBox: "bg-green-950 border-green-500",
    resultText: "text-green-400",
    resultBtn: "bg-green-500 hover:bg-green-400 text-black",
    sendBtn: "bg-green-500 hover:bg-green-400 text-black",
    focusBorder: "focus:border-green-500",
    hoverBorder: "hover:border-green-500",
    hoverText: "hover:text-green-400",
  },
  it: {
    tabActive: "bg-blue-500 text-black",
    dot: "bg-blue-500",
    accentText: "text-blue-400",
    rosterActive: "bg-blue-500 border-blue-400",
    rosterActiveSub: "text-blue-950",
    pieceActive: "bg-blue-500 border-blue-400 text-black",
    pieceCompletedInactive: "bg-blue-900 border-blue-700 text-blue-300 hover:bg-blue-800",
    resultBox: "bg-blue-950 border-blue-500",
    resultText: "text-blue-400",
    resultBtn: "bg-blue-500 hover:bg-blue-400 text-black",
    sendBtn: "bg-blue-500 hover:bg-blue-400 text-black",
    focusBorder: "focus:border-blue-500",
    hoverBorder: "hover:border-blue-500",
    hoverText: "hover:text-blue-400",
  },
  marketing: {
    tabActive: "bg-amber-500 text-black",
    dot: "bg-amber-500",
    accentText: "text-amber-400",
    rosterActive: "bg-amber-500 border-amber-400",
    rosterActiveSub: "text-amber-950",
    pieceActive: "bg-amber-500 border-amber-400 text-black",
    pieceCompletedInactive: "bg-amber-900 border-amber-700 text-amber-300 hover:bg-amber-800",
    resultBox: "bg-amber-950 border-amber-500",
    resultText: "text-amber-400",
    resultBtn: "bg-amber-500 hover:bg-amber-400 text-black",
    sendBtn: "bg-amber-500 hover:bg-amber-400 text-black",
    focusBorder: "focus:border-amber-500",
    hoverBorder: "hover:border-amber-500",
    hoverText: "hover:text-amber-400",
  },
};

const COLOR_CYCLE = [
  { text: "text-amber-400", bg: "bg-amber-400" },
  { text: "text-emerald-400", bg: "bg-emerald-400" },
  { text: "text-sky-400", bg: "bg-sky-400" },
  { text: "text-orange-400", bg: "bg-orange-400" },
  { text: "text-violet-400", bg: "bg-violet-400" },
  { text: "text-pink-400", bg: "bg-pink-400" },
  { text: "text-teal-400", bg: "bg-teal-400" },
  { text: "text-red-400", bg: "bg-red-400" },
];

const PROMPT_TEMPLATES = [
  // Person-based templates (Birthday/RIP)
  { id: 'birthday', label: '🎂 Birthday', prompt: 'BORN ON THIS DAY — find a GenX celebrity (born 1965-1980) who was BORN ON THIS EXACT DATE. Include their birth date, country, and why they matter to GenX.' },
  { id: 'rip', label: '🕯️ RIP', prompt: 'DIED ON THIS DAY — find a GenX celebrity (born 1965-1980) who DIED ON THIS EXACT DATE. Include their birth date, death date, country, and a tribute to their legacy.' },
  // Event-based templates (ON THIS DAY)
  { id: 'movie', label: '🎬 Movie/TV', prompt: 'ON THIS DAY — find a movie or TV show that PREMIERED or had a significant event ON THIS EXACT DATE (any year 1975-2000). Could be: a film premiere, a TV series finale, a famous episode airing, an Oscar win, etc. Give the exact date, title, and why it mattered to GenX. NOT a person — an EVENT.' },
  { id: 'music', label: '🎵 Music', prompt: 'ON THIS DAY — find a music event that happened ON THIS EXACT DATE (any year 1975-2000). Could be: an album release, a legendary concert, a #1 hit, a band forming/breaking up, an award show moment, etc. Give the exact date, artist/song, and why it mattered to GenX. NOT a person — an EVENT.' },
  { id: 'sport', label: '⚽ Sport', prompt: 'ON THIS DAY — find a sports event that happened ON THIS EXACT DATE (any year 1975-2000). Could be: a championship game, a world record, a legendary match, an upset, a retirement, etc. Give the exact date, teams/athletes, scores, and why it became folklore. NOT a birthday — an EVENT.' },
  { id: 'history', label: '📜 History', prompt: 'ON THIS DAY — find a historical event that happened ON THIS EXACT DATE (any year 1975-2000). Could be: a political moment, a cultural shift, a tragedy, a triumph, a tech launch, etc. Give the exact date, what happened, and why it shaped GenX. NOT a person — an EVENT.' },
  { id: 'band', label: '💎 Band', prompt: 'ON THIS DAY — find a band-related event that happened ON THIS EXACT DATE (any year 1975-2000). Could be: a band forming, breaking up, a legendary concert, a debut album release, etc. Give the exact date, band name, and why it mattered. NOT a person — an EVENT.' },
  { id: 'album', label: '💿 Album', prompt: 'ON THIS DAY — find an album that was RELEASED ON THIS EXACT DATE (any year 1975-2000). Give the exact release date, artist, album name, and why it was significant to GenX. NOT a person — an EVENT.' },
  { id: 'tvseries', label: '📺 TV Series', prompt: 'ON THIS DAY — find a TV series event that happened ON THIS EXACT DATE (any year 1975-2000). Could be: a series premiere, a finale, a famous episode, etc. Give the exact date, show name, and why it mattered. NOT a person — an EVENT.' },
  { id: 'game', label: '🎮 Game', prompt: 'ON THIS DAY — find a video game that was RELEASED ON THIS EXACT DATE (any year 1975-2000). Could be: an arcade game debut, a console launch, a legendary game release, etc. Give the exact date, game name, and why it mattered to GenX. NOT a person — an EVENT.' },
  // Special templates (load data dynamically)
  { id: 'radio', label: '📻 Radio', prompt: 'RADIO_SONG_REQUESTS', isDynamic: true },
  { id: 'custom', label: '✏️ Custom', prompt: '' },
];

const PROMPT_SUGGESTIONS = [
  "Write an article about...",
  "Create a rankroll for...",
  "Who else should join this conversation?",
  "Summarize the discussion so far",
];

// ---- Template Panel Component ---------------------------------------------

function TemplatePanel({ 
  onSelect, 
  onClose
}: { 
  onSelect: (prompt: string) => void; 
  onClose: () => void;
}) {
  const [activeTemplate, setActiveTemplate] = useState(PROMPT_TEMPLATES[0].id);
  const [customPrompt, setCustomPrompt] = useState('');
  
  const currentTemplate = PROMPT_TEMPLATES.find(t => t.id === activeTemplate);
  const promptText = activeTemplate === 'custom' ? customPrompt : (currentTemplate?.prompt || '');

  return (
    <div className="border-t border-gray-800 bg-gray-900/95 p-4">
      {/* Template tabs */}
      <div className="flex flex-wrap gap-1 mb-3">
        {PROMPT_TEMPLATES.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTemplate(t.id)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeTemplate === t.id 
                ? 'bg-[#E36B11] text-black' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      
      {/* Prompt text area */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 mb-3">
        {activeTemplate === 'custom' ? (
          <textarea
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            placeholder="Enter your custom prompt..."
            rows={2}
            className="w-full bg-transparent text-sm text-gray-200 placeholder-gray-500 resize-none focus:outline-none"
          />
        ) : (
          <p className="text-sm text-gray-200">{promptText}</p>
        )}
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigator.clipboard.writeText(promptText)}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 hover:bg-gray-700"
        >
          📋 Copy
        </button>
        <button
          onClick={() => onSelect(promptText)}
          disabled={!promptText.trim()}
          className="px-4 py-1.5 bg-[#E36B11] hover:bg-[#c07830] rounded text-xs font-bold text-white disabled:opacity-50"
        >
          → Use as Campaign Topic
        </button>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          ↺ Reset
        </button>
      </div>
    </div>
  );
}

// ---- Helpers --------------------------------------------------------------

function todayLabel(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---- Component ------------------------------------------------------------

export default function NewsroomConference({
  reporters: externalReporters,
  reporterProfiles: externalProfiles,
  userId,
  onClose,
  onGoToArticles,
  onRankrollProposed,
}: NewsroomConferenceProps) {
  // Department state
  const [activeDept, setActiveDept] = useState<string>("authors");
  const theme = DEPT_THEME[activeDept];

  // Load reporters if not provided externally
  const [loadedReporters, setLoadedReporters] = useState<Reporter[]>([]);
  const [loadedProfiles, setLoadedProfiles] = useState<Record<string, ReporterProfile>>({});
  const [loading, setLoading] = useState(!externalReporters);

  useEffect(() => {
    if (externalReporters) return; // Already have reporters from props
    
    async function loadReporters() {
      try {
        // Load AI reporters
        const usersRes = await fetch('/api/admin/users?isAIReporter=true');
        const usersData = await usersRes.json();
        if (usersData.success) {
          setLoadedReporters(usersData.users || []);
        }
        
        // Load reporter profiles
        const profilesRes = await fetch('/api/editorial/reporters');
        const profilesData = await profilesRes.json();
        if (profilesData.success && profilesData.reporters) {
          const profileMap: Record<string, ReporterProfile> = {};
          profilesData.reporters.forEach((p: ReporterProfile) => {
            if (p.userId) profileMap[p.userId] = p;
          });
          setLoadedProfiles(profileMap);
        }
      } catch (err) {
        console.error('Failed to load reporters:', err);
      } finally {
        setLoading(false);
      }
    }
    
    loadReporters();
  }, [externalReporters]);

  const reporters = externalReporters || loadedReporters;
  const reporterProfiles = externalProfiles || loadedProfiles;

  // Build roster from reporters + profiles (exclude "Eastercorn" - that's the admin account)
  const roster = reporters
    .filter(r => r._id && r.username !== 'ai_eastercorn' && r.displayName !== 'Eastercorn')
    .map(r => {
      const profile = reporterProfiles[r._id];
      return {
        id: r._id,
        name: r.displayName || r.username,
        avatar: r.avatar,
        region: profile?.region || '',
        regionLabel: profile?.nationality || REPORTER_REGIONS.find(reg => reg.value === profile?.region)?.label || '',
        role: profile?.role || 'journalist',
        specialty: profile?.specialty || profile?.responsibilities || '',
        active: false,
      };
    });

  // Pieces state (per department) - restore from localStorage
  const [pieces, setPieces] = useState<Record<string, Piece[]>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('newsroom-pieces');
      if (saved) {
        try { return JSON.parse(saved); } catch { /* ignore */ }
      }
    }
    return { authors: [], it: [], marketing: [] };
  });
  const [activePieceId, setActivePieceId] = useState<Record<string, string | null>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('newsroom-activePieceId');
      if (saved) {
        try { return JSON.parse(saved); } catch { /* ignore */ }
      }
    }
    return { authors: null, it: null, marketing: null };
  });

  // Active reporters in current piece - restore from localStorage
  const [activeReporters, setActiveReporters] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('newsroom-activeReporters');
      if (saved) {
        try { return JSON.parse(saved); } catch { /* ignore */ }
      }
    }
    return {};
  });

  // Save state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('newsroom-pieces', JSON.stringify(pieces));
  }, [pieces]);
  
  useEffect(() => {
    localStorage.setItem('newsroom-activePieceId', JSON.stringify(activePieceId));
  }, [activePieceId]);
  
  useEffect(() => {
    localStorage.setItem('newsroom-activeReporters', JSON.stringify(activeReporters));
  }, [activeReporters]);

  // UI state
  const [draft, setDraft] = useState("");
  const [showPrompts, setShowPrompts] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [typing, setTyping] = useState<string | false>(false); // false or reporter name
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const cancelRequestedRef = useRef(false); // For stopping search (ref so loops can read it)
  
  // Global search filters
  const [globalCategory, setGlobalCategory] = useState<string>('');
  const [globalCountry, setGlobalCountry] = useState<string>('');
  const [rankrollInput, setRankrollInput] = useState<string>(''); // Free text for Rank template
  const [tvSearchInput, setTvSearchInput] = useState<string>(''); // Search term for TV videos
  const [tvSearching, setTvSearching] = useState(false);
  const [tvResults, setTvResults] = useState<Array<{
    youtubeId: string;
    title: string;
    description: string;
    duration: string;
    thumbnail: string;
  }>>([]);
  const [tvSaving, setTvSaving] = useState<number | null>(null); // Position being saved (1, 2, or 3)
  
  // Pending reporters (for proposal loading states)
  const [pendingReporters, setPendingReporters] = useState<Array<{id: string; name: string; status: 'searching' | 'done' | 'error'; error?: string}>>([]);
  
  // Reporter category assignments (reporterId -> category)
  const [reporterCategories, setReporterCategories] = useState<Record<string, string>>({});
  const SEARCH_CATEGORIES = [
    { id: '', label: '— Any —' },
    { id: 'sports', label: '🏆 Sports' },
    { id: 'music', label: '🎵 Music' },
    { id: 'movies-tv', label: '📺 Movies/TV' },
    { id: 'lifestyle', label: '✨ Lifestyle' },
    { id: 'politics', label: '🏛️ Politics' },
    { id: 'tech', label: '💻 Tech' },
    { id: 'gaming', label: '🎮 Gaming' },
  ];
  const SEARCH_COUNTRIES = [
    { id: '', label: 'Any Country' },
    { id: 'US', label: '🇺🇸 USA' },
    { id: 'UK', label: '🇬🇧 UK' },
    { id: 'DE', label: '🇩🇪 Germany' },
    { id: 'FR', label: '🇫🇷 France' },
    { id: 'IT', label: '🇮🇹 Italy' },
    { id: 'ES', label: '🇪🇸 Spain' },
    { id: 'NL', label: '🇳🇱 Netherlands' },
    { id: 'BE', label: '🇧🇪 Belgium' },
    { id: 'AT', label: '🇦🇹 Austria' },
    { id: 'CH', label: '🇨🇭 Switzerland' },
    { id: 'PL', label: '🇵🇱 Poland' },
    { id: 'SE', label: '🇸🇪 Sweden' },
    { id: 'NO', label: '🇳🇴 Norway' },
    { id: 'DK', label: '🇩🇰 Denmark' },
    { id: 'FI', label: '🇫🇮 Finland' },
    { id: 'PT', label: '🇵🇹 Portugal' },
    { id: 'GR', label: '🇬🇷 Greece' },
    { id: 'IE', label: '🇮🇪 Ireland' },
    { id: 'CZ', label: '🇨🇿 Czech Republic' },
    { id: 'HU', label: '🇭🇺 Hungary' },
    { id: 'RO', label: '🇷🇴 Romania' },
    { id: 'RU', label: '🇷🇺 Russia' },
    { id: 'UA', label: '🇺🇦 Ukraine' },
    { id: 'CA', label: '🇨🇦 Canada' },
    { id: 'MX', label: '🇲🇽 Mexico' },
    { id: 'BR', label: '🇧🇷 Brazil' },
    { id: 'AR', label: '🇦🇷 Argentina' },
    { id: 'CL', label: '🇨🇱 Chile' },
    { id: 'CO', label: '🇨🇴 Colombia' },
    { id: 'PE', label: '🇵🇪 Peru' },
    { id: 'VE', label: '🇻🇪 Venezuela' },
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
  const [apiStatus, setApiStatus] = useState<{ status: string; message: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Radio Song Requests state (for Radio template)
  const [songRequests, setSongRequests] = useState<Array<{
    _id: string;
    username: string;
    playlist: string;
    band: string;
    song: string;
    link?: string;
    coverImage?: string;
    status: string;
    createdAt: string;
  }>>([]);
  const [songRequestsLoading, setSongRequestsLoading] = useState(false);

  // Reporter Edit Modal state
  const [editingReporter, setEditingReporter] = useState<{
    id: string;
    name: string;
    nationality: string;
    region: string;
    specialty: string;
    writingStyle: string;
    personality: string;
    responsibilities: string;
  } | null>(null);
  const [savingReporter, setSavingReporter] = useState(false);

  // Article editor state
  const [articleDraft, setArticleDraft] = useState<{
    _id?: string;
    title: string;
    subtitle: string;
    content: string;
    category: string;
    tags: string[];
    coverImage: string;
    imagePosX?: number;
    imagePosY?: number;
    reporterId: string;
    reporterName: string;
    personName: string;
    personBirthday?: string;
    personDeathday?: string;
    personCauseOfDeath?: string;
    personCountry?: string;
    isRIP?: boolean;
  } | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [articleTagInput, setArticleTagInput] = useState("");
  
  // Created articles tabs (shown below chat)
  const [createdArticles, setCreatedArticles] = useState<Array<{
    id: string;
    title: string;
    reporterName: string;
    draft: typeof articleDraft;
    saved?: boolean;
  }>>([]);
  const [selectedArticleTab, setSelectedArticleTab] = useState<string | null>(null);
  const [selectingProposal, setSelectingProposal] = useState<string | null>(null); // Track which proposal is being selected
  const [retryingReporter, setRetryingReporter] = useState<string | null>(null); // Track which reporter is retrying
  const [savingArticle, setSavingArticle] = useState(false); // Track article save
  const [abortController, setAbortController] = useState<AbortController | null>(null); // For cancelling article generation
  
  // Created rankrolls tabs (shown below chat, like articles)
  const [createdRankrolls, setCreatedRankrolls] = useState<Array<{
    id: string;
    title: string;
    subtitle: string;
    items: Array<{ id: string; title: string; description: string; image: string; upvotes: number; downvotes: number; score: number }>;
    category: string;
    reporterName: string;
    reporterId: string;
  }>>([]);
  const [selectedRankrollTab, setSelectedRankrollTab] = useState<string | null>(null);
  const [savingRankroll, setSavingRankroll] = useState(false);
  
  // Rankroll Editor Modal state (opens the full RankrollTab editor)
  const [rankrollEditorData, setRankrollEditorData] = useState<{
    title: string;
    description: string;
    items: Array<{ title: string; description: string; image: string }>;
    category: string;
  } | null>(null);

  // History mode state - restore from localStorage
  const [historyEvents, setHistoryEvents] = useState<Array<{
    id: string;
    title: string;
    year: number;
    date: string;
    description: string;
    category: string;
    youtubeSearch: string;
    youtubeVideoId?: string;
    reporterId: string;
    reporterName: string;
    selected: boolean;
    loading: boolean;
    error?: string;
  }>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('newsroom-historyEvents');
      if (saved) {
        try { 
          const parsed = JSON.parse(saved);
          // Reset loading states on restore
          return parsed.map((e: any) => ({ ...e, loading: false }));
        } catch { /* ignore */ }
      }
    }
    return [];
  });
  const [historySearching, setHistorySearching] = useState(false);
  const [historyCompiling, setHistoryCompiling] = useState(false);
  const [historyBanner, setHistoryBanner] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('newsroom-historyBanner') || null;
    }
    return null;
  });
  const [historyBannerGenerating, setHistoryBannerGenerating] = useState(false);
  const [showHistoryBannerModal, setShowHistoryBannerModal] = useState(false);
  const [historyHeadline, setHistoryHeadline] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('newsroom-historyHeadline') || null;
    }
    return null;
  });

  // Save history events to localStorage
  useEffect(() => {
    // Don't save if all events are loading (initial state)
    if (historyEvents.length > 0 && !historyEvents.every(e => e.loading)) {
      localStorage.setItem('newsroom-historyEvents', JSON.stringify(historyEvents));
    } else if (historyEvents.length === 0) {
      localStorage.removeItem('newsroom-historyEvents');
    }
  }, [historyEvents]);

  // Save history banner to localStorage
  useEffect(() => {
    if (historyBanner) {
      localStorage.setItem('newsroom-historyBanner', historyBanner);
    } else {
      localStorage.removeItem('newsroom-historyBanner');
    }
  }, [historyBanner]);

  // Save history headline to localStorage
  useEffect(() => {
    if (historyHeadline) {
      localStorage.setItem('newsroom-historyHeadline', historyHeadline);
    } else {
      localStorage.removeItem('newsroom-historyHeadline');
    }
  }, [historyHeadline]);

  // Current piece
  const deptPieces = pieces[activeDept] || [];
  const currentPieceId = activePieceId[activeDept];
  const currentPiece = deptPieces.find(p => p.id === currentPieceId) || null;
  const messages = currentPiece?.messages || [];

  // Active people in current piece
  const activePeople = roster.filter(p => activeReporters[p.id]);

  // Check API status on mount
  useEffect(() => {
    fetch('/api/openai/status')
      .then(r => r.json())
      .then(d => setApiStatus({ status: d.status, message: d.message }))
      .catch(() => setApiStatus({ status: 'error', message: 'Could not check API status' }));
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing]);

  // Auto-load song requests when Radio tab is opened
  useEffect(() => {
    if (currentPiece?.type === 'radio' && songRequests.length === 0 && !songRequestsLoading) {
      setSongRequestsLoading(true);
      fetch('/api/song-request?status=added')
        .then(res => res.json())
        .then(data => {
          if (data.success) setSongRequests(data.requests || []);
        })
        .catch(e => console.error('Failed to load song requests:', e))
        .finally(() => setSongRequestsLoading(false));
    }
  }, [currentPiece?.type, songRequests.length, songRequestsLoading]);

  // Color for a person
  function colorFor(personId: string) {
    const idx = roster.findIndex(p => p.id === personId);
    return COLOR_CYCLE[idx % COLOR_CYCLE.length];
  }

  // Update messages in current piece
  function updatePieceMessages(pieceId: string, updater: (msgs: ConferenceMessage[]) => ConferenceMessage[]) {
    setPieces(prev => ({
      ...prev,
      [activeDept]: (prev[activeDept] || []).map(p =>
        p.id === pieceId ? { ...p, messages: updater(p.messages || []) } : p
      ),
    }));
  }

  // Open reporter edit modal
  function openReporterEdit(person: typeof roster[0]) {
    const profile = reporterProfiles[person.id];
    setEditingReporter({
      id: person.id,
      name: person.name,
      nationality: profile?.nationality || '',
      region: profile?.region || 'europe',
      specialty: profile?.specialty || '',
      writingStyle: profile?.writingStyle || '',
      personality: profile?.personality || '',
      responsibilities: profile?.responsibilities || '',
    });
  }

  // Save reporter changes
  async function saveReporterEdit() {
    if (!editingReporter) return;
    setSavingReporter(true);
    
    const updateData = {
      region: editingReporter.region,
      writingStyle: editingReporter.writingStyle,
    };
    console.log('Saving reporter:', editingReporter.id, updateData);
    
    try {
      const res = await fetch(`/api/editorial/reporters/${editingReporter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      const result = await res.json();
      console.log('Save result:', result);
      if (res.ok) {
        // Reload profiles
        const profilesRes = await fetch('/api/editorial/reporters');
        const profilesData = await profilesRes.json();
        if (profilesData.profiles) {
          const profileMap: Record<string, ReporterProfile> = {};
          profilesData.profiles.forEach((p: ReporterProfile) => {
            profileMap[p.userId] = p;
          });
          setLoadedProfiles(profileMap);
        }
        setEditingReporter(null);
      }
    } catch (err) {
      console.error('Failed to save reporter:', err);
    }
    setSavingReporter(false);
  }

  // Toggle person in/out of conference - JUST SELECT, NO AUTO-SEARCH
  function togglePerson(personId: string) {
    setActiveReporters(prev => ({ ...prev, [personId]: !prev[personId] }));
  }

  // Create a new piece OR switch to existing piece of same type
  function createPiece(typeId: string) {
    // Check if there's already a piece of this type for today
    const existingPiece = deptPieces.find(p => p.type === typeId);
    if (existingPiece) {
      // Switch to existing piece instead of creating new one
      setActivePieceId(prev => ({ ...prev, [activeDept]: existingPiece.id }));
      setTypeMenuOpen(false);
      return;
    }
    
    const typeLabel = CONTENT_TYPES.find(t => t.id === typeId)?.label || typeId;
    const newId = `${activeDept}-${typeId}-${Date.now()}`;
    const newPiece: Piece = {
      id: newId,
      type: typeId as Piece['type'],
      date: todayLabel(),
      completed: false,
      messages: [{ id: generateId(), from: 'system', text: `New ${typeLabel} conference started.` }],
      activeReporterIds: [],
    };
    setPieces(prev => ({ ...prev, [activeDept]: [...prev[activeDept], newPiece] }));
    setActivePieceId(prev => ({ ...prev, [activeDept]: newId }));
    setTypeMenuOpen(false);
    // Reset active reporters for new piece
    setActiveReporters({});
  }

  // Close/delete a piece (red X button)
  function closePiece(pieceId: string) {
    const piece = pieces[activeDept].find(p => p.id === pieceId);
    const pieceType = piece?.type || 'piece';
    
    // For History pieces, check if there are events and ask for confirmation
    if (pieceType === 'history' && historyEvents.length > 0) {
      const confirmed = window.confirm(
        `Delete History session?\n\nThis will remove ${historyEvents.length} event(s) and the banner image.`
      );
      if (!confirmed) return;
      
      // Clear history data
      setHistoryEvents([]);
      setHistoryBanner(null);
      setHistoryHeadline(null);
    } else if (pieceType !== 'history') {
      // For other piece types, simple confirmation
      const confirmed = window.confirm(`Delete this ${pieceType} session?`);
      if (!confirmed) return;
    }
    
    const remaining = pieces[activeDept].filter(p => p.id !== pieceId);
    
    setPieces(prev => ({
      ...prev,
      [activeDept]: remaining,
    }));
    
    // If we closed the active piece, select another or null
    if (activePieceId[activeDept] === pieceId) {
      setActivePieceId(prev => ({
        ...prev,
        [activeDept]: remaining.length > 0 ? remaining[remaining.length - 1].id : null,
      }));
    }
    
    // If no pieces left in any department, clear localStorage
    const allPieces = { ...pieces, [activeDept]: remaining };
    const totalPieces = Object.values(allPieces).flat().length;
    if (totalPieces === 0) {
      localStorage.removeItem('newsroom-pieces');
      localStorage.removeItem('newsroom-activePieceId');
      localStorage.removeItem('newsroom-activeReporters');
      setActiveReporters({});
    }
  }

  // Activate an article (save as draft)
  async function activateArticle(msgId: string, preview: ConferenceMessage['articlePreview']) {
    if (!preview || !currentPiece) return;
    
    try {
      // Call API to save the article as draft
      const res = await fetch('/api/editorial/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterUserId: preview.reporterId,
          message: 'go ahead', // Trigger article creation
          userId,
          articleJson: JSON.stringify({
            title: preview.title,
            subtitle: preview.subtitle,
            content: preview.content,
            category: preview.category,
            tags: preview.tags,
            imageSearchTerm: preview.title,
          }),
        }),
      });
      const data = await res.json();
      
      if (data.success && data.articleDraftId) {
        // Update the message to show it's activated
        updatePieceMessages(currentPiece.id, msgs =>
          msgs.map(m => m.id === msgId ? { ...m, activated: true, articleDraftId: data.articleDraftId } : m)
        );
        // Mark piece as completed
        setPieces(prev => ({
          ...prev,
          [activeDept]: prev[activeDept].map(p =>
            p.id === currentPiece.id ? { ...p, completed: true } : p
          ),
        }));
      }
    } catch (err) {
      console.error('Failed to activate article:', err);
    }
  }

  // Save a person to Menschen DB
  async function saveMensch(msgId: string, data: ConferenceMessage['menschenCheck']) {
    if (!data || !currentPiece) return;
    
    try {
      const res = await fetch('/api/almanac/add-person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          born: data.birthday,
          died: (data as any).deathday,
          causeOfDeath: (data as any).causeOfDeath,
          nationality: data.country,
          profession: data.profession,
        }),
      });
      const result = await res.json();
      
      if (result.success) {
        // Update the message to show it's saved
        updatePieceMessages(currentPiece.id, msgs =>
          msgs.map(m => m.id === msgId ? { ...m, menschenSaved: true } : m)
        );
        // Add confirmation message
        const ripInfo = (data as any).deathday ? ` (RIP ${(data as any).deathday})` : '';
        updatePieceMessages(currentPiece.id, msgs => [
          ...msgs,
          { id: generateId(), from: 'system', text: `👤 ${data.name}${ripInfo} saved to Menschen database.` },
        ]);
      } else if (result.error) {
        updatePieceMessages(currentPiece.id, msgs => [
          ...msgs,
          { id: generateId(), from: 'system', text: `❌ Failed to save ${data.name}: ${result.error}` },
        ]);
      }
    } catch (err) {
      console.error('Failed to save Mensch:', err);
    }
  }

  // Helper: Parse AI response into a Proposal object
  function parseProposalResponse(
    text: string, 
    reporter: typeof activePeople[0], 
    reporterCategories: Record<string, string>,
    isEventRequest: boolean,
    isRIPRequest: boolean
  ): Proposal {
    // Parse structured format
    const nameMatch = text.match(/(?:NAME|EVENT|TITLE):\s*(.+)/i);
    const bornMatch = text.match(/(?:BORN|DATE):\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
    const diedMatch = text.match(/DIED:\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
    const causeMatch = text.match(/CAUSE:\s*(.+)/i);
    const countryMatch = text.match(/COUNTRY:\s*(.+)/i);
    const typeMatch = text.match(/TYPE:\s*(.+)/i);
    const categoryMatch = text.match(/CATEGORY:\s*(.+)/i);
    const descMatch = text.match(/DESCRIPTION:\s*([\s\S]+?)(?=\n(?:NAME|BORN|DIED|CAUSE|COUNTRY|CATEGORY|TYPE):|$)/i);
    
    let name = nameMatch ? nameMatch[1].trim().split('\n')[0] : 'Unknown';
    const birthday = bornMatch ? bornMatch[1].trim() : '';
    const deathday = diedMatch ? diedMatch[1].trim() : undefined;
    const causeOfDeath = causeMatch ? causeMatch[1].trim().split('\n')[0] : undefined;
    const country = countryMatch ? countryMatch[1].trim().split('\n')[0] : '';
    const eventType = typeMatch ? typeMatch[1].trim().split('\n')[0] : undefined;
    let rawCategory = categoryMatch ? categoryMatch[1].trim().toLowerCase().split('\n')[0] : '';
    // Normalize common variations
    if (rawCategory === 'sport') rawCategory = 'sports';
    if (rawCategory === 'movie' || rawCategory === 'tv' || rawCategory === 'film' || rawCategory === 'movies' || rawCategory === 'television') rawCategory = 'movies-tv';
    if (rawCategory === 'game' || rawCategory === 'games' || rawCategory === 'video games') rawCategory = 'gaming';
    if (rawCategory === 'musician' || rawCategory === 'singer' || rawCategory === 'band') rawCategory = 'music';
    if (rawCategory === 'actor' || rawCategory === 'actress') rawCategory = 'movies-tv';
    if (rawCategory === 'athlete' || rawCategory === 'football' || rawCategory === 'basketball' || rawCategory === 'soccer' || rawCategory === 'nfl' || rawCategory === 'nba') rawCategory = 'sports';
    if (rawCategory === 'history' || rawCategory === 'historical') rawCategory = 'culture';
    const validCategories = ['sports', 'music', 'movies-tv', 'gaming', 'politics', 'tech', 'culture', 'lifestyle', 'rip'];
    const category = validCategories.includes(rawCategory) ? rawCategory : (globalCategory || 'culture');
    const description = descMatch ? descMatch[1].trim().slice(0, 300) : text.slice(0, 200);
    const isEvent = isEventRequest || text.toLowerCase().includes('event:');
    
    // Check for NO_MATCH or NO_CATEGORY_MATCH response
    let noCategoryMatch = false;
    if (name === 'NO_MATCH' || name.includes('NO_MATCH')) {
      name = 'Unknown';
    }
    if (name === 'NO_CATEGORY_MATCH' || name.includes('NO_CATEGORY_MATCH')) {
      name = 'Unknown';
      noCategoryMatch = true;
    }
    
    // Validate - different rules for events vs people
    let isValid = name !== 'Unknown' && birthday;
    let errorReason = '';
    if (noCategoryMatch) {
      errorReason = `No ${category || 'matching'} events found for this date. Try a different category.`;
    } else if (!isValid) {
      errorReason = isEvent ? 'Could not find any event for this date' : 'Could not find anyone for this date';
    } else if (!isEvent && birthday) {
      // Only validate GenX year for PEOPLE, not events
      const yearMatch = birthday.match(/(\d{4})/);
      if (yearMatch) {
        const year = parseInt(yearMatch[1]);
        if (year < 1965) { isValid = false; errorReason = `Born ${year} - too old for GenX (need 1965-1980)`; }
        else if (year > 1980) { isValid = false; errorReason = `Born ${year} - too young for GenX (need 1965-1980)`; }
      }
    } else if (isEvent && birthday) {
      // For events, validate year is in GenX era (1975-2000)
      const yearMatch = birthday.match(/(\d{4})/);
      if (yearMatch) {
        const year = parseInt(yearMatch[1]);
        if (year < 1975) { isValid = false; errorReason = `Event from ${year} - too early (need 1975-2000)`; }
        else if (year > 2000) { isValid = false; errorReason = `Event from ${year} - too recent (need 1975-2000)`; }
      }
    }
    
    return {
      name,
      birthday,
      deathday,
      causeOfDeath,
      country: isEvent ? (eventType || '') : country, // For events, show event type instead of country
      profession: '',
      description,
      reporterId: reporter.id,
      reporterName: reporter.name,
      category,
      isRIP: isRIPRequest || !!deathday,
      isEvent,
      isError: !isValid,
      errorReason: isValid ? undefined : errorReason,
    };
  }

  // Send a message - asks reporters ONE BY ONE (sequential)
  async function sendMessage(text?: string) {
    const messageText = text ?? draft;
    console.log('[sendMessage] called with:', { text, draft, messageText, currentPiece: currentPiece?.type, activePeopleCount: activePeople.length });
    if (!messageText.trim() || !currentPiece) {
      console.log('[sendMessage] EARLY RETURN - no message or no currentPiece');
      return;
    }

    // Check for @mention to target specific reporter: "@Frank find sports" or "Frank, find sports"
    const mentionMatch = messageText.match(/^@?(\w+)[,:]?\s+(.+)$/i);
    let targetReporters = activePeople;
    let actualMessage = messageText;
    
    if (mentionMatch) {
      const mentionedName = mentionMatch[1].toLowerCase();
      const matchedReporter = roster.find(r => 
        r.name.toLowerCase().startsWith(mentionedName) || 
        r.name.split(' ')[0].toLowerCase() === mentionedName
      );
      if (matchedReporter && activeReporters[matchedReporter.id]) {
        targetReporters = [matchedReporter];
        actualMessage = mentionMatch[2]; // Use the rest of the message
      }
    }

    // Add user message
    updatePieceMessages(currentPiece.id, msgs => [
      ...msgs,
      { id: generateId(), from: 'me', name: 'Editor', text: messageText },
    ]);
    setDraft("");
    setShowPrompts(false);
    setShowTemplates(false);

    if (targetReporters.length === 0) {
      updatePieceMessages(currentPiece.id, msgs => [
        ...msgs,
        { id: generateId(), from: 'system', text: 'No one is active in this conference. Add people from the roster.' },
      ]);
      return;
    }

    // Show who is typing - single name or "multiple"
    setTyping(targetReporters.length === 1 ? targetReporters[0].name : 'multiple');

    // Check if this is a RANKROLL request
    const lowerMsg = actualMessage.toLowerCase();
    const isRankrollRequest = currentPiece.type === 'rankroll' || lowerMsg.includes('rankroll') || lowerMsg.includes('ranking');
    
    // For Rankroll, use a completely different flow - show cards like Article
    if (isRankrollRequest) {
      // Extract the topic from the message
      const topic = actualMessage.replace(/propose a rankroll about:\s*/i, '').trim();
      
      // Add user message
      updatePieceMessages(currentPiece.id, msgs => [
        ...msgs,
        { id: generateId(), from: 'me', name: 'Editor', text: `Propose rankroll: ${topic}` },
      ]);
      
      try {
        // Process reporters sequentially - each one updates the UI immediately (like Articles)
        cancelRequestedRef.current = false;
        
        for (const reporter of targetReporters) {
          // Check if cancel was requested
          if (cancelRequestedRef.current) {
            setTyping(false);
            cancelRequestedRef.current = false;
            break;
          }
          setTyping(reporter.name);
          
          const res = await fetch('/api/editorial/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reporterUserId: reporter.id,
              message: `Create a VIRAL ranking idea about: ${topic}

You're writing for sports/entertainment fans who want FUN, ENGAGING content.

🎯 MIX OF IDEAS - some should be SPORT-focused, some ENTERTAINMENT/VIRAL:

SPORT ideas (with a twist):
- "Tom Brady's Most Clutch 4th Quarter Drives"
- "Touchdowns That Made Commentators Lose Their Minds"
- "Games Where Tom Brady Destroyed a Team Single-Handedly"
- "Tom Brady Passes That Defied Physics"

ENTERTAINMENT/VIRAL ideas:
- "Tom Brady's Most Savage Trash Talk Moments"
- "Times Tom Brady Made Defenders Look Stupid"  
- "Tom Brady Outfits That Broke the Internet"
- "Celebrities Who Got Destroyed Trying to Roast Tom Brady"
- "Tom Brady Commercials That Were Actually Hilarious"

🚫 BANNED generic titles:
- "Best Moments" / "Greatest Plays" / "Top 10" - TOO VAGUE
- Just "Career Highlights" - BORING

Be SPECIFIC! Use real games, real opponents, real dates when possible.

Reply in this format:
TITLE: [viral headline - make people WANT to click and vote]
ITEMS: [8-12 specific items with real names/events/opponents, comma-separated]
CATEGORY: [sports, music, movies-tv, culture, lifestyle]
DESCRIPTION: [1 sentence hook that makes people curious]`,
              userId,
              proposalOnly: true,
              contentType: 'rankroll',
            }),
          });
          const data = await res.json();
          const text = data.response || '';
          
          // Parse response - title, items, category, and description
          const titleMatch = text.match(/TITLE:\s*(.+)/i);
          const itemsMatch = text.match(/ITEMS:\s*(.+)/i);
          const categoryMatch = text.match(/CATEGORY:\s*(.+)/i);
          const descMatch = text.match(/DESCRIPTION:\s*(.+)/i);
          
          const title = titleMatch ? titleMatch[1].trim().replace(/^["']|["']$/g, '') : `Top 10 ${topic}`;
          const itemsRaw = itemsMatch ? itemsMatch[1].trim() : '';
          const items = itemsRaw.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
          const description = descMatch ? descMatch[1].trim().replace(/\n/g, ' ').replace(/^["']|["']$/g, '').slice(0, 200) : '';
          
          // Parse and normalize category
          let rawCat = categoryMatch ? categoryMatch[1].trim().toLowerCase().split('\n')[0] : 'culture';
          if (rawCat === 'sport') rawCat = 'sports';
          if (rawCat === 'movie' || rawCat === 'tv' || rawCat === 'film' || rawCat === 'entertainment') rawCat = 'movies-tv';
          if (rawCat === 'athlete' || rawCat === 'football' || rawCat === 'nfl' || rawCat === 'nba') rawCat = 'sports';
          const validCats = ['sports', 'music', 'movies-tv', 'gaming', 'culture', 'lifestyle'];
          const category = validCats.includes(rawCat) ? rawCat : 'sports';
          
          const newProposal: Proposal = {
            name: title,
            birthday: itemsRaw, // FULL items list - needed for selectProposal()
            country: `${items.length} items`,
            profession: '',
            description,
            reporterId: reporter.id,
            reporterName: reporter.name,
            category,
            isError: items.length < 3,
            errorReason: items.length < 3 ? 'Not enough items' : undefined,
          };
          
          // Add to messages immediately so card updates (like Article flow)
          updatePieceMessages(currentPiece.id, msgs => {
            const existingIdx = msgs.findIndex(m => m.from === 'proposals');
            if (existingIdx >= 0) {
              // Add to existing proposals
              const existing = msgs[existingIdx];
              return msgs.map((m, i) => i === existingIdx 
                ? { ...m, proposals: [...(existing.proposals || []), newProposal] }
                : m
              );
            } else {
              // Create new proposals message
              return [...msgs, {
                id: generateId(),
                from: 'proposals' as const,
                text: 'Rankroll proposals',
                proposals: [newProposal],
              }];
            }
          });
        }
        
        setTyping(false);
        
      } catch (err) {
        setTyping(false);
        updatePieceMessages(currentPiece.id, msgs => [
          ...msgs,
          { id: generateId(), from: 'system', text: 'Error generating rankroll proposals.' },
        ]);
      }
      return;
    }

    // Build the prompt - ask for ONE proposal from their region, no article yet
    // Each reporter will get their region injected + TODAY'S DATE from the chat API
    const today = new Date();
    const dayMonth = `${today.getDate()}.${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    
    // Detect if this is a RIP request (death anniversary) vs Birthday
    const isRIPRequest = lowerMsg.includes('rip') || 
                         lowerMsg.includes('died') || 
                         lowerMsg.includes('death') ||
                         lowerMsg.includes('todestag') ||
                         lowerMsg.includes('gestorben');
    
    // EVENT request (ON THIS DAY) - not a person, but an event like movie premiere, album release
    // IMPORTANT: "BORN ON THIS DAY" is NOT an event request - it's a birthday request!
    const hasOnThisDay = lowerMsg.includes('on this day');
    const isBirthdayOrRIP = lowerMsg.includes('born') || lowerMsg.includes('died') || lowerMsg.includes('death') || lowerMsg.includes('rip');
    const isEventRequest = !isBirthdayOrRIP && (
      hasOnThisDay ||
      lowerMsg.includes('premiered') ||
      lowerMsg.includes('this exact date') ||
      lowerMsg.includes('happened on') ||
      lowerMsg.includes('not a person') ||
      lowerMsg.includes('an event') ||
      lowerMsg.includes('film premiere') ||
      lowerMsg.includes('series premiere') ||
      lowerMsg.includes('series finale') ||
      lowerMsg.includes('famous episode') ||
      lowerMsg.includes('oscar win') ||
      lowerMsg.includes('album release') ||
      lowerMsg.includes('released') ||
      lowerMsg.includes('game release') ||
      lowerMsg.includes('console launch') ||
      lowerMsg.includes('arcade game') ||
      lowerMsg.includes('championship game') ||
      lowerMsg.includes('world record') ||
      lowerMsg.includes('legendary match') ||
      lowerMsg.includes('legendary concert') ||
      lowerMsg.includes('band forming') ||
      lowerMsg.includes('band breaking') ||
      lowerMsg.includes('#1 hit')
    );
    
    // Simple prompt - the system prompt already has birthday data from Wikipedia
    const getProposalPrompt = (reporter: typeof activePeople[0], index: number) => {
      // Use global category filter if set, otherwise "any celebrity"
      const categoryDesc = globalCategory === 'sports' ? 'an athlete/sports person' 
        : globalCategory === 'music' ? 'a musician/singer'
        : globalCategory === 'movies-tv' ? 'an actor/TV personality'
        : globalCategory === 'politics' ? 'a politician'
        : globalCategory === 'tech' ? 'a tech figure'
        : globalCategory === 'gaming' ? 'a gaming personality'
        : 'a GenX celebrity (any field)';
      
      // Country filter
      const countryNames: Record<string, string> = {
        'US': 'United States', 'CA': 'Canada', 'MX': 'Mexico', 'BR': 'Brazil',
        'AR': 'Argentina', 'UK': 'United Kingdom', 'DE': 'Germany', 'FR': 'France',
        'IT': 'Italy', 'ES': 'Spain', 'NL': 'Netherlands', 'SE': 'Sweden',
        'NO': 'Norway', 'PL': 'Poland', 'RU': 'Russia', 'JP': 'Japan',
        'CN': 'China', 'KR': 'South Korea', 'IN': 'India', 'AU': 'Australia',
        'NZ': 'New Zealand', 'ZA': 'South Africa', 'EG': 'Egypt',
      };
      const countryName = globalCountry ? (countryNames[globalCountry] || globalCountry) : '';
      const countryFilter = countryName ? `from ${countryName}` : '';
      
      if (isRIPRequest) {
        // RIP request - find someone who DIED on this day
        return `Find ${categoryDesc} ${countryFilter} from Generation X (born 1965-1980) who DIED on ${dayMonth} (any year).
${countryName ? `IMPORTANT: Person MUST be from ${countryName}.` : ''}
${globalCategory ? `IMPORTANT: Person MUST be in ${globalCategory} category.` : ''}

Reply in EXACTLY this format:
NAME: [full name]
BORN: [DD.MM.YYYY]
DIED: ${dayMonth}.[YYYY]
CAUSE: [cause of death]
COUNTRY: [country]
DESCRIPTION: [1-2 sentences about their life and legacy]`;
      }
      
      if (isEventRequest) {
        // EVENT request - find a movie premiere, album release, sports event, etc.
        // Build category-specific prompt
        let eventTypeDesc: string;
        let examples: string;
        let typeOptions: string;
        
        if (globalCategory === 'movies-tv') {
          eventTypeDesc = 'a movie premiere, TV series premiere/finale, famous episode airing, or Oscar win';
          examples = `- A blockbuster movie that premiered on this date (e.g. "Pulp Fiction premiered October 14, 1994")
- A TV series that debuted or ended on this date (e.g. "Friends finale aired May 6, 2004")
- A famous episode that aired on this date (e.g. "Who Shot J.R.? aired November 21, 1980")
- An Oscar ceremony or major award on this date`;
          typeOptions = 'movie-premiere, tv-premiere, tv-finale, famous-episode, oscar-win';
        } else if (globalCategory === 'music') {
          eventTypeDesc = 'an album release, legendary concert, #1 hit, band forming, or band breaking up';
          examples = `- An iconic album released on this date (e.g. "Nevermind released September 24, 1991")
- A legendary concert on this date (e.g. "Live Aid July 13, 1985")
- A song hitting #1 on this date
- A band forming or breaking up on this date (e.g. "The Beatles broke up April 10, 1970")`;
          typeOptions = 'album-release, concert, number-one-hit, band-formed, band-breakup';
        } else if (globalCategory === 'sports') {
          eventTypeDesc = 'a championship game, world record, legendary match, historic upset, or retirement';
          examples = `- A Super Bowl, World Cup final, or championship game on this date
- A world record set on this date (e.g. "Usain Bolt 9.58s August 16, 2009")
- A legendary match or upset on this date (e.g. "Miracle on Ice February 22, 1980")
- A famous athlete retiring on this date`;
          typeOptions = 'championship, world-record, legendary-match, upset, retirement';
        } else if (globalCategory === 'gaming') {
          eventTypeDesc = 'a video game release, console launch, or arcade debut';
          examples = `- A legendary game released on this date (e.g. "Super Mario Bros. September 13, 1985")
- A console launched on this date (e.g. "PlayStation December 3, 1994")
- An arcade game debuted on this date (e.g. "Pac-Man May 22, 1980")`;
          typeOptions = 'game-release, console-launch, arcade-debut';
        } else {
          eventTypeDesc = 'a significant cultural event (movie, music, sports, tech, or historical)';
          examples = `- A movie premiere, album release, or TV event
- A sports championship or world record
- A tech launch (e.g. "iPhone announced January 9, 2007")
- A historical moment (e.g. "Berlin Wall fell November 9, 1989")`;
          typeOptions = 'movie-premiere, album-release, championship, tech-launch, historical';
        }
        
        return `Find ${eventTypeDesc} that happened ON THIS EXACT DATE (${dayMonth}) in any year between 1975-2000.

⚠️ THIS IS AN EVENT, NOT A PERSON! Do NOT suggest a birthday or death anniversary.
Find something that PREMIERED, RELEASED, or HAPPENED on ${dayMonth}.

Examples for this category:
${examples}

Reply in EXACTLY this format:
EVENT: [title of the event/movie/album/game]
DATE: ${dayMonth}.[year between 1975-2000]
TYPE: [${typeOptions}]
CATEGORY: [movies-tv, music, sports, gaming, history]
DESCRIPTION: [1-2 sentences about why this event mattered to GenX]`;
      }
      
      // Birthday request - find someone BORN on this day
      const categoryRequirement = globalCategory 
        ? `\n\n🚫🚫🚫 MANDATORY CATEGORY FILTER: ${globalCategory.toUpperCase()} 🚫🚫🚫\nYou MUST find someone in the ${globalCategory} category. NO sports people if politics is selected. NO actors if politics is selected. ONLY ${globalCategory}!\nIf you suggest someone outside ${globalCategory}, your response will be REJECTED.\n\n⚠️ Only if NEITHER the "WORLDWIDE ${globalCategory.toUpperCase()} BIRTHDAYS" block NOR the Wikipedia list contains a single ${globalCategory} person, respond with:\nNAME: NO_CATEGORY_MATCH\nBORN: ${dayMonth}.0000\nCOUNTRY: N/A\nCATEGORY: ${globalCategory}\nDESCRIPTION: No ${globalCategory} people found for this date. Try a different category.`
        : '';
      
      return `Find a GenX celebrity (born 1965-1980) who was ACTUALLY born on ${dayMonth}.
${categoryRequirement}

SOURCE PRIORITY:
1. The "🌍 WORLDWIDE ... BIRTHDAYS" block (Wikidata) — complete and global. USE THIS FIRST.
2. Only if that block is missing, fall back to the shorter "BIRTHDAYS TODAY" Wikipedia list.
${countryName ? `Prefer someone from ${countryName}; if nobody from there is listed, take the most prominent person from the worldwide list.` : ''}

⚠️ CRITICAL: Only suggest someone if you are 100% CERTAIN of their birthday. Do NOT guess or invent birthdays!
Only use NO_CATEGORY_MATCH when BOTH lists are empty for this category.

Reply EXACTLY in this format:
NAME: [full name]
BORN: ${dayMonth}.[year between 1965-1980]
COUNTRY: [their country]
CATEGORY: [must be: ${globalCategory || 'sports, music, movies-tv, gaming, politics, tech, culture, lifestyle'}]
DESCRIPTION: [1 sentence about them]`;
    };

    try {
      // Clear old proposals before starting new search
      updatePieceMessages(currentPiece.id, msgs => 
        msgs.filter(m => m.from !== 'proposals')
      );
      
      // Process reporters ONE BY ONE (sequential, not parallel)
      const results: { reporter: typeof targetReporters[0]; response: string; success: boolean }[] = [];
      const alreadyProposed: string[] = []; // Track names to avoid duplicates
      
      for (let i = 0; i < targetReporters.length; i++) {
        // Check if cancel was requested
        if (cancelRequestedRef.current) {
          setTyping(false);
          cancelRequestedRef.current = false;
          break;
        }
        
        const reporter = targetReporters[i];
        
        // Show this reporter is searching
        setTyping(reporter.name);
        
        // Build prompt with already proposed names
        const basePrompt = getProposalPrompt(reporter, i);
        const avoidList = alreadyProposed.length > 0 
          ? `\n\n🚫🚫🚫 FORBIDDEN NAMES - DO NOT USE THESE: ${alreadyProposed.join(', ')}\nYou MUST pick someone COMPLETELY DIFFERENT. If you suggest any name from this list, your response will be REJECTED.`
          : '';
        
        console.log(`[Reporter ${i+1}/${targetReporters.length}] ${reporter.name} - Already proposed: [${alreadyProposed.join(', ')}]`);
        
        const res = await fetch('/api/editorial/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reporterUserId: reporter.id,
            message: basePrompt + avoidList,
            userId,
            proposalOnly: true,
            contentType: currentPiece.type,
            overrideCategory: globalCategory || undefined,
            overrideCountry: globalCountry || undefined,
            isEventRequest,
          }),
        });
        const data = await res.json();
        
        results.push({
          reporter,
          response: data.response || data.message || 'No response',
          success: data.success,
        });
        
        // Immediately show this reporter's result
        const text = data.response || '';
        let proposal = parseProposalResponse(text, reporter, reporterCategories, isEventRequest, isRIPRequest);
        
        console.log(`[Reporter ${i+1}] Parsed name: "${proposal.name}" | isError: ${proposal.isError}`);
        
        // Check for duplicate - if name already proposed, mark as error
        if (proposal.name && proposal.name !== 'Unknown' && alreadyProposed.some(n => n.toLowerCase() === proposal.name.toLowerCase())) {
          proposal = {
            ...proposal,
            isError: true,
            errorReason: `Duplicate: ${proposal.name} was already proposed`,
          };
        } else if (proposal.name && proposal.name !== 'Unknown' && !proposal.isError) {
          // Track this name to avoid duplicates in next reporters
          alreadyProposed.push(proposal.name);
          
          // IMMEDIATELY save to Almanac Person database (same DB as MenschenTab)
          try {
            // Split name into firstname/lastname
            const nameParts = proposal.name.trim().split(' ');
            const firstname = nameParts[0] || '';
            const lastname = nameParts.slice(1).join(' ') || '';
            
            // Convert birthday from DD.MM.YYYY to YYYY-MM-DD
            let born = '';
            if (proposal.birthday) {
              const match = proposal.birthday.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
              if (match) {
                born = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
              }
            }
            
            // Convert deathday from DD.MM.YYYY to YYYY-MM-DD
            let died = '';
            if (proposal.deathday) {
              const match = proposal.deathday.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
              if (match) {
                died = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
              }
            }
            
            // Map category to profession enum
            const professionMap: Record<string, string> = {
              'music': 'Music',
              'sports': 'Sport',
              'movies-tv': 'Actor',
              'politics': 'Politik',
              'tech': 'Tech',
              'culture': 'Art',
              'lifestyle': 'Other',
              'gaming': 'Other',
            };
            const profession = professionMap[proposal.category?.toLowerCase() || ''] || 'Other';
            
            await fetch('/api/almanac', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'people',
                firstname,
                lastname,
                born,
                died,
                causeOfDeath: '',
                profession,
                subcat: proposal.category || '',
                knownfor: proposal.description || '',
                countryBorn: proposal.country || '',
                // Discovery tracking
                discoveredBy: reporter.id,
                discoveredByName: reporter.name,
                discoveredFor: proposal.isRIP ? 'rip' : 'birthday',
                hasArticle: false,
              }),
            });
            console.log(`[Almanac] Saved: ${proposal.name}`);
            proposal.savedToMenschen = true;
          } catch (err) {
            console.error(`[Almanac] Failed to save ${proposal.name}:`, err);
          }
        }
        
        // Add to messages immediately so card updates
        updatePieceMessages(currentPiece.id, msgs => {
          // Check if we already have a proposals message
          const existingIdx = msgs.findIndex(m => m.from === 'proposals');
          if (existingIdx >= 0) {
            // Add to existing proposals
            const existing = msgs[existingIdx];
            return [
              ...msgs.slice(0, existingIdx),
              { ...existing, proposals: [...(existing.proposals || []), proposal] },
              ...msgs.slice(existingIdx + 1),
            ];
          } else {
            // Create new proposals message
            return [
              ...msgs,
              { id: generateId(), from: 'proposals' as const, text: 'Proposals', proposals: [proposal] },
            ];
          }
        });
      }

      setTyping(false);
      // Results already added to messages in the loop above
      
      // Clear pending reporters
      setPendingReporters([]);

    } catch (err) {
      setTyping(false);
      setPendingReporters([]);
      updatePieceMessages(currentPiece.id, msgs => [
        ...msgs,
        { id: generateId(), from: 'system', text: 'Connection error. Please try again.' },
      ]);
    }
  }

  // Ask a specific reporter for another suggestion
  async function askForAnother(reporterId: string, reporterName: string, isRIP: boolean = false) {
    if (!currentPiece) return;
    if (retryingReporter) return; // Prevent double-click
    
    setRetryingReporter(reporterId);

    const today = new Date();
    const dayMonth = `${today.getDate()}.${(today.getMonth() + 1).toString().padStart(2, '0')}`;

    // Collect ALL already proposed names from current proposals
    const alreadyProposedNames: string[] = [];
    for (const msg of currentPiece.messages) {
      if (msg.from === 'proposals' && msg.proposals) {
        for (const p of msg.proposals) {
          if (p.name && p.name !== 'Unknown') {
            alreadyProposedNames.push(p.name);
          }
        }
      }
    }
    const forbiddenList = alreadyProposedNames.length > 0
      ? `\n\n🚫🚫🚫 FORBIDDEN NAMES - ALREADY PROPOSED:\n${alreadyProposedNames.join(', ')}\n\nDO NOT suggest any of these names! Pick someone COMPLETELY DIFFERENT.`
      : '';

    const requestType = isRIP ? 'RIP (died on this day)' : 'birthday';
    updatePieceMessages(currentPiece.id, msgs => [
      ...msgs,
      { id: generateId(), from: 'me', name: 'Editor', text: `${reporterName}, give me a different ${requestType} person from your region.` },
    ]);

    setTyping(reporterName);

    // Build the retry message based on request type
    const retryMessage = isRIP 
      ? `Give me a DIFFERENT GenX celebrity (born 1965-1980) who DIED on ${dayMonth}. Not the same one as before!
${forbiddenList}

YOU MUST FIND SOMEONE DIFFERENT who passed away on this date. Search harder - actors, musicians, athletes, directors, TV hosts, comedians, models, authors, politicians.

Reply in EXACTLY this format:
NAME: [full name]
BORN: [DD.MM.YYYY]
DIED: ${dayMonth}.[YYYY]
CAUSE: [cause of death]
COUNTRY: [country]
DESCRIPTION: [1-2 sentences about their life and legacy]`
      : `Pick a DIFFERENT person from the BIRTHDAYS TODAY list in your context. There are HUNDREDS of GenX celebrities born on ${dayMonth} - pick one you haven't suggested yet!
${forbiddenList}
${globalCategory ? `\n🚫🚫🚫 MANDATORY CATEGORY: ${globalCategory.toUpperCase()} ONLY! 🚫🚫🚫\nDO NOT suggest sports people, actors, or musicians if ${globalCategory} is required. ONLY ${globalCategory}!` : ''}

🚫 "NO_MATCH" IS NOT ALLOWED. The birthday list has 300+ people - you MUST pick one.

Reply in EXACTLY this format:
NAME: [full name from the birthday list]
BORN: ${dayMonth}.[year between 1965-1980]
COUNTRY: [their country]
CATEGORY: [must be: ${globalCategory || 'sports, music, movies-tv, gaming, politics, tech, culture, lifestyle'}]
DESCRIPTION: [1 sentence about them]`;

    try {
      const res = await fetch('/api/editorial/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterUserId: reporterId,
          message: retryMessage,
          userId,
          proposalOnly: true,
          contentType: currentPiece.type,
          overrideCategory: globalCategory || undefined,
          overrideCountry: globalCountry || undefined,
        }),
      });
      const data = await res.json();
      setTyping(false);

      const text = data.response || '';
      
      // Parse structured format: NAME: / BORN: / DIED: / CAUSE: / COUNTRY: / CATEGORY: / DESCRIPTION:
      const nameMatch = text.match(/NAME:\s*(.+)/i);
      const bornMatch = text.match(/BORN:\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
      const diedMatch = text.match(/DIED:\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
      const causeMatch = text.match(/CAUSE:\s*(.+)/i);
      const countryMatch = text.match(/COUNTRY:\s*(.+)/i);
      const categoryMatch = text.match(/CATEGORY:\s*(.+)/i);
      const descMatch = text.match(/DESCRIPTION:\s*([\s\S]+?)(?=\n(?:NAME|BORN|DIED|CAUSE|COUNTRY|CATEGORY):|$)/i);
      
      // Fallback to legacy parsing if structured format not found
      let name = nameMatch ? nameMatch[1].trim() : 'Unknown';
      let birthday = bornMatch ? bornMatch[1].trim() : '';
      const deathday = diedMatch ? diedMatch[1].trim() : undefined;
      const causeOfDeath = causeMatch ? causeMatch[1].trim().split('\n')[0].trim() : undefined;
      let country = countryMatch ? countryMatch[1].trim().split('\n')[0].trim() : '';
      let description = descMatch ? descMatch[1].trim().slice(0, 300) : '';
      
      // Parse and normalize category
      let rawCategory = categoryMatch ? categoryMatch[1].trim().toLowerCase().split('\n')[0] : '';
      if (rawCategory === 'sport') rawCategory = 'sports';
      if (rawCategory === 'movie' || rawCategory === 'tv' || rawCategory === 'film' || rawCategory === 'movies' || rawCategory === 'television') rawCategory = 'movies-tv';
      if (rawCategory === 'game' || rawCategory === 'games' || rawCategory === 'video games') rawCategory = 'gaming';
      if (rawCategory === 'musician' || rawCategory === 'singer' || rawCategory === 'band') rawCategory = 'music';
      if (rawCategory === 'actor' || rawCategory === 'actress') rawCategory = 'movies-tv';
      if (rawCategory === 'athlete' || rawCategory === 'football' || rawCategory === 'basketball' || rawCategory === 'soccer' || rawCategory === 'nfl' || rawCategory === 'nba') rawCategory = 'sports';
      const validCategories = ['sports', 'music', 'movies-tv', 'gaming', 'politics', 'tech', 'culture', 'lifestyle', 'rip'];
      const category = validCategories.includes(rawCategory) ? rawCategory : (globalCategory || 'culture');
      
      // Legacy fallback parsing
      if (name === 'Unknown') {
        const boldNameMatch = text.match(/\*\*([A-ZÀ-Ž][a-zà-ž']+(?:[-\s]+[A-ZÀ-Ž]?[a-zà-ž']+)*)\*\*/);
        if (boldNameMatch) {
          name = boldNameMatch[1].trim();
        } else {
          const anyNameDate = text.match(/([A-ZÀ-Ž][a-zà-ž']+(?:\s+[A-ZÀ-Ž][a-zà-ž']+)+)\s*\(\d{1,2}\.\d{1,2}\.\d{4}\)/);
          if (anyNameDate) name = anyNameDate[1].trim();
        }
      }
      if (!birthday) {
        const dateMatch = text.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
        birthday = dateMatch ? dateMatch[1] : '';
      }
      if (!country) {
        const reporter = activePeople.find(p => p.id === reporterId);
        country = reporter?.regionLabel || '';
      }
      if (!description) {
        description = text.replace(/\*\*/g, '').slice(0, 250);
      }

      // Check if valid GenX (1965-1980) and not rejected
      // For RIP, we also accept if they have a death date
      let isValidGenX = name !== 'Unknown' && (birthday || deathday);
      if (isValidGenX && birthday) {
        const yearMatch = birthday.match(/(\d{4})/);
        if (yearMatch) {
          const year = parseInt(yearMatch[1]);
          if (year < 1965 || year > 1980) isValidGenX = false;
        }
        if (description.toLowerCase().includes('outside')) isValidGenX = false;
        if (description.toLowerCase().includes('not genx')) isValidGenX = false;
        if (description.toLowerCase().includes('baby boomer')) isValidGenX = false;
      }
      // For RIP requests, must have died date
      if (isRIP && !deathday) isValidGenX = false;

      // Check if this name is a duplicate (already proposed by another reporter)
      const isDuplicate = name !== 'Unknown' && alreadyProposedNames.some(
        n => n.toLowerCase() === name.toLowerCase()
      );

      // Build the new proposal object
      const newProposal: Proposal = {
        name,
        birthday,
        deathday,
        causeOfDeath,
        country,
        profession: '',
        description,
        reporterId,
        reporterName,
        category,
        isRIP: !!deathday,
        isError: !isValidGenX || isDuplicate,
        errorReason: isDuplicate 
          ? `Duplicate: ${name} was already proposed`
          : !isValidGenX ? (
            name === 'Unknown' ? 'Could not find anyone for this date' :
            birthday ? (() => {
              const yearMatch = birthday.match(/(\d{4})/);
              if (yearMatch) {
                const year = parseInt(yearMatch[1]);
                if (year < 1965) return `Born ${year} - too old for GenX (need 1965-1980)`;
                if (year > 1980) return `Born ${year} - too young for GenX (need 1965-1980)`;
              }
              return 'Invalid GenX range';
            })() : 'Missing birth date'
          ) : undefined,
      };

      // AUTO-SAVE to Menschen database if valid proposal found
      console.log('[Menschen] Checking save conditions:', { isValidGenX, isDuplicate, name, birthday, country, description });
      if (isValidGenX && !isDuplicate && name !== 'Unknown') {
        try {
          const payload = {
            name,
            birthday: birthday || '',
            deathday: deathday || '',
            causeOfDeath: causeOfDeath || '',
            country: country || 'Unknown',
            category: category || 'culture',
            description: description || `${name} - GenX personality`,
            discoveredBy: reporterId,
            discoveredByName: reporterName,
            discoveredFor: isRIP ? 'rip' : 'birthday',
          };
          console.log('[Menschen] Saving with payload:', payload);
          const saveRes = await fetch('/api/menschen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const saveData = await saveRes.json();
          console.log('[Menschen] Save response:', saveData);
          if (saveData.success) {
            newProposal.savedToMenschen = true;
            console.log(`[Menschen] ✅ Auto-saved: ${name}`, saveData.alreadyExists ? '(already existed)' : '(new)');
          } else {
            console.error('[Menschen] ❌ Save failed:', saveData.error);
          }
        } catch (e) {
          console.error('[Menschen] ❌ Auto-save exception:', e);
        }
      } else {
        console.log('[Menschen] ⏭️ Skipping save - conditions not met');
      }
      
      // Update existing proposal for this reporter (replace, don't add new)
      updatePieceMessages(currentPiece.id, msgs => {
        let found = false;
        const updated = msgs.map(m => {
          if (m.from === 'proposals' && m.proposals) {
            const hasThisReporter = m.proposals.some(p => p.reporterId === reporterId);
            if (hasThisReporter) {
              found = true;
              // Replace this reporter's proposal
              return {
                ...m,
                proposals: m.proposals.map(p => p.reporterId === reporterId ? newProposal : p),
              };
            }
          }
          return m;
        });
        
        // If not found, add as new proposal message
        if (!found) {
          return [
            ...updated,
            {
              id: generateId(),
              from: 'proposals' as const,
              text: '1 new proposal',
              proposals: [newProposal],
            },
          ];
        }
        
        return updated;
      });
    } catch (err) {
      setTyping(false);
      updatePieceMessages(currentPiece.id, msgs => [
        ...msgs,
        { id: generateId(), from: 'system', text: 'Error. Please try again.' },
      ]);
    } finally {
      setRetryingReporter(null);
    }
  }

  // Select a proposal and ask that reporter to write the article - opens editor modal
  async function selectProposal(proposal: Proposal) {
    if (!currentPiece) return;
    if (selectingProposal) return; // Prevent double-click
    
    // For RANKROLL: generate items with images, then open the full RankrollTab editor
    if (currentPiece.type === 'rankroll') {
      setSelectingProposal(proposal.reporterId);
      
      updatePieceMessages(currentPiece.id, msgs => [
        ...msgs,
        { id: generateId(), from: 'me', name: 'Editor', text: `Create ranking: ${proposal.name}` },
      ]);
      
      setTyping(proposal.reporterName);
      
      try {
        // Items are already in proposal.birthday (comma-separated from the proposal)
        const itemTitles = proposal.birthday
          .replace(/\.\.\.$/,'') // Remove trailing ...
          .split(',')
          .map((s: string) => s.trim().replace(/^["']|["']$/g, '')) // Remove quotes
          .filter((s: string) => s.length > 0);
        
        if (itemTitles.length < 3) {
          throw new Error('Not enough items in proposal');
        }
        
        // Get Tenor GIFs for each item
        const itemsWithImages = await Promise.all(
          itemTitles.map(async (title: string) => {
            try {
              const gifRes = await fetch(`/api/tenor-search?q=${encodeURIComponent(title)}`);
              const gifData = await gifRes.json();
              return {
                title,
                description: '',
                image: gifData.success ? gifData.url : '',
              };
            } catch {
              return { title, description: '', image: '' };
            }
          })
        );
        
        // Generate descriptions for all items in one API call
        try {
          const descRes = await fetch('/api/editorial/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reporterUserId: proposal.reporterId,
              message: `Write SHORT descriptions (1-2 sentences each) for these ranking items about "${proposal.name}":

${itemTitles.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n')}

Reply ONLY with numbered descriptions, one per line:
1. [description for item 1]
2. [description for item 2]
...

Make them FUN and ENGAGING - not boring Wikipedia summaries!`,
              userId,
              proposalOnly: true,
            }),
          });
          const descData = await descRes.json();
          const descText = descData.response || '';
          
          // Parse descriptions
          const descLines = descText.split('\n').filter((l: string) => /^\d+\./.test(l.trim()));
          descLines.forEach((line: string, idx: number) => {
            if (itemsWithImages[idx]) {
              const desc = line.replace(/^\d+\.\s*/, '').trim();
              itemsWithImages[idx].description = desc;
            }
          });
        } catch (descErr) {
          console.error('Failed to generate descriptions:', descErr);
          // Continue without descriptions
        }
        
        setTyping(false);
        setSelectingProposal(null);
        
        // Open the full RankrollTab editor modal with pre-filled data
        setRankrollEditorData({
          title: proposal.name,
          description: proposal.description,
          items: itemsWithImages,
          category: proposal.category || 'ranking',
        });
        
        // Add success message
        updatePieceMessages(currentPiece.id, msgs => [
          ...msgs,
          { 
            id: generateId(), 
            from: 'result', 
            text: `✅ Opening editor for "${proposal.name}" with ${itemsWithImages.length} items`,
            resultType: 'rankroll' as const,
          },
        ]);
        
      } catch (err) {
        console.error('Rankroll generation failed:', err);
        setTyping(false);
        setSelectingProposal(null);
        updatePieceMessages(currentPiece.id, msgs => [
          ...msgs,
          { id: generateId(), from: 'system', text: 'Failed to generate ranking. Try again.' },
        ]);
      }
      return;
    }
    
    setSelectingProposal(proposal.reporterId); // Show loading on this card
    
    // Create abort controller for this request
    const controller = new AbortController();
    setAbortController(controller);

    // Add selection message
    updatePieceMessages(currentPiece.id, msgs => [
      ...msgs,
      { id: generateId(), from: 'me', name: 'Editor', text: `Write an article about ${proposal.name}` },
    ]);

    setTyping(proposal.reporterName);

    try {
      // Build the article request message with RIP info if applicable
      let articleMessage = `Go ahead and write the article about ${proposal.name} (Born: ${proposal.birthday}, ${proposal.country}).`;
      if (proposal.isRIP && proposal.deathday) {
        articleMessage = `Write a RIP tribute article about ${proposal.name}.
Born: ${proposal.birthday}
Died: ${proposal.deathday}
${proposal.causeOfDeath ? `Cause of death: ${proposal.causeOfDeath}` : ''}
Country: ${proposal.country}

This is a memorial article honoring their life and legacy. Create the full article now.`;
      }
      
      // Ask the specific reporter to write the article content (NOT saved to DB yet!)
      const res = await fetch('/api/editorial/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterUserId: proposal.reporterId,
          message: articleMessage,
          userId,
          skipSave: true, // Don't save to DB yet - user will review first
        }),
        signal: controller.signal, // Allow cancellation
      });
      const data = await res.json();
      setTyping(false);

      if (data.success && data.articleData) {
        // Article content ready - AUTO-SAVE directly to database
        // For RIP articles, use 'rip' category
        const articleCategory = proposal.isRIP ? 'rip' : (data.articleData.category || 'culture');
        
        // Save article directly to database
        try {
          const saveRes = await fetch('/api/articles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              title: data.articleData.title || '',
              subtitle: data.articleData.subtitle || '',
              content: data.articleData.content || '',
              category: articleCategory,
              tags: data.articleData.tags || [],
              coverImage: data.articleData.coverImage || '',
              imagePosX: 50,
              imagePosY: 50,
              author: proposal.reporterId,
              authorName: proposal.reporterName,
              status: 'draft',
              personName: proposal.name,
              personBirthday: proposal.birthday,
              personDeathday: proposal.deathday,
              personCauseOfDeath: proposal.causeOfDeath,
              personCountry: proposal.country,
              isRIP: proposal.isRIP,
            }),
          });
          const saveData = await saveRes.json();
          
          if (saveData.success || saveData._id || saveData.article) {
            const savedId = saveData._id || saveData.article?._id;
            // Show as result message (same as after manual save)
            updatePieceMessages(currentPiece.id, msgs => [
              ...msgs,
              {
                id: generateId(),
                from: 'result',
                text: `✅ Article "${data.articleData.title}" saved to Articles.`,
                resultType: 'article',
                articleDraftId: savedId,
                articlePersonName: proposal.name, // Store person name for Rankroll button
                activated: true,
              },
            ]);
          } else {
            // Save failed - fall back to showing in tabs
            const newArticleId = generateId();
            const newDraft = {
              title: data.articleData.title || '',
              subtitle: data.articleData.subtitle || '',
              content: data.articleData.content || '',
              category: articleCategory,
              tags: data.articleData.tags || [],
              coverImage: data.articleData.coverImage || '',
              imagePosX: 50,
              imagePosY: 50,
              reporterId: proposal.reporterId,
              reporterName: proposal.reporterName,
              personName: proposal.name,
              personBirthday: proposal.birthday,
              personDeathday: proposal.deathday,
              personCauseOfDeath: proposal.causeOfDeath,
              personCountry: proposal.country,
              isRIP: proposal.isRIP,
            };
            setCreatedArticles(prev => [...prev, {
              id: newArticleId,
              title: data.articleData.title || proposal.name,
              reporterName: proposal.reporterName,
              draft: newDraft,
            }]);
            updatePieceMessages(currentPiece.id, msgs => [
              ...msgs,
              {
                id: generateId(),
                from: 'system',
                text: `⚠️ Article "${data.articleData.title}" created but auto-save failed. Click tab below to save manually.`,
              },
            ]);
          }
        } catch (saveErr) {
          console.error('Auto-save failed:', saveErr);
          // Fall back to tabs on error
          const newArticleId = generateId();
          const newDraft = {
            title: data.articleData.title || '',
            subtitle: data.articleData.subtitle || '',
            content: data.articleData.content || '',
            category: articleCategory,
            tags: data.articleData.tags || [],
            coverImage: data.articleData.coverImage || '',
            imagePosX: 50,
            imagePosY: 50,
            reporterId: proposal.reporterId,
            reporterName: proposal.reporterName,
            personName: proposal.name,
            personBirthday: proposal.birthday,
            personDeathday: proposal.deathday,
            personCauseOfDeath: proposal.causeOfDeath,
            personCountry: proposal.country,
            isRIP: proposal.isRIP,
          };
          setCreatedArticles(prev => [...prev, {
            id: newArticleId,
            title: data.articleData.title || proposal.name,
            reporterName: proposal.reporterName,
            draft: newDraft,
          }]);
          updatePieceMessages(currentPiece.id, msgs => [
            ...msgs,
            {
              id: generateId(),
              from: 'system',
              text: `⚠️ Article "${data.articleData.title}" created but auto-save failed. Click tab below to save manually.`,
            },
          ]);
        }
      } else if (data.response) {
        // Reporter responded but didn't create an article (maybe person is not GenX, etc.)
        const reporter = roster.find(r => r.id === proposal.reporterId);
        updatePieceMessages(currentPiece.id, msgs => [
          ...msgs,
          {
            id: generateId(),
            from: proposal.reporterId,
            name: proposal.reporterName,
            avatar: reporter?.avatar,
            text: data.response,
          },
        ]);
      } else {
        updatePieceMessages(currentPiece.id, msgs => [
          ...msgs,
          { id: generateId(), from: 'system', text: 'Could not generate article. Try again.' },
        ]);
      }
    } catch (err: any) {
      setTyping(false);
      // Check if this was a user-initiated abort
      if (err.name === 'AbortError') {
        updatePieceMessages(currentPiece.id, msgs => [
          ...msgs,
          { id: generateId(), from: 'system', text: '⏹️ Article generation cancelled.' },
        ]);
      } else {
        updatePieceMessages(currentPiece.id, msgs => [
          ...msgs,
          { id: generateId(), from: 'system', text: 'Error creating article. Please try again.' },
        ]);
      }
    } finally {
      setSelectingProposal(null); // Clear loading state
      setAbortController(null); // Clear abort controller
    }
  }

  // Cancel ongoing article generation
  function cancelGeneration() {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setSelectingProposal(null);
      setTyping(false);
    }
  }

  // Ask all active reporters for proposals based on template
  async function askProposals(templateId: string, prompt: string) {
    if (!currentPiece || activePeople.length === 0) return;
    
    setShowTemplates(false);
    
    // Add system message
    updatePieceMessages(currentPiece.id, msgs => [
      ...msgs,
      { id: generateId(), from: 'system', text: `📋 Asking ${activePeople.length} reporter(s) for proposals: "${prompt}"` },
    ]);
    
    // Just send the template prompt - reporters already have TODAY'S DATE and BIRTHDAYS TODAY in their context
    const proposalPrompt = `${prompt}

Propose ONE person. Format: Name (DD.MM.YYYY) - Country - Why they matter to GenX. Do NOT write the article yet.`;
    
    // Show who is typing - single name or "multiple"
    setTyping(activePeople.length === 1 ? activePeople[0].name : 'multiple');
    
    try {
      const results = await Promise.all(
        activePeople.map(async (reporter) => {
          const res = await fetch('/api/editorial/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reporterUserId: reporter.id,
              message: proposalPrompt,
              userId,
            }),
          });
          const data = await res.json();
          return {
            reporter,
            response: data.response || data.message || 'No response',
            success: data.success,
          };
        })
      );
      
      setTyping(false);
      
      // Add each reporter's proposals as messages
      for (const result of results) {
        updatePieceMessages(currentPiece.id, msgs => [
          ...msgs,
          {
            id: generateId(),
            from: result.reporter.id,
            name: result.reporter.name,
            avatar: result.reporter.avatar,
            text: result.response,
          },
        ]);
      }
      
      // Add helper message
      updatePieceMessages(currentPiece.id, msgs => [
        ...msgs,
        { id: generateId(), from: 'system', text: '👆 Select a proposal by telling the reporter to write about it, or ask for "more suggestions"' },
      ]);
      
    } catch (err) {
      setTyping(false);
      updatePieceMessages(currentPiece.id, msgs => [
        ...msgs,
        { id: generateId(), from: 'system', text: 'Error getting proposals. Please try again.' },
      ]);
    }
  }

  // Handle key press in textarea
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Show loading state when loading reporters
  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading editorial team...</span>
        </div>
      </div>
    );
  }

  // Check if we're used as a standalone tab (no onClose) or as a modal
  const isStandaloneTab = !onClose;

  return (
    <div className={isStandaloneTab ? "" : "fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-2"}>
      <div className={isStandaloneTab 
        ? "bg-gray-800 rounded-xl border border-gray-700 overflow-hidden flex flex-col" 
        : "w-[95vw] max-w-[1400px] h-[95vh] bg-gray-950 border border-gray-800 rounded-xl overflow-hidden flex flex-col shadow-2xl"
      } style={isStandaloneTab ? { height: 'calc(100vh - 140px)' } : undefined}>

        {/* Header with Department tabs on RIGHT */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 bg-gray-950 shrink-0">
          {/* Left side */}
          <div className="flex items-center gap-3">
            <Users className="w-4 h-4 text-gray-400" />
            <h2 className="text-white font-semibold text-sm">Editorial Conference</h2>
            <span className="text-[10px] text-gray-500">{roster.length} reporters</span>
            {/* API Status */}
            {apiStatus && apiStatus.status !== 'active' && (
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium ${
                apiStatus.status === 'quota_exceeded' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                apiStatus.status === 'invalid_key' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                'bg-gray-500/20 text-gray-400 border border-gray-500/30'
              }`}>
                <AlertCircle className="w-3 h-3" />
                {apiStatus.message}
              </div>
            )}
            {apiStatus && apiStatus.status === 'active' && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                <CheckCircle className="w-3 h-3" />
                API OK
              </div>
            )}
          </div>
          
          {/* Right side - Department tabs */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {DEPARTMENTS.map(d => (
                <button
                  key={d.id}
                  onClick={() => setActiveDept(d.id)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                    activeDept === d.id ? DEPT_THEME[d.id].tabActive : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {onClose && (
              <button onClick={onClose} className="text-gray-500 hover:text-white p-1 rounded transition-colors ml-2">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Content-type TABS + piece tabs */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800 bg-gray-950 shrink-0 relative z-30">

          {/* Content type tabs - Article, Rankroll, TV, Radio */}
          <div className="flex gap-1 shrink-0">
            {CONTENT_TYPES.map(c => {
              const Icon = c.icon;
              const isActive = currentPiece?.type === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => createPiece(c.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                    isActive 
                      ? theme.pieceActive
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  <Icon size={13} />
                  {c.label}
                </button>
              );
            })}
          </div>

          <div className="w-px h-5 bg-gray-700 shrink-0 mx-1" />

          {/* Piece tabs - scrollable container */}
          <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0">
          {deptPieces.map(p => {
            const typeInfo = CONTENT_TYPES.find(t => t.id === p.type);
            const isActive = p.id === currentPieceId;
            return (
              <div key={p.id} className="relative shrink-0 group">
                <button
                  onClick={() => setActivePieceId(prev => ({ ...prev, [activeDept]: p.id }))}
                  className={`flex flex-col items-start px-3 py-1.5 rounded border transition-all ${
                    p.completed
                      ? isActive
                        ? theme.pieceActive
                        : theme.pieceCompletedInactive
                      : isActive
                      ? "bg-gray-700 border-gray-500 text-gray-100"
                      : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <span className="text-xs font-bold leading-tight">{typeInfo?.label}</span>
                  <span className="text-[10px] font-mono opacity-80 leading-tight">{p.date}</span>
                </button>
                {/* Close button */}
                <button
                  onClick={(e) => { e.stopPropagation(); closePiece(p.id); }}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Close this piece"
                >
                  <X size={10} className="text-white" />
                </button>
              </div>
            );
          })}

          {/* New piece button */}
          <button
            onClick={() => createPiece('article')}
            className={`flex items-center justify-center w-8 h-8 rounded border border-dashed border-gray-700 text-gray-500 shrink-0 ${theme.hoverBorder} ${theme.hoverText}`}
            title="Start a new piece"
          >
            <Plus size={15} />
          </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {/* Reporter Row - clean cards, multiple rows */}
          <div className="border-b border-gray-800 bg-gray-950 px-3 py-2">
            {/* Select All button */}
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => {
                  const allActive = roster.every(p => activeReporters[p.id]);
                  const newState: Record<string, boolean> = {};
                  roster.forEach(p => { newState[p.id] = !allActive; });
                  setActiveReporters(newState);
                }}
                className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
                  roster.every(p => activeReporters[p.id])
                    ? "bg-gray-700 text-white hover:bg-gray-600"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {roster.every(p => activeReporters[p.id]) ? '✓ All Selected' : 'Select All'}
              </button>
              <span className="text-[10px] text-gray-500">
                {Object.values(activeReporters).filter(Boolean).length} / {roster.length} active
              </span>
            </div>
            {/* Reporter grid */}
            <div className="flex flex-wrap gap-1">
            {roster.map(p => {
              return (
                <div 
                  key={p.id} 
                  onClick={() => togglePerson(p.id)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer transition-all ${
                    activeReporters[p.id] 
                      ? theme.rosterActive 
                      : "bg-gray-900 border-gray-800 hover:border-gray-600"
                  }`}
                >
                  {/* Avatar */}
                  {p.avatar ? (
                    <img src={p.avatar} alt={p.name} className="w-5 h-5 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-black shrink-0 ${colorFor(p.id).bg}`}>
                      {p.name.split(' ').map(n => n[0]).join('')}
                    </div>
                  )}
                  
                  {/* Name */}
                  <span className={`text-xs font-medium whitespace-nowrap ${activeReporters[p.id] ? "text-black" : "text-gray-200"}`}>
                    {p.name}
                  </span>
                  
                  {/* Edit button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); openReporterEdit(p); }}
                    className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                      activeReporters[p.id] 
                        ? "hover:bg-black/20 text-black/60" 
                        : "hover:bg-gray-800 text-gray-500"
                    }`}
                    title="Edit reporter"
                  >
                    <Pencil size={9} />
                  </button>
                </div>
              );
            })}
            </div>
          </div>

          {/* Template Row - shows when Article type is selected */}
          {currentPiece?.type === 'article' && (
            <div className="border-b border-gray-800 bg-gray-900/50 px-3 py-2">
              {/* Row 1: Template buttons + Category + Country */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[10px] text-gray-500">TEMPLATES:</span>
                {PROMPT_TEMPLATES.filter(t => t.id !== 'custom').map(t => (
                  <button
                    key={t.id}
                    onClick={async () => {
                      const newTemplate = selectedTemplate === t.id ? null : t.id;
                      setSelectedTemplate(newTemplate);
                      // Load song requests when Radio template is selected
                      if (newTemplate === 'radio' && songRequests.length === 0) {
                        setSongRequestsLoading(true);
                        try {
                          const res = await fetch('/api/song-request?status=added');
                          const data = await res.json();
                          if (data.success) setSongRequests(data.requests || []);
                        } catch (e) {
                          console.error('Failed to load song requests:', e);
                        }
                        setSongRequestsLoading(false);
                      }
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                      selectedTemplate === t.id 
                        ? 'bg-[#E36B11] text-black' 
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
                
                <div className="w-px h-4 bg-gray-700 mx-1" />
                
                <span className="text-[10px] text-gray-500">CATEGORY:</span>
                <select
                  value={globalCategory}
                  onChange={e => setGlobalCategory(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-[10px] text-gray-300 focus:border-[#E36B11] focus:outline-none"
                >
                  <option value="">Any</option>
                  <option value="sports">🏆 Sports</option>
                  <option value="music">🎵 Music</option>
                  <option value="movies-tv">📺 Movies/TV</option>
                  <option value="gaming">🎮 Gaming</option>
                  <option value="politics">🏛️ Politics</option>
                  <option value="tech">💻 Tech</option>
                </select>
                
                <span className="text-[10px] text-gray-500">COUNTRY:</span>
                <select
                  value={globalCountry}
                  onChange={e => setGlobalCountry(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-[10px] text-gray-300 focus:border-[#E36B11] focus:outline-none"
                >
                  <option value="">Any</option>
                  <optgroup label="Americas">
                    <option value="US">🇺🇸 USA</option>
                    <option value="CA">🇨🇦 Canada</option>
                    <option value="MX">🇲🇽 Mexico</option>
                    <option value="BR">🇧🇷 Brazil</option>
                    <option value="AR">🇦🇷 Argentina</option>
                    <option value="CO">🇨🇴 Colombia</option>
                    <option value="CL">🇨🇱 Chile</option>
                    <option value="PE">🇵🇪 Peru</option>
                    <option value="CU">🇨🇺 Cuba</option>
                    <option value="JM">🇯🇲 Jamaica</option>
                  </optgroup>
                  <optgroup label="Europe">
                    <option value="UK">🇬🇧 UK</option>
                    <option value="DE">🇩🇪 Germany</option>
                    <option value="FR">🇫🇷 France</option>
                    <option value="IT">🇮🇹 Italy</option>
                    <option value="ES">🇪🇸 Spain</option>
                    <option value="PT">🇵🇹 Portugal</option>
                    <option value="NL">🇳🇱 Netherlands</option>
                    <option value="BE">🇧🇪 Belgium</option>
                    <option value="AT">🇦🇹 Austria</option>
                    <option value="CH">🇨🇭 Switzerland</option>
                    <option value="SE">🇸🇪 Sweden</option>
                    <option value="NO">🇳🇴 Norway</option>
                    <option value="DK">🇩🇰 Denmark</option>
                    <option value="FI">🇫🇮 Finland</option>
                    <option value="PL">🇵🇱 Poland</option>
                    <option value="CZ">🇨🇿 Czech Republic</option>
                    <option value="HU">🇭🇺 Hungary</option>
                    <option value="GR">🇬🇷 Greece</option>
                    <option value="IE">🇮🇪 Ireland</option>
                    <option value="RU">🇷🇺 Russia</option>
                    <option value="UA">🇺🇦 Ukraine</option>
                  </optgroup>
                  <optgroup label="Asia">
                    <option value="JP">🇯🇵 Japan</option>
                    <option value="CN">🇨🇳 China</option>
                    <option value="KR">🇰🇷 South Korea</option>
                    <option value="IN">🇮🇳 India</option>
                    <option value="TH">🇹🇭 Thailand</option>
                    <option value="PH">🇵🇭 Philippines</option>
                    <option value="ID">🇮🇩 Indonesia</option>
                    <option value="SG">🇸🇬 Singapore</option>
                    <option value="TW">🇹🇼 Taiwan</option>
                    <option value="HK">🇭🇰 Hong Kong</option>
                    <option value="IL">🇮🇱 Israel</option>
                    <option value="TR">🇹🇷 Turkey</option>
                    <option value="SA">🇸🇦 Saudi Arabia</option>
                    <option value="AE">🇦🇪 UAE</option>
                  </optgroup>
                  <optgroup label="Oceania">
                    <option value="AU">🇦🇺 Australia</option>
                    <option value="NZ">🇳🇿 New Zealand</option>
                  </optgroup>
                  <optgroup label="Africa">
                    <option value="ZA">🇿🇦 South Africa</option>
                    <option value="EG">🇪🇬 Egypt</option>
                    <option value="NG">🇳🇬 Nigeria</option>
                    <option value="KE">🇰🇪 Kenya</option>
                    <option value="MA">🇲🇦 Morocco</option>
                  </optgroup>
                </select>
              </div>
              
              {/* Row 2: Prompt preview + Send button (shows when template selected) */}
              {selectedTemplate && selectedTemplate !== 'rank' && selectedTemplate !== 'radio' && (
                <div className="flex items-start gap-2 bg-gray-800 rounded p-2">
                  <p className="flex-1 text-xs text-gray-300 leading-relaxed">
                    {PROMPT_TEMPLATES.find(t => t.id === selectedTemplate)?.prompt}
                  </p>
                  <button
                    onClick={() => {
                      const prompt = PROMPT_TEMPLATES.find(t => t.id === selectedTemplate)?.prompt;
                      if (prompt) sendMessage(prompt);
                    }}
                    disabled={!!typing}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold shrink-0 disabled:opacity-50 ${theme.sendBtn}`}
                  >
                    {typing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Send
                  </button>
                </div>
              )}
              
              {/* Radio template - show song requests */}
              {selectedTemplate === 'radio' && (
                <div className="bg-gray-800 rounded p-2">
                  {songRequestsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Loader2 size={12} className="animate-spin" /> Loading song requests...
                    </div>
                  ) : songRequests.length === 0 ? (
                    <p className="text-xs text-gray-400">No added song requests found. Mark songs as "Added" in the Requests tab first.</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-300">
                          <span className="font-bold text-[#E36B11]">{songRequests.length}</span> songs from our community ready for article:
                        </p>
                        <button
                          onClick={() => {
                            // Build the Radio article prompt with song data
                            const songList = songRequests.map(r => `- "${r.song}" by ${r.band} (requested by ${r.username} for ${r.playlist})`).join('\n');
                            const radioPrompt = `RADIO ARTICLE — Write a monthly "Community Radio" article celebrating the songs our readers requested this month.

SONG REQUESTS FROM OUR COMMUNITY:
${songList}

Write an engaging article that:
1. Thanks our community for their great taste in music
2. Groups songs by genre/mood/era if possible
3. Tells a short story or fun fact about 3-5 of the most interesting songs
4. Mentions the usernames who requested them (they'll love seeing their name!)
5. Encourages more song requests

Tone: Warm, appreciative, music-nerd enthusiastic. Like a DJ thanking callers.
Category: music
Length: 800-1200 words`;
                            sendMessage(radioPrompt);
                          }}
                          disabled={!!typing || songRequests.length === 0}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold shrink-0 disabled:opacity-50 ${theme.sendBtn}`}
                        >
                          {typing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Generate Article
                        </button>
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {songRequests.slice(0, 10).map(r => (
                          <div key={r._id} className="text-[10px] text-gray-400 flex items-center gap-2">
                            <span className="text-white font-medium">{r.band}</span>
                            <span className="text-gray-500">—</span>
                            <span>{r.song}</span>
                            <span className="text-gray-600">({r.username})</span>
                          </div>
                        ))}
                        {songRequests.length > 10 && (
                          <p className="text-[10px] text-gray-500">...and {songRequests.length - 10} more</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
            </div>
          )}

          {/* Rankroll Row - shows when Rankroll type is selected */}
          {currentPiece?.type === 'rankroll' && (
            <div className="border-b border-gray-800 bg-gray-900/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 shrink-0">🏆 Propose ranking:</span>
                <input
                  type="text"
                  value={rankrollInput}
                  onChange={e => setRankrollInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && rankrollInput.trim() && !typing) {
                      sendMessage(`Propose a rankroll about: ${rankrollInput.trim()}`);
                    }
                  }}
                  placeholder="e.g. Robert De Niro best movies, 90s hip hop albums, Mike Tyson fights..."
                  className="flex-1 bg-gray-700 px-3 py-2 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#E36B11]"
                />
                {typing ? (
                  <button
                    onClick={() => {
                      cancelRequestedRef.current = true;
                      setTyping(false); // Immediately stop typing indicator
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold shrink-0 bg-red-600 hover:bg-red-500 text-white"
                  >
                    <X size={12} /> Stop
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (rankrollInput.trim() && !typing) {
                        sendMessage(`Propose a rankroll about: ${rankrollInput.trim()}`);
                      }
                    }}
                    disabled={!rankrollInput.trim()}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold shrink-0 disabled:opacity-50 ${theme.sendBtn}`}
                  >
                    <Send size={12} /> Send
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TV Row - shows when TV type is selected */}
          {currentPiece?.type === 'tv' && (
            <div className="border-b border-gray-800 bg-gray-900/50 px-3 py-3">
              {/* Search Input */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-400 shrink-0">📺 Find YouTube videos for:</span>
                <input
                  type="text"
                  value={tvSearchInput}
                  onChange={e => setTvSearchInput(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && tvSearchInput.trim() && !tvSearching) {
                      setTvSearching(true);
                      setTvResults([]);
                      try {
                        const res = await fetch('/api/editorial/tv-search', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ topic: tvSearchInput.trim(), count: 6, searchOnly: true }),
                        });
                        const data = await res.json();
                        if (data.success && data.videos) {
                          setTvResults(data.videos.map((v: any) => ({
                            youtubeId: v.youtubeId,
                            title: v.title,
                            description: v.description || '',
                            duration: v.duration || '',
                            thumbnail: v.thumbnail || `https://img.youtube.com/vi/${v.youtubeId}/mqdefault.jpg`,
                          })));
                        }
                      } catch (err) {
                        console.error('TV search error:', err);
                      }
                      setTvSearching(false);
                    }
                  }}
                  placeholder="e.g. Max Cavalera interview, Nirvana live, Brad Pitt movies..."
                  className="flex-1 bg-gray-700 px-3 py-2 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <button
                  onClick={async () => {
                    if (tvSearchInput.trim() && !tvSearching) {
                      setTvSearching(true);
                      setTvResults([]);
                      try {
                        const res = await fetch('/api/editorial/tv-search', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ topic: tvSearchInput.trim(), count: 6, searchOnly: true }),
                        });
                        const data = await res.json();
                        if (data.success && data.videos) {
                          setTvResults(data.videos.map((v: any) => ({
                            youtubeId: v.youtubeId,
                            title: v.title,
                            description: v.description || '',
                            duration: v.duration || '',
                            thumbnail: v.thumbnail || `https://img.youtube.com/vi/${v.youtubeId}/mqdefault.jpg`,
                          })));
                        }
                      } catch (err) {
                        console.error('TV search error:', err);
                      }
                      setTvSearching(false);
                    }
                  }}
                  disabled={!tvSearchInput.trim() || tvSearching}
                  className="flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold shrink-0 disabled:opacity-50 bg-green-600 hover:bg-green-500 text-white"
                >
                  {tvSearching ? <Loader2 size={12} className="animate-spin" /> : <Tv size={12} />} Search
                </button>
              </div>

              {/* Results Grid */}
              {tvResults.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {tvResults.map((video, idx) => (
                    <div key={video.youtubeId} className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-purple-500 transition-colors">
                      {/* Thumbnail */}
                      <div className="relative aspect-video">
                        <img 
                          src={video.thumbnail} 
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                        {video.duration && (
                          <span className="absolute top-2 right-2 bg-black/90 text-white text-xs font-bold px-2 py-0.5 rounded">
                            {video.duration}
                          </span>
                        )}
                        {/* Play button overlay */}
                        <a 
                          href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity"
                        >
                          <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          </div>
                        </a>
                      </div>
                      {/* Info */}
                      <div className="p-2">
                        <h4 className="text-xs font-medium text-white line-clamp-2 mb-2">{video.title}</h4>
                        {/* Save buttons */}
                        <div className="flex gap-1">
                          {[1, 2, 3].map(pos => (
                            <button
                              key={pos}
                              onClick={async () => {
                                setTvSaving(pos);
                                try {
                                  const res = await fetch('/api/editorial/tv-search', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ 
                                      saveVideo: {
                                        youtubeId: video.youtubeId,
                                        title: video.title,
                                        description: video.description,
                                        duration: video.duration,
                                      },
                                      position: pos,
                                    }),
                                  });
                                  const data = await res.json();
                                  if (data.success) {
                                    // Update the result to show it's saved
                                    setTvResults(prev => prev.map((v, i) => 
                                      i === idx ? { ...v, savedAt: pos } as any : v
                                    ));
                                  }
                                } catch (err) {
                                  console.error('Save error:', err);
                                }
                                setTvSaving(null);
                              }}
                              disabled={tvSaving !== null}
                              className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-colors ${
                                (video as any).savedAt === pos
                                  ? 'bg-green-600 text-white'
                                  : 'bg-purple-600/50 hover:bg-purple-600 text-white'
                              }`}
                            >
                              {tvSaving === pos ? (
                                <Loader2 size={10} className="animate-spin mx-auto" />
                              ) : (video as any).savedAt === pos ? (
                                <Check size={10} className="mx-auto" />
                              ) : (
                                `#${pos}`
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Searching indicator */}
              {tvSearching && (
                <div className="flex items-center justify-center gap-2 py-8 text-purple-400">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-sm">Searching YouTube...</span>
                </div>
              )}
            </div>
          )}

          {/* Radio Row - shows when Radio type is selected */}
          {currentPiece?.type === 'radio' && (
            <div className="border-b border-gray-800 bg-gray-900/50 px-3 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio size={16} className="text-[#1DB954]" />
                  <span className="text-sm font-medium text-gray-300">Community Radio Article</span>
                  <span className="text-xs text-gray-500">
                    {songRequestsLoading ? 'Loading...' : `${songRequests.length} songs ready`}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    const activePeople = roster.filter(r => activeReporters[r.id]);
                    if (activePeople.length === 0) {
                      alert('Select at least one reporter first');
                      return;
                    }
                    if (songRequests.length === 0) {
                      alert('No song requests available. Wait for them to load.');
                      return;
                    }
                    
                    // Use the first selected reporter
                    const reporter = activePeople[0];
                    setTyping(reporter.name);
                    
                    // Build the Radio article prompt with song data INCLUDING Spotify links
                    const songList = songRequests.map(r => {
                      const spotifyLink = r.link || '';
                      return `- "${r.song}" by ${r.band} (requested by @${r.username} for ${r.playlist})${spotifyLink ? ` [SPOTIFY: ${spotifyLink}]` : ''}`;
                    }).join('\n');
                    
                    const radioPrompt = `Write a "Community Radio" article celebrating the songs our readers requested this month.

SONG REQUESTS FROM OUR COMMUNITY:
${songList}

Write an engaging article that:
1. Thanks our community for their great taste in music
2. Groups songs by genre/mood/era if possible  
3. Tells a short story or fun fact about 3-5 of the most interesting songs
4. Mentions the usernames who requested them (they'll love seeing their name!)
5. Encourages more song requests

IMPORTANT FORMATTING:
- For each section, use "spotifyEmbed" instead of "youtubeSearch"
- Use the SPOTIFY links provided above (the [SPOTIFY: ...] URLs)
- DO NOT search for YouTube videos - this is a MUSIC article with Spotify embeds only

Tone: Warm, appreciative, music-nerd enthusiastic. Like a DJ thanking callers.
Category: music
Length: 800-1200 words

IMPORTANT: Generate a full article, NOT a birthday proposal. This is about the SONGS listed above.`;

                    try {
                      // Call editorial chat API directly to generate article
                      // articleMode: true forces article generation (not proposal)
                      // skipYoutube: true prevents YouTube video search (use Spotify instead)
                      const res = await fetch('/api/editorial/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          reporterUserId: reporter.id,
                          message: radioPrompt,
                          articleMode: true,
                          skipYoutube: true,
                          spotifyLinks: songRequests.map(r => ({ song: r.song, band: r.band, link: r.link, coverImage: r.coverImage })),
                        }),
                      });
                      const data = await res.json();
                      console.log('[Radio] API response:', data);
                      
                      // API returns articleDraftId, not articleId
                      const createdArticleId = data.articleDraftId || data.articleId;
                      
                      if (createdArticleId) {
                        // Article was created - fetch it and show in editor
                        console.log('[Radio] Fetching article:', createdArticleId);
                        const articleRes = await fetch(`/api/articles/${createdArticleId}`);
                        const articleData = await articleRes.json();
                        console.log('[Radio] Article data:', articleData);
                        if (articleData.success && articleData.article) {
                          const a = articleData.article;
                          setArticleDraft({
                            _id: a._id,
                            title: a.title || '',
                            subtitle: a.subtitle || '',
                            content: a.content || '',
                            category: a.category || 'music',
                            tags: a.tags || [],
                            coverImage: a.coverImage || '',
                            reporterId: reporter.id,
                            reporterName: reporter.name,
                            personName: 'Community Radio',
                          });
                          // Add to created articles tabs
                          setCreatedArticles(prev => [...prev, {
                            id: a._id,
                            title: a.title || 'Community Radio Article',
                            reporterName: reporter.name,
                            draft: {
                              _id: a._id,
                              title: a.title || '',
                              subtitle: a.subtitle || '',
                              content: a.content || '',
                              category: a.category || 'music',
                              tags: a.tags || [],
                              coverImage: a.coverImage || '',
                              reporterId: reporter.id,
                              reporterName: reporter.name,
                              personName: 'Community Radio',
                            },
                          }]);
                          setSelectedArticleTab(a._id);
                        }
                      } else {
                        // No articleId - show error or reply
                        console.warn('[Radio] No articleDraftId in response. Reply:', data.reply, 'Error:', data.error, 'Response:', data.response);
                        alert(data.response || data.reply || data.error || 'Article generation failed - check console');
                      }
                      
                      // Add message to chat (only if currentPiece exists)
                      if (currentPiece?.id) {
                        updatePieceMessages(currentPiece.id, msgs => [
                          ...msgs,
                          { id: generateId(), from: reporter.id, name: reporter.name, text: createdArticleId ? '✅ Article created! Click to edit.' : (data.response || data.reply || data.error || 'No article generated.') },
                        ]);
                      }
                    } catch (err: any) {
                      console.error('Radio article generation failed:', err);
                      alert('Radio article generation failed: ' + (err?.message || 'Unknown error'));
                      if (currentPiece?.id) {
                        updatePieceMessages(currentPiece.id, msgs => [
                          ...msgs,
                          { id: generateId(), from: 'system', text: '❌ Failed to generate article: ' + (err?.message || 'Unknown error') },
                        ]);
                      }
                    }
                    
                    setTyping(false);
                  }}
                  disabled={!!typing || songRequestsLoading || songRequests.length === 0 || !roster.some(r => activeReporters[r.id])}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-[#1DB954] hover:bg-[#1ed760] text-white"
                >
                  {typing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  Start Article
                </button>
              </div>
            </div>
          )}

          {/* History Row - shows when History type is selected */}
          {currentPiece?.type === 'history' && (
            <div className="border-b border-gray-800 bg-gray-900/50 px-3 py-3 flex flex-col max-h-[calc(100vh-300px)] overflow-hidden">
              {/* Header with Start button */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-300">On This Day — {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span>
                  <span className="text-xs text-gray-500">Each reporter finds a historical event</span>
                </div>
                <div className="flex items-center gap-2">
                  {historyEvents.length > 0 && (
                    <span className="text-xs text-gray-400">
                      {historyEvents.filter(e => e.selected).length} / {historyEvents.length} selected
                    </span>
                  )}
                  <button
                    onClick={async () => {
                      const activeIds = roster.filter(r => activeReporters[r.id]).map(r => r.id);
                      if (activeIds.length === 0) return;
                      
                      setHistorySearching(true);
                      setHistoryEvents([]);
                      
                      // Initialize all reporters as loading
                      const initialEvents = activeIds.map(id => {
                        const r = roster.find(rep => rep.id === id);
                        return {
                          id: `${id}-${Date.now()}`,
                          title: '',
                          year: 0,
                          date: '',
                          description: '',
                          category: '',
                          youtubeSearch: '',
                          reporterId: id,
                          reporterName: r?.name || 'Reporter',
                          selected: false,
                          loading: true,
                        };
                      });
                      setHistoryEvents(initialEvents);
                      
                      // Fetch events SEQUENTIALLY so each reporter knows what others found
                      const foundEvents: string[] = []; // Track found event titles to avoid duplicates
                      
                      for (const reporterId of activeIds) {
                        try {
                          const res = await fetch('/api/editorial/history-event', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              reporterId,
                              excludeEvents: foundEvents, // Tell API what events to avoid
                            }),
                          });
                          const data = await res.json();
                          
                          if (data.success && data.event) {
                            // Add to found events list
                            foundEvents.push(data.event.title);
                            
                            // Update this reporter's event immediately
                            setHistoryEvents(prev => prev.map(e => 
                              e.reporterId === reporterId 
                                ? { ...e, ...data.event, loading: false, selected: true }
                                : e
                            ));
                          } else {
                            setHistoryEvents(prev => prev.map(e => 
                              e.reporterId === reporterId 
                                ? { ...e, loading: false, error: data.error || 'Failed' }
                                : e
                            ));
                          }
                        } catch (err) {
                          setHistoryEvents(prev => prev.map(e => 
                            e.reporterId === reporterId 
                              ? { ...e, loading: false, error: 'Network error' }
                              : e
                          ));
                        }
                      }
                      
                      setHistorySearching(false);
                    }}
                    disabled={historySearching || roster.filter(r => activeReporters[r.id]).length === 0}
                    className="flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold shrink-0 disabled:opacity-50 bg-green-600 hover:bg-green-500 text-white"
                  >
                    {historySearching ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {historyEvents.length > 0 ? 'Search Again' : 'Start Search'}
                  </button>
                </div>
              </div>

              {/* Events Grid - scrollable */}
              {historyEvents.length > 0 && (
                <div className="flex-1 overflow-y-auto pr-2 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {historyEvents.map((event) => (
                    <div 
                      key={event.id}
                      className={`rounded-lg p-3 border transition-all cursor-pointer ${
                        event.loading 
                          ? 'bg-gray-800 border-gray-600 animate-pulse'
                          : event.error
                            ? 'bg-red-950/30 border-red-900/50'
                            : event.selected
                              ? 'bg-gray-800 border-green-500'
                              : 'bg-gray-900 border-gray-700 hover:border-gray-500'
                      }`}
                      onClick={() => {
                        if (!event.loading && !event.error) {
                          setHistoryEvents(prev => prev.map(e => 
                            e.id === event.id ? { ...e, selected: !e.selected } : e
                          ));
                        }
                      }}
                    >
                      {/* Reporter name */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-300 font-medium">{event.reporterName}</span>
                        {!event.loading && !event.error && (
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            event.selected ? 'bg-green-500 border-green-500' : 'border-gray-600'
                          }`}>
                            {event.selected && <Check size={12} className="text-black" />}
                          </div>
                        )}
                      </div>
                      
                      {event.loading ? (
                        <div className="flex items-center gap-2 py-4">
                          <Loader2 size={16} className="animate-spin text-gray-400" />
                          <span className="text-sm text-gray-400">Searching...</span>
                        </div>
                      ) : event.error ? (
                        <div className="py-2">
                          <p className="text-sm text-red-400">{event.error}</p>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              // Retry this reporter
                              setHistoryEvents(prev => prev.map(ev => 
                                ev.id === event.id ? { ...ev, loading: true, error: undefined } : ev
                              ));
                              try {
                                const res = await fetch('/api/editorial/history-event', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ reporterId: event.reporterId }),
                                });
                                const data = await res.json();
                                if (data.success && data.event) {
                                  setHistoryEvents(prev => prev.map(ev => 
                                    ev.id === event.id ? { ...ev, ...data.event, loading: false, selected: true } : ev
                                  ));
                                } else {
                                  setHistoryEvents(prev => prev.map(ev => 
                                    ev.id === event.id ? { ...ev, loading: false, error: data.error || 'Failed' } : ev
                                  ));
                                }
                              } catch {
                                setHistoryEvents(prev => prev.map(ev => 
                                  ev.id === event.id ? { ...ev, loading: false, error: 'Network error' } : ev
                                ));
                              }
                            }}
                            className="mt-2 text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1"
                          >
                            <RotateCcw size={10} /> Try Again
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* Event date and title */}
                          <div className="text-xs text-gray-500 mb-1">{event.date}</div>
                          <h4 className="text-base font-bold text-white mb-2">
                            {event.title}
                          </h4>
                          <p className="text-sm text-gray-400 line-clamp-3 mb-3">{event.description}</p>
                          
                          {/* Video thumbnail */}
                          {event.youtubeVideoId && (
                            <a 
                              href={`https://www.youtube.com/watch?v=${event.youtubeVideoId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="relative block mb-3 rounded overflow-hidden group"
                            >
                              <img 
                                src={`https://img.youtube.com/vi/${event.youtubeVideoId}/mqdefault.jpg`}
                                alt={event.title}
                                className="w-full h-auto rounded"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
                                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                                  <Play size={18} className="text-white ml-0.5" fill="white" />
                                </div>
                              </div>
                            </a>
                          )}
                          
                          {/* Category */}
                          <div className="flex items-center">
                            <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
                              {event.category}
                            </span>
                          </div>
                          
                          {/* Action buttons */}
                          <div className="mt-2 flex items-center gap-3">
                            {/* Different Event button */}
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                setHistoryEvents(prev => prev.map(ev => 
                                  ev.id === event.id ? { ...ev, loading: true } : ev
                                ));
                                try {
                                  // Get other events to exclude
                                  const otherEvents = historyEvents
                                    .filter(ev => ev.id !== event.id && ev.title)
                                    .map(ev => ev.title);
                                  
                                  const res = await fetch('/api/editorial/history-event', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ 
                                      reporterId: event.reporterId,
                                      excludeEvents: otherEvents,
                                    }),
                                  });
                                  const data = await res.json();
                                  if (data.success && data.event) {
                                    setHistoryEvents(prev => prev.map(ev => 
                                      ev.id === event.id ? { ...ev, ...data.event, id: `${event.reporterId}-${Date.now()}`, loading: false, selected: true } : ev
                                    ));
                                  } else {
                                    setHistoryEvents(prev => prev.map(ev => 
                                      ev.id === event.id ? { ...ev, loading: false, error: data.error } : ev
                                    ));
                                  }
                                } catch {
                                  setHistoryEvents(prev => prev.map(ev => 
                                    ev.id === event.id ? { ...ev, loading: false, error: 'Network error' } : ev
                                  ));
                                }
                              }}
                              className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1"
                            >
                              <RotateCcw size={10} /> Different Event
                            </button>
                            
                            {/* Different Video button */}
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                // Remember the current video: the search now filters for
                                // long/medium duration, so "nothing found" is a real
                                // outcome. Without restoring it, clearing the id for the
                                // loading state would drop a perfectly good video.
                                const previousVideoId = event.youtubeVideoId;
                                setHistoryEvents(prev => prev.map(ev => 
                                  ev.id === event.id ? { ...ev, youtubeVideoId: undefined } : ev
                                ));
                                try {
                                  const res = await fetch('/api/editorial/history-video', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ 
                                      query: event.youtubeSearch || event.title,
                                      year: event.year,
                                      excludeVideoId: previousVideoId,
                                    }),
                                  });
                                  const data = await res.json();
                                  setHistoryEvents(prev => prev.map(ev => 
                                    ev.id === event.id
                                      ? { ...ev, youtubeVideoId: (data.success && data.videoId) ? data.videoId : previousVideoId }
                                      : ev
                                  ));
                                } catch {
                                  // Network error - put the original video back
                                  setHistoryEvents(prev => prev.map(ev => 
                                    ev.id === event.id ? { ...ev, youtubeVideoId: previousVideoId } : ev
                                  ));
                                }
                              }}
                              className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1"
                            >
                              <Video size={10} /> Different Video
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                </div>
              )}

              {/* Banner Preview + Actions */}
              {historyEvents.filter(e => e.selected && !e.error).length > 0 && (
                <div className="pt-3 mt-3 border-t border-gray-700 shrink-0">
                  {/* Headline display - always show, with generate button if no headline */}
                  <div className="flex items-center gap-2 mb-3">
                    {historyHeadline ? (
                      <>
                        <span className="text-sm font-bold text-white flex-1 truncate">{historyHeadline}</span>
                        <button
                          onClick={async () => {
                            const selectedEvents = historyEvents.filter(e => e.selected && !e.error);
                            if (selectedEvents.length === 0) return;
                            
                            try {
                              const res = await fetch('/api/editorial/history-headline', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                  events: selectedEvents.map(e => ({
                                    title: e.title,
                                    year: e.year,
                                  }))
                                }),
                              });
                              const data = await res.json();
                              if (data.success && data.headline) {
                                setHistoryHeadline(data.headline);
                              }
                            } catch {
                              // Silently fail
                            }
                          }}
                          className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                          title="Generate new headline"
                        >
                          <Sparkles size={12} /> New
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={async () => {
                          const selectedEvents = historyEvents.filter(e => e.selected && !e.error);
                          if (selectedEvents.length === 0) return;
                          
                          try {
                            const res = await fetch('/api/editorial/history-headline', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ 
                                events: selectedEvents.map(e => ({
                                  title: e.title,
                                  year: e.year,
                                }))
                              }),
                            });
                            const data = await res.json();
                            if (data.success && data.headline) {
                              setHistoryHeadline(data.headline);
                            }
                          } catch {
                            // Silently fail
                          }
                        }}
                        className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                      >
                        <Sparkles size={12} /> Generate Headline
                      </button>
                    )}
                  </div>
                  
                  {/* Action buttons row */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Banner thumbnail preview */}
                      {historyBanner && (
                        <button
                          onClick={() => setShowHistoryBannerModal(true)}
                          className="relative w-24 h-14 rounded overflow-hidden border-2 border-green-500 hover:border-green-400 transition-colors"
                          title="Click to view full banner"
                        >
                          <img src={historyBanner} alt="Banner" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <Eye size={16} className="text-white" />
                          </div>
                        </button>
                      )}
                      
                      <button
                        onClick={async () => {
                          const selectedEvents = historyEvents.filter(e => e.selected && !e.error);
                          if (selectedEvents.length === 0) return;
                          
                          setHistoryBannerGenerating(true);
                          try {
                            const res = await fetch('/api/editorial/history-banner', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ 
                                events: selectedEvents.map(e => ({
                                  title: e.title,
                                  year: e.year,
                                  category: e.category,
                                }))
                              }),
                            });
                            const data = await res.json();
                            if (data.success && data.imageUrl) {
                              setHistoryBanner(data.imageUrl);
                              setHistoryHeadline(data.headline || null);
                              setShowHistoryBannerModal(true); // Show modal when generated
                            } else {
                              alert(`❌ Failed: ${data.error}`);
                            }
                          } catch (err) {
                            alert('❌ Network error');
                          }
                          setHistoryBannerGenerating(false);
                        }}
                        disabled={historyBannerGenerating}
                        className="flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
                      >
                        {historyBannerGenerating ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            Generating... (60-90s)
                          </>
                        ) : (
                          <>
                            <Sparkles size={12} />
                            {historyBanner ? 'Regenerate Banner' : 'Generate Banner'}
                          </>
                        )}
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">
                        {historyEvents.filter(e => e.selected && !e.error).length} events selected
                      </span>
                      <button
                        onClick={async () => {
                          const selectedEvents = historyEvents.filter(e => e.selected && !e.error);
                          if (selectedEvents.length === 0) return;
                          
                          setHistoryCompiling(true);
                          try {
                            const res = await fetch('/api/editorial/history-compile', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ 
                                events: selectedEvents.map(e => ({
                                  title: e.title,
                                  year: e.year,
                                  date: e.date,
                                  description: e.description,
                                  category: e.category,
                                  youtubeSearch: e.youtubeSearch,
                                  youtubeVideoId: e.youtubeVideoId,
                                  reporterId: e.reporterId,
                                  reporterName: e.reporterName,
                                })),
                                bannerImage: historyBanner, // Pass the banner image
                                headline: historyHeadline, // Pass the headline
                              }),
                            });
                            const data = await res.json();
                            if (data.success) {
                              // Clear events, banner and headline
                              setHistoryEvents([]);
                              setHistoryBanner(null);
                              setHistoryHeadline(null);
                              alert(`✅ History article created!\n\nTitle: ${data.title}\nEvents: ${data.eventCount}\n\nGo to Articles tab to review.`);
                            } else {
                              alert(`❌ Failed: ${data.error}`);
                            }
                          } catch (err) {
                            alert('❌ Network error');
                          }
                          setHistoryCompiling(false);
                        }}
                        disabled={historyCompiling}
                        className="flex items-center gap-1.5 px-5 py-2 rounded text-sm font-bold bg-green-600 hover:bg-green-500 text-white disabled:opacity-50"
                      >
                        {historyCompiling ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                        Create History Article
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {historyEvents.length === 0 && !historySearching && (
                <div className="text-center py-6 text-gray-500">
                  <BookOpen size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Select reporters and click "Start Search"</p>
                  <p className="text-xs mt-1">Each reporter will find a historical event for today's date</p>
                </div>
              )}
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Proposals + Working indicators */}
            {currentPiece ? (
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Reporter Cards Grid - PERSISTENT cards that update with status */}
                {(typing || messages.some(m => m.from === 'proposals')) && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {roster.filter(r => activeReporters[r.id]).map(r => {
                      // Find this reporter's proposal in messages
                      const proposalMsg = messages.find(m => m.from === 'proposals' && m.proposals?.some(p => p.reporterId === r.id));
                      const proposal = proposalMsg?.proposals?.find(p => p.reporterId === r.id);
                      const isSearching = typing && !proposal;
                      
                      return (
                        <div 
                          key={r.id} 
                          className={`rounded-xl p-4 flex flex-col min-h-[180px] transition-all ${
                            isSearching 
                              ? "bg-green-900/30 border border-green-600 animate-pulse"
                              : proposal?.isError
                                ? "bg-red-950/30 border border-red-900/50"
                                : proposal
                                  ? "bg-gray-900 border border-gray-700 hover:border-[#E36B11]"
                                  : "bg-gray-900 border border-gray-700"
                          }`}
                        >
                          {/* Reporter header: Avatar + Name + Category */}
                          <div className="flex items-center gap-2 mb-2">
                            {r.avatar ? (
                              <img src={r.avatar} alt={r.name} className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-black ${colorFor(r.id).bg}`}>
                                {r.name.split(' ').map(n => n[0]).join('')}
                              </div>
                            )}
                            <div className="text-xs font-semibold text-gray-200 flex-1">{r.name}</div>
                            {proposal && !proposal.isError && (
                              <span className="text-[8px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">
                                {proposal.category === 'sports' ? 'Sports' : 
                                  proposal.category === 'music' ? 'Music' : 
                                  proposal.category === 'gaming' ? 'Gaming' :
                                  proposal.category === 'politics' ? 'Politics' :
                                  proposal.category === 'tech' ? 'Tech' :
                                  proposal.category === 'movies-tv' ? 'Movies/TV' :
                                  proposal.category === 'lifestyle' ? 'Lifestyle' :
                                  'Culture'}
                              </span>
                            )}
                          </div>
                          
                          {/* Status content */}
                          {isSearching ? (
                            /* Searching state */
                            <div className="flex-1 flex flex-col items-center justify-center">
                              <Loader2 className="w-6 h-6 text-green-400 animate-spin mb-2" />
                              <div className="text-[10px] text-green-400">searching...</div>
                            </div>
                          ) : proposal?.isError ? (
                            /* Error state - show what was found but rejected */
                            <>
                              <div className="flex items-center gap-1 mb-1">
                                <span className="text-sm">❌</span>
                                <span className="text-[10px] text-red-400 font-medium">No match</span>
                              </div>
                              {proposal.name !== 'Unknown' && (
                                <div className="text-xs text-white mb-1 line-clamp-1">{proposal.name}</div>
                              )}
                              {proposal.birthday && (
                                <div className="text-[9px] text-white/70 mb-1">📅 {proposal.birthday?.length > 60 ? proposal.birthday.slice(0, 60) + '...' : proposal.birthday}</div>
                              )}
                              <p className="text-[10px] text-red-400/80 flex-1">{proposal.errorReason}</p>
                              <button
                                onClick={() => askForAnother(r.id, r.name, selectedTemplate === 'rip')}
                                disabled={!!retryingReporter}
                                className={`mt-2 w-full py-1.5 rounded text-[10px] flex items-center justify-center gap-1 ${
                                  retryingReporter === r.id
                                    ? 'bg-blue-600 text-white animate-pulse'
                                    : retryingReporter
                                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                }`}
                              >
                                {retryingReporter === r.id ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Searching...
                                  </>
                                ) : (
                                  '↻ Try again'
                                )}
                              </button>
                            </>
                          ) : proposal ? (
                            /* Found state - different layout for Rankroll vs Article */
                            <>
                              {currentPiece?.type === 'rankroll' ? (
                                /* RANKROLL layout */
                                <>
                                  <div className="text-[11px] font-semibold text-white mb-1 line-clamp-2">{proposal.name}</div>
                                  <div className="text-[9px] text-purple-400 mb-1">🏆 {proposal.country}</div>
                                  <p className="text-[9px] text-white/80 flex-1 line-clamp-2 mb-0.5">{proposal.description}</p>
                                </>
                              ) : (
                                /* ARTICLE layout - Person with Birthday + Flag */
                                <>
                                  <div className="flex items-center gap-1.5 text-[11px] text-white mb-1">
                                    <span className="font-semibold text-white">{proposal.name}</span>
                                    <span className="text-white/60">·</span>
                                    <span className="text-white/90">{proposal.birthday?.length > 80 ? proposal.birthday.slice(0, 80) + '...' : proposal.birthday}</span>
                                    {proposal.country && !proposal.country.includes('items') && (
                                      <CountryFlag 
                                        flag={
                                          proposal.country === 'Canada' ? 'CA' : 
                                          proposal.country === 'USA' || proposal.country === 'United States' ? 'US' :
                                          proposal.country === 'UK' || proposal.country === 'United Kingdom' ? 'GB' :
                                          proposal.country === 'Northern Ireland' || proposal.country?.includes('Northern Ireland') ? 'NI' :
                                          proposal.country === 'Scotland' ? 'gb-sct' :
                                          proposal.country === 'Wales' ? 'gb-wls' :
                                          proposal.country === 'England' ? 'gb-eng' :
                                          proposal.country === 'Germany' ? 'DE' :
                                          proposal.country === 'France' ? 'FR' :
                                          proposal.country === 'Italy' ? 'IT' :
                                          proposal.country === 'Spain' ? 'ES' :
                                          proposal.country === 'Japan' ? 'JP' :
                                          proposal.country === 'Australia' ? 'AU' :
                                          proposal.country === 'Brazil' ? 'BR' :
                                          proposal.country === 'Poland' ? 'PL' :
                                          proposal.country === 'Singapore' ? 'SG' :
                                          proposal.country === 'Libya' || proposal.country?.includes('Libya') ? 'LY' :
                                          proposal.country === 'Mexico' ? 'MX' :
                                          proposal.country === 'Argentina' ? 'AR' :
                                          proposal.country === 'Netherlands' ? 'NL' :
                                          proposal.country === 'Sweden' ? 'SE' :
                                          proposal.country === 'Norway' ? 'NO' :
                                          proposal.country === 'Russia' ? 'RU' :
                                          proposal.country === 'China' ? 'CN' :
                                          proposal.country === 'South Korea' ? 'KR' :
                                          proposal.country === 'India' ? 'IN' :
                                          proposal.country === 'Ireland' ? 'IE' :
                                          'US'
                                        } 
                                        className="w-4 h-3 rounded-[1px]"
                                      />
                                    )}
                                  </div>
                                  <p className="text-[9px] text-white/80 flex-1 line-clamp-2 mb-0.5">{proposal.description}</p>
                                </>
                              )}
                              {/* Common elements for both layouts */}
                              {proposal.savedToMenschen && (
                                <div className="text-[8px] text-green-500 flex items-center gap-1 mb-1">
                                  <Check className="w-2.5 h-2.5" />
                                  <span>Saved to Menschen Database</span>
                                </div>
                              )}
                              <div className="flex gap-1">
                                {selectingProposal === proposal.reporterId ? (
                                  /* Stop button when writing */
                                  <button
                                    onClick={cancelGeneration}
                                    className="flex-1 py-1 rounded text-[10px] font-bold text-white flex items-center justify-center gap-1 bg-red-600 hover:bg-red-700"
                                  >
                                    <Square className="w-3 h-3 fill-current" />
                                    Stop
                                  </button>
                                ) : (
                                  /* Select button when idle */
                                  <button
                                    onClick={() => selectProposal(proposal)}
                                    disabled={!!selectingProposal}
                                    className={`flex-1 py-1 rounded text-[10px] font-bold text-white flex items-center justify-center gap-1 ${
                                      selectingProposal
                                        ? 'bg-gray-600 cursor-not-allowed'
                                        : 'bg-[#E36B11] hover:bg-[#c07830]'
                                    }`}
                                  >
                                    Select
                                  </button>
                                )}
                                <button
                                  onClick={() => askForAnother(r.id, r.name, proposal.isRIP)}
                                  disabled={!!retryingReporter || !!selectingProposal}
                                  className={`w-7 py-1 rounded text-[10px] flex items-center justify-center ${
                                    retryingReporter === r.id
                                      ? 'bg-blue-600 text-white animate-pulse'
                                      : retryingReporter || selectingProposal
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                  }`}
                                  title="Try again"
                                >
                                  {retryingReporter === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '↻'}
                                </button>
                              </div>
                            </>
                          ) : (
                            /* Waiting state */
                            <div className="flex-1 flex items-center justify-center text-[10px] text-gray-500">
                              Ready
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Result cards (article created) */}
                {messages.filter(m => m.from === 'result').map(m => (
                  <div key={m.id} className={`rounded px-4 py-3 flex items-center justify-between gap-3 border ${theme.resultBox}`}>
                    <span className={`text-sm ${theme.resultText}`}>{m.text}</span>
                    <div className="flex items-center gap-2">
                      {m.articleDraftId && (
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/articles/${m.articleDraftId}?includeContent=true`);
                              const data = await res.json();
                              if (data.article) {
                                setArticleDraft({
                                  _id: m.articleDraftId,
                                  title: data.article.title || '',
                                  subtitle: data.article.subtitle || '',
                                  content: data.article.content || '',
                                  category: data.article.category || 'culture',
                                  tags: data.article.tags || [],
                                  coverImage: data.article.coverImage || '',
                                  imagePosX: data.article.imagePosX ?? 50,
                                  imagePosY: data.article.imagePosY ?? 50,
                                  reporterId: data.article.author?._id || data.article.author || '',
                                  reporterName: data.article.author?.displayName || 'Unknown',
                                  personName: data.article.title || '',
                                });
                              }
                            } catch (err) {
                              console.error('Failed to load article:', err);
                            }
                          }}
                          className="shrink-0 px-3 py-1 rounded text-xs font-bold bg-[#E36B11] hover:bg-[#c07830] text-white flex items-center gap-1"
                        >
                          <ExternalLink size={12} /> Edit Article
                        </button>
                      )}
                      {m.activated && (
                        <button
                          onClick={() => { onClose?.(); onGoToArticles?.(); }}
                          className="shrink-0 px-3 py-1 rounded text-xs font-bold bg-gray-700 hover:bg-gray-600 text-white flex items-center gap-1"
                        >
                          View in Articles
                        </button>
                      )}
                      {m.activated && m.articlePersonName && (
                        <button
                          onClick={() => {
                            // Switch to Rankroll tab and pre-fill the person name
                            setRankrollInput(m.articlePersonName || '');
                            createPiece('rankroll');
                          }}
                          className="shrink-0 px-3 py-1 rounded text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1"
                        >
                          <ListOrdered size={12} /> Create Rankroll
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Article preview (full article before activation) */}
                {messages.filter(m => m.from === 'article-preview' && m.articlePreview).map(m => {
                  const preview = m.articlePreview!;
                  return (
                    <div key={m.id} className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden max-w-[90%]">
                      <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
                        <span className="text-xs font-semibold text-green-400">📝 Article Draft Preview</span>
                        <span className="text-[10px] text-gray-500">{preview.category}</span>
                      </div>
                      {preview.coverImage && (
                        <img src={preview.coverImage} alt="" className="w-full h-40 object-cover" />
                      )}
                      <div className="p-4">
                        <h3 className="text-lg font-bold text-white mb-1">{preview.title}</h3>
                        {preview.subtitle && <p className="text-sm text-gray-400 mb-3">{preview.subtitle}</p>}
                        <div 
                          className="text-sm text-gray-300 max-h-60 overflow-y-auto prose prose-invert prose-sm"
                          dangerouslySetInnerHTML={{ __html: preview.content }}
                        />
                        {preview.tags && preview.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {preview.tags.map((tag, i) => (
                              <span key={i} className="px-2 py-0.5 bg-gray-800 rounded text-[10px] text-gray-400">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="px-4 py-3 bg-gray-800 border-t border-gray-700 flex justify-end gap-2">
                        {m.activated ? (
                          <button
                            onClick={() => { onClose?.(); onGoToArticles?.(); }}
                            className="px-4 py-1.5 rounded text-xs font-bold bg-gray-600 hover:bg-gray-500 text-white flex items-center gap-1"
                          >
                            <ExternalLink size={12} /> View in Articles
                          </button>
                        ) : (
                          <button
                            onClick={() => activateArticle(m.id, preview)}
                            className={`px-4 py-1.5 rounded text-xs font-bold ${theme.resultBtn}`}
                          >
                            ✓ Activate & Save as Draft
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {/* Menschen check (person data before saving) */}
                {messages.filter(m => m.from === 'menschen-check' && m.menschenCheck).map(m => {
                  const data = m.menschenCheck!;
                  return (
                    <div key={m.id} className="bg-gray-900 border border-purple-500/30 rounded-xl overflow-hidden max-w-md">
                      <div className="bg-purple-500/10 px-4 py-2 flex items-center gap-2">
                        <User size={14} className="text-purple-400" />
                        <span className="text-xs font-semibold text-purple-400">Person not in database</span>
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500 text-xs">Name</span>
                            <p className="text-white font-medium">{data.name}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">Birthday</span>
                            <p className="text-white">{data.birthday || '—'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">Country</span>
                            <p className="text-white">{data.country || '—'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">Profession</span>
                            <p className="text-white">{data.profession || '—'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="px-4 py-3 bg-gray-800 border-t border-gray-700 flex justify-end gap-2">
                        {m.menschenSaved ? (
                          <span className="text-xs text-green-400 flex items-center gap-1">
                            <CheckCircle size={12} /> Saved to Menschen
                          </span>
                        ) : (
                          <button
                            onClick={() => saveMensch(m.id, data)}
                            className="px-4 py-1.5 rounded text-xs font-bold bg-purple-500 hover:bg-purple-400 text-white"
                          >
                            👤 Save to Menschen
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <p className="mb-4 text-gray-500">Select a content type to start:</p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {CONTENT_TYPES.map(c => {
                      const Icon = c.icon;
                      return (
                        <button
                          key={c.id}
                          onClick={() => createPiece(c.id)}
                          className="flex items-center gap-2 px-5 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-green-500 transition-all"
                        >
                          <Icon size={18} className="text-green-400" />
                          <span className="text-sm font-semibold text-white">Start {c.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}


          </div>
        </div>
      </div>

      {/* Created Rankrolls tabs - shown below chat */}
      {createdRankrolls.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-[55] bg-gray-900 border-t border-gray-700">
          <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto">
            <span className="text-[10px] text-gray-500 mr-2">Rankings:</span>
            {createdRankrolls.map(rankroll => (
              <button
                key={rankroll.id}
                onClick={() => {
                  setSelectedRankrollTab(rankroll.id);
                  setSelectedArticleTab(null);
                  setArticleDraft(null);
                }}
                className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-all ${
                  selectedRankrollTab === rankroll.id 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                🏆 {rankroll.title.slice(0, 25)}{rankroll.title.length > 25 ? '...' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Article Editor Modal - Full Width */}
      {articleDraft && (
        <div className="fixed inset-0 z-[60] bg-black/90">
          <div className="bg-gray-800 w-full h-full overflow-y-auto">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800 z-10">
              <h3 className="text-sm font-bold">Edit Article</h3>
              <button onClick={() => setArticleDraft(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Top Section: Cover left, Title/Subtitle center, Meta right */}
              <div className="grid grid-cols-[180px_1fr_280px] gap-4">
                {/* Cover Image */}
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Cover Image</label>
                  <div 
                    onClick={() => setShowImagePicker(true)}
                    className="aspect-[16/10] bg-gray-700 rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#E36B11] transition-all"
                  >
                    {articleDraft.coverImage ? (
                      <img 
                        src={articleDraft.coverImage} 
                        alt="Cover" 
                        className="w-full h-full object-cover"
                        style={{ objectPosition: `${articleDraft.imagePosX ?? 50}% ${articleDraft.imagePosY ?? 50}%` }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                        Click to add
                      </div>
                    )}
                  </div>
                </div>

                {/* Title + Subtitle (stacked) */}
                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">Title *</label>
                    <input
                      type="text"
                      value={articleDraft.title}
                      onChange={e => setArticleDraft({ ...articleDraft, title: e.target.value })}
                      className="w-full bg-gray-700 px-3 py-2 rounded text-base font-semibold"
                      placeholder="Article title..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">Subtitle</label>
                    <input
                      type="text"
                      value={articleDraft.subtitle}
                      onChange={e => setArticleDraft({ ...articleDraft, subtitle: e.target.value })}
                      className="w-full bg-gray-700 px-3 py-2 rounded text-sm text-gray-300"
                      placeholder="Subtitle or tagline..."
                    />
                  </div>
                </div>

                {/* Meta: Category, Author, Tags */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">Category</label>
                      <select
                        value={articleDraft.category}
                        onChange={e => setArticleDraft({ ...articleDraft, category: e.target.value })}
                        className="w-full bg-gray-700 px-2 py-1.5 rounded text-xs"
                      >
                        <option value="culture">Culture</option>
                        <option value="music">Music</option>
                        <option value="movies-tv">Movies & TV</option>
                        <option value="sports">Sports</option>
                        <option value="gaming">Gaming</option>
                        <option value="tech">Tech</option>
                        <option value="genx-icons">GenX Icons</option>
                        <option value="rip">RIP</option>
                        <option value="lifestyle">Lifestyle</option>
                        <option value="news">News</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">Author</label>
                      <select
                        value={articleDraft.reporterId}
                        onChange={e => {
                          const newReporter = roster.find(r => r.id === e.target.value);
                          if (newReporter) {
                            setArticleDraft({ 
                              ...articleDraft, 
                              reporterId: newReporter.id, 
                              reporterName: newReporter.name 
                            });
                          }
                        }}
                        className="w-full bg-gray-700 px-2 py-1.5 rounded text-xs"
                      >
                        {roster.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {/* Rewrite Button */}
                  <button
                    onClick={async () => {
                      if (!articleDraft.personName) return;
                      setSavingArticle(true);
                      try {
                        const res = await fetch('/api/editorial/chat', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            reporterUserId: articleDraft.reporterId,
                            message: `Rewrite this article about ${articleDraft.personName} in YOUR voice and style. Keep the same facts but make it sound like YOU wrote it.\n\nCurrent content:\n${articleDraft.content}`,
                            userId,
                            skipSave: true,
                          }),
                        });
                        const data = await res.json();
                        if (data.success && data.articleData) {
                          setArticleDraft({
                            ...articleDraft,
                            title: data.articleData.title || articleDraft.title,
                            subtitle: data.articleData.subtitle || articleDraft.subtitle,
                            content: data.articleData.content || articleDraft.content,
                          });
                        }
                      } catch (err) {
                        console.error('Rewrite failed:', err);
                      } finally {
                        setSavingArticle(false);
                      }
                    }}
                    disabled={savingArticle}
                    className={`w-full py-1.5 rounded text-[10px] font-medium flex items-center justify-center gap-1 ${
                      savingArticle 
                        ? 'bg-blue-600 text-white animate-pulse' 
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                  >
                    {savingArticle ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Rewriting...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3" />
                        Rewrite in {articleDraft.reporterName.split(' ')[0]}'s voice
                      </>
                    )}
                  </button>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">Tags</label>
                    <div className="flex flex-wrap gap-1 bg-gray-700 px-2 py-1.5 rounded min-h-[32px]">
                      {articleDraft.tags.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 bg-[#E36B11]/20 text-[#E36B11] rounded text-[10px] flex items-center gap-1">
                          {tag}
                          <button onClick={() => setArticleDraft({ ...articleDraft, tags: articleDraft.tags.filter((_, j) => j !== i) })} className="hover:text-white">×</button>
                        </span>
                      ))}
                      <input
                        type="text"
                        value={articleTagInput}
                        onChange={e => setArticleTagInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && articleTagInput.trim()) {
                            setArticleDraft({ ...articleDraft, tags: [...articleDraft.tags, articleTagInput.trim()] });
                            setArticleTagInput('');
                          }
                        }}
                        placeholder="+ Add tag"
                        className="bg-transparent text-[10px] flex-1 min-w-[60px] outline-none text-gray-400"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Content Editor - Full Width */}
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">Content</label>
                <div className="min-w-0">
                  <BlockEditor
                    value={articleDraft.content || ''}
                    onChange={(content: string) => setArticleDraft({ ...articleDraft, content })}
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-700">
                <button
                  onClick={() => {
                    // Just close - article was never saved to DB (skipSave mode)
                    setArticleDraft(null);
                  }}
                  className="px-4 py-1.5 text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  disabled={savingArticle || !articleDraft.title}
                  onClick={async () => {
                    if (savingArticle) return;
                    setSavingArticle(true);
                    try {
                      console.log('Saving article:', articleDraft.title, 'id:', articleDraft._id);
                      // If article has _id, update it (PUT), otherwise create new (POST)
                      const isUpdate = !!articleDraft._id;
                      const url = isUpdate ? `/api/articles/${articleDraft._id}` : '/api/articles';
                      const res = await fetch(url, {
                        method: isUpdate ? 'PUT' : 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          userId, // Required by API (caller)
                          title: articleDraft.title,
                          subtitle: articleDraft.subtitle,
                          content: articleDraft.content,
                          category: articleDraft.category,
                          tags: articleDraft.tags,
                          coverImage: articleDraft.coverImage,
                          imagePosX: articleDraft.imagePosX,
                          imagePosY: articleDraft.imagePosY,
                          author: articleDraft.reporterId,
                          authorName: articleDraft.reporterName, // Skip extra DB lookup
                          status: 'draft',
                          // Person data for Menschen database
                          personName: articleDraft.personName,
                          personBirthday: articleDraft.personBirthday,
                          personDeathday: articleDraft.personDeathday,
                          personCauseOfDeath: articleDraft.personCauseOfDeath,
                          personCountry: articleDraft.personCountry,
                          isRIP: articleDraft.isRIP,
                        }),
                      });
                      const data = await res.json();
                      console.log('Save response:', data);
                      if (data.success || data._id || data.article) {
                        const savedId = data._id || data.article?._id || articleDraft._id;
                        // Mark as saved in tabs (keep visible in bottom bar)
                        setCreatedArticles(prev => prev.map(a => 
                          a.draft?.title === articleDraft.title 
                            ? { ...a, saved: true, id: savedId, draft: { ...a.draft!, _id: savedId } }
                            : a
                        ));
                        // Close the editor modal
                        setSelectedArticleTab(null);
                        setArticleDraft(null);
                        // Add result message to current piece (or find the radio piece)
                        const radioPiece = Object.values(pieces).flat().find((p: Piece) => p.type === 'radio');
                        const targetPieceId = currentPiece?.id || radioPiece?.id;
                        if (targetPieceId && !isUpdate) {
                          updatePieceMessages(targetPieceId, msgs => [
                            ...msgs,
                            {
                              id: generateId(),
                              from: 'result',
                              text: `✅ Article "${articleDraft.title}" saved to Articles.`,
                              resultType: 'article',
                              articleDraftId: savedId,
                              articlePersonName: articleDraft.personName || articleDraft.title,
                              activated: true,
                            },
                          ]);
                        }
                      } else {
                        console.error('Save failed:', data);
                        alert('Save failed: ' + (data.error || JSON.stringify(data)));
                      }
                    } catch (err) {
                      console.error('Failed to save article:', err);
                      alert('Save failed: ' + err);
                    } finally {
                      setSavingArticle(false);
                    }
                  }}
                  className={`px-4 py-1.5 rounded text-xs font-bold text-white flex items-center gap-1 ${
                    savingArticle 
                      ? 'bg-green-600 animate-pulse cursor-wait' 
                      : !articleDraft.title
                        ? 'bg-gray-600 cursor-not-allowed'
                        : 'bg-[#E36B11] hover:bg-[#c07830]'
                  }`}
                >
                  {savingArticle ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check size={12} /> Save
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Picker Modal */}
      {showImagePicker && articleDraft && (
        <ImagePickerModal
          isOpen={showImagePicker}
          onClose={() => setShowImagePicker(false)}
          onSelect={(url) => {
            setArticleDraft({ ...articleDraft, coverImage: url });
            setShowImagePicker(false);
          }}
          currentImage={articleDraft.coverImage}
          searchTerm={articleDraft.personName}
        />
      )}

      {/* Reporter Edit Modal */}
      {editingReporter && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80">
          <div className="bg-gray-800 rounded-xl w-full max-w-lg">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Pencil size={14} className="text-[#E36B11]" />
                Edit Reporter: {editingReporter.name}
              </h3>
              <button onClick={() => setEditingReporter(null)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Name (read-only for now) */}
              <div>
                <label className="block text-[10px] text-gray-400 mb-1 uppercase">Name</label>
                <input
                  type="text"
                  value={editingReporter.name}
                  disabled
                  className="w-full bg-gray-700/50 border border-gray-600 px-3 py-2 rounded text-sm text-gray-400"
                />
              </div>

              {/* Region */}
              <div>
                <label className="block text-[10px] text-gray-400 mb-1 uppercase">Region</label>
                <select
                  value={editingReporter.region}
                  onChange={e => setEditingReporter({ ...editingReporter, region: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 px-3 py-2 rounded text-sm focus:border-[#E36B11] focus:outline-none"
                >
                  {REPORTER_REGIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {/* Writing Style */}
              <div>
                <label className="block text-[10px] text-gray-400 mb-1 uppercase">Writing Style</label>
                <select
                  value={editingReporter.writingStyle}
                  onChange={e => setEditingReporter({ ...editingReporter, writingStyle: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 px-3 py-2 rounded text-sm focus:border-[#E36B11] focus:outline-none"
                >
                  <option value="">— Select Style —</option>
                  <option value="nick-hornby">Nick Hornby (conversational, witty)</option>
                  <option value="hunter-s-thompson">Hunter S. Thompson (gonzo, intense)</option>
                  <option value="nora-ephron">Nora Ephron (warm, observant)</option>
                  <option value="charles-bukowski">Charles Bukowski (raw, direct)</option>
                  <option value="murakami">Haruki Murakami (dreamy, surreal)</option>
                  <option value="irvine-welsh">Irvine Welsh (gritty, energetic)</option>
                  <option value="joan-didion">Joan Didion (precise, cool)</option>
                  <option value="david-sedaris">David Sedaris (humorous, self-deprecating)</option>
                  <option value="tom-wolfe">Tom Wolfe (flamboyant, detailed)</option>
                  <option value="zadie-smith">Zadie Smith (sharp, multicultural)</option>
                  <option value="slavenka-drakulic">Slavenka Drakulić (political, Eastern European)</option>
                  <option value="benjamin-stuckrad-barre">Benjamin v. Stuckrad-Barre (pop culture, ironic)</option>
                  <option value="bret-easton-ellis">Bret Easton Ellis (detached, satirical)</option>
                  <option value="chuck-palahniuk">Chuck Palahniuk (dark, transgressive)</option>
                  <option value="douglas-coupland">Douglas Coupland (GenX voice, observational)</option>
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setEditingReporter(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={saveReporterEdit}
                disabled={savingReporter}
                className="px-4 py-2 bg-[#E36B11] hover:bg-[#c07830] rounded text-xs font-bold text-white flex items-center gap-1 disabled:opacity-50"
              >
                {savingReporter ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rankroll Editor Modal */}
      {selectedRankrollTab && (() => {
        const rankroll = createdRankrolls.find(r => r.id === selectedRankrollTab);
        if (!rankroll) return null;
        return (
          <div className="fixed inset-0 z-[60] bg-black/90">
            <div className="bg-gray-800 w-full h-full overflow-y-auto">
              {/* Header */}
              <div className="px-4 py-2.5 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800 z-10">
                <h3 className="text-sm font-bold">🏆 {rankroll.title}</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if (savingRankroll) return;
                      setSavingRankroll(true);
                      try {
                        const res = await fetch('/api/polls', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            title: rankroll.title,
                            subtitle: rankroll.subtitle,
                            type: 'ranking',
                            items: rankroll.items,
                            category: 'ranking',
                            status: 'inactive',
                          }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          setCreatedRankrolls(prev => prev.filter(r => r.id !== rankroll.id));
                          setSelectedRankrollTab(null);
                          alert('Ranking saved!');
                        } else {
                          alert('Save failed: ' + (data.error || 'Unknown error'));
                        }
                      } catch (err) {
                        alert('Save failed: ' + err);
                      } finally {
                        setSavingRankroll(false);
                      }
                    }}
                    disabled={savingRankroll}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-xs font-bold text-white flex items-center gap-1 disabled:opacity-50"
                  >
                    {savingRankroll ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    Save Ranking
                  </button>
                  <button onClick={() => setSelectedRankrollTab(null)} className="text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-4">
                <p className="text-sm text-gray-400 mb-4">{rankroll.subtitle}</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {rankroll.items.map((item, idx) => (
                    <div key={item.id} className="bg-gray-700 rounded-lg overflow-hidden">
                      {item.image && (
                        <img src={item.image} alt={item.title} className="w-full h-24 object-cover" />
                      )}
                      <div className="p-2">
                        <span className="text-[10px] text-purple-400 font-bold">#{idx + 1}</span>
                        <p className="text-xs font-medium text-white line-clamp-2">{item.title}</p>
                        {item.description && (
                          <p className="text-[10px] text-gray-400 line-clamp-2 mt-1">{item.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Full RankrollTab Editor Modal (from proposal selection) */}
      {rankrollEditorData && (
        <div className="fixed inset-0 z-[70] bg-black/95">
          <RankrollTab
            hideListView={true}
            initialNewTitle={rankrollEditorData.title}
            initialNewDescription={rankrollEditorData.description}
            initialNewItems={rankrollEditorData.items}
            initialNewCategory={rankrollEditorData.category}
            onProposalHandled={() => setRankrollEditorData(null)}
          />
        </div>
      )}

      {/* History Banner Preview Modal */}
      {showHistoryBannerModal && historyBanner && (
        <div 
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowHistoryBannerModal(false)}
        >
          <div 
            className="relative max-w-5xl w-full bg-gray-900 rounded-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">History Banner Preview</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setHistoryBanner(null);
                    setHistoryHeadline(null);
                    setShowHistoryBannerModal(false);
                  }}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-xs font-bold text-white"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowHistoryBannerModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            {/* Headline */}
            {historyHeadline && (
              <div className="px-4 pt-4">
                <h2 className="text-xl font-bold text-white">{historyHeadline}</h2>
              </div>
            )}
            
            {/* Banner Image */}
            <div className="p-4">
              <img 
                src={historyBanner} 
                alt="History Banner" 
                className="w-full h-auto rounded-lg"
              />
            </div>
            
            {/* Footer with info */}
            <div className="px-4 py-3 border-t border-gray-700 bg-gray-800/50">
              <p className="text-xs text-gray-400">
                Headline and banner will be used for the History article.
                Click "Regenerate Banner" to create new ones.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
