# Kho Chuyên môn 115

Ứng dụng tĩnh tra cứu danh mục kỹ thuật và kho quy trình, kết nối trực tiếp với
Supabase project `tzcaxoleefuezhocphyh`.

## Chạy cục bộ

Yêu cầu Node.js 20 trở lên và Python 3; lệnh `python` phải có trong `PATH` vì
máy chủ cục bộ được khởi chạy bằng `python -m http.server 8000`.

```bash
npm run serve
```

Mở `http://localhost:8000`. Không mở `index.html` bằng `file://` vì ES
modules, Service Worker và PWA cần HTTP.

## Kiểm thử

```bash
npm run check
npm test
npm run test:e2e
```

## Kết nối Supabase

Frontend đọc Supabase Data API qua:

- `app/config.js`: URL project và publishable key.
- `app/data.js`: phân trang khóa `code`, retry có giới hạn, ánh xạ dữ liệu và
  cache ngoại tuyến.
- `app/pdf-sources.js`: đối chiếu PDF theo kỹ thuật, tài liệu hoặc nhóm mã nguồn.
- `app/main.js`: giao diện, tìm kiếm, bộ lọc, phân trang và điều hướng.

Publishable key được phép xuất hiện trong mã frontend. Đây không phải secret;
quyền thực tế được giới hạn bằng GRANT và Row Level Security. Tuyệt đối không
đưa secret key hoặc `service_role` key vào repo.

| Contract frontend | Bảng Supabase | Số dòng |
|---|---|---:|
| `DATA.technical` | `technical_procedures` | 18.823 |
| `DATA.bytDocs` | `byt_documents` | 4.933 |
| `DATA.bvDocs` | `bv115_documents` | 105 |
| `DATA.pdfSources` | `procedure_pdf_sources` | 44 |
| `DATA.dashboard` | Tính từ ba bảng dữ liệu nghiệp vụ | — |

Schema tham chiếu nằm tại `supabase/schema.sql`. Cả bốn bảng đều bật RLS; vai
trò `anon` và `authenticated` chỉ có quyền `SELECT`. Mã như `01.0002`
và `01.1904.001` được lưu bằng kiểu `text` để giữ số 0 đầu.

Các liên kết toàn văn PDF được quản lý bằng migration trong
`supabase/migrations/`. Không ghép nguồn theo tên gần giống: frontend ưu tiên
mã trực tiếp rồi mới đối chiếu tiền tố nhóm quyết định (ví dụ `01.1904`).

## Cập nhật dữ liệu

`index.monolith.backup.html` hiện là nguồn seed lịch sử. Script
`scripts/build-seed-batch.mjs` chuyển dữ liệu nhúng thành câu lệnh upsert theo
từng lô để chạy bằng kết nối quản trị Supabase:

```bash
node scripts/build-seed-batch.mjs --dataset technical --start 0 --limit 250
node scripts/build-seed-batch.mjs --dataset bytDocs --start 0 --limit 100
node scripts/build-seed-batch.mjs --dataset bvDocs --start 0 --limit 100
```

Không cấp quyền ghi tạm thời cho trình duyệt để nhập dữ liệu.

Việc nhập nội dung toàn văn từ các quyết định đã ban hành sử dụng bộ trích
xuất có kiểm toán, bộ kiểm tra và migration đặc quyền. Xem
[`docs/procedure-content-import.md`](docs/procedure-content-import.md) để chạy
đúng chuỗi xuất dữ liệu → chuẩn bị văn bản → trích xuất → kiểm tra → migration.

## Ngoại tuyến

Sau lần tải thành công đầu tiên, dataset Supabase được lưu trong Cache Storage.
Service Worker lưu app shell nhưng không xóa cache dataset khi nâng phiên bản.
