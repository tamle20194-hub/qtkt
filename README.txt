KHO CHUYÊN MÔN 115 - PHIÊN BẢN 2.0

CHẠY CỤC BỘ
1. Mở PowerShell tại thư mục dự án.
2. Chạy: npm run serve
3. Mở: http://localhost:8000
Không mở index.html bằng file:// vì fetch, Web Worker và PWA cần HTTP.

KIỂM THỬ
- npm run check          Kiểm tra cú pháp JavaScript
- npm test               Unit test + data contract
- npm run test:e2e       Smoke test HTTP app shell
- npm run validate:data  Kiểm tra 18.823 kỹ thuật và 25 tài liệu

CHỨC NĂNG
- Tìm tiếng Việt không dấu, xếp hạng theo mã/tên, phân trang 50 dòng.
- Web Worker giữ thao tác tìm kiếm khỏi main thread.
- URL hash lưu query/filter/page và hỗ trợ back/forward/chia sẻ.
- Giao diện responsive, light/dark/system, keyboard và reduced motion.
- PWA cài đặt được; cache dữ liệu để tra cứu offline sau lần tải đầu.
- Analytics local-first không thu từ khóa tự do hoặc PII.

DỮ LIỆU VÀ TRIỂN KHAI
- docs/DATA_CONTRACT.md: schema và import.
- docs/DEPLOYMENT.md: GitHub Pages, release và rollback.
- docs/ACCESSIBILITY.md: kiểm tra WCAG.
- docs/analytics.md: event contract và privacy.

GIỚI HẠN
Chưa kết nối database, đăng nhập hoặc Google Drive thật. Muốn bật các phần này
cần backend, schema, tài khoản dịch vụ và chính sách quyền truy cập được duyệt.
