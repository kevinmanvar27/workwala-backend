/**
 * Translation Utility
 *
 * Key design decisions:
 *  1. English keys are bundled as a static JSON file (translation-keys.json).
 *     This means the live server NEVER needs the Flutter ARB files present —
 *     they are only needed locally when you add new keys and re-run the sync script.
 *
 *  2. Translation provider chain (tried in order, first success wins):
 *       a. MyMemory  — free, 50k words/day with email param, works on most servers
 *       b. LibreTranslate (public instance) — fully free, no key needed
 *       c. Google free endpoint — works locally, often blocked on shared hosting
 *     If ALL providers fail for a chunk, the original English value is kept as fallback.
 */

import fs   from 'fs';
import path from 'path';
import https from 'https';
import http  from 'http';

// ── Language code mapping ──────────────────────────────────────────────────────
const LANGUAGE_CODE_MAP: Record<string, string> = {
  en: 'en', hi: 'hi', gu: 'gu', mr: 'mr', pa: 'pa',
  es: 'es', fr: 'fr', de: 'de', it: 'it', pt: 'pt',
  ru: 'ru', ja: 'ja', ko: 'ko', zh: 'zh-CN',
  ar: 'ar', bn: 'bn', ta: 'ta', te: 'te', ml: 'ml', kn: 'kn',
};

// MyMemory uses slightly different codes for some languages
const MYMEMORY_CODE_MAP: Record<string, string> = {
  'zh-CN': 'zh-CN', 'zh': 'zh-CN',
};
function toMyMemoryCode(lang: string): string {
  return MYMEMORY_CODE_MAP[lang] ?? lang;
}

export interface TranslationKey {
  key: string;
  value: string;
  category: string;
}

// ── Static key source ──────────────────────────────────────────────────────────
// Bundled JSON is the single source of truth on the live server.
// Falls back to reading ARB files locally if the JSON somehow doesn't exist.
const BUNDLED_KEYS_PATH = path.join(__dirname, 'translation-keys.json');

export async function getEnglishTranslationKeys(): Promise<TranslationKey[]> {
  // 1. Try bundled JSON first (always present on live server)
  if (fs.existsSync(BUNDLED_KEYS_PATH)) {
    try {
      const raw  = fs.readFileSync(BUNDLED_KEYS_PATH, 'utf-8');
      const data = JSON.parse(raw) as Record<string, string>;
      const keys = Object.entries(data).map(([key, value]) => ({
        key,
        value,
        category: 'general',
      }));
      console.log(`✅ Loaded ${keys.length} keys from bundled translation-keys.json`);
      return keys;
    } catch (err) {
      console.warn('⚠️  Failed to parse bundled translation-keys.json, falling back to ARB files');
    }
  }

  // 2. Fallback: read ARB files (works locally during development)
  const arbPaths = [
    path.join(process.cwd(), '../Work-Wala-Partner/lib/l10n/app_en.arb'),
    path.join(process.cwd(), '../Work-Wala-Customer/lib/l10n/app_en.arb'),
  ];

  const mergedKeys = new Map<string, TranslationKey>();

  for (const arbFilePath of arbPaths) {
    if (!fs.existsSync(arbFilePath)) {
      console.warn(`⚠️  ARB file not found, skipping: ${arbFilePath}`);
      continue;
    }
    try {
      const arbData = JSON.parse(fs.readFileSync(arbFilePath, 'utf-8'));
      for (const [key, value] of Object.entries(arbData)) {
        if (key.startsWith('@')) continue;
        if (typeof value === 'string' && value.trim() && !mergedKeys.has(key)) {
          mergedKeys.set(key, { key, value, category: 'general' });
        }
      }
      console.log(`✅ Read ${arbFilePath.split('/').pop()}`);
    } catch (err) {
      console.error(`❌ Error reading ARB file ${arbFilePath}:`, err);
    }
  }

  const keys = Array.from(mergedKeys.values());
  console.log(`✅ Total merged translation keys from ARB: ${keys.length}`);
  return keys;
}

// ── HTTP helper ────────────────────────────────────────────────────────────────
function httpGet(url: string, timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Request timed out')); });
    req.on('error', reject);
  });
}

function httpPost(url: string, body: string, headers: Record<string, string>, timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const opts   = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'POST',
      headers:  { 'Content-Length': Buffer.byteLength(body), ...headers },
    };
    const req = lib.request(opts, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Request timed out')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Provider A: MyMemory ───────────────────────────────────────────────────────
// Free tier: 10k words/day anonymous, 50k words/day with email param.
// Docs: https://mymemory.translated.net/doc/spec.php
async function translateViaMyMemory(text: string, targetLang: string): Promise<string> {
  const lang = toMyMemoryCode(targetLang);
  const url  = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${lang}&de=support@joinlinko.com`;
  const raw  = await httpGet(url, 8000);
  const parsed = JSON.parse(raw);
  if (parsed?.responseStatus === 200 && parsed?.responseData?.translatedText) {
    return parsed.responseData.translatedText;
  }
  throw new Error(`MyMemory: status ${parsed?.responseStatus} — ${parsed?.responseDetails ?? 'unknown'}`);
}

// ── Provider B: LibreTranslate (public instance) ───────────────────────────────
// Completely free, no key needed on the public instance.
// Docs: https://libretranslate.com/docs
const LIBRE_INSTANCES = [
  'https://libretranslate.com',
  'https://translate.argosopentech.com',
  'https://libretranslate.de',
];

async function translateViaLibreTranslate(text: string, targetLang: string): Promise<string> {
  // LibreTranslate uses simple 2-letter codes; strip region suffix
  const lang = targetLang.split('-')[0];
  const body = JSON.stringify({ q: text, source: 'en', target: lang, format: 'text' });
  const headers = { 'Content-Type': 'application/json' };

  for (const instance of LIBRE_INSTANCES) {
    try {
      const raw    = await httpPost(`${instance}/translate`, body, headers, 8000);
      const parsed = JSON.parse(raw);
      if (parsed?.translatedText) return parsed.translatedText;
    } catch {
      // try next instance
    }
  }
  throw new Error('LibreTranslate: all instances failed');
}

// ── Provider C: Google free endpoint ──────────────────────────────────────────
// Works reliably locally; often blocked on shared hosting.
async function translateViaGoogle(text: string, targetLang: string): Promise<string> {
  const url  = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  const raw  = await httpGet(url, 8000);
  const parsed = JSON.parse(raw);
  if (parsed?.[0]) {
    const translated = (parsed[0] as any[]).map((item: any) => item?.[0]).filter(Boolean).join('');
    if (translated) return translated;
  }
  throw new Error('Google: invalid response format');
}

// ── Provider chain ─────────────────────────────────────────────────────────────
async function doTranslate(text: string, targetLang: string): Promise<string> {
  const providers: Array<{ name: string; fn: () => Promise<string> }> = [
    { name: 'MyMemory',       fn: () => translateViaMyMemory(text, targetLang)       },
    { name: 'LibreTranslate', fn: () => translateViaLibreTranslate(text, targetLang) },
    { name: 'Google',         fn: () => translateViaGoogle(text, targetLang)         },
  ];

  for (const { name, fn } of providers) {
    try {
      const result = await fn();
      console.log(`✅ [${name}] translated successfully`);
      return result;
    } catch (err) {
      console.warn(`⚠️  [${name}] failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  throw new Error(`All translation providers failed for lang="${targetLang}"`);
}

// ── Batch translate all keys ───────────────────────────────────────────────────
// MyMemory has a ~500 char limit per request, so we batch keys into small chunks.
export async function translateAllKeysAtOnce(
  keys: TranslationKey[],
  targetLanguage: string,
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, string>> {
  const translations = new Map<string, string>();
  const targetLang   = LANGUAGE_CODE_MAP[targetLanguage] ?? targetLanguage;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`🌐 Translating ${keys.length} keys → ${targetLanguage} (${targetLang})`);
  console.log(`${'─'.repeat(60)}`);

  const CHUNK_SIZE  = 5;   // 5 values joined by newline — stays well under 500 chars
  let successCount  = 0;
  let fallbackCount = 0;

  for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
    const chunk        = keys.slice(i, i + CHUNK_SIZE);
    const combinedText = chunk.map((k) => k.value).join('\n');

    try {
      const result           = await doTranslate(combinedText, targetLang);
      const translatedLines  = result.split('\n');

      chunk.forEach((item, idx) => {
        const translated = translatedLines[idx]?.trim();
        if (translated) {
          translations.set(item.key, translated);
          successCount++;
        } else {
          // Line missing in response — keep English
          translations.set(item.key, item.value);
          fallbackCount++;
        }
      });
    } catch {
      // Entire chunk failed — keep English values
      chunk.forEach((item) => {
        translations.set(item.key, item.value);
        fallbackCount++;
      });
    }

    // Small delay between chunks to respect rate limits
    if (i + CHUNK_SIZE < keys.length) {
      await new Promise((r) => setTimeout(r, 300));
    }

    if (onProgress) onProgress(Math.min(i + CHUNK_SIZE, keys.length), keys.length);

    if ((i / CHUNK_SIZE + 1) % 10 === 0 || i + CHUNK_SIZE >= keys.length) {
      console.log(`   📊 ${Math.min(i + CHUNK_SIZE, keys.length)}/${keys.length} keys processed`);
    }
  }

  console.log(`\n✅ Translation done — success: ${successCount}, fallback to EN: ${fallbackCount}`);
  return translations;
}

// ── Single-text helper (used by test endpoint) ─────────────────────────────────
export async function translateText(text: string, targetLanguage: string): Promise<string> {
  const targetLang = LANGUAGE_CODE_MAP[targetLanguage] ?? targetLanguage;
  return doTranslate(text, targetLang);
}

// ── DB insert helper ───────────────────────────────────────────────────────────
export async function batchInsertTranslations(
  pool: any,
  languageCode: string,
  keys: TranslationKey[],
  translations: Map<string, string>
): Promise<void> {
  if (keys.length === 0) return;

  console.log(`💾 Inserting ${keys.length} translations for "${languageCode}"…`);

  const values: any[]       = [];
  const placeholders: string[] = [];

  keys.forEach((item) => {
    const translatedValue = translations.get(item.key) ?? item.value;
    placeholders.push('(?, ?, ?, ?)');
    values.push(languageCode, item.key, translatedValue, item.category);
  });

  await pool.query(
    `INSERT INTO translations (language_code, translation_key, translation_value, category)
     VALUES ${placeholders.join(', ')}
     ON DUPLICATE KEY UPDATE
       translation_value = VALUES(translation_value),
       category          = VALUES(category),
       updated_at        = NOW()`,
    values
  );

  console.log(`✅ Inserted/updated ${keys.length} translations for "${languageCode}"`);
}
