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
    .replace(/\s+/g, ' ')
    .trim();
}
