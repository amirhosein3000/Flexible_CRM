# Cairn CRM

Cairn is a configurable relationship workspace for small B2B service teams. The interface defaults to Persian (fa-IR) with RTL layout. Choose English from the language control on sign-in or in the workspace header. The checkout includes a Next.js application, PostgreSQL migrations, synthetic consulting and recruitment workspaces, and a worker entry point.

## Run the synthetic demo locally

Use Node.js 24 LTS and Chrome. From this folder in PowerShell:

```powershell
npm ci
$env:NEXT_PUBLIC_CRM_DEMO='1'
npm run build
npm run demo
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The synthetic demo uses embedded PostgreSQL 18.6, runs the same migration SQL and role policies, and starts the automation loop in the app process. Data resets on restart. Use these credentials only with synthetic data.

| Account | Email | Password |
| --- | --- | --- |
| Owner across both workspaces | demo@cairn.example | Cairn-demo-2026! |
| Member in Studio North | sam@cairn.example | Cairn-demo-2026! |
| Viewer in Studio North | viewer@cairn.example | Cairn-demo-2026! |

In Studio North, open Settings, select Copilot, then choose **Use synthetic demo** to try evidence links and a task approval. AI is off until enabled.

## Run with a PostgreSQL server

Provision a private PostgreSQL 18 database and separate connection roles named crm_app and crm_worker with no superuser, ownership, or BYPASSRLS rights. Use a separate privileged connection for migrations. Copy .env.example to .env and set DATABASE_URL, WORKER_DATABASE_URL, MIGRATION_DATABASE_URL and APP_ORIGIN. Remove the demo flags if synthetic mode is not desired. Run migrations before the app or worker and keep backups for production-like upgrades.

```powershell
npm ci
npm run db:migrate
# With CRM_DEMO=1 only, to load synthetic data
npm run db:seed
npm run build
npm run start
# In a second terminal
npm run worker
```

The default start action binds to loopback. Live-provider mode requires explicit operator approval, server-managed configuration and owner enablement. The build evaluated here used synthetic records and the deterministic adapter.

## Verify

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:browser
```

Run the browser test after building with NEXT_PUBLIC_CRM_DEMO=1. It drives Chrome against actual Next.js handlers and embedded PostgreSQL. On a machine with an existing Playwright installation, CRM_PLAYWRIGHT_MODULE can point to its module URL. The test uses local IPC so it can run in environments where loopback TCP is restricted.

## Design and implementation status

- [Persian and English localization](docs/localization.md)
- [Design system](docs/design-system.md)
- [Product scope](docs/product/requirements.md)
- [Architecture](docs/architecture/system.md), [data model](docs/architecture/data-model.md), [security](docs/architecture/security.md), and [decision records](docs/architecture/decisions.md)
- [Roadmap and remaining release work](docs/roadmap.md)
- [QA handoff and verification](docs/qa-handoff.md)

This is a local synthetic build. Private pilot readiness still requires Better Auth and Graphile Worker integration, the remaining product milestones, a separate native PostgreSQL 18 deployment test, approval of the pilot data and hosting arrangements, and review of the exact package versions to ship.
"# Flexible_CRM" 
