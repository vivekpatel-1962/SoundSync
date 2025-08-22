import React, { useEffect, useRef, useState } from 'react';
import { useRoom } from '../context/RoomContext.jsx';
import { useUser } from '@clerk/clerk-react';
import { Button } from './ui/button.jsx';

export default function Chat({ roomId }) {
  const { socket } = useRoom();
  const { user } = useUser();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!socket) return;
    const onMsg = (msg) => setMessages((m) => [...m, msg]);
    socket.on('message', onMsg);
    return () => socket.off('message', onMsg);
  }, [socket]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = () => {
    if (!text.trim()) return;
    const userName = user?.username || user?.fullName || user?.primaryEmailAddress?.emailAddress || user?.id;
    socket.emit('message', { roomId, userId: user.id, userName, text });
    setText('');
  };

  return (
    <div className="card h-72 flex flex-col">
      <div className="font-semibold mb-2">Room Chat</div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
        {messages.map(m => (
          <div key={m.id} className="text-sm"><span className="text-[var(--text-1)]">{m.userName || m.userId}:</span> {m.text}</div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="mt-2 flex gap-2">
        <input className="input" placeholder="Type a message" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key==='Enter' && send()} />
        <Button
          variant="secondary"
          size="sm"
          onClick={send}
          disabled={!text.trim()}
          className="disabled:opacity-100 disabled:text-[var(--text-0)]"
        >
          Send
        </Button>
      </div>
    </div>
  );
}
