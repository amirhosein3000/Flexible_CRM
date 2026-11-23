# Architecture decision records

The founder approved the product direction and MVP scope, then authorized implementation. The table records architecture and implementation status.

| ID | Decision | Tradeoff and current status |
| --- | --- | --- |
| ADR-001 | TypeScript modular monolith with separate app and worker entry points | Next.js 16 and Node.js 24 are retained. Separate workers keep retry load off the HTTP process in a normal deployment. |
| ADR-002 | Use a relational envelope and metadata plus validated JSONB | Strong referential constraints and flexible fields without dynamic DDL. Benchmark complex filters and improve metadata tooling. |
| ADR-003 | Use PostgreSQL tenant keys, application authorization, and RLS | Simpler than database-per-tenant and more robust than one isolation layer. Reviewed production grants and full server deployment tests are open. |
| ADR-004 | Apply industry configuration as versioned templates | Same runtime serves consulting and recruiting. Major template changes require migration rules. |
| ADR-005 | One approved provider, a deterministic test adapter, off by default, and explicit task approval | The app implements an OpenAI adapter that requires operator and workspace enablement. Real-provider approval and smoke testing remain open. |
| ADR-006 | Transactional outbox and Graphile Worker for scheduled automation | The checkout runs a PostgreSQL polling worker with bounded retries, per-rule rollback, workspace-scoped manual retry and idempotent run keys. Graphile Worker remains an approved requirement pending integration. |
| ADR-007 | Use PostgreSQL search and bounded retrieval | Active title search is implemented. Configurable field search, stronger retrieval and measured scale remain open. |
| ADR-008 | Owner, Admin, Member, Viewer and shared records | Assignments express responsibility. Team, private-record, and field-level ACLs are deferred. |
| ADR-009 | Better Auth for reviewed identity integration | The current checkout uses a local database-backed credential/session service because Better Auth was unavailable in the offline environment. Better Auth integration and verified account onboarding remain open. |
| ADR-010 | Keep PostgreSQL 18 as the target and support a synthetic embedded preview | TCP connections are restricted in the execution environment. Embedded PostgreSQL 18.6 exercises the same SQL and policies. It cannot substitute for production networking, concurrency, process separation or backup testing. |
| ADR-011 | Keep hosting vendor and region open | Use synthetic data until founder approves jurisdiction, customer data requirements, and budget. The private pilot also requires provider data-handling review. |
| ADR-012 | Keep sign-in throttles in PostgreSQL | Transactional counters and per-key locks coordinate sign-in across app processes. Registered accounts use hashed email keys and unknown accounts use bounded hash buckets. A separate ingress traffic policy remains part of pilot deployment. |
