'use client';

import { useState, useEffect, useRef } from 'react';

interface Skill {
  id: number | string;
  name: string;
  description: string;
  trigger_text?: string;
  trigger?: string;
  icon: string;
  category: string;
  agent_id: string;
}

export default function SkillsTab() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ status: string; message?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSkills = () => {
    setLoading(true);
    fetch('/api/skills/')
      .then((r) => r.json())
      .then((d) => {
        const items = Array.isArray(d) ? d : (d.skills || []);
        setSkills(items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadSkills(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/skills/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.status === 'saved') {
        setUploadResult({ status: 'success', message: `Skill "${data.id}" 导入成功` });
        loadSkills(); // reload list
      } else {
        setUploadResult({ status: 'error', message: data.message || '导入失败' });
      }
    } catch (err) {
      setUploadResult({ status: 'error', message: String(err) });
    } finally {
      setUploading(false);
      // Reset file input so same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return <div className="p-8 text-text-muted">加载中...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Skills</h2>
          <p className="text-sm text-text-muted mt-1">预定义的工作流，通过 / 斜杠命令触发</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.yaml,.yml"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {uploading ? '导入中...' : '+ 导入 Skill (.md)'}
          </button>
        </div>
      </div>

      {/* Upload result notification */}
      {uploadResult && (
        <div className={`mb-4 p-3 rounded-lg border ${
          uploadResult.status === 'success'
            ? 'border-green-800/30 bg-green-900/10 text-green-400'
            : 'border-red-800/30 bg-red-900/10 text-red-400'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-sm">{uploadResult.message}</span>
            <button onClick={() => setUploadResult(null)} className="text-xs opacity-60 hover:opacity-100">
              关闭
            </button>
          </div>
        </div>
      )}

      {/* Skill format hint */}
      <div className="mb-6 p-4 rounded-xl border border-border-subtle bg-bg-secondary">
        <div className="text-xs text-text-muted mb-2">Skill 文件格式 (.md)：</div>
        <pre className="text-[11px] text-text-muted font-mono leading-relaxed">{`---
name: "报告生成"
description: "生成标准化分析报告"
trigger: "report"
icon: "📊"
category: "分析"
agent_id: ""
is_global: true
---

你是数据分析报告生成专家...
（Skill 的完整 prompt）`}</pre>
      </div>

      {skills.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          暂无 Skills，点击上方按钮导入
        </div>
      ) : (
        <div className="space-y-3">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className="p-4 rounded-xl border border-border-subtle bg-bg-secondary hover:border-border transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{skill.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary">{skill.name}</span>
                    <span className="text-xs text-text-muted bg-bg-tertiary px-2 py-0.5 rounded">
                      /{skill.trigger_text || skill.trigger}
                    </span>
                    <span className="text-xs text-accent bg-accent/10 px-2 py-0.5 rounded">
                      {skill.category}
                    </span>
                  </div>
                  <p className="text-sm text-text-muted mt-1">{skill.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
