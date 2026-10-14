// User types. Every non-admin type works the same way: creates tickets, sees only the stock
// items whose Inventory "visibleTo" cell names it, and views all tickets read-only.
// Keep in sync with USER_TYPES in backend/Code.gs.
export const USER_TYPES = ['a', 'b', 'c'];

// Transportator: only sees the read-only Tickets page (no stock, no new tickets).
export const TRANSPORT_ROLE = 'transport';

export function roleLabel(role) {
  if (role === 'admin') return 'Admin';
  if (role === TRANSPORT_ROLE) return 'Transportator';
  return USER_TYPES.includes(role) ? `Type ${role.toUpperCase()}` : role || '—';
}
