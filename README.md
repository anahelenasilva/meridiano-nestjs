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

# AI API Keys
DEEPSEEK_API_KEY=your-deepseek-api-key
EMBEDDING_API_KEY=your-embedding-api-key
# Required for text-to-speech audio generation
OPENAI_API_KEY=your-openai-api-key
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

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

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

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

# Parse Markdown Article Function Regex

The regex pattern to parse an article markdown is:

```
/^#[ \t]+([^\r\n]*)/m
```

Breaking down this regex parttern:

- `^#` - matches # at the start of a line
- `[ \t]+` - matches one or more spaces/tabs (required whitespace after # in markdown)
- `([^\r\n]*)` - captures zero or more non-newline characters (everything else on the line)
- `m` flag - enables multiline mode

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
- [ ] Add a PR pre check to validate if the file CLAUDE.md needs to be updated
- [ ] Move the processor module to articles module

# How to use Ralph in this project

Ralph is an autonomous coding agent that works through user stories in a PRD (Product Requirements Document) iteratively.

It reads a `prd.json` file containing user stories, then executes them one by one following the instructions in `prompt.md`. After each story is completed, it moves to the next highest priority story until all are done.

## 1. How to generate the PRD file

In Cursor chat, use the PRD skill to generate a detailed requirements document:

```plaintext
/generate-prd create a PRD for [feature name]
```

Answer the clarifying questions. The skill saves output to `tasks/prd-[feature-name].md`.

## 2. How to convert PRD to Ralph format

In Cursor chat, use the Ralph skill to convert the markdown PRD to JSON:

```plaintext
/ralph convert tasks/prd-[feature-name].md to prd.json
```

## 3. Run Ralph

In Cursor chat, simply reference the script:

```plaintext
@scripts/ralph/ralph.ts
```

This will load the script and execute one iteration, showing you:

- The current status (completed/total stories)
- The next story to work on
- The full prompt instructions
- Current progress log

Then you (or the AI assistant) can execute the instructions to implement the story.

For more information, access [Ralph documentation here](./scripts/ralph/README.md).

# Cursor + OpenCode Workflow

This project supports using both Cursor and OpenCode together for maximum productivity.

- **Cursor**: Quick edits, code review, file navigation, immediate feedback
- **OpenCode**: Complex multi-step tasks, orchestrated agent workflows with `ultrawork`

See the [Cursor + OpenCode Workflow Guide](./docs/CURSOR_OPENCODE_WORKFLOW.md) for:
- When to use which tool
- Workflow patterns and examples
- Helper scripts and shortcuts
- Best practices

Quick start: Source the helper script and use `ocu <task>` for ultrawork tasks:
```bash
source scripts/opencode-helpers.sh
ocu "add authentication to articles endpoint"
```

# How to use the `generate-commit-message` skill for better commit messages

The skill will automatically trigger when you:
- Ask for a commit message
- Ask to commit changes
- Need help writing commit messages

You can also explicitly invoke it:
```
/generate-commit-message
```

Or ask:
- "Generate a commit message for my changes"
- "What commit message should I use?"
- "Help me write a commit message"

**Location**: `.cursor/skills/generate-commit-message/SKILL.md`

The skill includes:

1. **Process workflow**: Steps to analyze git changes and generate commit messages
2. **Type reference**: Table of all Conventional Commits types with examples
3. **Scope guidelines**: How to identify and format scopes
4. **Description best practices**: Imperative mood, length, formatting
5. **Breaking changes**: How to indicate breaking changes
6. **Examples**: Real-world examples for different scenarios
7. **Analysis tips**: How to interpret diffs and identify types/scopes


# API Documentation

For detailed API documentation, see:

- [Bookmarks API Documentation](docs/bookmarks/BOOKMARKS_API.md) - Complete guide for users and bookmarks endpoints
