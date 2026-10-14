'use client';

import { useSettings } from '@/lib/settings';

interface UserMenuProps {
  onClose: () => void;
}

export default function UserMenu({ onClose }: UserMenuProps) {
  const { theme, locale, user, setTheme, setLocale, t } = useSettings();

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute bottom-full left-0 mb-2 w-[360px] bg-bg-secondary border border-border rounded-xl shadow-xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
        <h3 className="text-sm font-semibold text-text-primary">{t('settings.title')}</h3>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary text-lg">✕</button>
      </div>
      <div className="p-5 space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">{t('settings.name')}</span>
          <span className="text-sm text-text-primary">{user.name || 'User'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">{t('settings.email')}</span>
          <span className="text-sm text-text-primary">{user.email || '-'}</span>
        </div>
        {/* Theme */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">{t('settings.theme')}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setTheme('light')}
              className={`px-3 py-1 rounded text-xs border transition-colors ${
                theme === 'light' ? 'border-accent text-text-primary bg-bg-tertiary' : 'border-border-subtle text-text-muted hover:text-text-secondary'
              }`}
            >
              Light
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`px-3 py-1 rounded text-xs border transition-colors ${
                theme === 'dark' ? 'border-accent text-text-primary bg-bg-tertiary' : 'border-border-subtle text-text-muted hover:text-text-secondary'
              }`}
            >
              Dark
            </button>
          </div>
        </div>
        {/* Language */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">{t('settings.language')}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setLocale('en')}
              className={`px-3 py-1 rounded text-xs border transition-colors ${
                locale === 'en' ? 'border-accent text-text-primary bg-bg-tertiary' : 'border-border-subtle text-text-muted hover:text-text-secondary'
              }`}
            >
              English
            </button>
            <button
              onClick={() => setLocale('zh')}
              className={`px-3 py-1 rounded text-xs border transition-colors ${
                locale === 'zh' ? 'border-accent text-text-primary bg-bg-tertiary' : 'border-border-subtle text-text-muted hover:text-text-secondary'
              }`}
            >
              中文
            </button>
          </div>
        </div>
        {/* Account — org.account */}
        <div className="pt-3 border-t border-border-subtle space-y-3">
          {user.org && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Organization</span>
              <span className="text-xs text-text-muted bg-bg-tertiary px-2 py-1 rounded">{user.org}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">{t('settings.account')}</span>
            <span className="text-xs text-text-muted bg-bg-tertiary px-2 py-1 rounded">
              {user.org && user.account ? `${user.org}-${user.account}` : user.account || '-'}
            </span>
          </div>
          {user.role && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Role</span>
              <span className="text-xs text-text-muted bg-bg-tertiary px-2 py-1 rounded">{user.role}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Warehouse</span>
            <span className="text-xs text-text-muted bg-bg-tertiary px-2 py-1 rounded">{user.warehouse || '-'}</span>
          </div>
        </div>
        <button
          onClick={() => { window.location.href = '/_oauth/logout'; }}
          className="w-full text-left text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          {t('settings.signout')}
        </button>
      </div>
    </div>
    </>
  );
}
