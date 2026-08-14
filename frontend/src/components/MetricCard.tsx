'use client';

interface MetricCardProps {
  title: string;
  items: Array<{ label: string; value: string | number }>;
}

export default function MetricCard({ title, items }: MetricCardProps) {
  return (
    <div className="my-3 border border-border rounded-xl bg-bg-primary overflow-hidden shadow-sm">
      {title && (
        <div className="px-5 pt-4 pb-2">
          <h3 className="text-sm font-bold text-text-primary">{title}</h3>
        </div>
      )}
      <div className="px-5 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((item, i) => (
          <div key={i} className="bg-bg-secondary rounded-lg px-3 py-3 border border-border-subtle">
            <div className="text-xl font-bold text-accent">{item.value}</div>
            <div className="text-xs text-text-muted mt-1">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
