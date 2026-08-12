import test from 'node:test';
import assert from 'node:assert/strict';
import {
  asciiTitle,
  baseTitle,
  buildMappings,
  prefixTitle,
  punctuationTitle,
  renderMigration,
} from '../scripts/build-title-link-migration.mjs';

function document(overrides = {}) {
  return {
    code: '01.1904.001',
    name: 'Quy trình kỹ thuật ép tim ngoài lồng ngực',
    indication: 'Ngừng tuần hoàn',
    contraindication: 'Không có',
    performer: 'Bác sĩ và điều dưỡng',
    equipment: 'Ván cứng',
    duration: '30 phút',
    ...overrides,
  };
}

function technical(overrides = {}) {
  return {
    code: '13.0197',
    name: 'Ép tim ngoài lồng ngực',
    source_code: '#N/A',
    approved: true,
    indication: '#N/A',
    contraindication: '',
    performer: '0',
    equipment: 'Dữ liệu đang có',
    duration: '',
    ...overrides,
  };
}

test('chuẩn hóa tiêu đề theo bốn mức bảo thủ', () => {
  assert.equal(baseTitle('  ĐẶT   NỘI KHÍ QUẢN '), 'đặt nội khí quản');
  assert.equal(
    punctuationTitle('Phẫu thuật cắt – khâu kén khí phổi'),
    punctuationTitle('Phẫu thuật cắt-khâu kén khí phổi'),
  );
  assert.equal(asciiTitle('Cắt thuỳ phổi'), asciiTitle('Cắt thùy phổi'));
  assert.equal(
    prefixTitle('Quy trình kỹ thuật ép tim ngoài lồng ngực'),
    prefixTitle('Ép tim ngoài lồng ngực'),
  );
});

test('chỉ nối nguồn duy nhất và chỉ đánh dấu trường trống có thể bổ sung', () => {
  const mappings = buildMappings([technical()], [document()]);

  assert.deepEqual(mappings, [{
    technicalCode: '13.0197',
    documentCode: '01.1904.001',
    method: 'generic-prefix',
    expectedSourceCode: '#N/A',
    approved: true,
    fieldsToFill: ['indication', 'contraindication', 'performer', 'duration'],
  }]);
});

test('không nối tiêu đề trùng hoặc kỹ thuật đã có nguồn hợp lệ', () => {
  const duplicateDocuments = [
    document(),
    document({ code: '01.1904.002' }),
  ];
  const existingSource = technical({ code: '13.0198', source_code: '99.9999.999' });

  assert.deepEqual(buildMappings([technical()], duplicateDocuments), []);
  assert.deepEqual(buildMappings([existingSource], [document()]), []);
});

test('migration giữ dữ liệu lâm sàng hiện có và khóa theo nguồn dự kiến', () => {
  const sql = renderMigration(buildMappings([technical()], [document()]));

  assert.match(sql, /else target\.equipment/);
  assert.match(sql, /coalesce\(target\.source_code, ''\) = incoming\.expected_source_code/);
  assert.match(sql, /target\.source_name is distinct from incoming\.document_name/);
  assert.match(sql, /\(\s+'13\.0197',\s+'01\.1904\.001'/s);
});
