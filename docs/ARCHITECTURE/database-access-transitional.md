# Database access (transitional)

Runtime storage is PostgreSQL. `DatabaseService` exposes a **SQLite-shaped API** (`prepare`, `run`, `all`, `get`, callbacks) implemented by `PostgresDatabaseService`, so domain services can keep legacy-style query code while executing against PostgreSQL.

TypeORM is used for migrations (`typeorm_migrations`); entity classes are not the primary application data layer for most features.

---

Last updated: March 2026
