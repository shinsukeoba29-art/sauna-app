// サウナ日記 - アプリロジック
let saunas = [];
let visits = [];
let currentDetailSaunaId = null;
let currentPhotos = []; // {blob, url, name} for the visit modal being edited
let calendarDate = new Date();
calendarDate.setDate(1);
let selectedCalendarDate = null;

// ---------- 初期化 ----------
window.addEventListener('DOMContentLoaded', init);

async function init() {
  await reloadData();
  setupTabs();
  setupFacilityUI();
  setupVisitUI();
  setupCalendarUI();
  setupExportImport();
  renderAll();
}

async function reloadData() {
  saunas = await DB.getAllSaunas();
  visits = await DB.getAllVisits();
}

function renderAll() {
  renderFacilityList();
  populateSaunaSelect(document.getElementById('visit-filter-sauna'), true);
  renderVisitList();
  renderCalendar();
  renderStats();
}

// ---------- タブ切り替え ----------
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'stats') renderStats();
      if (btn.dataset.tab === 'calendar') renderCalendar();
    });
  });
}

// ---------- トースト ----------
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add('hidden'), 2200);
}

// ---------- ユーティリティ ----------
function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function parseTags(str) {
  return (str || '').split(',').map((t) => t.trim()).filter(Boolean);
}

function saunaById(id) {
  return saunas.find((s) => s.id === id);
}

function visitsForSauna(saunaId) {
  return visits.filter((v) => v.saunaId === saunaId);
}

function avgRating(visitArr) {
  const rated = visitArr.filter((v) => v.rating);
  if (!rated.length) return 0;
  return rated.reduce((sum, v) => sum + v.rating, 0) / rated.length;
}

function starString(n, max = 5, filledChar = '★', emptyChar = '☆') {
  n = Math.round(n);
  return filledChar.repeat(n) + emptyChar.repeat(max - n);
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

// ================= 施設 =================
function setupFacilityUI() {
  document.getElementById('facility-search').addEventListener('input', (e) => renderFacilityList(e.target.value));
  document.getElementById('btn-add-facility').addEventListener('click', () => openFacilityModal());
  document.getElementById('btn-cancel-facility').addEventListener('click', closeFacilityModal);
  document.getElementById('btn-save-facility').addEventListener('click', saveFacility);
  document.getElementById('btn-delete-facility').addEventListener('click', () => {
    const id = Number(document.getElementById('facility-id').value);
    if (!id) return;
    const relatedVisits = visitsForSauna(id);
    const msg = relatedVisits.length
      ? `この施設には${relatedVisits.length}件の訪問記録があります。施設を削除すると、これらの訪問記録も削除されます。よろしいですか?`
      : 'この施設を削除しますか?';
    if (!confirm(msg)) return;
    deleteFacility(id);
  });
  document.getElementById('btn-close-detail').addEventListener('click', closeFacilityDetail);
  document.getElementById('btn-edit-facility-from-detail').addEventListener('click', () => {
    const id = currentDetailSaunaId;
    closeFacilityDetail();
    openFacilityModal(id);
  });
}

function renderFacilityList(filterText = '') {
  const container = document.getElementById('facility-list');
  const q = filterText.trim().toLowerCase();
  const filtered = saunas.filter((s) => {
    if (!q) return true;
    const hay = [s.name, s.address, ...(s.tags || [])].join(' ').toLowerCase();
    return hay.includes(q);
  });

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state">${saunas.length ? '該当する施設がありません' : 'まだ施設が登録されていません。「＋ 施設を追加」から始めましょう。'}</div>`;
    return;
  }

  container.innerHTML = filtered
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
    .map((s) => {
      const vList = visitsForSauna(s.id);
      const avg = avgRating(vList);
      return `
      <div class="facility-card" data-id="${s.id}">
        <h3>${escapeHtml(s.name)}</h3>
        <p class="muted">${escapeHtml(s.address || '住所未登録')}</p>
        <div class="tag-row">${(s.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
        <div class="meta-row">
          <span>訪問 ${vList.length} 回</span>
          <span>${vList.length ? starString(avg) : '評価なし'}</span>
        </div>
      </div>`;
    })
    .join('');

  container.querySelectorAll('.facility-card').forEach((card) => {
    card.addEventListener('click', () => openFacilityDetail(Number(card.dataset.id)));
  });
}

function openFacilityModal(id = null) {
  const modal = document.getElementById('facility-modal');
  document.getElementById('facility-modal-title').textContent = id ? '施設を編集' : '施設を追加';
  document.getElementById('facility-id').value = id || '';
  const s = id ? saunaById(id) : null;
  document.getElementById('facility-name').value = s ? s.name : '';
  document.getElementById('facility-address').value = s ? s.address || '' : '';
  document.getElementById('facility-tags').value = s ? (s.tags || []).join(', ') : '';
  document.getElementById('facility-memo').value = s ? s.memo || '' : '';
  document.getElementById('btn-delete-facility').classList.toggle('hidden', !id);
  modal.classList.remove('hidden');
}

function closeFacilityModal() {
  document.getElementById('facility-modal').classList.add('hidden');
}

async function saveFacility() {
  const name = document.getElementById('facility-name').value.trim();
  if (!name) {
    showToast('施設名を入力してください');
    return;
  }
  const id = document.getElementById('facility-id').value;
  const data = {
    name,
    address: document.getElementById('facility-address').value.trim(),
    tags: parseTags(document.getElementById('facility-tags').value),
    memo: document.getElementById('facility-memo').value.trim(),
  };
  if (id) {
    data.id = Number(id);
    const existing = saunaById(data.id);
    data.createdAt = existing ? existing.createdAt : new Date().toISOString();
    await DB.updateSauna(data);
    showToast('施設を更新しました');
  } else {
    await DB.addSauna(data);
    showToast('施設を追加しました');
  }
  await reloadData();
  closeFacilityModal();
  renderAll();
}

async function deleteFacility(id) {
  const relatedVisits = visitsForSauna(id);
  for (const v of relatedVisits) {
    await DB.deleteVisit(v.id);
  }
  await DB.deleteSauna(id);
  await reloadData();
  closeFacilityModal();
  closeFacilityDetail();
  renderAll();
  showToast('施設を削除しました');
}

function openFacilityDetail(id) {
  currentDetailSaunaId = id;
  const s = saunaById(id);
  if (!s) return;
  document.getElementById('detail-facility-name').textContent = s.name;
  document.getElementById('detail-facility-address').textContent = s.address || '';
  document.getElementById('detail-facility-tags').innerHTML = (s.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  document.getElementById('detail-facility-memo').textContent = s.memo || '';

  const vList = visitsForSauna(id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const listEl = document.getElementById('detail-visit-list');
  if (!vList.length) {
    listEl.innerHTML = '<div class="empty-state">この施設への訪問記録はまだありません</div>';
  } else {
    listEl.innerHTML = vList.map((v) => visitCardHtml(v, false)).join('');
    attachVisitCardHandlers(listEl);
  }
  document.getElementById('facility-detail-modal').classList.remove('hidden');
}

function closeFacilityDetail() {
  document.getElementById('facility-detail-modal').classList.add('hidden');
  currentDetailSaunaId = null;
}

// ================= 訪問記録 =================
function setupVisitUI() {
  document.getElementById('visit-filter-sauna').addEventListener('change', (e) => renderVisitList(e.target.value));
  document.getElementById('btn-add-visit').addEventListener('click', () => openVisitModal());
  document.getElementById('btn-cancel-visit').addEventListener('click', closeVisitModal);
  document.getElementById('btn-save-visit').addEventListener('click', saveVisit);
  document.getElementById('btn-delete-visit').addEventListener('click', () => {
    const id = Number(document.getElementById('visit-id').value);
    if (!id) return;
    if (!confirm('この訪問記録を削除しますか?')) return;
    deleteVisitRecord(id);
  });

  setupStarPicker('visit-rating');
  setupStarPicker('visit-totonoi');

  document.getElementById('visit-photos').addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      currentPhotos.push({ blob: file, url, name: file.name });
    });
    e.target.value = '';
    renderPhotoPreview();
  });

  document.getElementById('photo-lightbox').addEventListener('click', () => {
    document.getElementById('photo-lightbox').classList.add('hidden');
  });
}

function setupStarPicker(elId) {
  const el = document.getElementById(elId);
  el.querySelectorAll('span').forEach((span) => {
    span.addEventListener('click', () => {
      const val = Number(span.dataset.star);
      const current = Number(el.dataset.value);
      const newVal = current === val ? 0 : val; // クリックで解除も可能
      el.dataset.value = newVal;
      updateStarDisplay(el);
    });
  });
}

function updateStarDisplay(el) {
  const val = Number(el.dataset.value);
  el.querySelectorAll('span').forEach((span) => {
    span.classList.toggle('filled', Number(span.dataset.star) <= val);
  });
}

function populateSaunaSelect(selectEl, withAllOption = false) {
  const currentVal = selectEl.value;
  const opts = saunas
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
    .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
    .join('');
  selectEl.innerHTML = (withAllOption ? '<option value="">すべての施設</option>' : '<option value="">選択してください</option>') + opts;
  if (currentVal) selectEl.value = currentVal;
}

function renderVisitList(filterSaunaId = '') {
  const container = document.getElementById('visit-list');
  let list = visits.slice();
  if (filterSaunaId) list = list.filter((v) => v.saunaId === Number(filterSaunaId));
  list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (!list.length) {
    container.innerHTML = `<div class="empty-state">${visits.length ? '該当する訪問記録がありません' : 'まだ訪問記録がありません。「＋ 訪問記録を追加」から始めましょう。'}</div>`;
    return;
  }
  container.innerHTML = list.map((v) => visitCardHtml(v, true)).join('');
  attachVisitCardHandlers(container);
}

function visitCardHtml(v, showSaunaName) {
  const s = saunaById(v.saunaId);
  const thumbs = (v.photos || [])
    .map((p) => `<img src="${URL.createObjectURL(p.blob)}" alt="${escapeHtml(p.name || '')}">`)
    .join('');
  return `
    <div class="visit-card" data-id="${v.id}">
      <div class="visit-top">
        ${showSaunaName ? `<span class="visit-sauna-name">${escapeHtml(s ? s.name : '（削除された施設）')}</span>` : '<span></span>'}
        <span class="visit-date">${formatDate(v.date)}</span>
      </div>
      <div class="stars">${v.rating ? starString(v.rating) : ''} ${v.totonoi ? '　整い ' + starString(v.totonoi, 5, '♨', '・') : ''}</div>
      <div class="visit-temps">${v.saunaTemp ? 'サウナ ' + v.saunaTemp + '℃　' : ''}${v.waterTemp ? '水風呂 ' + v.waterTemp + '℃　' : ''}${v.duration ? '滞在 ' + v.duration + '分' : ''}</div>
      ${v.memo ? `<p class="visit-memo">${escapeHtml(v.memo)}</p>` : ''}
      ${thumbs ? `<div class="visit-thumbs">${thumbs}</div>` : ''}
    </div>`;
}

function attachVisitCardHandlers(container) {
  container.querySelectorAll('.visit-card').forEach((card) => {
    card.querySelectorAll('.visit-thumbs img').forEach((img) => {
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('lightbox-img').src = img.src;
        document.getElementById('photo-lightbox').classList.remove('hidden');
      });
    });
    card.addEventListener('click', () => openVisitModal(Number(card.dataset.id)));
  });
}

function openVisitModal(id = null, presetSaunaId = null) {
  if (!saunas.length) {
    showToast('先に施設を登録してください');
    return;
  }
  revokeCurrentPhotoUrls();
  currentPhotos = [];

  const selectEl = document.getElementById('visit-sauna-select');
  populateSaunaSelect(selectEl, false);

  document.getElementById('visit-modal-title').textContent = id ? '訪問記録を編集' : '訪問記録を追加';
  document.getElementById('visit-id').value = id || '';

  const v = id ? visits.find((x) => x.id === id) : null;
  selectEl.value = v ? v.saunaId : presetSaunaId || '';
  document.getElementById('visit-date').value = v ? v.date : new Date().toISOString().slice(0, 10);
  document.getElementById('visit-sauna-temp').value = v && v.saunaTemp != null ? v.saunaTemp : '';
  document.getElementById('visit-water-temp').value = v && v.waterTemp != null ? v.waterTemp : '';
  document.getElementById('visit-duration').value = v && v.duration != null ? v.duration : '';
  document.getElementById('visit-memo').value = v ? v.memo || '' : '';

  const ratingEl = document.getElementById('visit-rating');
  ratingEl.dataset.value = v ? v.rating || 0 : 0;
  updateStarDisplay(ratingEl);
  const totonoiEl = document.getElementById('visit-totonoi');
  totonoiEl.dataset.value = v ? v.totonoi || 0 : 0;
  updateStarDisplay(totonoiEl);

  if (v && v.photos) {
    currentPhotos = v.photos.map((p) => ({ blob: p.blob, url: URL.createObjectURL(p.blob), name: p.name }));
  }
  renderPhotoPreview();

  document.getElementById('btn-delete-visit').classList.toggle('hidden', !id);
  document.getElementById('visit-modal').classList.remove('hidden');
}

function renderPhotoPreview() {
  const container = document.getElementById('visit-photo-preview');
  container.innerHTML = currentPhotos
    .map((p, i) => `<div class="thumb-wrap"><img src="${p.url}"><button type="button" class="remove-photo" data-idx="${i}">×</button></div>`)
    .join('');
  container.querySelectorAll('.remove-photo').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      URL.revokeObjectURL(currentPhotos[idx].url);
      currentPhotos.splice(idx, 1);
      renderPhotoPreview();
    });
  });
}

function revokeCurrentPhotoUrls() {
  currentPhotos.forEach((p) => URL.revokeObjectURL(p.url));
}

function closeVisitModal() {
  revokeCurrentPhotoUrls();
  currentPhotos = [];
  document.getElementById('visit-modal').classList.add('hidden');
}

async function saveVisit() {
  const saunaId = Number(document.getElementById('visit-sauna-select').value);
  if (!saunaId) {
    showToast('施設を選択してください');
    return;
  }
  const id = document.getElementById('visit-id').value;
  const data = {
    saunaId,
    date: document.getElementById('visit-date').value || new Date().toISOString().slice(0, 10),
    rating: Number(document.getElementById('visit-rating').dataset.value) || 0,
    totonoi: Number(document.getElementById('visit-totonoi').dataset.value) || 0,
    saunaTemp: document.getElementById('visit-sauna-temp').value ? Number(document.getElementById('visit-sauna-temp').value) : null,
    waterTemp: document.getElementById('visit-water-temp').value ? Number(document.getElementById('visit-water-temp').value) : null,
    duration: document.getElementById('visit-duration').value ? Number(document.getElementById('visit-duration').value) : null,
    memo: document.getElementById('visit-memo').value.trim(),
    photos: currentPhotos.map((p) => ({ blob: p.blob, name: p.name })),
  };
  if (id) {
    data.id = Number(id);
    const existing = visits.find((x) => x.id === data.id);
    data.createdAt = existing ? existing.createdAt : new Date().toISOString();
    await DB.updateVisit(data);
    showToast('訪問記録を更新しました');
  } else {
    await DB.addVisit(data);
    showToast('訪問記録を追加しました');
  }
  await reloadData();
  closeVisitModal();
  renderAll();
  if (currentDetailSaunaId) openFacilityDetail(currentDetailSaunaId);
}

async function deleteVisitRecord(id) {
  await DB.deleteVisit(id);
  await reloadData();
  closeVisitModal();
  renderAll();
  if (currentDetailSaunaId) openFacilityDetail(currentDetailSaunaId);
  showToast('訪問記録を削除しました');
}

// ================= カレンダー =================
function setupCalendarUI() {
  document.getElementById('btn-cal-prev').addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById('btn-cal-next').addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    renderCalendar();
  });
}

function dateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  document.getElementById('calendar-month-label').textContent = `${year}年 ${month + 1}月`;

  const visitsByDate = {};
  visits.forEach((v) => {
    if (!v.date) return;
    (visitsByDate[v.date] = visitsByDate[v.date] || []).push(v);
  });

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = dateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  const grid = document.getElementById('calendar-grid');
  let html = '';
  for (let i = 0; i < firstDayOfWeek; i++) {
    html += '<div class="calendar-day empty"></div>';
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = dateKey(year, month, d);
    const dayVisits = visitsByDate[key] || [];
    const classes = ['calendar-day'];
    if (key === todayKey) classes.push('today');
    if (key === selectedCalendarDate) classes.push('selected');
    html += `
      <div class="${classes.join(' ')}" data-date="${key}">
        <span>${d}</span>
        ${dayVisits.length ? `<span class="visit-count">${dayVisits.length}件</span>` : ''}
      </div>`;
  }
  grid.innerHTML = html;

  grid.querySelectorAll('.calendar-day:not(.empty)').forEach((cell) => {
    cell.addEventListener('click', () => {
      selectedCalendarDate = cell.dataset.date === selectedCalendarDate ? null : cell.dataset.date;
      renderCalendar();
    });
  });

  renderCalendarDayPanel(visitsByDate);
}

function renderCalendarDayPanel(visitsByDate) {
  const panel = document.getElementById('calendar-day-panel');
  if (!selectedCalendarDate) {
    panel.innerHTML = '';
    return;
  }
  const dayVisits = (visitsByDate || {})[selectedCalendarDate] || [];
  const label = formatDate(selectedCalendarDate);
  if (!dayVisits.length) {
    panel.innerHTML = `<h3>${label}</h3><div class="empty-state">この日の訪問記録はありません</div>`;
    return;
  }
  panel.innerHTML = `<h3>${label}</h3><div class="visit-list">${dayVisits.map((v) => visitCardHtml(v, true)).join('')}</div>`;
  attachVisitCardHandlers(panel);
}

// ================= 統計 =================
function renderStats() {
  const totalVisits = visits.length;
  const uniqueFacilities = new Set(visits.map((v) => v.saunaId)).size;
  const avg = avgRating(visits);

  document.getElementById('stat-summary').innerHTML = `
    <div class="stat-card"><div class="value">${totalVisits}</div><div class="label">総訪問回数</div></div>
    <div class="stat-card"><div class="value">${uniqueFacilities}</div><div class="label">訪問した施設数</div></div>
    <div class="stat-card"><div class="value">${saunas.length}</div><div class="label">登録施設数</div></div>
    <div class="stat-card"><div class="value">${avg ? avg.toFixed(1) : '-'}</div><div class="label">平均評価</div></div>
  `;

  renderRankingChart();
  renderMonthlyChart();
  renderRatingChart();
}

function renderRankingChart() {
  const el = document.getElementById('chart-ranking');
  if (!visits.length) {
    el.innerHTML = '<div class="empty-state">データがありません</div>';
    return;
  }
  const counts = {};
  visits.forEach((v) => { counts[v.saunaId] = (counts[v.saunaId] || 0) + 1; });
  const rows = Object.entries(counts)
    .map(([id, c]) => ({ name: (saunaById(Number(id)) || {}).name || '（削除済み）', count: c }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  el.innerHTML = barChartSvg(rows.map((r) => r.name), rows.map((r) => r.count), 'var(--primary)', { rotateLabels: true });
}

function renderMonthlyChart() {
  const el = document.getElementById('chart-monthly');
  if (!visits.length) {
    el.innerHTML = '<div class="empty-state">データがありません</div>';
    return;
  }
  const counts = {};
  visits.forEach((v) => {
    const ym = (v.date || '').slice(0, 7);
    if (!ym) return;
    counts[ym] = (counts[ym] || 0) + 1;
  });
  const months = Object.keys(counts).sort();
  // 直近12ヶ月に絞る
  const recent = months.slice(-12);
  el.innerHTML = barChartSvg(recent.map((m) => m.slice(2).replace('-', '/')), recent.map((m) => counts[m]), 'var(--accent)');
}

function renderRatingChart() {
  const el = document.getElementById('chart-rating');
  const rated = visits.filter((v) => v.rating);
  if (!rated.length) {
    el.innerHTML = '<div class="empty-state">評価データがありません</div>';
    return;
  }
  const counts = [1, 2, 3, 4, 5].map((r) => rated.filter((v) => v.rating === r).length);
  el.innerHTML = barChartSvg(['★1', '★2', '★3', '★4', '★5'], counts, 'var(--star)');
}

function truncateLabel(label, maxChars = 5) {
  const str = String(label);
  return str.length > maxChars ? str.slice(0, maxChars) + '…' : str;
}

function barChartSvg(labels, values, color, options = {}) {
  const { rotateLabels = false } = options;
  const slot = rotateLabels ? 70 : 60;
  const w = Math.max(320, labels.length * slot);
  const h = rotateLabels ? 240 : 220;
  const padBottom = rotateLabels ? 70 : 50;
  const padTop = 16;
  const max = Math.max(...values, 1);
  const barW = slot * 0.6;
  const gap = slot * 0.4;

  const bars = values
    .map((v, i) => {
      const barH = ((h - padBottom - padTop) * v) / max;
      const x = i * (barW + gap) + gap / 2;
      const y = h - padBottom - barH;
      const cx = x + barW / 2;
      const label = rotateLabels
        ? `<text x="${cx}" y="${h - padBottom + 14}" text-anchor="end" font-size="11" fill="currentColor" transform="rotate(-40 ${cx} ${h - padBottom + 14})"><title>${escapeHtml(String(labels[i]))}</title>${escapeHtml(truncateLabel(labels[i]))}</text>`
        : `<text x="${cx}" y="${h - padBottom + 18}" text-anchor="middle" font-size="11" fill="currentColor">${escapeHtml(String(labels[i]))}</text>`;
      return `
        <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="${color}"></rect>
        <text x="${cx}" y="${y - 6}" text-anchor="middle" font-size="12" fill="currentColor">${v}</text>
        ${label}
      `;
    })
    .join('');

  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="color:var(--muted); max-width:100%;">${bars}</svg>`;
}

// ================= エクスポート / インポート =================
function setupExportImport() {
  document.getElementById('btn-export').addEventListener('click', exportData);
  document.getElementById('btn-import-open').addEventListener('click', () => document.getElementById('btn-import').click());
  document.getElementById('btn-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importData(file);
    e.target.value = '';
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function base64ToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

async function exportData() {
  const saunasOut = saunas;
  const visitsOut = [];
  for (const v of visits) {
    const photos = [];
    for (const p of v.photos || []) {
      photos.push({ name: p.name, dataUrl: await blobToBase64(p.blob) });
    }
    visitsOut.push({ ...v, photos });
  }
  const payload = { exportedAt: new Date().toISOString(), saunas: saunasOut, visits: visitsOut };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sauna-log-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('データを書き出しました');
}

async function importData(file) {
  if (!confirm('JSONファイルを読み込みます。同じIDのデータは上書きされます。よろしいですか?')) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const importedSaunas = payload.saunas || [];
    const importedVisits = [];
    for (const v of payload.visits || []) {
      const photos = [];
      for (const p of v.photos || []) {
        photos.push({ name: p.name, blob: await base64ToBlob(p.dataUrl) });
      }
      importedVisits.push({ ...v, photos });
    }
    await DB.bulkAddSaunas(importedSaunas);
    await DB.bulkAddVisits(importedVisits);
    await reloadData();
    renderAll();
    showToast('データを読み込みました');
  } catch (err) {
    console.error(err);
    showToast('読み込みに失敗しました: ファイル形式を確認してください');
  }
}
