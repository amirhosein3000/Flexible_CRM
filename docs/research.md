# Research and evidence

## CRM patterns

| Product | Observed design | Decision for this product |
| --- | --- | --- |
| HubSpot | Custom objects have properties, associations, pipelines, and settings surfaced in a data model editor. HubSpot documents plan and quantity constraints. | Start with named associations and a shared pipeline primitive. Make relationships understandable in settings, imports, and records. |
| Salesforce | Lookup and master-detail are distinct relationships with different lifecycle and ownership behavior. | Ship explicit typed links with independent record lifecycles. Reserve automatic deletion or inherited permissions for a case with demonstrated need. |
| Twenty, open source | Standard and custom objects use common fields and relationships, with contacts, companies and opportunities supplied as starter objects. | Make starter objects configuration and validate a second industry against the same screens. |
| EspoCRM, open source | Entity Manager lets admins define entities, fields and relationships, supported by metadata customization. | Keep one admin surface for the model. Store versioned tenant definitions in PostgreSQL so configuration is auditable and can be transacted. |

A field is a property of a record. An object earns its own identity when users keep multiple instances, attach notes, assign ownership, or relate it to several records. Pipelines represent an ordered process. Categories represent labels or classifications. Keeping those concepts independent avoids overloading “status” across industries.

Overgeneralization risks include slow lists, confusing configuration, broken saved filters after schema changes, and every integration facing unfamiliar contracts. Mitigate with supported field types, predictable migration rules, small template sets, index budgets, and the same acceptance flow on both templates. Avoid a workflow-first product with weak basic data entry.

## Primary references

- [HubSpot data model and associations](https://knowledge.hubspot.com/data-management/use-the-data-model-builder)
- [HubSpot custom objects and pipelines](https://knowledge.hubspot.com/object-settings/create-custom-objects?exid=167982)
- [Salesforce object relationships](https://trailhead.salesforce.com/content/learn/modules/data_modeling/object_relationships)
- [Twenty source documentation](https://github.com/twentyhq/twenty/blob/main/packages/twenty-docs/getting-started/core-concepts/data-model.mdx)
- [EspoCRM Entity Manager](https://docs.espocrm.com/administration/entity-manager/)
- [EspoCRM metadata extension model](https://docs.espocrm.com/development/metadata/)
- [Next.js supported release lines](https://nextjs.org/support-policy)
- [Node.js release lines](https://nodejs.org/en/about/previous-releases)
- [PostgreSQL supported release lines](https://www.postgresql.org/support/versioning/)
- [PostgreSQL 18 JSON types and indexing](https://www.postgresql.org/docs/18/datatype-json.html)
- [PostgreSQL 18 row security](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)
- [Drizzle migrations](https://orm.drizzle.team/docs/migrations)
- [Better Auth integration for Next.js](https://better-auth.com/docs/integrations/next)
- [Graphile Worker and job delivery](https://worker.graphile.org/docs)
- [Tailwind installation with Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
- [shadcn/ui component documentation](https://ui.shadcn.com/docs)
- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [OWASP prompt injection](https://genai.owasp.org/llmrisk2023-24/llm01-24-prompt-injection/)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
