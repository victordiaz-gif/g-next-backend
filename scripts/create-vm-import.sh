#!/bin/bash
# Script to create VM in Google Cloud dedicated to product import
# Run from your local machine with gcloud CLI installed

set -e

# Configuration variables
PROJECT_ID="glass-next"  # Change if different
ZONE="us-central1-a"    # Zone where to create the VM
REGION="us-central1"
VM_NAME="vendure-import-worker"
MACHINE_TYPE="n1-standard-4"  # 4 vCPUs, 15GB RAM (adjustable)
DISK_SIZE="50"               # GB
DISK_TYPE="pd-ssd"           # SSD
IMAGE_FAMILY="ubuntu-2204-lts"
IMAGE_PROJECT="ubuntu-os-cloud"

echo "🚀 Creating VM for product import job..."
echo "========================================"

# Verify that gcloud is installed
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

# Create the VM
echo "🖥️  Creating VM: $VM_NAME"
echo "   Machine Type: $MACHINE_TYPE"
echo "   Zone: $ZONE"
echo "   Disk: ${DISK_SIZE}GB $DISK_TYPE"

gcloud compute instances create $VM_NAME \
    --zone=$ZONE \
    --machine-type=$MACHINE_TYPE \
    --network-interface=network-tier=PREMIUM,stack-type=IPV4_IPV6,subnet=default \
    --maintenance-policy=MIGRATE \
    --provisioning-model=STANDARD \
    --service-account=$(gcloud iam service-accounts list --filter="email ~ compute.*" --format="value(email)" | head -1) \
    --scopes=https://www.googleapis.com/auth/cloud-platform \
    --tags=http-server,https-server \
    --create-disk=auto-delete=yes,boot=yes,device-name=$VM_NAME,image=projects/$IMAGE_PROJECT/global/images/family/$IMAGE_FAMILY,mode=rw,size=$DISK_SIZE,type=projects/$PROJECT_ID/zones/$ZONE/diskTypes/$DISK_TYPE \
    --no-shielded-secure-boot \
    --shielded-vtpm \
    --shielded-integrity-monitoring \
    --labels=env=production,service=vendure-import \
    --reservation-affinity=any

echo ""
echo "✅ VM created successfully!"
echo ""
echo "📋 Next steps:"
echo "1. SSH into the VM:"
echo "   gcloud compute ssh $VM_NAME --zone=$ZONE"
echo ""
echo "2. Once connected, run the setup script:"
echo "   curl -fsSL https://raw.githubusercontent.com/victordiaz-gif/g-next-backend/main/scripts/setup-vm-import.sh | bash"
echo ""
echo "   Or clone the repo and run it manually:"
echo "   git clone https://github.com/victordiaz-gif/g-next-backend.git"
echo "   cd g-next-backend"
echo "   bash scripts/setup-vm-import.sh"
echo ""
echo "3. Configure firewall (if needed):"
echo "   gcloud compute firewall-rules create allow-http --allow tcp:80 --source-ranges 0.0.0.0/0"
echo ""
echo "4. Get VM external IP:"
echo "   gcloud compute instances describe $VM_NAME --zone=$ZONE --format='get(networkInterfaces[0].accessConfigs[0].natIP)'"
echo ""
echo "💡 VM Information:"
gcloud compute instances describe $VM_NAME --zone=$ZONE --format="table(name,status,machineType,zone)" || true

