import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../services/api.js';
import PlayerControls from '../components/PlayerControls.jsx';
import Lyrics from '../components/Lyrics.jsx';

// Lazy-load YouTube IFrame API once
let ytApiReadyPromise;
const loadYouTubeAPI = () => {
  if (typeof window !== 'undefined' && window.YT && window.YT.Player) return Promise.resolve();
  if (!ytApiReadyPromise) {
    ytApiReadyPromise = new Promise((resolve) => {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
      window.onYouTubeIframeAPIReady = () => resolve();
    });
  }
  return ytApiReadyPromise;
};

export default function Player() {
  const params = new URLSearchParams(useLocation().search);
  const songIdParam = params.get('song');
  const ytId = params.get('yt');
  const [songs, setSongs] = useState([]);
  const [idx, setIdx] = useState(0);
  const [lyrics, setLyrics] = useState(null);

  // --- YouTube mode state ---
  const [ytMeta, setYtMeta] = useState(null);
  const [ytPlaying, setYtPlaying] = useState(false);
  const [ytProgress, setYtProgress] = useState(0);
  const [ytReady, setYtReady] = useState(false);
  const [ytError, setYtError] = useState(null);
  const ytContainerRef = useRef(null);
  const ytPlayerRef = useRef(null);

  // --- Regular sample songs fetch ---
  useEffect(() => { api.get('/songs').then(s => setSongs(s.songs)); }, []);

  const current = useMemo(() => {
    if (!songs.length) return null;
    const i = songIdParam ? songs.findIndex(s => s.id === songIdParam) : idx;
    const safeIdx = i >= 0 ? i : 0;
    return songs[safeIdx];
  }, [songs, idx, songIdParam]);

  useEffect(() => { if (current && !ytId) api.get(`/songs/${current.id}/lyrics`).then(r => setLyrics(r.lyrics)); }, [current, ytId]);

  // --- YouTube mode: fetch metadata ---
  useEffect(() => {
    if (!ytId) return;
    setYtMeta(null);
    setYtReady(false);
    setYtError(null);
    api.get(`/yt/videos?ids=${encodeURIComponent(ytId)}`).then(r => {
      setYtMeta((r.items && r.items[0]) || null);
    }).catch(() => setYtMeta(null));
  }, [ytId]);

  // --- YouTube mode: init hidden player and track progress ---
  useEffect(() => {
    if (!ytId) return;
    let interval;
    loadYouTubeAPI().then(() => {
      if (ytPlayerRef.current) { try { ytPlayerRef.current.destroy(); } catch {} ytPlayerRef.current = null; }
      ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
        height: '1',
        width: '1',
        videoId: ytId,
        playerVars: { autoplay: 0, playsinline: 1 },
        events: {
          onReady: () => { setYtReady(true); },
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.PLAYING) setYtPlaying(true);
            if (e.data === window.YT.PlayerState.PAUSED) setYtPlaying(false);
            if (e.data === window.YT.PlayerState.ENDED) setYtPlaying(false);
          },
          onError: (e) => {
            // Map common YT errors to friendly messages
            const code = e?.data;
            const map = {
              2: 'Invalid parameter. Try another video.',
              5: 'HTML5 player error. Try reloading.',
              100: 'Video not found or removed.',
              101: 'Playback blocked by the uploader (embedding disabled).',
              150: 'Playback blocked by the uploader (embedding disabled).'
            };
            setYtError(map[code] || 'Failed to load this video.');
            setYtReady(false);
          }
        }
      });
      interval = setInterval(() => {
        const p = ytPlayerRef.current;
        if (p && p.getDuration) {
          const d = p.getDuration() || 0;
          const t = p.getCurrentTime() || 0;
          setYtProgress(d ? (t / d) * 100 : 0);
        }
      }, 500);
    });
    return () => { if (interval) clearInterval(interval); if (ytPlayerRef.current) { try { ytPlayerRef.current.destroy(); } catch {} ytPlayerRef.current = null; } };
  }, [ytId]);

  // --- YouTube mode: controls ---
  const ytToggle = () => {
    const p = ytPlayerRef.current; if (!p || !ytReady || ytError) return;
    const state = p.getPlayerState();
    if (state === window.YT.PlayerState.PLAYING) { p.pauseVideo(); setYtPlaying(false); }
    else { p.playVideo(); setYtPlaying(true); }
  };
  const ytBack = () => { const p = ytPlayerRef.current; if (!p || !ytReady || ytError) return; const t = (p.getCurrentTime?.() || 0) - 10; p.seekTo(Math.max(0, t), true); };
  const ytFwd = () => { const p = ytPlayerRef.current; if (!p || !ytReady || ytError) return; const d = p.getDuration?.() || 0; const t = (p.getCurrentTime?.() || 0) + 10; p.seekTo(Math.min(d, t), true); };

  // --- If YouTube mode, render YouTube audio UI and hide the video ---
  if (ytId) {
    if (!ytMeta) return <div>Loading...</div>;
    const thumb = ytMeta.thumbnails?.medium?.url || ytMeta.thumbnails?.default?.url;
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card flex gap-4 items-center">
            <img src={thumb} alt="cover" className="w-20 h-20 rounded-md object-cover" />
            <div className="flex-1">
              <div className="font-semibold">{ytMeta.title}</div>
              <div className="text-sm text-slate-400">{ytMeta.channel}</div>
              <div className="h-2 bg-slate-700 rounded mt-2">
                <div className="h-2 bg-primary rounded" style={{ width: `${ytProgress}%` }} />
              </div>
              {!ytReady && !ytError && (
                <div className="text-xs text-slate-400 mt-1">Loading player...</div>
              )}
              {ytError && (
                <div className="text-xs text-red-400 mt-1">{ytError}</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button className="btn btn-secondary" onClick={ytBack} disabled={!ytReady || !!ytError}>-10s</button>
              <button className="btn btn-primary" onClick={ytToggle} disabled={!ytReady || !!ytError}>{ytPlaying ? 'Pause' : 'Play'}</button>
              <button className="btn btn-secondary" onClick={ytFwd} disabled={!ytReady || !!ytError}>+10s</button>
            </div>
            <div
              ref={ytContainerRef}
              style={{ position: 'absolute', left: '-9999px', top: 0, width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}
            />
          </div>
          <Lyrics lyrics={null} />
        </div>
        <aside className="space-y-2">
          <div className="font-semibold">Up Next</div>
          <div className="text-sm text-slate-400">Select more from search to build a queue (coming soon)</div>
        </aside>
      </div>
    );
  }

  // --- Existing local audio player mode ---
  if (!current) return <div>Loading...</div>;

  const onEnd = () => setIdx(i => (i + 1) % songs.length);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <PlayerControls src={current.audioUrl} cover={current.cover} title={current.title} artist={current.artist} onEnd={onEnd} />
        <Lyrics lyrics={lyrics} />
      </div>
      <aside className="space-y-2">
        <div className="font-semibold">Up Next</div>
        <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1 scrollbar-thin">
          {songs.map((s, i) => (
            <div key={s.id} className={`flex items-center gap-3 p-2 rounded ${s.id===current.id? 'bg-primary/20' : 'bg-slate-800/50'}`}>
              <img src={s.cover} alt="cover" className="w-12 h-12 rounded object-cover" />
              <div className="flex-1">
                <div className="font-medium">{s.title}</div>
                <div className="text-xs text-slate-400">{s.artist}</div>
              </div>
              <button className="btn btn-secondary" onClick={() => setIdx(i)}>Play</button>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
