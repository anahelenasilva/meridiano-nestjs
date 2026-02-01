/**
 * Extract video ID from various YouTube URL formats
 * @param url - The YouTube URL
 * @returns The video ID or null if not found
 *
 * Supported formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 */
export function extractVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '').replace('m.', '');

    // Format: https://www.youtube.com/watch?v=VIDEO_ID
    if (hostname === 'youtube.com' && urlObj.pathname === '/watch') {
      return urlObj.searchParams.get('v');
    }

    // Format: https://youtu.be/VIDEO_ID
    if (hostname === 'youtu.be') {
      return urlObj.pathname.slice(1).split('?')[0];
    }

    // Format: https://www.youtube.com/embed/VIDEO_ID or https://www.youtube.com/v/VIDEO_ID
    if (hostname === 'youtube.com' && (urlObj.pathname.startsWith('/embed/') || urlObj.pathname.startsWith('/v/'))) {
      const pathParts = urlObj.pathname.split('/');
      return pathParts[2] || null;
    }

    return null;
  } catch (error) {
    console.error('Error extracting video ID:', error);
    console.error('URL:', url);
    return null;
  }
}
