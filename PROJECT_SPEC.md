# Compensation Intelligence Backend — Master Project Specification

## 1. Project Role and Track

- **Role:** Backend Engineer
- **Track:** Compensation Intelligence System
- **Goal:** Build a backend system for ingesting, validating, storing, filtering, aggregating, and comparing compensation data across companies.

This document is the **single source of truth** for implementation. Codex must follow it closely and must not silently add, remove, rename, or reinterpret requirements.

---

## 2. Mandatory Technology Stack

Use:

- **Next.js**
- **TypeScript**
- **Next.js API Routes / App Router route handlers**
- **PostgreSQL**
- **Prisma ORM**

Do **not** replace this stack with Express, MongoDB, NestJS, Firebase, Supabase ORM abstractions, or any other backend framework/database unless explicitly instructed later.

---

## 3. Core Features

The backend must implement exactly these four core capabilities:

1. **Salary ingestion**
2. **Filtering/search**
3. **Company-level compensation aggregation**
4. **Multi-company compensation comparison**

Supporting concerns:

- validation
- normalization
- annualization
- duplicate detection
- pagination
- sorting
- safe error responses
- database indexing
- realistic seed data
- tests

---

# 4. Data Model

Use only these primary models:

1. `Company`
2. `CompensationEntry`
3. `AnonymousSubmitter`

Do not create separate tables for role, level, location, currency, or salary period.

---

## 4.1 Company

Fields:

- `id`
- `nameRaw`
- `nameNormalized`
- `createdAt`
- `updatedAt`

Rules:

- `nameNormalized` must be unique.
- `nameRaw` preserves the original/display form.
- `nameNormalized` is used for identity/search.

Normalization:

1. trim leading/trailing whitespace
2. convert to lowercase
3. collapse repeated internal spaces into one

Example:

`"  Google   India  "` -> `"google india"`

Do **not** automatically treat `Google LLC` and `Google` as the same company.

Do **not** perform fuzzy matching or legal-suffix stripping.

---

## 4.2 AnonymousSubmitter

Fields:

- `id`
- `anonymousId`
- `createdAt`
- `lastSeenAt`

Rules:

- `anonymousId` must be unique.
- No authentication/login system is required.
- The anonymous ID should be generated randomly for a first-time user and persisted using a cookie or equivalent anonymous browser identifier.
- Do not use IP address as the primary identity mechanism.
- No public delete endpoint is required for anonymous submitters.

---

## 4.3 CompensationEntry

Fields:

- `id`
- `companyId`
- `submitterId`
- `roleRaw`
- `roleNormalized`
- `level`
- `city`
- `state`
- `country`
- `currency`
- `salaryPeriod`
- `baseSalarySubmitted`
- `annualBaseSalary`
- `annualBonus`
- `annualStock`
- `totalCompensation`
- `yearsOfExperience`
- `createdAt`

### Why both base salary fields exist

If a user submits:

- `baseSalary = 100000`
- `salaryPeriod = MONTHLY`

store:

- `baseSalarySubmitted = 100000`
- `annualBaseSalary = 1200000`

This preserves the original input while enabling consistent annualized filtering and aggregation.

---

# 5. Enums

## Level

```text
INTERN
L1
L2
L3
SENIOR
STAFF
PRINCIPAL
```

## Currency

```text
INR
USD
```

## SalaryPeriod

```text
MONTHLY
ANNUAL
```

No additional enum values should be introduced unless explicitly requested.

---

# 6. Role Normalization

Store both:

- `roleRaw`
- `roleNormalized`

Normalization:

1. trim whitespace
2. lowercase
3. collapse repeated spaces

Example:

`"  Backend   Engineer "` -> `"backend engineer"`

Do **not** automatically map these together:

- `SDE`
- `Software Engineer`
- `Software Development Engineer`

No fuzzy synonym matching is required.

---

# 7. Salary Rules

## 7.1 Base Salary Annualization

If:

```text
salaryPeriod = MONTHLY
```

then:

```text
annualBaseSalary = baseSalary * 12
```

If:

```text
salaryPeriod = ANNUAL
```

then:

```text
annualBaseSalary = baseSalary
```

## 7.2 Bonus and Stock

- Bonus is always treated as an **annual** value.
- Stock is always treated as an **annual** value.
- Missing bonus defaults to `0`.
- Missing stock defaults to `0`.

## 7.3 Total Compensation

```text
totalCompensation = annualBaseSalary + annualBonus + annualStock
```

---

# 8. Currency Rules

Supported currencies:

- INR
- USD

Do **not** implement live FX conversion.

Store the submitted currency directly.

Never combine INR and USD values in the same aggregation or comparison.

All company aggregation and company comparison operations must operate on a single currency at a time.

---

# 9. Location

Store separately:

- `city`
- `state`
- `country`

All three are required on ingestion.

No separate location table is required.

---

# 10. Validation Rules

The API layer must validate:

- `company`: required, non-empty string
- `role`: required, non-empty string
- `city`: required, non-empty string
- `state`: required, non-empty string
- `country`: required, non-empty string
- `level`: valid `Level` enum
- `currency`: only `INR` or `USD`
- `salaryPeriod`: only `MONTHLY` or `ANNUAL`
- `baseSalary`: must be greater than `0`
- `bonus`: optional, defaults to `0`, must be `>= 0`
- `stock`: optional, defaults to `0`, must be `>= 0`
- `yearsOfExperience`: numeric, decimal allowed, must be between `0` and `50`

Important:

- Business validation should be handled in the API/service validation layer.
- Do not depend only on Prisma for numeric validation/check constraints.

---

# 11. Duplicate Detection

The system must allow multiple different users to submit identical compensation data.

Duplicate detection is based on the **same anonymous submitter**.

A probable duplicate is:

- same anonymous submitter
- same company
- same normalized role
- same level
- same city
- same state
- same country
- same annualized base salary
- same currency
- submitted within the previous **24 hours**

Bonus and stock are **not** part of duplicate identity.

### Expected behavior

Different anonymous submitters submitting the same salary -> **accepted**.

Same anonymous submitter submitting the same compensation identity within 24 hours -> **rejected as duplicate**.

Do not use IP-based duplicate detection.

---

# 12. Database Relationships

```text
Company 1 ---- many CompensationEntry

AnonymousSubmitter 1 ---- many CompensationEntry
```

Foreign keys:

- `CompensationEntry.companyId -> Company.id`
- `CompensationEntry.submitterId -> AnonymousSubmitter.id`

Delete behavior:

- Company deletion should be restricted when compensation entries reference it.
- No anonymous submitter deletion API is required.
- Do not cascade-delete compensation history as part of ordinary application behavior.

---

# 13. Database Indexes

Index fields used heavily for filtering/search:

- `Company.nameNormalized`
- `CompensationEntry.companyId`
- `CompensationEntry.roleNormalized`
- `CompensationEntry.level`
- `CompensationEntry.city`
- `CompensationEntry.state`
- `CompensationEntry.country`
- `CompensationEntry.currency`
- `CompensationEntry.createdAt`

Duplicate lookup should also be optimized for the combination of:

- `submitterId`
- `companyId`
- `roleNormalized`
- `level`
- `city`
- `state`
- `country`
- `annualBaseSalary`
- `currency`
- `createdAt`

Note:

`Company.nameNormalized` being unique already creates an index in PostgreSQL/Prisma, so do not add an unnecessary duplicate index if Prisma already handles it.

---

# 14. API Design

Use consistent JSON responses.

Success pattern:

```json
{
  "success": true,
  "data": {}
}
```

Error pattern:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

Do not leak internal stack traces or database details in production API responses.

---

# 15. API 1 — Salary Ingestion

## Route

```http
POST /api/compensation
```

## Request body

```json
{
  "company": "Google",
  "role": "Backend Engineer",
  "level": "L1",
  "city": "Bengaluru",
  "state": "Karnataka",
  "country": "India",
  "currency": "INR",
  "salaryPeriod": "MONTHLY",
  "baseSalary": 100000,
  "bonus": 200000,
  "stock": 300000,
  "yearsOfExperience": 1.5
}
```

Anonymous submitter ID must **not** be trusted from the JSON body.

Use the anonymous browser identifier/cookie mechanism instead.

## Processing sequence

1. parse request
2. validate fields
3. normalize company
4. normalize role
5. annualize base salary
6. default bonus/stock to `0`
7. calculate total compensation
8. resolve/create anonymous submitter
9. resolve/create company by normalized company name
10. check the 24-hour duplicate rule
11. insert `CompensationEntry`
12. return created record summary

## Example success response

```json
{
  "success": true,
  "data": {
    "id": "comp_123",
    "company": "Google",
    "role": "Backend Engineer",
    "level": "L1",
    "annualBaseSalary": 1200000,
    "annualBonus": 200000,
    "annualStock": 300000,
    "totalCompensation": 1700000,
    "currency": "INR"
  }
}
```

## Duplicate response

```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_SUBMISSION",
    "message": "A similar compensation entry was submitted by this user within the last 24 hours."
  }
}
```

## Validation response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid compensation data."
  }
}
```

---

# 16. API 2 — Compensation Filtering/Search

## Route

```http
GET /api/compensation
```

## Supported query parameters

- `company`
- `role`
- `level`
- `city`
- `state`
- `country`
- `currency`
- `minBaseSalary`
- `maxBaseSalary`
- `minExperience`
- `maxExperience`
- `sortBy`
- `order`
- `page`
- `limit`

Salary filtering must use **annualized base salary**.

Do not add a salary-period filter.

## Sorting

Allowed `sortBy` values:

- `totalCompensation`
- `annualBaseSalary`
- `yearsOfExperience`
- `createdAt`

Allowed `order` values:

- `asc`
- `desc`

## Pagination

Use offset pagination.

```text
offset = (page - 1) * limit
```

Response pagination metadata:

- current page
- limit/page size
- total records
- total pages

## Example

```http
GET /api/compensation?company=google&role=backend%20engineer&level=L1&city=bengaluru&currency=INR&minBaseSalary=1000000&page=1&limit=20
```

## Example response

```json
{
  "success": true,
  "data": [
    {
      "id": "comp_123",
      "company": "Google",
      "role": "Backend Engineer",
      "level": "L1",
      "city": "Bengaluru",
      "state": "Karnataka",
      "country": "India",
      "currency": "INR",
      "annualBaseSalary": 1200000,
      "annualBonus": 200000,
      "annualStock": 300000,
      "totalCompensation": 1700000,
      "yearsOfExperience": 1.5
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalRecords": 73,
    "totalPages": 4
  }
}
```

---

# 17. API 3 — Company Aggregation

## Route

```http
GET /api/companies/[company]/compensation
```

## Filters

- `currency` — required
- `role` — optional
- `city` — optional
- `state` — optional
- `country` — optional

## Example

```http
GET /api/companies/google/compensation?currency=INR&role=backend%20engineer&city=bengaluru
```

## Return metrics

- total submission count
- average total compensation
- median total compensation
- minimum total compensation
- maximum total compensation
- average base salary
- average bonus
- average stock
- level breakdown

Level breakdown should contain only:

- `level`
- `averageTotalCompensation`
- `submissionCount`

Do not add unnecessary per-level min/max metrics.

## Example response

```json
{
  "success": true,
  "data": {
    "company": "Google",
    "currency": "INR",
    "submissionCount": 120,
    "averageTotalCompensation": 2800000,
    "medianTotalCompensation": 2600000,
    "minimumTotalCompensation": 1800000,
    "maximumTotalCompensation": 4200000,
    "averageBaseSalary": 2100000,
    "averageBonus": 300000,
    "averageStock": 400000,
    "levelBreakdown": [
      {
        "level": "L1",
        "averageTotalCompensation": 2200000,
        "submissionCount": 35
      },
      {
        "level": "L2",
        "averageTotalCompensation": 3100000,
        "submissionCount": 28
      }
    ]
  }
}
```

If no matching records exist, return a clean empty/not-found result. Do not throw an unhandled error.

---

# 18. API 4 — Multi-Company Comparison

## Route

```http
GET /api/compare
```

## Required query parameters

- `companies` — comma-separated list of **2 to 5 companies**
- `currency`

## Optional filters

- `role`
- `level`
- `city`
- `state`
- `country`

## Example

```http
GET /api/compare?companies=google,microsoft,amazon&currency=INR&role=backend%20engineer&level=L1&city=bengaluru
```

## Metrics per company

- `company`
- `currency`
- `submissionCount`
- `averageTotalCompensation`
- `medianTotalCompensation`
- `averageBaseSalary`
- `averageBonus`
- `averageStock`

All companies must return the same response structure.

## Example response

```json
{
  "success": true,
  "data": [
    {
      "company": "Google",
      "currency": "INR",
      "submissionCount": 120,
      "averageTotalCompensation": 2800000,
      "medianTotalCompensation": 2600000,
      "averageBaseSalary": 2100000,
      "averageBonus": 300000,
      "averageStock": 400000
    },
    {
      "company": "Microsoft",
      "currency": "INR",
      "submissionCount": 98,
      "averageTotalCompensation": 2500000,
      "medianTotalCompensation": 2400000,
      "averageBaseSalary": 1900000,
      "averageBonus": 250000,
      "averageStock": 350000
    }
  ]
}
```

Validation:

- fewer than 2 companies -> error
- more than 5 companies -> error
- invalid currency -> error

---

# 19. Recommended Project Structure

```text
src/
  app/
    api/
      compensation/
        route.ts
      companies/
        [company]/
          compensation/
            route.ts
      compare/
        route.ts

  lib/
    prisma.ts

  services/
    compensation.service.ts
    aggregation.service.ts
    comparison.service.ts

  validators/
    compensation.validator.ts
    query.validator.ts

  utils/
    normalize.ts
    salary.ts
    duplicate.ts
    response.ts

prisma/
  schema.prisma
  seed.ts
```

Principles:

- API route handlers should stay thin.
- Business logic belongs in `services`.
- Validation belongs in `validators`.
- Reusable deterministic helpers belong in `utils`.
- Prisma client initialization belongs in `lib/prisma.ts`.

Do not put all business logic directly inside route files.

---

# 20. Implementation Order

Implement in this exact high-level order:

## Phase 1 — Project setup

- Next.js
- TypeScript
- Prisma
- PostgreSQL connection
- environment variables

## Phase 2 — Database

- enums
- models
- relationships
- indexes
- migration

## Phase 3 — Core utilities

- normalization
- salary annualization
- total compensation calculation
- API response helpers

## Phase 4 — Validation

- salary ingestion validation
- query parameter validation

## Phase 5 — API 1

Salary ingestion:

- anonymous submitter handling
- company lookup/create
- duplicate detection
- compensation insert

## Phase 6 — API 2

Filtering/search:

- filters
- sorting
- offset pagination

## Phase 7 — API 3

Company aggregation:

- count
- averages
- median
- min/max
- level breakdown

## Phase 8 — API 4

Company comparison:

- 2–5 companies
- shared filters
- identical metric structure per company

## Phase 9 — Seed data

Create enough realistic records to demonstrate:

- INR and USD
- multiple companies
- multiple levels
- multiple locations
- different roles
- different experience ranges
- different salary structures

## Phase 10 — Tests / cleanup

- validation tests
- salary calculation tests
- normalization tests
- duplicate detection tests
- API behavior tests where practical
- README
- deployment preparation

---

# 21. Error Handling

Use predictable application-level errors.

Suggested codes:

```text
VALIDATION_ERROR
DUPLICATE_SUBMISSION
COMPANY_NOT_FOUND
NO_MATCHING_RECORDS
INVALID_QUERY
INTERNAL_ERROR
```

Use appropriate HTTP status codes, for example:

- `200` successful GET
- `201` successful creation
- `400` invalid request/query
- `404` requested company/data not found where appropriate
- `409` duplicate submission
- `500` unexpected internal error

Do not expose raw Prisma/database errors to clients.

---

# 22. Testing Expectations

At minimum test the logic that is easiest to break and easiest to explain in an interview:

### Normalization

- trims whitespace
- lowercases
- collapses repeated spaces

### Salary calculation

- monthly -> annual
- annual -> unchanged
- missing bonus -> 0
- missing stock -> 0
- total compensation calculated correctly

### Validation

Reject:

- negative salary
- zero base salary
- invalid level
- invalid currency
- invalid salary period
- negative bonus
- negative stock
- experience < 0
- experience > 50
- missing required text fields

### Duplicate detection

- same submitter + same compensation identity within 24h -> rejected
- different submitter + same compensation -> accepted
- same submitter outside 24h -> accepted

---

# 23. Scope Constraints

Do **not** add these unless explicitly requested:

- authentication/login
- admin dashboard
- frontend UI
- payment system
- email system
- Redis
- queues
- background workers
- microservices
- GraphQL
- Elasticsearch
- live currency conversion
- AI salary prediction
- role synonym matching
- fuzzy company matching
- company legal-suffix normalization
- separate Role/Location/Level tables
- cursor pagination

The objective is a clean, reliable, explainable backend implementation under a short deadline.

---

# 24. Codex Working Rules

Codex must follow these rules while implementing this project.

## Rule 1 — Treat this document as the source of truth

Do not silently redesign requirements.

If an implementation detail conflicts with this document, stop and explain the conflict before changing the design.

## Rule 2 — Work phase-by-phase

Do not implement the entire application in one uncontrolled pass.

Only implement the phase explicitly requested.

## Rule 3 — Do not overengineer

Prefer simple, production-reasonable solutions that are easy to understand and defend.

## Rule 4 — Explain changes

After each implementation phase, report:

1. files created
2. files modified
3. what each file does
4. important implementation decisions
5. commands the developer must run
6. environment variables required
7. how to test the completed phase
8. any deviations from this specification

## Rule 5 — Do not hide errors

If something cannot be implemented exactly as specified, explain why instead of silently substituting another design.

## Rule 6 — Preserve interview explainability

Write clear TypeScript with meaningful names.

Avoid unnecessarily clever abstractions.

Add comments only where they clarify non-obvious logic.

## Rule 7 — Keep routes thin

Route handlers should mainly:

- parse request
- call validation/service logic
- return standardized response

Business logic should not become a giant `route.ts` file.

## Rule 8 — Verify before moving on

After each phase:

- run relevant checks/tests
- fix TypeScript errors
- fix lint/build errors caused by the phase
- report the result

Do not move to another phase unless explicitly instructed.

---

# 27. Definition of Done

The backend is complete when:

- PostgreSQL + Prisma are configured correctly
- schema and migrations work
- salary ingestion works
- validation works
- normalization works
- annualization works
- duplicate detection works
- filtering works
- sorting works
- pagination works
- company aggregation works
- median/average/min/max calculations work
- level breakdown works
- 2–5 company comparison works
- INR/USD are never incorrectly mixed
- realistic seed data exists
- core logic has tests
- API errors are clean
- README explains setup and API usage
- project builds successfully
- deployed backend can be demonstrated reliably

