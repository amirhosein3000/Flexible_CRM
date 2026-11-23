# Cairn design review

## The daily follow-up journey

A practice lead opens the overview to find work that may slip. An account manager needs to see which commitment belongs to them, open the customer context, and close the loop. We prioritized that journey across the overview, queue, record profile and navigation. The existing stage chart, metadata-driven forms, keyboard command palette and bilingual interface already support it.

| Step | Original finding | Implemented decision |
| --- | --- | --- |
| 1. Choose a pipeline on the overview | The metric updated for the selected pipeline, but clicking it opened the default pipeline. | The metric opens the pipeline it counts. |
| 2. Review the task queue | Relative dates alone made urgent work hard to scan. The owner column showed names but had no personal filter. In Persian, English task titles could align at the opposite edge from the completion control. | Group visible tasks by overdue, today, upcoming, undated and completed. Apply ownership and status filters together. Use stable assignee IDs and workspace-local dates. Isolate each title within a row aligned to the interface language. |
| 3. Open a customer record | A user could create a linked task in the drawer but had to leave to see its status. | Put linked follow-ups directly under the record actions. Fetch them for the authorized record, independent of the workspace task feed. Show up to five, with open work first, and allow completion and reopening in place. |
| 4. Inspect a record table | Every sortable column displayed the same down arrow. Some Persian headers for non-sortable fields used the English label. | Show the applied direction, announce it through the column header, and resolve every field label through the bilingual metadata helper. |
| 5. Navigate back or switch screens on a phone | Navigation replaced browser history. Mobile navigation left the page visible and interactive behind the rail. Search required opening the menu. | Preserve screen history and departing list filters, contain focus in a dismissible mobile drawer, and provide a search action in the phone header. Group workspace creation with the switcher. |

## Visual and interaction direction

Keep the existing cobalt identity, Persian typography and compact working surfaces. On the task screen, give each deadline group a heading and count. Reserve the warm tint for overdue work. On the record profile, place the next commitment before field detail so an account manager can act during a call. Search and the current destination should remain recognizable in a dense rail. Navigation motion respects reduced-motion preferences.

## Scope and future validation

The task queue filters the existing workspace feed of up to 250 tasks. Server-side ownership filtering and pagination would support larger teams. The record drawer fetches its own bounded preview. A full record-specific task history could follow if pilot users need it.

Test the daily journey with Persian-speaking account managers, including people who use mixed-script customer names. Measure time to find and complete a follow-up and observe whether people understand who owns it. Synthetic browser QA establishes behavior; usability, assistive-technology experience and pilot-scale performance still need direct evaluation.

## Review evidence

The bilingual browser suite writes local evidence under `screenshots-bilingual/en` and `screenshots-bilingual/fa-IR`. In each directory, `04-record-detail.png` shows the in-context follow-up panel and `07-tasks.png` shows the deadline groups. The Persian capture `18-mobile-navigation.png` shows the modal rail. Screenshots contain synthetic workspace data and stay outside source commits.

Lint, TypeScript, all 20 unit and embedded database tests, and the production build passed. The bilingual Chrome suite captured 19 English and 23 Persian screenshots, including 390-pixel task queues. The build passed on retry after Next.js reported a security advisory for the installed version. Dependency review remains a release gate.
