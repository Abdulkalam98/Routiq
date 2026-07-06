const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

class InferixAPI {
  constructor(token = null) {
    this.baseURL = API_URL;
    this.token = token;
  }

  setToken(token) {
    this.token = token;
  }

  async request(path, options = {}) {
    const url = `${this.baseURL}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Dashboard
  async getDashboardStats() {
    return this.request('/api/dashboard/stats');
  }

  async getRecentRequests(limit = 20) {
    return this.request(`/api/dashboard/requests?limit=${limit}`);
  }

  // API Keys
  async listKeys() {
    return this.request('/v1/keys');
  }

  async createKey(name) {
    return this.request('/v1/keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async revokeKey(keyId) {
    return this.request(`/v1/keys/${keyId}`, {
      method: 'DELETE',
    });
  }

  // Billing
  async getBillingStatus() {
    return this.request('/billing/status');
  }

  async subscribe(plan) {
    return this.request('/billing/subscribe', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    });
  }

  async getPaymentHistory() {
    return this.request('/billing/history');
  }

  // Models
  async listModels() {
    return this.request('/v1/models');
  }
}

export const api = new InferixAPI();
export default InferixAPI;
