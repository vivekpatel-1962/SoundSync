import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api.js';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const navigate = useNavigate();
  const { user } = useUser();

  const load = async () => {
    const res = await api.get('/rooms');
    setRooms(res.rooms);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    const res = await api.post('/rooms', { name: name || undefined, isPublic });
    setName('');
    setRooms([...rooms, { ...res.room, size: 0, isPublic: res.room.isPublic, isMember: true }]);
    // Store private room join code so RoomDetail header can show it
    if (!isPublic && res.room?.id && res.room?.joinCode) {
      try {
        const map = JSON.parse(localStorage.getItem('roomJoinCodes') || '{}');
        map[res.room.id] = res.room.joinCode;
        localStorage.setItem('roomJoinCodes', JSON.stringify(map));
      } catch {}
    }
    if (res.room?.id) navigate(`/rooms/${res.room.id}`);
  };

  // no-op

  const joinByCode = async () => {
    if (!joinCode.trim()) return;
    const r = await api.post('/rooms/join-by-code', { code: joinCode.trim(), userId: user?.id });
    setJoinCode('');
    await load();
    if (r?.room?.id) navigate(`/rooms/${r.room.id}`);
  };

  const joinPublic = async (roomId) => {
    await api.post(`/rooms/${roomId}/join`, { userId: user?.id });
    await load();
    navigate(`/rooms/${roomId}`);
  };

  const yourRooms = useMemo(() => rooms.filter(r => r.isMember), [rooms]);
  const recommendedRooms = useMemo(() => rooms.filter(r => r.isPublic && !r.isMember), [rooms]);

  return (
    <div className="space-y-6">
      {/* Create Room */}
      <div className="card">
        <div className="font-semibold mb-2">Create Room</div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row gap-3">
            <input className="input" placeholder="Room name" value={name} onChange={e => setName(e.target.value)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} /> Public
            </label>
            <button className="btn btn-primary" onClick={create}>Create</button>
          </div>
        </div>
      </div>

      {/* Join by code */}
      <div className="card">
        <div className="font-semibold mb-2">Join a Private Room</div>
        <div className="flex flex-col md:flex-row gap-3">
          <input className="input" placeholder="Enter code (e.g., 8 chars)" value={joinCode} onChange={e => setJoinCode(e.target.value)} onKeyDown={e => e.key==='Enter' && joinByCode()} />
          <button className="btn btn-primary" onClick={joinByCode}>Join</button>
        </div>
      </div>

      {/* Your Rooms */}
      <div className="space-y-2">
        <div className="text-sm uppercase tracking-wide text-slate-400">Your Rooms</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {yourRooms.map(r => (
            <Link key={r.id} to={`/rooms/${r.id}`} className="card hover:border-primary/50">
              <div className="font-semibold">{r.name}</div>
              <div className="text-sm text-slate-400">{r.size} members</div>
              <div className="mt-2 text-xs">
                <span className="text-emerald-400">Member</span>
              </div>
            </Link>
          ))}
          {!yourRooms.length && <div className="text-sm text-slate-400">You haven't joined any rooms yet.</div>}
        </div>
      </div>

      {/* Recommended Rooms (Public) */}
      <div className="space-y-2">
        <div className="text-sm uppercase tracking-wide text-slate-400">Recommended (Public)</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recommendedRooms.map(r => (
            <div key={r.id} className="card hover:border-primary/50">
              <div className="font-semibold">{r.name}</div>
              <div className="text-sm text-slate-400">{r.size} members</div>
              <div className="mt-2 text-xs text-emerald-400">Public</div>
              <div className="mt-3">
                <button className="btn btn-primary w-full" onClick={() => joinPublic(r.id)}>Join</button>
              </div>
            </div>
          ))}
          {!recommendedRooms.length && <div className="text-sm text-slate-400">No public rooms available right now.</div>}
        </div>
      </div>
    </div>
  );
}
