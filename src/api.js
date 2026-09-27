import { API_URL as CONFIG_API_URL } from './config';
import { clearSession, getSession } from './session';

// VITE_API_URL (e.g. in .env.local) overrides the Apps Script URL from config.js,
// which is handy for local testing against a mock backend.
export const API_URL = import.meta.env.VITE_API_URL || CONFIG_API_URL;

export class ApiError extends Error {
  constructor(message, code = '', data = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.data = data;
  }
}

function handleExpiredSession() {
  clearSession();
  if (window.location.pathname !== '/login') {
    window.location.assign('/login?expired=1');
  }
}

// All calls are POST with a plain-string JSON body (sent as text/plain, so the
// browser makes no CORS preflight, which Apps Script cannot answer).
async function request(body) {
  let res;
  try {
    res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(body) });
  } catch {
    throw new ApiError('Connection error. Please check your internet connection and try again.', 'NETWORK');
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('Received non-JSON:', text.slice(0, 200));
    throw new ApiError('Temporary connection problem with the server. Please try again in a few seconds.', 'BAD_RESPONSE');
  }

  if (!data || data.status !== 'success') {
    if (data && data.code === 'AUTH') handleExpiredSession();
    throw new ApiError((data && data.message) || 'Unexpected server error.', (data && data.code) || '', data);
  }
  return data;
}

/** Authenticated call: api('getStock'), api('createTicket', { ... }). */
export function api(action, data = {}) {
  return request({ action, token: getSession().token, data });
}

export function login(username, password) {
  return request({ action: 'login', username, password });
}

/** Ends the session on the server (best effort) and clears it locally. */
export async function logout() {
  const { token } = getSession();
  clearSession();
  if (!token) return;
  try {
    await request({ action: 'logout', token });
  } catch (e) {
    console.error(e);
  }
}
