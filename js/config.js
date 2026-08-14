/**
 * App Configuration & Constants for ICONNET Asset Monitoring Parser
 */

export const CONFIG = {
  DEFAULT_PREFIX: 'SPLT_',
  
  CATEGORIES: {
    LOSS: 'loss',
    OFFLINE: 'offline',
    DEAKTIF: 'deaktif',
    SUSPEND: 'suspend',
    ANOMALI: 'anomali',
    ONLINE: 'online',
    REDAMAN: 'redaman',
    EMPTY: 'empty'
  },

  // Keywords & Typo aliases for matching categories (case-insensitive substring/regex check)
  ALIASES: {
    loss: ['loss', 'los'],
    offline: ['offline', 'of'],
    deaktif: ['deak', 'deaktif', 'deaktivasi', 'deactive', 'deactivation'],
    suspend: ['suspend', 'susspend'],
    online: ['online', 'active', 'on', 'ok'],
    anomali: ['dying gasp', 'beda port', 'beda cluster', 'not found', 'pindah cluster', '??']
  },

  // Regex pattern for optical attenuation dBm values (e.g. -25.5, -24.9, 24.5 dBm)
  REDAMAN_REGEX: /^-?\d+(\.\d+)?\s*(dbm)?$/i
};
