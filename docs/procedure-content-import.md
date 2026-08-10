# Nhập nội dung quy trình kỹ thuật đã ban hành

Quy trình này tạo dữ liệu cho các trường đang trống trong `byt_documents` và
`technical_procedures` từ toàn văn quyết định chuyên môn. Mục tiêu là bảo toàn
nguyên văn nguồn, có nhật ký trang và không suy diễn nội dung không được ban
hành.

## Nguyên tắc kiểm soát

- Chỉ nhận một quy trình khi tiêu đề đạt ngưỡng và trang bắt đầu có cấu trúc
  chuyên môn phù hợp. Mục chỉ có trong danh mục nhưng không có toàn văn được
  giữ trống.
- Không ghi đè giá trị khác `''`, `0` hoặc `#N/A` đang có trong cơ sở dữ liệu.
- Ghép kỹ thuật theo `source_code` trước. Trạng thái `Cần QTKT`/`thiếu qtkt`
  chỉ được ghép khi tên trùng hoàn toàn, cùng mã chuyên khoa và tên đó là duy
  nhất trong toàn bộ danh mục Bộ Y tế.
- Mỗi hồ sơ có SHA-256 của văn bản nguồn, số trang bắt đầu/kết thúc, điểm tiêu
  đề và phương pháp căn chỉnh trong `extraction-audit.json`.
- Các liên kết thay thế đã kiểm tra nằm tại
  `scripts/procedure-source-overrides.json`. Đây là trang công bố và tệp đính
  kèm của cơ sở y tế, dùng khi liên kết cũ chỉ có quyết định, bị chặn hoặc không
  còn tải được.

## 1. Xuất ảnh chụp dữ liệu đọc công khai

```bash
node scripts/export-procedure-data.mjs --output-dir /tmp/qtkt-export
```

Lệnh này chỉ sử dụng publishable key và quyền `SELECT`; không dùng hoặc yêu cầu
`service_role` key.

## 2. Chuẩn bị văn bản nguồn

Tải toàn văn theo `procedure_pdf_sources.json`, ưu tiên liên kết thay thế khi
cùng `target_code`, rồi chuyển mỗi phần sang UTF-8 bằng `pdftotext -layout`.
Tên tệp phải theo mẫu:

```text
source_group_<target_code>_<part>.txt
```

Ví dụ: `source_group_27.7708_01.txt` và
`source_group_27.7708_02.txt`. Hai quyết định 3906/QĐ-BYT và 3978/QĐ-BYT dùng
phông mã hóa đặc thù nên cần OCR tiếng Việt; đặt tệp đã OCR với hậu tố
`.ocr.txt` để bộ trích xuất tự ưu tiên.

## 3. Trích xuất và ánh xạ

```bash
python scripts/extract-procedure-content.py \
  --documents /tmp/qtkt-export/byt_documents.json \
  --technical /tmp/qtkt-export/technical_procedures.json \
  --pdf-sources /tmp/qtkt-export/procedure_pdf_sources.json \
  --text-dir /tmp/qtkt-text \
  --output-dir /tmp/qtkt-extract \
  --match-technical-by-title
```

Đầu ra gồm dữ liệu cập nhật, nhật ký ánh xạ và báo cáo theo từng nhóm quyết
định. Căn chỉnh tuần tự là mặc định; ghép ngoài thứ tự chỉ nhận điểm tiêu đề
mạnh trên trang bắt đầu bằng Mục I.

## 4. Kiểm tra bắt buộc

```bash
python scripts/validate-procedure-content.py \
  --output-dir /tmp/qtkt-extract \
  --documents /tmp/qtkt-export/byt_documents.json \
  --technical /tmp/qtkt-export/technical_procedures.json
```

Kiểm tra sẽ dừng khi có mã trùng, nhật ký không khớp, lẫn tài liệu tham khảo,
chân trang, quy trình kế tiếp, ánh xạ sai chuyên khoa hoặc ghép tên không duy
nhất.

## 5. Tạo và áp dụng migration

```bash
node scripts/build-procedure-content-migration.mjs \
  --documents /tmp/qtkt-extract/byt-document-updates.json \
  --technical /tmp/qtkt-extract/technical-updates.json \
  --output supabase/migrations/<timestamp>_backfill_procedure_content.sql
```

Chỉ áp dụng migration bằng kết nối quản trị Supabase. Không mở quyền ghi cho
`anon` hoặc `authenticated`. Sau khi áp dụng, chạy các câu `SELECT` xác minh ở
cuối migration và kiểm tra mẫu trên cả `/records` lẫn `/technical`.
