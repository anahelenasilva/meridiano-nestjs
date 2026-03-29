# Configuration Model

Configuration comes from:

1. Environment variables (`.env`, deployment env)
2. `ConfigService` defaults in `src/config/config.service.ts`
3. DB-driven YouTube channel configuration via `YoutubeChannelsService`

Environment toggles are used for behavior such as:

- `ENABLED_CHAT_MODEL`, `ENABLED_TTS_MODEL`
- `TELEGRAM_INTEGRATION_ENABLED`
- Email notification addresses for queue and processing failures (for example queue handlers and embedding failure alerts)
