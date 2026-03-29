# Security Architecture

- Global JWT auth guard is enabled application-wide.
- `@Public()` marks unauthenticated routes (for example login and user creation).
- Redis-backed rate limit guard is used on login and external article endpoint.
- External article endpoint includes token guard and SSRF protections (blocked localhost/private IP ranges).
