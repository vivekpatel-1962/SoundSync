const baseHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  try {
    // If Clerk is available, forward a simple user id header for demo endpoints
    const uid = typeof window !== 'undefined' && window.Clerk && window.Clerk.user && window.Clerk.user.id;
    if (uid) headers['x-user-id'] = uid;
  } catch {}
  return headers;
};

const request = async (path, options = {}) => {
  const res = await fetch(`/api${path}`, {
    headers: { ...baseHeaders(), ...(options.headers || {}) },
    ...options
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `${res.status}`);
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { raw: text }; }
};

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body || {}) }),
  delete: (path) => request(path, { method: 'DELETE' }),
  download: async (path, filename) => {
    const res = await fetch(`/api${path}`, { headers: baseHeaders() });
    const text = await res.text();
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename || 'download.json'; a.click();
    URL.revokeObjectURL(url);
  }
};

