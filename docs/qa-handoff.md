# Local release QA

The QA pass used synthetic Studio North and Recruiting Lab data only. No public deployment was made. [README.md](../README.md) has demo access and startup commands. [AGENTS.md](../AGENTS.md) is the development entry point.

## Review assignments

| Reviewer | Scope and evidence |
| --- | --- |
| Functional QA | Ran the bilingual Playwright suite and traced authentication, records, settings, CSV, workflow and Copilot journeys. Observed an intermittent first-load sign-in timeout and missing workspace and relationship coverage. |
| UI and localization QA | Compared English and Persian browser screenshots across desktop and mobile. Observed the first-load timeout and weak discoverability of horizontal board scrolling on narrow screens. |
| Security and backend QA | Reviewed session checks, workspace authorization, database constraints, imports, worker and AI approval, and ran the embedded PostgreSQL suite. Identified the process-local sign-in limiter and native deployment verification gap. |

## Findings and fixes

| Priority | Finding | Fix and verification |
| --- | --- | --- |
| High | A failing rule could roll back successful sibling rules for the same event. | Per-rule savepoints preserve valid effects. Reproduced with a revoked assignee in a synthetic workspace and verified an operator retry creates exactly one task per rule. |
| Medium | Administrators could not recover terminal automation jobs from the product. | Automations shows bounded failed jobs and a workspace-scoped retry action. Domain tests cover Owner approval, Viewer denial, foreign scope and duplicate retries. |
| Medium | Authenticated users could switch workspaces but had no creation flow. | Added Persian and English onboarding, transactionally assigned the creator as Owner, and recorded an audit event. Database tests cover duplicate submission and scope. English Playwright creates and selects a workspace. |
| Medium | Sign-in throttles reset with process restart and were independent across replicas. | PostgreSQL now stores bounded counters. Tests check persisted failures, the ninth-attempt limit, and expiry. |
| Medium | A correct demo sign-in could time out when first database initialization happened during the browser flow. | Demo warms the database before reporting readiness. Both browser suites check health before sign-in. The final suites passed. |
| Low | Mobile boards needed an indication that more stages were offscreen. | Added a localized swipe hint and visually reviewed the narrow board. The suite checks page-level overflow. |
| Low | Relationship picker needed a stable accessible name. | Named the selector explicitly. Playwright links an opportunity to a second company and verifies the resulting link. |

## Integrated checks

| Check | Result |
| --- | --- |
| Locked package install dry run | Passed using the existing offline npm cache. |
| ESLint and TypeScript | Both passed. |
| Node test runner and embedded PostgreSQL 18.6 | 20 passed, 0 failed, 0 skipped. Migrations ran before tests. |
| Next.js production build | Passed with Next.js 16.4.3 on Node.js 24.11.1. |
| Playwright and Chrome | English LTR and Persian RTL suites passed, with desktop and 390 px mobile checks. Captured 16 English and 20 Persian screenshots. |
| Application and automation | Health returned 200 in both browser runs. A browser stage change created a task through the embedded worker. The synthetic CLI reached its loopback startup message. |

Playwright exercised invitation onboarding and role-specific navigation, workspace creation and switching, template records, saved views, search, linking, timeline activities, schema and layout configuration, CSV, pipeline editing and stage changes, automation and task creation, Copilot evidence and approval, locale persistence and mobile navigation. Persian tests also covered a localized sign-in error, Persian letter variants, Vazirmatn, localized numerals, Jalali input and canonical CSV values. Integration tests additionally checked expired sessions, permission revalidation, foreign scope, metadata conflicts, job recovery and AI approval replay.

The follow-up browser run also opened due tasks from the localized overview, navigated from keyboard search, saved and restored a filtered board, and opened completed automation step history in both languages. Integration assertions verified failed step recording and successful replay without duplicate actions.

Tenant boundary assertions passed in the embedded database for records, relationship endpoints, import commits, workflow references and retries, AI evidence and threads. The tests exercise role and RLS restrictions. Findings apply to the tested paths and synthetic environment.

## Open pilot gates

- Better Auth and Graphile Worker remain approved dependencies pending integration. The verified checkout uses local credential sessions and a PostgreSQL outbox poller.
- Native PostgreSQL 18 migrations, role grants, pool and independent worker concurrency still need a connected isolated server. Loopback TCP requests were denied in this QA environment. Embedded PostgreSQL and IPC browser verification ran successfully.
- Dependency-aware schema changes and stable pagination remain under [the roadmap](roadmap.md).
- Live provider, package advisory review, representative multi-user performance, accessibility audit and backup restore drill remain open. Resolve hosting, jurisdiction and data-handling requirements before introducing customer data.
