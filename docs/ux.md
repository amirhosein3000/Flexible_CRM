# UX and screen specifications

The design is a compact workspace for sustained data entry and review. Use a neutral background, strong table hierarchy, one accent color for primary actions, restrained stage color, and clear focus states. Use a legible sans-serif and tabular numerals for counts. Keep calls to action near the information they affect. Layouts come from metadata.

| Surface | Main content and interactions |
| --- | --- |
| Workspace entry | Sign in, accept invitation, choose workspace, show explicit disabled or expired states |
| Home | Overdue tasks and stage counts with drill-through, recent activity, quick create |
| Object index | Saved views, query chips, sortable table, selectable columns, record count, quick create and import |
| Board | Pipeline switcher, stage counts, keyboard move menu, pointer dragging, accessible live confirmation |
| Record detail | Header with name, owner and status. Configurable field sections, related records, timeline and create-task action |
| Task queue | My tasks by due date, overdue state, completion, linked record with permission-aware fallback |
| Global search | Shortcut opens search across visible objects. Show matched object, label and permitted snippets. |
| Copilot | Contextual drawer from record or global shell, evidence links, thread history and an approval panel |
| Settings | Workspace, members, data model, fields, record layouts, pipelines, templates, automations, AI settings and audit |
| Import and export | Upload, field mapping, row preview, commit, report and authorized download |

Top-level navigation uses a workspace switcher, Home, Tasks, objects from metadata, a search entry, and Settings when authorized. Page state preserves workspace, selected object, filters and view. Detail URLs support deep links. Unsaved forms preserve input on validation failure and warn before losing drafts. Empty states offer a context-appropriate next step. Rejected access avoids disclosing resource existence.

## Key flows

- Setup: invite → apply a template → inspect sample objects → import or add a company → open its record.
- Daily follow-up: overdue view → open relevant record → inspect timeline → create or complete task → return to the same filters.
- Schema change: settings → add field or link → preview effect and dependencies → publish → inspect metadata-driven forms.
- Stage move: choose destination → validate and save → show timeline update and an activity indication. Show a recovery action on network or version conflict.
- Copilot task: ask in context → open a cited record when needed → review exact task → approve or dismiss → see saved task and result.

## Initial visual concepts

At desktop widths, the object list uses a narrow left sidebar, a full-width command row, and a compact table. The record detail begins with a header and a split body, with configurable fields on one side and activity on the other. A Copilot drawer opens from the right and can overlay the board when horizontal space is constrained.

At mobile widths, use one full-width record section at a time, stacked filters, and stage-list tabs alongside the table or board choice. Support shallow navigation and consistent back behavior. Use semantic tables and forms, visible focus, non-color statuses, escaped text, predictable dialog focus and accessible error messages. Test keyboard-based creation, filtering, stage movement, and task approval. See [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
