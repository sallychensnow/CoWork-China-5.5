'use client';

import { useState } from 'react';
import type { VQR } from './SVWizard';

interface Props {
  vqrs: VQR[];
  onVqrsChange: (vqrs: VQR[]) => void;
}

export default function VQREditor({ vqrs, onVqrsChange }: Props) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [question, setQuestion] = useState('');
  const [sql, setSql] = useState('');

  const addVQR = () => {
    if (!name.trim() || !question.trim() || !sql.trim()) return;
    onVqrsChange([...vqrs, { name, question, sql }]);
    setName('');
    setQuestion('');
    setSql('');
  };

  const updateVQR = () => {
    if (editingIdx === null) return;
    const next = [...vqrs];
    next[editingIdx] = { name, question, sql };
    onVqrsChange(next);
    setEditingIdx(null);
    setName('');
    setQuestion('');
    setSql('');
  };

  const removeVQR = (idx: number) => {
    onVqrsChange(vqrs.filter((_, i) => i !== idx));
  };

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setName(vqrs[idx].name);
    setQuestion(vqrs[idx].question);
    setSql(vqrs[idx].sql);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-text-muted">
        Verified Queries (VQR) 是预定义的问答对，帮助 Cortex Analyst 更准确地生成 SQL。此步骤可选。
      </p>

      {/* VQR List */}
      {vqrs.length > 0 && (
        <div className="space-y-2">
          {vqrs.map((vqr, idx) => (
            <div key={idx} className="p-3 rounded-lg border border-border-subtle bg-bg-secondary">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-text-primary">{vqr.name}</span>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(idx)} className="p-1 text-text-muted hover:text-accent rounded">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </button>
                  <button onClick={() => removeVQR(idx)} className="p-1 text-text-muted hover:text-red-400 rounded">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
              </div>
              <div className="text-xs text-text-muted">Q: {vqr.question}</div>
              <pre className="text-[11px] text-text-muted mt-1 font-mono bg-bg-tertiary px-2 py-1 rounded overflow-x-auto">{vqr.sql}</pre>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit form */}
      <div className="p-4 rounded-xl border border-border-subtle bg-bg-secondary">
        <h4 className="text-sm font-medium text-text-primary mb-3">
          {editingIdx !== null ? '编辑 VQR' : '添加 VQR'}
        </h4>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-muted mb-1 block">名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg-primary border border-border-subtle rounded-lg text-text-primary"
              placeholder="例如: Total Sales by Region"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">问题</label>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg-primary border border-border-subtle rounded-lg text-text-primary"
              placeholder="用户会怎么问？例如: 各区域的总销售额是多少"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">SQL</label>
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg-primary border border-border-subtle rounded-lg text-text-primary font-mono h-20 resize-none"
              placeholder="SELECT region, SUM(amount) FROM orders GROUP BY region"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={editingIdx !== null ? updateVQR : addVQR}
              disabled={!name.trim() || !question.trim() || !sql.trim()}
              className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50"
            >
              {editingIdx !== null ? '更新' : '添加'}
            </button>
            {editingIdx !== null && (
              <button
                onClick={() => { setEditingIdx(null); setName(''); setQuestion(''); setSql(''); }}
                className="px-4 py-2 text-sm text-text-secondary border border-border-subtle rounded-lg hover:bg-bg-hover"
              >
                取消
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
