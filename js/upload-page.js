import { parseRawRows } from './parser.js';
import { generateMarkdown, generateTSV, copyToClipboard, downloadExcelFile, downloadAllSheetsAsExcel } from './export.js';
import { renderSummaryStats, renderCategoryBreakdown, renderDataTable, showToast } from './render.js';
import { CONFIG } from './config.js';

let activeWorkbookSheets = []; // Array of { sheetName, parsedData, markdown }
let activeSheetIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('file-input');
  const dropzone = document.getElementById('dropzone');
  const prefixInput = document.getElementById('prefix-input');
  const dedupeCheckbox = document.getElementById('dedupe-checkbox');

  const previewSection = document.getElementById('preview-section');
  const tabsContainer = document.getElementById('tabs-container');
  const statsContainer = document.getElementById('stats-container');
  const breakdownContainer = document.getElementById('breakdown-container');
  const tableContainer = document.getElementById('table-container');

  const btnCopySheet = document.getElementById('btn-copy-sheet');
  const btnDownloadXlsx = document.getElementById('btn-download-xlsx') || document.getElementById('btn-download-sheet');
  const btnDownloadAllXlsx = document.getElementById('btn-download-all-xlsx') || document.getElementById('btn-download-zip');

  const currentSheetTitle = document.getElementById('current-sheet-title');
  const filterBtns = document.querySelectorAll('.filter-btn');

  let currentFile = null;

  if (!fileInput || !dropzone) return;

  if (prefixInput) prefixInput.value = CONFIG.DEFAULT_PREFIX;

  // File Input Change
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      currentFile = e.target.files[0];
      processFile(currentFile);
    }
  });

  if (dedupeCheckbox) {
    dedupeCheckbox.addEventListener('change', () => {
      if (currentFile) {
        processFile(currentFile);
      }
    });
  }

  // Drag & Drop Handlers
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
      currentFile = e.dataTransfer.files[0];
      processFile(currentFile);
    }
  });

  // Process File with SheetJS
  function processFile(file) {
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
        const isDeduplicate = dedupeCheckbox ? dedupeCheckbox.checked : true;

        activeWorkbookSheets = [];

        // Loop through all sheets in workbook
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          // Convert sheet to 2D string matrix
          const rawRows = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
          
          // Parse sheet independently
          const parsedData = parseRawRows(rawRows, prefix, { deduplicate: isDeduplicate });
          const markdown = generateMarkdown(parsedData, sheetName);

          activeWorkbookSheets.push({
            sheetName,
            parsedData,
            markdown
          });
        });

        if (activeWorkbookSheets.length === 0) {
          alert('Tidak ada sheet data yang ditemukan dalam file Excel ini.');
          return;
        }

        // Show Preview Section
        previewSection.style.display = 'block';
        activeSheetIndex = 0;

        renderTabs();
        renderActiveSheet();

        previewSection.scrollIntoView({ behavior: 'smooth' });
        showToast(`Berhasil membaca ${activeWorkbookSheets.length} sheet!`);

      } catch (err) {
        console.error('File parsing error:', err);
        alert('Gagal memproses file Excel: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // Render Tabs per Sheet
  function renderTabs() {
    tabsContainer.innerHTML = '';
    activeWorkbookSheets.forEach((item, index) => {
      const btn = document.createElement('button');
      btn.className = `tab-btn ${index === activeSheetIndex ? 'active' : ''}`;
      btn.innerHTML = `📄 ${item.sheetName} (${item.parsedData.totalOnt} Kode)`;
      btn.addEventListener('click', () => {
        activeSheetIndex = index;
        renderTabs();
        renderActiveSheet();
      });
      tabsContainer.appendChild(btn);
    });
  }

  // Render Active Sheet Details
  function renderActiveSheet() {
    const current = activeWorkbookSheets[activeSheetIndex];
    if (!current) return;

    if (currentSheetTitle) {
      currentSheetTitle.textContent = `Sheet: ${current.sheetName}`;
    }

    renderSummaryStats(statsContainer, current.parsedData);
    renderCategoryBreakdown(breakdownContainer, current.parsedData);
    renderDataTable(tableContainer, current.parsedData, 'all');
  }

  // Copy TSV per Sheet Handler
  if (btnCopySheet) {
    btnCopySheet.addEventListener('click', async () => {
      const current = activeWorkbookSheets[activeSheetIndex];
      if (!current) return;
      const tsvText = generateTSV(current.parsedData);
      const success = await copyToClipboard(tsvText);
      if (success) {
        showToast(`Data TSV sheet "${current.sheetName}" disalin (siap di-paste ke Excel)!`);
      }
    });
  }

  // Download .xlsx per Sheet
  if (btnDownloadXlsx) {
    btnDownloadXlsx.addEventListener('click', () => {
      const current = activeWorkbookSheets[activeSheetIndex];
      if (!current) return;
      downloadExcelFile(current.parsedData, `${current.sheetName}_Kode_FAT`);
      showToast(`File ${current.sheetName}.xlsx berhasil di-download!`);
    });
  }

  // Download Semua Sheet sebagai Multi-Tab Workbook (.xlsx)
  if (btnDownloadAllXlsx) {
    btnDownloadAllXlsx.addEventListener('click', () => {
      if (activeWorkbookSheets.length === 0) return;
      downloadAllSheetsAsExcel(activeWorkbookSheets, 'ICONNET_Monitoring_Semua_Sheet');
      showToast('Mengunduh file Excel multi-sheet (.xlsx)...');
    });
  }

  // Table Filter Handler
  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const mode = e.target.getAttribute('data-filter');
      const current = activeWorkbookSheets[activeSheetIndex];
      if (current) {
        renderDataTable(tableContainer, current.parsedData, mode);
      }
    });
  });
});
