# Cairn CRM

Read this file and the relevant [product requirements](docs/product/requirements.md), [data model](docs/architecture/data-model.md), [security policy](docs/architecture/security.md), and [decision records](docs/architecture/decisions.md) before editing. The founder approved local implementation of the MVP. Pilot hosting, data handling and provider approval remain open.

## Product and architecture

- Cairn gives small B2B service teams an adaptable workspace for customer relationships. It supports metadata-driven records and relationships, pipelines, tasks and timelines, views, CSV, internal workflows and an opt-in Copilot. Consulting and recruiting are synthetic templates. Shared services must work with any configured object.
- Node.js 24 LTS, TypeScript, Next.js 16 App Router, React, PostgreSQL 18, Drizzle and node-postgres form a modular monolith. `app/` owns HTTP and page entry points, `src/server/` owns HTTP helpers, `src/domain/` owns validation and persistence, `src/ui/` owns reusable client components, and `src/i18n/` owns translation and presentation codecs. `scripts/` contains development and process entry points.
- The data model combines a relational envelope, versioned object and field metadata, validated JSONB values and type-aware queries. Edges have named sides and enforced cardinality. Preserve values on archive and retain stable technical identifiers across labels and locales. Add ordered SQL files under `migrations/`. Test on an empty database and an upgraded fixture, and document recovery for risky changes.
- Owner, Admin, Member and Viewer share workspace records. Assignment expresses responsibility. Every tenant request, job and AI tool must establish a workspace and validate current authorization. Use explicit workspace predicates and composite foreign keys with PostgreSQL RLS. Platform identity and authentication tables are outside the tenant namespace of record data.
- Write domain state, audit and outbox events in one transaction. `src/domain/workflows.ts` processes due jobs with a workspace lock and durable workflow run keys. A failed rule rolls back its actions. An authorized admin can retry its event without duplicating successful runs. `scripts/worker.ts` runs separately against the worker connection, and embedded mode starts its own loop. See [automation decisions](docs/architecture/decisions.md) before changing the transport.
- Copilot starts off. Its adapter can use scoped, cited CRM evidence and propose an immutable task. Only an explicit, unexpired approval with revalidated permissions can create the task. Treat CRM text and model output as untrusted. Never log content, secrets, session tokens or invitations. See [AI boundaries](docs/architecture/ai.md).

## Engineering and design

- Keep handlers thin and domain functions workspace-scoped. Decode untrusted input with existing Zod schemas and metadata validators. Bind SQL parameters, allowlist operators and sort keys, keep TypeScript strict, and reuse existing UI and domain types.
- Return localized domain problems through the shared HTTP wrapper. Add stable error keys in `src/i18n/errors.ts` and entries to both catalogs. Add regression tests for failure paths, transaction rollback, duplicate commands, concurrency and privilege boundaries when relevant.
- Use the typography, color, surface and spacing tokens in `app/globals.css` and [the design system](docs/design-system.md). Keep keyboard focus visible and make tables, dialogs and boards work on narrow screens. Favor labeled controls, restrained surfaces and contextual feedback.
- Persian `fa-IR` is default and RTL, using Vazirmatn. English `en` is LTR. `next-intl` serves shared components and locale catalogs. Use logical CSS, mirror directional icons selectively, and isolate mixed text with `bdi`. Use [the formatting helpers](docs/localization.md) for Persian/Gregorian dates, digits and workspace currency and timezone. Keep canonical backend values and original customer text.

## Local development

Use Node.js 24 LTS and npm. Run these from the repository root.

```powershell
npm ci
$env:NEXT_PUBLIC_CRM_DEMO='1'
npm run build
npm run demo
```

The synthetic app and embedded worker start together at `http://127.0.0.1:3000`. Use the accounts in [README.md](README.md). Data resets on restart. For a separate PostgreSQL 18 server, provision a disposable database, `crm_app` and `crm_worker` runtime roles with NOBYPASSRLS, and a privileged migration login. Copy `.env.example` to `.env`, then set `DATABASE_URL`, `WORKER_DATABASE_URL`, `MIGRATION_DATABASE_URL` and `APP_ORIGIN`. Enable `CRM_DEMO=1` only for synthetic seed data. Keep the embedded flags unset for this mode.

```powershell
npm run db:migrate
npm run db:seed
npm run dev
# In a second terminal
npm run worker
```

Skip seeding outside synthetic environments. For production-mode local testing use `npm run build` followed by `npm run start`. The optional `OPENAI_API_KEY` and `CRM_AI_MODEL` settings require operator approval, access to the chosen provider, and explicit owner enablement. Keep all credentials outside version control.

```powershell
npm run lint
npm run typecheck
npm test
$env:NEXT_PUBLIC_CRM_DEMO='1'
npm run build
npm run test:browser
```

`npm test` includes unit and embedded PostgreSQL integration cases. Browser QA uses Playwright with local Chrome by default and covers both locales. Set `CRM_BROWSER_CHANNEL` to use another installed Chromium channel. Keep generated evidence outside source commits.

## Status and future changes

See [the QA handoff](docs/qa-handoff.md) and [roadmap](docs/roadmap.md) for verified features and open work. The integrated synthetic build uses a local session service and PostgreSQL polling while Better Auth and Graphile Worker remain approved work. Native server concurrency, the private-pilot hosting and retention decisions, live Copilot, and performance and restore targets still require verification.

Preserve the architecture and tenant boundaries. Justify dependencies and module rewrites. Update relevant docs and decision records alongside implementation changes. Run the checks that cover each meaningful edit and record what actually passed. Keep customer data out of tests, demos, commits and operational logs.
