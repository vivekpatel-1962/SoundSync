import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api.js';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { Button } from '../components/ui/button.jsx';
import { container, fadeUp } from '../lib/motionPresets.js';

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
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Create Room */}
      <motion.div variants={fadeUp} className="card">
        <div className="font-semibold mb-2">Create Room</div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] items-center">
          <input className="input w-full" placeholder="Room name" value={name} onChange={e => setName(e.target.value)} />
          <label className="flex items-center gap-2 text-sm whitespace-nowrap">
            <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} /> Public
          </label>
          <Button onClick={create} className="md:justify-self-end">Create</Button>
        </div>
      </motion.div>

      {/* Join by code */}
      <motion.div variants={fadeUp} className="card">
        <div className="font-semibold mb-2">Join a Private Room</div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto] items-center">
          <input className="input w-full" placeholder="Enter code (e.g., 8 chars)" value={joinCode} onChange={e => setJoinCode(e.target.value)} onKeyDown={e => e.key==='Enter' && joinByCode()} />
          <Button onClick={joinByCode} className="md:justify-self-end">Join</Button>
        </div>
      </motion.div>

      {/* Your Rooms */}
      <motion.div variants={fadeUp} className="space-y-2">
        <div className="text-sm uppercase tracking-wide text-[var(--text-1)]">Your Rooms</div>
        {/* Mobile: square tiles (smaller) */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3 md:hidden">
          {yourRooms.map(r => (
            <motion.div variants={fadeUp} key={r.id}>
              <Link to={`/rooms/${r.id}`} className="block aspect-square rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--bg-2)] shadow">
                <div className="aspect-inner p-2 flex flex-col">
                  <div className="text-xs font-semibold leading-tight line-clamp-2" title={r.name}>{r.name}</div>
                  <div className="mt-auto text-[10px] text-[var(--text-1)] flex items-center justify-between">
                    <span>{r.size} mem</span>
                    <span className="text-emerald-400">{r.isPublic ? 'Public' : 'Private'}</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
          {!yourRooms.length && <div className="text-sm text-[var(--text-1)] col-span-2 sm:col-span-3">You haven't joined any rooms yet.</div>}
        </div>
        {/* Desktop: original list cards */}
        <div className="hidden md:grid md:grid-cols-3 gap-4">
          {yourRooms.map(r => (
            <motion.div variants={fadeUp} key={r.id} className="h-full">
              <Link to={`/rooms/${r.id}`} className="card block h-full hover:border-primary/50">
                <div className="font-semibold">{r.name}</div>
                <div className="text-sm text-[var(--text-1)]">{r.size} members</div>
                <div className="mt-2 text-xs">
                  <span className="text-emerald-400">{r.isPublic ? 'Public' : 'Private'}</span>
                </div>
              </Link>
            </motion.div>
          ))}
          {!yourRooms.length && <div className="text-sm text-[var(--text-1)] md:col-span-3">You haven't joined any rooms yet.</div>}
        </div>
      </motion.div>

      {/* Recommended Rooms (Public) */}
      <motion.div variants={fadeUp} className="space-y-2">
        <div className="text-sm uppercase tracking-wide text-[var(--text-1)]">Recommended (Public)</div>
        {/* Mobile: square tiles that join on tap (smaller) */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3 md:hidden">
          {recommendedRooms.map(r => (
            <motion.button
              type="button"
              variants={fadeUp}
              key={r.id}
              onClick={() => joinPublic(r.id)}
              className="aspect-square rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--bg-2)] shadow text-left"
            >
              <div className="aspect-inner p-2 flex flex-col">
                <div className="text-xs font-semibold leading-tight line-clamp-2" title={r.name}>{r.name}</div>
                <div className="mt-auto text-[10px] text-[var(--text-1)] flex items-center justify-between">
                  <span>{r.size} mem</span>
                  <span className="text-emerald-400">Public</span>
                </div>
              </div>
            </motion.button>
          ))}
          {!recommendedRooms.length && <div className="text-sm text-[var(--text-1)] col-span-2 sm:col-span-3">No public rooms available right now.</div>}
        </div>
        {/* Desktop: original cards */}
        <div className="hidden md:grid md:grid-cols-3 gap-4">
          {recommendedRooms.map(r => (
            <motion.div variants={fadeUp} key={r.id} className="card hover:border-primary/50">
              <div className="font-semibold">{r.name}</div>
              <div className="text-sm text-[var(--text-1)]">{r.size} members</div>
              <div className="mt-2 text-xs text-emerald-400">Public</div>
              <div className="mt-3">
                <Button className="w-full" onClick={() => joinPublic(r.id)}>Join</Button>
              </div>
            </motion.div>
          ))}
          {!recommendedRooms.length && <div className="text-sm text-[var(--text-1)]">No public rooms available right now.</div>}
        </div>
      </motion.div>
    </motion.div>
  );
}
