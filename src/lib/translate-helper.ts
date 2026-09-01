/**
 * Translation Helper Functions
 * Extracted from translate.ts for reuse
 */

import https from 'https';

/**
 * Translate using MyMemory API (100% free, no key needed, works on all servers)
 */
async function translateViaMyMemory(text: string, targetLang: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const encodedText = encodeURIComponent(text);
    const langPair = `en|${targetLang}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=${langPair}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`MyMemory HTTP ${res.statusCode}: ${data}`));
            return;
          }
          const parsed = JSON.parse(data);
          if (parsed?.responseStatus === 200 && parsed?.responseData?.translatedText) {
            resolve(parsed.responseData.translatedText);
          } else {
            reject(new Error(`MyMemory error: ${parsed?.responseDetails || 'Unknown error'}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Translate using Google Translate free endpoint (fallback, may be blocked on servers)
 */
async function translateViaGoogle(text: string, targetLang: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const encodedText = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodedText}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed && parsed[0]) {
            const translated = parsed[0].map((item: any) => item[0]).filter(Boolean).join('');
            resolve(translated);
          } else {
            reject(new Error('Invalid Google response format'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Translate with automatic fallback: MyMemory → Google
 */
export async function translateViaDirect(text: string, targetLang: string): Promise<string> {
  try {
    return await translateViaMyMemory(text, targetLang);
  } catch (error) {
    console.warn(`⚠️ MyMemory failed, trying Google...`);
    return translateViaGoogle(text, targetLang);
  }
}
