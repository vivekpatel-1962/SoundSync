import React, { useEffect, useMemo, useState } from 'react';

export default function Lyrics({ lyrics }) {
  const [mode, setMode] = useState('karaoke'); // 'karaoke' | 'static'
  const [time, setTime] = useState(0);

  // Simulate time when in karaoke mode if no external player time provided
  useEffect(() => {
    if (mode !== 'karaoke') return;
    const id = setInterval(() => setTime(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [mode]);

  const activeIdx = useMemo(() => {
    if (mode !== 'karaoke' || !lyrics?.timed) return -1;
    const idx = lyrics.timed.findIndex((line, i) => {
      const next = lyrics.timed[i + 1];
      return time >= line.time && (!next || time < next.time);
    });
    return idx;
  }, [lyrics, time, mode]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">Lyrics</div>
        <div className="text-sm flex gap-2">
          <button className={`btn ${mode==='karaoke'?'btn-primary':'btn-secondary'}`} onClick={() => setMode('karaoke')}>Karaoke</button>
          <button className={`btn ${mode==='static'?'btn-primary':'btn-secondary'}`} onClick={() => setMode('static')}>Static</button>
        </div>
      </div>
      {mode === 'static' ? (
        <pre className="whitespace-pre-wrap text-[var(--text-0)] leading-relaxed">{lyrics?.static || 'No lyrics'}</pre>
      ) : (
        <div className="space-y-1">
          {lyrics?.timed?.map((l, i) => (
            <div key={i} className={`transition-colors ${i===activeIdx? 'text-[var(--text-0)]' : 'text-[var(--text-1)]'}`}>{l.line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
