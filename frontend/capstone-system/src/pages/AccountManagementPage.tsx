import { useState, useEffect } from 'react';
import { userService, type ManagedUser } from '../services/userService';
import { UserPlus, ShieldCheck, ShieldOff } from 'lucide-react';

export default function AccountManagementPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'staff'>('admin');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await userService.getAll();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load accounts.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Username and password are required.');
      return;
    }
    setIsSaving(true);
    try {
      await userService.create({ username, password, full_name: fullName, role });
      setUsername('');
      setFullName('');
      setPassword('');
      setRole('admin');
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to create account.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (user: ManagedUser) => {
    try {
      await userService.setActive(user.user_id, !user.is_active);
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to update account.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Account management</h2>
        <p className="text-sm text-slate-500 mt-1">
          Super-Admin maintenance: create Admin/Staff accounts and activate or deactivate access.
        </p>
      </div>

      <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <UserPlus size={16} /> Create account
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'staff')} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
          </select>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={isSaving}
          className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? 'Creating...' : 'Create account'}
        </button>
      </form>

      <div className="bg-white rounded-xl border border-slate-200">
        {isLoading ? (
          <p className="text-sm text-slate-400 p-5">Loading accounts...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="p-4 font-medium">Username</th>
                <th className="p-4 font-medium">Full name</th>
                <th className="p-4 font-medium">Role</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id} className="border-b border-slate-50 last:border-0">
                  <td className="p-4 font-medium text-slate-700">{u.username}</td>
                  <td className="p-4 text-slate-500">{u.full_name || '—'}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-600">
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${u.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      {u.is_active ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="p-4">
                    {u.role !== 'super_admin' && (
                      <button
                        onClick={() => toggleActive(u)}
                        className={`flex items-center gap-1 text-xs font-medium ${u.is_active ? 'text-red-600 hover:text-red-800' : 'text-emerald-600 hover:text-emerald-800'}`}
                      >
                        {u.is_active ? <><ShieldOff size={12} /> Deactivate</> : <><ShieldCheck size={12} /> Activate</>}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
