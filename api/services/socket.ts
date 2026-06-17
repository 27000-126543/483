import { Server } from 'socket.io';
import { Message, MessageType } from '../../shared/types.js';
import { messageModel } from '../db/models/Message.js';

let io: Server | null = null;
const userSockets = new Map<string, Set<string>>();

export function initSocketIO(server: any): Server {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId as string;

    if (userId) {
      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId)!.add(socket.id);

      socket.join(`user:${userId}`);
    }

    socket.on('disconnect', () => {
      if (userId && userSockets.has(userId)) {
        userSockets.get(userId)!.delete(socket.id);
        if (userSockets.get(userId)!.size === 0) {
          userSockets.delete(userId);
        }
      }
    });

    socket.on('markAsRead', (messageId: string) => {
      messageModel.markAsRead(messageId);
    });

    socket.on('markAllAsRead', (userId: string) => {
      messageModel.markAllAsRead(userId);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}

export function sendMessageToUser(userId: string, message: Omit<Message, 'id' | 'createdAt' | 'isRead'>): Message {
  const savedMessage = messageModel.create(message);

  if (io && userSockets.has(userId)) {
    io.to(`user:${userId}`).emit('newMessage', savedMessage);
  }

  return savedMessage;
}

export function broadcastMessage(message: Omit<Message, 'id' | 'createdAt' | 'isRead'>, userIds: string[]): void {
  userIds.forEach(userId => {
    sendMessageToUser(userId, message);
  });
}

export async function sendNotification(
  userId: string,
  type: MessageType,
  title: string,
  content: string,
  relatedId?: string
): Promise<Message> {
  return sendMessageToUser(userId, {
    userId,
    type,
    title,
    content,
    relatedId
  });
}
