"use client";

import { useState, useRef } from "react";
import { Upload, Instagram, Facebook, Linkedin, Twitter, Youtube, Send, X, Clock, CheckCircle, AlertCircle } from "lucide-react";

interface ScheduledPost {
  id: string;
  videoUrl: string;
  videoName: string;
  caption: string;
  platforms: string[];
  scheduledFor: string | null;
  status: 'draft' | 'scheduled' | 'posted' | 'failed';
  createdAt: string;
}

const PLATFORMS = [
  { id: 'instagram', name: 'Instagram', icon: Instagram, color: '#E4405F' },
  { id: 'facebook', name: 'Facebook', icon: Facebook, color: '#1877F2' },
  { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: '#0A66C2' },
  { id: 'twitter', name: 'X (Twitter)', icon: Twitter, color: '#000000' },
  { id: 'youtube', name: 'YouTube', icon: Youtube, color: '#FF0000' },
];

export default function MarketingTab() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId) 
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    );
  };

  const handleSubmit = async () => {
    if (!selectedFile || selectedPlatforms.length === 0) return;

    setIsUploading(true);
    
    // TODO: Implement actual upload and social media posting
    // For now, just simulate the process
    await new Promise(resolve => setTimeout(resolve, 2000));

    const newPost: ScheduledPost = {
      id: Date.now().toString(),
      videoUrl: videoPreview || '',
      videoName: selectedFile.name,
      caption,
      platforms: selectedPlatforms,
      scheduledFor: scheduleDate && scheduleTime ? `${scheduleDate}T${scheduleTime}` : null,
      status: scheduleDate && scheduleTime ? 'scheduled' : 'draft',
      createdAt: new Date().toISOString(),
    };

    setPosts(prev => [newPost, ...prev]);
    
    // Reset form
    setSelectedFile(null);
    setVideoPreview(null);
    setCaption("");
    setSelectedPlatforms([]);
    setScheduleDate("");
    setScheduleTime("");
    setIsUploading(false);
  };

  const clearVideo = () => {
    setSelectedFile(null);
    setVideoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Marketing</h2>
          <p className="text-gray-400 text-sm">Upload videos and distribute to social media platforms</p>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-white font-semibold mb-4">New Post</h3>
        
        {/* Video Upload */}
        <div className="mb-6">
          {!videoPreview ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-[#D4873A] transition-colors"
            >
              <Upload className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400 mb-1">Click to upload video</p>
              <p className="text-gray-500 text-sm">MP4, MOV, AVI (max 100MB)</p>
            </div>
          ) : (
            <div className="relative">
              <video 
                src={videoPreview} 
                controls 
                className="w-full max-h-64 rounded-xl bg-black"
              />
              <button
                onClick={clearVideo}
                className="absolute top-2 right-2 p-1.5 bg-black/70 rounded-full hover:bg-black"
              >
                <X className="w-4 h-4 text-white" />
              </button>
              <p className="text-gray-400 text-sm mt-2">{selectedFile?.name}</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Caption */}
        <div className="mb-6">
          <label className="block text-gray-400 text-sm mb-2">Caption</label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write your caption here..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 resize-none h-24 focus:outline-none focus:border-[#D4873A]"
          />
        </div>

        {/* Platform Selection */}
        <div className="mb-6">
          <label className="block text-gray-400 text-sm mb-3">Select Platforms</label>
          <div className="flex flex-wrap gap-3">
            {PLATFORMS.map(platform => {
              const Icon = platform.icon;
              const isSelected = selectedPlatforms.includes(platform.id);
              return (
                <button
                  key={platform.id}
                  onClick={() => togglePlatform(platform.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                    isSelected 
                      ? 'border-[#D4873A] bg-[#D4873A]/20 text-white' 
                      : 'border-gray-600 bg-gray-900 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <Icon className="w-4 h-4" style={{ color: isSelected ? platform.color : undefined }} />
                  <span className="text-sm">{platform.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Schedule */}
        <div className="mb-6">
          <label className="block text-gray-400 text-sm mb-2">Schedule (optional)</label>
          <div className="flex gap-3">
            <input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#D4873A]"
            />
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#D4873A]"
            />
          </div>
          <p className="text-gray-500 text-xs mt-1">Leave empty to save as draft</p>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!selectedFile || selectedPlatforms.length === 0 || isUploading}
          className="w-full bg-[#D4873A] hover:bg-[#C4772A] disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          {isUploading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              {scheduleDate && scheduleTime ? 'Schedule Post' : 'Save as Draft'}
            </>
          )}
        </button>
      </div>

      {/* Scheduled Posts */}
      {posts.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-white font-semibold mb-4">Recent Posts</h3>
          <div className="space-y-3">
            {posts.map(post => (
              <div key={post.id} className="bg-gray-900 rounded-lg p-4 flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
                  <video src={post.videoUrl} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{post.videoName}</p>
                  <p className="text-gray-400 text-sm truncate">{post.caption || 'No caption'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {post.platforms.map(platformId => {
                      const platform = PLATFORMS.find(p => p.id === platformId);
                      if (!platform) return null;
                      const Icon = platform.icon;
                      return <Icon key={platformId} className="w-3 h-3" style={{ color: platform.color }} />;
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {post.status === 'scheduled' && (
                    <span className="flex items-center gap-1 text-yellow-500 text-xs">
                      <Clock className="w-3 h-3" />
                      Scheduled
                    </span>
                  )}
                  {post.status === 'posted' && (
                    <span className="flex items-center gap-1 text-green-500 text-xs">
                      <CheckCircle className="w-3 h-3" />
                      Posted
                    </span>
                  )}
                  {post.status === 'draft' && (
                    <span className="flex items-center gap-1 text-gray-500 text-xs">
                      Draft
                    </span>
                  )}
                  {post.status === 'failed' && (
                    <span className="flex items-center gap-1 text-red-500 text-xs">
                      <AlertCircle className="w-3 h-3" />
                      Failed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <p className="text-gray-400 text-sm">
          <strong className="text-[#D4873A]">Coming Soon:</strong> Direct posting to Instagram, Facebook, LinkedIn, X, and YouTube. 
          For now, posts are saved as drafts. You&apos;ll need to connect your social media accounts in Settings.
        </p>
      </div>
    </div>
  );
}
