'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, Shield } from 'lucide-react';

interface Permission { id: number; name: string; slug: string; module: string; }
interface RoleFormProps { roleId?: number; }

export default function RoleForm({ roleId }: RoleFormProps) {
  const router = useRouter();
  const isEdit = !!roleId;

  const [form, setForm] = useState({ name: '', slug: '', description: '' });
  const [allPermissions, setAllPermissions] = useState<Record<string, Permission[]>>({});
  const [selectedPerms, setSelectedPerms] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/permissions').then((r) => r.json()).then((d) => setAllPermissions(d.grouped || {}));
    if (isEdit) {
      fetch(`/api/admin/roles/${roleId}`).then((r) => r.json()).then((d) => {
        if (d.role) {
          setForm({ name: d.role.name, slug: d.role.slug, description: d.role.description || '' });
          setSelectedPerms(d.permissions || []);
        }
      });
    }
  }, [isEdit, roleId]);

  const togglePerm = (id: number) =>
    setSelectedPerms((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);

  const toggleModule = (perms: Permission[]) => {
    const ids = perms.map((p) => p.id);
    const allSelected = ids.every((id) => selectedPerms.includes(id));
    setSelectedPerms((prev) => allSelected ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(isEdit ? `/api/admin/roles/${roleId}` : '/api/admin/roles', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, permissions: selectedPerms }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to save role'); return; }
      toast.success(isEdit ? 'Role updated!' : 'Role created!');
      router.push('/admin/roles');
    } catch { toast.error('Something went wrong'); }
    finally { setLoading(false); }
  };

  const autoSlug = (name: string) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const inputCls = "w-full bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl px-4 py-2.5 text-sm text-[#2D2D2D] placeholder-[#757575] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent focus:bg-white transition-all";
  const labelCls = "block text-xs font-semibold text-[#757575] mb-1.5 uppercase tracking-wide";

  return (
    <div className="p-6 lg:p-8 w-full">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin/roles" className="p-2 text-[#757575] hover:text-[#2D2D2D] hover:bg-[var(--light-purple)] rounded-xl transition-all">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#2D2D2D] tracking-tight">{isEdit ? 'Edit Role' : 'Add New Role'}</h1>
          <p className="text-[#757575] text-sm mt-0.5">Configure role and assign permissions</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Role info */}
        <div className="bg-white rounded-2xl border border-[#E0E0E0] p-6 shadow-sm space-y-5">
          <p className={labelCls}>Role Information</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Name <span className="text-red-400 normal-case font-normal">*</span></label>
              <input
                type="text" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value, slug: autoSlug(e.target.value) })}
                placeholder="Content Manager"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Slug <span className="text-red-400 normal-case font-normal">*</span></label>
              <input
                type="text" required value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="content-manager"
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What can this role do?"
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        {/* Permissions */}
        <div className="bg-white rounded-2xl border border-[#E0E0E0] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <p className={labelCls + ' mb-0'}>Permissions</p>
            <span className="text-xs font-semibold text-[var(--primary)] bg-[var(--light-purple)] px-2.5 py-1 rounded-full">
              {selectedPerms.length} selected
            </span>
          </div>
          <div className="space-y-3">
            {Object.entries(allPermissions).map(([module, perms]) => {
              const allSelected = perms.every((p) => selectedPerms.includes(p.id));
              const someSelected = perms.some((p) => selectedPerms.includes(p.id));
              return (
                <div key={module} className="border border-[#E0E0E0] rounded-xl overflow-hidden">
                  <div
                    className="flex items-center justify-between px-4 py-3 bg-[#F9F9F9] cursor-pointer hover:bg-[var(--light-purple)] transition-colors"
                    onClick={() => toggleModule(perms)}
                  >
                    <div className="flex items-center gap-2.5">
                      <Shield size={14} className="text-[#757575]" />
                      <span className="text-sm font-semibold text-[#2D2D2D] capitalize">{module}</span>
                      <span className="text-xs text-[#757575]">({perms.length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {someSelected && !allSelected && (
                        <span className="text-xs text-[var(--accent)] font-medium">partial</span>
                      )}
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all`}
                        style={{
                          backgroundColor: allSelected ? 'var(--primary)' : someSelected ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : 'transparent',
                          borderColor: allSelected ? 'var(--primary)' : someSelected ? 'var(--accent)' : '#E0E0E0',
                        }}
                        onClick={(e) => { e.stopPropagation(); toggleModule(perms); }}
                      >
                        {allSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        {someSelected && !allSelected && <div className="w-2 h-0.5 rounded" style={{ backgroundColor: 'var(--accent)' }} />}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-3">
                    {perms.map((perm) => {
                      const checked = selectedPerms.includes(perm.id);
                      return (
                        <label
                          key={perm.id}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-sm select-none`}
                          style={checked ? { backgroundColor: 'var(--light-purple)', color: 'var(--primary)' } : undefined}
                        >
                          <div
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all`}
                            style={{
                              backgroundColor: checked ? 'var(--primary)' : 'transparent',
                              borderColor: checked ? 'var(--primary)' : '#E0E0E0',
                            }}
                          >
                            {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </div>
                          <input type="checkbox" checked={checked} onChange={() => togglePerm(perm.id)} className="hidden" />
                          <span className="truncate">{perm.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit" disabled={loading}
            className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-60 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-all shadow-sm hover:-translate-y-px"
          >
            {loading ? 'Saving…' : isEdit ? 'Update Role' : 'Create Role'}
          </button>
          <Link href="/admin/roles" className="border border-[#E0E0E0] hover:bg-[#F9F9F9] text-[#757575] font-medium text-sm px-6 py-2.5 rounded-xl transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
