'use client';

import type { TableMeta, ColumnMeta } from './SVWizard';

interface Props {
  tables: TableMeta[];
  onTablesChange: (tables: TableMeta[]) => void;
}

const KIND_COLORS: Record<string, string> = {
  dimension: 'bg-blue-900/30 text-blue-400',
  time_dimension: 'bg-purple-900/30 text-purple-400',
  fact: 'bg-green-900/30 text-green-400',
  filter: 'bg-yellow-900/30 text-yellow-400',
  metric: 'bg-orange-900/30 text-orange-400',
};

const KIND_OPTIONS = ['dimension', 'time_dimension', 'fact', 'filter', 'metric'];

export default function ColumnEditor({ tables, onTablesChange }: Props) {
  const updateColumn = (tableIdx: number, colIdx: number, updates: Partial<ColumnMeta>) => {
    const next = [...tables];
    next[tableIdx] = {
      ...next[tableIdx],
      columns: next[tableIdx].columns.map((c, i) => i === colIdx ? { ...c, ...updates } : c),
    };
    onTablesChange(next);
  };

  const handleInferPK = async (tableIdx: number) => {
    const t = tables[tableIdx];
    try {
      const res = await fetch('/api/sv/infer-pk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ database: t.database, schema_name: t.schema, table: t.name }),
      });
      const data = await res.json();
      if (data.candidates?.length > 0) {
        const bestPK = data.candidates[0];
        const next = [...tables];
        next[tableIdx] = { ...next[tableIdx], primary_keys: bestPK.columns || [bestPK.column] };
        onTablesChange(next);
      }
    } catch (e) {
      console.error('Infer PK failed:', e);
    }
  };

  if (tables.length === 0) {
    return <div className="text-text-muted p-4">请先在第一步选择表并提取元数据</div>;
  }

  return (
    <div className="space-y-6">
      {tables.map((table, tableIdx) => (
        <div key={table.fqn} className="border border-border-subtle rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-bg-secondary flex items-center justify-between">
            <div>
              <span className="font-medium text-text-primary">{table.name}</span>
              <span className="text-xs text-text-muted ml-2">{table.columns.length} 列</span>
              {table.primary_keys.length > 0 && (
                <span className="text-xs text-accent ml-2">PK: {table.primary_keys.join(', ')}</span>
              )}
            </div>
            <button
              onClick={() => handleInferPK(tableIdx)}
              className="text-xs px-3 py-1 bg-accent/10 text-accent rounded-lg hover:bg-accent/20"
            >
              推断主键
            </button>
          </div>
          <div className="divide-y divide-border-subtle">
            {table.columns.map((col, colIdx) => (
              <div key={col.name} className="px-4 py-2 flex items-center gap-3 hover:bg-bg-hover">
                <span className="text-sm text-text-primary w-40 truncate font-mono">{col.name}</span>
                <span className="text-[10px] text-text-muted w-24 truncate">{col.data_type}</span>
                <select
                  value={col.kind}
                  onChange={(e) => updateColumn(tableIdx, colIdx, { kind: e.target.value as ColumnMeta['kind'] })}
                  className={`text-[11px] px-2 py-0.5 rounded border-0 ${KIND_COLORS[col.kind] || 'bg-bg-tertiary text-text-muted'}`}
                >
                  {KIND_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <input
                  value={col.description}
                  onChange={(e) => updateColumn(tableIdx, colIdx, { description: e.target.value })}
                  className="flex-1 text-xs px-2 py-1 bg-transparent border border-transparent hover:border-border-subtle rounded text-text-muted focus:border-accent focus:text-text-primary"
                  placeholder="描述..."
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
