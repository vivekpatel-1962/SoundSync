import { v4 as uuid } from 'uuid';

export const users = [
  { id: 'u1', name: 'Ava', email: 'ava@example.com', avatar: 'https://i.pravatar.cc/100?img=1' },
  { id: 'u2', name: 'Ben', email: 'ben@example.com', avatar: 'https://i.pravatar.cc/100?img=2' },
  { id: 'u3', name: 'Cara', email: 'cara@example.com', avatar: 'https://i.pravatar.cc/100?img=3' }
];

export const songs = [
  {
    id: 's1',
    title: 'Starlight Drive',
    artist: 'Nova Echo',
    duration: 214,
    cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80&auto=format',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    lyrics: {
      static: `In the starlight, we are drifting\nOver oceans of our mind\nHold the moment, keep it with you\nLeave the growing world behind`,
      timed: [
        { time: 0, line: 'In the starlight, we are drifting' },
        { time: 6, line: 'Over oceans of our mind' },
        { time: 12, line: 'Hold the moment, keep it with you' },
        { time: 18, line: 'Leave the growing world behind' }
      ]
    }
  },
  {
    id: 's2',
    title: 'Neon Skyline',
    artist: 'Citywave',
    duration: 198,
    cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80&auto=format',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    lyrics: {
      static: `Under neon, hearts are glowing\nShadows dancing in the rain\nHear the rhythm, feel it growing\nBeat it once and start again`,
      timed: [
        { time: 0, line: 'Under neon, hearts are glowing' },
        { time: 5, line: 'Shadows dancing in the rain' },
        { time: 10, line: 'Hear the rhythm, feel it growing' },
        { time: 15, line: 'Beat it once and start again' }
      ]
    }
  },
  {
    id: 's3',
    title: 'Golden Hourglass',
    artist: 'Solstice',
    duration: 225,
    cover: 'https://images.unsplash.com/photo-1494232410401-ad00d5433cfa?w=600&q=80&auto=format',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    lyrics: {
      static: `Time is falling through our fingers\nCatch a grain and make it stay\nEvery second softly lingers\nIn the glow of yesterday`,
      timed: [
        { time: 0, line: 'Time is falling through our fingers' },
        { time: 7, line: 'Catch a grain and make it stay' },
        { time: 14, line: 'Every second softly lingers' },
        { time: 21, line: 'In the glow of yesterday' }
      ]
    }
  }
];

export const playlists = [
  { id: 'p1', name: 'Daily Mix', cover: songs[0].cover, songIds: ['s1', 's2', 's3'] },
  { id: 'p2', name: 'Focus Flow', cover: songs[1].cover, songIds: ['s2', 's3'] },
  { id: 'p3', name: 'Night Drive', cover: songs[2].cover, songIds: ['s3', 's1'] }
];

// Ensure a default "Liked" playlist exists
const likedId = 'liked';
if (!playlists.find(p => p.id === likedId)) {
  playlists.unshift({ id: likedId, name: 'Liked', cover: songs[0]?.cover, songIds: [] });
}

function genJoinCode() {
  return uuid().slice(0, 8).toUpperCase();
}

function genUniqueJoinCode() {
  let code;
  do {
    code = genJoinCode();
  } while (rooms.some(r => r.joinCode && r.joinCode === code));
  return code;
}

export const rooms = [
  {
    id: 'r1',
    name: 'Lounge',
    members: ['u1'],
    queue: [ { key: `sample:${songs[0].id}`, type: 'sample', songId: songs[0].id, meta: { title: songs[0].title, subtitle: songs[0].artist, cover: songs[0].cover }, votes: { up: new Set(['u1']), down: new Set() } } ],
    theme: { primary: '#7c3aed', accent: '#22d3ee' },
    isPairMode: false,
    pair: [],
    isPublic: true,
    joinCode: null
  }
];

export const getSong = (id) => songs.find(s => s.id === id);
export const getUser = (id) => users.find(u => u.id === id);
export const getPlaylist = (id) => playlists.find(p => p.id === id);

export function createPlaylist({ name, cover }) {
  const p = {
    id: uuid(),
    name: name || 'New Playlist',
    cover: cover || songs[0]?.cover,
    songIds: []
  };
  playlists.push(p);
  return p;
}

export function addSongToPlaylist(playlistId, songId) {
  const p = getPlaylist(playlistId);
  const s = getSong(songId);
  if (!p || !s) return null;
  if (!p.songIds.includes(songId)) p.songIds.push(songId);
  return p;
}

export function removeSongFromPlaylist(playlistId, songId) {
  const p = getPlaylist(playlistId);
  if (!p) return null;
  p.songIds = p.songIds.filter(id => id !== songId);
  return p;
}

export function deletePlaylist(id) {
  if (id === 'liked') return false; // protect default Liked
  const idx = playlists.findIndex(p => p.id === id);
  if (idx === -1) return false;
  playlists.splice(idx, 1);
  return true;
}

export function createRoom({ name, isPairMode = false, theme, pair = [], isPublic = true }) {
  const room = {
    id: uuid(),
    name: name || 'New Room',
    members: [],
    queue: [],
    theme: theme || { primary: '#16a34a', accent: '#f59e0b' },
    isPairMode,
    pair,
    isPublic: Boolean(isPublic),
    joinCode: isPublic ? null : genUniqueJoinCode()
  };
  rooms.push(room);
  return room;
}

function buildKeyAndMeta(payload) {
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

export function addToQueue(roomId, payload, userId) {
  const room = rooms.find(r => r.id === roomId);
  if (!room) return null;
  const built = buildKeyAndMeta(payload);
  if (!built) return null;
  const existing = room.queue.find(q => q.key === built.key);
  if (existing) return existing;
  const entry = { ...built, votes: { up: new Set([userId]), down: new Set() } };
  room.queue.push(entry);
  return entry;
}

export function voteSong(roomId, key, userId, vote) {
  const room = rooms.find(r => r.id === roomId);
  if (!room) return null;
  const entry = room.queue.find(q => q.key === key);
  if (!entry) return null;
  // Ensure exclusive vote per user
  entry.votes.up.delete(userId);
  entry.votes.down.delete(userId);
  if (vote === 'up') entry.votes.up.add(userId);
  if (vote === 'down') entry.votes.down.add(userId);
  return entry;
}

export function serializeQueue(queue) {
  return queue.map(q => ({
    key: q.key,
    type: q.type,
    title: q.meta?.title,
    subtitle: q.meta?.subtitle,
    cover: q.meta?.cover,
    up: q.votes.up.size,
    down: q.votes.down.size,
    // Provide audioUrl for sample-library songs; YouTube entries have no direct URL here
    audioUrl: q.songId ? (getSong(q.songId)?.audioUrl || null) : null,
    ytId: q.ytId || null
  }));
}

export function getRecommendationsForUser(userId, partnerId) {
  // Very simple: rotate songs and merge for pair
  const base = [...songs];
  if (partnerId) base.reverse();
  return base.slice(0, 5);
}
