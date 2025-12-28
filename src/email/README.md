# Email Module

A generic email service module for NestJS that supports multiple email providers with easy switching via environment variables.

## Features

- **Provider Abstraction**: Easy to swap between email providers
- **Environment-based Configuration**: Switch providers via `EMAIL_PROVIDER` env var
- **Type-safe**: Full TypeScript support with interfaces
- **Extensible**: Easy to add new providers

## Supported Providers

- **Mailgun** (default)

## Setup

### 1. Install Dependencies

The required dependencies (`mailgun.js` and `form-data`) are already in your `package.json`.

### 2. Environment Variables

Add these to your `.env` file:

```env
# Email Provider Selection (defaults to 'mailgun')
EMAIL_PROVIDER=mailgun

# Mailgun Configuration
MAILGUN_API_KEY=your-api-key-here
MAILGUN_DOMAIN=your-domain.com  # Required: Your Mailgun domain
# Optional: For EU domains
# MAILGUN_URL=https://api.eu.mailgun.net
```

### 3. Import the Module

In your `app.module.ts` or any feature module:

```typescript
import { Module } from '@nestjs/common';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    EmailModule.forRoot(),
    // ... other modules
  ],
})
export class AppModule {}
```

## Usage

### Inject and Use the Email Service

```typescript
import { Injectable } from '@nestjs/common';
import { EmailService } from './email/email.service';

@Injectable()
export class MyService {
  constructor(private readonly emailService: EmailService) {}

  async sendWelcomeEmail(userEmail: string) {
    const result = await this.emailService.sendEmail({
      from: 'noreply@example.com',
      to: userEmail,
      subject: 'Welcome!',
      text: 'Welcome to our platform!',
    });

    if (result.success) {
      console.log('Email sent successfully:', result.messageId);
    } else {
      console.error('Failed to send email:', result.error);
    }
  }
}
```

### Email Options

```typescript
interface SendEmailOptions {
  from: string;                   // Required: Sender email address
  to: string | string[];          // Required: Recipient(s)
  subject: string;                // Required: Email subject
  text: string;                   // Required: Plain text content
  cc?: string | string[];         // Optional: CC recipients
}
```

## Adding New Providers

To add a new email provider:

1. Create a new provider class implementing `EmailProvider`:

```typescript
import { Injectable } from '@nestjs/common';
import { EmailProvider } from '../interfaces/email-provider.interface';
import { SendEmailOptions, SendEmailResult } from '../interfaces/send-email-options.interface';

@Injectable()
export class SendgridProvider implements EmailProvider {
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    // Implementation here
  }
}
```

2. Update `email.module.ts` to include the new provider:

```typescript
case 'sendgrid':
  emailProviderClass = SendgridProvider;
  break;
```

3. Set `EMAIL_PROVIDER=sendgrid` in your environment variables.

## Example: Using in a Script

You can use the email service in scripts or standalone applications:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { EmailService } from '../email/email.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const emailService = app.get(EmailService);

  const result = await emailService.sendEmail({
    from: process.env.EMAIL_FROM || 'noreply@yourdomain.com',
    to: process.env.EMAIL_TO || 'recipient@example.com',
    subject: 'Test Email',
    text: 'This is a test email sent via the email service.',
  });

  if (result.success) {
    console.log('Email sent successfully:', result.messageId);
  } else {
    console.error('Failed to send email:', result.error);
  }

  await app.close();
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
```

