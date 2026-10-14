'use client';

import { useState } from 'react';
import type { TableMeta, Relationship } from './SVWizard';

interface Props {
  tables: TableMeta[];
  relationships: Relationship[];
  onRelationshipsChange: (rels: Relationship[]) => void;
}

export default function RelationshipEditor({ tables, relationships, onRelationshipsChange }: Props) {
  const [leftTable, setLeftTable] = useState('');
  const [rightTable, setRightTable] = useState('');
  const [leftCol, setLeftCol] = useState('');
  const [rightCol, setRightCol] = useState('');
  const [inferring, setInferring] = useState(false);
  const [error, setError] = useState('');

  const leftTableMeta = tables.find((t) => t.name === leftTable);
  const rightTableMeta = tables.find((t) => t.name === rightTable);

  const addRelationship = async () => {
    if (!leftTable || !rightTable || !leftCol || !rightCol) return;
    setInferring(true);
    setError('');
    try {
      const res = await fetch('/api/sv/infer-relationship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_yaml: '', // Empty for now — backend will infer from column info
          left_table: leftTable,
          right_table: rightTable,
          left_column: leftCol,
          right_column: rightCol,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        const rel: Relationship = {
          name: `${leftTable}_to_${rightTable}`,
          left_table: leftTable,
          right_table: rightTable,
          relationship_type: data.relationship_type || data.type || 'many_to_one',
          join_type: data.join_type || 'left_outer',
          relationship_columns: [{ left_column: leftCol, right_column: rightCol }],
        };
        onRelationshipsChange([...relationships, rel]);
        setLeftCol('');
        setRightCol('');
      }
    } catch (e) {
      // Fallback: add manually as many_to_one
      const rel: Relationship = {
        name: `${leftTable}_to_${rightTable}`,
        left_table: leftTable,
        right_table: rightTable,
        relationship_type: 'many_to_one',
        join_type: 'left_outer',
        relationship_columns: [{ left_column: leftCol, right_column: rightCol }],
      };
      onRelationshipsChange([...relationships, rel]);
      setLeftCol('');
      setRightCol('');
    } finally {
      setInferring(false);
    }
  };

  const removeRelationship = (idx: number) => {
    onRelationshipsChange(relationships.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      {/* Existing relationships */}
      {relationships.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-text-primary">已定义的关系</h4>
          {relationships.map((rel, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border border-border-subtle bg-bg-secondary">
              <span className="text-sm text-text-primary font-mono">{rel.left_table}</span>
              <span className="text-xs px-2 py-0.5 bg-accent/10 text-accent rounded">{rel.relationship_type}</span>
              <span className="text-sm text-text-primary font-mono">{rel.right_table}</span>
              <span className="text-xs text-text-muted ml-auto">
                {rel.relationship_columns.map((rc) => `${rc.left_column} = ${rc.right_column}`).join(', ')}
              </span>
              <button
                onClick={() => removeRelationship(idx)}
                className="p-1 text-text-muted hover:text-red-400 rounded"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new relationship */}
      <div className="p-4 rounded-xl border border-border-subtle bg-bg-secondary">
        <h4 className="text-sm font-medium text-text-primary mb-3">添加关系</h4>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <label className="text-xs text-text-muted mb-1 block">左表</label>
            <select
              value={leftTable}
              onChange={(e) => { setLeftTable(e.target.value); setLeftCol(''); }}
              className="w-full px-3 py-2 text-sm bg-bg-primary border border-border-subtle rounded-lg text-text-primary"
            >
              <option value="">选择表...</option>
              {tables.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">右表</label>
            <select
              value={rightTable}
              onChange={(e) => { setRightTable(e.target.value); setRightCol(''); }}
              className="w-full px-3 py-2 text-sm bg-bg-primary border border-border-subtle rounded-lg text-text-primary"
            >
              <option value="">选择表...</option>
              {tables.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">左列</label>
            <select
              value={leftCol}
              onChange={(e) => setLeftCol(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg-primary border border-border-subtle rounded-lg text-text-primary"
              disabled={!leftTableMeta}
            >
              <option value="">选择列...</option>
              {leftTableMeta?.columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">右列</label>
            <select
              value={rightCol}
              onChange={(e) => setRightCol(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg-primary border border-border-subtle rounded-lg text-text-primary"
              disabled={!rightTableMeta}
            >
              <option value="">选择列...</option>
              {rightTableMeta?.columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
        </div>
        {error && <div className="text-xs text-red-400 mb-2">{error}</div>}
        <button
          onClick={addRelationship}
          disabled={!leftTable || !rightTable || !leftCol || !rightCol || inferring}
          className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50"
        >
          {inferring ? '推断中...' : '添加关系'}
        </button>
      </div>

      {tables.length < 2 && (
        <div className="text-sm text-text-muted p-4">需要至少 2 张表才能创建关系。可以跳过此步。</div>
      )}
    </div>
  );
}
