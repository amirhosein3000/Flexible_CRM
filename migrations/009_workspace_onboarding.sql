GRANT INSERT (id,name) ON crm.workspaces TO crm_app;
CREATE POLICY workspace_onboarding ON crm.workspaces FOR INSERT TO crm_app
  WITH CHECK (id=crm.tenant() AND crm.actor() IS NOT NULL);
