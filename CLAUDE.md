# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> **Read the rule above first.** This repo runs **Next.js 16.2 / React 19.2** with the React Compiler enabled. APIs and conventions differ from older Next.js — consult `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`) before writing framework code.

## What this is

VPS Gestão — a multi-tenant SaaS for managing craft/atelier businesses (orders, production workflow, pricing/"precificação", inventory, finance, demands, a rewards program "Stars", and an AI assistant). The UI and domain language are **Brazilian Portuguese**; match that in code identifiers, comments, and user-facing strings.

## Commands

```bash
npm run dev      # next dev (localhost:3000)
npm run build    # next build
npm run start    # next start (production)
npm run lint     # eslint (flat config, eslint.config.mjs)
npx prisma db pull      # re-introspect DB into prisma/schema.prisma
npx prisma generate     # regenerate @prisma/client after schema changes
```

There is **no test suite** — verify changes by running the app.

`gerar_mapa.ps1` / `scripts/mapear-projeto.ps1` regenerate `MAPA_PROJETO.md`, an auto-generated index of every API route, page, component, lib, and Prisma table. Consult `MAPA_PROJETO.md` to locate things quickly; regenerate it after adding routes/pages.

## Architecture

**App Router only.** Pages live under `app/<area>/page.tsx`, API handlers under `app/api/.../route.ts` exporting `GET`/`POST`/`PUT`/`DELETE`. Path alias `@/*` maps to repo root (e.g. `@/lib/prisma`).

**Data access is raw SQL, not the Prisma query builder.** ~118 of 133 route files use `prisma.$queryRaw` / `prisma.$executeRaw` tagged templates; essentially none use `prisma.model.findMany()`. `prisma/schema.prisma` is an **introspected mirror** of an existing Postgres DB (Neon) — it documents tables/columns but is rarely used as a query API. When writing queries:
- Use tagged-template interpolation (`${value}`) for parameterization — never string-concatenate SQL.
- Quote camelCase identifiers in SQL: `sf."workspaceId"`, `w."ativo"`.
- Postgres returns `BigInt`/`Decimal`/`Date` that don't `JSON.stringify` cleanly — pass results through `serialize()` (`@/lib/serialize`) before `NextResponse.json()`. Many routes inline a local copy of this function.
- For transient Neon connection errors, wrap queries in `withRetry()` from `@/lib/dbRetry`.
- `lib/prisma.ts` exports a singleton `prisma` (global-cached in dev to survive HMR).

**Multi-tenancy via `workspaceId`.** Almost every table has a `workspaceId` column. Every query that reads or writes tenant data **must** filter/insert by the current `workspaceId`. Get it from the session:
```ts
const session = await getServerSession(authOptions)
if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
const workspaceId = session.user.workspaceId
```
Forgetting the `workspaceId` filter leaks data across tenants — treat it as a hard requirement.

**Auth.** NextAuth (JWT strategy, Credentials provider) in `lib/auth.ts`. `authorize()` validates against the `User`/`Workspace` tables (bcrypt) and rejects inactive users/workspaces. The session carries `id`, `role`, `workspaceId`, `workspaceNome`, `workspaceAtivo`, `primeiroLogin` — check `session.user.role` for authorization.

**Master/admin area is separate.** `/master/*` routes are gated by `middleware.ts` using a `master_token` cookie compared to `MASTER_SECRET_TOKEN` (not NextAuth). Master-only API routes verify a `x-master-token` header against the same env var. Do not protect master endpoints with `getServerSession`.

**External integrations** (all via `fetch`, no SDKs):
- **AI assistant** (`/api/gestao/chat`, `/api/suporte/chat`): calls **Google Gemini 2.5 Flash** via `generativelanguage.googleapis.com`. ⚠️ The API key env var is misleadingly named `ANTHROPIC_API_KEY_GESTAO` but holds a Google API key.
- **Telegram** notifications — `lib/telegramNotify.ts` and inline in feedback/stars routes.
- **Resend** for transactional email; **Hotmart** webhook for purchases; **Meta Pixel** conversions API.

**IDs** are generated app-side, not by the DB: `Math.random().toString(36).slice(2) + Date.now().toString(36)`.

## Conventions

- Routes return `NextResponse.json(...)`; auth failures use status 401, validation 400, server errors 500. Errors are usually `console.error`'d with a `[ROUTE]` prefix; some routes also call `logError()` (`@/lib/errorLog`) to persist per-workspace errors to the `ErrorLog` table.
- Styling is **Tailwind CSS v4** (via `@tailwindcss/postcss`, no `tailwind.config.js`). Dark mode and per-workspace themes are handled in `lib/theme.ts` + `components/ThemeLoader.tsx`.
- Keep comments and identifiers in Portuguese to match the existing code.
