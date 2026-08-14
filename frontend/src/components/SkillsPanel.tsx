'use client';

import { useState, useEffect } from 'react';

export interface Skill {
  id: string;
  name: string;
  description: string;
  trigger: string;
  icon?: string;
  category: string;
  prompt?: string;
  agent_id: string | null;
}

interface SkillsPanelProps {
  agentId: string;
  onSelect: (skill: Skill) => void;
  onClose: () => void;
}

export default function SkillsPanel({ agentId, onSelect, onClose }: SkillsPanelProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/skills?agent_id=${agentId}`)
      .then(r => r.json())
      .then(data => { setSkills(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [agentId]);

  // Group by category
  const grouped: Record<string, Skill[]> = {};
  for (const s of skills) {
    const cat = s.category || 'general';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute bottom-full left-0 mb-2 w-[280px] bg-bg-secondary border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-[400px] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary">Skills</span>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-text-muted text-sm animate-pulse">加载中...</span>
            </div>
          ) : skills.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-sm">
              当前 Agent 暂无 Skill
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="mb-2">
                <div className="px-4 py-1.5 text-xs text-text-muted font-medium uppercase tracking-wide">
                  {category}
                </div>
                {items.map(skill => (
                  <button
                    key={skill.id}
                    onClick={() => onSelect(skill)}
                    className="w-full text-left px-4 py-2.5 hover:bg-bg-hover transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-text-primary group-hover:text-accent transition-colors truncate">
                          {skill.name}
                        </div>
                        <div className="text-xs text-text-muted truncate mt-0.5">
                          {skill.description}
                        </div>
                      </div>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
