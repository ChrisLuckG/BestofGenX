"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Edit2, Trash2, Loader2, X, Save, Upload, Sparkles, Link, Wand2 } from "lucide-react";

export default function PollsTab() {
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
        const newItems = [...editingPoll.items];
        newItems[itemIndex] = { ...newItems[itemIndex], image: data.url };
        setEditingPoll({ ...editingPoll, items: newItems });
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

  useEffect(() => {
    fetchPolls();
    fetch('/api/articles?admin=true').then(r => r.json()).then(d => { if (d.success) setArticles(d.articles.map((a: any) => ({ _id: a._id, title: a.title }))); }).catch(() => {});
  }, []);

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
        const newItems = [...editingPoll.items];
        newItems[itemIndex] = { ...newItems[itemIndex], image: data.url };
        setEditingPoll({ ...editingPoll, items: newItems });
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

  const savePoll = async () => {
    if (!editingPoll) return;
    try {
      const method = editingPoll._id ? "PATCH" : "POST";
      const url = editingPoll._id ? `/api/polls/${editingPoll._id}` : "/api/polls";
      
      console.log('Saving poll:', editingPoll);
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingPoll),
      });
      
      const data = await res.json();
      console.log('Response:', data);
      
      if (res.ok && data.success) {
        fetchPolls();
        setEditingPoll(null);
        alert('Poll saved successfully!');
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
        fetchPolls();
      }
    } catch (error) {
      console.error("Error deleting poll:", error);
    }
  };

  return (
    <>
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">🗳️ Polls ({polls.length})</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setEditingPoll({
                title: '',
                subtitle: '',
                description: '',
                image: '',
                type: 'simple',
                options: [
                  { id: 'option_1', label: '', emoji: '' },
                  { id: 'option_2', label: '', emoji: '' },
                ],
                category: 'general',
                status: 'active',
                featured: false,
              })}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-bold transition-colors"
            >
              <Plus className="w-5 h-5" />
              Simple Poll
            </button>
            <button
              onClick={() => setEditingPoll({
                title: '',
                subtitle: '',
                description: '',
                image: '',
                type: 'quiz',
                questions: [
                  { id: 'q1', question: '', answers: [
                    { id: 'q1_a1', text: '', emoji: '', resultType: 'type_a' },
                    { id: 'q1_a2', text: '', emoji: '', resultType: 'type_b' },
                  ]},
                ],
                resultTypes: [
                  { id: 'type_a', label: '', image: '', description: '', votes: 0 },
                  { id: 'type_b', label: '', image: '', description: '', votes: 0 },
                ],
                category: 'personality',
                status: 'active',
                featured: false,
              })}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg font-bold transition-colors"
            >
              <Plus className="w-5 h-5" />
              Quiz / Self-Test
            </button>
            <button
              onClick={() => setEditingPoll({
                title: '',
                subtitle: '',
                description: '',
                image: '',
                type: 'ranking',
                items: [
                  { id: 'item_1', title: '', description: '', image: '', upvotes: 0, downvotes: 0, score: 0 },
                  { id: 'item_2', title: '', description: '', image: '', upvotes: 0, downvotes: 0, score: 0 },
                  { id: 'item_3', title: '', description: '', image: '', upvotes: 0, downvotes: 0, score: 0 },
                ],
                category: 'ranking',
                status: 'active',
                featured: false,
              })}
              className="flex items-center gap-2 bg-[#D4873A] hover:bg-[#C4772A] px-4 py-2 rounded-lg font-bold transition-colors"
            >
              <Plus className="w-5 h-5" />
              Ranking List
            </button>
          </div>
        </div>

        {pollsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : polls.length === 0 ? (
          <div className="text-center text-gray-400 py-8">No polls yet. Create your first poll!</div>
        ) : (
          <div className="space-y-3">
            {polls.map((poll) => (
              <div key={poll._id} className="bg-gray-700/50 rounded-lg p-4 flex items-center gap-4">
                {poll.image && (
                  <img src={poll.image} alt="" className="w-16 h-16 rounded-lg object-cover" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold">{poll.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      poll.type === 'quiz' ? 'bg-purple-500/20 text-purple-400' : 
                      poll.type === 'ranking' ? 'bg-[#D4873A]/20 text-[#D4873A]' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>{poll.type || 'simple'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      poll.status === 'active' ? 'bg-green-500/20 text-green-400' :
                      poll.status === 'closed' ? 'bg-red-500/20 text-red-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>{poll.status}</span>
                    {poll.featured && <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">Featured</span>}
                  </div>
                  <div className="text-sm text-gray-400">
                    {poll.type === 'quiz' 
                      ? `${poll.questions?.length || 0} questions · ${poll.resultTypes?.length || 0} results`
                      : poll.type === 'ranking'
                      ? `${poll.items?.length || 0} items`
                      : `${poll.options?.length || 0} options`
                    } · {poll.totalVotes || 0} votes
                    {poll.closesAt && (
                      <span className="ml-2 text-[#D4873A]">
                        · Ends {new Date(poll.closesAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                    {poll.linkedArticleId && <span className="ml-2 text-purple-400">· Linked to article</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingPoll(poll)}
                    className="p-2 hover:bg-gray-600 rounded"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deletePoll(poll._id)}
                    className="p-2 hover:bg-red-500/20 rounded text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Poll Editor Modal - Compact */}
      {editingPoll && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#D4873A #374151' }}>
            <div className="p-3 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-bold">
                {editingPoll._id ? 'Edit' : 'Create'} {editingPoll.type === 'ranking' ? 'Ranking List' : 'Poll'}
              </h3>
              <button onClick={() => setEditingPoll(null)} className="p-1 hover:bg-gray-700 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-3 space-y-2">
              {/* AI Generator - only for ranking type */}
              {editingPoll.type === 'ranking' && (
                <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-purple-300">AI Generator</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiTopic}
                      onChange={(e) => setAiTopic(e.target.value)}
                      placeholder="Enter topic (e.g. Best 80s Cartoons, Top GenX Movies...)"
                      className="flex-1 bg-gray-700 px-3 py-2 rounded text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && generateWithAI()}
                    />
                    <button
                      onClick={generateWithAI}
                      disabled={aiGenerating || !aiTopic.trim()}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:text-gray-400 rounded font-bold text-sm flex items-center gap-2"
                    >
                      {aiGenerating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      Generate
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">AI will generate title, subtitle, and 10 ranking items</p>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">Title *</label>
                <input
                  type="text"
                  value={editingPoll.title || ''}
                  onChange={(e) => setEditingPoll({ ...editingPoll, title: e.target.value })}
                  placeholder="Top 10 Gen X Movies"
                  className="w-full bg-gray-700 px-2 py-1.5 rounded text-sm"
                />
              </div>

              {/* Subtitle - larger textarea */}
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">Subtitle / Description</label>
                <textarea
                  value={editingPoll.subtitle || ''}
                  onChange={(e) => setEditingPoll({ ...editingPoll, subtitle: e.target.value })}
                  placeholder="Vote for your favorites from the 80s and 90s. Which movies defined Generation X?"
                  rows={3}
                  className="w-full bg-gray-700 px-2 py-1.5 rounded text-sm resize-none"
                />
              </div>

              {/* Countdown Timer (optional) - only for ranking type */}
              {editingPoll.type === 'ranking' && (
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!editingPoll.closesAt}
                        onChange={(e) => {
                          if (e.target.checked) {
                            // Default to 30 days from now
                            const defaultDate = new Date();
                            defaultDate.setDate(defaultDate.getDate() + 30);
                            setEditingPoll({ ...editingPoll, closesAt: defaultDate.toISOString().slice(0, 16) });
                          } else {
                            setEditingPoll({ ...editingPoll, closesAt: null });
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-500 text-[#D4873A] focus:ring-[#D4873A]"
                      />
                      <span className="text-xs text-gray-300">Enable Countdown Timer</span>
                    </label>
                  </div>
                  {editingPoll.closesAt && (
                    <div className="mt-2">
                      <label className="block text-[10px] text-gray-400 mb-0.5">Ends At</label>
                      <input
                        type="datetime-local"
                        value={editingPoll.closesAt?.slice(0, 16) || ''}
                        onChange={(e) => setEditingPoll({ ...editingPoll, closesAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                        className="w-full bg-gray-600 px-2 py-1.5 rounded text-sm"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Voting stays open after deadline. Timer shows users when the "official" ranking period ends.</p>
                    </div>
                  )}
                </div>
              )}

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
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">Ranking Items *</label>
                <div className="space-y-2">
                  {(editingPoll.items || []).map((item: any, i: number) => (
                    <div key={i} className="bg-gray-700/30 rounded-lg p-3 flex gap-3">
                      {/* Image Preview - Clickable for menu */}
                      <div className="relative">
                        <div 
                          onClick={() => setImageMenuIndex(imageMenuIndex === i ? null : i)}
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
                        
                        {/* Image Source Menu */}
                        {imageMenuIndex === i && (
                          <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 w-40 overflow-hidden">
                            <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-700 cursor-pointer text-sm text-gray-200">
                              <Upload className="w-4 h-4 text-[#D4873A]" />
                              <span>Upload File</span>
                              <input
                                type="file"
                                accept="image/*,image/gif"
                                className="hidden"
                                onChange={(e) => {
                                  handleItemImageUpload(e, i);
                                  setImageMenuIndex(null);
                                }}
                              />
                            </label>
                            <button
                              onClick={() => {
                                setUrlInputIndex(i);
                                setTempUrl(item.image || '');
                                setImageMenuIndex(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 text-sm text-gray-200"
                            >
                              <Link className="w-4 h-4 text-[#D4873A]" />
                              <span>URL / GIF Link</span>
                            </button>
                            <button
                              onClick={() => searchGifForItem(i, item.title, item.image)}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 text-sm text-gray-200 border-t border-gray-600"
                            >
                              <Wand2 className="w-4 h-4 text-[#D4873A]" />
                              <span>{item.image ? 'New GIF (Tenor)' : 'Auto GIF (Tenor)'}</span>
                            </button>
                          </div>
                        )}
                        
                        {/* URL Input Modal */}
                        {urlInputIndex === i && (
                          <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 w-64 p-3">
                            <label className="block text-[10px] text-gray-400 mb-1">Image URL (Tenor, Giphy, etc.)</label>
                            <input
                              type="text"
                              value={tempUrl}
                              onChange={(e) => setTempUrl(e.target.value)}
                              placeholder="https://media.tenor.com/..."
                              className="w-full bg-gray-700 px-2 py-1.5 rounded text-xs mb-2"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  const newItems = [...editingPoll.items];
                                  newItems[i] = { ...newItems[i], image: tempUrl };
                                  setEditingPoll({ ...editingPoll, items: newItems });
                                  setUrlInputIndex(null);
                                  setTempUrl('');
                                }}
                                className="flex-1 py-1.5 bg-[#D4873A] hover:bg-[#C4772A] text-white text-xs font-medium rounded"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setUrlInputIndex(null);
                                  setTempUrl('');
                                }}
                                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded"
                              >
                                Cancel
                              </button>
                            </div>
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
                  className="w-full py-2 mt-2 border border-dashed border-[#D4873A] rounded-lg text-[#D4873A] hover:bg-[#D4873A]/10"
                >
                  + Add Item
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

              {/* Link to Article + Category + Status - All in one row */}
              <div className="grid grid-cols-3 gap-2">
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
              </div>

              {/* Featured */}
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

            <div className="p-3 border-t border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setEditingPoll(null)}
                className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={savePoll}
                disabled={!editingPoll.title || (editingPoll.type === 'simple' && !editingPoll.options?.some((o: any) => o.label)) || (editingPoll.type === 'ranking' && !editingPoll.items?.some((i: any) => i.title))}
                className="px-2 py-1 bg-[#D4873A] rounded hover:bg-[#C4772A] disabled:opacity-50 flex items-center gap-1 text-xs"
              >
                <Save className="w-3 h-3" />
                {editingPoll._id ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
