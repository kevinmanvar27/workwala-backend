'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  Tag, X, Check, Loader2, GripVertical,
} from 'lucide-react';
import PermissionGuard from '@/components/admin/PermissionGuard';
import { apiFetch } from '@/lib/apiFetch';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price_per_hour: number;
  bg_color: string;
  border_color: string;
  is_active: number;
  sort_order: number;
  created_at: string;
}

const PRESET_COLORS = [
  { bg: '#F0F5FF', border: '#6B9BFA', label: 'Blue'   },
  { bg: '#F0FAF4', border: '#4AC48B', label: 'Green'  },
  { bg: '#FFF0F5', border: '#D677B7', label: 'Pink'   },
  { bg: '#FFF8EA', border: '#D9A05B', label: 'Yellow' },
  { bg: '#FCF0F0', border: '#C77878', label: 'Red'    },
  { bg: '#F3F0FF', border: '#8B5CF6', label: 'Purple' },
  { bg: '#F0FAFA', border: '#2DD4BF', label: 'Teal'   },
  { bg: '#FFF5F0', border: '#FB923C', label: 'Orange' },
];

const EMPTY_FORM = {
  name: '',
  description: '',
  price_per_hour: '',
  bg_color: '#F0F5FF',
  border_color: '#6B9BFA',
  is_active: true,
  sort_order: '0',
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState<number | null>(null);

  // Modal state
  const [modal, setModal]   = useState<'create' | 'edit' | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm]     = useState({ ...EMPTY_FORM });

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/categories');
      const data = await res.json();
      if (res.ok) setCategories(data.categories);
      else toast.error(data.error || 'Failed to load categories');
    } catch {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  // ── Open modals ────────────────────────────────────────────────────────────

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, sort_order: String(categories.length) });
    setEditId(null);
    setModal('create');
  };

  const openEdit = (cat: Category) => {
    setForm({
      name:          cat.name,
      description:   cat.description || '',
      price_per_hour: String(cat.price_per_hour),
      bg_color:      cat.bg_color,
      border_color:  cat.border_color,
      is_active:     cat.is_active === 1,
      sort_order:    String(cat.sort_order),
    });
    setEditId(cat.id);
    setModal('edit');
  };

  const closeModal = () => { setModal(null); setEditId(null); };

  // ── Save (create / update) ─────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    const price = parseFloat(form.price_per_hour);
    if (isNaN(price) || price < 0) { toast.error('Enter a valid price'); return; }

    setSaving(true);
    try {
      const isEdit  = modal === 'edit';
      const payload = {
        ...(isEdit ? { id: editId } : {}),
        name:          form.name.trim(),
        description:   form.description.trim() || null,
        price_per_hour: price,
        bg_color:      form.bg_color,
        border_color:  form.border_color,
        is_active:     form.is_active,
        sort_order:    parseInt(form.sort_order) || 0,
      };

      const res  = await apiFetch('/api/admin/categories', {
        method:  isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(isEdit ? 'Category updated' : 'Category created');
        closeModal();
        fetchCategories();
      } else {
        toast.error(data.error || 'Save failed');
      }
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle active ──────────────────────────────────────────────────────────

  const handleToggle = async (cat: Category) => {
    try {
      const res = await apiFetch('/api/admin/categories', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: cat.id, is_active: cat.is_active === 0 }),
      });
      if (res.ok) {
        toast.success(cat.is_active === 1 ? 'Category deactivated' : 'Category activated');
        fetchCategories();
      }
    } catch {
      toast.error('Failed to update');
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async (cat: Category) => {
    if (!confirm(`Delete category "${cat.name}"? This cannot be undone.`)) return;
    setDeleting(cat.id);
    try {
      const res = await apiFetch('/api/admin/categories', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: cat.id }),
      });
      if (res.ok) {
        toast.success('Category deleted');
        fetchCategories();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Delete failed');
      }
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <PermissionGuard permission="users.view">
      <div className="p-6 lg:p-8 w-full">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#2D2D2D] tracking-tight">Categories</h1>
            <p className="text-[#757575] text-sm mt-1">
              {categories.length} {categories.length === 1 ? 'category' : 'categories'} · prices shown in the app
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-xl transition-all hover:opacity-90"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <Plus size={16} />
            Add Category
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E0E0E0]">
                  {/* Sr. No. column header */}
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5 w-12">Sr.</th>
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5">Category</th>
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5">Price / Hr</th>
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5 hidden md:table-cell">Color</th>
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5 hidden lg:table-cell">Sort</th>
                  <th className="text-left text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5">Status</th>
                  <th className="text-right text-[11px] font-semibold text-[#757575] uppercase tracking-wider px-6 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-[#F9F9F9]">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[var(--light-purple)] animate-pulse" />
                          <div className="space-y-1.5">
                            <div className="h-3 bg-[var(--light-purple)] rounded w-28 animate-pulse" />
                            <div className="h-2.5 bg-[var(--light-purple)] rounded w-20 animate-pulse" />
                          </div>
                        </div>
                      </td>
                      {[...Array(6)].map((_, j) => (
                        <td key={j} className="px-6 py-4">
                          <div className="h-3 bg-[var(--light-purple)] rounded w-16 animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : categories.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="w-14 h-14 bg-[var(--light-purple)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Tag size={24} style={{ color: 'var(--primary)' }} />
                      </div>
                      <p className="text-[#757575] font-medium text-sm">No categories yet</p>
                      <p className="text-[#bdbdbd] text-xs mt-1">Click "Add Category" to get started</p>
                    </td>
                  </tr>
                ) : (
                  categories.map((cat, index) => (
                    <tr key={cat.id} className="border-b border-[#F9F9F9] last:border-0 hover:bg-[#F9F9F9]/60 transition-colors">

                      {/* Sr. No. cell */}
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-[#757575]">{index + 1}</span>
                      </td>

                      {/* Name + slug */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {/* Color preview swatch */}
                          <div
                            className="w-9 h-9 rounded-xl border flex-shrink-0"
                            style={{ backgroundColor: cat.bg_color, borderColor: cat.border_color }}
                          />
                          <div>
                            <p className="text-sm font-semibold text-[#2D2D2D]">{cat.name}</p>
                            <p className="text-xs text-[#bdbdbd] font-mono">{cat.slug}</p>
                          </div>
                        </div>
                      </td>

                      {/* Price */}
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-[#2D2D2D]">₹{cat.price_per_hour}</span>
                        <span className="text-xs text-[#757575]">/hr</span>
                      </td>

                      {/* Color codes */}
                      <td className="px-6 py-4 hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-[#757575]">{cat.bg_color}</span>
                          <span className="text-[#bdbdbd]">·</span>
                          <span className="text-xs font-mono text-[#757575]">{cat.border_color}</span>
                        </div>
                      </td>

                      {/* Sort order */}
                      <td className="px-6 py-4 hidden lg:table-cell">
                        <span className="text-sm text-[#757575]">{cat.sort_order}</span>
                      </td>

                      {/* Active toggle */}
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggle(cat)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium transition-all"
                          title={cat.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {cat.is_active === 1 ? (
                            <>
                              <ToggleRight size={20} className="text-[#2E7D32]" />
                              <span className="text-[#2E7D32] hidden sm:inline">Active</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft size={20} className="text-[#bdbdbd]" />
                              <span className="text-[#bdbdbd] hidden sm:inline">Inactive</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(cat)}
                            className="p-2 text-[#757575] hover:bg-[var(--light-purple)] rounded-lg transition-all"
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#757575')}
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(cat)}
                            disabled={deleting === cat.id}
                            className="p-2 text-[#757575] hover:bg-red-50 hover:text-red-600 rounded-lg transition-all disabled:opacity-40"
                            title="Delete"
                          >
                            {deleting === cat.id
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Trash2 size={14} />
                            }
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Create / Edit Modal ─────────────────────────────────────────────── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0E0E0]">
              <h2 className="text-base font-bold text-[#2D2D2D]">
                {modal === 'create' ? 'Add Category' : 'Edit Category'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 text-[#757575] hover:bg-[#F9F9F9] rounded-lg transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. House Keeping"
                  className="w-full px-4 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Short description (optional)"
                  rows={2}
                  className="w-full px-4 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all resize-none"
                />
              </div>

              {/* Price per hour */}
              <div>
                <label className="block text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5">
                  Price Per Hour (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#757575]">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price_per_hour}
                    onChange={(e) => setForm((f) => ({ ...f, price_per_hour: e.target.value }))}
                    placeholder="100"
                    className="w-full pl-8 pr-4 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] placeholder-[#bdbdbd] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="block text-xs font-semibold text-[#757575] uppercase tracking-wider mb-2">
                  App Display Color
                </label>
                {/* Preset swatches */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {PRESET_COLORS.map((p) => {
                    const isSelected = form.bg_color === p.bg && form.border_color === p.border;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, bg_color: p.bg, border_color: p.border }))}
                        className="relative flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all"
                        style={{
                          backgroundColor: p.bg,
                          borderColor: isSelected ? p.border : '#E0E0E0',
                        }}
                      >
                        {isSelected && (
                          <span
                            className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: p.border }}
                          >
                            <Check size={9} color="white" />
                          </span>
                        )}
                        <div
                          className="w-6 h-6 rounded-lg border"
                          style={{ backgroundColor: p.bg, borderColor: p.border, borderWidth: 2 }}
                        />
                        <span className="text-[10px] font-medium text-[#757575]">{p.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom hex inputs */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-[#757575] mb-1">Background</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.bg_color}
                        onChange={(e) => setForm((f) => ({ ...f, bg_color: e.target.value }))}
                        className="w-8 h-8 rounded-lg border border-[#E0E0E0] cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={form.bg_color}
                        onChange={(e) => setForm((f) => ({ ...f, bg_color: e.target.value }))}
                        className="flex-1 px-3 py-1.5 border border-[#E0E0E0] rounded-lg text-xs font-mono text-[#2D2D2D] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#757575] mb-1">Border / Icon</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={form.border_color}
                        onChange={(e) => setForm((f) => ({ ...f, border_color: e.target.value }))}
                        className="w-8 h-8 rounded-lg border border-[#E0E0E0] cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={form.border_color}
                        onChange={(e) => setForm((f) => ({ ...f, border_color: e.target.value }))}
                        className="flex-1 px-3 py-1.5 border border-[#E0E0E0] rounded-lg text-xs font-mono text-[#2D2D2D] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                      />
                    </div>
                  </div>
                </div>

                {/* Live preview */}
                <div className="mt-3 p-3 rounded-xl border" style={{ backgroundColor: form.bg_color, borderColor: form.border_color }}>
                  <p className="text-xs font-semibold" style={{ color: form.border_color }}>
                    Preview — {form.name || 'Category Name'}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: form.border_color, opacity: 0.7 }}>
                    ₹{form.price_per_hour || '0'}/hr
                  </p>
                </div>
              </div>

              {/* Sort order + Active */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.sort_order}
                    onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#757575] uppercase tracking-wider mb-1.5">
                    Status
                  </label>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium transition-all"
                    style={form.is_active
                      ? { borderColor: '#4AC48B', backgroundColor: '#F0FAF4', color: '#2E7D32' }
                      : { borderColor: '#E0E0E0', backgroundColor: '#F9F9F9', color: '#757575' }
                    }
                  >
                    {form.is_active
                      ? <><ToggleRight size={16} /> Active</>
                      : <><ToggleLeft size={16} /> Inactive</>
                    }
                  </button>
                </div>
              </div>

              {/* Save / Cancel */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 border border-[#E0E0E0] rounded-xl text-sm font-semibold text-[#757575] hover:bg-[#F9F9F9] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  {saving
                    ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                    : <><Check size={14} /> {modal === 'create' ? 'Create' : 'Save Changes'}</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PermissionGuard>
  );
}
