"use client";

import { useState, useRef, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ImageZoomModalProps {
  images: string[];
  selectedIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  productName: string;
}

export default function ImageZoomModal({
  images,
  selectedIndex,
  onClose,
  onPrev,
  onNext,
  productName,
}: ImageZoomModalProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTouchDistance = useRef<number | null>(null);

  // Reset zoom when image changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [selectedIndex]);

  // Handle pinch zoom
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      if (lastTouchDistance.current !== null) {
        const delta = distance - lastTouchDistance.current;
        const newScale = Math.min(Math.max(scale + delta * 0.01, 1), 5);
        setScale(newScale);
        
        // Reset position if zoomed out to 1
        if (newScale === 1) {
          setPosition({ x: 0, y: 0 });
        }
      }
      lastTouchDistance.current = distance;
    } else if (e.touches.length === 1 && scale > 1 && isDragging) {
      // Pan when zoomed in
      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStart.x;
      const deltaY = touch.clientY - dragStart.y;
      setPosition({ x: position.x + deltaX, y: position.y + deltaY });
      setDragStart({ x: touch.clientX, y: touch.clientY });
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      lastTouchDistance.current = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchEnd = () => {
    lastTouchDistance.current = null;
    setIsDragging(false);
  };

  // Mouse wheel zoom for desktop
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    const newScale = Math.min(Math.max(scale + delta, 1), 5);
    setScale(newScale);
    if (newScale === 1) {
      setPosition({ x: 0, y: 0 });
    }
  };

  // Button zoom controls
  const zoomIn = () => setScale(Math.min(scale + 0.5, 5));
  const zoomOut = () => {
    const newScale = Math.max(scale - 0.5, 1);
    setScale(newScale);
    if (newScale === 1) setPosition({ x: 0, y: 0 });
  };
  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Double tap to zoom
  const lastTap = useRef<number>(0);
  const handleDoubleTap = (e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Double tap detected
      if (scale > 1) {
        resetZoom();
      } else {
        setScale(2.5);
      }
    }
    lastTap.current = now;
  };

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black flex flex-col"
      ref={containerRef}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 z-10">
        <button 
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-medium"
        >
          <X className="w-4 h-4" />
          Close
        </button>
        
        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button 
            onClick={zoomOut}
            disabled={scale <= 1}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-white text-sm font-medium min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button 
            onClick={zoomIn}
            disabled={scale >= 5}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          {scale > 1 && (
            <button 
              onClick={resetZoom}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white ml-1"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Image container */}
      <div 
        className="flex-1 flex items-center justify-center overflow-hidden relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        onClick={(e) => {
          if (scale === 1) onClose();
        }}
      >
        {/* Navigation arrows */}
        {images.length > 1 && scale === 1 && (
          <>
            <button 
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white z-10"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white z-10"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          </>
        )}

        {/* Zoomable image */}
        <img 
          src={images[selectedIndex]} 
          alt={productName}
          className="max-w-full max-h-full object-contain select-none"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            cursor: scale > 1 ? 'grab' : 'zoom-in',
          }}
          draggable={false}
          onTouchEnd={handleDoubleTap}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-black/80 flex items-center justify-between">
        {/* Image counter */}
        {images.length > 1 && (
          <div className="text-white text-sm">
            {selectedIndex + 1} / {images.length}
          </div>
        )}
        {images.length <= 1 && <div />}
        
        {/* Hint */}
        <div className="text-white/50 text-xs">
          {scale === 1 ? 'Pinch or scroll to zoom' : 'Drag to pan'}
        </div>
      </div>
    </div>
  );
}
