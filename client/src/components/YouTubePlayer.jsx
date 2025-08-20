import React, { useEffect, useRef, useState } from 'react';

// Load YT IFrame API once
let ytApiLoading = null;
function ensureYouTubeAPI() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (ytApiLoading) return ytApiLoading;
  ytApiLoading = new Promise((resolve) => {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(tag);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) try { prev(); } catch {}
      resolve();
    };
  });
  return ytApiLoading;
}

export default function YouTubePlayer({ videoId, cover, title, artist, autoPlay = true, onEnd, repeatMode = 'off', onToggleRepeat }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef(null);

  // Cleanup interval
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Ensure the player is fully stopped and destroyed on unmount
      if (playerRef.current) {
        try { playerRef.current.stopVideo?.(); } catch {}
        try { playerRef.current.destroy?.(); } catch {}
        playerRef.current = null;
      }
    };
  }, []);

  // Initialize or switch video
  useEffect(() => {
    let cancelled = false;
    async function init() {
      await ensureYouTubeAPI();
      if (cancelled) return;
      const YT = window.YT;
      if (!playerRef.current) {
        playerRef.current = new YT.Player(containerRef.current, {
          videoId,
          playerVars: {
            autoplay: autoPlay ? 1 : 0,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
          },
          events: {
            onReady: () => {
              if (autoPlay) try { playerRef.current.playVideo(); setPlaying(true); } catch {}
              if (intervalRef.current) clearInterval(intervalRef.current);
              intervalRef.current = setInterval(() => {
                try {
                  const p = playerRef.current;
                  const d = p.getDuration() || 0;
                  const c = p.getCurrentTime() || 0;
                  setProgress(d ? (c / d) * 100 : 0);
                } catch {}
              }, 500);
            },
            onStateChange: (e) => {
              // 0 = ENDED, 1 = PLAYING, 2 = PAUSED
              if (e.data === 0) { setPlaying(false); onEnd && onEnd(); }
              if (e.data === 1) setPlaying(true);
              if (e.data === 2) setPlaying(false);
            },
          }
        });
      } else {
        // Load new video in existing player
        try {
          // Stop previous playback to avoid it continuing briefly
          try { playerRef.current.stopVideo?.(); } catch {}
          playerRef.current.loadVideoById(videoId);
          if (!autoPlay) playerRef.current.pauseVideo(); else playerRef.current.playVideo();
          setPlaying(!!autoPlay);
        } catch {}
      }
    }
    init();
    return () => { cancelled = true; };
  }, [videoId, autoPlay]);

  const toggle = () => {
    const p = playerRef.current; if (!p) return;
    if (playing) { try { p.pauseVideo(); } catch {} } else { try { p.playVideo(); } catch {} }
    setPlaying(!playing);
  };

  const seek = (delta) => {
    const p = playerRef.current; if (!p) return;
    try {
      const t = Math.max(0, (p.getCurrentTime() || 0) + delta);
      p.seekTo(t, true);
    } catch {}
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
        {onToggleRepeat && (
          <button
            className={`btn ${repeatMode === 'off' ? 'btn-secondary' : 'btn-primary'}`}
            title={repeatMode === 'one' ? 'Repeat one' : repeatMode === 'all' ? 'Repeat all' : 'Repeat'}
            onClick={() => onToggleRepeat && onToggleRepeat()}
          >
            {repeatMode === 'one' ? '🔂' : '🔁'}
          </button>
        )}
        <button className="btn btn-secondary" onClick={() => seek(-10)}>-10s</button>
        <button className="btn btn-primary" onClick={toggle}>{playing ? 'Pause' : 'Play'}</button>
        <button className="btn btn-secondary" onClick={() => seek(10)}>+10s</button>
      </div>
      {/* Hidden iframe host */}
      <div style={{ width: 0, height: 0, overflow: 'hidden' }}>
        <div id={`yt-${videoId}`} ref={containerRef} />
      </div>
    </div>
  );
}
