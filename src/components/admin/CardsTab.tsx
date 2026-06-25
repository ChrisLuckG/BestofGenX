"use client";

import { useState, useEffect } from "react";
import { Trash2, Loader2, Sparkles, ChevronUp, ChevronDown, Wand2 } from "lucide-react";
import ImagePickerModal from "./ImagePickerModal";
import PredictionsTab from "./PredictionsTab";

interface QuestionVariant {
  _id?: string; // Unique question ID
  question: string;
  options: (string | number)[];
  correctAnswer: string | number;
  highlightWords: string[];
  difficulty: number;
  difficultyText: string;
  maxReward: number;
}

interface Card {
  _id: string;
  type: string;
  theme: string;
  subCategory?: string;
  topic: string;
  questions: QuestionVariant[];
  timeLimit: number;
  previewImage: string;
  playerImage: string;
  active: boolean;
  guestCard: boolean;
  createdAt: string;
}

interface DifficultyCard {
  question: string;
  options: (string | number)[];
  correctAnswer: string | number;
  highlightWords: string[];
  difficulty: number;
  difficultyText: string;
  maxReward: number;
}

const emptyCard = {
  type: "quiz", theme: "", topic: "", options: ["", "", "", ""],
  correctAnswer: "", highlightWords: [], difficulty: 1,
  difficultyText: "Easy", maxReward: 0.05, timeLimit: 10,
  previewImage: "", playerImage: "", active: true, guestCard: false,
};

const emptyDifficultyCard: DifficultyCard = {
  question: "", options: ["", "", "", ""], correctAnswer: "",
  highlightWords: [], difficulty: 1, difficultyText: "Easy", maxReward: 0.05,
};

const THEMES = ['MUSIC','MOVIES','TV SHOWS','SPORTS','GAMING','FASHION','TECHNOLOGY','CELEBRITIES'];

// SubCategories per Theme for dropdown
const SUBCATEGORIES: Record<string, string[]> = {
  'SPORTS': ['Basketball', 'Soccer', 'American Football', 'Rugby', 'Tennis', 'Table Tennis', 'Boxing', 'Golf', 'Hockey', 'Baseball', 'Wrestling', 'Olympics', 'Racing', 'Cycling', 'Swimming', 'X-Games'],
  'MUSIC': ['Rock', 'Pop', 'Hip Hop', 'R&B', 'Electronic', 'Metal', 'Punk', 'Alternative', 'Country', 'Soul', 'Grunge'],
  'MOVIES': ['Action', 'Comedy', 'Horror', 'Sci-Fi', 'Drama', 'Thriller', 'Animation', 'Romance'],
  'TV SHOWS': ['Sitcom', 'Drama', 'Sci-Fi', 'Animation', 'Reality', 'Talk Show', 'Crime'],
  'GAMING': ['Nintendo', 'PlayStation', 'Sega', 'PC Gaming', 'Fighting', 'RPG', 'Arcade', 'Sports'],
  'FASHION': ['Streetwear', 'Designer', 'Shoes', 'Accessories', 'Denim', 'Sportswear', 'Vintage'],
  'TECHNOLOGY': ['Computers', 'Internet', 'Gaming', 'Audio', 'Mobile', 'Software', 'Hardware'],
  'CELEBRITIES': ['Actors', 'Musicians', 'Athletes', 'TV Stars', 'Models', 'Directors'],
};

const topicPools: Record<string, string[]> = {
  'MUSIC': ['Nirvana','Oasis','Radiohead','Red Hot Chili Peppers','Green Day','Blink-182','Foo Fighters','Pearl Jam','Spice Girls','Backstreet Boys','NSYNC','Britney Spears','Eminem','Dr. Dre','Daft Punk','U2','Depeche Mode','The Cure'],
  'MOVIES': ['Titanic','The Matrix','Pulp Fiction','Forrest Gump','Jurassic Park','The Lion King','Fight Club','The Shawshank Redemption','Gladiator','The Sixth Sense','Terminator 2','Independence Day','Speed','Die Hard'],
  'TV SHOWS': ['Friends','Seinfeld','The Fresh Prince','The X-Files','ER','Frasier','The Simpsons','South Park','Buffy the Vampire Slayer','Beverly Hills 90210','Twin Peaks','Sex and the City','Saved by the Bell'],
  'SPORTS': ['Michael Jordan','Magic Johnson','Shaquille O\'Neal','Kobe Bryant','Diego Maradona','Ronaldo','David Beckham','Mike Tyson','Wayne Gretzky','Joe Montana','Barry Sanders'],
  'GAMING': ['Super Mario','Sonic','The Legend of Zelda','Pokemon','Street Fighter','Mortal Kombat','Resident Evil','Metal Gear Solid','Tomb Raider','GoldenEye 007','Doom','Half-Life'],
  'FASHION': ['Calvin Klein','Tommy Hilfiger','Versace','Gucci','Nike','Adidas','Levi\'s','Gap'],
  'TECHNOLOGY': ['Windows 95','Netscape','AOL','ICQ','Napster','Palm Pilot','Nokia 3310','Sony Walkman','VHS','DVD','PlayStation','Nintendo 64'],
  'CELEBRITIES': ['Madonna','Michael Jackson','Arnold Schwarzenegger','Tom Cruise','Julia Roberts','Will Smith'],
};

// Arcade subtabs
type ArcadeSubTab = 'quizbattle' | 'trivia' | 'othergames' | 'predictions' | 'questions';

export default function ArcadeTab() {
  const [activeSubTab, setActiveSubTab] = useState<ArcadeSubTab>('questions');
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCard, setEditingCard] = useState<Partial<Card> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [isSearchingImage, setIsSearchingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [difficultyCards, setDifficultyCards] = useState<DifficultyCard[]>([
    { ...emptyDifficultyCard, difficulty: 1, difficultyText: "Easy", maxReward: 0.05 },
    { ...emptyDifficultyCard, difficulty: 3, difficultyText: "Medium", maxReward: 0.10 },
    { ...emptyDifficultyCard, difficulty: 5, difficultyText: "Hard", maxReward: 0.15 },
  ]);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [isRegeneratingDifficulty, setIsRegeneratingDifficulty] = useState<number | null>(null);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
    const [themeFilter, setThemeFilter] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState<Record<string, { current: number; total: number }>>({});
  const [bulkConfig, setBulkConfig] = useState({ count: 10, theme: 'MIX', subCategory: '', guestCard: false, difficulty: 'Easy' as 'Easy' | 'Medium' | 'Hard' });
  const [isCleaningGerman, setIsCleaningGerman] = useState(false);
  const [germanCount, setGermanCount] = useState<number | null>(null);
  const [imageMenuOpen, setImageMenuOpen] = useState<string | null>(null);
  const [generatingImageFor, setGeneratingImageFor] = useState<string | null>(null);
  const [imagePickerCard, setImagePickerCard] = useState<{ cardId: string; searchTerm: string } | null>(null);
  const [editingAnswer, setEditingAnswer] = useState<{ cardId: string; qIdx: number; options: string[]; correctAnswer: string } | null>(null);
  const [sortBy, setSortBy] = useState<'diff' | 'pts' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [isSplitting, setIsSplitting] = useState(false);

  const fetchCards = async () => {
    try {
      const res = await fetch(`/api/cards`);
      const data = await res.json();
      if (data.success) setCards(data.cards);
    } catch (error) {
      console.error("Error fetching cards:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, []);

  // Auto-cleanup on first load: split packages, remove duplicates, backfill subcategories
  useEffect(() => {
    const autoCleanup = async () => {
      try {
        let needsRefresh = false;
        
        // 1. Split multi-question cards
        const splitCheck = await fetch('/api/admin/split-cards');
        const splitData = await splitCheck.json();
        if (splitData.success && splitData.cardsToSplit > 0) {
          console.log(`Splitting ${splitData.cardsToSplit} multi-question cards...`);
          await fetch('/api/admin/split-cards', { method: 'POST' });
          needsRefresh = true;
        }
        
        // 2. Remove duplicate topics
        const dupeCheck = await fetch('/api/admin/cleanup-duplicates');
        const dupeData = await dupeCheck.json();
        if (dupeData.success && dupeData.duplicateTopics > 0) {
          console.log(`Removing ${dupeData.duplicateTopics} duplicate topics...`);
          await fetch('/api/admin/cleanup-duplicates', { method: 'DELETE' });
          needsRefresh = true;
        }
        
        // 3. Reset invalid subcategories first
        const resetRes = await fetch('/api/admin/reset-invalid-subcategories', { method: 'POST' });
        const resetData = await resetRes.json();
        if (resetData.reset > 0) {
          console.log(`Reset ${resetData.reset} invalid subcategories`);
          needsRefresh = true;
        }
        
        // 4. Backfill subcategories
        const backfillRes = await fetch('/api/admin/backfill-subcategory', { method: 'POST' });
        const backfillData = await backfillRes.json();
        if (backfillData.updated > 0) {
          console.log(`Backfilled ${backfillData.updated} subcategories`);
          needsRefresh = true;
        }
        
        if (needsRefresh) fetchCards();
      } catch (e) {
        console.error('Auto-cleanup error:', e);
      }
    };
    autoCleanup();
  }, []);

  const handleCreate = () => {
    setEditingCard({ ...emptyCard });
    setIsCreating(true);
    setDifficultyCards([
      { ...emptyDifficultyCard, difficulty: 1, difficultyText: "Easy", maxReward: 0.05 },
      { ...emptyDifficultyCard, difficulty: 3, difficultyText: "Medium", maxReward: 0.10 },
      { ...emptyDifficultyCard, difficulty: 5, difficultyText: "Hard", maxReward: 0.15 },
    ]);
  };

  const handleEdit = (card: Card) => {
    setEditingCard({ ...card });
    setIsCreating(false);
    if (card.questions?.length > 0) {
      const newDiffCards = [
        { ...emptyDifficultyCard, difficulty: 1, difficultyText: "Easy", maxReward: 0.05 },
        { ...emptyDifficultyCard, difficulty: 3, difficultyText: "Medium", maxReward: 0.10 },
        { ...emptyDifficultyCard, difficulty: 5, difficultyText: "Hard", maxReward: 0.15 },
      ];
      card.questions.forEach((q, idx) => {
        if (idx < 3) newDiffCards[idx] = { question: q.question, options: q.options, correctAnswer: q.correctAnswer, highlightWords: q.highlightWords || [], difficulty: q.difficulty, difficultyText: q.difficultyText, maxReward: q.maxReward };
      });
      setDifficultyCards(newDiffCards);
    }
  };

  const handleGenerateAllDifficulties = async () => {
    if (!editingCard) return;
    setIsGeneratingAll(true);
    try {
      // Generate 3 questions one by one
      const difficulties = ['Easy', 'Medium', 'Hard'];
      const newCards: DifficultyCard[] = [];
      let lastImage = editingCard.previewImage || '';
      let lastTopic = editingCard.topic || '';
      let lastTheme = editingCard.theme || 'MUSIC';
      
      for (const diff of difficulties) {
        const res = await fetch('/api/generate-quiz-set', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: lastTopic, theme: lastTheme, difficulty: diff }),
        });
        const data = await res.json();
        if (data.success && data.question) {
          const diffNum = diff === 'Easy' ? 1 : diff === 'Medium' ? 3 : 5;
          const maxReward = diff === 'Easy' ? 0.05 : diff === 'Medium' ? 0.10 : 0.15;
          newCards.push({
            question: data.question,
            options: data.options,
            correctAnswer: data.correctAnswer,
            highlightWords: data.highlightWords || [],
            difficulty: diffNum,
            difficultyText: diff,
            maxReward,
          });
          if (data.generatedImage) lastImage = data.generatedImage;
          if (data.topic) lastTopic = data.topic;
          if (data.theme) lastTheme = data.theme;
        }
      }
      
      if (newCards.length > 0) {
        setDifficultyCards(newCards.length === 3 ? newCards : [
          newCards[0] || { ...emptyDifficultyCard, difficulty: 1, difficultyText: "Easy", maxReward: 0.05 },
          newCards[1] || { ...emptyDifficultyCard, difficulty: 3, difficultyText: "Medium", maxReward: 0.10 },
          newCards[2] || { ...emptyDifficultyCard, difficulty: 5, difficultyText: "Hard", maxReward: 0.15 },
        ]);
        setEditingCard({ ...editingCard, topic: lastTopic, theme: lastTheme, previewImage: lastImage, playerImage: lastImage });
      } else {
        alert('Generation failed');
      }
    } catch (error) {
      alert('Failed to generate questions');
    } finally {
      setIsGeneratingAll(false);
    }
  };

  const handleRegenerateDifficulty = async (diffIndex: number) => {
    if (!editingCard) return;
    const difficultyLevel = diffIndex === 0 ? 'easy' : diffIndex === 1 ? 'medium' : 'hard';
    setIsRegeneratingDifficulty(diffIndex);
    try {
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: editingCard.topic || '', theme: editingCard.theme || 'MUSIC', difficulty: difficultyLevel }),
      });
      const data = await res.json();
      if (data.success) {
        const newCards = [...difficultyCards];
        newCards[diffIndex] = { ...newCards[diffIndex], question: data.data.question, options: data.data.options, correctAnswer: data.data.correctAnswer, highlightWords: data.data.highlightWords || [] };
        setDifficultyCards(newCards);
      } else {
        alert('Regeneration failed: ' + data.error);
      }
    } catch {
      alert('Failed to regenerate');
    } finally {
      setIsRegeneratingDifficulty(null);
    }
  };

  const handleSaveAllDifficulties = async () => {
    if (!editingCard) return;
    setIsSaving(true);
    try {
      const questions = difficultyCards.filter(dc => dc.question).map(dc => ({
        question: dc.question, options: dc.options, correctAnswer: dc.correctAnswer,
        highlightWords: dc.highlightWords, difficulty: dc.difficulty,
        difficultyText: dc.difficultyText, maxReward: dc.maxReward,
      }));
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: editingCard.type, theme: editingCard.theme, topic: editingCard.topic, questions, timeLimit: editingCard.timeLimit || 10, previewImage: editingCard.previewImage, playerImage: editingCard.playerImage, active: true }),
      });
      const data = await res.json();
      if (data.success) { fetchCards(); setEditingCard(null); setIsCreating(false); }
      else alert('Error: ' + data.error);
    } catch { alert("Failed to save card"); }
    finally { setIsSaving(false); }
  };

  const handleSave = async () => {
    if (!editingCard) return;
    setIsSaving(true);
    try {
      const url = isCreating ? "/api/cards" : `/api/cards/${editingCard._id}`;
      const method = isCreating ? "POST" : "PUT";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingCard) });
      const data = await res.json();
      if (data.success) { fetchCards(); setEditingCard(null); setIsCreating(false); }
      else alert("Error: " + data.error);
    } catch { alert("Failed to save card"); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    setIsDeleting(id);
    try {
      const res = await fetch(`/api/cards/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) fetchCards();
    } catch { console.error("Error deleting card"); }
    finally { setIsDeleting(null); }
  };

  const handleToggleActive = async (card: Card) => {
    try {
      await fetch(`/api/cards/${card._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !card.active }) });
      fetchCards();
    } catch { console.error("Error toggling card"); }
  };

  const handleToggleGuestCard = async (card: Card) => {
    try {
      await fetch(`/api/cards/${card._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guestCard: !card.guestCard }) });
      fetchCards();
    } catch { console.error("Error toggling guest card"); }
  };

  const toggleCardSelection = (cardId: string) => {
    setSelectedCards(prev => { const s = new Set(prev); s.has(cardId) ? s.delete(cardId) : s.add(cardId); return s; });
  };

  const selectAllCards = () => {
    setSelectedCards(selectedCards.size === cards.length ? new Set() : new Set(cards.map(c => c._id)));
  };

  const handleDeleteSelected = async () => {
    if (selectedCards.size === 0 || !confirm(`Delete ${selectedCards.size} questions?`)) return;
    setIsDeletingSelected(true);
    try {
      await Promise.all(Array.from(selectedCards).map(id => fetch(`/api/cards/${id}`, { method: "DELETE" })));
      setSelectedCards(new Set());
      fetchCards();
    } catch { alert("Failed to delete some questions"); }
    finally { setIsDeletingSelected(false); }
  };

  const handleRegenerateImage = async () => {
    if (!editingCard) return;
    setIsRegeneratingImage(true);
    try {
      const res = await fetch('/api/generate-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: editingCard.topic || '', theme: editingCard.theme || 'MUSIC' }) });
      const data = await res.json();
      if (data.success) setEditingCard({ ...editingCard, previewImage: data.imageUrl, playerImage: data.imageUrl });
      else alert('Image generation failed: ' + data.error);
    } catch { alert('Failed to regenerate image'); }
    finally { setIsRegeneratingImage(false); }
  };

  const handleSearchWikimedia = async () => {
    if (!editingCard) return;
    setIsSearchingImage(true);
    try {
      const res = await fetch('/api/search-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: editingCard.topic || '' }) });
      const data = await res.json();
      if (data.success && data.image) setEditingCard({ ...editingCard, previewImage: data.image.thumbUrl, playerImage: data.image.thumbUrl });
      else alert('No images found for: ' + editingCard.topic);
    } catch { alert('Failed to search Wikimedia'); }
    finally { setIsSearchingImage(false); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingCard) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) setEditingCard({ ...editingCard, previewImage: data.url, playerImage: data.url });
      else alert('Upload failed: ' + data.error);
    } catch { alert('Upload failed'); }
  };

  const handleBulkGenerate = async (forTheme?: string) => {
    const allThemes = THEMES.filter(t => t !== 'CELEBRITIES');
    const count = bulkConfig.count;
    const difficulty = bulkConfig.difficulty;
    const difficultyNum = difficulty === 'Easy' ? 1 : difficulty === 'Medium' ? 3 : 5;
    const maxReward = difficulty === 'Easy' ? 0.05 : difficulty === 'Medium' ? 0.10 : 0.15;
    // Use passed theme, or selected theme filter, or MIX
    const selectedTheme = forTheme || themeFilter || 'MIX';
    const genKey = selectedTheme; // Key for tracking this generation
    
    // Check if already generating for this theme
    if (bulkGenerating[genKey]) return;
    
    setBulkGenerating(prev => ({ ...prev, [genKey]: { current: 0, total: count } }));
    try {
      for (let i = 0; i < count; i++) {
        setBulkGenerating(prev => ({ ...prev, [genKey]: { current: i + 1, total: count } }));
        const isGuestCard = bulkConfig.guestCard;
        const theme = selectedTheme === 'MIX' ? allThemes[Math.floor(Math.random() * allThemes.length)] : selectedTheme;
        
        // Generate SINGLE question with specified difficulty and optional subCategory
        const res = await fetch('/api/generate-quiz-set', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ theme, difficulty, subCategory: bulkConfig.subCategory || undefined }) 
        });
        const data = await res.json();
        if (!data.success || !data.question) continue;
        
        // Skip duplicates - don't save them
        if (data.isDuplicate) {
          console.log(`Skipping duplicate: ${data.topic}`);
          continue;
        }
        
        // Save single question
        await fetch('/api/cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ 
          type: 'quiz', 
          theme: data.theme || theme, 
          subCategory: data.subCategory || '',
          topic: data.topic, 
          questions: [
            { question: data.question, options: data.options, correctAnswer: data.correctAnswer, highlightWords: data.highlightWords || [], difficulty: difficultyNum, difficultyText: difficulty, maxReward }
          ], 
          timeLimit: 10, 
          previewImage: data.generatedImage || '', 
          playerImage: data.generatedImage || '', 
          active: true, 
          guestCard: isGuestCard 
        }) });
        await new Promise(r => setTimeout(r, 500));
      }
      fetchCards();
    } catch { alert('Error generating questions'); }
    finally { setBulkGenerating(prev => { const n = { ...prev }; delete n[genKey]; return n; }); }
  };

  const handleCleanupGerman = async () => {
    setIsCleaningGerman(true);
    try {
      // First check how many
      const checkRes = await fetch(`/api/admin/cleanup-german?userId=${localStorage.getItem('userId') || ''}`);
      const checkData = await checkRes.json();
      if (!checkData.success) {
        alert('Error checking: ' + checkData.error);
        return;
      }
      if (checkData.found === 0) {
        alert('No German questions found!');
        setGermanCount(0);
        return;
      }
      setGermanCount(checkData.found);
      if (!confirm(`Found ${checkData.found} German cards. Delete them all?`)) return;
      
      // Delete them
      const deleteRes = await fetch(`/api/admin/cleanup-german?userId=${localStorage.getItem('userId') || ''}`, { method: 'DELETE' });
      const deleteData = await deleteRes.json();
      if (deleteData.success) {
        alert(`Deleted ${deleteData.deleted} German cards!`);
        setGermanCount(0);
        fetchCards();
      } else {
        alert('Error deleting: ' + deleteData.error);
      }
    } catch (e) { alert('Cleanup failed'); }
    finally { setIsCleaningGerman(false); }
  };

  const handleGenerateAIImage = async (cardId: string, topic: string) => {
    setGeneratingImageFor(cardId);
    setImageMenuOpen(null);
    try {
      const res = await fetch('/api/generate-image', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ topic }) 
      });
      const data = await res.json();
      if (data.success && data.imageUrl) {
        await fetch('/api/cards', { 
          method: 'PUT', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ _id: cardId, previewImage: data.imageUrl, playerImage: data.imageUrl }) 
        });
        fetchCards();
      } else {
        alert('Failed to generate image');
      }
    } catch { alert('Error generating image'); }
    finally { setGeneratingImageFor(null); }
  };

  const toggleSort = (col: 'diff' | 'pts') => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const handleSplitCards = async () => {
    setIsSplitting(true);
    try {
      // First check
      const checkRes = await fetch('/api/admin/split-cards');
      const checkData = await checkRes.json();
      if (!checkData.success) {
        alert('Error: ' + checkData.error);
        return;
      }
      if (checkData.cardsToSplit === 0) {
        alert('All cards already have single questions!');
        return;
      }
      if (!confirm(`Found ${checkData.cardsToSplit} cards with multiple questions.\nThis will create ${checkData.willCreate} new cards.\n\nContinue?`)) return;
      
      // Split them
      const splitRes = await fetch('/api/admin/split-cards', { method: 'POST' });
      const splitData = await splitRes.json();
      if (splitData.success) {
        alert(splitData.message);
        fetchCards();
      } else {
        alert('Error: ' + splitData.error);
      }
    } catch { alert('Split failed'); }
    finally { setIsSplitting(false); }
  };

  // Count cards with multiple questions
  const multiQuestionCards = cards.filter(c => (c.questions?.length || 0) > 1).length;

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-[#D4873A]" />
      <p className="text-gray-400 text-sm">Loading cards...</p>
    </div>
  );

  // Subtab config
  const ARCADE_TABS = [
    { id: 'quizbattle' as const, label: 'Quiz Battle' },
    { id: 'trivia' as const, label: 'Trivia' },
    { id: 'othergames' as const, label: 'Other Games' },
    { id: 'predictions' as const, label: 'Predictions' },
    { id: 'questions' as const, label: 'Questions' },
  ];

  return (
    <div>
      {/* Header like Predictions */}
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-[#D4873A]" />
        <h2 className="text-sm font-bold">Arcade</h2>
        <span className="text-xs text-gray-500">({cards.length} questions)</span>
      </div>

      {/* Subtabs */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {ARCADE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeSubTab === tab.id ? 'bg-[#D4873A] text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeSubTab === 'questions' && (
          <button
            onClick={handleCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#D4873A] text-white hover:bg-[#C4772A] transition-colors"
          >
            <Wand2 className="w-3 h-3" />
            Question
          </button>
        )}
      </div>

      {/* Quiz Battle Stats Dashboard */}
      {activeSubTab === 'quizbattle' && (
        <div className="space-y-4">
          {/* Top Stats Row */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 rounded-xl p-4 border border-purple-700/50">
              <p className="text-purple-400 text-[10px] font-bold uppercase tracking-wider mb-1">Total Battles</p>
              <p className="text-2xl font-bold text-white">--</p>
              <p className="text-[10px] text-purple-300 mt-1">All time</p>
            </div>
            <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 rounded-xl p-4 border border-green-700/50">
              <p className="text-green-400 text-[10px] font-bold uppercase tracking-wider mb-1">Today</p>
              <p className="text-2xl font-bold text-white">--</p>
              <p className="text-[10px] text-green-300 mt-1">Battles played</p>
            </div>
            <div className="bg-gradient-to-br from-[#D4873A]/30 to-[#D4873A]/10 rounded-xl p-4 border border-[#D4873A]/50">
              <p className="text-[#D4873A] text-[10px] font-bold uppercase tracking-wider mb-1">BOGX Spent</p>
              <p className="text-2xl font-bold text-white">--</p>
              <p className="text-[10px] text-[#D4873A]/70 mt-1">Entry fees collected</p>
            </div>
            <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 rounded-xl p-4 border border-blue-700/50">
              <p className="text-blue-400 text-[10px] font-bold uppercase tracking-wider mb-1">Active Players</p>
              <p className="text-2xl font-bold text-white">--</p>
              <p className="text-[10px] text-blue-300 mt-1">This week</p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <h3 className="text-xs font-bold text-gray-300 mb-3">Battles per Day (Last 7 Days)</h3>
              <div className="flex items-end gap-1 h-24">
                {[40, 65, 45, 80, 55, 70, 90].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-purple-500/30 rounded-t" style={{ height: `${h}%` }}>
                      <div className="w-full h-full bg-gradient-to-t from-purple-600 to-purple-400 rounded-t opacity-80" />
                    </div>
                    <span className="text-[9px] text-gray-500">{['Mo','Tu','We','Th','Fr','Sa','Su'][i]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <h3 className="text-xs font-bold text-gray-300 mb-3">Win Rate Distribution</h3>
              <div className="flex items-center justify-center h-24 gap-4">
                <div className="relative w-20 h-20">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#374151" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#22C55E" strokeWidth="3" strokeDasharray="45 100" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#EF4444" strokeWidth="3" strokeDasharray="35 100" strokeDashoffset="-45" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#6B7280" strokeWidth="3" strokeDasharray="20 100" strokeDashoffset="-80" />
                  </svg>
                </div>
                <div className="space-y-1 text-[10px]">
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500" /> Wins 45%</div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" /> Losses 35%</div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-500" /> Draws 20%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Battles */}
          <div className="bg-gray-800 rounded-xl border border-gray-700">
            <div className="px-4 py-3 border-b border-gray-700">
              <h3 className="text-xs font-bold text-gray-300">Recent Battles</h3>
            </div>
            <div className="divide-y divide-gray-700">
              {[1,2,3,4,5].map((_, i) => (
                <div key={i} className="px-4 py-2 flex items-center gap-3 text-xs">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-500">?</div>
                  <div className="flex-1">
                    <span className="text-gray-400">Player vs Player</span>
                  </div>
                  <span className="text-gray-500">--:--</span>
                  <span className="px-2 py-0.5 rounded bg-gray-700 text-gray-400">--</span>
                </div>
              ))}
            </div>
          </div>

          {/* Most Pulled Questions */}
          <div className="bg-gray-800 rounded-xl border border-gray-700">
            <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-300">🔥 Most Pulled Questions (Top 10)</h3>
              <span className="text-[10px] text-gray-500">Adjust difficulty if too easy</span>
            </div>
            <div className="divide-y divide-gray-700">
              {cards.slice(0, 10).map((card, i) => (
                <div key={card._id} className="px-4 py-2 flex items-center gap-3 text-xs hover:bg-gray-700/30">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                    i === 1 ? 'bg-gray-400/20 text-gray-300' :
                    i === 2 ? 'bg-orange-500/20 text-orange-400' :
                    'bg-gray-700 text-gray-500'
                  }`}>#{i + 1}</span>
                  {card.previewImage && (
                    <img src={card.previewImage} alt="" className="w-8 h-8 rounded object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-300 truncate">{card.questions?.[0]?.question || card.topic}</p>
                    <p className="text-[10px] text-gray-500">{card.theme} · {card.topic}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    card.questions?.[0]?.difficultyText === 'Easy' ? 'bg-green-500/20 text-green-400' :
                    card.questions?.[0]?.difficultyText === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {card.questions?.[0]?.difficultyText || 'Easy'}
                  </span>
                  <span className="text-gray-500 text-[10px]">-- pulls</span>
                </div>
              ))}
              {cards.length === 0 && (
                <div className="px-4 py-6 text-center text-gray-500 text-xs">
                  No questions yet. Create some in the Questions tab.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trivia Stats Dashboard */}
      {activeSubTab === 'trivia' && (
        <div className="space-y-4">
          {/* Top Stats Row */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-cyan-900/50 to-cyan-800/30 rounded-xl p-4 border border-cyan-700/50">
              <p className="text-cyan-400 text-[10px] font-bold uppercase tracking-wider mb-1">Games Played</p>
              <p className="text-2xl font-bold text-white">--</p>
              <p className="text-[10px] text-cyan-300 mt-1">All time</p>
            </div>
            <div className="bg-gradient-to-br from-pink-900/50 to-pink-800/30 rounded-xl p-4 border border-pink-700/50">
              <p className="text-pink-400 text-[10px] font-bold uppercase tracking-wider mb-1">Today</p>
              <p className="text-2xl font-bold text-white">--</p>
              <p className="text-[10px] text-pink-300 mt-1">Sessions</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 rounded-xl p-4 border border-yellow-700/50">
              <p className="text-yellow-400 text-[10px] font-bold uppercase tracking-wider mb-1">BOGX Earned</p>
              <p className="text-2xl font-bold text-white">--</p>
              <p className="text-[10px] text-yellow-300 mt-1">By players</p>
            </div>
            <div className="bg-gradient-to-br from-indigo-900/50 to-indigo-800/30 rounded-xl p-4 border border-indigo-700/50">
              <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-wider mb-1">Avg Score</p>
              <p className="text-2xl font-bold text-white">--</p>
              <p className="text-[10px] text-indigo-300 mt-1">Per game</p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <h3 className="text-xs font-bold text-gray-300 mb-3">Sessions per Day (Last 7 Days)</h3>
              <div className="flex items-end gap-1 h-24">
                {[30, 50, 70, 45, 85, 60, 75].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-cyan-500/30 rounded-t" style={{ height: `${h}%` }}>
                      <div className="w-full h-full bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t opacity-80" />
                    </div>
                    <span className="text-[9px] text-gray-500">{['Mo','Tu','We','Th','Fr','Sa','Su'][i]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <h3 className="text-xs font-bold text-gray-300 mb-3">Category Popularity</h3>
              <div className="space-y-2">
                {[
                  { name: 'Music', pct: 35, color: 'bg-pink-500' },
                  { name: 'Movies', pct: 28, color: 'bg-purple-500' },
                  { name: 'TV Shows', pct: 20, color: 'bg-blue-500' },
                  { name: 'Gaming', pct: 17, color: 'bg-green-500' },
                ].map((cat) => (
                  <div key={cat.name} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 w-16">{cat.name}</span>
                    <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full ${cat.color} rounded-full`} style={{ width: `${cat.pct}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-500 w-8">{cat.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Players */}
          <div className="bg-gray-800 rounded-xl border border-gray-700">
            <div className="px-4 py-3 border-b border-gray-700">
              <h3 className="text-xs font-bold text-gray-300">Top Trivia Players This Week</h3>
            </div>
            <div className="divide-y divide-gray-700">
              {[1,2,3,4,5].map((rank) => (
                <div key={rank} className="px-4 py-2 flex items-center gap-3 text-xs">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
                    rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                    rank === 2 ? 'bg-gray-400/20 text-gray-300' :
                    rank === 3 ? 'bg-orange-500/20 text-orange-400' :
                    'bg-gray-700 text-gray-500'
                  }`}>#{rank}</span>
                  <div className="w-8 h-8 rounded-full bg-gray-700" />
                  <div className="flex-1">
                    <span className="text-gray-400">Loading...</span>
                  </div>
                  <span className="text-gray-500">-- pts</span>
                  <span className="text-green-400">-- games</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trivia Questions Overview */}
          <div className="bg-gray-800 rounded-xl border border-gray-700">
            <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-300">📊 Question Performance</h3>
              <span className="text-[10px] text-gray-500">Correct answer rate</span>
            </div>
            <div className="divide-y divide-gray-700">
              {cards.slice(0, 10).map((card, i) => {
                // Mock correct rate for now
                const correctRate = Math.floor(Math.random() * 60) + 20;
                return (
                  <div key={card._id} className="px-4 py-2 flex items-center gap-3 text-xs hover:bg-gray-700/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 truncate text-[11px]">{card.questions?.[0]?.question || card.topic}</p>
                      <p className="text-[10px] text-gray-500">{card.theme}</p>
                    </div>
                    {/* Correct Rate Bar */}
                    <div className="w-24 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            correctRate > 70 ? 'bg-green-500' : 
                            correctRate > 40 ? 'bg-yellow-500' : 
                            'bg-red-500'
                          }`} 
                          style={{ width: `${correctRate}%` }} 
                        />
                      </div>
                      <span className={`text-[10px] font-bold w-8 ${
                        correctRate > 70 ? 'text-green-400' : 
                        correctRate > 40 ? 'text-yellow-400' : 
                        'text-red-400'
                      }`}>{correctRate}%</span>
                    </div>
                    <span className="text-gray-500 text-[10px]">-- plays</span>
                  </div>
                );
              })}
              {cards.length === 0 && (
                <div className="px-4 py-6 text-center text-gray-500 text-xs">
                  No questions yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Other Games Content */}
      {activeSubTab === 'othergames' && (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
          <p className="text-gray-400">More games coming soon...</p>
        </div>
      )}

      {/* Predictions Content - embedded PredictionsTab */}
      {activeSubTab === 'predictions' && (
        <PredictionsTab />
      )}

      {/* Questions Content (former Cards) */}
      {activeSubTab === 'questions' && (
      <>
      {/* Stats Bar */}
      <div className="bg-gray-800 rounded-lg px-3 py-2 mb-3 border border-gray-700">
        <div className="flex justify-center gap-4 text-xs">
          <span className="text-gray-400">Total: <strong className="text-white">{cards.length * 3}</strong></span>
          <span className="text-purple-400">Guest: <strong>{cards.filter(c => c.guestCard).length * 3}</strong></span>
          <span className="text-blue-400">Login: <strong>{cards.filter(c => !c.guestCard).length * 3}</strong></span>
          {cards.filter(c => !c.previewImage).length > 0 && <span className="text-red-400">No img: <strong>{cards.filter(c => !c.previewImage).length}</strong></span>}
        </div>
        {/* Theme Filter Buttons with Generate Options */}
        <div className="flex flex-wrap justify-center gap-1 mt-2 pt-2 border-t border-gray-700">
          <button
            onClick={() => setThemeFilter(null)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
              themeFilter === null ? 'bg-[#D4873A] text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            ALL
          </button>
          {THEMES.map(theme => {
            const count = cards.filter(c => c.theme === theme).length;
            const isSelected = themeFilter === theme;
            return (
              <div key={theme} className="relative">
                <button
                  onClick={() => setThemeFilter(isSelected ? null : theme)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                    isSelected ? 'bg-[#D4873A] text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  } ${count === 0 ? 'opacity-40' : ''}`}
                >
                  {theme} {count > 0 && <span className="text-[8px] opacity-70">({count})</span>}
                </button>
              </div>
            );
          })}
        </div>
        
        {/* SubCategory Stats - only for themes that need it */}
        {themeFilter && ['SPORTS', 'MUSIC', 'MOVIES', 'TV SHOWS', 'GAMING'].includes(themeFilter) && (() => {
          const themeCards = cards.filter(c => c.theme === themeFilter);
          const subCatStats: Record<string, { total: number; easy: number; medium: number; hard: number }> = {};
          
          themeCards.forEach(card => {
            const sub = card.subCategory || '(none)';
            if (!subCatStats[sub]) subCatStats[sub] = { total: 0, easy: 0, medium: 0, hard: 0 };
            card.questions?.forEach(q => {
              subCatStats[sub].total++;
              if (q.difficulty === 1) subCatStats[sub].easy++;
              else if (q.difficulty === 3) subCatStats[sub].medium++;
              else subCatStats[sub].hard++;
            });
          });
          
          const sortedSubs = Object.entries(subCatStats).sort((a, b) => b[1].total - a[1].total);
          
          return (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <div className="flex flex-wrap justify-center gap-1 text-[9px]">
                {sortedSubs.map(([sub, stats]) => (
                  <div key={sub} className="bg-gray-700/50 rounded px-2 py-1 flex items-center gap-1">
                    <span className="text-gray-300 font-medium">{sub}</span>
                    <span className="text-gray-500">({stats.total})</span>
                    <span className="text-green-400">{stats.easy}E</span>
                    <span className="text-yellow-400">{stats.medium}M</span>
                    <span className="text-red-400">{stats.hard}H</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        
        {/* Generate Options - shows when theme is selected OR for ALL (Mix) */}
        {(themeFilter || themeFilter === null) && (
          <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-gray-700 flex-wrap">
            <span className="text-xs text-gray-400">{themeFilter || 'MIX'}:</span>
            {/* SubCategory dropdown for SPORTS */}
            {themeFilter === 'SPORTS' && (
              <select 
                value={bulkConfig.subCategory} 
                onChange={e => setBulkConfig({...bulkConfig, subCategory: e.target.value})}
                className="px-2 py-1 bg-gray-700 rounded text-xs text-cyan-400"
              >
                <option value="">All Sports</option>
                <option value="Basketball">Basketball</option>
                <option value="Soccer">Soccer (Football)</option>
                <option value="American Football">American Football (NFL)</option>
                <option value="Rugby">Rugby</option>
                <option value="Tennis">Tennis</option>
                <option value="Table Tennis">Table Tennis</option>
                <option value="Boxing">Boxing</option>
                <option value="Golf">Golf</option>
                <option value="Hockey">Hockey</option>
                <option value="Baseball">Baseball</option>
                <option value="Wrestling">Wrestling</option>
                <option value="Olympics">Olympics</option>
                <option value="Racing">Racing/F1</option>
                <option value="Cycling">Cycling</option>
                <option value="Swimming">Swimming</option>
                <option value="X-Games">X-Games (Skate/Surf/BMX)</option>
              </select>
            )}
            {/* SubCategory dropdown for MUSIC */}
            {themeFilter === 'MUSIC' && (
              <select 
                value={bulkConfig.subCategory} 
                onChange={e => setBulkConfig({...bulkConfig, subCategory: e.target.value})}
                className="px-2 py-1 bg-gray-700 rounded text-xs text-cyan-400"
              >
                <option value="">All Genres</option>
                <option value="Rock">Rock</option>
                <option value="Pop">Pop</option>
                <option value="Hip Hop">Hip Hop</option>
                <option value="R&B">R&B</option>
                <option value="Electronic">Electronic</option>
                <option value="Metal">Metal</option>
                <option value="Punk">Punk</option>
                <option value="Alternative">Alternative</option>
              </select>
            )}
            {/* SubCategory dropdown for MOVIES */}
            {themeFilter === 'MOVIES' && (
              <select 
                value={bulkConfig.subCategory} 
                onChange={e => setBulkConfig({...bulkConfig, subCategory: e.target.value})}
                className="px-2 py-1 bg-gray-700 rounded text-xs text-cyan-400"
              >
                <option value="">All Genres</option>
                <option value="Action">Action</option>
                <option value="Comedy">Comedy</option>
                <option value="Horror">Horror</option>
                <option value="Sci-Fi">Sci-Fi</option>
                <option value="Drama">Drama</option>
                <option value="Thriller">Thriller</option>
                <option value="Animation">Animation</option>
              </select>
            )}
            {/* SubCategory dropdown for TV SHOWS */}
            {themeFilter === 'TV SHOWS' && (
              <select 
                value={bulkConfig.subCategory} 
                onChange={e => setBulkConfig({...bulkConfig, subCategory: e.target.value})}
                className="px-2 py-1 bg-gray-700 rounded text-xs text-cyan-400"
              >
                <option value="">All Genres</option>
                <option value="Sitcom">Sitcom</option>
                <option value="Drama">Drama</option>
                <option value="Sci-Fi">Sci-Fi/Fantasy</option>
                <option value="Animation">Animation</option>
                <option value="Reality">Reality</option>
                <option value="Talk Show">Talk Show</option>
                <option value="Crime">Crime</option>
              </select>
            )}
            {/* SubCategory dropdown for GAMING */}
            {themeFilter === 'GAMING' && (
              <select 
                value={bulkConfig.subCategory} 
                onChange={e => setBulkConfig({...bulkConfig, subCategory: e.target.value})}
                className="px-2 py-1 bg-gray-700 rounded text-xs text-cyan-400"
              >
                <option value="">All Platforms</option>
                <option value="Nintendo">Nintendo</option>
                <option value="PlayStation">PlayStation</option>
                <option value="Sega">Sega</option>
                <option value="PC Gaming">PC Gaming</option>
                <option value="Fighting">Fighting Games</option>
                <option value="RPG">RPG</option>
              </select>
            )}
            <select 
              value={bulkConfig.count} 
              onChange={e => setBulkConfig({...bulkConfig, count: parseInt(e.target.value)})}
              className="px-2 py-1 bg-gray-700 rounded text-xs"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
            <select 
              value={bulkConfig.difficulty} 
              onChange={e => setBulkConfig({...bulkConfig, difficulty: e.target.value as 'Easy' | 'Medium' | 'Hard'})}
              className="px-2 py-1 bg-gray-700 rounded text-xs"
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
            <label className="flex items-center gap-1 text-xs text-gray-400">
              <input 
                type="checkbox" 
                checked={bulkConfig.guestCard} 
                onChange={e => setBulkConfig({...bulkConfig, guestCard: e.target.checked})}
                className="w-3 h-3"
              />
              Guest
            </label>
            {(() => {
              const genKey = themeFilter || 'MIX';
              const isGenerating = !!bulkGenerating[genKey];
              const progress = bulkGenerating[genKey];
              return (
                <button
                  onClick={() => handleBulkGenerate(genKey)}
                  disabled={isGenerating}
                  className="px-3 py-1 bg-[#D4873A] hover:bg-[#C4772A] rounded text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> {progress?.current}/{progress?.total}</>
                  ) : (
                    <><Sparkles className="w-3 h-3" /> Generate</>
                  )}
                </button>
              );
            })()}
          </div>
        )}
      </div>

      {/* Mass Selection */}
      {selectedCards.size > 0 && (
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-2 mb-3 flex items-center justify-between">
          <span className="text-red-400 text-xs font-medium">{selectedCards.size} selected</span>
          <button onClick={handleDeleteSelected} disabled={isDeletingSelected} className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-bold disabled:opacity-50">
            {isDeletingSelected ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Delete
          </button>
        </div>
      )}

      {/* Cards List - Inline editable */}
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-2 py-2 text-left text-gray-300 w-6">
                <input 
                  type="checkbox" 
                  checked={selectedCards.size === cards.length && cards.length > 0}
                  onChange={selectAllCards}
                  className="w-3 h-3 cursor-pointer"
                />
              </th>
              <th className="px-2 py-2 text-left text-gray-300 w-8">#</th>
              <th className="px-2 py-2 text-left text-gray-300 w-12">Img</th>
              <th className="px-2 py-2 text-left text-gray-300">Theme</th>
              <th className="px-2 py-2 text-left text-gray-300">Sub</th>
              <th className="px-2 py-2 text-left text-gray-300 cursor-pointer hover:text-white" onClick={() => toggleSort('diff')}>
                <span className="flex items-center gap-0.5">Diff {sortBy === 'diff' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</span>
              </th>
              <th className="px-2 py-2 text-left text-gray-300">Question</th>
              <th className="px-2 py-2 text-left text-gray-300">Answer</th>
              <th className="px-2 py-2 text-left text-gray-300 w-16 cursor-pointer hover:text-white" onClick={() => toggleSort('pts')}>
                <span className="flex items-center gap-0.5">Pts {sortBy === 'pts' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</span>
              </th>
                            <th className="px-2 py-2 text-right text-gray-300 w-10">Del</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Flatten all questions with card reference
              type FlatQuestion = { card: Card; q: QuestionVariant; qIdx: number };
              let flatQuestions: FlatQuestion[] = cards
                .filter(c => !themeFilter || c.theme === themeFilter)
                .flatMap((card) => (card.questions || []).map((q, qIdx) => ({ card, q, qIdx })));
              
              // Sort if needed
              if (sortBy) {
                flatQuestions.sort((a, b) => {
                  let cmp = 0;
                  if (sortBy === 'diff') cmp = a.q.difficulty - b.q.difficulty;
                  else if (sortBy === 'pts') cmp = a.q.maxReward - b.q.maxReward;
                  return sortDir === 'asc' ? cmp : -cmp;
                });
              }
              
              const shownMenuForCard = new Set<string>();
              return flatQuestions.map(({ card, q, qIdx }, rowNum) => {
                const showMenuHere = !shownMenuForCard.has(card._id);
                if (showMenuHere) shownMenuForCard.add(card._id);
                  return (
                    <tr key={`${card._id}-${qIdx}`} className={`border-t border-gray-700 hover:bg-gray-750 ${selectedCards.has(card._id) ? 'bg-red-900/20' : ''}`}>
                      <td className="px-2 py-1">
                        <input 
                          type="checkbox" 
                          checked={selectedCards.has(card._id)}
                          onChange={() => toggleCardSelection(card._id)}
                          className="w-3 h-3 cursor-pointer"
                        />
                      </td>
                      <td className="px-2 py-1 text-gray-500 font-mono cursor-help" title={`ID: ${q._id || card._id}`}>{rowNum + 1}</td>
                      <td className="px-2 py-1 relative">
                        {generatingImageFor === card._id ? (
                          <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin text-[#D4873A]" />
                          </div>
                        ) : (
                          <button onClick={() => setImagePickerCard({ cardId: card._id, searchTerm: card.topic })} className="cursor-pointer">
                            {card.previewImage ? (
                              <img src={card.previewImage} alt="" className="w-8 h-8 rounded object-cover hover:ring-2 hover:ring-[#D4873A]" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center text-gray-500 text-[8px] hover:bg-gray-600">+</div>
                            )}
                          </button>
                        )}
                      </td>
                      <td className="px-2 py-1 font-medium text-gray-400">{card.theme}</td>
                      <td className="px-2 py-1">
                        <select
                          value={card.subCategory || ''}
                          onChange={async (e) => {
                            const newSub = e.target.value;
                            await fetch(`/api/cards/${card._id}`, { 
                              method: 'PUT', 
                              headers: { 'Content-Type': 'application/json' }, 
                              body: JSON.stringify({ subCategory: newSub }) 
                            });
                            fetchCards();
                          }}
                          className={`px-1 py-0.5 rounded text-[10px] cursor-pointer bg-gray-700 border border-gray-600 ${
                            card.subCategory ? 'text-gray-300' : 'text-red-400'
                          }`}
                        >
                          <option value="">-- wählen --</option>
                          {(SUBCATEGORIES[card.theme] || []).map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <select 
                          value={q.difficulty} 
                          onChange={async (e) => {
                            const newDiff = parseInt(e.target.value);
                            const diffText = newDiff === 1 ? 'Easy' : newDiff === 3 ? 'Medium' : 'Hard';
                            const newQuestions = [...(card.questions || [])];
                            newQuestions[qIdx] = { ...newQuestions[qIdx], difficulty: newDiff, difficultyText: diffText };
                            await fetch('/api/cards', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _id: card._id, questions: newQuestions }) });
                            fetchCards();
                          }}
                          className={`px-1 py-0.5 rounded text-[9px] font-bold cursor-pointer ${
                            q.difficulty === 1 ? 'bg-green-500/30 text-green-400' : 
                            q.difficulty === 3 ? 'bg-yellow-500/30 text-yellow-400' : 
                            'bg-red-500/30 text-red-400'
                          }`}
                        >
                          <option value={1}>Easy</option>
                          <option value={3}>Medium</option>
                          <option value={5}>Hard</option>
                        </select>
                      </td>
                      <td className="px-2 py-1 text-gray-300 max-w-[250px] truncate" title={q.question}>{q.question}</td>
                      <td className="px-2 py-1 relative">
                        <button 
                          onClick={() => setEditingAnswer({ 
                            cardId: card._id, 
                            qIdx, 
                            options: q.options.map(String), 
                            correctAnswer: String(q.correctAnswer) 
                          })}
                          className="text-green-400 font-medium max-w-[100px] truncate hover:underline cursor-pointer"
                          title="Click to edit options"
                        >
                          {q.correctAnswer}
                        </button>
                        {/* Answer Edit Popup */}
                        {editingAnswer?.cardId === card._id && editingAnswer?.qIdx === qIdx && (
                          <div className="absolute top-full left-0 mt-1 z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-3 min-w-[200px]">
                            <div className="text-[10px] text-gray-400 mb-2">Options (click to set correct):</div>
                            {editingAnswer.options.map((opt, optIdx) => (
                              <div key={optIdx} className="flex items-center gap-2 mb-1">
                                <button
                                  onClick={() => setEditingAnswer({ ...editingAnswer, correctAnswer: opt })}
                                  className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                                    editingAnswer.correctAnswer === opt 
                                      ? 'bg-green-500 border-green-500' 
                                      : 'border-gray-500 hover:border-green-400'
                                  }`}
                                />
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => {
                                    const newOpts = [...editingAnswer.options];
                                    const oldVal = newOpts[optIdx];
                                    newOpts[optIdx] = e.target.value;
                                    setEditingAnswer({ 
                                      ...editingAnswer, 
                                      options: newOpts,
                                      correctAnswer: editingAnswer.correctAnswer === oldVal ? e.target.value : editingAnswer.correctAnswer
                                    });
                                  }}
                                  className="flex-1 bg-gray-700 rounded px-2 py-1 text-xs text-white"
                                />
                              </div>
                            ))}
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={async () => {
                                  const newQuestions = [...(card.questions || [])];
                                  newQuestions[qIdx] = { 
                                    ...newQuestions[qIdx], 
                                    options: editingAnswer.options, 
                                    correctAnswer: editingAnswer.correctAnswer 
                                  };
                                  await fetch('/api/cards', { 
                                    method: 'PUT', 
                                    headers: { 'Content-Type': 'application/json' }, 
                                    body: JSON.stringify({ _id: card._id, questions: newQuestions }) 
                                  });
                                  setEditingAnswer(null);
                                  fetchCards();
                                }}
                                className="flex-1 bg-green-600 hover:bg-green-700 rounded px-2 py-1 text-xs font-bold"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingAnswer(null)}
                                className="flex-1 bg-gray-600 hover:bg-gray-700 rounded px-2 py-1 text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        <input 
                          type="number" 
                          value={q.maxReward} 
                          onChange={async (e) => {
                            const newPts = parseInt(e.target.value) || 50;
                            const newQuestions = [...(card.questions || [])];
                            newQuestions[qIdx] = { ...newQuestions[qIdx], maxReward: newPts };
                            await fetch('/api/cards', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _id: card._id, questions: newQuestions }) });
                            fetchCards();
                          }}
                          className="w-12 bg-gray-700 rounded px-1 py-0.5 text-yellow-400 text-xs text-center"
                        />
                      </td>
                                            <td className="px-2 py-1 text-right">
                        <button onClick={() => handleDelete(card._id)} disabled={isDeleting === card._id} className="p-1 rounded hover:bg-red-900/50 disabled:opacity-50">
                          {isDeleting === card._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3 text-gray-400 hover:text-red-400" />}
                        </button>
                      </td>
                    </tr>
                  );
              });
            })()}
            {cards.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No cards yet. Use Generate above.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Image Picker Modal */}
      <ImagePickerModal
        isOpen={!!imagePickerCard}
        onClose={() => setImagePickerCard(null)}
        onSelect={async (url: string) => {
          if (!imagePickerCard) return;
          setGeneratingImageFor(imagePickerCard.cardId);
          setImagePickerCard(null);
          try {
            const res = await fetch('/api/cards', { 
              method: 'PUT', 
              headers: { 'Content-Type': 'application/json' }, 
              body: JSON.stringify({ _id: imagePickerCard.cardId, previewImage: url, playerImage: url }) 
            });
            const data = await res.json();
            if (data.success) {
              await fetchCards();
            } else {
              alert('Failed to save image: ' + data.error);
            }
          } catch (err) {
            console.error('Error saving image:', err);
            alert('Error saving image');
          } finally {
            setGeneratingImageFor(null);
          }
        }}
        searchTerm={imagePickerCard?.searchTerm}
        showAiGenerate={true}
        aiPromptContext={`Quiz card about: ${imagePickerCard?.searchTerm}`}
      />
      </>
      )}
    </div>
  );
}
