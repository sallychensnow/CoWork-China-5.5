'use client';

import { useState, useEffect } from 'react';

interface SearchService {
  name: string;
  fqn: string;
  database: string;
  schema: string;
}

export default function SearchServicesTab() {
  const [services, setServices] = useState<SearchService[]>([]);
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDb, setSelectedDb] = useState('COWORK');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/sources/databases')
      .then((r) => r.json())
      .then((d) => setDatabases(d.databases || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/sources/search-services?db=${selectedDb}`)
      .then((r) => r.json())
      .then((d) => setServices(d.services || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedDb]);

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Search Services</h2>
          <p className="text-sm text-text-muted mt-1">已有的 Cortex Search 服务，可绑定到智能体</p>
        </div>
        <select
          value={selectedDb}
          onChange={(e) => setSelectedDb(e.target.value)}
          className="px-3 py-1.5 text-sm bg-bg-secondary border border-border-subtle rounded-lg text-text-primary"
        >
          {databases.map((db) => (
            <option key={db} value={db}>{db}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="p-8 text-text-muted">加载中...</div>
      ) : services.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          在 {selectedDb} 中未找到 Cortex Search 服务
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((svc) => (
            <div
              key={svc.fqn}
              className="p-4 rounded-xl border border-border-subtle bg-bg-secondary hover:border-border transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-text-primary">{svc.name}</div>
                  <div className="text-xs text-text-muted mt-1 font-mono">{svc.fqn}</div>
                </div>
                <span className="text-xs text-text-muted bg-bg-tertiary px-2 py-1 rounded">
                  {svc.schema}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
