'use client';

import { useEffect, useRef, useState } from 'react';

interface MermaidBlockProps {
  code: string;
}

export default function MermaidBlock({ code }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: {
            primaryColor: '#29b5e8',
            primaryTextColor: '#e2e8f0',
            primaryBorderColor: '#3b4d61',
            lineColor: '#64748b',
            secondaryColor: '#1e293b',
            tertiaryColor: '#0f172a',
            background: '#0f1729',
            mainBkg: '#1e293b',
            nodeBorder: '#3b4d61',
            clusterBkg: '#1e293b',
            titleColor: '#e2e8f0',
            edgeLabelBackground: '#1e293b',
          },
          flowchart: { curve: 'basis', padding: 15 },
          securityLevel: 'loose',
        });

        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { svg: rendered } = await mermaid.render(id, code);
        if (!cancelled) setSvg(rendered);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Mermaid render error');
      }
    }

    render();
    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <pre className="bg-bg-tertiary border border-border-subtle rounded-lg p-4 my-3 overflow-x-auto">
        <code className="text-xs text-text-primary font-mono">{code}</code>
      </pre>
    );
  }

  if (!svg) {
    return (
      <div className="my-3 p-4 bg-bg-tertiary border border-border-subtle rounded-lg flex items-center justify-center">
        <span className="text-text-muted text-sm animate-pulse">渲染图表中...</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-3 p-4 bg-bg-secondary border border-border-subtle rounded-lg overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
