import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Folds the feed_source values that drifted away from RSSFeed.name (the
 * scraper used to store the publisher's feed <title>) onto the names in
 * src/shared/feeds/*.ts, so the source filter shows one entry per publication.
 *
 * Measured against prod on 2026-08-30: 15 values, 1,748 rows. Exact matches
 * only. The trailing space in "Latest from Tom's Hardware " is real; keep it.
 * "S3 Upload" is a documented legacy sentinel (ADR-0003) and is not touched.
 */
const FEED_SOURCE_RENAMES: ReadonlyArray<{ from: string; to: string }> = [
  { from: 'Tech - South China Morning Post', to: 'South China Morning Post' },
  { from: 'World - South China Morning Post', to: 'South China Morning Post' },
  {
    from: 'Americas - South China Morning Post',
    to: 'South China Morning Post',
  },
  {
    from: 'Middle East - South China Morning Post',
    to: 'South China Morning Post',
  },
  {
    from: 'Science & Research - South China Morning Post',
    to: 'South China Morning Post',
  },
  {
    from: 'Big Tech - South China Morning Post',
    to: 'South China Morning Post',
  },
  {
    from: 'Innovation - South China Morning Post',
    to: 'South China Morning Post',
  },
  { from: 'philschmid.de - RSS feed', to: 'Philipp Schmid' },
  { from: 'TLDR RSS Feed', to: 'TLDR Feed' },
  { from: 'AkitaOnRails.com', to: 'Fabio Akita' },
  { from: 'AkitaOnRails', to: 'Fabio Akita' },
  { from: "Latest from Tom's Hardware ", to: "Tom's Hardware" },
  { from: 'Elevate', to: 'Elevate by Addy Osmani' },
  { from: 'Irrational Exuberance', to: 'Will Larson' },
  { from: 'AI Hero Skills', to: 'AI Hero' },
];

export class NormalizeFeedSources1790000000000 implements MigrationInterface {
  name = 'NormalizeFeedSources1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { from, to } of FEED_SOURCE_RENAMES) {
      await queryRunner.query(
        `UPDATE articles SET feed_source = $1 WHERE feed_source = $2`,
        [to, from],
      );
    }
  }

  // Seven SCMP sections and two Akita spellings merge into one value each, so
  // the old values cannot be rebuilt from the new ones. A partial revert of the
  // one-to-one rows would leave the data in a third state nobody designed for.
  public down(): Promise<void> {
    return Promise.resolve();
  }
}
