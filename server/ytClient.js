import https from 'https';

// Environment and defaults
const RAW_KEYS = (process.env.YOUTUBE_API_KEYS || '').split(',').map(s => s.trim()).filter(Boolean);
const FALLBACK_KEY = (process.env.YOUTUBE_API_KEY || '').trim();
const KEYS = RAW_KEYS.length ? RAW_KEYS : (FALLBACK_KEY ? [FALLBACK_KEY] : []);
const COOLDOWN_MS = Math.max(0, parseInt(process.env.YT_KEY_COOLDOWN_MS || '3600000', 10) || 3600000);
const CACHE_TTL_MS = Math.max(0, parseInt(process.env.YT_CACHE_TTL_MS || '0', 10) || 0);

let rrIndex = 0; // round-robin index
const disabledUntil = new Map(); // key -> timestamp
const lastErrors = new Map(); // key -> { reason, at }

// Simple in-memory cache
const cache = new Map(); // cacheKey -> { body, expiry }

function cacheGet(k) {
  if (!CACHE_TTL_MS) return null;
  const v = cache.get(k);
  if (!v) return null;
  if (Date.now() > v.expiry) { cache.delete(k); return null; }
  return v.body;
}

function cacheSet(k, body) {
  if (!CACHE_TTL_MS) return;
  try { cache.set(k, { body, expiry: Date.now() + CACHE_TTL_MS }); } catch {}
}

function buildUrl(endpoint, params, key) {
  const base = `https://www.googleapis.com/youtube/v3/${endpoint}`;
  const p = new URLSearchParams({ ...params, key }).toString();
  return `${base}?${p}`;
}

function parseYtError(status, data) {
  // Returns { error, quota }
  try {
    const parsed = JSON.parse(data || '{}');
    const reason = parsed?.error?.errors?.[0]?.reason || parsed?.error?.status || null;
    const msg = (parsed?.error?.message || '').toLowerCase();
    const quota = reason === 'quotaExceeded' || reason === 'dailyLimitExceeded' || reason === 'rateLimitExceeded' || msg.includes('quota') || msg.includes('exceeded') || status === 403;
    const err = new Error(parsed?.error?.message || `YouTube error ${status}`);
    err.status = status;
    if (reason) err.reason = reason;
    if (quota) err.quotaExceeded = true;
    return { error: err, quota };
  } catch {
    const err = new Error(`YouTube error ${status}`);
    err.status = status;
    return { error: err, quota: status === 403 };
  }
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (ch) => { data += ch; });
      res.on('end', () => {
        try {
          if (res.statusCode && res.statusCode >= 400) {
            const { error } = parseYtError(res.statusCode, data);
            return reject(error);
          }
          resolve(JSON.parse(data || '{}'));
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function getNextKey() {
  if (!KEYS.length) return null;
  const n = KEYS.length;
  for (let i = 0; i < n; i++) {
    const idx = (rrIndex + i) % n;
    const k = KEYS[idx];
    const until = disabledUntil.get(k) || 0;
    if (Date.now() >= until) {
      rrIndex = (idx + 1) % n; // advance for next call
      return k;
    }
  }
  return null; // all cooling down
}

function markBadKey(key, err) {
  if (!key) return;
  const reason = err?.reason || err?.message || 'unknown';
  lastErrors.set(key, { reason, at: Date.now() });
  if (err?.quotaExceeded && COOLDOWN_MS > 0) {
    disabledUntil.set(key, Date.now() + COOLDOWN_MS);
  }
}

export function keysInfo() {
  return KEYS.map(k => ({
    keyPreview: k.slice(0, 6) + '...' + k.slice(-4),
    disabledUntil: disabledUntil.get(k) || 0,
    lastError: lastErrors.get(k) || null
  }));
}

export async function ytFetch(endpoint, params) {
  // caching key independent of API key
  const cacheKey = `${endpoint}?${new URLSearchParams(params).toString()}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  if (!KEYS.length) {
    const e = new Error('No YouTube API keys configured');
    e.status = 500;
    throw e;
  }

  const tried = new Set();
  let lastErr = null;

  for (let attempts = 0; attempts < KEYS.length; attempts++) {
    const key = getNextKey();
    if (!key) { break; }
    if (tried.has(key)) { continue; }
    tried.add(key);

    const url = buildUrl(endpoint, params, key);
    try {
      const json = await httpGetJson(url);
      cacheSet(cacheKey, json);
      return json;
    } catch (err) {
      lastErr = err;
      // Only mark key bad on quota/403 errors
      if (err?.quotaExceeded || err?.status === 403) {
        markBadKey(key, err);
        continue; // try next key
      }
      // Non-quota errors: don't disable the key, but if more keys exist, try next; else throw
      if (attempts < KEYS.length - 1) continue; else throw err;
    }
  }

  if (lastErr) throw lastErr;
  const e = new Error('All YouTube API keys are cooling down');
  e.status = 503;
  e.quotaExceeded = true;
  throw e;
}

export async function ytSearch(params) {
  return ytFetch('search', params);
}

export async function ytVideos(params) {
  return ytFetch('videos', params);
}
