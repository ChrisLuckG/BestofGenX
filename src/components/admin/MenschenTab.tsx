"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Loader2, Trash2, Search, X, FileText, 
  Table as TableIcon, CalendarDays, ArrowUpDown, CheckCircle2, ListOrdered, Youtube
} from "lucide-react";
import ImagePickerModal from "./ImagePickerModal";
import BlockEditor from "./BlockEditor";
import RankrollTab from "./RankrollTab";
import { useConfirm } from "./ConfirmModal";
import { AUTHOR_STYLES } from "@/config/authorStyles";
import { countryNameToCode, getFlagUrl } from "@/lib/countryFlags";

// Person interface
interface Person {
  _id: string;
  firstname: string;
  lastname: string;
  born?: string;
  died?: string;
  causeOfDeath?: string;
  profession?: string;
  subcat?: string;
  knownfor?: string;
  countryBorn?: string;
  cityBorn?: string;
  countryDied?: string;
  cityDied?: string;
  nationality?: string;
  image?: string;
  hasArticle?: boolean;
  articleId?: string;
}

interface MenschenTabProps {
  userId?: string;
}

// Cap for the "All Months" view only - see fetchPeople.
const ALL_MONTHS_LIMIT = 3000;

// Profession options (main categories)
const PROFESSIONS = ['Music', 'Actor', 'Sport', 'Politik', 'Art', 'Tech', 'Comedy', 'Model', 'Other'];

// Sport-specific professions from bestofgenx - these map to "Sport" as main profession
const SPORT_CATEGORIES = [
  'football', 'tennis', 'basketball', 'ice-hockey', 'american-football',
  'baseball', 'golf', 'motorsport', 'rugby', 'cricket', 'handball',
  'boxing', 'volleyball', 'table-tennis', 'badminton', 'darts',
  'snooker', 'esports', 'others'
];

// Check if profession is a sport subcategory
function isSportProfession(profession?: string): boolean {
  return !!profession && SPORT_CATEGORIES.includes(profession.toLowerCase());
}

// Get display profession (main category)
function getDisplayProfession(person: Person): string {
  if (isSportProfession(person.profession)) return 'Sport';
  return person.profession || 'Other';
}

// Get subcategory label (sport type, or subcat field for other professions)
function getSubcat(person: Person): string | null {
  // For sport professions, the profession field IS the subcat (football, basketball, etc.)
  if (isSportProfession(person.profession)) {
    // Capitalize first letter
    return person.profession!.charAt(0).toUpperCase() + person.profession!.slice(1).replace(/-/g, ' ');
  }
  // For other professions, use the subcat field (Painter, Author, etc.)
  return person.subcat || null;
}

// Profession badge colors
const PROF_COLORS: Record<string, string> = {
  Music: 'bg-yellow-500',
  Actor: 'bg-blue-500',
  Sport: 'bg-green-500',
  Politik: 'bg-red-500',
  Art: 'bg-purple-500',
  Tech: 'bg-orange-500',
  Comedy: 'bg-yellow-400',
  Model: 'bg-pink-500',
  Other: 'bg-gray-500',
};

// Wikipedia search URL
function wikipediaSearchUrl(p: Person): string {
  return `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(`${p.firstname} ${p.lastname}`.trim())}`;
}

// Interest/completeness score (from bestofgenx)
function interestScore(p: Person): number {
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

// Tooltip for person
function buildPersonTooltip(p: Person): string {
  const lines: string[] = [];
  if (p.knownfor) {
    lines.push(p.knownfor);
  } else {
    lines.push('⚠ No bio saved - verify notability before writing.');
  }
  if (p.cityBorn) lines.push(`Born in: ${p.cityBorn}`);
  if (p.died) lines.push(`Died: ${p.died}${p.cityDied ? `, ${p.cityDied}` : ''}${p.countryDied ? `, ${p.countryDied}` : ''}${p.causeOfDeath ? ` (${p.causeOfDeath})` : ''}`);
  if (p.nationality && p.nationality !== p.countryBorn) lines.push(`Nationality: ${p.nationality}`);
  if (p.subcat) lines.push(`Role: ${p.subcat}`);
  lines.push(`Data completeness: ${interestScore(p)}/100`);
  return lines.join('\n');
}

// Parse date
function parseBornDate(born?: string): Date | null {
  if (!born) return null;
  // Try YYYY-MM-DD format
  const iso = born.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
  // Try DD.MM.YYYY format
  const m = born.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
  return null;
}

// Calculate age
function ageOf(born?: string): number | null {
  const d = parseBornDate(born);
  if (!d) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

// Format date for display
function formatDate(born?: string): string {
  if (!born) return '—';
  const d = parseBornDate(born);
  if (!d) return born;
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
}

// A list shows dozens of portraits at once. Lazy loading keeps that from being a burst
// the image host throttles, and a portrait that still fails falls back to the initial
// instead of the browser's broken-image icon.
function PersonThumb({ image, letter, letterClass }: { image?: string; letter: string; letterClass: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [image]);
  if (!image || failed) return <div className={`w-full h-full flex items-center justify-center ${letterClass}`}>{letter}</div>;
  return <img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="w-full h-full object-cover" />;
}
export default function MenschenTab({ userId }: MenschenTabProps) {
  // Data
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  // Unlimited match count from the server - the header must not report the
  // capped number as if it were the whole collection.
  const [totalCount, setTotalCount] = useState(0);
  
  // Filters
  const [search, setSearch] = useState('');
  const [professionFilter, setProfessionFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [aliveFilter, setAliveFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState<number>(new Date().getMonth() + 1);
  const [minScoreFilter, setMinScoreFilter] = useState(70);
  
  // View & Sort
  const [viewMode, setViewMode] = useState<'table' | 'byDate'>('byDate');
  const [sortBy, setSortBy] = useState<'birthday' | 'name' | 'age' | 'country' | 'profession'>('birthday');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Article tracking
  const [personArticles, setPersonArticles] = useState<Record<string, { title: string; status: string }>>({});
  // Rankroll tracking - same contract as personArticles, keyed by person id
  const [personRankrolls, setPersonRankrolls] = useState<Record<string, { title: string; status: string }>>({});
  // TV video tracking - keyed by person id
  const [personTvVideos, setPersonTvVideos] = useState<Record<string, { title: string; videoId: string; dbId: string; position?: number }>>({});
  
  // Country counts for filter dropdown
  const [countriesWithCounts, setCountriesWithCounts] = useState<{ country: string; count: number }[]>([]);
  
  // Modals
  const [imageModal, setImageModal] = useState<{ id: string; type: 'people'; currentUrl?: string; searchTerm?: string } | null>(null);
  const [articleModal, setArticleModal] = useState<Person | null>(null);
  const [articleGenerating, setArticleGenerating] = useState(false);
  const [articleSaving, setArticleSaving] = useState(false);
  // Rankroll editor overlay - shows the full RankrollTab editor
  const [rankrollEditorTopic, setRankrollEditorTopic] = useState<string | null>(null);
  const [rankrollEditorPerson, setRankrollEditorPerson] = useState<string | null>(null);
  // TV video modal
  const [tvModal, setTvModal] = useState<Person | null>(null);
  const [tvModalUrl, setTvModalUrl] = useState('');
  const [tvModalSaving, setTvModalSaving] = useState(false);
  const [tvModalVideoId, setTvModalVideoId] = useState<string | null>(null); // DB _id for editing
  const [tvModalPosition, setTvModalPosition] = useState<number | null>(null); // 1, 2, 3 or null
  // Current holder of each hero position (any TV video), so the modal can say what a position replaces
  const [tvHolders, setTvHolders] = useState<Record<number, { title: string; personId?: string }>>({});
  const [articleData, setArticleData] = useState({
    title: '',
    subtitle: '',
    content: '',
    tags: [] as string[],
    category: 'culture',
    coverImage: '',
    thumbnailUrl: '',
    // The focal point picked in ImagePickerModal. Held here rather than applied
    // straight to the person, because the article does not exist yet when the
    // image is chosen - it is created on "Save as Article".
    imagePosX: 50,
    imagePosY: 50,
  });
  const [articleOptions, setArticleOptions] = useState({
    topic: '',
    language: 'English',
    length: 'long (~600 words)',
    tone: 'informative',
    extra: '',
  });
  const { confirm, ConfirmDialog } = useConfirm();

  // Fetch people
  const fetchPeople = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: 'people' });
      if (search) params.set('search', search);
      if (professionFilter) {
        params.set('filter', 'profession');
        params.set('filterValue', professionFilter);
      }
      if (countryFilter) params.set('countryBorn', countryFilter);
      if (aliveFilter) params.set('aliveStatus', aliveFilter);
      if (monthFilter > 0) {
        if (aliveFilter === 'deceased') {
          params.set('deathMonth', monthFilter.toString());
        } else {
          params.set('birthMonth', monthFilter.toString());
        }
      } else if (!search) {
        // "All Months" with no search is the pathological case: it used to load
        // every person in one response (measured 67.5 MB / 9.1s server-side,
        // plus ~0.9s JSON.parse and 122k cards to render). A month-filtered
        // view is ~1/12 of that and stays unlimited, so this cap only applies
        // where the request was previously unusable.
        params.set('limit', String(ALL_MONTHS_LIMIT));
      }
      
      const res = await fetch(`/api/almanac?${params}`);
      const data = await res.json();
      if (data.success) {
        setPeople(data.data);
        setTotalCount(typeof data.total === 'number' ? data.total : data.data.length);
      }
    } catch (e) {
      console.error('Failed to fetch people:', e);
    } finally {
      setLoading(false);
    }
  }, [search, professionFilter, countryFilter, aliveFilter, monthFilter]);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  // Fetch article + rankroll refs. Both markers are derived from the server, never
  // from local state alone: the optimistic update after saving used to be the ONLY
  // record of it, so the checkmark vanished on the next reload.
  // Rankroll articles (contentType 'rankroll') are kept out of the article map, or
  // publishing a ranking with its article would also tick "has article".
  const refreshRefs = useCallback(() => {
    fetch('/api/articles?personRefs=true')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const map: Record<string, { title: string; status: string }> = {};
          (data.data || []).forEach((a: any) => {
            if (a.personRef && a.contentType !== 'rankroll') {
              map[a.personRef.toString()] = { title: a.title, status: a.status };
            }
          });
          setPersonArticles(map);
        }
      })
      .catch(() => {});

    fetch('/api/polls?personRefs=true')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const map: Record<string, { title: string; status: string }> = {};
          (data.polls || []).forEach((p: any) => {
            if (p.personRef) map[p.personRef.toString()] = { title: p.title, status: p.status };
          });
          setPersonRankrolls(map);
        }
      })
      .catch(() => {});

    // TV videos linked to persons
    fetch('/api/tv?all=true')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const map: Record<string, { title: string; videoId: string; dbId: string; position?: number }> = {};
          (data.videos || []).forEach((v: any) => {
            if (v.personRef) map[v.personRef.toString()] = { 
              title: v.title, 
              videoId: v.youtubeId, 
              dbId: v._id,
              position: v.featuredPosition 
            };
          });
          setPersonTvVideos(map);
          const holders: Record<number, { title: string; personId?: string }> = {};
          (data.videos || []).forEach((v: any) => { if (v.featuredPosition) holders[v.featuredPosition] = { title: v.title, personId: v.personRef?.toString() }; });
          setTvHolders(holders);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshRefs();
  }, [refreshRefs]);

  // Calculate country counts
  useEffect(() => {
    const counts: Record<string, number> = {};
    people.forEach(p => {
      const country = p.countryBorn || 'Unknown';
      counts[country] = (counts[country] || 0) + 1;
    });
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([country, count]) => ({ country, count }));
    setCountriesWithCounts(sorted);
  }, [people]);

  // Filter by score and sort
  const sortedPeople = useMemo(() => {
    let filtered = people;
    
    // Apply score filter
    if (minScoreFilter > 0) {
      filtered = filtered.filter(p => interestScore(p) >= minScoreFilter);
    }
    
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return dir * `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`);
        case 'age': {
          const ageA = ageOf(a.born) ?? -1, ageB = ageOf(b.born) ?? -1;
          return dir * (ageA - ageB);
        }
        case 'country':
          return dir * (a.countryBorn || '').localeCompare(b.countryBorn || '');
        case 'profession':
          return dir * (a.profession || '').localeCompare(b.profession || '');
        case 'birthday':
        default: {
          const da = parseBornDate(a.born), db = parseBornDate(b.born);
          if (!da && !db) return 0;
          if (!da) return 1;
          if (!db) return -1;
          const today = new Date();
          const todayDay = today.getDate();
          // Sort by distance from today's day within the month
          // Days >= today come first (ascending), then days < today
          const dayA = da.getDate();
          const dayB = db.getDate();
          const distA = dayA >= todayDay ? dayA - todayDay : dayA + 31 - todayDay;
          const distB = dayB >= todayDay ? dayB - todayDay : dayB + 31 - todayDay;
          return dir * (distA - distB);
        }
      }
    });
  }, [people, sortBy, sortDir, minScoreFilter]);

  // Group by date for byDate view
  const byDateGroups = useMemo(() => {
    const useDeathDate = aliveFilter === 'deceased';
    const grouped: Record<string, Person[]> = {};
    
    sortedPeople.forEach(p => {
      const dateField = useDeathDate ? p.died : p.born;
      if (!dateField) return;
      const d = parseBornDate(dateField);
      if (!d) return;
      const mmdd = `${d.getMonth() + 1}-${d.getDate()}`;
      if (!grouped[mmdd]) grouped[mmdd] = [];
      grouped[mmdd].push(p);
    });

    const today = new Date();
    const todayMMDD = `${today.getMonth() + 1}-${today.getDate()}`;
    const todayDay = today.getDate();

    return Object.entries(grouped)
      .sort(([a], [b]) => {
        // Parse day numbers
        const dayA = parseInt(a.split('-')[1]);
        const dayB = parseInt(b.split('-')[1]);
        
        // Calculate distance from today (wrapping around month)
        const distA = dayA >= todayDay ? dayA - todayDay : dayA + 31 - todayDay;
        const distB = dayB >= todayDay ? dayB - todayDay : dayB + 31 - todayDay;
        
        return distA - distB;
      })
      .map(([mmdd, dayPeople]) => {
        const [mm, dd] = mmdd.split('-');
        return {
          mmdd,
          label: `${dd.padStart(2, '0')}.${mm.padStart(2, '0')}.`,
          isToday: mmdd === todayMMDD,
          count: dayPeople.length,
          people: dayPeople.sort((a, b) => `${a.lastname} ${a.firstname}`.localeCompare(`${b.lastname} ${b.firstname}`))
        };
      });
  }, [sortedPeople, aliveFilter]);

  // Toggle sort
  const toggleSort = (key: typeof sortBy) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortDir('asc'); }
  };

  // Selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => prev.size === sortedPeople.length ? new Set() : new Set(sortedPeople.map((p) => p._id)));
  };

  // Delete
  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      title: 'Delete People',
      message: `Delete ${selectedIds.size} selected people?`,
      confirmLabel: 'Delete All',
      variant: 'danger',
    });
    if (!ok) return;
    await Promise.all(Array.from(selectedIds).map((id) => fetch(`/api/almanac?type=people&id=${id}`, { method: 'DELETE' })));
    setPeople((prev) => prev.filter((p) => !selectedIds.has(p._id)));
    setSelectedIds(new Set());
  };

  const deletePerson = async (id: string) => {
    const ok = await confirm({
      title: 'Delete Person',
      message: 'Delete this person?',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    await fetch(`/api/almanac?type=people&id=${id}`, { method: 'DELETE' });
    setPeople((prev) => prev.filter((p) => p._id !== id));
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  // Save image
  const saveImage = async (url: string, position?: { x: number; y: number }, thumbnailUrl?: string) => {
    if (!imageModal) return;
    
    if (imageModal.id === 'article-cover') {
      // `position` was accepted here and then dropped, so every nudge in the
      // picker previewed correctly and was lost on Apply. It has to survive into
      // the POST in saveArticle() AND be handed back as `currentPosition`, or
      // reopening the picker silently resets to 50/50.
      setArticleData(prev => ({ 
        ...prev, 
        coverImage: url,
        thumbnailUrl: thumbnailUrl || url,
        imagePosX: position?.x ?? 50,
        imagePosY: position?.y ?? 50,
      }));
      setImageModal(null);
      return;
    }
    
    try {
      await fetch('/api/almanac', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'people', id: imageModal.id, image: url }),
      });
      setPeople((prev) => prev.map((p) => p._id === imageModal.id ? { ...p, image: url } : p));
    } catch (e) {
      console.error('Failed to update image:', e);
    }
    setImageModal(null);
  };

  // Open article modal
  const openArticleModal = (person: Person) => {
    setArticleModal(person);
    setArticleData({
      title: '',
      subtitle: '',
      content: '',
      tags: [person.profession, 'Gen X', person.countryBorn].filter((t): t is string => !!t),
      category: 'culture',
      coverImage: person.image || '',
      thumbnailUrl: person.image || '',
      imagePosX: 50,
      imagePosY: 50,
    });
    setArticleOptions({
      topic: '',
      language: 'English',
      length: 'long (~600 words)',
      tone: 'informative',
      extra: '',
    });
  };

  // Generate article with AI
  const generateArticle = async () => {
    if (!articleModal) return;
    setArticleGenerating(true);
    
    try {
      const res = await fetch('/api/almanac/article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person: articleModal,
          options: articleOptions,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setArticleData(prev => ({
          ...prev,
          title: data.title || `${articleModal.firstname} ${articleModal.lastname}: ${articleModal.profession} Icon`,
          subtitle: data.subtitle || `A look at the life and career of ${articleModal.firstname} ${articleModal.lastname}`,
          content: data.article || data.content || '',
          tags: data.tags || prev.tags,
          category: data.category || 'culture',
        }));
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e) {
      alert('Error generating article');
    } finally {
      setArticleGenerating(false);
    }
  };

  // Save article
  const saveArticle = async () => {
    if (!articleModal || !articleData.content) return;
    setArticleSaving(true);
    
    try {
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: articleData.title,
          subtitle: articleData.subtitle,
          content: articleData.content,
          coverImage: articleData.coverImage,
          thumbnailUrl: articleData.thumbnailUrl || articleData.coverImage,
          imagePosX: articleData.imagePosX,
          imagePosY: articleData.imagePosY,
          tags: articleData.tags,
          category: articleData.category,
          status: 'draft',
          contentType: 'article',
          personRef: articleModal._id,
          autoGenerated: true,
          personCountry: articleModal.countryBorn || articleModal.nationality || '',
          personName: `${articleModal.firstname} ${articleModal.lastname}`.trim(),
          personBirthday: articleModal.born,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Optimistic for instant feedback, then confirmed from the server so the
        // marker is backed by a real personRef rather than by local state only.
        setPersonArticles(prev => ({
          ...prev,
          [articleModal._id]: { title: articleData.title, status: 'draft' }
        }));
        alert('✅ Article saved as DRAFT! Go to Articles tab to review and publish.');
        setArticleModal(null);
        refreshRefs();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e) {
      alert('Error saving article');
    } finally {
      setArticleSaving(false);
    }
  };

  // Open rankroll editor with pre-filled topic.
  // Deliberately WITHOUT a leading count ("Top 10 ..."): the generator decides how
  // many entries a subject genuinely supports, and a hardcoded number produced
  // titles that promised 10 while only 9 items were delivered.
  const openRankrollEditor = (person: Person) => {
    const name = `${person.firstname} ${person.lastname}`;
    const topic = person.knownfor || person.profession || 'career highlights';
    setRankrollEditorTopic(`Iconic ${topic} moments by ${name}`);
    setRankrollEditorPerson(person._id);
  };

  // Open TV modal for adding or editing a YouTube video
  const openTvModal = (person: Person) => {
    const existing = personTvVideos[person._id];
    setTvModal(person);
    if (existing) {
      setTvModalUrl(`https://www.youtube.com/watch?v=${existing.videoId}`);
      setTvModalVideoId(existing.dbId);
      setTvModalPosition(existing.position || null);
    } else {
      setTvModalUrl('');
      setTvModalVideoId(null);
      setTvModalPosition(null);
    }
  };

  // Save TV video from modal (create or update)
  const saveTvVideo = async () => {
    if (!tvModal || !tvModalUrl.trim()) return;
    
    // Extract video ID from URL
    const urlMatch = tvModalUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (!urlMatch) {
      alert('Invalid YouTube URL. Please paste a valid YouTube link.');
      return;
    }
    
    const videoId = urlMatch[1];
    const personName = `${tvModal.firstname} ${tvModal.lastname}`.trim();
    
    setTvModalSaving(true);
    try {
      // Fetch video metadata from YouTube
      const metaRes = await fetch(`/api/youtube/metadata?videoId=${videoId}`);
      const metaData = await metaRes.json();
      
      const title = metaData.title || personName;
      const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      
      const isUpdate = !!tvModalVideoId;
      
      // Add or update in GenX TV
      const tvRes = await fetch('/api/tv', {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isUpdate ? { _id: tvModalVideoId } : {}),
          title,
          description: `${personName} - ${tvModal.profession || 'GenX Icon'}`,
          youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
          youtubeId: videoId,
          thumbnail,
          category: tvModal.profession === 'Music' ? 'Music Videos' : 'Documentaries',
          language: 'en',
          personRef: tvModal._id,
          featuredPosition: tvModalPosition,
        }),
      });
      
      const tvData = await tvRes.json();
      if (tvData.success) {
        const newDbId = tvData.video?._id || tvModalVideoId;
        // The server hands the position over; mirror that here so the badges of the
        // previous holder disappear without a reload
        setPersonTvVideos(prev => {
          const next = { ...prev };
          if (tvModalPosition) {
            for (const k of Object.keys(next)) {
              if (k !== tvModal._id && next[k].position === tvModalPosition) next[k] = { ...next[k], position: undefined };
            }
          }
          next[tvModal._id] = { title, videoId, dbId: newDbId, position: tvModalPosition || undefined };
          return next;
        });
        setTvHolders(prev => {
          const next = { ...prev };
          for (const k of Object.keys(next)) if (next[Number(k)].personId === tvModal._id) delete next[Number(k)];
          if (tvModalPosition) next[tvModalPosition] = { title, personId: tvModal._id };
          return next;
        });
        setTvModal(null);
        setTvModalUrl('');
        setTvModalVideoId(null);
        setTvModalPosition(null);
      } else {
        alert('Error: ' + tvData.error);
      }
    } catch (e) {
      alert('Error saving TV video');
    } finally {
      setTvModalSaving(false);
    }
  };

  // Coverage comes from two independent places and BOTH have to count, or the
  // marker is wrong for a large part of the data:
  //  - `personArticles`: articles carrying a personRef (the Menschen tab's own
  //    "Create Article" path)
  //  - `person.hasArticle`: set on the Person by the article POST route and by
  //    /api/almanac/link-articles, which match on name/birthday instead
  const articleFor = (person: Person): { title: string; status: string } | undefined => {
    const byRef = personArticles[person._id];
    if (byRef) return byRef;
    if (person.hasArticle) return { title: '', status: 'linked' };
    return undefined;
  };

  // Sort header component
  const SortHeader = ({ label, column }: { label: string; column: typeof sortBy }) => (
    <button onClick={() => toggleSort(column)} className={`flex items-center gap-1 hover:text-gray-700 ${sortBy === column ? 'text-gray-900' : 'text-gray-500'}`}>
      {label}
      <ArrowUpDown className={`w-2.5 h-2.5 ${sortBy === column ? 'opacity-100' : 'opacity-30'}`} style={sortBy === column && sortDir === 'desc' ? { transform: 'scaleY(-1)' } : undefined} />
    </button>
  );

  return (
    <div className="admin-panel flex flex-col h-full">
      {/* Header */}
      <div className="admin-header flex items-center justify-between">
        <h3 className="text-sm">
          People ({sortedPeople.length.toLocaleString()}
          {totalCount > sortedPeople.length && (
            <span className="admin-text-muted"> of {totalCount.toLocaleString()}</span>
          )})
        </h3>
      </div>

      {/* Filters */}
      <div className="admin-content border-b border-gray-200">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="admin-input w-full pl-8"
            />
          </div>

          {/* Profession filter */}
          <select
            value={professionFilter}
            onChange={(e) => setProfessionFilter(e.target.value)}
            className="admin-select"
          >
            <option value="">All Professions</option>
            {PROFESSIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          {/* Country filter */}
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="admin-select min-w-[120px]"
          >
            <option value="">All Countries</option>
            {countriesWithCounts.map(({ country, count }) => (
              <option key={country} value={country}>{country} ({count})</option>
            ))}
          </select>

          {/* Alive filter */}
          <select
            value={aliveFilter}
            onChange={(e) => setAliveFilter(e.target.value)}
            className="admin-select"
          >
            <option value="">All</option>
            <option value="alive">Alive</option>
            <option value="deceased">Deceased</option>
          </select>

          {/* Month filter */}
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(parseInt(e.target.value))}
            className="admin-select"
          >
            <option value={0}>All Months</option>
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>

          {/* Score filter */}
          <select
            value={minScoreFilter}
            onChange={(e) => setMinScoreFilter(parseInt(e.target.value))}
            className="admin-select"
            title="Filter by data completeness score"
          >
            <option value={0}>Any score</option>
            <option value={30}>Score 30+</option>
            <option value={50}>Score 50+</option>
            <option value={70}>Score 70+</option>
          </select>

          <div className="flex-1" />

          {/* Bulk delete */}
          {selectedIds.size > 0 && (
            <button onClick={deleteSelected} className="admin-btn admin-btn-danger flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" /> Delete {selectedIds.size}
            </button>
          )}

          {/* View toggle */}
          <div className="admin-toggle-group">
            <button
              onClick={() => setViewMode('table')}
              className={`admin-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              title="Table view"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('byDate')}
              className={`admin-toggle-btn ${viewMode === 'byDate' ? 'active' : ''}`}
              title="By birthday"
            >
              <CalendarDays className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto admin-content">
        {loading ? (
          <div className="flex items-center gap-2 admin-text-muted text-sm py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : sortedPeople.length === 0 ? (
          <div className="admin-text-muted text-sm py-8 text-center">No people match the current filters.</div>
        ) : viewMode === 'table' ? (
          /* TABLE VIEW */
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="w-8">
                    <input type="checkbox" checked={sortedPeople.length > 0 && selectedIds.size === sortedPeople.length} onChange={toggleSelectAll} className="cursor-pointer" />
                  </th>
                  <th><SortHeader label="Name" column="name" /></th>
                  <th><SortHeader label="Birthday" column="birthday" /></th>
                  <th><SortHeader label="Age" column="age" /></th>
                  <th><SortHeader label="Profession" column="profession" /></th>
                  <th>Subcat</th>
                  <th><SortHeader label="Country" column="country" /></th>
                  <th>City</th>
                  <th>Death</th>
                  <th>Score</th>
                  <th>Article</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedPeople.map((person) => {
                  const article = articleFor(person);
                  const rankroll = personRankrolls[person._id];
                  const score = interestScore(person);
                  return (
                    <tr key={person._id} className={selectedIds.has(person._id) ? 'bg-orange-50' : ''}>
                      <td>
                        <input type="checkbox" checked={selectedIds.has(person._id)} onChange={() => toggleSelect(person._id)} className="cursor-pointer" />
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setImageModal({ id: person._id, type: 'people', currentUrl: person.image, searchTerm: `${person.firstname} ${person.lastname}` })} 
                            className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 hover:ring-2 hover:ring-[#E36B11]" 
                            title="Set image"
                          >
                            <PersonThumb image={person.image} letter={person.firstname[0]} letterClass="text-[9px] text-gray-400" />
                          </button>
                          <a 
                            href={wikipediaSearchUrl(person)} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="font-medium text-gray-900 hover:text-[#E36B11] hover:underline" 
                            title={buildPersonTooltip(person)}
                          >
                            {person.firstname} {person.lastname}
                          </a>
                          {person.died && <span className="admin-text-muted text-xs" title="Deceased">†</span>}
                        </div>
                      </td>
                      <td>{formatDate(person.born)}</td>
                      <td>{ageOf(person.born) ?? '—'}</td>
                      <td>
                        {(() => {
                          const mainProf = getDisplayProfession(person);
                          return (
                            <span className={`admin-badge ${PROF_COLORS[mainProf] || 'bg-gray-500'}`}>
                              {mainProf}
                            </span>
                          );
                        })()}
                      </td>
                      <td>{getSubcat(person) || '—'}</td>
                      <td>{person.countryBorn || '—'}</td>
                      <td>{person.cityBorn || '—'}</td>
                      <td>{person.died ? formatDate(person.died) : '—'}</td>
                      <td>
                        <span className={`text-[10px] font-medium ${score >= 60 ? 'admin-text-success' : score >= 30 ? 'admin-text-warning' : 'admin-text-muted'}`}>{score}</span>
                      </td>
                      <td>
                        {article ? <span className="text-[10px] admin-text-success font-medium">✓ {article.status}</span> : <span className="text-[10px] admin-text-muted">—</span>}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => openArticleModal(person)} className={article ? 'admin-text-success' : 'admin-text-muted hover:text-[#E36B11]'} title="Create Article">
                            {article ? <CheckCircle2 className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                          </button>
                          <button onClick={() => openRankrollEditor(person)} className={rankroll ? 'admin-text-success' : 'admin-text-muted hover:text-purple-600'} title={rankroll ? `Rankroll: ${rankroll.title}` : 'Create Rankroll'}>
                            {rankroll ? <CheckCircle2 className="w-3 h-3" /> : <ListOrdered className="w-3 h-3" />}
                          </button>
                          <button 
                            onClick={() => openTvModal(person)} 
                            className={`relative ${personTvVideos[person._id] ? 'admin-text-success' : 'admin-text-muted hover:text-red-500'}`} 
                            title={personTvVideos[person._id] ? `Edit TV: ${personTvVideos[person._id].title}` : 'Add to GenX TV'}
                          >
                            <Youtube className="w-3 h-3" />
                            {personTvVideos[person._id]?.position && (
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#E36B11] text-white text-[6px] font-bold rounded-full flex items-center justify-center">
                                {personTvVideos[person._id].position}
                              </span>
                            )}
                          </button>
                          <button onClick={() => deletePerson(person._id)} className="admin-text-muted hover:text-red-500" title="Delete">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* BY DATE VIEW */
          <div className="space-y-4">
            {byDateGroups.map(({ mmdd, label, isToday, count, people: dayPeople }) => (
              <div key={mmdd} className="border border-gray-200 rounded-lg" style={{ background: '#fff' }}>
                <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2 text-sm text-gray-700">
                  <span>{label}</span>
                  <span className="text-xs text-gray-400">({count})</span>
                  {isToday && <span className="text-xs font-medium text-gray-900">· Today</span>}
                </div>
                <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                  {dayPeople.map((person) => {
                    const article = articleFor(person);
                    const rankroll = personRankrolls[person._id];
                    const score = interestScore(person);
                    const subcat = getSubcat(person);
                    const flagUrl = getFlagUrl(undefined, person.countryBorn, '24x18');
                    return (
                      <div key={person._id} className="rounded-lg border border-gray-200 p-3 hover:border-gray-300 transition-colors" style={{ background: '#fff' }}>
                        <div className="flex gap-3">
                          {/* Image */}
                          <button 
                            onClick={() => setImageModal({ id: person._id, type: 'people', currentUrl: person.image, searchTerm: `${person.firstname} ${person.lastname}` })} 
                            className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0" 
                            title="Set image"
                          >
                            <PersonThumb image={person.image} letter={person.firstname[0]} letterClass="text-base text-gray-300" />
                          </button>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <a
                                href={wikipediaSearchUrl(person)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-gray-900 hover:underline truncate"
                                title={buildPersonTooltip(person)}
                              >
                                {person.firstname} {person.lastname}
                              </a>
                              {flagUrl && <img src={flagUrl} alt="" className="w-4 h-3 object-cover rounded-sm flex-shrink-0" />}
                            </div>
                            
                            <div className="text-xs text-gray-500 mt-1">
                              {getDisplayProfession(person)}{subcat ? ` · ${subcat}` : ''}
                            </div>
                            
                            <div className="text-xs text-gray-400 mt-0.5">
                              {formatDate(person.born)} · {ageOf(person.born) ?? '—'}
                            </div>
                          </div>
                          
                          {/* Score */}
                          <div className={`text-base font-semibold ${score >= 50 ? 'text-gray-700' : 'text-gray-300'}`}>
                            {score}
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                          <button 
                            onClick={() => openArticleModal(person)} 
                            className={`flex-1 py-1.5 rounded text-xs font-medium border transition-colors ${
                              article 
                                ? 'border-gray-200 text-gray-400 bg-gray-50' 
                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {article ? '✓ Article' : 'Create Article'}
                          </button>
                          <button 
                            onClick={() => openRankrollEditor(person)} 
                            className={`flex-1 py-1.5 rounded text-xs font-medium border transition-colors ${
                              rankroll
                                ? 'border-gray-200 text-gray-400 bg-gray-50'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {rankroll ? '✓ Rankroll' : 'Create Rankroll'}
                          </button>
                          <button 
                            onClick={() => openTvModal(person)}
                            className={`relative p-1.5 rounded transition-colors ${
                              personTvVideos[person._id] 
                                ? 'text-red-500 hover:bg-red-50' 
                                : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                            }`}
                            title={personTvVideos[person._id] ? `Edit TV: ${personTvVideos[person._id].title}` : 'Add to GenX TV'}
                          >
                            <Youtube className="w-4 h-4" />
                            {personTvVideos[person._id]?.position && (
                              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-[#E36B11] text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                                {personTvVideos[person._id].position}
                              </span>
                            )}
                          </button>
                          <button 
                            onClick={() => deletePerson(person._id)} 
                            className="p-1.5 rounded text-gray-300 hover:text-gray-500 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TV VIDEO MODAL */}
      {tvModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setTvModal(null)}>
          <div className="bg-white rounded-lg w-[500px] max-w-[95vw] shadow-xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-red-500" />
                  Add to GenX TV
                </h3>
                <p className="text-xs text-gray-500">{tvModal.firstname} {tvModal.lastname} · {tvModal.profession}</p>
              </div>
              <button onClick={() => setTvModal(null)} className="p-1 hover:bg-gray-200 rounded">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">YouTube URL</label>
                <input
                  type="text"
                  value={tvModalUrl}
                  onChange={e => setTvModalUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#E36B11]/50"
                  autoFocus
                />
                <p className="text-[10px] text-gray-400 mt-1">Paste a YouTube video URL for {tvModal.firstname} {tvModal.lastname}</p>
              </div>

              {/* Preview */}
              {tvModalUrl && (() => {
                const match = tvModalUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
                if (match) {
                  return (
                    <div className="rounded-lg overflow-hidden border border-gray-200">
                      <img 
                        src={`https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`} 
                        alt="Video preview" 
                        className="w-full h-auto"
                      />
                    </div>
                  );
                }
                return null;
              })()}

              {/* Featured Position */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Featured Position (Hero Carousel)</label>
                <div className="flex gap-2">
                  {[1, 2, 3].map(pos => (
                    <button
                      key={pos}
                      onClick={() => setTvModalPosition(tvModalPosition === pos ? null : pos)}
                      title={tvHolders[pos] && tvHolders[pos].personId !== tvModal?._id ? `Taken by "${tvHolders[pos].title}"` : 'Free'}
                      className={`w-10 h-10 rounded-lg border-2 font-bold text-sm transition-colors ${
                        tvModalPosition === pos 
                          ? 'border-[#E36B11] bg-[#E36B11] text-white' 
                          : tvHolders[pos] && tvHolders[pos].personId !== tvModal?._id
                            ? 'border-[#E36B11]/40 text-[#E36B11] hover:border-[#E36B11]'
                            : 'border-gray-300 text-gray-500 hover:border-gray-400'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                  <span className="text-[10px] text-gray-400 self-center ml-2">Optional: Set 1, 2, or 3 for hero carousel</span>
                </div>
                {tvModalPosition && tvHolders[tvModalPosition] && tvHolders[tvModalPosition].personId !== tvModal?._id && (
                  <p className="text-[11px] text-[#E36B11] mt-1.5">
                    Replaces <strong>{tvHolders[tvModalPosition].title}</strong> on position {tvModalPosition}
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => { setTvModal(null); setTvModalVideoId(null); setTvModalPosition(null); }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveTvVideo}
                disabled={!tvModalUrl.trim() || tvModalSaving}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {tvModalSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {tvModalVideoId ? 'Updating...' : 'Adding...'}
                  </>
                ) : (
                  <>
                    <Youtube className="w-4 h-4" />
                    {tvModalVideoId ? 'Update Video' : 'Add to TV'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE PICKER MODAL */}
      <ImagePickerModal
        isOpen={!!imageModal}
        onClose={() => setImageModal(null)}
        onSelect={saveImage}
        currentImage={imageModal?.currentUrl}
        currentThumbnail={imageModal?.id === 'article-cover' ? articleData.thumbnailUrl : undefined}
        currentPosition={imageModal?.id === 'article-cover' ? { x: articleData.imagePosX, y: articleData.imagePosY } : undefined}
        searchTerm={imageModal?.searchTerm}
        showThumbnail={imageModal?.id === 'article-cover'}
      />

      {/* ARTICLE MODAL - Full Article Builder */}
      {articleModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setArticleModal(null)}>
          <div className="bg-white rounded-lg w-[900px] max-w-[95vw] max-h-[90vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div>
                <h3 className="text-sm font-bold text-gray-900">✍ Create Article</h3>
                <p className="text-xs text-gray-500">{articleModal.firstname} {articleModal.lastname} · {articleModal.profession}</p>
              </div>
              <button onClick={() => setArticleModal(null)} className="p-1 hover:bg-gray-200 rounded">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Content - scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* AI Generation Options */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <h4 className="text-xs font-bold text-gray-700 mb-2">🤖 AI Generation</h4>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  <div>
                    <label className="text-[10px] text-gray-500">Focus</label>
                    <input
                      value={articleOptions.topic}
                      onChange={e => setArticleOptions({...articleOptions, topic: e.target.value})}
                      placeholder="Career..."
                      className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Language</label>
                    <select value={articleOptions.language} onChange={e => setArticleOptions({...articleOptions, language: e.target.value})} className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-900">
                      <option>English</option>
                      <option>Deutsch</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Length</label>
                    <select value={articleOptions.length} onChange={e => setArticleOptions({...articleOptions, length: e.target.value})} className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-900">
                      <option value="short (~150 words)">Short</option>
                      <option value="medium (~300 words)">Medium</option>
                      <option value="long (~600 words)">Long</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Style</label>
                    <select value={articleOptions.tone} onChange={e => setArticleOptions({...articleOptions, tone: e.target.value})} className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-900">
                      {AUTHOR_STYLES.map(style => (
                        <option key={style.id} value={style.id}>{style.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    value={articleOptions.extra}
                    onChange={e => setArticleOptions({...articleOptions, extra: e.target.value})}
                    placeholder="Extra instructions..."
                    className="flex-1 px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-900"
                  />
                  <button
                    onClick={generateArticle}
                    disabled={articleGenerating}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded disabled:opacity-50 flex items-center gap-1"
                  >
                    {articleGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : '⚡'}
                    {articleGenerating ? 'Generating...' : 'Generate'}
                  </button>
                </div>
              </div>

              {/* Cover Image */}
              <div className="flex gap-3">
                <div 
                  onClick={() => setImageModal({ id: 'article-cover', type: 'people', currentUrl: articleData.coverImage, searchTerm: `${articleModal.firstname} ${articleModal.lastname}` })}
                  className="w-32 h-20 rounded bg-gray-100 flex-shrink-0 cursor-pointer hover:opacity-80 overflow-hidden border border-gray-200"
                >
                  {articleData.coverImage ? (
                    <img 
                      src={articleData.coverImage} 
                      alt="Cover" 
                      className="w-full h-full object-cover" 
                      style={{ objectPosition: `${articleData.imagePosX ?? 50}% ${articleData.imagePosY ?? 50}%` }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">+ Cover</div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <label className="text-[10px] text-gray-500">Titel</label>
                    <input
                      value={articleData.title}
                      onChange={e => setArticleData({...articleData, title: e.target.value})}
                      placeholder="Article title..."
                      className="w-full px-2 py-1 bg-white border border-gray-200 rounded text-sm text-gray-900 font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Subtitle</label>
                    <input
                      value={articleData.subtitle}
                      onChange={e => setArticleData({...articleData, subtitle: e.target.value})}
                      placeholder="Subtitle..."
                      className="w-full px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-900"
                    />
                  </div>
                </div>
              </div>

              {/* Content - Block Editor */}
              <div>
                <div className="bg-white rounded border border-gray-200 overflow-hidden">
                  <BlockEditor
                    value={articleData.content}
                    onChange={(content: string) => setArticleData({...articleData, content})}
                  />
                </div>
              </div>

              {/* Tags & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500">Tags (comma-separated)</label>
                  <input
                    value={articleData.tags.join(', ')}
                    onChange={e => setArticleData({...articleData, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)})}
                    placeholder="Gen X, Music, ..."
                    className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">Category</label>
                  <select
                    value={articleData.category}
                    onChange={e => setArticleData({...articleData, category: e.target.value})}
                    className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-900"
                  >
                    <option value="history">History</option>
                    <option value="sports">Sport</option>
                    <option value="music">Music</option>
                    <option value="movies-tv">TV & Cinema</option>
                    <option value="gaming">Gaming & Tech</option>
                    <option value="lifestyle">Lifestyle & Culture</option>
                    <option value="news">Politics</option>
                    <option value="rip">RIP</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <div className="text-xs text-gray-500">
                {articleData.content ? `${articleData.content.split(' ').length} words` : 'No content yet'}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setArticleModal(null)} className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs rounded">
                  Cancel
                </button>
                <button
                  onClick={saveArticle}
                  disabled={articleSaving || !articleData.content || !articleData.title}
                  className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded disabled:opacity-50 flex items-center gap-1"
                >
                  {articleSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : '💾'}
                  {articleSaving ? 'Saving...' : 'Save as Article'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RANKROLL EDITOR - RankrollTab renders its own modal + overlay */}
      {rankrollEditorTopic && (
        <RankrollTab
          hideListView={true}
          initialNewTitle={rankrollEditorTopic}
          initialPersonRef={rankrollEditorPerson}
          onProposalHandled={() => {
            setRankrollEditorTopic(null);
            setRankrollEditorPerson(null);
            // Re-read from the server rather than ticking the marker locally: the
            // editor also closes on discard, where no ranking was actually saved.
            refreshRefs();
          }}
        />
      )}
      <ConfirmDialog />
    </div>
  );
}
