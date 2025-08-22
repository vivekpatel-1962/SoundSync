import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api.js';
import { useUser } from '@clerk/clerk-react';
import { container, fadeUp } from '../lib/motionPresets.js';

export default function Settings() {
  const { user } = useUser();
  const [partnerId, setPartnerId] = useState('');
  const [pairRes, setPairRes] = useState(null);

  const pair = async () => {
    const res = await api.post('/pair', { userIdA: user.id, userIdB: partnerId || undefined });
    setPairRes(res);
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} className="card">
        <div className="font-semibold mb-2">Pair / Couple Mode</div>
        <div className="flex flex-col md:flex-row gap-3">
          <input className="input" placeholder="Partner userId (demo: u2, u3)" value={partnerId} onChange={e => setPartnerId(e.target.value)} />
          <button className="btn btn-primary" onClick={pair}>Pair</button>
        </div>
        {pairRes && (
          <motion.div variants={fadeUp} className="mt-3 text-sm">
            Paired: {pairRes.pair.filter(Boolean).join(' + ')} · Theme primary {pairRes.theme.primary}
          </motion.div>
        )}
      </motion.div>

      <motion.div variants={fadeUp} className="card">
        <div className="font-semibold mb-2">Appearance</div>
        <div className="text-sm text-[var(--text-1)]">Use room themes to personalize experience. (Applied in Rooms)</div>
      </motion.div>
    </motion.div>
  );
}
