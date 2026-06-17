import { io, Socket } from 'socket.io-client';
import { Message } from '../../shared/types.js';

let socket: Socket | null = null;
const messageListeners = new Set<(message: Message) => void>();

export function initSocket(userId: string): Socket {
  if (socket) {
    socket.disconnect();
  }

  socket = io('http://localhost:3001', {
    query: { userId },
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket?.id);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  socket.on('newMessage', (message: Message) => {
    messageListeners.forEach(listener => listener(message));
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function addMessageListener(listener: (message: Message) => void): () => void {
  messageListeners.add(listener);
  return () => messageListeners.delete(listener);
}

export function markMessageAsRead(messageId: string): void {
  if (socket) {
    socket.emit('markAsRead', messageId);
  }
}

export function markAllMessagesAsRead(userId: string): void {
  if (socket) {
    socket.emit('markAllAsRead', userId);
  }
}
