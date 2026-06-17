import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore.js';
import { apiGet } from '../lib/api.js';
import { Appointment, Payment, Message } from '../../shared/types.js';
import { Calendar, CreditCard, Bell, Star, TrendingUp, Users, Pill, FileText, PawPrint, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DashboardStats {
  todayAppointments: number;
  pendingPayments: number;
  unreadMessages: number;
  memberLevel: number;
  memberPoints: number;
}

export default function Dashboard() {
  const user = useAuthStore(state => state.user);
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    todayAppointments: 0,
    pendingPayments: 0,
    unreadMessages: 0,
    memberLevel: 1,
    memberPoints: 0
  });
  const [recentAppointments, setRecentAppointments] = useState<Appointment[]>([]);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'owner') {
      loadOwnerDashboard();
    } else if (user?.role === 'doctor') {
      loadDoctorDashboard();
    } else if (user?.role === 'pharmacist') {
      loadPharmacistDashboard();
    } else if (user?.role === 'manager') {
      loadManagerDashboard();
    }
  }, [user]);

  const loadOwnerDashboard = async () => {
    try {
      const [appointments, messages] = await Promise.all([
        apiGet<Appointment[]>('/appointments'),
        apiGet<Message[]>('/messages/unread')
      ]);
      setRecentAppointments(appointments.slice(0, 5));
      setRecentMessages(messages.slice(0, 5));
      setStats({
        todayAppointments: appointments.filter(a => 
          new Date(a.appointmentTime).toDateString() === new Date().toDateString()
        ).length,
        pendingPayments: appointments.filter(a => a.status === 'completed' && !a.paymentId).length,
        unreadMessages: messages.length,
        memberLevel: user?.memberLevel || 1,
        memberPoints: user?.memberPoints || 0
      });
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDoctorDashboard = async () => {
    try {
      const appointments = await apiGet<Appointment[]>('/appointments');
      const messages = await apiGet<Message[]>('/messages/unread');
      setRecentAppointments(appointments.filter(a => a.status === 'confirmed').slice(0, 5));
      setRecentMessages(messages.slice(0, 5));
      setStats({
        todayAppointments: appointments.filter(a => 
          new Date(a.appointmentTime).toDateString() === new Date().toDateString() && a.doctorId === user?.id
        ).length,
        pendingPayments: appointments.filter(a => a.status === 'in_progress' && a.doctorId === user?.id).length,
        unreadMessages: messages.length,
        memberLevel: 1,
        memberPoints: 0
      });
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPharmacistDashboard = async () => {
    try {
      const [prescriptions, messages] = await Promise.all([
        apiGet<any[]>('/pharmacy/prescriptions/pending'),
        apiGet<Message[]>('/messages/unread')
      ]);
      setRecentMessages(messages.slice(0, 5));
      setStats({
        todayAppointments: prescriptions?.length || 0,
        pendingPayments: 0,
        unreadMessages: messages.length,
        memberLevel: 1,
        memberPoints: 0
      });
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadManagerDashboard = async () => {
    try {
      const [dashboardData, messages] = await Promise.all([
        apiGet<any>('/reports/dashboard'),
        apiGet<Message[]>('/messages/unread')
      ]);
      setRecentMessages(messages.slice(0, 5));
      setStats({
        todayAppointments: dashboardData?.todayAppointments || 0,
        pendingPayments: dashboardData?.todayRevenue || 0,
        unreadMessages: messages.length,
        memberLevel: 1,
        memberPoints: 0
      });
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      confirmed: 'bg-blue-100 text-blue-700',
      in_progress: 'bg-purple-100 text-purple-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-gray-100 text-gray-700'
    };
    const labels: Record<string, string> = {
      pending: '待确认',
      confirmed: '已确认',
      in_progress: '就诊中',
      completed: '已完成',
      cancelled: '已取消'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getOwnerStatCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Calendar className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">今日预约</p>
            <p className="text-2xl font-bold text-gray-800">{stats.todayAppointments}</p>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">待支付</p>
            <p className="text-2xl font-bold text-gray-800">{stats.pendingPayments}</p>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <Bell className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">未读消息</p>
            <p className="text-2xl font-bold text-gray-800">{stats.unreadMessages}</p>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <Star className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">会员积分</p>
            <p className="text-2xl font-bold text-gray-800">{stats.memberPoints}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const getDoctorStatCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">今日接诊</p>
            <p className="text-2xl font-bold text-gray-800">{stats.todayAppointments}</p>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">待诊断</p>
            <p className="text-2xl font-bold text-gray-800">{stats.pendingPayments}</p>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
            <Bell className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">未读消息</p>
            <p className="text-2xl font-bold text-gray-800">{stats.unreadMessages}</p>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <Star className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">满意度</p>
            <p className="text-2xl font-bold text-gray-800">4.8</p>
          </div>
        </div>
      </div>
    </div>
  );

  const getPharmacistStatCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Pill className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">待审核处方</p>
            <p className="text-2xl font-bold text-gray-800">{stats.todayAppointments}</p>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
            <PawPrint className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">库存预警</p>
            <p className="text-2xl font-bold text-gray-800">3</p>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <Bell className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">未读消息</p>
            <p className="text-2xl font-bold text-gray-800">{stats.unreadMessages}</p>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">今日配药</p>
            <p className="text-2xl font-bold text-gray-800">12</p>
          </div>
        </div>
      </div>
    </div>
  );

  const getManagerStatCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Calendar className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">今日就诊量</p>
            <p className="text-2xl font-bold text-gray-800">{stats.todayAppointments}</p>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">今日营收</p>
            <p className="text-2xl font-bold text-gray-800">¥{stats.pendingPayments}</p>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <Bell className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">未读消息</p>
            <p className="text-2xl font-bold text-gray-800">{stats.unreadMessages}</p>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">待处理投诉</p>
            <p className="text-2xl font-bold text-gray-800">2</p>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          欢迎回来，{user?.name}
        </h1>
        <p className="text-gray-500 mt-1">
          {new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {user?.role === 'owner' && getOwnerStatCards()}
      {user?.role === 'doctor' && getDoctorStatCards()}
      {user?.role === 'pharmacist' && getPharmacistStatCards()}
      {user?.role === 'manager' && getManagerStatCards()}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {recentAppointments.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">最近预约</h3>
              <button 
                onClick={() => navigate('/appointments')}
                className="text-blue-500 text-sm hover:underline"
              >
                查看全部
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {recentAppointments.map((apt) => (
                <div key={apt.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">
                        {apt.symptoms}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(apt.appointmentTime).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    {getStatusBadge(apt.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentMessages.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">最近消息</h3>
              <button 
                onClick={() => navigate('/messages')}
                className="text-blue-500 text-sm hover:underline"
              >
                查看全部
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {recentMessages.map((msg) => (
                <div key={msg.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bell className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm">
                        {msg.title}
                      </p>
                      <p className="text-sm text-gray-500 mt-1 truncate">
                        {msg.content}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(msg.createdAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
