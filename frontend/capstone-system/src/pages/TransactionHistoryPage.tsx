import React, { useEffect, useState } from 'react';
import { posService } from '../services/posService';
import { Search, Eye, X, Receipt, Glasses } from 'lucide-react';

interface TransactionItem {
  id: string | number;
  item_name?: string;
  quantity: number;
  unit_price: number;
  item_type?: string;
  image_url?: string | null;
  image_2d_url?: string | null;
}

interface Transaction {
  id: string | number;
  patient_name?: string;
  customer_name?: string;
  total_amount: number;
  created_at?: string;
  date?: string;
  items?: TransactionItem[];
  payment_status?: string;
}

const SERVER_HOST = 'http://127.0.0.1:5000';

const formatImageUrl = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return url;
  }
  return `${SERVER_HOST}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const TransactionHistoryPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  // Modal state & item loading for modal
  const [activeTransaction, setActiveTransaction] = useState<Transaction | null>(null);
  const [loadingItems, setLoadingItems] = useState<boolean>(false);

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

  // Handle opening modal and fetching item details if not already loaded
  const handleViewDetails = async (tx: Transaction) => {
    setActiveTransaction(tx);
    if (!tx.items) {
      setLoadingItems(true);
      try {
        // Fetch item breakdown from the backend endpoint: /transactions/:id/items
        const itemsData = await posService.getTransactionItems(tx.id);
        setActiveTransaction(prev => prev ? { ...prev, items: itemsData } : null);
      } catch (err) {
        console.error('Failed to load transaction items:', err);
      } finally {
        setLoadingItems(false);
      }
    }
  };

  // Filter logic for search and date
  const filteredTransactions = transactions.filter((tx) => {
    const customerName = (tx.patient_name || tx.customer_name || 'Walk-in / Guest').toLowerCase();
    const txId = String(tx.id);
    const matchesSearch = customerName.includes(searchQuery.toLowerCase()) || txId.includes(searchQuery);
    
    let matchesDate = true;
    if (selectedDate) {
      const txDate = new Date(tx.created_at || tx.date || '').toISOString().split('T')[0];
      matchesDate = txDate === selectedDate;
    }

    return matchesSearch && matchesDate;
  });

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Transaction History</h1>
          <p className="text-gray-600 text-sm">View and track all completed point-of-sale transactions and receipts.</p>
        </div>

        {/* Filters bar */}
        <div className="flex items-center space-x-3 mt-4 md:mt-0">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search ID or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-600"
            />
          </div>
          {selectedDate && (
            <button
              onClick={() => setSelectedDate('')}
              className="text-xs text-blue-600 hover:underline"
            >
              Clear Date
            </button>
          )}
        </div>
      </div>
      
      {error && <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

      <div className="bg-white shadow rounded-lg overflow-hidden border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Transaction ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Patient / Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Total Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date & Time</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">Loading transactions...</td>
              </tr>
            ) : filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">No matching transactions found.</td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">#{tx.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{tx.patient_name || tx.customer_name || 'Walk-in / Guest'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-semibold">₱{Number(tx.total_amount).toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{tx.created_at || tx.date ? new Date(tx.created_at || tx.date!).toLocaleString() : 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={() => handleViewDetails(tx)}
                      className="inline-flex items-center space-x-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors text-xs font-medium"
                    >
                      <Eye size={14} />
                      <span>View Details</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Transaction Details Modal */}
      {activeTransaction && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center space-x-2">
                <Receipt className="text-blue-600" size={20} />
                <h3 className="font-bold text-slate-800">Transaction Receipt #{activeTransaction.id}</h3>
              </div>
              <button
                onClick={() => setActiveTransaction(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-lg border border-slate-100">
                <div>
                  <span className="text-slate-500 block text-xs">Customer Name</span>
                  <span className="font-medium text-slate-800">{activeTransaction.patient_name || activeTransaction.customer_name || 'Walk-in / Guest'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">Transaction Date</span>
                  <span className="font-medium text-slate-800">{activeTransaction.created_at || activeTransaction.date ? new Date(activeTransaction.created_at || activeTransaction.date!).toLocaleString() : 'N/A'}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Purchased Items</h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                      <tr>
                        <th className="px-4 py-2 text-left">Item</th>
                        <th className="px-4 py-2 text-center">Qty</th>
                        <th className="px-4 py-2 text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingItems ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-6 text-center text-slate-400 text-xs">Loading item details...</td>
                        </tr>
                      ) : activeTransaction.items && activeTransaction.items.length > 0 ? (
                        activeTransaction.items.map((item, idx) => {
                          const itemImage = item.image_url || item.image_2d_url;
                          return (
                            <tr key={idx}>
                              <td className="px-4 py-2 text-slate-800 flex items-center space-x-3">
                                <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                                  {itemImage ? (
                                    <img
                                      src={formatImageUrl(itemImage)}
                                      alt={item.item_name || 'Item'}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <Glasses size={16} className="text-slate-400" />
                                  )}
                                </div>
                                <span className="line-clamp-2">{item.item_name || 'Optical Item'}</span>
                              </td>
                              <td className="px-4 py-2 text-center text-slate-600 whitespace-nowrap">{item.quantity}</td>
                              <td className="px-4 py-2 text-right text-slate-800 font-medium whitespace-nowrap">₱{Number(item.unit_price).toFixed(2)}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-4 py-4 text-center text-slate-400 text-xs">No items found for this transaction.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <span className="font-semibold text-slate-700">Total Amount Paid</span>
                <span className="text-xl font-bold text-blue-600">₱{Number(activeTransaction.total_amount).toFixed(2)}</span>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setActiveTransaction(null)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};