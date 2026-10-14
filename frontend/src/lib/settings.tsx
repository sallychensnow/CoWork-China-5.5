'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'dark' | 'light';
type Locale = 'en' | 'zh';

interface UserInfo {
  name: string;
  email: string;
  initials: string;
  account: string;
  org: string;
  role: string;
  warehouse: string;
}

interface SettingsContextType {
  theme: Theme;
  locale: Locale;
  user: UserInfo;
  setTheme: (t: Theme) => void;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const translations: Record<string, Record<Locale, string>> = {
  'nav.newChat': { en: 'New Chat', zh: '新对话' },
  'nav.agents': { en: 'Agents', zh: '智能体' },
  'nav.models': { en: 'Models', zh: '模型' },
  'nav.search': { en: 'Search', zh: '搜索' },
  'nav.recents': { en: 'Recents', zh: '最近' },
  'nav.showMore': { en: 'Show more', zh: '显示更多' },
  'welcome.greeting.morning': { en: 'Good morning', zh: '早上好' },
  'welcome.greeting.afternoon': { en: 'Good afternoon', zh: '下午好' },
  'welcome.greeting.evening': { en: 'Good evening', zh: '晚上好' },
  'welcome.greeting.night': { en: 'Good night', zh: '晚安' },
  'welcome.subtitle': { en: 'What insights can I help with?', zh: '有什么可以帮到你？' },
  'input.placeholder': { en: 'Ask a question to get started...', zh: '输入问题开始对话...' },
  'settings.title': { en: 'Settings', zh: '设置' },
  'settings.name': { en: 'Preferred name', zh: '显示名称' },
  'settings.email': { en: 'Email', zh: '邮箱' },
  'settings.theme': { en: 'Theme', zh: '主题' },
  'settings.language': { en: 'Language', zh: '语言' },
  'settings.account': { en: 'Account', zh: '账号' },
  'settings.signout': { en: 'Sign out', zh: '退出登录' },
  'agents.title': { en: 'Agents', zh: '智能体配置' },
  'agents.new': { en: '+ New Agent', zh: '+ 新建智能体' },
  'agents.activate': { en: 'Activate', zh: '激活' },
  'agents.active': { en: 'Active', zh: '已激活' },
  'agents.edit': { en: 'Edit', zh: '编辑' },
  'agents.delete': { en: 'Delete', zh: '删除' },
  'agents.editAgent': { en: 'Edit Agent', zh: '编辑智能体' },
  'agents.newAgent': { en: 'New Agent', zh: '新建智能体' },
  'agents.name': { en: 'Name', zh: '名称' },
  'agents.description': { en: 'Description', zh: '描述' },
  'agents.systemPrompt': { en: 'System Prompt', zh: '系统提示词' },
  'agents.systemPromptPlaceholder': { en: "Define the agent's behavior, personality, and instructions...", zh: '定义智能体的行为、角色和指令...' },
  'agents.tools': { en: 'Tools', zh: '工具' },
  'agents.semanticModels': { en: 'Semantic Models (from Stage)', zh: '语义模型（来自Stage）' },
  'agents.searchServices': { en: 'Cortex Search Services', zh: 'Cortex 搜索服务' },
  'agents.selectDbHint': { en: 'Select a database above to discover search services', zh: '请先选择数据库以发现搜索服务' },
  'agents.cancel': { en: 'Cancel', zh: '取消' },
  'agents.save': { en: 'Save', zh: '保存' },
  'agents.database': { en: 'Database...', zh: '数据库...' },
  'agents.schema': { en: 'Schema...', zh: 'Schema...' },
  'agents.stage': { en: 'Stage...', zh: 'Stage...' },
  'models.title': { en: 'Models', zh: '模型选择' },
  'noConversations': { en: 'No conversations yet', zh: '暂无对话记录' },
};

function getInitials(name: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [locale, setLocaleState] = useState<Locale>('zh');
  const [user, setUser] = useState<UserInfo>({ name: '', email: '', initials: '', account: '', org: '', role: '', warehouse: '' });

  useEffect(() => {
    const saved = localStorage.getItem('cowork-theme') as Theme;
    const savedLocale = localStorage.getItem('cowork-locale') as Locale;
    if (saved) setThemeState(saved);
    if (savedLocale) setLocaleState(savedLocale);

    // Fetch greeting for time-aware greeting only (not for name)
    fetch('/api/agent/greeting')
      .then(r => r.json())
      .then(() => {
        // greeting data used by WelcomeScreen directly, not for user name
      })
      .catch(() => {});

    // Fetch full user identity from Snowflake (authoritative source for name)
    fetch('/api/agent/user-info')
      .then(r => r.json())
      .then(data => {
        const displayName = data?.display_name || data?.user || '';
        setUser(prev => ({
          ...prev,
          name: displayName || prev.name,
          email: data?.email || prev.email,
          account: data?.account || prev.account,
          org: data?.org || '',
          role: data?.role || '',
          warehouse: data?.warehouse || '',
          initials: getInitials(displayName) || prev.initials || getInitials(data?.user || ''),
        }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cowork-theme', theme);
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);
  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem('cowork-locale', l);
  };

  const t = (key: string): string => {
    return translations[key]?.[locale] || key;
  };

  return (
    <SettingsContext.Provider value={{ theme, locale, user, setTheme, setLocale, t }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be inside SettingsProvider');
  return ctx;
}
