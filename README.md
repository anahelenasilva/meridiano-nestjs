<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
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
- [ ] Refactor all tests to use jest-mock-extended
- [ ] Send email with articles briefings; use my `personal-sendmail-api` (create validation on aws SES for meridiano)
- [ ] Move the following modules to a libs structure inside this project:
  - [x] S3
  - [x] Email
  - [x] Auth
  - [ ] Database
  - [ ] Queue
- [ ] Add e2e tests for the main parts
  - [ ] login
  - [ ] briefing tech (or could be any other -> maybe break down into smaller pieces)
  - [ ] get transcriptions
  - [ ] process transcription
- [ ] Add an AI coding CLI, for example, Code Rabbit as part of the loop where after a run, it runs the Code Rabbit CLI against the current diff, finds any potential things that might be wrong with that code, and then sends that as part of the context to another agent that will go and fix the things that it caught

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

# API Documentation

For detailed API documentation, see:
- [Bookmarks API Documentation](docs/bookmarks/BOOKMARKS_API.md) - Complete guide for users and bookmarks endpoints
