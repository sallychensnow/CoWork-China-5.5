'use client';

import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import InputArea from './InputArea';
import type { Message } from '@/lib/types';

interface ChatViewProps {
  messages: Message[];
  onSend: (text: string, options?: { skillPrompt?: string; skillName?: string }) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  activeAgent: string;
  onAgentChange: (agent: string) => void;
}

export default function ChatView({ messages, onSend, onStop, isStreaming, activeAgent, onAgentChange }: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((msg, i) => (
            <MessageBubble key={i} role={msg.role} content={msg.content} displayContent={msg.displayContent} skillName={msg.skillName} toolResults={msg.toolResults} thinkingSteps={msg.thinkingSteps} subAgents={msg.subAgents} isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'} />
          ))}
          {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex items-center gap-2 text-text-muted text-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="animate-pulse">Thinking...</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="px-6 pb-6">
        <div className="max-w-3xl mx-auto">
          <InputArea onSend={onSend} onStop={onStop} isStreaming={isStreaming} activeAgent={activeAgent} onAgentChange={onAgentChange} />
        </div>
      </div>
    </div>
  );
}
