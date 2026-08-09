create table public.procedure_pdf_sources (
  code text primary key,
  target_type text not null,
  target_code text not null,
  title text not null,
  organization text not null,
  decision_number text not null default '',
  decision_date date,
  pdf_url text not null,
  source_page_url text not null default '',
  verified_at timestamptz not null default now(),
  is_primary boolean not null default true,
  constraint procedure_pdf_sources_target_type_check
    check (target_type in ('source_group', 'technical', 'byt', 'bv115')),
  constraint procedure_pdf_sources_pdf_url_check
    check (pdf_url like 'https://%'),
  constraint procedure_pdf_sources_source_page_url_check
    check (source_page_url = '' or source_page_url like 'https://%'),
  constraint procedure_pdf_sources_target_url_key
    unique (target_type, target_code, pdf_url)
);

create index procedure_pdf_sources_target_idx
  on public.procedure_pdf_sources (target_type, target_code, is_primary, code);

alter table public.procedure_pdf_sources enable row level security;

create policy procedure_pdf_sources_public_read
  on public.procedure_pdf_sources
  for select
  to anon, authenticated
  using (true);

revoke all on table public.procedure_pdf_sources from anon, authenticated;
grant select on table public.procedure_pdf_sources to anon, authenticated;

insert into public.procedure_pdf_sources (
  code,
  target_type,
  target_code,
  title,
  organization,
  decision_number,
  pdf_url,
  source_page_url,
  is_primary
)
values
  ('source_group:01.1904:01', 'source_group', '01.1904', 'Hướng dẫn quy trình kỹ thuật chuyên ngành Hồi sức - Cấp cứu và Chống độc', 'Bệnh viện Đa khoa tỉnh Quảng Ninh', '1904/QĐ-BYT', 'https://www.benhviendakhoatinhquangninh.vn/images/uploadfiles/20238299388.PDF', 'https://www.benhviendakhoatinhquangninh.vn/quy-trinh-hoi-suc-tich-cuc/quyet-dinh-so-1904qdbyt-ve-viec-ban-hanh-tai-lieu-huong-dan-quy-trinh-ky-thuat-chuyen-nganh-hoi-suc-cap-cuu-va-chong-doc.6429.html', true),
  ('source_group:02.0654:01', 'source_group', '02.0654', 'Hướng dẫn quy trình kỹ thuật Nội khoa, chuyên ngành Cơ Xương Khớp', 'Cục Quản lý Khám, chữa bệnh - Bộ Y tế', '654/QĐ-BYT', 'https://kcb.vn/upload/2005611/20210723/HD-QTKT-Noi-CXK-in.pdf', 'https://kcb.vn/quy-trinh/huong-dan-quy-trinh-ky-thuat-kham-benh-chua-benh-noi-khoa-.html', true),
  ('source_group:02.1981:01', 'source_group', '02.1981', 'Hướng dẫn quy trình kỹ thuật Nội khoa, chuyên ngành Hô hấp', 'Bệnh viện Sản - Nhi tỉnh Quảng Ngãi', '1981/QĐ-BYT', 'https://sannhiquangngai.com/uploads/page/2018_11/huongdanqtkthohap.pdf', 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-1981-QD-BYT-2014-tai-lieu-Huong-dan-quy-trinh-ky-thuat-Noi-khoa-chuyen-nganh-Ho-hap-239670.aspx', true),
  ('source_group:02.3154:01', 'source_group', '02.3154', 'Hướng dẫn quy trình kỹ thuật Nội khoa, chuyên ngành Thần kinh', 'Cục Quản lý Khám, chữa bệnh - Bộ Y tế', '3154/QĐ-BYT', 'https://kcb.vn/upload/2005611/20210723//Huong-dan-QTKT-Than-Kinh.pdf', 'https://kcb.vn/quy-trinh/quy-trinh-ky-thuat-noi-khoa-chuyen-nganh-than-kinh.html', true),
  ('source_group:02.3592:01', 'source_group', '02.3592', 'Hướng dẫn quy trình kỹ thuật Nội khoa, chuyên ngành Thận - Tiết niệu', 'Bệnh viện Đa khoa tỉnh Sơn La', '3592/QĐ-BYT', 'https://benhviendakhoa.sonla.gov.vn/data/files/vanban/Van%20ban%202017/quet%20dinh%20than%20nhan%20tao/3592_QD-BYT%20QTCM%20Noi%20khoa%20than%20tiet%20nieu.pdf', 'https://thuvienphapluat.vn/van-ban/the-thao-y-te/quyet-dinh-3592-qd-byt-huong-dan-quy-trinh-ky-thuat-noi-khoa-chuyen-nganh-than-tiet-nieu-290594.aspx', true),
  ('source_group:02.3805:01', 'source_group', '02.3805', 'Hướng dẫn quy trình kỹ thuật Nội khoa, chuyên ngành Tiêu hóa', 'Cục Quản lý Khám, chữa bệnh - Bộ Y tế', '3805/QĐ-BYT', 'https://kcb.vn/upload/2005611/20210723/48704c354a8f06266fe8be985e30208dHuong-dan-QTKT-Tieu-Hoa.pdf', 'https://kcb.vn/van-ban/quy-trinh-ky-thuat-noi-khoa-chuyen-nganh-tieu-hoa.html', true),
  ('source_group:02.3983:01', 'source_group', '02.3983', 'Hướng dẫn quy trình kỹ thuật Nội khoa, chuyên ngành Tim mạch', 'Cục Quản lý Khám, chữa bệnh - Bộ Y tế', '3983/QĐ-BYT', 'https://kcb.vn/upload/2005611/20210723//Huong-dan-QTKT-Tim-Mach.pdf', 'https://kcb.vn/quy-trinh/quy-trinh-ky-thuat-noi-khoa-chuyen-nganh-tim-mach.html', true),
  ('source_group:08.0792:01', 'source_group', '08.0792', 'Hướng dẫn quy trình kỹ thuật chuyên ngành Châm cứu', 'Cục Quản lý Khám, chữa bệnh - Bộ Y tế', '792/QĐ-BYT', 'https://kcb.vn/upload/2005611/20210723//Ch%C3%A2m-c%E1%BB%A9u.pdf', 'https://kcb.vn/quy-trinh/quy-trinh-ky-thuat-kham-benh-chua-benh-chuyen-nganh-cham-cuu.html', true),
  ('source_group:08.5480:01', 'source_group', '08.5480', 'Hướng dẫn quy trình kỹ thuật chuyên ngành Y học cổ truyền', 'Thư Viện Pháp Luật', '5480/QĐ-BYT', 'https://files.thuvienphapluat.vn/uploads/FilePDFUpload/460982.pdf?vv=113900', 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-5480-QD-BYT-2020-tai-lieu-Huong-dan-Quy-trinh-ky-thuat-chuyen-nganh-y-hoc-co-truyen-460982.aspx', true),
  ('source_group:10.0201:01', 'source_group', '10.0201', 'Hướng dẫn quy trình kỹ thuật chuyên ngành Ngoại khoa', 'Sở Y tế tỉnh Đồng Nai', '201/QĐ-BYT', 'https://syt.dongnai.gov.vn/vi/van-ban/detail/Quyet-dinh-ve-viec-ban-hanh-tai-lieu-Huong-dan-quy-trinh-ky-thuat-chuyen-nganh-Ngoai-khoa-ch-113/?download=1&id=0', 'https://syt.dongnai.gov.vn/vi/van-ban/detail/Quyet-dinh-ve-viec-ban-hanh-tai-lieu-Huong-dan-quy-trinh-ky-thuat-chuyen-nganh-Ngoai-khoa-ch-113/', true),
  ('source_group:10.4419:01', 'source_group', '10.4419', 'Hướng dẫn quy trình kỹ thuật chuyên khoa Phẫu thuật Tiết niệu', 'Thư Viện Pháp Luật', '4419/QĐ-BYT', 'https://files.thuvienphapluat.vn/uploads/FilePDFUpload/443628.pdf?vv=120000', 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-4419-QD-BYT-2016-tai-lieu-Huong-dan-ky-thuat-Ngoai-khoa-chuyen-khoa-Phau-thuat-Tiet-nieu-443628.aspx', true),
  ('source_group:10.4420:01', 'source_group', '10.4420', 'Hướng dẫn quy trình kỹ thuật chuyên khoa Phẫu thuật Gan mật', 'Thư Viện Pháp Luật', '4420/QĐ-BYT', 'https://files.thuvienphapluat.vn/uploads/FilePDFUpload/320255.pdf?vv=173900', 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-4420-QD-BYT-tai-lieu-huong-dan-quy-trinh-ky-thuat-chuyen-khoa-phau-thuat-Gan-mat-2016-320255.aspx', true),
  ('source_group:10.4421:01', 'source_group', '10.4421', 'Hướng dẫn quy trình kỹ thuật chuyên khoa Phẫu thuật Cột sống', 'Thư Viện Pháp Luật', '4421/QĐ-BYT', 'https://files.thuvienphapluat.vn/uploads/FilePDFUpload/320256.pdf?vv=174000', 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-4421-QD-BYT-tai-lieu-huong-dan-quy-trinh-ky-thuat-chuyen-khoa-phau-thuat-Cot-song-2016-320256.aspx', true),
  ('source_group:10.4423:01', 'source_group', '10.4423', 'Hướng dẫn quy trình kỹ thuật chuyên khoa Phẫu thuật Tim mạch - Lồng ngực', 'Thư Viện Pháp Luật', '4423/QĐ-BYT', 'https://files.thuvienphapluat.vn/uploads/FilePDFUpload/320257.pdf?vv=120000', 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-4423-QD-BYT-tai-lieu-huong-dan-quy-trinh-ky-thuat-chuyen-khoa-phau-thuat-Tim-mach-2016-320257.aspx', true),
  ('source_group:10.4484:01', 'source_group', '10.4484', 'Hướng dẫn quy trình kỹ thuật Ngoại khoa chuyên khoa Chấn thương Chỉnh hình', 'Thư Viện Pháp Luật', '4484/QĐ-BYT', 'https://files.thuvienphapluat.vn/uploads/FilePDFUpload/320298.pdf?vv=173500', 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-4484-QD-BYT-tai-lieu-huong-dan-quy-trinh-ky-thuat-Ngoai-khoa-Chan-thuong-Chinh-hinh-2016-320298.aspx', true),
  ('source_group:10.4485:01', 'source_group', '10.4485', 'Hướng dẫn quy trình kỹ thuật chuyên khoa Phẫu thuật Thần kinh', 'Thư Viện Pháp Luật', '4485/QĐ-BYT', 'https://files.thuvienphapluat.vn/uploads/FilePDFUpload/320299.pdf?vv=120000', 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-4485-QD-BYT-tai-lieu-huong-dan-quy-trinh-ky-thuat-chuyen-khoa-phau-thuat-than-kinh-2016-320299.aspx', true),
  ('source_group:10.4491:01', 'source_group', '10.4491', 'Hướng dẫn quy trình kỹ thuật chuyên khoa Phẫu thuật Tiêu hóa', 'Thư Viện Pháp Luật', '4491/QĐ-BYT', 'https://files.thuvienphapluat.vn/uploads/FilePDFUpload/320300.pdf?vv=172800', 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-4491-QD-BYT-tai-lieu-huong-dan-quy-trinh-ky-thuat-chuyen-khoa-phau-thuat-Tieu-hoa-2016-320300.aspx', true),
  ('source_group:10.5590:01', 'source_group', '10.5590', 'Hướng dẫn quy trình kỹ thuật chuyên ngành Phẫu thuật Tạo hình - Thẩm mỹ', 'Thư Viện Pháp Luật', '5590/QĐ-BYT', 'https://files.thuvienphapluat.vn/uploads/FilePDFUpload/369701.pdf?vv=151700', 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-5590-QD-BYT-2017-Huong-dan-quy-trinh-ky-thuat-Phau-thuat-Tao-hinh-Tham-my-369701.aspx', true),
  ('source_group:10.5728:01', 'source_group', '10.5728', 'Hướng dẫn quy trình kỹ thuật Ngoại khoa, chuyên khoa Phẫu thuật Tim mạch', 'Thư Viện Pháp Luật', '5728/QĐ-BYT', 'https://files.thuvienphapluat.vn/uploads/FilePDFUpload/370394.pdf?vv=173700', 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-5728-QD-BYT-2017-Huong-dan-quy-trinh-ky-thuat-Ngoai-khoa-Phau-thuat-Tim-mach-370394.aspx', true),
  ('source_group:10.5729:01', 'source_group', '10.5729', 'Hướng dẫn quy trình kỹ thuật Ngoại khoa, chuyên khoa Phẫu thuật Lồng ngực', 'Thư Viện Pháp Luật', '5729/QĐ-BYT', 'https://files.thuvienphapluat.vn/uploads/FilePDFUpload/370395.pdf?vv=173800', 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-5729-QD-BYT-2017-Huong-dan-quy-trinh-ky-thuat-Ngoai-khoa-Phau-thuat-Long-nguc-370395.aspx', true),
  ('source_group:10.5730:01', 'source_group', '10.5730', 'Hướng dẫn quy trình kỹ thuật Ngoại khoa, chuyên khoa Phẫu thuật Tiết niệu', 'Thư Viện Pháp Luật', '5730/QĐ-BYT', 'https://files.thuvienphapluat.vn/uploads/FilePDFUpload/370396.pdf?vv=174000', 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-5730-QD-BYT-2017-Huong-dan-quy-trinh-ky-thuat-Ngoai-khoa-Phau-thuat-Tiet-nieu-370396.aspx', true),
  ('source_group:10.5731:01', 'source_group', '10.5731', 'Hướng dẫn quy trình kỹ thuật Ngoại khoa, chuyên khoa Phẫu thuật Tiêu hóa', 'Thư Viện Pháp Luật', '5731/QĐ-BYT', 'https://files.thuvienphapluat.vn/uploads/FilePDFUpload/370397.pdf?vv=082700', 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-5731-QD-BYT-2017-Huong-dan-quy-trinh-ky-thuat-Ngoai-khoa-Phau-thuat-Tieu-hoa-370397.aspx', true),
  ('source_group:10.5732:01', 'source_group', '10.5732', 'Hướng dẫn quy trình kỹ thuật Ngoại khoa, chuyên khoa Chấn thương Chỉnh hình', 'Thư Viện Pháp Luật', '5732/QĐ-BYT', 'https://files.thuvienphapluat.vn/uploads/FilePDFUpload/370398.pdf?vv=174000', 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-5732-QD-BYT-2017-Huong-dan-quy-trinh-ky-thuat-Ngoai-khoa-Chan-thuong-Chinh-hinh-370398.aspx', true),
  ('source_group:12.3338:01', 'source_group', '12.3338', 'Hướng dẫn quy trình kỹ thuật khám bệnh, chữa bệnh chuyên ngành Ung bướu', 'Cục Quản lý Khám, chữa bệnh - Bộ Y tế', '3338/QĐ-BYT', 'https://kcb.vn/upload/2005611/20210723//Ung-b%C6%B0%E1%BB%9Bu.pdf', 'https://kcb.vn/quy-trinh/quy-trinh-ky-thuat-kham-benh-chua-benh-chuyen-nganh-ung-buou.html', true),
  ('source_group:13.1377:01', 'source_group', '13.1377', 'Hướng dẫn quy trình kỹ thuật khám bệnh, chữa bệnh chuyên ngành Phụ Sản', 'Cục Quản lý Khám, chữa bệnh - Bộ Y tế', '1377/QĐ-BYT', 'https://kcb.vn/upload/2005611/20210723//Ph%E1%BB%A5-s%E1%BA%A3n.pdf', 'https://kcb.vn/quy-trinh/quy-trinh-ky-thuat-kham-benh-chua-benh-chuyen-nganh-phu-san.html', true),
  ('source_group:14.3906:01', 'source_group', '14.3906', 'Hướng dẫn quy trình kỹ thuật khám bệnh, chữa bệnh chuyên ngành Nhãn khoa', 'Cục Quản lý Khám, chữa bệnh - Bộ Y tế', '3906/QĐ-BYT', 'https://kcb.vn/upload/2005611/20210723//Nh%C3%A3n-khoa.pdf', 'https://kcb.vn/quy-trinh/quy-trinh-ky-thuat-kham-benh-chua-benh-chuyen-nganh-nhan-kho.html', true),
  ('source_group:15.3978:01', 'source_group', '15.3978', 'Hướng dẫn quy trình kỹ thuật khám bệnh, chữa bệnh chuyên ngành Tai Mũi Họng', 'Cục Quản lý Khám, chữa bệnh - Bộ Y tế', '3978/QĐ-BYT', 'https://kcb.vn/upload/2005611/20210723//Tai-M%C5%A9i-H%E1%BB%8Dng.pdf', 'https://kcb.vn/quy-trinh/quy-trinh-ky-thuat-kham-benh-chua-benh-chuyen-nganh-tai-mui-.html', true),
  ('source_group:16.2121:01', 'source_group', '16.2121', 'Hướng dẫn quy trình kỹ thuật chuyên ngành Răng Hàm Mặt', 'Cục Quản lý Khám, chữa bệnh - Bộ Y tế', '2121/QĐ-BYT', 'https://kcb.vn/upload/2005611/20210723//Quyet-dinh-2121-ve-ban-h%C3%A0nh-t%C3%A0i-li%E1%BB%87u-H%C6%B0%E1%BB%9Bng-d%E1%BA%ABn-quy-tr%C3%ACnh-k%E1%BB%B9-thu%E1%BA%ADt-chuy%C3%AAn-ng%C3%A0nh-R%C4%83ng-h%C3%A0m-mat-.pdf', 'https://kcb.vn/phac-do/quyet-dinh-so-2121-qd-byt-ngay-21-5-2020-ban-hanh-tai-lieu-h.html', true),
  ('source_group:16.3207:01', 'source_group', '16.3207', 'Hướng dẫn quy trình kỹ thuật khám bệnh, chữa bệnh chuyên ngành Răng Hàm Mặt', 'Bệnh viện Đa khoa huyện Hà Trung', '3207/QĐ-BYT', 'https://benhvienhatrung.vn/wp-content/uploads/2022/08/3207_2013-RHM.pdf', 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-3207-QD-BYT-2013-huong-dan-Quy-trinh-ky-thuat-kham-chua-benh-chuyen-nganh-Rang-Ham-Mat-206569.aspx', true),
  ('source_group:17.0054:01', 'source_group', '17.0054', 'Hướng dẫn quy trình kỹ thuật chuyên ngành Phục hồi chức năng', 'Cục Quản lý Khám, chữa bệnh - Bộ Y tế', '54/QĐ-BYT', 'https://kcb.vn/upload/2005611/20210723//PHCN.pdf', 'https://kcb.vn/quy-trinh/quy-trinh-ky-thuat-chuyen-nganh-phuc-hoi-chuc-nang.html', true),
  ('source_group:17.2520:01', 'source_group', '17.2520', 'Hướng dẫn quy trình kỹ thuật Phục hồi chức năng', 'Thư Viện Pháp Luật', '2520/QĐ-BYT', 'https://files.thuvienphapluat.vn/uploads/FilePDFUpload/417981.pdf?vv=092400', 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-2520-QD-BYT-2019-Huong-dan-quy-trinh-ky-thuat-Phuc-hoi-chuc-nang-417981.aspx', true),
  ('source_group:17.5737:01', 'source_group', '17.5737', 'Hướng dẫn quy trình kỹ thuật Phục hồi chức năng', 'Cục Quản lý Khám, chữa bệnh - Bộ Y tế', '5737/QĐ-BYT', 'https://kcb.vn/upload/2005611/20210723//Quy-trinh-ky-thuat-PHCN-dot-2-Q%C4%90-5737.2017-Bo-Y-te.pdf', 'https://kcb.vn/quy-trinh/quyet-dinh-so-5737-qd-byt-ngay-22-thang-12-nam-2017-ve-viec-.html', true),
  ('source_group:18.0025:01', 'source_group', '18.0025', 'Hướng dẫn quy trình kỹ thuật Chẩn đoán hình ảnh và Điện quang can thiệp', 'Thư Viện Pháp Luật', '25/QĐ-BYT', 'https://files.thuvienphapluat.vn/uploads/FilePDFUpload/253736.pdf?vv=120000', 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-25-QD-BYT-2014-tai-lieu-Huong-dan-quy-trinh-ky-thuat-Chan-doan-hinh-anh-dien-quang-can-thiep-253736.aspx', true),
  ('source_group:22.2017:01', 'source_group', '22.2017', 'Hướng dẫn quy trình kỹ thuật Huyết học - Truyền máu - Miễn dịch - Di truyền - Sinh học phân tử', 'Thư Viện Pháp Luật', '2017/QĐ-BYT', 'https://files.thuvienphapluat.vn/uploads/FilePDFUpload/249563.pdf?vv=120000', 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-2017-QD-BYT-2014-quy-trinh-ky-thuat-Huyet-hoc-Truyen-mau-Mien-dich-di-truyen-Sinh-hoc-phan-tu-249563.aspx', true),
  ('source_group:22.3336:01', 'source_group', '22.3336', 'Hướng dẫn quy trình kỹ thuật Huyết học - Truyền máu - Miễn dịch - Di truyền - Sinh học phân tử', 'Thư Viện Pháp Luật', '3336/QĐ-BYT', 'https://files.thuvienphapluat.vn/uploads/FilePDFUpload/355969.pdf?vv=161300', 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-3336-QD-BYT-2017-quy-trinh-Huyet-hoc-Truyen-mau-Mien-dich-Di-truyen-Sinh-hoc-phan-tu-355969.aspx', true),
  ('source_group:23.0320:01', 'source_group', '23.0320', 'Hướng dẫn quy trình kỹ thuật chuyên ngành Hóa sinh', 'Thư Viện Pháp Luật', '320/QĐ-BYT', 'https://files.thuvienphapluat.vn/uploads/FilePDFUpload/221476.pdf?vv=100400', 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-320-QD-BYT-nam-2014-tai-lieu-huong-dan-quy-trinh-ky-thuat-Hoa-sinh-221476.aspx', true),
  ('source_group:23.7034:01', 'source_group', '23.7034', 'Hướng dẫn quy trình kỹ thuật chuyên ngành Hóa sinh', 'Cục Quản lý Khám, chữa bệnh - Bộ Y tế', '7034/QĐ-BYT', 'https://kcb.vn/upload/2005611/20210723//H%C6%B0%E1%BB%9Bng-d%E1%BA%ABn-130-QTKT-H%C3%B3a-sinh-2018.pdf', 'https://kcb.vn/quy-trinh/quyet-dinh-7034-qd-byt-ngay-21-11-2018-cua-bo-y-te-ve-viec-b.html', true),
  ('source_group:24.0026:01', 'source_group', '24.0026', 'Hướng dẫn quy trình kỹ thuật chuyên ngành Vi sinh Y học', 'Thư Viện Pháp Luật', '26/QĐ-BYT', 'https://files.thuvienphapluat.vn/uploads/FilePDFUpload/290453.pdf?vv=120000', 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-26-QD-BYT-2014-tai-lieu-Huong-dan-quy-trinh-ky-thuat-chuyen-nganh-Vi-sinh-Y-hoc-290453.aspx', true),
  ('source_group:24.6769:01', 'source_group', '24.6769', 'Hướng dẫn quy trình kỹ thuật chuyên ngành Vi sinh', 'Cục Quản lý Khám, chữa bệnh - Bộ Y tế', '6769/QĐ-BYT', 'https://kcb.vn/upload/2005611/20210723//Q%C4%90-ban-h%C3%A0nh-HD-QTKTVi-sinh-2018-2.pdf', 'https://kcb.vn/quy-trinh/quyet-dinh-so-6769-qd-byt-ngay-08-thang-11-nam-2018-cua-bo-t.html', true),
  ('source_group:25.5199:01', 'source_group', '25.5199', 'Hướng dẫn quy trình kỹ thuật chuyên ngành Giải phẫu bệnh - Tế bào bệnh học', 'Thư Viện Pháp Luật', '5199/QĐ-BYT', 'https://files.thuvienphapluat.vn/uploads/FilePDFUpload/226614.pdf?vv=120000', 'https://thuvienphapluat.vn/van-ban/The-thao-Y-te/Quyet-dinh-5199-QD-BYT-nam-2013-ky-thuat-chuyen-nganh-Giai-phau-benh-Te-bao-benh-hoc-Bo-Y-te-226614.aspx', true),
  ('source_group:26.3448:01', 'source_group', '26.3448', 'Hướng dẫn quy trình kỹ thuật Vi phẫu', 'Cục Quản lý Khám, chữa bệnh - Bộ Y tế', '3448/QĐ-BYT', 'https://kcb.vn/upload/2005611/20210723//Huong-dan-Quy-trinh-ky-thuat-Vi-Phau.pdf', 'https://kcb.vn/quy-trinh/quyet-dinh-3448-qd-byt-ngay-07-6-2018-ve-viec-ban-hanh-tai-l.html', true),
  ('source_group:27.7708:01', 'source_group', '27.7708', 'Hướng dẫn quy trình Phẫu thuật Nội soi - Phần 1', 'Cục Quản lý Khám, chữa bệnh - Bộ Y tế', '7708/QĐ-BYT', 'https://kcb.vn/upload/2005611/20210723/48967e1e7812938134f55394e00700bbPHAN-1.pdf', 'https://kcb.vn/quy-trinh/quyet-dinh-so-7708-qd-byt-ngay-30-12-2016-ve-viec-ban-hanh-t.html', true),
  ('source_group:27.7708:02', 'source_group', '27.7708', 'Hướng dẫn quy trình Phẫu thuật Nội soi - Phần 2', 'Cục Quản lý Khám, chữa bệnh - Bộ Y tế', '7708/QĐ-BYT', 'https://kcb.vn/upload/2005611/20210723/7ae5612efb14e3b0f24e43bfc75ca3b3PHAN-2.pdf', 'https://kcb.vn/quy-trinh/quyet-dinh-so-7708-qd-byt-ngay-30-12-2016-ve-viec-ban-hanh-t.html', false),
  ('source_group:28.3449:01', 'source_group', '28.3449', 'Hướng dẫn quy trình kỹ thuật Phẫu thuật Tạo hình - Thẩm mỹ', 'Cục Quản lý Khám, chữa bệnh - Bộ Y tế', '3449/QĐ-BYT', 'https://kcb.vn/upload/2005611/20210723//Huong-dan-Quy-trinh-ky-thuat-Tao-hinh-Tham-mi.pdf', 'https://kcb.vn/quy-trinh/quyet-dinh-3449-qd-byt-ngay-07-6-2018-ve-viec-ban-hanh-tai-l.html', true)
on conflict (code) do update set
  target_type = excluded.target_type,
  target_code = excluded.target_code,
  title = excluded.title,
  organization = excluded.organization,
  decision_number = excluded.decision_number,
  pdf_url = excluded.pdf_url,
  source_page_url = excluded.source_page_url,
  verified_at = now(),
  is_primary = excluded.is_primary;
