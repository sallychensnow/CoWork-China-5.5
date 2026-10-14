'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useSettings } from '@/lib/settings';
import type { Agent } from '@/lib/types';

export default function AgentsPage() {
  const { t } = useSettings();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeId, setActiveId] = useState('');
  const [editing, setEditing] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  // For dropdowns in edit modal
  const [availableModels, setAvailableModels] = useState<Array<{name: string; stage: string}>>([]);
  const [availableSearch, setAvailableSearch] = useState<Array<{name: string; fqn: string}>>([]);
  const [databases, setDatabases] = useState<string[]>([]);
  const [schemas, setSchemas] = useState<Array<{name: string; fqn: string}>>([]);
  const [stages, setStages] = useState<Array<{name: string; fqn: string}>>([]);
  const [yamlFiles, setYamlFiles] = useState<Array<{name: string; path: string}>>([]);
  const [selectedDb, setSelectedDb] = useState('');
  const [selectedSchema, setSelectedSchema] = useState('');
  const [selectedStage, setSelectedStage] = useState('');

  useEffect(() => {
    api.getAgents().then(d => {
      setAgents(d.agents || []);
      setActiveId(d.active || '');
    }).finally(() => setLoading(false));
  }, []);

  // Load databases when edit modal opens
  useEffect(() => {
    if (editing) {
      fetch('/api/sources/databases').then(r => r.json()).then(d => setDatabases(d.databases || [])).catch(() => {});
    }
  }, [editing]);

  const loadSchemas = async (db: string) => {
    setSelectedDb(db);
    setSelectedSchema('');
    setSelectedStage('');
    setYamlFiles([]);
    const d = await fetch(`/api/sources/schemas?db=${db}`).then(r => r.json());
    setSchemas(d.schemas || []);
    // Also load search services for this DB
    const s = await fetch(`/api/sources/search-services?db=${db}`).then(r => r.json());
    setAvailableSearch(s.services || []);
  };

  const loadStages = async (schema: string) => {
    setSelectedSchema(schema);
    setSelectedStage('');
    setYamlFiles([]);
    const d = await fetch(`/api/sources/stages?schema=${schema}`).then(r => r.json());
    setStages(d.stages || []);
  };

  const loadFiles = async (stage: string) => {
    setSelectedStage(stage);
    const d = await fetch(`/api/sources/files?stage=${stage}`).then(r => r.json());
    setYamlFiles((d.files || []).filter((f: {name: string}) => f.name.endsWith('.yaml') || f.name.endsWith('.yml')));
  };

  const addSemanticModel = (name: string) => {
    if (!editing) return;
    const fullPath = `@${selectedStage}/${name}`;
    if (editing.semantic_models.includes(fullPath)) return;
    setEditing({ ...editing, semantic_models: [...editing.semantic_models, fullPath] });
  };

  const removeSemanticModel = (name: string) => {
    if (!editing) return;
    setEditing({ ...editing, semantic_models: editing.semantic_models.filter(m => m !== name) });
  };

  const addSearchService = (fqn: string) => {
    if (!editing || editing.search_services.includes(fqn)) return;
    setEditing({ ...editing, search_services: [...editing.search_services, fqn] });
  };

  const removeSearchService = (fqn: string) => {
    if (!editing) return;
    setEditing({ ...editing, search_services: editing.search_services.filter(s => s !== fqn) });
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      alert('请输入智能体名称');
      return;
    }
    try {
      if (agents.find(a => a.id === editing.id)) {
        await api.updateAgent(editing.id, editing);
      } else {
        await api.createAgent(editing);
      }
      const d = await api.getAgents();
      setAgents(d.agents || []);
      setEditing(null);
    } catch (e) {
      console.error('Save failed:', e);
      alert('保存失败，请检查控制台');
    }
  };

  const handleDelete = async (id: string) => {
    await api.deleteAgent(id);
    const d = await api.getAgents();
    setAgents(d.agents || []);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">{t('agents.title')}</h1>
          <button
            onClick={() => setEditing({ id: `agent_${Date.now()}`, name: '', description: '', tools: ['cortex_analyst', 'cortex_search', 'deep_research'], semantic_models: [], search_services: [], skills: [], icon: '🤖' })}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm hover:opacity-90 transition-opacity"
          >
            {t('agents.new')}
          </button>
        </div>

        {/* Agent list */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-text-muted">
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                <span>加载中...</span>
              </div>
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-12 text-text-muted">暂无智能体，点击右上角创建</div>
          ) : agents.map(agent => (
            <div key={agent.id} className={`p-4 rounded-xl border transition-colors ${agent.id === activeId ? 'border-accent bg-accent/5' : 'border-border-subtle bg-bg-secondary'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{agent.icon}</span>
                  <div>
                    <div className="font-medium text-text-primary">{agent.name}</div>
                    <div className="text-xs text-text-muted mt-0.5">{agent.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {agent.id !== activeId && (
                    <button onClick={() => { api.setActiveAgent(agent.id); setActiveId(agent.id); }} className="px-3 py-1 text-xs rounded border border-border-subtle text-text-secondary hover:bg-bg-hover">{t('agents.activate')}</button>
                  )}
                  {agent.id === activeId && (
                    <span className="px-3 py-1 text-xs rounded bg-accent/20 text-accent">{t('agents.active')}</span>
                  )}
                  <button onClick={() => setEditing({...agent})} className="px-2 py-1 text-xs text-text-muted hover:text-text-primary">{t('agents.edit')}</button>
                  <button onClick={() => handleDelete(agent.id)} className="px-2 py-1 text-xs text-text-muted hover:text-red-400">{t('agents.delete')}</button>
                </div>
              </div>
              <div className="flex gap-1.5 mt-3 flex-wrap">
                {agent.tools.map(t => <span key={t} className="px-2 py-0.5 text-[10px] rounded bg-bg-tertiary text-text-secondary">{t}</span>)}
                {agent.semantic_models.map(m => <span key={m} className="px-2 py-0.5 text-[10px] rounded bg-blue-900/30 text-blue-300">{m}</span>)}
                {agent.search_services.map(s => <span key={s} className="px-2 py-0.5 text-[10px] rounded bg-purple-900/30 text-purple-300">{s}</span>)}
              </div>
            </div>
          ))}
        </div>

        {/* Edit modal */}
        {editing && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-bg-secondary border border-border rounded-xl p-6 w-[520px] max-h-[85vh] overflow-y-auto">
              <h2 className="text-lg font-semibold mb-4">
                {agents.find(a => a.id === editing.id) ? t('agents.editAgent') : t('agents.newAgent')}
              </h2>
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="text-xs text-text-muted block mb-1">{t('agents.name')}</label>
                  <input value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})}
                    className="w-full px-3 py-2 bg-bg-tertiary border border-border-subtle rounded-lg text-sm text-text-primary" />
                </div>
                {/* Description */}
                <div>
                  <label className="text-xs text-text-muted block mb-1">{t('agents.description')}</label>
                  <textarea value={editing.description} onChange={e => setEditing({...editing, description: e.target.value})}
                    className="w-full px-3 py-2 bg-bg-tertiary border border-border-subtle rounded-lg text-sm text-text-primary" rows={2} />
                </div>
                {/* System Prompt */}
                <div>
                  <label className="text-xs text-text-muted block mb-1">{t('agents.systemPrompt')}</label>
                  <textarea
                    value={editing.system_prompt || ''}
                    onChange={e => setEditing({...editing, system_prompt: e.target.value})}
                    placeholder={t('agents.systemPromptPlaceholder')}
                    className="w-full px-3 py-2 bg-bg-tertiary border border-border-subtle rounded-lg text-sm text-text-primary font-mono" rows={5} />
                </div>
                {/* Tools */}
                <div>
                  <label className="text-xs text-text-muted block mb-1">{t('agents.tools')}</label>
                  <div className="flex gap-2 flex-wrap">
                    {['cortex_analyst', 'cortex_search'].map(tool => (
                      <label key={tool} className="flex items-center gap-1.5 text-xs text-text-secondary">
                        <input type="checkbox" checked={editing.tools.includes(tool)}
                          onChange={e => setEditing({...editing, tools: e.target.checked ? [...editing.tools, tool] : editing.tools.filter(t => t !== tool)})}
                          className="rounded accent-accent" />
                        {tool}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Semantic Models - browse from Stage */}
                <div>
                  <label className="text-xs text-text-muted block mb-2">{t('agents.semanticModels')}</label>
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <select value={selectedDb} onChange={e => loadSchemas(e.target.value)} className="px-2 py-1.5 bg-bg-tertiary border border-border-subtle rounded text-xs text-text-primary">
                        <option value="">{t('agents.database')}</option>
                        {databases.map(db => <option key={db} value={db}>{db}</option>)}
                      </select>
                      <select value={selectedSchema} onChange={e => loadStages(e.target.value)} disabled={!selectedDb} className="px-2 py-1.5 bg-bg-tertiary border border-border-subtle rounded text-xs text-text-primary disabled:opacity-50">
                        <option value="">{t('agents.schema')}</option>
                        {schemas.map(s => <option key={s.fqn} value={s.fqn}>{s.name}</option>)}
                      </select>
                      <select value={selectedStage} onChange={e => loadFiles(e.target.value)} disabled={!selectedSchema} className="px-2 py-1.5 bg-bg-tertiary border border-border-subtle rounded text-xs text-text-primary disabled:opacity-50">
                        <option value="">{t('agents.stage')}</option>
                        {stages.map(s => <option key={s.fqn} value={s.fqn}>{s.name}</option>)}
                      </select>
                    </div>
                    {yamlFiles.length > 0 && (
                      <div className="border border-border-subtle rounded-lg p-2 space-y-1 max-h-32 overflow-y-auto">
                        {yamlFiles.map(f => (
                          <button key={f.name} onClick={() => addSemanticModel(f.name)}
                            className="w-full text-left px-2 py-1 text-xs text-text-secondary hover:bg-bg-hover rounded">
                            + {f.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Selected models */}
                    <div className="flex gap-1 flex-wrap">
                      {editing.semantic_models.map(m => (
                        <span key={m} className="px-2 py-0.5 text-[10px] rounded bg-blue-900/30 text-blue-300 flex items-center gap-1">
                          {m} <button onClick={() => removeSemanticModel(m)} className="hover:text-red-300">x</button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Search Services - auto-discovered */}
                <div>
                  <label className="text-xs text-text-muted block mb-2">{t('agents.searchServices')}</label>
                  {availableSearch.length > 0 ? (
                    <div className="border border-border-subtle rounded-lg p-2 space-y-1 max-h-32 overflow-y-auto">
                      {availableSearch.map(s => (
                        <button key={s.fqn} onClick={() => addSearchService(s.fqn)}
                          disabled={editing.search_services.includes(s.fqn)}
                          className="w-full text-left px-2 py-1 text-xs text-text-secondary hover:bg-bg-hover rounded disabled:opacity-40">
                          + {s.name} <span className="text-text-muted">({s.fqn})</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-text-muted italic">{t('agents.selectDbHint')}</div>
                  )}
                  <div className="flex gap-1 flex-wrap mt-2">
                    {editing.search_services.map(s => (
                      <span key={s} className="px-2 py-0.5 text-[10px] rounded bg-purple-900/30 text-purple-300 flex items-center gap-1">
                        {s} <button onClick={() => removeSearchService(s)} className="hover:text-red-300">x</button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('agents.cancel')}</button>
                <button onClick={handleSave} className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:opacity-90">{t('agents.save')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
