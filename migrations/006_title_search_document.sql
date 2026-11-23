ALTER TABLE crm.records ADD COLUMN search_document tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig,title)) STORED;
CREATE INDEX records_search_document ON crm.records USING gin(search_document) WHERE archived_at IS NULL;
DROP INDEX crm.records_search;
