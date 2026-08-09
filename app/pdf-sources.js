const TARGET_TYPES = new Set(['source_group', 'technical', 'byt', 'bv115']);

export function safeHttpsUrl(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';

  try {
    const url = new URL(text);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function sourceCodeCandidates(technical, document) {
  return [document?.sourceCode, document?.code, technical?.sourceCode]
    .flatMap((value) => String(value ?? '').split(/[;,]/))
    .map((value) => value.trim())
    .filter(Boolean);
}

function matchesSourceGroup(source, candidates) {
  return candidates.some(
    (candidate) =>
      candidate === source.targetCode || candidate.startsWith(`${source.targetCode}.`),
  );
}

export function resolvePdfSources({
  pdfSources = [],
  technical = null,
  document = null,
  documentType = '',
} = {}) {
  const candidates = sourceCodeCandidates(technical, document);
  const directDocumentType = documentType === 'bv' ? 'bv115' : documentType;

  const matches = pdfSources.filter((source) => {
    if (!source || !TARGET_TYPES.has(source.targetType) || !safeHttpsUrl(source.pdfUrl)) {
      return false;
    }

    if (source.targetType === 'technical') {
      return Boolean(technical?.code && source.targetCode === technical.code);
    }

    if (source.targetType === 'byt' || source.targetType === 'bv115') {
      return Boolean(
        document?.code &&
          source.targetType === directDocumentType &&
          source.targetCode === document.code,
      );
    }

    return matchesSourceGroup(source, candidates);
  });

  const seenUrls = new Set();
  return matches
    .sort(
      (left, right) =>
        Number(right.isPrimary) - Number(left.isPrimary) ||
        String(left.code).localeCompare(String(right.code), 'vi'),
    )
    .filter((source) => {
      const url = safeHttpsUrl(source.pdfUrl);
      if (seenUrls.has(url)) return false;
      seenUrls.add(url);
      return true;
    });
}
