'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import AgentPicker from './AgentPicker';
import PlusMenu from './PlusMenu';
import { useSettings } from '@/lib/settings';
import type { Skill } from './SkillsPanel';

interface InputAreaProps {
  onSend: (text: string, options?: { skillPrompt?: string; skillName?: string; deepResearch?: boolean }) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  activeAgent: string;
  onAgentChange: (agent: string) => void;
}

export default function InputArea({ onSend, onStop, isStreaming, activeAgent, onAgentChange }: InputAreaProps) {
  const [text, setText] = useState('');
  const [plusOpen, setPlusOpen] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashIdx, setSlashIdx] = useState(0);
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null);
  const [deepResearch, setDeepResearch] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { t } = useSettings();

  // Fetch skills for / command
  useEffect(() => {
    fetch(`/api/skills?agent_id=${activeAgent}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSkills(data); })
      .catch(() => {});
  }, [activeAgent]);

  const filteredSkills = skills.filter(s =>
    s.name.toLowerCase().includes(slashFilter.toLowerCase()) ||
    s.trigger.toLowerCase().includes(slashFilter.toLowerCase())
  );

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && !activeSkill) return;
    // Send with skill prompt if a skill is active
    const msg = trimmed || activeSkill?.trigger || '';
    onSend(msg, {
      ...(activeSkill ? { skillPrompt: activeSkill.prompt, skillName: activeSkill.name } : {}),
      ...(deepResearch ? { deepResearch: true } : {}),
    });
    setText('');
    setActiveSkill(null);
    setSlashOpen(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleSkillSelect = (skill: Skill) => {
    // Don't send immediately — activate the skill and let user type their query
    setActiveSkill(skill);
    setText('');
    setSlashOpen(false);
    setPlusOpen(false);
    // Focus the textarea
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleChange = (value: string) => {
    setText(value);
    // Detect / at start of input (only when no skill is active)
    if (!activeSkill && value.startsWith('/')) {
      setSlashOpen(true);
      setSlashFilter(value.slice(1));
      setSlashIdx(0);
    } else {
      setSlashOpen(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Escape clears active skill
    if (e.key === 'Escape' && activeSkill) {
      setActiveSkill(null);
      return;
    }
    // Backspace on empty with active skill → deactivate skill
    if (e.key === 'Backspace' && text === '' && activeSkill) {
      setActiveSkill(null);
      return;
    }

    if (slashOpen && filteredSkills.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIdx(i => Math.min(i + 1, filteredSkills.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIdx(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSkillSelect(filteredSkills[slashIdx]);
        return;
      }
      if (e.key === 'Escape') {
        setSlashOpen(false);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  };

  return (
    <div className="bg-bg-secondary border border-border-subtle rounded-2xl p-4 shadow-lg relative">
      {/* Slash command dropdown */}
      {slashOpen && filteredSkills.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 mx-4 bg-bg-secondary border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-[240px] overflow-y-auto">
          <div className="px-3 py-2 text-xs text-text-muted border-b border-border-subtle">Skills</div>
          {filteredSkills.map((skill, i) => (
            <button
              key={skill.id}
              onClick={() => handleSkillSelect(skill)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                i === slashIdx ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-hover'
              }`}
            >
              <div className="font-medium">/{skill.trigger}</div>
              <div className="text-xs text-text-muted mt-0.5 truncate">{skill.description}</div>
            </button>
          ))}
        </div>
      )}

      {/* Active skill badge + textarea */}
      <div className="flex items-start gap-2">
        {activeSkill && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/15 text-accent text-xs font-medium shrink-0 mt-0.5">
            {activeSkill.name}
            <button onClick={() => setActiveSkill(null)} className="hover:text-white ml-0.5">×</button>
          </span>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={activeSkill ? `输入具体问题，如"主轴承组件库存"` : t('input.placeholder') + '  (输入 / 选择 Skill)'}
          rows={1}
          className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted text-sm resize-none leading-relaxed"
        />
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-subtle">
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setPlusOpen(!plusOpen)}
              className="w-8 h-8 rounded-full border border-border-subtle flex items-center justify-center text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            {plusOpen && (
              <PlusMenu
                onClose={() => setPlusOpen(false)}
                activeAgent={activeAgent}
                onSkillSelect={handleSkillSelect}
                deepResearch={deepResearch}
                onDeepResearchToggle={setDeepResearch}
              />
            )}
          </div>
          <AgentPicker selected={activeAgent} onSelect={onAgentChange} />
          {deepResearch && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/15 text-accent text-xs font-medium">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              Deep Research
              <button onClick={() => setDeepResearch(false)} className="hover:text-white ml-0.5">×</button>
            </span>
          )}
        </div>
        {isStreaming ? (
          <button
            onClick={onStop}
            className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center hover:opacity-90 transition-opacity"
            title="Stop"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!text.trim() && !activeSkill}
            className="w-8 h-8 rounded-full bg-accent flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-30"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        )}
      </div>
    </div>
  );
}
