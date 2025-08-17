import React, { useEffect, useRef, useState } from 'react';

export default function PlayerControls({ src, cover, title, artist, onEnd }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const t = () => setProgress((a.currentTime / a.duration) * 100 || 0);
    a.addEventListener('timeupdate', t);
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('timeupdate', t);
      a.removeEventListener('ended', onEnd);
    };
  }, [onEnd]);

  useEffect(() => { setPlaying(false); if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; } }, [src]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause(); else a.play();
    setPlaying(!playing);
  };

  return (
    <div className="card flex gap-4 items-center">
      <img src={cover} alt="cover" className="w-20 h-20 rounded-md object-cover" />
      <div className="flex-1">
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-slate-400">{artist}</div>
        <div className="h-2 bg-slate-700 rounded mt-2">
          <div className="h-2 bg-primary rounded" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="btn btn-secondary" onClick={() => { audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10); }}>-10s</button>
        <button className="btn btn-primary" onClick={toggle}>{playing ? 'Pause' : 'Play'}</button>
        <button className="btn btn-secondary" onClick={() => { audioRef.current.currentTime = Math.min(audioRef.current.duration, audioRef.current.currentTime + 10); }}>+10s</button>
      </div>
      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  );
}
