import fs from 'node:fs';
import path from 'node:path';
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from '../app/config.js';

const TABLES = [
  'technical_procedures',
  'byt_documents',
  'bv115_documents',
  'procedure_pdf_sources',
];
const PAGE_SIZE = 1000;

function readArg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

async function fetchPage(table, cursor, attempt = 0) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set('select', '*');
  url.searchParams.set('order', 'code.asc');
  url.searchParams.set('limit', String(PAGE_SIZE));
  if (cursor) url.searchParams.set('code', `gt.${cursor}`);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
    });
    if (!response.ok) {
      throw new Error(`${response.status}: ${await response.text()}`);
    }
    return response.json();
  } catch (error) {
    if (attempt >= 2) throw error;
    await new Promise((resolve) => setTimeout(resolve, 500 * 3 ** attempt));
    return fetchPage(table, cursor, attempt + 1);
  }
}

async function exportTable(table, outputDirectory) {
  const rows = [];
  let cursor = '';
  while (true) {
    const page = await fetchPage(table, cursor);
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    const nextCursor = page.at(-1)?.code;
    if (!nextCursor || nextCursor === cursor) {
      throw new Error(`${table}: phân trang không tiến triển`);
    }
    cursor = nextCursor;
  }

  const output = path.join(outputDirectory, `${table}.json`);
  fs.writeFileSync(output, `${JSON.stringify(rows, null, 2)}\n`);
  return { table, rows: rows.length, output };
}

const outputDirectory = path.resolve(readArg('output-dir'));
if (!readArg('output-dir')) {
  throw new Error('Cần truyền --output-dir');
}
fs.mkdirSync(outputDirectory, { recursive: true });

const results = await Promise.all(
  TABLES.map((table) => exportTable(table, outputDirectory)),
);
console.log(JSON.stringify(results, null, 2));
