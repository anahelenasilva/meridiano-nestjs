// WebVTT cue text must escape these; direction marks carry nothing readable.
const CHARACTER_REFERENCES = new Map([
  ['&amp;', '&'],
  ['&lt;', '<'],
  ['&gt;', '>'],
  ['&nbsp;', ' '],
  ['&lrm;', ''],
  ['&rlm;', ''],
]);

/**
 * Flattens a WebVTT transcript into one line of spoken text. Only lines after a
 * cue's timing line are speech; the header, NOTE, STYLE and REGION blocks have
 * no timing line, so they drop out.
 */
export function vttToText(vtt: string): string {
  return vtt
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .flatMap((block) => {
      const lines = block.split('\n');
      const timingIndex = lines.findIndex((line) => line.includes('-->'));
      return timingIndex === -1 ? [] : lines.slice(timingIndex + 1);
    })
    .join(' ')
    .replace(/<[^>]+>/g, '')
    .replace(
      /&[a-z]+;/g,
      (reference) => CHARACTER_REFERENCES.get(reference) ?? reference,
    )
    .replace(/\s+/g, ' ')
    .trim();
}
