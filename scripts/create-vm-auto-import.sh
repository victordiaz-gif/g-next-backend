#!/bin/bash
# Script to create VM in Google Cloud that automatically runs
# product import and shuts down when finished
#
# Usage: ./scripts/create-vm-auto-import.sh [TARGET_PRODUCTS] [BATCH_SIZE] [CONCURRENCY]

set -e

# Configuration variables
PROJECT_ID="glass-next"
ZONE="us-central1-a"
REGION="us-central1"
VM_NAME="vendure-import-auto-$(date +%s)"  # Unique name based on timestamp
MACHINE_TYPE="n1-standard-4"  # 4 vCPUs, 15GB RAM (adjustable as needed)
DISK_SIZE="50"
DISK_TYPE="pd-ssd"
IMAGE_FAMILY="ubuntu-2204-lts"
IMAGE_PROJECT="ubuntu-os-cloud"

# Import parameters (can be passed as arguments)
TARGET_PRODUCTS="${1:-5000000}"  # Default: 5 million
BATCH_SIZE="${2:-500}"
CONCURRENCY="${3:-5}"

# GitHub token (optional, for private repositories)
# You can pass it as environment variable: GITHUB_TOKEN=xxx ./scripts/create-vm-auto-import.sh
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

echo "🚀 Creating auto-import VM..."
echo "========================================"
echo "VM Name: $VM_NAME"
echo "Target Products: $TARGET_PRODUCTS"
echo "Batch Size: $BATCH_SIZE"
echo "Concurrency: $CONCURRENCY"
echo "Machine Type: $MACHINE_TYPE"
echo ""

# Verify gcloud
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI not found. Please install it first."
    exit 1
fi

# Check authentication
echo "🔍 Checking authentication..."
gcloud auth list --filter=status:ACTIVE --format="value(account)" || {
    echo "❌ Not authenticated. Please run: gcloud auth login"
    exit 1
}

# Set project
echo "📋 Setting project to: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# Get Cloud SQL IP (from cloudbuild.yaml or environment variables)
CLOUD_SQL_IP="${DB_HOST:-34.171.38.108}"
DB_NAME="${DB_NAME:-vendure}"
DB_USER="${DB_USERNAME:-vendure}"
DB_PASSWORD="${DB_PASSWORD:-yAXHq2BZB0Hu8NENFJTIBA}"

# Create startup script that runs automatically when VM starts
STARTUP_SCRIPT=$(cat <<EOF
#!/bin/bash
set -e

# Environment variables
export TARGET_PRODUCTS=${TARGET_PRODUCTS}
export BATCH_SIZE=${BATCH_SIZE}
export CONCURRENCY=${CONCURRENCY}
export NODE_ENV=production
export APP_ENV=production
export DB_TYPE=postgres
export DB_HOST=${CLOUD_SQL_IP}
export DB_PORT=5432
export DB_NAME=${DB_NAME}
export DB_USERNAME=${DB_USER}
export DB_PASSWORD=${DB_PASSWORD}
export DB_SCHEMA=public
export SUPERADMIN_USERNAME=superadmin
export SUPERADMIN_PASSWORD=superadmin
export ELASTICSEARCH_HOST=http://34.27.160.130
export ELASTICSEARCH_PORT=9200
export ADMIN_UI_API_HOST=https://vendure-backend-393513168568.us-central1.run.app
export FRONTEND_URL=https://gcommerce.glass

# Start log
echo "========================================" >> /var/log/import.log
echo "Import started at: \$(date)" >> /var/log/import.log
echo "Target products: \${TARGET_PRODUCTS}" >> /var/log/import.log
echo "Batch size: \${BATCH_SIZE}" >> /var/log/import.log
echo "Concurrency: \${CONCURRENCY}" >> /var/log/import.log
echo "========================================" >> /var/log/import.log

# Install dependencies
echo "[$(date)] Installing dependencies..." >> /var/log/import.log
apt-get update -qq
apt-get install -y -qq curl git build-essential

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >> /var/log/import.log 2>&1
apt-get install -y -qq nodejs >> /var/log/import.log 2>&1

# Install pnpm
npm install -g pnpm >> /var/log/import.log 2>&1

# Install ts-node and typescript globally (required to run TypeScript scripts)
npm install -g ts-node typescript >> /var/log/import.log 2>&1

# Clone repository using SSH (if configured) or create structure manually
echo "[$(date)] Setting up repository..." >> /var/log/import.log
cd /tmp
rm -rf glass-next-vendure-backend
mkdir -p glass-next-vendure-backend
cd glass-next-vendure-backend

# Configure Git to allow the directory (avoid permission error)
git config --global --add safe.directory /tmp/glass-next-vendure-backend

# Try to clone - first with token if exists, then direct HTTPS (for public repos)
GITHUB_TOKEN=$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/attributes/github_token" -H "Metadata-Flavor: Google" 2>/dev/null || echo "")

if [ -n "$GITHUB_TOKEN" ]; then
    echo "[$(date)] Cloning repository with GitHub token..." >> /var/log/import.log
    git clone https://${GITHUB_TOKEN}@github.com/victordiaz-gif/g-next-backend.git . >> /var/log/import.log 2>&1
else
    echo "[$(date)] Cloning repository via HTTPS (public repo)..." >> /var/log/import.log
    git clone https://github.com/victordiaz-gif/g-next-backend.git . >> /var/log/import.log 2>&1
fi

if [ $? -ne 0 ]; then
    echo "[$(date)] ERROR: Failed to clone repository." >> /var/log/import.log
    exit 1
fi

echo "[$(date)] Repository cloned successfully" >> /var/log/import.log

# Install project dependencies
echo "[$(date)] Installing project dependencies..." >> /var/log/import.log
# If pnpm-lock.yaml exists use frozen-lockfile, otherwise install normally
if [ -f "pnpm-lock.yaml" ]; then
    pnpm install --frozen-lockfile >> /var/log/import.log 2>&1
else
    pnpm install >> /var/log/import.log 2>&1
fi

# Install tsx (more modern and reliable than ts-node for running TypeScript)
echo "[$(date)] Installing tsx for TypeScript execution..." >> /var/log/import.log
pnpm add -D tsx >> /var/log/import.log 2>&1

# Run import using tsx (no compilation required)
echo "[$(date)] Starting product import with tsx..." >> /var/log/import.log
# Set environment variables for the script
export TARGET_PRODUCTS=${TARGET_PRODUCTS}
# Use tsx to run TypeScript directly (more reliable than ts-node)
TARGET_PRODUCTS=${TARGET_PRODUCTS} \
  pnpm exec tsx --node-options="--max-old-space-size=16384 --expose-gc" src/strees-test/import-products-vm.ts >> /var/log/import.log 2>&1

# Capture exit code
IMPORT_EXIT_CODE=\$?
echo "[$(date)] Import finished with exit code: \${IMPORT_EXIT_CODE}" >> /var/log/import.log

# Shut down VM automatically after completion
echo "[$(date)] Shutting down VM..." >> /var/log/import.log
shutdown -h +1 "Import completed. VM will shutdown in 1 minute."

EOF
)

# Save startup script temporarily
STARTUP_SCRIPT_FILE=$(mktemp)
echo "$STARTUP_SCRIPT" > "$STARTUP_SCRIPT_FILE"

echo "🖥️  Creating VM: $VM_NAME"
echo "   Machine Type: $MACHINE_TYPE"
echo "   Zone: $ZONE"
echo "   Disk: ${DISK_SIZE}GB $DISK_TYPE"
echo ""

# Create VM with startup script
gcloud compute instances create $VM_NAME \
    --zone=$ZONE \
    --machine-type=$MACHINE_TYPE \
    --network-interface=network-tier=PREMIUM,subnet=default \
    --maintenance-policy=MIGRATE \
    --provisioning-model=STANDARD \
    --service-account=$(gcloud iam service-accounts list --filter="email ~ compute.*" --format="value(email)" | head -1) \
    --scopes=https://www.googleapis.com/auth/cloud-platform \
    --tags=http-server,https-server \
    --create-disk=auto-delete=yes,boot=yes,device-name=$VM_NAME,image=projects/$IMAGE_PROJECT/global/images/family/$IMAGE_FAMILY,mode=rw,size=$DISK_SIZE,type=projects/$PROJECT_ID/zones/$ZONE/diskTypes/$DISK_TYPE \
    --no-shielded-secure-boot \
    --shielded-vtpm \
    --shielded-integrity-monitoring \
    --labels=env=production,service=vendure-import,auto-shutdown=true \
    --reservation-affinity=any \
    --metadata-from-file=startup-script="$STARTUP_SCRIPT_FILE" \
    --metadata=enable-oslogin=TRUE${GITHUB_TOKEN:+,github_token=$GITHUB_TOKEN}

# Clean up temporary file
rm "$STARTUP_SCRIPT_FILE"

echo ""
echo "✅ VM created successfully!"
echo ""
echo "📋 VM Information:"
gcloud compute instances describe $VM_NAME --zone=$ZONE --format="table(name,status,machineType,zone,networkInterfaces[0].accessConfigs[0].natIP)" || true

echo ""
echo "📊 Monitoring Commands:"
echo ""
echo "1. View real-time logs (SSH):"
echo "   gcloud compute ssh $VM_NAME --zone=$ZONE --command='tail -f /var/log/import.log'"
echo ""
echo "2. View logs from local machine:"
echo "   gcloud compute ssh $VM_NAME --zone=$ZONE --command='cat /var/log/import.log'"
echo ""
echo "3. Check VM status:"
echo "   gcloud compute instances describe $VM_NAME --zone=$ZONE --format='value(status)'"
echo ""
echo "4. Stop VM manually (if needed):"
echo "   gcloud compute instances stop $VM_NAME --zone=$ZONE"
echo ""
echo "5. Delete VM:"
echo "   gcloud compute instances delete $VM_NAME --zone=$ZONE"
echo ""
echo "💰 Estimated Cost:"
echo "   VM will run until import completes (~${TARGET_PRODUCTS} products)"
echo "   Estimated time: $(echo "scale=1; ${TARGET_PRODUCTS} / 3000 / 3600" | bc) hours"
COST_PER_HOUR="0.20"
ESTIMATED_HOURS=$(echo "scale=1; ${TARGET_PRODUCTS} / 3000 / 3600" | bc)
ESTIMATED_COST=$(echo "scale=2; ${COST_PER_HOUR} * ${ESTIMATED_HOURS}" | bc)
echo "   Estimated cost: \$${ESTIMATED_COST} USD"
echo ""
echo "✅ VM will automatically shutdown when import completes!"
echo ""

