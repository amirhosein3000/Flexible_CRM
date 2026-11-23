CREATE OR REPLACE FUNCTION crm.worker_workspaces() RETURNS TABLE(id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path=crm,pg_catalog AS $$ SELECT id FROM crm.workspaces $$;
REVOKE ALL ON FUNCTION crm.worker_workspaces() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION crm.worker_workspaces() TO crm_worker;
GRANT crm_app TO crm_worker;
