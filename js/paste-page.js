import { parseRawRows } from './parser.js';
import { generateMarkdown, generateTSV, copyToClipboard, downloadExcelFile } from './export.js';
import { renderSummaryStats, renderCategoryBreakdown, renderDataTable, showToast } from './render.js';
import { CONFIG } from './config.js';

let currentParsedData = null;

document.addEventListener('DOMContentLoaded', () => {
  const pasteArea = document.getElementById('paste-input');
  const prefixInput = document.getElementById('prefix-input');
  const dedupeCheckbox = document.getElementById('dedupe-checkbox');
  const btnParse = document.getElementById('btn-parse');
  
  const previewSection = document.getElementById('preview-section');
  const statsContainer = document.getElementById('stats-container');
  const breakdownContainer = document.getElementById('breakdown-container');
  const tableContainer = document.getElementById('table-container');

  const btnCopy = document.getElementById('btn-copy') || document.getElementById('btn-copy-md');
  const btnDownloadXlsx = document.getElementById('btn-download-xlsx') || document.getElementById('btn-download-md');

  const filterBtns = document.querySelectorAll('.filter-btn');

  if (!btnParse || !pasteArea) return;

  // Set default prefix
  if (prefixInput) prefixInput.value = CONFIG.DEFAULT_PREFIX;

  // Biarkan textarea menggunakan perilaku paste native browser.
  pasteArea.addEventListener('input', () => {
    if (pasteArea.value.trim().length > 0) {
      triggerParse(false);
    }
  });

  if (prefixInput) {
    prefixInput.addEventListener('input', () => {
      if (pasteArea.value.trim().length > 0) {
        triggerParse(false);
      }
    });
  }

  if (dedupeCheckbox) {
    dedupeCheckbox.addEventListener('change', () => {
      if (pasteArea.value.trim().length > 0) {
        triggerParse(false);
      }
    });
  }

  // Parse Button Click
  btnParse.addEventListener('click', () => {
    triggerParse(true);
  });

  // Trigger Parsing Process
  function triggerParse(showAlertOnEmpty = true) {
    const rawText = pasteArea.value;
    const prefix = (prefixInput.value || CONFIG.DEFAULT_PREFIX).trim();
    const isDeduplicate = dedupeCheckbox ? dedupeCheckbox.checked : true;

    if (!rawText.trim()) {
      if (showAlertOnEmpty) {
        alert('Silakan tempel (paste) data mentah dari Excel terlebih dahulu!');
      }
      previewSection.style.display = 'none';
      return;
    }

    // Split text into 2D Matrix (lines by \n, columns by \t)
    const lines = rawText.split(/\r?\n/);
    const rows = lines.map(line => line.split('\t'));

    currentParsedData = parseRawRows(rows, prefix, { deduplicate: isDeduplicate });

    // Show Preview Section
    previewSection.style.display = 'block';

    // Render Components
    renderSummaryStats(statsContainer, currentParsedData);
    renderCategoryBreakdown(breakdownContainer, currentParsedData);
    renderDataTable(tableContainer, currentParsedData, 'all');

    if (showAlertOnEmpty) {
      previewSection.scrollIntoView({ behavior: 'smooth' });
      showToast('Data berhasil diparsing!');
    }
  }

  // Copy TSV Handler
  if (btnCopy) {
    btnCopy.addEventListener('click', async () => {
      if (!currentParsedData) return;
      const tsvText = generateTSV(currentParsedData);
      const success = await copyToClipboard(tsvText);
      if (success) {
        showToast('Data TSV disalin ke clipboard (siap di-paste ke Excel)!');
      } else {
        alert('Gagal menyalin ke clipboard.');
      }
    });
  }

  // Download Excel (.xlsx) Handler
  if (btnDownloadXlsx) {
    btnDownloadXlsx.addEventListener('click', () => {
      if (!currentParsedData) return;
      downloadExcelFile(currentParsedData, 'Monitoring_ICONNET_Kode_FAT');
      showToast('File Excel (.xlsx) berhasil di-download!');
    });
  }

  // Table Filter Handler
  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const mode = e.target.getAttribute('data-filter');
      if (currentParsedData) {
        renderDataTable(tableContainer, currentParsedData, mode);
      }
    });
  });
});
