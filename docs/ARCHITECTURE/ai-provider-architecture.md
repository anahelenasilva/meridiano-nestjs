# AI Provider Architecture

`AiService` centralizes provider clients:

- Chat: DeepSeek or OpenAI (selected by `ENABLED_CHAT_MODEL`)
- Embeddings: Together API
- TTS: OpenAI or Groq (selected by `ENABLED_TTS_MODEL`)

The service handles provider initialization, input sanitization, chunking, retries for transient embedding issues, and fallback selection by configuration.
