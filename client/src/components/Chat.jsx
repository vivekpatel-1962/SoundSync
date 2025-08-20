import React, { useEffect, useRef, useState } from 'react';
import { useRoom } from '../context/RoomContext.jsx';
import { useUser } from '@clerk/clerk-react';

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
          <div key={m.id} className="text-sm"><span className="text-slate-400">{m.userName || m.userId}:</span> {m.text}</div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="mt-2 flex gap-2">
        <input className="input" placeholder="Type a message" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key==='Enter' && send()} />
        <button className="btn btn-primary" onClick={send}>Send</button>
      </div>
    </div>
  );
}
