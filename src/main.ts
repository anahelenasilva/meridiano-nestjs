import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';
import { AppModule } from './app.module';

// Load environment variables from .env file (only if not already set)
// This ensures Docker Compose environment variables take precedence
dotenv.config({ override: false });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transform: true, // Automatically transform payloads to DTO instances
    }),
  );

  // Configure CORS
  // If CORS_ORIGINS is set, use it; otherwise allow all origins (for Tailscale/local flexibility)
  const corsOrigins = process.env.CORS_ORIGINS;
  const corsConfig = corsOrigins
    ? {
        origin: corsOrigins.split(',').map((origin) => origin.trim()),
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      }
    : {
        origin: true, // Allow all origins (useful for Tailscale/local network access)
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      };

  app.enableCors(corsConfig);

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Meridiano API server running on http://0.0.0.0:${port}`);
  console.log(`📊 API endpoints:`);
  console.log(`   GET /api/briefings - List briefings`);
  console.log(`   GET /api/briefings/:id - Get briefing details`);
  console.log(`   GET /api/articles - List articles`);
  console.log(`   GET /api/articles/:id - Get article details`);
  console.log(`   GET /api/profiles - Get available feed profiles`);
  console.log(
    `   GET /api/youtube/transcriptions - List youtube transcriptions`,
  );
  console.log(
    `   GET /api/youtube/transcriptions/:id - Get youtube transcription details`,
  );
  console.log(`   GET /api/health - Health check`);
  console.log(`   GET /feeds/articles.xml - Public Articles RSS feed`);
}

void bootstrap();
