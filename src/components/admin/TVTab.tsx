"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Edit2, Save, X, Loader2, Play, Tv, Youtube, Search, ExternalLink, Upload, GripVertical, LayoutGrid, List } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TVVideo {
  _id: string;
  title: string;
  description: string;
  youtubeUrl: string;
  youtubeId: string;
  thumbnail: string;
  category: string;
  duration: string;
  language: 'de' | 'en';
  featured: boolean;
  featuredPosition?: number;
  active: boolean;
  createdAt: string;
}

interface TVCategoryType {
  _id: string;
  name: string;
  order: number;
  active: boolean;
}

const DEFAULT_categoryNames = [
  'Action', 'Thriller', 'Crime', 'Sci-Fi', 'Drama', 'Western',
  'Music Videos', 'Concerts', 'TV Shows', 'Documentaries', 'Sports',
];

const extractYouTubeId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

// Sortable Category Tab Component
function SortableCategoryTab({ 
  category, 
  isActive, 
  onClick 
}: { 
  category: TVCategoryType; 
  isActive: boolean; 
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
        isActive ? 'bg-[#E36B11] text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
      }`}
      onClick={onClick}
    >
      <span {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="w-3 h-3 opacity-50 hover:opacity-100" />
      </span>
      {category.name}
    </div>
  );
}

const ytThumb = (youtubeId: string | undefined, stored: string) => stored || (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg` : '');
const ytThumbError = (e: React.SyntheticEvent<HTMLImageElement>, youtubeId: string | undefined) => {
  const img = e.currentTarget;
  const src = img.src;
  if (youtubeId) {
    if (src.includes('mqdefault')) { img.src = `https://img.youtube.com/vi/${youtubeId}/sddefault.jpg`; }
    else if (src.includes('sddefault')) { img.src = `https://img.youtube.com/vi/${youtubeId}/default.jpg`; }
    else if (src.includes('hqdefault')) { img.src = `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`; }
  }
};

export default function TVTab() {
  const [videos, setVideos] = useState<TVVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Partial<TVVideo> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [uploadingVideoId, setUploadingVideoId] = useState<string | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const editThumbnailInputRef = useRef<HTMLInputElement>(null);

  const [newVideo, setNewVideo] = useState({
    title: '',
    description: '',
    youtubeUrl: '',
    category: 'Action',
    duration: '',
    language: 'en' as 'de' | 'en',
    featured: false,
  });

  // Categories state
  const [categories, setCategories] = useState<TVCategoryType[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Handle drag end for category reorder
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex(c => c._id === active.id);
      const newIndex = categories.findIndex(c => c._id === over.id);
      
      const newCategories = arrayMove(categories, oldIndex, newIndex);
      setCategories(newCategories);
      
      // Save new order to DB
      try {
        await fetch('/api/tv/categories', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderedIds: newCategories.map(c => c._id) }),
        });
      } catch (error) {
        console.error('Error saving category order:', error);
        // Revert on error
        fetchCategories();
      }
    }
  };

  const fetchVideos = async () => {
    try {
      const res = await fetch('/api/tv?all=true');
      const data = await res.json();
      if (data.success) setVideos(data.videos);
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/tv/categories');
      const data = await res.json();
      if (data.success && data.categories.length > 0) {
        setCategories(data.categories);
      } else {
        // Seed default categories if none exist
        for (const name of DEFAULT_categoryNames) {
          await fetch('/api/tv/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          });
        }
        const res2 = await fetch('/api/tv/categories');
        const data2 = await res2.json();
        if (data2.success) setCategories(data2.categories);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const addCategory = async () => {
    if (!newCategoryName.trim()) return;
    // Capitalize first letter of each word
    const formatted = newCategoryName.trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    try {
      const res = await fetch('/api/tv/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formatted }),
      });
      if (res.ok) {
        setNewCategoryName('');
        fetchCategories();
      }
    } catch (error) {
      console.error('Error adding category:', error);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    try {
      await fetch(`/api/tv/categories?id=${id}`, { method: 'DELETE' });
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  useEffect(() => {
    fetchVideos();
    fetchCategories();
  }, []);
  
  // Get category names for dropdowns
  const categoryNames = categories.length > 0 
    ? categories.map(c => c.name) 
    : DEFAULT_categoryNames;

  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);

  const handleYouTubeUrlChange = async (url: string) => {
    setNewVideo(prev => ({ ...prev, youtubeUrl: url }));
    const id = extractYouTubeId(url);
    
    if (id) {
      // Auto-fetch video metadata from YouTube
      setIsFetchingMetadata(true);
      try {
        const res = await fetch(`/api/youtube/metadata?videoId=${id}`);
        const data = await res.json();
        
        if (data.success && data.metadata) {
          setNewVideo(prev => ({
            ...prev,
            youtubeUrl: url,
            title: prev.title || data.metadata.title || '',
            description: prev.description || data.metadata.description || '',
            duration: data.metadata.duration || '',
            language: data.metadata.language || 'en', // Auto-detected!
          }));
        }
      } catch (error) {
        console.error('Failed to fetch YouTube metadata:', error);
      } finally {
        setIsFetchingMetadata(false);
      }
    }
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploadingThumbnail(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      if (data.success && data.url) {
        setNewVideo(prev => ({ ...prev, customThumbnail: data.url } as any));
      } else {
        alert('Upload failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed');
    } finally {
      setIsUploadingThumbnail(false);
      if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';
    }
  };

  const handleEditThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingVideo?._id) return;
    
    setUploadingVideoId(editingVideo._id);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      if (data.success && data.url) {
        setEditingVideo(prev => ({ ...prev, thumbnail: data.url }));
      } else {
        alert('Upload failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed');
    } finally {
      setUploadingVideoId(null);
      if (editThumbnailInputRef.current) editThumbnailInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    const youtubeId = extractYouTubeId(newVideo.youtubeUrl);
    if (!youtubeId || !newVideo.title) {
      alert('Please enter a valid YouTube URL and title');
      return;
    }

    setIsSaving(true);
    try {
      const customThumb = (newVideo as any).customThumbnail;
      const res = await fetch('/api/tv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newVideo,
          youtubeId,
          thumbnail: customThumb || `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
        }),
      });
      
      if (res.ok) {
        setNewVideo({ title: '', description: '', youtubeUrl: '', category: 'Action', duration: '', language: 'en', featured: false });
        setIsCreating(false);
        fetchVideos();
      }
    } catch (error) {
      console.error('Error saving video:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingVideo?._id) return;
    
    setIsSaving(true);
    try {
      const youtubeId = extractYouTubeId(editingVideo.youtubeUrl || '');
      const res = await fetch('/api/tv', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingVideo,
          youtubeId,
          // Keep the current thumbnail (could be custom uploaded)
          thumbnail: editingVideo.thumbnail,
          active: !!youtubeId,
        }),
      });
      
      if (res.ok) {
        setEditingVideo(null);
        fetchVideos();
      }
    } catch (error) {
      console.error('Error updating video:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this video?')) return;
    
    try {
      const res = await fetch(`/api/tv?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchVideos();
    } catch (error) {
      console.error('Error deleting video:', error);
    }
  };

  const setFeaturedPosition = async (video: TVVideo, position: number | null) => {
    try {
      // Clear this position from other videos first
      if (position) {
        const currentHolder = videos.find(v => v.featuredPosition === position && v._id !== video._id);
        if (currentHolder) {
          const clearRes = await fetch('/api/tv', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              _id: currentHolder._id,
              title: currentHolder.title,
              description: currentHolder.description,
              youtubeUrl: currentHolder.youtubeUrl,
              youtubeId: currentHolder.youtubeId,
              thumbnail: currentHolder.thumbnail,
              category: currentHolder.category,
              duration: currentHolder.duration,
              language: currentHolder.language,
              active: currentHolder.active,
              featured: false, 
              featuredPosition: null 
            }),
          });
          if (!clearRes.ok) console.error('Failed to clear position');
        }
      }
      
      const res = await fetch('/api/tv', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          _id: video._id,
          title: video.title,
          description: video.description,
          youtubeUrl: video.youtubeUrl,
          youtubeId: video.youtubeId,
          thumbnail: video.thumbnail,
          category: video.category,
          duration: video.duration,
          language: video.language,
          active: video.active,
          featured: position !== null, 
          featuredPosition: position 
        }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        console.error('Failed to set featured:', err);
      }
      
      await fetchVideos();
    } catch (error) {
      console.error('Error setting featured:', error);
    }
  };

  const filteredVideos = videos
    .filter(v => {
      const matchesCategory = !categoryFilter || v.category === categoryFilter;
      const matchesSearch = !searchQuery || 
        v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesActive = activeFilter === 'all' || 
        (activeFilter === 'active' && v.active) || 
        (activeFilter === 'inactive' && !v.active);
      return matchesCategory && matchesSearch && matchesActive;
    })
    .sort((a, b) => {
      // Featured videos with position come first, sorted by position
      if (a.featuredPosition && b.featuredPosition) return a.featuredPosition - b.featuredPosition;
      if (a.featuredPosition) return -1;
      if (b.featuredPosition) return 1;
      return 0;
    });

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-[#E36B11]" />
      <p className="text-gray-400 text-sm">Loading videos...</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Tv className="w-5 h-5 text-[#E36B11]" />
          <h2 className="text-lg font-bold">TV / Video Library</h2>
          <span className="text-gray-500 text-sm">({filteredVideos.length}/{videos.length})</span>
        </div>
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search videos..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:border-[#E36B11]"
            />
          </div>
          {/* View Toggle */}
          <div className="flex bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-[#E36B11] text-white' : 'text-gray-400 hover:text-white'}`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-[#E36B11] text-white' : 'text-gray-400 hover:text-white'}`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setShowCategoryManager(true)}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap"
          >
            Categories
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-[#E36B11] hover:bg-[#C4772A] px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Video
          </button>
        </div>
      </div>

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Manage Categories</h3>
              <button onClick={() => setShowCategoryManager(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Add new category */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="New category name..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E36B11]"
                onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              />
              <button
                onClick={addCategory}
                className="px-4 py-2 bg-[#E36B11] hover:bg-[#C4772A] rounded-lg text-sm font-medium"
              >
                Add
              </button>
            </div>
            
            {/* Category list */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {categories.map((cat) => (
                <div key={cat._id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                  <span className="text-sm">{cat.name}</span>
                  <button
                    onClick={() => deleteCategory(cat._id)}
                    className="text-red-500 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 flex-wrap items-center">
        {/* Active/Inactive Filter */}
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              activeFilter === 'all' ? 'bg-[#E36B11] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveFilter('active')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              activeFilter === 'active' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setActiveFilter('inactive')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              activeFilter === 'inactive' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Inactive
          </button>
        </div>

        {/* Category Filter - Drag & Drop */}
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              !categoryFilter ? 'bg-[#E36B11] text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            All Categories
          </button>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={categories.map(c => c._id)} strategy={horizontalListSortingStrategy}>
              <div className="flex gap-2 flex-wrap">
                {categories.map(cat => (
                  <SortableCategoryTab
                    key={cat._id}
                    category={cat}
                    isActive={categoryFilter === cat.name}
                    onClick={() => setCategoryFilter(cat.name)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <span className="text-[10px] text-gray-500 ml-2">Drag to reorder</span>
        </div>
      </div>

      {/* Add Video Form */}
      {isCreating && (
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Youtube className="w-5 h-5 text-red-500" />
            Add YouTube Video
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-xs mb-1">YouTube URL *</label>
              <input
                type="text"
                value={newVideo.youtubeUrl}
                onChange={(e) => handleYouTubeUrlChange(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E36B11]"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">
                Title * {isFetchingMetadata && <span className="text-[#E36B11] text-[10px]">(Auto-fetching...)</span>}
              </label>
              <input
                type="text"
                value={newVideo.title}
                onChange={(e) => setNewVideo(prev => ({ ...prev, title: e.target.value }))}
                placeholder={isFetchingMetadata ? "Loading from YouTube..." : "Video title"}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E36B11]"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Category</label>
              <select
                value={newVideo.category}
                onChange={(e) => setNewVideo(prev => ({ ...prev, category: e.target.value }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E36B11]"
              >
                {categoryNames.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Duration</label>
              <input
                type="text"
                value={newVideo.duration}
                onChange={(e) => setNewVideo(prev => ({ ...prev, duration: e.target.value }))}
                placeholder="e.g. 3:45 or 1:23:45"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E36B11]"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Language</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewVideo(prev => ({ ...prev, language: 'en' }))}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm ${newVideo.language === 'en' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                >
                  🇬🇧 EN
                </button>
                <button
                  type="button"
                  onClick={() => setNewVideo(prev => ({ ...prev, language: 'de' }))}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm ${newVideo.language === 'de' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                >
                  🇩🇪 DE
                </button>
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-gray-400 text-xs mb-1">Description</label>
              <textarea
                value={newVideo.description}
                onChange={(e) => setNewVideo(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Video description..."
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E36B11] h-20 resize-none"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-gray-400 text-xs mb-1">Custom Thumbnail (optional)</label>
              <div className="flex items-center gap-2">
                <input ref={thumbnailInputRef} type="file" accept="image/*" onChange={handleThumbnailUpload} className="hidden" />
                <button
                  onClick={() => thumbnailInputRef.current?.click()}
                  disabled={isUploadingThumbnail}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-500 px-3 py-2 rounded-lg text-sm disabled:opacity-50"
                >
                  {isUploadingThumbnail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload Thumbnail
                </button>
                {(newVideo as any).customThumbnail && (
                  <>
                    <img src={(newVideo as any).customThumbnail} alt="Custom" className="h-10 rounded" />
                    <button onClick={() => setNewVideo(prev => ({ ...prev, customThumbnail: '' } as any))} className="p-1 bg-red-600 hover:bg-red-500 rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="featured"
                checked={newVideo.featured}
                onChange={(e) => setNewVideo(prev => ({ ...prev, featured: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="featured" className="text-sm text-gray-400">Featured (show in hero section)</label>
            </div>
          </div>

          {/* Preview */}
          {extractYouTubeId(newVideo.youtubeUrl) && (
            <div className="mt-4">
              <p className="text-gray-400 text-xs mb-2">Preview:</p>
              <img
                src={`https://img.youtube.com/vi/${extractYouTubeId(newVideo.youtubeUrl)}/mqdefault.jpg`}
                alt="Thumbnail preview"
                className="w-48 rounded-lg"
              />
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
            <button
              onClick={() => setIsCreating(false)}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Videos Grid or List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredVideos.map(video => (
            <div key={video._id} className={`bg-gray-800 rounded-lg overflow-hidden border border-gray-700 group ${!video.active ? 'opacity-60' : ''}`}>
              {editingVideo?._id === video._id ? (
              <div className="p-3 space-y-2">
                <input
                  type="text"
                  value={editingVideo.title || ''}
                  onChange={(e) => setEditingVideo(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Title"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                />
                <input
                  type="text"
                  value={editingVideo.youtubeUrl || ''}
                  onChange={(e) => {
                    const url = e.target.value;
                    const id = extractYouTubeId(url);
                    setEditingVideo(prev => ({ 
                      ...prev, 
                      youtubeUrl: url,
                      youtubeId: id || prev?.youtubeId || '',
                      thumbnail: id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : prev?.thumbnail || '',
                      active: !!id,
                    }));
                  }}
                  placeholder="YouTube URL"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                />
                <div className="flex items-center gap-1">
                  <input ref={editThumbnailInputRef} type="file" accept="image/*" onChange={handleEditThumbnailUpload} className="hidden" />
                  <button
                    onClick={() => editThumbnailInputRef.current?.click()}
                    disabled={uploadingVideoId === editingVideo._id}
                    className="flex items-center gap-1 bg-green-600 hover:bg-green-500 px-2 py-1 rounded text-xs disabled:opacity-50"
                  >
                    {uploadingVideoId === editingVideo._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    Thumbnail
                  </button>
                  {editingVideo.thumbnail && (
                    <img src={editingVideo.thumbnail} alt="Thumb" className="h-6 rounded" />
                  )}
                </div>
                <div className="flex gap-2">
                  <select
                    value={editingVideo.category || ''}
                    onChange={(e) => setEditingVideo(prev => ({ ...prev, category: e.target.value }))}
                    className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                  >
                    {categoryNames.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  <input
                    type="text"
                    value={editingVideo.duration || ''}
                    onChange={(e) => setEditingVideo(prev => ({ ...prev, duration: e.target.value }))}
                    placeholder="Duration"
                    className="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setEditingVideo(prev => ({ ...prev, language: prev?.language === 'de' ? 'en' : 'de' }))}
                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                    title="Toggle language"
                  >
                    {editingVideo.language === 'de' ? '🇩🇪' : '🇬🇧'}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleUpdate} className="flex-1 bg-green-600 hover:bg-green-700 py-1 rounded text-xs">
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Save'}
                  </button>
                  <button onClick={() => setEditingVideo(null)} className="flex-1 bg-gray-700 hover:bg-gray-600 py-1 rounded text-xs">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div 
                    className="relative aspect-video cursor-pointer"
                    onClick={() => {
                      const url = video.youtubeId 
                        ? `https://www.youtube.com/watch?v=${video.youtubeId}`
                        : video.youtubeUrl;
                      if (url) window.open(url, '_blank');
                    }}
                  >
                  <img
                    src={ytThumb(video.youtubeId, video.thumbnail)}
                    alt={video.title}
                    className="w-full h-full object-cover"
                    onError={(e) => ytThumbError(e, video.youtubeId)}
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="w-10 h-10 text-white fill-current" />
                  </div>
                  {video.featuredPosition && (
                    <span className="absolute top-2 left-2 bg-[#E36B11] text-white text-sm w-6 h-6 rounded-full flex items-center justify-center font-bold shadow-lg">
                      {video.featuredPosition}
                    </span>
                  )}
                  {!video.active && (
                    <span className="absolute top-2 right-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded font-medium">
                      INACTIVE
                    </span>
                  )}
                  {video.duration && (
                    <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded">
                      {video.duration}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-1">
                    <span className="text-xs">{video.language === 'de' ? '🇩🇪' : '🇬🇧'}</span>
                    <h4 className="font-medium text-sm truncate flex-1">{video.title}</h4>
                  </div>
                  <p className="text-gray-500 text-xs">{video.category}</p>
                  <div className="flex gap-1 mt-2">
                    {video.youtubeUrl && (
                      <a
                        href={video.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 bg-red-600 hover:bg-red-700 rounded"
                        title="Open YouTube"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <select
                      value={video.featuredPosition || ''}
                      onChange={(e) => setFeaturedPosition(video, e.target.value ? Number(e.target.value) : null)}
                      className={`flex-1 py-1 px-2 rounded text-xs cursor-pointer ${
                        video.featuredPosition 
                          ? 'bg-[#E36B11] text-white font-bold' 
                          : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      <option value="">☆ Feature</option>
                      <option value="1">★ Position 1</option>
                      <option value="2">★ Position 2</option>
                      <option value="3">★ Position 3</option>
                    </select>
                    <button
                      onClick={() => setEditingVideo(video)}
                      className="p-1 bg-gray-700 hover:bg-gray-600 rounded"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(video._id)}
                      className="p-1 bg-red-600/20 hover:bg-red-600/40 text-red-500 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
        </div>
      ) : (
        /* List View */
        <div className="space-y-1">
          {/* List Header */}
          <div className="grid grid-cols-[auto_1fr_120px_80px_60px_100px] gap-3 px-3 py-2 text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-700">
            <div className="w-16">Thumb</div>
            <div>Title</div>
            <div>Category</div>
            <div>Duration</div>
            <div>Lang</div>
            <div className="text-right">Actions</div>
          </div>
          {filteredVideos.map(video => (
            <div 
              key={video._id} 
              className={`grid grid-cols-[auto_1fr_120px_80px_60px_100px] gap-3 items-center px-3 py-2 bg-gray-800/50 hover:bg-gray-800 rounded-lg border border-transparent hover:border-gray-700 transition-colors ${!video.active ? 'opacity-60' : ''}`}
            >
              {/* Thumbnail */}
              <div 
                className="w-16 h-10 rounded overflow-hidden cursor-pointer relative group"
                onClick={() => {
                  const url = video.youtubeId 
                    ? `https://www.youtube.com/watch?v=${video.youtubeId}`
                    : video.youtubeUrl;
                  if (url) window.open(url, '_blank');
                }}
              >
                <img src={ytThumb(video.youtubeId, video.thumbnail)} alt="" className="w-full h-full object-cover" onError={(e) => ytThumbError(e, video.youtubeId)} />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Play className="w-4 h-4 text-white fill-current" />
                </div>
                {video.featuredPosition && (
                  <span className="absolute top-0.5 left-0.5 bg-[#E36B11] text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {video.featuredPosition}
                  </span>
                )}
              </div>
              
              {/* Title */}
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{video.title}</div>
                {!video.active && <span className="text-[10px] text-red-500">INACTIVE</span>}
              </div>
              
              {/* Category */}
              <div className="text-xs text-gray-400 truncate">{video.category}</div>
              
              {/* Duration */}
              <div className="text-xs text-gray-500">{video.duration || '—'}</div>
              
              {/* Language */}
              <div className="text-sm">{video.language === 'de' ? '🇩🇪' : '🇬🇧'}</div>
              
              {/* Actions */}
              <div className="flex gap-1 justify-end">
                <select
                  value={video.featuredPosition || ''}
                  onChange={(e) => setFeaturedPosition(video, e.target.value ? Number(e.target.value) : null)}
                  className={`w-8 py-1 px-1 rounded text-[10px] cursor-pointer ${
                    video.featuredPosition 
                      ? 'bg-[#E36B11] text-white font-bold' 
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  <option value="">☆</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
                <button
                  onClick={() => setEditingVideo(video)}
                  className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded"
                  title="Edit"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDelete(video._id)}
                  className="p-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-500 rounded"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredVideos.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Tv className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No videos yet. Add your first video!</p>
        </div>
      )}
    </div>
  );
}
