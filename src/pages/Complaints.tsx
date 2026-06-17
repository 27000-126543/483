import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../lib/api.js';
import { Complaint, ComplaintType, ComplaintStatus } from '../../shared/types.js';
import { useAuthStore } from '../store/authStore.js';
import { MessageSquare, Plus, Clock, CheckCircle, AlertCircle, Send, X, Upload, User, Calendar, ChevronRight } from 'lucide-react';

export default function Complaints() {
  const user = useAuthStore(state => state.user);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [responseText, setResponseText] = useState('');

  const [formData, setFormData] = useState({
    type: 'service' as ComplaintType,
    title: '',
    description: '',
    appointmentId: '',
    evidenceUrls: [] as string[]
  });

  const [appointments, setAppointments] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [complaintsData, appointmentsData] = await Promise.all([
        apiGet<Complaint[]>('/complaints'),
        apiGet<any[]>('/appointments')
      ]);
      setComplaints(complaintsData);
      setAppointments(appointmentsData.filter(a => a.status === 'completed'));
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.description) {
      alert('请填写标题和描述');
      return;
    }

    setSubmitting(true);
    try {
      const newComplaint = await apiPost<Complaint>('/complaints', formData);
      setComplaints([newComplaint, ...complaints]);
      setShowCreateModal(false);
      resetForm();
      alert('投诉已提交，我们会尽快处理');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResponse = async () => {
    if (!selectedComplaint || !responseText.trim()) {
      alert('请输入回复内容');
      return;
    }

    try {
      const response = await apiPost(`/complaints/${selectedComplaint.id}/respond`, {
        response: responseText
      });
      setComplaints(complaints.map(c => 
        c.id === selectedComplaint.id 
          ? { ...c, status: 'processing' as const, responses: [...(c.responses || []), response] as any }
          : c
      ));
      setResponseText('');
      alert('回复已发送');
      loadData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleClose = async (complaintId: string) => {
    if (!confirm('确认投诉已解决，要关闭此投诉吗？')) return;
    try {
      await apiPost(`/complaints/${complaintId}/close`);
      setComplaints(complaints.map(c => 
        c.id === complaintId ? { ...c, status: 'closed' as const } : c
      ));
      alert('投诉已关闭');
    } catch (error: any) {
      alert(error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'service',
      title: '',
      description: '',
      appointmentId: '',
      evidenceUrls: []
    });
  };

  const getTypeLabel = (type: ComplaintType) => {
    const labels: Record<ComplaintType, string> = {
      service: '服务态度',
      medical: '医疗质量',
      billing: '费用结算',
      price: '价格问题',
      environment: '环境设施',
      other: '其他'
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: ComplaintStatus) => {
    const colors: Record<ComplaintStatus, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      assigned: 'bg-orange-100 text-orange-700',
      processing: 'bg-blue-100 text-blue-700',
      resolved: 'bg-green-100 text-green-700',
      closed: 'bg-gray-100 text-gray-700'
    };
    const labels: Record<ComplaintStatus, string> = {
      pending: '待处理',
      assigned: '已分派',
      processing: '处理中',
      resolved: '已解决',
      closed: '已关闭'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status]}`}>
        {labels[status]}
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
          <h1 className="text-2xl font-bold text-gray-800">投诉中心</h1>
          <p className="text-gray-500 mt-1">提交和处理投诉建议</p>
        </div>
        {user?.role === 'owner' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            提交投诉
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="divide-y divide-gray-50">
          {complaints.map((complaint) => (
            <div key={complaint.id} className="p-5 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-800">{complaint.title}</h3>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                      {getTypeLabel(complaint.type)}
                    </span>
                    {getStatusBadge(complaint.status)}
                  </div>
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">{complaint.description}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(complaint.createdAt).toLocaleString('zh-CN')}
                    </div>
                    {complaint.assignedToName && (
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        处理人: {complaint.assignedToName}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => {
                      setSelectedComplaint(complaint);
                      setShowDetailModal(true);
                    }}
                    className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  {user?.role === 'owner' && complaint.status === 'resolved' && (
                    <button
                      onClick={() => handleClose(complaint.id)}
                      className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors"
                    >
                      确认关闭
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {complaints.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>暂无投诉记录</p>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">提交投诉</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">投诉类型 *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as ComplaintType })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="service">服务态度</option>
                  <option value="medical">医疗质量</option>
                  <option value="price">价格问题</option>
                  <option value="environment">环境设施</option>
                  <option value="other">其他</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">关联就诊</label>
                <select
                  value={formData.appointmentId}
                  onChange={(e) => setFormData({ ...formData, appointmentId: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">不关联</option>
                  {appointments.map(apt => (
                    <option key={apt.id} value={apt.id}>
                      {apt.symptoms} - {new Date(apt.appointmentTime).toLocaleDateString('zh-CN')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">投诉标题 *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="请简要描述您的问题"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">详细描述 *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="请详细描述您遇到的问题，我们会认真对待每一条反馈"
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">上传凭证</label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">点击或拖拽上传图片凭证</p>
                  <p className="text-xs text-gray-400 mt-1">支持 JPG、PNG 格式，最多3张</p>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !formData.title || !formData.description}
                className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl font-medium transition-colors"
              >
                {submitting ? '提交中...' : '提交投诉'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedComplaint && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">投诉详情</h3>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedComplaint(null);
                  setResponseText('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="font-semibold text-gray-800 text-xl">{selectedComplaint.title}</h3>
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                  {getTypeLabel(selectedComplaint.type)}
                </span>
                {getStatusBadge(selectedComplaint.status)}
              </div>
              <p className="text-sm text-gray-500 mb-4">
                提交时间: {new Date(selectedComplaint.createdAt).toLocaleString('zh-CN')}
              </p>
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <p className="text-gray-700 whitespace-pre-wrap">{selectedComplaint.description}</p>
              </div>

              {selectedComplaint.responses && selectedComplaint.responses.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium text-gray-800 mb-3">处理记录</h4>
                  <div className="space-y-3">
                    {selectedComplaint.responses.map((resp: any, index: number) => (
                      <div key={index} className="bg-blue-50 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-blue-800">{resp.responderName}</span>
                          <span className="text-xs text-blue-600">
                            {new Date(resp.createdAt).toLocaleString('zh-CN')}
                          </span>
                        </div>
                        <p className="text-sm text-blue-700">{resp.response}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {user?.role === 'manager' && selectedComplaint.status !== 'closed' && (
                <div className="border-t border-gray-200 pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">回复投诉</label>
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="输入回复内容..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none mb-3"
                  />
                  <button
                    onClick={handleResponse}
                    disabled={!responseText.trim()}
                    className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-xl font-medium transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    发送回复
                  </button>
                </div>
              )}

              {user?.role === 'owner' && selectedComplaint.status === 'resolved' && (
                <div className="border-t border-gray-200 pt-4 flex justify-end">
                  <button
                    onClick={() => handleClose(selectedComplaint.id)}
                    className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl font-medium transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    确认关闭
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
