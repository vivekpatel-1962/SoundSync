import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import NavBar from './components/NavBar.jsx';
import { Button } from './components/ui/button.jsx';
import { useUser } from '@clerk/clerk-react';
import { api } from './services/api.js';

// Lazy-load YouTube IFrame Player API
let ytApiPromise;
const getYouTubeAPI = () => {
  if (typeof window !== 'undefined' && window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve) => {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      document.head.appendChild(tag);
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev && prev();
        resolve(window.YT);
      };
    });
  }
  return ytApiPromise;
};

// --- Player Context & Mini Player ---
const PlayerContext = createContext(null);
export const usePlayer = () => useContext(PlayerContext);

function PlayerProvider({ children }) {
  const { isSignedIn, user } = useUser();
  const uid = user?.id;
  const [queue, setQueue] = useState([]); // [{ type:'youtube', id, title, channel }]
  const [index, setIndex] = useState(-1);
  // Derive current synchronously to avoid one-tick lag that could load the previous video
  const current = useMemo(() => (index >= 0 && index < queue.length ? queue[index] : null), [queue, index]);
  const [visible, setVisible] = useState(false);
  // Local likes/playlists (namespaced per user when signed in)
  const [ytLikes, setYtLikes] = useState(() => new Set());
  const [ytPlaylists, setYtPlaylists] = useState(() => ({}));

  const storageKeys = useCallback((id) => ({
    likes: id ? `ytLikes:${id}` : 'ytLikes',
    playlists: id ? `ytPlaylists:${id}` : 'ytPlaylists'
  }), []);

  // Hydrate likes/playlists whenever auth state changes
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // reset view immediately to avoid showing previous user's data
      setYtLikes(new Set());
      setYtPlaylists({});
      // 1) Cache-first hydrate (instant UI), then server refresh in background
      try {
        if (isSignedIn && uid) {
          const keys = storageKeys(uid);
          try {
            const likesArr = JSON.parse(localStorage.getItem(keys.likes) || '[]');
            setYtLikes(new Set(Array.isArray(likesArr) ? likesArr : []));
          } catch {}
          try {
            const plObj = JSON.parse(localStorage.getItem(keys.playlists) || '{}');
            setYtPlaylists(plObj && typeof plObj === 'object' ? plObj : {});
          } catch {}
        } else {
          try {
            const likesArr = JSON.parse(localStorage.getItem('ytLikes') || '[]');
            setYtLikes(new Set(Array.isArray(likesArr) ? likesArr : []));
          } catch {}
          try {
            const plObj = JSON.parse(localStorage.getItem('ytPlaylists') || '{}');
            setYtPlaylists(plObj && typeof plObj === 'object' ? plObj : {});
          } catch {}
        }
      } catch {}

      // 2) If signed in, refresh from server in background and update cache
      if (isSignedIn && uid) {
        try {
          const data = await api.get('/user/yt');
          if (cancelled) return;
          const likesArr = Array.isArray(data.likes) ? data.likes : [];
          const plObj = data.playlists && typeof data.playlists === 'object' ? data.playlists : {};
          setYtLikes(new Set(likesArr));
          setYtPlaylists(plObj);
          const keys = storageKeys(uid);
          try { localStorage.setItem(keys.likes, JSON.stringify(likesArr)); } catch {}
          try { localStorage.setItem(keys.playlists, JSON.stringify(plObj)); } catch {}
        } catch {
          // keep cached state on failure
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [isSignedIn, uid, storageKeys]);

  // current is derived via useMemo above


  const next = useCallback(() => {
    setIndex(i => {
      const n = queue.length;
      if (!n) return i;
      return (i + 1) % n;
    });
  }, [queue.length]);
  const prev = useCallback(() => {
    setIndex(i => {
      const n = queue.length;
      if (!n) return i;
      return (i - 1 + n) % n;
    });
  }, [queue.length]);
  const close = useCallback(() => setVisible(false), []);

  const isLiked = useCallback((id) => ytLikes.has(id), [ytLikes]);
  const toggleLike = useCallback(async (id, track) => {
    if (!id) return;
    if (isSignedIn && uid) {
      try {
        const data = await api.post('/user/yt/likes/toggle', { id, track });
        const likesArr = Array.isArray(data.likes) ? data.likes : [];
        const plObj = data.playlists && typeof data.playlists === 'object' ? data.playlists : {};
        setYtLikes(new Set(likesArr));
        setYtPlaylists(plObj);
        try {
          const keys = storageKeys(uid);
          localStorage.setItem(keys.likes, JSON.stringify(likesArr));
        } catch {}
        try {
          const keys = storageKeys(uid);
          localStorage.setItem(keys.playlists, JSON.stringify(plObj));
        } catch {}
        return;
      } catch {}
    }
    // Fallback: local only
    setYtLikes(prev => {
      const next = new Set(prev);
      const willLike = !next.has(id);
      if (willLike) next.add(id); else next.delete(id);
      try {
        const keys = storageKeys(isSignedIn ? uid : undefined);
        localStorage.setItem(keys.likes, JSON.stringify(Array.from(next)));
      } catch {}
      try {
        const name = 'liked';
        const keys = storageKeys(isSignedIn ? uid : undefined);
        const store = JSON.parse(localStorage.getItem(keys.playlists) || '{}');
        const list = Array.isArray(store[name]) ? store[name] : [];
        if (willLike) {
          if (track && !list.some(t => t.id === id)) list.push({ id, title: track.title, channel: track.channel });
        } else {
          const idx = list.findIndex(t => t.id === id);
          if (idx >= 0) list.splice(idx, 1);
        }
        store[name] = list;
        const keys2 = storageKeys(isSignedIn ? uid : undefined);
        localStorage.setItem(keys2.playlists, JSON.stringify(store));
        setYtPlaylists(store);
      } catch {}
      return next;
    });
  }, [isSignedIn, uid, storageKeys]);

  const addToPlaylist = useCallback(async (name, track) => {
    if (!name || !track?.id) return;
    if (isSignedIn && uid) {
      try {
        const data = await api.post(`/user/yt/playlists/${encodeURIComponent(name)}/tracks`, { track: { id: track.id, title: track.title, channel: track.channel } });
        const plObj = data.playlists && typeof data.playlists === 'object' ? data.playlists : {};
        setYtPlaylists(plObj);
        try {
          const keys = storageKeys(uid);
          localStorage.setItem(keys.playlists, JSON.stringify(plObj));
        } catch {}
        return;
      } catch {}
    }
    // Fallback: local only
    const keys = storageKeys(isSignedIn ? uid : undefined);
    try {
      const store = JSON.parse(localStorage.getItem(keys.playlists) || '{}');
      const list = Array.isArray(store[name]) ? store[name] : [];
      if (!list.some(t => t.id === track.id)) list.push({ id: track.id, title: track.title, channel: track.channel });
      store[name] = list;
      localStorage.setItem(keys.playlists, JSON.stringify(store));
      setYtPlaylists(store);
    } catch {}
  }, [isSignedIn, uid, storageKeys]);

  const removeFromPlaylist = useCallback(async (name, id) => {
    if (!name || !id) return;
    if (isSignedIn && uid) {
      try {
        const data = await api.delete(`/user/yt/playlists/${encodeURIComponent(name)}/tracks/${encodeURIComponent(id)}`);
        const plObj = data.playlists && typeof data.playlists === 'object' ? data.playlists : {};
        setYtPlaylists(plObj);
        try {
          const keys = storageKeys(uid);
          localStorage.setItem(keys.playlists, JSON.stringify(plObj));
        } catch {}
        return;
      } catch {}
    }
    // Fallback local
    try {
      const keys = storageKeys(isSignedIn ? uid : undefined);
      const store = JSON.parse(localStorage.getItem(keys.playlists) || '{}');
      const list = Array.isArray(store[name]) ? store[name] : [];
      const nextList = list.filter(t => t.id !== id);
      store[name] = nextList;
      localStorage.setItem(keys.playlists, JSON.stringify(store));
      setYtPlaylists(store);
    } catch {}
  }, [isSignedIn, uid, storageKeys]);

  const deleteLocalPlaylist = useCallback(async (name) => {
    if (!name || name === 'liked') return; // protect liked
    if (isSignedIn && uid) {
      try {
        await api.delete(`/user/yt/playlists/${encodeURIComponent(name)}`);
        // refetch to be safe
        const data = await api.get('/user/yt');
        const plObj = data.playlists && typeof data.playlists === 'object' ? data.playlists : {};
        setYtPlaylists(plObj);
        try {
          const keys = storageKeys(uid);
          localStorage.setItem(keys.playlists, JSON.stringify(plObj));
        } catch {}
        return;
      } catch {}
    }
    try {
      const keys = storageKeys(isSignedIn ? uid : undefined);
      const store = JSON.parse(localStorage.getItem(keys.playlists) || '{}');
      if (store[name]) {
        delete store[name];
        localStorage.setItem(keys.playlists, JSON.stringify(store));
        setYtPlaylists(store);
      }
    } catch {}
  }, [isSignedIn, uid, storageKeys]);

  const createLocalPlaylist = useCallback(async (name) => {
    const n = (name || '').trim();
    if (!n || n.toLowerCase() === 'liked') return; // do not override liked
    if (isSignedIn && uid) {
      try {
        await api.post('/user/yt/playlists', { name: n });
        const data = await api.get('/user/yt');
        const plObj = data.playlists && typeof data.playlists === 'object' ? data.playlists : {};
        setYtPlaylists(plObj);
        try {
          const keys = storageKeys(uid);
          localStorage.setItem(keys.playlists, JSON.stringify(plObj));
        } catch {}
        return;
      } catch {}
    }
    try {
      const keys = storageKeys(isSignedIn ? uid : undefined);
      const store = JSON.parse(localStorage.getItem(keys.playlists) || '{}');
      if (!store[n]) {
        store[n] = [];
        localStorage.setItem(keys.playlists, JSON.stringify(store));
        setYtPlaylists(store);
      }
    } catch {}
  }, [isSignedIn, uid, storageKeys]);

  return (
    <PlayerContext.Provider value={{ queue, index, current, visible, next, prev, close, setVisible, setQueue, setIndex, isLiked, toggleLike, ytPlaylists, addToPlaylist, removeFromPlaylist, deleteLocalPlaylist, createLocalPlaylist }}>
      {children}
    </PlayerContext.Provider>
  );
}

function MiniPlayer() {
  const { current, visible, next, prev, queue, index, close, isLiked, toggleLike, ytPlaylists, addToPlaylist } = usePlayer();
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const playerRef = useRef(null);
  const ytRef = useRef(null);
  const ignoreEndUntilRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  // Repeat mode: 'off' | 'one'
  const [repeatMode, setRepeatMode] = useState('off');
  const cycleRepeat = () => setRepeatMode(m => (m === 'off' ? 'one' : 'off'));
  const repeatTitle = repeatMode === 'one' ? 'Repeat this song' : 'Repeat off';
  const repeatSymbol = repeatMode === 'one' ? '🔂' : '🔁';
  // Refs to avoid stale values inside YT event handlers
  const repeatModeRef = useRef(repeatMode);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
  const indexRef = useRef(index);
  useEffect(() => { indexRef.current = index; }, [index]);
  const queueRef = useRef(queue);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  // Keep a ref of current id for YT event handlers to avoid stale closures
  const currentIdRef = useRef(current?.id);
  useEffect(() => { currentIdRef.current = current?.id; }, [current?.id]);
  const [showPl, setShowPl] = useState(false);
  const plMenuRef = useRef(null);
  const [newPl, setNewPl] = useState('');
  // Title overflow detection for conditional marquee
  const titleBoxRef = useRef(null);
  const [titleOverflow, setTitleOverflow] = useState(false);
  // Dragging state
  const [pos, setPos] = useState(() => {
    try { return JSON.parse(localStorage.getItem('miniPos') || 'null'); } catch { return null; }
  });
  const draggingRef = useRef({ active: false, dx: 0, dy: 0 });

  // Mobile detection to switch to bottom-docked layout and larger touch targets
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsMobile(!!mq.matches);
    apply();
    try { mq.addEventListener('change', apply); } catch { mq.addListener(apply); }
    return () => { try { mq.removeEventListener('change', apply); } catch { mq.removeListener(apply); } };
  }, []);

  // Fullscreen mobile player state
  const [expanded, setExpanded] = useState(false);
  // Auto-open fullscreen when becoming visible on mobile
  useEffect(() => {
    if (isMobile && visible && current) setExpanded(true);
  }, [isMobile, visible, current?.id]);

  useEffect(() => {
    if (!showPl) return;
    const onDoc = (e) => {
      if (!plMenuRef.current) return;
      if (!plMenuRef.current.contains(e.target)) setShowPl(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setShowPl(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [showPl]);

  // Recompute if title overflows when visible/title changes
  useEffect(() => {
    if (!visible) return;
    const el = titleBoxRef.current;
    if (!el) return;
    const check = () => setTitleOverflow(el.scrollWidth > el.clientWidth + 1);
    const raf = requestAnimationFrame(check);
    window.addEventListener('resize', check);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', check);
    };
  }, [visible, current?.title]);

  // Initialize or update YT player when track changes
  useEffect(() => {
    let interval;
    if (!visible || !current || current.type !== 'youtube') return;
    let cancelled = false;
    (async () => {
      const YT = await getYouTubeAPI();
      if (cancelled) return;
      ytRef.current = YT;
      const loadVideo = (id) => {
        // Ignore stray ENDED events fired immediately after a manual load
        ignoreEndUntilRef.current = Date.now() + 1200;
        if (playerRef.current) {
          // Stop previous playback to avoid it resuming unexpectedly
          try { playerRef.current.stopVideo?.(); } catch {}
          try { playerRef.current.loadVideoById({ videoId: id, startSeconds: 0 }); } catch {}
        } else if (containerRef.current) {
          playerRef.current = new YT.Player(containerRef.current, {
            videoId: id,
            playerVars: { autoplay: 1, rel: 0 },
            events: {
              onReady: (e) => {
                e.target.playVideo();
                setIsPlaying(true);
              },
              onStateChange: (e) => {
                const s = e.data;
                // Ignore events coming from an outdated video id (race during fast switches)
                const vid = e?.target?.getVideoData?.().video_id;
                const curId = currentIdRef.current;
                if (vid && curId && vid !== curId) return;
                if (s === YT.PlayerState.PLAYING) setIsPlaying(true);
                else if (s === YT.PlayerState.PAUSED) setIsPlaying(false);
                else if (s === YT.PlayerState.ENDED) {
                  if (Date.now() < ignoreEndUntilRef.current) return;
                  const rm = repeatModeRef.current;
                  if (rm === 'one') {
                    // small guard window to ignore any stray ENDED events from the seek
                    ignoreEndUntilRef.current = Date.now() + 800;
                    try { e.target.seekTo(0, true); e.target.playVideo(); } catch {}
                    setIsPlaying(true);
                  } else {
                    // Keep original playlist behavior: always advance to next
                    next();
                  }
                }
              }
            }
          });
        }
      };
      loadVideo(current.id);

      interval = setInterval(() => {
        try {
          const d = playerRef.current?.getDuration?.() || 0;
          const t = playerRef.current?.getCurrentTime?.() || 0;
          setDuration(d || 0);
          setCurrentTime(t || 0);
        } catch {}
      }, 250);
    })();
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [visible, current, next]);

  // After first render, if no stored position, place bottom-right using measured size
  useEffect(() => {
    if (!visible) return;
    if (isMobile) return; // bottom-docked on mobile, skip floating position init
    if (pos) return;
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 16;
    const x = Math.max(margin, window.innerWidth - rect.width - margin);
    const y = Math.max(margin, window.innerHeight - rect.height - margin);
    const initial = { x, y };
    setPos(initial);
    try { localStorage.setItem('miniPos', JSON.stringify(initial)); } catch {}
  }, [visible, pos]);

  // Clamp position to viewport whenever visible or pos changes
  useEffect(() => {
    if (!visible) return;
    if (isMobile) return; // no floating on mobile
    if (!pos) return;
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const maxX = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxY = Math.max(margin, window.innerHeight - rect.height - margin);
    const px = Number.isFinite(pos.x) ? pos.x : maxX;
    const py = Number.isFinite(pos.y) ? pos.y : maxY;
    const clamped = {
      x: Math.min(Math.max(margin, px), maxX),
      y: Math.min(Math.max(margin, py), maxY),
    };
    if (clamped.x !== pos.x || clamped.y !== pos.y) {
      setPos(clamped);
      try { localStorage.setItem('miniPos', JSON.stringify(clamped)); } catch {}
    }
  }, [visible, pos]);

  // Keep position within viewport on resize
  useEffect(() => {
    const onResize = () => {
      const el = wrapperRef.current;
      if (isMobile) return; // mobile stays docked
      if (!el || !pos) return;
      const rect = el.getBoundingClientRect();
      const margin = 8;
      const maxX = Math.max(margin, window.innerWidth - rect.width - margin);
      const maxY = Math.max(margin, window.innerHeight - rect.height - margin);
      const nextPos = {
        x: Math.min(Math.max(margin, pos.x), maxX),
        y: Math.min(Math.max(margin, pos.y), maxY)
      };
      if (nextPos.x !== pos.x || nextPos.y !== pos.y) {
        setPos(nextPos);
        try { localStorage.setItem('miniPos', JSON.stringify(nextPos)); } catch {}
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [pos]);

  // Drag handlers
  useEffect(() => {
    const onMove = (clientX, clientY) => {
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const margin = 8;
      const x = clientX - draggingRef.current.dx;
      const y = clientY - draggingRef.current.dy;
      const maxX = Math.max(margin, window.innerWidth - rect.width - margin);
      const maxY = Math.max(margin, window.innerHeight - rect.height - margin);
      const clamped = {
        x: Math.min(Math.max(margin, x), maxX),
        y: Math.min(Math.max(margin, y), maxY),
      };
      setPos(clamped);
    };
    const onMouseMove = (e) => {
      if (!draggingRef.current.active) return;
      e.preventDefault();
      onMove(e.clientX, e.clientY);
    };
    const onMouseUp = () => {
      if (!draggingRef.current.active) return;
      draggingRef.current.active = false;
      try { localStorage.setItem('miniPos', JSON.stringify(pos)); } catch {}
    };
    const onTouchMove = (e) => {
      if (!draggingRef.current.active) return;
      const t = e.touches[0];
      if (!t) return;
      onMove(t.clientX, t.clientY);
    };
    const onTouchEnd = () => {
      if (!draggingRef.current.active) return;
      draggingRef.current.active = false;
      try { localStorage.setItem('miniPos', JSON.stringify(pos)); } catch {}
    };
    if (!isMobile) {
      document.addEventListener('mousemove', onMouseMove, { passive: false });
      document.addEventListener('mouseup', onMouseUp);
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onTouchEnd);
    }
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [pos, isMobile]);

  const startDrag = (e) => {
    if (isMobile) return; // disable dragging on mobile
    const start = 'touches' in e ? e.touches[0] : e;
    if (!start) return;
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    draggingRef.current = {
      active: true,
      dx: start.clientX - rect.left,
      dy: start.clientY - rect.top,
    };
  };

  const resetPos = () => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 16;
    const x = Math.max(margin, window.innerWidth - rect.width - margin);
    const y = Math.max(margin, window.innerHeight - rect.height - margin);
    const next = { x, y };
    setPos(next);
    try { localStorage.setItem('miniPos', JSON.stringify(next)); } catch {}
  };

  // Stop and cleanup when hiding mini-player
  useEffect(() => {
    if (!visible && playerRef.current) {
      try { playerRef.current.stopVideo?.(); } catch {}
      try { playerRef.current.destroy?.(); } catch {}
      playerRef.current = null;
    }
  }, [visible]);

  if (!visible || !current || current.type !== 'youtube') return null;

  const canPrev = queue.length > 0;
  const canNext = queue.length > 0;
  const toggle = () => {
    const YT = ytRef.current;
    const p = playerRef.current;
    if (!p || !YT) return;
    const state = p.getPlayerState();
    if (state === YT.PlayerState.PLAYING) { p.pauseVideo(); setIsPlaying(false); }
    else { p.playVideo(); setIsPlaying(true); }
  };
  const seekBy = (deltaSeconds) => {
    const p = playerRef.current;
    if (!p) return;
    try {
      const d = p.getDuration?.() || 0;
      const t = p.getCurrentTime?.() || 0;
      const nextT = Math.max(0, Math.min(d || 0, t + deltaSeconds));
      p.seekTo(nextT, true);
    } catch {}
  };
  const handleSeek = (e) => {
    const val = Number(e.target.value);
    if (!playerRef.current || !duration) return;
    const seconds = (val / 100) * duration;
    try { playerRef.current.seekTo(seconds, true); } catch {}
  };

  const pct = duration ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const fmt = (s) => {
    const m = Math.floor((s || 0) / 60);
    const ss = Math.floor((s || 0) % 60).toString().padStart(2, '0');
    return `${m}:${ss}`;
  };

  const isFullscreen = isMobile && expanded;

  if (isFullscreen) {
    const cover = current?.id ? `https://i.ytimg.com/vi/${current.id}/hqdefault.jpg` : null;
    return (
      <div className="fixed inset-0 z-50 bg-[var(--bg-0)]">
        {/* Hidden video container */}
        <div className="absolute opacity-0 pointer-events-none w-[320px] h-[180px] -z-10">
          <div ref={containerRef} className="w-full h-full" />
        </div>
        {/* Top bar */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-1)]/70 backdrop-blur-xl">
          <button className="text-[var(--text-1)] hover:text-[var(--text-0)]" aria-label="Collapse" onClick={() => setExpanded(false)}>↧</button>
          <div className="text-sm text-[var(--text-1)]">Playing</div>
          <Button aria-label="Close" variant="ghost" size="sm" onClick={close}>✕</Button>
        </div>
        {/* Artwork and info */}
        <div className="px-5 pt-5 pb-3">
          <div className="aspect-square rounded-2xl overflow-hidden border border-[var(--border)] shadow-xl">
            {cover ? (
              <img src={cover} alt={current.title || 'Cover'} className="aspect-inner object-cover" />
            ) : (
              <div className="aspect-inner flex items-center justify-center bg-[var(--panel)] text-[var(--text-1)]">♪</div>
            )}
          </div>
          <div className="mt-4">
            <div ref={titleBoxRef} className="text-[var(--text-0)] font-semibold text-xl leading-snug" title={current.title || 'Playing video'}>
              <div className="truncate whitespace-nowrap">{current.title || 'Playing video'}</div>
            </div>
            {current.channel && <div className="text-sm text-[var(--text-1)] mt-1" title={current.channel}>{current.channel}</div>}
          </div>
        </div>
        {/* Seek */}
        <div className="px-5">
          <input type="range" min={0} max={100} value={pct} onChange={handleSeek} className="range-touch w-full accent-[var(--brand)]" />
          <div className="text-xs text-[var(--text-1)] mt-1">{fmt(currentTime)} / {fmt(duration)}</div>
        </div>
        {/* Controls */}
        <div className="px-5 mt-4">
          <div className="flex items-center justify-center gap-4">
            <Button aria-label="Previous" title="Previous" variant="outline" size="icon" onClick={prev} disabled={!canPrev}>⏮</Button>
            <Button aria-label="Rewind 10 seconds" title="Rewind 10 seconds" variant="outline" size="icon" onClick={() => seekBy(-10)}>⏪</Button>
            <Button aria-label={isPlaying ? 'Pause' : 'Play'} title={isPlaying ? 'Pause' : 'Play'} variant="secondary" size="icon" className="h-14 w-14 text-2xl" onClick={toggle}>{isPlaying ? '⏸' : '▶'}</Button>
            <Button aria-label="Forward 10 seconds" title="Forward 10 seconds" variant="outline" size="icon" onClick={() => seekBy(10)}>⏩</Button>
            <Button aria-label="Next" title="Next" variant="outline" size="icon" onClick={next} disabled={!canNext}>⏭</Button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Button aria-label={repeatTitle} title={repeatTitle} variant={repeatMode === 'off' ? 'outline' : 'secondary'} size="sm" onClick={cycleRepeat}>{repeatSymbol}</Button>
            <Button aria-label={isLiked(current.id) ? 'Unlike' : 'Like'} title={isLiked(current.id) ? 'Unlike' : 'Like'} variant="outline" size="sm" onClick={() => toggleLike(current.id, current)}>{isLiked(current.id) ? '♥' : '♡'}</Button>
            <Button aria-label="Add to playlist" title="Add to playlist" variant="outline" size="sm" onClick={() => setShowPl(true)}>＋</Button>
          </div>
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
        {/* Modal overlay for playlist selection is rendered below */}
        {showPl && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowPl(false)} />
            <div className="relative z-50 mx-auto mt-[10vh] w-[92%] max-w-sm bg-[var(--bg-0)] border border-[var(--border)] rounded-xl shadow-2xl p-4" ref={plMenuRef}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-[var(--text-0)] font-semibold">Add to playlist</div>
                <button className="text-[var(--text-1)] hover:text-[var(--text-0)]" onClick={() => setShowPl(false)}>✕</button>
              </div>
              <div className="max-h-64 overflow-auto space-y-1">
                {[...new Set(['liked', ...Object.keys(ytPlaylists || {})])].map(name => (
                  <button key={name} className="block w-full text-left px-3 py-2 text-sm rounded hover:bg-[var(--bg-1)] text-[var(--text-0)]" onClick={() => { addToPlaylist(name, current); setShowPl(false); }}>➕ {name}</button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input className="flex-1 h-9 bg-[var(--bg-0)] border border-[var(--border)] rounded px-3 text-sm text-[var(--text-0)] placeholder:text-[var(--text-1)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]" placeholder="New playlist name" value={newPl} onChange={(e) => setNewPl(e.target.value)} onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const name = (newPl || '').trim();
                    if (!name) return;
                    addToPlaylist(name, current);
                    setNewPl('');
                    setShowPl(false);
                  }
                }} />
                <Button variant="secondary" size="sm" className="h-9 text-sm" disabled={!((newPl || '').trim())} onClick={() => { const name = (newPl || '').trim(); if (!name) return; addToPlaylist(name, current); setNewPl(''); setShowPl(false); }}>Create & Add</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
    <div
      ref={wrapperRef}
      className={isMobile ? "fixed inset-x-3 bottom-3 z-50" : (pos ? "fixed z-50 md:w-[520px] w-[92vw]" : "fixed bottom-4 right-4 left-4 md:left-auto md:w-[520px] z-50")}
      style={!isMobile && pos ? { left: pos.x, top: pos.y } : undefined}
    >
      <div className="border border-[var(--border)] rounded-[var(--radius)] shadow-2xl ring-1 ring-black/10 p-3 md:p-4 pb-[env(safe-area-inset-bottom)] relative select-none bg-[var(--bg-0)]">
        {/* hidden video container to stream audio */}
        <div className="absolute opacity-0 pointer-events-none w-[320px] h-[180px] -z-10">
          <div ref={containerRef} className="w-full h-full" />
        </div>
        {/* top-right actions */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {isMobile && <Button aria-label="Expand" variant="ghost" size="sm" onClick={() => setExpanded(true)} className="text-[var(--text-1)] hover:text-[var(--text-0)]">⤢</Button>}
          <Button aria-label="Close player" variant="ghost" size="sm" onClick={close} className="text-[var(--text-1)] hover:text-[var(--text-0)]">✕</Button>
        </div>
        {/* Drag handle */}
        {!isMobile && (
          <div
            className="absolute left-0 right-10 top-0 h-6 cursor-move"
            onMouseDown={startDrag}
            onTouchStart={startDrag}
            onDoubleClick={resetPos}
          />
        )}
        <div className="flex gap-4 items-start">
          <div className="flex-1 min-w-0">
            <div ref={titleBoxRef} className="text-[var(--text-0)] font-semibold overflow-hidden text-base md:text-lg leading-snug" title={current.title || 'Playing video'}>
              {titleOverflow ? (
                <div className="marquee">
                  <span className="marquee-inner">{current.title || 'Playing video'}</span>
                  <span className="marquee-inner" aria-hidden="true">{current.title || 'Playing video'}</span>
                </div>
              ) : (
                <div className="truncate whitespace-nowrap">{current.title || 'Playing video'}</div>
              )}
            </div>
            {current.channel && <div className="text-sm text-[var(--text-1)] mt-1 line-clamp-1" title={current.channel}>{current.channel}</div>}
            <div className="mt-2">
              <input
                type="range"
                min={0}
                max={100}
                value={pct}
                onChange={handleSeek}
                className="range-touch w-full accent-[var(--brand)]"
              />
              <div className="text-xs text-[var(--text-1)] mt-1">
                {fmt(currentTime)} / {fmt(duration)}
              </div>
            </div>
            {isMobile ? (
              <>
                <div className="mt-3 flex items-center justify-center gap-3">
                  <Button aria-label="Previous" title="Previous" variant="outline" size="icon" onClick={prev} disabled={!canPrev}>⏮</Button>
                  <Button aria-label={isPlaying ? 'Pause' : 'Play'} title={isPlaying ? 'Pause' : 'Play'} variant="secondary" size="icon" className="h-12 w-12 text-xl" onClick={toggle}>{isPlaying ? '⏸' : '▶'}</Button>
                  <Button aria-label="Next" title="Next" variant="outline" size="icon" onClick={next} disabled={!canNext}>⏭</Button>
                </div>
                <div className="mt-2 grid grid-cols-5 gap-2 items-center">
                  <Button aria-label="Rewind 10 seconds" title="Rewind 10 seconds" variant="outline" size="icon" onClick={() => seekBy(-10)}>⏪</Button>
                  <Button aria-label="Forward 10 seconds" title="Forward 10 seconds" variant="outline" size="icon" onClick={() => seekBy(10)}>⏩</Button>
                  <Button aria-label={repeatTitle} title={repeatTitle} variant={repeatMode === 'off' ? 'outline' : 'secondary'} size="icon" onClick={cycleRepeat}>{repeatSymbol}</Button>
                  <Button aria-label={isLiked(current.id) ? 'Unlike' : 'Like'} title={isLiked(current.id) ? 'Unlike' : 'Like'} variant="outline" size="icon" onClick={() => toggleLike(current.id, current)}>{isLiked(current.id) ? '♥' : '♡'}</Button>
                  <div className="relative overflow-visible" ref={plMenuRef}>
                    <Button aria-label="Add to playlist" title="Add to playlist" variant="outline" size="icon" className="text-xl" onClick={() => setShowPl(true)}>＋</Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-3 flex flex-wrap md:flex-nowrap gap-2 items-center justify-center md:justify-start">
                <Button aria-label="Previous" title="Previous" variant="outline" size="sm" onClick={prev} disabled={!canPrev}>⏮</Button>
                <Button aria-label="Rewind 10 seconds" title="Rewind 10 seconds" variant="outline" size="sm" onClick={() => seekBy(-10)}>⏪</Button>
                <Button aria-label={isPlaying ? 'Pause' : 'Play'} title={isPlaying ? 'Pause' : 'Play'} variant="secondary" size="sm" onClick={toggle}>{isPlaying ? '⏸' : '▶'}</Button>
                <Button aria-label="Forward 10 seconds" title="Forward 10 seconds" variant="outline" size="sm" onClick={() => seekBy(10)}>⏩</Button>
                <Button aria-label="Next" title="Next" variant="outline" size="sm" onClick={next} disabled={!canNext}>⏭</Button>
                <div className="ml-auto flex items-center gap-2">
                  <Button aria-label={repeatTitle} title={repeatTitle} variant={repeatMode === 'off' ? 'outline' : 'secondary'} size="sm" onClick={cycleRepeat}>{repeatSymbol}</Button>
                  <Button aria-label={isLiked(current.id) ? 'Unlike' : 'Like'} title={isLiked(current.id) ? 'Unlike' : 'Like'} variant="outline" size="sm" onClick={() => toggleLike(current.id, current)}>{isLiked(current.id) ? '♥' : '♡'}</Button>
                  <div className="relative overflow-visible" ref={plMenuRef}>
                    <Button aria-label="Add to playlist" title="Add to playlist" variant="outline" size="icon" className="text-xl" onClick={() => setShowPl(true)}>＋</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    {/* Modal overlay for playlist selection */}
    {showPl && (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/60" onClick={() => setShowPl(false)} />
        <div className="relative z-50 mx-auto mt-[10vh] w-[92%] max-w-sm bg-[var(--bg-0)] border border-[var(--border)] rounded-xl shadow-2xl p-4" ref={plMenuRef}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[var(--text-0)] font-semibold">Add to playlist</div>
            <button className="text-[var(--text-1)] hover:text-[var(--text-0)]" onClick={() => setShowPl(false)}>✕</button>
          </div>
          <div className="max-h-64 overflow-auto space-y-1">
            {[...new Set(['liked', ...Object.keys(ytPlaylists || {})])].map(name => (
              <button
                key={name}
                className="block w-full text-left px-3 py-2 text-sm rounded hover:bg-[var(--bg-1)] text-[var(--text-0)]"
                onClick={() => { addToPlaylist(name, current); setShowPl(false); }}
              >➕ {name}</button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              className="flex-1 h-9 bg-[var(--bg-0)] border border-[var(--border)] rounded px-3 text-sm text-[var(--text-0)] placeholder:text-[var(--text-1)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
              placeholder="New playlist name"
              value={newPl}
              onChange={(e) => setNewPl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const name = (newPl || '').trim();
                  if (!name) return;
                  addToPlaylist(name, current);
                  setNewPl('');
                  setShowPl(false);
                }
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              className="h-9 text-sm"
              disabled={!((newPl || '').trim())}
              onClick={() => {
                const name = (newPl || '').trim();
                if (!name) return;
                addToPlaylist(name, current);
                setNewPl('');
                setShowPl(false);
              }}
            >Create & Add</Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// Render modal overlay for playlist selection
// Note: This relies on MiniPlayer's state; ensure it's within the same component scope

function MiniPlayerSpacer() {
  const { current, visible } = usePlayer();
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsMobile(!!mq.matches);
    apply();
    try { mq.addEventListener('change', apply); } catch { mq.addListener(apply); }
    return () => { try { mq.removeEventListener('change', apply); } catch { mq.removeListener(apply); } };
  }, []);
  if (!(isMobile && visible && current)) return null;
  return <div className="h-28" />;
}

export default function App({ children }) {
  return (
    <PlayerProvider>
      <div className="min-h-screen grid grid-rows-[auto,1fr,auto]">
        <NavBar />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
        <MiniPlayerSpacer />
        <MiniPlayer />
        <footer className="text-center text-base text-[var(--text-1)] py-6 border-t border-[var(--border)] backdrop-blur-md bg-[var(--bg-1)]">
          <div className="container mx-auto px-4">
            Built with ♥ for music lovers. <Link className="text-[var(--text-1)] hover:text-[var(--text-0)] underline underline-offset-2" to="/settings">Settings</Link>
          </div>
        </footer>
      </div>
    </PlayerProvider>
  );
}
