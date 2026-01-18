#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import 'source-map-support/register';
import { S3Stack } from '../lib/s3-stack';

const app = new cdk.App();

const environment = app.node.tryGetContext('environment') || process.env.NODE_ENV || 'dev';

const validEnvironments = ['dev', 'stg', 'prod'];
if (!validEnvironments.includes(environment)) {
  throw new Error(
    `Invalid environment: ${environment}. Must be one of: ${validEnvironments.join(', ')}`
  );
}

console.log(`Deploying to environment: ${environment}`);

new S3Stack(app, `MeridianoS3Stack-${environment}`, {
  environment,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1',
  },
  description: `Meridiano Articles S3 bucket for ${environment} environment`,
  tags: {
    Environment: environment,
    Project: 'Meridiano',
    ManagedBy: 'CDK',
  },
});

app.synth();
