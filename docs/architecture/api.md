# API design

## Routes in this checkout

| Route | Behavior |
| --- | --- |
| GET /api/auth | Current session and its active workspace memberships |
| POST /api/auth | Sign in or create an account with a valid workspace invitation |
| DELETE /api/auth | Revoke the current session |
| GET /api/crm/{workspace}?kind=… | Workspace bootstrap, record list or detail, workspace search, role-scoped CSV export, and workflow run history for workspace managers |
| POST /api/crm/{workspace} | Origin-checked command with an allowlisted action and typed data payload |
| GET /api/health | Verifies the database connection without exposing configuration |

Commands invoke the same domain authorization used by jobs. Use the application's current routes above. The resource-oriented paths below are a proposed future contract.

## Proposed resource-oriented routes

Pilot browser APIs are same-origin. Handlers use typed serialization and share application endpoints with server actions. A session authenticates every tenant route. Workspace path selection is checked against live membership. Prefix workspace routes with /api/v1/workspaces/{workspaceId}.

| Request under the workspace prefix | Purpose |
| --- | --- |
| GET /objects, POST /objects, PATCH /objects/{objectId} | Read and draft configuration |
| POST /objects/{objectId}/publish | Validate and publish a metadata revision |
| GET /objects/{objectId}/records, POST /objects/{objectId}/records | Query metadata-aware filters or create a record |
| GET /records/{id}, PATCH /records/{id} | Read or update a record with expected version |
| POST /records/{id}/archive, POST /records/{id}/restore | Manage active lifecycle |
| POST /records/{id}/relationships, DELETE /record-edges/{edgeId} | Add or remove authorized links |
| POST /records/{id}/stage-transitions | Move to verified pipeline stage |
| GET /records/{id}/timeline, POST /activities | Retrieve timeline or add notes and manual interactions |
| GET /tasks, POST /tasks, PATCH /tasks/{id} | Work queue and task management |
| GET /search, GET /overview | Permission-filtered search and fixed dashboard |
| GET or POST /views, PATCH /views/{id} | Saved table and board configuration |
| POST /imports, POST /imports/{id}/commit, GET /imports/{id} | Upload and map, then commit with an idempotency key and inspect row results |
| POST /exports, GET /exports/{id} | Start an export and authorize each result fetch |
| POST /workflows, POST /workflows/{id}/publish, GET /workflows/{id}/runs | Configure, publish and inspect automation |
| POST /ai/threads, POST /ai/threads/{id}/messages | Own-thread creation, bounded conversational request and streamed status |
| POST /ai/actions/{id}/approve, POST /ai/actions/{id}/reject | Explicit action lifecycle |
| GET /members, POST /invitations, PATCH /members/{id} | Role-checked membership lifecycle |

Use URLs for simple search and pagination. For complex object list filters, provide a typed JSON query via a read-only POST /objects/{id}/query. Filter clauses pair a stable field ID with an allowed operator and a typed value. Cap depth, count, page size and sort keys. Signed cursors bind workspace, normalized query, sort values and generation. Emit stable error codes with field paths and correlation IDs. Never return credentials, internal schema or raw provider errors.

Return 403 for denied workspace-level capabilities and 404 for hidden resources. Return 409 for stale state, duplicate keys with conflicting payloads, or invalid schema revision. Return 422 for typed validation failures, 429 for usage limits, and 202 for accepted background work. Use structured field errors. Require a version precondition for edits and an idempotency key for replayable submissions. Scope idempotency to actor, workspace and operation with payload comparison.

Copilot emits ordered status, evidence references, text, action proposal and terminal events. It reauthorizes stored references on return and clears partial state on disconnect or timeout according to the retention policy. Client recovery uses an allowed thread fetch. Document versioned API schemas and fixtures in code before building additional consumers.
