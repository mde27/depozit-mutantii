import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { login } from '../api';
import { saveSession } from '../session';
import Banner from '../components/Banner';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(
    searchParams.get('expired') ? 'Your session has expired. Please sign in again.' : ''
  );

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Enter both username and password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const data = await login(username.trim(), password.trim());
      saveSession({ token: data.token, username: data.username || username.trim(), role: data.role }); // role: "a", "b" or "admin"

      // Redirect based on role
      if (data.role === 'admin') {
        navigate('/dashboard');
      } else {
        // Type A or Type B go directly to New Request
        navigate('/client');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-white to-pink-50 px-4 overflow-hidden">
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-rose-200/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-pink-200/25 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl shadow-rose-100/60 border border-rose-100/80 p-8 sm:p-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 text-white text-2xl mb-4 shadow-lg shadow-rose-200">
              📦
            </div>
            <h1 className="text-2xl font-bold text-rose-900 tracking-tight">
              Depozit BT
            </h1>
            <p className="text-sm text-rose-600/80 mt-1.5 font-medium">
              Warehouse Ticketing Portal
            </p>
          </div>

          <Banner message={error} onClose={() => setError('')} className="mb-5" />

          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-rose-900/80 mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 bg-rose-50/50 border border-rose-200 rounded-xl text-gray-800 placeholder-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-400/50 focus:border-rose-400 transition"
                placeholder="username"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-rose-900/80 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-rose-50/50 border border-rose-200 rounded-xl text-gray-800 placeholder-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-400/50 focus:border-rose-400 transition"
                placeholder="••••"
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white font-semibold py-3 rounded-xl shadow-md shadow-rose-200 hover:shadow-lg hover:shadow-rose-300 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Authenticating...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}