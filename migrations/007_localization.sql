ALTER TABLE crm.workspaces ADD COLUMN currency text CHECK(currency ~ '^[A-Z]{3}$');
ALTER TABLE crm.workspaces ADD COLUMN time_zone text NOT NULL DEFAULT 'UTC';
GRANT UPDATE(currency,time_zone) ON crm.workspaces TO crm_app;

ALTER TABLE crm.objects ADD COLUMN name_fa text, ADD COLUMN plural_fa text;
ALTER TABLE crm.fields ADD COLUMN name_fa text;
ALTER TABLE crm.fields DROP CONSTRAINT fields_kind_check;
ALTER TABLE crm.fields ADD CHECK(kind IN ('text','longtext','decimal','number','currency','date','timestamp','boolean','email','phone','url','select','multi'));
ALTER TABLE crm.pipelines ADD COLUMN name_fa text;
ALTER TABLE crm.stages ADD COLUMN name_fa text;
ALTER TABLE crm.relations ADD COLUMN label_fa text, ADD COLUMN inverse_fa text;
ALTER TABLE crm.activities ADD COLUMN stage_id uuid;

CREATE FUNCTION crm.search_normalize(source text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
RETURN trim(regexp_replace(
  regexp_replace(translate(lower(source),'يىك۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩‌‍','ییک01234567890123456789  '),'[ـً-ٰٟ]','','g'),
  '[[:space:]]+',' ','g'
));
ALTER TABLE crm.records ADD COLUMN localized_search_document tsvector
  GENERATED ALWAYS AS (to_tsvector('simple'::regconfig,crm.search_normalize(title))) STORED;
CREATE INDEX records_localized_search_document ON crm.records USING gin(localized_search_document) WHERE archived_at IS NULL;
