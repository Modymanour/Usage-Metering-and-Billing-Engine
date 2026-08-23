# Usage Metering and Billing Engine

A TypeScript/Express service backed by PostgreSQL for storing tenants, plans, subscriptions, usage events, and Stripe event records.

## Current status

The PostgreSQL schema, migrations, connection pool, and application bootstrap are in place. API routes, controllers, and services have not been implemented yet.

## Requirements

- Node.js
- npm
- PostgreSQL
- Docker
- Stripe

## Run with Docker Compose

```bash
docker compose up --build
```

The API container listens on `http://localhost:3000`. PostgreSQL is exposed on port `5432` with these development credentials:

The API runs pending migrations before starting.

Install dependencies and run the service:

```bash
npm install
npm start
```

## Database migrations

The system already applies pending migrations when running using docker compose up;though, on the circumstances where you want to run it without docker, you should run the postgres container with the same configurations as the system and us the following commands:

```bash
npm run db:migrate
```

Show migration status and checksum changes:

```bash
npm run db:migrate:status
```

Migration files are stored in `src/migrations/` and are applied in filename order.

## Project structure

```text
src/
	app.ts                    Express application entry point
	config/                   Environment configuration
	db/                       PostgreSQL pool and migration runner
	migrations/               SQL schema and indexes
	repositories/             Database access modules
	routes/                   Express router
	controllers/              Request handlers
	services/                 Application services
```

## Database Schema


## Tests

No automated test suite is configured yet.
