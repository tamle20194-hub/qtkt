import fs from 'node:fs';

const DATASETS = new Set(['technical', 'bytDocs', 'bvDocs']);

function readArg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function readEmbeddedData() {
  const html = fs.readFileSync(new URL('../index.monolith.backup.html', import.meta.url), 'utf8');
  const token = 'const DATA=';
  const start = html.indexOf(token);

  if (start === -1) {
    throw new Error('Không tìm thấy DATA trong index.monolith.backup.html');
  }

  const jsonStart = start + token.length;
  const lineEnd = html.indexOf('\n', jsonStart);
  const json = html.slice(jsonStart, lineEnd).trim().replace(/;$/, '');
  return JSON.parse(json);
}

function sqlLiteral(json) {
  const tag = '$qtkt_seed$';
  if (json.includes(tag)) {
    throw new Error('Dữ liệu chứa delimiter SQL dành cho seed');
  }
  return `${tag}${json}${tag}`;
}

function technicalSql(rows) {
  const values = rows.map((row) => [
    row.code,
    row.name,
    row.specialty,
    row.approved,
    row.approvalYear,
    row.mtd,
    row.priceCode,
    row.sourceCode,
    row.sourceName,
    row.hasProcess,
    row.indication,
    row.contra,
    row.performer,
    row.equipment,
    row.duration,
  ]);

  return `
with incoming as (
  select
    item->>0 as code,
    item->>1 as name,
    item->>2 as specialty,
    (item->>3)::boolean as approved,
    nullif(item->>4, '')::smallint as approval_year,
    item->>5 as mtd_code,
    item->>6 as price_code,
    item->>7 as source_code,
    item->>8 as source_name,
    (item->>9)::boolean as has_process,
    item->>10 as indication,
    item->>11 as contraindication,
    item->>12 as performer,
    item->>13 as equipment,
    item->>14 as duration
  from jsonb_array_elements(${sqlLiteral(JSON.stringify(values))}::jsonb) as item
)
insert into public.technical_procedures (
  code, name, specialty, approved, approval_year, mtd_code, price_code,
  source_code, source_name, has_process, indication, contraindication,
  performer, equipment, duration
)
select
  code, name, specialty, approved, approval_year, mtd_code, price_code,
  source_code, source_name, has_process, indication, contraindication,
  performer, equipment, duration
from incoming
on conflict (code) do update set
  name = excluded.name,
  specialty = excluded.specialty,
  approved = excluded.approved,
  approval_year = excluded.approval_year,
  mtd_code = excluded.mtd_code,
  price_code = excluded.price_code,
  source_code = excluded.source_code,
  source_name = excluded.source_name,
  has_process = excluded.has_process,
  indication = excluded.indication,
  contraindication = excluded.contraindication,
  performer = excluded.performer,
  equipment = excluded.equipment,
  duration = excluded.duration,
  updated_at = now();
`.trim();
}

function bytSql(rows) {
  const values = rows.map((row) => [
    row.code,
    row.sourceCode,
    row.name,
    row.author,
    row.indication,
    row.contra,
    row.performer,
    row.equipment,
    row.duration,
    row.general,
    row.procedure,
    row.monitor,
    row.complications,
  ]);

  return `
with incoming as (
  select
    item->>0 as code,
    item->>1 as source_code,
    item->>2 as name,
    item->>3 as author,
    item->>4 as indication,
    item->>5 as contraindication,
    item->>6 as performer,
    item->>7 as equipment,
    item->>8 as duration,
    item->>9 as general_content,
    item->>10 as procedure_content,
    item->>11 as monitoring,
    item->>12 as complications
  from jsonb_array_elements(${sqlLiteral(JSON.stringify(values))}::jsonb) as item
)
insert into public.byt_documents (
  code, source_code, name, author, indication, contraindication, performer,
  equipment, duration, general_content, procedure_content, monitoring, complications
)
select
  code, source_code, name, author, indication, contraindication, performer,
  equipment, duration, general_content, procedure_content, monitoring, complications
from incoming
on conflict (code) do update set
  source_code = excluded.source_code,
  name = excluded.name,
  author = excluded.author,
  indication = excluded.indication,
  contraindication = excluded.contraindication,
  performer = excluded.performer,
  equipment = excluded.equipment,
  duration = excluded.duration,
  general_content = excluded.general_content,
  procedure_content = excluded.procedure_content,
  monitoring = excluded.monitoring,
  complications = excluded.complications,
  updated_at = now();
`.trim();
}

function bvSql(rows) {
  const values = rows.map((row) => [
    row.code,
    row.sourceCode,
    row.name,
    row.indication,
    row.contra,
    row.performer,
    row.equipment,
    row.duration,
  ]);

  return `
with incoming as (
  select
    item->>0 as code,
    item->>1 as source_code,
    item->>2 as name,
    item->>3 as indication,
    item->>4 as contraindication,
    item->>5 as performer,
    item->>6 as equipment,
    item->>7 as duration
  from jsonb_array_elements(${sqlLiteral(JSON.stringify(values))}::jsonb) as item
)
insert into public.bv115_documents (
  code, source_code, name, indication, contraindication, performer, equipment, duration
)
select
  code, source_code, name, indication, contraindication, performer, equipment, duration
from incoming
on conflict (code) do update set
  source_code = excluded.source_code,
  name = excluded.name,
  indication = excluded.indication,
  contraindication = excluded.contraindication,
  performer = excluded.performer,
  equipment = excluded.equipment,
  duration = excluded.duration,
  updated_at = now();
`.trim();
}

const dataset = readArg('dataset');
const start = Number(readArg('start', '0'));
const limit = Number(readArg('limit', '250'));

if (!DATASETS.has(dataset)) {
  throw new Error('--dataset phải là technical, bytDocs hoặc bvDocs');
}
if (!Number.isInteger(start) || start < 0 || !Number.isInteger(limit) || limit < 1) {
  throw new Error('--start và --limit phải là số nguyên hợp lệ');
}

const data = readEmbeddedData();
const rows = data[dataset].slice(start, start + limit);

if (rows.length === 0) {
  process.stdout.write('select 0 as imported_rows;');
} else if (dataset === 'technical') {
  process.stdout.write(technicalSql(rows));
} else if (dataset === 'bytDocs') {
  process.stdout.write(bytSql(rows));
} else {
  process.stdout.write(bvSql(rows));
}
