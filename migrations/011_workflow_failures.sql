CREATE TABLE crm.workflow_failures (
  workspace_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL,
  event_id uuid NOT NULL,
  record_id uuid,
  step_index integer CHECK (step_index BETWEEN 0 AND 7),
  retryable boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id, workflow_id) REFERENCES crm.workflows,
  FOREIGN KEY (workspace_id, event_id) REFERENCES crm.outbox ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, record_id) REFERENCES crm.records
);
CREATE INDEX workflow_failures_history ON crm.workflow_failures(workspace_id, workflow_id, created_at DESC);
ALTER TABLE crm.workflow_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.workflow_failures FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_scope ON crm.workflow_failures
  USING (workspace_id = crm.tenant())
  WITH CHECK (workspace_id = crm.tenant());
GRANT SELECT ON crm.workflow_failures TO crm_app;
GRANT INSERT ON crm.workflow_failures TO crm_worker;
