# Compensation Intelligence Backend

A focused Next.js backend for collecting anonymous compensation submissions, searching them, aggregating company data, and comparing companies. It is intentionally small: the project emphasizes clear validation, durable data integrity, and explainable API behavior over a large application framework.

## Live Deployment

https://compensation-intelligence-systems.vercel.app

## Tech stack

- Next.js App Router route handlers
- TypeScript
- PostgreSQL (hosted on Neon)
- Prisma ORM
- Node's built-in test runner, executed through `tsx`

## Architecture

```text
Route handler -> validator -> service -> Prisma -> PostgreSQL
                         -> utilities (normalization / salary arithmetic)
```

- `src/app/api`: thin HTTP handlers that parse requests and produce the standard response envelope.
- `src/validators`: parse untrusted JSON/query input and enforce types, enums, defaults, and ranges.
- `src/services`: coordinate business rules and Prisma queries.
- `src/utils`: deterministic normalization, Decimal salary arithmetic, and response helpers.
- `src/lib/prisma.ts`: one reusable Prisma client, safe across development hot reloads.

## Database models

| Model | Responsibility |
| --- | --- |
| `Company` | Stores a display name and a unique normalized company identity. |
| `AnonymousSubmitter` | Stores the anonymous browser identifier used for per-submitter duplicate protection. |
| `CompensationEntry` | Stores submitted and annualized base salary, annual bonus/stock, total compensation, location, level, and experience. |

`CompensationEntry` has a composite unique constraint on submitter, company, normalized role, level, location, annual base salary, and currency. It permanently prevents the same anonymous submitter from submitting the same compensation identity, while allowing another submitter to submit the same data.

## Setup

Prerequisites: Node.js 20+ and PostgreSQL access. The configured development environment uses Neon.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and set both variables:

   ```dotenv
   DATABASE_URL="postgresql://..."
   DATABASE_URL_UNPOOLED="postgresql://..."
   ```

   Use the pooled connection for `DATABASE_URL` at application runtime. Use a direct, non-pooled connection for `DATABASE_URL_UNPOOLED`; Prisma uses it for migrations.

3. Generate Prisma Client and apply committed migrations:

   ```bash
   npm run prisma:generate
   npx prisma migrate deploy
   ```

4. Optionally load deterministic development data:

   ```bash
   npm run db:seed
   ```

   Seeding is explicit and never runs automatically in development or production.

5. Run the application:

   ```bash
   npm run dev
   ```

   For a production-style local run:

   ```bash
   npm run build
   npm start
   ```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Create a production build. |
| `npm start` | Serve an existing production build. |
| `npm run typecheck` | Type-check without emitting files. |
| `npm test` | Run focused unit tests. |
| `npm run prisma:validate` | Validate the Prisma schema. |
| `npm run prisma:generate` | Generate Prisma Client. |
| `npx prisma migrate dev --name <name>` | Create and apply a development migration. |
| `npx prisma migrate deploy` | Apply committed migrations in a deployment environment. |
| `npm run db:seed` | Insert deterministic development seed data. |

## API

All responses use one of these envelopes:

```json
{ "success": true, "data": {} }
```

```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Human-readable message" } }
```

### `POST /api/compensation`

Creates a compensation entry. The route uses an HTTP-only `anonymous_submitter_id` cookie; it never accepts an anonymous identity from the JSON body.

```bash
curl -X POST http://localhost:3000/api/compensation \
  -H "Content-Type: application/json" \
  -d '{
    "company":"Google",
    "role":"Backend Engineer",
    "level":"L1",
    "city":"Bengaluru",
    "state":"Karnataka",
    "country":"India",
    "currency":"INR",
    "salaryPeriod":"MONTHLY",
    "baseSalary":100000,
    "bonus":200000,
    "stock":300000,
    "yearsOfExperience":1.5
  }'
```

Returns `201` when created, `400` for invalid JSON/input, `409` with `DUPLICATE_SUBMISSION` for a permanent duplicate from the same anonymous submitter, and `500` for an unexpected server failure.

### `GET /api/compensation`

Searches compensation entries. Supported filters: `company`, `role`, `level`, `city`, `state`, `country`, `currency`, `minBaseSalary`, `maxBaseSalary`, `minExperience`, `maxExperience`, `sortBy`, `order`, `page`, and `limit`.

```bash
curl "http://localhost:3000/api/compensation?company=google&role=backend%20engineer&currency=INR&minBaseSalary=1000000&sortBy=totalCompensation&order=desc&page=1&limit=20"
```

Salary filters use annualized base salary. Pagination is offset-based; `page` defaults to `1`, `limit` defaults to `20`, and the maximum limit is `100`.

### `GET /api/companies/[company]/compensation`

Returns one company's metrics: count, average/median/minimum/maximum total compensation, average base/bonus/stock, and a per-level breakdown. `currency` is required; `role`, `city`, `state`, and `country` are optional.

```bash
curl "http://localhost:3000/api/companies/google/compensation?currency=INR&role=backend%20engineer"
```

Returns `404` with `NO_MATCHING_RECORDS` if the company is unknown or the filters match no records.

### `GET /api/compare`

Compares 2–5 companies using a required `companies` comma-separated list and required `currency`. Optional filters are `role`, `level`, `city`, `state`, and `country`.

```bash
curl "http://localhost:3000/api/compare?companies=google,microsoft,amazon&currency=INR&role=backend%20engineer"
```

Every requested company must have matching records; otherwise the route returns `404` with `NO_MATCHING_RECORDS`.

## Important design decisions

- Company and role matching trim, lowercase, and collapse internal whitespace. They intentionally do not do fuzzy matching, synonym mapping, or legal-suffix removal.
- Monetary calculations use Prisma `Decimal` rather than JavaScript floating-point arithmetic. Bonus and stock are always annual; a monthly base salary is multiplied by 12.
- INR and USD are stored separately. Aggregation and comparison require a single currency and perform no foreign-exchange conversion.
- A pre-insert duplicate lookup gives a friendly response, while the database composite unique constraint is the race-safe integrity guarantee.
- Prisma transactions keep the related ingestion writes together. API routes stay thin and do not expose Prisma errors.

## Deployment readiness and limitations

- Secrets are read from environment variables. `.env`, `.env.local`, and `.neon` are ignored by Git; do not commit real connection strings.
- Run `npm run prisma:generate`, `npx prisma migrate deploy`, `npm run typecheck`, `npm test`, and `npm run build` in CI/deployment before serving traffic.
- Use a direct `DATABASE_URL_UNPOOLED` for migrations. Do not use `prisma migrate dev` against production.
- The anonymous cookie is an identifier, not authentication or abuse prevention. There is no login, rate limiting, moderation, or deletion API.
- Median calculation currently fetches all matching totals and sorts them in PostgreSQL. That is simple and accurate for this project, but a larger dataset may need a database percentile query or pre-aggregated analytics.
- Offset pagination is simple but can become slower at very high page offsets.
- Automated tests cover deterministic utilities and validation. Duplicate behavior is enforced by the database constraint and should be covered by isolated Postgres integration tests in a larger system.
