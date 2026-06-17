import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../lib/api.js';
import { Payment, Appointment } from '../../shared/types.js';
import { useAuthStore } from '../store/authStore.js';
import { CreditCard, Receipt, Star, Clock, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';

export default function Payments() {
  const user = useAuthStore(state => state.user);
  const updateUser = useAuthStore(state => state.updateUser);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pendingAppointments, setPendingAppointments] = useState<Appointment[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [paymentsData, appointmentsData] = await Promise.all([
        apiGet<Payment[]>('/payments'),
        apiGet<Appointment[]>('/appointments')
      ]);
      setPayments(paymentsData);
      const pending = appointmentsData.filter(a => a.status === 'completed' && !a.paymentId);
      setPendingAppointments(pending);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePayment = async (appointmentId: string) => {
    try {
      const result = await apiPost<any>('/payments/calculate', { appointmentId, usePoints: false });
      setPaymentInfo(result);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handlePay = async () => {
    if (!selectedAppointment || !paymentInfo) return;
    setPaying(true);
    try {
      const result = await apiPost<Payment>('/payments', {
        appointmentId: selectedAppointment.id,
        usePoints: paymentInfo.usePoints,
        paymentMethod: 'wechat'
      });
      alert('支付成功！');
      if (result.pointsEarned && user) {
        updateUser({ memberPoints: (user.memberPoints || 0) + result.pointsEarned });
      }
      setShowPaymentModal(false);
      setPaymentInfo(null);
      setSelectedAppointment(null);
      loadData();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setPaying(false);
    }
  };

  const handleTogglePoints = async (usePoints: boolean) => {
    if (!selectedAppointment) return;
    try {
      const result = await apiPost<any>('/payments/calculate', { 
        appointmentId: selectedAppointment.id, 
        usePoints 
      });
      setPaymentInfo(result);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const getMemberLevelName = (level: number) => {
    const names = ['普通会员', '银卡会员', '金卡会员', '铂金会员', '钻石会员'];
    return names[level - 1] || '普通会员';
  };

  const getMemberLevelColor = (level: number) => {
    const colors = ['text-gray-600', 'text-gray-500', 'text-yellow-600', 'text-blue-600', 'text-purple-600'];
    return colors[level - 1] || 'text-gray-600';
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
          <h1 className="text-2xl font-bold text-gray-800">支付中心</h1>
          <p className="text-gray-500 mt-1">管理账单和支付记录</p>
        </div>
      </div>

      {user?.role === 'owner' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-5 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Star className="w-6 h-6" />
              <span className="text-sm opacity-90">会员等级</span>
            </div>
            <p className={`text-2xl font-bold ${getMemberLevelColor(user.memberLevel || 1)} bg-white rounded-lg px-3 py-1 inline-block`}>
              {getMemberLevelName(user.memberLevel || 1)}
            </p>
            <p className="text-sm opacity-80 mt-2">
              折扣率: {Math.round((1 - (user.memberLevel || 1) * 0.05) * 100)}%
            </p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Star className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm text-gray-500">可用积分</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{user?.memberPoints || 0}</p>
            <p className="text-xs text-gray-400 mt-1">100积分 = 1元</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Receipt className="w-5 h-5 text-orange-600" />
              </div>
              <span className="text-sm text-gray-500">待支付</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{pendingAppointments.length}</p>
          </div>
        </div>
      )}

      {user?.role === 'owner' && pendingAppointments.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">待支付订单</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="divide-y divide-gray-50">
              {pendingAppointments.map((apt) => (
                <div key={apt.id} className="p-5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-800">{apt.symptoms}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(apt.appointmentTime).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedAppointment(apt);
                        setShowPaymentModal(true);
                        calculatePayment(apt.id);
                      }}
                      className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-medium transition-colors"
                    >
                      去支付
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">支付记录</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="divide-y divide-gray-50">
            {payments.map((payment) => (
              <div key={payment.id} className="p-5 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      payment.status === 'completed' ? 'bg-green-100' : 'bg-yellow-100'
                    }`}>
                      {payment.status === 'completed' ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <Clock className="w-5 h-5 text-yellow-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-800">账单 #{payment.id.slice(-8)}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          payment.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {payment.status === 'completed' ? '已支付' : '待支付'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(payment.createdAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-800">¥{payment.finalAmount.toFixed(2)}</p>
                    {payment.discountAmount > 0 && (
                      <p className="text-xs text-green-600">已优惠 ¥{payment.discountAmount.toFixed(2)}</p>
                    )}
                    {payment.pointsUsed > 0 && (
                      <p className="text-xs text-blue-600">积分抵扣 ¥{(payment.pointsUsed / 100).toFixed(2)}</p>
                    )}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">原价: </span>
                    <span className="text-gray-700">¥{payment.originalAmount.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">会员折扣: </span>
                    <span className="text-purple-600">{Math.round(payment.discountRate * 100)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500">支付方式: </span>
                    <span className="text-gray-700">{payment.paymentMethod === 'wechat' ? '微信支付' : '支付宝'}</span>
                  </div>
                </div>
              </div>
            ))}
            {payments.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <Receipt className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>暂无支付记录</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPaymentModal && selectedAppointment && paymentInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800">确认支付</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-500 mb-1">就诊信息</p>
                <p className="font-medium text-gray-800">{selectedAppointment.symptoms}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(selectedAppointment.appointmentTime).toLocaleString('zh-CN')}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">药品费用</span>
                  <span className="text-gray-800">¥{paymentInfo.medicineAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">诊疗费用</span>
                  <span className="text-gray-800">¥{paymentInfo.treatmentAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">原价合计</span>
                  <span className="text-gray-800">¥{paymentInfo.originalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">会员等级折扣 ({getMemberLevelName(user?.memberLevel || 1)})</span>
                  <span className="text-green-600">-¥{paymentInfo.discountAmount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">积分抵扣</span>
                    <button
                      onClick={() => handleTogglePoints(!paymentInfo.usePoints)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        paymentInfo.usePoints ? 'bg-blue-500' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          paymentInfo.usePoints ? 'translate-x-4' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <span className="text-blue-600">
                    {paymentInfo.usePoints ? `-¥${(paymentInfo.pointsUsed / 100).toFixed(2)}` : '¥0.00'}
                    <span className="text-xs text-gray-400 ml-1">(可用 {user?.memberPoints || 0} 积分)</span>
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">应付金额</span>
                  <span className="text-2xl font-bold text-blue-600">¥{paymentInfo.finalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentInfo(null);
                  setSelectedAppointment(null);
                }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handlePay}
                disabled={paying}
                className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded-xl font-medium transition-colors"
              >
                {paying ? '支付中...' : '微信支付'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
