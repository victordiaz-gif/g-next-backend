# 🚀 Automatic Import with VM

Scripts to create a VM in Google Cloud that automatically executes product import and shuts down when finished.

## ✅ Advantages over Cloud Run Jobs

- ✅ **Works like local**: No context/environment issues
- ✅ **No time limits**: Can run for days if necessary
- ✅ **Full control**: Direct SSH, local logs, easy debugging
- ✅ **More resources**: Can use larger machines if needed
- ✅ **Automatic shutdown**: VM shuts down automatically when finished
- ✅ **More economical**: For long jobs (24+ hours) it's cheaper than Cloud Run

## 📋 Quick Usage

### 1. Create VM and run import automatically

```bash
# For 5 million products (default)
./scripts/create-vm-auto-import.sh

# Customize parameters
./scripts/create-vm-auto-import.sh 5000000 500 5
# Parameters: TARGET_PRODUCTS BATCH_SIZE CONCURRENCY
```

### 2. Monitor progress

```bash
# Monitor the latest VM
./scripts/monitor-vm-import.sh

# Monitor specific VM
./scripts/monitor-vm-import.sh vendure-import-auto-1234567890
```

### 3. View logs in real-time

```bash
VM_NAME="vendure-import-auto-XXXX"  # Replace with actual name
gcloud compute ssh $VM_NAME --zone=us-central1-a --command='tail -f /var/log/import.log'
```

## 🔧 Configuration

The script uses these default values (modifiable in the script):

- **VM Type**: `n1-standard-4` (4 vCPUs, 15GB RAM)
- **Disk**: 50GB SSD
- **Target Products**: 5,000,000
- **Batch Size**: 500
- **Concurrency**: 5

## 💰 Estimated Costs

For `n1-standard-4`:
- **Cost/hour**: ~$0.20 USD
- **5 million products** (~28 hours at 3000 products/sec): ~$5.60 USD
- **1 million products** (~6 hours): ~$1.20 USD

## 📊 Monitoring

### View VM status

```bash
gcloud compute instances list --filter="name~vendure-import-auto"
```

### View logs from your machine

```bash
VM_NAME="vendure-import-auto-XXXX"
gcloud compute ssh $VM_NAME --zone=us-central1-a --command='cat /var/log/import.log'
```

### Connect via SSH (if you need debugging)

```bash
gcloud compute ssh $VM_NAME --zone=us-central1-a
```

## 🛑 Stop/Delete VM

### Stop VM (can resume later)

```bash
gcloud compute instances stop $VM_NAME --zone=us-central1-a
```

### Delete VM (when everything is done)

```bash
gcloud compute instances delete $VM_NAME --zone=us-central1-a
```

## ⚠️ Important

1. **VM shuts down automatically** when import completes
2. **Logs are saved** in `/var/log/import.log` inside the VM
3. **Script uses the VM-specific script** `import-products-vm.ts` that accepts environment variables
4. **Direct connection to Cloud SQL** by IP (no proxy needed)

## 🐛 Troubleshooting

### VM doesn't start

```bash
# View VM events
gcloud compute instances get-serial-port-output $VM_NAME --zone=us-central1-a
```

### Import fails

```bash
# SSH and check logs
gcloud compute ssh $VM_NAME --zone=us-central1-a
cat /var/log/import.log
```

### VM doesn't shut down automatically

```bash
# Shut down manually
gcloud compute instances stop $VM_NAME --zone=us-central1-a
```

## 📝 Notes

- The VM uses the **VM-specific script** `import-products-vm.ts` that supports environment variables
- All environment variables are automatically configured
- Repository is cloned from GitHub in the VM
- VM disk is automatically deleted when stopped (auto-delete disk)
