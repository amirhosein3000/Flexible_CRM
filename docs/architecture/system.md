# System architecture

Cairn is a TypeScript modular monolith. Next.js hosts the client and routes. Domain services validate metadata, authorize against current workspace membership and own transactional writes. PostgreSQL stores identity, metadata, records, links and durable state. Drizzle provides the database adapter and readiness probe. Reviewed SQL migrations specify constraints and policies, while domain commands use explicit SQL with bound inputs.

| Component | Target | Verified checkout |
| --- | --- | --- |
| Next.js | 16.x stable | Installed 16.4.3 and built successfully. Re-pin to the current maintained 16.x patch before deployment. |
| TypeScript | Stable Next.js-compatible release | Installed 5.9.3. |
| Node.js | 24 LTS | Ran on 24.11.1. |
| PostgreSQL | 18, patched | Embedded 18.6 ran migrations and tests. Native 18 server validation is still required. |
| Drizzle | Stable PostgreSQL driver path | Installed ORM 0.45.4. |
| Better Auth | Supported stable Next/Drizzle adapter | Recommended integration verified in documentation. The package was unavailable offline and current sessions use a database-backed local implementation. |
| Graphile Worker | PostgreSQL job delivery and scheduling | Required by the approved plan. The package was unavailable offline and current workflow processing uses a PostgreSQL polling worker. |

[Next.js v16 runtime requirements](https://nextjs.org/docs/app/guides/upgrading/version-16) · [Node.js release table](https://nodejs.org/en/about/previous-releases) · [PostgreSQL version policy](https://www.postgresql.org/support/versioning/) · [Drizzle PostgreSQL adapter](https://orm.drizzle.team/docs/get-started-postgresql) · [Better Auth Next integration](https://better-auth.com/docs/integrations/next) · [Graphile Worker documentation](https://worker.graphile.org/docs)

## Workflow processing

A stage transition writes the record, activity, audit and outbox event in one transaction. Current processing scans ready events within one authorized workspace, acquires a workspace advisory lock, rechecks the workflow publisher's membership, and commits effects and the run's unique (workspace, workflow, event, target) key together. Failed transactions roll back the effects and record bounded retry or terminal outcome. Recurring work uses daily or weekly schedules with IANA time zones. Repeated local times run once and skipped times run at the first valid minute. Durable per-step status and operator retries remain unimplemented.

The approved target adds a dedicated dispatcher between the outbox and Graphile Worker. The dispatcher leases only committed events and enqueues an allowlisted task with a stable workspace/event key. It marks the event dispatched after the job is durable. Prefer enqueuing and marking within one transaction on the same PostgreSQL database. When those operations are separate, repeat enqueue after a crash and rely on the execution key for correctness. Graphile job keys reduce duplicate deliveries. Domain execution remains idempotent across re-enqueue, acknowledgment failure and worker crashes. A recurring Graphile tick discovers due occurrences, then stores one durable occurrence key and event atomically. The worker receives workspace and event IDs, loads the outbox row in that workspace and revalidates publisher/assignee permissions before each effect. Set a fixed workflow action catalog and separate migration, dispatch, transport and tenant service roles.

[Graphile Worker SQL enqueue and job keys](https://worker.graphile.org/docs/sql-add-job) · [Graphile Worker recurring tasks](https://worker.graphile.org/docs/cron)

## Deployment and privacy

The pilot target is a private environment with application and worker processes from the same release, a managed PostgreSQL 18 instance, TLS, encrypted backups and connection credentials scoped by role. Use versioned backward-compatible migrations first, then deploy app and worker. Verify restore, readiness and rollback from a deployment-like environment. The hosting provider, region and cost envelope remain open until the pilot jurisdiction and customer data requirements are established. Use synthetic data until those decisions are approved.

The local preview uses embedded PostgreSQL only with both demo flags set. It starts the workflow loop in the same process. This mode validates shared application paths and SQL semantics. Concurrent pooled connections, worker process separation, managed backups and network access need independent verification.
