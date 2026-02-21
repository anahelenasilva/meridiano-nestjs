import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedYoutubeChannels1767438279000 implements MigrationInterface {
  name = 'SeedYoutubeChannels1767438279000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Seed channels from the original channels.config.ts
    await queryRunner.query(`
      INSERT INTO youtube_channels (channel_id, name, url, description, enabled)
      VALUES
        (
          'UCbRP3c757lWg9M-U7TyEkXA',
          'Theo Browne',
          'https://www.youtube.com/feeds/videos.xml?channel_id=UCbRP3c757lWg9M-U7TyEkXA',
          'Theo is a software dev, AI nerd, TypeScript sympathizer, creator of T3 Chat and the T3 Stack.',
          true
        ),
        (
          'UC-lHJZR3Gqxm24_Vd_AJ5Yw',
          'PewDiePie',
          'https://www.youtube.com/feeds/videos.xml?channel_id=UC-lHJZR3Gqxm24_Vd_AJ5Yw',
          'PewDiePie is a Swedish YouTuber who is known for his comedic videos and gaming content.',
          false
        ),
        (
          'UCQM428Hwrvxla8DCgjGONSQ',
          'JavaScript Conferences by GitNation',
          'https://www.youtube.com/feeds/videos.xml?channel_id=UCQM428Hwrvxla8DCgjGONSQ',
          'Channel of the JavaScript-related family of conferences from GitNation. We organize JavaScript events for a bigger cause — we want the modern tech community to become a better place for developers and enthusiasts alike by encouraging professional growth opportunities, skills evolution, and nurturing the passion for the craft.',
          false
        ),
        (
          'UCLW51-XEzuOm5RwPMChHBMw',
          'Augusto Galego',
          'https://www.youtube.com/feeds/videos.xml?channel_id=UCLW51-XEzuOm5RwPMChHBMw',
          'Augusto Galego channel',
          false
        )
      ON CONFLICT (channel_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the seeded channels
    await queryRunner.query(`
      DELETE FROM youtube_channels
      WHERE channel_id IN (
        'UCbRP3c757lWg9M-U7TyEkXA',
        'UC-lHJZR3Gqxm24_Vd_AJ5Yw',
        'UCQM428Hwrvxla8DCgjGONSQ',
        'UCLW51-XEzuOm5RwPMChHBMw'
      )
    `);
  }
}
