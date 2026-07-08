import url from '@/constants/backurl';

/**
 * Resolves an image URL to a fully-qualified URI.
 *
 * - If the path starts with `/uploads`, prepend the API base URL.
 * - If the path is already an absolute URL (`http://` or `https://`), return as-is.
 * - If the path is falsy, return the provided fallback (or undefined).
 */
export function resolveImageUrl(
  path: string | null | undefined,
  fallback?: string,
): string | undefined {
  if (!path) return fallback || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80';

  // console.log(path);


  if (path.startsWith('/uploads')) {
    return `${url}${path}`;
  }

  // Already a full URL
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // Local file or other scheme (e.g. file://)
  return path;
}
