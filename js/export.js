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

  // --- MODE B: 1-Kolom List Kode (Tanpa Data Check) ---
  if (!hasChecks) {
    md += `## Detail Kode Aset (FAT → ONT)\n\n`;
    md += `| Kode Aset |\n`;
    md += `| --- |\n`;
    (groupedFats || []).forEach(group => {
      md += `| **\`${group.fatId}\`** |\n`;
      group.onts.forEach(ont => {
        md += `| \`${ont.ont_id}\` |\n`;
      });
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

  // --- MODE B: 1-Kolom List Kode Aset ---
  if (!hasChecks) {
    const lines = [];
    (groupedFats || []).forEach(group => {
      lines.push(group.fatId);
      group.onts.forEach(ont => {
        lines.push(ont.ont_id);
      });
    });
    return lines.join('\n');
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
