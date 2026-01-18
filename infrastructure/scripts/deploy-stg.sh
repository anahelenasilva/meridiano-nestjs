#!/bin/bash
set -e

echo "🚀 Deploying Meridiano S3 infrastructure to STAGING environment..."

export NODE_ENV=stg

cd "$(dirname "$0")/.."

if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  pnpm install
fi

echo "🔧 Synthesizing CDK stack..."
npx cdk synth --context environment=stg

echo "📤 Deploying to AWS..."
npx cdk deploy --context environment=stg --require-approval never

echo "✅ Deployment complete!"
echo ""
echo "To view the stack outputs, run:"
echo "  aws cloudformation describe-stacks --stack-name MeridianoS3Stack-stg --query 'Stacks[0].Outputs'"
