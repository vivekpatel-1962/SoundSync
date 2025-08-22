import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useUser } from '@clerk/clerk-react';
import { useRoom } from '../context/RoomContext.jsx';
import Chat from '../components/Chat.jsx';
import PlayerControls from '../components/PlayerControls.jsx';
import YouTubePlayer from '../components/YouTubePlayer.jsx';
import { Button } from '../components/ui/button.jsx';
import { container, fadeUp } from '../lib/motionPresets.js';

export default function RoomDetail() {
  const { id } = useParams();
  const { user } = useUser();
  const { setCurrentRoom, socket } = useRoom();
  const [room, setRoom] = useState(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [savedCode, setSavedCode] = useState('');
  const navigate = useNavigate();
  const [playingIdx, setPlayingIdx] = useState(null);

  const load = async () => {
    const r = await api.get(`/rooms/${id}`);
    setRoom(r.room);
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => { if (room) setCurrentRoom({ id: room.id, name: room.name }); return () => setCurrentRoom(null); }, [room, setCurrentRoom]);

  // Load saved join code (available immediately after creating a private room)
  useEffect(() => {
    try {
      const map = JSON.parse(localStorage.getItem('roomJoinCodes') || '{}');
      if (id && map[id]) setSavedCode(map[id]);
    } catch {}
  }, [id]);

  useEffect(() => {
    if (!socket) return;
    const onQueue = (p) => setRoom(r => ({ ...r, queue: p.queue }));
    const onVote = (p) => setRoom(r => ({ ...r, queue: p.queue }));
    socket.on('queueUpdated', onQueue);
    socket.on('voteUpdated', onVote);
    return () => { socket.off('queueUpdated', onQueue); socket.off('voteUpdated', onVote); };
  }, [socket]);

  const leave = async () => {
    try {
      await api.post(`/rooms/${id}/leave`, { userId: user.id });
      navigate('/rooms');
    } catch (e) {
      console.error(e);
      alert('Failed to leave room. ' + ('' + e.message));
    }
  };
  const addYT = async (yt) => { await api.post(`/rooms/${id}/queue`, { yt, userId: user.id }); };
  const vote = async (key, v) => { await api.post(`/rooms/${id}/vote`, { key, userId: user.id, vote: v }); };

  const doSearch = async () => {
    if (!search.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await api.get(`/yt/search?q=${encodeURIComponent(search)}`);
      const items = Array.isArray(res.items) ? res.items : [];
      const mapped = items.map(it => ({
        id: it.id,
        title: it.title,
        channel: it.channel,
        cover: it.thumbnails?.high?.url || it.thumbnails?.medium?.url || it.thumbnails?.default?.url || `https://i.ytimg.com/vi/${it.id}/hqdefault.jpg`
      }));
      setResults(mapped);
    } finally {
      setSearching(false);
    }
  };

  const theme = useMemo(() => room?.theme || { primary: '#7c3aed', accent: '#22d3ee' }, [room]);
  // Use a distinct public-room gradient similar to the reference image
  const publicGradient = 'linear-gradient(135deg, #a9d6df 0%, #1b8c86 100%)';
  const sortedQueue = useMemo(() => {
    const list = Array.isArray(room?.queue) ? [...room.queue] : [];
    return list.sort((a, b) => (b.up - b.down) - (a.up - a.down));
  }, [room?.queue]);
  // Derive YouTube id from key if missing
  const withDerived = useMemo(() => sortedQueue.map(q => ({
    ...q,
    _ytId: q.ytId || (typeof q.key === 'string' && q.key.startsWith('yt:') ? q.key.split(':')[1] : null)
  })), [sortedQueue]);
  const playableQueue = useMemo(() => withDerived.filter(q => !!(q.audioUrl || q._ytId)), [withDerived]);
  const current = typeof playingIdx === 'number' && playingIdx >= 0 ? playableQueue[playingIdx] : null;

  if (!room) return <div>Loading...</div>;

  const notMember = !room.isMember;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={fadeUp} className="rounded-xl overflow-hidden shadow border border-[var(--border)]">
        <div
          className="p-6"
          style={{
            background: room.isPublic
              ? publicGradient
              : `linear-gradient(135deg, ${theme.primary} 0%, ${theme.accent} 100%)`,
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-0)] drop-shadow">{room.name}</h1>
              <div className="text-[var(--text-1)] text-sm">{room.members?.length || 0} members · {room.isPublic ? 'Public' : 'Private'}</div>
            </div>
            {room.isMember && (
              <div className="flex items-center gap-2">
                {!!savedCode && (
                  <div className="flex items-center gap-2 rounded p-2 border border-[var(--border)] bg-[var(--panel)]">
                    <code className="px-2 py-1 rounded bg-[var(--bg-2)] border border-[var(--border)] tracking-widest text-[var(--text-0)]">{savedCode}</code>
                    <Button variant="secondary" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(savedCode); } catch {} }}>Copy</Button>
                  </div>
                )}
                <Button variant="secondary" onClick={leave}>Leave Room</Button>
              </div>
            )}
          </div>
        </div>
        {!room.isMember && (
          <div className="px-6 py-3 bg-[var(--bg-2)] text-[var(--text-1)] text-sm border-t border-[var(--border)]">
            Join the room to add to queue and vote.
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Queue + Search */}
        <div className="lg:col-span-2 space-y-4">
          {current && (
            current.audioUrl ? (
              <PlayerControls
                key={`mp-${current.key}`}
                src={current.audioUrl}
                cover={current.cover}
                title={current.title}
                artist={current.subtitle}
                autoPlay
                onEnd={() => {
                  const next = (playingIdx ?? -1) + 1;
                  if (next < playableQueue.length) setPlayingIdx(next); else setPlayingIdx(null);
                }}
              />
            ) : (
              <YouTubePlayer
                key={`mp-${current.key}`}
                videoId={current._ytId}
                cover={current.cover}
                title={current.title}
                artist={current.subtitle}
                autoPlay
                onEnd={() => {
                  const next = (playingIdx ?? -1) + 1;
                  if (next < playableQueue.length) setPlayingIdx(next); else setPlayingIdx(null);
                }}
              />
            )
          )}

          {/* Queue */}
          <motion.div variants={fadeUp} className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Queue</div>
              <Button
                onClick={() => {
                  if (notMember) return;
                  if (!sortedQueue.length) return;
                  if (!playableQueue.length) { alert('No playable items in queue yet. Add a sample track to play.'); return; }
                  setPlayingIdx(0);
                }}
                disabled={notMember || !sortedQueue.length}
              >
                Play All
              </Button>
            </div>
            <div className="space-y-2">
              {sortedQueue.map(q => (
                <motion.div variants={fadeUp} key={q.key} className={`flex items-center gap-3 rounded-lg p-2 ${notMember ? 'bg-[var(--panel)]' : 'bg-[var(--panel)] hover:bg-[var(--bg-2)] transition-colors'}`}>
                  <img src={q.cover} alt="cover" loading="lazy" className="w-12 h-12 rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{q.title}</div>
                    <div className="text-xs text-[var(--text-1)] truncate">{q.subtitle}</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-1)]">
                    <span className="px-2 py-1 rounded bg-emerald-600/20">👍 {q.up}</span>
                    <span className="px-2 py-1 rounded bg-rose-600/20">👎 {q.down}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => vote(q.key, 'up')} disabled={notMember}>👍</Button>
                    <Button variant="secondary" size="sm" onClick={() => vote(q.key, 'down')} disabled={notMember}>👎</Button>
                  </div>
                </motion.div>
              ))}
              {!sortedQueue.length && <div className="text-sm text-[var(--text-1)]">No songs yet. Add one below.</div>}
            </div>
          </motion.div>

          

          {/* YouTube Search */}
          <motion.div variants={fadeUp} className="card">
            <div className="font-semibold mb-3">Add from YouTube</div>
            <div className="flex gap-2 mb-3">
              <input className="input flex-1" placeholder="Search YouTube (title, artist, etc.)" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key==='Enter' && doSearch()} />
              <Button onClick={doSearch} disabled={searching}>{searching ? 'Searching...' : 'Search'}</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
              {results.map(v => (
                <motion.div variants={fadeUp} key={v.id} className="flex items-center gap-3 bg-[var(--panel)] rounded p-2">
                  <img src={v.cover} alt="thumb" loading="lazy" className="w-12 h-12 rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate" title={v.title}>{v.title}</div>
                    <div className="text-xs text-[var(--text-1)] truncate" title={v.channel}>{v.channel}</div>
                  </div>
                  <Button onClick={() => addYT(v)} disabled={notMember}>Add</Button>
                </motion.div>
              ))}
              {!results.length && !searching && <div className="text-sm text-[var(--text-1)]">Search to add YouTube tracks to the queue.</div>}
            </div>
            {notMember && <div className="mt-2 text-xs text-[var(--text-1)]">Join the room to add songs.</div>}
          </motion.div>
        </div>
        {/* Right: Chat */}
        <motion.div variants={fadeUp}>
          <Chat roomId={id} />
        </motion.div>
      </div>
    </motion.div>
  );
}
