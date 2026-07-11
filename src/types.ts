export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'owner' | 'tenant';
  unit_id?: string;
  created_at?: Date;
}

export interface Unit {
  id: string;
  number: number;
  tower: string;
  owner_id?: string;
  tenant_id?: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  date: Date | any; // Timestamp from Firestore
  description: string;
  category: string;
  unit_id?: string;
  status?: 'pending' | 'paid';
  receipt_url?: string;
}

export interface Reservation {
  id: string;
  unit_id: string;
  amenity: string;
  date: Date | any; // Timestamp from Firestore
  start_time: string;
  end_time: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface MaintenanceFee {
  id: string;
  unit_id: string;
  period: string; // YYYY-MM
  amount: number;
  status: 'pending' | 'paid';
  paid_date?: Date | any;
}
