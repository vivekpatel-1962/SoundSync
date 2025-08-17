import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { getSocket } from '../services/socket.js';

const RoomContext = createContext();

export function RoomProvider({ children }) {
  const { user } = useUser();
  const [currentRoom, setCurrentRoom] = useState(null);
  const socket = useMemo(() => getSocket(), []);

  useEffect(() => {
    if (!currentRoom || !user) return;
    socket.emit('joinRoom', { roomId: currentRoom.id, userId: user.id });
  }, [currentRoom, user, socket]);

  const value = { currentRoom, setCurrentRoom, socket };
  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export const useRoom = () => useContext(RoomContext);
