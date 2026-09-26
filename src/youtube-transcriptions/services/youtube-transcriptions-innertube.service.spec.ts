import {
  parseTimedTextXml,
  pickCaptionTrack,
} from './youtube-transcriptions-innertube.service';

describe('parseTimedTextXml', () => {
  it('parses the <p t d> millisecond format, stripping inner tags', () => {
    const xml = `<timedtext><body>
      <p t="0" d="1500"><s>Hello</s> <s>there</s></p>
      <p t="1500" d="2000">General Kenobi</p>
    </body></timedtext>`;

    expect(parseTimedTextXml(xml)).toEqual([
      { text: 'Hello there', offset: 0, duration: 1500 },
      { text: 'General Kenobi', offset: 1500, duration: 2000 },
    ]);
  });

  it('parses the <text start dur> seconds format into milliseconds', () => {
    const xml = `<transcript>
      <text start="0.5" dur="1.25">first</text>
      <text start="1.75" dur="2">second</text>
    </transcript>`;

    expect(parseTimedTextXml(xml)).toEqual([
      { text: 'first', offset: 500, duration: 1250 },
      { text: 'second', offset: 1750, duration: 2000 },
    ]);
  });

  it('decodes HTML entities and drops segments with no text', () => {
    const xml = `<p t="0" d="100">rock &amp; roll &#39;n&#39; &quot;more&quot;</p>
      <p t="100" d="100">   </p>`;

    expect(parseTimedTextXml(xml)).toEqual([
      { text: `rock & roll 'n' "more"`, offset: 0, duration: 100 },
    ]);
  });

  it('returns no segments for xml in neither format', () => {
    expect(parseTimedTextXml('<html>blocked</html>')).toEqual([]);
  });
});

describe('pickCaptionTrack', () => {
  const asrEnglish = { language_code: 'en', kind: 'asr', base_url: 'asr-en' };
  const manualEnglish = { language_code: 'en', base_url: 'manual-en' };
  const britishEnglish = { language_code: 'en-GB', base_url: 'en-gb' };
  const portuguese = { language_code: 'pt', base_url: 'pt' };

  it('prefers a manual English track over an auto-generated one', () => {
    expect(pickCaptionTrack([asrEnglish, manualEnglish])).toBe(manualEnglish);
  });

  it('falls back to any English variant', () => {
    expect(pickCaptionTrack([portuguese, britishEnglish])).toBe(britishEnglish);
  });

  it('falls back to the first track when none is English', () => {
    expect(pickCaptionTrack([portuguese])).toBe(portuguese);
  });
});
