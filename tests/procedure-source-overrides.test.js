import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const overrides = JSON.parse(
  fs.readFileSync('scripts/procedure-source-overrides.json', 'utf8'),
);

test('nguồn thay thế có mã duy nhất và URL HTTPS', () => {
  assert.equal(overrides.length, 23);
  assert.equal(new Set(overrides.map((row) => row.target_code)).size, overrides.length);

  for (const row of overrides) {
    assert.match(row.target_code, /^\d{2}\.\d{4}$/);
    assert.match(row.source_page_url, /^https:\/\//);
    assert.match(row.document_url, /^https:\/\//);
  }
});

test('mọi nguồn thay thế đều có trang công bố của cơ sở y tế', () => {
  for (const row of overrides) {
    assert.match(row.source_page_url, /^https:\/\/bvdksadec\.vn\//);
  }
});
