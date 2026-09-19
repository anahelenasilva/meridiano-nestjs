# Database Module

A database service module for NestJS that provides a unified database interface with PostgreSQL support. The module uses TypeORM for migrations and provides a raw SQL interface compatible with SQLite-style prepared statements.

## Features

- **Unified Database Interface**: SQLite-compatible API that works with PostgreSQL
- **TypeORM Integration**: Automatic migrations on application startup
- **Connection Pooling**: Uses PostgreSQL connection pooling for performance
- **Type-safe**: Full TypeScript support with interfaces
- **Global Module**: Available throughout the application without explicit imports

## Setup

### 1. Install Dependencies

The required dependencies (`pg`, `typeorm`, `@nestjs/typeorm`) are already in your `package.json`.

### 2. Environment Variables

Add these to your `.env` file:

```env
# Database Configuration
DATABASE_TYPE=postgres
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=meridian

# Optional: Use a full connection string instead
# DATABASE_URL=postgresql://your-user:your-password@your-host:5432/your-database

# Optional: Enable SSL (for production)
# DATABASE_SSL=true
```

### 3. Import the Module

In your `app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@libs/database';

@Module({
  imports: [
    DatabaseModule,
    // ... other modules
  ],
})
export class AppModule {}
```

**Note:** The `DatabaseModule` is marked with `@Global()`, so it's available throughout your application without needing to import it in each feature module. However, you still need to import it in `AppModule` to initialize it.

## Usage

### Inject and Use the Database Service

```typescript
import { Injectable } from '@nestjs/common';
import { DatabaseService, execute, queryAll, queryOne } from '@libs/database';

interface UserRow {
  id: string;
  email: string;
}

@Injectable()
export class MyService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getUserById(id: string): Promise<UserRow | undefined> {
    const db = this.databaseService.getDbConnection();
    return queryOne<UserRow>(db, 'SELECT id, email FROM users WHERE id = ?', [id]);
  }

  async listUsers(): Promise<UserRow[]> {
    const db = this.databaseService.getDbConnection();
    return queryAll<UserRow>(db, 'SELECT id, email FROM users ORDER BY email');
  }

  async createUser(email: string): Promise<string | undefined> {
    const db = this.databaseService.getDbConnection();
    const row = await queryOne<{ id: string }>(
      db,
      'INSERT INTO users (email) VALUES (?) RETURNING id',
      [email],
    );
    return row?.id;
  }

  async renameUser(id: string, email: string): Promise<boolean> {
    const db = this.databaseService.getDbConnection();
    const changes = await execute(db, 'UPDATE users SET email = ? WHERE id = ?', [email, id]);
    return changes > 0;
  }
}
```

The raw callback methods below still exist for code that has not moved to the helpers.

### Database Connection API

The `getDbConnection()` method returns a `DatabaseConnection` object with the following methods:

#### `prepare(sql: string): PreparedStatement`

Creates a prepared statement for repeated queries:

```typescript
const db = this.databaseService.getDbConnection();
const stmt = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');

stmt.run(['John Doe', 'john@example.com'], function(err) {
  console.log('Inserted ID:', this.lastID);
  console.log('Rows affected:', this.changes);
});

stmt.finalize();
```

#### `run(sql: string, params?: SqlParams, callback?: RunCallback): RunResult`

Executes a SQL statement (INSERT, UPDATE, DELETE):

```typescript
const db = this.databaseService.getDbConnection();

db.run('UPDATE users SET name = ? WHERE id = ?', ['Jane Doe', '123'], function(err) {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Rows affected:', this.changes);
  }
});
```

**Note:** For INSERT statements, the service automatically appends `RETURNING id` to get the inserted ID, which is available as `this.lastID` in the callback.

#### `all<T = unknown>(sql: string, params?: SqlParams, callback?: (err: Error | null, rows?: T[]) => void): void`

Executes a SELECT query and returns all rows. Pass a row type (`db.all<User>(...)`) or annotate the callback to recover typed rows:

```typescript
const db = this.databaseService.getDbConnection();

db.all<User>('SELECT * FROM users WHERE active = ?', [true], (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Found users:', rows);
  }
});
```

#### `get<T = unknown>(sql: string, params?: SqlParams, callback?: (err: Error | null, row?: T) => void): void`

Executes a SELECT query and returns the first row. Pass a row type (`db.get<User>(...)`) or annotate the callback to recover a typed row:

```typescript
const db = this.databaseService.getDbConnection();

db.get<User>('SELECT * FROM users WHERE id = ?', ['123'], (err, row) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('User:', row);
  }
});
```

### Placeholder Conversion

The service automatically converts SQLite-style `?` placeholders to PostgreSQL-style `$1`, `$2`, etc. You can use `?` placeholders in your SQL queries:

```typescript
db.get('SELECT * FROM users WHERE id = ? AND active = ?', ['123', true], callback);
```

## Migrations

The module automatically runs pending migrations on application startup. Migrations are stored in `src/database/migrations/` and are managed via TypeORM CLI commands.

### Creating Migrations

```bash
# Generate migration from entity changes
pnpm run migration:generate src/database/migrations/MigrationName

# Create empty migration
pnpm run migration:create src/database/migrations/MigrationName
```

### Running Migrations

Migrations run automatically on application startup. You can also run them manually:

```bash
# Run pending migrations
pnpm run migration:run

# Revert last migration
pnpm run migration:revert
```

## Architecture

The database module consists of:

- **`DatabaseModule`**: NestJS module that initializes TypeORM and provides `DatabaseService`
- **`DatabaseService`**: Factory service that provides the appropriate database implementation
- **`AbstractDatabaseService`**: Abstract base class defining the database interface
- **`PostgresDatabaseService`**: PostgreSQL implementation using `pg` connection pooling
- **`DatabaseConnection`**: Interface compatible with SQLite-style database APIs

## Lifecycle

The `DatabaseModule` implements `OnModuleInit` and `OnModuleDestroy`:

1. **OnModuleInit**: Runs pending migrations, then initializes the database connection
2. **OnModuleDestroy**: Closes the database connection pool

## Error Handling

The helpers reject with the driver error, so callers use `try`/`catch` or `.catch()`. Postgres unique violations carry `code === '23505'`; `ArticlesService.addArticle` and `BookmarksService.addBookmark` show how to branch on it.
