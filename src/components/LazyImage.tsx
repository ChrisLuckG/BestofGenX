"use client";

import { useState, useRef, useEffect } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * URLs that have finished loading at least once in this session.
 *
 * Without it, any remount of the surrounding card resets `isInView`/`isLoaded`,
 * which drops the img back to the grey placeholder and replays the 300ms fade.
 * That is the thumbnail flicker in the feed: the card components in WelcomeReel
 * are declared inside the page component, so every parent render (a reactions
 * fetch, a coin update, scroll state) creates new component types and React
 * remounts the whole subtree. The browser still holds the bytes, so a URL we
 * have already shown can go straight to full opacity with no placeholder step.
 *
 * Module scope on purpose - it has to outlive the component instances.
 */
const loadedSrcs = new Set<string>();

export default function LazyImage({ 
  src, 
  alt, 
  className = '', 
  style,
  placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3Crect fill="%23f3f4f6"/%3E%3C/svg%3E',
  onLoad,
  onError
}: LazyImageProps) {
  const seen = loadedSrcs.has(src);
  // Seeded from the cache so a known image never starts hidden
  const [isLoaded, setIsLoaded] = useState(seen);
  const [isInView, setIsInView] = useState(seen);
  const imgRef = useRef<HTMLImageElement>(null);

  // Keep state honest when the src changes on an already mounted element
  // (index-keyed lists reuse the same DOM node for a different article).
  useEffect(() => {
    if (loadedSrcs.has(src)) {
      setIsInView(true);
      setIsLoaded(true);
    } else {
      setIsLoaded(false);
    }
  }, [src]);

  useEffect(() => {
    // Already known - no observer needed, it is displayed immediately
    if (loadedSrcs.has(src)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' } // Start loading 100px before visible
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [src]);

  return (
    <img
      ref={imgRef}
      src={isInView ? src : placeholder}
      alt={alt}
      className={`${className} transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
      style={style}
      onLoad={() => {
        // Only the real image counts - the placeholder fires onLoad too, and
        // recording that would make the next mount skip loading altogether.
        if (isInView) {
          loadedSrcs.add(src);
          setIsLoaded(true);
        }
        onLoad?.();
      }}
      onError={onError}
      loading="lazy"
    />
  );
}
