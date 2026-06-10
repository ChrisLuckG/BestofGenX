"use client";

import { useState, useEffect } from "react";
import { Trash2, Loader2, Sparkles, ChevronLeft, ChevronRight, Calendar, ChevronUp, ChevronDown, Wand2 } from "lucide-react";

interface QuestionVariant {
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
  topic: string;
  questions: QuestionVariant[];
  timeLimit: number;
  previewImage: string;
  playerImage: string;
  active: boolean;
  guestCard: boolean;
  gameDate: string;
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
  difficultyText: "Easy", maxReward: 50, timeLimit: 10,
  previewImage: "", playerImage: "", active: true, guestCard: false,
};

const emptyDifficultyCard: DifficultyCard = {
  question: "", options: ["", "", "", ""], correctAnswer: "",
  highlightWords: [], difficulty: 1, difficultyText: "Easy", maxReward: 50,
};

const THEMES = ['MUSIC','MOVIES','TV SHOWS','SPORTS','GAMING','FASHION','TECHNOLOGY','CELEBRITIES'];

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

export default function CardsTab() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCard, setEditingCard] = useState<Partial<Card> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [isSearchingImage, setIsSearchingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [difficultyCards, setDifficultyCards] = useState<DifficultyCard[]>([
    { ...emptyDifficultyCard, difficulty: 1, difficultyText: "Easy", maxReward: 50 },
    { ...emptyDifficultyCard, difficulty: 3, difficultyText: "Medium", maxReward: 100 },
    { ...emptyDifficultyCard, difficulty: 5, difficultyText: "Hard", maxReward: 150 },
  ]);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [isRegeneratingDifficulty, setIsRegeneratingDifficulty] = useState<number | null>(null);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAllCards, setShowAllCards] = useState(true);
  const [themeFilter, setThemeFilter] = useState<string | null>(null);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [bulkConfig, setBulkConfig] = useState({ count: 10, theme: 'MIX', guestCard: false, difficulty: 'Easy' as 'Easy' | 'Medium' | 'Hard' });
  const [isCleaningGerman, setIsCleaningGerman] = useState(false);
  const [germanCount, setGermanCount] = useState<number | null>(null);
  const [imageMenuOpen, setImageMenuOpen] = useState<string | null>(null);
  const [generatingImageFor, setGeneratingImageFor] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'diff' | 'pts' | 'date' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [isSplitting, setIsSplitting] = useState(false);

  const fetchCards = async (date?: string) => {
    try {
      const dateParam = date || (showAllCards ? 'all' : selectedDate);
      const res = await fetch(`/api/cards?date=${dateParam}`);
      const data = await res.json();
      if (data.success) setCards(data.cards);
    } catch (error) {
      console.error("Error fetching cards:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards(showAllCards ? 'all' : selectedDate);
  }, [selectedDate, showAllCards]);

  const handleCreate = () => {
    setEditingCard({ ...emptyCard, gameDate: selectedDate });
    setIsCreating(true);
    setDifficultyCards([
      { ...emptyDifficultyCard, difficulty: 1, difficultyText: "Easy", maxReward: 50 },
      { ...emptyDifficultyCard, difficulty: 3, difficultyText: "Medium", maxReward: 100 },
      { ...emptyDifficultyCard, difficulty: 5, difficultyText: "Hard", maxReward: 150 },
    ]);
  };

  const handleEdit = (card: Card) => {
    setEditingCard({ ...card });
    setIsCreating(false);
    if (card.questions?.length > 0) {
      const newDiffCards = [
        { ...emptyDifficultyCard, difficulty: 1, difficultyText: "Easy", maxReward: 50 },
        { ...emptyDifficultyCard, difficulty: 3, difficultyText: "Medium", maxReward: 100 },
        { ...emptyDifficultyCard, difficulty: 5, difficultyText: "Hard", maxReward: 150 },
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
      const res = await fetch('/api/generate-quiz-set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: editingCard.topic || '', theme: editingCard.theme || 'MUSIC' }),
      });
      const data = await res.json();
      if (data.success && data.questions) {
        setDifficultyCards([
          { question: data.questions.easy.question, options: data.questions.easy.options, correctAnswer: data.questions.easy.correctAnswer, highlightWords: data.questions.easy.highlightWords || [], difficulty: 1, difficultyText: "Easy", maxReward: 50 },
          { question: data.questions.medium.question, options: data.questions.medium.options, correctAnswer: data.questions.medium.correctAnswer, highlightWords: data.questions.medium.highlightWords || [], difficulty: 3, difficultyText: "Medium", maxReward: 100 },
          { question: data.questions.hard.question, options: data.questions.hard.options, correctAnswer: data.questions.hard.correctAnswer, highlightWords: data.questions.hard.highlightWords || [], difficulty: 5, difficultyText: "Hard", maxReward: 150 },
        ]);
        setEditingCard({ ...editingCard, topic: data.topic || editingCard.topic, theme: data.theme || editingCard.theme, previewImage: data.generatedImage || editingCard.previewImage, playerImage: data.generatedImage || editingCard.playerImage });
      } else {
        alert('Generation failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Failed to generate quiz set');
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
        body: JSON.stringify({ type: editingCard.type, theme: editingCard.theme, topic: editingCard.topic, questions, timeLimit: editingCard.timeLimit || 10, previewImage: editingCard.previewImage, playerImage: editingCard.playerImage, active: true, gameDate: editingCard.gameDate || selectedDate }),
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
    if (!confirm("Delete this card?")) return;
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
    if (selectedCards.size === 0 || !confirm(`Delete ${selectedCards.size} cards?`)) return;
    setIsDeletingSelected(true);
    try {
      await Promise.all(Array.from(selectedCards).map(id => fetch(`/api/cards/${id}`, { method: "DELETE" })));
      setSelectedCards(new Set());
      fetchCards();
    } catch { alert("Failed to delete some cards"); }
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

  const handleBulkGenerate = async () => {
    if (isBulkGenerating) return;
    const allThemes = THEMES.filter(t => t !== 'CELEBRITIES');
    const count = bulkConfig.count;
    const difficulty = bulkConfig.difficulty;
    const difficultyNum = difficulty === 'Easy' ? 1 : difficulty === 'Medium' ? 3 : 5;
    const maxReward = difficulty === 'Easy' ? 50 : difficulty === 'Medium' ? 100 : 150;
    
    setIsBulkGenerating(true);
    setBulkProgress({ current: 0, total: count });
    try {
      for (let i = 0; i < count; i++) {
        setBulkProgress({ current: i + 1, total: count });
        const isGuestCard = count === 30 ? (i < 5) : bulkConfig.guestCard;
        const theme = bulkConfig.theme === 'MIX' ? allThemes[Math.floor(Math.random() * allThemes.length)] : bulkConfig.theme;
        const res = await fetch('/api/generate-quiz-set', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme }) });
        const data = await res.json();
        if (!data.success || !data.questions) continue;
        
        // Pick only the selected difficulty
        const diffKey = difficulty.toLowerCase() as 'easy' | 'medium' | 'hard';
        const q = data.questions[diffKey];
        if (!q) continue;
        
        // Save single question card
        await fetch('/api/cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ 
          type: 'quiz', 
          theme: data.theme || theme, 
          topic: data.topic, 
          questions: [
            { question: q.question, options: q.options, correctAnswer: q.correctAnswer, highlightWords: q.highlightWords || [], difficulty: difficultyNum, difficultyText: difficulty, maxReward }
          ], 
          timeLimit: 10, 
          previewImage: data.generatedImage || '', 
          playerImage: data.generatedImage || '', 
          active: true, 
          guestCard: isGuestCard, 
          gameDate: selectedDate 
        }) });
        await new Promise(r => setTimeout(r, 500));
      }
      fetchCards();
    } catch { alert('Error generating cards'); }
    finally { setIsBulkGenerating(false); setBulkProgress({ current: 0, total: 0 }); }
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

  const toggleSort = (col: 'diff' | 'pts' | 'date') => {
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold">Quiz Cards</h2>
        <div className="flex items-center gap-2">
          <select value={bulkConfig.count} onChange={(e) => setBulkConfig({ ...bulkConfig, count: parseInt(e.target.value) })} disabled={isBulkGenerating} className="bg-gray-700 px-2 py-1 rounded text-xs">
            {[1,2,3,4,5,10,15,30].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={bulkConfig.theme} onChange={(e) => setBulkConfig({ ...bulkConfig, theme: e.target.value })} disabled={isBulkGenerating} className="bg-gray-700 px-2 py-1 rounded text-xs">
            <option value="MIX">Mix</option>
            {THEMES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={bulkConfig.difficulty} onChange={(e) => setBulkConfig({ ...bulkConfig, difficulty: e.target.value as 'Easy' | 'Medium' | 'Hard' })} disabled={isBulkGenerating} className={`px-2 py-1 rounded text-xs font-bold ${bulkConfig.difficulty === 'Easy' ? 'bg-green-500/30 text-green-400' : bulkConfig.difficulty === 'Medium' ? 'bg-yellow-500/30 text-yellow-400' : 'bg-red-500/30 text-red-400'}`}>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
          <button onClick={() => setBulkConfig({ ...bulkConfig, guestCard: !bulkConfig.guestCard })} disabled={isBulkGenerating} className={`px-2 py-1 rounded text-xs transition-colors ${bulkConfig.guestCard ? "bg-purple-500/30 text-purple-400" : "bg-gray-700 text-gray-400"}`}>
            {bulkConfig.guestCard ? "GUEST" : "LOGIN"}
          </button>
          <button onClick={handleBulkGenerate} disabled={isBulkGenerating} className="flex items-center gap-1 bg-[#D4873A] hover:bg-[#d00440] px-3 py-1 rounded text-xs font-bold disabled:opacity-50">
            {isBulkGenerating ? <><Loader2 className="w-3 h-3 animate-spin" />{bulkProgress.current}/{bulkProgress.total}</> : <><Sparkles className="w-3 h-3" />Generate</>}
          </button>
          <button onClick={handleCleanupGerman} disabled={isCleaningGerman} className="flex items-center gap-1 bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-xs font-bold disabled:opacity-50">
            {isCleaningGerman ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            German
          </button>
          {multiQuestionCards > 0 && (
            <button onClick={handleSplitCards} disabled={isSplitting} className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded text-xs font-bold disabled:opacity-50">
              {isSplitting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Split {multiQuestionCards}
            </button>
          )}
        </div>
      </div>

      {/* Date Picker */}
      <div className="bg-gray-800 rounded-lg px-3 py-2 mb-3 border border-gray-700">
        <div className="flex items-center justify-between">
          <button onClick={() => { setShowAllCards(false); const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toISOString().split('T')[0]); }} disabled={showAllCards} className="p-1 hover:bg-gray-700 rounded disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-[#D4873A]" />
            {showAllCards ? (
              <span className="bg-gray-700 rounded px-3 py-1 text-xs font-bold">ALL CARDS</span>
            ) : (
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-center" />
            )}
            <span className="text-xs font-bold">
              {showAllCards ? <span className="text-yellow-400">POOL</span>
                : selectedDate === new Date().toISOString().split('T')[0] ? <span className="text-green-400">TODAY</span>
                : new Date(selectedDate) > new Date() ? <span className="text-blue-400">FUTURE</span>
                : <span className="text-gray-500">PAST</span>}
            </span>
            <button 
              onClick={() => {
                if (showAllCards) {
                  // Going back to calendar view
                  setShowAllCards(false);
                  setSelectedDate(new Date().toISOString().split('T')[0]); // Reset to today
                } else {
                  setShowAllCards(true);
                }
              }} 
              className={`px-2 py-0.5 rounded text-xs font-bold ${showAllCards ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-300'}`}
            >
              {showAllCards ? 'KALENDER' : 'ALL'}
            </button>
          </div>
          <button onClick={() => { setShowAllCards(false); const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d.toISOString().split('T')[0]); }} disabled={showAllCards} className="p-1 hover:bg-gray-700 rounded disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex justify-center gap-4 mt-1.5 pt-1.5 border-t border-gray-700 text-xs">
          <span className="text-gray-400">Total: <strong className="text-white">{cards.length * 3}</strong></span>
          <span className="text-purple-400">Guest: <strong>{cards.filter(c => c.guestCard).length * 3}</strong></span>
          <span className="text-blue-400">Login: <strong>{cards.filter(c => !c.guestCard).length * 3}</strong></span>
          {cards.filter(c => !c.previewImage).length > 0 && <span className="text-red-400">No img: <strong>{cards.filter(c => !c.previewImage).length}</strong></span>}
        </div>
        {/* Theme Filter Buttons */}
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
            return (
              <button
                key={theme}
                onClick={() => setThemeFilter(theme)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                  themeFilter === theme ? 'bg-[#D4873A] text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                } ${count === 0 ? 'opacity-40' : ''}`}
              >
                {theme} {count > 0 && <span className="text-[8px] opacity-70">({count})</span>}
              </button>
            );
          })}
        </div>
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
              <th className="px-2 py-2 text-left text-gray-300 w-8">#</th>
              <th className="px-2 py-2 text-left text-gray-300 w-12">Img</th>
              <th className="px-2 py-2 text-left text-gray-300">Theme</th>
              <th className="px-2 py-2 text-left text-gray-300">Topic</th>
              <th className="px-2 py-2 text-left text-gray-300 cursor-pointer hover:text-white" onClick={() => toggleSort('diff')}>
                <span className="flex items-center gap-0.5">Diff {sortBy === 'diff' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</span>
              </th>
              <th className="px-2 py-2 text-left text-gray-300">Question</th>
              <th className="px-2 py-2 text-left text-gray-300">Answer</th>
              <th className="px-2 py-2 text-left text-gray-300 w-16 cursor-pointer hover:text-white" onClick={() => toggleSort('pts')}>
                <span className="flex items-center gap-0.5">Pts {sortBy === 'pts' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</span>
              </th>
              {showAllCards && <th className="px-2 py-2 text-left text-gray-300 cursor-pointer hover:text-white" onClick={() => toggleSort('date')}>
                <span className="flex items-center gap-0.5">Date {sortBy === 'date' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</span>
              </th>}
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
                  else if (sortBy === 'date') cmp = (a.card.gameDate || '').localeCompare(b.card.gameDate || '');
                  return sortDir === 'asc' ? cmp : -cmp;
                });
              }
              
              const shownMenuForCard = new Set<string>();
              return flatQuestions.map(({ card, q, qIdx }, rowNum) => {
                const showMenuHere = !shownMenuForCard.has(card._id);
                if (showMenuHere) shownMenuForCard.add(card._id);
                  return (
                    <tr key={`${card._id}-${qIdx}`} className="border-t border-gray-700 hover:bg-gray-750">
                      <td className="px-2 py-1 text-gray-500 font-mono">{rowNum + 1}</td>
                      <td className="px-2 py-1 relative">
                        {generatingImageFor === card._id ? (
                          <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin text-[#D4873A]" />
                          </div>
                        ) : (
                          <button onClick={() => setImageMenuOpen(imageMenuOpen === card._id ? null : card._id)} className="cursor-pointer">
                            {card.previewImage ? (
                              <img src={card.previewImage} alt="" className="w-8 h-8 rounded object-cover hover:ring-2 hover:ring-[#D4873A]" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center text-gray-500 text-[8px] hover:bg-gray-600">+</div>
                            )}
                          </button>
                        )}
                        {imageMenuOpen === card._id && showMenuHere && (
                          <div className="absolute top-full left-0 mt-1 z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-1 flex flex-col gap-1 min-w-[80px]">
                            <label className="px-2 py-1 text-[10px] bg-blue-600 hover:bg-blue-700 rounded cursor-pointer text-center">
                              Upload
                              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setImageMenuOpen(null);
                                setGeneratingImageFor(card._id); // Show loading
                                try {
                                  const formData = new FormData();
                                  formData.append('file', file);
                                  const res = await fetch('/api/upload', { method: 'POST', body: formData });
                                  const data = await res.json();
                                  console.log('Upload response:', data);
                                  if (data.success && data.url) {
                                    const updateRes = await fetch('/api/cards', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _id: card._id, previewImage: data.url, playerImage: data.url }) });
                                    const updateData = await updateRes.json();
                                    console.log('Card update response:', updateData);
                                    if (updateData.success) {
                                      await fetchCards();
                                    } else {
                                      alert('Failed to save image: ' + updateData.error);
                                    }
                                  } else {
                                    alert('Upload failed: ' + (data.error || 'Unknown error'));
                                  }
                                } catch (err) {
                                  console.error('Upload error:', err);
                                  alert('Upload error');
                                } finally {
                                  setGeneratingImageFor(null);
                                }
                              }} />
                            </label>
                            <button onClick={() => handleGenerateAIImage(card._id, card.topic)} className="px-2 py-1 text-[10px] bg-[#D4873A] hover:bg-[#C4772A] rounded flex items-center justify-center gap-1">
                              <Wand2 className="w-3 h-3" /> AI
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1 font-medium text-gray-400">{card.theme}</td>
                      <td className="px-2 py-1 text-gray-300 max-w-[100px] truncate" title={card.topic}>{card.topic}</td>
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
                      <td className="px-2 py-1 text-green-400 font-medium max-w-[100px] truncate" title={String(q.correctAnswer)}>{q.correctAnswer}</td>
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
                      {showAllCards && <td className="px-2 py-1 text-gray-500 font-mono text-[10px]">{card.gameDate}</td>}
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
              <tr><td colSpan={showAllCards ? 10 : 9} className="px-4 py-8 text-center text-gray-400">No cards yet. Use Generate above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
