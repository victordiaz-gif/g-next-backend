#!/bin/bash

# Simple Docker build script for local testing
# This builds the image locally for testing before pushing to Google Cloud

set -e

echo "🏗️  Building Vendure backend Docker image locally..."

# Build the Docker image
docker build -t vendure-backend:latest .

echo "✅ Docker image built successfully!"
echo "📋 Image: vendure-backend:latest"

# Test the image locally
echo "🧪 Testing the image locally..."
echo "   Run: docker run -p 8080:8080 vendure-backend:latest"
echo "   Then visit: http://localhost:8080/health"

# Show image details
echo "📊 Image details:"
docker images vendure-backend:latest
