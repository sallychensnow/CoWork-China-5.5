'use client';

import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, ScatterChart, Scatter, Cell, PieChart, Pie
} from 'recharts';
import type { ChartData } from '@/lib/types';

// Vibrant palette matching Global CoWork
const COLORS = ['#ff6b6b', '#ffaa5c', '#4cd964', '#29b5e8', '#a78bfa', '#f97316', '#06b6d4', '#ec4899'];

interface ChartCardProps {
  data: ChartData;
  sql?: string;
}

// Custom legend with round dots like Global CoWork
function CustomLegend({ payload }: { payload?: Array<{ value: string; color: string }> }) {
  if (!payload) return null;
  return (
    <div className="flex flex-wrap gap-4 px-1 pb-1">
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-xs text-text-secondary">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// Custom tooltip - dark themed, no white background
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1a1f2e', border: '1px solid #2a3040', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
      {label && <div style={{ fontSize: 11, color: '#8b95a5', marginBottom: 4 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: p.color, flexShrink: 0 }} />
          <span style={{ color: '#8b95a5' }}>{p.name}:</span>
          <span style={{ color: '#fff', fontWeight: 600 }}>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function ChartCard({ data, sql }: ChartCardProps) {
  const { type, title, x_label, y_label, labels, datasets } = data;
  const [showSql, setShowSql] = useState(false);

  // Transform data for recharts
  const chartData = (labels || []).map((label, i) => {
    const point: Record<string, string | number> = { name: label };
    datasets.forEach((ds) => {
      point[ds.label] = ds.data[i] ?? 0;
    });
    return point;
  });

  const getColor = (ds: { color?: string }, i: number) => ds.color || COLORS[i % COLORS.length];

  const renderChart = () => {
    if (type === 'pie') {
      // Pie chart: use first dataset's data with labels as slices
      const pieData = (labels || []).map((label, i) => ({
        name: label,
        value: datasets[0]?.data[i] ?? 0,
      }));
      return (
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={120}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }: { name?: string; percent?: number }) => `${name || ""} ${((percent || 0) * 100).toFixed(0)}%`}
              labelLine={{ stroke: 'var(--text-muted)', strokeWidth: 1 }}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (type === 'bubble') {
      // Bubble chart: scatter with variable size
      // datasets[0].data = x values, datasets[1].data = y values, datasets[2].data = sizes (optional)
      const bubbleData = (labels || []).map((label, i) => ({
        name: label,
        x: i,
        y: datasets[0]?.data[i] ?? 0,
        z: datasets[1]?.data[i] ?? datasets[0]?.data[i] ?? 20,
      }));
      // Group by dataset label for multi-series
      const seriesData: Record<string, Array<{ name: string; x: number; y: number; z: number }>> = {};
      if (datasets.length > 1) {
        datasets.forEach((ds, dsIdx) => {
          seriesData[ds.label] = (labels || []).map((label, i) => ({
            name: label,
            x: i,
            y: ds.data[i] ?? 0,
            z: Math.abs(ds.data[i] ?? 20) * 3,
          }));
        });
      } else {
        seriesData[datasets[0]?.label || 'data'] = bubbleData;
      }
      return (
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis
              dataKey="x"
              type="number"
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--border-subtle)' }}
              tickLine={false}
              tickFormatter={(v) => labels?.[v] || String(v)}
              label={x_label ? { value: x_label, position: 'bottom', fill: 'var(--text-secondary)', fontSize: 12, dy: 15 } : undefined}
            />
            <YAxis
              dataKey="y"
              type="number"
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              label={y_label ? { value: y_label, angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 12 } : undefined}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
            {Object.entries(seriesData).map(([key, sData], i) => (
              <Scatter key={key} name={key} data={sData} fill={COLORS[i % COLORS.length]}>
                {sData.map((entry, j) => (
                  <Cell key={j} fill={COLORS[i % COLORS.length]} fillOpacity={0.7} />
                ))}
              </Scatter>
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    if (type === 'line') {
      return (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} label={x_label ? { value: x_label, position: 'bottom', fill: 'var(--text-secondary)', fontSize: 12, dy: 15 } : undefined} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} label={y_label ? { value: y_label, angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 12 } : undefined} />
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
            {datasets.map((ds, i) => (
              <Line key={ds.label} type="monotone" dataKey={ds.label} stroke={getColor(ds, i)} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0, fill: getColor(ds, i) }} activeDot={{ r: 5 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (type === 'horizontal_bar') {
      const barHeight = datasets.length > 1 ? 50 : 40;
      const chartHeight = Math.max(240, chartData.length * barHeight + 80);
      return (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 30 }} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
            <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} label={x_label ? { value: x_label, position: 'bottom', fill: 'var(--text-secondary)', fontSize: 12, dy: 15 } : undefined} />
            <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 13 }} width={120} axisLine={false} tickLine={false} label={y_label ? { value: y_label, angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 12 } : undefined} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Legend content={<CustomLegend />} />
            {datasets.map((ds, i) => (
              <Bar key={ds.label} dataKey={ds.label} fill={getColor(ds, i)} radius={[0, 6, 6, 0]} barSize={28} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (type === 'stacked_bar') {
      return (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} label={x_label ? { value: x_label, position: 'bottom', fill: 'var(--text-secondary)', fontSize: 12, dy: 15 } : undefined} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} label={y_label ? { value: y_label, angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 12 } : undefined} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Legend content={<CustomLegend />} />
            {datasets.map((ds, i) => (
              <Bar key={ds.label} dataKey={ds.label} stackId="stack" fill={getColor(ds, i)} radius={i === datasets.length - 1 ? [4, 4, 0, 0] : undefined} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (type === 'scatter') {
      return (
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis dataKey="x" type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} label={x_label ? { value: x_label, position: 'bottom', fill: 'var(--text-secondary)', fontSize: 12, dy: 15 } : undefined} />
            <YAxis dataKey="y" type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} label={y_label ? { value: y_label, angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 12 } : undefined} />
            <Tooltip content={<CustomTooltip />} />
            {datasets.map((ds, i) => (
              <Scatter key={ds.label} name={ds.label} data={ds.data.map((v, j) => ({ x: j, y: v }))} fill={getColor(ds, i)}>
                {ds.data.map((_, j) => <Cell key={j} />)}
              </Scatter>
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    // Default: vertical bar chart
    return (
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 30 }} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} label={x_label ? { value: x_label, position: 'bottom', fill: 'var(--text-secondary)', fontSize: 12, dy: 15 } : undefined} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} label={y_label ? { value: y_label, angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 12 } : undefined} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Legend content={<CustomLegend />} />
          {datasets.map((ds, i) => (
            <Bar key={ds.label} dataKey={ds.label} fill={getColor(ds, i)} radius={[6, 6, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="my-4 border border-border rounded-xl bg-bg-primary overflow-hidden shadow-sm">
      {/* Header with title and action buttons */}
      <div className="px-5 pt-5 pb-2">
        <h3 className="text-base font-bold text-text-primary mb-1">{title || 'Chart'}</h3>
      </div>

      {/* Chart body */}
      <div className="px-2 pb-2">
        {renderChart()}
      </div>

      {/* SQL panel */}
      {showSql && sql && (
        <div className="px-5 py-3 border-t border-border-subtle bg-bg-secondary">
          <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap overflow-x-auto">{sql}</pre>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-border-subtle">
        <div className="flex items-center gap-3">
          <button className="p-1.5 rounded hover:bg-bg-hover text-text-muted" title="Bookmark">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
          </button>
          <button className="p-1.5 rounded hover:bg-bg-hover text-text-muted" title="Link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
          </button>
        </div>
        {sql && (
          <button
            onClick={() => setShowSql(!showSql)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              showSql
                ? 'border-accent/40 text-accent bg-accent/10'
                : 'border-border-subtle text-text-secondary hover:bg-bg-hover'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            View SQL
          </button>
        )}
      </div>
    </div>
  );
}
