const baseHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    // If Clerk is available, forward a simple user id header for demo endpoints
    const uid = typeof window !== 'undefined' && window.Clerk && window.Clerk.user && window.Clerk.user.id;
    if (uid) headers['x-user-id'] = uid;
    // Dev fallback: ensure a stable local id so server can store user/yt likes
    if (!headers['x-user-id']) {
      const key = 'dev-user-id';
      let devId = '';
      try { devId = localStorage.getItem(key) || ''; } catch {}
      if (!devId) {
        devId = 'local-dev';
        try { localStorage.setItem(key, devId); } catch {}
      }
      headers['x-user-id'] = devId;
    }
  } catch {}
  return headers;
};

// Optional API base for production when frontend and backend are on different domains
const API_BASE = (import.meta.env?.VITE_API_BASE || '');

const request = async (path, options = {}) => {
  const { timeoutMs = 5000, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}/api${path}`, {
      headers: { ...baseHeaders(), ...(rest.headers || {}) },
      signal: controller.signal,
      ...rest
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text || `${res.status}`);
    if (!text) return {};
    try { return JSON.parse(text); } catch { return { raw: text }; }
  } finally {
    clearTimeout(timer);
  }
};

export const api = {
  get: (path, opts) => request(path, { timeoutMs: 5000, ...(opts || {}) }),
  post: (path, body, opts) => request(path, { method: 'POST', body: JSON.stringify(body || {}), timeoutMs: 5000, ...(opts || {}) }),
  delete: (path, opts) => request(path, { method: 'DELETE', timeoutMs: 5000, ...(opts || {}) }),
  download: async (path, filename) => {
    const res = await fetch(`${API_BASE}/api${path}`, { headers: baseHeaders() });
    const text = await res.text();
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename || 'download.json'; a.click();
    URL.revokeObjectURL(url);
  }
};

