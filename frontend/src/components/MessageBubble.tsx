'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ChartCard from './ChartCard';
import TableCard from './TableCard';
import ThinkingDisplay from './ThinkingDisplay';
import MermaidBlock from './MermaidBlock';
import MetricCard from './MetricCard';
import type { ToolResult, ChartData, TableData, ThinkingStep, SubAgent } from '@/lib/types';

interface ParsedMetricCard {
  title: string;
  items: Array<{ label: string; value: string }>;
}

type ContentSegment = { type: 'text'; content: string } | { type: 'metric_card'; data: ParsedMetricCard };

function parseContentSegments(raw: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const regex = /<metric_card>([\s\S]*?)<\/metric_card>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: raw.slice(lastIndex, match.index) });
    }
    const inner = match[1];
    const titleMatch = inner.match(/<title>(.*?)<\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : '';
    const items: Array<{ label: string; value: string }> = [];
    const itemRegex = /<item\s+label=["']([^"']*)["']\s+value=["']([^"']*)["']\s*\/>/g;
    let itemMatch: RegExpExecArray | null;
    while ((itemMatch = itemRegex.exec(inner)) !== null) {
      items.push({ label: itemMatch[1], value: itemMatch[2] });
    }
    segments.push({ type: 'metric_card', data: { title, items } });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < raw.length) {
    segments.push({ type: 'text', content: raw.slice(lastIndex) });
  }
  return segments;
}

interface MessageBubbleProps {
  role: string;
  content: string;
  displayContent?: string;
  skillName?: string;
  toolResults?: ToolResult[];
  thinkingSteps?: ThinkingStep[];
  subAgents?: SubAgent[];
  isStreaming?: boolean;
}

export default function MessageBubble({ role, content, displayContent, skillName, toolResults, thinkingSteps, subAgents, isStreaming }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] ${isUser ? 'order-1' : ''}`}>
        {!isUser && (
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#29b5e8" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="text-xs text-text-muted">CoWork Agent</span>
          </div>
        )}
        {/* Thinking steps and sub-agents (before content) */}
        {!isUser && <ThinkingDisplay steps={thinkingSteps} subAgents={subAgents} isStreaming={isStreaming} />}
        <div
          className={`text-sm leading-relaxed ${
            isUser
              ? 'bg-bg-tertiary rounded-2xl rounded-br-md px-4 py-3 text-text-primary'
              : 'text-text-primary prose-container'
          }`}
        >
          {isUser ? (
            <div>
              {skillName && (
                <span className="inline-block px-2 py-0.5 rounded bg-accent/20 text-accent text-xs font-medium mr-2 mb-1">{skillName}</span>
              )}
              {(displayContent || content).split('\n').map((line, i) => (
                <p key={i} className={i > 0 ? 'mt-2' : ''}>{line}</p>
              ))}
            </div>
          ) : content ? (
            <>{parseContentSegments(content).map((seg, idx) => {
              if (seg.type === 'metric_card') {
                return <MetricCard key={idx} title={seg.data.title} items={seg.data.items} />;
              }
              const text = seg.content.trim();
              if (!text) return null;
              return (
                <ReactMarkdown
                  key={idx}
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => <h1 className="text-xl font-bold text-text-primary mt-6 mb-3">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-lg font-bold text-text-primary mt-5 mb-2">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-base font-semibold text-text-primary mt-4 mb-2">{children}</h3>,
                    p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="text-text-primary">{children}</li>,
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-accent pl-4 my-3 text-text-secondary italic">{children}</blockquote>
                    ),
                    code: ({ className, children }) => {
                      const lang = className?.replace('language-', '') || '';
                      const isBlock = !!className?.includes('language-');
                      const codeText = String(children).replace(/\n$/, '');

                      if (isBlock && (lang === 'mermaid' || lang === 'flowchart' || lang === 'sequenceDiagram')) {
                        return <MermaidBlock code={codeText} />;
                      }
                      if (isBlock) {
                        return (
                          <pre className="bg-bg-tertiary border border-border-subtle rounded-lg p-4 my-3 overflow-x-auto">
                            <code className="text-xs text-text-primary font-mono">{children}</code>
                          </pre>
                        );
                      }
                      return <code className="bg-bg-tertiary px-1.5 py-0.5 rounded text-xs font-mono text-accent">{children}</code>;
                    },
                    pre: ({ children }) => <>{children}</>,
                    table: ({ children }) => (
                      <div className="my-4 border border-border rounded-xl overflow-hidden">
                        <table className="w-full text-sm">{children}</table>
                      </div>
                    ),
                    thead: ({ children }) => <thead className="border-b border-border bg-bg-secondary">{children}</thead>,
                    th: ({ children }) => <th className="text-left py-3 px-4 text-text-secondary font-medium">{children}</th>,
                    td: ({ children }) => <td className="py-3 px-4 text-text-primary border-b border-border-subtle">{children}</td>,
                    hr: () => <hr className="my-4 border-border" />,
                    a: ({ href, children }) => <a href={href} className="text-accent hover:underline" target="_blank" rel="noreferrer">{children}</a>,
                  }}
                >
                  {text}
                </ReactMarkdown>
              );
            })}</>
          ) : isStreaming ? (
            <div className="flex items-center gap-2 text-text-muted text-sm py-1">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:300ms]" />
              </span>
              <span className="animate-pulse">思考中...</span>
            </div>
          ) : null}
        </div>

        {/* Tool results: charts and tables */}
        {toolResults && toolResults.map((tr) => {
          if (!tr.display) return null;
          if (tr.display.type === 'chart') {
            return <ChartCard key={tr.call_id} data={tr.display.data as ChartData} sql={tr.display.sql} />;
          }
          if (tr.display.type === 'table') {
            return <TableCard key={tr.call_id} data={tr.display.data as TableData} sql={tr.display.sql} />;
          }
          return null;
        })}
      </div>
    </div>
  );
}
