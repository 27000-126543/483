import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../lib/api.js';
import { Prescription, Inventory, Medicine } from '../../shared/types.js';
import { useAuthStore } from '../store/authStore.js';
import { Pill, Check, X, Package, AlertTriangle, QrCode, Search, Clock, User, FileText } from 'lucide-react';

export default function Pharmacy() {
  const user = useAuthStore(state => state.user);
  const [pendingPrescriptions, setPendingPrescriptions] = useState<any[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDispenseModal, setShowDispenseModal] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null);
  const [dispenseCode, setDispenseCode] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'prescriptions' | 'inventory'>('prescriptions');

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [prescriptionsData, inventoryData, medicinesData] = await Promise.all([
        apiGet<any[]>('/pharmacy/prescriptions/pending'),
        apiGet<Inventory[]>('/pharmacy/inventory'),
        apiGet<Medicine[]>('/pharmacy/medicines')
      ]);
      setPendingPrescriptions(prescriptionsData);
      setInventory(inventoryData);
      setMedicines(medicinesData);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (prescriptionId: string) => {
    if (!confirm('确定审核通过此处方？')) return;
    try {
      await apiPost(`/pharmacy/prescriptions/${prescriptionId}/approve`);
      setPendingPrescriptions(pendingPrescriptions.filter(p => p.id !== prescriptionId));
      alert('处方审核通过，已通知主人');
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleReject = async (prescriptionId: string) => {
    const reason = prompt('请输入拒绝原因：');
    if (!reason) return;
    try {
      await apiPost(`/pharmacy/prescriptions/${prescriptionId}/reject`, { reason });
      setPendingPrescriptions(pendingPrescriptions.filter(p => p.id !== prescriptionId));
      alert('处方已拒绝');
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDispense = async (prescription: any) => {
    setSelectedPrescription(prescription);
    try {
      const result = await apiPost<{ pickupCode: string; qrCode: string }>(`/pharmacy/prescriptions/${prescription.id}/dispense`);
      setDispenseCode(result.pickupCode);
      setQrCode(result.qrCode);
      setShowDispenseModal(true);
      loadData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const filteredInventory = inventory.filter(item => {
    const med = medicines.find(m => m.id === item.medicineId);
    if (!med) return false;
    const searchLower = searchTerm.toLowerCase();
    return med.name.toLowerCase().includes(searchLower) || 
           med.category.toLowerCase().includes(searchLower) ||
           med.specification.toLowerCase().includes(searchLower);
  });

  const lowStockItems = inventory.filter(item => item.quantity <= item.minStock);

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
          <h1 className="text-2xl font-bold text-gray-800">药房管理</h1>
          <p className="text-gray-500 mt-1">处方审核与药品库存管理</p>
        </div>
        {lowStockItems.length > 0 && (
          <div className="flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-medium">{lowStockItems.length} 种药品库存预警</span>
          </div>
        )}
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('prescriptions')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
            activeTab === 'prescriptions'
              ? 'bg-blue-500 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          <FileText className="w-5 h-5" />
          待审核处方
          {pendingPrescriptions.length > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
              {pendingPrescriptions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
            activeTab === 'inventory'
              ? 'bg-blue-500 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          <Package className="w-5 h-5" />
          库存管理
        </button>
      </div>

      {activeTab === 'prescriptions' && (
        <div className="space-y-4">
          {pendingPrescriptions.map((prescription) => (
            <div key={prescription.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-800">处方 #{prescription.id.slice(-8)}</h3>
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                      待审核
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {prescription.ownerName}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {new Date(prescription.createdAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(prescription.id)}
                    className="flex items-center gap-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    审核通过
                  </button>
                  <button
                    onClick={() => handleReject(prescription.id)}
                    className="flex items-center gap-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                    拒绝
                  </button>
                  <button
                    onClick={() => handleDispense(prescription)}
                    className="flex items-center gap-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
                  >
                    <QrCode className="w-4 h-4" />
                    扫码配药
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">处方药品</p>
                <div className="space-y-2">
                  {prescription.items?.map((item: any, index: number) => {
                    const med = medicines.find(m => m.id === item.medicineId);
                    const inv = inventory.find(i => i.medicineId === item.medicineId);
                    const isLow = inv && inv.quantity < item.quantity;
                    return (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Pill className="w-4 h-4 text-blue-500" />
                          <span className="text-sm text-gray-800">
                            {med?.name} ({med?.specification})
                          </span>
                          <span className="text-sm text-gray-500">x{item.quantity}</span>
                        </div>
                        {isLow && (
                          <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                            库存不足
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {prescription.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-500">医师备注: {prescription.notes}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
          {pendingPrescriptions.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <Pill className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">暂无待审核处方</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'inventory' && (
        <div>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索药品名称、分类、规格..."
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">药品名称</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">分类</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">规格</th>
                  <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">库存</th>
                  <th className="text-center px-6 py-4 text-sm font-medium text-gray-500">最低库存</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-gray-500">单价</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredInventory.map((item) => {
                  const med = medicines.find(m => m.id === item.medicineId);
                  if (!med) return null;
                  const isLow = item.quantity <= item.minStock;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Pill className={`w-4 h-4 ${isLow ? 'text-orange-500' : 'text-blue-500'}`} />
                          <span className="font-medium text-gray-800">{med.name}</span>
                          {isLow && (
                            <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                              预警
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{med.category}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{med.specification}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`font-medium ${isLow ? 'text-orange-600' : 'text-gray-800'}`}>
                          {item.quantity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-500">{item.minStock}</td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-gray-800">
                        ¥{med.price.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredInventory.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>未找到匹配的药品</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showDispenseModal && selectedPrescription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">取药码已生成</h3>
            <p className="text-sm text-gray-500 mb-4">已推送取药通知给主人</p>
            <div className="bg-white p-4 rounded-xl mb-4">
              <img src={qrCode} alt="取药码" className="w-48 h-48 mx-auto" />
            </div>
            <p className="text-2xl font-mono font-bold text-gray-800 mb-2">
              {dispenseCode}
            </p>
            <div className="text-sm text-gray-500 mb-4">
              <p>处方 #{selectedPrescription.id.slice(-8)}</p>
            </div>
            <button
              onClick={() => {
                setShowDispenseModal(false);
                setSelectedPrescription(null);
              }}
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
