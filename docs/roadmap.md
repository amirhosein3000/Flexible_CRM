# Revised implementation sequence

The founder approved the product direction and MVP scope and authorized the local build. Completion still requires the full CRM-01 through CRM-11 contract and release verification. This sequence keeps the approved features in scope.

| Order | Milestone | Delivered in this checkout | Work before the pilot |
| --- | --- | --- | --- |
| 1 | Secure foundation | Next.js shell, local sessions, shared sign-in throttles, idempotent workspace creation, roles, invite tokens, database migrations, row policies and synthetic fixtures | Install supported patches, integrate Better Auth and review invitation delivery, review deployment grants, run two-tenant concurrency and pooling checks on native PostgreSQL 18. |
| 2 | Configurable records | Object creation, typed fields, field archiving, layout sections, archive/restore, typed relations, assignment, pipelines, board, tasks and timeline | Finish schema dependency repair and validate concurrent edits. Check cardinality and archive/restore outcomes under concurrency. |
| 3 | Query and exchange | Workspace command search, table filters, custom field sorting, personal and shared table and board views, CSV preview/commit/export | Complete query coverage and stable pagination. Benchmark the 50,000-record and 10-user fixture. Exercise the 5,000-row import limit. |
| 4 | Automation | Transactional outbox, IANA-zone schedules, ordered internal actions, isolated rule failures, idempotent runs, manual retry and per-step run history | Integrate Graphile Worker. Verify dispatcher recovery and separate worker execution. |
| 5 | Governed AI | Default-off provider boundary, scoped evidence, task preview and expiry, approval and audit | Approve one provider and model choice, finish history and typed retrieval tools, validate budget and retention, and run live-provider smoke tests on synthetic data. |
| 6 | Private pilot | Local synthetic startup and browser verification harness | Choose jurisdiction, hosting vendor/region and budget. Run pinned runtime/build security review, complete accessibility and restore checks, verify incident and migration runbooks and approve data handling before onboarding. |

Hosting, production retention and provider contracts are unresolved. They do not block local synthetic development. Do not import real customer data before their resolution.
