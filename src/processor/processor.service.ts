import { AudioJobService } from '@libs/audio';
import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { ArticleCategory, DBArticle } from '../articles/article.entity';
import { ArticlesService } from '../articles/articles.service';
import { ConfigService } from '../config/config.service';
import { ProfilesService } from '../profiles/profiles.service';
import { ProcessingStats } from '../shared/types/ai';
import { FeedProfile } from '../shared/types/feed';

@Injectable()
export class ProcessorService {
  private readonly logger = new Logger(ProcessorService.name);

  constructor(
    private readonly articlesService: ArticlesService,
    private readonly aiService: AiService,
    private readonly configService: ConfigService,
    private readonly profilesService: ProfilesService,
    private readonly audioJobService: AudioJobService,
  ) {
    this.logger.debug('ProcessorService constructor called');
    this.logger.debug(`articlesService: ${typeof this.articlesService}`);
    this.logger.debug(`aiService: ${typeof this.aiService}`);
    this.logger.debug(`configService: ${typeof this.configService}`);
    this.logger.debug(`profilesService: ${typeof this.profilesService}`);
    this.logger.debug(`audioJobService: ${typeof this.audioJobService}`);
  }

  async processArticles(
    feedProfile: FeedProfile,
    limit: number = 1000,
    articleId?: string,
    generateAudio?: boolean,
  ): Promise<ProcessingStats> {
    // console.log('\n--- Starting Article Processing ---');

    const stats: ProcessingStats = {
      feedProfile,
      articlesProcessed: 0,
      articlesRated: 0,
      articlesCategorized: 0,
      errors: 0,
      startTime: new Date(),
    };

    let unprocessedArticles: DBArticle[] = [];
    if (articleId) {
      const article =
        await this.articlesService.getUnprocessedArticleById(articleId);
      unprocessedArticles = article ? [article] : [];
    } else {
      unprocessedArticles =
        await this.articlesService.getUnprocessedArticles(feedProfile, limit);
    }

    if (unprocessedArticles.length === 0) {
      console.log('No new articles to process.');
      stats.endTime = new Date();
      return stats;
    }

    console.log(`Found ${unprocessedArticles.length} articles to process.`);

    const profilePrompts =
      this.profilesService.getPromptsForProfile(feedProfile);

    for (const article of unprocessedArticles) {
      console.log(
        `Processing article ID: ${article.id} - ${article.title}...`,
      );

      try {
        const summaryPrompt = profilePrompts.articleSummary
          ? this.configService.formatPrompt(profilePrompts.articleSummary, {
            article_content: article.raw_content.substring(0, 4000),
          })
          : this.configService.getArticleSummaryPrompt(
            article.raw_content.substring(0, 4000),
          );

        const summary = await this.aiService.callDeepseekChat(summaryPrompt);

        if (!summary) {
          console.log(
            `Skipping article ${article.id} due to summarization error.`,
          );
          stats.errors++;
          continue;
        }

        const finalSummary = `${summary}\n\nSource: [${article.title}](${article.url})`;

        const embedding = await this.aiService.getEmbedding(finalSummary);

        if (!embedding) {
          console.log(`Skipping article ${article.id} due to embedding error.`);
          stats.errors++;
          continue;
        }

        await this.articlesService.updateArticleProcessing(
          article.id,
          finalSummary,
          embedding,
        );
        stats.articlesProcessed++;
        console.log(`Successfully processed article ID: ${article.id}`);

        // Generate audio if flag is enabled
        if (generateAudio) {
          try {
            console.log(`Enqueuing audio generation for article ID: ${article.id}...`);
            const jobInfo = await this.audioJobService.enqueueAudioJob({
              sourceType: 'article',
              sourceId: article.id,
              text: summary,
              date: article.published_date ? new Date(article.published_date) : new Date(),
            });
            console.log(`Audio generation job enqueued: ${jobInfo.jobId}`);
          } catch (audioError) {
            console.error(`Error enqueuing audio generation for article ID: ${article.id}:`, audioError);
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error processing article ${article.id}:`, error);
        stats.errors++;
      }
    }

    stats.endTime = new Date();
    console.log(
      `--- Processing Finished. Processed ${stats.articlesProcessed} articles. ---`,
    );

    return stats;
  }

  async rateArticles(
    feedProfile: FeedProfile,
    limit: number = 1000,
    articleId?: string,
  ): Promise<ProcessingStats> {
    const stats: ProcessingStats = {
      feedProfile,
      articlesProcessed: 0,
      articlesRated: 0,
      articlesCategorized: 0,
      errors: 0,
      startTime: new Date(),
    };

    let unratedArticles: DBArticle[] = [];
    if (articleId) {
      const article =
        await this.articlesService.getUnratedArticleById(articleId);
      unratedArticles = article ? [article] : [];
    } else {
      unratedArticles = await this.articlesService.getUnratedArticles(
        feedProfile,
        limit,
      );
    }

    if (unratedArticles.length === 0) {
      console.log('No new articles to rate.');
      stats.endTime = new Date();
      return stats;
    }

    console.log(`Found ${unratedArticles.length} processed articles to rate.`);

    const profilePrompts =
      this.profilesService.getPromptsForProfile(feedProfile);

    for (const article of unratedArticles) {
      console.log(`Rating article ID: ${article.id}: ${article.title}...`);

      if (!article.processed_content) {
        console.log(`  Skipping article ${article.id} - no summary found.`);
        continue;
      }

      try {
        const ratingPrompt = profilePrompts.impactRating
          ? this.configService.formatPrompt(profilePrompts.impactRating, {
            summary: article.processed_content,
          })
          : this.configService.getImpactRatingPrompt(article.processed_content);

        const ratingResponse =
          await this.aiService.callDeepseekChat(ratingPrompt);

        if (ratingResponse) {
          try {
            const scoreMatch = ratingResponse.trim().match(/\d+/);
            if (scoreMatch) {
              const score = parseInt(scoreMatch[0], 10);

              if (this.configService.isValidImpactRating(score)) {
                await this.articlesService.updateArticleRating(
                  article.id,
                  score,
                );
                stats.articlesRated++;
              } else {
                console.log(
                  `  Warning: Rating ${score} for article ${article.id} is out of range (1-10).`,
                );
                stats.errors++;
              }
            } else {
              console.log(
                `  Warning: Could not extract numeric rating from response '${ratingResponse}' for article ${article.id}.`,
              );
              stats.errors++;
            }
          } catch (error) {
            console.error(`Error rating article ${article.id}:`, error);
            console.log(
              `  Warning: Could not parse rating from response '${ratingResponse}' for article ${article.id}.`,
            );
            stats.errors++;
          }
        } else {
          console.log(
            `  Warning: No rating response received for article ${article.id}.`,
          );
          stats.errors++;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error rating article ${article.id}:`, error);
        stats.errors++;
      }
    }

    stats.endTime = new Date();
    console.log(
      `--- Rating Finished. Rated ${stats.articlesRated} articles. ---`,
    );

    return stats;
  }

  async categorizeArticles(
    feedProfile: FeedProfile,
    limit: number = 1000,
    articleId?: string,
  ): Promise<ProcessingStats> {
    const stats: ProcessingStats = {
      feedProfile,
      articlesProcessed: 0,
      articlesRated: 0,
      articlesCategorized: 0,
      errors: 0,
      startTime: new Date(),
    };

    let uncategorizedArticles: DBArticle[] = [];
    if (articleId) {
      const article =
        await this.articlesService.getUncategorizedArticleById(articleId);
      uncategorizedArticles = article ? [article] : [];
    } else {
      uncategorizedArticles =
        await this.articlesService.getUncategorizedArticles(feedProfile, limit);
    }

    if (uncategorizedArticles.length === 0) {
      console.log('No new articles to categorize.');
      stats.endTime = new Date();
      return stats;
    }

    console.log(
      `Found ${uncategorizedArticles.length} processed articles to categorize.`,
    );

    for (const article of uncategorizedArticles) {
      if (!article.processed_content) {
        console.log(
          `  Skipping article ${article.id} - no processed content found.`,
        );
        continue;
      }

      try {
        const categoryPrompt =
          this.configService.getCategoryClassificationPrompt(
            article.title,
            article.processed_content.substring(0, 2000),
          );

        const categoryResponse =
          await this.aiService.callDeepseekChat(categoryPrompt);

        if (categoryResponse) {
          try {
            const categories = JSON.parse(
              categoryResponse.trim(),
            ) as ArticleCategory[];

            if (Array.isArray(categories) && categories.length > 0) {
              const validCategories = categories.filter((cat) =>
                Object.values(ArticleCategory).includes(cat),
              );

              if (validCategories.length > 0) {
                await this.articlesService.updateArticleCategories(
                  article.id,
                  validCategories,
                );
                stats.articlesCategorized++;
              } else {
                console.log(
                  `  Warning: No valid categories found in response for article ${article.id}.`,
                );
                await this.articlesService.updateArticleCategories(article.id, [
                  ArticleCategory.OTHER,
                ]);
                stats.articlesCategorized++;
              }
            } else {
              console.log(
                `  Warning: Invalid category array format for article ${article.id}.`,
              );
              await this.articlesService.updateArticleCategories(article.id, [
                ArticleCategory.OTHER,
              ]);
              stats.articlesCategorized++;
            }
          } catch (parseError) {
            console.error(
              `Error parsing category response for article ${article.id}:`,
              parseError,
            );
            console.log(
              `  Warning: Could not parse category response '${categoryResponse}' for article ${article.id}.`,
            );
            await this.articlesService.updateArticleCategories(article.id, [
              ArticleCategory.OTHER,
            ]);
            stats.articlesCategorized++;
          }
        } else {
          console.log(
            `  Warning: No category response received for article ${article.id}.`,
          );
          await this.articlesService.updateArticleCategories(article.id, [
            ArticleCategory.OTHER,
          ]);
          stats.articlesCategorized++;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error categorizing article ${article.id}:`, error);
        stats.errors++;
      }
    }

    stats.endTime = new Date();
    console.log(
      `--- Categorization Finished. Categorized ${stats.articlesCategorized} articles. ---`,
    );

    return stats;
  }
}
