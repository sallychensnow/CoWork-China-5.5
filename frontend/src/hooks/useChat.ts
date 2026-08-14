'use client';

import { useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import type { Message, ToolResult, ThinkingStep, SubAgent } from '@/lib/types';

export type UseChatReturn = ReturnType<typeof useChat>;

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeAgent, setActiveAgent] = useState('customer_analyst');
  const abortRef = useRef<AbortController | null>(null);

  // Poll deep research task until completed or timeout
  async function pollResearch(taskId: string, maxMs = 180000, onProgress?: (agents: SubAgent[]) => void): Promise<string | null> {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      await new Promise(r => setTimeout(r, 3000));
      const status = await api.getResearchStatus(taskId);
      // Update sub-agents from poll response
      if (status.sub_agents && onProgress) {
        onProgress(status.sub_agents.map((a: Record<string, string>) => ({
          id: a.id,
          role: a.role,
          task: a.task,
          status: a.status as SubAgent['status'],
        })));
      }
      if (status.status === 'completed' || status.status === 'error') {
        if (status.result?.success) {
          return status.result.result || '研究完成';
        }
        return status.result?.result || '研究失败';
      }
    }
    return '深度研究超时';
  }

  const sendMessage = useCallback(async (text: string, options?: { skillPrompt?: string; skillName?: string }) => {
    // If skill is active: content = full prompt (for AI), displayContent = user text (for UI)
    let apiContent = text;
    const userMsg: Message = { role: 'user', content: text };

    if (options?.skillPrompt) {
      // Combine skill prompt + user's additional text as the actual content for AI
      apiContent = options.skillPrompt + (text ? `\n\n用户补充: ${text}` : '');
      userMsg.content = apiContent; // full content for API history
      userMsg.displayContent = text || options.skillName || ''; // short display
      userMsg.skillName = options.skillName;
    }

    setMessages(prev => [...prev, userMsg]);

    // Create session if needed
    let sid = sessionId;
    if (!sid) {
      const title = options?.skillName || text.slice(0, 50);
      const res = await api.createSession(title);
      if (res.success) {
        sid = res.session_id;
        setSessionId(sid);
      }
    }

    // Save user message (save displayable version)
    if (sid) {
      api.saveMessage(sid, { role: 'user', content: userMsg.displayContent || text });
    }

    // Build message history for API — use full content (with prompt)
    const apiMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

    // Start streaming
    setIsStreaming(true);
    const assistantMsg: Message = { role: 'assistant', content: '', isStreaming: true };
    setMessages(prev => [...prev, assistantMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const body: Record<string, unknown> = { messages: apiMessages, agent_id: activeAgent };
      const response = await fetch('/api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let fullContent = '';
      const toolResults: ToolResult[] = [];
      const thinkingSteps: ThinkingStep[] = [];
      const subAgents: SubAgent[] = [];

      const updateMsg = () => {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: fullContent,
            isStreaming: true,
            toolResults: toolResults.length > 0 ? [...toolResults] : undefined,
            thinkingSteps: thinkingSteps.length > 0 ? [...thinkingSteps] : undefined,
            subAgents: subAgents.length > 0 ? [...subAgents] : undefined,
          };
          return updated;
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content' && parsed.content) {
              fullContent += parsed.content;
              updateMsg();
            } else if (parsed.type === 'tool_result' && parsed.display) {
              toolResults.push({
                call_id: parsed.call_id || String(toolResults.length),
                tool: parsed.tool || 'unknown',
                success: parsed.success ?? true,
                display: parsed.display,
              });
              updateMsg();
            } else if (parsed.type === 'thinking' || parsed.type === 'tool_start' || parsed.type === 'status') {
              const stepText = parsed.text || parsed.message || parsed.tool || 'Thinking...';
              thinkingSteps.push({
                id: parsed.call_id || String(thinkingSteps.length),
                text: stepText,
                type: parsed.type === 'tool_start' ? 'data' : 'thinking',
                expandable: true,
              });
              updateMsg();
            } else if (parsed.type === 'sub_agent') {
              const existing = subAgents.find(a => a.id === parsed.agent_id);
              if (existing) {
                existing.status = parsed.status || 'running';
                existing.task = parsed.task || existing.task;
              } else {
                subAgents.push({
                  id: parsed.agent_id || String(subAgents.length),
                  role: parsed.role || 'Swarm Worker',
                  task: parsed.task || '',
                  status: parsed.status || 'running',
                });
              }
              updateMsg();
            } else if (parsed.type === 'deep_research_async') {
              // Deep research — start async polling
              const resQuery = parsed.query || text;
              subAgents.push({
                id: 'orchestrator',
                role: 'Orchestrator',
                task: '分解研究任务...',
                status: 'running',
              });
              updateMsg();

              // Start polling in background
              try {
                const startRes = await api.startResearch(resQuery, activeAgent);
                const taskId = startRes.task_id;
                if (taskId) {
                  const pollResult = await pollResearch(taskId, 180000, (pollAgents: SubAgent[]) => {
                    // Update sub-agents in real-time from poll
                    subAgents.length = 0;
                    pollAgents.forEach(a => subAgents.push(a));
                    updateMsg();
                  });
                  if (pollResult) {
                    fullContent += '\n\n' + pollResult;
                    updateMsg();
                  }
                }
              } catch (e) {
                fullContent += '\n\n深度研究执行失败';
                updateMsg();
              }
            }
          } catch {
            // skip malformed
          }
        }
      }

      // Finalize
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: fullContent,
          isStreaming: false,
          toolResults: toolResults.length > 0 ? toolResults : undefined,
          thinkingSteps: thinkingSteps.length > 0 ? thinkingSteps : undefined,
          subAgents: subAgents.length > 0 ? subAgents : undefined,
        };
        return updated;
      });

      // Save assistant message
      if (sid && fullContent) {
        api.saveMessage(sid, { role: 'assistant', content: fullContent });
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: '连接失败，请检查后端服务是否运行。', isStreaming: false };
        return updated;
      });
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [messages, sessionId, activeAgent]);

  const loadSession = useCallback(async (sid: string) => {
    const res = await api.getMessages(sid);
    if (res.messages) {
      setMessages(res.messages.map((m: Record<string, string>) => ({
        role: m.role as Message['role'],
        content: m.content,
      })));
      setSessionId(sid);
    }
  }, []);

  const newChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
  }, []);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, isStreaming, sendMessage, loadSession, newChat, stopStreaming, sessionId, activeAgent, setActiveAgent };
}
