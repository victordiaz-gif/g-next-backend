#!/bin/bash
# Setup script for Google Cloud VM dedicated to product import
# Run on the VM after creating it

set -e

echo "🚀 Setting up VM for product import job..."
echo "=========================================="

# Configuration variables
REPO_URL="https://github.com/victordiaz-gif/g-next-backend.git"
PROJECT_DIR="~/g-next-backend"
NODE_VERSION="18"  # or the version you use
USER_HOME=$(eval echo ~$USER)

echo "📦 Installing system dependencies..."

# Update system
sudo apt-get update -y
sudo apt-get upgrade -y

# Install basic dependencies
sudo apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release

# Install Node.js via nvm (recommended for specific versions)
echo "📦 Installing Node.js via nvm..."
if [ ! -d "$USER_HOME/.nvm" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$USER_HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install $NODE_VERSION
    nvm use $NODE_VERSION
    nvm alias default $NODE_VERSION
else
    export NVM_DIR="$USER_HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# Verify installation
node --version
npm --version

# Install pnpm globally
echo "📦 Installing pnpm..."
npm install -g pnpm

# Install screen to run jobs in background
sudo apt-get install -y screen

# Clone repository
echo "📥 Cloning repository..."
if [ ! -d "$PROJECT_DIR" ]; then
    cd ~
    git clone $REPO_URL g-next-backend
    cd g-next-backend
else
    cd $PROJECT_DIR
    git pull
fi

# Install project dependencies
echo "📦 Installing project dependencies..."
pnpm install

# Create .env file if it doesn't exist
echo "📝 Setting up environment file..."
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from template..."
    if [ -f "env.production.example" ]; then
        cp env.production.example .env
        echo "✅ Created .env from template. Please edit it with your production credentials!"
    else
        echo "❌ env.production.example not found. Please create .env manually."
    fi
fi

# Create directory for logs
mkdir -p logs

# Install cloud-sql-proxy if needed
echo "📦 Installing Cloud SQL Proxy..."
if [ ! -f "/usr/local/bin/cloud_sql_proxy" ]; then
    wget https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 -O /tmp/cloud_sql_proxy
    sudo mv /tmp/cloud_sql_proxy /usr/local/bin/cloud_sql_proxy
    sudo chmod +x /usr/local/bin/cloud_sql_proxy
fi

# Create helper script to run import
echo "📝 Creating helper scripts..."
cat > ~/run-import.sh << 'EOFSCRIPT'
#!/bin/bash
# Helper script to run import in background

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/g-next-backend"

# Verify that .env exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found!"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Create screen session for import
SCREEN_NAME="vendure-import-$(date +%Y%m%d-%H%M%S)"
LOG_FILE="logs/import-$(date +%Y%m%d-%H%M%S).log"

echo "🚀 Starting import job in screen session: $SCREEN_NAME"
echo "📝 Logs will be saved to: $LOG_FILE"

screen -dmS $SCREEN_NAME bash -c "
    cd $SCRIPT_DIR/g-next-backend && \
    export NVM_DIR=\"$HOME/.nvm\" && \
    [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\" && \
    pnpm run import:products:1m 2>&1 | tee $LOG_FILE
"

echo "✅ Job started in screen session: $SCREEN_NAME"
echo "📝 To view logs: tail -f $LOG_FILE"
echo "📝 To attach to screen: screen -r $SCREEN_NAME"
echo "📝 To list all screens: screen -ls"
EOFSCRIPT

chmod +x ~/run-import.sh

# Create monitoring script
cat > ~/monitor-import.sh << 'EOFSCRIPT'
#!/bin/bash
# Script to monitor running import

echo "📊 Monitoring import jobs..."
echo "=============================="

# Show active screens
echo "🖥️  Active screen sessions:"
screen -ls | grep vendure-import || echo "No active import sessions"

# Show latest logs
echo ""
echo "📝 Latest logs:"
find ~/g-next-backend/logs -name "import-*.log" -type f -mmin -60 | head -1 | xargs tail -n 20 2>/dev/null || echo "No recent logs found"

# Show resource usage
echo ""
echo "💻 System resources:"
echo "CPU: $(top -bn1 | grep 'Cpu(s)' | awk '{print $2}')"
echo "Memory: $(free -h | awk '/^Mem:/ {print $3 "/" $2}')"
echo "Disk: $(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 " used)"}')"
EOFSCRIPT

chmod +x ~/monitor-import.sh

echo ""
echo "✅ Setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Edit .env file with your production credentials:"
echo "   cd $PROJECT_DIR && nano .env"
echo ""
echo "2. Run the import job:"
echo "   ~/run-import.sh"
echo ""
echo "3. Monitor the job:"
echo "   ~/monitor-import.sh"
echo ""
echo "4. View logs in real-time:"
echo "   tail -f ~/g-next-backend/logs/import-*.log"
echo ""
echo "5. Attach to screen session (to see output):"
echo "   screen -r <session-name>"
echo "   (Press Ctrl+A then D to detach without stopping)"
echo ""
echo "6. List all screens:"
echo "   screen -ls"
echo ""
echo "7. Kill a screen session:"
echo "   screen -X -S <session-name> quit"

