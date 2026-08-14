'use client';

import type { TableData } from '@/lib/types';

interface TableCardProps {
  data: TableData;
}

export default function TableCard({ data }: TableCardProps) {
  const { title, columns, rows } = data;

  return (
    <div className="my-4 border border-border rounded-xl bg-bg-primary overflow-hidden">
      {/* Header */}
      {title && (
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded hover:bg-bg-hover text-text-muted">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
            </button>
            <button className="p-1.5 rounded hover:bg-bg-hover text-text-muted">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
            </button>
          </div>
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
