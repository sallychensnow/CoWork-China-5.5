'use client';

import { useState, useEffect } from 'react';

interface Props {
  yamlContent: string;
  svName: string;
  onClose: () => void;
}

export default function DeployPanel({ yamlContent, svName, onClose }: Props) {
  const [databases, setDatabases] = useState<string[]>([]);
  const [schemas, setSchemas] = useState<{ name: string; fqn: string }[]>([]);
  const [stages, setStages] = useState<{ name: string; fqn: string }[]>([]);
  const [selectedDb, setSelectedDb] = useState('');
  const [selectedSchema, setSelectedSchema] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [createSV, setCreateSV] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [deployResult, setDeployResult] = useState<{ success: boolean; error?: string } | null>(null);

  useEffect(() => {
    fetch('/api/sources/databases').then((r) => r.json()).then((d) => setDatabases(d.databases || [])).catch(() => {});
  }, []);

  const loadSchemas = async (db: string) => {
    setSelectedDb(db);
    setSelectedSchema('');
    setSelectedStage('');
    const d = await fetch(`/api/sources/schemas?db=${db}`).then((r) => r.json());
    setSchemas(d.schemas || []);
  };

  const loadStages = async (schema: string) => {
    setSelectedSchema(schema);
    setSelectedStage('');
    const d = await fetch(`/api/sources/stages?schema=${selectedDb}.${schema}`).then((r) => r.json());
    setStages(d.stages || []);
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const res = await fetch('/api/sv/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml_content: yamlContent }),
      });
      const data = await res.json();
      setValidationResult(data);
    } catch (e) {
      setValidationResult({ valid: false, errors: [String(e)], warnings: [] });
    } finally {
      setValidating(false);
    }
  };

  const handleDeploy = async () => {
    if (!selectedStage) { alert('请选择目标 Stage'); return; }
    setDeploying(true);
    try {
      const res = await fetch('/api/sv/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yaml_content: yamlContent,
          name: svName || 'my_semantic_view',
          stage: selectedStage,
          create_semantic_view: createSV,
          sv_database: createSV ? selectedDb : undefined,
          sv_schema: createSV ? selectedSchema : undefined,
        }),
      });
      const data = await res.json();
      setDeployResult(data);
    } catch (e) {
      setDeployResult({ success: false, error: String(e) });
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Left: YAML Preview */}
      <div>
        <h4 className="text-sm font-medium text-text-primary mb-2">YAML 预览</h4>
        <pre className="p-4 rounded-lg bg-bg-tertiary border border-border-subtle text-xs text-text-primary font-mono overflow-auto max-h-[500px] whitespace-pre-wrap">
          {yamlContent || '（请先完成前面的步骤）'}
        </pre>
      </div>

      {/* Right: Deploy options */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-text-primary">部署选项</h4>

        {/* Stage selector */}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-muted mb-1 block">Database</label>
            <select
              value={selectedDb}
              onChange={(e) => loadSchemas(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg-secondary border border-border-subtle rounded-lg text-text-primary"
            >
              <option value="">选择数据库...</option>
              {databases.map((db) => <option key={db} value={db}>{db}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">Schema</label>
            <select
              value={selectedSchema}
              onChange={(e) => loadStages(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg-secondary border border-border-subtle rounded-lg text-text-primary"
              disabled={!selectedDb}
            >
              <option value="">选择 Schema...</option>
              {schemas.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">Stage</label>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg-secondary border border-border-subtle rounded-lg text-text-primary"
              disabled={!selectedSchema}
            >
              <option value="">选择 Stage...</option>
              {stages.map((s) => <option key={s.fqn} value={s.fqn}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* Create Semantic View checkbox */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={createSV}
            onChange={(e) => setCreateSV(e.target.checked)}
            className="accent-accent"
          />
          <span className="text-sm text-text-primary">同时创建 Semantic View (DDL)</span>
        </label>

        {/* Validation */}
        <div className="flex gap-2">
          <button
            onClick={handleValidate}
            disabled={validating}
            className="px-4 py-2 text-sm border border-border-subtle text-text-primary rounded-lg hover:bg-bg-hover disabled:opacity-50"
          >
            {validating ? '验证中...' : '验证 YAML'}
          </button>
          <button
            onClick={handleDeploy}
            disabled={deploying || !selectedStage}
            className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50"
          >
            {deploying ? '部署中...' : '部署'}
          </button>
        </div>

        {/* Validation result */}
        {validationResult && (
          <div className={`p-3 rounded-lg border ${validationResult.valid ? 'border-green-800/30 bg-green-900/10' : 'border-red-800/30 bg-red-900/10'}`}>
            <div className={`text-sm font-medium ${validationResult.valid ? 'text-green-400' : 'text-red-400'}`}>
              {validationResult.valid ? 'YAML 验证通过' : 'YAML 验证失败'}
            </div>
            {validationResult.errors.map((err, i) => (
              <div key={i} className="text-xs text-red-400 mt-1">{err}</div>
            ))}
          </div>
        )}

        {/* Deploy result */}
        {deployResult && (
          <div className={`p-3 rounded-lg border ${deployResult.success ? 'border-green-800/30 bg-green-900/10' : 'border-red-800/30 bg-red-900/10'}`}>
            <div className={`text-sm font-medium ${deployResult.success ? 'text-green-400' : 'text-red-400'}`}>
              {deployResult.success ? '部署成功' : '部署失败'}
            </div>
            {deployResult.success && (
              <div className="text-xs text-text-muted mt-1">
                YAML 已上传到 Stage。
                <button
                  onClick={onClose}
                  className="text-accent hover:underline ml-2"
                >
                  返回列表
                </button>
              </div>
            )}
            {deployResult.error && (
              <div className="text-xs text-red-400 mt-1">{String(deployResult.error)}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
