# Telegram Article Submission - Node-RED Flow Setup

This document provides instructions for setting up the Node-RED flow for the Telegram Article Submission feature.

## Prerequisites

1. **Node-RED** installed (locally or on Raspberry Pi)
2. **Telegram Bot** created via [BotFather](https://t.me/BotFather)
3. **Meridiano API** running with the external endpoint configured

## Installation

### 1. Install Node-RED

```bash
# Install Node-RED globally (use pnpm; npm -g also works for global installs)
pnpm add -g node-red

# Or use Docker
docker run -it -p 1880:1880 -v node_red_data:/data --name my-nodered nodered/node-red:latest
```

### 2. Install Telegram Nodes

In Node-RED, go to **Manage Palette** → **Install** and search for:
- `node-red-contrib-telegrambot` - For Telegram bot integration

### 3. Import the Flow

1. Open Node-RED (http://localhost:1880)
2. Click the menu (☰) → **Import** → **Clipboard**
3. Copy the contents of [`telegram-article-submission-flow.json`](telegram-article-submission-flow.json)
4. Paste into the import dialog and click **Import**

> **Important:** The flow JSON does not include credentials. You must configure them after importing (see next section).

### 4. Configure Telegram Bot Credentials

1. Double-click the **Telegram Bot** node
2. Click the edit button (pencil icon) next to Bot
3. Enter your Telegram Bot API Token (from BotFather)
4. Click **Add**

### 5. Configure Environment Variables

Set the following values in Node-RED flow settings:

1. Click the **Menu** → **Settings** → **Flow Settings**
2. Add the following environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `MERIDIANO_API_URL` | Meridiano API base URL | `http://localhost:3000` |
| `EXTERNAL_API_TOKEN` | External API token (from Meridiano env) | `tok_your_token_here` |

Or set them in the `Prepare API Request` function node directly.

## Telegram Bot Setup

### Creating the Bot

1. Open Telegram and start a chat with [BotFather](https://t.me/BotFather)
2. Send `/newbot` command
3. Follow the prompts to create your bot
4. Copy the bot API token

### Configuring Bot Commands

Send the following commands to BotFather:

```
/setcommands
```

Then enter:

```
start - Get started with the bot
help - Get help on how to use the bot
```

## Testing the Integration

### Test Message Format

Send the following message to your Telegram bot:

```
URL: https://addyosmani.com/blog/self-improving-agents/
Feed: technology
```

### Expected Response

On success:
```
✅ Article submitted successfully!

Article submitted successfully and queued for processing

🆔 Job ID: 550e8400-e29b-41d4-a716-446655440000
📄 Article ID: article-uuid-here

⏳ Your article is being processed and will be available soon.
```

On error (invalid URL):
```
❌ The URL you provided doesn't seem valid. Please check and try again.
```

## Node-RED Flow Overview

```
┌─────────────────┐     ┌──────────────────┐
│  Telegram Bot   │────▶│   Parse Message   │
│   (Receiver)    │     │   (Option B)      │
└─────────────────┘     └────────┬─────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
          ┌──────────────────┐      ┌─────────────────────┐
          │  Validation      │      │    API Request      │
          │  Error Response  │      │  (Meridiano API)    │
          └──────────────────┘      └──────────┬──────────┘
                                                │
                                   ┌────────────┴────────────┐
                                   │                         │
                                   ▼                         ▼
                         ┌──────────────────┐    ┌──────────────────┐
                         │  Success Handler │    │   Error Handler  │
                         └────────┬─────────┘    └────────┬─────────┘
                                  │                       │
                                  └───────────┬───────────┘
                                              │
                                              ▼
                                    ┌──────────────────┐
                                    │  Telegram Bot    │
                                    │    (Sender)      │
                                    └──────────────────┘
```

## Troubleshooting

### Bot not responding

1. Check that the bot token is correct in the Telegram Receiver node
2. Verify the bot is started (send `/start` to the bot)

### API requests failing

1. Verify `MERIDIANO_API_URL` is correct
2. Check that `EXTERNAL_API_TOKEN` is valid
3. Ensure Meridiano API is running

### Rate limiting

- The API allows 10 requests per minute per token
- If you hit the limit, wait 60 seconds before retrying

## Security Considerations

1. **Never commit tokens or credentials** to version control
2. The flow JSON intentionally excludes credentials - always configure them through the Node-RED UI after importing
3. Use environment variables for sensitive data
4. Consider setting up a webhook with a secret token for production
5. The Telegram bot token should be stored in Node-RED credentials

## Docker Compose Setup (Optional)

For running Node-RED alongside Meridiano:

```yaml
version: '3.8'
services:
  nodered:
    image: nodered/node-red:latest
    ports:
      - "1880:1880"
    volumes:
      - nodered-data:/data
    environment:
      - MERIDIANO_API_URL=http://api:3000
      # Note: Tokens should be set via Node-RED UI or secrets management

volumes:
  nodered-data:
```

## Support

For issues related to:
- **Meridiano API**: Check the API logs
- **Node-RED flow**: Check Node-RED debug panel
- **Telegram Bot**: Check BotFather bot settings
