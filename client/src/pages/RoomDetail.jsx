import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api.js';
import { useUser } from '@clerk/clerk-react';
import { useRoom } from '../context/RoomContext.jsx';
import Chat from '../components/Chat.jsx';

export default function RoomDetail() {
  const { id } = useParams();
  const { user } = useUser();
  const { setCurrentRoom, socket } = useRoom();
  const [room, setRoom] = useState(null);
  const [songs, setSongs] = useState([]);

  const load = async () => {
    const r = await api.get(`/rooms/${id}`);
    setRoom(r.room);
  };

  useEffect(() => { load(); api.get('/songs').then(s => setSongs(s.songs)); }, [id]);
  useEffect(() => { if (room) setCurrentRoom({ id: room.id, name: room.name }); return () => setCurrentRoom(null); }, [room, setCurrentRoom]);

  useEffect(() => {
    if (!socket) return;
    const onQueue = (p) => setRoom(r => ({ ...r, queue: p.queue }));
    const onVote = (p) => setRoom(r => ({ ...r, queue: p.queue }));
    socket.on('queueUpdated', onQueue);
    socket.on('voteUpdated', onVote);
    return () => { socket.off('queueUpdated', onQueue); socket.off('voteUpdated', onVote); };
  }, [socket]);

  const join = async () => { await api.post(`/rooms/${id}/join`, { userId: user.id }); await load(); };
  const add = async (songId) => { await api.post(`/rooms/${id}/queue`, { songId, userId: user.id }); };
  const vote = async (songId, v) => { await api.post(`/rooms/${id}/vote`, { songId, userId: user.id, vote: v }); };

  const theme = useMemo(() => room?.theme || { primary: '#7c3aed', accent: '#22d3ee' }, [room]);

  if (!room) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: theme.primary }}>{room.name}</h1>
          <div className="text-slate-400 text-sm">{room.members?.length || 0} members</div>
        </div>
        <button className="btn btn-primary" onClick={join}>Join Room</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <div className="font-semibold mb-2">Queue</div>
            <div className="space-y-2">
              {room.queue?.map(q => (
                <div key={q.songId} className="flex items-center justify-between bg-slate-800/50 rounded p-2">
                  <div className="flex-1">
                    <div className="font-medium">{songs.find(s => s.id===q.songId)?.title}</div>
                    <div className="text-xs text-slate-400">Up: {q.up} · Down: {q.down}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-secondary" onClick={() => vote(q.songId, 'up')}>👍</button>
                    <button className="btn btn-secondary" onClick={() => vote(q.songId, 'down')}>👎</button>
                  </div>
                </div>
              ))}
              {!room.queue?.length && <div className="text-sm text-slate-400">No songs yet. Add one below.</div>}
            </div>
          </div>

          <div className="card">
            <div className="font-semibold mb-2">Add Song</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
              {songs.map(s => (
                <div key={s.id} className="flex items-center gap-3 bg-slate-800/50 rounded p-2">
                  <img src={s.cover} alt="cover" className="w-12 h-12 rounded object-cover" />
                  <div className="flex-1">
                    <div className="font-medium">{s.title}</div>
                    <div className="text-xs text-slate-400">{s.artist}</div>
                  </div>
                  <button className="btn btn-primary" onClick={() => add(s.id)}>Add</button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <Chat roomId={id} />
      </div>
    </div>
  );
}
