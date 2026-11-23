# Requirements and MVP scope

| ID | Pilot requirement | Acceptance |
| --- | --- | --- |
| CRM-01 | Invite and manage workspace membership, roles and assignments | One person can switch between two isolated workspaces. A viewer cannot mutate records. The last owner cannot be removed. |
| CRM-02 | Configure objects, ordered record sections, typed fields, categories, and named relationships | Admin configures Company → Engagement, validates field types and required fields, and archives fields with old data intact. |
| CRM-03 | Manage Contacts, Companies, Leads, Opportunities, and custom records | Users create, edit, assign, archive, and link records using metadata-driven forms. Leads and opportunities are separate records and can be linked manually. |
| CRM-04 | Configure several pipelines and move records on a board | Users select a pipeline, see valid stages, and move a record by keyboard or pointer. Stage move updates its timeline. |
| CRM-05 | Track tasks, manual communications, and notes | Users record a call or meeting, link a task and mark it complete. Record timeline includes dated activities and stage events. |
| CRM-06 | Search and filter data, save table and board views | People can find linked business context, select table columns, filter and sort, and save a personal or shared view according to role. |
| CRM-07 | Import and export CSV | Admin maps headers, sees row validation and explicit import outcome, and exports only visible results. Retrying a submitted import adds zero duplicate rows. |
| CRM-08 | Build bounded, no-code internal automations | Admin creates a stage-change or scheduled rule, adds conditions, and orders task, assignment or notification actions. Each step has a visible result and retries avoid duplicate effects. |
| CRM-09 | Answer questions about records and propose tasks | Authorized Copilot answers with record links, shows uncertainty with missing evidence, and previews an exact task for approval. A viewer cannot approve a write. |
| CRM-10 | Reuse starter configurations and provide an overview | Admin applies a versioned consulting or recruiting template. Home shows visible open opportunities, stage counts and overdue tasks with drill-through. |
| CRM-11 | Provide audit, administration, and support for a private pilot | Admin can review membership changes, model configuration, exports, and protected actions. Operators have backup, recovery, alerting, and operational runbooks. |

## Beyond the pilot

- Next candidates: automatic lead conversion, email and calendar sync, custom dashboard composition, user/team home layouts, file attachments, semantic search, document extraction, AI workflow drafting, and private-record, team-scoped or field-level permissions.
- Advance when usage supports them: third-party webhooks and public API, template packaging and sharing between organizations, governed AI record updates and assignments, expanded reporting, SSO, billing, and integration marketplace. Sending external communications needs explicit approval and channel controls.
- Pilot exclusions: arbitrary code, arbitrary AI tools, industry-specific runtime modules, customer-authored SQL, automatic schema migration between incompatible field types, arbitrary dashboards, and organization-specific database deployments.

## Operational objectives

| Area | Target to verify for pilot |
| --- | --- |
| Capacity | Test fixture of 50,000 records in one workspace, 10 concurrent users, 100 rows per page and an initial 5,000-row limit per CSV operation |
| Latency | p95 under 500 ms for filtered first-page lists and under 750 ms for search on the reference fixture. Copilot streams status after provider calls begin and stops on a configurable timeout. |
| Durability | Proposed recovery objectives are 24-hour maximum data loss and four-hour recovery. Verify with restore drill before onboarding. |
| Accessibility | Target WCAG 2.2 AA for core user flows. Check keyboard, focus, reduced motion, error feedback, and contrast. |
| Isolation | Zero cross-workspace disclosures in API, AI history, jobs, exports, invitation, and search integration tests. |
| Privacy | Explicit provider opt-in, workspace usage limits, bounded retention, documented deletion and export paths, and hosting/provider approval for the chosen geography. |
