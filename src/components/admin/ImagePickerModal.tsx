"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, Search, X, Link, Upload, Image as ImageIcon, Sparkles, Wand2 } from "lucide-react";

interface ImagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (imageUrl: string) => void;
  currentImage?: string;
  searchTerm?: string; // Pre-fill search with topic/name
  showAiGenerate?: boolean; // Show AI generation option
  aiPromptContext?: string; // Context for AI image generation
  onUpload?: (file: File) => Promise<string | null>; // Custom upload handler
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
  searchTerm = "",
  showAiGenerate = true,
  aiPromptContext = "",
  onUpload,
}: ImagePickerModalProps) {
  const [activeTab, setActiveTab] = useState<'wikimedia' | 'url' | 'upload' | 'ai'>('wikimedia');
  const [search, setSearch] = useState(searchTerm);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<WikiImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>(currentImage || '');
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset search when searchTerm changes
  useEffect(() => {
    if (searchTerm) setSearch(searchTerm);
  }, [searchTerm]);

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
        setError(`Keine Bilder gefunden für "${search}"`);
      }
    } catch (e) {
      setError('Fehler bei der Suche');
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
    const prompt = aiPrompt.trim() || `Nostalgic 80s 90s style image for: ${searchTerm || aiPromptContext}. Cinematic, retro aesthetic, Gen X nostalgia.`;
    
    setAiGenerating(true);
    setError('');
    
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style: 'article' }),
      });
      const data = await res.json();
      
      if (data.success && data.imageUrl) {
        setSelectedImage(data.imageUrl);
      } else {
        setError('Fehler beim Generieren: ' + (data.error || 'Unbekannter Fehler'));
      }
    } catch (e) {
      setError('Fehler beim Generieren');
    } finally {
      setAiGenerating(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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
        
        if (data.success && data.url) {
          setSelectedImage(data.url);
        } else {
          setError('Upload fehlgeschlagen');
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
      onSelect(selectedImage);
      onClose();
    }
  };

  // Remove image
  const handleRemove = () => {
    onSelect('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-gray-800 rounded-lg w-[600px] max-w-[95vw] max-h-[85vh] flex flex-col" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Bild auswählen
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('wikimedia')}
            className={`flex-1 px-3 py-2 text-xs font-medium ${
              activeTab === 'wikimedia' 
                ? 'text-white border-b-2 border-[#D4873A]' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🌐 Wikimedia
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
                  Gib einen Suchbegriff ein und klicke auf "Suchen"
                </div>
              )}
            </div>
          )}

          {/* URL Tab */}
          {activeTab === 'url' && (
            <div>
              <p className="text-xs text-gray-400 mb-3">
                Füge eine direkte Bild-URL ein (muss mit http:// oder https:// beginnen)
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
                  Laden
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
                accept="image/*"
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
                  {uploading ? 'Wird hochgeladen...' : 'Klicken zum Hochladen'}
                </p>
                <p className="text-xs text-gray-500">
                  JPG, PNG, GIF, WebP
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
                placeholder={`z.B. "Nostalgic 80s concert scene with neon lights" oder leer lassen für automatischen Prompt basierend auf: ${searchTerm || aiPromptContext || 'Kontext'}`}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 h-24 resize-none mb-3"
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
        <div className="border-t border-gray-700 p-4">
          <div className="flex items-center gap-4">
            {/* Current/Selected Preview */}
            <div className="flex-shrink-0">
              {selectedImage ? (
                <img
                  src={selectedImage}
                  alt="Selected"
                  className="w-16 h-16 rounded object-cover border border-gray-600"
                />
              ) : (
                <div className="w-16 h-16 rounded bg-gray-700 flex items-center justify-center text-gray-500 border border-dashed border-gray-500">
                  <ImageIcon className="w-6 h-6" />
                </div>
              )}
            </div>

            <div className="flex-1 text-xs text-gray-400">
              {selectedImage ? (
                <span className="text-green-400">✓ Bild ausgewählt</span>
              ) : (
                <span>Kein Bild ausgewählt</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {currentImage && (
                <button
                  onClick={handleRemove}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded"
                >
                  Entfernen
                </button>
              )}
              <button
                onClick={onClose}
                className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded"
              >
                Abbrechen
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
