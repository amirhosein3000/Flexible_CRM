# Copilot architecture

AI is off by default. The implementation has one live adapter, OpenAI, and a deterministic synthetic adapter. The live adapter is usable only when the operator sets an approved configuration, credentials and model, then a workspace Owner opts in. The fixture adapter is limited to synthetic demo mode. Neither provider has database access or mutation credentials.

## Retrieval and evidence

Read the current session and membership, resolve the actor-owned thread, and retrieve records under that transaction's workspace. The browser can specify a record context. The application validates it, then supplies a bounded projection of active record titles, pipeline stages and last contact timestamps. This projection excludes custom fields, raw notes and files. Contact times use logged calls and meetings. The approved follow-up includes a retrieval evaluation for more nuanced stale lists, inconsistent data and counts.

Use short application-generated evidence IDs. Validate every returned reference against the bounded set for that request and generate links from the matched record IDs. Provider results and CRM content are untrusted and shown as escaped text. The live adapter uses structured output and server-side schema validation. The currently implemented provider has no autonomous tool loop. The target tool allowlist is find_records, get_record_context, count_by_stage and propose_task, with bounded inputs and the same authorization checks as the corresponding domain services. Persisted message replay, link revalidation for historical responses, configurable egress field allowlists and advanced retrieval remain work.

## Approval transaction

A structure describing a task becomes an immutable proposal tied to requesting workspace, actor, thread, target version and an expiration of 15 minutes. The browser presents exact title, linked record, assignee, due date and expiry. Only an authenticated deliberate approval invokes the domain command. Inside a transaction, recheck current membership, role, own proposal, workspace setting, expiry, record version and active assignee. Commit task, audit event and proposal outcome together. A repeated successful approval returns the original task. A Viewer can ask but cannot propose or approve writes. Task creation is the only supported mutation.

## Data handling

Use timeouts, bounded response sizes, and a workspace-scoped request budget. Current limits are 25 requests per user per rolling day and 250 per workspace per rolling month. A transaction-scoped lock prevents concurrent budget checks from exceeding the count limit. Token-based cost reservation, configurable retention, provider deletion review and conversation-history controls remain open. Do not include prompts or model output in logs. Configure TLS egress to the approved endpoint, store secrets server-side and require approval of region, customer data terms and retention before live use. The deterministic adapter is verified with synthetic data, and the live provider still needs an approved smoke test.

[Structured function calling](https://developers.openai.com/api/docs/guides/function-calling) · [Untrusted content and prompt injection](https://genai.owasp.org/llmrisk2023-24/llm01-24-prompt-injection/)
