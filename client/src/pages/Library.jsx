import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '../components/ui/card.jsx';
import { Button } from '../components/ui/button.jsx';
import { usePlayer } from '../App.jsx';
import { Input } from '../components/ui/input.jsx';
import { container, fadeUp } from '../lib/motionPresets.js';

export default function Library() {
  const { ytPlaylists, removeFromPlaylist, deleteLocalPlaylist, addToPlaylist, current, createLocalPlaylist, setQueue, setIndex, setVisible } = usePlayer();
  const [newName, setNewName] = useState('');

  const onCreate = (e) => {
    e?.preventDefault();
    const name = (newName || '').trim();
    if (!name || name.toLowerCase() === 'liked') return;
    createLocalPlaylist(name);
    setNewName('');
  };

  const playFromPlaylist = (list, startIdx = 0) => {
    const q = (list || []).map(t => ({ type: 'youtube', id: t.id, title: t.title, channel: t.channel }));
    if (q.length === 0) return;
    setQueue(q);
    setIndex(Math.max(0, Math.min(startIdx, q.length - 1)));
    setVisible(true);
  };

  const downloadJSON = (filename, data) => {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {}
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
      <motion.h1 variants={fadeUp} className="text-3xl font-bold gradient-text">Playlists</motion.h1>

      <motion.form variants={fadeUp} onSubmit={onCreate} className="flex gap-3 max-w-md">
        <Input
          placeholder="New playlist name"
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <Button type="submit" className="h-12 px-5">Create</Button>
      </motion.form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(() => {
          const entries = Object.entries(ytPlaylists || {});
          const hasLiked = entries.some(([n]) => n === 'liked');
          const safeEntries = hasLiked ? entries : [['liked', []], ...entries];
          if (safeEntries.length === 0) {
            return (
              <motion.div variants={fadeUp} className="text-[var(--text-1)]">No playlists yet. Use the mini-player ＋ or ♥ to add songs.</motion.div>
            );
          }
          return safeEntries.map(([name, list]) => {
            const first = (list || [])[0];
            const cover = first ? `https://i.ytimg.com/vi/${first.id}/hqdefault.jpg` : null;
            return (
              <motion.div variants={fadeUp} key={name}>
                <Card className="hover:shadow-xl transition-all duration-300 overflow-hidden">
                  <CardContent className="p-6 overflow-hidden">
                    <div className="flex items-start gap-4">
                      {cover ? (
                        <img src={cover} alt={name} loading="lazy" className="w-20 h-20 rounded-lg object-cover shadow" />
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-[var(--panel)] shadow flex items-center justify-center text-[var(--text-1)] text-sm">{name[0]?.toUpperCase() || 'P'}</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 w-full">
                          <div className="min-w-0">
                            <div className="font-semibold text-[var(--text-0)] truncate whitespace-nowrap w-full pr-2" title={name}>{name}</div>
                            <div className="text-sm text-[var(--text-1)]">{(list || []).length} songs</div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 justify-self-end flex-nowrap mt-0">
                            {current?.type === 'youtube' && (
                              <Button
                                size="sm"
                                variant="outline"
                                title="Add current track to this playlist"
                                aria-label="Add current track"
                                className="h-8 w-8 p-0 rounded-md"
                                onClick={() => addToPlaylist(name, current)}
                              >
                                <span aria-hidden>＋</span>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="secondary"
                              title="Save this playlist as JSON"
                              aria-label="Save playlist JSON"
                              className="h-8 w-8 p-0 rounded-md"
                              onClick={() => downloadJSON(`${name}.json`, { name, songs: list || [] })}
                            >
                              <span aria-hidden>⤓</span>
                            </Button>
                            {name !== 'liked' && (
                              <Button
                                size="sm"
                                variant="outline"
                                title={`Delete playlist "${name}"`}
                                aria-label="Delete playlist"
                                className="h-8 w-8 p-0 rounded-md border-red-500/50 text-red-300 hover:bg-red-500/10"
                                onClick={() => { if (window.confirm(`Delete playlist \"${name}\"?`)) deleteLocalPlaylist(name); }}
                              >
                                <span aria-hidden>🗑</span>
                              </Button>
                            )}
                          </div>
                        </div>

                        {(list || []).length > 0 && (
                          <ul className="mt-4 space-y-2 w-full overflow-hidden">
                            {(list || []).map((t, idx) => (
                              <motion.li variants={fadeUp} key={t.id} className="flex items-center justify-between bg-[var(--panel)] hover:bg-[var(--bg-2)] transition-colors rounded-md p-2 min-w-0 w-full cursor-pointer" onClick={() => playFromPlaylist(list, idx)}>
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <img src={`https://i.ytimg.com/vi/${t.id}/default.jpg`} alt={t.title} loading="lazy" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                                  <div className="flex-1 min-w-0 max-w-full">
                                    <div className="text-sm text-[var(--text-0)] truncate" title={t.title}>{t.title}</div>
                                    <div className="text-xs text-[var(--text-1)] truncate" title={t.channel}>{t.channel}</div>
                                  </div>
                                </div>
                                <Button
                                  className="flex-shrink-0 ml-2 h-8 w-8 p-0"
                                  variant="secondary"
                                  size="sm"
                                  title="Remove from playlist"
                                  aria-label="Remove from playlist"
                                  onClick={(e) => { e.stopPropagation(); removeFromPlaylist(name, t.id); }}
                                >
                                  <span aria-hidden>✕</span>
                                </Button>
                              </motion.li>
                            ))}
                          </ul>
                        )}
                        {(list || []).length === 0 && (
                          <div className="mt-4 text-sm text-[var(--text-1)]">No songs yet. Use ＋ in mini-player or "Add current" to add songs.</div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          });
        })()}
      </div>
    </motion.div>
  );
}
