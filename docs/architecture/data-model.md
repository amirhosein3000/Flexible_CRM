# Configurable PostgreSQL data model

The selected hybrid uses relational workspace, metadata, pipeline and link tables with a typed JSONB values document per record. The recruiting and consulting templates exercise the same engine.

| Storage approach | Advantages | Cost |
| --- | --- | --- |
| Fixed relational tables by industry | Native constraints, simple indexes and queries | Requires code and migrations for new industries. |
| Dynamic tables or schema per object | Native columns, constraints and filters | Customer configuration becomes runtime DDL and makes upgrades, pooling and grants harder. |
| Typed EAV | Sparse fields with a typed index per value | Sorting, multiple conditions and rendering each record require additional joins or pivots. |
| Document-only records | Easy sparse record storage | Tenant-aware references and cardinality rely on discipline outside the database. |
| Relational envelope and typed JSONB | Workspace and link integrity plus flexible fields without runtime DDL | Custom field rules run in shared server codecs. Targeted indexes require workload evidence. |

[PostgreSQL JSONB and indexing](https://www.postgresql.org/docs/18/datatype-json.html) · [PostgreSQL constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)

## Metadata and records

An object has a stable UUID, immutable workspace-unique key, singular and plural labels, icon, and revision. Each field belongs to one object and has its own stable UUID, type, name, order, required flag and select options. The object revision stores an immutable snapshot. Each record stores workspace, object, title, optional assignee, optional pipeline and stage, timestamps, row version, schema revision and a JSONB object keyed by field UUID. Both revision and row version are checked when updating data. A record on a pipeline references that pipeline for the same object and a stage in that pipeline. A pipeline and stage are set together.

One server codec validates record edits, CSV mapping, filters and workflow condition values. Short and long text have bounded lengths. Decimal values use bounded strings and numeric sort. Dates and timestamps use validated ISO forms; timezone policy still needs full deployment review. Boolean values are actual booleans. Email, phone and HTTP(S) URL use bounded format checks. Single and multiple selections use field options. The current code stores choice strings. Stable option IDs and option revision tooling remain a target before option editing is offered. An unset value is omitted, while false, zero and an empty optional selection remain values. Required text cannot be blank and required multi-select must have a selection.

The current app allows creating objects, creating and archiving fields, layout sections, applying versioned templates, and editing pipelines with ordered stages. Adding a required field to an object with data is blocked. Archived custom values are retained but omitted from ordinary views. Future schema evolution should preview affected data and dependencies, use a staged backfill for constraints, keep immutable IDs for a compatible rename, and publish an incompatible type change as a new field after copy and review. Configurable field and option migrations, and schema dependency repair are still pending.

## Relationships and lifecycle

Relations specify forward and inverse names, endpoint object types and cardinality. Source and target references include workspace, object and record IDs. The edge also references the definition's workspace, ID, endpoint types and cardinality. Unique composite keys prevent duplicate links. A one-to-one relation has unique source and target. One-to-many allows many targets per source, with unique target. Many-to-many has neither endpoint limit. Relationships are optional. Same-object links are legal, with a database check against self-links.

Record archive suppresses the record and links from ordinary reads without deleting historical activities or relationship rows. Archived endpoints continue to reserve their links until explicit unlink. No cascade removes linked records. A retention purge must explicitly process dependent entities. Restore revalidates the record against active metadata and reactivates retained relationships when both endpoints are active. Hard deletion is reserved for an approved retention procedure. The pipeline builder rejects deletion of stages with records or workflow references. Users can rename, reorder, and add stages without changing existing stage IDs.

## Queries and indexes

Typed queries require workspace and object predicates. User-provided values and JSON paths are parameterized. Fixed sorting and metadata-approved custom fields use an allowlist, type-appropriate casts, NULLS LAST and record-ID tie-breaking. Current filters are title search, owner, stage, and custom-field equality or unset. A select can be filtered by exact option, a multi-select by one member. Sorting omits long text and multi-select. Current tables use bounded offset pagination. Signed cursor pagination, custom-field range predicates and shared query compilation across all consumers remain work.

Indexes cover active workspace/object/updated order, active stages, edge reverse lookups, task due dates, record activities, and a stored PostgreSQL full-text document over titles with a partial GIN index for active records. Add custom expression or GIN indexes only after representative 50,000-record benchmarks. Metadata configuration should not trigger per-object DDL. Cross-workspace joins fail regardless of custom field values. See [tenant isolation](security.md).
