'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface AgentPickerProps {
  selected: string;
  onSelect: (agentId: string) => void;
}

export default function AgentPicker({ selected, onSelect }: AgentPickerProps) {
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<{ id: string; name: string; icon: string }[]>([]);

  useEffect(() => {
    api.getAgents().then(data => {
      const list = (data.agents || []).map((a: Record<string, unknown>) => ({
        id: a.id as string,
        name: a.name as string,
        icon: (a.icon as string) || '🤖',
      }));
      setAgents(list);
      // Set active from backend if current selection is invalid
      const activeFromBackend = data.active as string;
      if (activeFromBackend && (!selected || !list.find((a: {id: string}) => a.id === selected))) {
        onSelect(activeFromBackend);
      }
    }).catch(() => {});
  }, []);

  const selectedAgent = agents.find(a => a.id === selected);
  const displayName = selectedAgent ? selectedAgent.name : (selected || '选择智能体');

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:bg-bg-hover transition-colors border border-border-subtle"
      >
        {selectedAgent && <span>{selectedAgent.icon}</span>}
        <span>{displayName}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-2 bg-bg-secondary border border-border rounded-lg shadow-lg overflow-hidden min-w-[200px] z-50">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => {
                  onSelect(agent.id);
                  api.setActiveAgent(agent.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-bg-hover transition-colors ${
                  selected === agent.id ? 'text-accent' : 'text-text-primary'
                }`}
              >
                <span className="mr-2">{agent.icon}</span>{agent.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
