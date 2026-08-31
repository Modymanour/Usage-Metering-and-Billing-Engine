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
	schemas/				  Zod schema for the APIs
	errors/					  Specified Errors for the system
```

## Database Schema

<img width="1502" height="772" alt="Usage-Metering-and-Billing-Engine ERD drawio" src="https://github.com/user-attachments/assets/16b84f11-9a84-488c-b44f-5145700d7c55" />


## API Reference

| Category | Method | Endpoint | Description | Request Body / Parameters |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/auth/sign-up` | Register a new tenant account | **JSON Body:**<br>`name`: `string`<br>`email`: `string` (valid email format)<br>`password`: `string` (min 8, max 256 chars) |
| **Tenant** | `PUT` | `/tenant` | Update an existing tenant's profile | **JSON Body:**<br>`id`: `uuid`<br>`name`: `string` |
| **Tenant** | `DELETE` | `/tenant/:id` | Remove a tenant account | **Path Param:**<br>`id`: `uuid` |
| **Tenant** | `GET` | `/tenant/:id` | Retrieve tenant details by ID | **Path Param:**<br>`id`: `uuid` |
| **Tenant** | `GET` | `/tenant` | List all registered tenants (paginated) | **Query Params:**<br>`page`: `number` *(optional)*<br>`pageSize`: `number` *(optional)* |
| **Subscription** | `POST` | `/subscription` | Create a new tenant subscription | **JSON Body:**<br>`tenant_id`: `uuid`<br>`plan_name`: `string`<br>`start_from`: `date-string` (ISO format)<br>`ends_at`: `date-string` (ISO format) |
| **Subscription** | `PUT` | `/subscription/plan` | Upgrade/downgrade subscription plan | **JSON Body:**<br>`sub_id`: `uuid`<br>`new_plan_name`: `string` |
| **Subscription** | `PUT` | `/subscription/status` | Change active status of a subscription | **JSON Body:**<br>`sub_id`: `uuid`<br>`new_state`: `"active"` \| `"cancelled"` \| `"expired"` |
| **Subscription** | `DELETE` | `/subscription/:id` | Delete a subscription | **Path Param:**<br>`id`: `uuid` |
| **Subscription** | `GET` | `/subscription/:id` | Get subscription details by ID | **Path Param:**<br>`id`: `uuid` |
| **Subscription** | `GET` | `/subscription` | List all subscriptions (paginated) | **Query Params:**<br>`page`: `number` *(optional)*<br>`pageSize`: `number` *(optional)* |
| **Metering** | `POST` | `/generate` | Record unit usage / meter event | **JSON Body:**<br>`tenant_id`: `uuid`<br>`idempotency_key`: `string`<br>`event_type`: `"api_call"` \| `"api_token"`<br>`quantity`: `integer` (min 1) |
| **Metering** | `GET` | `/get-quota` | Check current tenant quota status | **Query / Body Params:**<br>`tenant_id`: `uuid`<br>`type`: `"api_call"` \| `"api_token"` |
| **Metering** | `GET` | `/user-events` | List all usage events (paginated) | **Query Params:**<br>`page`: `number` *(optional)*<br>`pageSize`: `number` *(optional)* |

## Tests

Run the unit and repository tests with:

```bash
npm test
```

Run the PostgreSQL integration flow with `TEST_DATABASE_URL` set to a database
containing the migrations:

```bash
TEST_DATABASE_URL=postgres://postgres:dev@localhost:5432/BillingEngine npm run test:integration
```

## Stripe webhooks

Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in the private environment
file. The webhook endpoint is `POST /webhooks/stripe`; it must receive Stripe's
raw JSON body, which the application preserves before applying JSON parsing.

The system creates a stripe customer within the tenant creation along with a test wallet; however, the payment plan must be configured through the cli and be hard-coded
into the "Pro" plan on the column (stripe_price_id) in the 004_stripe_integeration.sql migration in the migrations folder. The plan_price on the migration is used for test purposes 
and should generally not be pushed into a public repository.

For subscription events, set these Stripe subscription metadata values:

- `tenant_id`: the tenant UUID
- `plan_name`: the local plan name

To Test, you will run this command on the cli:

```bash
stripe listen --forward-to localhost:3000/webhooks/stripe
```
Then, run the subscription creation API with the subscription being "Pro"; this will trigger a stripe subscription which if successful will return a result on the webhook.

Another case of the webhook being triggered is when a subscription plan changes from "free" tier to "Pro" tier.

## Architecture Flow 

```text
       [ Client ]
           │
           │ POST /auth/sign-up
           ▼
┌──────────────────────┐
│   Tenants Service    │ ──( 1. Create Tenant Record )──► [ Database ]
└──────────┬───────────┘
           │
           │ 2. Create Stripe Customer
           ▼
┌──────────────────────┐
│ Subscription Service │ ──( 3. Create Local Sub: 'trialing' )──► [ Database ]
└──────────┬───────────┘
           │
           │ 4. Create Subscription (with metadata)
           ▼
    [ Stripe API ]
           │
           │ 5. customer.subscription.created / updated (Async Webhook)
           ▼
┌──────────────────────┐
│ Stripe Webhook Serv. │ ──( 6. Sync Sub Status: 'active' )──► [ Database ]
└──────────────────────┘
