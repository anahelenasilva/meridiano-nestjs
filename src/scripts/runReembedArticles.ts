import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';

import { AiService } from '../ai/ai.service';
import { AppModule } from '../app.module';
import { ArticlesService } from '../articles/articles.service';

dotenv.config();

// Re-embeds every processed article with the current EMBEDDING_MODEL. Run it after
// switching models so all stored vectors share one space. Safe to rerun.
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ai = app.get(AiService);
  const articles = app.get(ArticlesService);

  const rows = await articles.getArticlesToReembed();
  console.log(`Re-embedding ${rows.length} articles`);

  const failed: string[] = [];
  for (const [i, row] of rows.entries()) {
    try {
      const embedding = await ai.getEmbedding(row.processed_content);
      if (!embedding) {
        throw new Error('empty processed_content');
      }
      await articles.updateArticleEmbedding(row.id, embedding);
    } catch (error) {
      failed.push(row.id);
      console.error(
        `Failed ${row.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if ((i + 1) % 100 === 0) {
      console.log(`${i + 1}/${rows.length}`);
    }
  }

  console.log(
    `Done. ${rows.length - failed.length} updated, ${failed.length} failed.`,
  );
  if (failed.length > 0) {
    console.log(`Failed ids:\n${failed.join('\n')}`);
  }

  await app.close();
  process.exitCode = failed.length > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
