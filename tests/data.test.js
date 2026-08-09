import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDashboard,
  mapBvDocumentRow,
  mapBytDocumentRow,
  mapTechnicalRow,
} from '../app/data.js';

test('ánh xạ kỹ thuật giữ mã có số 0 đầu và đổi tên trường', () => {
  const result = mapTechnicalRow({
    code: '01.0002',
    name: 'Kỹ thuật mẫu',
    specialty: 'Hồi sức',
    approved: true,
    approval_year: 2026,
    mtd_code: '01.0001.0001',
    price_code: '37.0001',
    source_code: '01.1904.001',
    source_name: 'QTKT mẫu',
    has_process: true,
    indication: 'A',
    contraindication: 'B',
    performer: 'C',
    equipment: 'D',
    duration: '30 phút',
  });

  assert.equal(result.code, '01.0002');
  assert.equal(result.approvalYear, '2026');
  assert.equal(result.mtd, '01.0001.0001');
  assert.equal(result.sourceCode, '01.1904.001');
  assert.equal(result.contra, 'B');
});

test('ánh xạ hai kho tài liệu theo contract frontend', () => {
  const byt = mapBytDocumentRow({
    code: '01.1904.001',
    source_code: '01.1904',
    name: 'QTKT',
    author: 'Tác giả',
    indication: '',
    contraindication: '',
    performer: '',
    equipment: '',
    duration: '',
    general_content: 'Đại cương',
    procedure_content: 'Các bước',
    monitoring: 'Theo dõi',
    complications: 'Tai biến',
  });
  const bv = mapBvDocumentRow({
    code: 'BV.10.001',
    source_code: 'BV.10',
    name: 'QTKT BV',
    indication: '',
    contraindication: '',
    performer: '',
    equipment: '',
    duration: '',
  });

  assert.equal(byt.procedure, 'Các bước');
  assert.equal(byt.monitor, 'Theo dõi');
  assert.equal(bv.code, 'BV.10.001');
  assert.equal(bv.sourceCode, 'BV.10');
});

test('dashboard được tính từ dữ liệu thay vì lưu số liệu cứng', () => {
  const dashboard = buildDashboard(
    [
      { approved: true, hasProcess: true },
      { approved: false, hasProcess: true },
    ],
    [{ code: 'BYT.1' }],
    [{ code: 'BV.1' }],
  );

  assert.deepEqual(dashboard, {
    approved: 1,
    totalBYT: 2,
    withProcess: 2,
    totalApproved: 1,
    totalBV: 1,
    bytProcessCount: 1,
    bvProcessCount: 1,
  });
});
