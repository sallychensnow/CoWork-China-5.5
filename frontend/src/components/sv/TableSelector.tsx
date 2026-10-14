'use client';

import { useState, useEffect } from 'react';
import type { TableMeta } from './SVWizard';

interface Props {
  tables: TableMeta[];
  onTablesChange: (tables: TableMeta[]) => void;
}

export default function TableSelector({ tables, onTablesChange }: Props) {
  const [databases, setDatabases] = useState<string[]>([]);
  const [schemas, setSchemas] = useState<{ name: string; fqn: string }[]>([]);
  const [availableTables, setAvailableTables] = useState<{ name: string; fqn: string }[]>([]);
  const [selectedDb, setSelectedDb] = useState('');
  const [selectedSchema, setSelectedSchema] = useState('');
  const [selectedTableNames, setSelectedTableNames] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    fetch('/api/sources/databases').then((r) => r.json()).then((d) => setDatabases(d.databases || [])).catch(() => {});
  }, []);

  const loadSchemas = async (db: string) => {
    setSelectedDb(db);
    setSelectedSchema('');
    setAvailableTables([]);
    const d = await fetch(`/api/sources/schemas?db=${db}`).then((r) => r.json());
    setSchemas(d.schemas || []);
  };

  const loadTables = async (schema: string) => {
    setSelectedSchema(schema);
    setLoading(true);
    const d = await fetch(`/api/sv/tables?database=${selectedDb}&schema=${schema}`).then((r) => r.json());
    setAvailableTables((d.tables || []).map((t: Record<string, string>) => ({ name: t.name, fqn: t.fqn })));
    setLoading(false);
  };

  const toggleTable = (name: string) => {
    const next = new Set(selectedTableNames);
    if (next.has(name)) next.delete(name); else next.add(name);
    setSelectedTableNames(next);
  };

  const extractMetadata = async () => {
    if (selectedTableNames.size === 0) return;
    setExtracting(true);
    const payload = Array.from(selectedTableNames).map((name) => ({
      database: selectedDb,
      schema: selectedSchema,
      table: name,
    }));
    try {
      const res = await fetch('/api/sv/extract-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables: payload }),
      });
      const data = await res.json();
      onTablesChange(data.tables || []);
    } catch (e) {
      console.error('Extract metadata failed:', e);
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cascading selectors */}
      <div className="grid grid-cols-2 gap-4">
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
            onChange={(e) => loadTables(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-bg-secondary border border-border-subtle rounded-lg text-text-primary"
            disabled={!selectedDb}
          >
            <option value="">选择 Schema...</option>
            {schemas.map((s) => <option key={s.fqn} value={s.name}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* Table list with checkboxes */}
      {loading ? (
        <div className="p-4 text-text-muted">加载表列表...</div>
      ) : availableTables.length > 0 ? (
        <div className="border border-border-subtle rounded-lg max-h-64 overflow-y-auto">
          {availableTables.map((t) => (
            <label
              key={t.fqn}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-border-subtle last:border-0 hover:bg-bg-hover cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedTableNames.has(t.name)}
                onChange={() => toggleTable(t.name)}
                className="accent-accent"
              />
              <span className="text-sm text-text-primary">{t.name}</span>
            </label>
          ))}
        </div>
      ) : selectedSchema ? (
        <div className="text-sm text-text-muted">该 Schema 中没有表</div>
      ) : null}

      {/* Extract button */}
      {selectedTableNames.size > 0 && (
        <button
          onClick={extractMetadata}
          disabled={extracting}
          className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50"
        >
          {extracting ? `提取元数据中 (${selectedTableNames.size} 张表)...` : `提取元数据 (${selectedTableNames.size} 张表)`}
        </button>
      )}

      {/* Extracted results summary */}
      {tables.length > 0 && (
        <div className="p-4 rounded-lg bg-green-900/10 border border-green-800/30">
          <div className="text-sm text-green-400 font-medium mb-2">
            已提取 {tables.length} 张表的元数据
          </div>
          <div className="space-y-1">
            {tables.map((t) => (
              <div key={t.fqn} className="text-xs text-text-muted">
                {t.name}: {t.columns.length} 列, {t.primary_keys.length} PK
                {t.error && <span className="text-red-400 ml-2">{t.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
