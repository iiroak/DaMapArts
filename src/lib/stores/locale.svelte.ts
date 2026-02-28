/**
 * Reactive i18n locale store — Svelte 5 runes.
 *
 * Usage:
 *   import { locale } from '$lib/stores/locale.svelte.js';
 *   locale.t('file.title')          // returns translated string
 *   locale.code = 'es';             // switch language
 *   locale.locales                   // available locales
 */

import { browser } from '$app/environment';
import en from '$lib/locale/en.js';

/* ── Available locales ── */
export interface LocaleInfo {
  code: string;
  name: string;
  nativeName: string;
}

export const AVAILABLE_LOCALES: LocaleInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'pt-Br', name: 'Portuguese (BR)', nativeName: 'Português (BR)' },
  { code: 'zh-Hans', name: 'Chinese (Simplified)', nativeName: '简体中文' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
];

type Translations = Record<string, string>;

const STORAGE_KEY = 'mapartcraft_locale';

/* ── Detect initial locale ── */
function getInitialLocale(): string {
  if (browser) {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && AVAILABLE_LOCALES.some((l) => l.code === saved)) return saved;
  }
  if (browser) {
    const full = navigator.language; // e.g. "es-MX", "pt-BR", "zh-CN"
    // Try exact match first (e.g. "pt-Br")
    const exactMatch = AVAILABLE_LOCALES.find(
      (l) => l.code.toLowerCase() === full.toLowerCase(),
    );
    if (exactMatch) return exactMatch.code;
    // Then base language
    const base = full.split('-')[0];
    const baseMatch = AVAILABLE_LOCALES.find(
      (l) => l.code.split('-')[0].toLowerCase() === base.toLowerCase(),
    );
    if (baseMatch) return baseMatch.code;
  }
  return 'en';
}

/* ── Lazy loaders ── */
const loaders: Record<string, () => Promise<{ default: Translations }>> = {
  en: () => import('$lib/locale/en.js'),
  es: () => import('$lib/locale/es.js'),
  ja: () => import('$lib/locale/ja.js'),
  'pt-Br': () => import('$lib/locale/pt-Br.js'),
  'zh-Hans': () => import('$lib/locale/zh-Hans.js'),
  fr: () => import('$lib/locale/fr.js'),
  de: () => import('$lib/locale/de.js'),
  ru: () => import('$lib/locale/ru.js'),
};

/* ── Store ── */
let _code = $state(getInitialLocale());
let _translations = $state<Translations>(en);
let _loading = $state(false);

async function loadLocale(code: string) {
  if (!loaders[code]) code = 'en';
  _loading = true;
  try {
    const mod = await loaders[code]();
    _translations = mod.default;
    _code = code;
    if (browser) {
      localStorage.setItem(STORAGE_KEY, code);
    }
  } catch {
    // Fallback to English
    _translations = en;
    _code = 'en';
  }
  _loading = false;
}

// Load initial locale on startup (English is already loaded synchronously)
if (_code !== 'en') {
  loadLocale(_code);
}

/**
 * Translate a key. Falls back to the key itself if not found.
 * Supports simple interpolation: t('key', { count: 5 }) replaces {count}.
 */
function t(key: string, vars?: Record<string, string | number>): string {
  let str = _translations[key] ?? en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return str;
}

export const locale = {
  get code() {
    return _code;
  },
  set code(c: string) {
    if (c !== _code) loadLocale(c);
  },
  get loading() {
    return _loading;
  },
  get locales() {
    return AVAILABLE_LOCALES;
  },
  t,
};
