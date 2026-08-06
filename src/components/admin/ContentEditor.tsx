"use client";

import { useRef, useMemo, useCallback, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Film, Megaphone, Minus, X } from "lucide-react";

const ReactQuill = dynamic(
  () => import("react-quill-new").then((mod: any) => {
    // Register video blot to preserve iframes
    const Quill = mod.default?.Quill || mod.Quill;
    if (Quill) {
      try {
        const BlockEmbed = Quill.import('blots/block/embed') as any;
        class VideoBlot extends BlockEmbed {
          static blotName = 'video';
          static tagName = 'iframe';
          static create(url: string) {
            const node = super.create() as HTMLIFrameElement;
            node.setAttribute('src', url);
            node.setAttribute('frameborder', '0');
            node.setAttribute('allowfullscreen', 'true');
            node.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
            node.setAttribute('class', 'ql-video');
            node.setAttribute('style', 'width:100%;height:315px;');
            return node;
          }
          static value(node: HTMLIFrameElement) {
            return node.getAttribute('src');
          }
        }
        Quill.register(VideoBlot as any, true);
      } catch (e) {
        console.warn('Failed to register VideoBlot:', e);
      }
    }
    return mod;
  }),
  {
    ssr: false,
    loading: () => <div className="h-64 bg-gray-900 rounded-lg animate-pulse" />,
  }
) as any;

interface ContentEditorProps {
  value: string;
  onChange: (content: string) => void;
}

/**
 * Rich content editor for articles based on Quill.
 * Adds custom buttons for inserting videos, ad slots and dividers.
 */
export default function ContentEditor({ value, onChange }: ContentEditorProps) {
  const quillRef = useRef<any>(null);
  const [videoPopover, setVideoPopover] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoError, setVideoError] = useState<string | null>(null);
  const savedRangeRef = useRef<{ index: number; length: number } | null>(null);

  // Helper to get Quill editor instance
  const getQuillEditor = useCallback(() => {
    if (!quillRef.current) return null;
    // react-quill-new exposes editor differently
    if (typeof quillRef.current.getEditor === 'function') {
      return quillRef.current.getEditor();
    }
    if (quillRef.current.editor) {
      return quillRef.current.editor;
    }
    // Try accessing via unprivilegedEditor
    if (quillRef.current.unprivilegedEditor) {
      return quillRef.current.unprivilegedEditor;
    }
    // Last resort: try to find Quill instance in DOM
    const container = document.querySelector('.ql-container');
    if (container && (container as any).__quill) {
      return (container as any).__quill;
    }
    return null;
  }, []);

  // Open video popover (saves cursor position)
  const insertVideo = useCallback(() => {
    const quill = getQuillEditor();
    if (quill) {
      // Force focus and get selection
      quill.focus();
      const range = quill.getSelection(true);
      savedRangeRef.current = range || { index: quill.getLength() - 1, length: 0 };
      console.log('Saved cursor position:', savedRangeRef.current);
    } else {
      // Fallback: insert at end
      savedRangeRef.current = null;
    }
    setVideoUrl("");
    setVideoError(null);
    setVideoPopover(true);
  }, [getQuillEditor]);

  // Confirm video insertion from popover
  const confirmInsertVideo = useCallback(() => {
    const url = videoUrl.trim();
    if (!url) {
      setVideoError("Please paste a URL");
      return;
    }
    const embedUrl = toEmbedUrl(url);
    if (!embedUrl) {
      setVideoError("Not a valid YouTube or Vimeo URL");
      return;
    }
    
    const quill = getQuillEditor();
    const videoHtml = `<iframe class="ql-video" frameborder="0" allowfullscreen="true" src="${embedUrl}" style="width:100%;height:315px;display:block;margin:16px 0;border-radius:8px;"></iframe>`;
    
    if (!quill) {
      // Fallback: Insert directly into content HTML
      const newContent = value + `<p><br></p>${videoHtml}<p><br></p>`;
      onChange(newContent);
      setVideoPopover(false);
      setVideoUrl("");
      return;
    }
    
    // Get saved cursor position or default to end
    const insertIndex = savedRangeRef.current?.index ?? quill.getLength() - 1;
    
    // Focus editor and set selection to saved position
    quill.focus();
    quill.setSelection(insertIndex, 0);
    
    // Insert video embed at cursor position
    quill.insertEmbed(insertIndex, "video", embedUrl, "user");
    // Add line break after video
    quill.insertText(insertIndex + 1, "\n", "user");
    // Move cursor after video
    quill.setSelection(insertIndex + 2, 0);
    
    setVideoPopover(false);
    setVideoUrl("");
    savedRangeRef.current = null;
  }, [videoUrl, getQuillEditor, value, onChange]);

  // Close popover on Escape
  useEffect(() => {
    if (!videoPopover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVideoPopover(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [videoPopover]);

  // Track videos for deletion
  const [videoElements, setVideoElements] = useState<HTMLIFrameElement[]>([]);
  
  // Scan for videos periodically
  useEffect(() => {
    const scanVideos = () => {
      const editor = document.querySelector('.ql-editor');
      if (!editor) return;
      const iframes = Array.from(editor.querySelectorAll('iframe.ql-video, iframe[src*="youtube"], iframe[src*="vimeo"]')) as HTMLIFrameElement[];
      setVideoElements(iframes);
    };
    
    scanVideos();
    const interval = setInterval(scanVideos, 1000);
    return () => clearInterval(interval);
  }, [value]);

  // Delete a video by index
  const deleteVideo = useCallback((iframe: HTMLIFrameElement) => {
    iframe.remove();
    const quill = getQuillEditor();
    if (quill) {
      onChange(quill.root.innerHTML);
    }
  }, [getQuillEditor, onChange]);

  // Insert in-article ad placeholder
  const insertAdSlot = useCallback(() => {
    const quill = quillRef.current?.getEditor?.();
    if (!quill) return;
    const range = quill.getSelection(true);
    // Insert raw HTML marker on its own line
    quill.clipboard.dangerouslyPasteHTML(
      range.index,
      '<p data-ad-slot="banner" class="ad-slot-marker">[ AD ]</p><p><br></p>'
    );
    quill.setSelection(range.index + 2, 0);
  }, []);

  // Insert horizontal divider
  const insertDivider = useCallback(() => {
    const quill = quillRef.current?.getEditor?.();
    if (!quill) return;
    const range = quill.getSelection(true);
    quill.clipboard.dangerouslyPasteHTML(
      range.index,
      '<hr class="article-divider" /><p><br></p>'
    );
    quill.setSelection(range.index + 1, 0);
  }, []);

  const modules = useMemo(
    () => ({
      toolbar: {
        container: "#article-quill-toolbar",
        handlers: {
          "ad-slot": insertAdSlot,
          "video-embed": insertVideo,
          divider: insertDivider,
        },
      },
      keyboard: {
        bindings: {
          linebreak: {
            key: 13,
            shiftKey: true,
            handler: function (this: any) {
              const cursorPosition = this.quill.getSelection()?.index || 0;
              this.quill.insertText(cursorPosition, "\n");
              this.quill.setSelection(cursorPosition + 1);
              return false;
            },
          },
        },
      },
    }),
    [insertAdSlot, insertVideo, insertDivider]
  );

  const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "color",
    "background",
    "list",
    "bullet",
    "blockquote",
    "link",
    "image",
    "video",
    "align",
  ];

  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">Content</label>

      {/* Custom Toolbar - icon only, single row */}
      <div
        id="article-quill-toolbar"
        className="bg-gray-100 border border-gray-300 border-b-0 rounded-t-lg px-1.5 py-1 flex items-center gap-0.5 overflow-x-auto"
      >
        <select className="ql-header !w-[88px]" defaultValue="">
          <option value="1" />
          <option value="2" />
          <option value="3" />
          <option value="" />
        </select>
        <span className="ql-formats !mr-1">
          <button className="ql-bold" />
          <button className="ql-italic" />
          <button className="ql-underline" />
          <button className="ql-strike" />
        </span>
        <span className="ql-formats !mr-1">
          <select className="ql-color" />
          <select className="ql-background" />
        </span>
        <span className="ql-formats !mr-1">
          <button className="ql-list" value="ordered" />
          <button className="ql-list" value="bullet" />
          <button className="ql-blockquote" />
          <button className="ql-link" />
          <button className="ql-image" />
        </span>

        {/* Custom buttons - icon only with tooltips */}
        <span className="mx-0.5 h-5 w-px bg-gray-300 flex-shrink-0" />
        <div className="relative flex-shrink-0">
          <button
            type="button"
            className="ql-video-embed flex items-center justify-center w-7 h-7 text-gray-700 hover:bg-gray-200 rounded transition-colors"
            title="Insert video (YouTube / Vimeo)"
          >
            <Film className="w-4 h-4" />
          </button>
          {videoPopover && (
            <>
              {/* Click-outside catcher */}
              <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setVideoPopover(false)} />
              {/* Modal - centered */}
              <div 
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[400px] bg-gray-800 border border-gray-600 rounded-xl shadow-2xl overflow-hidden" 
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-900">
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    <Film className="w-4 h-4 text-[#E36B11]" />
                    Insert Video
                  </span>
                  <button
                    type="button"
                    onClick={() => setVideoPopover(false)}
                    className="text-gray-400 hover:text-white p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Content */}
                <div className="p-4">
                  <label className="block text-xs text-gray-400 mb-2">Paste YouTube or Vimeo URL</label>
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => { setVideoUrl(e.target.value); setVideoError(null); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); confirmInsertVideo(); }
                    }}
                    placeholder="https://www.youtube.com/watch?v=..."
                    autoFocus
                    className="w-full px-3 py-2.5 text-sm text-white bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-[#E36B11] focus:ring-1 focus:ring-[#E36B11]"
                  />
                  {videoError && (
                    <div className="text-xs text-red-400 mt-2 flex items-center gap-1.5">
                      <X className="w-3.5 h-3.5" />
                      {videoError}
                    </div>
                  )}
                  <div className="text-[11px] text-gray-500 mt-2">
                    Supported: youtube.com, youtu.be, vimeo.com
                  </div>
                </div>
                
                {/* Footer with buttons */}
                <div className="flex justify-center gap-4 p-4 border-t border-gray-700 bg-gray-900">
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setVideoPopover(false); }}
                    className="px-6 py-2.5 bg-gray-600 hover:bg-gray-500 text-white font-medium text-sm rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); confirmInsertVideo(); }}
                    className="px-6 py-2.5 bg-[#E36B11] hover:bg-[#c06a2a] text-white font-bold text-sm rounded-lg cursor-pointer"
                  >
                    Insert
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          className="ql-ad-slot flex items-center justify-center w-7 h-7 text-orange-700 hover:bg-orange-50 rounded transition-colors flex-shrink-0"
          title="Insert in-article ad slot"
        >
          <Megaphone className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="ql-divider flex items-center justify-center w-7 h-7 text-gray-700 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
          title="Insert horizontal divider"
        >
          <Minus className="w-4 h-4" />
        </button>

        <span className="ql-formats !ml-auto !mr-0">
          <button className="ql-clean" />
        </span>
      </div>

      <div className="bg-cream rounded-b-lg overflow-hidden">
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={value}
          onChange={onChange}
          modules={modules}
          formats={formats}
          className="[&_.ql-editor]:min-h-[320px] [&_.ql-editor]:text-gray-900 [&_.ql-editor]:text-base [&_.ql-toolbar]:hidden [&_.ql-container]:border-gray-300 [&_.ql-container]:rounded-b-lg [&_.ql-editor_h1]:text-2xl [&_.ql-editor_h1]:font-bold [&_.ql-editor_h2]:text-xl [&_.ql-editor_h2]:font-bold [&_.ql-editor_h3]:text-lg [&_.ql-editor_h3]:font-semibold [&_.ql-editor_p]:mb-4 [&_.ql-editor_strong]:font-bold [&_.ql-editor_em]:italic [&_.ql-editor_iframe]:rounded-lg [&_.ql-editor_iframe]:my-4 [&_.ql-editor_iframe]:w-full [&_.ql-editor_iframe]:aspect-video [&_.ql-editor_.ql-video]:w-full [&_.ql-editor_.ql-video]:aspect-video [&_.ql-editor_.ql-video]:my-4 [&_.ql-editor_.ql-video]:rounded-lg [&_.ql-editor_.ad-slot-marker]:bg-orange-100 [&_.ql-editor_.ad-slot-marker]:text-orange-700 [&_.ql-editor_.ad-slot-marker]:font-bold [&_.ql-editor_.ad-slot-marker]:text-center [&_.ql-editor_.ad-slot-marker]:border-2 [&_.ql-editor_.ad-slot-marker]:border-dashed [&_.ql-editor_.ad-slot-marker]:border-orange-400 [&_.ql-editor_.ad-slot-marker]:py-3 [&_.ql-editor_.ad-slot-marker]:rounded [&_.ql-editor_.article-divider]:my-6 [&_.ql-editor_.article-divider]:border-t-2 [&_.ql-editor_.article-divider]:border-gray-300"
        />
      </div>
      
      {/* Video Manager - shows delete buttons for embedded videos */}
      {videoElements.length > 0 && (
        <div className="mt-2 p-2 bg-gray-100 rounded-lg border border-gray-300">
          <div className="text-xs font-semibold text-gray-600 mb-2">Embedded Videos ({videoElements.length})</div>
          <div className="flex flex-wrap gap-2">
            {videoElements.map((iframe, index) => {
              const src = iframe.getAttribute('src') || '';
              const isYouTube = src.includes('youtube');
              const isVimeo = src.includes('vimeo');
              const videoId = src.match(/embed\/([^?]+)/)?.[1] || src.match(/video\/(\d+)/)?.[1] || 'video';
              return (
                <div key={index} className="flex items-center gap-2 bg-white px-2 py-1.5 rounded border border-gray-200">
                  <span className="text-xs text-gray-600">
                    {isYouTube ? '▶ YouTube' : isVimeo ? '▶ Vimeo' : '▶ Video'}: {videoId.slice(0, 8)}...
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteVideo(iframe)}
                    className="px-2 py-0.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
        <span className="font-semibold">Enter</span> = new paragraph ·{" "}
        <span className="font-semibold">Shift+Enter</span> = soft line break ·{" "}
        Use <span className="font-semibold text-orange-400">Video</span> /{" "}
        <span className="font-semibold text-orange-400">Ad Slot</span> /{" "}
        <span className="font-semibold text-orange-400">Divider</span> buttons to embed rich content.
      </p>
    </div>
  );
}

// Convert YouTube/Vimeo URL to embed URL
function toEmbedUrl(url: string): string | null {
  // YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  // Vimeo
  const vmMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vmMatch) return `https://player.vimeo.com/video/${vmMatch[1]}`;

  // If already an embed URL, return as-is
  if (url.includes("/embed/") || url.includes("player.vimeo.com")) return url;

  return null;
}
