# Testing strategy

Use synthetic fixtures with two workspaces, a user in both, access scoped to one workspace, the four role capabilities, and archived and active records. The test suite runs the same migration SQL in embedded PostgreSQL 18.6 and lowers to the non-owner app role. The browser harness drives Chromium through the actual Next.js routes, with a local named-pipe or Unix-socket HTTP transport for execution environments with restricted TCP.

| Suite | Purpose |
| --- | --- |
| Lint and type checking | Validate TypeScript source and normal Next.js routing types. |
| Domain and database | Test codec, strict decimal and CSV parsing; authentication and revocation; workspace role enforcement and no-context RLS; foreign record, relationship, import, stage, thread and evidence rejection; schema revision checks; normal import, filter and view operations; workflow replay; and AI permission, expiration and approval replay. |
| Playwright | Sign-in, seeded overview, tables and saved views, record activity, board, workflow creation and effects, tasks, metadata, CSV, contextual Copilot approval, tenant switching and mobile flow. Captures major screens from the real app. |
| Native PostgreSQL and deployment, outstanding | Verify separate roles and processes, pool context reset, scale, concurrent import and approval, stale writes, edge cardinality race, signed cursors when introduced, restore, provider egress and release rollback. |

For release require zero cross-tenant disclosures in records, relationships, imports, scheduled jobs and AI retrieval. Verify viewer restrictions, opt-in, hidden thread handling and expired approvals. Load a representative 50,000-record fixture with 10 concurrent users and collect p95. Rehearse native backup and recovery before inviting customers. Assess keyboard interaction, semantics, contrast, zoom and reduced motion. Synthetic review does not establish production accessibility or launch readiness.

## Verified in this checkout

- Lint, TypeScript checking and the production build passed.
- Twenty automated tests passed. Integration cases ran against embedded PostgreSQL 18.6 with restricted runtime roles and RLS. The detailed coverage and remaining verification gates are in the [QA handoff](qa-handoff.md).
- The bilingual Playwright suite passed in Chrome against the actual Next.js handlers. It verified default Persian rendering, RTL and LTR, mobile navigation and title fit, locale persistence, localized errors, Persian search, Jalali entry, CSV exports, and Copilot approvals. The run captured 16 English and 20 Persian screenshots.
- One warmed embedded benchmark with 50,000 synthetic records and 15 sequential first-page requests measured 79.0 ms median and 171.4 ms p95 after storing the title search document. Production concurrency and representative workload performance remain unverified.
- The native migration and separate worker attempts could not connect to loopback PostgreSQL in this environment. The embedded migrations and the background task created during Playwright passed. The live provider was not exercised.
