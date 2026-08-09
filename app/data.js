import {
  DATA_CACHE_NAME,
  DATA_CACHE_PATH,
  DATA_PAGE_SIZE,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from './config.js';

const TABLES = {
  technical: {
    name: 'technical_procedures',
    select: [
      'code',
      'name',
      'specialty',
      'approved',
      'approval_year',
      'mtd_code',
      'price_code',
      'source_code',
      'source_name',
      'has_process',
      'indication',
      'contraindication',
      'performer',
      'equipment',
      'duration',
    ].join(','),
  },
  bytDocs: {
    name: 'byt_documents',
    select: [
      'code',
      'source_code',
      'name',
      'author',
      'indication',
      'contraindication',
      'performer',
      'equipment',
      'duration',
      'general_content',
      'procedure_content',
      'monitoring',
      'complications',
    ].join(','),
  },
  bvDocs: {
    name: 'bv115_documents',
    select: [
      'code',
      'source_code',
      'name',
      'indication',
      'contraindication',
      'performer',
      'equipment',
      'duration',
    ].join(','),
  },
  pdfSources: {
    name: 'procedure_pdf_sources',
    select: [
      'code',
      'target_type',
      'target_code',
      'title',
      'organization',
      'decision_number',
      'decision_date',
      'pdf_url',
      'source_page_url',
      'verified_at',
      'is_primary',
    ].join(','),
  },
};

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const FETCH_TIMEOUT_MS = 20_000;

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchJson(url, attempt = 0) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (attempt < 2) {
      await wait(300 * 3 ** attempt);
      return fetchJson(url, attempt + 1);
    }
    throw error;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    if (attempt < 2 && RETRYABLE_STATUS.has(response.status)) {
      await wait(300 * 3 ** attempt);
      return fetchJson(url, attempt + 1);
    }

    let details = '';
    try {
      details = (await response.json()).message || '';
    } catch {
      details = await response.text();
    }
    throw new Error(
      `Supabase trả về lỗi ${response.status}${details ? `: ${details}` : ''}`,
    );
  }

  return response.json();
}

async function fetchAllRows(definition, onProgress) {
  const rows = [];
  let cursor = '';

  while (true) {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${definition.name}`);
    url.searchParams.set('select', definition.select);
    url.searchParams.set('order', 'code.asc');
    url.searchParams.set('limit', String(DATA_PAGE_SIZE));
    if (cursor) {
      url.searchParams.set('code', `gt.${cursor}`);
    }

    const page = await fetchJson(url);
    rows.push(...page);
    onProgress?.({ table: definition.name, rows: rows.length });

    if (page.length < DATA_PAGE_SIZE) {
      break;
    }

    const nextCursor = page.at(-1)?.code;
    if (!nextCursor || nextCursor === cursor) {
      throw new Error(`Phân trang ${definition.name} không tiến triển`);
    }
    cursor = nextCursor;
  }

  return rows;
}

export function mapTechnicalRow(row) {
  return {
    code: String(row.code ?? ''),
    name: row.name ?? '',
    specialty: row.specialty ?? '',
    approved: row.approved === true,
    approvalYear: row.approval_year == null ? '' : String(row.approval_year),
    mtd: row.mtd_code ?? '',
    priceCode: row.price_code ?? '',
    sourceCode: row.source_code ?? '',
    sourceName: row.source_name ?? '',
    hasProcess: row.has_process === true,
    indication: row.indication ?? '',
    contra: row.contraindication ?? '',
    performer: row.performer ?? '',
    equipment: row.equipment ?? '',
    duration: row.duration ?? '',
  };
}

export function mapBytDocumentRow(row) {
  return {
    code: String(row.code ?? ''),
    sourceCode: row.source_code ?? '',
    name: row.name ?? '',
    author: row.author ?? '',
    indication: row.indication ?? '',
    contra: row.contraindication ?? '',
    performer: row.performer ?? '',
    equipment: row.equipment ?? '',
    duration: row.duration ?? '',
    general: row.general_content ?? '',
    procedure: row.procedure_content ?? '',
    monitor: row.monitoring ?? '',
    complications: row.complications ?? '',
  };
}

export function mapBvDocumentRow(row) {
  return {
    code: String(row.code ?? ''),
    sourceCode: row.source_code ?? '',
    name: row.name ?? '',
    indication: row.indication ?? '',
    contra: row.contraindication ?? '',
    performer: row.performer ?? '',
    equipment: row.equipment ?? '',
    duration: row.duration ?? '',
  };
}

export function mapPdfSourceRow(row) {
  return {
    code: String(row.code ?? ''),
    targetType: row.target_type ?? '',
    targetCode: String(row.target_code ?? ''),
    title: row.title ?? '',
    organization: row.organization ?? '',
    decisionNumber: row.decision_number ?? '',
    decisionDate: row.decision_date ?? '',
    pdfUrl: row.pdf_url ?? '',
    sourcePageUrl: row.source_page_url ?? '',
    verifiedAt: row.verified_at ?? '',
    isPrimary: row.is_primary === true,
  };
}

export function buildDashboard(technical, bytDocs, bvDocs) {
  const approved = technical.filter((item) => item.approved).length;
  const withProcess = technical.filter((item) => item.hasProcess).length;

  return {
    approved,
    totalBYT: technical.length,
    withProcess,
    totalApproved: approved,
    totalBV: bvDocs.length,
    bytProcessCount: bytDocs.length,
    bvProcessCount: bvDocs.length,
  };
}

function validateDataset(data) {
  if (!data || !Array.isArray(data.technical)) {
    throw new Error('Dataset không có danh mục kỹ thuật');
  }
  if (!Array.isArray(data.bytDocs) || !Array.isArray(data.bvDocs)) {
    throw new Error('Dataset không có kho quy trình kỹ thuật');
  }
  if (!Array.isArray(data.pdfSources)) {
    data.pdfSources = [];
  }
  if (data.technical.length === 0) {
    throw new Error('Danh mục kỹ thuật đang trống');
  }
  return data;
}

async function readCache() {
  if (!('caches' in globalThis) || typeof location === 'undefined') {
    return null;
  }

  const cache = await caches.open(DATA_CACHE_NAME);
  const response = await cache.match(new URL(DATA_CACHE_PATH, location.href));
  if (!response) {
    return null;
  }

  return validateDataset(await response.json());
}

async function writeCache(data) {
  if (!('caches' in globalThis) || typeof location === 'undefined') {
    return;
  }

  const cache = await caches.open(DATA_CACHE_NAME);
  const response = new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
  await cache.put(new URL(DATA_CACHE_PATH, location.href), response);
}

async function loadRemoteData(onProgress) {
  const technicalPromise = fetchAllRows(TABLES.technical, onProgress);
  const [technicalRows, bytRows, bvRows, pdfSourceRows] = await Promise.all([
    technicalPromise,
    fetchAllRows(TABLES.bytDocs, onProgress),
    fetchAllRows(TABLES.bvDocs, onProgress),
    fetchAllRows(TABLES.pdfSources, onProgress),
  ]);

  const technical = technicalRows.map(mapTechnicalRow);
  const bytDocs = bytRows.map(mapBytDocumentRow);
  const bvDocs = bvRows.map(mapBvDocumentRow);
  const pdfSources = pdfSourceRows.map(mapPdfSourceRow);

  return validateDataset({
    dashboard: buildDashboard(technical, bytDocs, bvDocs),
    technical,
    bytDocs,
    bvDocs,
    pdfSources,
    meta: {
      source: 'supabase',
      loadedAt: new Date().toISOString(),
    },
  });
}

export async function loadData({ onProgress } = {}) {
  try {
    const remote = await loadRemoteData(onProgress);
    try {
      await writeCache(remote);
    } catch (cacheError) {
      console.warn('Không thể lưu cache dữ liệu:', cacheError);
    }
    return remote;
  } catch (remoteError) {
    const cached = await readCache();
    if (!cached) {
      throw remoteError;
    }

    return {
      ...cached,
      meta: {
        ...(cached.meta || {}),
        source: 'cache',
        remoteError: remoteError.message,
      },
    };
  }
}
