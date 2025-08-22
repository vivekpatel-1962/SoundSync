import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuid } from 'uuid';
import 'dotenv/config';
import https from 'https';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectMongo, isMongoConfigured, isMongoConnected } from './db.js';
import { getOrCreateUserYT } from './models/UserYT.js';
import { Room } from './models/Room.js';
import {
  users,
  songs,
  playlists,
  rooms,
  getSong,
  getUser,
  getPlaylist,
  createRoom,
  addToQueue,
  voteSong,
  serializeQueue,
  getRecommendationsForUser
} from './sampleData.js';
import { createPlaylist, addSongToPlaylist, removeSongFromPlaylist, deletePlaylist } from './sampleData.js';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 4000;

// __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize MongoDB (optional; app continues if not configured)
connectMongo();

// In-memory fallback store when MongoDB isn't configured
const ytMem = new Map(); // userId -> { userId, likes: string[], playlists: Map<string, {id,title,channel}[]> }
function getMemUserYT(userId) {
  let doc = ytMem.get(userId);
  if (!doc) {
    doc = { userId, likes: [], playlists: new Map() };
    ytMem.set(userId, doc);
  }
  return doc;
}

// Per-user recommendations cache and in-flight deduping
const REC_CACHE_TTL_MS = Number.parseInt(process.env.REC_CACHE_TTL_MS || '600000', 10); // default 10 minutes
const recCache = new Map(); // key: `${userId}:${topK}` -> { t: number, data: any }
const inflight = new Map(); // key: `${userId}:${topK}` -> Promise<void>

// --- Helpers for Rooms (DB path) ---
function votesCount(v) {
  if (!v) return 0;
  if (Array.isArray(v)) return v.length;
  if (typeof v.size === 'number') return v.size;
  return 0;
}

function serializeQueueAny(queue) {
  return (queue || []).map(q => ({
    key: q.key,
    type: q.type,
    title: q.meta?.title,
    subtitle: q.meta?.subtitle,
    cover: q.meta?.cover,
    up: votesCount(q?.votes?.up),
    down: votesCount(q?.votes?.down),
    audioUrl: q.songId ? (getSong(q.songId)?.audioUrl || null) : null,
    ytId: q.ytId || null
  }));
}

function buildKeyAndMetaForDb(payload) {
  if (payload?.songId) {
    const s = getSong(payload.songId);
    if (!s) return null;
    return {
      key: `sample:${s.id}`,
      type: 'sample',
      meta: { title: s.title, subtitle: s.artist, cover: s.cover },
      songId: s.id
    };
  }
  const yt = payload?.yt;
  if (yt?.id) {
    return {
      key: `yt:${yt.id}`,
      type: 'yt',
      meta: { title: yt.title || 'YouTube', subtitle: yt.channel || 'YouTube', cover: yt.cover },
      ytId: yt.id
    };
  }
  return null;
}

// Socket.IO
io.on('connection', (socket) => {
  // Join room channel
  socket.on('joinRoom', ({ roomId, userId }) => {
    socket.join(roomId);
    socket.to(roomId).emit('system', { type: 'join', message: `${userId} joined` });
  });

  socket.on('message', ({ roomId, userId, userName, text }) => {
    const payload = { id: uuid(), roomId, userId, userName, text, ts: Date.now() };
    io.to(roomId).emit('message', payload);
  });
});

// (Auth routes removed; client uses Clerk. No server-side auth verification in this prototype.)

// --- Recommendations (Python ML) ---
app.get('/api/recommendations', async (req, res) => {
  // Helpers
  function iso8601ToSeconds(iso) {
    if (!iso || typeof iso !== 'string') return 0;
    // Example: PT4M13S
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    const h = parseInt(m[1] || '0', 10);
    const mn = parseInt(m[2] || '0', 10);
    const s = parseInt(m[3] || '0', 10);
    return h * 3600 + mn * 60 + s;
  }
  function httpGetJson(url) {
    return new Promise((resolve, reject) => {
      https.get(url, (ytRes) => {
        let data = '';
        ytRes.on('data', ch => { data += ch; });
        ytRes.on('end', () => {
          try {
            if (ytRes.statusCode && ytRes.statusCode >= 400) {
              const err = new Error(data || String(ytRes.statusCode));
              err.status = ytRes.statusCode;
              try {
                const parsed = JSON.parse(data);
                const reason = parsed?.error?.errors?.[0]?.reason || parsed?.error?.status || null;
                if (reason) err.reason = reason;
                const msg = (parsed?.error?.message || '').toLowerCase();
                if (reason === 'quotaExceeded' || msg.includes('quota')) err.quotaExceeded = true;
              } catch {}
              return reject(err);
            }
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  const userId = (req.header('x-user-id') || users[0]?.id || '').toString();
  const topK = Number.parseInt(req.query.top_k || '12', 10);
  // Rec filtering controls (env-configurable)
  const recsMusicOnlyParam = (process.env.RECS_MUSIC_ONLY ?? '1').toString().toLowerCase();
  const RECS_MUSIC_ONLY = recsMusicOnlyParam === '1' || recsMusicOnlyParam === 'true' || recsMusicOnlyParam === 'yes' || recsMusicOnlyParam === 'on';
  const RECS_MIN_SEC = Math.max(0, parseInt(process.env.RECS_MIN_SEC ?? '60', 10) || 0);
  const RECS_MAX_SEC = Math.max(RECS_MIN_SEC, parseInt(process.env.RECS_MAX_SEC ?? '900', 10) || 900);

  // Cache key per user + topK
  const cacheKey = `${userId}:${topK}`;
  const now = Date.now();
  const cached = recCache.get(cacheKey);
  if (cached && (now - cached.t) < REC_CACHE_TTL_MS) {
    return res.json(cached.data);
  }

  // If a build is already in-flight for this key, wait and then serve cache
  const pending = inflight.get(cacheKey);
  if (pending) {
    try { await pending; } catch {}
    const again = recCache.get(cacheKey);
    if (again) return res.json(again.data);
  }

  // Try to use YouTube likes (Mongo or in-memory fallback)
  let ytLikes = [];
  let ytTracks = [];
  try {
    let doc = null;
    if (isMongoConfigured() && isMongoConnected()) {
      try { doc = await getOrCreateUserYT(userId); } catch { doc = null; }
    }
    if (!doc) { doc = getMemUserYT(userId); }
    ytLikes = Array.isArray(doc?.likes) ? doc.likes.slice(0, 40) : [];
    const likedList = doc?.playlists?.get('liked') || [];
    ytTracks = Array.isArray(likedList) ? likedList : [];
  } catch {}

  const key = process.env.YOUTUBE_API_KEY;
  const useYouTube = key && ytLikes.length > 0;
  let quotaHit = false;
  const cachedAny = recCache.get(cacheKey); // may be stale

  // Helper: build recs directly from liked playlist (fallback if ML fails)
  const returnLikedBased = async () => {
    if (useYouTube) {
      try {
        const likedIds = Array.from(new Set(ytLikes)).slice(0, Math.max(1, Math.min(20, topK * 2)));
        // 1) Details for liked
        let likedItems = [];
        if (likedIds.length) {
          const p = new URLSearchParams({ key, part: 'snippet,contentDetails', id: likedIds.join(',') }).toString();
          const url = `https://www.googleapis.com/youtube/v3/videos?${p}`;
          const details = await httpGetJson(url);
          likedItems = (details.items || []).map(it => ({
            id: it.id,
            title: it.snippet?.title || 'YouTube',
            artist: it.snippet?.channelTitle || 'YouTube',
            duration: iso8601ToSeconds(it.contentDetails?.duration),
            cover: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || null,
            source: 'yt',
            cat: it.snippet?.categoryId
          }));
          if (RECS_MUSIC_ONLY) {
            likedItems = likedItems.filter(x => x.cat === '10' && x.duration >= RECS_MIN_SEC && x.duration <= RECS_MAX_SEC);
          }
          likedItems = likedItems.map(({ cat, ...rest }) => rest);
        }
        // 2) Related per first few liked
        const relatedIdSet = new Set();
        const seedIds = likedIds.slice(0, Math.min(5, likedIds.length));
        for (const seed of seedIds) {
          const sp = new URLSearchParams({ key, part: 'snippet', type: 'video', maxResults: '10', relatedToVideoId: seed, videoDuration: RECS_MUSIC_ONLY ? 'medium' : 'any' }).toString();
          const sUrl = `https://www.googleapis.com/youtube/v3/search?${sp}`;
          try {
            const js = await httpGetJson(sUrl);
            (js.items || []).forEach(it => {
              const vid = it.id?.videoId;
              if (vid && !likedIds.includes(vid)) relatedIdSet.add(vid);
            });
          } catch {}
        }
        const relatedIds = Array.from(relatedIdSet).slice(0, Math.max(0, topK * 3));
        let relatedItems = [];
        if (relatedIds.length) {
          const p2 = new URLSearchParams({ key, part: 'snippet,contentDetails', id: relatedIds.join(',') }).toString();
          const url2 = `https://www.googleapis.com/youtube/v3/videos?${p2}`;
          const details2 = await httpGetJson(url2);
          relatedItems = (details2.items || []).map(it => ({
            id: it.id,
            title: it.snippet?.title || 'YouTube',
            artist: it.snippet?.channelTitle || 'YouTube',
            duration: iso8601ToSeconds(it.contentDetails?.duration),
            cover: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || null,
            source: 'yt',
            cat: it.snippet?.categoryId
          }));
          if (RECS_MUSIC_ONLY) {
            relatedItems = relatedItems.filter(x => x.cat === '10' && x.duration >= RECS_MIN_SEC && x.duration <= RECS_MAX_SEC);
          }
          relatedItems = relatedItems.map(({ cat, ...rest }) => rest);
        }
        const seen = new Set();
        const combined = [];
        for (const item of [...likedItems, ...relatedItems]) {
          if (!item?.id || seen.has(item.id)) continue;
          seen.add(item.id);
          combined.push(item);
          if (combined.length >= topK) break;
        }
        if (combined.length === 0) {
          const recs = songs.slice(0, topK).map(s => ({ id: s.id, title: s.title, artist: s.artist, duration: s.duration, cover: s.cover, source: 'sample' }));
          return sendBody({ songs: recs, playlists });
        }
        return sendBody({ songs: combined, playlists });
      } catch (e) {
        if (e?.quotaExceeded && cachedAny?.data) {
          return sendBody({ ...cachedAny.data, note: 'served-from-cache-quota' });
        }
        const recs = songs.slice(0, topK).map(s => ({ id: s.id, title: s.title, artist: s.artist, duration: s.duration, cover: s.cover, source: 'sample' }));
        return sendBody({ songs: recs, playlists, note: 'yt-liked-fallback' });
      }
    }
    // No YouTube likes or key: use sample liked or top sample
    const likedPl = getPlaylist('liked');
    const likedSampleIds = Array.isArray(likedPl?.songIds) ? likedPl.songIds : [];
    const likedSample = likedSampleIds.map(id => getSong(id)).filter(Boolean);
    const base = likedSample.length ? likedSample : songs;
    const recs = base.slice(0, topK).map(s => ({ id: s.id, title: s.title, artist: s.artist, duration: s.duration, cover: s.cover, source: 'sample' }));
    return sendBody({ songs: recs, playlists });
  };

  // Build candidate catalog for ML
  let songCatalog = [];
  let idToMeta = new Map();
  if (useYouTube) {
    try {
      const channels = Array.from(new Set((ytTracks || []).map(t => t.channel).filter(Boolean))).slice(0, 3);
      const candidateIds = new Set(ytLikes);
      const addSearch = async (q) => {
        const params = new URLSearchParams({
          key,
          part: 'snippet',
          type: 'video',
          maxResults: '20',
          videoEmbeddable: 'true',
          videoDuration: RECS_MUSIC_ONLY ? 'medium' : 'any',
          q
        }).toString();
        const url = `https://www.googleapis.com/youtube/v3/search?${params}`;
        const json = await httpGetJson(url);
        (json.items || []).forEach(it => { const vid = it.id?.videoId; if (vid) candidateIds.add(vid); });
      };
      for (const c of channels) { await addSearch(c); }
      await addSearch('music');

      const allIds = Array.from(candidateIds).slice(0, 50);
      if (allIds.length === 0) throw new Error('no-candidates');
      const params2 = new URLSearchParams({ key, part: 'snippet,contentDetails', id: allIds.join(',') }).toString();
      const url2 = `https://www.googleapis.com/youtube/v3/videos?${params2}`;
      const details = await httpGetJson(url2);
      let items = (details.items || []).map(it => ({
        id: it.id,
        title: it.snippet?.title || 'YouTube',
        artist: it.snippet?.channelTitle || 'YouTube',
        duration: iso8601ToSeconds(it.contentDetails?.duration),
        cover: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || null,
        source: 'yt',
        cat: it.snippet?.categoryId
      }));
      if (RECS_MUSIC_ONLY) {
        items = items.filter(x => x.cat === '10' && x.duration >= RECS_MIN_SEC && x.duration <= RECS_MAX_SEC);
      }
      songCatalog = items.map(({ cat, ...rest }) => rest);
      idToMeta = new Map(songCatalog.map(x => [x.id, x]));
    } catch (e) {
      if (e?.quotaExceeded) quotaHit = true;
      // Fallback to sample catalog
      songCatalog = songs.map(s => ({ id: s.id, title: s.title, artist: s.artist, duration: s.duration, cover: s.cover, source: 'sample' }));
      idToMeta = new Map(songCatalog.map(x => [x.id, x]));
    }
  } else {
    // Sample data fallback
    songCatalog = songs.map(s => ({ id: s.id, title: s.title, artist: s.artist, duration: s.duration, cover: s.cover, source: 'sample' }));
    idToMeta = new Map(songCatalog.map(x => [x.id, x]));
  }

  // Only send likes that exist in our candidate catalog to the model
  const catalogIds = new Set(songCatalog.map(s => s.id));
  const likesForModel = (ytLikes || []).filter(id => catalogIds.has(id));

  const payload = {
    userId,
    songs: songCatalog.map(s => ({ id: s.id, title: s.title, artist: s.artist, duration: s.duration })),
    likes: likesForModel,
    top_k: topK,
  };

  // If quota was hit while building catalog, prefer cached recommendations if available
  if (quotaHit && cachedAny?.data) {
    return sendBody({ ...cachedAny.data, note: 'served-from-cache-quota' });
  }

  const scriptPath = path.resolve(__dirname, 'ml', 'train_recommender.py');
  let responded = false;

  // Register in-flight promise for this request key
  let resolveWait, rejectWait;
  const waitP = new Promise((resolve, reject) => { resolveWait = resolve; rejectWait = reject; });
  inflight.set(cacheKey, waitP);

  function sendBody(payload) {
    if (responded) return;
    responded = true;
    try { recCache.set(cacheKey, { t: Date.now(), data: payload }); } catch {}
    try { resolveWait && resolveWait(); } catch {}
    inflight.delete(cacheKey);
    return res.json(payload);
  }

  async function fallback(reason) {
    if (responded) return;
    try {
      return await returnLikedBased();
    } catch (e) {
      try {
        const recs = getRecommendationsForUser(userId, null);
        return sendBody({ songs: recs, playlists, note: `Fallback used: ${reason}` });
      } catch (e2) {
        return sendBody({ songs, playlists, note: `Fallback (error building recs): ${reason}` });
      }
    }
  }

  try {
    const pyCmd = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'py' : 'python');
    const pyArgs = (process.platform === 'win32' && !process.env.PYTHON_BIN) ? ['-3', scriptPath] : [scriptPath];
    const py = spawn(pyCmd, pyArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
    const out = [];
    const err = [];
    const timer = setTimeout(() => {
      try { py.kill(); } catch {}
      fallback('python-timeout');
    }, 12000);

    py.stdout.on('data', (d) => out.push(d));
    py.stderr.on('data', (d) => err.push(d));
    py.on('error', () => {
      clearTimeout(timer);
      fallback('python-error');
    });
    py.on('close', async (code) => {
      clearTimeout(timer);
      if (responded) return;
      const stdout = Buffer.concat(out).toString('utf8').trim();
      const stderrStr = Buffer.concat(err).toString('utf8').trim();
      if (stderrStr) console.warn('recommender.py stderr:', stderrStr);
      try {
        const json = JSON.parse(stdout || '{}');
        const ids = Array.isArray(json.recommended_ids) ? json.recommended_ids : [];
        if (!ids.length) return fallback('no-ids');
        const recs = ids.map(id => idToMeta.get(id)).filter(Boolean);
        if (!recs.length) return fallback('no-meta-mapping');
        return sendBody({ songs: recs, playlists, metrics: json.metrics || null });
      } catch (e) {
        return fallback('parse-failed');
      }
    });

    // send payload
    py.stdin.write(JSON.stringify(payload));
    py.stdin.end();
  } catch (e) {
    try { rejectWait && rejectWait(e); } catch {}
    inflight.delete(cacheKey);
    return fallback('spawn-failed');
  }
});

// --- Rooms ---
app.get('/api/rooms', async (req, res) => {
  const uid = (req.header('x-user-id') || '').toString();
  if (isMongoConfigured() && isMongoConnected()) {
    try {
      const docs = await Room.find({}, { queue: 0 }).lean();
      const normalized = (docs || []).map(r => ({
        id: r.id,
        name: r.name,
        size: Array.isArray(r.members) ? r.members.length : 0,
        theme: r.theme,
        isPairMode: !!r.isPairMode,
        isPublic: !!r.isPublic,
        isMember: uid ? (Array.isArray(r.members) && r.members.includes(uid)) : false
      }));
      return res.json({ rooms: normalized });
    } catch {}
  }
  // Fallback to in-memory
  const normalized = rooms.map(r => ({
    id: r.id,
    name: r.name,
    size: r.members.length,
    theme: r.theme,
    isPairMode: r.isPairMode,
    isPublic: r.isPublic,
    isMember: uid ? r.members.includes(uid) : false
  }));
  res.json({ rooms: normalized });
});

app.post('/api/rooms', async (req, res) => {
  const { name, isPairMode, theme, pair, isPublic } = req.body || {};
  const uid = (req.header('x-user-id') || '').toString();
  if (isMongoConfigured() && isMongoConnected()) {
    try {
      const id = uuid();
      const privateCode = (isPublic ? null : uuid().slice(0, 8).toUpperCase());
      const doc = await Room.create({
        id,
        name: name || 'New Room',
        members: uid ? [uid] : [],
        queue: [],
        theme: theme || { primary: '#16a34a', accent: '#f59e0b' },
        isPairMode: !!isPairMode,
        pair: Array.isArray(pair) ? pair : [],
        isPublic: isPublic !== false,
        joinCode: privateCode
      });
      const { joinCode, ...rest } = doc.toObject();
      return res.status(201).json({ room: { ...rest, joinCode: doc.isPublic ? null : joinCode } });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to create room' });
    }
  }
  // Fallback to in-memory
  const room = createRoom({ name, isPairMode, theme, pair, isPublic });
  if (uid && !room.members.includes(uid)) room.members.push(uid);
  const { joinCode, ...rest } = room;
  res.status(201).json({ room: { ...rest, joinCode: room.isPublic ? null : joinCode } });
});

app.get('/api/rooms/:id', async (req, res) => {
  const uid = (req.header('x-user-id') || '').toString();
  const roomId = req.params.id;
  if (isMongoConfigured() && isMongoConnected()) {
    try {
      const doc = await Room.findOne({ id: roomId }).lean();
      if (!doc) return res.status(404).json({ error: 'Room not found' });
      const queue = serializeQueueAny(doc.queue);
      const { joinCode, ...sanitized } = doc;
      return res.json({ room: { ...sanitized, isMember: uid ? (doc.members || []).includes(uid) : false, queue } });
    } catch {}
  }
  const room = rooms.find(r => r.id === roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const queue = serializeQueue(room.queue);
  const { joinCode, ...sanitized } = room;
  res.json({ room: { ...sanitized, isMember: uid ? room.members.includes(uid) : false, queue } });
});

app.post('/api/rooms/:id/join', async (req, res) => {
  const { userId, code } = req.body || {};
  const roomId = req.params.id;
  if (isMongoConfigured() && isMongoConnected()) {
    try {
      const doc = await Room.findOne({ id: roomId });
      if (!doc) return res.status(404).json({ error: 'Room not found' });
      if (!doc.isPublic) {
        if (!code || code !== doc.joinCode) return res.status(403).json({ error: 'Invalid or missing join code' });
      }
      if (!doc.members.includes(userId)) doc.members.push(userId);
      await doc.save();
      io.to(doc.id).emit('system', { type: 'member', message: `${userId} joined room` });
      const { joinCode, ...sanitized } = doc.toObject();
      return res.json({ room: { id: sanitized.id, name: sanitized.name, members: sanitized.members, isPublic: sanitized.isPublic } });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to join room' });
    }
  }
  const room = rooms.find(r => r.id === roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (!room.isPublic) {
    if (!code || code !== room.joinCode) return res.status(403).json({ error: 'Invalid or missing join code' });
  }
  if (!room.members.includes(userId)) room.members.push(userId);
  io.to(room.id).emit('system', { type: 'member', message: `${userId} joined room` });
  const { joinCode, ...sanitized } = room;
  res.json({ room: { id: sanitized.id, name: sanitized.name, members: sanitized.members, isPublic: sanitized.isPublic } });
});

// Join a room via code only
app.post('/api/rooms/join-by-code', async (req, res) => {
  const { code, userId } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Missing code' });
  if (isMongoConfigured() && isMongoConnected()) {
    try {
      const doc = await Room.findOne({ isPublic: false, joinCode: code });
      if (!doc) return res.status(404).json({ error: 'Room not found' });
      if (!doc.members.includes(userId)) doc.members.push(userId);
      await doc.save();
      io.to(doc.id).emit('system', { type: 'member', message: `${userId} joined room` });
      const { joinCode, ...sanitized } = doc.toObject();
      return res.json({ room: { id: sanitized.id, name: sanitized.name, members: sanitized.members, isPublic: sanitized.isPublic } });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to join by code' });
    }
  }
  const room = rooms.find(r => !r.isPublic && r.joinCode === code);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (!room.members.includes(userId)) room.members.push(userId);
  io.to(room.id).emit('system', { type: 'member', message: `${userId} joined room` });
  const { joinCode, ...sanitized } = room;
  res.json({ room: { id: sanitized.id, name: sanitized.name, members: sanitized.members, isPublic: sanitized.isPublic } });
});

// Leave a room
app.post('/api/rooms/:id/leave', async (req, res) => {
  const { userId } = req.body || {};
  const roomId = req.params.id;
  if (isMongoConfigured() && isMongoConnected()) {
    try {
      const doc = await Room.findOne({ id: roomId });
      if (!doc) return res.status(404).json({ error: 'Room not found' });
      doc.members = (doc.members || []).filter(id => id !== userId);
      await doc.save();
      io.to(doc.id).emit('system', { type: 'member', message: `${userId} left room` });
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to leave room' });
    }
  }
  const room = rooms.find(r => r.id === roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  room.members = room.members.filter(id => id !== userId);
  io.to(room.id).emit('system', { type: 'member', message: `${userId} left room` });
  res.json({ ok: true });
});

app.post('/api/rooms/:id/queue', async (req, res) => {
  const { songId, yt, userId } = req.body || {};
  const roomId = req.params.id;
  if (isMongoConfigured() && isMongoConnected()) {
    try {
      const doc = await Room.findOne({ id: roomId });
      if (!doc) return res.status(404).json({ error: 'Room not found' });
      if (!(doc.members || []).includes(userId)) return res.status(403).json({ error: 'Join the room to interact' });
      const payload = songId ? { songId } : (yt ? { yt } : null);
      const built = buildKeyAndMetaForDb(payload);
      if (!built) return res.status(400).json({ error: 'Unable to add to queue' });
      const exists = (doc.queue || []).find(q => q.key === built.key);
      if (!exists) {
        doc.queue.push({ ...built, votes: { up: [userId], down: [] } });
        await doc.save();
      }
      io.to(doc.id).emit('queueUpdated', { queue: serializeQueueAny(doc.queue) });
      return res.status(201).json({ queue: serializeQueueAny(doc.queue) });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to add to queue' });
    }
  }
  const room = rooms.find(r => r.id === roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (!room.members.includes(userId)) return res.status(403).json({ error: 'Join the room to interact' });
  const payload = songId ? { songId } : (yt ? { yt } : null);
  const added = addToQueue(roomId, payload, userId);
  if (!added) return res.status(400).json({ error: 'Unable to add to queue' });
  io.to(roomId).emit('queueUpdated', { queue: serializeQueue(room.queue) });
  res.status(201).json({ queue: serializeQueue(room.queue) });
});

app.post('/api/rooms/:id/vote', async (req, res) => {
  const { key, userId, vote } = req.body || {};
  const roomId = req.params.id;
  if (isMongoConfigured() && isMongoConnected()) {
    try {
      const doc = await Room.findOne({ id: roomId });
      if (!doc) return res.status(404).json({ error: 'Room not found' });
      if (!(doc.members || []).includes(userId)) return res.status(403).json({ error: 'Join the room to interact' });
      const entry = (doc.queue || []).find(q => q.key === key);
      if (!entry) return res.status(400).json({ error: 'Unable to vote' });
      entry.votes = entry.votes || { up: [], down: [] };
      entry.votes.up = (entry.votes.up || []).filter(id => id !== userId);
      entry.votes.down = (entry.votes.down || []).filter(id => id !== userId);
      if (vote === 'up') entry.votes.up.push(userId);
      if (vote === 'down') entry.votes.down.push(userId);
      await doc.save();
      io.to(doc.id).emit('voteUpdated', { queue: serializeQueueAny(doc.queue) });
      return res.json({ queue: serializeQueueAny(doc.queue) });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to vote' });
    }
  }
  const room = rooms.find(r => r.id === roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (!room.members.includes(userId)) return res.status(403).json({ error: 'Join the room to interact' });
  const updated = voteSong(roomId, key, userId, vote);
  if (!updated) return res.status(400).json({ error: 'Unable to vote' });
  io.to(roomId).emit('voteUpdated', { queue: serializeQueue(room.queue) });
  res.json({ queue: serializeQueue(room.queue) });
});

// --- Pair / Couple mode ---
app.post('/api/pair', (req, res) => {
  const { userIdA, userIdB } = req.body || {};
  const theme = { primary: '#0ea5e9', accent: '#ef4444' };
  res.json({ pair: [userIdA, userIdB], theme, recommendationHint: 'Combined history' });
});

// --- Library / Playlists ---
app.get('/api/playlists', (req, res) => {
  const expanded = playlists.map(p => ({
    ...p,
    songs: p.songIds.map(id => getSong(id))
  }));
  res.json({ playlists: expanded });
});

// Create a new playlist
app.post('/api/playlists', (req, res) => {
  const { name, cover } = req.body || {};
  const p = createPlaylist({ name, cover });
  res.status(201).json({ playlist: { ...p, songs: p.songIds.map(id => getSong(id)) } });
});

// Add a song to a playlist (including default 'liked' playlist)
app.post('/api/playlists/:id/songs', (req, res) => {
  const { songId } = req.body || {};
  const p = addSongToPlaylist(req.params.id, songId);
  if (!p) return res.status(400).json({ error: 'Invalid playlist or song' });
  res.status(200).json({ playlist: { ...p, songs: p.songIds.map(id => getSong(id)) } });
});

// Remove a song from a playlist
app.delete('/api/playlists/:id/songs/:songId', (req, res) => {
  const p = removeSongFromPlaylist(req.params.id, req.params.songId);
  if (!p) return res.status(400).json({ error: 'Invalid playlist' });
  res.status(200).json({ playlist: { ...p, songs: p.songIds.map(id => getSong(id)) } });
});

// Delete a playlist (cannot delete 'liked')
app.delete('/api/playlists/:id', (req, res) => {
  const ok = deletePlaylist(req.params.id);
  if (!ok) return res.status(400).json({ error: 'Cannot delete playlist' });
  res.status(204).send();
});

// --- Lyrics ---
app.get('/api/songs/:id/lyrics', (req, res) => {
  const song = getSong(req.params.id);
  if (!song) return res.status(404).json({ error: 'Not found' });
  res.json({ lyrics: song.lyrics });
});

// --- Downloads (simulate) ---
app.get('/api/download/playlist/:id', (req, res) => {
  const p = getPlaylist(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const payload = {
    id: p.id,
    name: p.name,
    songs: p.songIds.map(id => getSong(id))
  };
  res.setHeader('Content-Disposition', `attachment; filename="${p.name}.json"`);
  res.json(payload);
});

app.get('/api/songs', (req, res) => {
  res.json({ songs });
});

// --- YouTube proxy: search ---
// GET /api/yt/search?q=QUERY
app.get('/api/yt/search', (req, res) => {
  const q = (req.query.q || '').toString();
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(500).json({ error: 'YOUTUBE_API_KEY not set on server' });
  if (!q) return res.status(400).json({ error: 'Missing query parameter q' });

  const musicOnlyParam = (req.query.musicOnly || '1').toString().toLowerCase();
  const musicOnly = musicOnlyParam === '1' || musicOnlyParam === 'true' || musicOnlyParam === 'yes' || musicOnlyParam === 'on';
  const minSec = Math.max(0, parseInt((req.query.minSec || '60').toString(), 10) || 0); // default 60s to avoid reels
  const maxSec = Math.max(minSec, parseInt((req.query.maxSec || '900').toString(), 10) || 900); // default 15m to avoid movies

  function httpGetJson(url) {
    return new Promise((resolve, reject) => {
      https.get(url, (ytRes) => {
        let data = '';
        ytRes.on('data', chunk => { data += chunk; });
        ytRes.on('end', () => {
          try {
            if (ytRes.statusCode && ytRes.statusCode >= 400) {
              return reject(Object.assign(new Error('YouTube error'), { status: ytRes.statusCode, body: data }));
            }
            resolve(JSON.parse(data));
          } catch (e) { reject(e); }
        });
      }).on('error', reject);
    });
  }

  function iso8601ToSeconds(iso) {
    if (!iso || typeof iso !== 'string') return 0;
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    const h = parseInt(m[1] || '0', 10);
    const mn = parseInt(m[2] || '0', 10);
    const s = parseInt(m[3] || '0', 10);
    return h * 3600 + mn * 60 + s;
  }

  const params = new URLSearchParams({
    key,
    part: 'snippet',
    type: 'video',
    maxResults: '20',
    videoEmbeddable: 'true',
    q
  }).toString();

  const url = `https://www.googleapis.com/youtube/v3/search?${params}`;
  httpGetJson(url)
    .then(async (json) => {
      const items = (json.items || []).map(it => ({
        id: it.id?.videoId,
        title: it.snippet?.title,
        channel: it.snippet?.channelTitle,
        publishedAt: it.snippet?.publishedAt,
        description: it.snippet?.description,
        thumbnails: it.snippet?.thumbnails
      })).filter(x => x.id);

      if (!musicOnly || items.length === 0) {
        return res.json({ items, pageInfo: json.pageInfo, nextPageToken: json.nextPageToken });
      }

      // Fetch details for category and duration filtering
      const ids = items.map(x => x.id).slice(0, 50);
      const params2 = new URLSearchParams({ key, part: 'snippet,contentDetails', id: ids.join(',') }).toString();
      const url2 = `https://www.googleapis.com/youtube/v3/videos?${params2}`;

      try {
        const details = await httpGetJson(url2);
        const meta = new Map(details.items.map(it => [it.id, { cat: it.snippet?.categoryId, dur: iso8601ToSeconds(it.contentDetails?.duration) }]));
        const filtered = items.filter(it => {
          const m = meta.get(it.id);
          if (!m) return false;
          const isMusic = m.cat === '10'; // YouTube Music category
          const inRange = m.dur >= minSec && m.dur <= maxSec;
          return isMusic && inRange;
        });
        return res.json({ items: filtered, pageInfo: json.pageInfo, nextPageToken: json.nextPageToken });
      } catch (e) {
        // On failure of details call, fall back to unfiltered results
        return res.json({ items, pageInfo: json.pageInfo, nextPageToken: json.nextPageToken, note: 'unfiltered-fallback' });
      }
    })
    .catch((err) => {
      console.error('YouTube search request failed:', {
        message: err?.message || String(err),
        status: err?.status,
        body: err?.body
      });
      res.status(502).json({ error: 'YouTube request failed' });
    });
});

// --- YouTube proxy: videos details ---
// GET /api/yt/videos?ids=ID1,ID2,...
app.get('/api/yt/videos', (req, res) => {
  const ids = (req.query.ids || '').toString();
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(500).json({ error: 'YOUTUBE_API_KEY not set on server' });
  if (!ids) return res.status(400).json({ error: 'Missing query parameter ids' });

  const params = new URLSearchParams({
    key,
    part: 'snippet,contentDetails',
    id: ids
  }).toString();

  const url = `https://www.googleapis.com/youtube/v3/videos?${params}`;
  https.get(url, (ytRes) => {
    let data = '';
    ytRes.on('data', chunk => { data += chunk; });
    ytRes.on('end', () => {
      try {
        if (ytRes.statusCode && ytRes.statusCode >= 400) {
          return res.status(ytRes.statusCode).send(data);
        }
        const json = JSON.parse(data);
        const items = (json.items || []).map(it => ({
          id: it.id,
          title: it.snippet?.title,
          channel: it.snippet?.channelTitle,
          description: it.snippet?.description,
          thumbnails: it.snippet?.thumbnails,
          duration: it.contentDetails?.duration
        }));
        res.json({ items });
      } catch (e) {
        res.status(502).json({ error: 'Failed to parse YouTube response' });
      }
    });
  }).on('error', (err) => {
    console.error('YouTube videos request failed:', err?.message);
    res.status(502).json({ error: 'YouTube request failed' });
  });
});

// --- User-specific YouTube likes and playlists (MongoDB-backed) ---
function getUid(req) {
  return (req.header('x-user-id') || '').toString();
}

// Fetch current user's likes and playlists
app.get('/api/user/yt', async (req, res) => {
  try {
    const userId = getUid(req);
    if (!userId) return res.status(401).json({ error: 'Missing user' });
    let doc = null;
    if (isMongoConfigured() && isMongoConnected()) {
      try { doc = await getOrCreateUserYT(userId); } catch { doc = null; }
    }
    if (!doc) doc = getMemUserYT(userId);
    const playlistsObj = Object.fromEntries(doc.playlists || []);
    res.json({ likes: doc.likes || [], playlists: playlistsObj });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load user data' });
  }
});

// Toggle like for a YouTube track (also syncs the special 'liked' playlist)
app.post('/api/user/yt/likes/toggle', async (req, res) => {
  try {
    const userId = getUid(req);
    if (!userId) return res.status(401).json({ error: 'Missing user' });
    const { id, track, like } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Missing id' });
    if (isMongoConfigured() && isMongoConnected()) {
      try {
        const doc = await getOrCreateUserYT(userId);
        let willLike = Array.isArray(doc.likes) ? !doc.likes.includes(id) : true;
        if (typeof like === 'boolean') willLike = like;
        if (willLike) {
          if (!doc.likes.includes(id)) doc.likes.push(id);
          const list = doc.playlists.get('liked') || [];
          if (!list.some(t => t.id === id)) list.push({ id, title: track?.title, channel: track?.channel });
          doc.playlists.set('liked', list);
        } else {
          doc.likes = (doc.likes || []).filter(x => x !== id);
          const list = (doc.playlists.get('liked') || []).filter(t => t.id !== id);
          doc.playlists.set('liked', list);
        }
        await doc.save();
        return res.json({ likes: doc.likes || [], playlists: Object.fromEntries(doc.playlists || []) });
      } catch {
        // fall through to memory below
      }
    }
    const doc = getMemUserYT(userId);
    let willLike = Array.isArray(doc.likes) ? !doc.likes.includes(id) : true;
    if (typeof like === 'boolean') willLike = like;
    if (willLike) {
      if (!doc.likes.includes(id)) doc.likes.push(id);
      const list = doc.playlists.get('liked') || [];
      if (!list.some(t => t.id === id)) list.push({ id, title: track?.title, channel: track?.channel });
      doc.playlists.set('liked', list);
    } else {
      doc.likes = (doc.likes || []).filter(x => x !== id);
      const list = (doc.playlists.get('liked') || []).filter(t => t.id !== id);
      doc.playlists.set('liked', list);
    }
    return res.json({ likes: doc.likes || [], playlists: Object.fromEntries(doc.playlists || []) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update like' });
  }
});

// Create a playlist (no-op if exists). Cannot override 'liked'.
app.post('/api/user/yt/playlists', async (req, res) => {
  try {
    const userId = getUid(req);
    if (!userId) return res.status(401).json({ error: 'Missing user' });
    const name = (req.body?.name || '').toString().trim();
    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (name.toLowerCase() === 'liked') return res.status(400).json({ error: 'Cannot modify liked playlist' });
    if (isMongoConfigured() && isMongoConnected()) {
      try {
        const doc = await getOrCreateUserYT(userId);
        if (!doc.playlists.get(name)) doc.playlists.set(name, []);
        await doc.save();
        return res.status(201).json({ playlists: Object.fromEntries(doc.playlists || []) });
      } catch {
        // fall through to memory below
      }
    }
    const doc = getMemUserYT(userId);
    if (!doc.playlists.get(name)) doc.playlists.set(name, []);
    return res.status(201).json({ playlists: Object.fromEntries(doc.playlists || []) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

// Add track to a playlist (creates playlist if missing)
app.post('/api/user/yt/playlists/:name/tracks', async (req, res) => {
  try {
    const userId = getUid(req);
    if (!userId) return res.status(401).json({ error: 'Missing user' });
    const name = (req.params.name || '').toString();
    const track = req.body?.track;
    if (!track?.id) return res.status(400).json({ error: 'Missing track' });
    if (isMongoConfigured() && isMongoConnected()) {
      try {
        const doc = await getOrCreateUserYT(userId);
        const list = doc.playlists.get(name) || [];
        if (!list.some(t => t.id === track.id)) list.push({ id: track.id, title: track.title, channel: track.channel });
        doc.playlists.set(name, list);
        await doc.save();
        return res.status(200).json({ playlists: Object.fromEntries(doc.playlists || []) });
      } catch {
        // fall through to memory below
      }
    }
    const doc = getMemUserYT(userId);
    const list = doc.playlists.get(name) || [];
    if (!list.some(t => t.id === track.id)) list.push({ id: track.id, title: track.title, channel: track.channel });
    doc.playlists.set(name, list);
    return res.status(200).json({ playlists: Object.fromEntries(doc.playlists || []) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to add track' });
  }
});

// Remove track from a playlist
app.delete('/api/user/yt/playlists/:name/tracks/:id', async (req, res) => {
  try {
    const userId = getUid(req);
    if (!userId) return res.status(401).json({ error: 'Missing user' });
    const name = (req.params.name || '').toString();
    const id = (req.params.id || '').toString();
    if (isMongoConfigured() && isMongoConnected()) {
      try {
        const doc = await getOrCreateUserYT(userId);
        const list = doc.playlists.get(name) || [];
        const next = list.filter(t => t.id !== id);
        doc.playlists.set(name, next);
        await doc.save();
        return res.status(200).json({ playlists: Object.fromEntries(doc.playlists || []) });
      } catch {
        // fall through to memory below
      }
    }
    const doc = getMemUserYT(userId);
    const list = doc.playlists.get(name) || [];
    const next = list.filter(t => t.id !== id);
    doc.playlists.set(name, next);
    return res.status(200).json({ playlists: Object.fromEntries(doc.playlists || []) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to remove track' });
  }
});

// Delete a playlist (cannot delete 'liked')
app.delete('/api/user/yt/playlists/:name', async (req, res) => {
  try {
    const userId = getUid(req);
    if (!userId) return res.status(401).json({ error: 'Missing user' });
    const name = (req.params.name || '').toString();
    if (name.toLowerCase() === 'liked') return res.status(400).json({ error: 'Cannot delete liked playlist' });
    if (isMongoConfigured() && isMongoConnected()) {
      try {
        const doc = await getOrCreateUserYT(userId);
        if (doc.playlists.has(name)) doc.playlists.delete(name);
        await doc.save();
        return res.status(204).send();
      } catch {
        // fall through to memory below
      }
    }
    const doc = getMemUserYT(userId);
    if (doc.playlists.has(name)) doc.playlists.delete(name);
    return res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete playlist' });
  }
});

httpServer.listen(PORT, () => {
  console.log(`API + Socket.IO listening on :${PORT}`);
});
