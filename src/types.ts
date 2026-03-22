export type VehicleType = 'moto' | 'car' | 'bus' | 'truck';
export type PaymentMethod = 'cash' | 'mobile_money' | 'card' | 'subscription' | 'bank_transfer';
export type TransactionStatus = 'completed' | 'pending' | 'failed' | 'cancelled' | 'awaiting_bank_proof';
export type UserRole = 'agent' | 'admin' | 'user';
export type Currency = 'USD' | 'CDF';

export interface Vehicle {
  plate: string;
  type: VehicleType;
  ownerId?: string;
  lastPassage?: any; // Firestore Timestamp
}

export interface Transaction {
  id?: string;
  vehiclePlate: string;
  vehicleType: VehicleType;
  amount: number;
  currency: Currency;
  paymentMethod: PaymentMethod;
  agentId: string;
  postId: string;
  tollPostName?: string;
  timestamp: any; // Firestore Timestamp
  status: TransactionStatus;
  cancelReason?: string;
  userId?: string;
  isOffline?: boolean;
  mmOperator?: 'MTN' | 'Orange' | 'Airtel' | 'MPSA';
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  role: 'agent' | 'admin';
  active: boolean;
  postId?: string;
}

export interface TollPost {
  id: string;
  name: string;
  location: string;
}

export interface Subscription {
  userId: string;
  balance: number;
  currency: Currency;
  planType: 'basic' | 'premium' | 'corporate';
}

export const TOLL_RATES: Record<VehicleType, Record<Currency, number>> = {
  moto: { USD: 0.2, CDF: 500 },
  car: { USD: 0.6, CDF: 1500 },
  bus: { USD: 1.0, CDF: 2500 },
  truck: { USD: 2.0, CDF: 5000 },
};

export const EXCHANGE_RATE = 2500;
