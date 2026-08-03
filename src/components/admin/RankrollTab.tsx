"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Edit2, Trash2, Loader2, X, Save, Upload, Sparkles, Link, Wand2, FileText, Globe } from "lucide-react";
import BlockEditor from "./BlockEditor";
import ImagePickerModal from "./ImagePickerModal";
import { LANGUAGES, DEFAULT_LANGUAGE } from "@/config/languages";
import { AUTHOR_STYLES, DEFAULT_AUTHOR_STYLE } from "@/config/authorStyles";

interface RankrollTabProps {
  // When set, RankrollTab auto-opens the editor for this poll (used when a reporter's
  // rankroll proposal was pre-saved as a draft from the Newsroom Conference).
  initialEditPollId?: string | null;
  // Called once the auto-opened editor has been closed (saved OR discarded), so the
  // parent can clear its pending-poll-id state.
  onProposalHandled?: () => void;
  // When true, only the editor modal (overlay) is rendered — the main poll list view is
  // hidden. Used to show the "Edit Ranking List" editor on top of another tab (e.g. the
  // Newsroom Conference) without navigating away from it.
  hideListView?: boolean;
}

export default function RankrollTab({ initialEditPollId, onProposalHandled, hideListView }: RankrollTabProps = {}) {
  const [polls, setPolls] = useState<any[]>([]);
  const [pollsLoading, setPollsLoading] = useState(false);
  const [editingPoll, setEditingPoll] = useState<any | null>(null);
  const [articles, setArticles] = useState<{ _id: string; title: string }[]>([]);
  const [uploadingItemIndex, setUploadingItemIndex] = useState<number | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [imageMenuIndex, setImageMenuIndex] = useState<number | null>(null);
  const [urlInputIndex, setUrlInputIndex] = useState<number | null>(null);
  const [tempUrl, setTempUrl] = useState('');
  const [searchingGifIndex, setSearchingGifIndex] = useState<number | null>(null);
  const [articleGenerating, setArticleGenerating] = useState(false);
  const [generatedArticle, setGeneratedArticle] = useState<any | null>(null);
  const [articleLanguage, setArticleLanguage] = useState<string>(DEFAULT_LANGUAGE);
  const [articleStyle, setArticleStyle] = useState<string>(DEFAULT_AUTHOR_STYLE);
  const [showImagePicker, setShowImagePicker] = useState(false); // For article thumbnail (right side)
  const [showRankrollImagePicker, setShowRankrollImagePicker] = useState(false); // For rankroll cover (left side)
  const [imagePickerItemIndex, setImagePickerItemIndex] = useState<number | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'ranking' | 'quiz' | 'simple'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const itemImageInputRef = useRef<HTMLInputElement>(null);

  // Auto-search GIF from Tenor based on item title
  const searchGifForItem = async (itemIndex: number, title: string, currentImage?: string) => {
    if (!title.trim()) {
      alert('Please enter a title first');
      return;
    }
    
    setSearchingGifIndex(itemIndex);
    setImageMenuIndex(null);
    
    try {
      // Clean up title but keep country for context
      // "Ronaldo (1994-2007) - Brazil" -> "Ronaldo Brazil"
      const countryMatch = title.match(/\s*-\s*([A-Za-z]+)\s*$/);
      const country = countryMatch ? countryMatch[1] : '';
      
      let searchQuery = title
        .replace(/\s*\(\d{4}(?:\s*-\s*\d{4})?\)\s*/g, '') // Remove (1956-1977) or (1992)
        .replace(/\s*-\s*[A-Za-z]+.*$/, '') // Remove " - Brazil" etc
        .trim();
      
      // Add country back for better search results (e.g. "Ronaldo Brazil" vs just "Ronaldo")
      if (country) {
        searchQuery = `${searchQuery} ${country}`;
      }
      
      // If there's already an image, skip to get a different one
      const skip = currentImage ? Math.floor(Math.random() * 10) + 1 : 0;
      const res = await fetch(`/api/tenor-search?q=${encodeURIComponent(searchQuery)}&skip=${skip}`);
      const data = await res.json();
      
      if (data.success && data.url) {
        await updateItemImage(itemIndex, data.url);
      } else {
        alert('No GIF found for: ' + title);
      }
    } catch (error) {
      console.error('GIF search error:', error);
      alert('GIF search failed');
    } finally {
      setSearchingGifIndex(null);
    }
  };

  // Fetch GIF for a single title
  const fetchGifForTitle = async (title: string): Promise<string> => {
    try {
      const res = await fetch(`/api/tenor-search?q=${encodeURIComponent(title)}`);
      const data = await res.json();
      return data.success && data.url ? data.url : '';
    } catch {
      return '';
    }
  };

  // AI Generator for ranking lists
  const generateWithAI = async () => {
    if (!aiTopic.trim()) {
      alert('Please enter a topic');
      return;
    }
    
    setAiGenerating(true);
    try {
      const res = await fetch('/api/generate-ranking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic }),
      });
      
      const data = await res.json();
      if (data.success && data.ranking) {
        // Create items first
        const items = data.ranking.items.map((item: any, i: number) => ({
          id: `item_${Date.now()}_${i}`,
          title: item.title,
          description: item.description,
          image: item.image || '',
          upvotes: 0,
          downvotes: 0,
          score: 0,
        }));
        
        // Set the poll immediately so user sees progress
        setEditingPoll({
          ...editingPoll,
          title: data.ranking.title,
          subtitle: data.ranking.subtitle,
          items,
        });
        setAiTopic('');
        
        // Now fetch GIFs for all items in parallel
        const gifPromises = items.map((item: any) => fetchGifForTitle(item.title));
        const gifs = await Promise.all(gifPromises);
        
        // Update items with GIFs
        const itemsWithGifs = items.map((item: any, i: number) => ({
          ...item,
          image: gifs[i] || item.image,
        }));
        
        setEditingPoll((prev: any) => ({
          ...prev,
          items: itemsWithGifs,
        }));
      } else {
        alert('AI generation failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('AI generation error:', error);
      alert('AI generation failed');
    } finally {
      setAiGenerating(false);
    }
  };

  // Generate Article from Ranking Poll
  const generateArticleFromPoll = async () => {
    if (!editingPoll || editingPoll.type !== 'ranking') return;
    if (!editingPoll.title || !editingPoll.items?.length) {
      alert('Please fill in the ranking title and items first');
      return;
    }
    
    setArticleGenerating(true);
    try {
      const res = await fetch('/api/generate-ranking-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingPoll.title,
          subtitle: editingPoll.subtitle,
          language: articleLanguage,
          style: articleStyle,
          items: editingPoll.items.map((item: any) => ({
            title: item.title,
            description: item.description,
          })),
        }),
      });
      
      const data = await res.json();
      if (data.success && data.article) {
        setGeneratedArticle({
          title: data.article.title,
          subtitle: data.article.subtitle,
          content: data.article.content,
          category: 'culture',
          tags: data.article.tags || [],
          language: articleLanguage,
        });
      } else {
        alert('Article generation failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Article generation error:', error);
      alert('Article generation failed');
    } finally {
      setArticleGenerating(false);
    }
  };

  useEffect(() => {
    fetchPolls();
    fetch('/api/articles?admin=true').then(r => r.json()).then(d => { if (d.success) setArticles(d.articles.map((a: any) => ({ _id: a._id, title: a.title }))); }).catch(() => {});
  }, []);

  // Auto-open the editor for a poll pre-saved from a reporter proposal (Newsroom Conference)
  useEffect(() => {
    if (!initialEditPollId || polls.length === 0) return;
    const poll = polls.find(p => p._id === initialEditPollId);
    if (poll) {
      setEditingPoll({ ...poll, _fromProposal: true });
    }
  }, [initialEditPollId, polls]);

  // Close the editor. If it was opened from a reporter proposal and was never actually
  // saved by the admin, DELETE the draft poll instead of leaving it orphaned.
  const closeEditorDiscardIfProposal = async () => {
    if (editingPoll?._fromProposal && editingPoll._id) {
      try {
        await fetch(`/api/polls/${editingPoll._id}`, { method: 'DELETE' });
        fetchPolls();
      } catch { /* ignore */ }
    }
    setEditingPoll(null);
    setGeneratedArticle(null);
    onProposalHandled?.();
  };

  const fetchPolls = async () => {
    setPollsLoading(true);
    try {
      const res = await fetch("/api/polls?status=all");
      const data = await res.json();
      if (data.success) {
        setPolls(data.polls);
      }
    } catch (error) {
      console.error("Error fetching polls:", error);
    } finally {
      setPollsLoading(false);
    }
  };

  // Update item image and sync to linked article if first item
  const updateItemImage = async (itemIndex: number, imageUrl: string) => {
    if (!editingPoll) return;
    
    const newItems = [...editingPoll.items];
    newItems[itemIndex] = { ...newItems[itemIndex], image: imageUrl };
    setEditingPoll({ ...editingPoll, items: newItems });
    
    // If first item and article is linked, update article cover too
    if (itemIndex === 0 && editingPoll.linkedArticleId) {
      try {
        await fetch(`/api/articles/${editingPoll.linkedArticleId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coverImage: imageUrl }),
        });
        console.log('Article cover updated:', imageUrl);
      } catch (e) {
        console.error('Failed to update article cover:', e);
      }
    }
  };

  // Handle image upload for ranking items
  const handleItemImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, itemIndex: number) => {
    const file = e.target.files?.[0];
    if (!file || !editingPoll) return;
    
    setUploadingItemIndex(itemIndex);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (data.success && data.url) {
        await updateItemImage(itemIndex, data.url);
      } else {
        alert('Upload failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed');
    } finally {
      setUploadingItemIndex(null);
      if (itemImageInputRef.current) itemImageInputRef.current.value = '';
    }
  };

  const savePoll = async (publishWithArticle = false) => {
    if (!editingPoll) return;
    try {
      let articleId = editingPoll.linkedArticleId;
      
      // If publishing with article, create article first
      if (publishWithArticle) {
        // Use generated article if available, otherwise create from poll data
        const articlePayload = generatedArticle || {
          title: editingPoll.title,
          subtitle: editingPoll.subtitle || editingPoll.description || '',
          content: '', // Empty content, will be linked to rankroll
          category: editingPoll.category || 'culture',
          tags: [],
          coverImage: editingPoll.items?.[0]?.image || '',
        };
        
        const articleRes = await fetch('/api/articles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'system', // Will be handled by API
            title: articlePayload.title,
            subtitle: articlePayload.subtitle,
            content: articlePayload.content,
            category: articlePayload.category || 'culture',
            tags: articlePayload.tags || [],
            coverImage: articlePayload.coverImage || editingPoll.items?.[0]?.image || '',
            status: 'published',
            contentType: 'rankroll', // Mark as rankroll article
          }),
        });
        
        const articleResult = await articleRes.json();
        if (articleResult.success && articleResult.article?._id) {
          articleId = articleResult.article._id;
        } else {
          alert('Failed to create article: ' + (articleResult.error || 'Unknown error'));
          return;
        }
      }
      
      const method = editingPoll._id ? "PATCH" : "POST";
      const url = editingPoll._id ? `/api/polls/${editingPoll._id}` : "/api/polls";
      
      // Include linkedArticleId and articleImage
      const pollData = {
        ...editingPoll,
        linkedArticleId: articleId || editingPoll.linkedArticleId,
        // Use rankroll cover image, fallback to first item image
        articleImage: editingPoll.image || editingPoll.items?.[0]?.image || editingPoll.articleImage,
      };
      
      console.log('Saving poll:', pollData);
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pollData),
      });
      
      const data = await res.json();
      console.log('Response:', data);
      
      if (res.ok && data.success) {
        // If article was created, update it with linkedContentId
        if (articleId && data.poll?._id) {
          await fetch(`/api/articles/${articleId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ linkedContentId: data.poll._id }),
          });
        }
        
        fetchPolls();
        setEditingPoll(null);
        setGeneratedArticle(null);
        onProposalHandled?.();
        alert(publishWithArticle ? 'Poll & Article published successfully!' : 'Poll saved successfully!');
      } else {
        alert('Error: ' + (data.error || 'Failed to save poll'));
      }
    } catch (error) {
      console.error("Error saving poll:", error);
      alert('Error saving poll: ' + error);
    }
  };

  const deletePoll = async (id: string) => {
    if (!confirm("Delete this poll?")) return;
    try {
      const res = await fetch(`/api/polls/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
        fetchPolls();
      }
    } catch (error) {
      console.error("Error deleting poll:", error);
    }
  };

  // Toggle a single row's selection
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Select all / none for the currently visible list
  const toggleSelectAll = () => {
    const visibleIds = getCurrentPolls().map(p => p._id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(visibleIds));
  };

  // Delete all selected polls
  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected item(s)? This cannot be undone.`)) return;
    try {
      await Promise.all(Array.from(selectedIds).map(id => fetch(`/api/polls/${id}`, { method: "DELETE" })));
      setSelectedIds(new Set());
      fetchPolls();
    } catch (error) {
      console.error("Error deleting selected polls:", error);
      alert('Failed to delete some items');
    }
  };

  // Toggle poll status
  const toggleStatus = async (poll: any) => {
    const newStatus = poll.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`/api/polls/${poll._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) fetchPolls();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  // Group polls by type
  const rankingPolls = polls.filter(p => p.type === 'ranking');
  const quizPolls = polls.filter(p => p.type === 'quiz');
  const simplePolls = polls.filter(p => p.type === 'simple' || !p.type);

  // Filters like Predictions
  const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'ranking', label: 'Ranking Lists' },
    { id: 'quiz', label: 'Self-Tests' },
    { id: 'simple', label: 'Simple Polls' },
  ] as const;

  // Get current list based on filter
  const getCurrentPolls = () => {
    switch (activeSubTab) {
      case 'ranking': return rankingPolls;
      case 'quiz': return quizPolls;
      case 'simple': return simplePolls;
      default: return polls;
    }
  };

  const currentPolls = getCurrentPolls();

  // Create new poll based on current filter
  const createNewPoll = (type: 'ranking' | 'quiz' | 'simple') => {
    if (type === 'ranking') {
      setEditingPoll({
        title: '', subtitle: '', description: '', image: '', type: 'ranking',
        items: [
          { id: 'item_1', title: '', description: '', image: '', upvotes: 0, downvotes: 0, score: 0 },
          { id: 'item_2', title: '', description: '', image: '', upvotes: 0, downvotes: 0, score: 0 },
          { id: 'item_3', title: '', description: '', image: '', upvotes: 0, downvotes: 0, score: 0 },
        ],
        category: 'ranking', status: 'inactive', featured: false,
      });
    } else if (type === 'quiz') {
      setEditingPoll({
        title: '', subtitle: '', description: '', image: '', type: 'quiz',
        questions: [{ id: 'q1', question: '', answers: [
          { id: 'q1_a1', text: '', emoji: '', resultType: 'type_a' },
          { id: 'q1_a2', text: '', emoji: '', resultType: 'type_b' },
        ]}],
        resultTypes: [
          { id: 'type_a', label: '', image: '', description: '', votes: 0 },
          { id: 'type_b', label: '', image: '', description: '', votes: 0 },
        ],
        category: 'personality', status: 'inactive', featured: false,
      });
    } else {
      setEditingPoll({
        title: '', subtitle: '', description: '', image: '', type: 'simple',
        options: [
          { id: 'option_1', label: '', emoji: '' },
          { id: 'option_2', label: '', emoji: '' },
        ],
        category: 'general', status: 'inactive', featured: false,
      });
    }
  };

  return (
    <>
      {!hideListView && (
      <div>
        {/* Header like Predictions */}
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-[#D4873A]" />
          <h2 className="text-sm font-bold">Rankroll</h2>
          <span className="text-xs text-gray-500">({currentPolls.length})</span>
        </div>

        {/* Filter tabs + Create button on same row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveSubTab(f.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  activeSubTab === f.id ? 'bg-[#D4873A] text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {/* Show button based on active filter */}
            {(activeSubTab === 'all' || activeSubTab === 'ranking') && (
              <button
                onClick={() => createNewPoll('ranking')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#D4873A] text-white hover:bg-[#C4772A] transition-colors"
              >
                <Plus className="w-3 h-3" />
                Ranking
              </button>
            )}
            {(activeSubTab === 'all' || activeSubTab === 'quiz') && (
              <button
                onClick={() => createNewPoll('quiz')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 text-white hover:bg-purple-500 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Self-Test
              </button>
            )}
            {(activeSubTab === 'all' || activeSubTab === 'simple') && (
              <button
                onClick={() => createNewPoll('simple')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-700 text-white hover:bg-gray-600 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Poll
              </button>
            )}
          </div>
        </div>

        {/* Bulk actions toolbar */}
        {!pollsLoading && currentPolls.length > 0 && (
          <div className="flex items-center gap-3 mb-2 px-1">
            <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={currentPolls.length > 0 && currentPolls.every(p => selectedIds.has(p._id))}
                onChange={toggleSelectAll}
                className="accent-[#D4873A]"
              />
              Select all
            </label>
            <span className="text-xs text-gray-500">{currentPolls.length} items</span>
            {selectedIds.size > 0 && (
              <button
                onClick={deleteSelected}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete selected ({selectedIds.size})
              </button>
            )}
          </div>
        )}

        {/* List */}
        {pollsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-[#D4873A] animate-spin" />
          </div>
        ) : currentPolls.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-12">
            No items yet. Create your first one above.
          </p>
        ) : (
          <div className="space-y-2">
            {currentPolls.map((poll, idx) => (
              <div
                key={poll._id}
                onClick={() => setEditingPoll(poll)}
                className={`bg-gray-800 rounded-xl p-3 border cursor-pointer transition-colors flex items-center gap-3 ${
                  selectedIds.has(poll._id) ? 'border-[#D4873A]' : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                {/* Selection checkbox */}
                <input
                  type="checkbox"
                  checked={selectedIds.has(poll._id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSelect(poll._id)}
                  className="accent-[#D4873A] flex-shrink-0"
                />
                {/* Running number */}
                <span className="text-xs text-gray-500 w-7 text-right flex-shrink-0 tabular-nums">{idx + 1}</span>
                {/* Image - prioritize main thumbnail (poll.image), then articleImage, then first item */}
                {(poll.image || poll.articleImage || poll.items?.[0]?.image) && (
                  <img src={poll.image || poll.articleImage || poll.items?.[0]?.image} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                )}
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{poll.title}</div>
                  <div className="text-xs text-gray-400">
                    {poll.type === 'ranking' && <>{poll.items?.length || 0} items</>}
                    {poll.type === 'quiz' && <>{poll.questions?.length || 0} questions</>}
                    {poll.type === 'simple' && <>{poll.options?.length || 0} options</>}
                    {' · '}{poll.totalVotes || 0} votes
                    {poll.linkedArticleId && <span className="text-purple-400 ml-1">· Article</span>}
                    {poll.createdAt && <span className="ml-1">· {new Date(poll.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>}
                  </div>
                </div>
                {/* Type badge - smaller */}
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  poll.type === 'ranking' ? 'bg-[#D4873A]/20 text-[#D4873A]' :
                  poll.type === 'quiz' ? 'bg-purple-500/20 text-purple-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {poll.type === 'ranking' ? 'Rank' : poll.type === 'quiz' ? 'Quiz' : 'Poll'}
                </span>
                {/* Status badge - clickable toggle */}
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleStatus(poll); }}
                  className={`text-[9px] px-1.5 py-0.5 rounded font-bold transition-colors ${
                    poll.status === 'active' ? 'bg-green-500/20 text-green-400 hover:bg-green-500/40' : 'bg-gray-600/30 text-gray-400 hover:bg-gray-500/40'
                  }`}
                >
                  {poll.status === 'active' ? 'active' : 'inactive'}
                </button>
                {/* Edit button */}
                <button onClick={(e) => { e.stopPropagation(); setEditingPoll(poll); }} className="p-1 hover:bg-blue-500/20 rounded text-blue-400">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                {/* Delete button */}
                <button onClick={(e) => { e.stopPropagation(); deletePoll(poll._id); }} className="p-1 hover:bg-red-500/20 rounded text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Poll Editor Modal - Extra Wide for Desktop */}
      {editingPoll && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2">
          <div className={`bg-gray-800 rounded-xl w-full ${editingPoll.type === 'ranking' ? 'max-w-[95vw]' : 'max-w-2xl'} max-h-[95vh] overflow-hidden flex flex-col`}>
            {/* Header */}
            <div className="p-3 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold">
                  {editingPoll._id ? 'Edit' : 'Create'} {editingPoll.type === 'ranking' ? 'Ranking List' : 'Poll'}
                </h3>
                {/* AI Generator inline for ranking */}
                {editingPoll.type === 'ranking' && (
                  <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-600">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <input
                      type="text"
                      value={aiTopic}
                      onChange={(e) => setAiTopic(e.target.value)}
                      placeholder="AI: Enter topic to generate..."
                      className="w-64 bg-gray-700 px-2 py-1 rounded text-xs"
                      onKeyDown={(e) => e.key === 'Enter' && generateWithAI()}
                    />
                    <button
                      onClick={generateWithAI}
                      disabled={aiGenerating || !aiTopic.trim()}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:text-gray-400 rounded font-bold text-xs flex items-center gap-1"
                    >
                      {aiGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Generate All
                    </button>
                  </div>
                )}
              </div>
              <button onClick={closeEditorDiscardIfProposal} className="p-1 hover:bg-gray-700 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden p-3">
              <div className={editingPoll.type === 'ranking' ? 'grid grid-cols-2 gap-4 h-full' : 'space-y-2'}>
              {/* LEFT COLUMN for Ranking / Single Column for others */}
              <div className={editingPoll.type === 'ranking' ? 'flex flex-col h-full overflow-hidden' : 'space-y-2'}>

              {/* Compact Header: Thumbnail + Title/Subtitle + Timer in one row */}
              <div className="flex-shrink-0 flex gap-3 items-start">
                {/* Thumbnail for Rankroll (left side) */}
                {editingPoll.type === 'ranking' && (
                  <div 
                    onClick={() => setShowRankrollImagePicker(true)}
                    className="w-14 h-14 flex-shrink-0 rounded overflow-hidden bg-gray-600 border border-gray-500 cursor-pointer hover:border-[#D4873A] transition-colors"
                  >
                    {editingPoll.image ? (
                      <img src={editingPoll.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-[9px]">
                        <Upload className="w-3 h-3" />
                        <span>Cover</span>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Title + Subtitle */}
                <div className="flex-1 space-y-1">
                  <input
                    type="text"
                    value={editingPoll.title || ''}
                    onChange={(e) => setEditingPoll({ ...editingPoll, title: e.target.value })}
                    placeholder="Title *"
                    className="w-full bg-gray-700 px-2 py-1 rounded text-sm font-medium"
                  />
                  <input
                    type="text"
                    value={editingPoll.subtitle || ''}
                    onChange={(e) => setEditingPoll({ ...editingPoll, subtitle: e.target.value })}
                    placeholder="Subtitle / Description"
                    className="w-full bg-gray-700 px-2 py-1 rounded text-xs text-gray-300"
                  />
                </div>

                {/* Countdown Timer - compact */}
                {editingPoll.type === 'ranking' && (
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-gray-400">
                      <input
                        type="checkbox"
                        checked={!!editingPoll.closesAt}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const defaultDate = new Date();
                            defaultDate.setDate(defaultDate.getDate() + 30);
                            setEditingPoll({ ...editingPoll, closesAt: defaultDate.toISOString().slice(0, 16) });
                          } else {
                            setEditingPoll({ ...editingPoll, closesAt: null });
                          }
                        }}
                        className="w-3 h-3 rounded border-gray-500 text-[#D4873A]"
                      />
                      Timer
                    </label>
                    {editingPoll.closesAt && (
                      <input
                        type="datetime-local"
                        value={editingPoll.closesAt?.slice(0, 16) || ''}
                        onChange={(e) => setEditingPoll({ ...editingPoll, closesAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                        className="bg-gray-600 px-1.5 py-0.5 rounded text-[10px] w-36"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* SIMPLE POLL: Options */}
              {editingPoll.type === 'simple' && (
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">Options *</label>
                <div className="space-y-2">
                  {(editingPoll.options || []).map((opt: any, i: number) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={opt.emoji || ''}
                        onChange={(e) => {
                          const newOptions = [...editingPoll.options];
                          newOptions[i] = { ...newOptions[i], emoji: e.target.value };
                          setEditingPoll({ ...editingPoll, options: newOptions });
                        }}
                        placeholder="🐝"
                        className="w-16 bg-gray-700 px-3 py-2 rounded-lg text-center"
                      />
                      <input
                        type="text"
                        value={opt.label || ''}
                        onChange={(e) => {
                          const newOptions = [...editingPoll.options];
                          newOptions[i] = { ...newOptions[i], label: e.target.value };
                          setEditingPoll({ ...editingPoll, options: newOptions });
                        }}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 bg-gray-700 px-4 py-2 rounded-lg"
                      />
                      {editingPoll.options.length > 2 && (
                        <button
                          onClick={() => {
                            const newOptions = editingPoll.options.filter((_: any, j: number) => j !== i);
                            setEditingPoll({ ...editingPoll, options: newOptions });
                          }}
                          className="p-2 hover:bg-red-500/20 rounded text-red-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const newOptions = [...editingPoll.options, { id: `option_${editingPoll.options.length + 1}`, label: '', emoji: '' }];
                      setEditingPoll({ ...editingPoll, options: newOptions });
                    }}
                    className="w-full py-2 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-gray-500"
                  >
                    + Add Option
                  </button>
                </div>
              </div>
              )}

              {/* RANKING LIST: Items */}
              {editingPoll.type === 'ranking' && (
              <div className="flex flex-col flex-1 min-h-0 mt-2 overflow-hidden">
                <label className="block text-[10px] text-gray-400 mb-1 flex-shrink-0">Ranking Items *</label>
                <div className="space-y-2 overflow-y-auto flex-1 pr-1 max-h-[calc(95vh-350px)]" style={{ scrollbarWidth: 'thin', scrollbarColor: '#D4873A #374151' }}>
                  {(editingPoll.items || []).map((item: any, i: number) => (
                    <div key={i} className="bg-gray-700/30 rounded-lg p-3 flex gap-3">
                      {/* Image Preview - Click to open ImagePickerModal */}
                      <div 
                        onClick={() => setImagePickerItemIndex(i)}
                        className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-600 border border-gray-500 cursor-pointer hover:border-[#D4873A] hover:bg-gray-500 transition-colors"
                      >
                        {(uploadingItemIndex === i || searchingGifIndex === i) ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <Loader2 className="w-5 h-5 text-[#D4873A] animate-spin" />
                          </div>
                        ) : item.image ? (
                          <img src={item.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-[10px] gap-0.5">
                            <Upload className="w-4 h-4" />
                            <span>Image</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 space-y-1.5">
                        <div className="flex gap-2 items-center">
                          <span className="text-xs font-bold text-[#D4873A] w-6">#{i + 1}</span>
                          <input
                            type="text"
                            value={item.title || ''}
                            onChange={(e) => {
                              const newItems = [...editingPoll.items];
                              newItems[i] = { ...newItems[i], title: e.target.value };
                              setEditingPoll({ ...editingPoll, items: newItems });
                            }}
                            placeholder="Item title (e.g. The Breakfast Club)"
                            className="flex-1 bg-gray-700 px-2 py-1.5 rounded text-sm font-medium"
                          />
                          {editingPoll.items.length > 2 && (
                            <button
                              onClick={() => {
                                const newItems = editingPoll.items.filter((_: any, j: number) => j !== i);
                                setEditingPoll({ ...editingPoll, items: newItems });
                              }}
                              className="p-1.5 hover:bg-red-500/20 rounded text-red-400"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={item.description || ''}
                          onChange={(e) => {
                            const newItems = [...editingPoll.items];
                            newItems[i] = { ...newItems[i], description: e.target.value };
                            setEditingPoll({ ...editingPoll, items: newItems });
                          }}
                          placeholder="Short description (e.g. 1985 - John Hughes classic)"
                          className="w-full bg-gray-700 px-2 py-1 rounded text-xs text-gray-300"
                        />
                        <input
                          type="text"
                          value={item.image?.replace('/images/', '') || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const fullUrl = val.startsWith('http') || val.startsWith('/') ? val : `/images/${val}`;
                            const newItems = [...editingPoll.items];
                            newItems[i] = { ...newItems[i], image: val ? fullUrl : '' };
                            setEditingPoll({ ...editingPoll, items: newItems });
                          }}
                          placeholder="Image: movie.jpg or https://..."
                          className="w-full bg-gray-700 px-2 py-1 rounded text-[10px] text-gray-400"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Add Item Button - outside scrollable area */}
                <button
                  onClick={() => {
                    const newItems = [...(editingPoll.items || []), { 
                      id: `item_${Date.now()}`, 
                      title: '', 
                      description: '', 
                      image: '', 
                      upvotes: 0, 
                      downvotes: 0, 
                      score: 0 
                    }];
                    setEditingPoll({ ...editingPoll, items: newItems });
                  }}
                  className="w-full py-2 mt-2 border border-dashed border-[#D4873A] rounded-lg text-[#D4873A] hover:bg-[#D4873A]/10 flex-shrink-0"
                >
                  + Add Item ({editingPoll.items?.length || 0})
                </button>
              </div>
              )}

              {/* QUIZ: Result Types with Descriptions */}
              {editingPoll.type === 'quiz' && (
              <>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Result Types & Descriptions</label>
                  <div className="space-y-2">
                    {(editingPoll.resultTypes || []).map((rt: any, i: number) => (
                      <div key={i} className="bg-gray-700/30 rounded p-2">
                        <div className="flex gap-2 mb-1">
                          {/* Image preview or placeholder */}
                          <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-gray-600">
                            {rt.image ? (
                              <img src={rt.image} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">IMG</div>
                            )}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={rt.id || ''}
                                onChange={(e) => {
                                  const newTypes = [...editingPoll.resultTypes];
                                  newTypes[i] = { ...newTypes[i], id: e.target.value };
                                  setEditingPoll({ ...editingPoll, resultTypes: newTypes });
                                }}
                                placeholder="type_a"
                                className="w-20 bg-gray-700 px-2 py-1 rounded text-xs"
                              />
                              <input
                                type="text"
                                value={rt.label || ''}
                                onChange={(e) => {
                                  const newTypes = [...editingPoll.resultTypes];
                                  newTypes[i] = { ...newTypes[i], label: e.target.value };
                                  setEditingPoll({ ...editingPoll, resultTypes: newTypes });
                                }}
                                placeholder="Result Label (e.g. You're a Bee)"
                                className="flex-1 bg-gray-700 px-2 py-1 rounded text-[10px]"
                              />
                              {editingPoll.resultTypes.length > 2 && (
                                <button
                                  onClick={() => {
                                    const newTypes = editingPoll.resultTypes.filter((_: any, j: number) => j !== i);
                                    setEditingPoll({ ...editingPoll, resultTypes: newTypes });
                                  }}
                                  className="p-1 hover:bg-red-500/20 rounded text-red-400"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            <input
                              type="text"
                              value={rt.image?.replace('/images/', '') || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                const fullUrl = val.startsWith('http') || val.startsWith('/') ? val : `/images/${val}`;
                                const newTypes = [...editingPoll.resultTypes];
                                newTypes[i] = { ...newTypes[i], image: val ? fullUrl : '' };
                                setEditingPoll({ ...editingPoll, resultTypes: newTypes });
                              }}
                              placeholder="bee.png or https://..."
                              className="w-full bg-gray-700 px-2 py-1 rounded text-[10px] text-gray-300"
                            />
                          </div>
                        </div>
                        <textarea
                          value={rt.description || ''}
                          onChange={(e) => {
                            const newTypes = [...editingPoll.resultTypes];
                            newTypes[i] = { ...newTypes[i], description: e.target.value };
                            setEditingPoll({ ...editingPoll, resultTypes: newTypes });
                          }}
                          placeholder="Result description..."
                          className="w-full bg-gray-700 px-2 py-1 rounded text-[10px] resize-none"
                          rows={1}
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const newTypes = [...(editingPoll.resultTypes || []), { id: `type_${(editingPoll.resultTypes?.length || 0) + 1}`, label: '', image: '', description: '', votes: 0 }];
                        setEditingPoll({ ...editingPoll, resultTypes: newTypes });
                      }}
                      className="w-full py-1 border border-dashed border-gray-600 rounded text-gray-400 hover:border-gray-500 text-xs"
                    >
                      + Add Result Type
                    </button>
                  </div>
                </div>

                {/* Questions - Compact */}
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Questions</label>
                  <div className="space-y-2">
                    {(editingPoll.questions || []).map((q: any, qi: number) => (
                      <div key={qi} className="bg-gray-700/50 rounded p-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] text-gray-500 w-4">{qi + 1}.</span>
                          <input
                            type="text"
                            value={q.question || ''}
                            onChange={(e) => {
                              const newQuestions = [...editingPoll.questions];
                              newQuestions[qi] = { ...newQuestions[qi], question: e.target.value };
                              setEditingPoll({ ...editingPoll, questions: newQuestions });
                            }}
                            placeholder="What would you do if...?"
                            className="flex-1 bg-gray-700 px-2 py-1 rounded text-[10px]"
                          />
                          {editingPoll.questions.length > 1 && (
                            <button
                              onClick={() => {
                                const newQuestions = editingPoll.questions.filter((_: any, j: number) => j !== qi);
                                setEditingPoll({ ...editingPoll, questions: newQuestions });
                              }}
                              className="text-red-400 p-1 hover:bg-red-500/20 rounded"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="ml-6 space-y-1">
                          {(q.answers || []).map((a: any, ai: number) => (
                            <div key={ai} className="flex gap-1 items-center">
                              <input
                                type="text"
                                value={a.text || ''}
                                onChange={(e) => {
                                  const newQuestions = [...editingPoll.questions];
                                  newQuestions[qi].answers[ai] = { ...newQuestions[qi].answers[ai], text: e.target.value };
                                  setEditingPoll({ ...editingPoll, questions: newQuestions });
                                }}
                                placeholder={`Answer ${ai + 1}`}
                                className="flex-1 bg-gray-600 px-2 py-1 rounded text-[10px]"
                              />
                              <select
                                value={a.resultType || ''}
                                onChange={(e) => {
                                  const newQuestions = [...editingPoll.questions];
                                  newQuestions[qi].answers[ai] = { ...newQuestions[qi].answers[ai], resultType: e.target.value };
                                  setEditingPoll({ ...editingPoll, questions: newQuestions });
                                }}
                                className="bg-gray-600 px-1.5 py-1 rounded text-[10px] w-24"
                              >
                                <option value="">→ Result</option>
                                {(editingPoll.resultTypes || []).map((rt: any) => (
                                  <option key={rt.id} value={rt.id}>{rt.emoji} {rt.id}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              const newQuestions = [...editingPoll.questions];
                              const q = newQuestions[qi];
                              const aNum = (q.answers?.length || 0) + 1;
                              newQuestions[qi].answers = [...(q.answers || []), { id: `${q.id}_a${aNum}`, text: '', resultType: '' }];
                              setEditingPoll({ ...editingPoll, questions: newQuestions });
                            }}
                            className="text-[10px] text-gray-500 hover:text-white"
                          >
                            + Add Answer
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const qNum = (editingPoll.questions?.length || 0) + 1;
                        const newQuestions = [...(editingPoll.questions || []), { 
                          id: `q${qNum}`, 
                          question: '', 
                          answers: [
                            { id: `q${qNum}_a1`, text: '', resultType: '' },
                            { id: `q${qNum}_a2`, text: '', resultType: '' },
                          ]
                        }];
                        setEditingPoll({ ...editingPoll, questions: newQuestions });
                      }}
                      className="w-full py-1 border border-dashed border-[#D4873A] rounded text-[#D4873A] hover:bg-[#D4873A]/10 text-xs"
                    >
                      + Add Question
                    </button>
                  </div>
                </div>
              </>
              )}

              {/* Category + Status + Featured - Fixed at bottom */}
              <div className="flex-shrink-0 mt-2 pt-2 border-t border-gray-700 space-y-2">
                <div className={`grid gap-2 ${editingPoll.type === 'ranking' ? 'grid-cols-3' : 'grid-cols-3'}`}>
                  {/* Link to Article - only for non-ranking types */}
                  {editingPoll.type !== 'ranking' && (
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">Link to Article</label>
                      <select
                        value={editingPoll.linkedArticleId || ''}
                        onChange={(e) => setEditingPoll({ ...editingPoll, linkedArticleId: e.target.value || undefined })}
                        className="w-full bg-gray-700 px-2 py-1 rounded text-[10px]"
                      >
                        <option value="">No linked article</option>
                        {articles.map((article) => (
                          <option key={article._id} value={article._id}>{article.title}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">Category</label>
                    <select
                      value={editingPoll.category || 'general'}
                      onChange={(e) => setEditingPoll({ ...editingPoll, category: e.target.value })}
                      className="w-full bg-gray-700 px-2 py-1 rounded text-[10px]"
                    >
                      <option value="general">General</option>
                      <option value="personality">Personality Test</option>
                      <option value="opinion">Opinion</option>
                      <option value="prediction">Prediction</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">Status</label>
                    <select
                      value={editingPoll.status || 'active'}
                      onChange={(e) => setEditingPoll({ ...editingPoll, status: e.target.value })}
                      className="w-full bg-gray-700 px-2 py-1 rounded text-[10px]"
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  {/* Featured - inline */}
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={editingPoll.featured || false}
                      onChange={(e) => setEditingPoll({ ...editingPoll, featured: e.target.checked })}
                      className="rounded w-3 h-3"
                    />
                    <span className="text-[10px] text-gray-400">Featured</span>
                  </label>
                </div>
              </div>
              </div>{/* End LEFT COLUMN */}
              
              {/* RIGHT COLUMN: Article Generator (only for ranking) */}
              {editingPoll.type === 'ranking' && (
                <div className="flex flex-col bg-gray-900/50 rounded-lg p-3 h-full">
                  {/* Header with title */}
                  <div className="flex items-center justify-between mb-2 flex-shrink-0">
                    <span className="text-sm font-bold text-purple-400 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Article Generator
                    </span>
                    <button
                      onClick={generateArticleFromPoll}
                      disabled={articleGenerating || !editingPoll.title || !editingPoll.items?.some((i: any) => i.title)}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:text-gray-400 rounded text-xs font-bold flex items-center gap-1.5"
                    >
                      {articleGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {generatedArticle ? 'Regenerate' : 'Generate'}
                    </button>
                  </div>
                  
                  {/* Language + Style Selectors */}
                  <div className="flex gap-2 mb-3 flex-shrink-0">
                    {/* Language */}
                    <div className="flex items-center gap-1 bg-gray-700 rounded px-2 py-1">
                      <Globe className="w-3 h-3 text-gray-400" />
                      {LANGUAGES.map(lang => (
                        <button
                          key={lang.id}
                          onClick={() => setArticleLanguage(lang.id)}
                          className={`px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
                            articleLanguage === lang.id 
                              ? 'bg-purple-600 text-white' 
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          {lang.flag}
                        </button>
                      ))}
                    </div>
                    {/* Author Style */}
                    <select
                      value={articleStyle}
                      onChange={(e) => setArticleStyle(e.target.value)}
                      className="flex-1 bg-gray-700 px-2 py-1 rounded text-xs text-white border-none"
                    >
                      {AUTHOR_STYLES.map(style => (
                        <option key={style.id} value={style.id}>
                          {style.emoji} {style.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {generatedArticle ? (
                    <div className="flex flex-col flex-1 min-h-0 space-y-2">
                      {/* Thumbnail + Title Row */}
                      <div className="flex gap-3 flex-shrink-0">
                        {/* Thumbnail */}
                        <div 
                          onClick={() => setShowImagePicker(true)}
                          className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-700 border border-gray-600 cursor-pointer hover:border-purple-500 transition-colors group"
                        >
                          {generatedArticle.coverImage ? (
                            <img src={generatedArticle.coverImage} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 group-hover:text-purple-400">
                              <Wand2 className="w-5 h-5 mb-1" />
                              <span className="text-[9px]">Thumbnail</span>
                            </div>
                          )}
                        </div>
                        {/* Title + Subtitle */}
                        <div className="flex-1 space-y-1.5">
                          <div>
                            <p className="text-[10px] text-gray-400 mb-0.5">Title</p>
                            <input
                              type="text"
                              value={generatedArticle.title || ''}
                              onChange={(e) => setGeneratedArticle({ ...generatedArticle, title: e.target.value })}
                              className="w-full bg-gray-700 px-2 py-1 rounded text-sm font-medium text-white"
                            />
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 mb-0.5">Subtitle</p>
                            <input
                              type="text"
                              value={generatedArticle.subtitle || ''}
                              onChange={(e) => setGeneratedArticle({ ...generatedArticle, subtitle: e.target.value })}
                              className="w-full bg-gray-700 px-2 py-1 rounded text-xs text-gray-300"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 min-h-0 overflow-y-auto">
                        <p className="text-[10px] text-gray-400 mb-1">Content (Block Editor)</p>
                        <div className="min-h-0">
                          <BlockEditor
                            value={generatedArticle.content || ''}
                            onChange={(content: string) => setGeneratedArticle({ ...generatedArticle, content })}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-green-400 font-medium flex-shrink-0">✓ Ready! Click "Publish with Article" to save both.</p>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                      <FileText className="w-12 h-12 mb-3 opacity-30" />
                      <p className="text-sm font-medium">No Article Yet</p>
                      <p className="text-xs mt-1">Fill in ranking title and items, then click Generate</p>
                    </div>
                  )}
                </div>
              )}
              </div>{/* End Grid */}
            </div>{/* End scrollable content */}

            <div className="p-3 border-t border-gray-700 flex justify-end gap-2 flex-shrink-0">
              <button
                onClick={closeEditorDiscardIfProposal}
                className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
              >
                {editingPoll._fromProposal ? 'Discard' : 'Cancel'}
              </button>
              <button
                onClick={() => savePoll(false)}
                disabled={!editingPoll.title || (editingPoll.type === 'simple' && !editingPoll.options?.some((o: any) => o.label)) || (editingPoll.type === 'ranking' && !editingPoll.items?.some((i: any) => i.title))}
                className="px-2 py-1 bg-[#D4873A] rounded hover:bg-[#D4873A]/80 disabled:opacity-50 flex items-center gap-1 text-xs font-bold"
              >
                <Save className="w-3 h-3" />
                Save Rankroll Only
              </button>
              {editingPoll.type === 'ranking' && (
                <button
                  onClick={() => savePoll(true)}
                  disabled={!editingPoll.title || !editingPoll.items?.some((i: any) => i.title)}
                  className="px-3 py-1 bg-green-600 rounded hover:bg-green-500 disabled:opacity-50 flex items-center gap-1 text-xs font-bold"
                >
                  <FileText className="w-3 h-3" />
                  Save Rankroll + Article
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Picker Modal for Rankroll Cover (left side) */}
      <ImagePickerModal
        isOpen={showRankrollImagePicker}
        onClose={() => setShowRankrollImagePicker(false)}
        onSelect={(url: string) => {
          setEditingPoll({ ...editingPoll, image: url });
          setShowRankrollImagePicker(false);
        }}
        searchTerm={editingPoll?.title || ''}
        showAiGenerate={true}
        aiPromptContext={`Cover image for ranking: ${editingPoll?.title}`}
      />

      {/* Image Picker Modal for Article Thumbnail (right side) */}
      <ImagePickerModal
        isOpen={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        onSelect={(url: string) => {
          setGeneratedArticle({ ...generatedArticle, coverImage: url });
          setShowImagePicker(false);
        }}
        searchTerm={editingPoll?.title || ''}
        showAiGenerate={true}
        aiPromptContext={`Article thumbnail for: ${editingPoll?.title}`}
      />

      {/* Image Picker Modal for Ranking Items */}
      {imagePickerItemIndex !== null && editingPoll?.items?.[imagePickerItemIndex] && (
        <ImagePickerModal
          isOpen={true}
          onClose={() => setImagePickerItemIndex(null)}
          onSelect={async (url: string) => {
            await updateItemImage(imagePickerItemIndex, url);
            setImagePickerItemIndex(null);
          }}
          currentImage={editingPoll.items[imagePickerItemIndex]?.image}
          searchTerm={editingPoll.items[imagePickerItemIndex]?.title || ''}
          showAiGenerate={true}
          aiPromptContext={`Image for ranking item: ${editingPoll.items[imagePickerItemIndex]?.title}`}
          dimensions="200×200"
          aspectRatio="1:1"
        />
      )}
    </>
  );
}
