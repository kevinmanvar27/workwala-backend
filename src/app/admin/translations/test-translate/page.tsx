'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

export default function TestTranslatePage() {
  const [text, setText] = useState('Hello');
  const [targetLang, setTargetLang] = useState('ta');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const testTranslation = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/translations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLanguage: targetLang }),
      });

      const data = await response.json();
      
      if (data.success) {
        setResult(data.translated);
        toast.success('Translation successful!');
      } else {
        toast.error(data.error || 'Translation failed');
        setResult(`Error: ${data.error}\nDetails: ${data.details || 'N/A'}`);
      }
    } catch (error) {
      toast.error('Request failed');
      setResult(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Test Translation API</h1>
      
      <div className="space-y-4 bg-white p-6 rounded-lg border">
        <div>
          <label className="block text-sm font-medium mb-2">Text to translate</label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="Enter text..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Target Language</label>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="ta">Tamil (ta)</option>
            <option value="hi">Hindi (hi)</option>
            <option value="pa">Punjabi (pa)</option>
            <option value="bn">Bengali (bn)</option>
            <option value="te">Telugu (te)</option>
            <option value="ml">Malayalam (ml)</option>
            <option value="kn">Kannada (kn)</option>
            <option value="gu">Gujarati (gu)</option>
            <option value="mr">Marathi (mr)</option>
          </select>
        </div>

        <button
          onClick={testTranslation}
          disabled={loading}
          className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? 'Translating...' : 'Test Translation'}
        </button>

        {result && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium mb-2">Result:</h3>
            <p className="text-lg">{result}</p>
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">Instructions:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
          <li>Enter text to translate</li>
          <li>Select target language</li>
          <li>Click "Test Translation"</li>
          <li>Check browser console (F12) and server terminal for detailed logs</li>
        </ol>
      </div>
    </div>
  );
}
