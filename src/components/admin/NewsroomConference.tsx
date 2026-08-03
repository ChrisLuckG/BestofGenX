"use client";

import { useState, useEffect, useRef } from "react";
import { 
  X, Send, Loader2, ListOrdered, FileText, Tv, Radio, Plus, Check, ChevronDown, 
  CheckCircle, AlertCircle, Users, Sparkles, ExternalLink, User, Eye, Pencil, Save,
  RefreshCw, Trash2, Calendar
} from "lucide-react";
import BlockEditor from "@/components/admin/BlockEditor";
import ImagePickerModal from "@/components/admin/ImagePickerModal";
import CountryFlag from "@/components/CountryFlag";

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
  menschenSaved?: boolean;
}

interface Piece {
  id: string;
  type: 'article' | 'rankroll' | 'tv' | 'radio';
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
                ? 'bg-[#D4873A] text-black' 
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
          className="px-4 py-1.5 bg-[#D4873A] hover:bg-[#c07830] rounded text-xs font-bold text-white disabled:opacity-50"
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
  
  // Global search filters
  const [globalCategory, setGlobalCategory] = useState<string>('');
  const [globalCountry, setGlobalCountry] = useState<string>('');
  const [rankrollInput, setRankrollInput] = useState<string>(''); // Free text for Rank template
  
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
  }>>([]);
  const [selectedArticleTab, setSelectedArticleTab] = useState<string | null>(null);
  const [selectingProposal, setSelectingProposal] = useState<string | null>(null); // Track which proposal is being selected
  const [retryingReporter, setRetryingReporter] = useState<string | null>(null); // Track which reporter is retrying
  const [savingArticle, setSavingArticle] = useState(false); // Track article save
  
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

  // Create a new piece
  function createPiece(typeId: string) {
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
    const categoryMatch = text.match(/CATEGORY:\s*(.+)/i);
    const descMatch = text.match(/DESCRIPTION:\s*([\s\S]+?)(?=\n(?:NAME|BORN|DIED|CAUSE|COUNTRY|CATEGORY):|$)/i);
    
    let name = nameMatch ? nameMatch[1].trim().split('\n')[0] : 'Unknown';
    const birthday = bornMatch ? bornMatch[1].trim() : '';
    const deathday = diedMatch ? diedMatch[1].trim() : undefined;
    const causeOfDeath = causeMatch ? causeMatch[1].trim().split('\n')[0] : undefined;
    const country = countryMatch ? countryMatch[1].trim().split('\n')[0] : '';
    const rawCategory = categoryMatch ? categoryMatch[1].trim().toLowerCase().split('\n')[0] : '';
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
    
    // Validate GenX
    let isValid = name !== 'Unknown' && birthday;
    let errorReason = '';
    if (noCategoryMatch) {
      errorReason = `No ${category || 'matching'} people in today's Wikipedia list. Try a different category.`;
    } else if (!isValid) {
      errorReason = 'Could not find anyone for this date';
    } else if (!isEvent && birthday) {
      const yearMatch = birthday.match(/(\d{4})/);
      if (yearMatch) {
        const year = parseInt(yearMatch[1]);
        if (year < 1965) { isValid = false; errorReason = `Born ${year} - too old for GenX (need 1965-1980)`; }
        else if (year > 1980) { isValid = false; errorReason = `Born ${year} - too young for GenX (need 1965-1980)`; }
      }
    }
    
    return {
      name,
      birthday,
      deathday,
      causeOfDeath,
      country,
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
    if (!messageText.trim() || !currentPiece) return;

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
        // Process reporters sequentially like Article flow
        const rankrollProposals: Proposal[] = [];
        
        for (const reporter of targetReporters) {
          setTyping(reporter.name);
          
          const res = await fetch('/api/editorial/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reporterUserId: reporter.id,
              message: `Propose a CREATIVE rankroll about: ${topic}

Be creative like Ranker or Buzzfeed! Don't just do the obvious.
For Mike Tyson: NOT just "knockouts" - think "Craziest Moments", "Best Trash Talk", "Wildest Press Conferences"
For De Niro: NOT just "best movies" - think "Most Underrated Roles", "Scariest Characters", "Funniest Moments"

Reply in this format:
TITLE: [creative headline with number, e.g. "8 Times Mike Tyson Was Absolutely Unhinged"]
ITEMS: [comma-separated list of the actual items you'd rank, e.g. "Ear Bite vs Holyfield, Face Tattoo Reveal, Pigeon Obsession Interview, ..."]
DESCRIPTION: [1-2 sentences teaser]`,
              userId,
              proposalOnly: true,
              contentType: 'rankroll',
            }),
          });
          const data = await res.json();
          const text = data.response || '';
          
          // Parse response - title, items, and description
          const titleMatch = text.match(/TITLE:\s*(.+)/i);
          const itemsMatch = text.match(/ITEMS:\s*(.+)/i);
          const descMatch = text.match(/DESCRIPTION:\s*(.+)/i);
          
          const title = titleMatch ? titleMatch[1].trim() : `Top 10 ${topic}`;
          const itemsRaw = itemsMatch ? itemsMatch[1].trim() : '';
          const items = itemsRaw.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
          const description = descMatch ? descMatch[1].trim().replace(/\n/g, ' ').slice(0, 200) : '';
          
          rankrollProposals.push({
            name: title,
            birthday: itemsRaw.slice(0, 100) + (itemsRaw.length > 100 ? '...' : ''), // Show items preview
            country: `${items.length} items`,
            profession: '',
            description,
            reporterId: reporter.id,
            reporterName: reporter.name,
            isError: items.length < 3,
            errorReason: items.length < 3 ? 'Not enough items' : undefined,
          });
        }
        
        setTyping(false);
        
        // Add proposals as cards
        updatePieceMessages(currentPiece.id, msgs => [
          ...msgs,
          {
            id: generateId(),
            from: 'proposals' as const,
            text: `${rankrollProposals.length} rankroll proposals`,
            proposals: rankrollProposals,
          },
        ]);
        
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
      lowerMsg.includes('series finale') ||
      lowerMsg.includes('oscar win') ||
      lowerMsg.includes('album release') ||
      lowerMsg.includes('game release')
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
      
      // Birthday request - find someone BORN on this day
      const categoryRequirement = globalCategory 
        ? `\n\n🚫🚫🚫 MANDATORY CATEGORY FILTER: ${globalCategory.toUpperCase()} 🚫🚫🚫\nYou MUST find someone in the ${globalCategory} category. NO sports people if politics is selected. NO actors if politics is selected. ONLY ${globalCategory}!\nIf you suggest someone outside ${globalCategory}, your response will be REJECTED.\n\n⚠️ CHECK THE "Categories available" LINE IN YOUR CONTEXT! If ${globalCategory} shows 0 or is not listed, respond with:\nNAME: NO_CATEGORY_MATCH\nBORN: ${dayMonth}.0000\nCOUNTRY: N/A\nCATEGORY: ${globalCategory}\nDESCRIPTION: No ${globalCategory} people found in today's Wikipedia birthday list. Try a different category.`
        : '';
      
      return `Find a GenX celebrity (born 1965-1980) who was ACTUALLY born on ${dayMonth}.
${categoryRequirement}

LOOK AT THE BIRTHDAYS TODAY LIST IN YOUR CONTEXT FIRST - these are VERIFIED birthdays.
Check the "Categories available" line to see what categories have people today.
${countryName ? `Filter for someone from ${countryName} if available in the list.` : ''}

⚠️ CRITICAL: Only suggest someone if you are 100% CERTAIN of their birthday. Do NOT guess or invent birthdays!
If the requested category has 0 people, use the NO_CATEGORY_MATCH format above.

Reply EXACTLY in this format:
NAME: [full name]
BORN: ${dayMonth}.[year between 1965-1980]
COUNTRY: [their country]
CATEGORY: [must be: ${globalCategory || 'sports, music, movies-tv, gaming, politics, tech, culture, lifestyle'}]
DESCRIPTION: [1 sentence about them]`;
    };

    try {
      // Process reporters ONE BY ONE (sequential, not parallel)
      const results: { reporter: typeof targetReporters[0]; response: string; success: boolean }[] = [];
      const alreadyProposed: string[] = []; // Track names to avoid duplicates
      
      for (let i = 0; i < targetReporters.length; i++) {
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
        } else if (proposal.name && proposal.name !== 'Unknown') {
          // Track this name to avoid duplicates in next reporters
          alreadyProposed.push(proposal.name);
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
      
      // Parse structured format: NAME: / BORN: / DIED: / CAUSE: / COUNTRY: / DESCRIPTION:
      const nameMatch = text.match(/NAME:\s*(.+)/i);
      const bornMatch = text.match(/BORN:\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
      const diedMatch = text.match(/DIED:\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
      const causeMatch = text.match(/CAUSE:\s*(.+)/i);
      const countryMatch = text.match(/COUNTRY:\s*(.+)/i);
      const descMatch = text.match(/DESCRIPTION:\s*([\s\S]+?)(?=\n(?:NAME|BORN|DIED|CAUSE|COUNTRY):|$)/i);
      
      // Fallback to legacy parsing if structured format not found
      let name = nameMatch ? nameMatch[1].trim() : 'Unknown';
      let birthday = bornMatch ? bornMatch[1].trim() : '';
      const deathday = diedMatch ? diedMatch[1].trim() : undefined;
      const causeOfDeath = causeMatch ? causeMatch[1].trim().split('\n')[0].trim() : undefined;
      let country = countryMatch ? countryMatch[1].trim().split('\n')[0].trim() : '';
      let description = descMatch ? descMatch[1].trim().slice(0, 300) : '';
      
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
    
    // For RANKROLL: generate the full ranking with items + images, then show as tab
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
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0);
        
        if (itemTitles.length < 3) {
          throw new Error('Not enough items in proposal');
        }
        
        // Get Tenor GIFs for each item
        const itemsWithImages = await Promise.all(
          itemTitles.map(async (title: string, idx: number) => {
            try {
              const gifRes = await fetch(`/api/tenor-search?q=${encodeURIComponent(title)}`);
              const gifData = await gifRes.json();
              return {
                id: `item_${idx + 1}`,
                title,
                description: '',
                image: gifData.success ? gifData.url : '',
                upvotes: 0,
                downvotes: 0,
                score: 0,
              };
            } catch {
              return { id: `item_${idx + 1}`, title, description: '', image: '', upvotes: 0, downvotes: 0, score: 0 };
            }
          })
        );
        
        setTyping(false);
        setSelectingProposal(null);
        
        // Add as tab (like articles)
        const newRankrollId = generateId();
        const newRankroll = {
          id: newRankrollId,
          title: proposal.name,
          subtitle: proposal.description,
          items: itemsWithImages,
          category: 'ranking',
          reporterName: proposal.reporterName,
          reporterId: proposal.reporterId,
        };
        
        setCreatedRankrolls(prev => [...prev, newRankroll]);
        setSelectedRankrollTab(newRankrollId);
        
        // Add success message
        updatePieceMessages(currentPiece.id, msgs => [
          ...msgs,
          { 
            id: generateId(), 
            from: 'result', 
            text: `✅ Ranking "${proposal.name}" created with ${itemsWithImages.length} items`,
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
      });
      const data = await res.json();
      setTyping(false);

      if (data.success && data.articleData) {
        // Article content ready - add to tabs (NOT saved yet)
        // For RIP articles, use 'rip' category
        const articleCategory = proposal.isRIP ? 'rip' : (data.articleData.category || 'culture');
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
        // Add to tabs
        setCreatedArticles(prev => [...prev, {
          id: newArticleId,
          title: data.articleData.title || proposal.name,
          reporterName: proposal.reporterName,
          draft: newDraft,
        }]);
        // Show message that article is ready for review
        updatePieceMessages(currentPiece.id, msgs => [
          ...msgs,
          {
            id: generateId(),
            from: 'system',
            text: `✅ Article "${data.articleData.title}" created. Click tab below to review.`,
          },
        ]);
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
    } catch (err) {
      setTyping(false);
      updatePieceMessages(currentPiece.id, msgs => [
        ...msgs,
        { id: generateId(), from: 'system', text: 'Error creating article. Please try again.' },
      ]);
    } finally {
      setSelectingProposal(null); // Clear loading state
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
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
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
                    onClick={() => setSelectedTemplate(selectedTemplate === t.id ? null : t.id)}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                      selectedTemplate === t.id 
                        ? 'bg-[#D4873A] text-black' 
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
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-[10px] text-gray-300 focus:border-[#D4873A] focus:outline-none"
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
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-[10px] text-gray-300 focus:border-[#D4873A] focus:outline-none"
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
              {selectedTemplate && selectedTemplate !== 'rank' && (
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
                  className="flex-1 bg-gray-700 px-3 py-2 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#D4873A]"
                />
                <button
                  onClick={() => {
                    if (rankrollInput.trim() && !typing) {
                      sendMessage(`Propose a rankroll about: ${rankrollInput.trim()}`);
                    }
                  }}
                  disabled={!!typing || !rankrollInput.trim()}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold shrink-0 disabled:opacity-50 ${theme.sendBtn}`}
                >
                  {typing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Send
                </button>
              </div>
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
                                  ? "bg-gray-900 border border-gray-700 hover:border-[#D4873A]"
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
                                <div className="text-xs text-gray-300 mb-1 line-clamp-1">{proposal.name}</div>
                              )}
                              {proposal.birthday && (
                                <div className="text-[9px] text-gray-500 mb-1">📅 {proposal.birthday}</div>
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
                            /* Found state - compact layout */
                            <>
                              {/* Line 1: Finding Name + Birthday + Flag */}
                              <div className="flex items-center gap-1.5 text-[11px] text-gray-300 mb-1">
                                <span className="font-semibold text-white">{proposal.name}</span>
                                <span className="text-gray-500">·</span>
                                <span className="text-gray-400">{proposal.birthday}</span>
                                {proposal.country && (
                                  <CountryFlag 
                                    flag={
                                      proposal.country === 'Canada' ? 'CA' : 
                                      proposal.country === 'USA' || proposal.country === 'United States' ? 'US' :
                                      proposal.country === 'UK' || proposal.country === 'United Kingdom' ? 'GB' :
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
                                      'US'
                                    } 
                                    className="w-4 h-3 rounded-[1px]"
                                  />
                                )}
                              </div>
                              <p className="text-[9px] text-gray-500 flex-1 line-clamp-2 mb-1">{proposal.description}</p>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => selectProposal(proposal)}
                                  disabled={!!selectingProposal}
                                  className={`flex-1 py-1 rounded text-[10px] font-bold text-white flex items-center justify-center gap-1 ${
                                    selectingProposal === proposal.reporterId
                                      ? 'bg-green-600 animate-pulse'
                                      : selectingProposal
                                        ? 'bg-gray-600 cursor-not-allowed'
                                        : 'bg-[#D4873A] hover:bg-[#c07830]'
                                  }`}
                                >
                                  {selectingProposal === proposal.reporterId ? (
                                    <>
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      Writing...
                                    </>
                                  ) : (
                                    'Select'
                                  )}
                                </button>
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
                          className="shrink-0 px-3 py-1 rounded text-xs font-bold bg-[#D4873A] hover:bg-[#c07830] text-white flex items-center gap-1"
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
                <div className="text-center text-gray-500">
                  <p className="mb-2">No active piece.</p>
                  <button
                    onClick={() => createPiece('article')}
                    className={`px-4 py-2 rounded text-sm font-semibold ${theme.sendBtn}`}
                  >
                    Start a new Article
                  </button>
                </div>
              </div>
            )}


          </div>
        </div>
      </div>

      {/* Created Articles & Rankrolls Tabs - shown below chat */}
      {(createdArticles.length > 0 || createdRankrolls.length > 0) && (
        <div className="fixed bottom-0 left-0 right-0 z-[55] bg-gray-900 border-t border-gray-700">
          <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto">
            {createdArticles.length > 0 && (
              <>
                <span className="text-[10px] text-gray-500 mr-2">Articles:</span>
                {createdArticles.map(article => (
                  <button
                    key={article.id}
                    onClick={() => {
                      setArticleDraft(article.draft);
                      setSelectedArticleTab(article.id);
                      setSelectedRankrollTab(null);
                    }}
                    className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-all ${
                      selectedArticleTab === article.id 
                        ? 'bg-[#D4873A] text-white' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    📝 {article.title.slice(0, 25)}{article.title.length > 25 ? '...' : ''}
                  </button>
                ))}
              </>
            )}
            {createdRankrolls.length > 0 && (
              <>
                <span className="text-[10px] text-gray-500 mx-2">Rankings:</span>
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
              </>
            )}
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
                    className="aspect-[16/10] bg-gray-700 rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#D4873A] transition-all"
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
                        <span key={i} className="px-2 py-0.5 bg-[#D4873A]/20 text-[#D4873A] rounded text-[10px] flex items-center gap-1">
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
                      console.log('Saving article:', articleDraft.title);
                      // Always POST to create new article (skipSave means it wasn't saved before)
                      const res = await fetch('/api/articles', {
                        method: 'POST',
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
                        }),
                      });
                      const data = await res.json();
                      console.log('Save response:', data);
                      if (data.success || data._id || data.article) {
                        const savedId = data._id || data.article?._id;
                        // Remove from tabs
                        setCreatedArticles(prev => prev.filter(a => a.draft?.title !== articleDraft.title));
                        setSelectedArticleTab(null);
                        setArticleDraft(null);
                        if (currentPiece) {
                          updatePieceMessages(currentPiece.id, msgs => [
                            ...msgs,
                            {
                              id: generateId(),
                              from: 'result',
                              text: `✅ Article "${articleDraft.title}" saved to Articles.`,
                              resultType: 'article',
                              articleDraftId: savedId,
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
                        : 'bg-[#D4873A] hover:bg-[#c07830]'
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
                <Pencil size={14} className="text-[#D4873A]" />
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
                  className="w-full bg-gray-700 border border-gray-600 px-3 py-2 rounded text-sm focus:border-[#D4873A] focus:outline-none"
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
                  className="w-full bg-gray-700 border border-gray-600 px-3 py-2 rounded text-sm focus:border-[#D4873A] focus:outline-none"
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
                className="px-4 py-2 bg-[#D4873A] hover:bg-[#c07830] rounded text-xs font-bold text-white flex items-center gap-1 disabled:opacity-50"
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
    </div>
  );
}
