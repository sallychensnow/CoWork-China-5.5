'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import UserMenu from './UserMenu';
import SearchModal from './SearchModal';
import { api } from '@/lib/api';
import { useSettings } from '@/lib/settings';
import type { Session } from '@/lib/types';

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  onNewChat?: () => void;
  onLoadSession?: (sessionId: string) => void;
}

export default function Sidebar({ collapsed = false, onToggle, onNewChat, onLoadSession }: SidebarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const pathname = usePathname();
  const router = useRouter();
  const { t, user } = useSettings();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    api.getSessions().then(d => setSessions(d.sessions || [])).catch(() => {});
  }, []);

  const handleDeleteSession = async (sid: string) => {
    await api.deleteSession(sid).catch(() => {});
    setSessions(prev => prev.filter(s => s.session_id !== sid));
  };

  const startRename = (sid: string, currentTitle: string) => {
    setRenamingId(sid);
    setRenameValue(currentTitle);
  };

  const commitRename = async () => {
    if (!renamingId || !renameValue.trim()) { setRenamingId(null); return; }
    await fetch(`/api/conversations/sessions/${renamingId}/title`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: renameValue.trim() }),
    }).catch(() => {});
    setSessions(prev => prev.map(s => s.session_id === renamingId ? { ...s, title: renameValue.trim() } : s));
    setRenamingId(null);
  };

  // Icons for nav items
  const NewChatIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
  );
  const CapIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
  );
  const ModelsIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v3"/></svg>
  );
  const SearchIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
  );

  if (collapsed) {
    return (
      <>
        <aside className="w-[60px] flex-shrink-0 bg-bg-primary border-r border-border-subtle flex flex-col items-center h-full py-4 transition-all duration-200">
          {/* Logo + toggle */}
          <div className="flex flex-col items-center gap-3 mb-4">
            <img src="/snowflake-logo.svg" alt="Snowflake" width={24} height={24} />
            <button onClick={onToggle} className="p-1.5 rounded hover:bg-bg-hover text-text-muted" title="Expand sidebar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
            </button>
          </div>

          {/* Nav icons */}
          <nav className="flex flex-col items-center gap-1">
            <Link href="/" onClick={onNewChat} className="p-2.5 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors" title={t('nav.newChat')}>
              <NewChatIcon />
            </Link>
            <Link href="/capabilities" className={`p-2.5 rounded-lg transition-colors ${pathname === '/capabilities' ? 'bg-bg-hover text-text-primary' : 'text-text-primary hover:bg-bg-hover'}`} title="Capabilities">
              <CapIcon />
            </Link>
            <Link href="/models" className={`p-2.5 rounded-lg transition-colors ${pathname === '/models' ? 'bg-bg-hover text-text-primary' : 'text-text-primary hover:bg-bg-hover'}`} title={t('nav.models')}>
              <ModelsIcon />
            </Link>
            <button onClick={() => setSearchOpen(true)} className="p-2.5 rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors" title={t('nav.search')}>
              <SearchIcon />
            </button>
          </nav>

          {/* User at bottom */}
          <div className="mt-auto relative">
            <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="p-1 hover:opacity-80" title="User">
              <div className="w-7 h-7 rounded-full bg-accent-dim flex items-center justify-center text-xs font-medium text-white">
                {user.initials || 'U'}
              </div>
            </button>
            {userMenuOpen && <UserMenu onClose={() => setUserMenuOpen(false)} />}
          </div>
        </aside>
        <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} onSelectSession={(sid) => onLoadSession?.(sid)} />
      </>
    );
  }

  return (
    <>
      <aside className="w-[272px] flex-shrink-0 bg-bg-primary border-r border-border-subtle flex flex-col h-full transition-all duration-200">
        {/* Logo + toggle */}
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/snowflake-logo.svg" alt="Snowflake" width={26} height={26} />
            <span className="text-[17px] font-semibold text-accent">Snowflake China Cowork V5</span>
          </div>
          <button onClick={onToggle} className="p-1.5 rounded hover:bg-bg-hover text-text-muted" title="Collapse sidebar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
          </button>
        </div>

        {/* New Chat */}
        <div className="px-2 mb-1">
          <Link
            href="/"
            onClick={onNewChat}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] text-text-primary hover:bg-bg-hover transition-colors"
          >
            <NewChatIcon />
            <span>{t('nav.newChat')}</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="px-2 space-y-0.5">
          <Link
            href="/capabilities"
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] transition-colors ${
              pathname === '/capabilities' ? 'bg-bg-hover text-text-primary' : 'text-text-primary hover:bg-bg-hover'
            }`}
          >
            <CapIcon />
            <span>Capabilities</span>
          </Link>
          <Link
            href="/models"
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] transition-colors ${
              pathname === '/models' ? 'bg-bg-hover text-text-primary' : 'text-text-primary hover:bg-bg-hover'
            }`}
          >
            <ModelsIcon />
            <span>{t('nav.models')}</span>
          </Link>
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] text-text-primary hover:bg-bg-hover transition-colors"
          >
            <SearchIcon />
            <span className="flex-1 text-left">{t('nav.search')}</span>
            <span className="text-xs text-text-muted">⌘K</span>
          </button>
        </nav>

        {/* Recents */}
        <div className="mt-6 px-4 flex-1 overflow-y-auto">
          <div className="text-[11px] text-text-muted uppercase tracking-wider mb-3">{t('nav.recents')}</div>
          <div className="space-y-0.5">
            {sessions.map((s) => (
              <div
                key={s.session_id}
                className="group flex items-center rounded hover:bg-bg-hover transition-colors"
              >
                {renamingId === s.session_id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null); }}
                    onBlur={() => commitRename()}
                    className="flex-1 px-2 py-1 text-xs bg-bg-tertiary text-text-primary border border-accent rounded outline-none"
                  />
                ) : (
                  <button
                    onClick={() => { if (pathname !== '/') router.push('/'); onLoadSession?.(s.session_id); }}
                    onDoubleClick={() => startRename(s.session_id, s.title)}
                    className="flex-1 text-left px-2 py-1.5 text-[13px] text-text-primary transition-colors truncate"
                  >
                    {s.title}
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); startRename(s.session_id, s.title); }}
                  className="hidden group-hover:block px-1 py-1 text-text-muted hover:text-accent transition-colors flex-shrink-0"
                  title="Rename"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.session_id); }}
                  className="hidden group-hover:block px-1 py-1 text-text-muted hover:text-red-400 transition-colors flex-shrink-0"
                  title="Delete"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
                </button>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="text-xs text-text-muted italic">{t('noConversations')}</div>
            )}
          </div>
        </div>

        {/* User */}
        <div className="relative px-4 py-3 border-t border-border-subtle">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 w-full hover:opacity-80 transition-opacity"
          >
            <div className="w-7 h-7 rounded-full bg-accent-dim flex items-center justify-center text-xs font-medium text-white">
              {user.initials || 'U'}
            </div>
            <span className="text-sm text-text-primary">{user.name || 'User'}</span>
          </button>
          {userMenuOpen && <UserMenu onClose={() => setUserMenuOpen(false)} />}
        </div>
      </aside>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} onSelectSession={(sid) => onLoadSession?.(sid)} />
    </>
  );
}
