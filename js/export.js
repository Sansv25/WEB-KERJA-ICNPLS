/**
 * Export Utility Module for Markdown generation, Clipboard, and Zip archiving.
 */

/**
 * Generates formatted Markdown string from parsed sheet data.
 * @param {Object} parsedData - Data object from parseRawRows()
 * @param {string} sheetName - Title or Sheet Name
 * @returns {string} Markdown text
 */
export function generateMarkdown(parsedData, sheetName = 'Hasil Parsing') {
  const { totalFat, totalOnt, problemOntCount, normalOntCount, maxChecksCount, categoryBreakdown, topProblemFats, items, groupedFats } = parsedData;

  const timestamp = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  const hasChecks = (maxChecksCount || 0) > 0;

  let md = `# Laporan Monitoring Aset ICONNET — ${sheetName}\n\n`;
  md += `> **Tanggal Parsing:** ${timestamp}  \n`;
  md += `> **Prefix ID:** \`${parsedData.prefixUsed}\`  \n\n`;

  // --- MODE B: 1-Kolom List Kode Bersih (Tanpa Data Check) ---
  if (!hasChecks) {
    const flatCodes = parsedData.flatCodes || [];
    md += `## Detail Kode Aset (${parsedData.prefixUsed}...)\n\n`;
    md += `| Kode Aset |\n`;
    md += `| --- |\n`;
    flatCodes.forEach(code => {
      md += `| \`${code}\` |\n`;
    });
    md += `\n---\n*Di-generate secara otomatis oleh Web App Parsing Data Monitoring Aset ICONNET*\n`;
    return md;
  }

  // --- MODE A: Multi-Kolom Tabel (Ada Data Check) ---
  // 1. Ringkasan Statistik
  md += `## 1. Ringkasan Monitoring\n\n`;
  md += `| Metric | Jumlah |\n`;
  md += `| --- | --- |\n`;
  md += `| **Total FAT (ODP)** | ${totalFat} |\n`;
  md += `| **Total ONT Pelanggan** | ${totalOnt} |\n`;
  md += `| **ONT Bermasalah (Problem)** | **${problemOntCount}** |\n`;
  md += `| **ONT Normal** | ${normalOntCount} |\n\n`;

  // 2. Breakdown per Kategori
  md += `### Breakdown Status Check\n\n`;
  md += `| Kategori | Jumlah Sel |\n`;
  md += `| --- | --- |\n`;
  for (const [cat, count] of Object.entries(categoryBreakdown || {})) {
    if (count > 0 && cat !== 'empty') {
      md += `| ${cat.toUpperCase()} | ${count} |\n`;
    }
  }
  md += `\n`;

  // 3. Top FAT Bermasalah
  if (topProblemFats && topProblemFats.length > 0) {
    md += `### FAT dengan ONT Bermasalah Terbanyak\n\n`;
    md += `| FAT ID | Total ONT | Bermasalah |\n`;
    md += `| --- | --- | --- |\n`;
    topProblemFats.slice(0, 5).forEach(f => {
      md += `| \`${f.fatId}\` | ${f.totalOnt} | **${f.problemOnt}** |\n`;
    });
    md += `\n`;
  }

  // 4. Tabel Detail Data (FAT -> ONT)
  md += `## 2. Detail Data Monitoring\n\n`;
  
  // Header Columns
  let headers = ['FAT ID', 'ONT ID'];
  for (let i = 1; i <= maxChecksCount; i++) {
    headers.push(`Check ${i}`);
  }
  headers.push('Status');

  md += `| ${headers.join(' | ')} |\n`;
  md += `| ${headers.map(() => '---').join(' | ')} |\n`;

  // Table Rows
  items.forEach(item => {
    let rowVals = [`\`${item.fat_id}\``, `\`${item.ont_id}\``];
    for (let i = 0; i < maxChecksCount; i++) {
      const check = item.checks[i];
      if (check && check.raw_value) {
        if (check.isProblem) {
          rowVals.push(`**${check.raw_value}**`);
        } else {
          rowVals.push(check.raw_value);
        }
      } else {
        rowVals.push('-');
      }
    }
    rowVals.push(item.has_problem ? '⚠️ PROBLEM' : '✅ NORMAL');
    md += `| ${rowVals.join(' | ')} |\n`;
  });

  md += `\n---\n*Di-generate secara otomatis oleh Web App Parsing Data Monitoring Aset ICONNET*\n`;

  return md;
}

/**
 * Generates TSV string: Mode A (Multi-column TSV) or Mode B (1-column grouped code list).
 * @param {Object} parsedData - Data object from parseRawRows()
 * @returns {string} TSV text
 */
export function generateTSV(parsedData) {
  const { maxChecksCount, items, groupedFats } = parsedData;
  const hasChecks = (maxChecksCount || 0) > 0;

  // --- MODE B: 1-Kolom List Kode Aset Bersih ---
  if (!hasChecks) {
    const flatCodes = parsedData.flatCodes || [];
    return flatCodes.join('\n');
  }

  // --- MODE A: Multi-Kolom TSV ---
  const rows = [];

  // Header Row
  const headers = ['FAT ID', 'ONT ID'];
  for (let i = 1; i <= maxChecksCount; i++) {
    headers.push(`Check ${i}`);
  }
  headers.push('Status Risk');
  rows.push(headers.join('\t'));

  // Data Rows
  (items || []).forEach(item => {
    const rowVals = [item.fat_id, item.ont_id];
    for (let i = 0; i < maxChecksCount; i++) {
      const check = item.checks[i];
      rowVals.push(check ? check.raw_value : '');
    }
    rowVals.push(item.has_problem ? 'PROBLEM' : 'NORMAL');
    rows.push(rowVals.join('\t'));
  });

  return rows.join('\n');
}

/**
 * Copies text string to user clipboard.
 * @param {string} text 
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback execCommand for older environments
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Copy to clipboard failed:', err);
    return false;
  }
}

/**
 * Downloads a single text/markdown file in browser.
 * @param {string} filename 
 * @param {string} content 
 */
export function downloadMarkdownFile(filename, content) {
  const sanitizedFilename = sanitizeFilename(filename) + (filename.endsWith('.md') ? '' : '.md');
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  
  if (window.saveAs) {
    window.saveAs(blob, sanitizedFilename);
  } else {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = sanitizedFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }
}

/**
 * Downloads parsed dataset as a styled Excel (.xlsx) file.
 * Column A Row 1 header is 'Kode FAT' with background #FFC000 and bold text.
 * @param {Object} parsedData - Data object from parseRawRows()
 * @param {string} filename - Output filename (without extension)
 */
export function downloadExcelFile(parsedData, filename = 'Monitoring_ICONNET_Kode_FAT') {
  if (!window.XLSX) {
    alert('Library SheetJS (xlsx) belum dimuat. Pastikan terhubung ke internet.');
    return;
  }

  const { flatCodes, maxChecksCount, items } = parsedData;
  const hasChecks = (maxChecksCount || 0) > 0;
  const sanitizedFilename = sanitizeFilename(filename) + (filename.endsWith('.xlsx') ? '' : '.xlsx');

  const aoa = [];

  if (!hasChecks) {
    // Mode B: 1-Kolom Kode FAT Bersih
    aoa.push(['Kode FAT']);
    (flatCodes || []).forEach(code => {
      aoa.push([code]);
    });
  } else {
    // Mode A: Multi-Kolom Tabel
    const headers = ['Kode FAT', 'ONT ID'];
    for (let i = 1; i <= maxChecksCount; i++) {
      headers.push(`Check ${i}`);
    }
    headers.push('Status Risk');
    aoa.push(headers);

    (items || []).forEach(item => {
      const rowVals = [item.fat_id, item.ont_id];
      for (let i = 0; i < maxChecksCount; i++) {
        const check = item.checks[i];
        rowVals.push(check ? check.raw_value : '');
      }
      rowVals.push(item.has_problem ? 'PROBLEM' : 'NORMAL');
      aoa.push(rowVals);
    });
  }

  const ws = window.XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 28 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];

  // 1. Header (Baris 1 / r=0): Background Putih (#FFFFFF), Font Bold Hitam
  const headerCols = hasChecks ? (maxChecksCount + 3) : 1;
  for (let c = 0; c < headerCols; c++) {
    const cellRef = window.XLSX.utils.encode_cell({ r: 0, c: c });
    if (ws[cellRef]) {
      ws[cellRef].s = {
        fill: {
          patternType: 'solid',
          fgColor: { rgb: 'FFFFFF' }
        },
        font: {
          bold: true,
          color: { rgb: '000000' },
          sz: 11
        },
        alignment: {
          horizontal: 'center',
          vertical: 'center'
        }
      };
    }
  }

  // 2. Baris Kode-Kode FAT di bawahnya (Baris A2 ke bawah): Background Orange (#FFC000), Font Bold Hitam
  for (let r = 1; r < aoa.length; r++) {
    const cellRef = window.XLSX.utils.encode_cell({ r: r, c: 0 });
    if (ws[cellRef]) {
      ws[cellRef].s = {
        fill: {
          patternType: 'solid',
          fgColor: { rgb: 'FFC000' }
        },
        font: {
          bold: true,
          color: { rgb: '000000' },
          sz: 11
        },
        alignment: {
          horizontal: 'left',
          vertical: 'center'
        }
      };
    }
  }

  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'Kode FAT');
  window.XLSX.writeFile(wb, sanitizedFilename);
}

/**
 * Bundles multi-sheet parsed dataset into a single multi-tab .xlsx workbook.
 * @param {Array<{ sheetName: string, parsedData: Object }>} sheets 
 * @param {string} filename 
 */
export function downloadAllSheetsAsExcel(sheets, filename = 'Monitoring_ICONNET_Semua_Sheet.xlsx') {
  if (!window.XLSX) {
    alert('Library XLSX belum dimuat. Pastikan terhubung ke internet.');
    return;
  }

  const sanitizedFilename = sanitizeFilename(filename) + (filename.endsWith('.xlsx') ? '' : '.xlsx');
  const wb = window.XLSX.utils.book_new();

  sheets.forEach((s, idx) => {
    const { flatCodes, maxChecksCount, items } = s.parsedData;
    const hasChecks = (maxChecksCount || 0) > 0;
    const sheetTitle = sanitizeFilename(s.sheetName || `Sheet${idx + 1}`).substring(0, 30);

    const aoa = [];
    if (!hasChecks) {
      aoa.push(['Kode FAT']);
      (flatCodes || []).forEach(code => {
        aoa.push([code]);
      });
    } else {
      const headers = ['Kode FAT', 'ONT ID'];
      for (let i = 1; i <= maxChecksCount; i++) {
        headers.push(`Check ${i}`);
      }
      headers.push('Status Risk');
      aoa.push(headers);

      (items || []).forEach(item => {
        const rowVals = [item.fat_id, item.ont_id];
        for (let i = 0; i < maxChecksCount; i++) {
          const check = item.checks[i];
          rowVals.push(check ? check.raw_value : '');
        }
        rowVals.push(item.has_problem ? 'PROBLEM' : 'NORMAL');
        aoa.push(rowVals);
      });
    }

    const ws = window.XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 28 }, { wch: 25 }, { wch: 15 }, { wch: 15 }];

    // Header baris 1 putih
    const headerCols = hasChecks ? (maxChecksCount + 3) : 1;
    for (let c = 0; c < headerCols; c++) {
      const cellRef = window.XLSX.utils.encode_cell({ r: 0, c: c });
      if (ws[cellRef]) {
        ws[cellRef].s = {
          fill: {
            patternType: 'solid',
            fgColor: { rgb: 'FFFFFF' }
          },
          font: {
            bold: true,
            color: { rgb: '000000' },
            sz: 11
          },
          alignment: {
            horizontal: 'center',
            vertical: 'center'
          }
        };
      }
    }

    // Baris Kode FAT di Kolom A orange #FFC000
    for (let r = 1; r < aoa.length; r++) {
      const cellRef = window.XLSX.utils.encode_cell({ r: r, c: 0 });
      if (ws[cellRef]) {
        ws[cellRef].s = {
          fill: {
            patternType: 'solid',
            fgColor: { rgb: 'FFC000' }
          },
          font: {
            bold: true,
            color: { rgb: '000000' },
            sz: 11
          },
          alignment: {
            horizontal: 'left',
            vertical: 'center'
          }
        };
      }
    }

    window.XLSX.utils.book_append_sheet(wb, ws, sheetTitle);
  });

  window.XLSX.writeFile(wb, sanitizedFilename);
}

/**
 * Bundles multi-sheet markdown contents into a .zip archive and triggers download.
 * @param {Array<{ sheetName: string, markdown: string }>} sheets 
 * @param {string} zipName 
 */
export async function downloadAllAsZip(sheets, zipName = 'ICONNET_Monitoring_MD.zip') {
  if (!window.JSZip) {
    alert('Library JSZip belum dimuat. Pastikan terhubung ke internet.');
    return;
  }

  const zip = new window.JSZip();
  const folder = zip.folder('Monitoring_MD');

  sheets.forEach(s => {
    const fileName = sanitizeFilename(s.sheetName) + '.md';
    folder.file(fileName, s.markdown);
  });

  const content = await zip.generateAsync({ type: 'blob' });
  if (window.saveAs) {
    window.saveAs(content, zipName);
  } else {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = zipName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }
}

/**
 * Sanitizes filename to remove invalid characters
 */
export function sanitizeFilename(name) {
  return String(name || 'output')
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_');
}
