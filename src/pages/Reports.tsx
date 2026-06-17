import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api.js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { BarChart3, TrendingUp, Users, DollarSign, Pill, Calendar, Download, RefreshCw, Store, Coins, Percent, CreditCard } from 'lucide-react';

export default function Reports() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [satisfactionRanking, setSatisfactionRanking] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [medicineConsumption, setMedicineConsumption] = useState<any[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const loadData = async () => {
    try {
      const [dashboard, paymentSum] = await Promise.all([
        apiGet<any>('/reports/dashboard'),
        apiGet<any>(`/payments/summary/by-store?startDate=${startDate}&endDate=${endDate} 23:59:59`)
      ]);
      setDashboardData(dashboard);
      setSatisfactionRanking(dashboard?.satisfactionRanking || []);
      setRevenueData(dashboard?.revenueStats || []);
      setMedicineConsumption((dashboard?.medicineConsumption || []).slice(0, 10));
      setPaymentSummary(paymentSum);
    } catch (error) {
      console.error('加载报表数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

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
          <h1 className="text-2xl font-bold text-gray-800">数据报表</h1>
          <p className="text-gray-500 mt-1">查看门店运营数据和统计报表</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <span className="text-gray-400">至</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={loadData}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="刷新数据"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl font-medium transition-colors">
            <Download className="w-5 h-5" />
            导出报表
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">支付笔数</p>
              <p className="text-3xl font-bold text-gray-800">{paymentSummary?.overall?.orderCount || 0}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">营收总额</p>
              <p className="text-3xl font-bold text-green-600">¥{paymentSummary?.overall?.totalRevenue?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">会员折扣总额</p>
              <p className="text-3xl font-bold text-purple-600">¥{paymentSummary?.overall?.totalDiscount?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Percent className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">积分抵扣总额</p>
              <p className="text-3xl font-bold text-yellow-600">¥{paymentSummary?.overall?.totalPointsDeduction?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <Coins className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">营收趋势</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [`¥${value?.toFixed(2) || value}`, '营收']} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="营收"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">药品消耗TOP10</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={medicineConsumption} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip />
                <Bar dataKey="total_quantity" name="消耗量" fill="#10B981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">科室就诊分布</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dashboardData?.departmentStats || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {dashboardData?.departmentStats?.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">医师满意度排行</h3>
          <div className="space-y-3">
            {satisfactionRanking.map((doctor, index) => (
              <div key={doctor.doctorId} className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  index === 0 ? 'bg-yellow-100 text-yellow-700' :
                  index === 1 ? 'bg-gray-100 text-gray-700' :
                  index === 2 ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-50 text-gray-500'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-800">{doctor.doctorName}</span>
                    <span className="text-sm text-gray-600">{doctor.avgSatisfaction?.toFixed(1) || '0.0'}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all"
                      style={{ width: `${(doctor.avgSatisfaction / 5) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {doctor.appointmentCount} 单
                </div>
              </div>
            ))}
            {satisfactionRanking.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                暂无数据
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Store className="w-5 h-5 text-blue-500" />
            各门店收入排行
          </h3>
          <p className="text-sm text-gray-500">
            共 {paymentSummary?.overall?.storeCount || 0} 家门店
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">排名</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">门店名称</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">订单数</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">原价总额</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">会员折扣</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">积分抵扣</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">实际营收</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paymentSummary?.byStore?.map((store: any, index: number) => (
                <tr key={store.storeId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`w-7 h-7 rounded-full inline-flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-gray-200 text-gray-700' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{store.storeName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">{store.orderCount} 单</td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">¥{store.totalOriginal?.toFixed(2) || '0.00'}</td>
                  <td className="px-4 py-3 text-sm text-purple-600 text-right">-¥{store.totalDiscount?.toFixed(2) || '0.00'}</td>
                  <td className="px-4 py-3 text-sm text-blue-600 text-right">-¥{store.totalPointsDeduction?.toFixed(2) || '0.00'}</td>
                  <td className="px-4 py-3 text-sm font-bold text-green-600 text-right">¥{store.totalRevenue?.toFixed(2) || '0.00'}</td>
                </tr>
              ))}
              {(!paymentSummary?.byStore || paymentSummary.byStore.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">定时报表记录</h3>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            系统每天凌晨 1:00 自动生成
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">报表名称</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">类型</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">统计周期</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">生成时间</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {dashboardData?.recentReports?.map((report: any) => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-800">{report.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      report.type === 'daily' ? 'bg-blue-100 text-blue-700' :
                      report.type === 'weekly' ? 'bg-green-100 text-green-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {report.type === 'daily' ? '日报' : report.type === 'weekly' ? '周报' : '月报'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{report.period}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(report.createdAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-blue-500 hover:text-blue-600 text-sm flex items-center gap-1 ml-auto">
                      <Download className="w-4 h-4" />
                      下载
                    </button>
                  </td>
                </tr>
              ))}
              {!dashboardData?.recentReports?.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    暂无报表记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
