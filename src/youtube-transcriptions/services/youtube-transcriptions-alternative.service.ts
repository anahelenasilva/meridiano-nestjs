import { Injectable } from '@nestjs/common';
import { YoutubeTranscript } from 'youtube-transcript-plus';
import { TranscriptItem } from '../../shared/types/video';

interface FetchTranscriptOptions {
  keepBrackets?: boolean;
}

interface CleanOptions {
  keepBrackets?: boolean;
}

@Injectable()
export class YoutubeTranscriptionsAlternativeService {
  isYouTubeUrl(url: string): boolean {
    return /(^https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(url);
  }

  extractYouTubeId(input: string): string | null {
    if (!input) return null;
    const raw = String(input).trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
    const m = raw.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  private decodeHtmlEntities(input: string): string {
    if (!input) return input;
    let text = input;
    for (let i = 0; i < 2; i++) {
      const decoded = text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
          String.fromCodePoint(parseInt(hex, 16)),
        );
      if (decoded === text) break;
      text = decoded;
    }
    return text;
  }

  private cleanSegments(segments: string[], options?: CleanOptions): string[] {
    const cleaned: string[] = [];
    let prev = '';

    for (const seg of segments) {
      const s = String(seg || '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!s) continue;

      const withoutTags = s.replace(/<[^>]+>/g, '').trim();
      const withoutBrackets = options?.keepBrackets
        ? withoutTags
        : withoutTags.replace(/\[[^\]]*\]/g, '').trim();
      const withoutCurlies = withoutBrackets
        .replace(/\{[^}]+\}/g, '')
        .replace(/♪/g, '')
        .trim();
      const t = withoutCurlies.replace(/\s+/g, ' ').trim();

      if (!t) continue;
      if (t === prev) continue;
      if (prev && t.startsWith(prev)) {
        const newPart = t.slice(prev.length).trim();
        if (newPart) cleaned.push(newPart);
      } else if (prev && t.includes(prev)) {
        const idx = t.indexOf(prev);
        const newPart = (t.slice(0, idx) + t.slice(idx + prev.length)).trim();
        if (newPart) cleaned.push(newPart);
      } else {
        cleaned.push(t);
      }

      prev = t;
    }

    return cleaned;
  }

  private toParagraph(segments: string[], options?: CleanOptions): string {
    const cleaned = this.cleanSegments(segments, options);
    return cleaned.join(' ').replace(/\s+/g, ' ').trim();
  }

  async fetchTranscript(videoId: string): Promise<TranscriptItem[]> {
    const id = this.extractYouTubeId(videoId);
    if (!id) {
      throw new Error(`Invalid YouTube video ID: ${videoId}`);
    }

    const transcript = await YoutubeTranscript.fetchTranscript(id);

    return transcript.map((entry) => {
      const decodedText = this.decodeHtmlEntities(entry.text);
      return {
        text: decodedText,
        duration: entry.duration ?? 0,
        offset: entry.offset,
      };
    });
  }

  async fetchTranscriptAsText(
    videoId: string,
    options?: FetchTranscriptOptions,
  ): Promise<string> {
    const transcript = await this.fetchTranscript(videoId);
    const segments = transcript.map((item) => item.text);
    const paragraph = this.toParagraph(segments, {
      keepBrackets: options?.keepBrackets,
    });

    if (!paragraph) {
      throw new Error('Empty transcript');
    }

    return paragraph;
  }
}
