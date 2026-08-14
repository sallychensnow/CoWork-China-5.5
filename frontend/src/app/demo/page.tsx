'use client';

import MessageBubble from '@/components/MessageBubble';
import type { Message } from '@/lib/types';

const DEMO_MESSAGES: Message[] = [
  {
    role: 'user',
    content: '电驱系统的质量问题根因是什么？请结合生产数据、客户投诉和合同条款，给我一份完整的风险分析报告。',
  },
  {
    role: 'assistant',
    content: '',
    thinkingSteps: [
      { id: '1', text: 'Loaded skill and reviewed context', type: 'context', expandable: true },
    ],
    subAgents: [
      { id: 'w1', role: 'Swarm Worker', task: '电驱系统生产质量分析', status: 'done' },
      { id: 'w2', role: 'Swarm Worker', task: '电驱系统供应商合同风险', status: 'done' },
      { id: 'w3', role: 'Swarm Worker', task: '电驱系统客户投诉分析', status: 'done' },
      { id: 'a1', role: 'Swarm Auditor', task: 'Audit Shared Notes for this step', status: 'done' },
      { id: 'w4', role: 'Swarm Worker', task: '电驱系统交付延迟关联', status: 'planning' },
    ],
  },
  {
    role: 'user',
    content: '各产品线的销售额和交付情况如何？',
  },
  {
    role: 'assistant',
    content: `现在让我获取更详细的交付状态分布数据用于图表展示：

用不同的颜色表示不同的交付状态。`,
    thinkingSteps: [
      { id: 't1', text: 'Reviewed context, retrieved data, and loaded skill', type: 'context', expandable: true },
      { id: 't2', text: 'Retrieved data...', type: 'data', expandable: true },
    ],
    toolResults: [
      {
        call_id: '1',
        tool: 'cortex_analyst',
        success: true,
        display: {
          type: 'chart',
          data: {
            title: '各产品线销售额与交付状态分布',
            type: 'stacked_bar',
            x_label: '产品线',
            y_label: '销售额（人民币）',
            labels: ['传动系统', '制动系统', '电驱系统'],
            datasets: [
              { label: '按时交付', data: [580000, 520000, 1500000], color: '#22c55e' },
              { label: '延迟交付', data: [420000, 480000, 1100000], color: '#f87171' },
              { label: '生产中', data: [50000, 60000, 350000], color: '#29b5e8' },
            ],
          },
        },
      },
      {
        call_id: '2',
        tool: 'cortex_analyst',
        success: true,
        display: {
          type: 'chart',
          data: {
            title: '电驱系统供应商合同到期倒计时与风险等级',
            type: 'horizontal_bar',
            x_label: '合同剩余天数',
            y_label: '供应商',
            labels: ['台湾联电(苏州)', '宁德精工', '日本电产(大连)', '马来西亚Silterra'],
            datasets: [
              { label: 'critical', data: [320, 0, 0, 0], color: '#22c55e' },
              { label: 'high', data: [0, 180, 270, 0], color: '#f87171' },
              { label: 'medium', data: [0, 0, 0, 160], color: '#facc15' },
            ],
          },
        },
      },
      {
        call_id: '3',
        tool: 'cortex_analyst',
        success: true,
        display: {
          type: 'table',
          data: {
            title: '综合风险评估矩阵',
            columns: ['风险类别', '风险等级', '影响金额', '时间紧迫性'],
            rows: [
              ['CNC-03设备退化导致良率持续下滑', '🔴 极高', '全线影响', '立即'],
              ['蔚来合同违约/终止', '🔴 极高', '360万/年', '已触发'],
              ['理想合同单方终止', '🟠 高', '280万/年', '1-2个月内'],
              ['宁德精工合同到期未续', '🟠 高', '870万采购', '191天'],
              ['供应链单点故障', '🟠 高', '1,790万', '中期'],
              ['延迟罚款累积', '🟡 中', '持续累积', '已发生'],
            ],
          },
        },
      },
    ],
  },
  {
    role: 'assistant',
    content: `## 五、建议行动方案

🚨 **紧急（本周内）**

1. 立即启动CNC-03设备全面诊断，评估维修/更换成本
2. 与蔚来客户经理进行紧急沟通，协商延期交付方案
3. 启动宁德精工合同续签谈判

⚠️ **短期（1个月内）**

- 建立备选供应商清单，重点关注电驱系统核心零部件
- 优化生产排程，将高优先订单转移至良率稳定的机台
- 完成合同风险条款审查`,
  },
];

export default function DemoPage() {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-lg font-semibold text-text-primary mb-2">渲染效果 Demo</h1>
          <p className="text-sm text-text-muted">展示 Markdown、图表、表格的渲染能力</p>
        </div>
        <div className="space-y-6">
          {DEMO_MESSAGES.map((msg, i) => (
            <MessageBubble key={i} role={msg.role} content={msg.content} toolResults={msg.toolResults} />
          ))}
        </div>
      </div>
    </div>
  );
}
