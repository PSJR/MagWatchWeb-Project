/**
 * API client for the spark.fun backend.
 * All routes live under /api (the deployment routes that prefix to FastAPI).
 */

const BASE = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');
const API = `${BASE}/api`;

const TOKEN_KEY = 'sparkfun.session';

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setSession(session) {
  try {
    if (session) localStorage.setItem(TOKEN_KEY, JSON.stringify(session));
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode — the app still works, it just forgets between reloads */
  }
}

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

async function request(path, { method = 'GET', body, auth = true, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const session = getSession();
  if (auth && session?.token) headers.Authorization = `Bearer ${session.token}`;

  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Perdemos a conexão com a casa.', 0);
  }

  if (res.status === 204) return null;

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { detail: text }; }

  if (!res.ok) {
    const detail = data?.detail;
    throw new ApiError(humanError(res.status, detail), res.status, detail);
  }
  return data;
}

/** Error copy rules from /design/10-content-and-microcopy.md § 5. */
function humanError(status, detail) {
  if (typeof detail === 'string' && detail.length && status !== 500) return detail;
  if (status === 401) return 'Sua sessão expirou. Entre de novo.';
  if (status === 403) return 'Isso aí não é seu para mexer.';
  if (status === 404) return 'Não achei isso por aqui.';
  if (status === 429) return 'Calma com a fogueira — muitas ações seguidas.';
  return 'A gente derrubou alguma coisa. Já estamos consertando.';
}

const qs = (params) => {
  const clean = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return clean.length ? `?${new URLSearchParams(clean)}` : '';
};

export const api = {
  // ---- session ----
  nonce: (address) => request(`/sf/auth/nonce${qs({ address })}`, { auth: false }),
  verify: (payload) => request('/sf/auth/verify', { method: 'POST', body: payload, auth: false }),
  guest: (payload) => request('/sf/auth/guest', { method: 'POST', body: payload, auth: false }),
  me: () => request('/sf/me'),
  updateMe: (patch) => request('/sf/me', { method: 'PATCH', body: patch }),

  // ---- discovery ----
  tokens: (params, signal) => request(`/sf/tokens${qs(params)}`, { auth: false, signal }),
  token: (address, signal) => request(`/sf/tokens/${address}`, { auth: false, signal }),
  createToken: (payload) => request('/sf/tokens', { method: 'POST', body: payload }),
  tickerAvailable: (ticker) => request(`/sf/tokens/ticker/${encodeURIComponent(ticker)}`, { auth: false }),

  // ---- trading ----
  quote: (address, payload) => request(`/sf/tokens/${address}/quote`, { method: 'POST', body: payload, auth: false }),
  trade: (address, payload) => request(`/sf/tokens/${address}/trade`, { method: 'POST', body: payload }),
  trades: (address, params) => request(`/sf/tokens/${address}/trades${qs(params)}`, { auth: false }),
  holders: (address) => request(`/sf/tokens/${address}/holders`, { auth: false }),
  candles: (address, params) => request(`/sf/tokens/${address}/candles${qs(params)}`, { auth: false }),

  // ---- social ----
  comments: (address) => request(`/sf/tokens/${address}/comments`, { auth: false }),
  comment: (address, body) => request(`/sf/tokens/${address}/comments`, { method: 'POST', body }),
  favorite: (address) => request(`/sf/tokens/${address}/favorite`, { method: 'POST' }),

  // ---- profiles ----
  portfolio: () => request('/sf/me/portfolio'),
  history: (params) => request(`/sf/me/history${qs(params)}`),
  favorites: () => request('/sf/me/favorites'),
  activity: (handle) => request(`/sf/users/${handle}/activity`, { auth: false }),
  profile: (handle) => request(`/sf/users/${handle}`, { auth: false }),
  follow: (handle) => request(`/sf/users/${handle}/follow`, { method: 'POST' }),
  creator: (handle) => request(`/sf/creators/${handle}`, { auth: false }),
  creatorDashboard: () => request('/sf/me/creator'),
  claimFees: () => request('/sf/me/creator/claim', { method: 'POST' }),

  // ---- ambient ----
  stats: () => request('/sf/stats', { auth: false }),
  liveFeed: (params) => request(`/sf/feed${qs(params)}`, { auth: false }),
  leaderboard: (params) => request(`/sf/leaderboard${qs(params)}`, { auth: false }),
};

/** WebSocket URL for the live feed, derived from the HTTP base. */
export function liveSocketUrl(channel = 'global') {
  const base = BASE || (typeof window !== 'undefined' ? window.location.origin : '');
  const url = new URL(`${base}/api/sf/live`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('channel', channel);
  return url.toString();
}
