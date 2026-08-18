import { parseClusterInput, auditClusters } from './cluster-audit.js';
import { generateAuditTSV, downloadAuditExcelFile, copyToClipboard } from './export.js';
import { showToast } from './render.js';
import { CONFIG } from './config.js';

let currentRawRecords = [];
let activeAuditResult = null;
let currentFilter = 'all';

// List opsi cluster populer ICONNET / Mataram
const CLUSTER_OPTIONS = [
  'SANDUBAYA',
  'AMPENAN',
  'MATARAM',
  'CAKRANEGARA',
  'SWETA',
  'LINGSAR',
  'NARMADA',
  'SEKARBELA',
  'GERUNG',
  'SENGGIGI',
  'PRAYA',
  'KUTA'
];

document.addEventListener('DOMContentLoaded', () => {
  const tabBtnPaste = document.getElementById('tab-btn-paste');
  const tabBtnFile = document.getElementById('tab-btn-file');
  const pasteInputContainer = document.getElementById('paste-input-container');
  const dropzoneContainer = document.getElementById('dropzone-container');

  const pasteInput = document.getElementById('paste-input');
  const btnAudit = document.getElementById('btn-audit');
  const fileInput = document.getElementById('file-input');
  const dropzone = document.getElementById('dropzone');
  const prefixInput = document.getElementById('prefix-input');

  const previewSection = document.getElementById('preview-section');
  const auditAlertContainer = document.getElementById('audit-alert-container');
  const statsContainer = document.getElementById('stats-container');
  const tableContainer = document.getElementById('table-container');

  const btnCopySheet = document.getElementById('btn-copy-sheet');
  const btnDownloadXlsx = document.getElementById('btn-download-xlsx');
  const filterBtns = document.querySelectorAll('.filter-btn');

  if (prefixInput) prefixInput.value = CONFIG.DEFAULT_PREFIX;

  // --- Tab Switching Logic ---
  if (tabBtnPaste && tabBtnFile) {
    tabBtnPaste.addEventListener('click', () => {
      tabBtnPaste.classList.add('active');
      tabBtnFile.classList.remove('active');
      pasteInputContainer.style.display = 'block';
      dropzoneContainer.style.display = 'none';
    });

    tabBtnFile.addEventListener('click', () => {
      tabBtnFile.classList.add('active');
      tabBtnPaste.classList.remove('active');
      dropzoneContainer.style.display = 'block';
      pasteInputContainer.style.display = 'none';
    });
  }

  // --- 1. Event Handler Paste Input ---
  if (btnAudit && pasteInput) {
    btnAudit.addEventListener('click', () => {
      const rawText = pasteInput.value.trim();
      if (!rawText) {
        alert('Silakan tempel (paste) data tabel Excel terlebih dahulu!');
        return;
      }

      const prefix = (prefixInput.value || CONFIG.DEFAULT_PREFIX).trim();
      currentRawRecords = parseClusterInput(rawText, prefix);

      if (currentRawRecords.length === 0) {
        alert(`Tidak ada Kode FAT yang sesuai dengan prefix '${prefix}' dalam teks input.`);
        return;
      }

      performAuditAndUpdateUI();
      showToast(`Berhasil mengaudit ${currentRawRecords.length} Kode FAT!`);
    });
  }

  // --- 2. Event Handler File Upload ---
  if (fileInput && dropzone) {
    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        processUploadedExcel(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        processUploadedExcel(e.target.files[0]);
      }
    });
  }

  function processUploadedExcel(file) {
    if (!window.XLSX) {
      alert('Library SheetJS (xlsx) belum dimuat. Pastikan terhubung ke internet.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const prefix = (prefixInput.value || CONFIG.DEFAULT_PREFIX).trim();

        if (workbook.SheetNames.length === 0) {
          alert('File Excel kosong.');
          return;
        }

        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = window.XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false, defval: '' });

        currentRawRecords = parseClusterInput(rawRows, prefix);

        if (currentRawRecords.length === 0) {
          alert(`Tidak ada Kode FAT yang cocok dengan prefix '${prefix}' ditemukan dalam file Excel ini.`);
          return;
        }

        performAuditAndUpdateUI();
        showToast(`Berhasil membaca file ${file.name} (${currentRawRecords.length} Kode FAT)!`);

      } catch (err) {
        console.error('File Excel read error:', err);
        alert('Gagal memproses file Excel: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // --- Audit Execution & UI Refresh ---
  function performAuditAndUpdateUI() {
    activeAuditResult = auditClusters(currentRawRecords);
    previewSection.style.display = 'block';

    renderAuditBanner(activeAuditResult);
    renderAuditStats(activeAuditResult);
    renderAuditTable(activeAuditResult, currentFilter);

    previewSection.scrollIntoView({ behavior: 'smooth' });
  }

  // --- Render Audit Summary Banner ---
  function renderAuditBanner(result) {
    if (!auditAlertContainer) return;

    const { dominantCluster, totalRows, validCount, mismatchCount, summaryRemarks, mismatchedRecords } = result;
    const isSuccess = mismatchCount === 0;

    let html = `
      <div class="audit-alert-box ${isSuccess ? 'success' : 'warning'}">
        <div class="audit-alert-header">
          <span class="material-symbols-outlined">${isSuccess ? 'check_circle' : 'warning'}</span>
          <span>${isSuccess ? 'Validasi Cluster Sempurna!' : 'Perhatian: Ditemukan Perbedaan Cluster'}</span>
        </div>
        <div class="audit-alert-body">
          ${escapeHtml(summaryRemarks)}
        </div>
    `;

    if (mismatchedRecords && mismatchedRecords.length > 0) {
      html += `<div style="font-size:12.5px; font-weight:700; color:var(--text-secondary); margin-top:8px;">Kode FAT yang Salah Cluster:</div>`;
      html += `<div class="audit-mismatch-list">`;
      mismatchedRecords.forEach(m => {
        html += `
          <span class="mismatch-chip" title="Cluster Input: ${escapeHtml(m.currentCluster)} → Ekspektasi: ${escapeHtml(m.expectedCluster)}">
            <span class="material-symbols-outlined" style="font-size:14px;">error</span>
            <strong>${escapeHtml(m.fatId)}</strong> (${escapeHtml(m.position)}: ${escapeHtml(m.currentCluster)})
          </span>
        `;
      });
      html += `</div>`;
    }

    html += `</div>`;
    auditAlertContainer.innerHTML = html;
  }

  // --- Render Audit Summary Cards ---
  function renderAuditStats(result) {
    if (!statsContainer) return;

    const { dominantCluster, totalRows, validCount, mismatchCount } = result;

    statsContainer.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Data FAT</div>
          <div class="stat-value">${totalRows}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Cluster Mayoritas</div>
          <div class="stat-value" style="font-size:18px; color:var(--brand-primary);">${escapeHtml(dominantCluster)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Sesuai (OK)</div>
          <div class="stat-value normal">${validCount}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Perbedaan Cluster</div>
          <div class="stat-value problem">${mismatchCount}</div>
        </div>
      </div>
    `;
  }

  // --- Render Interactive Data Table ---
  function renderAuditTable(result, filterMode = 'all') {
    if (!tableContainer) return;

    let records = result.auditedRecords || [];

    if (filterMode === 'mismatch') {
      records = records.filter(r => r.validation === 'PERBEDAAN');
    } else if (filterMode === 'valid') {
      records = records.filter(r => r.validation === 'OK');
    }

    if (records.length === 0) {
      tableContainer.innerHTML = `<div style="padding:32px; text-align:center; color: var(--text-muted);">Tidak ada data yang cocok dengan filter '${filterMode}'.</div>`;
      return;
    }

    let html = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 50px; text-align: center;">Skip</th>
              <th>Kode FAT</th>
              <th>Status</th>
              <th>Cluster *</th>
              <th>Validasi</th>
              <th>Posisi Urutan</th>
            </tr>
          </thead>
          <tbody>
    `;

    records.forEach(rec => {
      const isMismatch = rec.validation === 'PERBEDAAN';
      const rowClass = isMismatch ? 'mismatch-row' : '';

      // Opsi dropdown Cluster
      let clusterOptionsHtml = '';
      const currentClusterUpper = (rec.cluster || '').trim().toUpperCase();

      // Tambahkan cluster saat ini jika belum ada di opsi standar
      const optionsList = [...CLUSTER_OPTIONS];
      if (currentClusterUpper && !optionsList.includes(currentClusterUpper)) {
        optionsList.unshift(currentClusterUpper);
      }

      optionsList.forEach(opt => {
        const isSelected = opt.toUpperCase() === currentClusterUpper ? 'selected' : '';
        clusterOptionsHtml += `<option value="${escapeHtml(opt)}" ${isSelected}>${escapeHtml(opt)}</option>`;
      });

      const validationBadge = rec.skip
        ? `<span class="badge badge-empty">SKIPPED</span>`
        : isMismatch
          ? `<span class="badge-valid-mismatch"><span class="material-symbols-outlined" style="font-size:14px;">error</span> PERBEDAAN</span>`
          : `<span class="badge-valid-ok"><span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> OK</span>`;

      html += `
        <tr class="${rowClass}">
          <td style="text-align: center;">
            <input type="checkbox" class="audit-skip-checkbox" data-id="${rec.id}" ${rec.skip ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: var(--brand-primary); cursor: pointer;">
          </td>
          <td class="fat-cell">${escapeHtml(rec.fatId)}</td>
          <td><span class="badge badge-online">${escapeHtml(rec.status || 'Aktif')}</span></td>
          <td>
            <select class="select-cluster audit-cluster-select" data-id="${rec.id}">
              ${clusterOptionsHtml}
            </select>
          </td>
          <td>${validationBadge}</td>
          <td><span class="badge-position">${escapeHtml(rec.position || '-')}</span></td>
        </tr>
      `;
    });

    html += `</tbody></table></div>`;
    tableContainer.innerHTML = html;

    // Attach Event Listeners pada Checkbox & Dropdown Select
    attachTableInteractions();
  }

  // --- Attach Table Interaction Handlers ---
  function attachTableInteractions() {
    // 1. Skip Checkbox
    const checkboxes = tableContainer.querySelectorAll('.audit-skip-checkbox');
    checkboxes.forEach(chk => {
      chk.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        const targetRec = currentRawRecords.find(r => r.id === id);
        if (targetRec) {
          targetRec.skip = e.target.checked;
          performAuditAndUpdateUI();
        }
      });
    });

    // 2. Cluster Select Dropdown
    const selects = tableContainer.querySelectorAll('.audit-cluster-select');
    selects.forEach(sel => {
      sel.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        const newCluster = e.target.value;
        const targetRec = currentRawRecords.find(r => r.id === id);
        if (targetRec) {
          targetRec.cluster = newCluster;
          performAuditAndUpdateUI();
          showToast(`Cluster untuk ${targetRec.fatId} diubah menjadi ${newCluster}`);
        }
      });
    });
  }

  // --- Action Buttons & Filter Handlers ---
  if (btnCopySheet) {
    btnCopySheet.addEventListener('click', async () => {
      if (!activeAuditResult) return;
      const tsvText = generateAuditTSV(activeAuditResult);
      const success = await copyToClipboard(tsvText);
      if (success) {
        showToast('Data hasil audit disalin dalam format TSV (siap di-paste ke Excel)!');
      }
    });
  }

  if (btnDownloadXlsx) {
    btnDownloadXlsx.addEventListener('click', () => {
      if (!activeAuditResult) return;
      downloadAuditExcelFile(activeAuditResult, 'Hasil_Audit_Cluster_FAT');
      showToast('Unduhan file Hasil_Audit_Cluster_FAT.xlsx dimulai!');
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.getAttribute('data-filter');
      if (activeAuditResult) {
        renderAuditTable(activeAuditResult, currentFilter);
      }
    });
  });
});

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
