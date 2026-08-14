/**
 * DOM Rendering Engine for ICONNET Asset Monitoring Parser
 */

/**
 * Renders statistical cards (Total FAT, Total ONT, Problem, Normal)
 */
export function renderSummaryStats(containerEl, parsedData) {
  if (!containerEl) return;

  const { totalFat, totalOnt, problemOntCount, normalOntCount, maxChecksCount } = parsedData;

  const hasChecks = (maxChecksCount || 0) > 0;

  if (hasChecks) {
    containerEl.style.display = 'block';
    containerEl.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total FAT (ODP)</div>
          <div class="stat-value">${totalFat}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total ONT Pelanggan</div>
          <div class="stat-value">${totalOnt}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">ONT Bermasalah</div>
          <div class="stat-value problem">${problemOntCount}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">ONT Normal</div>
          <div class="stat-value normal">${normalOntCount}</div>
        </div>
      </div>
    `;
  } else {
    // Mode B: Skip Summary Panel sepenuhnya (tidak ada data status untuk direkap)
    containerEl.innerHTML = '';
    containerEl.style.display = 'none';
  }
}

/**
 * Renders breakdown badges per category
 */
export function renderCategoryBreakdown(containerEl, parsedData) {
  if (!containerEl) return;

  const { categoryBreakdown, maxChecksCount } = parsedData;
  if ((maxChecksCount || 0) === 0) {
    containerEl.innerHTML = '';
    containerEl.style.display = 'none';
    return;
  }

  containerEl.style.display = 'block';
  const catConfig = [
    { key: 'loss', label: 'Loss', badgeClass: 'badge-loss' },
    { key: 'offline', label: 'Offline', badgeClass: 'badge-offline' },
    { key: 'deaktif', label: 'Deaktif', badgeClass: 'badge-deaktif' },
    { key: 'suspend', label: 'Suspend', badgeClass: 'badge-suspend' },
    { key: 'anomali', label: 'Anomali', badgeClass: 'badge-anomali' },
    { key: 'redaman', label: 'Redaman (Info)', badgeClass: 'badge-redaman' },
    { key: 'online', label: 'Online/OK', badgeClass: 'badge-online' }
  ];

  let html = `<div class="breakdown-container">`;
  catConfig.forEach(cat => {
    const count = categoryBreakdown[cat.key] || 0;
    if (count > 0) {
      html += `<span class="badge ${cat.badgeClass}">${cat.label}: <strong>${count}</strong></span>`;
    }
  });
  html += `</div>`;

  containerEl.innerHTML = html;
}

/**
 * Renders structured data: Mode A (Multi-column Table) or Mode B (1-Column Code List)
 */
export function renderDataTable(containerEl, parsedData, filterMode = 'all') {
  if (!containerEl) return;

  const maxChecks = parsedData.maxChecksCount || 0;
  const hasChecks = maxChecks > 0;

  // Sembunyikan/Tampilkan filter bar jika di Mode B
  const filterControls = containerEl.previousElementSibling;
  if (filterControls && filterControls.querySelector('.filter-btn')) {
    filterControls.style.display = hasChecks ? 'flex' : 'none';
  }

  // --- MODE B: 1-Kolom List Sederhana (Tanpa Data Check) ---
  if (!hasChecks) {
    const groupedFats = parsedData.groupedFats || [];
    if (groupedFats.length === 0) {
      containerEl.innerHTML = `<div style="padding:32px; text-align:center; color: var(--text-muted);">Tidak ada data aset yang ditemukan.</div>`;
      return;
    }

    let html = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Kode Aset (FAT → ONT)</th>
            </tr>
          </thead>
          <tbody>
    `;

    groupedFats.forEach(group => {
      // Baris Grup FAT (Penanda visual beda)
      html += `
        <tr class="fat-group-header">
          <td style="font-weight: 800; background: rgba(2, 132, 199, 0.12); color: #38bdf8; font-size: 13.5px; border-bottom: 1px solid rgba(2, 132, 199, 0.2);">
            📁 ${escapeHtml(group.fatId)}
          </td>
        </tr>
      `;
      // Baris ONT di bawahnya dalam kolom yang sama
      group.onts.forEach(ont => {
        html += `
          <tr>
            <td style="padding-left: 32px; color: var(--text-primary);">
              └─ ${escapeHtml(ont.ont_id)}
            </td>
          </tr>
        `;
      });
    });

    html += `</tbody></table></div>`;
    containerEl.innerHTML = html;
    return;
  }

  // --- MODE A: Tabel Multi-Kolom (Ada Data Check) ---
  let items = parsedData.items || [];

  if (filterMode === 'problem') {
    items = items.filter(item => item.has_problem);
  } else if (filterMode === 'normal') {
    items = items.filter(item => !item.has_problem);
  }

  if (items.length === 0) {
    containerEl.innerHTML = `<div style="padding:32px; text-align:center; color: var(--text-muted);">Tidak ada data yang cocok untuk ditampilkan.</div>`;
    return;
  }

  let html = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>FAT ID</th>
            <th>ONT ID</th>
  `;

  for (let i = 1; i <= maxChecks; i++) {
    html += `<th>Check ${i}</th>`;
  }
  html += `<th>Status Risk</th></tr></thead><tbody>`;

  items.forEach(item => {
    const rowClass = item.has_problem ? 'has-problem' : '';
    html += `<tr class="${rowClass}">`;
    html += `<td class="fat-cell">${escapeHtml(item.fat_id)}</td>`;
    html += `<td>${escapeHtml(item.ont_id)}</td>`;

    for (let i = 0; i < maxChecks; i++) {
      const check = item.checks[i];
      if (check && check.raw_value) {
        html += `<td><span class="badge ${check.badgeClass}">${escapeHtml(check.raw_value)}</span></td>`;
      } else {
        html += `<td><span class="badge badge-empty">-</span></td>`;
      }
    }

    const statusBadge = item.has_problem
      ? `<span class="badge badge-loss">⚠️ PROBLEM</span>`
      : `<span class="badge badge-online">✅ NORMAL</span>`;

    html += `<td>${statusBadge}</td></tr>`;
  });

  html += `</tbody></table></div>`;
  containerEl.innerHTML = html;
}

/**
 * Displays brief toast feedback
 */
export function showToast(message, duration = 2500) {
  let toastEl = document.getElementById('toast-notification');
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'toast-notification';
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }

  toastEl.innerHTML = `<span>✨</span> <span>${escapeHtml(message)}</span>`;
  toastEl.classList.add('show');

  setTimeout(() => {
    toastEl.classList.remove('show');
  }, duration);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
