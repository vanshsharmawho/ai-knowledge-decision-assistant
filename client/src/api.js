const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const TOKEN_KEY = 'kb_admin_token';

export const session = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t) => {
    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* storage unavailable */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(method, path, { body, form, auth = true } = {}) {
  const headers = {};
  if (auth && session.get()) headers.Authorization = `Bearer ${session.get()}`;
  if (body) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : form });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Is the API running?');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && auth) session.clear();
    throw new ApiError(res.status, data?.error?.code || 'ERROR', data?.error?.message || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  register: (b) => request('POST', '/api/auth/register', { body: b, auth: false }),
  login: (b) => request('POST', '/api/auth/login', { body: b, auth: false }),
  me: () => request('GET', '/api/auth/me'),

  listDocuments: () => request('GET', '/api/documents'),
  uploadDocument: (file, replaceDocumentId) => {
    const form = new FormData();
    form.append('file', file);
    if (replaceDocumentId) form.append('replaceDocumentId', replaceDocumentId);
    return request('POST', '/api/documents', { form });
  },
  deleteDocument: (id) => request('DELETE', `/api/documents/${id}`),

  getAssistant: () => request('GET', '/api/assistant'),
  regenerateAssistant: () => request('POST', '/api/assistant/regenerate'),

  usage: () => request('GET', '/api/usage'),

  // public (assistant token, no login)
  assistantInfo: (token) => request('GET', `/api/public/assistant/${encodeURIComponent(token)}`, { auth: false }),
  ask: (token, question, debug) => request('POST', '/api/ask', { body: { token, question, debug }, auth: false }),
};
