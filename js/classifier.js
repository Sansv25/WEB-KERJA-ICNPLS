import { CONFIG } from './config.js';

/**
 * Classifies a raw cell value into category and problem flag.
 * @param {string|number} rawValue - Raw cell text/number
 * @returns {Object} { raw_value, category, isProblem, badgeClass, label }
 */
export function classifyValue(rawValue) {
  const val = String(rawValue ?? '').trim();

  // 1. Sel Kosong
  if (!val) {
    return {
      raw_value: '',
      category: CONFIG.CATEGORIES.EMPTY,
      isProblem: false,
      isCheck: false,
      badgeClass: 'badge-empty',
      label: '-'
    };
  }

  // 2. Nilai Redaman dBm (Angka desimal dengan/tanpa minus & dBm suffix)
  if (CONFIG.REDAMAN_REGEX.test(val)) {
    return {
      raw_value: val,
      category: CONFIG.CATEGORIES.REDAMAN,
      isProblem: false, // Netral sesuai PRD 5.2
      isCheck: true,
      badgeClass: 'badge-redaman',
      label: val
    };
  }

  const lowerVal = val.toLowerCase();

  // 3. Loss
  if (CONFIG.ALIASES.loss.some(alias => lowerVal.includes(alias))) {
    return {
      raw_value: val,
      category: CONFIG.CATEGORIES.LOSS,
      isProblem: true,
      isCheck: true,
      badgeClass: 'badge-loss',
      label: val
    };
  }

  // 4. Offline
  if (CONFIG.ALIASES.offline.some(alias => lowerVal === alias || lowerVal.startsWith(alias + ' '))) {
    return {
      raw_value: val,
      category: CONFIG.CATEGORIES.OFFLINE,
      isProblem: true,
      isCheck: true,
      badgeClass: 'badge-offline',
      label: val
    };
  }

  // 5. Deaktif / Deaktivasi
  if (CONFIG.ALIASES.deaktif.some(alias => lowerVal.includes(alias))) {
    return {
      raw_value: val,
      category: CONFIG.CATEGORIES.DEAKTIF,
      isProblem: true,
      isCheck: true,
      badgeClass: 'badge-deaktif',
      label: val
    };
  }

  // 6. Suspend (termasuk yang ada tanggal seperti "suspend 12/08")
  if (CONFIG.ALIASES.suspend.some(alias => lowerVal.includes(alias))) {
    return {
      raw_value: val,
      category: CONFIG.CATEGORIES.SUSPEND,
      isProblem: true,
      isCheck: true,
      badgeClass: 'badge-suspend',
      label: val
    };
  }

  // 7. Online / Aktif
  if (CONFIG.ALIASES.online.some(alias => lowerVal === alias)) {
    return {
      raw_value: val,
      category: CONFIG.CATEGORIES.ONLINE,
      isProblem: false,
      isCheck: true,
      badgeClass: 'badge-online',
      label: val
    };
  }

  // 8. Anomali Jaringan Dikenal (dying gasp, beda port, beda cluster, not found, pindah cluster, ??)
  if (CONFIG.ALIASES.anomali.some(alias => lowerVal.includes(alias))) {
    return {
      raw_value: val,
      category: CONFIG.CATEGORIES.ANOMALI,
      isProblem: true, // Ditandai bermasalah untuk dicek manual
      isCheck: true,
      badgeClass: 'badge-anomali',
      label: val
    };
  }

  // 9. Teks Tak Dikenal Lainnya (nama orang, catatan bebas, dll)
  return {
    raw_value: val,
    category: CONFIG.CATEGORIES.IGNORED,
    isProblem: false,
    isCheck: false,
    badgeClass: 'badge-empty',
    label: val
  };
}
