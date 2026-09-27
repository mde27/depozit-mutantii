// Client-side session storage. The role is only used to choose what the UI shows;
// the backend derives username and role from the token and enforces permissions.
const KEYS = ['token', 'username', 'role'];

export function getSession() {
  return {
    token: localStorage.getItem('token') || '',
    username: localStorage.getItem('username') || '',
    role: localStorage.getItem('role') || '',
  };
}

export function saveSession({ token, username, role }) {
  localStorage.removeItem('isAuthenticated'); // legacy flag from the old login
  localStorage.setItem('token', token || '');
  localStorage.setItem('username', username || '');
  localStorage.setItem('role', role || '');
}

export function clearSession() {
  localStorage.removeItem('isAuthenticated');
  KEYS.forEach((k) => localStorage.removeItem(k));
}
