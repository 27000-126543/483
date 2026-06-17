import { create } from 'zustand';
import { Message } from '../../shared/types.js';
import { apiGet, apiPut } from '../lib/api.js';
import { addMessageListener, markMessageAsRead as socketMarkAsRead, markAllMessagesAsRead as socketMarkAllAsRead } from '../lib/socket.js';

interface MessageState {
  messages: Message[];
  unreadCount: number;
  loading: boolean;
  fetchMessages: () => Promise<void>;
  addMessage: (message: Message) => void;
  markAsRead: (messageId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  getUnreadCount: () => Promise<void>;
  initListener: () => () => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: [],
  unreadCount: 0,
  loading: false,

  fetchMessages: async () => {
    set({ loading: true });
    try {
      const messages = await apiGet<Message[]>('/messages');
      set({ messages });
      const unread = messages.filter(m => !m.isRead).length;
      set({ unreadCount: unread });
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      set({ loading: false });
    }
  },

  addMessage: (message: Message) => {
    set(state => ({
      messages: [message, ...state.messages],
      unreadCount: state.unreadCount + 1
    }));
  },

  markAsRead: async (messageId: string) => {
    try {
      await apiPut(`/messages/${messageId}/read`);
      socketMarkAsRead(messageId);
      set(state => ({
        messages: state.messages.map(m =>
          m.id === messageId ? { ...m, isRead: true } : m
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }));
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  },

  markAllAsRead: async () => {
    try {
      await apiPut('/messages/read-all');
      const userId = JSON.parse(localStorage.getItem('user') || '{}').id;
      socketMarkAllAsRead(userId);
      set(state => ({
        messages: state.messages.map(m => ({ ...m, isRead: true })),
        unreadCount: 0
      }));
    } catch (error) {
      console.error('Failed to mark all messages as read:', error);
    }
  },

  getUnreadCount: async () => {
    try {
      const count = await apiGet<{ count: number }>('/messages/unread-count');
      set({ unreadCount: count.count });
    } catch (error) {
      console.error('Failed to get unread count:', error);
    }
  },

  initListener: () => {
    return addMessageListener((message) => {
      get().addMessage(message);
    });
  }
}));
