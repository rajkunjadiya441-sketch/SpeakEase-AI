/**
 * Adapt Synthetix API Client
 * Configured for future FastAPI backend integration.
 * In Phase 1, routes through mock service handlers with realistic async latency.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'; // default to mock in Phase 1

export const apiClient = {
  baseUrl: BASE_URL,
  useMock: USE_MOCK,

  /**
   * Generic request helper ready for FastAPI endpoints
   */
  async request(endpoint, options = {}) {
    if (this.useMock) {
      throw new Error(`API client is running in mock mode. Endpoint ${endpoint} should be handled by service layer.`);
    }

    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const error = new Error(errorBody.message || `Request failed with status ${response.status}`);
      error.status = response.status;
      error.data = errorBody;
      throw error;
    }

    return response.json();
  },

  /**
   * Helper simulating network latency for mock calls
   */
  async mockDelay(ms = 180) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
};
