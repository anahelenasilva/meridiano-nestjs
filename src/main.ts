import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';
import { AppModule } from './app.module';

// Load environment variables from .env file
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 Meridiano API server running on http://localhost:${port}`);
  console.log(`📊 API endpoints:`);
  console.log(`   GET /api/briefings - List briefings`);
  console.log(`   GET /api/briefings/:id - Get briefing details`);
  console.log(`   GET /api/articles - List articles`);
  console.log(`   GET /api/articles/:id - Get article details`);
  console.log(`   GET /api/profiles - Get available feed profiles`);
  console.log(`   GET /api/youtube/transcriptions - List youtube transcriptions`);
  console.log(`   GET /api/youtube/transcriptions/:id - Get youtube transcription details`);
  console.log(`   GET /api/health - Health check`);
}

void bootstrap();
