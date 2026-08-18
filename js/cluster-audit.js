/**
 * Module Engine Audit Cluster
 * Berfungsi untuk memparsing data cluster dan mengaudit kesesuaian cluster FAT/ONT.
 */

import { CONFIG } from './config.js';
import { sanitizeCellStr } from './parser.js';

/**
 * Memparsing input mentah (teks paste TSV/Excel atau 2D array SheetJS) menjadi array objek record FAT.
 * @param {string|Array<Array<string>>} input - Teks mentah atau 2D array
 * @param {string} customPrefix - Prefix ID FAT (default 'SPLT_')
 * @returns {Array<Object>} Records [{ id, fatId, status, cluster, skip, originalRowIndex }]
 */
export function parseClusterInput(input, customPrefix = CONFIG.DEFAULT_PREFIX) {
  const prefix = (customPrefix || CONFIG.DEFAULT_PREFIX).trim().toUpperCase();
  const knownStatuses = ['AKTIF', 'ONLINE', 'OFFLINE', 'LOSS', 'DEAKTIF', 'SUSPEND', 'NORMAL', 'PROBLEM'];
  const records = [];

  if (typeof input === 'string') {
    // === OPSI A: PARSING TEKS TEMPILAN (PASTE) ===
    // Bersihkan karakter tersembunyi
    const cleanStr = input.replace(/[\uFEFF\u200B\u200C\u200D\u00A0]/g, ' ');
    const rawTokens = cleanStr.split(/[\t\r\n]+/);
    const tokens = rawTokens.map(t => sanitizeCellStr(t)).filter(t => t !== '');

    if (tokens.length === 0) return [];

    // Cari semua indeks token yang diawali dengan Prefix (misal SPLT_)
    let fatIndices = [];
    tokens.forEach((t, idx) => {
      if (t.toUpperCase().startsWith(prefix)) {
        fatIndices.push(idx);
      }
    });

    // Fallback jika tidak ada yang persis diawali prefix, cari token yang tampak seperti Kode FAT
    if (fatIndices.length === 0) {
      tokens.forEach((t, idx) => {
        const u = t.toUpperCase();
        if (u.includes('MTRA') || u.includes('MTRF') || u.includes('SPLT') || u.includes('ODP') || /^[A-Z0-9_-]{6,}$/.test(u)) {
          fatIndices.push(idx);
        }
      });
    }

    if (fatIndices.length === 0) return [];

    // Ekstrak segmen data per Kode FAT
    for (let i = 0; i < fatIndices.length; i++) {
      const startIdx = fatIndices[i];
      const endIdx = (i + 1 < fatIndices.length) ? fatIndices[i + 1] : tokens.length;
      
      const fatId = tokens[startIdx];
      const segmentTokens = tokens.slice(startIdx + 1, endIdx);

      let status = 'Aktif';
      let cluster = '';

      segmentTokens.forEach(token => {
        const upper = token.toUpperCase();
        if (knownStatuses.includes(upper)) {
          status = token;
        } else if (
          upper !== 'OK' && 
          upper !== 'SKIP' && 
          upper !== 'VALIDATION' && 
          upper !== 'VALIDASI' && 
          upper !== 'KODE FAT' && 
          upper !== 'STATUS' && 
          upper !== 'CLUSTER' && 
          upper !== 'CLUSTER *' && 
          !cluster
        ) {
          cluster = token;
        }
      });

      records.push({
        id: `audit-${records.length + 1}`,
        fatId: fatId,
        status: status || 'Aktif',
        cluster: cluster || 'UNKNOWN',
        skip: false,
        originalRowIndex: i + 1
      });
    }

    return records;
  }

  // === OPSI B: PARSING 2D ARRAY SHEETJS (UPLOAD EXCEL) ===
  if (Array.isArray(input)) {
    for (let r = 0; r < input.length; r++) {
      const rawRow = input[r];
      if (!rawRow || !Array.isArray(rawRow)) continue;

      const row = rawRow.map(c => sanitizeCellStr(c)).filter(c => c !== '');
      if (row.length === 0) continue;

      // Cari sel yang merupakan fatId
      const fatCell = row.find(c => c.toUpperCase().startsWith(prefix));
      if (!fatCell) continue; // Abaikan baris header atau baris tanpa kode FAT

      const fatId = fatCell;
      const otherCells = row.filter(c => c !== fatCell);

      let status = 'Aktif';
      let cluster = '';

      otherCells.forEach(cell => {
        const upperCell = cell.toUpperCase();
        if (knownStatuses.includes(upperCell)) {
          status = cell;
        } else if (
          upperCell !== 'OK' && 
          upperCell !== 'SKIP' && 
          upperCell !== 'VALIDATION' && 
          upperCell !== 'VALIDASI' && 
          !cluster
        ) {
          cluster = cell;
        }
      });

      records.push({
        id: `audit-${records.length + 1}`,
        fatId: fatId,
        status: status || 'Aktif',
        cluster: cluster || 'UNKNOWN',
        skip: false,
        originalRowIndex: records.length + 1
      });
    }
  }

  return records;
}

/**
 * Melakukan Audit Cluster pada array record FAT:
 * - Menghitung cluster mayoritas (modus)
 * - Mengecek validasi tiap baris (OK vs PERBEDAAN)
 * - Menentukan posisi perbedaan (Sekitaran Atas, Sekitaran Tengah, Sekitaran Bawah)
 * - Menghasilkan rincian ringkasan & daftar Kode FAT yang salah
 * 
 * @param {Array<Object>} records - Array of records [{ fatId, status, cluster, skip }]
 * @returns {Object} Hasil audit lengkap
 */
export function auditClusters(records = []) {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      dominantCluster: '-',
      totalRows: 0,
      validCount: 0,
      mismatchCount: 0,
      summaryRemarks: 'Belum ada data untuk diaudit.',
      mismatchedRecords: [],
      positionSummary: { atas: [], tengah: [], bawah: [] },
      auditedRecords: []
    };
  }

  // Filter record yang tidak di-skip
  const activeRecords = records.filter(r => !r.skip && r.fatId);
  const totalRows = activeRecords.length;

  if (totalRows === 0) {
    return {
      dominantCluster: '-',
      totalRows: 0,
      validCount: 0,
      mismatchCount: 0,
      summaryRemarks: 'Semua baris di-skip atau tidak ada data.',
      mismatchedRecords: [],
      positionSummary: { atas: [], tengah: [], bawah: [] },
      auditedRecords: records
    };
  }

  // 1. Hitung frekuensi masing-masing cluster untuk menentukan modus (Cluster Mayoritas)
  const clusterCounts = {};
  activeRecords.forEach(rec => {
    const cName = (rec.cluster || '').trim().toUpperCase();
    if (cName && cName !== 'UNKNOWN') {
      clusterCounts[cName] = (clusterCounts[cName] || 0) + 1;
    }
  });

  let dominantCluster = '';
  let maxCount = 0;
  for (const [cName, count] of Object.entries(clusterCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantCluster = cName;
    }
  }

  if (!dominantCluster && activeRecords.length > 0) {
    dominantCluster = (activeRecords[0].cluster || 'UNKNOWN').trim().toUpperCase();
  }

  const mismatchedRecords = [];
  const positionSummary = {
    atas: [],
    tengah: [],
    bawah: []
  };

  let validCount = 0;
  let mismatchCount = 0;

  // 2. Evaluasi tiap baris dan tentukan posisinya (Atas, Tengah, Bawah)
  const auditedRecords = records.map((rec) => {
    if (rec.skip || !rec.fatId) {
      return {
        ...rec,
        validation: 'SKIPPED',
        position: '-'
      };
    }

    // Hitung posisi relatif dalam himpunan data aktif
    const activeIndex = activeRecords.indexOf(rec);
    const ratio = (activeIndex + 0.5) / totalRows;

    let position = 'Sekitaran Tengah';
    let posKey = 'tengah';
    if (ratio <= 0.3334) {
      position = 'Sekitaran Atas';
      posKey = 'atas';
    } else if (ratio >= 0.6667) {
      position = 'Sekitaran Bawah';
      posKey = 'bawah';
    }

    const currentClusterUpper = (rec.cluster || '').trim().toUpperCase();
    const isValid = currentClusterUpper === dominantCluster;

    if (isValid) {
      validCount++;
      return {
        ...rec,
        validation: 'OK',
        position: position
      };
    } else {
      mismatchCount++;
      const mismatchDetail = {
        fatId: rec.fatId,
        currentCluster: rec.cluster || '(Kosong)',
        expectedCluster: dominantCluster,
        position: position,
        rowIndex: rec.originalRowIndex || (activeIndex + 1)
      };
      
      mismatchedRecords.push(mismatchDetail);
      positionSummary[posKey].push(rec.fatId);

      return {
        ...rec,
        validation: 'PERBEDAAN',
        position: position
      };
    }
  });

  // 3. Buat kalimat Keterangan Ringkasan (Remarks)
  let summaryRemarks = '';
  if (mismatchCount === 0) {
    summaryRemarks = `Semua ${totalRows} Kode FAT sudah sesuai dengan cluster mayoritas (${dominantCluster}). Tidak ada perbedaan.`;
  } else {
    const parts = [];
    if (positionSummary.atas.length > 0) {
      parts.push(`${positionSummary.atas.length} di sekitaran atas (${positionSummary.atas.join(', ')})`);
    }
    if (positionSummary.tengah.length > 0) {
      parts.push(`${positionSummary.tengah.length} di sekitaran tengah (${positionSummary.tengah.join(', ')})`);
    }
    if (positionSummary.bawah.length > 0) {
      parts.push(`${positionSummary.bawah.length} di sekitaran bawah (${positionSummary.bawah.join(', ')})`);
    }

    summaryRemarks = `Terdapat ${mismatchCount} perbedaan cluster dari total ${totalRows} Kode FAT. Perbedaan ditemukan pada: ${parts.join('; ')}. Cluster rata-rata/mayoritas: ${dominantCluster}.`;
  }

  return {
    dominantCluster,
    totalRows,
    validCount,
    mismatchCount,
    summaryRemarks,
    mismatchedRecords,
    positionSummary,
    auditedRecords
  };
}
