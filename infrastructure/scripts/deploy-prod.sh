#!/bin/bash
set -e

echo "🚀 Deploying Meridiano S3 infrastructure to PRODUCTION environment..."
echo ""
echo "⚠️  WARNING: You are about to deploy to PRODUCTION!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " -r
echo

if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
  echo "❌ Deployment cancelled."
  exit 1
fi

export NODE_ENV=prod

cd "$(dirname "$0")/.."

if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  pnpm install
fi

echo "🔧 Synthesizing CDK stack..."
npx cdk synth --context environment=prod

echo "📤 Deploying to AWS..."
npx cdk deploy --context environment=prod

echo "✅ Deployment complete!"
echo ""
echo "To view the stack outputs, run:"
echo "  aws cloudformation describe-stacks --stack-name MeridianoS3Stack-prod --query 'Stacks[0].Outputs'"
