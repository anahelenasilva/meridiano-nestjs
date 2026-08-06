# Meridiano: Your Personal Intelligence Briefing System

**AI-powered intelligence briefings, tailored to your interests, built with simple, deployable tech.**
Meridiano cuts through the news noise by scraping configured sources, analyzing stories with AI (summaries, impact ratings), clustering related events, and delivering concise daily briefs via a web interface.

Based on the project of [lfzawacki/meridiano](https://github.com/lfzawacki/meridiano/), that's based on the original project [iliane5/meridian](https://github.com/iliane5/meridian)


## Why It Exists

Inspired by the concept of presidential daily briefings, Meridiano aims to provide similar focused intelligence, personalized for individual users. In an era of information overload, it helps you:

*   Stay informed on key global or specific topical events without drowning in noise.
*   Understand context beyond headlines through AI analysis.
*   Track developing stories via article clustering.
*   Leverage AI for summarization and impact assessment.
*   Maintain control through customizable feed profiles and open-source code.

Built for the curious mind wanting depth and relevance without the endless time sink of manual news consumption.

## Project setup

1.  **Clone the repository (or download files):**
```bash
git clone <repo_url> meridiano-nestjs
cd meridiano-nestjs
```

2.  **Install dependencies:**
```bash
npm install
```

## Database Setup with Docker

This project uses PostgreSQL as the primary database with TypeORM for migrations. You can run the database using Docker.

### Prerequisites

- Docker and Docker Compose installed
- pnpm package manager

### Environment Configuration

Create a `.env` file in the root directory with your database configuration:

```bash
# Database Configuration
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://your-user:your-password@localhost:5432/meridian

# Or use individual variables
DATABASE_USER=your-user
DATABASE_PASSWORD=your-password
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=meridian

# Docker Compose Profile
COMPOSE_PROFILE=local

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Authentication
JWT_SECRET=your-secret-key-change-in-production

# Meridiano CLI scoped API key (optional)
# Long-lived static secret sent via the `x-api-key` header. Accepted on exactly
# two routes — POST /api/youtube/transcriptions and GET /api/youtube/channels —
# so an unattended CLI can call them without a JWT. Every other route stays
# JWT-only. If unset/empty the key path is inert. Rotate by changing the value
# and restarting the service.
MERIDIANO_API_KEY=

# AI API Keys
DEEPSEEK_API_KEY=your-deepseek-api-key
EMBEDDING_API_KEY=your-embedding-api-key
# Required for text-to-speech audio generation
OPENAI_API_KEY=your-openai-api-key

# Presigned URL expiry in seconds for audio playback (default: 3600)
PRESIGNED_URL_EXPIRY_SECONDS=3600
```

### Starting the Database

```bash
# Start PostgreSQL and Redis containers (local environment)
$ pnpm run docker:up

# View database logs
$ pnpm run docker:logs

# Stop containers
$ pnpm run docker:down
```

### Database Migrations

The project uses TypeORM migrations to manage database schema changes. Migrations run automatically when the application starts.

```bash
# Create a new migration file
$ pnpm run migration:create src/database/migrations/AddNewColumn

# Generate a migration from entity changes (when using TypeORM entities)
$ pnpm run migration:generate src/database/migrations/UpdateSchema

# Run pending migrations manually
$ pnpm run migration:run

# Revert the last migration
$ pnpm run migration:revert
```

### Create tables in the local database

1. Install dependencies (if you haven't already):

```bash
$ pnpm install
```

2. Create a .env file in the project root with your database configuration:

```env
DATABASE_TYPE=postgres
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=meridian
```

3. Start the PostgreSQL database using Docker:

```bash
$ pnpm run docker:up
```

This will start both PostgreSQL and Redis containers in the background.

4. Build the project (this compiles the TypeScript migration files to JavaScript):

```bash
$ pnpm run build
```

5. Run migrations - You have two options:
   Option A: Run migrations manually (recommended for first time):

```bash
pnpm run migration:run
```

Option B: Let migrations run automatically on app startup:

```bash
pnpm run start:dev
```

The migrations will run automatically because we configured the DatabaseModule (from `@libs/database`) to execute them on startup.

### Verification

To verify your tables were created successfully:

1. **Connect to your PostgreSQL database:**

```bash
docker exec -it meridiano-postgres-local psql -U postgres -d meridian
```

2. **List all tables:**

```sql
\dt
```

You should see:

- `articles`
- `briefings`
- `youtube_transcriptions`
- `typeorm_migrations` (tracks which migrations have run)

3. **View a table structure:**

```sql
\d articles
```

4. **Exit psql:**

```sql
\q
```

### Environment-Specific Setup

**Local Development:**

```bash
# Uses docker-compose with 'local' profile
COMPOSE_PROFILE=local
pnpm run docker:up
pnpm run start:dev
```

**Staging:**

```bash
# Uses docker-compose with 'staging' profile
COMPOSE_PROFILE=staging
docker-compose --profile staging up -d
pnpm run start
```

**Production:**

```bash
# Uses docker-compose with 'production' profile
COMPOSE_PROFILE=production
docker-compose --profile production up -d
pnpm run start:prod
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## How to run Redis

Redis is included in the Docker Compose setup and will start automatically with `pnpm run docker:up`.

Alternatively, install Redis using Homebrew:

**Install Redis:**

```bash
brew install redis
```

**Then start Redis:**

```bash
brew services start redis
```

Or if you want to run it without starting Redis as a background service:

```bash
redis-server
```

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

# To-dos (not necessarily in order)

- [x] Check if youtube transcription already exists in database before adding it and process it
- [x] Convert cli commands to use usecase so it's more decoupled and easy to reuse
- [x] Isolate prompts configs from config.service.ts to separate files, so it's easier to mantain; also do this for the other configs
- [x] Add articles manually
- [x] Star/bookmark/save for later an article
- [x] See stars/bookmarks/saved in a special view
- [x] Add youtube video manually
- [x] Remove sqlite code
- [x] Create a docs folder on the root of the project with all available endpoints ready to import to Bruno
- [x] Endpoint to create channel
- [x] Add auth
- [x] Make it possible to upload a markdown file to S3 with an article and send an event to the queue to process this md file
- [x] Change the s3 upload to use the pre signed post from s3
- [ ] Migrate feeds configs to a table
- [x] Refactor all tests to use jest-mock-extended
- [ ] Send email with articles briefings; use my `personal-sendmail-api` (create validation on aws SES for meridiano)
- [x] Move the following modules to a libs structure inside this project:
  - [x] S3
  - [x] Email
  - [x] Auth
  - [x] Database
  - [x] Queue
- [ ] Add e2e tests for the main parts
  - [x] login
  - [ ] briefing tech (or could be any other -> maybe break down into smaller pieces)
  - [ ] get transcriptions
  - [ ] process transcription
- [ ] Add an AI coding CLI, for example, Code Rabbit as part of the loop where after a run, it runs the Code Rabbit CLI against the current diff, finds any potential things that might be wrong with that code, and then sends that as part of the context to another agent that will go and fix the things that it caught
- [x] Generate an audio for a transcript (optional param); save to s3? make it possible to listen on the transcription page?
- [ ] Isolate the generate audio feature into another job, and add a specific command for it; also add retry (max 1x) if it fails to process audio; if max attempts reached, add to dead letter queue
- [x] Remove usecase module
- [x] Add github actions (or alternative like depot)
- [ ] Add embedding search on articles and on youtube transcriptions (e.g. search for "github actions alternatives")
- [ ] Possibility to add comments to an article or youtube transcription (goal: add my notes to them)
- [ ] Move the processor module to articles module

# How to use Sandcastle in this project

1. Build the image:
   ```bash
   pnpm run sandcastle:build
   ```
2. Run sandcastle:
   ```bash
   pnpm run sandcastle:run
   ```

# API Documentation

For detailed API documentation, see:

- **[📦 Libraries Guide](docs/LIBRARIES.md)** - Infrastructure library documentation
- [Technical Overview](docs/TECHNICAL_OVERVIEW.md) - Technical architecture details
- [Libraries Documentation](libs/README.md) - Infrastructure libraries guide
