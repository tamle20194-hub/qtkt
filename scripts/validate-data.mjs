import fs from 'node:fs';

const html = fs.readFileSync('index.monolith.backup.html', 'utf8');
const token = 'const DATA=';
const start = html.indexOf(token);
if (start === -1) throw new Error('Không tìm thấy const DATA trong nguồn seed');

const jsonStart = start + token.length;
const lineEnd = html.indexOf('\n', jsonStart);
const data = JSON.parse(html.slice(jsonStart, lineEnd).trim().replace(/;$/, ''));

const expected = {
  technical: 18823,
  bytDocs: 15,
  bvDocs: 10,
};

for (const [name, count] of Object.entries(expected)) {
  const rows = data[name];
  if (!Array.isArray(rows) || rows.length !== count) {
    throw new Error(`${name}: dự kiến ${count}, thực tế ${rows?.length ?? 'không có'}`);
  }

  const hasInvalidCode = rows.some(
    (row) => typeof row?.code !== 'string' || row.code.trim() === '',
  );
  const codes = new Set(rows.map((row) => row?.code));
  if (hasInvalidCode || codes.size !== rows.length) {
    throw new Error(`${name}: mã trống hoặc trùng lặp`);
  }
}

const approved = data.technical.filter((row) => row.approved === true).length;
const withProcess = data.technical.filter((row) => row.hasProcess === true).length;
if (approved !== 4335 || withProcess !== 18823) {
  throw new Error(`Chỉ số không khớp: approved=${approved}, hasProcess=${withProcess}`);
}

for (const code of ['01.0002', '01.1904.001', 'BV.10.001']) {
  const found = [...data.technical, ...data.bytDocs, ...data.bvDocs].some(
    (row) => row.code === code,
  );
  if (!found) throw new Error(`Thiếu mã kiểm tra ${code}`);
}

console.log(
  `Dữ liệu hợp lệ: ${expected.technical} kỹ thuật, ${expected.bytDocs} QTKT BYT, ${expected.bvDocs} QTKT BV 115.`,
);
