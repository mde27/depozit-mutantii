import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { getSession } from '../session';
import Banner from '../components/Banner';

const ROLE_OPTIONS = [
  { value: 'a', label: 'Type A' },
  { value: 'b', label: 'Type B' },
  { value: 'admin', label: 'Admin' },
];
const MIN_PASSWORD = 6;

const inputClass =
  'w-full px-3 py-2 border border-rose-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-rose-400/50 focus:border-rose-400 transition';

function roleBadge(role) {
  if (role === 'admin') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (role === 'a') return 'bg-violet-50 text-violet-700 border-violet-200';
  if (role === 'b') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-gray-50 text-gray-600 border-gray-200';
}

export default function Users() {
  const navigate = useNavigate();
  const me = getSession().username;
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(''); // username (or '__create__') being saved
  const [form, setForm] = useState({ username: '', password: '', role: 'b' });
  const [resetFor, setResetFor] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');

  // Admin only (RequireAdmin in App.jsx + server-side check).
  useEffect(() => {
    let cancelled = false;
    api('listUsers')
      .then((data) => {
        if (!cancelled) setUsers(data.users || []);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = () => {
    setLoading(true);
    setReloadKey((n) => n + 1);
  };

  const isMe = (u) => u.username.toLowerCase() === me.toLowerCase();
  const adminCount = users.filter((u) => u.role === 'admin').length;

  const run = async (key, action, data, message) => {
    setBusy(key);
    setError('');
    setSuccess('');
    try {
      await api(action, data);
      setSuccess(message);
      reload();
      return true;
    } catch (e) {
      console.error(e);
      setError(e.message || 'Could not save. Please try again.');
      return false;
    } finally {
      setBusy('');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const username = form.username.trim();
    const password = form.password.trim();
    if (!username) return setError('Enter a username.');
    if (password.length < MIN_PASSWORD) return setError(`Password must be at least ${MIN_PASSWORD} characters.`);
    const ok = await run('__create__', 'createUser', { username, password, role: form.role }, `User "${username}" created.`);
    if (ok) setForm({ username: '', password: '', role: 'b' });
  };

  const handleRoleChange = (user, role) => {
    if (role === user.role) return;
    run(user.username, 'updateUser', { username: user.username, role },
      `Role of "${user.username}" changed to ${ROLE_OPTIONS.find((r) => r.value === role)?.label || role}.`);
  };

  const handleReset = async (user) => {
    const password = resetPassword.trim();
    if (password.length < MIN_PASSWORD) return setError(`Password must be at least ${MIN_PASSWORD} characters.`);
    const ok = await run(user.username, 'updateUser', { username: user.username, password }, `Password of "${user.username}" was reset.`);
    if (ok) {
      setResetFor('');
      setResetPassword('');
    }
  };

  const handleDelete = async (user) => {
    const ok = await run(user.username, 'deleteUser', { username: user.username }, `User "${user.username}" deleted.`);
    if (ok) setConfirmDelete('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-rose-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-1.5 text-rose-600 font-medium hover:text-rose-800 transition"
          >
            <span className="text-lg">←</span> Back to Dashboard
          </button>
          <button
            onClick={reload}
            className="text-sm px-3 py-1.5 bg-white text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-50 shadow-sm transition font-medium"
          >
            Refresh
          </button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-rose-200">
            👥
          </div>
          <div>
            <h2 className="text-2xl font-bold text-rose-900">Users</h2>
            <p className="text-sm text-rose-500">Accounts, roles and passwords</p>
          </div>
        </div>

        <Banner message={error} onClose={() => setError('')} className="mb-4" />
        <Banner type="success" message={success} onClose={() => setSuccess('')} className="mb-4" />

        {/* Create user */}
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-2xl shadow-lg shadow-rose-100/40 border border-rose-100 p-6 mb-6"
        >
          <h3 className="text-lg font-bold text-rose-800 mb-4">New user</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className={inputClass}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={inputClass}
                placeholder={`min. ${MIN_PASSWORD} characters`}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className={inputClass}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={busy === '__create__'}
              className="w-full bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white font-semibold py-2.5 rounded-xl shadow-md shadow-rose-200 transition disabled:opacity-60"
            >
              {busy === '__create__' ? 'Creating...' : 'Create user'}
            </button>
          </div>
        </form>

        {/* User list */}
        <div className="bg-white rounded-2xl shadow-lg shadow-rose-100/40 border border-rose-100 p-6">
          {loading ? (
            <p className="text-center text-rose-600 py-12 font-medium">Loading users...</p>
          ) : users.length === 0 ? (
            <p className="text-center text-gray-400 py-12">No users found.</p>
          ) : (
            <div className="divide-y divide-rose-50">
              {users.map((user) => {
                const self = isMe(user);
                const lastAdmin = user.role === 'admin' && adminCount <= 1;
                const rowBusy = busy === user.username;
                return (
                  <div key={user.id || user.username} className="py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-semibold text-gray-800 truncate">{user.username}</span>
                        {self && <span className="text-xs text-rose-400">(you)</span>}
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${roleBadge(user.role)}`}>
                          {ROLE_OPTIONS.find((r) => r.value === user.role)?.label || user.role || '—'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={user.role}
                          disabled={rowBusy || self || lastAdmin}
                          title={self ? 'You cannot change your own role' : lastAdmin ? 'The last admin must stay admin' : 'Change role'}
                          onChange={(e) => handleRoleChange(user, e.target.value)}
                          className="px-2.5 py-1.5 text-sm border border-rose-200 rounded-lg bg-white disabled:opacity-50"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={rowBusy}
                          onClick={() => {
                            setResetFor(resetFor === user.username ? '' : user.username);
                            setResetPassword('');
                            setConfirmDelete('');
                          }}
                          className="px-3 py-1.5 text-sm font-medium text-rose-700 bg-white border border-rose-200 rounded-lg hover:bg-rose-50 disabled:opacity-50"
                        >
                          Reset password
                        </button>
                        <button
                          type="button"
                          disabled={rowBusy || self || lastAdmin}
                          title={self ? 'You cannot delete your own account' : lastAdmin ? 'The last admin cannot be deleted' : 'Delete user'}
                          onClick={() => {
                            setConfirmDelete(user.username);
                            setResetFor('');
                          }}
                          className="px-3 py-1.5 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {resetFor === user.username && (
                      <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center bg-rose-50/60 border border-rose-100 rounded-xl p-3">
                        <input
                          type="password"
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                          placeholder={`New password (min. ${MIN_PASSWORD} characters)`}
                          autoComplete="new-password"
                          className={`${inputClass} sm:max-w-xs`}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={rowBusy}
                            onClick={() => handleReset(user)}
                            className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50"
                          >
                            {rowBusy ? 'Saving...' : 'Save password'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setResetFor('')}
                            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {confirmDelete === user.username && (
                      <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between bg-red-50 border border-red-200 rounded-xl p-3">
                        <p className="text-sm text-red-700">
                          Delete user <span className="font-bold">{user.username}</span>? This cannot be undone.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={rowBusy}
                            onClick={() => handleDelete(user)}
                            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                          >
                            {rowBusy ? 'Deleting...' : 'Yes, delete'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete('')}
                            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}