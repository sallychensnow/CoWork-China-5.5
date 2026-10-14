'use client';

import { useState } from 'react';
import SkillsTab from '@/components/capabilities/SkillsTab';
import SemanticViewsTab from '@/components/capabilities/SemanticViewsTab';
import SearchServicesTab from '@/components/capabilities/SearchServicesTab';
import AgentsTab from '@/components/capabilities/AgentsTab';

type TabId = 'skills' | 'sv' | 'search' | 'agents';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'skills', label: 'Skills', icon: '⚡' },
  { id: 'sv', label: 'Semantic Views', icon: '📊' },
  { id: 'search', label: 'Search Services', icon: '🔍' },
  { id: 'agents', label: 'Agents', icon: '🤖' },
];

export default function CapabilitiesPage() {
  const [activeTab, setActiveTab] = useState<TabId>('agents');

  return (
    <div className="flex h-full">
      {/* Left: Tab navigation */}
      <div className="w-56 flex-shrink-0 border-r border-border-subtle bg-bg-primary">
        <div className="p-5 pb-3">
          <h1 className="text-lg font-semibold text-text-primary">Capabilities</h1>
        </div>
        <nav className="px-2 space-y-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] transition-colors ${
                activeTab === tab.id
                  ? 'bg-bg-hover text-text-primary font-medium'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Right: Content area */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'skills' && <SkillsTab />}
        {activeTab === 'sv' && <SemanticViewsTab />}
        {activeTab === 'search' && <SearchServicesTab />}
        {activeTab === 'agents' && <AgentsTab />}
      </div>
    </div>
  );
}
