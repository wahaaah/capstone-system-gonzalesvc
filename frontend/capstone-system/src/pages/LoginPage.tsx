import { useState } from 'react';
import { authService, type AuthUser } from '../services/authService';
import { Lock } from 'lucide-react';

export default function LoginPage({ onLoginSuccess }: { onLoginSuccess: (user: AuthUser) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const user = await authService.login(username, password);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-sm p-8"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center mb-3">
            <Lock size={20} />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Gonzales Vision Clinic</h1>
          <p className="text-xs text-slate-500">Admin / Staff Portal</p>
        </div>

        <label className="text-xs font-medium text-slate-500">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 mt-1"
          autoFocus
        />

        <label className="text-xs font-medium text-slate-500">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4 mt-1"
        />

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
