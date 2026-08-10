import fs from 'node:fs';

const DOCUMENT_FIELDS = [
  'indication',
  'contraindication',
  'performer',
  'equipment',
  'duration',
  'general_content',
  'procedure_content',
  'monitoring',
  'complications',
];

const TECHNICAL_FIELDS = [
  'indication',
  'contraindication',
  'performer',
  'equipment',
  'duration',
];

function readArg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function isPresent(value) {
  const text = String(value ?? '').trim();
  return text !== '' && text !== '0' && text !== '#N/A';
}

function sqlFieldUpdate(alias, field) {
  return `${field} = case
    when btrim(target.${field}) in ('', '0', '#N/A')
      and btrim(${alias}.${field}) not in ('', '0', '#N/A')
    then ${alias}.${field}
    else target.${field}
  end`;
}

function sqlFieldChanged(alias, field) {
  return `(btrim(target.${field}) in ('', '0', '#N/A') and btrim(${alias}.${field}) not in ('', '0', '#N/A'))`;
}

const inputPath = readArg('documents');
const technicalInputPath = readArg('technical');
const outputPath = readArg('output');
if (!inputPath || !technicalInputPath || !outputPath) {
  throw new Error('Cần truyền --documents, --technical và --output');
}

const rows = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
  .map((row) => ({
    code: String(row.code ?? '').trim(),
    ...Object.fromEntries(DOCUMENT_FIELDS.map((field) => [field, String(row[field] ?? '')])),
  }))
  .filter(
    (row) => row.code && DOCUMENT_FIELDS.some((field) => isPresent(row[field])),
  );

const codes = new Set(rows.map((row) => row.code));
if (codes.size !== rows.length) {
  throw new Error('Danh sách trích xuất có mã quy trình trùng lặp');
}

const technicalRows = JSON.parse(fs.readFileSync(technicalInputPath, 'utf8'))
  .map((row) => ({
    code: String(row.code ?? '').trim(),
    ...Object.fromEntries(TECHNICAL_FIELDS.map((field) => [field, String(row[field] ?? '')])),
  }))
  .filter(
    (row) => row.code && TECHNICAL_FIELDS.some((field) => isPresent(row[field])),
  );
const technicalCodes = new Set(technicalRows.map((row) => row.code));
if (technicalCodes.size !== technicalRows.length) {
  throw new Error('Danh sách cập nhật danh mục kỹ thuật có mã trùng lặp');
}

const delimiter = '$qtkt_content$';
const json = JSON.stringify(rows);
if (json.includes(delimiter)) {
  throw new Error('Nội dung trùng delimiter SQL dành cho migration');
}
const technicalDelimiter = '$qtkt_technical$';
const technicalJson = JSON.stringify(technicalRows);
if (technicalJson.includes(technicalDelimiter)) {
  throw new Error('Nội dung danh mục kỹ thuật trùng delimiter SQL');
}

const documentColumns = ['code', ...DOCUMENT_FIELDS]
  .map((field) => `${field} text`)
  .join(',\n      ');
const documentUpdates = DOCUMENT_FIELDS
  .map((field) => sqlFieldUpdate('incoming', field))
  .join(',\n  ');
const documentChanged = DOCUMENT_FIELDS
  .map((field) => sqlFieldChanged('incoming', field))
  .join('\n    or ');
const technicalSourceUpdates = TECHNICAL_FIELDS
  .map((field) => sqlFieldUpdate('source_document', field))
  .join(',\n  ');
const technicalSourceChanged = TECHNICAL_FIELDS
  .map((field) => sqlFieldChanged('source_document', field))
  .join('\n    or ');
const technicalColumns = ['code', ...TECHNICAL_FIELDS]
  .map((field) => `${field} text`)
  .join(',\n      ');
const technicalIncomingUpdates = TECHNICAL_FIELDS
  .map((field) => sqlFieldUpdate('incoming', field))
  .join(',\n  ');
const technicalIncomingChanged = TECHNICAL_FIELDS
  .map((field) => sqlFieldChanged('incoming', field))
  .join('\n    or ');

const sql = `-- Generated from official procedure PDF text.
-- Apply with a privileged Supabase migration connection; browser roles remain read-only.

begin;

with incoming as (
  select *
  from jsonb_to_recordset(${delimiter}${json}${delimiter}::jsonb) as row(
      ${documentColumns}
  )
)
update public.byt_documents as target
set
  ${documentUpdates},
  updated_at = now()
from incoming
where target.code = incoming.code
  and (
    ${documentChanged}
  );

with source_document as (
  select
    code, indication, contraindication, performer, equipment, duration
  from public.byt_documents
  union all
  select
    code, indication, contraindication, performer, equipment, duration
  from public.bv115_documents
)
update public.technical_procedures as target
set
  ${technicalSourceUpdates},
  updated_at = now()
from source_document
where target.source_code = source_document.code
  and (
    ${technicalSourceChanged}
  );

-- Includes exact source mappings plus conservative mappings audited by the
-- extraction pipeline (embedded source code or unique exact title in the same
-- specialty). Existing non-placeholder values are still preserved.
with incoming as (
  select *
  from jsonb_to_recordset(${technicalDelimiter}${technicalJson}${technicalDelimiter}::jsonb) as row(
      ${technicalColumns}
  )
)
update public.technical_procedures as target
set
  ${technicalIncomingUpdates},
  updated_at = now()
from incoming
where target.code = incoming.code
  and (
    ${technicalIncomingChanged}
  );

commit;

-- Post-migration verification summary.
select
  count(*) as byt_documents,
  count(*) filter (where btrim(indication) not in ('', '0', '#N/A')) as with_indication,
  count(*) filter (where btrim(contraindication) not in ('', '0', '#N/A')) as with_contraindication,
  count(*) filter (where btrim(performer) not in ('', '0', '#N/A')) as with_performer,
  count(*) filter (where btrim(equipment) not in ('', '0', '#N/A')) as with_equipment,
  count(*) filter (where btrim(duration) not in ('', '0', '#N/A')) as with_duration
from public.byt_documents;

select
  count(*) as technical_procedures,
  count(*) filter (where btrim(indication) in ('', '0', '#N/A')) as missing_indication,
  count(*) filter (where btrim(contraindication) in ('', '0', '#N/A')) as missing_contraindication,
  count(*) filter (where btrim(performer) in ('', '0', '#N/A')) as missing_performer,
  count(*) filter (where btrim(equipment) in ('', '0', '#N/A')) as missing_equipment,
  count(*) filter (where btrim(duration) in ('', '0', '#N/A')) as missing_duration
from public.technical_procedures;
`;

fs.writeFileSync(outputPath, sql);
console.log(
  JSON.stringify(
    {
      inputRows: rows.length,
      technicalRows: technicalRows.length,
      bytes: Buffer.byteLength(sql),
      output: outputPath,
    },
    null,
    2,
  ),
);
