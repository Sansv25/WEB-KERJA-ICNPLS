import { classifyValue } from './classifier.js';
import { CONFIG } from './config.js';

/**
 * Parses raw 2D array of rows (from paste TSV or Excel sheet) into structured FAT -> ONT hierarchy.
 * @param {string[][]} rows - 2D matrix of cell values
 * @param {string} customPrefix - Asset ID prefix (default 'SPLT_')
 * @returns {Object} Parsed dataset containing items, statistics, and metadata
 */
export function parseRawRows(rows, customPrefix = CONFIG.DEFAULT_PREFIX) {
  const prefix = (customPrefix || CONFIG.DEFAULT_PREFIX).trim();
  const ontList = [];
  const fatsMap = new Map(); // fatId -> { fatId, totalOnt: 0, problemOnt: 0 }

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
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const cell0 = String(row[0] || '').trim();
    if (!cell0) continue; // Baris tanpa ID di kolom 0 diabaikan

    // Cek apakah cell0 cocok dengan prefix (case-insensitive check)
    const matchesPrefix0 = cell0.toUpperCase().startsWith(prefix.toUpperCase());
    if (!matchesPrefix0) continue;

    const cell1 = String(row[1] || '').trim();
    const matchesPrefix1 = cell1.toUpperCase().startsWith(prefix.toUpperCase());

    // KASUS A: Kolom 0 = FAT ID, Kolom 1 = ONT ID (Dataset 2-Kolom Kode Aset)
    if (matchesPrefix1) {
      const fatId = cell0;
      const ontId = cell1;

      if (!fatsMap.has(fatId)) {
        fatsMap.set(fatId, { fatId, totalOnt: 0, problemOnt: 0 });
      }
      const fatStats = fatsMap.get(fatId);
      fatStats.totalOnt++;

      // Kolom check dimulai dari index 2
      const checkCells = row.slice(2);
      // Abaikan trailing empty cells di ujung kanan
      const lastNonEmptyIndex = findLastNonEmptyIndex(checkCells);
      const effectiveCheckCells = lastNonEmptyIndex >= 0 ? checkCells.slice(0, lastNonEmptyIndex + 1) : [];

      const checks = effectiveCheckCells.map(cVal => {
        const classified = classifyValue(cVal);
        if (categoryBreakdown[classified.category] !== undefined) {
          categoryBreakdown[classified.category]++;
        }
        return classified;
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

    // KASUS B: Structure 1-Kolom Kode Aset (Merged Cell / Hierarki Baris)
    const restCells = row.slice(1);
    const lastNonEmptyIndex = findLastNonEmptyIndex(restCells);
    const hasDataInRest = lastNonEmptyIndex >= 0;

    if (!hasDataInRest) {
      // Cek apakah cell0 adalah FAT parent atau ONT child tanpa check
      const upper0 = cell0.toUpperCase();
      const isExplicitFat = upper0.includes('MTRF') || upper0.includes('FAT') || upper0.includes('ODP');
      const isExplicitOnt = upper0.includes('MTRA') || upper0.includes('ONT');

      if (isExplicitFat || (!isExplicitOnt && fatsMap.size === 0)) {
        // FAT Parent Baru
        currentFatId = cell0;
        if (!fatsMap.has(currentFatId)) {
          fatsMap.set(currentFatId, { fatId: currentFatId, totalOnt: 0, problemOnt: 0 });
        }
      } else {
        // ONT Child tanpa data check
        if (!fatsMap.has(currentFatId)) {
          fatsMap.set(currentFatId, { fatId: currentFatId, totalOnt: 0, problemOnt: 0 });
        }
        const fatStats = fatsMap.get(currentFatId);
        fatStats.totalOnt++;

        ontList.push({
          id: `ont-${ontList.length + 1}`,
          fat_id: currentFatId,
          ont_id: cell0,
          checks: [],
          has_problem: false
        });
      }
    } else {
      // ONT Child dengan data check di kolom 1..N
      if (!fatsMap.has(currentFatId)) {
        fatsMap.set(currentFatId, { fatId: currentFatId, totalOnt: 0, problemOnt: 0 });
      }
      const fatStats = fatsMap.get(currentFatId);
      fatStats.totalOnt++;

      const effectiveCheckCells = restCells.slice(0, lastNonEmptyIndex + 1);
      const checks = effectiveCheckCells.map(cVal => {
        const classified = classifyValue(cVal);
        if (categoryBreakdown[classified.category] !== undefined) {
          categoryBreakdown[classified.category]++;
        }
        return classified;
      });

      if (checks.length > maxChecksCount) {
        maxChecksCount = checks.length;
      }

      const hasProblem = checks.some(c => c.isProblem);
      if (hasProblem) fatStats.problemOnt++;

      ontList.push({
        id: `ont-${ontList.length + 1}`,
        fat_id: currentFatId,
        ont_id: cell0,
        checks: checks,
        has_problem: hasProblem
      });
    }
  }

  // Hitung Top FAT dengan ONT Bermasalah Terbanyak
  const topProblemFats = Array.from(fatsMap.values())
    .filter(f => f.problemOnt > 0)
    .sort((a, b) => b.problemOnt - a.problemOnt);

  // Buat struktur grup FAT -> ONTs untuk Mode B (1-kolom)
  const groupedFatsMap = new Map();
  ontList.forEach(item => {
    if (!groupedFatsMap.has(item.fat_id)) {
      groupedFatsMap.set(item.fat_id, { fatId: item.fat_id, onts: [] });
    }
    groupedFatsMap.get(item.fat_id).onts.push(item);
  });
  const groupedFats = Array.from(groupedFatsMap.values());

  const problemOntCount = ontList.filter(o => o.has_problem).length;
  const normalOntCount = ontList.length - problemOntCount;

  return {
    prefixUsed: prefix,
    totalFat: fatsMap.size,
    totalOnt: ontList.length,
    problemOntCount,
    normalOntCount,
    maxChecksCount,
    categoryBreakdown,
    topProblemFats,
    groupedFats,
    items: ontList
  };
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
