import { useEffect, useState } from 'react';
import { useMessageStore } from '../store/messageStore.js';
import { apiGet } from '../lib/api.js';
import { Message, MessageType } from '../../shared/types.js';
import { Bell, Calendar, FileText, CreditCard, MessageSquare, Check, Download, Clock, RefreshCw } from 'lucide-react';

export default function Messages() {
  const storeMessages = useMessageStore(state => state.messages);
  const loading = useMessageStore(state => state.loading);
  const fetchMessages = useMessageStore(state => state.fetchMessages);
  const markAsRead = useMessageStore(state => state.markAsRead);
  const markAllAsRead = useMessageStore(state => state.markAllAsRead);
  const initListener = useMessageStore(state => state.initListener);

  const [displayMessages, setDisplayMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<MessageType | 'all'>('all');

  useEffect(() => {
    fetchMessages();
    const cleanup = initListener();
    return cleanup;
  }, [fetchMessages, initListener]);

  useEffect(() => {
    loadFilteredMessages();
  }, [filter, storeMessages]);

  const loadFilteredMessages = async () => {
    if (filter === 'all') {
      setDisplayMessages(storeMessages);
    } else {
      try {
        const data = await apiGet<Message[]>(`/messages?type=${filter}`);
        setDisplayMessages(data);
      } catch (error) {
        console.error('加载消息失败:', error);
      }
    }
  };

  const getUnreadCount = () => displayMessages.filter(m => !m.isRead).length;

  const getMessageIcon = (type: MessageType) => {
    const icons: Record<MessageType, React.ReactNode> = {
      appointment: <Calendar className="w-5 h-5 text-blue-500" />,
      prescription: <FileText className="w-5 h-5 text-purple-500" />,
      payment: <CreditCard className="w-5 h-5 text-green-500" />,
      complaint: <MessageSquare className="w-5 h-5 text-orange-500" />,
      system: <Bell className="w-5 h-5 text-gray-500" />,
      follow_up: <RefreshCw className="w-5 h-5 text-yellow-500" />
    };
    return icons[type] || <Bell className="w-5 h-5 text-gray-500" />;
  };

  const getMessageTypeLabel = (type: MessageType) => {
    const labels: Record<MessageType, string> = {
      appointment: '预约通知',
      prescription: '处方通知',
      payment: '支付通知',
      complaint: '投诉通知',
      system: '系统通知',
      follow_up: '复诊提醒'
    };
    return labels[type] || type;
  };

  const filters = [
    { value: 'all' as const, label: '全部' },
    { value: 'appointment' as const, label: '预约' },
    { value: 'prescription' as const, label: '处方' },
    { value: 'payment' as const, label: '支付' },
    { value: 'complaint' as const, label: '投诉' },
    { value: 'system' as const, label: '系统' }
  ];

  if (loading && displayMessages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">消息中心</h1>
          <p className="text-gray-500 mt-1">
            共 {displayMessages.length} 条消息
            {getUnreadCount() > 0 && (
              <span className="ml-2 text-red-500">{getUnreadCount()} 条未读</span>
            )}
          </p>
        </div>
        {displayMessages.filter(m => !m.isRead).length > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-2 text-blue-500 hover:text-blue-600 text-sm font-medium"
          >
            <Check className="w-4 h-4" />
            全部标记已读
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {filters.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              filter === f.value
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="divide-y divide-gray-50">
          {displayMessages.map((message) => (
            <div
              key={message.id}
              className={`p-5 hover:bg-gray-50 transition-colors cursor-pointer ${
                !message.isRead ? 'bg-blue-50' : ''
              }`}
              onClick={() => !message.isRead && markAsRead(message.id)}
            >
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  !message.isRead ? 'bg-white' : 'bg-gray-50'
                }`}>
                  {getMessageIcon(message.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-medium ${
                        !message.isRead ? 'text-gray-900' : 'text-gray-700'
                      }`}>
                        {message.title}
                      </h3>
                      {!message.isRead && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      )}
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                        {getMessageTypeLabel(message.type)}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(message.createdAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  <p className={`text-sm ${
                    !message.isRead ? 'text-gray-600' : 'text-gray-500'
                  }`}>
                    {message.content}
                  </p>
                  {message.relatedId && (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        查看详情
                      </button>
                      {(message as any).attachmentUrl && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open((message as any).attachmentUrl, '_blank');
                          }}
                          className="text-xs text-green-500 hover:text-green-600 flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          下载凭证
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {displayMessages.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>暂无消息</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
