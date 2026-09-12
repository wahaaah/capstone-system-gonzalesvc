import React, { useEffect, useState } from 'react';
import { posService } from '../services/posService';

interface Transaction {
  id: string | number;
  patient_name?: string;
  customer_name?: string;
  total_amount: number;
  created_at?: string;
  date?: string;
}

export const TransactionHistoryPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    posService.getTransactions()
      .then((data: any) => {
        setTransactions(data);
        setLoading(false);
      })
      .catch((err: any) => {
        console.error('Failed to load transactions:', err);
        setError('Failed to load transaction history.');
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Transaction History</h1>
      <p className="text-gray-600 mb-6">View and track all completed point-of-sale transactions and receipts.</p>
      
      {error && <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Transaction ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Patient / Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Total Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-slate-500">Loading transactions...</td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-slate-500">No transactions recorded yet.</td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">#{tx.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{tx.patient_name || tx.customer_name || 'Walk-in Customer'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-semibold">₱{Number(tx.total_amount).toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{tx.created_at || tx.date ? new Date(tx.created_at || tx.date!).toLocaleString() : 'N/A'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};