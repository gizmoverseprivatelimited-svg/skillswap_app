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
  if (!path) return fallback;

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
