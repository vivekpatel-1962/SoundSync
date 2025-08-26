import { io } from 'socket.io-client';

let socket;
export function getSocket() {
  if (!socket) {
    const BASE = (import.meta.env?.VITE_API_BASE || '');
    const url = BASE || '/';
    socket = io(url, { path: '/socket.io' });
  }
  return socket;
}
