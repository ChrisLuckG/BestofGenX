"use client";

import { useState, useEffect, useRef } from "react";
import { 
  X, Send, Loader2, ListOrdered, FileText, Tv, Radio, Plus, Check, ChevronDown, 
  CheckCircle, AlertCircle, Users, Sparkles, ExternalLink, User, Eye
} from "lucide-react";
import BlockEditor from "@/components/admin/BlockEditor";
import ImagePickerModal from "@/components/admin/ImagePickerModal";

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
  category?: string; // sports, music, movies-tv, etc.
  isRIP?: boolean; // True if this is a death anniversary, not birthday
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
  { id: 'birthday', label: '🎂 Birthday', prompt: 'Birthday — find GenX celebrities (born 1965-1980) who were BORN ON THIS DAY and write about their life and achievements' },
  { id: 'movie', label: '🎬 Movie/TV', prompt: 'Movie/TV — write about an iconic 80s/90s movie or TV show, its cast, plot, and cultural impact' },
  { id: 'music', label: '🎵 Music', prompt: 'Music — write about a classic song, album, or artist from the GenX era' },
  { id: 'sport', label: '⚽ Sport', prompt: 'Sport — write about a legendary athlete, match, or sports moment from the 80s/90s' },
  { id: 'history', label: '📜 History', prompt: 'History — write about a significant historical event or moment from the GenX era' },
  { id: 'band', label: '💎 Band', prompt: 'Band — write about an iconic band from the 80s/90s, their music, members, and legacy' },
  { id: 'album', label: '💿 Album', prompt: 'Album — write about a classic album, its tracks, production, and cultural significance' },
  { id: 'tvseries', label: '📺 TV Series', prompt: 'TV Series — write about a beloved TV series from the GenX era' },
  { id: 'rip', label: '🕯️ RIP', prompt: 'RIP — find GenX celebrities (born 1965-1980) who DIED ON THIS DAY and write a tribute honoring their life and legacy' },
  { id: 'game', label: '🎮 Game', prompt: 'Game — write about a classic video game from the 80s/90s arcade or console era' },
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
  ];
  const [apiStatus, setApiStatus] = useState<{ status: string; message: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      [activeDept]: prev[activeDept].map(p =>
        p.id === pieceId ? { ...p, messages: updater(p.messages) } : p
      ),
    }));
  }

  // Toggle person in/out of conference
  async function togglePerson(personId: string) {
    const person = roster.find(p => p.id === personId);
    if (!person) return;

    const willActivate = !activeReporters[personId];
    setActiveReporters(prev => ({ ...prev, [personId]: willActivate }));

    if (willActivate && currentPiece) {
      // Check if this reporter already responded in this piece
      const alreadyResponded = messages.some(m => 
        m.from === personId || 
        (m.from === 'proposals' && m.proposals?.some(p => p.reporterId === personId)) ||
        (m.from === 'system' && m.text.includes(person.name))
      );
      
      if (alreadyResponded) {
        // Just show join message, don't auto-prompt again
        updatePieceMessages(currentPiece.id, msgs => [
          ...msgs,
          { id: generateId(), from: 'system', text: `${person.name} rejoined the conference.` },
        ]);
        return;
      }
      
      updatePieceMessages(currentPiece.id, msgs => [
        ...msgs,
        { id: generateId(), from: 'system', text: `${person.name} joined the conference.` },
      ]);

      // Find the last editor message (the topic/prompt)
      const lastEditorMsg = [...messages].reverse().find(m => m.from === 'me');
      if (lastEditorMsg) {
        // Auto-send the topic to the new reporter
        setTyping(person.name);
        const today = new Date();
        const dayMonth = `${today.getDate()}.${(today.getMonth() + 1).toString().padStart(2, '0')}`;
        
        const proposalPrompt = `${lastEditorMsg.text}

TODAY IS ${dayMonth} — find a celebrity born on THIS EXACT DAY (${dayMonth}) in your CONTINENT/REGION.

YOU MUST FIND SOMEONE. There are thousands of celebrities born on every day of the year. Search harder!

RULES:
1. Birth year MUST be 1965-1980 (Generation X). NO exceptions!
2. Search your ENTIRE continent - ALL countries in your region.
3. Include: actors, musicians, athletes, directors, TV hosts, comedians, models, authors, politicians, business leaders, etc.
4. If you can't find someone famous, find someone notable in sports, music, or entertainment.
5. DO NOT say "I couldn't find anyone" - there is ALWAYS someone. Search Wikipedia, IMDB, sports databases.

Format EXACTLY like this:
**Name** (DD.MM.YYYY) - Country - 2-3 sentences about why they matter to GenX and their achievements.

DO NOT write the article yet, just the proposal.`;

        try {
          const res = await fetch('/api/editorial/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reporterUserId: personId,
              message: proposalPrompt,
              userId,
            }),
          });
          const data = await res.json();
          setTyping(false);

          const text = data.response || '';
          
          // Parse the response
          const dateMatch = text.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
          const birthday = dateMatch ? dateMatch[1] : '';
          
          let name = 'Unknown';
          const boldNameMatch = text.match(/\*\*([A-ZÀ-Ž][a-zà-ž']+(?:[-\s]+[A-ZÀ-Ž]?[a-zà-ž']+)*)\*\*/);
          if (boldNameMatch) {
            name = boldNameMatch[1].trim();
          } else {
            const anyNameDate = text.match(/([A-ZÀ-Ž][a-zà-ž']+(?:\s+[A-ZÀ-Ž][a-zà-ž']+)+)\s*\(\d{1,2}\.\d{1,2}\.\d{4}\)/);
            if (anyNameDate) name = anyNameDate[1].trim();
          }

          const country = person.regionLabel || '';
          const description = text.replace(/\*\*/g, '').slice(0, 250);

          // Check if valid GenX (1965-1980) and not rejected
          let isValidGenX = name !== 'Unknown' && birthday;
          if (isValidGenX) {
            const yearMatch = birthday.match(/(\d{4})/);
            if (yearMatch) {
              const year = parseInt(yearMatch[1]);
              if (year < 1965 || year > 1980) isValidGenX = false;
            }
            if (description.toLowerCase().includes('outside')) isValidGenX = false;
            if (description.toLowerCase().includes('not genx')) isValidGenX = false;
            if (description.toLowerCase().includes('baby boomer')) isValidGenX = false;
          }

          if (isValidGenX) {
            updatePieceMessages(currentPiece.id, msgs => [
              ...msgs,
              {
                id: generateId(),
                from: 'proposals',
                text: '1 new proposal',
                proposals: [{
                  name,
                  birthday,
                  country,
                  profession: '',
                  description,
                  reporterId: personId,
                  reporterName: person.name,
                }],
              },
            ]);
          } else {
            updatePieceMessages(currentPiece.id, msgs => [
              ...msgs,
              { id: generateId(), from: 'system', text: `${person.name} couldn't find a GenX person for today.` },
            ]);
          }
        } catch (err) {
          setTyping(false);
        }
      }
    }
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

  // Send a message - asks ALL active reporters in parallel (or specific one if @mentioned)
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

    // Build the prompt - ask for ONE proposal from their region, no article yet
    // Each reporter will get their region injected + TODAY'S DATE from the chat API
    const today = new Date();
    const dayMonth = `${today.getDate()}.${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    
    // Detect if this is a RIP request (death anniversary) vs Birthday
    const isRIPRequest = actualMessage.toLowerCase().includes('rip') || 
                         actualMessage.toLowerCase().includes('died') || 
                         actualMessage.toLowerCase().includes('death') ||
                         actualMessage.toLowerCase().includes('todestag');
    
    // Simple prompt - the system prompt already has birthday data from Wikipedia
    const getProposalPrompt = (reporter: typeof activePeople[0], index: number) => {
      const manualCategory = reporterCategories[reporter.id];
      
      // Map reporter specialty to category
      const specialty = (reporter.specialty || '').toLowerCase();
      let autoCategory = 'movies-tv';
      if (specialty.includes('sport') || specialty.includes('boxing') || specialty.includes('football') || specialty.includes('rugby')) {
        autoCategory = 'sports';
      } else if (specialty.includes('music') || specialty.includes('gaming') || specialty.includes('indie')) {
        autoCategory = 'music';
      } else if (specialty.includes('rip') || specialty.includes('celebrit') || specialty.includes('movie') || specialty.includes('tv')) {
        autoCategory = 'movies-tv';
      } else if (specialty.includes('politic') || specialty.includes('history')) {
        autoCategory = 'politics';
      } else if (specialty.includes('tech') || specialty.includes('anime')) {
        autoCategory = 'tech';
      } else if (specialty.includes('lifestyle') || specialty.includes('travel') || specialty.includes('food') || specialty.includes('culture')) {
        autoCategory = 'lifestyle';
      }
      
      const category = manualCategory || autoCategory;
      const categoryLabel = category === 'sports' ? 'an athlete' 
        : category === 'music' ? 'a musician'
        : category === 'movies-tv' ? 'an actor/TV personality'
        : category === 'politics' ? 'a politician'
        : category === 'tech' ? 'a tech figure'
        : 'a notable person (author, chef, entrepreneur)';
      
      if (isRIPRequest) {
        // RIP request - find someone who DIED on this day
        return `Using your own knowledge, find ${categoryLabel} from Generation X (born 1965-1980) who DIED on ${dayMonth} (any year).
IMPORTANT: They must be DEAD. Find someone who passed away on this exact date (${dayMonth}).

Reply in EXACTLY this format:
NAME: [full name]
BORN: [DD.MM.YYYY]
DIED: ${dayMonth}.[YYYY]
CAUSE: [cause of death - e.g. cancer, car accident, heart attack]
COUNTRY: [country]
DESCRIPTION: [1-2 sentences about their life and legacy]`;
      }
      
      // Birthday request - find someone BORN on this day
      return `Using your own knowledge, find ${categoryLabel} born on ${dayMonth} (any year 1965-1980, Generation X).

Reply in EXACTLY this format:
NAME: [name]
BORN: ${dayMonth}.[YYYY]
COUNTRY: [country]
DESCRIPTION: [1-2 sentences]`;
    };

    try {
      // Ask target reporters in parallel (all active, or just the @mentioned one)
      const results = await Promise.all(
        targetReporters.map(async (reporter, index) => {
          const res = await fetch('/api/editorial/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reporterUserId: reporter.id,
              message: getProposalPrompt(reporter, index),
              userId,
              proposalOnly: true, // Don't auto-create articles from this response
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

      // Parse each response into a Proposal card
      const proposals: Proposal[] = [];
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const text = result.response;
        // Calculate the category that was assigned to this reporter (same logic as prompt)
        const specialty = (result.reporter.specialty || '').toLowerCase();
        let autoCategory = 'movies-tv';
        if (specialty.includes('sport') || specialty.includes('boxing') || specialty.includes('football') || specialty.includes('mma')) {
          autoCategory = 'sports';
        } else if (specialty.includes('music') || specialty.includes('gaming') || specialty.includes('indie')) {
          autoCategory = 'music';
        } else if (specialty.includes('rip') || specialty.includes('celebrit') || specialty.includes('movie') || specialty.includes('tv')) {
          autoCategory = 'movies-tv';
        } else if (specialty.includes('politic') || specialty.includes('history')) {
          autoCategory = 'politics';
        } else if (specialty.includes('tech') || specialty.includes('anime')) {
          autoCategory = 'tech';
        } else if (specialty.includes('lifestyle') || specialty.includes('travel') || specialty.includes('food') || specialty.includes('culture') || specialty.includes('society')) {
          autoCategory = 'lifestyle';
        }
        const assignedCategory = reporterCategories[result.reporter.id] || autoCategory;
        console.log(`[${result.reporter.name}] (${assignedCategory}) Response:`, text);
        
        // Parse structured format: NAME: / BORN: / DIED: / CAUSE: / COUNTRY: / DESCRIPTION:
        const nameMatch = text.match(/NAME:\s*(.+)/i);
        const bornMatch = text.match(/BORN:\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
        const diedMatch = text.match(/DIED:\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
        const causeMatch = text.match(/CAUSE:\s*(.+)/i);
        const countryMatch = text.match(/COUNTRY:\s*(.+)/i);
        const descMatch = text.match(/DESCRIPTION:\s*([\s\S]+?)(?=\n(?:NAME|BORN|DIED|CAUSE|COUNTRY|CATEGORY):|$)/i);
        
        const name = nameMatch ? nameMatch[1].trim() : 'Unknown';
        const birthday = bornMatch ? bornMatch[1].trim() : '';
        const deathday = diedMatch ? diedMatch[1].trim() : undefined;
        const causeOfDeath = causeMatch ? causeMatch[1].trim().split('\n')[0].trim() : undefined;
        const country = countryMatch ? countryMatch[1].trim().split('\n')[0].trim() : '';
        let description = descMatch ? descMatch[1].trim() : '';
        
        // Clean description
        description = description.slice(0, 300);
        
        proposals.push({
          name,
          birthday,
          deathday,
          causeOfDeath,
          country,
          profession: '',
          description,
          reporterId: result.reporter.id,
          reporterName: result.reporter.name,
          category: assignedCategory,
          isRIP: !!deathday, // Mark as RIP if we have a death date
        });
      }

      // Filter out empty/failed proposals and non-GenX
      const validProposals = proposals.filter(p => {
        // Must have name and birthday
        if (p.name === 'Unknown' || !p.birthday) return false;
        
        // Check if description says "outside" GenX range
        if (p.description.toLowerCase().includes('outside')) return false;
        if (p.description.toLowerCase().includes('not genx')) return false;
        if (p.description.toLowerCase().includes('baby boomer')) return false;
        
        // Check birth year is GenX (1965-1980)
        const yearMatch = p.birthday.match(/(\d{4})/);
        if (yearMatch) {
          const year = parseInt(yearMatch[1]);
          if (year < 1965 || year > 1980) return false;
        }
        
        return true;
      });
      const failedCount = proposals.length - validProposals.length;
      
      // Only show proposals if we have any valid ones
      if (validProposals.length > 0) {
        updatePieceMessages(currentPiece.id, msgs => [
          ...msgs,
          {
            id: generateId(),
            from: 'proposals',
            text: failedCount > 0 
              ? `${validProposals.length} proposals received (${failedCount} reporter(s) found no one)`
              : `${validProposals.length} proposals received`,
            proposals: validProposals,
          },
        ]);
      } else {
        // No valid proposals - show message
        updatePieceMessages(currentPiece.id, msgs => [
          ...msgs,
          { id: generateId(), from: 'system', text: `No valid GenX proposals found. Try asking for "Another" or add more reporters.` },
        ]);
      }

    } catch (err) {
      setTyping(false);
      updatePieceMessages(currentPiece.id, msgs => [
        ...msgs,
        { id: generateId(), from: 'system', text: 'Connection error. Please try again.' },
      ]);
    }
  }

  // Ask a specific reporter for another suggestion
  async function askForAnother(reporterId: string, reporterName: string) {
    if (!currentPiece) return;

    const today = new Date();
    const dayMonth = `${today.getDate()}.${(today.getMonth() + 1).toString().padStart(2, '0')}`;

    updatePieceMessages(currentPiece.id, msgs => [
      ...msgs,
      { id: generateId(), from: 'me', name: 'Editor', text: `${reporterName}, give me a different person from your region.` },
    ]);

    setTyping(reporterName);

    try {
      const res = await fetch('/api/editorial/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterUserId: reporterId,
          message: `Give me a DIFFERENT celebrity from your CONTINENT/REGION born on ${dayMonth}. Not the same one as before!

YOU MUST FIND SOMEONE DIFFERENT. Search harder - actors, musicians, athletes, directors, TV hosts, comedians, models, authors, politicians, business leaders.

Birth year MUST be 1965-1980 (GenX). Search ALL countries in your continent.

Format: **Name** (DD.MM.YYYY) - Country - 2-3 sentences about their achievements.`,
          userId,
        }),
      });
      const data = await res.json();
      setTyping(false);

      const text = data.response || '';
      
      // Parse the response
      const dateMatch = text.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
      const birthday = dateMatch ? dateMatch[1] : '';
      
      let name = 'Unknown';
      const boldNameMatch = text.match(/\*\*([A-ZÀ-Ž][a-zà-ž']+(?:[-\s]+[A-ZÀ-Ž]?[a-zà-ž']+)*)\*\*/);
      if (boldNameMatch) {
        name = boldNameMatch[1].trim();
      } else {
        const anyNameDate = text.match(/([A-ZÀ-Ž][a-zà-ž']+(?:\s+[A-ZÀ-Ž][a-zà-ž']+)+)\s*\(\d{1,2}\.\d{1,2}\.\d{4}\)/);
        if (anyNameDate) name = anyNameDate[1].trim();
      }

      const reporter = activePeople.find(p => p.id === reporterId);
      const country = reporter?.regionLabel || '';
      const description = text.replace(/\*\*/g, '').slice(0, 250);

      // Check if valid GenX (1965-1980) and not rejected
      let isValidGenX = name !== 'Unknown' && birthday;
      if (isValidGenX) {
        const yearMatch = birthday.match(/(\d{4})/);
        if (yearMatch) {
          const year = parseInt(yearMatch[1]);
          if (year < 1965 || year > 1980) isValidGenX = false;
        }
        if (description.toLowerCase().includes('outside')) isValidGenX = false;
        if (description.toLowerCase().includes('not genx')) isValidGenX = false;
        if (description.toLowerCase().includes('baby boomer')) isValidGenX = false;
      }

      if (isValidGenX) {
        // Add as new proposal
        updatePieceMessages(currentPiece.id, msgs => [
          ...msgs,
          {
            id: generateId(),
            from: 'proposals',
            text: '1 new proposal',
            proposals: [{
              name,
              birthday,
              country,
              profession: '',
              description,
              reporterId,
              reporterName,
            }],
          },
        ]);
      } else {
        updatePieceMessages(currentPiece.id, msgs => [
          ...msgs,
          { id: generateId(), from: 'system', text: `${reporterName} couldn't find another person.` },
        ]);
      }
    } catch (err) {
      setTyping(false);
      updatePieceMessages(currentPiece.id, msgs => [
        ...msgs,
        { id: generateId(), from: 'system', text: 'Error. Please try again.' },
      ]);
    }
  }

  // Select a proposal and ask that reporter to write the article - opens editor modal
  async function selectProposal(proposal: Proposal) {
    if (!currentPiece) return;

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
        // Article content ready - open editor for review (NOT saved yet)
        // For RIP articles, use 'rip' category
        const articleCategory = proposal.isRIP ? 'rip' : (data.articleData.category || 'culture');
        setArticleDraft({
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
        });
        // Show message that article is ready for review
        updatePieceMessages(currentPiece.id, msgs => [
          ...msgs,
          {
            id: generateId(),
            from: 'system',
            text: `Article "${data.articleData.title}" ready for review. Edit and Save to add to Articles.`,
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

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-gray-950 shrink-0">
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
          {onClose && (
            <button onClick={onClose} className="text-gray-500 hover:text-white p-1 rounded transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Department tabs */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-800 bg-gray-950 shrink-0">
          <div className="flex gap-1.5">
            {DEPARTMENTS.map(d => (
              <button
                key={d.id}
                onClick={() => setActiveDept(d.id)}
                className={`px-4 py-2 rounded text-sm font-semibold tracking-wide transition-colors ${
                  activeDept === d.id ? DEPT_THEME[d.id].tabActive : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content-type selector + piece tabs */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-gray-800 bg-gray-950 shrink-0 relative z-30">
          {/* Type dropdown - stays outside overflow so it can overlay */}
          <div className="relative shrink-0 z-40">
            <button
              onClick={() => setTypeMenuOpen(v => !v)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded border border-gray-700 bg-gray-900 transition-colors ${theme.hoverBorder}`}
            >
              {(() => {
                const Icon = CONTENT_TYPES.find(c => c.id === (currentPiece?.type || 'article'))?.icon || FileText;
                return <Icon size={15} className={theme.accentText} />;
              })()}
              <span className="text-sm font-semibold">
                {CONTENT_TYPES.find(c => c.id === (currentPiece?.type || 'article'))?.label || 'Article'}
              </span>
              <ChevronDown size={14} className="text-gray-500" />
            </button>
            {typeMenuOpen && (
              <div className="absolute top-full left-0 z-50 mt-1 w-52 bg-gray-900 border border-gray-700 rounded shadow-xl overflow-hidden">
                {CONTENT_TYPES.map(c => {
                  const Icon = c.icon;
                  const isCurrent = currentPiece?.type === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => createPiece(c.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-800 text-left"
                    >
                      <Icon size={14} className={isCurrent ? theme.accentText : "text-gray-500"} />
                      <span>New {c.label}</span>
                      {isCurrent && <Check size={13} className={`ml-auto ${theme.accentText}`} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-gray-800 shrink-0 mx-1" />

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
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Roster panel */}
          <div className="w-64 border-r border-gray-800 bg-gray-950 overflow-y-auto p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between px-1 mb-1">
              <div className="text-[10px] uppercase tracking-widest text-gray-500 font-mono">
                {DEPARTMENTS.find(d => d.id === activeDept)?.label} roster
              </div>
              {activeDept === 'authors' && (
                <button
                  onClick={() => {
                    const allActive = roster.every(p => activeReporters[p.id]);
                    const newState: Record<string, boolean> = {};
                    roster.forEach(p => { newState[p.id] = !allActive; });
                    setActiveReporters(newState);
                  }}
                  className="text-[10px] text-gray-500 hover:text-white"
                >
                  {roster.every(p => activeReporters[p.id]) ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>
            {activeDept === 'authors' ? (
              roster.map(p => (
                <button
                  key={p.id}
                  onClick={() => togglePerson(p.id)}
                  className={`w-full text-left rounded border px-3 py-2.5 transition-all ${
                    activeReporters[p.id] ? theme.rosterActive : "bg-gray-900 border-gray-800 hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {activeReporters[p.id] && <span className="w-1.5 h-1.5 rounded-full bg-black shrink-0" />}
                    {p.avatar ? (
                      <img src={p.avatar} alt={p.name} className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-black ${colorFor(p.id).bg}`}>
                        {p.name.split(' ').map(n => n[0]).join('')}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold leading-tight truncate ${activeReporters[p.id] ? "text-black" : "text-gray-100"}`}>
                        {p.name}
                      </div>
                      <div className={`text-xs leading-tight truncate ${activeReporters[p.id] ? theme.rosterActiveSub : "text-gray-500"}`}>
                        {p.regionLabel}
                      </div>
                    </div>
                    {/* Category icon - inside button, only when active */}
                    {activeReporters[p.id] && (
                      <select
                        value={reporterCategories[p.id] || ''}
                        onChange={(e) => { e.stopPropagation(); setReporterCategories(prev => ({ ...prev, [p.id]: e.target.value })); }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-7 h-7 text-sm bg-black/20 rounded cursor-pointer appearance-none text-center shrink-0 hover:bg-black/40"
                        title="Search category"
                      >
                        <option value="">🔍</option>
                        <option value="sports">🏆</option>
                        <option value="music">🎵</option>
                        <option value="movies-tv">📺</option>
                        <option value="lifestyle">✨</option>
                        <option value="politics">🏛️</option>
                        <option value="tech">💻</option>
                      </select>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center text-gray-500 text-sm py-8">
                {activeDept === 'it' ? 'IT department coming soon' : 'Marketing department coming soon'}
              </div>
            )}
          </div>

          {/* Chat panel */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Live strip */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 bg-gray-950">
              <span className={`text-[10px] font-mono uppercase tracking-widest ${theme.accentText} flex items-center gap-1`}>
                <span className={`w-1.5 h-1.5 rounded-full ${theme.dot} animate-pulse`} /> Live
              </span>
              <div className="flex -space-x-2">
                {activePeople.map(p => (
                  <div
                    key={p.id}
                    title={p.name}
                    className={`w-6 h-6 rounded-full border-2 border-gray-950 flex items-center justify-center text-[10px] font-bold text-black ${colorFor(p.id).bg}`}
                  >
                    {p.name.split(' ').map(n => n[0]).join('')}
                  </div>
                ))}
              </div>
              {activePeople.length === 0 && (
                <span className="text-xs text-gray-500">No one active — select people from the roster.</span>
              )}
            </div>

            {/* Messages */}
            {currentPiece ? (
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {messages.map(m => {
                  // System messages
                  if (m.from === 'system') {
                    return (
                      <div key={m.id} className="text-center text-xs text-gray-500 font-mono py-1">
                        {m.text}
                      </div>
                    );
                  }

                  // Proposals (selectable cards)
                  if (m.from === 'proposals' && m.proposals) {
                    return (
                      <div key={m.id} className="space-y-2">
                        <div className="text-xs text-gray-500 font-mono">Select a person to write about:</div>
                        <div className="grid gap-2">
                          {m.proposals.map((p, idx) => (
                            <div 
                              key={idx}
                              className="bg-gray-900 border border-gray-700 rounded-lg p-3 hover:border-[#D4873A] transition-colors"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    {p.isRIP ? (
                                      <>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/50 text-red-300">🕯️ RIP</span>
                                        <span className="text-xs text-gray-500 font-mono">Born: {p.birthday}</span>
                                        {p.deathday && <span className="text-xs text-red-400 font-mono">Died: {p.deathday}</span>}
                                      </>
                                    ) : (
                                      <span className="text-xs text-gray-500 font-mono">{p.birthday}</span>
                                    )}
                                    <span className="font-bold text-white">{p.name}</span>
                                    <span className="text-xs text-gray-400">• {p.country}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
                                      {p.category === 'sports' ? '🏆 sports' : p.category === 'music' ? '🎵 music' : p.category === 'movies-tv' ? '📺 movies-tv' : p.category === 'lifestyle' ? '✨ lifestyle' : p.category === 'politics' ? '🏛️ politics' : p.category === 'tech' ? '💻 tech' : '🔍 any'}
                                    </span>
                                  </div>
                                  {p.causeOfDeath && <p className="text-xs text-red-400 mb-1">Cause: {p.causeOfDeath}</p>}
                                  <p className="text-sm text-gray-300 line-clamp-2">{p.description}</p>
                                  <div className="text-[10px] text-gray-500 mt-1">proposed by {p.reporterName}</div>
                                </div>
                                <div className="flex flex-col gap-1 shrink-0">
                                  <button
                                    onClick={() => selectProposal(p)}
                                    className="px-3 py-1.5 bg-[#D4873A] hover:bg-[#c07830] rounded text-xs font-bold text-white"
                                  >
                                    Select
                                  </button>
                                  <button
                                    onClick={() => askForAnother(p.reporterId, p.reporterName)}
                                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-[10px] text-gray-300"
                                  >
                                    Another
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  
                  // Result card (article created)
                  if (m.from === 'result') {
                    return (
                      <div key={m.id} className={`rounded px-4 py-3 flex items-center justify-between gap-3 border ${theme.resultBox}`}>
                        <span className={`text-sm ${theme.resultText}`}>{m.text}</span>
                        <div className="flex items-center gap-2">
                          {m.articleDraftId && (
                            <button
                              onClick={async () => {
                                // Fetch article and open in editor
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
                    );
                  }
                  
                  // Article preview (full article before activation)
                  if (m.from === 'article-preview' && m.articlePreview) {
                    const preview = m.articlePreview;
                    return (
                      <div key={m.id} className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden max-w-[90%]">
                        {/* Header */}
                        <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
                          <span className="text-xs font-semibold text-green-400">📝 Article Draft Preview</span>
                          <span className="text-[10px] text-gray-500">{preview.category}</span>
                        </div>
                        {/* Cover image */}
                        {preview.coverImage && (
                          <img src={preview.coverImage} alt="" className="w-full h-40 object-cover" />
                        )}
                        {/* Content */}
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
                                <span key={i} className="px-2 py-0.5 bg-gray-800 rounded text-[10px] text-gray-400">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Actions */}
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
                  }
                  
                  // Menschen check (person data before saving)
                  if (m.from === 'menschen-check' && m.menschenCheck) {
                    const data = m.menschenCheck;
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
                  }
                  
                  // Regular chat messages
                  const isMe = m.from === 'me';
                  const nameColor = isMe ? "text-gray-400" : colorFor(m.from).text;
                  return (
                    <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] ${isMe ? "text-right" : "text-left"}`}>
                        <div className={`text-xs font-semibold mb-0.5 ${nameColor}`}>{m.name}</div>
                        <div
                          className={`inline-block rounded-lg px-3 py-2 text-sm leading-snug whitespace-pre-wrap ${
                            isMe ? "bg-gray-800 text-gray-100" : "bg-gray-900 border border-gray-800 text-gray-100"
                          }`}
                          dangerouslySetInnerHTML={{ __html: m.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                        />
                      </div>
                    </div>
                  );
                })}
                {typing && <div className="text-xs text-gray-500 font-mono italic">{typing === 'multiple' ? 'Reporters are typing…' : `${typing} is typing…`}</div>}
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

            {/* Template panel */}
            {showTemplates && currentPiece && (
              <TemplatePanel 
                onSelect={(prompt) => { setDraft(prompt); setShowTemplates(false); }}
                onClose={() => setShowTemplates(false)}
              />
            )}

            {/* Prompts row */}
            {showPrompts && currentPiece && (
              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {PROMPT_SUGGESTIONS.map(p => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className={`text-xs px-3 py-1.5 rounded-full border border-gray-700 bg-gray-900 transition-colors ${theme.hoverBorder} ${theme.hoverText}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            {currentPiece && (
              <div className="border-t border-gray-800 bg-gray-950 p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message this ${CONTENT_TYPES.find(t => t.id === currentPiece.type)?.label.toLowerCase()} conference…`}
                    rows={2}
                    disabled={!!typing}
                    className={`flex-1 resize-none bg-gray-900 border border-gray-800 rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none disabled:opacity-50 ${theme.focusBorder}`}
                  />
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => { setShowTemplates(v => !v); setShowPrompts(false); }}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded border text-xs font-semibold transition-colors ${showTemplates ? 'bg-[#D4873A] border-[#D4873A] text-black' : 'bg-gray-800 border-gray-700 hover:border-[#D4873A] text-[#D4873A]'}`}
                    >
                      <FileText size={13} /> Templates
                    </button>
                    <button
                      onClick={() => sendMessage()}
                      disabled={!!typing || !draft.trim()}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded text-xs font-bold disabled:opacity-50 ${theme.sendBtn}`}
                    >
                      {typing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Article Editor Modal - Full Featured */}
      {articleDraft && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80">
          <div className="bg-gray-800 rounded-xl w-full max-w-5xl max-h-[95vh] overflow-y-auto">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-800 z-10">
              <h3 className="text-sm font-bold">Edit Article</h3>
              <button onClick={() => setArticleDraft(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Title & Subtitle Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Title *</label>
                  <input
                    type="text"
                    value={articleDraft.title}
                    onChange={e => setArticleDraft({ ...articleDraft, title: e.target.value })}
                    className="w-full bg-gray-700 px-2 py-1.5 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Subtitle</label>
                  <input
                    type="text"
                    value={articleDraft.subtitle}
                    onChange={e => setArticleDraft({ ...articleDraft, subtitle: e.target.value })}
                    className="w-full bg-gray-700 px-2 py-1.5 rounded text-sm"
                  />
                </div>
              </div>

              {/* Content & Sidebar */}
              <div className="grid grid-cols-[1fr_280px] gap-4">
                {/* Content Editor */}
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Content (Block Editor)</label>
                  <div className="min-w-0">
                    <BlockEditor
                      value={articleDraft.content || ''}
                      onChange={(content: string) => setArticleDraft({ ...articleDraft, content })}
                    />
                  </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-3">
                  {/* Cover Image */}
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">Cover Image</label>
                    <div 
                      onClick={() => setShowImagePicker(true)}
                      className="aspect-video bg-gray-700 rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#D4873A] transition-all"
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
                          Click to add image
                        </div>
                      )}
                    </div>
                    {articleDraft.coverImage && (
                      <div className="mt-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400 w-6">X:</span>
                          <input type="range" min="0" max="100" value={articleDraft.imagePosX ?? 50} onChange={(e) => setArticleDraft({ ...articleDraft, imagePosX: Number(e.target.value) })} className="flex-1 h-1.5 accent-[#D4873A]" />
                          <span className="text-[10px] text-gray-500 w-8">{articleDraft.imagePosX ?? 50}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400 w-6">Y:</span>
                          <input type="range" min="0" max="100" value={articleDraft.imagePosY ?? 50} onChange={(e) => setArticleDraft({ ...articleDraft, imagePosY: Number(e.target.value) })} className="flex-1 h-1.5 accent-[#D4873A]" />
                          <span className="text-[10px] text-gray-500 w-8">{articleDraft.imagePosY ?? 50}%</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Category */}
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

                  {/* Author */}
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">Author</label>
                    <div className="bg-gray-700 px-2 py-1.5 rounded text-xs text-gray-300">
                      {articleDraft.reporterName}
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">Tags</label>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {articleDraft.tags.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-600 rounded text-[10px] flex items-center gap-1">
                          {tag}
                          <button onClick={() => setArticleDraft({ ...articleDraft, tags: articleDraft.tags.filter((_, j) => j !== i) })} className="text-gray-400 hover:text-white">×</button>
                        </span>
                      ))}
                    </div>
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
                      placeholder="Add tag (Enter)"
                      className="w-full bg-gray-700 px-2 py-1 rounded text-[10px]"
                    />
                  </div>
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
                  onClick={async () => {
                    try {
                      // Always POST to create new article (skipSave means it wasn't saved before)
                      const res = await fetch('/api/articles', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          userId, // Required by API
                          title: articleDraft.title,
                          subtitle: articleDraft.subtitle,
                          content: articleDraft.content,
                          category: articleDraft.category,
                          tags: articleDraft.tags,
                          coverImage: articleDraft.coverImage,
                          imagePosX: articleDraft.imagePosX,
                          imagePosY: articleDraft.imagePosY,
                          author: articleDraft.reporterId,
                          status: 'draft',
                        }),
                      });
                      const data = await res.json();
                      if (data.success || data._id || data.article) {
                        const savedId = data._id || data.article?._id;
                        setArticleDraft(null);
                        if (currentPiece) {
                          updatePieceMessages(currentPiece.id, msgs => [
                            ...msgs,
                            {
                              id: generateId(),
                              from: 'result',
                              text: `Article "${articleDraft.title}" saved to Articles.`,
                              resultType: 'article',
                              articleDraftId: savedId,
                              activated: true,
                            },
                          ]);
                        }
                      } else {
                        alert('Save failed: ' + (data.error || 'Unknown error'));
                      }
                    } catch (err) {
                      console.error('Failed to save article:', err);
                      alert('Save failed: ' + err);
                    }
                  }}
                  className="px-4 py-1.5 bg-[#D4873A] hover:bg-[#c07830] rounded text-xs font-bold text-white flex items-center gap-1"
                >
                  <Check size={12} /> Save
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
    </div>
  );
}
