/**
 * Translation Helper Functions
 * Extracted from translate.ts for reuse
 */

import https from 'https';

/**
 * Translate using Google Translate API directly
 */
export async function translateViaDirect(text: string, targetLang: string): Promise<string> {
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
            const translated = parsed[0].map((item: any) => item[0]).join('');
            resolve(translated);
          } else {
            reject(new Error('Invalid response format'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}
