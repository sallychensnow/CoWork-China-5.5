'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { SettingsProvider } from '@/lib/settings';
import { ChatProvider, useChatContext } from '@/lib/chat-context';

function LayoutInner({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { loadSession, newChat } = useChatContext();

  return (
    <>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        onNewChat={newChat}
        onLoadSession={loadSession}
      />
      <main className="flex-1 flex flex-col min-w-0">
        {children}
      </main>
    </>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <ChatProvider>
        <LayoutInner>{children}</LayoutInner>
      </ChatProvider>
    </SettingsProvider>
  );
}
