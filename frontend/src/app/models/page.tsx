'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useSettings } from '@/lib/settings';

interface ModelInfo {
  id: string;
  name: string;
  context: string;
  description: string;
}

interface ProviderData {
  backend: string;
  models: ModelInfo[];
  note?: string;
}

const FALLBACK_PROVIDERS: Record<string, ProviderData> = {
  'Qwen (通义千问)': {
    backend: 'DashScope API',
    models: [
      { id: 'qwen-plus', name: 'Qwen Plus', context: '128K', description: '均衡性能，适合大多数场景' },
      { id: 'qwen-max', name: 'Qwen Max', context: '128K', description: '最强推理能力，适合复杂分析任务' },
      { id: 'qwen-turbo', name: 'Qwen Turbo', context: '128K', description: '快速响应，适合简单对话' },
      { id: 'qwen-long', name: 'Qwen Long', context: '1M', description: '超长上下文，适合文档分析' },
    ],
  },
  'DeepSeek (深度求索)': {
    backend: 'DeepSeek API',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3', context: '64K', description: '通用对话模型，性价比高' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', context: '64K', description: '推理增强模型，擅长逻辑分析和数学' },
    ],
  },
  'Snowflake Arctic': {
    backend: 'Cortex LLM (UDF)',
    models: [
      { id: 'arctic-instruct', name: 'Arctic Instruct', context: '4K', description: 'Snowflake自研模型，企业场景优化' },
    ],
    note: '中国区通过UDF调用',
  },
};

export default function ModelsPage() {
  const { t } = useSettings();
  const [providers, setProviders] = useState<Record<string, ProviderData>>(FALLBACK_PROVIDERS);
  const [currentProvider, setCurrentProvider] = useState('Qwen (通义千问)');
  const [currentModel, setCurrentModel] = useState('qwen-plus');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getModels().then(d => {
      if (d.providers && Object.keys(d.providers).length > 0) {
        setProviders(d.providers);
      }
      if (d.current_provider) setCurrentProvider(d.current_provider);
      if (d.current_model) setCurrentModel(d.current_model);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const selectModel = async (provider: string, modelId: string) => {
    setCurrentProvider(provider);
    setCurrentModel(modelId);
    try {
      await api.setModel(provider, modelId);
    } catch {}
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full px-8 py-8">
        <h1 className="text-2xl font-semibold text-text-primary mb-2">{t('models.title')}</h1>
        <p className="text-sm text-text-muted mb-8">选择 Agent 使用的基础大模型</p>

        <div className="space-y-6">
          {Object.entries(providers).map(([providerName, data]) => (
            <div key={providerName} className="p-5 rounded-xl border border-border-subtle bg-bg-secondary">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center text-text-secondary">
                    {providerName.includes('Qwen') ? '🟣' : providerName.includes('Deep') ? '🔵' : '❄️'}
                  </div>
                  <div>
                    <h2 className="text-base font-medium text-text-primary">{providerName}</h2>
                    <span className="text-xs text-text-muted">{data.backend}</span>
                  </div>
                </div>
                {data.note && <span className="text-xs text-yellow-400 bg-yellow-900/20 px-2 py-1 rounded">{data.note}</span>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.models.map(model => {
                  const isActive = currentProvider === providerName && currentModel === model.id;
                  return (
                    <button
                      key={model.id}
                      onClick={() => selectModel(providerName, model.id)}
                      className={`text-left p-4 rounded-lg border transition-all ${
                        isActive
                          ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
                          : 'border-border-subtle hover:border-border hover:bg-bg-hover'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-text-primary">{model.name}</span>
                        <span className="text-[10px] text-text-muted bg-bg-tertiary px-2 py-0.5 rounded">{model.context}</span>
                      </div>
                      <div className="text-xs text-text-muted mt-1.5">{model.description}</div>
                      {isActive && (
                        <div className="flex items-center gap-1 text-[10px] text-accent mt-2">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          当前使用
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
