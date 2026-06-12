/**
 * Media utility functions for handling images and videos
 */

/**
 * Check if a URL points to a video file
 * Supports: .mp4, .webm, .mov, and URLs containing 'video'
 */
export function isVideoUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('.mp4') ||
    lower.includes('.webm') ||
    lower.includes('.mov') ||
    lower.includes('/video') ||
    lower.includes('video/')
  );
}

/**
 * Get the appropriate HTML element type for a media URL
 */
export function getMediaType(url: string | undefined | null): 'video' | 'image' | null {
  if (!url) return null;
  return isVideoUrl(url) ? 'video' : 'image';
}
