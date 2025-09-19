#!/bin/bash

# Simple deployment script for Google Cloud Run
# Make sure you have gcloud installed and authenticated

set -e

PROJECT_ID="glass-next"
SERVICE_NAME="vendure-backend"
REGION="us-central1"
IMAGE_TAG="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "🚀 Deploying Vendure backend to Google Cloud Run..."

# Build and push the image
echo "🏗️  Building and pushing Docker image..."
gcloud builds submit --tag $IMAGE_TAG

# Deploy to Cloud Run with correct port configuration
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_TAG \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 8080 \
    --memory 2Gi \
    --cpu 1 \
    --max-instances 10 \
    --min-instances 0 \
    --set-env-vars NODE_ENV=production,APP_ENV=production,PORT=8080 \
    --timeout 900 \
    --concurrency 1000

echo "✅ Deployment complete!"
echo "🌐 Your service is available at:"
gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)'

echo ""
echo "🔍 To check logs:"
echo "gcloud logging read \"resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME\" --limit 50"
