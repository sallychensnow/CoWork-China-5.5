export interface ChartData {
  title?: string;
  type: 'bar' | 'line' | 'scatter' | 'horizontal_bar' | 'stacked_bar' | 'pie' | 'bubble';
  x_label?: string;
  y_label?: string;
  labels?: string[];
  datasets: {
    label: string;
    data: number[];
    color?: string;
  }[];
}

export interface TableData {
  title?: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface ToolResult {
  call_id: string;
  tool: string;
  success: boolean;
  display?: {
    type: 'table' | 'chart';
    data: TableData | ChartData;
  };
}

export interface ThinkingStep {
  id: string;
  text: string;
  type: 'thinking' | 'context' | 'data';
  expandable?: boolean;
}

export interface SubAgent {
  id: string;
  role: string;      // "Swarm Worker" | "Swarm Auditor"
  task: string;      // e.g. "电驱系统生产质量分析"
  status: 'running' | 'done' | 'planning';
}

export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  displayContent?: string; // What to show in UI (e.g. skill name), content is what goes to API
  skillName?: string; // If triggered via skill, show as blue badge
  toolInfo?: string;
  queryResult?: string;
  isStreaming?: boolean;
  toolResults?: ToolResult[];
  thinkingSteps?: ThinkingStep[];
  subAgents?: SubAgent[];
}

export interface Session {
  session_id: string;
  title: string;
  agent_id: string | null;
  updated_at: string | null;
  message_count: number;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  system_prompt?: string;
  tools: string[];
  semantic_models: string[];
  search_services: string[];
  icon: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  context: string;
  description: string;
}

export interface ModelProvider {
  backend: string;
  base_url: string | null;
  models: ModelInfo[];
  note?: string;
}
