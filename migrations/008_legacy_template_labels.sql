-- Attach translations only to known, installed templates. Keep source names and customer content.
SET LOCAL row_security = off;
WITH template_labels(template_key,object_key,name_en,plural_en,name_fa,plural_fa) AS (
  VALUES
    ('consulting','opportunity','Opportunity','Opportunities','فرصت','فرصت‌ها'),
    ('consulting','contact','Contact','Contacts','مخاطب','مخاطبان'),
    ('consulting','company','Company','Companies','شرکت','شرکت‌ها'),
    ('consulting','lead','Lead','Leads','سرنخ','سرنخ‌ها'),
    ('recruitment','position','Position','Positions','موقعیت شغلی','موقعیت‌های شغلی'),
    ('recruitment','candidate','Candidate','Candidates','متقاضی','متقاضیان'),
    ('recruitment','employer','Employer','Employers','کارفرما','کارفرمایان'),
    ('recruitment','interview','Interview','Interviews','مصاحبه','مصاحبه‌ها')
)
UPDATE crm.objects o SET name_fa=l.name_fa,plural_fa=l.plural_fa
FROM crm.templates t JOIN template_labels l ON t.key=l.template_key AND t.version=1
WHERE o.workspace_id=t.workspace_id AND o.key=l.object_key AND o.name=l.name_en AND o.plural=l.plural_en AND o.name_fa IS NULL;

WITH field_labels(object_key,field_name,kind,label) AS (
  VALUES ('opportunity','Value','decimal','مبلغ'),('position','Budget','decimal','بودجه'),
    ('contact','Email','email','ایمیل'),('candidate','Email','email','ایمیل'),
    ('company','Website','url','وب‌سایت'),('employer','Website','url','وب‌سایت')
)
UPDATE crm.fields f SET name_fa=l.label
FROM crm.objects o JOIN field_labels l ON l.object_key=o.key
JOIN crm.audit original ON original.workspace_id=o.workspace_id AND original.target_id=o.id AND original.event='object.created'
JOIN crm.audit added ON added.workspace_id=o.workspace_id AND added.created_at=original.created_at AND added.event='field.added'
WHERE f.workspace_id=o.workspace_id AND f.object_id=o.id AND f.id=added.target_id AND o.name_fa IS NOT NULL
  AND f.name=l.field_name AND f.kind=l.kind AND f.name_fa IS NULL;

WITH pipeline_labels(object_key,name_en,name_fa) AS (
  VALUES ('opportunity','Sales pipeline','فرایند فروش'),('position','Hiring pipeline','فرایند استخدام')
)
UPDATE crm.pipelines p SET name_fa=l.name_fa
FROM crm.objects o JOIN pipeline_labels l ON l.object_key=o.key
JOIN crm.audit original ON original.workspace_id=o.workspace_id AND original.target_id=o.id AND original.event='object.created'
JOIN crm.audit created ON created.workspace_id=o.workspace_id AND created.created_at=original.created_at AND created.event='pipeline.created'
WHERE p.workspace_id=o.workspace_id AND p.object_id=o.id AND p.id=created.target_id AND o.name_fa IS NOT NULL AND p.name=l.name_en AND p.name_fa IS NULL;

WITH stage_labels(pipeline_en,stage_en,stage_fa) AS (
  VALUES ('Sales pipeline','Qualified','واجد شرایط'),('Sales pipeline','Discovery','شناخت نیاز'),
    ('Sales pipeline','Proposal','پیشنهاد'),('Sales pipeline','Negotiation','مذاکره'),('Sales pipeline','Won','برنده‌شده'),
    ('Hiring pipeline','Open','باز'),('Hiring pipeline','Screening','غربالگری'),('Hiring pipeline','Interview','مصاحبه'),
    ('Hiring pipeline','Offer','پیشنهاد همکاری'),('Hiring pipeline','Filled','تکمیل‌شده')
)
UPDATE crm.stages s SET name_fa=l.stage_fa
FROM crm.pipelines p JOIN stage_labels l ON p.name=l.pipeline_en
WHERE s.workspace_id=p.workspace_id AND s.pipeline_id=p.id AND p.name_fa IS NOT NULL AND s.name=l.stage_en AND s.name_fa IS NULL
  AND NOT EXISTS (SELECT 1 FROM crm.audit a WHERE a.workspace_id=p.workspace_id AND a.target_id=p.id AND a.event='pipeline.updated');

UPDATE crm.relations r SET label_fa=labels.label_fa,inverse_fa=labels.inverse_fa
FROM (
  SELECT relation.workspace_id,relation.id,
    CASE WHEN relation.label=target.plural THEN target.plural_fa ELSE target.name_fa END label_fa,
    CASE WHEN relation.inverse=source.plural THEN source.plural_fa ELSE source.name_fa END inverse_fa
  FROM crm.relations relation
  JOIN crm.objects source ON source.workspace_id=relation.workspace_id AND source.id=relation.source_object
  JOIN crm.objects target ON target.workspace_id=relation.workspace_id AND target.id=relation.target_object
  JOIN crm.audit original ON original.workspace_id=source.workspace_id AND original.target_id=source.id AND original.event='object.created'
  JOIN crm.audit created ON created.workspace_id=source.workspace_id AND created.target_id=relation.id
    AND created.created_at=original.created_at AND created.event='relation.created'
  WHERE source.name_fa IS NOT NULL AND target.name_fa IS NOT NULL
    AND ((source.key,target.key,relation.label,relation.inverse) IN (
      ('company','contact','Contacts','Company'),('opportunity','company','Company','Opportunities'),
      ('employer','candidate','Candidates','Employer'),('position','employer','Employer','Positions')
    ))
) labels
WHERE r.workspace_id=labels.workspace_id AND r.id=labels.id AND r.label_fa IS NULL AND r.inverse_fa IS NULL;

ALTER TABLE crm.activities ADD FOREIGN KEY (workspace_id,stage_id)
  REFERENCES crm.stages(workspace_id,id) ON DELETE SET NULL (stage_id);
SET LOCAL row_security = on;
