# Product brief

## Vision

Give client-facing teams a single, configurable place to see relationships, move work forward, and decide who needs attention. A workspace admin should be able to adapt the CRM as the business changes. Copilot should answer from records a user can access and link back to the evidence.

## Discovery decisions

| Decision | Recommended default | Status and consequence |
| --- | --- | --- |
| First customer and job | Small B2B service and consulting teams | Confirmed. The 5–25 person size band and inquiry-to-proposal scope are pilot hypotheses to validate. |
| Hosting and market | Multi-tenant SaaS, piloted privately | Confirmed. Invite-only access is proposed. Confirm launch geography and hosting region before using live customer data. |
| Roles and record access | Owner, Admin, Member and Viewer. Workspace records are shared. Ownership and assignment express responsibility. | Confirmed. Team and private-record access rules are deferred. |
| AI and data | Configurable AI provider | Confirmed. Provider, model, and data handling remain open. The plan proposes default-off AI, one approved provider, and a deterministic test adapter. |
| Integrations | CSV import and export | Confirmed. Manual interaction logging and in-app notifications are proposed for the pilot. Email/calendar sync remains a later candidate. |
| Deployment | One app process and one worker process backed by managed PostgreSQL. Private pilot and no billing. | Provisional. Select a vendor after jurisdiction, provisioning, and budget decisions. |

Confirmed by the brief: metadata-configured objects, fields and relationships, usable core CRM flows, structured and permission-aware AI, consequential action approval, production-quality engineering, and a product/architecture review before implementation.

Recruitment is the second validation template, using Candidate, Employer, Position, and Interview. Real estate provides a useful design check for relationship cardinality and concurrent pipelines. Both can validate generality without increasing the first customer's feature set.

## Validation

Interview five target users across buyer, admin, and account manager roles. Ask each to show the last intake, handoff, and missed follow-up using redacted work examples. Record the existing tools, manual steps, frequency, cost of missed handoffs, and actual access boundaries. Test whether they can configure the template without help before prioritizing advanced settings. Treat these targets as hypotheses pending interviews. The founder approved the product direction and MVP scope.

Pilot targets: four of five users independently import or create their first client, move an opportunity, and schedule a follow-up within 20 minutes. An admin can configure a useful custom object and relationship in 15 minutes. During the pilot, track weekly active operators, overdue follow-ups, time to first successful import, and supported/copilot answer coverage. Collect a baseline before making improvement claims.
