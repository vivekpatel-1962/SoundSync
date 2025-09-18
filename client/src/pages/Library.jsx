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
  const [selectedName, setSelectedName] = useState(null);
  const panelRef = React.useRef(null);
  React.useEffect(() => {
    if (!selectedName) return;
    const el = panelRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
    }
  }, [selectedName]);

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

      {(() => {
        const entries = Object.entries(ytPlaylists || {});
        const hasLiked = entries.some(([n]) => n === 'liked');
        const safeEntries = hasLiked ? entries : [['liked', []], ...entries];
        if (safeEntries.length === 0) {
          return (
            <motion.div variants={fadeUp} className="text-[var(--text-1)]">No playlists yet. Use the mini-player ＋ or ♥ to add songs.</motion.div>
          );
        }
        return (
          <>
            {/* Mobile: square tiles (smaller) */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3 md:hidden">
              {safeEntries.map(([name, list]) => {
                const first = (list || [])[0];
                const cover = first ? `https://i.ytimg.com/vi/${first.id}/hqdefault.jpg` : null;
                return (
                  <motion.button
                    type="button"
                    variants={fadeUp}
                    key={name}
                    onClick={() => setSelectedName(name)}
                    className="aspect-square rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--bg-2)] shadow text-left"
                    title={`Open ${name}`}
                  >
                    <div className="aspect-inner">
                      {cover ? (
                        <img src={cover} alt={name} loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl text-[var(--text-1)]">{name[0]?.toUpperCase() || 'P'}</div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                        <div className="text-[11px] font-semibold text-white truncate" title={name}>{name}</div>
                        <div className="text-[10px] text-gray-200">{(list || []).length} songs</div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
            {/* Mobile: selected playlist panel */}
            {selectedName && (
              <div className="md:hidden mt-3" ref={panelRef}>
                {(() => {
                  const entry = safeEntries.find(([n]) => n === selectedName);
                  const list = entry ? entry[1] : [];
                  const first = (list || [])[0];
                  const cover = first ? `https://i.ytimg.com/vi/${first.id}/hqdefault.jpg` : null;
                  return (
                    <Card className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <button className="text-sm text-[var(--text-1)] hover:text-[var(--text-0)]" onClick={() => setSelectedName(null)}>← All playlists</button>
                          <div className="text-sm text-[var(--text-1)]">{(list || []).length} songs</div>
                        </div>
                        <div className="flex items-start gap-3 mb-3">
                          {cover ? (
                            <img src={cover} alt={selectedName} loading="lazy" className="w-16 h-16 rounded object-cover shadow" />
                          ) : (
                            <div className="w-16 h-16 rounded bg-[var(--panel)] shadow flex items-center justify-center text-[var(--text-1)] text-base">{selectedName[0]?.toUpperCase() || 'P'}</div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-[var(--text-0)] truncate" title={selectedName}>{selectedName}</div>
                            <div className="mt-2">
                              <Button size="sm" className="h-8 px-3" onClick={() => playFromPlaylist(list, 0)}>Play</Button>
                            </div>
                          </div>
                        </div>
                        {(list || []).length > 0 ? (
                          <ul className="space-y-2">
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
                                  onClick={(e) => { e.stopPropagation(); removeFromPlaylist(selectedName, t.id); }}
                                >
                                  <span aria-hidden>✕</span>
                                </Button>
                              </motion.li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-sm text-[var(--text-1)]">No songs yet. Use ＋ in mini-player or "Add current" to add songs.</div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })()}
              </div>
            )}
            {/* Desktop: existing detailed layout */}
            <div className="hidden md:block">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {safeEntries.map(([name, list]) => {
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
                                      title={`Delete playlist \"${name}\"`}
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
                })}
              </div>
            </div>
          </>
        );
      })()}
    </motion.div>
  );
}
