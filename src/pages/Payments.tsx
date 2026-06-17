import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../lib/api.js';
import { Payment, Appointment, CalculatePaymentResponse } from '../../shared/types.js';
import { useAuthStore } from '../store/authStore.js';
import {
  CreditCard, Receipt, Star, Clock, CheckCircle, AlertCircle,
  ChevronRight, X, Pill, Minus, Plus, FileText, Store, TrendingUp,
  DollarSign, Percent, Coins, MapPin, Package, QrCode, ArrowRight
} from 'lucide-react';

interface PaymentDetail extends Payment {
  appointmentCode?: string;
  appointmentTime?: string;
  symptoms?: string;
  consultationFee?: number;
  medicineAmount?: number;
  medicineItems?: any[];
  memberLevel?: number;
  ownerName?: string;
  pointsUsed?: number;
  earnedPoints?: number;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  prescriptionStatus?: string;
  needConfirmation?: boolean;
  dispenseRecord?: {
    id: string;
    pharmacistName?: string;
    pickupCode: string;
    dispensedAt?: string;
  } | null;
  pickupStatus?: 'pending_review' | 'pending_dispense' | 'ready' | 'dispensed';
}

export default function Payments() {
  const user = useAuthStore(state => state.user);
  const updateUser = useAuthStore(state => state.updateUser);
  const [payments, setPayments] = useState<PaymentDetail[]>([]);
  const [pendingAppointments, setPendingAppointments] = useState<Appointment[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentDetail | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<CalculatePaymentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [usePoints, setUsePoints] = useState(0);
  const [noPrescriptionError, setNoPrescriptionError] = useState('');

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [paymentsData, appointmentsData] = await Promise.all([
        apiGet<PaymentDetail[]>('/payments/my-payments'),
        apiGet<Appointment[]>('/appointments')
      ]);
      setPayments(paymentsData);
      const pending = appointmentsData.filter(a => (a.status === 'completed' || a.status === 'in_progress') && !a.paymentId);
      setPendingAppointments(pending);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePayment = async (appointmentId: string, points: number = 0) => {
    setCalculating(true);
    setNoPrescriptionError('');
    try {
      const result = await apiPost<CalculatePaymentResponse>('/payments/calculate', {
        appointmentId,
        usePoints: points
      });
      setPaymentInfo(result);
      setUsePoints(result.pointsUsed);
      return true;
    } catch (error: any) {
      console.error('计算费用失败:', error);
      if (error?.hasPrescription === false || error?.message?.includes('处方')) {
        setNoPrescriptionError(error?.message || '该预约尚未开具处方');
      }
      setPaymentInfo(null);
      return false;
    } finally {
      setCalculating(false);
    }
  };

  const handleOpenPayment = async (apt: Appointment) => {
    setSelectedAppointment(apt);
    setShowPaymentModal(true);
    setUsePoints(0);
    setNoPrescriptionError('');
    setPaymentInfo(null);
    await calculatePayment(apt.id, 0);
  };

  const handlePointsChange = (delta: number) => {
    if (!selectedAppointment || !paymentInfo) return;
    const maxPoints = user?.memberPoints || 0;
    const newPoints = Math.max(0, Math.min(maxPoints, usePoints + delta));
    setUsePoints(newPoints);
    calculatePayment(selectedAppointment.id, newPoints);
  };

  const handlePointsInput = (value: string) => {
    if (!selectedAppointment) return;
    const maxPoints = user?.memberPoints || 0;
    const num = parseInt(value) || 0;
    const newPoints = Math.max(0, Math.min(maxPoints, num));
    setUsePoints(newPoints);
    calculatePayment(selectedAppointment.id, newPoints);
  };

  const handleUseAllPoints = () => {
    if (!selectedAppointment) return;
    const maxPoints = user?.memberPoints || 0;
    setUsePoints(maxPoints);
    calculatePayment(selectedAppointment.id, maxPoints);
  };

  const handlePay = async () => {
    if (!selectedAppointment || !paymentInfo) return;
    setPaying(true);
    try {
      const result: any = await apiPost<Payment>('/payments', {
        appointmentId: selectedAppointment.id,
        amount: paymentInfo.finalAmount,
        usePoints: paymentInfo.pointsUsed,
        paymentMethod: 'wechat'
      });
      alert('支付成功！');
      if (result.user) {
        updateUser(result.user);
      }
      setShowPaymentModal(false);
      setPaymentInfo(null);
      setSelectedAppointment(null);
      loadData();
    } catch (error: any) {
      alert(error.message || '支付失败');
    } finally {
      setPaying(false);
    }
  };

  const viewPaymentDetail = async (payment: PaymentDetail) => {
    try {
      const detail = await apiGet<PaymentDetail>(`/payments/${payment.id}`);
      setSelectedPayment(detail);
      setShowDetailModal(true);
    } catch (error) {
      console.error('加载账单详情失败:', error);
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

  const getDiscountRate = (level: number) => {
    const rates = [0, 0.05, 0.10, 0.15, 0.20];
    return rates[level - 1] || 0;
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
            <p className="text-2xl font-bold">{getMemberLevelName(user.memberLevel || 1)}</p>
            <p className="text-sm opacity-80 mt-2">
              折扣率: {Math.round((1 - getDiscountRate(user.memberLevel || 1)) * 100)}%
            </p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Coins className="w-5 h-5 text-green-600" />
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
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-gray-800">{apt.symptoms || '就诊'}</h3>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                          {apt.appointmentCode}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(apt.appointmentTime).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleOpenPayment(apt)}
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
              <div
                key={payment.id}
                className="p-5 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => viewPaymentDetail(payment)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      payment.status === 'paid' ? 'bg-green-100' : 'bg-yellow-100'
                    }`}>
                      {payment.status === 'paid' ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <Clock className="w-5 h-5 text-yellow-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-800">电子账单 #{payment.id.slice(-8)}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          payment.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {payment.status === 'paid' ? '已支付' : '待支付'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(payment.createdAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-800">¥{payment.finalAmount.toFixed(2)}</p>
                    {payment.memberDiscount > 0 && (
                      <p className="text-xs text-green-600">已优惠 ¥{payment.memberDiscount.toFixed(2)}</p>
                    )}
                    {payment.pointsDeduction > 0 && (
                      <p className="text-xs text-blue-600">积分抵扣 ¥{payment.pointsDeduction.toFixed(2)}</p>
                    )}
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

      {showPaymentModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">确认支付</h3>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentInfo(null);
                  setSelectedAppointment(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {noPrescriptionError ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-yellow-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">暂无法支付</h3>
                <p className="text-gray-500">{noPrescriptionError}</p>
              </div>
            ) : paymentInfo ? (
              <div className="p-6 space-y-5">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-500">就诊信息</p>
                    <span className="text-xs bg-white px-2 py-1 rounded-full text-blue-600 font-medium">
                      {paymentInfo.appointmentCode}
                    </span>
                  </div>
                  <p className="font-medium text-gray-800">{selectedAppointment.symptoms || '就诊'}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(selectedAppointment.appointmentTime).toLocaleString('zh-CN')}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    费用明细
                  </p>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">诊金</span>
                      <span className="text-gray-800">¥{paymentInfo.consultationFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">药品费用</span>
                      <span className="text-gray-800">¥{paymentInfo.medicineAmount.toFixed(2)}</span>
                    </div>
                    {paymentInfo.medicineItems.map((item, index) => (
                      <div key={index} className="flex items-center justify-between pl-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Pill className="w-3 h-3 text-blue-400" />
                          <span>{item.medicineName} × {item.quantity}</span>
                        </div>
                        <span>¥{item.subtotal.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-gray-200 flex justify-between text-sm">
                      <span className="text-gray-600 font-medium">原价合计</span>
                      <span className="text-gray-800 font-medium">¥{paymentInfo.originalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Percent className="w-4 h-4" />
                    优惠明细
                  </p>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">会员等级折扣</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getMemberLevelColor(paymentInfo.memberLevel)} bg-white`}>
                          {getMemberLevelName(paymentInfo.memberLevel)}
                        </span>
                      </div>
                      <span className="text-green-600">-¥{paymentInfo.memberDiscount.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-sm">积分抵扣</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-white rounded-lg border border-gray-200">
                          <button
                            onClick={() => handlePointsChange(-100)}
                            disabled={usePoints <= 0 || calculating}
                            className="p-1.5 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-l-lg"
                          >
                            <Minus className="w-3 h-3 text-gray-600" />
                          </button>
                          <input
                            type="number"
                            value={usePoints}
                            onChange={(e) => handlePointsInput(e.target.value)}
                            disabled={calculating}
                            className="w-16 text-center text-sm border-x border-gray-200 py-1 focus:outline-none"
                          />
                          <button
                            onClick={() => handlePointsChange(100)}
                            disabled={usePoints >= (user?.memberPoints || 0) || calculating}
                            className="p-1.5 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-r-lg"
                          >
                            <Plus className="w-3 h-3 text-gray-600" />
                          </button>
                        </div>
                        <button
                          onClick={handleUseAllPoints}
                          disabled={calculating}
                          className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
                        >
                          全部使用
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>可用 {user?.memberPoints || 0} 积分</span>
                      <span className="text-blue-500">抵扣 ¥{paymentInfo.pointsDeduction.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-5 text-white">
                  <div className="flex justify-between items-center">
                    <span className="text-white/90">应付金额</span>
                    <div className="text-right">
                      <p className="text-3xl font-bold">¥{paymentInfo.finalAmount.toFixed(2)}</p>
                      <p className="text-xs text-white/70 mt-1">
                        支付后获得 {paymentInfo.earnedPoints} 积分
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-500">计算费用中...</p>
              </div>
            )}

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
                disabled={paying || !paymentInfo || !!noPrescriptionError}
                className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                {paying ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    支付中...
                  </>
                ) : paymentInfo && paymentInfo.finalAmount === 0 ? (
                  '确认领取（0元）'
                ) : (
                  '微信支付'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">账单详情</h3>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedPayment(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-5 text-white text-center">
                <p className="text-white/80 text-sm mb-1">实付金额</p>
                <p className="text-4xl font-bold">¥{selectedPayment.finalAmount.toFixed(2)}</p>
                <div className="flex justify-center gap-4 mt-3 text-sm text-white/70">
                  <span>订单号：{selectedPayment.appointmentCode}</span>
                </div>
                <div className="mt-3">
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    selectedPayment.status === 'paid'
                      ? 'bg-white/20 text-white'
                      : 'bg-yellow-200/30 text-yellow-100'
                  }`}>
                    {selectedPayment.status === 'paid' ? '已支付' : '待支付'}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">费用明细</p>
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">诊金</span>
                    <span className="text-gray-800">¥{selectedPayment.consultationFee?.toFixed(2) || '50.00'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">药品费用</span>
                    <span className="text-gray-800">¥{selectedPayment.medicineAmount?.toFixed(2) || '0.00'}</span>
                  </div>
                  {selectedPayment.medicineItems?.map((item, index) => (
                    <div key={index} className="flex items-center justify-between pl-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Pill className="w-3 h-3 text-blue-400" />
                        <span>{item.medicineName} × {item.quantity}</span>
                      </div>
                      <span>¥{item.subtotal.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-gray-200 flex justify-between text-sm">
                    <span className="text-gray-600 font-medium">原价合计</span>
                    <span className="text-gray-800 font-medium">¥{selectedPayment.originalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">优惠信息</p>
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      会员折扣 ({getMemberLevelName(selectedPayment.memberLevel || 1)})
                    </span>
                    <span className="text-green-600">-¥{selectedPayment.memberDiscount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      积分抵扣 ({selectedPayment.pointsUsed || 0}积分)
                    </span>
                    <span className="text-blue-600">-¥{selectedPayment.pointsDeduction.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  取药状态
                </p>
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  {selectedPayment.pickupStatus === 'pending_review' && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                        <Clock className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">处方待审核</p>
                        <p className="text-sm text-gray-500">医生已开具处方，等待药师正在审核中</p>
                      </div>
                    </div>
                  )}
                  {selectedPayment.pickupStatus === 'pending_dispense' && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Pill className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">待配药</p>
                        <p className="text-sm text-gray-500">处方审核通过，药师正在配药</p>
                      </div>
                    </div>
                  )}
                  {selectedPayment.pickupStatus === 'ready' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <QrCode className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">已配药完成</p>
                          <p className="text-sm text-gray-500">凭取药码到门店取药</p>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500 mb-1">取药码</p>
                        <p className="text-2xl font-bold text-green-600 tracking-widest">
                          {selectedPayment.dispenseRecord?.pickupCode || '-'}
                        </p>
                      </div>
                    </div>
                  )}
                  {selectedPayment.pickupStatus === 'dispensed' && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">已取药</p>
                        <p className="text-sm text-gray-500">
                          {selectedPayment.dispenseRecord?.pharmacistName
                            ? `由${selectedPayment.dispenseRecord.pharmacistName}配药`
                            : '药品已发放'}
                        </p>
                      </div>
                    </div>
                  )}
                  {!selectedPayment.pickupStatus && (
                    <div className="text-center py-2 text-gray-500 text-sm">
                      暂无取药信息
                    </div>
                  )}

                  {selectedPayment.storeName && (
                    <div className="pt-3 border-t border-gray-200">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="text-gray-700 font-medium">{selectedPayment.storeName}</p>
                          {selectedPayment.storeAddress && (
                            <p className="text-gray-500 text-xs mt-1">{selectedPayment.storeAddress}</p>
                          )}
                          {selectedPayment.storePhone && (
                            <p className="text-gray-500 text-xs mt-1">电话：{selectedPayment.storePhone}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 text-sm text-gray-500 space-y-2">
                <div className="flex justify-between">
                  <span>支付方式</span>
                  <span className="text-gray-700">
                    {selectedPayment.paymentMethod === 'wechat' ? '微信支付' : '支付宝'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>支付时间</span>
                  <span className="text-gray-700">
                    {selectedPayment.paidAt
                      ? new Date(selectedPayment.paidAt).toLocaleString('zh-CN')
                      : '-'}
                  </span>
                </div>
                {selectedPayment.earnedPoints !== undefined && (
                  <div className="flex justify-between">
                    <span>获得积分</span>
                    <span className="text-yellow-600 font-medium">+{selectedPayment.earnedPoints} 积分</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
