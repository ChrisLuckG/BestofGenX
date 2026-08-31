"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Loader2, Plus, Trash2, Search, X, ChevronDown, ChevronRight,
  User, Gamepad2, Film, Music, Disc3, Tv, UtensilsCrossed, Car, 
  Shirt, Smartphone, Package, MessageCircle, Image, Globe, FileText, Pencil
} from "lucide-react";
import ImagePickerModal from "./ImagePickerModal";
import BlockEditor from "./BlockEditor";
import { AUTHOR_STYLES, DEFAULT_AUTHOR_STYLE } from "@/config/authorStyles";

// Category configuration
const CATEGORIES = [
  { id: 'people', label: 'Best of GenX', icon: User, emoji: '👤' },
  { id: 'games', label: 'Games', icon: Gamepad2, emoji: '🎮' },
  { id: 'movies', label: 'Movies', icon: Film, emoji: '🎬' },
  { id: 'bands', label: 'Bands', icon: Music, emoji: '🎸' },
  { id: 'albums', label: 'Albums', icon: Disc3, emoji: '💿' },
  { id: 'tvseries', label: 'TV Series', icon: Tv, emoji: '📺' },
  { id: 'food', label: 'Food', icon: UtensilsCrossed, emoji: '🍕' },
  { id: 'cars', label: 'Cars', icon: Car, emoji: '🚗' },
  { id: 'fashion', label: 'Fashion', icon: Shirt, emoji: '👟' },
  { id: 'gadgets', label: 'Gadgets', icon: Smartphone, emoji: '📟' },
  { id: 'toys', label: 'Toys', icon: Package, emoji: '🧸' },
  { id: 'slang', label: 'Slang', icon: MessageCircle, emoji: '🤙' },
] as const;

type CategoryId = typeof CATEGORIES[number]['id'];

// Profession options for people
const PROFESSIONS = ['Music', 'Actor', 'Sport', 'Politik', 'Art', 'Tech', 'Comedy', 'Model', 'Other'];

// All countries of the world
const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Australia', 'Austria',
  'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan',
  'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon',
  'Canada', 'Cape Verde', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo', 'Costa Rica',
  'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'East Timor', 'Ecuador',
  'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France',
  'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau',
  'Guyana', 'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland',
  'Israel', 'Italy', 'Ivory Coast', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Kosovo',
  'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania',
  'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius',
  'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia',
  'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway',
  'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland',
  'Portugal', 'Puerto Rico', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent', 'Samoa',
  'San Marino', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands',
  'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland',
  'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey',
  'Turkmenistan', 'Tuvalu', 'Uganda', 'UK', 'Ukraine', 'United Arab Emirates', 'Uruguay', 'USA', 'Uzbekistan', 'Vanuatu',
  'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
];

// Profession badge colors
const PROF_COLORS: Record<string, string> = {
  Music: 'bg-yellow-200 text-yellow-800',
  Actor: 'bg-blue-200 text-blue-800',
  Sport: 'bg-green-200 text-green-800',
  Politik: 'bg-red-200 text-red-800',
  Art: 'bg-purple-200 text-purple-800',
  Tech: 'bg-orange-200 text-orange-800',
  Comedy: 'bg-yellow-100 text-yellow-700',
  Model: 'bg-pink-200 text-pink-800',
  Other: 'bg-gray-200 text-gray-700',
};

// Category-specific field definitions
const CATEGORY_FIELDS: Record<string, { key: string; label: string; type?: string }[]> = {
  games: [
    { key: 'title', label: 'Titel' },
    { key: 'year', label: 'Jahr', type: 'number' },
    { key: 'platform', label: 'Platform' },
    { key: 'genre', label: 'Genre' },
    { key: 'publisher', label: 'Publisher' },
    { key: 'country', label: 'Land' },
    { key: 'notes', label: 'Notizen' },
  ],
  movies: [
    { key: 'title', label: 'Titel' },
    { key: 'year', label: 'Jahr', type: 'number' },
    { key: 'director', label: 'Regisseur' },
    { key: 'genre', label: 'Genre' },
    { key: 'country', label: 'Land' },
    { key: 'cast', label: 'Cast' },
    { key: 'notes', label: 'Notizen' },
  ],
  bands: [
    { key: 'name', label: 'Name' },
    { key: 'founded', label: 'Founded', type: 'number' },
    { key: 'disbanded', label: 'Disbanded', type: 'number' },
    { key: 'genre', label: 'Genre' },
    { key: 'country', label: 'Land' },
    { key: 'members', label: 'Mitglieder' },
    { key: 'album', label: 'Top Album' },
    { key: 'label', label: 'Label' },
    { key: 'notes', label: 'Notizen' },
  ],
  albums: [
    { key: 'title', label: 'Titel' },
    { key: 'artist', label: 'Artist' },
    { key: 'year', label: 'Jahr', type: 'number' },
    { key: 'genre', label: 'Genre' },
    { key: 'country', label: 'Land' },
    { key: 'label', label: 'Label' },
    { key: 'track', label: 'Top Track' },
    { key: 'notes', label: 'Notizen' },
  ],
  tvseries: [
    { key: 'title', label: 'Titel' },
    { key: 'from', label: 'Von', type: 'number' },
    { key: 'to', label: 'Bis', type: 'number' },
    { key: 'genre', label: 'Genre' },
    { key: 'network', label: 'Sender' },
    { key: 'country', label: 'Land' },
    { key: 'seasons', label: 'Staffeln', type: 'number' },
    { key: 'cast', label: 'Cast' },
    { key: 'notes', label: 'Notizen' },
  ],
  food: [
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category' },
    { key: 'origin', label: 'Herkunft' },
    { key: 'brand', label: 'Marke/Kette' },
    { key: 'decade', label: 'Dekade' },
    { key: 'ingredients', label: 'Zutaten' },
    { key: 'recipe', label: 'Rezept-Link' },
    { key: 'notes', label: 'Notizen' },
  ],
  cars: [
    { key: 'model', label: 'Modell' },
    { key: 'brand', label: 'Marke' },
    { key: 'year', label: 'Jahr', type: 'number' },
    { key: 'country', label: 'Land' },
    { key: 'hp', label: 'PS', type: 'number' },
    { key: 'type', label: 'Typ' },
    { key: 'notes', label: 'Notizen' },
  ],
  fashion: [
    { key: 'name', label: 'Name' },
    { key: 'brand', label: 'Marke' },
    { key: 'category', label: 'Category' },
    { key: 'country', label: 'Land' },
    { key: 'decade', label: 'Dekade' },
    { key: 'subculture', label: 'Subkultur' },
    { key: 'notes', label: 'Notizen' },
  ],
  gadgets: [
    { key: 'name', label: 'Name' },
    { key: 'brand', label: 'Marke' },
    { key: 'year', label: 'Jahr', type: 'number' },
    { key: 'category', label: 'Category' },
    { key: 'country', label: 'Land' },
    { key: 'price', label: 'Preis (UVP)' },
    { key: 'notes', label: 'Notizen' },
  ],
  toys: [
    { key: 'name', label: 'Name' },
    { key: 'brand', label: 'Marke' },
    { key: 'year', label: 'Jahr', type: 'number' },
    { key: 'category', label: 'Category' },
    { key: 'country', label: 'Land' },
    { key: 'tv', label: 'TV-Serie' },
    { key: 'notes', label: 'Notizen' },
  ],
  slang: [
    { key: 'term', label: 'Begriff' },
    { key: 'meaning', label: 'Bedeutung' },
    { key: 'category', label: 'Category' },
    { key: 'origin', label: 'Herkunft' },
    { key: 'decade', label: 'Dekade' },
    { key: 'example', label: 'Beispiel' },
    { key: 'notes', label: 'Notizen' },
  ],
};

interface Person {
  _id: string;
  firstname: string;
  lastname: string;
  born?: string;
  died?: string;
  causeOfDeath?: string;
  profession: string;
  subcat?: string;
  knownfor?: string;
  countryBorn?: string;
  cityBorn?: string;
  countryDied?: string;
  cityDied?: string;
  nationality?: string;
  parents?: string;
  siblings?: number;
  image?: string;
  social?: Record<string, string>;
  savedNews?: any[];
  // Article tracking
  hasArticle?: boolean;
  articleId?: string;
  articleCreatedAt?: string;
}

interface AlmanacItem {
  _id: string;
  category: string;
  rank?: number;
  image?: string;
  data: Record<string, any>;
}

interface MenschenTabProps {
  userId?: string;
}

export default function MenschenTab({ userId }: MenschenTabProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryId>('people');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [professionFilter, setProfessionFilter] = useState('');
  const [aliveFilter, setAliveFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [sortBy, setSortBy] = useState<'birthday' | 'name' | 'age' | 'country' | 'profession'>('birthday');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'table' | 'byDate'>('table');
  const [monthFilter, setMonthFilter] = useState<number>(new Date().getMonth() + 1); // 1-12, default current month
  
  // Data
  const [people, setPeople] = useState<Person[]>([]);
  const [items, setItems] = useState<AlmanacItem[]>([]);
  const [personArticles, setPersonArticles] = useState<Record<string, { title: string; createdAt: string }>>({});
  
  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState<string[]>([]);
  const [generateAmount, setGenerateAmount] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [updating, setUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<string[]>([]);
  
  // Modals
  const [imageModal, setImageModal] = useState<{ id: string; type: 'people' | 'items'; currentUrl?: string; searchTerm?: string } | null>(null);
  const [articleModal, setArticleModal] = useState<Person | null>(null);
  const [articleGenerating, setArticleGenerating] = useState(false);
  const [articleSaving, setArticleSaving] = useState(false);
  const [articleIsItem, setArticleIsItem] = useState(false);
  const [articleData, setArticleData] = useState({
    title: '',
    subtitle: '',
    content: '',
    tags: [] as string[],
    category: 'culture',
    coverImage: '',
    thumbnailUrl: '',
  });
  const [articleOptions, setArticleOptions] = useState({
    topic: '',
    language: 'English',
    length: 'medium (~300 words)',
    tone: 'informative',
    timeframe: 'alltime',
    extra: '',
  });
  const [socialModal, setSocialModal] = useState<Person | null>(null);
  const [socialData, setSocialData] = useState<Record<string, string>>({});
  const [editModal, setEditModal] = useState<Person | null>(null);
  const [editData, setEditData] = useState<Partial<Person>>({});

  // Calculate country counts from loaded people
  const countryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    people.forEach(p => {
      const country = p.countryBorn || 'Unknown';
      counts[country] = (counts[country] || 0) + 1;
    });
    return counts;
  }, [people]);

  // Get countries sorted by count (descending), only those with people
  const countriesWithCounts = useMemo(() => {
    return Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([country, count]) => ({ country, count }));
  }, [countryCounts]);

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: activeCategory });
      if (search) params.set('search', search);
      if (activeCategory === 'people' && professionFilter) {
        params.set('filter', 'profession');
        params.set('filterValue', professionFilter);
      }
      if (activeCategory === 'people' && countryFilter) {
        params.set('countryBorn', countryFilter);
      }
      if (activeCategory === 'people' && aliveFilter) {
        params.set('aliveStatus', aliveFilter);
      }
      if (activeCategory === 'people' && monthFilter > 0) {
        params.set('birthMonth', monthFilter.toString());
      }
      
      const res = await fetch(`/api/almanac?${params}`);
      const data = await res.json();
      
      if (data.success) {
        if (activeCategory === 'people') {
          setPeople(data.data);
        } else {
          setItems(data.data);
        }
      }
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeCategory, professionFilter, countryFilter, aliveFilter, monthFilter]);

  // Fetch article refs for people
  useEffect(() => {
    if (activeCategory !== 'people') return;
    fetch('/api/articles?personRefs=true')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const map: Record<string, { title: string; createdAt: string }> = {};
          data.data.forEach((a: any) => {
            if (a.personRef) map[a.personRef.toString()] = { title: a.title, createdAt: a.createdAt };
          });
          setPersonArticles(map);
        }
      })
      .catch(() => {});
  }, [activeCategory]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Calculate age
  const calcAge = (born?: string, died?: string) => {
    if (!born) return '';
    const end = died ? new Date(died) : new Date();
    const b = new Date(born);
    let age = end.getFullYear() - b.getFullYear();
    const m = end.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && end.getDate() < b.getDate())) age--;
    return age;
  };

  // Format date
  const fmtDate = (d?: string) => {
    if (!d) return '—';
    const date = new Date(d);
    // Check if date is valid
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('de-DE');
  };

  // Sort people
  const sortedPeople = [...people].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    
    switch (sortBy) {
      case 'name':
        return dir * (`${a.lastname} ${a.firstname}`).localeCompare(`${b.lastname} ${b.firstname}`);
      
      case 'age':
        const ageA = calcAge(a.born, a.died) || 0;
        const ageB = calcAge(b.born, b.died) || 0;
        return dir * (ageA - ageB);
      
      case 'country':
        return dir * (a.countryBorn || '').localeCompare(b.countryBorn || '');
      
      case 'profession':
        return dir * (a.profession || '').localeCompare(b.profession || '');
      
      case 'birthday':
      default:
        // Sort by upcoming birthday
        if (!a.born && !b.born) return 0;
        if (!a.born) return 1;
        if (!b.born) return -1;
        
        const today = new Date();
        const getDaysUntil = (born: string) => {
          const d = new Date(born);
          const thisYear = new Date(today.getFullYear(), d.getMonth(), d.getDate());
          const nextYear = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
          const target = thisYear >= today ? thisYear : nextYear;
          return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        };
        
        return dir * (getDaysUntil(a.born) - getDaysUntil(b.born));
    }
  });

  // Toggle sort
  const toggleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  // Sort header component
  const SortHeader = ({ column, children }: { column: typeof sortBy; children: React.ReactNode }) => (
    <th 
      className="px-2 py-2 text-left text-gray-300 cursor-pointer hover:text-white select-none"
      onClick={() => toggleSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortBy === column && (
          <span className="text-purple-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </th>
  );

  // Add new item
  const handleAdd = async () => {
    if (activeCategory === 'people' && formData.born) {
      const year = parseInt(formData.born.substring(0, 4));
      if (year < 1960 || year > 1981) {
        alert(`⚠️ This is a GenX page! Birthday must be between 1960 and 1981. Got: ${year}`);
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch('/api/almanac', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activeCategory, ...formData }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddForm(false);
        setFormData({});
        fetchData();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e) {
      console.error('Add error:', e);
    } finally {
      setSaving(false);
    }
  };

  // Delete item
  const handleDelete = async (id: string) => {
    if (!confirm('Really delete this entry?')) return;
    try {
      await fetch(`/api/almanac?type=${activeCategory}&id=${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) {
      console.error('Delete error:', e);
    }
  };

  // Toggle selection
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // Select all visible
  const selectAll = () => {
    const allIds = activeCategory === 'people' 
      ? people.map(p => p._id)
      : items.map(i => i._id);
    setSelectedIds(new Set(allIds));
  };

  // Deselect all
  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Delete selected
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Really delete ${selectedIds.size} entries?`)) return;
    
    try {
      const idsArray = Array.from(selectedIds);
      for (const id of idsArray) {
        await fetch(`/api/almanac?type=${activeCategory}&id=${id}`, { method: 'DELETE' });
      }
      setSelectedIds(new Set());
      fetchData();
    } catch (e) {
      console.error('Bulk delete error:', e);
    }
  };

  const currentCat = CATEGORIES.find(c => c.id === activeCategory);

  

  // Open image modal
  const openImageModal = (id: string, type: 'people' | 'items', currentUrl?: string, searchTerm?: string) => {
    setImageModal({ id, type, currentUrl, searchTerm });
  };

  // Save image (called from ImagePickerModal)
  const saveImage = async (imageUrl: string, _position?: { x: number; y: number }, thumbnailUrl?: string) => {
    if (!imageModal) return;
    
    // Special case: article cover image
    if (imageModal.id === 'article-cover') {
      setArticleData(prev => ({ 
        ...prev, 
        coverImage: imageUrl,
        thumbnailUrl: thumbnailUrl || imageUrl // Use thumbnail if provided, else use cover
      }));
      setImageModal(null);
      return;
    }
    
    try {
      await fetch('/api/almanac', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: imageModal.type === 'people' ? 'people' : activeCategory,
          id: imageModal.id,
          image: imageUrl,
        }),
      });
      setImageModal(null);
      fetchData();
    } catch (e) {
      console.error('Save image error:', e);
    }
  };

  // Open article modal (person)
  const openArticleModal = (person: Person) => {
    setArticleIsItem(false);
    setArticleModal(person);
    setArticleData({
      title: '',
      subtitle: '',
      content: '',
      tags: [person.profession, 'Gen X', person.countryBorn || ''].filter(Boolean),
      category: 'culture',
      coverImage: person.image || '',
      thumbnailUrl: person.image || '',
    });
    setArticleOptions({
      topic: '',
      language: 'English',
      length: 'medium (~300 words)',
      tone: 'informative',
      timeframe: 'alltime',
      extra: '',
    });
  };

  // Open article modal (almanac item: band, game, movie etc.)
  const openItemArticleModal = (item: AlmanacItem) => {
    const name = item.data?.title || item.data?.name || item.data?.term || item.data?.model || 'Item';
    const catLabel = CATEGORIES.find(c => c.id === item.category)?.label || item.category;
    const details = Object.entries(item.data || {}).filter(([k]) => k !== 'notes').map(([_, v]) => String(v)).filter(Boolean).join(', ');
    const fakePerson: Person = {
      _id: item._id,
      firstname: name,
      lastname: '',
      profession: catLabel,
      knownfor: details,
      image: item.image,
    };
    setArticleIsItem(true);
    setArticleModal(fakePerson);
    setArticleData({
      title: '',
      subtitle: '',
      content: '',
      tags: [catLabel, 'Gen X'].filter(Boolean),
      category: 'culture',
      coverImage: item.image || '',
      thumbnailUrl: item.image || '',
    });
    setArticleOptions({
      topic: '',
      language: 'English',
      length: 'medium (~300 words)',
      tone: 'informative',
      timeframe: 'alltime',
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
          isItem: articleIsItem,
          itemCategory: articleIsItem ? activeCategory : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Parse AI response and fill article data
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

  // Save article to Articles collection
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
          thumbnailUrl: articleData.thumbnailUrl || articleData.coverImage, // Use separate thumbnail if set
          tags: articleData.tags,
          category: articleData.category,
          status: 'published', // Directly published!
          contentType: 'article',
          personRef: articleModal._id,
          autoGenerated: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ Article saved! You can find it in the Articles tab.');
        setArticleModal(null);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e) {
      alert('Error saving article');
    } finally {
      setArticleSaving(false);
    }
  };

  // Open social modal
  const openSocialModal = (person: Person) => {
    setSocialModal(person);
    setSocialData(person.social || {});
  };

  // Auto-search social media links
  const [searchingSocial, setSearchingSocial] = useState(false);
  
  const autoSearchSocial = async () => {
    if (!socialModal) return;
    setSearchingSocial(true);
    
    try {
      const res = await fetch('/api/almanac/search-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: `${socialModal.firstname} ${socialModal.lastname}`,
          profession: socialModal.profession,
        }),
      });
      const data = await res.json();
      
      if (data.success && data.social) {
        // Merge with existing data (don't overwrite existing entries)
        setSocialData(prev => ({
          ...data.social,
          ...Object.fromEntries(Object.entries(prev).filter(([_, v]) => v)), // Keep existing non-empty
        }));
      }
    } catch (e) {
      console.error('Social search error:', e);
    } finally {
      setSearchingSocial(false);
    }
  };

  // Save social
  const saveSocial = async () => {
    if (!socialModal) return;
    try {
      await fetch('/api/almanac', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'people',
          id: socialModal._id,
          social: socialData,
        }),
      });
      setSocialModal(null);
      fetchData();
    } catch (e) {
      console.error('Save social error:', e);
    }
  };

  // Open edit modal
  const openEditModal = (person: Person) => {
    setEditModal(person);
    setEditData({
      firstname: person.firstname,
      lastname: person.lastname,
      born: person.born,
      died: person.died || '',
      causeOfDeath: person.causeOfDeath || '',
      profession: person.profession,
      countryBorn: person.countryBorn || '',
      cityBorn: person.cityBorn || '',
      countryDied: person.countryDied || '',
      cityDied: person.cityDied || '',
      knownfor: person.knownfor || '',
    });
  };

  // Save edit
  const saveEdit = async () => {
    if (!editModal) return;
    try {
      await fetch('/api/almanac', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'people',
          id: editModal._id,
          ...editData,
        }),
      });
      setEditModal(null);
      fetchData();
    } catch (e) {
      console.error('Save edit error:', e);
    }
  };

  // Update from Wikidata - fetch missing data for next 50 people (streaming)
  const runWikidataUpdate = async () => {
    setUpdating(true);
    setUpdateProgress([]);
    
    try {
      const res = await fetch('/api/almanac/update-from-wikidata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 50, month: monthFilter || undefined }),
      });
      
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        setUpdateProgress(['❌ No response']);
        setUpdating(false);
        return;
      }
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(l => l.startsWith('data: '));
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line.substring(6));
            
            if (data.type === 'processing') {
              setUpdateProgress(prev => {
                const filtered = prev.filter(p => !p.startsWith('🔄'));
                return [...filtered, `🔄 [${data.index}/${data.total}] ${data.name}...`];
              });
            } else if (data.type === 'updated') {
              setUpdateProgress(prev => {
                const filtered = prev.filter(p => !p.startsWith('🔄'));
                return [...filtered, `✅ ${data.name}: ${data.fields.join(', ')}`];
              });
            } else if (data.type === 'not_found_marked') {
              setUpdateProgress(prev => {
                const filtered = prev.filter(p => !p.startsWith('🔄'));
                return [...filtered, `⚠️ ${data.name}: Unknown`];
              });
            } else if (data.type === 'marked_unknown') {
              setUpdateProgress(prev => {
                const filtered = prev.filter(p => !p.startsWith('🔄'));
                return [...filtered, `⚠️ ${data.name}: Unknown (no city)`];
              });
            } else if (data.type === 'image_only') {
              setUpdateProgress(prev => {
                const filtered = prev.filter(p => !p.startsWith('🔄'));
                return [...filtered, `📷 ${data.name}: image found`];
              });
            } else if (data.type === 'done') {
              setUpdateProgress(prev => [...prev, `\n📊 Done! Updated: ${data.updated}/${data.total}`]);
              fetchData();
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    } catch (e) {
      console.error('Wikidata update error:', e);
      setUpdateProgress(prev => [...prev, `❌ Error: ${(e as Error).message}`]);
    } finally {
      setUpdating(false);
    }
  };

  // AI Generate 10 entries with live progress
  const handleGenerate = async (categoryToGenerate: string, skipDuplicateCheck = false) => {
    const cat = CATEGORIES.find(c => c.id === categoryToGenerate);
    
    // Build filter description for confirmation
    const filters = [];
    if (categoryToGenerate === 'people' && professionFilter) filters.push(professionFilter);
    if (categoryToGenerate === 'people' && countryFilter) filters.push(countryFilter);
    const filterText = filters.length > 0 ? ` (${filters.join(', ')})` : '';
    
    const msg = skipDuplicateCheck 
      ? `Generate ${generateAmount} new ${cat?.label || categoryToGenerate}${filterText} entries (WITHOUT duplicate check)?`
      : `Generate ${generateAmount} new ${cat?.label || categoryToGenerate}${filterText} entries with AI?`;
    if (!confirm(msg)) return;
    
    setGenerating(true);
    setGenerateProgress([]);
    
    try {
      const res = await fetch('/api/almanac/generate-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          category: categoryToGenerate, 
          skipDuplicateCheck,
          targetCount: generateAmount,
          profession: categoryToGenerate === 'people' ? professionFilter : undefined,
          country: categoryToGenerate === 'people' ? countryFilter : undefined,
          alive: categoryToGenerate === 'people' ? aliveFilter : undefined,
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n').filter(line => line.startsWith('data: '));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'status') {
              setGenerateProgress(prev => [...prev, data.message]);
            } else if (data.type === 'progress') {
              const stepText = data.step === 'check' ? '🔍 Checking' 
                : data.step === 'image' ? '📷 Finding image' 
                : '💾 Saving';
              setGenerateProgress(prev => {
                const filtered = prev.filter(p => !p.includes(`[${data.current}/`));
                return [...filtered, `[${data.current}/${data.total}] ${stepText}: ${data.name}`];
              });
            } else if (data.type === 'saved') {
              setGenerateProgress(prev => [...prev.slice(-5), `✅ ${data.name} saved${data.image ? ' (with image)' : ''}`]);
            } else if (data.type === 'skip') {
              setGenerateProgress(prev => [...prev.slice(-5), `⏭️ ${data.name} skipped (${data.reason})`]);
            } else if (data.type === 'done') {
              setGenerateProgress(prev => [...prev, `\n🎉 Done! ${data.saved} saved, ${data.skipped} skipped`]);
              fetchData();
            } else if (data.type === 'error') {
              setGenerateProgress(prev => [...prev, `❌ Error: ${data.message}`]);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    } catch (e) {
      console.error('Generate error:', e);
      setGenerateProgress(prev => [...prev, '❌ Generation failed']);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Category Tabs - horizontal */}
      <div className="flex items-center gap-1 px-2 py-2 bg-gray-800 border-b border-gray-700 overflow-x-auto flex-shrink-0">
        <span className="text-sm font-bold text-white mr-2">🎸</span>
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => {
              setActiveCategory(cat.id);
              setSearch('');
              setProfessionFilter('');
              setShowAddForm(false);
              setSelectedIds(new Set());
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat.id 
                ? 'bg-[#E36B11] text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-lg">{currentCat?.emoji}</span>
            <h2 className="text-sm font-bold text-white">{currentCat?.label}</h2>
            <span className="text-xs text-gray-400">
              {activeCategory === 'people' ? people.length : items.length} entries
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="pl-7 pr-2 py-1 w-40 bg-gray-700 border border-gray-600 rounded text-xs text-white placeholder-gray-500"
              />
            </div>
            
            {/* Filters for people */}
            {activeCategory === 'people' && (
              <>
                <select
                  value={professionFilter}
                  onChange={e => setProfessionFilter(e.target.value)}
                  className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                >
                  <option value="">All Professions</option>
                  {PROFESSIONS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <select
                  value={aliveFilter}
                  onChange={e => setAliveFilter(e.target.value)}
                  className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                >
                  <option value="">All</option>
                  <option value="alive">Alive</option>
                  <option value="deceased">Deceased</option>
                </select>
                <select
                  value={countryFilter}
                  onChange={e => setCountryFilter(e.target.value)}
                  className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white min-w-[180px]"
                >
                  <option value="">All Countries ({people.length})</option>
                  {countriesWithCounts.map(({ country, count }) => (
                    <option key={country} value={country}>{country} ({count})</option>
                  ))}
                </select>
                <select
                  value={monthFilter}
                  onChange={e => setMonthFilter(parseInt(e.target.value))}
                  className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                >
                  <option value={0}>All Months</option>
                  <option value={1}>January</option>
                  <option value={2}>February</option>
                  <option value={3}>March</option>
                  <option value={4}>April</option>
                  <option value={5}>May</option>
                  <option value={6}>June</option>
                  <option value={7}>July</option>
                  <option value={8}>August</option>
                  <option value={9}>September</option>
                  <option value={10}>October</option>
                  <option value={11}>November</option>
                  <option value={12}>December</option>
                </select>
                
                {/* View Mode Toggle */}
                <div className="flex items-center bg-gray-700 rounded overflow-hidden border border-gray-600">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-2 py-1 text-xs font-medium ${viewMode === 'table' ? 'bg-[#E36B11] text-white' : 'text-gray-300 hover:bg-gray-600'}`}
                  >
                    📋 Table
                  </button>
                  <button
                    onClick={() => setViewMode('byDate')}
                    className={`px-2 py-1 text-xs font-medium ${viewMode === 'byDate' ? 'bg-[#E36B11] text-white' : 'text-gray-300 hover:bg-gray-600'}`}
                  >
                    📅 By Date
                  </button>
                </div>
              </>
            )}
            
            {/* Add button */}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
            
            {/* Bulk actions */}
            {selectedIds.size > 0 && (
              <>
                <div className="w-px h-5 bg-gray-600 mx-1" />
                <span className="text-xs text-gray-400">{selectedIds.size} selected</span>
                <button
                  onClick={deselectAll}
                  className="px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded"
                >
                  Deselect
                </button>
                <button
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </>
            )}
            
            {/* Update button - fetch missing data from Wikidata */}
            {activeCategory === 'people' && (
              <div className="relative">
                <button
                  onClick={runWikidataUpdate}
                  disabled={updating}
                  className={`flex items-center gap-1 px-2 py-1 text-white text-xs font-bold rounded disabled:opacity-50 ${
                    updating 
                      ? 'bg-blue-500 animate-pulse' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                  title="Update next 50 people with missing data from Wikidata"
                >
                  {updating ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <span>�</span>
                      <span>Update 50</span>
                    </>
                  )}
                </button>
                
                {/* Progress popup */}
                {(updating || updateProgress.length > 0) && (
                  <div className="absolute right-0 top-full mt-1 w-96 bg-gray-900 border border-blue-500 rounded-lg shadow-xl z-50 p-3">
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-700">
                      <Loader2 className={`w-4 h-4 text-blue-400 ${updating ? 'animate-spin' : ''}`} />
                      <span className="text-sm font-bold text-white">
                        {updating ? 'Fetching from Wikidata...' : 'Done!'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-300 space-y-1 max-h-48 overflow-y-auto">
                      {updateProgress.map((msg, i) => (
                        <div key={i} className={
                          msg.startsWith('✅') ? 'text-green-400' : 
                          msg.startsWith('❌') ? 'text-red-400' : 
                          msg.startsWith('🔄') ? 'text-blue-400 animate-pulse' : ''
                        }>
                          {msg}
                        </div>
                      ))}
                    </div>
                    {!updating && updateProgress.length > 0 && (
                      <button 
                        onClick={() => setUpdateProgress([])}
                        className="mt-2 w-full py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300"
                      >
                        Close
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>



        {/* Add form */}
        {showAddForm && (
          <div className="px-4 py-3 bg-gray-750 border-b border-gray-700">
            <h3 className="text-xs font-bold text-white mb-2">Add New Entry</h3>
            
            {activeCategory === 'people' ? (
              <div className="grid grid-cols-7 gap-2">
                <input placeholder="First Name *" value={formData.firstname || ''} onChange={e => setFormData({...formData, firstname: e.target.value})} className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white" />
                <input placeholder="Last Name *" value={formData.lastname || ''} onChange={e => setFormData({...formData, lastname: e.target.value})} className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white" />
                <input type="date" placeholder="Birthday" min="1960-01-01" max="1981-12-31" value={formData.born || ''} onChange={e => setFormData({...formData, born: e.target.value})} className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white" />
                <input type="date" placeholder="Death Date" value={formData.died || ''} onChange={e => setFormData({...formData, died: e.target.value})} className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white" />
                <input placeholder="Cause of Death" value={formData.causeOfDeath || ''} onChange={e => setFormData({...formData, causeOfDeath: e.target.value})} className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white" />
                <select value={formData.profession || ''} onChange={e => setFormData({...formData, profession: e.target.value})} className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white">
                  <option value="">Profession *</option>
                  {PROFESSIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input placeholder="Subkategorie" value={formData.subcat || ''} onChange={e => setFormData({...formData, subcat: e.target.value})} className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white" />
                <input placeholder="Known For" value={formData.knownfor || ''} onChange={e => setFormData({...formData, knownfor: e.target.value})} className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white" />
                <input placeholder="Birth Country" value={formData.countryBorn || ''} onChange={e => setFormData({...formData, countryBorn: e.target.value})} className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white" />
                <input placeholder="Birth City" value={formData.cityBorn || ''} onChange={e => setFormData({...formData, cityBorn: e.target.value})} className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white" />
                <input placeholder="Death Country" value={formData.countryDied || ''} onChange={e => setFormData({...formData, countryDied: e.target.value})} className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white" />
                <input placeholder="Nationality" value={formData.nationality || ''} onChange={e => setFormData({...formData, nationality: e.target.value})} className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white" />
              </div>
            ) : (
              <div className="grid grid-cols-6 gap-2">
                {CATEGORY_FIELDS[activeCategory]?.map(field => (
                  <input
                    key={field.key}
                    type={field.type || 'text'}
                    placeholder={field.label}
                    value={formData[field.key] || ''}
                    onChange={e => setFormData({...formData, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value})}
                    className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                  />
                ))}
              </div>
            )}
            
            <div className="flex gap-2 mt-2">
              <button onClick={handleAdd} disabled={saving} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded disabled:opacity-50">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
              </button>
              <button onClick={() => { setShowAddForm(false); setFormData({}); }} className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Table or By Date View */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-[#E36B11] animate-spin" />
            </div>
          ) : activeCategory === 'people' && viewMode === 'byDate' ? (
            /* BY DATE VIEW */
            <div className="p-4 space-y-4">
              {(() => {
                // Group people by birthday (MM-DD)
                const grouped: Record<string, Person[]> = {};
                people.forEach(p => {
                  if (!p.born) return;
                  const mmdd = p.born.substring(5); // "MM-DD"
                  if (!grouped[mmdd]) grouped[mmdd] = [];
                  grouped[mmdd].push(p);
                });
                
                // Sort dates - today first, then descending (most recent first)
                const today = new Date();
                const todayMMDD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                
                const sortedDates = Object.keys(grouped).sort((a, b) => {
                  // Today always first
                  if (a === todayMMDD) return -1;
                  if (b === todayMMDD) return 1;
                  // Then sort descending by date (31, 30, 29...)
                  return b.localeCompare(a);
                });
                
                return sortedDates.map(mmdd => {
                  const [mm, dd] = mmdd.split('-');
                  const dateLabel = `${dd}.${mm}.`;
                  const isToday = mmdd === todayMMDD;
                  const peopleThatDay = grouped[mmdd].sort((a, b) => 
                    `${a.lastname} ${a.firstname}`.localeCompare(`${b.lastname} ${b.firstname}`)
                  );
                  
                  return (
                    <div key={mmdd} className={`rounded-lg border ${isToday ? 'border-[#E36B11] bg-[#E36B11]/10' : 'border-gray-700 bg-gray-800/50'}`}>
                      <div className={`px-4 py-2 font-bold text-sm flex items-center gap-2 ${isToday ? 'text-[#E36B11]' : 'text-white'}`}>
                        <span className="text-lg">{isToday ? '🎂' : '📅'}</span>
                        <span>{dateLabel}</span>
                        <span className="text-xs font-normal text-gray-400">({peopleThatDay.length} {peopleThatDay.length === 1 ? 'person' : 'people'})</span>
                        {isToday && <span className="ml-2 px-2 py-0.5 bg-[#E36B11] text-white text-[10px] rounded-full">TODAY</span>}
                      </div>
                      <div className="px-4 pb-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                        {peopleThatDay.map(p => {
                          const hasArticleNow = p.hasArticle || personArticles[p._id];
                          const year = p.born ? parseInt(p.born.substring(0, 4)) : null;
                          
                          return (
                            <div 
                              key={p._id} 
                              className={`flex items-center gap-2 p-2 rounded-lg border ${hasArticleNow ? 'border-green-600/50 bg-green-900/20' : 'border-gray-600 bg-gray-700/50'} ${p.died ? 'opacity-60' : ''}`}
                            >
                              {/* Image */}
                              <div 
                                onClick={() => openImageModal(p._id, 'people', p.image, `${p.firstname} ${p.lastname}`)}
                                className="cursor-pointer hover:opacity-80 flex-shrink-0"
                              >
                                {p.image ? (
                                  <img src={p.image} alt="" className="w-10 h-10 rounded-full object-cover border border-gray-500" />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-gray-400 text-xs border border-dashed border-gray-500">
                                    ?
                                  </div>
                                )}
                              </div>
                              
                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-white text-sm truncate">
                                  {p.firstname} {p.lastname}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                  {year && <span>{year}</span>}
                                  <span className={`px-1 py-0.5 rounded ${PROF_COLORS[p.profession] || PROF_COLORS.Other}`}>
                                    {p.profession}
                                  </span>
                                  {p.cityBorn && <span className="text-blue-300">{p.cityBorn}</span>}
                                  {p.countryBorn && <span>{p.countryBorn}</span>}
                                </div>
                              </div>
                              
                              {/* Article Button */}
                              <div className="flex-shrink-0">
                                {hasArticleNow ? (
                                  <span className="text-green-400 text-lg" title="Article exists">✅</span>
                                ) : (
                                  <button 
                                    onClick={() => openArticleModal(p)}
                                    className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold rounded"
                                    title="Write article"
                                  >
                                    ✏️ Write
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : activeCategory === 'people' ? (
            /* TABLE VIEW */
            <table className="w-full text-xs">
              <thead className="bg-gray-700 sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-center text-gray-300 w-8">
                    <input 
                      type="checkbox" 
                      checked={people.length > 0 && selectedIds.size === people.length}
                      onChange={() => selectedIds.size === people.length ? deselectAll() : selectAll()}
                      className="w-3 h-3 cursor-pointer"
                    />
                  </th>
                  <th className="px-2 py-2 text-left text-gray-300 w-8">#</th>
                  <th className="px-2 py-2 text-left text-gray-300 w-10">Image</th>
                  <SortHeader column="name">Name</SortHeader>
                  <SortHeader column="birthday">Birthday</SortHeader>
                  <SortHeader column="age">Age</SortHeader>
                  <SortHeader column="country">Country</SortHeader>
                  <th className="px-2 py-2 text-left text-gray-300">City</th>
                  <SortHeader column="profession">Profession</SortHeader>
                  <th className="px-2 py-2 text-left text-gray-300">Death Date</th>
                  <th className="px-2 py-2 text-left text-gray-300">Cause of Death</th>
                  <th className="px-2 py-2 text-left text-gray-300">Death Country</th>
                  <th className="px-2 py-2 text-left text-gray-300">Article</th>
                  <th className="px-2 py-2 text-left text-gray-300 w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedPeople.map((p, i) => (
                  <tr key={p._id} className={`border-t border-gray-700 hover:bg-gray-750 ${p.died ? 'opacity-60' : ''} ${selectedIds.has(p._id) ? 'bg-purple-900/30' : ''}`}>
                    <td className="px-2 py-1 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(p._id)}
                        onChange={() => toggleSelect(p._id)}
                        className="w-3 h-3 cursor-pointer"
                      />
                    </td>
                    <td className="px-2 py-1 text-gray-500">{i + 1}</td>
                    <td className="px-2 py-1">
                      <div 
                        onClick={() => openImageModal(p._id, 'people', p.image, `${p.firstname} ${p.lastname}`)}
                        className="cursor-pointer hover:opacity-80"
                        title="Change image"
                      >
                        {p.image ? (
                          <img src={p.image} alt="" className="w-8 h-8 rounded object-cover border border-gray-600" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center text-gray-500 text-[10px] border border-dashed border-gray-500 hover:border-gray-400">
                            +
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1 text-white font-medium">{p.firstname} {p.lastname}</td>
                    <td className="px-2 py-1 text-gray-400">{fmtDate(p.born)}</td>
                    <td className="px-2 py-1 text-gray-400">{calcAge(p.born, p.died) || '—'}</td>
                    <td className="px-2 py-1 text-gray-400">{p.countryBorn || '—'}</td>
                    <td className="px-2 py-1 text-gray-400">{p.cityBorn || '—'}</td>
                    <td className="px-2 py-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${PROF_COLORS[p.profession] || PROF_COLORS.Other}`}>
                        {p.profession}
                      </span>
                    </td>
                                        <td className="px-2 py-1 text-gray-400">{p.died ? fmtDate(p.died) : '—'}</td>
                    <td className="px-2 py-1 text-gray-400">{p.causeOfDeath || '—'}</td>
                    <td className="px-2 py-1 text-gray-400">{p.countryDied || '—'}</td>
                    <td className="px-2 py-1">
                      {p.hasArticle ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-green-400 text-[10px] font-bold">✅ Yes</span>
                          {p.articleCreatedAt && (
                            <span className="text-gray-500 text-[9px]">{new Date(p.articleCreatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                          )}
                        </div>
                      ) : personArticles[p._id] ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-green-400 text-[10px] font-bold">✅ Yes</span>
                          <span className="text-gray-500 text-[9px]">{new Date(personArticles[p._id].createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                        </div>
                      ) : (
                        <button 
                          onClick={() => openArticleModal(p)}
                          className="px-2 py-0.5 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold rounded flex items-center gap-1"
                          title="Create article"
                        >
                          <FileText className="w-3 h-3" />
                          Write
                        </button>
                      )}
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex gap-1">
                        <button onClick={() => openEditModal(p)} className="p-1 bg-yellow-600 hover:bg-yellow-700 rounded" title="Edit">
                          <Pencil className="w-3 h-3 text-white" />
                        </button>
                        <button onClick={() => openSocialModal(p)} className="p-1 bg-blue-600 hover:bg-blue-700 rounded" title="Social Media">
                          <Globe className="w-3 h-3 text-white" />
                        </button>
                        <button onClick={() => handleDelete(p._id)} className="p-1 bg-red-600 hover:bg-red-700 rounded" title="Delete">
                          <Trash2 className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-700 sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-center text-gray-300 w-8">
                    <input 
                      type="checkbox" 
                      checked={items.length > 0 && selectedIds.size === items.length}
                      onChange={() => selectedIds.size === items.length ? deselectAll() : selectAll()}
                      className="w-3 h-3 cursor-pointer"
                    />
                  </th>
                  <th className="px-2 py-2 text-left text-gray-300 w-8">#</th>
                  <th className="px-2 py-2 text-left text-gray-300 w-10">Image</th>
                  {CATEGORY_FIELDS[activeCategory]?.map(field => (
                    <th key={field.key} className="px-2 py-2 text-left text-gray-300">{field.label}</th>
                  ))}
                  <th className="px-2 py-2 text-left text-gray-300 w-10">✕</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item._id} className={`border-t border-gray-700 hover:bg-gray-750 ${selectedIds.has(item._id) ? 'bg-purple-900/30' : ''}`}>
                    <td className="px-2 py-1 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(item._id)}
                        onChange={() => toggleSelect(item._id)}
                        className="w-3 h-3 cursor-pointer"
                      />
                    </td>
                    <td className="px-2 py-1 text-gray-500">{item.rank || i + 1}</td>
                    <td className="px-2 py-1">
                      {item.image ? (
                        <img src={item.image} alt="" className="w-8 h-8 rounded object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center text-gray-500 text-[10px]">+</div>
                      )}
                    </td>
                    {CATEGORY_FIELDS[activeCategory]?.map(field => (
                      <td key={field.key} className="px-2 py-1 text-gray-300">
                        {item.data?.[field.key] || '—'}
                      </td>
                    ))}
                    <td className="px-2 py-1">
                      <div className="flex gap-1">
                        <button onClick={() => openItemArticleModal(item)} className="p-1 bg-purple-600 hover:bg-purple-700 rounded" title="Generate article">
                          <FileText className="w-3 h-3 text-white" />
                        </button>
                        <button onClick={() => openImageModal(item._id, 'items', item.image, item.data?.title || item.data?.name || '')} className="p-1 bg-orange-600 hover:bg-orange-700 rounded" title="Image">
                          <Image className="w-3 h-3 text-white" />
                        </button>
                        <button onClick={() => handleDelete(item._id)} className="p-1 bg-red-600 hover:bg-red-700 rounded">
                          <Trash2 className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          
          {/* Empty state */}
          {!loading && ((activeCategory === 'people' && people.length === 0) || (activeCategory !== 'people' && items.length === 0)) && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <span className="text-4xl mb-2">{currentCat?.emoji}</span>
              <p className="text-sm">No entries found</p>
              <button onClick={() => setShowAddForm(true)} className="mt-2 text-xs text-[#E36B11] hover:underline">
                + Add first entry
              </button>
            </div>
          )}
        </div>
      </div>

      {/* IMAGE PICKER MODAL */}
      <ImagePickerModal
        isOpen={!!imageModal}
        onClose={() => setImageModal(null)}
        onSelect={saveImage}
        currentImage={imageModal?.currentUrl}
        currentThumbnail={imageModal?.id === 'article-cover' ? articleData.thumbnailUrl : undefined}
        searchTerm={imageModal?.searchTerm}
        showThumbnail={imageModal?.id === 'article-cover'} // Show thumbnail option for article covers
      />

      {/* ARTICLE MODAL - Full Article Builder */}
      {articleModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setArticleModal(null)}>
          <div className="bg-gray-800 rounded-lg w-[900px] max-w-[95vw] max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <div>
                <h3 className="text-sm font-bold text-white">✍ Create Article</h3>
                <p className="text-xs text-gray-400">{articleModal.firstname} {articleModal.lastname} · {articleModal.profession}</p>
              </div>
              <button onClick={() => setArticleModal(null)} className="p-1 hover:bg-gray-700 rounded">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Content - scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* AI Generation Options */}
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3">
                <h4 className="text-xs font-bold text-purple-300 mb-2">🤖 AI Generation</h4>
                <div className="grid grid-cols-5 gap-2 mb-2">
                  <div>
                    <label className="text-[10px] text-gray-400">Focus</label>
                    <input
                      value={articleOptions.topic}
                      onChange={e => setArticleOptions({...articleOptions, topic: e.target.value})}
                      placeholder="Career..."
                      className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400">Timeframe</label>
                    <select value={articleOptions.timeframe} onChange={e => setArticleOptions({...articleOptions, timeframe: e.target.value})} className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white">
                      <option value="week">Letzte Woche</option>
                      <option value="month">Letzter Monat</option>
                      <option value="year">Letztes Jahr</option>
                      <option value="alltime">All Time</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400">Language</label>
                    <select value={articleOptions.language} onChange={e => setArticleOptions({...articleOptions, language: e.target.value})} className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white">
                      <option>English</option>
                      <option>Deutsch</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400">Length</label>
                    <select value={articleOptions.length} onChange={e => setArticleOptions({...articleOptions, length: e.target.value})} className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white">
                      <option value="short (~150 words)">Short</option>
                      <option value="medium (~300 words)">Medium</option>
                      <option value="long (~600 words)">Long</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400">Style</label>
                    <select value={articleOptions.tone} onChange={e => setArticleOptions({...articleOptions, tone: e.target.value})} className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white">
                      {AUTHOR_STYLES.map(style => (
                        <option key={style.id} value={style.id}>{style.emoji} {style.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    value={articleOptions.extra}
                    onChange={e => setArticleOptions({...articleOptions, extra: e.target.value})}
                    placeholder="Extra instructions..."
                    className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                  />
                  <button
                    onClick={generateArticle}
                    disabled={articleGenerating}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded disabled:opacity-50 flex items-center gap-1"
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
                  className="w-32 h-20 rounded bg-gray-700 flex-shrink-0 cursor-pointer hover:opacity-80 overflow-hidden border border-gray-600"
                >
                  {articleData.coverImage ? (
                    <img src={articleData.coverImage} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">+ Cover</div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <label className="text-[10px] text-gray-400">Titel</label>
                    <input
                      value={articleData.title}
                      onChange={e => setArticleData({...articleData, title: e.target.value})}
                      placeholder="Article title..."
                      className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400">Subtitle</label>
                    <input
                      value={articleData.subtitle}
                      onChange={e => setArticleData({...articleData, subtitle: e.target.value})}
                      placeholder="Subtitle..."
                      className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Content - Block Editor */}
              <div>
                <label className="text-[10px] text-gray-400 mb-1 block">Content (Block Editor)</label>
                <div className="bg-gray-900 rounded border border-gray-600 overflow-hidden">
                  <BlockEditor
                    value={articleData.content}
                    onChange={(content: string) => setArticleData({...articleData, content})}
                  />
                </div>
              </div>

              {/* Tags & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-400">Tags (comma-separated)</label>
                  <input
                    value={articleData.tags.join(', ')}
                    onChange={e => setArticleData({...articleData, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)})}
                    placeholder="Gen X, Music, ..."
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400">Category</label>
                  <select
                    value={articleData.category}
                    onChange={e => setArticleData({...articleData, category: e.target.value})}
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                  >
                    <option value="genx-icons">GenX Icons</option>
                    <option value="culture">Culture</option>
                    <option value="music">Music</option>
                    <option value="movies-tv">Movies & TV</option>
                    <option value="gaming">Gaming</option>
                    <option value="tech">Tech</option>
                    <option value="sports">Sports</option>
                    <option value="lifestyle">Lifestyle</option>
                    <option value="news">News</option>
                    <option value="rip">RIP</option>
                    <option value="eastercorn">Eastercorn</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700 bg-gray-850">
              <div className="text-xs text-gray-500">
                {articleData.content ? `${articleData.content.split(' ').length} words` : 'No content yet'}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setArticleModal(null)} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded">
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

      {/* EDIT MODAL */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditModal(null)}>
          <div className="bg-gray-800 rounded-lg p-4 w-[500px] max-w-[95vw] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white mb-3">✏️ Edit Person</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">First Name</label>
                <input
                  value={editData.firstname || ''}
                  onChange={e => setEditData({...editData, firstname: e.target.value})}
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Last Name</label>
                <input
                  value={editData.lastname || ''}
                  onChange={e => setEditData({...editData, lastname: e.target.value})}
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Born (YYYY-MM-DD)</label>
                <input
                  value={editData.born || ''}
                  onChange={e => setEditData({...editData, born: e.target.value})}
                  placeholder="1975-08-21"
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Profession</label>
                <select
                  value={editData.profession || ''}
                  onChange={e => setEditData({...editData, profession: e.target.value})}
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                >
                  <option value="">Select...</option>
                  {PROFESSIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400">City of Birth</label>
                <input
                  value={editData.cityBorn || ''}
                  onChange={e => setEditData({...editData, cityBorn: e.target.value})}
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Country of Birth</label>
                <select
                  value={editData.countryBorn || ''}
                  onChange={e => setEditData({...editData, countryBorn: e.target.value})}
                  className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                >
                  <option value="">Select...</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            
            <div className="mt-3">
              <label className="text-xs text-gray-400">Known For</label>
              <input
                value={editData.knownfor || ''}
                onChange={e => setEditData({...editData, knownfor: e.target.value})}
                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
              />
            </div>
            
            <div className="border-t border-gray-600 mt-4 pt-3">
              <p className="text-xs text-gray-500 mb-2">Death Info (leave empty if alive)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400">Died (YYYY-MM-DD)</label>
                  <input
                    value={editData.died || ''}
                    onChange={e => setEditData({...editData, died: e.target.value})}
                    placeholder="2020-01-15"
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Cause of Death</label>
                  <input
                    value={editData.causeOfDeath || ''}
                    onChange={e => setEditData({...editData, causeOfDeath: e.target.value})}
                    placeholder="Cancer, Heart attack, etc."
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">City of Death</label>
                  <input
                    value={editData.cityDied || ''}
                    onChange={e => setEditData({...editData, cityDied: e.target.value})}
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Country of Death</label>
                  <select
                    value={editData.countryDied || ''}
                    onChange={e => setEditData({...editData, countryDied: e.target.value})}
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                  >
                    <option value="">Select...</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 mt-4">
              <button onClick={saveEdit} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded">
                💾 Save
              </button>
              <button onClick={() => setEditModal(null)} className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SOCIAL MODAL */}
      {socialModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSocialModal(null)}>
          <div className="bg-gray-800 rounded-lg p-4 w-96 max-w-[95vw]" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white mb-1">📱 Social Media</h3>
            <p className="text-xs text-gray-400 mb-3">{socialModal.firstname} {socialModal.lastname}</p>
            
            {['twitter', 'instagram', 'youtube', 'linkedin', 'tiktok', 'facebook', 'website'].map(platform => (
              <div key={platform} className="flex items-center gap-2 mb-2">
                <span className="w-6 text-center">
                  {platform === 'twitter' && '𝕏'}
                  {platform === 'instagram' && '📸'}
                  {platform === 'youtube' && '▶️'}
                  {platform === 'linkedin' && '💼'}
                  {platform === 'tiktok' && '🎵'}
                  {platform === 'facebook' && '📘'}
                  {platform === 'website' && '🌐'}
                </span>
                <input
                  value={socialData[platform] || ''}
                  onChange={e => setSocialData({...socialData, [platform]: e.target.value})}
                  placeholder={`https://${platform}.com/...`}
                  className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                />
                {socialData[platform] && (
                  <a href={socialData[platform]} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400 hover:underline">↗</a>
                )}
              </div>
            ))}
            
            <div className="flex gap-2 mt-3">
              <button onClick={saveSocial} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded">
                💾 Save
              </button>
              <button onClick={() => setSocialModal(null)} className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
