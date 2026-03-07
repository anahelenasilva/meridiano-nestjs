# Telegram Article Submission - Deployment Guide

## Overview

This document outlines the deployment steps for Phase 5 of the Telegram Article Submission feature.

## Prerequisites

Before deploying, ensure you have:
1. A Telegram Bot created via BotFather
2. The Node-RED flow imported (see [`docs/nodered/telegram-article-submission-flow.json`](docs/nodered/telegram-article-submission-flow.json))
3. External API tokens generated for authentication
4. Access to your deployment environment

---

## Environment Configuration

### Required Environment Variables

| Variable | Description | Example |
| -------- | ----------- | -------- |
| `EXTERNAL_API_TOKENS` | Comma-separated list of valid tokens | `tok_prod_abc123,tok_prod_xyz789` |
| `TELEGRAM_INTEGRATION_ENABLED` | Enable/disable feature | `true` or `false` |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API token (set in Node-RED) | Generated via BotFather |

### Setting Environment Variables

#### For Docker Compose

Add to your environment or `.env` file:

```bash
# .env file
EXTERNAL_API_TOKENS=tok_prod_your_token_here
TELEGRAM_INTEGRATION_ENABLED=true
```

---

## Staging Deployment

### Step 1: Configure Staging Environment

1. Set up staging-specific environment variables:

```bash
# staging.env
COMPOSE_PROFILE=staging
DATABASE_HOST=your-staging-db-host
DATABASE_USER=staging_user
DATABASE_PASSWORD=staging_password
DATABASE_NAME=meridian_staging
REDIS_PASSWORD=staging_redis_password

# Telegram-specific
EXTERNAL_API_TOKENS=tok_stg_test_token
TELEGRAM_INTEGRATION_ENABLED=true
```

### Step 2: Deploy Staging Stack

```bash
# Start staging services
docker-compose -f docker-compose.yml --profile staging up -d

# Or use the staging-specific compose file
docker-compose -f docker-compose.staging.yml up -d
```

### Step 3: Configure Node-RED (Staging)

1. Access Node-RED at `http://localhost:1880`
2. Import the flow from [`docs/nodered/telegram-article-submission-flow.json`](docs/nodered/telegram-article-submission-flow.json)
3. Configure the Telegram credentials:
   - Bot Token: Your test bot token from BotFather
4. Set the API URL to your staging API endpoint
5. Deploy the flow

### Step 4: Set Webhook (Optional - for production-like testing)

If you want to test with webhooks in staging:

```bash
# Set webhook (replace with your staging URL)
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=https://your-staging-domain.com/webhook"
```

### Step 5: Test the Integration

Send a test message to your Telegram bot:

```
URL: https://example.com/article
Feed: technology
```

Expected response:
```
✅ Article submitted successfully!
📝 Title: Example Article
📊 Status: Queed for processing
🆔 Job ID: <job-uuid>
```

---

## Production Deployment

### Step 1: Generate Production Token

Generate a secure token for production use:

```bash
# Generate a secure random token
openssl rand -hex 32
```

### Step 2: Configure Production Environment

```bash
# production.env
COMPOSE_PROFILE=production
DATABASE_HOST=your-prod-db-host
DATABASE_USER=prod_user
DATABASE_PASSWORD=prod_password
DATABASE_NAME=meridian
REDIS_PASSWORD=prod_redis_password

# Telegram-specific - Initially DISABLED
EXTERNAL_API_TOKENS=tok_prod_your_secure_token
TELEGRAM_INTEGRATION_ENABLED=false
```

### Step 3: Deploy Production Stack

```bash
# Build and start production services
docker-compose -f docker-compose.prod.yml up -d --build
```

### Step 4: Run Database Migrations

Ensure the Telegram submissions table is created:

```bash
# Run migrations
docker exec -it meridian-backend pnpm run migrations:run

# Or use the migration script
docker exec -it meridian-backend node dist/scripts/run-migrations.js
```

### Step 5: Configure Node-RED (Production)

1. Access Node-RED at `http://localhost:1880` (or configure a reverse proxy)
2. Import the flow from [`docs/nodered/telegram-article-submission-flow.json`](docs/nodered/telegram-article-submission-flow.json)
3. Configure the production Telegram bot credentials
4. Set the API URL to your production API endpoint
5. **Important**: Configure the external API token in Node-RED
6. Deploy the flow

### Step 6: Verify Production Deployment

```bash
# Check API health
curl http://localhost:3005/api/health

# Test external endpoint (should fail without token)
curl -X POST http://localhost:3005/api/articles/external \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","feedProfile":"technology"}'

# Test with valid token
curl -X POST http://localhost:3005/api/articles/external \
  -H "Content-Type: application/json" \
  -H "X-External-Token: tok_prod_your_secure_token" \
  -d '{"url":"https://example.com","feedProfile":"technology"}'
```

---

## Enabling the Feature in Production

After thorough testing in staging and verifying production deployment:

### Step 1: Update Environment Variable

```bash
# Option 1: Update .env file and restart
TELEGRAM_INTEGRATION_ENABLED=true
docker-compose -f docker-compose.prod.yml restart meridian-backend

# Option 2: Update at runtime (if supported)
docker exec -e TELEGRAM_INTEGRATION_ENABLED=true meridian-backend ...
```

### Step 2: Verify Feature is Enabled

```bash
# Check that the endpoint is accessible
curl -X POST http://localhost:3005/api/articles/external \
  -H "X-External-Token: tok_prod_your_token" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","feedProfile":"technology"}'
```

Expected response:
```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Article submitted successfully and queued for processing"
}
```

### Step 3: Set Telegram Webhook (Production)

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=https://your-production-domain.com/nodered-webhook"
```

---

## Rollback Procedures

### Immediate Rollback

If issues are detected:

```bash
# Disable the feature flag
TELEGRAM_INTEGRATION_ENABLED=false
docker-compose -f docker-compose.prod.yml restart meridian-backend
```

### Token Revocation

If a token is compromised:

```bash
# Remove the compromised token from EXTERNAL_API_TOKENS
# Generate a new token
openssl rand -hex 32

# Update environment and restart
docker-compose -f docker-compose.prod.yml restart meridian-backend
```

---

## Monitoring

### Key Metrics to Monitor

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `external_api.requests` | Total external API requests | > 1000/min |
| `external_api.errors` | Error rate | > 5% |
| `external_api.latency` | Response time (p95) | > 2s |
| `telegram.submissions` | Successful submissions | Track daily |

### Logs

Check logs for the external article submission:

```bash
# View API logs
docker logs meridian-backend | grep -i "external"

# View Node-RED logs
docker logs meridiano-nodered-prod
```

---

## Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Verify token is set in `EXTERNAL_API_TOKENS`
   - Check token matches exactly (no extra spaces)

2. **429 Rate Limited**
   - Default: 10 requests per minute per token
   - Wait and retry

3. **502 Bad Gateway**
   - Check Node-RED can reach the API
   - Verify `MERIDIANO_API_URL` is correct

4. **Node-RED Flow Not Working**
   - Check Telegram bot token in Node-RED credentials
   - Verify flow is deployed
   - Check Node-RED logs

---

## Security Checklist

- [ ] `EXTERNAL_API_TOKENS` set in production environment
- [ ] `TELEGRAM_INTEGRATION_ENABLED` set to `false` initially
- [ ] Telegram bot token stored in Node-RED credentials (not env vars)
- [ ] API endpoint behind authentication/VPN if possible
- [ ] Rate limiting enabled and tested
- [ ] Logs monitored for suspicious activity
- [ ] Token rotation policy established (every 90 days)

---

## Files Modified/Created

| File | Description |
|------|-------------|
| `docker-compose.prod.yml` | Updated with Node-RED and Telegram env vars |
| `docker-compose.staging.yml` | New staging configuration |
| `docs/plans/telegram_article_submission_deployment.md` | This deployment guide |

---

## Next Steps

After Phase 5 deployment is complete:

1. Monitor metrics and logs
2. Gather user feedback
3. Plan Phase 2 improvements:
   - Multi-user support with Telegram user mapping
   - Support for submitting with notes/tags
   - Bot usage analytics
