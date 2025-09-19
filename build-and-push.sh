#!/bin/bash

# Build and push script for Google Cloud Run
# Make sure you have Docker installed and are logged into Google Cloud

set -e

PROJECT_ID="glass-next"
SERVICE_NAME="vendure-backend"
REGION="us-central1"
IMAGE_TAG="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "🚀 Building and deploying Vendure backend to Google Cloud Run..."

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud SDK not found. Please install it first:"
    echo "   brew install --cask google-cloud-sdk"
    echo "   or visit: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "🔐 Please authenticate with Google Cloud:"
    gcloud auth login
fi

# Set the project
echo "📋 Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com

# Build and push the image
echo "🏗️  Building Docker image..."
gcloud builds submit --tag $IMAGE_TAG

# Deploy to Cloud Run
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
