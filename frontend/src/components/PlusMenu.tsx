'use client';

import { useState } from 'react';
import SkillsPanel from './SkillsPanel';
import type { Skill } from './SkillsPanel';

interface PlusMenuProps {
  onClose: () => void;
  onDeepResearchToggle?: (enabled: boolean) => void;
  deepResearch?: boolean;
  activeAgent: string;
  onSkillSelect?: (skill: Skill) => void;
}

export default function PlusMenu({ onClose, onDeepResearchToggle, deepResearch, activeAgent, onSkillSelect }: PlusMenuProps) {
  const [showSkills, setShowSkills] = useState(false);
  const [dr, setDr] = useState(deepResearch || false);

  const toggleDR = () => {
    const next = !dr;
    setDr(next);
    onDeepResearchToggle?.(next);
  };

  if (showSkills) {
    return (
      <SkillsPanel
        agentId={activeAgent}
        onSelect={(skill) => {
          onSkillSelect?.(skill);
          onClose();
        }}
        onClose={() => setShowSkills(false)}
      />
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute bottom-full left-0 mb-2 w-[220px] bg-bg-secondary border border-border rounded-xl shadow-xl z-50 overflow-hidden">
      <div className="py-1">
        <button
          onClick={onClose}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-hover transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
          Upload files
        </button>
        <button
          onClick={toggleDR}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-hover transition-colors"
        >
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            Deep Research
          </div>
          <div className={`w-8 h-4 rounded-full transition-colors ${dr ? 'bg-accent' : 'bg-bg-hover'} relative`}>
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${dr ? 'left-4' : 'left-0.5'}`} />
          </div>
        </button>
        <button
          onClick={() => setShowSkills(true)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-hover transition-colors"
        >
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            Skills
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button
          onClick={onClose}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-hover transition-colors"
        >
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
            Connectors
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
    </>
  );
}
