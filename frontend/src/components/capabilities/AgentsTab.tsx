'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { Agent } from '@/lib/types';

const TOOL_OPTIONS = [
  { id: 'cortex_analyst', label: 'Cortex Analyst', desc: '结构化数据查询' },
  { id: 'cortex_search', label: 'Cortex Search', desc: '文档检索' },
  { id: 'web_search', label: '联网搜索', desc: 'Web Search' },
  { id: 'python_exec', label: 'Python 执行', desc: '代码执行' },
  { id: 'deep_research', label: '深度研究', desc: 'ArcticSwarm' },
];

interface SVItem { name: string; fqn: string; }
interface SearchItem { name: string; fqn: string; }
interface SkillItem { id: string; name: string; icon: string; trigger?: string; }

export default function AgentsTab() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeId, setActiveId] = useState('');
  const [editing, setEditing] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  // Available SV and Search Services for binding
  const [availableSVs, setAvailableSVs] = useState<SVItem[]>([]);
  const [availableSearch, setAvailableSearch] = useState<SearchItem[]>([]);
  const [availableSkills, setAvailableSkills] = useState<SkillItem[]>([]);

  useEffect(() => {
    api.getAgents().then((d) => {
      setAgents(d.agents || []);
      setActiveId(d.active || '');
    }).finally(() => setLoading(false));
  }, []);

  // Load available data sources when edit modal opens
  useEffect(() => {
    if (!editing) return;
    // Load Semantic Views
    fetch('/api/sv/list?database=COWORK')
      .then((r) => r.json())
      .then((d) => setAvailableSVs((d.semantic_views || []).map((v: Record<string, string>) => ({ name: v.name, fqn: v.fqn }))))
      .catch(() => {});
    // Load Search Services
    fetch('/api/sources/search-services?db=COWORK')
      .then((r) => r.json())
      .then((d) => setAvailableSearch((d.services || []).map((s: Record<string, string>) => ({ name: s.name, fqn: s.fqn }))))
      .catch(() => {});
    // Load Skills
    fetch('/api/skills/')
      .then((r) => r.json())
      .then((d) => {
        const items = Array.isArray(d) ? d : (d.skills || []);
        setAvailableSkills(items.map((s: Record<string, string>) => ({ id: String(s.id || s.name), name: s.name, icon: s.icon || '⚡', trigger: s.trigger_text || s.trigger })));
      })
      .catch(() => {});
  }, [editing]);

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { alert('请输入智能体名称'); return; }
    try {
      if (agents.find((a) => a.id === editing.id)) {
        await api.updateAgent(editing.id, editing);
      } else {
        await api.createAgent(editing);
      }
      const d = await api.getAgents();
      setAgents(d.agents || []);
      setEditing(null);
    } catch (e) {
      console.error('Save failed:', e);
      alert('保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此智能体？')) return;
    await api.deleteAgent(id);
    const d = await api.getAgents();
    setAgents(d.agents || []);
  };

  const handleSetActive = async (id: string) => {
    await api.setActiveAgent(id);
    setActiveId(id);
  };

  const newAgent = (): Agent => ({
    id: `agent_${Date.now()}`,
    name: '',
    description: '',
    system_prompt: '',
    tools: ['cortex_analyst', 'cortex_search', 'deep_research'],
    semantic_models: [],
    search_services: [],
    skills: [],
    icon: '🤖',
  });

  const toggleTool = (toolId: string) => {
    if (!editing) return;
    const tools = editing.tools.includes(toolId)
      ? editing.tools.filter((t) => t !== toolId)
      : [...editing.tools, toolId];
    setEditing({ ...editing, tools });
  };

  const toggleSV = (fqn: string) => {
    if (!editing) return;
    const models = editing.semantic_models.includes(fqn)
      ? editing.semantic_models.filter((m) => m !== fqn)
      : [...editing.semantic_models, fqn];
    setEditing({ ...editing, semantic_models: models });
  };

  const toggleSearch = (fqn: string) => {
    if (!editing) return;
    const svcs = editing.search_services.includes(fqn)
      ? editing.search_services.filter((s) => s !== fqn)
      : [...editing.search_services, fqn];
    setEditing({ ...editing, search_services: svcs });
  };

  const toggleSkill = (skillId: string) => {
    if (!editing) return;
    const skills = editing.skills.includes(skillId)
      ? editing.skills.filter((s) => s !== skillId)
      : [...editing.skills, skillId];
    setEditing({ ...editing, skills });
  };

  if (loading) return <div className="p-8 text-text-muted">加载中...</div>;

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Agents</h2>
          <p className="text-sm text-text-muted mt-1">创建和管理智能体，绑定数据源和能力</p>
        </div>
        <button
          onClick={() => setEditing(newAgent())}
          className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
        >
          + 新建智能体
        </button>
      </div>

      {/* Agent List */}
      <div className="space-y-3">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`p-4 rounded-xl border transition-colors cursor-pointer ${
              activeId === agent.id
                ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
                : 'border-border-subtle bg-bg-secondary hover:border-border'
            }`}
            onClick={() => handleSetActive(agent.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{agent.icon}</span>
                <div>
                  <div className="font-medium text-text-primary flex items-center gap-2">
                    {agent.name}
                    {activeId === agent.id && (
                      <span className="text-[10px] text-accent">当前使用</span>
                    )}
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">{agent.description}</div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {agent.tools.map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 bg-bg-tertiary text-text-muted rounded">
                        {t}
                      </span>
                    ))}
                    {(agent.skills || []).map((s) => (
                      <span key={s} className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded">
                        ⚡{s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setEditing(agent); }}
                  className="p-1.5 text-text-muted hover:text-accent rounded hover:bg-accent/10"
                  title="编辑"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(agent.id); }}
                  className="p-1.5 text-text-muted hover:text-red-400 rounded hover:bg-red-500/10"
                  title="删除"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-bg-primary border border-border-subtle rounded-2xl shadow-2xl w-[600px] max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-5">
                {agents.find((a) => a.id === editing.id) ? '编辑智能体' : '创建智能体'}
              </h3>

              {/* Basic info */}
              <div className="space-y-4 mb-6">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-text-muted mb-1 block">名称</label>
                    <input
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-bg-secondary border border-border-subtle rounded-lg text-text-primary"
                      placeholder="例如：销售分析师"
                    />
                  </div>
                  <div className="w-16">
                    <label className="text-xs text-text-muted mb-1 block">图标</label>
                    <input
                      value={editing.icon}
                      onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-bg-secondary border border-border-subtle rounded-lg text-text-primary text-center"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">描述</label>
                  <input
                    value={editing.description}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-bg-secondary border border-border-subtle rounded-lg text-text-primary"
                    placeholder="简短描述智能体的用途"
                  />
                </div>
              </div>

              {/* Data source binding */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-text-primary mb-3">数据源绑定</h4>

                {/* Semantic Views */}
                <div className="mb-3">
                  <label className="text-xs text-text-muted mb-1.5 block">语义视图</label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {availableSVs.length === 0 ? (
                      <span className="text-xs text-text-muted italic">暂无可用语义视图</span>
                    ) : (
                      availableSVs.map((sv) => (
                        <label key={sv.fqn} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-bg-hover cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editing.semantic_models.includes(sv.fqn)}
                            onChange={() => toggleSV(sv.fqn)}
                            className="accent-accent"
                          />
                          <span className="text-sm text-text-primary">{sv.name}</span>
                          <span className="text-[10px] text-text-muted font-mono">{sv.fqn}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Search Services */}
                <div>
                  <label className="text-xs text-text-muted mb-1.5 block">搜索服务</label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {availableSearch.length === 0 ? (
                      <span className="text-xs text-text-muted italic">暂无可用搜索服务</span>
                    ) : (
                      availableSearch.map((svc) => (
                        <label key={svc.fqn} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-bg-hover cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editing.search_services.includes(svc.fqn)}
                            onChange={() => toggleSearch(svc.fqn)}
                            className="accent-accent"
                          />
                          <span className="text-sm text-text-primary">{svc.name}</span>
                          <span className="text-[10px] text-text-muted font-mono">{svc.fqn}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Skills binding */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-text-primary mb-3">Skills 绑定</h4>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {availableSkills.length === 0 ? (
                    <span className="text-xs text-text-muted italic">暂无可用 Skills（可在 Skills 页面导入）</span>
                  ) : (
                    availableSkills.map((skill) => (
                      <label key={skill.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-bg-hover cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editing.skills.includes(skill.id)}
                          onChange={() => toggleSkill(skill.id)}
                          className="accent-accent"
                        />
                        <span className="text-base">{skill.icon}</span>
                        <span className="text-sm text-text-primary">{skill.name}</span>
                        {skill.trigger && (
                          <span className="text-[10px] text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded">/{skill.trigger}</span>
                        )}
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Capability toggles */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-text-primary mb-3">能力开关</h4>
                <div className="space-y-2">
                  {TOOL_OPTIONS.map((tool) => (
                    <label key={tool.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-hover cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editing.tools.includes(tool.id)}
                        onChange={() => toggleTool(tool.id)}
                        className="accent-accent"
                      />
                      <div>
                        <span className="text-sm text-text-primary">{tool.label}</span>
                        <span className="text-xs text-text-muted ml-2">{tool.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* System prompt */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-text-primary mb-2">系统提示词</h4>
                <textarea
                  value={editing.system_prompt || ''}
                  onChange={(e) => setEditing({ ...editing, system_prompt: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-bg-secondary border border-border-subtle rounded-lg text-text-primary h-24 resize-none"
                  placeholder="自定义系统提示词（可选）"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 text-sm text-text-secondary border border-border-subtle rounded-lg hover:bg-bg-hover"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
