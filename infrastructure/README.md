# Meridiano Infrastructure (AWS CDK)

This directory contains AWS CDK infrastructure code for the Meridiano API project. It manages S3 buckets for storing markdown articles with environment-specific configurations.

## Prerequisites

Before deploying, ensure you have the following installed and configured:

### Required Software

1. **Node.js** (v20 or higher)
   ```bash
   node --version
   ```

2. **pnpm** (package manager)
   ```bash
   npm install -g pnpm
   ```

3. **AWS CLI** (configured with credentials)
   ```bash
   aws --version
   aws configure
   ```

4. **AWS CDK CLI**
   ```bash
   npm install -g aws-cdk
   cdk --version
   ```

### AWS Credentials

Configure your AWS credentials using one of these methods:

**Option 1: AWS CLI Configuration**
```bash
aws configure
```

**Option 2: Environment Variables**
```bash
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_REGION=us-east-1
```

**Option 3: AWS Profile**
```bash
export AWS_PROFILE=your-profile-name
```

### Required AWS Permissions

Your AWS user/role needs permissions to:
- Create and manage S3 buckets
- Create and manage IAM policies
- Create and manage CloudFormation stacks

## Installation

Install dependencies in the infrastructure directory:

```bash
cd infrastructure
pnpm install
```

## Deployment

### Deploy to Development

```bash
pnpm run deploy:dev
```

Or manually:
```bash
bash scripts/deploy-dev.sh
```

### Deploy to Staging

```bash
pnpm run deploy:stg
```

Or manually:
```bash
bash scripts/deploy-stg.sh
```

### Deploy to Production

```bash
pnpm run deploy:prod
```

Or manually:
```bash
bash scripts/deploy-prod.sh
```

**Note:** Production deployment requires confirmation prompt.

## Stack Outputs

After deployment, the stack outputs the following:

- **BucketName**: S3 bucket name (e.g., `meridiano-api-articles-dev`)
- **BucketArn**: S3 bucket ARN
- **ReadPolicyArn**: IAM policy ARN for read access to the bucket

### View Stack Outputs

```bash
# For dev environment
aws cloudformation describe-stacks \
  --stack-name MeridianoS3Stack-dev \
  --query 'Stacks[0].Outputs'

# For stg environment
aws cloudformation describe-stacks \
  --stack-name MeridianoS3Stack-stg \
  --query 'Stacks[0].Outputs'

# For prod environment
aws cloudformation describe-stacks \
  --stack-name MeridianoS3Stack-prod \
  --query 'Stacks[0].Outputs'
```

## S3 Bucket Configuration

Each environment has its own S3 bucket with the following configuration:

### Bucket Naming Convention
- Development: `meridiano-api-articles-dev`
- Staging: `meridiano-api-articles-stg`
- Production: `meridiano-api-articles-prod`

### Bucket Features
- **Versioning**: Enabled
- **Encryption**: SSE-S3 (Server-Side Encryption with S3-Managed Keys)
- **Public Access**: Blocked (all public access is disabled)
- **Lifecycle Policy**: Deletes non-current versions after 90 days
- **Removal Policy**: RETAIN (bucket is not deleted when stack is destroyed)

## IAM Policy

The stack creates a managed IAM policy that grants read access to the S3 bucket:

- Policy Name: `meridiano-articles-read-{env}`
- Permissions:
  - `s3:GetObject` - Read objects from bucket
  - `s3:ListBucket` - List objects in bucket

### Attach Policy to EC2 Instance/ECS Task Role

If running the NestJS application on EC2 or ECS, attach the policy to the IAM role:

```bash
# Get the policy ARN from stack outputs
POLICY_ARN=$(aws cloudformation describe-stacks \
  --stack-name MeridianoS3Stack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ReadPolicyArn`].OutputValue' \
  --output text)

# Attach to IAM role
aws iam attach-role-policy \
  --role-name your-role-name \
  --policy-arn $POLICY_ARN
```

### Use Policy with IAM User

For local development or CI/CD, attach the policy to an IAM user:

```bash
POLICY_ARN=$(aws cloudformation describe-stacks \
  --stack-name MeridianoS3Stack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ReadPolicyArn`].OutputValue' \
  --output text)

aws iam attach-user-policy \
  --user-name your-username \
  --policy-arn $POLICY_ARN
```

## Configure NestJS Application

After deployment, configure the NestJS application with the bucket name:

### Environment Variables

Add to your `.env` file:

```env
AWS_REGION=us-east-1
S3_ARTICLES_BUCKET_NAME=meridiano-api-articles-dev
```

For production:
```env
AWS_REGION=us-east-1
S3_ARTICLES_BUCKET_NAME=meridiano-api-articles-prod
```

### Get Bucket Name from Stack

```bash
aws cloudformation describe-stacks \
  --stack-name MeridianoS3Stack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
  --output text
```

## Other CDK Commands

### Synthesize CloudFormation Template

```bash
cd infrastructure
npx cdk synth --context environment=dev
```

### View Differences Before Deployment

```bash
npx cdk diff --context environment=dev
```

### Destroy Stack

**Warning:** This will destroy the CloudFormation stack but NOT the S3 bucket (due to RETAIN policy).

```bash
npx cdk destroy --context environment=dev
```

To also delete the bucket, manually delete it from AWS Console or CLI:
```bash
# Empty the bucket first
aws s3 rm s3://meridiano-api-articles-dev --recursive

# Delete the bucket
aws s3 rb s3://meridiano-api-articles-dev
```

## Troubleshooting

### CDK Bootstrap Required

If you see an error about CDK bootstrap, run:

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### Permission Denied on Scripts

Make scripts executable:

```bash
chmod +x scripts/*.sh
```

### Invalid Environment Error

Ensure you're using one of the valid environments: `dev`, `stg`, or `prod`.

### AWS Credentials Not Found

Verify your AWS credentials are configured:

```bash
aws sts get-caller-identity
```

## Architecture

```
┌─────────────────────────────────────────┐
│   CloudFormation Stack                  │
│   MeridianoS3Stack-{env}                │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  S3 Bucket                        │  │
│  │  meridiano-api-articles-{env}     │  │
│  │                                   │  │
│  │  - Versioning: Enabled            │  │
│  │  - Encryption: SSE-S3             │  │
│  │  - Public Access: Blocked         │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  IAM Managed Policy               │  │
│  │  meridiano-articles-read-{env}    │  │
│  │                                   │  │
│  │  Permissions:                     │  │
│  │  - s3:GetObject                   │  │
│  │  - s3:ListBucket                  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Support

For issues or questions:
- Check AWS CloudFormation console for stack events
- Review CloudWatch logs
- Verify IAM permissions
- Ensure AWS credentials are valid
