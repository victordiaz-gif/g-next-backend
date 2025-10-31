# Guide: Setting up VM for Product Import

## 🎯 Objective

Create a virtual machine in Google Cloud dedicated exclusively to running the product import job in the background, freeing up your local computer.

## 📋 Prerequisites

1. **Google Cloud SDK** installed and configured
2. **Authentication** in Google Cloud: `gcloud auth login`
3. **Permissions** to create VMs in the project
4. **Budget** estimated: ~$20 USD for a VM running 24 hours (depending on machine type)

## 🖥️ Recommended VM Specifications

### For 1 Million Products:

**Option 1: Conservative (Recommended to start)**
- **Type**: `n1-standard-2`
- **vCPUs**: 2
- **RAM**: 7.5 GB
- **Disk**: 50 GB SSD
- **Cost**: ~$0.10/hour (~$2.40/day)

**Option 2: Optimized (Faster)**
- **Type**: `n1-standard-4`
- **vCPUs**: 4
- **RAM**: 15 GB
- **Disk**: 50 GB SSD
- **Cost**: ~$0.20/hour (~$4.80/day)

**Option 3: Maximum Performance**
- **Type**: `n1-standard-8`
- **vCPUs**: 8
- **RAM**: 30 GB
- **Disk**: 100 GB SSD
- **Cost**: ~$0.40/hour (~$9.60/day)

## 🚀 Setup Steps

### Step 1: Create the VM

From your local machine, run:

```bash
# Give execution permissions
chmod +x scripts/create-vm-import.sh

# Create the VM
./scripts/create-vm-import.sh
```

Or manually:

```bash
gcloud compute instances create vendure-import-worker \
    --zone=us-central1-a \
    --machine-type=n1-standard-4 \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=50GB \
    --boot-disk-type=pd-ssd \
    --tags=import-worker
```

### Step 2: Connect to the VM

```bash
gcloud compute ssh vendure-import-worker --zone=us-central1-a
```

### Step 3: Run Setup Script

Inside the VM:

```bash
# Clone the repository
git clone https://github.com/victordiaz-gif/g-next-backend.git
cd g-next-backend

# Run setup
bash scripts/setup-vm-import.sh
```

The script will install:
- Node.js 18 (via nvm)
- pnpm
- screen (to run in background)
- Cloud SQL Proxy (if needed)
- Project dependencies

### Step 4: Configure Environment Variables

```bash
cd ~/g-next-backend

# Copy template
cp env.production.example .env

# Edit with your credentials
nano .env
```

**Critical variables to configure:**
- `DB_HOST`: Your Cloud SQL IP
- `DB_PASSWORD`: Database password
- `DB_USERNAME`: Database user
- `DB_NAME`: Database name
- `ELASTICSEARCH_HOST`: Your Elasticsearch VM IP (if applicable)

### Step 5: Run Import in Background

```bash
# Option 1: Using the helper script
~/run-import.sh

# Option 2: Manually
cd ~/g-next-backend
screen -dmS vendure-import bash -c "pnpm run import:products:vm TARGET_PRODUCTS=5000000 2>&1 | tee logs/import-$(date +%Y%m%d-%H%M%S).log"
```

### Step 6: Monitor Progress

```bash
# View logs in real-time
tail -f ~/g-next-backend/logs/import-*.log

# Monitor system
~/monitor-import.sh

# View active screen sessions
screen -ls

# Connect to session (to see output)
screen -r vendure-import-*
# Press Ctrl+A then D to disconnect without stopping
```

## 🔧 Useful Commands

### Screen Session Management

```bash
# List all sessions
screen -ls

# Connect to a session
screen -r vendure-import-YYYYMMDD-HHMMSS

# Disconnect (without stopping): Ctrl+A, then D

# Stop import: Inside screen, Ctrl+C

# Kill a session from outside
screen -X -S vendure-import-YYYYMMDD-HHMMSS quit
```

### Monitoring

```bash
# View logs in real-time
tail -f ~/g-next-backend/logs/import-*.log

# View last 100 lines
tail -n 100 ~/g-next-backend/logs/import-*.log

# Search for errors
grep -i error ~/g-next-backend/logs/import-*.log

# View progress
tail -f ~/g-next-backend/logs/import-*.log | grep -E "Progress Report|Speed:"
```

### VM Management

```bash
# From your local machine:

# Stop VM (saves costs)
gcloud compute instances stop vendure-import-worker --zone=us-central1-a

# Start VM
gcloud compute instances start vendure-import-worker --zone=us-central1-a

# Delete VM (when import is done)
gcloud compute instances delete vendure-import-worker --zone=us-central1-a
```

## ⚠️ Important Considerations

### 1. **DO NOT use the Elasticsearch VM**

**Reasons:**
- Elasticsearch requires dedicated resources
- The import job can affect ES performance
- Better separation of responsibilities

### 2. **Cloud SQL Connection**

If your Cloud SQL requires Cloud SQL Proxy:

```bash
# Install proxy (already included in setup script)
wget https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64
chmod +x cloud_sql_proxy
sudo mv cloud_sql_proxy /usr/local/bin/

# Run in background before import
screen -dmS cloud-sql-proxy bash -c "/usr/local/bin/cloud_sql_proxy -instances=PROJECT:REGION:INSTANCE=tcp:5432"
```

Then in `.env`:
```
DB_HOST=localhost
```

### 3. **Estimated Cost**

For a `n1-standard-4` VM running 24 hours:
- **Cost/day**: ~$4.80 USD
- **Cost/week**: ~$33.60 USD
- **Cost/month**: ~$144 USD (if running all month)

**Tip**: Stop the VM when import is done to save costs.

### 4. **Security**

- **Firewall**: Make sure the VM can connect to Cloud SQL
- **SSH Keys**: Use only SSH keys, no passwords
- **Environment variables**: Never commit `.env` to repository

### 5. **Resilience**

To ensure import continues if SSH disconnects:

```bash
# Use screen (already included in setup)
screen -dmS import-session pnpm run import:products:vm TARGET_PRODUCTS=5000000

# Or use nohup
nohup pnpm run import:products:vm TARGET_PRODUCTS=5000000 > logs/import.log 2>&1 &
```

## 🐛 Troubleshooting

### Problem: VM runs out of memory

**Solution:**
- Increase machine type: `n1-standard-4` → `n1-standard-8`
- Reduce `CONCURRENCY` in environment variables

### Problem: DB connections exhausted

**Solution:**
- Reduce `CONCURRENCY` (from 5 to 3)
- Check connection pool in Cloud SQL

### Problem: Import stops

**Solution:**
```bash
# Verify screen is still running
screen -ls

# Check logs for errors
tail -f logs/import-*.log | grep -i error

# Restart import if needed
screen -r vendure-import-*
# Ctrl+C to stop, then restart
```

### Problem: Cannot connect to Cloud SQL

**Solution:**
```bash
# Check Cloud SQL Proxy
ps aux | grep cloud_sql_proxy

# Check firewall rules
gcloud compute firewall-rules list --filter="name~allow-sql"
```

## 📊 Continuous Monitoring

To monitor progress without being connected:

```bash
# Create an automatic monitoring script
cat > ~/check-import.sh << 'EOF'
#!/bin/bash
tail -n 50 ~/g-next-backend/logs/import-*.log | grep -E "Progress Report|completed|Error"
EOF

chmod +x ~/check-import.sh

# Run every hour
watch -n 3600 ~/check-import.sh
```

## ✅ Post-Setup Checklist

- [ ] VM created and accessible
- [ ] Setup script executed successfully
- [ ] Environment variables configured (`.env`)
- [ ] Cloud SQL connection verified
- [ ] Import started in screen session
- [ ] Logs verified and working
- [ ] Monitoring configured
- [ ] Remember to stop VM when done to save costs
