# 🚀 Google Cloud Run Deployment Guide

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js       │    │   Vendure       │    │   Cloud SQL     │
│   Frontend      │◄──►│   Backend       │◄──►│   PostgreSQL    │
│   (Cloud Run)   │    │   (Cloud Run)   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Cloud CDN     │    │   Cloud Build   │    │   Cloud         │
│   (Static)      │    │   (CI/CD)       │    │   Memorystore   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Prerequisites

1. **Google Cloud SDK** installed
2. **Docker** installed
3. **Git** repository set up
4. **Google Cloud Project** created

## Setup Steps

### 1. Install Google Cloud SDK

```bash
# macOS
brew install --cask google-cloud-sdk

# Or download from: https://cloud.google.com/sdk/docs/install
```

### 2. Authenticate and Configure

```bash
# Login to Google Cloud
gcloud auth login

# Set your project
gcloud config set project glass-next

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable redis.googleapis.com
gcloud services enable container.googleapis.com
```

### 3. Create Cloud SQL Database

```bash
# Create Cloud SQL instance
gcloud sql instances create vendure-db \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=us-central1 \
    --root-password=YAXNqZB2DBu8NENFJTIBA

# Create database
gcloud sql databases create vendure --instance=vendure-db

# Create user
gcloud sql users create vendure \
    --instance=vendure-db \
    --password=YAXNqZB2DBu8NENFJTIBA
```

### 4. Create Redis Instance (Optional)

```bash
# Create Redis instance
gcloud redis instances create vendure-redis \
    --size=1 \
    --region=us-central1 \
    --redis-version=redis_7_0
```

### 5. Set Up CI/CD

#### Option A: GitHub Actions (Recommended)

1. **Create Service Account**:
```bash
# Create service account
gcloud iam service-accounts create vendure-deploy \
    --display-name="Vendure Deploy Service Account"

# Grant necessary permissions
gcloud projects add-iam-policy-binding glass-next \
    --member="serviceAccount:vendure-deploy@glass-next.iam.gserviceaccount.com" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding glass-next \
    --member="serviceAccount:vendure-deploy@glass-next.iam.gserviceaccount.com" \
    --role="roles/storage.admin"

gcloud projects add-iam-policy-binding glass-next \
    --member="serviceAccount:vendure-deploy@glass-next.iam.gserviceaccount.com" \
    --role="roles/cloudbuild.builds.builder"

# Create and download key
gcloud iam service-accounts keys create vendure-deploy-key.json \
    --iam-account=vendure-deploy@glass-next.iam.gserviceaccount.com
```

2. **Add to GitHub Secrets**:
   - Go to your GitHub repository
   - Settings → Secrets and variables → Actions
   - Add `GCP_SA_KEY` with the content of `vendure-deploy-key.json`

#### Option B: Cloud Build

```bash
# Create cloudbuild.yaml (already created)
# Trigger build
gcloud builds submit --config cloudbuild.yaml
```

### 6. Deploy Manually (First Time)

```bash
# Build and push image
gcloud builds submit --tag gcr.io/glass-next/vendure-backend

# Deploy to Cloud Run
gcloud run deploy vendure-backend \
    --image gcr.io/glass-next/vendure-backend \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --port 8080 \
    --memory 2Gi \
    --cpu 1 \
    --max-instances 10 \
    --min-instances 0 \
    --set-env-vars NODE_ENV=production,APP_ENV=production,PORT=8080
```

### 7. Set Up Environment Variables

```bash
# Update environment variables
gcloud run services update vendure-backend \
    --region us-central1 \
    --set-env-vars "DB_HOST=/cloudsql/glass-next:us-central1:vendure-db,DB_PASSWORD=YAXNqZB2DBu8NENFJTIBA,DB_USERNAME=vendure,DB_NAME=vendure,DB_TYPE=postgres,DB_PORT=5432,DB_SCHEMA=public"
```

### 8. Run Database Migrations

```bash
# Create a job to run migrations
gcloud run jobs create migrate-db \
    --image gcr.io/glass-next/vendure-backend \
    --region us-central1 \
    --set-env-vars NODE_ENV=production,APP_ENV=production,DB_HOST=/cloudsql/glass-next:us-central1:vendure-db,DB_PASSWORD=YAXNqZB2DBu8NENFJTIBA,DB_USERNAME=vendure,DB_NAME=vendure,DB_TYPE=postgres,DB_PORT=5432,DB_SCHEMA=public \
    --command "npx" \
    --args "vendure,migrate,--run" \
    --max-retries 3

# Execute the job
gcloud run jobs execute migrate-db --region us-central1
```

## Development Workflow

### Local Development

```bash
# Start local development
npm run dev

# Test with production Docker setup
docker-compose -f docker-compose.prod.yml up
```

### CI/CD Workflow

1. **Push to `develop` branch** → Deploys to staging environment
2. **Push to `main` branch** → Deploys to production environment
3. **Create Pull Request** → Runs tests and builds

### Environment URLs

- **Production**: `https://vendure-backend-xxxxx-uc.a.run.app`
- **Staging**: `https://vendure-backend-staging-xxxxx-uc.a.run.app`

## Monitoring and Logging

### View Logs

```bash
# View logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=vendure-backend" --limit 50

# Follow logs
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=vendure-backend"
```

### Monitor Performance

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to Cloud Run
3. Select your service
4. View metrics, logs, and traces

## Troubleshooting

### Common Issues

1. **Database Connection Issues**:
   - Check Cloud SQL instance is running
   - Verify connection string format
   - Ensure proper IAM permissions

2. **Build Failures**:
   - Check Dockerfile syntax
   - Verify all dependencies are in package.json
   - Check build logs in Cloud Build

3. **Deployment Issues**:
   - Verify environment variables
   - Check service account permissions
   - Review Cloud Run logs

### Useful Commands

```bash
# Check service status
gcloud run services describe vendure-backend --region us-central1

# Update service
gcloud run services update vendure-backend --region us-central1

# Delete service
gcloud run services delete vendure-backend --region us-central1

# List all services
gcloud run services list --region us-central1
```

## Cost Optimization

1. **Set minimum instances to 0** (scales to zero when not in use)
2. **Use appropriate memory/CPU allocation**
3. **Enable Cloud CDN** for static assets
4. **Use Cloud SQL with appropriate tier**
5. **Monitor usage** with Cloud Billing

## Security Best Practices

1. **Use IAM roles** with least privilege
2. **Enable VPC** for private communication
3. **Use Cloud SQL private IP**
4. **Enable Cloud Armor** for DDoS protection
5. **Regular security updates**
