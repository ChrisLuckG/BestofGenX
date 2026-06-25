"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, Search, X, Link, Upload, Image as ImageIcon, Sparkles, Wand2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

interface ImagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (imageUrl: string, position?: { x: number; y: number }, thumbnailUrl?: string) => void;
  currentImage?: string;
  currentThumbnail?: string; // Current thumbnail (if different from cover)
  currentPosition?: { x: number; y: number }; // Current image position
  searchTerm?: string; // Pre-fill search with topic/name
  showAiGenerate?: boolean; // Show AI generation option
  showThumbnail?: boolean; // Show thumbnail selection option
  aiPromptContext?: string; // Context for AI image generation
  aiAllowText?: boolean; // Allow text in AI-generated images (for banners with slogans)
  onUpload?: (file: File) => Promise<string | null>; // Custom upload handler
  dimensions?: string; // e.g. "1200×630" or "300×200"
  aspectRatio?: string; // e.g. "16:9" or "3:2"
}

interface WikiImage {
  title: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}

export default function ImagePickerModal({
  isOpen,
  onClose,
  onSelect,
  currentImage,
  currentThumbnail,
  currentPosition,
  searchTerm = "",
  showAiGenerate = true,
  showThumbnail = false,
  aiPromptContext = "",
  aiAllowText = false,
  onUpload,
  dimensions,
  aspectRatio,
}: ImagePickerModalProps) {
  const [activeTab, setActiveTab] = useState<'wikimedia' | 'tenor' | 'url' | 'upload' | 'ai'>('upload');
  const [tenorResults, setTenorResults] = useState<string[]>([]);
  const [tenorSearching, setTenorSearching] = useState(false);
  const [tenorSearch, setTenorSearch] = useState(searchTerm);
  const [search, setSearch] = useState(searchTerm);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<WikiImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>(currentImage || '');
  const [selectedThumbnail, setSelectedThumbnail] = useState<string>(currentThumbnail || '');
  const [thumbnailSameAsCover, setThumbnailSameAsCover] = useState(!currentThumbnail || currentThumbnail === currentImage);
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [imagePosition, setImagePosition] = useState(currentPosition || { x: 50, y: 50 }); // Position in %
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Move image position
  const moveImage = (direction: 'up' | 'down' | 'left' | 'right') => {
    const step = 5; // 5% per click
    setImagePosition(prev => {
      switch (direction) {
        case 'up': return { ...prev, y: Math.max(-50, prev.y - step) };
        case 'down': return { ...prev, y: Math.min(150, prev.y + step) };
        case 'left': return { ...prev, x: Math.max(-50, prev.x - step) };
        case 'right': return { ...prev, x: Math.min(150, prev.x + step) };
        default: return prev;
      }
    });
  };

  const resetPosition = () => setImagePosition({ x: 50, y: 50 });

  // Reset search when searchTerm changes
  useEffect(() => {
    if (searchTerm) {
      setSearch(searchTerm);
      setTenorSearch(searchTerm);
    }
  }, [searchTerm]);

  // Reset selected image & position every time the modal opens (fixes stale state)
  useEffect(() => {
    if (isOpen) {
      setSelectedImage(currentImage || '');
      setSelectedThumbnail(currentThumbnail || '');
      setThumbnailSameAsCover(!currentThumbnail || currentThumbnail === currentImage);
      setImagePosition(currentPosition || { x: 50, y: 50 });
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  // Search Wikimedia Commons
  const handleSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    setError('');
    setResults([]);
    
    try {
      const res = await fetch('/api/search-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: search }),
      });
      const data = await res.json();
      
      if (data.success && data.allImages?.length > 0) {
        setResults(data.allImages);
      } else {
        setError(`No images found for "${search}"`);
      }
    } catch (e) {
      setError('Search error');
    } finally {
      setSearching(false);
    }
  };

  // Handle URL input
  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      setSelectedImage(urlInput.trim());
    }
  };

  // AI Generate image
  const handleAiGenerate = async () => {
    const prompt = aiPrompt.trim()
      || aiPromptContext
      || 'Nostalgic Gen X editorial photo. Vintage objects, warm cinematic lighting, film grain texture. NO people, NO faces, NO text.';
    
    setAiGenerating(true);
    setError('');
    
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style: 'article', allowText: aiAllowText }),
      });
      const data = await res.json();
      
      if (data.success && data.imageUrl) {
        setSelectedImage(data.imageUrl);
      } else {
        setError('Generation error: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      setError('Generation error');
    } finally {
      setAiGenerating(false);
    }
  };

  // Search Tenor GIFs
  const handleTenorSearch = async () => {
    if (!tenorSearch.trim()) return;
    setTenorSearching(true);
    setError('');
    setTenorResults([]);
    
    try {
      const res = await fetch(`/api/tenor-search?q=${encodeURIComponent(tenorSearch)}`);
      const data = await res.json();
      
      if (data.success && data.results) {
        setTenorResults(data.results);
      } else {
        setError('Keine GIFs gefunden');
      }
    } catch (e) {
      setError('Tenor-Suche fehlgeschlagen');
    } finally {
      setTenorSearching(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('File selected:', file?.name, file?.type, file?.size);
    if (!file) return;
    
    setUploading(true);
    setError('');
    
    try {
      if (onUpload) {
        // Use custom upload handler
        const url = await onUpload(file);
        if (url) setSelectedImage(url);
      } else {
        // Default: upload to our API
        const formData = new FormData();
        formData.append('file', file);
        
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        
        console.log('Upload response:', data);
        if (data.success && data.url) {
          setSelectedImage(data.url);
        } else {
          setError(data.error || 'Upload fehlgeschlagen');
        }
      }
    } catch (e) {
      setError('Upload fehlgeschlagen');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Confirm selection
  const handleConfirm = () => {
    if (selectedImage) {
      const thumbnail = showThumbnail 
        ? (thumbnailSameAsCover ? selectedImage : selectedThumbnail)
        : undefined;
      onSelect(selectedImage, imagePosition, thumbnail);
      onClose();
    }
  };

  // Remove image
  const handleRemove = () => {
    onSelect('');
    onClose();
  };

  // Block closing while AI is generating
  const canClose = !aiGenerating && !uploading;

  return (
    <div 
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]" 
      onMouseDown={(e) => {
        // Only close if clicking directly on backdrop, not when dragging from inside
        // Block closing while AI is generating or uploading
        if (e.target === e.currentTarget && canClose) onClose();
      }}
    >
      <div 
        className="bg-gray-800 rounded-lg w-[600px] max-w-[95vw] max-h-[85vh] flex flex-col" 
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Bild auswählen
            </h3>
            {(dimensions || aspectRatio) && (
              <p className="text-[10px] text-[#D4873A] mt-0.5">
                📐 Empfohlen: {dimensions}{aspectRatio ? ` (${aspectRatio})` : ''}
              </p>
            )}
          </div>
          <button 
            onClick={() => canClose && onClose()} 
            className={`p-1 hover:bg-gray-700 rounded ${!canClose ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!canClose}
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 px-3 py-2 text-xs font-medium ${
              activeTab === 'upload' 
                ? 'text-white border-b-2 border-[#D4873A]' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            📤 Upload
          </button>
          <button
            onClick={() => setActiveTab('url')}
            className={`flex-1 px-3 py-2 text-xs font-medium ${
              activeTab === 'url' 
                ? 'text-white border-b-2 border-[#D4873A]' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🔗 URL
          </button>
          {showAiGenerate && (
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex-1 px-3 py-2 text-xs font-medium ${
                activeTab === 'ai' 
                  ? 'text-white border-b-2 border-purple-500' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              ✨ AI Generate
            </button>
          )}
          <button
            onClick={() => setActiveTab('tenor')}
            className={`flex-1 px-2 py-2 text-xs font-medium ${
              activeTab === 'tenor' 
                ? 'text-white border-b-2 border-[#D4873A]' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🎬 Tenor
          </button>
          <button
            onClick={() => setActiveTab('wikimedia')}
            className={`flex-1 px-2 py-2 text-xs font-medium ${
              activeTab === 'wikimedia' 
                ? 'text-white border-b-2 border-[#D4873A]' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🌐 Wiki
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Wikimedia Tab */}
          {activeTab === 'wikimedia' && (
            <div>
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Suchbegriff eingeben..."
                    className="w-full pl-8 pr-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={searching || !search.trim()}
                  className="px-4 py-2 bg-[#D4873A] hover:bg-[#c57830] text-white text-sm font-bold rounded disabled:opacity-50 flex items-center gap-2"
                >
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Suchen
                </button>
              </div>

              <p className="text-[10px] text-gray-500 mb-3">
                💡 Wikimedia Commons bietet lizenzfreie Bilder. Suche nach Namen, Begriffen oder Themen.
              </p>

              {error && (
                <div className="text-center py-4 text-red-400 text-sm">{error}</div>
              )}

              {searching && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-[#D4873A] animate-spin" />
                </div>
              )}

              {results.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {results.map((img, i) => (
                    <div
                      key={i}
                      onClick={() => setSelectedImage(img.thumbUrl)}
                      className={`relative cursor-pointer rounded overflow-hidden border-2 transition-all ${
                        selectedImage === img.thumbUrl 
                          ? 'border-[#D4873A] ring-2 ring-[#D4873A]/50' 
                          : 'border-transparent hover:border-gray-500'
                      }`}
                    >
                      <img
                        src={img.thumbUrl}
                        alt={img.title}
                        className="w-full h-24 object-cover"
                      />
                      {selectedImage === img.thumbUrl && (
                        <div className="absolute inset-0 bg-[#D4873A]/20 flex items-center justify-center">
                          <span className="text-white text-lg">✓</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!searching && results.length === 0 && !error && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Enter a search term and click "Search"
                </div>
              )}
            </div>
          )}

          {/* Tenor GIF Tab */}
          {activeTab === 'tenor' && (
            <div>
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={tenorSearch}
                    onChange={e => setTenorSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleTenorSearch()}
                    placeholder="Search GIFs (e.g. 'cooking', 'happy')..."
                    className="w-full pl-8 pr-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500"
                  />
                </div>
                <button
                  onClick={handleTenorSearch}
                  disabled={tenorSearching || !tenorSearch.trim()}
                  className="px-4 py-2 bg-[#D4873A] hover:bg-[#c57830] text-white text-sm font-bold rounded disabled:opacity-50 flex items-center gap-2"
                >
                  {tenorSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Search
                </button>
              </div>

              <p className="text-[10px] text-gray-500 mb-3">
                🎬 Tenor GIFs - animierte Bilder für Rankings und mehr
              </p>

              {error && (
                <div className="text-center py-4 text-red-400 text-sm">{error}</div>
              )}

              {tenorSearching && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-[#D4873A] animate-spin" />
                </div>
              )}

              {tenorResults.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {tenorResults.map((gif, i) => (
                    <div
                      key={i}
                      onClick={() => setSelectedImage(gif)}
                      className={`relative cursor-pointer rounded overflow-hidden border-2 transition-all ${
                        selectedImage === gif 
                          ? 'border-[#D4873A] ring-2 ring-[#D4873A]/50' 
                          : 'border-transparent hover:border-gray-500'
                      }`}
                    >
                      <img
                        src={gif}
                        alt={`GIF ${i + 1}`}
                        className="w-full h-24 object-cover"
                      />
                      {selectedImage === gif && (
                        <div className="absolute inset-0 bg-[#D4873A]/20 flex items-center justify-center">
                          <span className="text-white text-lg">✓</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!tenorSearching && tenorResults.length === 0 && !error && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Enter a search term and click "Search"
                </div>
              )}
            </div>
          )}

          {/* URL Tab */}
          {activeTab === 'url' && (
            <div>
              <p className="text-xs text-gray-400 mb-3">
                Paste a direct image URL (must start with http:// or https://)
              </p>
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Link className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
                    placeholder="https://example.com/image.jpg"
                    className="w-full pl-8 pr-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500"
                  />
                </div>
                <button
                  onClick={handleUrlSubmit}
                  disabled={!urlInput.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded disabled:opacity-50"
                >
                  Load
                </button>
              </div>

              {urlInput && (
                <div className="flex justify-center">
                  <img
                    src={urlInput}
                    alt="Preview"
                    className="max-w-full max-h-48 rounded border border-gray-600"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                    onLoad={(e) => {
                      (e.target as HTMLImageElement).style.display = 'block';
                      setSelectedImage(urlInput);
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div className="text-center py-6">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/mp4,video/webm"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-600 hover:border-gray-500 rounded-lg p-8 cursor-pointer transition-colors"
              >
                {uploading ? (
                  <Loader2 className="w-12 h-12 text-[#D4873A] mx-auto mb-3 animate-spin" />
                ) : (
                  <Upload className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                )}
                <p className="text-sm text-gray-400 mb-1">
                  {uploading ? 'Uploading...' : 'Click to upload'}
                </p>
                <p className="text-xs text-gray-500">
                  JPG, PNG, GIF, WebP, MP4, WebM
                </p>
              </div>
              {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
            </div>
          )}

          {/* AI Generate Tab */}
          {activeTab === 'ai' && showAiGenerate && (
            <div>
              <p className="text-xs text-gray-400 mb-3">
                Beschreibe das gewünschte Bild oder nutze den Standard-Prompt basierend auf dem Kontext.
              </p>
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder={`Leer lassen für automatischen Prompt basierend auf: "${searchTerm || aiPromptContext || 'Artikel-Titel'}"`}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 h-32 resize-y mb-3"
              />
              <button
                onClick={handleAiGenerate}
                disabled={aiGenerating}
                className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {aiGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generiere Bild...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Bild mit AI generieren
                  </>
                )}
              </button>
              {error && <p className="text-red-400 text-sm mt-3 text-center">{error}</p>}
              <p className="text-[10px] text-gray-500 mt-3 text-center">
                💡 AI-generierte Bilder werden mit DALL-E erstellt und kosten Credits.
              </p>
            </div>
          )}
        </div>

        {/* Preview & Actions */}
        <div className="border-t border-gray-700 p-4 space-y-3">
          {/* Multi-context preview */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {/* Thumbnail preview */}
            <div>
              <div className="text-[9px] text-gray-500 mb-1 uppercase tracking-wider">List / Thumbnail</div>
              <div className="mx-auto w-10 h-8 rounded bg-gray-700 border border-gray-600 overflow-hidden">
                {selectedImage ? (
                  selectedImage.match(/\.(mp4|webm|mov)($|\?)/i) || selectedImage.includes('/video/') ? (
                    <video src={selectedImage} className="w-full h-full object-cover" muted autoPlay loop playsInline style={{ objectPosition: `${imagePosition.x}% ${imagePosition.y}%` }} />
                  ) : (
                    <img src={selectedImage} alt="" className="w-full h-full object-cover" style={{ objectPosition: `${imagePosition.x}% ${imagePosition.y}%` }} />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-3 h-3 text-gray-500" /></div>
                )}
              </div>
            </div>
            {/* Mobile article header preview */}
            <div>
              <div className="text-[9px] text-gray-500 mb-1 uppercase tracking-wider">Mobile Article</div>
              <div className="mx-auto w-full aspect-[2/1] rounded bg-gray-700 border border-gray-600 overflow-hidden">
                {selectedImage ? (
                  selectedImage.includes('.mp4') || selectedImage.includes('.webm') ? (
                    <video src={selectedImage} className="w-full h-full object-cover" muted autoPlay loop playsInline style={{ objectPosition: `${imagePosition.x}% ${imagePosition.y}%` }} />
                  ) : (
                    <img src={selectedImage} alt="" className="w-full h-full object-cover" style={{ objectPosition: `${imagePosition.x}% ${imagePosition.y}%` }} />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-4 h-4 text-gray-500" /></div>
                )}
              </div>
            </div>
            {/* Desktop banner preview */}
            <div>
              <div className="text-[9px] text-gray-500 mb-1 uppercase tracking-wider">Desktop Banner</div>
              <div className="mx-auto w-full aspect-[3/1] rounded bg-gray-700 border border-gray-600 overflow-hidden">
                {selectedImage ? (
                  selectedImage.match(/\.(mp4|webm|mov)($|\?)/i) || selectedImage.includes('/video/') ? (
                    <video src={selectedImage} className="w-full h-full object-cover" muted autoPlay loop playsInline style={{ objectPosition: `${imagePosition.x}% ${imagePosition.y}%` }} />
                  ) : (
                    <img src={selectedImage} alt="" className="w-full h-full object-cover" style={{ objectPosition: `${imagePosition.x}% ${imagePosition.y}%` }} />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-3 h-3 text-gray-500" /></div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Position Controls */}
            <div className="flex-shrink-0 flex items-center gap-2">
              {/* small square for position arrows */}
              <div className="relative w-12 h-12 rounded bg-gray-700 border border-gray-600 overflow-hidden">
                {selectedImage ? (
                  selectedImage.match(/\.(mp4|webm|mov)($|\?)/i) || selectedImage.includes('/video/') ? (
                    <video src={selectedImage} className="w-full h-full object-cover" muted autoPlay loop playsInline style={{ objectPosition: `${imagePosition.x}% ${imagePosition.y}%` }} />
                  ) : (
                    <img src={selectedImage} alt="" className="w-full h-full object-cover" style={{ objectPosition: `${imagePosition.x}% ${imagePosition.y}%` }} />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500"><ImageIcon className="w-4 h-4" /></div>
                )}
              </div>
              
              {/* Position Controls */}
              {selectedImage && (
                <div className="flex flex-col items-center gap-0.5">
                  <button
                    onClick={() => moveImage('up')}
                    className="p-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                    title="Nach oben"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => moveImage('left')}
                      className="p-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                      title="Nach links"
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                    <button
                      onClick={resetPosition}
                      className="p-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-400"
                      title="Reset"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => moveImage('right')}
                      className="p-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                      title="Nach rechts"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => moveImage('down')}
                    className="p-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                    title="Nach unten"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 text-xs text-gray-400">
              {selectedImage ? (
                <div>
                  <span className="text-green-400">✓ {selectedImage.includes('.mp4') || selectedImage.includes('.webm') || selectedImage.includes('video') ? 'Video' : 'Bild'} ausgewählt</span>
                  {!selectedImage.includes('.mp4') && !selectedImage.includes('.webm') && !selectedImage.includes('video') && (
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      Position: {imagePosition.x}% / {imagePosition.y}%
                    </div>
                  )}
                </div>
              ) : (
                <span>Kein Bild ausgewählt</span>
              )}
            </div>

            {/* Thumbnail Option */}
            {showThumbnail && selectedImage && (
              <div className="flex items-center gap-3 px-3 py-1 bg-gray-700/50 rounded">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={thumbnailSameAsCover}
                    onChange={(e) => setThumbnailSameAsCover(e.target.checked)}
                    className="w-3 h-3 rounded"
                  />
                  <span className="text-[10px] text-gray-300">Thumbnail = Cover</span>
                </label>
                {!thumbnailSameAsCover && (
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-8 h-8 rounded bg-gray-600 overflow-hidden cursor-pointer border border-gray-500 hover:border-cyan-400"
                      onClick={() => {
                        // Use current selected image as thumbnail
                        if (selectedImage && selectedImage !== selectedThumbnail) {
                          setSelectedThumbnail(selectedImage);
                        }
                      }}
                      title="Aktuelles Bild als Thumbnail setzen"
                    >
                      {selectedThumbnail ? (
                        <img src={selectedThumbnail} className="w-full h-full object-cover" alt="Thumb" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] text-gray-400">+</div>
                      )}
                    </div>
                    <span className="text-[9px] text-gray-400">Klick = Bild als Thumb</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {currentImage && (
                <button
                  onClick={handleRemove}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded"
                >
                  Remove
                </button>
              )}
              <button
                onClick={() => canClose && onClose()}
                disabled={!canClose}
                className={`px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded ${!canClose ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {!canClose ? 'Please wait...' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selectedImage}
                className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded disabled:opacity-50"
              >
                Übernehmen
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
