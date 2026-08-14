const API_BASE = '/api';

export const api = {
  // Chat
  async sendMessage(messages: Array<{role: string; content: string}>, model?: string) {
    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, model }),
    });
    return response;
  },

  // Greeting
  async getGreeting() {
    const res = await fetch(`${API_BASE}/agent/greeting`);
    return res.json();
  },

  // Models
  async getModels() {
    const res = await fetch(`${API_BASE}/agent/models`);
    return res.json();
  },
  async setModel(provider: string, model: string) {
    const res = await fetch(`${API_BASE}/agent/model`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, model }),
    });
    return res.json();
  },

  // Agents
  async getAgents() {
    const res = await fetch(`${API_BASE}/agents/`);
    return res.json();
  },
  async setActiveAgent(agentId: string) {
    const res = await fetch(`${API_BASE}/agents/active`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agentId }),
    });
    return res.json();
  },
  async createAgent(agent: Record<string, unknown> | object) {
    const res = await fetch(`${API_BASE}/agents/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agent),
    });
    return res.json();
  },
  async updateAgent(agentId: string, agent: Record<string, unknown> | object) {
    const res = await fetch(`${API_BASE}/agents/${agentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agent),
    });
    return res.json();
  },
  async deleteAgent(agentId: string) {
    const res = await fetch(`${API_BASE}/agents/${agentId}`, { method: 'DELETE' });
    return res.json();
  },

  // Conversations
  async getSessions(limit = 20) {
    const res = await fetch(`${API_BASE}/conversations/sessions?limit=${limit}`);
    return res.json();
  },
  async createSession(title: string, agentId?: string) {
    const res = await fetch(`${API_BASE}/conversations/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, agent_id: agentId }),
    });
    return res.json();
  },
  async getMessages(sessionId: string) {
    const res = await fetch(`${API_BASE}/conversations/sessions/${sessionId}/messages`);
    return res.json();
  },
  async saveMessage(sessionId: string, message: {role: string; content: string; tool_info?: string; query_result?: string}) {
    const res = await fetch(`${API_BASE}/conversations/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, message }),
    });
    return res.json();
  },
  async deleteSession(sessionId: string) {
    const res = await fetch(`${API_BASE}/conversations/sessions/${sessionId}`, { method: 'DELETE' });
    return res.json();
  },

  // Sources
  async getActiveSources() {
    const res = await fetch(`${API_BASE}/sources/active`);
    return res.json();
  },

  // Search
  async searchConversations(query: string, limit = 20) {
    const res = await fetch(`${API_BASE}/conversations/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    return res.json();
  },

  // Deep Research
  async startResearch(query: string, agentId?: string) {
    const res = await fetch(`${API_BASE}/research/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, messages: [], agent_id: agentId }),
    });
    return res.json();
  },
  async getResearchStatus(taskId: string) {
    const res = await fetch(`${API_BASE}/research/status/${taskId}`);
    return res.json();
  },
};
