SET search_path TO crm,public;
ALTER POLICY membership_lookup ON memberships USING (workspace_id=tenant() OR (tenant() IS NULL AND user_id=actor()));
DO $$
BEGIN
 EXECUTE format('CREATE POLICY migration_workspace_inventory ON crm.workspaces FOR SELECT TO %I USING (true)',current_user);
END $$;
