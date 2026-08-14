import { parseRawRows } from './parser.js';
import { generateMarkdown, generateTSV, copyToClipboard, downloadMarkdownFile } from './export.js';
import { renderSummaryStats, renderCategoryBreakdown, renderDataTable, showToast } from './render.js';
import { CONFIG } from './config.js';

let currentParsedData = null;

// Preset Data Contoh untuk Pengujian Instan
const SAMPLE_PASTE_DATA = `SPLT_MTRF027
SPLT_MTRA247	offline	-27.9
SPLT_MTRA248	-24.5	online
SPLT_MTRA249	los	-28.1
SPLT_MTRA250	deaktif	
SPLT_MTRF028
SPLT_MTRA301	-23.1	-22.9
SPLT_MTRA302	susspend 12/08	-29.0
SPLT_MTRA303	dying gasp	of
SPLT_MTRA304	-25.2	active`;

document.addEventListener('DOMContentLoaded', () => {
  const pasteArea = document.getElementById('paste-input');
  const prefixInput = document.getElementById('prefix-input');
  const btnParse = document.getElementById('btn-parse');
  const btnSample = document.getElementById('btn-sample');
  
  const previewSection = document.getElementById('preview-section');
  const statsContainer = document.getElementById('stats-container');
  const breakdownContainer = document.getElementById('breakdown-container');
  const tableContainer = document.getElementById('table-container');

  const btnCopy = document.getElementById('btn-copy') || document.getElementById('btn-copy-md');
  const btnDownload = document.getElementById('btn-download-md');

  const filterBtns = document.querySelectorAll('.filter-btn');

  if (!btnParse || !pasteArea) return;

  // Set default prefix
  if (prefixInput) prefixInput.value = CONFIG.DEFAULT_PREFIX;

  // Biarkan textarea menggunakan perilaku paste native browser.
  // Pindahkan logic auto-parse ke event listener 'input' setelah teks masuk ke textarea.
  pasteArea.addEventListener('input', () => {
    if (pasteArea.value.trim().length > 0) {
      triggerParse(false); // Parse tanpa alert jika dipicu dari input
    }
  });

  if (prefixInput) {
    prefixInput.addEventListener('input', () => {
      if (pasteArea.value.trim().length > 0) {
        triggerParse(false);
      }
    });
  }

  // Preset Sample Data Handler
  if (btnSample) {
    btnSample.addEventListener('click', () => {
      pasteArea.value = SAMPLE_PASTE_DATA;
      triggerParse(true);
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

    currentParsedData = parseRawRows(rows, prefix);

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

  // Download Markdown Handler
  if (btnDownload) {
    btnDownload.addEventListener('click', () => {
      if (!currentParsedData) return;
      const mdText = generateMarkdown(currentParsedData, 'Paste Data');
      downloadMarkdownFile('Monitoring_ICONNET_Paste.md', mdText);
      showToast('File Markdown berhasil di-download!');
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
