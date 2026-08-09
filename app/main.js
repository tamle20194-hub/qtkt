import { loadData } from './data.js';

const main = document.getElementById('main-content');
const breadcrumb = document.getElementById('breadcrumb');
const notice = document.getElementById('app-notice');
const networkDot = document.getElementById('network-dot');
const networkLabel = document.getElementById('network-label');
const themeButton = document.getElementById('theme-toggle');
const installButton = document.getElementById('install-app');

const PAGE_SIZE = 50;
const numberFormat = new Intl.NumberFormat('vi-VN');
let DATA;
let installPrompt;

const PAGE_NAMES = {
  home: 'Tổng quan',
  technical: 'Danh mục kỹ thuật',
  byt: 'Tài liệu Bộ Y tế',
  bv: 'Quy trình BV 115',
  records: 'Hồ sơ áp dụng',
  about: 'Giới thiệu',
};

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  );
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function contentValue(value) {
  const text = String(value ?? '').trim();
  return !text || text === '#N/A' || text === '0' ? 'Chưa cập nhật' : text;
}

function percent(part, total) {
  return total ? `${((part / total) * 100).toFixed(1).replace('.', ',')}%` : '0%';
}

function parseHash() {
  const raw = (location.hash || '#/home').replace(/^#\/?/, '');
  const [pathPart, query = ''] = raw.split('?');
  const segments = pathPart
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });

  return {
    page: segments[0] || 'home',
    id: segments.slice(1).join('/'),
    params: new URLSearchParams(query),
  };
}

function makeHash(path, values = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== '' && value != null && value !== false) {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return `#/${path}${query ? `?${query}` : ''}`;
}

function navigate(path, values) {
  const next = makeHash(path, values);
  if (location.hash === next) {
    render();
  } else {
    location.hash = next;
  }
}

function updateNavigation(page) {
  document.querySelectorAll('#primary-nav a[data-page]').forEach((link) => {
    const active = link.dataset.page === page;
    link.classList.toggle('active', active);
    if (active) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
  breadcrumb.textContent = PAGE_NAMES[page] || 'Kho Chuyên môn 115';
}

function docSection(title, value) {
  return `
    <section class="doc-section">
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(contentValue(value))}</p>
    </section>
  `;
}

function pageFooter() {
  return `
    <footer class="footer">
      Nguồn dữ liệu: Supabase • Cập nhật từ Kho Chuyên môn 115
    </footer>
  `;
}

function renderHome() {
  const dashboard = DATA.dashboard;
  const approvedRate = percent(dashboard.approved, dashboard.totalBYT);
  const processRate = percent(dashboard.withProcess, dashboard.totalBYT);
  const recent = DATA.technical.filter((item) => item.approved).slice(0, 8);

  main.innerHTML = `
    <section class="hero">
      <p class="eyebrow">KHO DỮ LIỆU CHUYÊN MÔN TRỰC TUYẾN</p>
      <h1>Tra cứu kỹ thuật và quy trình chuyên môn trong một nơi</h1>
      <p>
        Tìm theo mã, tên kỹ thuật, chuyên ngành, mã tương đương hoặc quy trình nguồn.
      </p>
      <form class="search" id="home-search-form" role="search">
        <label class="sr-only" for="home-query">Từ khóa tra cứu</label>
        <input id="home-query" name="q" autocomplete="off"
          placeholder="Ví dụ: 01.0002, siêu âm tim, hồi sức..." />
        <button type="submit">Tra cứu</button>
      </form>
    </section>

    <section class="stats" aria-label="Thống kê tổng quan">
      <article class="stat">
        <div class="num">${numberFormat.format(dashboard.totalBYT)}</div>
        <div class="label">Kỹ thuật trong danh mục</div>
        <div class="ratio">Dữ liệu đầy đủ 100%</div>
      </article>
      <article class="stat">
        <div class="num">${numberFormat.format(dashboard.approved)}</div>
        <div class="label">Kỹ thuật đã phê duyệt</div>
        <div class="ratio">${approvedRate} danh mục</div>
      </article>
      <article class="stat">
        <div class="num">${numberFormat.format(dashboard.bytProcessCount)}</div>
        <div class="label">QTKT Bộ Y tế trong kho</div>
        <div class="ratio">Đang kết nối Supabase</div>
      </article>
      <article class="stat">
        <div class="num">${numberFormat.format(dashboard.bvProcessCount)}</div>
        <div class="label">QTKT Bệnh viện 115</div>
        <div class="ratio">${processRate} kỹ thuật có trạng thái QTKT</div>
      </article>
    </section>

    <div class="section-head">
      <div><p class="eyebrow">LỐI TẮT</p><h2>Không gian tra cứu</h2></div>
    </div>
    <section class="cards">
      <a class="card" href="#/technical">
        <span class="card-icon" aria-hidden="true">⌕</span>
        <strong>Danh mục kỹ thuật</strong>
        <span>Tìm kiếm và lọc ${numberFormat.format(dashboard.totalBYT)} kỹ thuật.</span>
      </a>
      <a class="card" href="#/byt">
        <span class="card-icon" aria-hidden="true">▤</span>
        <strong>Quy trình Bộ Y tế</strong>
        <span>Mở nội dung quy trình đang có trong kho.</span>
      </a>
      <a class="card" href="#/bv">
        <span class="card-icon" aria-hidden="true">✚</span>
        <strong>Quy trình BV 115</strong>
        <span>Tra cứu quy trình kỹ thuật nội bộ bệnh viện.</span>
      </a>
      <a class="card" href="#/records">
        <span class="card-icon" aria-hidden="true">✓</span>
        <strong>Hồ sơ áp dụng</strong>
        <span>Kiểm tra trạng thái phê duyệt và tài liệu nguồn.</span>
      </a>
    </section>

    <div class="section-head">
      <div><p class="eyebrow">DANH MỤC</p><h2>Một số kỹ thuật đã phê duyệt</h2></div>
      <a class="linkbtn" href="#/technical?status=approved">Xem toàn bộ</a>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Mã</th><th>Tên kỹ thuật</th><th>Chuyên ngành</th><th>MTĐ</th><th></th></tr></thead>
        <tbody>
          ${recent
            .map(
              (item) => `
                <tr>
                  <td class="code">${escapeHtml(item.code)}</td>
                  <td>${escapeHtml(item.name)}</td>
                  <td>${escapeHtml(item.specialty)}</td>
                  <td class="code">${escapeHtml(item.mtd || '—')}</td>
                  <td><a class="linkbtn" href="#/technical/${encodeURIComponent(item.code)}">Chi tiết</a></td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
    ${pageFooter()}
  `;
}

function getTechnicalFilters(route) {
  return {
    q: route.params.get('q') || '',
    status: route.params.get('status') || '',
    year: route.params.get('year') || '',
    specialty: route.params.get('specialty') || '',
    page: Math.max(1, Number(route.params.get('page')) || 1),
  };
}

function filterTechnical(filters, approvedOnly = false) {
  const query = normalizeText(filters.q);
  return DATA.technical.filter((item) => {
    if (approvedOnly && !item.approved) return false;
    if (query && !item._search.includes(query)) return false;
    if (filters.status === 'approved' && !item.approved) return false;
    if (filters.status === 'pending' && item.approved) return false;
    if (filters.year && item.approvalYear !== filters.year) return false;
    if (filters.specialty && item.specialty !== filters.specialty) return false;
    return true;
  });
}

function technicalFilterForm(filters) {
  const years = [...new Set(DATA.technical.map((item) => item.approvalYear).filter(Boolean))]
    .sort()
    .reverse();
  const specialties = [...new Set(DATA.technical.map((item) => item.specialty))].sort(
    (a, b) => a.localeCompare(b, 'vi'),
  );

  return `
    <form class="toolbar" id="technical-filter-form" data-auto-submit>
      <label class="field grow">
        <span class="sr-only">Từ khóa</span>
        <input name="q" value="${escapeHtml(filters.q)}"
          placeholder="Mã, tên kỹ thuật, MTĐ, quy trình..." autocomplete="off" />
      </label>
      <label>
        <span class="sr-only">Trạng thái phê duyệt</span>
        <select name="status">
          <option value="">Tất cả trạng thái</option>
          <option value="approved" ${filters.status === 'approved' ? 'selected' : ''}>Đã phê duyệt</option>
          <option value="pending" ${filters.status === 'pending' ? 'selected' : ''}>Chưa phê duyệt</option>
        </select>
      </label>
      <label>
        <span class="sr-only">Năm phê duyệt</span>
        <select name="year">
          <option value="">Tất cả năm</option>
          ${years
            .map(
              (year) =>
                `<option value="${escapeHtml(year)}" ${filters.year === year ? 'selected' : ''}>${escapeHtml(year)}</option>`,
            )
            .join('')}
        </select>
      </label>
      <label>
        <span class="sr-only">Chuyên ngành</span>
        <select name="specialty">
          <option value="">Tất cả chuyên ngành</option>
          ${specialties
            .map(
              (specialty) =>
                `<option value="${escapeHtml(specialty)}" ${filters.specialty === specialty ? 'selected' : ''}>${escapeHtml(specialty)}</option>`,
            )
            .join('')}
        </select>
      </label>
      <button class="secondary-button" type="submit">Lọc</button>
      <button class="clear-button" type="button" data-hash="#/technical">Xóa lọc</button>
    </form>
  `;
}

function pagination(path, filters, page, totalPages, totalRows) {
  const start = totalRows ? (page - 1) * PAGE_SIZE + 1 : 0;
  const end = Math.min(page * PAGE_SIZE, totalRows);
  const base = { ...filters };
  delete base.page;

  return `
    <nav class="pagination" aria-label="Phân trang">
      <span>Hiển thị ${numberFormat.format(start)}–${numberFormat.format(end)}
        trong ${numberFormat.format(totalRows)} kết quả</span>
      <div class="pagination-actions">
        <button type="button" ${page <= 1 ? 'disabled' : ''}
          data-hash="${escapeHtml(makeHash(path, { ...base, page: page - 1 }))}">← Trước</button>
        <span class="info-chip">Trang ${numberFormat.format(page)}/${numberFormat.format(totalPages)}</span>
        <button type="button" ${page >= totalPages ? 'disabled' : ''}
          data-hash="${escapeHtml(makeHash(path, { ...base, page: page + 1 }))}">Sau →</button>
      </div>
    </nav>
  `;
}

function renderTechnical(route) {
  const filters = getTechnicalFilters(route);
  const filtered = filterTechnical(filters);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  main.innerHTML = `
    <div class="section-head">
      <div>
        <p class="eyebrow">DANH MỤC KỸ THUẬT</p>
        <h1>Tra cứu kỹ thuật</h1>
      </div>
      <span class="result-summary">${numberFormat.format(filtered.length)} kết quả</span>
    </div>
    ${technicalFilterForm(filters)}
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Mã</th><th>Tên kỹ thuật</th><th>Chuyên ngành</th><th>Phê duyệt</th><th>MTĐ</th><th></th></tr>
        </thead>
        <tbody>
          ${rows.length
            ? rows
                .map(
                  (item) => `
                    <tr>
                      <td class="code">${escapeHtml(item.code)}</td>
                      <td>${escapeHtml(item.name)}</td>
                      <td>${escapeHtml(item.specialty)}</td>
                      <td><span class="badge ${item.approved ? 'green' : 'amber'}">
                        ${item.approved ? 'Đã phê duyệt' : 'Chưa phê duyệt'}
                      </span></td>
                      <td class="code">${escapeHtml(item.mtd || '—')}</td>
                      <td><a class="linkbtn" href="#/technical/${encodeURIComponent(item.code)}">Chi tiết</a></td>
                    </tr>
                  `,
                )
                .join('')
            : '<tr><td colspan="6" class="empty">Không tìm thấy kỹ thuật phù hợp.</td></tr>'}
        </tbody>
      </table>
    </div>
    ${pagination('technical', filters, page, totalPages, filtered.length)}
    ${pageFooter()}
  `;
}

function renderTechnicalDetail(code) {
  const item = DATA.technical.find((entry) => entry.code === code);
  if (!item) {
    renderNotFound('Không tìm thấy mã kỹ thuật', '#/technical');
    return;
  }

  const bytDoc = DATA.bytDocs.find((entry) => entry.code === item.sourceCode);
  const bvDoc = DATA.bvDocs.find((entry) => entry.code === item.sourceCode);
  const linkedDocument = bytDoc || bvDoc;
  const linkedType = bytDoc ? 'byt' : 'bv';

  main.innerHTML = `
    <button class="back" type="button" data-hash="#/technical">← Quay lại danh mục</button>
    <div class="detail">
      <section>
        <article class="panel">
          <div class="detail-heading">
            <div>
              <p class="eyebrow">MÃ KỸ THUẬT <span class="code">${escapeHtml(item.code)}</span></p>
              <h1>${escapeHtml(item.name)}</h1>
              <p class="muted">${escapeHtml(item.specialty)}</p>
            </div>
            <span class="badge ${item.approved ? 'green' : 'amber'}">
              ${item.approved ? 'Đã phê duyệt' : 'Chưa phê duyệt'}
            </span>
          </div>
          <div class="info-strip">
            <span class="info-chip">Năm: ${escapeHtml(item.approvalYear || '—')}</span>
            <span class="info-chip">MTĐ: ${escapeHtml(item.mtd || '—')}</span>
            <span class="info-chip">Mã giá: ${escapeHtml(item.priceCode || '—')}</span>
          </div>
          ${docSection('Chỉ định', item.indication)}
          ${docSection('Chống chỉ định', item.contra)}
          ${docSection('Người thực hiện', item.performer)}
          ${docSection('Phương tiện, trang thiết bị', item.equipment)}
          ${docSection('Thời gian thực hiện', item.duration)}
        </article>
      </section>
      <aside>
        <article class="panel">
          <h2>Liên kết tài liệu nguồn</h2>
          <div class="meta">
            <div class="meta-item"><small>Mã nguồn</small><strong class="code">${escapeHtml(item.sourceCode || '—')}</strong></div>
            <div class="meta-item"><small>Trạng thái QTKT</small><strong>${item.hasProcess ? 'Có' : 'Chưa có'}</strong></div>
          </div>
          <p class="body-copy spaced">${escapeHtml(contentValue(item.sourceName))}</p>
          ${linkedDocument
            ? `<div class="button-row"><a class="linkbtn" href="#/${linkedType}/${encodeURIComponent(linkedDocument.code)}">Mở quy trình nguồn</a></div>`
            : '<p class="muted spaced">Chưa có tài liệu nguồn trùng mã trong kho hiện tại.</p>'}
        </article>
      </aside>
    </div>
    ${pageFooter()}
  `;
}

function renderDocuments(type, route) {
  const isByt = type === 'byt';
  const documents = isByt ? DATA.bytDocs : DATA.bvDocs;
  const query = route.params.get('q') || '';
  const normalized = normalizeText(query);
  const filtered = documents.filter((document) =>
    normalizeText([document.code, document.sourceCode, document.name].join(' ')).includes(
      normalized,
    ),
  );

  main.innerHTML = `
    <div class="section-head">
      <div>
        <p class="eyebrow">${isByt ? 'KHO QUY TRÌNH BỘ Y TẾ' : 'KHO QUY TRÌNH NỘI BỘ'}</p>
        <h1>${isByt ? 'Tài liệu Bộ Y tế' : 'Quy trình BV 115'}</h1>
      </div>
      <span>${numberFormat.format(filtered.length)} tài liệu</span>
    </div>
    <form class="toolbar" id="document-filter-form">
      <input type="hidden" name="type" value="${type}" />
      <label class="field grow">
        <span class="sr-only">Tìm tài liệu</span>
        <input name="q" value="${escapeHtml(query)}" placeholder="Mã hoặc tên quy trình..." />
      </label>
      <button class="secondary-button" type="submit">Tìm</button>
      <button class="clear-button" type="button" data-hash="#/${type}">Xóa lọc</button>
    </form>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Mã</th><th>Mã nguồn</th><th>Tên quy trình</th>${isByt ? '<th>Tác giả</th>' : ''}<th></th></tr></thead>
        <tbody>
          ${filtered.length
            ? filtered
                .map(
                  (document) => `
                    <tr>
                      <td class="code">${escapeHtml(document.code)}</td>
                      <td class="code">${escapeHtml(document.sourceCode || '—')}</td>
                      <td>${escapeHtml(document.name)}</td>
                      ${isByt ? `<td>${escapeHtml(document.author || '—')}</td>` : ''}
                      <td><a class="linkbtn" href="#/${type}/${encodeURIComponent(document.code)}">Mở</a></td>
                    </tr>
                  `,
                )
                .join('')
            : `<tr><td colspan="${isByt ? 5 : 4}" class="empty">Không tìm thấy tài liệu phù hợp.</td></tr>`}
        </tbody>
      </table>
    </div>
    ${pageFooter()}
  `;
}

function renderDocumentDetail(type, code) {
  const isByt = type === 'byt';
  const documents = isByt ? DATA.bytDocs : DATA.bvDocs;
  const document = documents.find((entry) => entry.code === code);
  if (!document) {
    renderNotFound('Không tìm thấy quy trình', `#/${type}`);
    return;
  }

  main.innerHTML = `
    <button class="back" type="button" data-hash="#/${type}">← Quay lại kho tài liệu</button>
    <article class="panel">
      <div class="detail-heading">
        <div>
          <p class="eyebrow">${isByt ? 'QUY TRÌNH BỘ Y TẾ' : 'QUY TRÌNH BV 115'}</p>
          <h1>${escapeHtml(document.name)}</h1>
        </div>
        <span class="badge green">${escapeHtml(document.code)}</span>
      </div>
      <div class="info-strip">
        <span class="info-chip">Mã nguồn: ${escapeHtml(document.sourceCode || '—')}</span>
        ${isByt ? `<span class="info-chip">Tác giả: ${escapeHtml(document.author || '—')}</span>` : ''}
      </div>
      ${isByt ? docSection('Đại cương', document.general) : ''}
      ${docSection('Chỉ định', document.indication)}
      ${docSection('Chống chỉ định', document.contra)}
      ${docSection('Người thực hiện', document.performer)}
      ${docSection('Phương tiện, trang thiết bị', document.equipment)}
      ${docSection('Thời gian thực hiện', document.duration)}
      ${isByt ? docSection('Các bước tiến hành', document.procedure) : ''}
      ${isByt ? docSection('Theo dõi', document.monitor) : ''}
      ${isByt ? docSection('Tai biến và xử trí', document.complications) : ''}
    </article>
    ${pageFooter()}
  `;
}

function renderRecords(route) {
  const filters = {
    q: route.params.get('q') || '',
    page: Math.max(1, Number(route.params.get('page')) || 1),
  };
  const filtered = filterTechnical(filters, true);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const documentCodes = new Set([
    ...DATA.bytDocs.map((item) => item.code),
    ...DATA.bvDocs.map((item) => item.code),
  ]);

  main.innerHTML = `
    <div class="section-head">
      <div><p class="eyebrow">HỒ SƠ ÁP DỤNG</p><h1>Kỹ thuật đã phê duyệt</h1></div>
      <span>${numberFormat.format(filtered.length)} hồ sơ</span>
    </div>
    <form class="toolbar" id="records-filter-form">
      <label class="field grow">
        <span class="sr-only">Tìm hồ sơ</span>
        <input name="q" value="${escapeHtml(filters.q)}" placeholder="Mã hoặc tên kỹ thuật..." />
      </label>
      <button class="secondary-button" type="submit">Tìm</button>
      <button class="clear-button" type="button" data-hash="#/records">Xóa lọc</button>
    </form>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Mã</th><th>Tên kỹ thuật</th><th>Năm</th><th>Mã nguồn</th><th>Tài liệu trong kho</th><th></th></tr></thead>
        <tbody>
          ${rows
            .map((item) => {
              const hasLinkedDocument = documentCodes.has(item.sourceCode);
              return `
                <tr>
                  <td class="code">${escapeHtml(item.code)}</td>
                  <td>${escapeHtml(item.name)}</td>
                  <td>${escapeHtml(item.approvalYear || '—')}</td>
                  <td class="code">${escapeHtml(item.sourceCode || '—')}</td>
                  <td><span class="badge ${hasLinkedDocument ? 'green' : 'gray'}">
                    ${hasLinkedDocument ? 'Đã liên kết' : 'Chưa liên kết'}
                  </span></td>
                  <td><a class="linkbtn" href="#/technical/${encodeURIComponent(item.code)}">Chi tiết</a></td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
    ${pagination('records', filters, page, totalPages, filtered.length)}
    ${pageFooter()}
  `;
}

function renderAbout() {
  const source = DATA.meta?.source === 'cache' ? 'Bản lưu ngoại tuyến' : 'Supabase trực tuyến';
  main.innerHTML = `
    <section class="panel">
      <p class="eyebrow">GIỚI THIỆU HỆ THỐNG</p>
      <h1>Kho Chuyên môn 115</h1>
      <p class="body-copy spaced">
        Ứng dụng tra cứu danh mục kỹ thuật, quy trình Bộ Y tế và quy trình nội bộ
        của Bệnh viện 115. Frontend đọc dữ liệu qua Supabase Data API bằng quyền
        chỉ đọc; việc thêm, sửa và xóa không được cấp cho trình duyệt.
      </p>
      <div class="stats">
        <article class="stat"><div class="num">${numberFormat.format(DATA.technical.length)}</div><div class="label">Kỹ thuật</div></article>
        <article class="stat"><div class="num">${numberFormat.format(DATA.bytDocs.length)}</div><div class="label">QTKT Bộ Y tế</div></article>
        <article class="stat"><div class="num">${numberFormat.format(DATA.bvDocs.length)}</div><div class="label">QTKT BV 115</div></article>
        <article class="stat"><div class="num">RLS</div><div class="label">Bảo vệ ở tầng database</div></article>
      </div>
      <div class="meta">
        <div class="meta-item"><small>Nguồn đang sử dụng</small><strong>${escapeHtml(source)}</strong></div>
        <div class="meta-item"><small>Thời điểm tải</small><strong>${escapeHtml(DATA.meta?.loadedAt ? new Date(DATA.meta.loadedAt).toLocaleString('vi-VN') : '—')}</strong></div>
      </div>
    </section>
    ${pageFooter()}
  `;
}

function renderNotFound(message, backHash = '#/home') {
  main.innerHTML = `
    <section class="error-state">
      <p class="eyebrow">KHÔNG TÌM THẤY</p>
      <h1>${escapeHtml(message)}</h1>
      <button class="secondary-button spaced" type="button" data-hash="${escapeHtml(backHash)}">Quay lại</button>
    </section>
  `;
}

function render() {
  if (!DATA) return;
  const route = parseHash();
  updateNavigation(route.page);

  if (route.page === 'home') renderHome();
  else if (route.page === 'technical' && route.id) renderTechnicalDetail(route.id);
  else if (route.page === 'technical') renderTechnical(route);
  else if ((route.page === 'byt' || route.page === 'bv') && route.id) {
    renderDocumentDetail(route.page, route.id);
  } else if (route.page === 'byt' || route.page === 'bv') {
    renderDocuments(route.page, route);
  } else if (route.page === 'records') renderRecords(route);
  else if (route.page === 'about') renderAbout();
  else renderNotFound('Trang không tồn tại');

  main.focus({ preventScroll: true });
}

function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}

main.addEventListener('click', (event) => {
  const reload = event.target.closest('[data-reload]');
  if (reload) {
    location.reload();
    return;
  }

  const target = event.target.closest('[data-hash]');
  if (!target || target.disabled) return;
  event.preventDefault();
  const hash = target.dataset.hash;
  if (location.hash === hash) render();
  else location.hash = hash;
});

main.addEventListener('submit', (event) => {
  event.preventDefault();
  const values = formValues(event.target);

  if (event.target.id === 'home-search-form') {
    navigate('technical', { q: values.q });
  } else if (event.target.id === 'technical-filter-form') {
    navigate('technical', { ...values, page: 1 });
  } else if (event.target.id === 'document-filter-form') {
    navigate(values.type, { q: values.q });
  } else if (event.target.id === 'records-filter-form') {
    navigate('records', { q: values.q });
  }
});

main.addEventListener('change', (event) => {
  const form = event.target.closest('form[data-auto-submit]');
  if (form && event.target.matches('select')) {
    form.requestSubmit();
  }
});

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('kho115-theme', theme);
  themeButton.setAttribute('aria-pressed', String(theme === 'dark'));
}

function initTheme() {
  const saved = localStorage.getItem('kho115-theme');
  const preferred = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  setTheme(saved === 'dark' || saved === 'light' ? saved : preferred);
  themeButton.addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });
}

function updateNetworkStatus() {
  const online = navigator.onLine;
  networkDot.classList.toggle('online', online);
  networkDot.classList.toggle('offline', !online);
  networkLabel.textContent = online ? 'Đang trực tuyến' : 'Đang ngoại tuyến';
}

function showNotice(message, className = '') {
  notice.hidden = false;
  notice.className = `app-notice ${className}`.trim();
  notice.textContent = message;
}

function initPwa() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('Không đăng ký được service worker:', error);
    });
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });

  installButton.addEventListener('click', async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    installPrompt = null;
    installButton.hidden = true;
  });
}

function prepareSearchIndex() {
  for (const item of DATA.technical) {
    item._search = normalizeText(
      [item.code, item.name, item.specialty, item.mtd, item.sourceCode, item.sourceName].join(
        ' ',
      ),
    );
  }
}

async function start() {
  initTheme();
  initPwa();
  updateNetworkStatus();
  addEventListener('online', updateNetworkStatus);
  addEventListener('offline', updateNetworkStatus);
  addEventListener('hashchange', render);

  try {
    DATA = await loadData({
      onProgress({ table, rows }) {
        const progress = main.querySelector('.loading-card p');
        if (progress) {
          progress.textContent = `Đang tải ${table}: ${numberFormat.format(rows)} dòng...`;
        }
      },
    });
    prepareSearchIndex();

    if (DATA.meta?.source === 'cache') {
      showNotice(
        'Không kết nối được Supabase. Ứng dụng đang dùng dữ liệu đã lưu từ lần truy cập trước.',
        'offline-banner',
      );
    }

    if (!location.hash) {
      history.replaceState(null, '', '#/home');
    }
    render();
  } catch (error) {
    console.error(error);
    main.innerHTML = `
      <section class="error-state">
        <p class="eyebrow">LỖI KẾT NỐI DỮ LIỆU</p>
        <h1>Chưa tải được Kho Chuyên môn 115</h1>
        <p class="muted spaced">${escapeHtml(error.message)}</p>
        <button class="primary-button spaced" type="button" data-reload>Thử lại</button>
      </section>
    `;
  }
}

start();
