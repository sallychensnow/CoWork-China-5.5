'use client';

import { useState } from 'react';
import TableSelector from './TableSelector';
import ColumnEditor from './ColumnEditor';
import RelationshipEditor from './RelationshipEditor';
import VQREditor from './VQREditor';
import DeployPanel from './DeployPanel';

interface SVWizardProps {
  onClose: () => void;
}

const STEPS = [
  { id: 1, label: '选择表' },
  { id: 2, label: '列分类' },
  { id: 3, label: '关系' },
  { id: 4, label: 'VQR' },
  { id: 5, label: '部署' },
];

export interface TableMeta {
  name: string;
  database: string;
  schema: string;
  fqn: string;
  columns: ColumnMeta[];
  primary_keys: string[];
  foreign_keys: { column: string; references_table: string; references_column: string }[];
  error?: string;
}

export interface ColumnMeta {
  name: string;
  data_type: string;
  kind: 'dimension' | 'time_dimension' | 'fact' | 'filter' | 'metric';
  nullable: boolean;
  description: string;
  synonyms: string[];
}

export interface Relationship {
  name: string;
  left_table: string;
  right_table: string;
  relationship_type: 'many_to_one' | 'one_to_one';
  join_type: string;
  relationship_columns: { left_column: string; right_column: string }[];
}

export interface VQR {
  name: string;
  question: string;
  sql: string;
}

export default function SVWizard({ onClose }: SVWizardProps) {
  const [step, setStep] = useState(1);
  const [svName, setSvName] = useState('');
  const [svDescription, setSvDescription] = useState('');
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [vqrs, setVqrs] = useState<VQR[]>([]);
  const [yamlContent, setYamlContent] = useState('');

  const canNext = () => {
    if (step === 1) return tables.length > 0;
    if (step === 2) return tables.length > 0;
    return true;
  };

  const handleNext = async () => {
    if (step === 4) {
      // Generate YAML before showing deploy panel
      try {
        const res = await fetch('/api/sv/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: svName || 'my_semantic_view',
            description: svDescription,
            tables: tables.map((t) => ({
              name: t.name, database: t.database, schema: t.schema,
              columns: t.columns, primary_keys: t.primary_keys,
            })),
            relationships,
            vqrs,
          }),
        });
        const data = await res.json();
        if (data.yaml) setYamlContent(data.yaml);
      } catch (e) {
        console.error('Generate YAML failed:', e);
      }
    }
    setStep(Math.min(step + 1, 5));
  };

  return (
    <div className="max-w-5xl mx-auto px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">创建语义视图</h2>
          <p className="text-sm text-text-muted mt-1">通过向导逐步配置您的语义模型</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-bg-hover"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                step === s.id
                  ? 'bg-accent text-white'
                  : step > s.id
                  ? 'bg-green-500 text-white'
                  : 'bg-bg-tertiary text-text-muted'
              }`}
            >
              {step > s.id ? '✓' : s.id}
            </div>
            <span className={`text-sm ${step === s.id ? 'text-text-primary font-medium' : 'text-text-muted'}`}>
              {s.label}
            </span>
            {s.id < 5 && (
              <div className={`w-8 h-px ${step > s.id ? 'bg-green-500' : 'bg-border-subtle'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Name & Description (shown on step 1) */}
      {step === 1 && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-xs text-text-muted mb-1 block">模型名称</label>
            <input
              value={svName}
              onChange={(e) => setSvName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg-secondary border border-border-subtle rounded-lg text-text-primary"
              placeholder="例如: SALES_ANALYTICS"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">描述</label>
            <input
              value={svDescription}
              onChange={(e) => setSvDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg-secondary border border-border-subtle rounded-lg text-text-primary"
              placeholder="简要描述此语义模型"
            />
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="min-h-[400px]">
        {step === 1 && <TableSelector tables={tables} onTablesChange={setTables} />}
        {step === 2 && <ColumnEditor tables={tables} onTablesChange={setTables} />}
        {step === 3 && <RelationshipEditor tables={tables} relationships={relationships} onRelationshipsChange={setRelationships} />}
        {step === 4 && <VQREditor vqrs={vqrs} onVqrsChange={setVqrs} />}
        {step === 5 && <DeployPanel yamlContent={yamlContent} svName={svName} onClose={onClose} />}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6 pt-4 border-t border-border-subtle">
        <button
          onClick={() => step === 1 ? onClose() : setStep(step - 1)}
          className="px-4 py-2 text-sm text-text-secondary border border-border-subtle rounded-lg hover:bg-bg-hover"
        >
          {step === 1 ? '取消' : '上一步'}
        </button>
        {step < 5 && (
          <button
            onClick={handleNext}
            disabled={!canNext()}
            className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            下一步
          </button>
        )}
      </div>
    </div>
  );
}
