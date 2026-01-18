#!/bin/bash
set -e

echo "🚀 Deploying Meridiano S3 infrastructure to DEV environment..."

export NODE_ENV=dev

cd "$(dirname "$0")/.."

if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  pnpm install
fi

echo "🔧 Synthesizing CDK stack..."
npx cdk synth --context environment=dev

echo "📤 Deploying to AWS..."
npx cdk deploy --context environment=dev --require-approval never

echo "✅ Deployment complete!"
echo ""
echo "To view the stack outputs, run:"
echo "  aws cloudformation describe-stacks --stack-name MeridianoS3Stack-dev --query 'Stacks[0].Outputs'"
