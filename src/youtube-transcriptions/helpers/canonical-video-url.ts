/**
 * The one URL shape stored in youtube_transcriptions.video_url. Duplicate
 * checks normalize to this so a pasted youtu.be link matches a row saved from
 * video metadata as a watch link.
 */
export function canonicalVideoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
