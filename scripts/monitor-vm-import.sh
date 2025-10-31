#!/bin/bash
# Script to monitor the import progress in the VM

set -e

VM_NAME="${1:-vendure-import-auto-*}"
ZONE="${2:-us-central1-a}"

echo "📊 Monitoring VM Import Progress..."
echo "========================================"

# Find the most recent VM if exact name is not specified
if [[ "$VM_NAME" == *"*"* ]]; then
    LATEST_VM=$(gcloud compute instances list --filter="name~vendure-import-auto AND status:RUNNING" --format="value(name)" --sort-by="~creationTimestamp" | head -1)
    if [ -z "$LATEST_VM" ]; then
        echo "❌ No running import VM found"
        exit 1
    fi
    VM_NAME="$LATEST_VM"
    echo "📋 Using VM: $VM_NAME"
fi

echo ""
echo "🔄 Checking VM status..."
STATUS=$(gcloud compute instances describe $VM_NAME --zone=$ZONE --format='value(status)' 2>/dev/null || echo "NOT_FOUND")

if [ "$STATUS" == "NOT_FOUND" ]; then
    echo "❌ VM not found: $VM_NAME"
    exit 1
fi

echo "Status: $STATUS"
echo ""

if [ "$STATUS" == "RUNNING" ]; then
    echo "📊 Getting latest logs (last 50 lines)..."
    echo "----------------------------------------"
    gcloud compute ssh $VM_NAME --zone=$ZONE --command="tail -50 /var/log/import.log 2>/dev/null || echo 'Log file not created yet. Import may still be initializing...'" 2>/dev/null || echo "Waiting for VM to be ready..."
    echo ""
    echo "💡 To stream logs in real-time, run:"
    echo "   gcloud compute ssh $VM_NAME --zone=$ZONE --command='tail -f /var/log/import.log'"
elif [ "$STATUS" == "TERMINATED" ]; then
    echo "✅ VM has been shut down (import completed or stopped)"
    echo ""
    echo "📋 Getting final logs..."
    echo "----------------------------------------"
    # If the VM is shut down, we need to start it temporarily or copy logs before
    echo "Note: VM is terminated. To view logs, VM needs to be started."
    echo "   gcloud compute instances start $VM_NAME --zone=$ZONE"
    echo "   gcloud compute ssh $VM_NAME --zone=$ZONE --command='cat /var/log/import.log'"
else
    echo "Status: $STATUS"
fi

echo ""
echo "📈 VM Information:"
gcloud compute instances describe $VM_NAME --zone=$ZONE --format="table(name,status,machineType,creationTimestamp)" 2>/dev/null || true

