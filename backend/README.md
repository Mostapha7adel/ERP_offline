# LedgerFlow API

Production-ready backend for the LedgerFlow accounting desktop system.

## Stack
- **Node.js** + **Fastify 5** (HTTP server, schema validation, lifecycle hooks)
- **TypeScript** (strict mode, NodeNext ESM)
- **Prisma 6** + **SQLite** — full normalized schema (27 tables), migrations & seed
- **Zod** — runtime validation & type derivation (via `fastify-type-provider-zod`)
- **JWT** — stateless access tokens (`@fastify/jwt`) + rotating refresh tokens
- **Pino** — structured logging

## Architecture (Clean Architecture)
```
Controller  →  Service  →  Repository  →  Database Adapter
     ↓              ↓            ↓
  validation     business    in-memory /
  (zod)          rules       Prisma (SQLite)
```

Every feature is an isolated module under `src/modules/<feature>/`:

- `*.entity.ts`   — domain model (plain TS types)
- `*.schema.ts`   — Zod schemas (contracts for request/response)
- `*.repository.ts` — data-access interface + in-memory implementation
- `*.service.ts`  — business logic (transactions, rules)
- `*.controller.ts` — Fastify route registration (REST API)

> The database schema (`prisma/schema.prisma`), migrations, seed and ERD are
> fully designed. The service/controller layer still runs on the in-memory
> repositories; swapping them for Prisma-backed adapters behind the same
> `BaseRepository` contract is the next integration step.

## Quick start
```bash
cp .env.example .env
npm install
npm run prisma:migrate   # create DB + apply migrations + seed
npm run dev              # http://127.0.0.1:3000
```

## Database
- Schema & ERD: see [`docs/DATABASE.md`](docs/DATABASE.md)
- Migrations: `prisma/migrations/`
- Seed: `prisma/seed.ts` (idempotent, run with `npm run prisma:seed`)
- Studio: `npm run prisma:studio`

## API docs
OpenAPI (Swagger) contract auto-generated from Zod schemas:
`http://127.0.0.1:3000/docs`

Base path: `/api/v1`

## Default admin
- Email: `admin@ledgerflow.local`
- Password: `Admin@123!`

## Scripts
| Command | Purpose |
|---|---|
| `npm run dev` | Run with hot reload |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run compiled server |
| `npm run typecheck` | Type-check the whole project |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Create/apply dev migrations |
| `npm run prisma:migrate:prod` | Apply committed migrations (production) |
| `npm run prisma:reset` | Drop schema, re-apply migrations + seed |
| `npm run prisma:seed` | Run seed data |
| `npm run prisma:studio` | Open Prisma Studio |

## Repository swap to SQLite
1. Implement `PrismaRepository<T>` behind the existing `BaseRepository` interface (see `src/core/repository/base-repository.ts`).
2. Swap the adapter in each feature module's `repository.ts`.
3. Services/controllers require no changes.
