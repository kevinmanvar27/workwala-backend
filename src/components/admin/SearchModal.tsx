'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, LayoutDashboard, Users, Shield, FileText, ArrowRight, Loader2, Navigation } from 'lucide-react';
import type { SearchResult } from '@/app/api/admin/search/route';

const TYPE_ICON: Record<SearchResult['type'], React.ReactNode> = {
  nav:  <Navigation size={13} />,
  user: <Users size={13} />,
  role: <Shield size={13} />,
  page: <FileText size={13} />,
};

const TYPE_LABEL: Record<SearchResult['type'], string> = {
  nav:  'Navigation',
  user: 'User',
  role: 'Role',
  page: 'Page',
};

export default function SearchModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState<SearchResult[]>([]);
  const [loading, setLoading]   = useState(false);
  const [active, setActive]     = useState(0);
  const inputRef                = useRef<HTMLInputElement>(null);
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef                 = useRef<HTMLDivElement>(null);

  // Auto-focus input on open
  useEffect(() => {
    inputRef.current?.focus();
    // Load default nav items immediately
    fetch('/api/admin/search?q=')
      .then(r => r.json())
      .then(d => setResults(d.results ?? []))
      .catch(() => {});
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setActive(0);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(v => Math.min(v + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(v => Math.max(v - 1, 0));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      navigate(results[active]);
    }
  }, [results, active]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const navigate = (result: SearchResult) => {
    onClose();
    router.push(result.href);
  };

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    const key = TYPE_LABEL[r.type];
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  // Flat index map for keyboard nav
  const flat = results;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      {/* Modal panel */}
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#E0E0E0]"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#F0F0F0]">
          {loading
            ? <Loader2 size={16} className="text-[#bdbdbd] animate-spin flex-shrink-0" />
            : <Search size={16} className="text-[#bdbdbd] flex-shrink-0" style={{ color: query ? 'var(--primary)' : undefined }} />
          }
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search users, pages, roles, settings…"
            className="flex-1 text-sm text-[#2D2D2D] placeholder-[#bdbdbd] bg-transparent outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-[#bdbdbd] hover:text-[#757575] hover:bg-[#F9F9F9] transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="text-[10px] bg-[#F9F9F9] border border-[#E0E0E0] rounded px-1.5 py-0.5 text-[#757575] font-mono flex-shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto flex-1 py-2">
          {results.length === 0 && !loading && (
            <div className="px-4 py-10 text-center">
              <Search size={28} className="mx-auto text-[#E0E0E0] mb-2" />
              <p className="text-sm text-[#757575]">No results for <strong>&ldquo;{query}&rdquo;</strong></p>
              <p className="text-xs text-[#bdbdbd] mt-1">Try searching for a user, page, role, or setting</p>
            </div>
          )}

          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              {/* Group label */}
              <p className="px-4 pt-2 pb-1 text-[10px] font-bold text-[#bdbdbd] uppercase tracking-widest">
                {group}
              </p>
              {items.map((result) => {
                const idx = flat.indexOf(result);
                const isActive = idx === active;
                return (
                  <button
                    key={result.id}
                    data-idx={idx}
                    onClick={() => navigate(result)}
                    onMouseEnter={() => setActive(idx)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                    style={isActive ? { backgroundColor: 'var(--light-purple)' } : undefined}
                  >
                    {/* Type icon */}
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-white"
                      style={{ backgroundColor: isActive ? 'var(--primary)' : '#E0E0E0' }}
                    >
                      {TYPE_ICON[result.type]}
                    </span>
                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: isActive ? 'var(--primary)' : '#2D2D2D' }}
                      >
                        {result.title}
                      </p>
                      <p className="text-xs text-[#757575] truncate">{result.subtitle}</p>
                    </div>
                    {/* Arrow */}
                    <ArrowRight
                      size={13}
                      className="flex-shrink-0 transition-opacity"
                      style={{ color: 'var(--primary)', opacity: isActive ? 1 : 0 }}
                    />
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t border-[#F0F0F0] flex items-center gap-4 text-[10px] text-[#bdbdbd]">
          <span className="flex items-center gap-1">
            <kbd className="bg-[#F9F9F9] border border-[#E0E0E0] rounded px-1 py-0.5 font-mono">↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-[#F9F9F9] border border-[#E0E0E0] rounded px-1 py-0.5 font-mono">↵</kbd>
            Open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-[#F9F9F9] border border-[#E0E0E0] rounded px-1 py-0.5 font-mono">ESC</kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}
