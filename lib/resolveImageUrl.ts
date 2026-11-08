import url from '@/constants/backurl';

/**
 * Resolves an image URL to a fully-qualified URI.
 *
 * - If the path starts with `http://`, `https://`, `data:`, `file://`, or `blob:`, return as-is.
 * - If the path starts with `/uploads` or `uploads/` or relative path, prepends the API base URL.
 * - Handles Windows backslashes and whitespace.
 * - If the path is falsy, returns the provided fallback.
 */
export function resolveImageUrl(
  path: string | null | undefined,
  fallback?: string,
): string | undefined {
  if (!path || typeof path !== 'string' || path.trim() === '') {
    return fallback || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
  }

  const cleanPath = path.trim().replace(/\\/g, '/');

  // Already a full URL, data URI, blob, or file URI
  if (
    cleanPath.startsWith('http://') ||
    cleanPath.startsWith('https://') ||
    cleanPath.startsWith('data:') ||
    cleanPath.startsWith('file://') ||
    cleanPath.startsWith('blob:') ||
    cleanPath.startsWith('content://')
  ) {
    return cleanPath;
  }

  // Prepend API base URL for server uploads or relative paths
  if (cleanPath.startsWith('/uploads')) {
    return `${url}${cleanPath}`;
  }

  if (cleanPath.startsWith('uploads/')) {
    return `${url}/${cleanPath}`;
  }

  if (cleanPath.startsWith('/')) {
    return `${url}${cleanPath}`;
  }

  return `${url}/${cleanPath}`;
}

