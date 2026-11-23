# Persian and English in Cairn

Cairn defaults to fa-IR. The language control on sign-in and in the workspace header persists the selected locale in a first-party cookie. The Next.js root layout writes the selected language and direction into the server-rendered document. The same application components use the matching next-intl catalog. User text and language-independent IDs follow the same application routes and permissions.

## Design

The Persian interface uses self-hosted Vazirmatn Variable (OFL 1.1), relaxed leading, and Persian digits. English uses the original sans-serif stack. The RTL rail opens on the right, contextual drawers open at inline end, and Kanban stages and chart axes follow reading order. Logical spacing and alignment keep forms and tables shared. Names, emails, URLs, and mixed-language values have their own bidirectional context.

## Dates, amounts and search

- Persian defaults to the Solar Hijri calendar and English to Gregorian. Each user can change the calendar under Regional settings. Date and date-time fields accept localized inputs and convert them to Gregorian ISO dates or UTC timestamps.
- Workspace Owners and Admins can set an ISO 4217 currency and IANA time zone independently of language. A new workspace has an unset currency and a UTC time-zone default. Currency fields use the configured currency, while decimal fields remain unitless. Date-only values are never shifted by a time-zone conversion.
- Database search separately normalizes Arabic and Persian yeh and kaf, removes common Arabic marks, and accepts both numeral sets. Search indexing does not rewrite the original records.
- Built-in consulting and recruitment configuration includes translations, with migration support for identifiable legacy labels. Custom names, options, labels, record values, notes, workflow messages and user-entered data keep the exact supplied text. An edited built-in pipeline label becomes an explicit workspace value.

## CSV and Copilot

CSV accepts UTF-8. Persian exports include a BOM and localized titles and built-in headers. Mapping is keyed by stable field identifiers and accepts built-in header aliases. CSV dates are exchanged as Gregorian ISO values and number values use canonical notation. Error reports follow the request language. CSV files are intended for machine-consistent round-trips.

Copilot receives the request locale and uses workspace-scoped normalized retrieval. The deterministic adapter is bilingual. The live adapter prompts for the selected language and preserves product and record identifiers. Both adapters return the same pending action structure and approval checks. Local tests use the synthetic adapter.

## Upgrade and verification

Apply migrations 007 and 008 before opening an existing database with this build. The second migration backfills only recognized built-in labels and requires a maintenance role allowed to read across workspaces. It fails if RLS would silently skip rows. Existing stored values are retained. The new search projection is generated from the original text.

Run lint, type checking, the automated tests, and a production build. Build with NEXT_PUBLIC_CRM_DEMO=1 to run the bilingual Playwright suite with synthetic data. Captures are written to screenshots-bilingual/en and screenshots-bilingual/fa-IR. The suite exercises both UI locales, mobile navigation, record operations, pipeline movement, workflow automation, CSV, and Copilot approvals.

[Next.js internationalization](https://nextjs.org/docs/app/guides/internationalization) · [next-intl App Router integration](https://next-intl.dev/docs/getting-started/app-router) · [Vazirmatn project](https://github.com/rastikerdar/vazirmatn)
