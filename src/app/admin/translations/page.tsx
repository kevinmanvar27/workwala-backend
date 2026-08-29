'use client';

import { useState, useEffect } from 'react';
import { Plus, Languages, Edit, Trash2, Globe, CheckCircle, XCircle, ArrowUpDown, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '@/lib/apiFetch';

interface Language {
  id: number;
  code: string;
  name: string;
  native_name: string;
  is_active: boolean;
  sort_order: number;
  translation_count?: number;
  last_updated?: string;
}

export default function TranslationsPage() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [showAddLanguage, setShowAddLanguage] = useState(false);

  // Fetch languages
  useEffect(() => {
    fetchLanguages();
  }, []);

  const fetchLanguages = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/translations/languages');
      const data = await response.json();
      console.log('API Response:', data);
      if (response.ok && data.success) {
        setLanguages(data.languages || []);
      } else {
        toast.error(data.error || 'Failed to load languages');
        console.error('API Error:', data);
      }
    } catch (error) {
      toast.error('Failed to load languages');
      console.error('Fetch Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLanguageStatus = async (code: string, currentStatus: boolean) => {
    try {
      const response = await apiFetch(`/api/admin/translations/languages/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      if (response.ok) {
        toast.success(`Language ${!currentStatus ? 'activated' : 'deactivated'}`);
        fetchLanguages();
      } else {
        toast.error('Failed to update language');
      }
    } catch (error) {
      toast.error('Failed to update language');
    }
  };

  const deleteLanguage = async (code: string) => {
    if (!confirm(`Are you sure you want to delete this language? All translations will be removed.`)) {
      return;
    }

    try {
      const response = await apiFetch(`/api/admin/translations/languages/${code}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Language deleted successfully');
        fetchLanguages();
      } else {
        toast.error('Failed to delete language');
      }
    } catch (error) {
      toast.error('Failed to delete language');
    }
  };

  const autoTranslateLanguage = async (code: string) => {
    if (!confirm(`Auto-translate all keys for ${code.toUpperCase()}?\n\nThis will use Google Translate to translate all ${languages.find(l => l.code === code)?.translation_count || 342} English keys to ${code.toUpperCase()}.\n\n⚠️ This may take 2-5 minutes. Please keep this page open.\n\nExisting translations will be updated.`)) {
      return;
    }

    const toastId = `auto-translate-${code}`;
    
    try {
      toast.loading(`🔄 Auto-translating to ${code.toUpperCase()}...\n\nThis may take a few minutes. Please wait...`, { 
        id: toastId,
        duration: Infinity,
      });
      
      const response = await apiFetch('/api/admin/translations/auto-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ languageCode: code }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(
          `✅ Successfully translated ${data.stats?.total_keys || 0} keys to ${code.toUpperCase()}!\n\nYou can now view the translations.`, 
          { 
            id: toastId,
            duration: 5000,
          }
        );
        fetchLanguages();
      } else {
        toast.error(
          `❌ Auto-translation failed\n\n${data.error || 'Unknown error'}\n\n${data.hint || 'Please check server logs for details.'}`, 
          { 
            id: toastId,
            duration: 8000,
          }
        );
        console.error('Auto-translate error:', data);
      }
    } catch (error) {
      toast.error(
        `❌ Auto-translation failed\n\nNetwork error or server timeout.\n\nPlease check your internet connection and try again.`, 
        { 
          id: toastId,
          duration: 8000,
        }
      );
      console.error('Auto-translate error:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Languages className="w-7 h-7 text-purple-600" />
            Translations Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage app languages and translations dynamically
          </p>
        </div>
        <button
          onClick={() => setShowAddLanguage(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus size={20} />
          Add Language
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Languages className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Languages</p>
              <p className="text-2xl font-bold text-gray-900">{languages.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Languages</p>
              <p className="text-2xl font-bold text-gray-900">
                {languages.filter(l => l.is_active).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Translation Keys</p>
              <p className="text-2xl font-bold text-gray-900">
                {languages[0]?.translation_count || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Inactive Languages</p>
              <p className="text-2xl font-bold text-gray-900">
                {languages.filter(l => !l.is_active).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Languages Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Language
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Native Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Translations
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sort Order
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {languages.map((lang) => (
                <tr key={lang.code} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Globe className="w-5 h-5 text-gray-400" />
                      <span className="font-medium text-gray-900">{lang.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm font-mono">
                      {lang.code}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {lang.native_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => setSelectedLanguage(lang.code)}
                      className="text-purple-600 hover:text-purple-700 font-medium text-sm"
                    >
                      {lang.translation_count || 0} keys
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleLanguageStatus(lang.code, lang.is_active)}
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        lang.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {lang.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {lang.sort_order}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => autoTranslateLanguage(lang.code)}
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Auto-Translate from English"
                      >
                        <Sparkles size={16} />
                      </button>
                      <button
                        onClick={() => setSelectedLanguage(lang.code)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Translations"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => deleteLanguage(lang.code)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Language"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty State */}
      {languages.length === 0 && (
        <div className="text-center py-12">
          <Languages className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No languages found</h3>
          <p className="text-gray-600 mb-4">Get started by adding your first language</p>
          <button
            onClick={() => setShowAddLanguage(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Plus size={20} />
            Add Language
          </button>
        </div>
      )}

      {/* Translation Editor Modal */}
      {selectedLanguage && (
        <TranslationEditor
          languageCode={selectedLanguage}
          onClose={() => setSelectedLanguage(null)}
          onUpdate={fetchLanguages}
        />
      )}

      {/* Add Language Modal */}
      {showAddLanguage && (
        <AddLanguageModal
          onClose={() => setShowAddLanguage(false)}
          onSuccess={fetchLanguages}
        />
      )}
    </div>
  );
}

// Translation Editor Component
function TranslationEditor({ 
  languageCode, 
  onClose, 
  onUpdate 
}: { 
  languageCode: string; 
  onClose: () => void; 
  onUpdate: () => void;
}) {
  const [translations, setTranslations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showAddNew, setShowAddNew] = useState(false);
  const [autoTranslating, setAutoTranslating] = useState(false);
  const limit = 50;

  useEffect(() => {
    fetchTranslations();
  }, [languageCode, search, category, page]);

  const fetchTranslations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) params.append('search', search);
      if (category) params.append('category', category);

      console.log('🔍 Fetching translations:', `/api/admin/translations/data/${languageCode}?${params}`);
      const response = await fetch(`/api/admin/translations/data/${languageCode}?${params}`);
      const data = await response.json();
      
      console.log('📦 Response status:', response.status);
      console.log('📦 Response data:', data);
      
      if (response.ok && data.success) {
        setTranslations(data.translations || []);
        setTotal(data.total || 0);
        setCategories(data.categories || []);
        console.log('✅ Loaded', data.translations?.length, 'translations');
      } else {
        console.error('❌ API Error:', data);
        toast.error(data.error || 'Failed to load translations');
      }
    } catch (error) {
      console.error('❌ Fetch Error:', error);
      toast.error('Failed to load translations');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (key: string, value: string) => {
    setEditingKey(key);
    setEditValue(value);
  };

  const handleSave = async (key: string) => {
    try {
      const response = await apiFetch(`/api/admin/translations/data/${languageCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: editValue }),
      });

      if (response.ok) {
        toast.success('Translation updated');
        setEditingKey(null);
        fetchTranslations();
        onUpdate();
      } else {
        toast.error('Failed to update translation');
      }
    } catch (error) {
      toast.error('Failed to update translation');
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`Delete translation key "${key}"?`)) return;

    try {
      const response = await apiFetch(`/api/admin/translations/data/${languageCode}?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Translation deleted');
        fetchTranslations();
        onUpdate();
      } else {
        toast.error('Failed to delete translation');
      }
    } catch (error) {
      toast.error('Failed to delete translation');
    }
  };

  const handleAutoTranslate = async () => {
    if (!confirm(`Auto-translate all keys for ${languageCode.toUpperCase()}?\n\nThis will translate all English keys using Google Translate.\n\n⚠️ This may take 2-5 minutes. Please keep this page open.\n\nExisting translations will be updated.`)) {
      return;
    }

    try {
      setAutoTranslating(true);
      toast.loading(`🔄 Auto-translating to ${languageCode.toUpperCase()}...\n\nThis may take a few minutes. Please wait...`, { 
        id: 'auto-translate',
        duration: Infinity,
      });
      
      const response = await apiFetch('/api/admin/translations/auto-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ languageCode }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(
          `✅ Successfully translated ${data.stats?.total_keys || 0} keys to ${languageCode.toUpperCase()}!`, 
          { 
            id: 'auto-translate',
            duration: 5000,
          }
        );
        fetchTranslations();
        onUpdate();
      } else {
        toast.error(
          `❌ Auto-translation failed\n\n${data.error || 'Unknown error'}\n\n${data.hint || 'Please check server logs.'}`, 
          { 
            id: 'auto-translate',
            duration: 8000,
          }
        );
        console.error('Auto-translate error:', data);
      }
    } catch (error) {
      toast.error(
        `❌ Auto-translation failed\n\nNetwork error or server timeout.`, 
        { 
          id: 'auto-translate',
          duration: 8000,
        }
      );
      console.error('Auto-translate error:', error);
    } finally {
      setAutoTranslating(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Edit Translations - {languageCode.toUpperCase()}</h2>
              <p className="text-sm text-gray-600 mt-1">{total} translation keys</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAutoTranslate}
                disabled={autoTranslating}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title="Auto-translate all keys from English using Google Translate"
              >
                <Sparkles size={16} className={autoTranslating ? 'animate-spin' : ''} />
                {autoTranslating ? 'Translating...' : 'Auto-Translate'}
              </button>
              <button
                onClick={() => setShowAddNew(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
              >
                <Plus size={16} />
                Add New
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Search by key or value..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            />
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Translations List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : translations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No translations found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {translations.map((trans) => (
                <div key={trans.translation_key} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <code className="text-sm font-mono text-purple-600 bg-purple-50 px-2 py-1 rounded">
                          {trans.translation_key}
                        </code>
                        {trans.category && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            {trans.category}
                          </span>
                        )}
                      </div>
                      {editingKey === trans.translation_key ? (
                        <div className="space-y-2">
                          <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                            rows={3}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSave(trans.translation_key)}
                              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingKey(null)}
                              className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-700 text-sm whitespace-pre-wrap break-words">
                          {trans.translation_value}
                        </p>
                      )}
                    </div>
                    {editingKey !== trans.translation_key && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(trans.translation_key, trans.translation_value)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(trans.translation_key)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>

      {/* Add New Translation Modal */}
      {showAddNew && (
        <AddTranslationModal
          languageCode={languageCode}
          onClose={() => setShowAddNew(false)}
          onSuccess={() => {
            setShowAddNew(false);
            fetchTranslations();
            onUpdate();
          }}
        />
      )}
    </div>
  );
}

// Google Translate Supported Languages
const GOOGLE_LANGUAGES = [
  { code: 'af', name: 'Afrikaans', native: 'Afrikaans' },
  { code: 'sq', name: 'Albanian', native: 'Shqip' },
  { code: 'am', name: 'Amharic', native: 'አማርኛ' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'hy', name: 'Armenian', native: 'Հայերեն' },
  { code: 'az', name: 'Azerbaijani', native: 'Azərbaycan' },
  { code: 'eu', name: 'Basque', native: 'Euskara' },
  { code: 'be', name: 'Belarusian', native: 'Беларуская' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'bs', name: 'Bosnian', native: 'Bosanski' },
  { code: 'bg', name: 'Bulgarian', native: 'Български' },
  { code: 'ca', name: 'Catalan', native: 'Català' },
  { code: 'ceb', name: 'Cebuano', native: 'Cebuano' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', native: '简体中文' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', native: '繁體中文' },
  { code: 'co', name: 'Corsican', native: 'Corsu' },
  { code: 'hr', name: 'Croatian', native: 'Hrvatski' },
  { code: 'cs', name: 'Czech', native: 'Čeština' },
  { code: 'da', name: 'Danish', native: 'Dansk' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands' },
  { code: 'en', name: 'English', native: 'English' },
  { code: 'eo', name: 'Esperanto', native: 'Esperanto' },
  { code: 'et', name: 'Estonian', native: 'Eesti' },
  { code: 'fi', name: 'Finnish', native: 'Suomi' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'fy', name: 'Frisian', native: 'Frysk' },
  { code: 'gl', name: 'Galician', native: 'Galego' },
  { code: 'ka', name: 'Georgian', native: 'ქართული' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'el', name: 'Greek', native: 'Ελληνικά' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'ht', name: 'Haitian Creole', native: 'Kreyòl Ayisyen' },
  { code: 'ha', name: 'Hausa', native: 'Hausa' },
  { code: 'haw', name: 'Hawaiian', native: 'ʻŌlelo Hawaiʻi' },
  { code: 'he', name: 'Hebrew', native: 'עברית' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'hmn', name: 'Hmong', native: 'Hmong' },
  { code: 'hu', name: 'Hungarian', native: 'Magyar' },
  { code: 'is', name: 'Icelandic', native: 'Íslenska' },
  { code: 'ig', name: 'Igbo', native: 'Igbo' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'ga', name: 'Irish', native: 'Gaeilge' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'jv', name: 'Javanese', native: 'Basa Jawa' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'kk', name: 'Kazakh', native: 'Қазақ' },
  { code: 'km', name: 'Khmer', native: 'ខ្មែរ' },
  { code: 'rw', name: 'Kinyarwanda', native: 'Kinyarwanda' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'ku', name: 'Kurdish', native: 'Kurdî' },
  { code: 'ky', name: 'Kyrgyz', native: 'Кыргызча' },
  { code: 'lo', name: 'Lao', native: 'ລາວ' },
  { code: 'la', name: 'Latin', native: 'Latina' },
  { code: 'lv', name: 'Latvian', native: 'Latviešu' },
  { code: 'lt', name: 'Lithuanian', native: 'Lietuvių' },
  { code: 'lb', name: 'Luxembourgish', native: 'Lëtzebuergesch' },
  { code: 'mk', name: 'Macedonian', native: 'Македонски' },
  { code: 'mg', name: 'Malagasy', native: 'Malagasy' },
  { code: 'ms', name: 'Malay', native: 'Bahasa Melayu' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'mt', name: 'Maltese', native: 'Malti' },
  { code: 'mi', name: 'Maori', native: 'Māori' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'mn', name: 'Mongolian', native: 'Монгол' },
  { code: 'my', name: 'Myanmar (Burmese)', native: 'မြန်မာ' },
  { code: 'ne', name: 'Nepali', native: 'नेपाली' },
  { code: 'no', name: 'Norwegian', native: 'Norsk' },
  { code: 'ny', name: 'Nyanja (Chichewa)', native: 'Chichewa' },
  { code: 'or', name: 'Odia (Oriya)', native: 'ଓଡ଼ିଆ' },
  { code: 'ps', name: 'Pashto', native: 'پښتو' },
  { code: 'fa', name: 'Persian', native: 'فارسی' },
  { code: 'pl', name: 'Polish', native: 'Polski' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'ro', name: 'Romanian', native: 'Română' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'sm', name: 'Samoan', native: 'Gagana Samoa' },
  { code: 'gd', name: 'Scots Gaelic', native: 'Gàidhlig' },
  { code: 'sr', name: 'Serbian', native: 'Српски' },
  { code: 'st', name: 'Sesotho', native: 'Sesotho' },
  { code: 'sn', name: 'Shona', native: 'Shona' },
  { code: 'sd', name: 'Sindhi', native: 'سنڌي' },
  { code: 'si', name: 'Sinhala', native: 'සිංහල' },
  { code: 'sk', name: 'Slovak', native: 'Slovenčina' },
  { code: 'sl', name: 'Slovenian', native: 'Slovenščina' },
  { code: 'so', name: 'Somali', native: 'Soomaali' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'su', name: 'Sundanese', native: 'Basa Sunda' },
  { code: 'sw', name: 'Swahili', native: 'Kiswahili' },
  { code: 'sv', name: 'Swedish', native: 'Svenska' },
  { code: 'tl', name: 'Tagalog (Filipino)', native: 'Tagalog' },
  { code: 'tg', name: 'Tajik', native: 'Тоҷикӣ' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'tt', name: 'Tatar', native: 'Татар' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'th', name: 'Thai', native: 'ไทย' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe' },
  { code: 'tk', name: 'Turkmen', native: 'Türkmen' },
  { code: 'uk', name: 'Ukrainian', native: 'Українська' },
  { code: 'ur', name: 'Urdu', native: 'اردو' },
  { code: 'ug', name: 'Uyghur', native: 'ئۇيغۇر' },
  { code: 'uz', name: 'Uzbek', native: 'Oʻzbek' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt' },
  { code: 'cy', name: 'Welsh', native: 'Cymraeg' },
  { code: 'xh', name: 'Xhosa', native: 'isiXhosa' },
  { code: 'yi', name: 'Yiddish', native: 'ייִדיש' },
  { code: 'yo', name: 'Yoruba', native: 'Yorùbá' },
  { code: 'zu', name: 'Zulu', native: 'isiZulu' },
];

// Add Language Modal Component
function AddLanguageModal({ 
  onClose, 
  onSuccess 
}: { 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<typeof GOOGLE_LANGUAGES[0] | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [sortOrder, setSortOrder] = useState(999);
  const [saving, setSaving] = useState(false);

  // Filter languages based on search query
  const filteredLanguages = GOOGLE_LANGUAGES.filter(lang => 
    lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lang.native.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lang.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectLanguage = (lang: typeof GOOGLE_LANGUAGES[0]) => {
    setSelectedLanguage(lang);
    setSearchQuery(`${lang.name} (${lang.native})`);
    setShowDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedLanguage) {
      toast.error('Please select a language');
      return;
    }
    
    try {
      setSaving(true);
      const response = await apiFetch('/api/admin/translations/languages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: selectedLanguage.code,
          name: selectedLanguage.name,
          native_name: selectedLanguage.native,
          sort_order: sortOrder,
        }),
      });

      if (response.ok) {
        toast.success('Language added successfully');
        onSuccess();
        onClose();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to add language');
      }
    } catch (error) {
      toast.error('Failed to add language');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold">Add New Language</h2>
          <p className="text-sm text-gray-600 mt-1">Select from Google Translate supported languages</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Language *
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
                setSelectedLanguage(null);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search for a language..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            
            {/* Dropdown */}
            {showDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredLanguages.length > 0 ? (
                  filteredLanguages.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleSelectLanguage(lang)}
                      className="w-full px-3 py-2 text-left hover:bg-purple-50 transition-colors flex items-center justify-between group"
                    >
                      <div>
                        <div className="font-medium text-gray-900">{lang.name}</div>
                        <div className="text-sm text-gray-600">{lang.native}</div>
                      </div>
                      <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600 group-hover:bg-purple-100 group-hover:text-purple-700">
                        {lang.code}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-4 text-center text-gray-500 text-sm">
                    No languages found
                  </div>
                )}
              </div>
            )}

            {/* Selected Language Display */}
            {selectedLanguage && (
              <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-purple-900">
                      {selectedLanguage.name} ({selectedLanguage.native})
                    </div>
                    <div className="text-xs text-purple-700 mt-1">
                      Code: <span className="font-mono">{selectedLanguage.code}</span>
                    </div>
                  </div>
                  <CheckCircle className="w-5 h-5 text-purple-600" />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sort Order
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 999)}
              min={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">Lower numbers appear first in the language list</p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !selectedLanguage}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Adding...' : 'Add Language'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Add Translation Modal Component
function AddTranslationModal({
  languageCode,
  onClose,
  onSuccess,
}: {
  languageCode: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    key: '',
    value: '',
    category: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      const response = await apiFetch(`/api/admin/translations/data/${languageCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success('Translation added successfully');
        onSuccess();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to add translation');
      }
    } catch (error) {
      toast.error('Failed to add translation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg max-w-lg w-full">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold">Add New Translation</h2>
          <p className="text-sm text-gray-600 mt-1">Language: {languageCode.toUpperCase()}</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Translation Key *
            </label>
            <input
              type="text"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              placeholder="e.g., welcome_message, login_button"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">Use snake_case or camelCase</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Translation Value *
            </label>
            <textarea
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              placeholder="Enter the translated text..."
              required
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category (Optional)
            </label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="e.g., auth, profile, settings"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Translation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
