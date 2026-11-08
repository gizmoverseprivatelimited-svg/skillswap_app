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
  console.log('🖼️ [resolveImageUrl] Input path:', cleanPath);
  console.log('🖼️ [resolveImageUrl] Base url:', url);
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
 const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  const formattedPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;

  const finalUrl = `${baseUrl}${formattedPath}`;
  console.log('🖼️ [resolveImageUrl] Final Result URL:', finalUrl);

  return finalUrl;
}
