'use client';

import { useState } from 'react';
import type { TableData } from '@/lib/types';

interface TableCardProps {
  data: TableData;
  sql?: string;
}

export default function TableCard({ data, sql }: TableCardProps) {
  const { title, columns, rows } = data;
  const [showSql, setShowSql] = useState(false);

  return (
    <div className="my-4 border border-border rounded-xl bg-bg-primary overflow-hidden">
      {/* Header */}
      {title && (
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          <div className="flex items-center gap-2">
            {sql && (
              <button
                onClick={() => setShowSql(!showSql)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                  showSql
                    ? 'border-accent/40 text-accent bg-accent/10'
                    : 'border-border-subtle text-text-secondary hover:bg-bg-hover'
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                View SQL
              </button>
            )}
          </div>
        </div>
      )}

      {/* SQL panel */}
      {showSql && sql && (
        <div className="px-5 py-3 border-t border-border-subtle bg-bg-secondary">
          <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap overflow-x-auto">{sql}</pre>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto px-4 pb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col, i) => (
                <th key={i} className="text-left py-3 px-4 text-text-secondary font-medium whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border-subtle last:border-0 hover:bg-bg-hover/50 transition-colors">
                {row.map((cell, j) => (
                  <td key={j} className="py-3 px-4 text-text-primary whitespace-nowrap">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
