import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { useMessageStore } from '../store/messageStore.js';
import {
  PawPrint,
  Calendar,
  FileText,
  Pill,
  CreditCard,
  MessageSquare,
  BarChart3,
  Settings,
  LogOut,
  Bell,
  User,
  Cat
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
}

export default function Layout({ children }: LayoutProps) {
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const unreadCount = useMessageStore(state => state.unreadCount);
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: NavItem[] = [
    { path: '/dashboard', label: '工作台', icon: <BarChart3 className="w-5 h-5" />, roles: ['owner', 'doctor', 'pharmacist', 'manager'] },
    { path: '/appointments', label: '预约管理', icon: <Calendar className="w-5 h-5" />, roles: ['owner', 'doctor', 'manager'] },
    { path: '/pets', label: '我的宠物', icon: <Cat className="w-5 h-5" />, roles: ['owner'] },
    { path: '/medical', label: '病历处方', icon: <FileText className="w-5 h-5" />, roles: ['doctor', 'owner'] },
    { path: '/pharmacy', label: '药房管理', icon: <Pill className="w-5 h-5" />, roles: ['pharmacist', 'manager'] },
    { path: '/payments', label: '支付记录', icon: <CreditCard className="w-5 h-5" />, roles: ['owner', 'manager'] },
    { path: '/complaints', label: '投诉中心', icon: <MessageSquare className="w-5 h-5" />, roles: ['owner', 'manager'] },
    { path: '/messages', label: '消息中心', icon: <Bell className="w-5 h-5" />, roles: ['owner', 'doctor', 'pharmacist', 'manager'] },
    { path: '/reports', label: '数据报表', icon: <BarChart3 className="w-5 h-5" />, roles: ['manager'] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role || ''));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      owner: '宠物主人',
      doctor: '主治医师',
      pharmacist: '药剂师',
      manager: '门店店长'
    };
    return labels[role] || role;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <PawPrint className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-800">宠物医院</h1>
              <p className="text-xs text-gray-500">管理平台</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {filteredNavItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                location.pathname === item.path
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
          >
            <LogOut className="w-5 h-5" />
            退出登录
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              {filteredNavItems.find(item => item.path === location.pathname)?.label || '工作台'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/messages')}
              className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-800">{user?.name}</p>
                <p className="text-xs text-gray-500">{getRoleLabel(user?.role || '')}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
