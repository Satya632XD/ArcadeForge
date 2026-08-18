const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include'
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error?.message || `Request failed (${response.status})`);
    error.code = data?.error?.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

export const api = {
  me: () => request('/auth/me'),
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  games: (params = '') => request(`/games${params ? `?${params}` : ''}`),
  game: (id) => request(`/games/${id}`),
  myGames: () => request('/games/mine'),
  createGame: (body) => request('/games', { method: 'POST', body: JSON.stringify(body) }),
  updateGame: (id, body) => request(`/games/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  publish: (id) => request(`/games/${id}/publish`, { method: 'POST' }),
  unpublish: (id) => request(`/games/${id}/unpublish`, { method: 'POST' }),
  launch: (id) => request(`/games/${id}/launch`, { method: 'POST' }),
  endSession: (gameId, sessionId) => request(`/games/${gameId}/end-session`, { method: 'POST', body: JSON.stringify({ sessionId }) }),
  wallet: () => request('/wallet'),
  packages: () => request('/wallet/packages'),
  buyMock: (body) => request('/wallet/mock-purchase', { method: 'POST', body: JSON.stringify(body) }),
  transactions: () => request('/wallet/transactions'),
  earnings: () => request('/earnings'),
  meProfile: () => request('/users/me'),
  updateProfile: (body) => request('/users/me', { method: 'PATCH', body: JSON.stringify(body) }),
  profile: (username) => request(`/users/${encodeURIComponent(username)}`)
};
