import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api.js';
import { youtube } from '../services/youtube.js';
import { Input } from '../components/ui/input.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent } from '../components/ui/card.jsx';
import { Skeleton } from '../components/ui/skeleton.jsx';
import { usePlayer } from '../App.jsx';

export default function Home() {
  const [data, setData] = useState({ songs: [] });
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [liked, setLiked] = useState({});
  const [ytLiked, setYtLiked] = useState({});
  const { setQueue, setIndex, setVisible } = usePlayer();
  const didInit = useRef(false);

  const refreshRecs = async () => {
    try {
      const res = await api.get('/recommendations', { timeoutMs: 15000 });
      const safe = { songs: Array.isArray(res?.songs) ? res.songs : [] };
      setData(prev => {
        const prevHasYT = prev?.songs?.some(s => s.source === 'yt');
        const newHasYT = safe.songs.some(s => s.source === 'yt');
        if (prevHasYT && !newHasYT) return prev;
        return safe;
      });
    } catch {}
  };

  useEffect(() => {
    (async () => {
      if (didInit.current) return;
      didInit.current = true;
      try { await refreshRecs(); } catch (err) { console.error('Recommendations fetch failed:', err?.message || err); }
      try {
        const pl = await api.get('/playlists');
        const likedPl = (pl.playlists || []).find(p => p.id === 'liked');
        if (likedPl) {
          const map = {};
          (likedPl.songs || []).forEach(s => { map[s.id] = true; });
          setLiked(map);
        }
      } catch {}
      try {
        const yt = await api.get('/user/yt');
        const ymap = {};
        (yt.likes || []).forEach(id => { ymap[id] = true; });
        setYtLiked(ymap);
      } catch {}
    })();
  }, []);

  const onSearch = async (e) => {
    e?.preventDefault();
    setError('');
    const term = q.trim();
    if (!term) return;
    setLoading(true);
    try {
      const res = await youtube.search(term);
      setItems(res);
    } catch (err) {
      const msg = typeof err?.message === 'string' && err.message ? err.message : 'Search failed';
      setError(msg);
      setItems([]);
      console.error('YouTube search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const likeSong = async (songId) => {
    if (!songId || liked[songId]) return;
    try {
      await api.post(`/playlists/liked/songs`, { songId });
      setLiked(prev => ({ ...prev, [songId]: true }));
      await refreshRecs();
    } catch (e) {
      console.error('Failed to like song', e);
    }
  };

  const likeYt = async (id, track) => {
    if (!id || ytLiked[id]) return;
    try {
      await api.post('/user/yt/likes/toggle', { id, track, like: true });
      setYtLiked(prev => ({ ...prev, [id]: true }));
      await refreshRecs();
    } catch (e) {
      console.error('Failed to like YouTube track', e);
    }
  };

  return (
    <div className="space-y-16 px-4 sm:px-8 lg:px-16 pb-16 max-w-7xl mx-auto">
      <section className="text-center pt-12">
        <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 mb-6">Discover Music</h1>
        <p className="text-lg text-slate-400 max-w-xl mx-auto mb-10">Search and play your favorite tracks from YouTube with ease and style.</p>
        <form onSubmit={onSearch} className="flex max-w-xl mx-auto gap-4">
          <Input
            placeholder="Search for songs, artists, albums..."
            value={q}
            onChange={e => setQ(e.target.value)}
            className="text-base py-4 px-5 rounded-xl shadow-md focus:ring-2 focus:ring-indigo-500 transition"
          />
          <Button
            disabled={loading}
            type="submit"
            size="lg"
            className="px-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition"
          >
            {loading ? 'Searching…' : 'Search'}
          </Button>
        </form>
        {error && (
          <div className="mt-6 text-red-500 text-sm whitespace-pre-wrap break-words max-w-xl mx-auto">{error}</div>
        )}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading && Array.from({ length: 6 }).map((_, i) => (
            <Card key={`sk-${i}`} className="animate-pulse shadow-lg rounded-xl overflow-hidden">
              <Skeleton className="w-24 h-24 rounded-xl mx-auto mt-4" />
              <CardContent className="p-4 space-y-4">
                <Skeleton className="h-5 w-3/4 rounded-md mx-auto" />
                <Skeleton className="h-4 w-1/2 mx-auto rounded-md" />
                <Skeleton className="h-8 w-28 mx-auto rounded-pill" />
              </CardContent>
            </Card>
          ))}
          {!loading && items.length === 0 && !error && q.trim() && (
            <p className="text-center col-span-full text-slate-400 text-lg">No results found</p>
          )}
          {!loading && items.map((it, i) => (
            <Card key={it.id} className="shadow-lg rounded-2xl hover:shadow-2xl transition-transform transform hover:-translate-y-1 cursor-pointer">
              <CardContent className="p-6 flex gap-6 items-start">
                <img
                  src={it.thumbnails?.medium?.url || it.thumbnails?.default?.url}
                  alt={it.title}
                  className="w-24 h-24 rounded-xl object-cover shadow-md"
                />
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-white text-lg line-clamp-2 mb-1">{it.title}</h3>
                    <p className="text-sm text-slate-400 mb-4 truncate">{it.channel}</p>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const tracks = items.map(x => ({ type: 'youtube', id: x.id, title: x.title, channel: x.channel }));
                        setQueue(tracks);
                        setIndex(i);
                        setVisible(true);
                      }}
                      className="flex-1"
                    >
                      ▶ Play
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!!ytLiked[it.id]}
                      onClick={() => likeYt(it.id, { id: it.id, title: it.title, channel: it.channel })}
                      className="flex-1"
                    >
                      {ytLiked[it.id] ? 'Liked ✓' : '♥ Like'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-3xl font-bold mb-8 text-center">Recommended Songs</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
          {data.songs.length === 0 && (
            <p className="col-span-full text-center text-slate-400 text-lg">No recommendations yet. Like a few tracks to get started.</p>
          )}
          {data.songs.map(s => (
            <Card
              key={s.id}
              className={`shadow-lg rounded-2xl hover:shadow-2xl transition-transform transform hover:-translate-y-2 p-5 cursor-pointer`}
              onClick={() => {
                if (s.source !== 'yt') return;
                const ytSongs = data.songs.filter(x => x.source === 'yt');
                if (!ytSongs.length) return;
                const tracks = ytSongs.map(x => ({ type: 'youtube', id: x.id, title: x.title, channel: x.artist }));
                const idx = ytSongs.findIndex(x => x.id === s.id);
                if (idx >= 0) {
                  setQueue(tracks);
                  setIndex(idx);
                  setVisible(true);
                }
              }}
            >
              <img src={s.cover} alt={s.title} className="w-full aspect-square object-cover rounded-xl mb-4 shadow-md" />
              <h3 className="font-semibold text-white text-lg line-clamp-2 mb-1">{s.title}</h3>
              <p className="text-sm text-slate-400 truncate">{s.artist}</p>
              <div className="mt-5">
                {s.source === 'yt' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={e => { e.stopPropagation(); likeYt(s.id, { id: s.id, title: s.title, channel: s.artist }); }}
                    disabled={!!ytLiked[s.id]}
                    className="w-full"
                  >
                    {ytLiked[s.id] ? 'Liked ✓' : '♥ Like'}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={e => { e.stopPropagation(); likeSong(s.id); }}
                    disabled={!!liked[s.id]}
                    className="w-full"
                  >
                    {liked[s.id] ? 'Liked ✓' : '♥ Like'}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
