'use client';

import { useState } from 'react';
import type { ThinkingStep, SubAgent } from '@/lib/types';

interface ThinkingDisplayProps {
  steps?: ThinkingStep[];
  subAgents?: SubAgent[];
  isStreaming?: boolean;
}

export default function ThinkingDisplay({ steps, subAgents, isStreaming }: ThinkingDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  if (!steps?.length && !subAgents?.length) return null;

  // During streaming: show only the latest step as current activity
  // After streaming: collapse all steps into a single expandable summary
  const latestStep = steps?.[steps.length - 1];
  const hasSteps = steps && steps.length > 0;

  return (
    <div className="space-y-2 mb-3">
      {/* Thinking steps */}
      {hasSteps && (
        <div>
          {isStreaming ? (
            // While streaming: show the current step with spinner
            <div className="flex items-center gap-2 text-sm text-accent">
              <span className="w-4 h-4 animate-spin inline-block flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              </span>
              <span>{latestStep?.text || '思考中...'}</span>
            </div>
          ) : (
            // After done: show collapsible summary
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span>思考过程 ({steps!.length} 步)</span>
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
              >
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          )}

          {/* Expanded step list (only when not streaming and expanded) */}
          {!isStreaming && expanded && (
            <div className="mt-2 ml-5 pl-3 border-l-2 border-border-subtle space-y-1.5">
              {steps!.map((step, idx) => (
                <div key={step.id} className="flex items-center gap-2 text-xs text-text-muted">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span>{step.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sub-agents (Deep Research swarm cards) */}
      {subAgents && subAgents.length > 0 && (
        <div className="space-y-2 mt-2">
          {subAgents.map(agent => (
            <div
              key={agent.id}
              className="flex items-center justify-between px-4 py-3 rounded-xl border border-border-subtle bg-bg-secondary"
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                    </svg>
                    <span className="text-xs font-semibold text-accent uppercase tracking-wide">SUB-AGENT</span>
                    <span className="text-xs text-text-muted">· {agent.role}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    {agent.status === 'running' && (
                      <span className="inline-block w-3 h-3 text-accent animate-spin">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                        </svg>
                      </span>
                    )}
                    {agent.status === 'done' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    )}
                    <span className="text-sm text-text-primary">{agent.task}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {agent.status === 'planning' && (
                  <span className="text-xs text-text-muted">Planning...</span>
                )}
                {agent.status === 'running' && (
                  <span className="text-xs text-text-muted">Working...</span>
                )}
                {agent.status === 'done' && (
                  <span className="text-xs text-green-400">Done</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
