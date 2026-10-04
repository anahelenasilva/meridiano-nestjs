# Email Module

Sends plain-text email through Mailgun. `EmailService` builds the Mailgun client from `ConfigService.getMailgunConfig()`.

## Setup

### 1. Environment Variables

Add these to your `.env` file:

```env
MAILGUN_API_KEY=your-api-key-here
MAILGUN_DOMAIN=your-domain.com
# Optional: For EU domains
# MAILGUN_URL=https://api.eu.mailgun.net
```

`EmailService` throws at startup if `MAILGUN_API_KEY` or `MAILGUN_DOMAIN` is missing.

### 2. Import the Module

In the feature module that sends email:

```typescript
import { Module } from '@nestjs/common';
import { EmailModule } from '@libs/email';

@Module({
  imports: [
    EmailModule.forRoot(),
    // ... other modules
  ],
})
export class MyFeatureModule {}
```

`EmailModule` gets `ConfigService` from the app's global `ConfigModule`, so it does not import `ConfigModule` itself.

## Usage

### Inject and Use the Email Service

```typescript
import { Injectable } from '@nestjs/common';
import { EmailService } from '@libs/email';

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

## Example: Using in a Script

You can use the email service in scripts or standalone applications:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { EmailService } from '@libs/email';

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

