// API configuration
const API_BASE_URL = "https://venue-backend-1.onrender.com";

export const API_ENDPOINTS = {
  VENUES: `${API_BASE_URL}/api/venues/ai-search`,
  VENUES_REPLY: `${API_BASE_URL}/api/venues/reply`,
  VENUE_DETAIL: (id: string) => `${API_BASE_URL}/api/venues/${id}`,
  QUOTE: `${API_BASE_URL}/api/ai/quote`,
  INQUIRIES: `${API_BASE_URL}/api/inquiries`,
  INQUIRIES_AGENT_RESPONSE: `${API_BASE_URL}/api/inquiries/agent-response`,
  INQUIRIES_AGENT_DATA: (id: string) => `${API_BASE_URL}/api/inquiries/agent-data/${id}`,
  ADS: `${API_BASE_URL}/api/ads`,
  AGENT_RELAY: `${API_BASE_URL}/api/agent/relay`,
  HEALTH: `${API_BASE_URL}/api/health`
};

export default API_ENDPOINTS;