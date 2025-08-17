import React, { useState } from 'react';
import { api } from '../services/api.js';
import { useUser } from '@clerk/clerk-react';

export default function Settings() {
  const { user } = useUser();
  const [partnerId, setPartnerId] = useState('');
  const [pairRes, setPairRes] = useState(null);

  const pair = async () => {
    const res = await api.post('/pair', { userIdA: user.id, userIdB: partnerId || undefined });
    setPairRes(res);
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="font-semibold mb-2">Pair / Couple Mode</div>
        <div className="flex flex-col md:flex-row gap-3">
          <input className="input" placeholder="Partner userId (demo: u2, u3)" value={partnerId} onChange={e => setPartnerId(e.target.value)} />
          <button className="btn btn-primary" onClick={pair}>Pair</button>
        </div>
        {pairRes && (
          <div className="mt-3 text-sm">
            Paired: {pairRes.pair.filter(Boolean).join(' + ')} · Theme primary {pairRes.theme.primary}
          </div>
        )}
      </div>

      <div className="card">
        <div className="font-semibold mb-2">Appearance</div>
        <div className="text-sm text-slate-400">Use room themes to personalize experience. (Applied in Rooms)</div>
      </div>
    </div>
  );
}
