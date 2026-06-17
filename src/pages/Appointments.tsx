import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../lib/api.js';
import { Appointment, Department, Doctor, Store } from '../../shared/types.js';
import { useAuthStore } from '../store/authStore.js';
import { Calendar, Plus, Clock, MapPin, User, FileText, X, Check, QrCode } from 'lucide-react';

interface MatchResult {
  department: Department;
  doctor: Doctor;
  matchScore: number;
}

export default function Appointments() {
  const user = useAuthStore(state => state.user);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [qrCode, setQrCode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);

  const [formData, setFormData] = useState({
    petId: '',
    storeId: '',
    symptoms: '',
    appointmentTime: ''
  });

  const [pets, setPets] = useState<any[]>([]);
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [appointmentsData, petsData, storesData] = await Promise.all([
        apiGet<Appointment[]>('/appointments'),
        user?.role === 'owner' ? apiGet<any[]>('/pets') : Promise.resolve([]),
        apiGet<Store[]>('/stores')
      ]);
      setAppointments(appointmentsData);
      setPets(petsData);
      setStores(storesData);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSymptomsChange = async (symptoms: string) => {
    setFormData({ ...formData, symptoms });
    if (symptoms.length >= 2) {
      setMatching(true);
      try {
        const result = await apiPost<MatchResult>('/appointments/match', { symptoms, storeId: formData.storeId });
        setMatchResult(result);
      } catch (error) {
        console.error('匹配失败:', error);
      } finally {
        setMatching(false);
      }
    } else {
      setMatchResult(null);
    }
  };

  const handleCreateAppointment = async () => {
    if (!formData.petId || !formData.storeId || !formData.symptoms || !formData.appointmentTime) {
      alert('请填写完整信息');
      return;
    }

    try {
      const appointment = await apiPost<Appointment>('/appointments', {
        ...formData,
        departmentId: matchResult?.department.id,
        doctorId: matchResult?.doctor.id
      });
      setAppointments([appointment, ...appointments]);
      setShowCreateModal(false);
      setFormData({ petId: '', storeId: '', symptoms: '', appointmentTime: '' });
      setMatchResult(null);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleGenerateQr = async (appointmentId: string) => {
    try {
      const result = await apiPost<{ qrCode: string; appointmentCode: string }>(`/appointments/${appointmentId}/qr`);
      setQrCode(result.qrCode);
      setSelectedAppointment(appointments.find(a => a.id === appointmentId) || null);
      setShowQrModal(true);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!confirm('确定要取消这个预约吗？')) return;
    try {
      await apiPost(`/appointments/${appointmentId}/status`, { status: 'cancelled' });
      setAppointments(appointments.map(a => 
        a.id === appointmentId ? { ...a, status: 'cancelled' as const } : a
      ));
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleConfirmAppointment = async (appointmentId: string) => {
    try {
      await apiPost(`/appointments/${appointmentId}/status`, { status: 'confirmed' });
      setAppointments(appointments.map(a => 
        a.id === appointmentId ? { ...a, status: 'confirmed' as const } : a
      ));
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleStartVisit = async (appointmentId: string) => {
    try {
      await apiPost(`/appointments/${appointmentId}/status`, { status: 'in_progress' });
      setAppointments(appointments.map(a => 
        a.id === appointmentId ? { ...a, status: 'in_progress' as const } : a
      ));
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleCompleteVisit = async (appointmentId: string) => {
    try {
      await apiPost(`/appointments/${appointmentId}/status`, { status: 'completed' });
      setAppointments(appointments.map(a => 
        a.id === appointmentId ? { ...a, status: 'completed' as const } : a
      ));
    } catch (error: any) {
      alert(error.message);
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

  if (loading) {
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
          <h1 className="text-2xl font-bold text-gray-800">预约管理</h1>
          <p className="text-gray-500 mt-1">共 {appointments.length} 条预约记录</p>
        </div>
        {user?.role === 'owner' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            新建预约
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="divide-y divide-gray-50">
          {appointments.map((apt) => (
            <div key={apt.id} className="p-5 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-800">{apt.symptoms}</h3>
                    {getStatusBadge(apt.status)}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {new Date(apt.appointmentTime).toLocaleDateString('zh-CN')}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {new Date(apt.appointmentTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {stores.find(s => s.id === apt.storeId)?.name || '未知门店'}
                    </div>
                    {apt.appointmentCode && (
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        就诊码: {apt.appointmentCode}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {apt.status === 'confirmed' && apt.appointmentCode && (
                    <button
                      onClick={() => handleGenerateQr(apt.id)}
                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                      title="查看就诊码"
                    >
                      <QrCode className="w-5 h-5" />
                    </button>
                  )}
                  {apt.status === 'pending' && user?.role !== 'owner' && (
                    <button
                      onClick={() => handleConfirmAppointment(apt.id)}
                      className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                      title="确认预约"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  )}
                  {apt.status === 'confirmed' && user?.role === 'doctor' && (
                    <button
                      onClick={() => handleStartVisit(apt.id)}
                      className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded-lg transition-colors"
                    >
                      开始接诊
                    </button>
                  )}
                  {apt.status === 'in_progress' && user?.role === 'doctor' && (
                    <button
                      onClick={() => handleCompleteVisit(apt.id)}
                      className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors"
                    >
                      完成就诊
                    </button>
                  )}
                  {(apt.status === 'pending' || apt.status === 'confirmed') && user?.role === 'owner' && (
                    <button
                      onClick={() => handleCancelAppointment(apt.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="取消预约"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {appointments.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>暂无预约记录</p>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">新建预约</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setMatchResult(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择宠物</label>
                <select
                  value={formData.petId}
                  onChange={(e) => setFormData({ ...formData, petId: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">请选择宠物</option>
                  {pets.map(pet => (
                    <option key={pet.id} value={pet.id}>{pet.name} ({pet.species} - {pet.breed})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择门店</label>
                <select
                  value={formData.storeId}
                  onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">请选择门店</option>
                  {stores.map(store => (
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">症状描述</label>
                <textarea
                  value={formData.symptoms}
                  onChange={(e) => handleSymptomsChange(e.target.value)}
                  placeholder="请详细描述宠物的症状，系统将自动匹配科室和医生"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                />
                {matching && (
                  <p className="text-sm text-blue-500 mt-2">正在匹配科室和医生...</p>
                )}
                {matchResult && (
                  <div className="mt-3 p-4 bg-blue-50 rounded-xl">
                    <p className="text-sm font-medium text-blue-800 mb-2">智能匹配结果</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-blue-700">
                        <User className="w-4 h-4" />
                        推荐科室: {matchResult.department.name}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-blue-700">
                        <User className="w-4 h-4" />
                        推荐医生: {matchResult.doctor.name}
                      </div>
                      <div className="text-xs text-blue-600">
                        匹配度: {Math.round(matchResult.matchScore * 100)}%
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">预约时间</label>
                <input
                  type="datetime-local"
                  value={formData.appointmentTime}
                  onChange={(e) => setFormData({ ...formData, appointmentTime: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setMatchResult(null);
                }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateAppointment}
                disabled={!formData.petId || !formData.storeId || !formData.symptoms || !formData.appointmentTime}
                className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl font-medium transition-colors"
              >
                提交预约
              </button>
            </div>
          </div>
        </div>
      )}

      {showQrModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">电子就诊码</h3>
            <p className="text-sm text-gray-500 mb-4">请出示此码给医护人员扫码就诊</p>
            <div className="bg-white p-4 rounded-xl mb-4">
              <img src={qrCode} alt="就诊码" className="w-48 h-48 mx-auto" />
            </div>
            <p className="text-lg font-mono font-bold text-gray-800 mb-4">
              {selectedAppointment.appointmentCode}
            </p>
            <div className="text-sm text-gray-500 mb-4">
              <p>{selectedAppointment.symptoms}</p>
              <p className="mt-1">{new Date(selectedAppointment.appointmentTime).toLocaleString('zh-CN')}</p>
            </div>
            <button
              onClick={() => setShowQrModal(false)}
              className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
