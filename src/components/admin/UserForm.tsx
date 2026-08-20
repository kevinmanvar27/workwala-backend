'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { apiFetch } from '@/lib/apiFetch';
import { ArrowLeft, Upload, X, Camera } from 'lucide-react';

interface Role { id: number; name: string; }
interface UserFormProps { userId?: number; }

export default function UserForm({ userId }: UserFormProps) {
  const router = useRouter();
  const isEdit = !!userId;

  const [form, setForm] = useState({ name: '', email: '', password: '', role_id: '', status: 'active' });
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/roles').then((r) => r.json()).then((d) => setRoles(d.roles || []));
    if (isEdit) {
      fetch(`/api/admin/users/${userId}`).then((r) => r.json()).then((d) => {
        if (d.user) {
          setForm({ name: d.user.name, email: d.user.email, password: '', role_id: d.user.role_id?.toString() || '', status: d.user.status });
          setCurrentAvatar(d.user.avatar || null);
        }
      });
    }
  }, [isEdit, userId]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Max file size is 5MB'); return; }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: Record<string, string> = { name: form.name, email: form.email, role_id: form.role_id, status: form.status };
      if (form.password) payload.password = form.password;

      const res = await apiFetch(isEdit ? `/api/admin/users/${userId}` : '/api/admin/users', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to save user'); return; }

      const savedId = isEdit ? userId : data.id;
      if (avatarFile && savedId) {
        const fd = new FormData();
        fd.append('avatar', avatarFile);
        const ar = await apiFetch(`/api/admin/users/${savedId}/avatar`, { method: 'POST', body: fd });
        if (!ar.ok) toast.error('User saved but avatar upload failed');
      }

      toast.success(isEdit ? 'User updated!' : 'User created!');
      router.push('/admin/users');
    } catch { toast.error('Something went wrong'); }
    finally { setLoading(false); }
  };

  const displayAvatar = avatarPreview || currentAvatar;

  const inputCls = "w-full bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl px-4 py-2.5 text-sm text-[#2D2D2D] placeholder-[#757575] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent focus:bg-white transition-all";
  const labelCls = "block text-xs font-semibold text-[#757575] mb-1.5 uppercase tracking-wide";

  return (
    <div className="p-6 lg:p-8 w-full">
      {/* Back + title */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/admin/users"
          className="p-2 text-[#757575] hover:text-[#2D2D2D] hover:bg-[var(--light-purple)] rounded-xl transition-all"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#2D2D2D] tracking-tight">
            {isEdit ? 'Edit User' : 'Add New User'}
          </h1>
          <p className="text-[#757575] text-sm mt-0.5">
            {isEdit ? 'Update user account details' : 'Create a new user account'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Avatar card */}
        <div className="bg-white rounded-2xl border border-[#E0E0E0] p-6 shadow-sm">
          <p className="text-xs font-semibold text-[#757575] uppercase tracking-wide mb-4">Profile Photo</p>
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}>
                {displayAvatar
                  ? <img src={displayAvatar} alt="Avatar" className="w-full h-full object-cover" />
                  : <span>{form.name[0]?.toUpperCase() || 'U'}</span>
                }
              </div>
              <label className="absolute -bottom-1.5 -right-1.5 w-7 h-7 text-white rounded-full flex items-center justify-center cursor-pointer shadow-md transition-colors" style={{ backgroundColor: 'var(--accent)' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent-dark)')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}>
                <Camera size={13} />
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </label>
            </div>
            <div>
              <label className="cursor-pointer inline-flex items-center gap-2 bg-[var(--light-purple)] text-[var(--primary)] text-sm font-medium px-4 py-2 rounded-xl transition-colors hover:opacity-90">
                <Upload size={14} />
                Upload Photo
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </label>
              <p className="text-xs text-[#757575] mt-1.5">JPG, PNG, GIF, WEBP · max 5MB</p>
              {avatarPreview && (
                <button
                  type="button"
                  onClick={() => { setAvatarFile(null); setAvatarPreview(null); }}
                  className="mt-1.5 text-xs text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors"
                >
                  <X size={11} /> Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Details card */}
        <div className="bg-white rounded-2xl border border-[#E0E0E0] p-6 shadow-sm space-y-5">
          <p className="text-xs font-semibold text-[#757575] uppercase tracking-wide">Account Details</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Full Name <span className="text-red-400 normal-case font-normal">*</span></label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email Address <span className="text-red-400 normal-case font-normal">*</span></label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>
              Password{' '}
              {isEdit && <span className="text-[#757575] normal-case font-normal tracking-normal">— leave blank to keep current</span>}
            </label>
            <input
              type="password"
              required={!isEdit}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={isEdit ? '••••••••' : 'Min. 8 characters'}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Role</label>
              <select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })} className={inputCls}>
                <option value="">No Role</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="banned">Banned</option>
              </select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-60 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-all shadow-sm hover:-translate-y-px"
          >
            {loading ? 'Saving…' : isEdit ? 'Update User' : 'Create User'}
          </button>
          <Link
            href="/admin/users"
            className="border border-[#E0E0E0] hover:bg-[#F9F9F9] text-[#757575] font-medium text-sm px-6 py-2.5 rounded-xl transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
