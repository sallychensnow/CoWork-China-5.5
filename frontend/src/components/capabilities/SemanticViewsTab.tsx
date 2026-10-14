'use client';

import { useState, useEffect } from 'react';
import SVWizard from '@/components/sv/SVWizard';

interface SemanticView {
  name: string;
  database: string;
  schema: string;
  fqn: string;
  type?: string;
}

export default function SemanticViewsTab() {
  const [views, setViews] = useState<SemanticView[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [databases, setDatabases] = useState<string[]>([]);
  const [schemas, setSchemas] = useState<string[]>([]);
  const [selectedDb, setSelectedDb] = useState('COWORK');
  const [selectedSchema, setSelectedSchema] = useState('');
  const [editingSv, setEditingSv] = useState<SemanticView | null>(null);
  const [yamlContent, setYamlContent] = useState('');
  const [yamlLoading, setYamlLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/sources/databases')
      .then((r) => r.json())
      .then((d) => setDatabases(d.databases || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedDb) return;
    setSelectedSchema('');
    fetch(`/api/sources/schemas?db=${selectedDb}`)
      .then((r) => r.json())
      .then((d) => {
        const items = d.schemas || [];
        setSchemas(items.map((s: string | { name: string }) => typeof s === 'string' ? s : s.name));
      })
      .catch(() => setSchemas([]));
  }, [selectedDb]);

  const loadViews = () => {
    setLoading(true);
    const params = new URLSearchParams({ database: selectedDb });
    if (selectedSchema) params.set('schema', selectedSchema);
    fetch(`/api/sv/list?${params}`)
      .then((r) => r.json())
      .then((d) => setViews(d.semantic_views || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadViews(); }, [selectedDb, selectedSchema]);

  const handleDelete = async (sv: SemanticView) => {
    if (!confirm(`确定删除 ${sv.name}?`)) return;
    await fetch(`/api/sv/${sv.name}?database=${sv.database}&schema=${sv.schema}&type=${sv.type || 'semantic_view'}`, {
      method: 'DELETE',
    });
    loadViews();
  };

  const handleEdit = async (sv: SemanticView) => {
    setEditingSv(sv);
    setYamlLoading(true);
    setSaveStatus(null);
    try {
      if (sv.type === 'semantic_model') {
        // Load from stage
        const stagePath = sv.fqn.replace(/^@/, '');
        const parts = stagePath.split('/');
        const fileName = parts.pop() || '';
        const stage = parts.join('/');
        const res = await fetch(`/api/sources/load-yaml?stage=${encodeURIComponent(stage)}&file=${encodeURIComponent(fileName)}`);
        const data = await res.json();
        setYamlContent(data.content || '# 无法加载 YAML 内容');
      } else {
        // Semantic View object — get definition
        setYamlContent(`-- Semantic View: ${sv.fqn}\n-- 暂不支持直接编辑 Semantic View 对象的 YAML\n-- 请在 Snowsight 中查看或使用 DESCRIBE SEMANTIC VIEW ${sv.fqn}`);
      }
    } catch {
      setYamlContent('# 加载失败');
    }
    setYamlLoading(false);
  };

  const handleSaveYaml = async () => {
    if (!editingSv || editingSv.type !== 'semantic_model') return;
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/sv/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yaml_content: yamlContent,
          name: editingSv.name,
          stage: `${editingSv.database}.APP.SEMANTIC_MODELS`,
          filename: `${editingSv.name}.yaml`,
        }),
      });
      const data = await res.json();
      setSaveStatus(data.success ? 'saved' : 'error');
      if (data.success) {
        setTimeout(() => { setEditingSv(null); loadViews(); }, 1000);
      }
    } catch {
      setSaveStatus('error');
    }
  };

  if (showWizard) {
    return (
      <SVWizard
        onClose={() => { setShowWizard(false); loadViews(); }}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Semantic Views</h2>
          <p className="text-sm text-text-muted mt-1">管理语义视图和语义模型</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedDb}
            onChange={(e) => setSelectedDb(e.target.value)}
            className="px-3 py-1.5 text-sm bg-bg-secondary border border-border-subtle rounded-lg text-text-primary"
          >
            {databases.map((db) => (
              <option key={db} value={db}>{db}</option>
            ))}
          </select>
          <select
            value={selectedSchema}
            onChange={(e) => setSelectedSchema(e.target.value)}
            className="px-3 py-1.5 text-sm bg-bg-secondary border border-border-subtle rounded-lg text-text-primary"
          >
            <option value="">全部 Schema</option>
            {schemas.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={() => setShowWizard(true)}
            className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors whitespace-nowrap"
          >
            + 新建语义视图
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-text-muted">加载中...</div>
      ) : views.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-text-muted mb-4">在 {selectedDb}{selectedSchema ? `.${selectedSchema}` : ''} 中未找到语义视图或模型</div>
          <button
            onClick={() => setShowWizard(true)}
            className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90"
          >
            创建第一个语义视图
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {views.map((sv) => (
            <div
              key={sv.fqn}
              className="p-4 rounded-xl border border-border-subtle bg-bg-secondary hover:border-border transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary">{sv.name}</span>
                    {sv.type === 'semantic_model' ? (
                      <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 rounded">YAML Model</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded">Semantic View</span>
                    )}
                  </div>
                  <div className="text-xs text-text-muted mt-1 font-mono">{sv.fqn}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted bg-bg-tertiary px-2 py-1 rounded">
                    {sv.schema}
                  </span>
                  <button
                    onClick={() => handleEdit(sv)}
                    className="p-1.5 text-text-muted hover:text-accent transition-colors rounded hover:bg-accent/10"
                    title="查看/编辑"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(sv)}
                    className="p-1.5 text-text-muted hover:text-red-400 transition-colors rounded hover:bg-red-500/10"
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
      )}

      {/* YAML Editor Modal */}
      {editingSv && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setEditingSv(null)} />
          <div className="fixed inset-4 md:inset-12 lg:inset-20 bg-bg-primary border border-border rounded-2xl z-50 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
              <div>
                <h3 className="text-base font-semibold text-text-primary">{editingSv.name}</h3>
                <p className="text-xs text-text-muted mt-0.5 font-mono">{editingSv.fqn}</p>
              </div>
              <div className="flex items-center gap-2">
                {editingSv.type === 'semantic_model' && (
                  <button
                    onClick={handleSaveYaml}
                    disabled={saveStatus === 'saving'}
                    className="px-4 py-1.5 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50"
                  >
                    {saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '已保存' : '保存到 Stage'}
                  </button>
                )}
                <button
                  onClick={() => setEditingSv(null)}
                  className="p-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-bg-hover"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden p-4">
              {yamlLoading ? (
                <div className="flex items-center justify-center h-full text-text-muted">加载中...</div>
              ) : (
                <textarea
                  value={yamlContent}
                  onChange={(e) => { setYamlContent(e.target.value); setSaveStatus(null); }}
                  readOnly={editingSv.type !== 'semantic_model'}
                  className="w-full h-full font-mono text-sm bg-bg-secondary border border-border-subtle rounded-lg p-4 text-text-primary resize-none focus:outline-none focus:border-accent"
                  spellCheck={false}
                />
              )}
            </div>
            {saveStatus === 'error' && (
              <div className="px-6 py-2 text-sm text-red-400 border-t border-border-subtle">保存失败，请重试</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
