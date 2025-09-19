// API configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin);

export const API_ENDPOINTS = {
  VENUES: `${API_BASE_URL}/api/venues`,
  VENUE_DETAIL: (id: string) => `${API_BASE_URL}/api/venues/${id}`,
  QUOTE: `${API_BASE_URL}/api/ai/quote`,
  INQUIRIES: `${API_BASE_URL}/api/inquiries`,
  ADS: `${API_BASE_URL}/api/ads`,
  AGENT_RELAY: `${API_BASE_URL}/api/agent/relay`,
  HEALTH: `${API_BASE_URL}/api/health`
};

export default API_ENDPOINTS;