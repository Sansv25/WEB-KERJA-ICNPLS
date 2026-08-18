import { classifyValue } from './classifier.js';
import { CONFIG } from './config.js';

/**
 * Parses raw 2D array of rows (from paste TSV or Excel sheet) into structured FAT -> ONT hierarchy.
 * @param {string[][]} rows - 2D matrix of cell values
 * @param {string} customPrefix - Asset ID prefix (default 'SPLT_')
 * @returns {Object} Parsed dataset containing items, statistics, and metadata
 */
export function parseRawRows(rows, customPrefix = CONFIG.DEFAULT_PREFIX, options = {}) {
  const prefix = (customPrefix || CONFIG.DEFAULT_PREFIX).trim();
  const isDeduplicate = typeof options === 'boolean' ? options : Boolean(options?.deduplicate);

  const ontList = [];
  const fatsMap = new Map(); // fatId -> { fatId, totalOnt: 0, problemOnt: 0 }
  const flatCodes = []; // Array of clean extracted codes matching prefix
  const seenFlatCodes = new Set();
  const seenOntKeys = new Set();

  let currentFatId = '(Tanpa FAT)';
  let maxChecksCount = 0;

  const categoryBreakdown = {
    [CONFIG.CATEGORIES.LOSS]: 0,
    [CONFIG.CATEGORIES.OFFLINE]: 0,
    [CONFIG.CATEGORIES.DEAKTIF]: 0,
    [CONFIG.CATEGORIES.SUSPEND]: 0,
    [CONFIG.CATEGORIES.ANOMALI]: 0,
    [CONFIG.CATEGORIES.ONLINE]: 0,
    [CONFIG.CATEGORIES.REDAMAN]: 0,
    [CONFIG.CATEGORIES.EMPTY]: 0
  };

  if (!Array.isArray(rows)) {
    return createEmptyResult();
  }

  for (let r = 0; r < rows.length; r++) {
    const rawRow = rows[r];
    if (!rawRow || !Array.isArray(rawRow) || rawRow.length === 0) continue;

    // Sanitize surrounding quotes and whitespace from all cell values in row
    const row = rawRow.map(c => sanitizeCellStr(c));

    // Scan baris untuk menemukan semua sel yang diawali dengan prefix ID
    const codeCells = [];
    row.forEach(cellVal => {
      const valStr = cellVal;
      if (valStr.toUpperCase().startsWith(prefix.toUpperCase())) {
        codeCells.push(valStr);

        const valUpper = valStr.toUpperCase();
        if (isDeduplicate) {
          if (!seenFlatCodes.has(valUpper)) {
            seenFlatCodes.add(valUpper);
            flatCodes.push(valStr);
          }
        } else {
          flatCodes.push(valStr);
        }
      }
    });

    if (codeCells.length === 0) continue;

    // Cari index kolom pertama yang diawali dengan prefix ID
    const codeIdx = row.findIndex(c => c.toUpperCase().startsWith(prefix.toUpperCase()));
    if (codeIdx === -1) continue;

    const cell0 = row[codeIdx] || '';
    const cell1 = row[codeIdx + 1] || '';
    const matchesPrefix1 = cell1.toUpperCase().startsWith(prefix.toUpperCase());

    // KASUS A: Kolom codeIdx = FAT ID, Kolom codeIdx + 1 = ONT ID (Dataset 2-Kolom Kode Aset)
    if (matchesPrefix1) {
      const fatId = cell0;
      const ontId = cell1;
      const ontKey = `${fatId}::${ontId}`;

      if (isDeduplicate) {
        if (!seenOntKeys.has(ontKey)) {
          seenOntKeys.add(ontKey);
        }
      }

      if (!fatsMap.has(fatId)) {
        fatsMap.set(fatId, { fatId, totalOnt: 0, problemOnt: 0 });
      }
      const fatStats = fatsMap.get(fatId);
      fatStats.totalOnt++;

      // Kolom check dimulai dari index codeIdx + 2
      const checkCells = row.slice(codeIdx + 2);
      const lastNonEmptyIndex = findLastNonEmptyIndex(checkCells);
      const effectiveCheckCells = lastNonEmptyIndex >= 0 ? checkCells.slice(0, lastNonEmptyIndex + 1) : [];

      const checks = [];
      effectiveCheckCells.forEach(cVal => {
        const classified = classifyValue(cVal);
        if (classified.isCheck && classified.category !== CONFIG.CATEGORIES.IGNORED) {
          if (categoryBreakdown[classified.category] !== undefined) {
            categoryBreakdown[classified.category]++;
          }
          checks.push(classified);
        }
      });

      if (checks.length > maxChecksCount) {
        maxChecksCount = checks.length;
      }

      const hasProblem = checks.some(c => c.isProblem);
      if (hasProblem) fatStats.problemOnt++;

      ontList.push({
        id: `ont-${ontList.length + 1}`,
        fat_id: fatId,
        ont_id: ontId,
        checks: checks,
        has_problem: hasProblem
      });
      continue;
    }

    // KASUS B: Structure 1-Kolom Kode Aset
    const restCells = row.slice(codeIdx + 1);
    const lastNonEmptyIndex = findLastNonEmptyIndex(restCells);
    const effectiveCheckCells = lastNonEmptyIndex >= 0 ? restCells.slice(0, lastNonEmptyIndex + 1) : [];

    const checks = [];
    effectiveCheckCells.forEach(cVal => {
      const classified = classifyValue(cVal);
      if (classified.isCheck && classified.category !== CONFIG.CATEGORIES.IGNORED) {
        if (categoryBreakdown[classified.category] !== undefined) {
          categoryBreakdown[classified.category]++;
        }
        checks.push(classified);
      }
    });

    const upper0 = cell0.toUpperCase();
    const isExplicitFat = upper0.includes('MTRF') || upper0.includes('FAT') || upper0.includes('ODP') || upper0.includes('SPLT_F');
    const isExplicitOnt = upper0.includes('MTRA') || upper0.includes('ONT') || upper0.includes('SPLT_A');

    if (isExplicitFat || (!isExplicitOnt && fatsMap.size === 0 && checks.length === 0)) {
      // FAT Parent Baru
      currentFatId = cell0;
      if (!fatsMap.has(currentFatId)) {
        fatsMap.set(currentFatId, { fatId: currentFatId, totalOnt: 0, problemOnt: 0 });
      }
    } else {
      // ONT Child
      const ontId = cell0;
      const ontKey = `${currentFatId}::${ontId}`;

      if (isDeduplicate) {
        if (!seenOntKeys.has(ontKey)) {
          seenOntKeys.add(ontKey);
        }
      }

      if (!fatsMap.has(currentFatId)) {
        fatsMap.set(currentFatId, { fatId: currentFatId, totalOnt: 0, problemOnt: 0 });
      }
      const fatStats = fatsMap.get(currentFatId);
      fatStats.totalOnt++;

      if (checks.length > maxChecksCount) {
        maxChecksCount = checks.length;
      }

      const hasProblem = checks.some(c => c.isProblem);
      if (hasProblem) fatStats.problemOnt++;

      ontList.push({
        id: `ont-${ontList.length + 1}`,
        fat_id: currentFatId,
        ont_id: ontId,
        checks: checks,
        has_problem: hasProblem
      });
    }
  }

  // Hitung Top FAT dengan ONT Bermasalah Terbanyak
  const topProblemFats = Array.from(fatsMap.values())
    .filter(f => f.problemOnt > 0)
    .sort((a, b) => b.problemOnt - a.problemOnt);

  // Buat struktur grup FAT -> ONTs untuk Mode B
  const groupedFatsMap = new Map();
  for (const fatId of fatsMap.keys()) {
    groupedFatsMap.set(fatId, { fatId, onts: [] });
  }

  ontList.forEach(item => {
    if (!groupedFatsMap.has(item.fat_id)) {
      groupedFatsMap.set(item.fat_id, { fatId: item.fat_id, onts: [] });
    }
    groupedFatsMap.get(item.fat_id).onts.push(item);
  });
  const groupedFats = Array.from(groupedFatsMap.values());

  const problemOntCount = ontList.filter(o => o.has_problem).length;
  const normalOntCount = ontList.length - problemOntCount;

  const hasChecks = (maxChecksCount || 0) > 0;
  const totalFatCount = hasChecks ? (fatsMap.size || flatCodes.length) : flatCodes.length;
  const totalOntCount = hasChecks ? ontList.length : flatCodes.length;

  return {
    prefixUsed: prefix,
    totalFat: totalFatCount,
    totalOnt: totalOntCount,
    problemOntCount,
    normalOntCount,
    maxChecksCount,
    categoryBreakdown,
    topProblemFats,
    groupedFats,
    flatCodes,
    items: ontList
  };
}

/**
 * Sanitizes cell text by removing hidden unicode characters, outer quotation marks, and extra whitespace
 */
export function sanitizeCellStr(val) {
  let str = String(val ?? '')
    .replace(/[\uFEFF\u200B\u200C\u200D\u00A0]/g, ' ')
    .trim();
  str = str.replace(/^["'`“”‘’\s]+|["'`“”‘’\s]+$/g, '').trim();
  return str;
}

function findLastNonEmptyIndex(arr) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (String(arr[i] ?? '').trim() !== '') {
      return i;
    }
  }
  return -1;
}

function createEmptyResult() {
  return {
    prefixUsed: CONFIG.DEFAULT_PREFIX,
    totalFat: 0,
    totalOnt: 0,
    problemOntCount: 0,
    normalOntCount: 0,
    maxChecksCount: 0,
    categoryBreakdown: {},
    topProblemFats: [],
    groupedFats: [],
    items: []
  };
}
