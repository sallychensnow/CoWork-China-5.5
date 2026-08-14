'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { useSettings } from '@/lib/settings';

interface SearchResult {
  session_id: string;
  title: string;
  updated_at: string | null;
  message_count: number;
  matched_content: string | null;
  matched_role: string | null;
}

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
}

export default function SearchModal({ open, onClose, onSelectSession }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useSettings();
  const debounceRef = useRef<NodeJS.Timeout>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults([]);
    }
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const data = await api.searchConversations(q);
      setResults(data.results || []);
    } catch {
      setResults([]);
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border-subtle">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            placeholder={t('nav.search') + '...'}
            className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted text-sm outline-none"
          />
          <kbd className="text-[10px] text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded border border-border-subtle">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {loading && (
            <div className="px-5 py-6 text-center text-sm text-text-muted">搜索中...</div>
          )}
          {!loading && query && results.length === 0 && (
            <div className="px-5 py-6 text-center text-sm text-text-muted">未找到相关对话</div>
          )}
          {!loading && results.map((r) => (
            <button
              key={r.session_id}
              onClick={() => { onSelectSession(r.session_id); onClose(); }}
              className="w-full text-left px-5 py-3 hover:bg-bg-hover transition-colors border-b border-border-subtle last:border-0"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary truncate">{r.title}</span>
                <span className="text-[10px] text-text-muted ml-2 flex-shrink-0">
                  {r.message_count} msgs
                </span>
              </div>
              {r.matched_content && (
                <p className="text-xs text-text-muted mt-1 line-clamp-2">{r.matched_content}</p>
              )}
            </button>
          ))}
          {!loading && !query && (
            <div className="px-5 py-6 text-center text-sm text-text-muted">输入关键词搜索历史对话</div>
          )}
        </div>
      </div>
    </div>
  );
}
