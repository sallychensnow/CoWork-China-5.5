'use client';

import { createContext, useContext } from 'react';
import { useChat, type UseChatReturn } from '@/hooks/useChat';

const ChatContext = createContext<UseChatReturn | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const chat = useChat();
  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
}

export function useChatContext(): UseChatReturn {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
}
