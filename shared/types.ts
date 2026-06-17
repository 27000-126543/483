export type UserRole = 'owner' | 'doctor' | 'pharmacist' | 'manager' | 'admin';

export type AppointmentStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export type PrescriptionStatus = 'pending' | 'confirmed' | 'reviewed' | 'dispensed' | 'cancelled';

export type PaymentStatus = 'pending' | 'completed' | 'paid' | 'refunded';

export type ComplaintType = 'service' | 'medical' | 'billing' | 'price' | 'environment' | 'other';

export type ComplaintStatus = 'pending' | 'assigned' | 'processing' | 'resolved' | 'closed';

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  departmentId: string;
  rating: number;
}

export type MessageType = 'appointment' | 'prescription' | 'payment' | 'complaint' | 'system';

export type MemberTransactionType = 'earn' | 'spend' | 'adjust';

export interface User {
  id: string;
  name: string;
  phone: string;
  passwordHash?: string;
  role: UserRole;
  storeId?: string;
  memberLevel: number;
  memberPoints: number;
  createdAt: string;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  phone: string;
  createdAt: string;
}

export interface Pet {
  id: string;
  ownerId: string;
  name: string;
  species: string;
  breed?: string;
  age?: number;
  weight?: number;
  gender?: 'male' | 'female' | string;
  birthday?: string;
  allergies?: string;
  notes?: string;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  keywords: string;
  description?: string;
  createdAt: string;
}

export interface DoctorSpecialty {
  id: string;
  doctorId: string;
  departmentId: string;
  keywords?: string;
  rating: number;
}

export interface Appointment {
  id: string;
  ownerId: string;
  petId: string;
  storeId: string;
  doctorId?: string;
  department: string;
  symptoms: string;
  appointmentCode: string;
  appointmentTime: string;
  status: AppointmentStatus;
  satisfaction?: number;
  paymentId?: string;
  createdAt: string;
}

export interface MedicalRecord {
  id: string;
  appointmentId: string;
  doctorId: string;
  diagnosis: string;
  treatment?: string;
  notes?: string;
  prescriptionId?: string;
  createdAt: string;
}

export interface Medicine {
  id: string;
  name: string;
  category: string;
  specification?: string;
  manufacturer?: string;
  price: number;
  description?: string;
  createdAt: string;
}

export interface Prescription {
  id: string;
  medicalRecordId: string;
  status: PrescriptionStatus;
  needConfirmation: boolean;
  createdAt: string;
}

export interface PrescriptionItem {
  id: string;
  prescriptionId: string;
  medicineId: string;
  medicine?: Medicine;
  quantity: number;
  dosage?: string;
  frequency?: string;
  isSubstitute: boolean;
  originalMedicineId?: string;
}

export interface Inventory {
  id: string;
  storeId: string;
  medicineId: string;
  medicine?: Medicine;
  quantity: number;
  minStock: number;
  lastUpdated: string;
}

export interface DispenseRecord {
  id: string;
  prescriptionId: string;
  pharmacistId: string;
  pickupCode: string;
  dispensedAt: string;
}

export interface Payment {
  id: string;
  appointmentId: string;
  originalAmount: number;
  memberDiscount: number;
  pointsDeduction: number;
  finalAmount: number;
  paymentMethod?: string;
  status: PaymentStatus;
  paidAt?: string;
  discountAmount?: number;
  pointsUsed?: number;
  discountRate?: number;
  pointsEarned?: number;
  createdAt: string;
}

export interface MemberTransaction {
  id: string;
  userId: string;
  paymentId?: string;
  type: MemberTransactionType;
  pointsChange: number;
  balanceAfter: number;
  description?: string;
  createdAt: string;
}

export interface Complaint {
  id: string;
  ownerId: string;
  storeId: string;
  managerId?: string;
  type: ComplaintType;
  title: string;
  content: string;
  description?: string;
  evidenceUrls?: string | string[];
  status: ComplaintStatus;
  satisfaction?: number;
  assignedToName?: string;
  responses?: ComplaintResponse[];
  createdAt: string;
}

export interface ComplaintResponse {
  id: string;
  complaintId: string;
  responderId: string;
  content: string;
  createdAt: string;
}

export interface Message {
  id: string;
  userId: string;
  type: MessageType;
  title: string;
  content: string;
  relatedId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface Report {
  id: string;
  storeId?: string;
  type: string;
  period: string;
  reportDate: string;
  fileUrl?: string;
  data?: string;
  createdAt: string;
}

export interface LoginRequest {
  phone: string;
  password: string;
  role: UserRole;
}

export interface LoginResponse {
  token: string;
  user: Omit<User, 'passwordHash'>;
}

export interface RegisterRequest {
  name: string;
  phone: string;
  password: string;
}

export interface CreateAppointmentRequest {
  petId: string;
  storeId: string;
  symptoms: string;
  appointmentTime: string;
}

export interface MatchResult {
  department: string;
  departmentId: string;
  doctors: Array<{
    id: string;
    name: string;
    specialty: string;
    rating: number;
  }>;
}

export interface InventoryCheckResponse {
  available: boolean;
  currentStock: number;
  substitutes?: Array<{
    id: string;
    name: string;
    stock: number;
    price: number;
  }>;
}

export interface CreateMedicalRecordRequest {
  appointmentId: string;
  diagnosis: string;
  treatment?: string;
  notes?: string;
  prescriptions: Array<{
    medicineId: string;
    quantity: number;
    dosage?: string;
    frequency?: string;
  }>;
}

export interface ConfirmPrescriptionRequest {
  substituteMedicines?: Array<{
    originalId: string;
    substituteId: string;
    reason: string;
  }>;
}

export interface DispenseRequest {
  prescriptionCode: string;
}

export interface DispenseResponse {
  pickupCode: string;
  qrCodeUrl: string;
}

export interface CalculatePaymentRequest {
  appointmentId: string;
  usePoints: number;
}

export interface CalculatePaymentResponse {
  originalAmount: number;
  memberDiscount: number;
  pointsDeduction: number;
  finalAmount: number;
  earnedPoints: number;
}

export interface PaymentRequest {
  appointmentId: string;
  amount: number;
  paymentMethod: string;
  usePoints: number;
}

export interface CreateComplaintRequest {
  type: ComplaintType;
  title: string;
  content: string;
  evidenceUrls?: string[];
}

export interface ResolveComplaintRequest {
  response: string;
}

export interface CloseComplaintRequest {
  satisfaction: number;
}
