import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api.js';
import { Pet } from '../../shared/types.js';
import { Plus, Edit2, Trash2, X, Cat, Dog, Bird, Fish, Rabbit, Calendar, Weight } from 'lucide-react';

const speciesIcons: Record<string, React.ReactNode> = {
  犬: <Dog className="w-6 h-6" />,
  猫: <Cat className="w-6 h-6" />,
  鸟: <Bird className="w-6 h-6" />,
  鱼: <Fish className="w-6 h-6" />,
  兔: <Rabbit className="w-6 h-6" />
};

export default function Pets() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    species: '犬',
    breed: '',
    gender: 'male' as 'male' | 'female',
    birthday: '',
    weight: '',
    allergies: '',
    notes: ''
  });

  useEffect(() => {
    loadPets();
  }, []);

  const loadPets = async () => {
    try {
      const data = await apiGet<Pet[]>('/pets');
      setPets(data);
    } catch (error) {
      console.error('加载宠物列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.species || !formData.breed) {
      alert('请填写必填项');
      return;
    }

    try {
      if (editingPet) {
        const updated = await apiPut<Pet>(`/pets/${editingPet.id}`, formData);
        setPets(pets.map(p => p.id === editingPet.id ? updated : p));
      } else {
        const newPet = await apiPost<Pet>('/pets', formData);
        setPets([newPet, ...pets]);
      }
      setShowModal(false);
      resetForm();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这只宠物的信息吗？')) return;
    try {
      await apiDelete(`/pets/${id}`);
      setPets(pets.filter(p => p.id !== id));
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleEdit = (pet: Pet) => {
    setEditingPet(pet);
    setFormData({
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      gender: (pet.gender as 'male' | 'female') || 'male',
      birthday: pet.birthday || '',
      weight: pet.weight?.toString() || '',
      allergies: pet.allergies || '',
      notes: pet.notes || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      species: '犬',
      breed: '',
      gender: 'male',
      birthday: '',
      weight: '',
      allergies: '',
      notes: ''
    });
    setEditingPet(null);
  };

  const calculateAge = (birthday: string) => {
    const birth = new Date(birthday);
    const now = new Date();
    const diff = now.getFullYear() - birth.getFullYear();
    return diff > 0 ? `${diff}岁` : `${Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 30))}个月`;
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
          <h1 className="text-2xl font-bold text-gray-800">我的宠物</h1>
          <p className="text-gray-500 mt-1">共 {pets.length} 只宠物</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          添加宠物
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pets.map((pet) => (
          <div key={pet.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                    {speciesIcons[pet.species] || <Cat className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-lg">{pet.name}</h3>
                    <p className="text-sm text-gray-500">{pet.species} · {pet.breed}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  pet.gender === 'male' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'
                }`}>
                  {pet.gender === 'male' ? '公' : '母'}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                {pet.birthday && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Calendar className="w-4 h-4" />
                    {calculateAge(pet.birthday)}
                  </div>
                )}
                {pet.weight && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Weight className="w-4 h-4" />
                    {pet.weight} kg
                  </div>
                )}
                {pet.allergies && (
                  <div className="text-orange-600 bg-orange-50 px-2 py-1 rounded-lg text-xs">
                    过敏: {pet.allergies}
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => handleEdit(pet)}
                className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                title="编辑"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(pet.id)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="删除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {pets.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Cat className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-800 mb-2">还没有添加宠物</h3>
          <p className="text-gray-500 mb-4">添加您的宠物信息，方便预约和就诊</p>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            添加第一只宠物
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                {editingPet ? '编辑宠物信息' : '添加宠物'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">宠物名称 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="请输入宠物名称"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">物种 *</label>
                  <select
                    value={formData.species}
                    onChange={(e) => setFormData({ ...formData, species: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="犬">犬</option>
                    <option value="猫">猫</option>
                    <option value="鸟">鸟</option>
                    <option value="鱼">鱼</option>
                    <option value="兔">兔</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">品种 *</label>
                  <input
                    type="text"
                    value={formData.breed}
                    onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                    placeholder="如：金毛、英短"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">性别</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'male' | 'female' })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="male">公</option>
                    <option value="female">母</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">生日</label>
                  <input
                    type="date"
                    value={formData.birthday}
                    onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">体重 (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    placeholder="如：5.5"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">过敏史</label>
                <input
                  type="text"
                  value={formData.allergies}
                  onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                  placeholder="如：青霉素、花粉"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="其他需要说明的信息"
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.name || !formData.species || !formData.breed}
                className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl font-medium transition-colors"
              >
                {editingPet ? '保存修改' : '添加宠物'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
