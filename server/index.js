import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuid } from 'uuid';
import 'dotenv/config';
import https from 'https';
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

// Socket.IO
io.on('connection', (socket) => {
  // Join room channel
  socket.on('joinRoom', ({ roomId, userId }) => {
    socket.join(roomId);
    socket.to(roomId).emit('system', { type: 'join', message: `${userId} joined` });
  });

  socket.on('message', ({ roomId, userId, text }) => {
    const payload = { id: uuid(), roomId, userId, text, ts: Date.now() };
    io.to(roomId).emit('message', payload);
  });
});

// (Auth routes removed; client uses Clerk. No server-side auth verification in this prototype.)

// --- Recommendations ---
app.get('/api/recommendations', (req, res) => {
  const userId = req.header('x-user-id') || users[0].id;
  const partnerId = req.query.partnerId;
  const recs = getRecommendationsForUser(userId, partnerId);
  res.json({ songs: recs, playlists });
});

// --- Rooms ---
app.get('/api/rooms', (req, res) => {
  const normalized = rooms.map(r => ({
    id: r.id,
    name: r.name,
    size: r.members.length,
    theme: r.theme,
    isPairMode: r.isPairMode
  }));
  res.json({ rooms: normalized });
});

app.post('/api/rooms', (req, res) => {
  const { name, isPairMode, theme, pair } = req.body || {};
  const room = createRoom({ name, isPairMode, theme, pair });
  res.status(201).json({ room });
});

app.get('/api/rooms/:id', (req, res) => {
  const room = rooms.find(r => r.id === req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const queue = serializeQueue(room.queue);
  res.json({ room: { ...room, queue } });
});

app.post('/api/rooms/:id/join', (req, res) => {
  const { userId } = req.body;
  const room = rooms.find(r => r.id === req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (!room.members.includes(userId)) room.members.push(userId);
  io.to(room.id).emit('system', { type: 'member', message: `${userId} joined room` });
  res.json({ room: { id: room.id, name: room.name, members: room.members } });
});

app.post('/api/rooms/:id/queue', (req, res) => {
  const { songId, userId } = req.body;
  const roomId = req.params.id;
  const room = rooms.find(r => r.id === roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const added = addToQueue(roomId, songId, userId);
  if (!added) return res.status(400).json({ error: 'Unable to add to queue' });
  io.to(roomId).emit('queueUpdated', { queue: serializeQueue(room.queue) });
  res.status(201).json({ queue: serializeQueue(room.queue) });
});

app.post('/api/rooms/:id/vote', (req, res) => {
  const { songId, userId, vote } = req.body;
  const roomId = req.params.id;
  const room = rooms.find(r => r.id === roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const updated = voteSong(roomId, songId, userId, vote);
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

  const params = new URLSearchParams({
    key,
    part: 'snippet',
    type: 'video',
    maxResults: '20',
    videoEmbeddable: 'true',
    q
  }).toString();

  const url = `https://www.googleapis.com/youtube/v3/search?${params}`;
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
          id: it.id?.videoId,
          title: it.snippet?.title,
          channel: it.snippet?.channelTitle,
          publishedAt: it.snippet?.publishedAt,
          description: it.snippet?.description,
          thumbnails: it.snippet?.thumbnails
        })).filter(x => x.id);
        res.json({ items, pageInfo: json.pageInfo, nextPageToken: json.nextPageToken });
      } catch (e) {
        res.status(502).json({ error: 'Failed to parse YouTube response' });
      }
    });
  }).on('error', (err) => {
    console.error('YouTube search request failed:', err?.message);
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

httpServer.listen(PORT, () => {
  console.log(`API + Socket.IO listening on :${PORT}`);
});
