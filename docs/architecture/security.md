# Tenant isolation and permissions

Cairn grants access through current workspace membership. Client-supplied workspace, record, and job identifiers are selectors. The service authenticates the session, checks and locks the relevant membership for the transaction, then sets local workspace scope. Business reads and mutations use explicit workspace predicates. Service authorization applies equally to UI, API, workers and Copilot. A missing or foreign resource returns the same response.

## Pilot permissions

CRM records, tasks and their timelines are shared within a workspace. Ownership and assignment route responsibility. Private-record, team-level and field-level CRM ACLs are deferred. Personal views, Copilot threads and targeted notifications have explicit per-user service checks.

| Capability | Owner | Admin | Member | Viewer |
| --- | --- | --- | --- | --- |
| Create a separate workspace as its owner | Yes | Yes | Yes | Yes |
| Read records, notes, tasks, boards, dashboard, search and shared views | Yes | Yes | Yes | Yes |
| Create, change, archive, restore or link records, log activities, assign and update tasks | Yes | Yes | Yes | No |
| Save and remove own personal views | Yes | Yes | Yes | Yes |
| Publish and remove shared views, manage objects, fields, relationships, pipelines and starter templates | Yes | Yes | No | No |
| Preview and commit own imports, export scoped records | Yes | Yes | No | No |
| Publish, enable, pause and retry automations, inspect runs and audit | Yes | Yes | No | No |
| Read own notifications and Copilot thread | Yes | Yes | Yes | Yes |
| Ask Copilot when enabled | Yes | Yes | Yes | Yes |
| Approve or dismiss own task proposal | Yes | Yes | Yes | No |
| Change workspace AI settings | Yes | No | No | No |
| Issue invitations and manage membership | Admin, Member and Viewer | Member and Viewer | No | No |
| Change owner or permanently purge workspace | Reserved for future controlled operations | No | No | No |

Only the addressee can accept a hashed, single-use, three-day invitation. Seed accounts can demonstrate acceptance. An invitation supports creation of a scoped credential account or acceptance by an existing account. Delivery remains manual and the invitation should only be sent through an approved channel. No route can remove or demote an owner. Revalidate active recipients before assignment and under the approval transaction.

## Table boundaries

| Boundary | Relations in the current migrations | Controls |
| --- | --- | --- |
| Global identity | users, sessions, sign_in_failures | Opaque hashed session tokens and expiration. Credentials and profiles remain in the identity store. Sign-in failures have no raw email and are rate-limited across app instances. The workspace service only projects explicitly allowed profile columns for active members. |
| Workspace root | workspaces, memberships | Workspace access through current membership. Workspace listing can bootstrap from the authenticated actor. Role checks and tenant scope precede business queries. |
| Configuration | invitations, objects, object_revisions, fields, pipelines, stages, relations, templates, views | Workspace-first primary keys. Composite FKs bind object, stage, revision and user references. View queries enforce creator or shared access. |
| CRM data | records, edges, activities, tasks | Composite FKs for tenant, endpoint object, actual record, owner, stage and relationship definition. Non-null identity components. One-to-one and one-to-many use partial unique edge indexes. |
| Data exchange and automation | imports, workflows, workflow_runs, workflow_failures, outbox, notifications | Actor, record and configuration references are scoped. Workspace-qualified events are resolved again before processing. Notifications filter recipient on read. |
| AI and operations | ai_threads, ai_messages, ai_actions, ai_usage, audit | Actor-owned threads and proposals, workspace-scoped records, audited decisions and explicit usage caps. Audit writes are append-only for the runtime role. |

All tenant-owned tables are subject to PostgreSQL RLS. Set workspace and actor via transaction-local settings and use a non-owner, non-superuser app role without BYPASSRLS. Policies use both USING and WITH CHECK. Identity bootstrap exposes own membership across workspaces and permits selected-workspace membership access only after service authorization. RLS catches omitted tenant filters. It depends on trustworthy transaction context and does not protect a compromised runtime able to change it. PostgreSQL referential integrity checks bypass RLS. Workspace-first keys and composite foreign keys provide the integrity boundary independently of row visibility. [PostgreSQL row security](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)

The current worker uses a separate database role and a function limited to listing workspace IDs, then sets one workspace per transaction. The migration runs under a separately provisioned, privileged migration role. Restrict that role to migration and recovery. Remaining work includes a production role-grant review, a dedicated queue transport role for Graphile Worker, and concurrent tests against hosted-equivalent PostgreSQL 18.

## Expected isolation evidence

- Records: an actor with memberships in A and B cannot read a B record by its UUID from A. An actor with access only to A cannot enter B. Querying tenant tables with unbound scope returns zero rows.
- Relationships: submit a B endpoint ID against a relationship in A. The service denies it, and PostgreSQL rejects a direct cross-tenant composite reference. Verify cardinality under concurrent creation in independent transactions.
- Imports: a preview created in A cannot commit in B. Change the schema before committing and verify conflict. Replay a committed preview and verify no duplicate records.
- Workflows: publish in A with a B stage or assignee and verify rejection. Test a revoked publishing actor, replayed stage event, and schedule failure. An A run affects no B records, task list or notification list.
- AI: validate B record and thread IDs fail in A, check the evidence list for B content, and deny proposals after actor revocation, timeout or target changes. A Viewer can ask and cannot approve a write.
- Runtime: verify tenant-session context after rollback, pooled connection reuse, unsupported tenant joins, and role grants. Use the migration and runtime roles separately in tests.

## Privacy and security operations

Cookie sessions use HttpOnly, SameSite and Secure with HTTPS, short-circuit invalid tokens and validate origin on writes. Account rate limiting currently uses in-process state. Use reviewed identity integration and shared rate limiting for private pilot readiness. Bound upload size, CSV records, and provider requests. Neutralize exported spreadsheet formulas. Keep secrets, prompts, and CRM payloads out of operational logs. Restrict provider egress and store secrets in the deployment secret store. Approve retention for conversations, CSV jobs, backups and audit before onboarding. Use synthetic data while the location, vendor, budget and data requirements are open.
