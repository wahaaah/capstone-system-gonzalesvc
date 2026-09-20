import { authService } from './authService';

export interface Product {
  id: number;
  name: string;
  category: string | null;
  description: string | null;
  image_url: string | null;
  price: number;
  stock_quantity: number;
  created_at?: string;
}

export interface CartItem {
  cart_key: string;
  product_id?: number | null;
  frame_id?: number | null;
  name: string;
  unit_price: number;
  quantity: number;
  item_type: 'product' | 'frame';
}

export interface TransactionItem {
  id: number;
  transaction_id: number;
  quantity: number;
  unit_price: number;
  product_id: number | null;
  frame_id: number | null;
  item_name: string;
  item_type: 'product' | 'frame';
  image_url?: string | null;       
  image_2d_url?: string | null;    
}

export interface Transaction {
  id: number;
  appointment_id: number | null;
  patient_id?: number | null;
  customer_name?: string;
  total_amount: number;
  payment_status: 'Pending' | 'Paid';
  created_at: string;
  items?: TransactionItem[];
}

export interface PatientTransaction {
  transaction_id: number;
  appointment_id: number | null;
  patient_id?: number | null;
  total_amount: number;
  payment_status: 'Pending' | 'Paid';
  created_at: string;
  purpose_of_visit: string;
  items_summary: string | null;
}

const API_BASE = 'https://gonzalesvisionclinic.onrender.com/api';

export const posService = {
  getProducts: async (): Promise<Product[]> => {
    const response = await fetch(`${API_BASE}/products`);
    if (!response.ok) throw new Error('Failed to fetch products');
    return response.json();
  },

  createProduct: async (product: Partial<Product>): Promise<Product> => {
    const response = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authService.authHeader() },
      body: JSON.stringify(product),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to create product' }));
      throw new Error(err.error || 'Failed to create product');
    }
    return response.json();
  },

  updateProduct: async (id: number, product: Partial<Product>): Promise<Product> => {
    const response = await fetch(`${API_BASE}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authService.authHeader() },
      body: JSON.stringify(product),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to update product' }));
      throw new Error(err.error || 'Failed to update product');
    }
    return response.json();
  },

  removeProduct: async (id: number): Promise<void> => {
    const response = await fetch(`${API_BASE}/products/${id}`, {
      method: 'DELETE',
      headers: { ...authService.authHeader() },
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to delete product' }));
      throw new Error(err.error || 'Failed to delete product');
    }
  },

  getTransactions: async (): Promise<Transaction[]> => {
    const response = await fetch(`${API_BASE}/transactions`);
    if (!response.ok) throw new Error('Failed to fetch transactions');
    return response.json();
  },

  getTransactionItems: async (id: string | number): Promise<TransactionItem[]> => {
    const response = await fetch(`${API_BASE}/transactions/${id}/items`);
    if (!response.ok) throw new Error('Failed to fetch transaction items');
    return response.json();
  },

  updateTransactionStatus: async (
    id: number | string,
    paymentStatus: 'Pending' | 'Paid'
  ): Promise<{ success: boolean; id: string; payment_status: string }> => {
    const response = await fetch(`${API_BASE}/transactions/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_status: paymentStatus }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to update payment status' }));
      throw new Error(err.error || 'Failed to update payment status');
    }
    return response.json();
  },

  getPatientTransactions: async (patientId: string | number): Promise<PatientTransaction[]> => {
    const response = await fetch(`${API_BASE}/pos/patient/${encodeURIComponent(patientId)}`);
    if (!response.ok) throw new Error('Failed to fetch patient transactions');
    return response.json();
  },

  checkout: async (
    appointmentId: number | string | null,
    patientId: number | string | null,
    items: CartItem[]
  ): Promise<{ message: string; transactionId: number; totalAmount: number }> => {
    const response = await fetch(`${API_BASE}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointment_id: appointmentId,
        patient_id: patientId,
        items: items.map((i) => ({
          product_id: i.product_id ?? null,
          frame_id: i.frame_id ?? null,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Checkout failed' }));
      throw new Error(err.error || 'Checkout failed');
    }
    return response.json();
  },
};