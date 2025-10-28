# 🚀 Guía de Deployment - Glass Next Vendure Backend

## 📋 Tabla de Contenidos

1. [Setup Local](#setup-local)
2. [Variables de Entorno](#variables-de-entorno)
3. [Deployment a Google Cloud](#deployment-a-google-cloud)
4. [Troubleshooting](#troubleshooting)

---

## 🛠️ Setup Local

### Requisitos Previos

- Node.js 20+
- Docker y Docker Compose
- Google Cloud SDK (para deployment)
- Git

### Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/g-next-backend.git
cd glass-next-vendure-backend

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno (ver sección siguiente)
cp env.development.example .env

# 4. Iniciar servicios (PostgreSQL, Redis, Elasticsearch)
docker-compose up -d postgres_db redis elasticsearch

# 5. Inicializar base de datos
npm run init-db

# 6. Iniciar servidor de desarrollo
npm run dev
```

---

## 📝 Variables de Entorno

### Desarrollo

**Archivo**: `env.development.example`

```bash
# Copiar al .env para desarrollo
cp env.development.example .env
```

**Variables de Desarrollo:**

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `APP_ENV` | `dev` | Entorno de aplicación |
| `NODE_ENV` | `development` | Entorno de Node.js |
| `PORT` | `3002` | Puerto del servidor |
| `DB_HOST` | `localhost` | Host de PostgreSQL |
| `DB_PORT` | `6543` | Puerto de PostgreSQL |
| `DB_NAME` | `vendure` | Nombre de la base de datos |
| `DB_USERNAME` | `vendure` | Usuario de PostgreSQL |
| `DB_PASSWORD` | `yAXHq2BZB0Hu8NENFJTIBA` | Password de PostgreSQL |
| `ELASTICSEARCH_HOST` | `localhost` | Host de Elasticsearch |
| `ELASTICSEARCH_PORT` | `9300` | Puerto de Elasticsearch |
| `REDIS_HOST` | `localhost` | Host de Redis |
| `REDIS_PORT` | `6479` | Puerto de Redis |

### Producción

**Archivo**: `env.production.example`

⚠️ **IMPORTANTE**: Nunca subir el archivo `.env.production` real al repositorio.

**Variables de Producción:**

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `APP_ENV` | `production` | Entorno de aplicación |
| `NODE_ENV` | `production` | Entorno de Node.js |
| `PORT` | `8080` | Puerto del servidor (Cloud Run) |
| `DB_HOST` | `34.171.38.108` | IP de Cloud SQL |
| `DB_PORT` | `5432` | Puerto de Cloud SQL |
| `DB_NAME` | `vendure` | Nombre de la base de datos |
| `DB_USERNAME` | `vendure` | Usuario de PostgreSQL |
| `DB_PASSWORD` | `[SECRETO]` | ⚠️ Password real (no compartir) |
| `ELASTICSEARCH_HOST` | `http://34.27.160.130` | Host de Elasticsearch |
| `ELASTICSEARCH_PORT` | `9200` | Puerto de Elasticsearch |
| `REDIS_HOST` | `localhost` | Host de Redis |
| `FRONTEND_URL` | `https://gcommerce.glass` | URL del frontend |
| `ADMIN_UI_API_HOST` | `https://vendure-backend-...us-central1.run.app` | URL del backend |

---

## ☁️ Deployment a Google Cloud

### Prerequisitos

```bash
# 1. Instalar Google Cloud SDK
# macOS
brew install --cask google-cloud-sdk

# 2. Autenticarse
gcloud auth login

# 3. Configurar proyecto
gcloud config set project glass-next

# 4. Verificar
gcloud config get-value project
```

### Opción 1: Deployment Automático con Cloud Build (RECOMENDADO)

```bash
cd glass-next-vendure-backend

# 1. Commit tus cambios
git add .
git commit -m "Your commit message"
git push origin main

# 2. Deploy automático
gcloud builds submit --config cloudbuild.yaml --region=us-central1
```

**Tiempo estimado**: 10-15 minutos

### Opción 2: Deployment Manual

```bash
# 1. Build y push la imagen
gcloud builds submit --tag gcr.io/glass-next/vendure-backend

# 2. Deploy a Cloud Run
gcloud run deploy vendure-backend \
    --image gcr.io/glass-next/vendure-backend \
    --platform managed \
    --region us-central1 \
    --port 8080 \
    --memory 2Gi \
    --cpu 1 \
    --max-instances 10 \
    --min-instances 0 \
    --timeout 900 \
    --set-env-vars "NODE_ENV=production,APP_ENV=production,DB_TYPE=postgres,DB_HOST=34.171.38.108,DB_PORT=5432,DB_NAME=vendure,DB_USERNAME=vendure,DB_PASSWORD=YOUR_PASSWORD,DB_SCHEMA=public,SUPERADMIN_USERNAME=superadmin,SUPERADMIN_PASSWORD=superadmin,COOKIE_SECRET=YOUR_COOKIE_SECRET,INIT_DB=true,ELASTICSEARCH_HOST=http://34.27.160.130,ELASTICSEARCH_PORT=9200,REDIS_HOST=localhost,REDIS_PORT=6379,ADMIN_UI_API_HOST=https://vendure-backend-393513168568.us-central1.run.app,FRONTEND_URL=https://gcommerce.glass"
```

### Verificación Post-Deployment

```bash
# 1. Ver estado del servicio
gcloud run services describe vendure-backend --region=us-central1

# 2. Ver logs
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=vendure-backend"

# 3. Test la API
curl https://vendure-backend-393513168568.us-central1.run.app/shop-api
```

---

## 🔧 Troubleshooting

### Problema: Build exitoso pero Deploy falla

**Síntoma**: "Container failed to start"

**Causa común**: Variables de entorno incorrectas o conexión a base de datos falla

**Solución**:
```bash
# Ver logs del contenedor
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=vendure-backend" --limit 50

# Verificar variables de entorno
gcloud run services describe vendure-backend --region=us-central1 \
    --format="get(spec.template.spec.containers[0].env)"
```

### Problema: Password authentication failed

**Síntoma**: `error: password authentication failed for user "vendure"`

**Solución**: Verificar que el password en `cloudbuild.yaml` sea correcto
```bash
# Verificar password en Cloud Build
cat cloudbuild.yaml | grep DB_PASSWORD

# Verificar usuarios en Cloud SQL
gcloud sql users list --instance=vendure-db
```

### Problema: CORS Error en Frontend

**Síntoma**: Error FORBIDDEN o CORS error

**Solución**: Verificar que `FRONTEND_URL` esté configurado en CORS
```bash
# Ver configuración de CORS en logs
gcloud logging read "resource.type=cloud_run_revision" --limit 100 \
    | grep -i "cors\|origin"
```

### Problema: Puerto 443 vs 8080

**Síntoma**: "PORT=443 environment variable"

**Solución**: Cloud Run maneja PORT automáticamente. No definir PORT en env vars.

```yaml
# ❌ INCORRECTO
--set-env-vars="PORT=8080,..."

# ✅ CORRECTO
--port=8080
```

---

## 📊 URLs Importantes

### Producción

- **Backend**: https://vendure-backend-393513168568.us-central1.run.app
- **Shop API**: https://vendure-backend-393513168568.us-central1.run.app/shop-api
- **Admin API**: https://vendure-backend-393513168568.us-central1.run.app/admin-api
- **Admin UI**: https://vendure-backend-393513168568.us-central1.run.app/admin
- **Frontend**: https://gcommerce.glass

### Desarrollo Local

- **Server**: http://localhost:3002
- **Shop API**: http://localhost:3002/shop-api
- **Admin API**: http://localhost:3002/admin-api
- **Admin UI**: http://localhost:3002/admin
- **GraphiQL**: http://localhost:3002/graphiql

---

## 🔐 Seguridad

### ❌ NUNCA Subir al Repositorio

- `.env` (archivo real con contraseñas)
- `.env.production` (contraseñas de producción)
- `cloud_sql_proxy`
- Credenciales de Google Cloud
- API keys

### ✅ SÍ Subir

- `env.development.example` (template sin contraseñas)
- `env.production.example` (template sin contraseñas reales)
- `cloudbuild.yaml` (CON contraseñas deproducción - necesario para deploy)
- `.gitignore` (actualizado)

---

## 📋 Checklist de Deployment

### Antes de Deployar

- [ ] Variables de entorno actualizadas
- [ ] Build local exitoso (`npm run build`)
- [ ] Tests pasan
- [ ] Git commiteado
- [ ] Código pushed a GitHub

### Durante Deploy

- [ ] Cloud Build inicia
- [ ] Build de Docker completado
- [ ] Imagen pusheada a registry
- [ ] Deploy a Cloud Run exitoso
- [ ] Servicio en estado "Ready"

### Después de Deploy

- [ ] API responde correctamente
- [ ] Logs sin errores
- [ ] Frontend puede conectarse
- [ ] Login funciona
- [ ] Buyer Dashboard muestra datos

---

## 🎯 Comandos Rápidos

```bash
# Ver último build
gcloud builds list --limit=1

# Ver logs del servicio
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=vendure-backend"

# Verificar servicio
gcloud run services describe vendure-backend --region=us-central1

# Test API
curl https://vendure-backend-393513168568.us-central1.run.app/shop-api

# Ver revisiones
gcloud run revisions list --service=vendure-backend --region=us-central1
```

---

## 📖 Documentación Relacionada

- [Vendure Docs](https://www.vendure.io/docs)
- [Cloud Run Docs](https://cloud.google.com/run/docs)
- [Cloud Build Docs](https://cloud.google.com/build/docs)

