# Glass Next Vendure Backend

This is a Vendure e-commerce backend with multivendor marketplace functionality, built with custom plugins for product sellers, marketplace payments, and Stripe integration.

## Features

- **Multivendor Marketplace**: Support for multiple sellers with individual channels
- **Product Sellers Plugin**: Manage product-seller relationships
- **Marketplace Payment Plugin**: Handle payments and payouts for multiple sellers
- **Stripe Integration**: Payment processing with Stripe
- **Elasticsearch**: Advanced search capabilities
- **Redis**: Caching and job queue management
- **PostgreSQL**: Primary database

## Quick Start

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- npm or pnpm

### 🚀 One-Command Setup (Recommended)

For a completely fresh setup, run this single command. Make sure you have docker up and running:

```bash
npm run setup
```

This will automatically:
1. Clean up any existing processes
2. Start Docker services (PostgreSQL, Redis, Elasticsearch)
3. Create the database schema (if empty)
4. Handle all migrations properly
5. Populate initial data
6. Stop after successful completion

After setup, run `npm run dev` to start the development server.

### Manual Setup (Alternative)

If you prefer to set up manually:

1. **Start Infrastructure Services**:
   ```bash
   docker-compose up -d postgres_db redis elasticsearch
   ```

2. **Create Environment File**:
   ```bash
   copy .env.example .env
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Initialize Database** (handles schema creation and migrations):
   ```bash
   npm run init-db
   ```

5. **Start Development Server**:
   ```bash
   npm run dev
   ```

The Vendure server will be available at:
- **Admin API**: http://localhost:3000/admin-api
- **Shop API**: http://localhost:3000/shop-api
- **Admin UI**: http://localhost:3000/admin
- **GraphiQL**: http://localhost:3000/graphiql

### Default Credentials

- **Superadmin Username**: `superadmin`
- **Superadmin Password**: `superadmin`

## Environment Configuration

The `.env.example` file contains all necessary environment variables. Copy it to `.env` and adjust as needed:

```env
# Application Environment
APP_ENV=dev
PORT=3000

# Database Configuration
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=6543
DB_NAME=vendure
DB_USERNAME=vendure
DB_PASSWORD=yAXHq2BZB0Hu8NENFJTIBA
DB_SCHEMA=public

# Authentication
SUPERADMIN_USERNAME=superadmin
SUPERADMIN_PASSWORD=superadmin
COOKIE_SECRET=your-cookie-secret-here-change-this-in-production

# Elasticsearch Configuration
ELASTICSEARCH_HOST=localhost
ELASTICSEARCH_PORT=9300

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6479
```

## Infrastructure Services

The following services are configured in `docker-compose.yml`:

- **PostgreSQL** (Port 6543): Primary database
- **Redis** (Port 6479): Caching and job queue
- **Elasticsearch** (Port 9300): Search engine

### Starting Services

```bash
# Start all infrastructure services
docker-compose up -d postgres_db redis elasticsearch

# Start individual services
docker-compose up -d postgres_db
docker-compose up -d redis
docker-compose up -d elasticsearch

# Stop all services
docker-compose down
```

## Development

### Available Scripts

```bash
# Development (runs both server and worker)
npm run dev

# Development server only
npm run dev:server

# Development worker only
npm run dev:worker

# Build for production
npm run build

# Start production server
npm run start

# Run database migrations
npx @vendure/cli migrate

# Populate initial data
npx @vendure/cli populate
```

### Database Management

```bash
# Generate new migration
npx @vendure/cli migrate

# Run migrations manually
npx @vendure/cli migrate

# Reset database (WARNING: This will delete all data)
npx @vendure/cli reset
```

## Custom Plugins

This project includes several custom plugins:

### 1. Multivendor Plugin (`src/plugins/multivendor/`)
- Manages multiple seller channels
- Handles order processing for different sellers
- Platform fee management

### 2. Product Sellers Plugin (`src/plugins/product-sellers/`)
- Associates products with sellers
- Manages seller-product relationships

### 3. Marketplace Payment Plugin (`src/plugins/marketplace-payment/`)
- Handles payments for multiple sellers
- Manages payouts and refunds
- Platform fee collection

## Production Deployment

### Using Docker (Infrastructure Only)

1. Start infrastructure services:
   ```bash
   docker-compose up -d postgres_db redis elasticsearch
   ```

2. Deploy Vendure application using your preferred method (PM2, systemd, etc.)

### Using Docker Compose (Full Stack)

For a complete Docker setup, uncomment the `vendure_backend` service in `docker-compose.yml` and run:

```bash
docker-compose up -d
```

## Troubleshooting

### Common Issues

1. **Database Connection Issues**:
   - Ensure PostgreSQL is running: `docker-compose ps postgres_db`
   - Check connection details in `.env` file
   - Verify port 6543 is not in use

2. **Elasticsearch Issues**:
   - Ensure Elasticsearch is running: `docker-compose ps elasticsearch`
   - Check if port 9300 is available
   - Wait for Elasticsearch to fully start (may take 1-2 minutes)

3. **Migration Errors**:
   - Ensure database is empty or run migrations manually
   - Check database permissions
   - Verify migration files are present in `src/migrations/`

4. **Port Conflicts**:
   - PostgreSQL: 6543
   - Redis: 6479
   - Elasticsearch: 9300
   - Vendure: 3000

### Logs

```bash
# View infrastructure logs
docker-compose logs postgres_db
docker-compose logs redis
docker-compose logs elasticsearch

# View all logs
docker-compose logs
```

## Useful Links

- [Vendure Documentation](https://www.vendure.io/docs)
- [Vendure Discord Community](https://www.vendure.io/community)
- [Vendure on GitHub](https://github.com/vendure-ecommerce/vendure)
- [Stripe Documentation](https://stripe.com/docs)

## Directory structure

* `/src` contains the source code of your Vendure server. All your custom code and plugins should reside here.
* `/static` contains static (non-code) files such as assets (e.g. uploaded images) and email templates.

## Development

```
npm run dev
```

will start the Vendure server and [worker](https://www.vendure.io/docs/developer-guide/vendure-worker/) processes from
the `src` directory.

## Build

```
npm run build
```

will compile the TypeScript sources into the `/dist` directory.

## Production

For production, there are many possibilities which depend on your operational requirements as well as your production
hosting environment.

### Running directly

You can run the built files directly with the `start` script:

```
npm run start
```

You could also consider using a process manager like [pm2](https://pm2.keymetrics.io/) to run and manage
the server & worker processes.

### Using Docker

We've included a sample [Dockerfile](./Dockerfile) which you can build with the following command:

```
docker build -t vendure .
```

This builds an image and tags it with the name "vendure". We can then run it with:

```
# Run the server
docker run -dp 3000:3000 -e "DB_HOST=host.docker.internal" --name vendure-server vendure npm run start:server

# Run the worker
docker run -dp 3000:3000 -e "DB_HOST=host.docker.internal" --name vendure-worker vendure npm run start:worker
```

Here is a breakdown of the command used above:

- `docker run` - run the image we created with `docker build`
- `-dp 3000:3000` - the `-d` flag means to run in "detached" mode, so it runs in the background and does not take
control of your terminal. `-p 3000:3000` means to expose port 3000 of the container (which is what Vendure listens
on by default) as port 3000 on your host machine.
- `-e "DB_HOST=host.docker.internal"` - the `-e` option allows you to define environment variables. In this case we
are setting the `DB_HOST` to point to a special DNS name that is created by Docker desktop which points to the IP of
the host machine. Note that `host.docker.internal` only exists in a Docker Desktop environment and thus should only be
used in development.
- `--name vendure-server` - we give the container a human-readable name.
- `vendure` - we are referencing the tag we set up during the build.
- `npm run start:server` - this last part is the actual command that should be run inside the container.

### Docker Compose

We've included a [docker-compose.yml](./docker-compose.yml) file which includes configuration for commonly-used
services such as PostgreSQL, MySQL, MariaDB, Elasticsearch and Redis.

To use Docker Compose, you will need to have Docker installed on your machine. Here are installation
instructions for [Mac](https://docs.docker.com/desktop/install/mac-install/), [Windows](https://docs.docker.com/desktop/install/windows-install/),
and [Linux](https://docs.docker.com/desktop/install/linux/).

You can start the services with:

```shell
docker-compose up <service>

# examples:
docker-compose up postgres_db
docker-compose up redis
```

## Plugins

In Vendure, your custom functionality will live in [plugins](https://www.vendure.io/docs/plugins/).
These should be located in the `./src/plugins` directory.

To create a new plugin run:

```
npx vendure add
```

and select `[Plugin] Create a new Vendure plugin`.

## Migrations

[Migrations](https://www.vendure.io/docs/developer-guide/migrations/) allow safe updates to the database schema. Migrations
will be required whenever you make changes to the `customFields` config or define new entities in a plugin.

To generate a new migration, run:

```
npx vendure migrate
```

The generated migration file will be found in the `./src/migrations/` directory, and should be committed to source control.
Next time you start the server, and outstanding migrations found in that directory will be run by the `runMigrations()`
function in the [index.ts file](./src/index.ts).

If, during initial development, you do not wish to manually generate a migration on each change to customFields etc, you
can set `dbConnectionOptions.synchronize` to `true`. This will cause the database schema to get automatically updated
on each start, removing the need for migration files. Note that this is **not** recommended once you have production
data that you cannot lose.

---

You can also run any pending migrations manually, without starting the server via the "vendure migrate" command.

---

## Troubleshooting

### Error: Could not load the "sharp" module using the \[OS\]-x\[Architecture\] runtime when running Vendure server.

- Make sure your Node version is ^18.17.0 || ^20.3.0 || >=21.0.0 to support the Sharp library.
- Make sure your package manager is up to date.
- **Not recommended**: if none of the above helps to resolve the issue, install sharp specifying your machines OS and Architecture. For example: `pnpm install sharp --config.platform=linux --config.architecture=x64` or `npm install sharp --os linux --cpu x64`

