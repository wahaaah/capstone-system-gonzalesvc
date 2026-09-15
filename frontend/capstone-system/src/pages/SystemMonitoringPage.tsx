import { useState, useEffect } from 'react';
import { monitoringService, type MonitoringStats } from '../services/monitoringService';
import { Users, Calendar, Receipt, Glasses, Package, AlertTriangle, TrendingUp, DollarSign, CalendarDays } from 'lucide-react';

export default function SystemMonitoringPage() {
  const [stats, setStats] = useState<MonitoringStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const load = async () => {
    try {
      const data = await monitoringService.getStats();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load monitoring data.');
    }
  };

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (!stats) return <p className="text-sm text-slate-400">Loading system status...</p>;

  const cards = [
    { label: 'Total patients', value: stats.totalPatients, icon: Users },
    { label: 'Appointments today', value: stats.appointmentsToday, icon: Calendar },
    { label: 'Total transactions', value: stats.totalTransactions, icon: Receipt },
    { label: 'Frames in catalog', value: stats.totalFrames, icon: Glasses },
    { label: 'Products in inventory', value: stats.totalProducts, icon: Package },
    { label: 'Low stock items', value: stats.lowStockProducts, icon: AlertTriangle, alert: stats.lowStockProducts > 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">System monitoring</h2>
        <p className="text-sm text-slate-500 mt-1">
          Read-only operational snapshot — Super-Admin oversight of clinic activity and account health.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`bg-white rounded-xl border p-5 ${c.alert ? 'border-amber-300' : 'border-slate-200'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <c.icon size={18} className={c.alert ? 'text-amber-500' : 'text-blue-500'} />
              {c.alert && <span className="text-[10px] font-bold uppercase text-amber-600">Attention</span>}
            </div>
            <p className="text-2xl font-bold text-slate-900">{c.value}</p>
            <p className="text-xs text-slate-400 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Revenue Breakdown Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <DollarSign size={18} className="text-emerald-500" />
            <span className="text-[10px] font-bold uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Today</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">₱{Number(stats.todayRevenue || 0).toFixed(2)}</p>
          <p className="text-xs text-slate-400 mt-1">Revenue collected today</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <CalendarDays size={18} className="text-blue-500" />
            <span className="text-[10px] font-bold uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded">This Month</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">₱{Number(stats.monthRevenue || 0).toFixed(2)}</p>
          <p className="text-xs text-slate-400 mt-1">Revenue for current month</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp size={18} className="text-indigo-500" />
            <span className="text-[10px] font-bold uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">All-Time</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">₱{Number(stats.totalRevenue || 0).toFixed(2)}</p>
          <p className="text-xs text-slate-400 mt-1">Across {stats.totalTransactions} recorded transactions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Accounts by role</h3>
          <div className="space-y-2">
            {stats.usersByRole.map((r) => (
              <div key={r.role} className="flex items-center justify-between text-sm border-b border-slate-50 pb-2">
                <span className="text-slate-600 capitalize">{r.role.replace('_', ' ')}</span>
                <span className="text-slate-400">
                  {r.active}/{r.count} active
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Recent appointment activity</h3>
          {stats.recentActivity.length === 0 ? (
            <p className="text-xs text-slate-400">No recent activity.</p>
          ) : (
            <div className="space-y-2">
              {stats.recentActivity.map((item) => (
                <div key={`${item.type}-${item.id}`} className="flex items-center justify-between text-sm border-b border-slate-50 pb-2">
                  <span className="text-slate-600">Appointment #{item.id} — {item.reference}</span>
                  <span className="text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}