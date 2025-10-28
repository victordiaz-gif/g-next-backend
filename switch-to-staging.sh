#!/bin/bash

# Script para cambiar a la base de datos de staging
echo "🔄 Cambiando a la base de datos de staging..."

# Hacer backup del .env actual
cp .env .env.local.backup

# Crear nuevo .env para staging
cat > .env << 'EOF'
# Configuración para Staging - Google Cloud SQL
APP_ENV=staging
NODE_ENV=production
PORT=3002

# Base de datos Cloud SQL
DB_TYPE=postgres
DB_HOST=34.171.38.108
DB_PORT=5432
DB_NAME=g-next-db
DB_USERNAME=postgres
DB_PASSWORD=yAXHq2BZB0Hu8NENFJTIBA
DB_SCHEMA=public

# Autenticación
SUPERADMIN_USERNAME=superadmin
SUPERADMIN_PASSWORD=superadmin
COOKIE_SECRET=your-cookie-secret-here-change-this-in-production

# Email
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Elasticsearch
ELASTICSEARCH_HOST=http://localhost
ELASTICSEARCH_PORT=9200

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Admin UI
ADMIN_UI_API_HOST=http://localhost:3002
EOF

echo "✅ Configuración actualizada para staging"
echo "📊 Base de datos: g-next-db en Cloud SQL"
echo "🌐 Host: 34.171.38.108:5432"
echo ""
echo "Para volver a local, ejecuta: ./switch-to-local.sh"

