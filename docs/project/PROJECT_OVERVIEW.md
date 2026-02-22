# Meridiano - Personal Intelligence Briefing System

## Overview

Meridiano is an AI-powered intelligence briefing system built with NestJS that helps users cut through information overload by automatically scraping configured news sources, analyzing stories with AI, clustering related events, and delivering concise daily briefings. Inspired by the concept of presidential daily briefings, it provides focused, personalized intelligence for individual users.

## Core Purpose

In an era of information overload, Meridiano helps users:
- Stay informed on key global or specific topical events without drowning in noise
- Understand context beyond headlines through AI analysis
- Track developing stories via article clustering
- Leverage AI for summarization and impact assessment
- Maintain control through customizable feed profiles

## Technology Stack

### Backend Framework
- **NestJS**: Primary framework for building the application
- **TypeScript**: Strongly typed development
- **Node.js** (version 22+): Runtime environment

### Database & Storage
- **PostgreSQL**: Primary relational database for articles, briefings, transcriptions, and user data
- **TypeORM**: ORM for database migrations and entity management
- **Redis**: Used for job queue management and caching
- **AWS S3**: Cloud storage for markdown files and audio files

### Queue System
- **BullMQ**: Job queue system for background processing with Redis backend
- Multiple queues for different processing tasks (article processing, audio generation, transcription summaries)

### AI Integration
- **DeepSeek**: Primary AI model for chat completions and content analysis
- **OpenAI**: Alternative chat model and text-to-speech (TTS) generation
- **Groq**: Alternative TTS provider using Orpheus model
- **Together.xyz**: Embedding generation for article clustering

### Authentication
- **JWT**: Token-based authentication with 24-hour expiration
- **Passport**: Authentication middleware
- **bcrypt**: Password hashing with 10 salt rounds

### External Services
- **Mailgun**: Email delivery provider

## Key Features

### 1. Article Management

#### RSS Feed Scraping
- Automatically scrapes configured RSS feeds on a schedule
- Extracts article content using Mozilla Readability for clean text extraction
- Captures Open Graph images and RSS enclosure images
- Prevents duplicate articles by URL checking
- Configurable maximum articles per feed per scraping session

#### Manual Article Addition
- Add articles manually via URL
- Automatic content extraction and processing
- Support for markdown file uploads to S3 with queue-based processing

#### Article Processing Pipeline
- Raw content extraction and storage
- AI-powered content summarization
- Embedding generation for semantic clustering
- Impact rating assignment (1-10 scale)
- Category classification

#### Article Search & Filtering
- Paginated article listing
- Full-text search across titles and content
- Filter by feed profile, date range, and category
- Sort by publication date, impact rating, or creation date
- Related articles suggestions based on feed profile and publication proximity

### 2. YouTube Transcription System

#### Channel Management
- Configure YouTube channels for transcription monitoring
- Enable/disable channels individually
- Set maximum videos to process per channel

#### Transcription Extraction
- Multi-method fallback system for transcript fetching:
  1. Primary: youtube-transcript-plus library
  2. Secondary: Custom transcript service
  3. Tertiary: Innertube API method
- Automatic video metadata extraction (title, thumbnail, publication date)
- Duplicate prevention by video URL

#### Transcription Processing
- AI-generated summaries of video content
- Optional audio generation from transcriptions
- Paginated listing with search and filters
- Channel-based organization

### 3. Intelligence Briefing Generation

#### Clustering Algorithm
- Uses K-means clustering on article embeddings
- Groups related articles by semantic similarity
- Configurable number of clusters
- Automatic cluster analysis and topic identification

#### Brief Generation Process
1. Fetches recent articles within configurable lookback period
2. Filters articles with embeddings and processed content
3. Clusters articles by semantic similarity
4. AI analyzes each cluster to identify themes
5. Synthesizes final briefing in Markdown format
6. Saves briefing with references to source articles

#### Briefing Profiles
- Multiple feed profiles (e.g., technology, Brasil, Teclas)
- Profile-specific RSS feed configurations
- Customizable prompts per profile
- Independent briefing generation per profile

### 4. Audio Generation

#### Text-to-Speech Integration
- Support for multiple TTS providers:
  - **OpenAI TTS**: High-quality voices (alloy, echo, fable, onyx, nova, shimmer)
  - **Groq Orpheus**: Alternative voices (autumn, diana, hannah, austin, daniel, troy)
- Automatic text chunking for length limits (200 chars for Groq)
- Sentence-boundary-aware text splitting
- MP3 output format (OpenAI) or WAV format (Groq)

#### Audio Processing Queue
- Background job processing with BullMQ
- Concurrent audio generation (2 jobs parallel)
- Error classification (retryable vs fatal errors)
- Automatic retry for transient failures
- Progress tracking and logging

### 5. User Management & Authentication

#### User System
- User registration with email and username
- UUID-based primary keys
- Username validation (alphanumeric, underscores, hyphens)

#### Authentication Flow
- JWT token-based authentication
- Global route protection by default
- Public routes marked with decorator
- Token expiration after 24 hours
- Rate limiting on login endpoint

### 6. Bookmark System

#### Article Bookmarking
- Save articles for later reading
- Paginated bookmark lists with full article details
- Bookmark status checking
- Bookmark count tracking
- User-specific bookmark collections

## Architecture Patterns

### Modular Structure
- **Domain modules** in `src/`: Feature-specific business logic (articles, briefings, users, etc.)
- **Infrastructure modules** in `libs/`: Reusable cross-cutting concerns (auth, database, queue, s3, email, redis)

### Dependency Injection
- NestJS dependency injection throughout
- Constructor-based injection
- Forward references for circular dependencies

### Queue-Based Processing
- Asynchronous job processing for heavy operations
- Separate queues for different job types:
  - Article processing queue
  - Markdown article processing queue
  - YouTube transcription summary queue
  - Audio generation queue

### Configuration Management
- Environment-based configuration
- Separate configuration services for different concerns
- Model configuration (AI models, temperatures, max tokens)
- Application configuration (scraping limits, briefing parameters)
- Prompt configuration with template variables

## API Endpoints

### Authentication
- POST /api/auth/login - User login (public)

### Articles
- GET /api/articles - List articles with pagination and filters
- GET /api/articles/:id - Get single article
- POST /api/articles/upload-url - Generate presigned URL for markdown upload
- POST /api/articles/process-markdown - Process uploaded markdown file

### Briefings
- GET /api/briefings - List all briefing metadata
- GET /api/briefings/:id - Get full briefing content
- GET /api/briefings/stats/:feedProfile - Get processing statistics

### YouTube Transcriptions
- GET /api/youtube-transcriptions - List transcriptions with pagination
- GET /api/youtube-transcriptions/:id - Get single transcription
- POST /api/youtube-transcriptions/process - Process a video URL

### YouTube Channels
- POST /api/youtube-channels - Create a new channel configuration

### Users
- POST /api/users - Create a new user

### Bookmarks
- POST /api/bookmarks - Create a bookmark
- GET /api/bookmarks - List user's bookmarks
- DELETE /api/bookmarks/:id - Remove a bookmark
- GET /api/bookmarks/check - Check if article is bookmarked
- GET /api/bookmarks/count - Get bookmark count

### Audio Files
- POST /api/audio-files/generate - Generate audio for article or transcription

## CLI Commands

The application provides several CLI scripts for administrative tasks:

### Briefing Generation
- Generate briefings for specific feed profiles
- Run individual pipeline stages (scrape, process, rate, generate)
- Configurable lookback periods

### YouTube Transcription
- Extract transcripts from configured channels
- Process individual video URLs
- List existing transcriptions

### Database Migrations
- Create new migrations
- Generate migrations from entity changes
- Run pending migrations
- Revert last migration

## Deployment

### Docker Support
- Docker Compose for local development
- Environment-specific profiles (local, staging, production)
- PostgreSQL and Redis containers

### Infrastructure
- AWS CDK for infrastructure as code
- S3 bucket creation and configuration
- Deployment scripts for different environments

### Railway Support
- Configuration for Railway deployment platform

## Development Workflow

### Testing
- Jest for unit and E2E testing
- jest-mock-extended for mock creation
- Co-located test files with source

### Code Quality
- ESLint with TypeScript support
- Prettier for code formatting
- EditorConfig for consistency

### Git Workflow
- Conventional commit messages
- Feature branch workflow
- PR-based code review

## Environment Variables

### Required
- DATABASE_URL or individual database credentials
- JWT_SECRET for authentication
- DEEPSEEK_API_KEY for AI chat completions
- EMBEDDING_API_KEY for embedding generation

### Optional
- OPENAI_API_KEY for OpenAI chat and TTS
- GROQ_API_KEY for Groq TTS
- MAILGUN_API_KEY and MAILGUN_DOMAIN for email
- AWS credentials for S3 operations

## Future Roadmap

### Planned Features
- Feed configuration migration to database tables
- Email delivery of article briefings
- Embedding-based search for articles and transcriptions
- Comments/notes on articles and transcriptions
- End-to-end testing expansion
- AI coding CLI integration for automated code review

### Recent Completed
- Migration of infrastructure modules to libs structure
- JWT authentication implementation
- Bookmark system
- Audio generation for transcriptions
- YouTube channel management
- Manual article addition
