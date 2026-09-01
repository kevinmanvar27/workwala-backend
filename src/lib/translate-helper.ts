/**
 * Translation Helper Functions
 * Extracted from translate.ts for reuse
 */

import https from 'https';

/**
 * Translate using Google Cloud Translation API (Official - Requires API Key)
 */
async function translateViaCloudAPI(text: string, targetLang: string): Promise<string> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  
  if (!apiKey) {
    throw new Error('GOOGLE_TRANSLATE_API_KEY not configured');
  }

  return new Promise((resolve, reject) => {
    const encodedText = encodeURIComponent(text);
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}&q=${encodedText}&source=en&target=${targetLang}&format=text`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            return;
          }
          const parsed = JSON.parse(data);
          if (parsed?.data?.translations?.[0]?.translatedText) {
            resolve(parsed.data.translations[0].translatedText);
          } else {
            reject(new Error('Invalid Cloud API response format'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Translate using Google Translate API with fallback methods
 */
export async function translateViaDirect(text: string, targetLang: string): Promise<string> {
  // Try official Google Cloud Translation API first if API key is configured
  if (process.env.GOOGLE_TRANSLATE_API_KEY) {
    try {
      return await translateViaCloudAPI(text, targetLang);
    } catch (error) {
      console.warn('Cloud API failed, trying free method...', error instanceof Error ? error.message : error);
    }
  }

  // Fallback to free Google Translate API
  return new Promise((resolve, reject) => {
    const encodedText = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodedText}`;
    
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://translate.google.com/',
      }
    };
    
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            return;
          }
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
