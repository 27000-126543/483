import { getDatabase, executeQuery, fetchOne, saveDatabase } from './database.js';
import bcrypt from 'bcryptjs';

export function createTables(): void {
  const db = getDatabase();

  db.run(`
    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner', 'doctor', 'pharmacist', 'manager', 'admin')),
      store_id TEXT,
      member_level INTEGER DEFAULT 1,
      member_points INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      keywords TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS doctor_specialties (
      id TEXT PRIMARY KEY,
      doctor_id TEXT NOT NULL,
      department_id TEXT NOT NULL,
      keywords TEXT,
      rating REAL DEFAULT 5,
      FOREIGN KEY (doctor_id) REFERENCES users(id),
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pets (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      species TEXT NOT NULL,
      breed TEXT,
      age INTEGER,
      weight REAL,
      gender TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      pet_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      doctor_id TEXT,
      department TEXT NOT NULL,
      symptoms TEXT NOT NULL,
      appointment_code TEXT UNIQUE NOT NULL,
      appointment_time DATETIME NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
      satisfaction INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id),
      FOREIGN KEY (pet_id) REFERENCES pets(id),
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (doctor_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS medical_records (
      id TEXT PRIMARY KEY,
      appointment_id TEXT NOT NULL,
      doctor_id TEXT NOT NULL,
      diagnosis TEXT NOT NULL,
      treatment TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id),
      FOREIGN KEY (doctor_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS medicines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      specification TEXT,
      manufacturer TEXT,
      price DECIMAL(10, 2) NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS prescriptions (
      id TEXT PRIMARY KEY,
      medical_record_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'reviewed', 'dispensed', 'cancelled')),
      need_confirmation BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (medical_record_id) REFERENCES medical_records(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS prescription_items (
      id TEXT PRIMARY KEY,
      prescription_id TEXT NOT NULL,
      medicine_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      dosage TEXT,
      frequency TEXT,
      is_substitute BOOLEAN DEFAULT 0,
      original_medicine_id TEXT,
      FOREIGN KEY (prescription_id) REFERENCES prescriptions(id),
      FOREIGN KEY (medicine_id) REFERENCES medicines(id),
      FOREIGN KEY (original_medicine_id) REFERENCES medicines(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      medicine_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      min_stock INTEGER NOT NULL DEFAULT 10,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (medicine_id) REFERENCES medicines(id),
      UNIQUE(store_id, medicine_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS dispense_records (
      id TEXT PRIMARY KEY,
      prescription_id TEXT NOT NULL,
      pharmacist_id TEXT NOT NULL,
      pickup_code TEXT UNIQUE NOT NULL,
      dispensed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (prescription_id) REFERENCES prescriptions(id),
      FOREIGN KEY (pharmacist_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      appointment_id TEXT NOT NULL,
      original_amount DECIMAL(10, 2) NOT NULL,
      member_discount DECIMAL(10, 2) NOT NULL DEFAULT 0,
      points_deduction DECIMAL(10, 2) NOT NULL DEFAULT 0,
      final_amount DECIMAL(10, 2) NOT NULL,
      payment_method TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'refunded')),
      paid_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS member_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      payment_id TEXT,
      type TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'adjust')),
      points_change INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (payment_id) REFERENCES payments(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS complaints (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      manager_id TEXT,
      type TEXT NOT NULL CHECK (type IN ('service', 'medical', 'billing', 'other')),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      evidence_urls TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'processing', 'resolved', 'closed')),
      satisfaction INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id),
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (manager_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS complaint_responses (
      id TEXT PRIMARY KEY,
      complaint_id TEXT NOT NULL,
      responder_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id),
      FOREIGN KEY (responder_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      related_id TEXT,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      store_id TEXT,
      type TEXT NOT NULL,
      period TEXT NOT NULL,
      report_date DATE NOT NULL,
      file_url TEXT,
      data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_appointments_owner ON appointments(owner_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_appointments_store ON appointments(store_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_appointments_time ON appointments(appointment_time)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id, is_read)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_complaints_store ON complaints(store_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_inventory_store_medicine ON inventory(store_id, medicine_id)`);

  saveDatabase();
}

export function seedData(): void {
  const db = getDatabase();

  const storeCheck = fetchOne('SELECT COUNT(*) as count FROM stores');
  if (storeCheck && storeCheck.count > 0) {
    return;
  }

  const stores = [
    { id: 'store-001', name: '爱宠医院(总部)', address: '北京市朝阳区建国路88号', phone: '010-88888888' },
    { id: 'store-002', name: '爱宠医院(海淀分院)', address: '北京市海淀区中关村大街1号', phone: '010-66666666' },
    { id: 'store-003', name: '爱宠医院(西城分院)', address: '北京市西城区金融街15号', phone: '010-77777777' }
  ];

  stores.forEach(store => {
    db.run(
      'INSERT INTO stores (id, name, address, phone) VALUES (?, ?, ?, ?)',
      [store.id, store.name, store.address, store.phone]
    );
  });

  const departments = [
    { id: 'dept-001', name: '内科', keywords: '发烧,呕吐,腹泻,咳嗽,呼吸困难,食欲不振,精神萎靡,腹痛,腹胀,便秘,尿频,尿急,尿痛,水肿,黄疸,贫血,体重下降,多饮多尿,抽搐,癫痫,瘫痪', description: '诊治宠物内科疾病' },
    { id: 'dept-002', name: '外科', keywords: '外伤,骨折,脱臼,扭伤,伤口,出血,肿胀,疼痛,跛行,无法站立,异物,肿瘤,肿块,疝气,肛门腺,指甲断裂', description: '诊治宠物外科疾病' },
    { id: 'dept-003', name: '皮肤科', keywords: '瘙痒,脱毛,皮屑,红斑,丘疹,脓疱,结痂,皮肤增厚,色素沉着,异位性皮炎,真菌感染,细菌感染,寄生虫,过敏,湿疹,荨麻疹', description: '诊治宠物皮肤疾病' },
    { id: 'dept-004', name: '眼科', keywords: '眼睛红肿,流泪,眼屎,视力下降,失明,白内障,青光眼,结膜炎,角膜炎,角膜溃疡,眼睑内翻,眼睑外翻,第三眼睑突出', description: '诊治宠物眼科疾病' },
    { id: 'dept-005', name: '口腔科', keywords: '口臭,牙结石,牙龈炎,牙周炎,牙齿松动,拔牙,口腔溃疡,口腔肿瘤,流口水,进食困难,咀嚼疼痛', description: '诊治宠物口腔疾病' },
    { id: 'dept-006', name: '产科', keywords: '怀孕,分娩,难产,流产,假孕,乳腺炎,子宫蓄脓,阴道分泌物,发情异常,不孕不育,剖腹产', description: '诊治宠物产科疾病' },
    { id: 'dept-007', name: '急诊科', keywords: '急救,中毒,休克,车祸,摔伤,溺水,触电,中暑,冻伤,窒息,异物卡喉,大出血,昏迷,抽搐急性发作', description: '24小时急诊服务' }
  ];

  departments.forEach(dept => {
    db.run(
      'INSERT INTO departments (id, name, keywords, description) VALUES (?, ?, ?, ?)',
      [dept.id, dept.name, dept.keywords, dept.description]
    );
  });

  const passwordHash = bcrypt.hashSync('123456', 10);

  const users = [
    { id: 'user-001', name: '张小明', phone: '13800138001', passwordHash, role: 'owner', memberLevel: 2, memberPoints: 580 },
    { id: 'user-002', name: '李小红', phone: '13800138002', passwordHash, role: 'owner', memberLevel: 3, memberPoints: 1250 },
    { id: 'user-003', name: '王医生', phone: '13900139001', passwordHash, role: 'doctor', storeId: 'store-001' },
    { id: 'user-004', name: '刘医生', phone: '13900139002', passwordHash, role: 'doctor', storeId: 'store-001' },
    { id: 'user-005', name: '陈医生', phone: '13900139003', passwordHash, role: 'doctor', storeId: 'store-002' },
    { id: 'user-006', name: '赵药师', phone: '13700137001', passwordHash, role: 'pharmacist', storeId: 'store-001' },
    { id: 'user-007', name: '孙药师', phone: '13700137002', passwordHash, role: 'pharmacist', storeId: 'store-002' },
    { id: 'user-008', name: '周店长', phone: '13600136001', passwordHash, role: 'manager', storeId: 'store-001' },
    { id: 'user-009', name: '吴店长', phone: '13600136002', passwordHash, role: 'manager', storeId: 'store-002' },
    { id: 'user-010', name: '管理员', phone: '13500135001', passwordHash, role: 'admin' }
  ];

  users.forEach(user => {
    db.run(
      'INSERT INTO users (id, name, phone, password_hash, role, store_id, member_level, member_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [user.id, user.name, user.phone, user.passwordHash, user.role, user.storeId || null, user.memberLevel || 1, user.memberPoints || 0]
    );
  });

  const specialties = [
    { id: 'spec-001', doctorId: 'user-003', departmentId: 'dept-001', keywords: '消化内科,呼吸内科,心血管内科', rating: 4.8 },
    { id: 'spec-002', doctorId: 'user-003', departmentId: 'dept-007', keywords: '急诊急救,中毒救治', rating: 4.8 },
    { id: 'spec-003', doctorId: 'user-004', departmentId: 'dept-002', keywords: '骨科手术,软组织手术,肿瘤外科', rating: 4.9 },
    { id: 'spec-004', doctorId: 'user-004', departmentId: 'dept-003', keywords: '皮肤病诊治,过敏性疾病', rating: 4.9 },
    { id: 'spec-005', doctorId: 'user-005', departmentId: 'dept-004', keywords: '眼科手术,白内障,青光眼', rating: 4.7 },
    { id: 'spec-006', doctorId: 'user-005', departmentId: 'dept-005', keywords: '口腔科,牙科疾病', rating: 4.7 }
  ];

  specialties.forEach(spec => {
    db.run(
      'INSERT INTO doctor_specialties (id, doctor_id, department_id, keywords, rating) VALUES (?, ?, ?, ?, ?)',
      [spec.id, spec.doctorId, spec.departmentId, spec.keywords, spec.rating]
    );
  });

  const pets = [
    { id: 'pet-001', ownerId: 'user-001', name: '豆豆', species: '犬', breed: '金毛寻回犬', age: 3, weight: 28.5, gender: '公' },
    { id: 'pet-002', ownerId: 'user-001', name: '咪咪', species: '猫', breed: '英国短毛猫', age: 2, weight: 4.2, gender: '母' },
    { id: 'pet-003', ownerId: 'user-002', name: '旺财', species: '犬', breed: '拉布拉多', age: 5, weight: 32.0, gender: '公' }
  ];

  pets.forEach(pet => {
    db.run(
      'INSERT INTO pets (id, owner_id, name, species, breed, age, weight, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [pet.id, pet.ownerId, pet.name, pet.species, pet.breed, pet.age, pet.weight, pet.gender]
    );
  });

  const medicines = [
    { id: 'med-001', name: '阿莫西林克拉维酸钾片', category: '抗生素', specification: '0.5g*10片', manufacturer: '辉瑞制药', price: 68.00 },
    { id: 'med-002', name: '头孢氨苄片', category: '抗生素', specification: '0.25g*24片', manufacturer: '拜耳', price: 45.00 },
    { id: 'med-003', name: '恩诺沙星片', category: '抗生素', specification: '50mg*12片', manufacturer: '硕腾', price: 56.00 },
    { id: 'med-004', name: '布洛芬混悬液', category: '解热镇痛', specification: '100ml', manufacturer: '默沙东', price: 32.00 },
    { id: 'med-005', name: '美洛昔康片', category: '解热镇痛', specification: '7.5mg*10片', manufacturer: '勃林格殷格翰', price: 78.00 },
    { id: 'med-006', name: '益生菌粉', category: '消化系统', specification: '5g*10袋', manufacturer: '麦德氏', price: 88.00 },
    { id: 'med-007', name: '蒙脱石散', category: '消化系统', specification: '3g*10袋', manufacturer: '博福-益普生', price: 25.00 },
    { id: 'med-008', name: '西咪替丁片', category: '消化系统', specification: '0.2g*100片', manufacturer: '上药信谊', price: 18.00 },
    { id: 'med-009', name: '氯雷他定片', category: '抗过敏', specification: '10mg*6片', manufacturer: '拜耳', price: 28.00 },
    { id: 'med-010', name: '地塞米松片', category: '激素', specification: '0.75mg*100片', manufacturer: '仙琚制药', price: 12.00 },
    { id: 'med-011', name: '碘伏消毒液', category: '外用消毒', specification: '100ml', manufacturer: '海氏海诺', price: 15.00 },
    { id: 'med-012', name: '红霉素软膏', category: '外用抗菌', specification: '10g', manufacturer: '马应龙', price: 8.50 },
    { id: 'med-013', name: '酮康唑乳膏', category: '抗真菌', specification: '15g', manufacturer: '西安杨森', price: 35.00 },
    { id: 'med-014', name: '复方酮康唑洗剂', category: '抗真菌', specification: '200ml', manufacturer: '西安杨森', price: 65.00 },
    { id: 'med-015', name: '左旋咪唑片', category: '驱虫药', specification: '25mg*100片', manufacturer: '华北制药', price: 22.00 },
    { id: 'med-016', name: '阿苯达唑片', category: '驱虫药', specification: '0.2g*10片', manufacturer: '中美史克', price: 38.00 },
    { id: 'med-017', name: '复合维生素B片', category: '维生素', specification: '100片', manufacturer: '新黄河', price: 10.00 },
    { id: 'med-018', name: '鱼肝油软胶囊', category: '维生素', specification: '100粒', manufacturer: '汤臣倍健', price: 68.00 },
    { id: 'med-019', name: '氯霉素滴眼液', category: '眼科用药', specification: '8ml', manufacturer: '润舒', price: 16.00 },
    { id: 'med-020', name: '人工泪液', category: '眼科用药', specification: '10ml', manufacturer: '爱丽', price: 45.00 }
  ];

  medicines.forEach(med => {
    db.run(
      'INSERT INTO medicines (id, name, category, specification, manufacturer, price, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [med.id, med.name, med.category, med.specification, med.manufacturer, med.price, `用于治疗宠物${med.category}相关疾病`]
    );
  });

  const inventoryData = [
    { storeId: 'store-001', medicineId: 'med-001', quantity: 150, minStock: 30 },
    { storeId: 'store-001', medicineId: 'med-002', quantity: 200, minStock: 40 },
    { storeId: 'store-001', medicineId: 'med-003', quantity: 80, minStock: 20 },
    { storeId: 'store-001', medicineId: 'med-004', quantity: 60, minStock: 15 },
    { storeId: 'store-001', medicineId: 'med-005', quantity: 0, minStock: 20 },
    { storeId: 'store-001', medicineId: 'med-006', quantity: 120, minStock: 30 },
    { storeId: 'store-001', medicineId: 'med-007', quantity: 250, minStock: 50 },
    { storeId: 'store-001', medicineId: 'med-008', quantity: 180, minStock: 40 },
    { storeId: 'store-001', medicineId: 'med-009', quantity: 90, minStock: 25 },
    { storeId: 'store-001', medicineId: 'med-010', quantity: 300, minStock: 60 },
    { storeId: 'store-001', medicineId: 'med-011', quantity: 500, minStock: 100 },
    { storeId: 'store-001', medicineId: 'med-012', quantity: 400, minStock: 80 },
    { storeId: 'store-001', medicineId: 'med-013', quantity: 70, minStock: 20 },
    { storeId: 'store-001', medicineId: 'med-014', quantity: 45, minStock: 15 },
    { storeId: 'store-001', medicineId: 'med-015', quantity: 0, minStock: 30 },
    { storeId: 'store-001', medicineId: 'med-016', quantity: 110, minStock: 25 },
    { storeId: 'store-001', medicineId: 'med-017', quantity: 280, minStock: 50 },
    { storeId: 'store-001', medicineId: 'med-018', quantity: 95, minStock: 20 },
    { storeId: 'store-001', medicineId: 'med-019', quantity: 160, minStock: 30 },
    { storeId: 'store-001', medicineId: 'med-020', quantity: 55, minStock: 15 },
    { storeId: 'store-002', medicineId: 'med-001', quantity: 120, minStock: 25 },
    { storeId: 'store-002', medicineId: 'med-002', quantity: 180, minStock: 35 },
    { storeId: 'store-002', medicineId: 'med-003', quantity: 65, minStock: 15 },
    { storeId: 'store-002', medicineId: 'med-005', quantity: 75, minStock: 15 },
    { storeId: 'store-002', medicineId: 'med-006', quantity: 100, minStock: 25 },
    { storeId: 'store-002', medicineId: 'med-011', quantity: 450, minStock: 80 },
    { storeId: 'store-002', medicineId: 'med-013', quantity: 60, minStock: 15 },
    { storeId: 'store-002', medicineId: 'med-019', quantity: 140, minStock: 25 },
    { storeId: 'store-002', medicineId: 'med-020', quantity: 48, minStock: 12 },
    { storeId: 'store-003', medicineId: 'med-001', quantity: 100, minStock: 20 },
    { storeId: 'store-003', medicineId: 'med-002', quantity: 150, minStock: 30 },
    { storeId: 'store-003', medicineId: 'med-006', quantity: 85, minStock: 20 },
    { storeId: 'store-003', medicineId: 'med-011', quantity: 380, minStock: 70 }
  ];

  inventoryData.forEach((inv, index) => {
    db.run(
      'INSERT INTO inventory (id, store_id, medicine_id, quantity, min_stock) VALUES (?, ?, ?, ?, ?)',
      [`inv-${String(index + 1).padStart(3, '0')}`, inv.storeId, inv.medicineId, inv.quantity, inv.minStock]
    );
  });

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dayAfter = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const appointments = [
    {
      id: 'apt-001', ownerId: 'user-001', petId: 'pet-001', storeId: 'store-001',
      doctorId: 'user-003', department: '内科', symptoms: '呕吐、腹泻、食欲不振，持续2天',
      appointmentCode: 'APT20260617001', appointmentTime: tomorrow.toISOString(),
      status: 'confirmed', satisfaction: null
    },
    {
      id: 'apt-002', ownerId: 'user-002', petId: 'pet-003', storeId: 'store-001',
      doctorId: 'user-004', department: '外科', symptoms: '右后腿跛行，不敢着地，肿胀',
      appointmentCode: 'APT20260617002', appointmentTime: dayAfter.toISOString(),
      status: 'pending', satisfaction: null
    },
    {
      id: 'apt-003', ownerId: 'user-001', petId: 'pet-002', storeId: 'store-002',
      doctorId: 'user-005', department: '眼科', symptoms: '眼睛红肿、流泪、眼屎增多',
      appointmentCode: 'APT20260617003', appointmentTime: yesterday.toISOString(),
      status: 'completed', satisfaction: 5
    }
  ];

  appointments.forEach(apt => {
    db.run(
      'INSERT INTO appointments (id, owner_id, pet_id, store_id, doctor_id, department, symptoms, appointment_code, appointment_time, status, satisfaction) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [apt.id, apt.ownerId, apt.petId, apt.storeId, apt.doctorId, apt.department, apt.symptoms, apt.appointmentCode, apt.appointmentTime, apt.status, apt.satisfaction]
    );
  });

  saveDatabase();
}
