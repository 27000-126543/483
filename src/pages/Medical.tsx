import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut } from '../lib/api.js';
import { Appointment, MedicalRecord, Prescription, Medicine, PrescriptionStatus } from '../../shared/types.js';
import { useAuthStore } from '../store/authStore.js';
import { FileText, Plus, X, Pill, AlertTriangle, Check, Clock, User, Calendar, RefreshCw, CalendarClock, AlertCircle, Edit2, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PrescriptionItem {
  medicineId: string;
  quantity: number;
  dosage: string;
  frequency: string;
  duration: string;
}

interface MedicalRecordWithDetails extends MedicalRecord {
  doctorName?: string;
  petName?: string;
  petId?: string;
  prescription?: Prescription & { items: any[] };
}

export default function Medical() {
  const user = useAuthStore(state => state.user);
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecordWithDetails[]>([]);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecordWithDetails | null>(null);
  const [showFollowUpEdit, setShowFollowUpEdit] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({ date: '', notes: '' });
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockCheck, setStockCheck] = useState<{ available: boolean; substitutes: Medicine[] } | null>( null);

  const [recordForm, setRecordForm] = useState({
    diagnosis: '',
    treatment: '',
    notes: ''
  });

  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItem[]>([]);
  const [newItem, setNewItem] = useState<PrescriptionItem>({
    medicineId: '',
    quantity: 1,
    dosage: '',
    frequency: '',
    duration: ''
  });

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [appointmentsData, recordsData, medicinesData] = await Promise.all([
        apiGet<Appointment[]>('/appointments'),
        apiGet<MedicalRecordWithDetails[]>('/medical/records'),
        apiGet<Medicine[]>('/pharmacy/medicines')
      ]);
      const filteredAppointments = user?.role === 'doctor'
        ? appointmentsData.filter(a => a.status === 'in_progress' || a.status === 'completed')
        : appointmentsData.filter(a => a.status === 'completed');
      setAppointments(filteredAppointments);
      setMedicalRecords(recordsData);
      setMedicines(medicinesData);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    if (!newItem.medicineId || !newItem.quantity || !newItem.dosage || !newItem.frequency || !newItem.duration) {
      alert('请填写完整的药品信息');
      return;
    }
    setPrescriptionItems([...prescriptionItems, { ...newItem }]);
    setNewItem({ medicineId: '', quantity: 1, dosage: '', frequency: '', duration: '' });
    setStockCheck(null);
  };

  const handleRemoveItem = (index: number) => {
    setPrescriptionItems(prescriptionItems.filter((_, i) => i !== index));
  };

  const checkStock = async (medicineId: string, quantity: number) => {
    try {
      const result = await apiPost<{ available: boolean; substitutes: Medicine[] }>('/medical/check-stock', {
        medicineId,
        quantity
      });
      setStockCheck(result);
    } catch (error) {
      console.error('库存检查失败:', error);
    }
  };

  const handleMedicineChange = (medicineId: string) => {
    setNewItem({ ...newItem, medicineId });
    if (medicineId && newItem.quantity > 0) {
      checkStock(medicineId, newItem.quantity);
    }
  };

  const handleQuantityChange = (quantity: number) => {
    setNewItem({ ...newItem, quantity });
    if (newItem.medicineId && quantity > 0) {
      checkStock(newItem.medicineId, quantity);
    }
  };

  const handleSubmit = async () => {
    if (!selectedAppointment) return;
    if (!recordForm.diagnosis) {
      alert('请填写诊断结果');
      return;
    }

    try {
      const result = await apiPost('/medical/records', {
        appointmentId: selectedAppointment.id,
        diagnosis: recordForm.diagnosis,
        treatment: recordForm.treatment,
        notes: recordForm.notes,
        items: prescriptionItems
      });

      alert('病历和处方已提交');
      setShowRecordModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const resetForm = () => {
    setRecordForm({ diagnosis: '', treatment: '', notes: '' });
    setPrescriptionItems([]);
    setNewItem({ medicineId: '', quantity: 1, dosage: '', frequency: '', duration: '' });
    setSelectedAppointment(null);
    setStockCheck(null);
  };

  const handleFollowUpEdit = (record: MedicalRecordWithDetails) => {
    setSelectedRecord(record);
    setFollowUpForm({
      date: record.followUpDate || '',
      notes: record.followUpNotes || ''
    });
    setShowFollowUpEdit(true);
  };

  const handleSaveFollowUp = async () => {
    if (!selectedRecord) return;
    try {
      await apiPut(`/medical/records/${selectedRecord.id}/follow-up`, {
        followUpDate: followUpForm.date || null,
        followUpNotes: followUpForm.notes
      });
      alert('复诊信息已保存');
      setShowFollowUpEdit(false);
      loadData();
    } catch (error: any) {
      alert(error.message || '保存失败');
    }
  };

  const handleReorder = (record: MedicalRecordWithDetails) => {
    navigate('/appointments/new', {
      state: {
        petId: record.petId,
        petName: record.petName,
        storeId: selectedAppointment?.storeId,
        symptoms: record.diagnosis,
        isFollowUp: true,
        fromRecordId: record.id
      }
    });
  };

  const getFollowUpStatus = (record: MedicalRecordWithDetails) => {
    if (!record.followUpDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fuDate = new Date(record.followUpDate);
    fuDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((fuDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { text: '已过期', color: 'bg-gray-100 text-gray-500' };
    if (diffDays === 0) return { text: '今天复诊', color: 'bg-red-100 text-red-600' };
    if (diffDays <= 3) return { text: `${diffDays}天后复诊`, color: 'bg-orange-100 text-orange-600' };
    return { text: `${diffDays}天后复诊`, color: 'bg-blue-100 text-blue-600' };
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

  const getPrescriptionStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      confirmed: 'bg-blue-100 text-blue-700',
      dispensed: 'bg-green-100 text-green-700',
      cancelled: 'bg-gray-100 text-gray-700'
    };
    const labels: Record<string, string> = {
      pending: '待审核',
      confirmed: '已审核',
      dispensed: '已配药',
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
          <h1 className="text-2xl font-bold text-gray-800">病历与处方</h1>
          <p className="text-gray-500 mt-1">管理电子病历和处方信息</p>
        </div>
      </div>

      {user?.role === 'doctor' && appointments.filter(a => a.status === 'in_progress').length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">待处理就诊</h2>
          <div className="grid gap-4">
            {appointments.filter(a => a.status === 'in_progress').map((apt) => (
              <div key={apt.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-800">{apt.symptoms}</h3>
                      {getStatusBadge(apt.status)}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {new Date(apt.appointmentTime).toLocaleString('zh-CN')}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedAppointment(apt);
                      setShowRecordModal(true);
                    }}
                    className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-medium transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    录入病历
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">病历记录</h2>
        {user?.role === 'owner' ? (
          Object.entries(
            medicalRecords.reduce((groups: Record<string, MedicalRecordWithDetails[]>, record) => {
              const key = record.petId || 'unknown';
              if (!groups[key]) groups[key] = [];
              groups[key].push(record);
              return groups;
            }, {})
          ).map(([petId, records]) => (
            <div key={petId} className="mb-6">
              <h3 className="text-md font-semibold text-blue-700 mb-3 flex items-center gap-2">
                <Pill className="w-4 h-4" />
                {records[0]?.petName || '宠物'}
              </h3>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="divide-y divide-gray-50">
                  {records.map((record) => {
                    const fuStatus = getFollowUpStatus(record);
                    return (
                    <div key={record.id} className="p-5 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-gray-800">诊断: {record.diagnosis}</h3>
                            {fuStatus && (
                              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${fuStatus.color}`}>
                                {fuStatus.text}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mb-1">
                            {new Date(record.createdAt).toLocaleString('zh-CN')}
                          </p>
                          {record.doctorName && (
                            <p className="text-sm text-gray-500">主治医师: {record.doctorName}</p>
                          )}
                          {record.treatment && (
                            <p className="text-sm text-gray-600">治疗方案: {record.treatment}</p>
                          )}
                          {record.notes && (
                            <p className="text-sm text-gray-500 mt-1">备注: {record.notes}</p>
                          )}
                          {record.followUpDate && (
                            <div className="mt-2 flex items-start gap-1.5 text-sm">
                              <CalendarClock className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-gray-600">建议复诊：{new Date(record.followUpDate).toLocaleDateString('zh-CN')}</span>
                                {record.followUpNotes && (
                                  <p className="text-gray-500 text-xs mt-0.5">{record.followUpNotes}</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      {record.prescription && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-sm font-medium text-gray-700">处方信息</p>
                            {getPrescriptionStatusBadge(record.prescription.status)}
                          </div>
                          {record.prescription.items && record.prescription.items.length > 0 && (
                            <div className="space-y-1">
                              {record.prescription.items.map((item: any, index: number) => (
                                <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                                  <Pill className="w-3 h-3 text-blue-500" />
                                  <span>{item.medicine?.name || '药品'} - {item.quantity}份</span>
                                  {item.dosage && <span className="text-gray-400">|</span>}
                                  {item.dosage && <span className="text-gray-500">{item.dosage}</span>}
                                  {item.frequency && <span className="text-gray-500">{item.frequency}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {record.followUpDate && (
                        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                          <button
                            onClick={() => handleReorder(record)}
                            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            <RefreshCw className="w-4 h-4" />
                            一键复诊预约
                          </button>
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="divide-y divide-gray-50">
              {medicalRecords.map((record) => {
                const fuStatus = getFollowUpStatus(record);
                return (
                <div key={record.id} className="p-5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-800">诊断: {record.diagnosis}</h3>
                        {fuStatus && (
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${fuStatus.color}`}>
                            {fuStatus.text}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mb-2">
                        {new Date(record.createdAt).toLocaleString('zh-CN')}
                      </p>
                      {record.treatment && (
                        <p className="text-sm text-gray-600">治疗方案: {record.treatment}</p>
                      )}
                      {record.notes && (
                        <p className="text-sm text-gray-500 mt-1">备注: {record.notes}</p>
                      )}
                      {record.followUpDate && (
                        <div className="mt-2 flex items-start gap-1.5 text-sm">
                          <CalendarClock className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-gray-600">建议复诊：{new Date(record.followUpDate).toLocaleDateString('zh-CN')}</span>
                            {record.followUpNotes && (
                              <p className="text-gray-500 text-xs mt-0.5">{record.followUpNotes}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {user?.role === 'doctor' && (
                      <button
                        onClick={() => handleFollowUpEdit(record)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                      >
                        <Edit2 className="w-4 h-4" />
                        设置复诊
                      </button>
                    )}
                  </div>
                  {record.prescription && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-sm font-medium text-gray-700">处方信息</p>
                        {getPrescriptionStatusBadge(record.prescription.status)}
                      </div>
                      {record.prescription.items && record.prescription.items.length > 0 && (
                        <div className="space-y-1">
                          {record.prescription.items.map((item: any, index: number) => (
                            <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                              <Pill className="w-3 h-3 text-blue-500" />
                              <span>{item.medicine?.name || '药品'} - {item.quantity}份</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )})}
              {medicalRecords.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>暂无病历记录</p>
                </div>
              )}
            </div>
          </div>
        )}
        {user?.role === 'owner' && medicalRecords.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>暂无病历记录</p>
          </div>
        )}
      </div>

      {showRecordModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">录入电子病历</h3>
              <button
                onClick={() => {
                  setShowRecordModal(false);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-blue-800 font-medium">预约信息</p>
                <p className="text-sm text-blue-600 mt-1">症状: {selectedAppointment.symptoms}</p>
                <p className="text-sm text-blue-600">
                  时间: {new Date(selectedAppointment.appointmentTime).toLocaleString('zh-CN')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">诊断结果 *</label>
                <textarea
                  value={recordForm.diagnosis}
                  onChange={(e) => setRecordForm({ ...recordForm, diagnosis: e.target.value })}
                  placeholder="请输入诊断结果"
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">治疗方案</label>
                <textarea
                  value={recordForm.treatment}
                  onChange={(e) => setRecordForm({ ...recordForm, treatment: e.target.value })}
                  placeholder="请输入治疗方案"
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={recordForm.notes}
                  onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
                  placeholder="其他备注信息"
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">开具处方</label>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">药品</label>
                      <select
                        value={newItem.medicineId}
                        onChange={(e) => handleMedicineChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      >
                        <option value="">选择药品</option>
                        {medicines.map(med => (
                          <option key={med.id} value={med.id}>
                            {med.name} ({med.specification})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">数量</label>
                      <input
                        type="number"
                        min="1"
                        value={newItem.quantity}
                        onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">用量</label>
                      <input
                        type="text"
                        value={newItem.dosage}
                        onChange={(e) => setNewItem({ ...newItem, dosage: e.target.value })}
                        placeholder="如：1片"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">频次</label>
                      <input
                        type="text"
                        value={newItem.frequency}
                        onChange={(e) => setNewItem({ ...newItem, frequency: e.target.value })}
                        placeholder="如：每日3次"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">疗程</label>
                      <input
                        type="text"
                        value={newItem.duration}
                        onChange={(e) => setNewItem({ ...newItem, duration: e.target.value })}
                        placeholder="如：7天"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
                      >
                        添加药品
                      </button>
                    </div>
                  </div>

                  {stockCheck && !stockCheck.available && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-orange-700 text-sm mb-2">
                        <AlertTriangle className="w-4 h-4" />
                        库存不足，推荐以下替代药品：
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {stockCheck.substitutes.map(sub => (
                          <button
                            key={sub.id}
                            onClick={() => handleMedicineChange(sub.id)}
                            className="px-3 py-1 bg-white border border-orange-300 text-orange-700 rounded-full text-xs hover:bg-orange-100 transition-colors"
                          >
                            {sub.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {prescriptionItems.length > 0 && (
                    <div className="border-t border-gray-200 pt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">处方药品列表</p>
                      <div className="space-y-2">
                        {prescriptionItems.map((item, index) => {
                          const med = medicines.find(m => m.id === item.medicineId);
                          return (
                            <div key={index} className="flex items-center justify-between bg-white rounded-lg p-3">
                              <div>
                                <p className="text-sm font-medium text-gray-800">
                                  {med?.name} ({med?.specification})
                                </p>
                                <p className="text-xs text-gray-500">
                                  {item.quantity}份 · {item.dosage} · {item.frequency} · {item.duration}
                                </p>
                              </div>
                              <button
                                onClick={() => handleRemoveItem(index)}
                                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setShowRecordModal(false);
                  resetForm();
                }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={!recordForm.diagnosis}
                className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl font-medium transition-colors"
              >
                提交病历与处方
              </button>
            </div>
          </div>
        </div>
      )}

      {showFollowUpEdit && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">设置复诊提醒</h3>
              <button
                onClick={() => setShowFollowUpEdit(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">建议复诊日期</label>
                <input
                  type="date"
                  value={followUpForm.date}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, date: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">注意事项</label>
                <textarea
                  value={followUpForm.notes}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, notes: e.target.value })}
                  placeholder="请输入复诊注意事项，如：按时服药、注意饮食、避免剧烈运动等"
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {followUpForm.date && (
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-700">
                      <p className="font-medium">系统将自动提醒主人</p>
                      <p className="text-blue-600/80 mt-1">
                        复诊日期前3天内系统会自动发送消息提醒宠物主人按时复诊。
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowFollowUpEdit(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveFollowUp}
                className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                保存设置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getPrescriptionStatusBadge(status: PrescriptionStatus) {
  const config: Record<PrescriptionStatus, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '待确认' },
    confirmed: { bg: 'bg-blue-100', text: 'text-blue-700', label: '已确认' },
    reviewed: { bg: 'bg-purple-100', text: 'text-purple-700', label: '已审核' },
    dispensed: { bg: 'bg-green-100', text: 'text-green-700', label: '已配药' },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-700', label: '已取消' }
  };
  const cfg = config[status] || config.pending;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function PrescriptionDetails({ prescriptionId }: { prescriptionId: string }) {
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    loadPrescription();
  }, [prescriptionId]);

  const loadPrescription = async () => {
    try {
      const [prescriptionData, itemsData] = await Promise.all([
        apiGet<Prescription>(`/medical/prescriptions/${prescriptionId}`),
        apiGet<any[]>(`/medical/prescriptions/${prescriptionId}/items`)
      ]);
      setPrescription(prescriptionData);
      setItems(itemsData);
    } catch (error) {
      console.error('加载处方失败:', error);
    }
  };

  if (!prescription) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm text-gray-500">处方状态:</span>
        {getPrescriptionStatusBadge(prescription.status)}
      </div>
      {items.length > 0 && (
        <div className="space-y-1">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
              <Pill className="w-3 h-3 text-blue-500" />
              <span>{item.medicineName} - {item.quantity}份</span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-500">{item.dosage} {item.frequency} {item.duration}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
