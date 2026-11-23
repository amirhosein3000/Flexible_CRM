ALTER TABLE crm.objects ADD COLUMN layout jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(layout)='array');
