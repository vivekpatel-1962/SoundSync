import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { youtube } from '../services/youtube.js';
import { Input } from '../components/ui/input.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent } from '../components/ui/card.jsx';
import { Skeleton } from '../components/ui/skeleton.jsx';
import { usePlayer } from '../App.jsx';

export default function Home() {
  const [data, setData] = useState({ songs: [], playlists: [] });
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [liked, setLiked] = useState({}); // { [songId]: true }
  const { playYouTube, setQueue, setIndex, setVisible } = usePlayer();

  useEffect(() => { (async () => {
    const res = await api.get('/recommendations');
    setData(res);
    try {
      const pl = await api.get('/playlists');
      const likedPl = (pl.playlists || []).find(p => p.id === 'liked');
      if (likedPl) {
        const map = {};
        (likedPl.songs || []).forEach(s => { map[s.id] = true; });
        setLiked(map);
      }
    } catch {}
  })(); }, []);

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
    } catch (e) {
      console.error('Failed to like song', e);
    }
  };

  return (
    <div className="space-y-12">
      <section className="text-center py-8">
        <h1 className="text-4xl font-bold gradient-text mb-4">Discover Music</h1>
        <p className="text-slate-400 text-lg mb-8">Search and play your favorite tracks from YouTube</p>
        <div className="max-w-2xl mx-auto">
        <form onSubmit={onSearch} className="flex gap-3">
          <Input
            placeholder="Search for songs, artists, albums..."
            value={q}
            onChange={e => setQ(e.target.value)}
            className="text-base py-3 px-4 h-12"
          />
          <Button disabled={loading} type="submit" size="lg" className="px-8">{loading ? 'Searching…' : 'Search'}</Button>
        </form>
        </div>
        {error && <div className="text-red-400 text-sm whitespace-pre-wrap break-words mt-4 text-center">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {loading && Array.from({ length: 6 }).map((_, i) => (
            <Card key={`sk-${i}`}>
              <CardContent className="p-4 flex gap-4 items-center">
                <Skeleton className="w-24 h-24 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-8 w-24 mt-2" />
                </div>
              </CardContent>
            </Card>
          ))}
          {!loading && items.length === 0 && !error && q.trim() && (
            <div className="text-slate-400">No results</div>
          )}
          {!loading && items.map((it, i) => (
            <Card key={it.id} className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-6">
                <div className="flex gap-4 items-start">
                  <img src={it.thumbnails?.medium?.url || it.thumbnails?.default?.url} alt={it.title} className="w-20 h-20 rounded-lg object-cover shadow-md" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white line-clamp-2 mb-1">{it.title}</h3>
                    <p className="text-sm text-slate-400 mb-3">{it.channel}</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        // build queue from current search results
                        const tracks = items.map(x => ({ type: 'youtube', id: x.id, title: x.title, channel: x.channel }));
                        setQueue(tracks);
                        setIndex(i);
                        setVisible(true);
                      }}
                    >
                      ▶ Play
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-bold mb-6 text-center">Recommended Songs</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {data.songs.map(s => (
            <Card key={s.id} className="hover:shadow-xl transition-all duration-300 hover:-translate-y-2 p-4">
              <img src={s.cover} alt={s.title} className="w-full aspect-square object-cover rounded-lg mb-3 shadow-md" />
              <h3 className="font-semibold text-white line-clamp-2 mb-1">{s.title}</h3>
              <p className="text-sm text-slate-400">{s.artist}</p>
              <div className="mt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => likeSong(s.id)}
                  disabled={!!liked[s.id]}
                  className="w-full"
                >
                  {liked[s.id] ? 'Liked ✓' : '♥ Like'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6 text-center">Playlists for You</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {data.playlists.map(p => (
            <Card key={p.id} className="hover:shadow-xl transition-all duration-300 p-4">
              <div className="flex gap-4 items-center">
                <img src={p.cover} alt={p.name} className="w-20 h-20 rounded-md object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white truncate">{p.name}</div>
                  <div className="text-sm text-slate-400">{p.songIds.length} songs</div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => api.download(`/download/playlist/${p.id}`, `${p.name}.json`)}>Download</Button>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
