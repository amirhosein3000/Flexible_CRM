CREATE TABLE crm.sign_in_failures (
  key text PRIMARY KEY,
  hits integer NOT NULL CHECK (hits BETWEEN 1 AND 8),
  expires_at timestamptz NOT NULL
);
CREATE INDEX sign_in_failures_expiry ON crm.sign_in_failures(expires_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON crm.sign_in_failures TO crm_app;
