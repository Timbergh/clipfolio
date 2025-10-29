import { createQueue } from './asyncQueue';

const api = window.api;

// Increase concurrent thumbnail generations for better performance
const queue = createQueue(6);

// In-memory cache for thumbnails
const inMemoryCache = new Map<string, string>();

// Generate cache key that includes trim data
function getCacheKey(videoPath: string, trimStart?: number, trimEnd?: number): string {
  if (trimStart !== undefined && trimEnd !== undefined) {
    return `${videoPath}|${trimStart}|${trimEnd}`;
  }
  return videoPath;
}

export function getCachedThumbnailPath(videoPath: string, trimStart?: number, trimEnd?: number): string | undefined {
  return inMemoryCache.get(getCacheKey(videoPath, trimStart, trimEnd));
}

// Track pending requests to avoid duplicate fetches
const pendingRequests = new Map<string, Promise<string>>();

// Priority queue for visible thumbnails
let highPriorityPaths = new Set<string>();

export async function getThumbnailFor(
  videoPath: string,
  priority: 'high' | 'normal' = 'normal',
  duration?: number,
  trimStart?: number,
  trimEnd?: number
): Promise<string> {
  if (!videoPath) return '';

  const cacheKey = getCacheKey(videoPath, trimStart, trimEnd);

  // Check cache first
  const cached = inMemoryCache.get(cacheKey);
  if (cached) return cached;

  // If already pending, return the existing promise
  const pending = pendingRequests.get(cacheKey);
  if (pending) return pending;

  // Mark as high priority if requested
  if (priority === 'high') {
    highPriorityPaths.add(videoPath);
  }

  // Create new request
  const request = queue.add(async () => {
    try {
      const out = await api.getCachedThumbnail(videoPath, duration, trimStart, trimEnd);
      const result = typeof out === 'string' ? out : '';

      if (result) {
        inMemoryCache.set(cacheKey, result);
      }

      return result;
    } finally {
      // Clean up
      pendingRequests.delete(cacheKey);
      highPriorityPaths.delete(videoPath);
    }
  });

  // Store pending request
  pendingRequests.set(cacheKey, request);

  return request;
}

// Preload thumbnails for visible items
export function preloadThumbnails(
  videos: Array<{ path: string; duration?: number; trimStart?: number; trimEnd?: number }>
): void {
  videos.forEach(video => {
    const cacheKey = getCacheKey(video.path, video.trimStart, video.trimEnd);
    if (!inMemoryCache.has(cacheKey) && !pendingRequests.has(cacheKey)) {
      getThumbnailFor(video.path, 'high', video.duration, video.trimStart, video.trimEnd);
    }
  });
}

// Clear cache if needed
export function clearThumbnailCache(): void {
  inMemoryCache.clear();
  pendingRequests.clear();
  highPriorityPaths.clear();
}


