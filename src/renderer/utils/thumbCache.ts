import { createQueue } from './asyncQueue';

const api = window.api;

// Increase concurrent thumbnail generations for better performance
const queue = createQueue(6);

// In-memory cache for thumbnails
const inMemoryCache = new Map<string, string>();

export function getCachedThumbnailPath(videoPath: string): string | undefined {
  return inMemoryCache.get(videoPath);
}

// Track pending requests to avoid duplicate fetches
const pendingRequests = new Map<string, Promise<string>>();

// Priority queue for visible thumbnails
let highPriorityPaths = new Set<string>();

export async function getThumbnailFor(videoPath: string, priority: 'high' | 'normal' = 'normal'): Promise<string> {
  if (!videoPath) return '';

  // Check cache first
  const cached = inMemoryCache.get(videoPath);
  if (cached) return cached;

  // If already pending, return the existing promise
  const pending = pendingRequests.get(videoPath);
  if (pending) return pending;

  // Mark as high priority if requested
  if (priority === 'high') {
    highPriorityPaths.add(videoPath);
  }

  // Create new request
  const request = queue.add(async () => {
    try {
      const out = await api.getCachedThumbnail(videoPath);
      const result = typeof out === 'string' ? out : '';

      if (result) {
        inMemoryCache.set(videoPath, result);
      }

      return result;
    } finally {
      // Clean up
      pendingRequests.delete(videoPath);
      highPriorityPaths.delete(videoPath);
    }
  });

  // Store pending request
  pendingRequests.set(videoPath, request);

  return request;
}

// Preload thumbnails for visible items
export function preloadThumbnails(videoPaths: string[]): void {
  videoPaths.forEach(path => {
    if (!inMemoryCache.has(path) && !pendingRequests.has(path)) {
      getThumbnailFor(path, 'high');
    }
  });
}

// Clear cache if needed
export function clearThumbnailCache(): void {
  inMemoryCache.clear();
  pendingRequests.clear();
  highPriorityPaths.clear();
}


