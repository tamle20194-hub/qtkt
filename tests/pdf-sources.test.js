import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePdfSources, safeHttpsUrl } from '../app/pdf-sources.js';

function source(overrides = {}) {
  return {
    code: 'source_group:01.1904:01',
    targetType: 'source_group',
    targetCode: '01.1904',
    title: 'QTKT Hồi sức',
    pdfUrl: 'https://example.org/1904.pdf',
    sourcePageUrl: 'https://example.org/1904',
    isPrimary: true,
    ...overrides,
  };
}

test('chỉ cho phép URL HTTPS hợp lệ', () => {
  assert.equal(safeHttpsUrl('https://example.org/a.pdf'), 'https://example.org/a.pdf');
  assert.equal(safeHttpsUrl('http://example.org/a.pdf'), '');
  assert.equal(safeHttpsUrl('javascript:alert(1)'), '');
  assert.equal(safeHttpsUrl('không phải URL'), '');
});

test('tìm PDF theo tiền tố mã nguồn của kỹ thuật khi chưa có tài liệu ghép chính xác', () => {
  const result = resolvePdfSources({
    pdfSources: [source()],
    technical: { code: '01.0096', sourceCode: '01.1904.003' },
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].targetCode, '01.1904');
});

test('hỗ trợ mã nguồn ghép bằng dấu chấm phẩy', () => {
  const result = resolvePdfSources({
    pdfSources: [source()],
    technical: { code: '02.0192', sourceCode: '02.3592.017; 01.1904.120' },
  });

  assert.equal(result.length, 1);
});

test('ưu tiên liên kết chính, giữ đủ các phần và loại URL trùng', () => {
  const primary = source({
    code: 'source_group:27.7708:01',
    targetCode: '27.7708',
    pdfUrl: 'https://example.org/part-1.pdf',
  });
  const second = source({
    code: 'source_group:27.7708:02',
    targetCode: '27.7708',
    pdfUrl: 'https://example.org/part-2.pdf',
    isPrimary: false,
  });
  const duplicate = source({
    code: 'technical:27.0001:01',
    targetType: 'technical',
    targetCode: '27.0001',
    pdfUrl: 'https://example.org/part-1.pdf',
  });

  const result = resolvePdfSources({
    pdfSources: [second, duplicate, primary],
    technical: { code: '27.0001', sourceCode: '27.7708.001' },
  });

  assert.deepEqual(
    result.map((entry) => entry.pdfUrl),
    ['https://example.org/part-1.pdf', 'https://example.org/part-2.pdf'],
  );
});

test('không gắn nhầm PDF khi mã nguồn không trùng nhóm', () => {
  const result = resolvePdfSources({
    pdfSources: [source()],
    technical: { code: '01.0002', sourceCode: 'thiếu qtkt - ko có mtđ' },
  });

  assert.deepEqual(result, []);
});
