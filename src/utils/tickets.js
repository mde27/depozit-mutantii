// Ticket list order: newest first (by createdAt), ticket ID (descending) as tiebreak.
// Tickets without a readable createdAt go to the bottom. Returns a new array.
function createdMs(ticket) {
  const t = new Date(ticket?.createdAt || '').getTime();
  return Number.isNaN(t) ? -Infinity : t;
}

export function newestFirst(tickets) {
  return [...(tickets || [])].sort((a, b) => {
    const diff = createdMs(b) - createdMs(a);
    if (diff !== 0 && !Number.isNaN(diff)) return diff;
    return String(b?.ticketId || '').localeCompare(String(a?.ticketId || ''), undefined, { numeric: true });
  });
}
