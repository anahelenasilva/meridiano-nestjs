import { vttToText } from './vtt-to-text';

describe('vttToText', () => {
  it('keeps only cue text, dropping the header, notes, identifiers and timings', () => {
    const vtt = [
      'WEBVTT',
      '',
      'NOTE produced by rss.com',
      '',
      '1',
      '00:00:00.280 --> 00:00:04.560',
      "Hi, I'm Maggie.",
      '',
      '00:00:05.520 --> 00:00:07.680',
      'A few years ago, one of my some days came.',
    ].join('\n');

    expect(vttToText(vtt)).toBe(
      "Hi, I'm Maggie. A few years ago, one of my some days came.",
    );
  });

  it('joins multi-line cues and collapses whitespace', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:08.120 --> 00:00:11.215',
      'I gave up my apartment,',
      '   sold most of my things, and started',
    ].join('\n');

    expect(vttToText(vtt)).toBe(
      'I gave up my apartment, sold most of my things, and started',
    );
  });

  it('handles CRLF line endings and strips voice tags', () => {
    const vtt =
      'WEBVTT\r\n\r\n00:00:01.000 --> 00:00:02.000\r\n<v Maggie>Welcome back.</v>\r\n';

    expect(vttToText(vtt)).toBe('Welcome back.');
  });

  it.each([
    ['empty input', ''],
    ['a header with no cues', 'WEBVTT\n\nNOTE nothing here\n'],
  ])('returns an empty string for %s', (_label, vtt) => {
    expect(vttToText(vtt)).toBe('');
  });
});
