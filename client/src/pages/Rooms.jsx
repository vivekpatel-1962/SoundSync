import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { Link } from 'react-router-dom';

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [name, setName] = useState('');
  const [pairMode, setPairMode] = useState(false);

  const load = async () => {
    const res = await api.get('/rooms');
    setRooms(res.rooms);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    const res = await api.post('/rooms', { name: name || undefined, isPairMode: pairMode });
    setName(''); setPairMode(false);
    setRooms([...rooms, { ...res.room, size: 0 }]);
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="font-semibold mb-2">Create Room</div>
        <div className="flex flex-col md:flex-row gap-3">
          <input className="input" placeholder="Room name" value={name} onChange={e => setName(e.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={pairMode} onChange={e => setPairMode(e.target.checked)} /> Pair/Couple Mode
          </label>
          <button className="btn btn-primary" onClick={create}>Create</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {rooms.map(r => (
          <Link key={r.id} to={`/rooms/${r.id}`} className="card hover:border-primary/50">
            <div className="font-semibold">{r.name}</div>
            <div className="text-sm text-slate-400">{r.size} members</div>
            {r.isPairMode && <div className="mt-2 text-xs text-accent">Pair Mode</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}
