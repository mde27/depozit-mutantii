import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';

export default function Logs() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('tickets');
  const [logs, setLogs] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('isAuthenticated')) {
      navigate('/login');
      return;
    }
    if (localStorage.getItem('role') !== 'admin') {
      navigate('/client');
      return;
    }
    loadAll();
  }, [navigate]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [logsRes, ticketsRes] = await Promise.all([
        fetch(`${API_URL}?action=getLogs`),
        fetch(`${API_URL}?action=getTickets`),
      ]);

      const logsText = await logsRes.text();
      const ticketsText = await ticketsRes.text();

      if (logsText.trim().startsWith('{')) {
        const data = JSON.parse(logsText);
        if (data.status === 'success') setLogs(data.logs || []);
      }
      if (ticketsText.trim().startsWith('{')) {
        const data = JSON.parse(ticketsText);
        if (data.status === 'success') setTickets(data.tickets || []);
      }
    } catch (e) {
      console.error(e);
      alert('Could not load history.');
    }
    setLoading(false);
  };

  const q = query.trim().toLowerCase();

  const matchesTicket = (ticket) => {
    if (!q) return true;
    const items = (ticket.items || [])
      .map((it) => `${it.orderedQty || ''} ${it.code || ''} ${it.name || ''}`)
      .join(' ');
    const history = (ticket.history || [])
      .map((h) => `${h.at || ''} ${h.user || ''} ${h.from || ''} ${h.to || ''} ${h.comment || ''}`)
      .join(' ');
    const blob = [
      ticket.ticketId,
      ticket.client,
      ticket.status,
      ticket.createdAt,
      items,
      history,
    ]
      .join(' ')
      .toLowerCase();
    return blob.includes(q);
  };

  const matchesLog = (log) => {
    if (!q) return true;
    return [log.timestamp, log.username, log.role, log.action, log.details]
      .join(' ')
      .toLowerCase()
      .includes(q);
  };

  const visibleTickets = [...tickets]
    .sort((a, b) => String(b.ticketId).localeCompare(String(a.ticketId)))
    .filter(matchesTicket);

  const visibleLogs = logs.filter(matchesLog);

  const actionStyle = (action) => {
    if (action === 'CREATE_TICKET') return 'bg-rose-50 text-rose-700 border-rose-200';
    if (action === 'CONFIRM_DELIVERY') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (action === 'PROCESS_RETURN') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (String(action).startsWith('STATUS_')) return 'bg-violet-50 text-violet-700 border-violet-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const statusStyle = (status) => {
    if (status === 'CLOSED') return 'bg-gray-100 text-gray-600 border-gray-200';
    if (status === 'DELIVERED') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (status === 'PICKED_UP') return 'bg-violet-50 text-violet-700 border-violet-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
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
            onClick={loadAll}
            className="text-sm px-3 py-1.5 bg-white text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-50 shadow-sm transition font-medium"
          >
            Refresh
          </button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-rose-200">
            📜
          </div>
          <div>
            <h2 className="text-2xl font-bold text-rose-900">History</h2>
            <p className="text-sm text-rose-500">Tickets, comments and activity</p>
          </div>
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ticket, client, product, comment, user..."
          className="w-full mb-4 px-4 py-2.5 bg-white border border-rose-200 rounded-xl text-gray-800 placeholder-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-400/50"
        />

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab('tickets')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border ${
              tab === 'tickets'
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-white text-rose-700 border-rose-200'
            }`}
          >
            Ticket history ({visibleTickets.length})
          </button>
          <button
            onClick={() => setTab('activity')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border ${
              tab === 'activity'
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-white text-rose-700 border-rose-200'
            }`}
          >
            Activity log ({visibleLogs.length})
          </button>
        </div>

        {loading ? (
          <p className="text-center text-rose-600 py-16">Loading...</p>
        ) : tab === 'tickets' ? (
          visibleTickets.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-rose-100">
              <p className="text-gray-500 font-medium">No tickets match that search.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleTickets.map((ticket) => (
                <div
                  key={ticket.ticketId}
                  className="bg-white rounded-2xl border border-rose-100 shadow-sm p-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">
                        {ticket.ticketId}
                        <span className="text-gray-400 font-normal ml-2">| {ticket.client}</span>
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {ticket.createdAt ? String(ticket.createdAt) : ''}
                      </p>
                    </div>
                    <span className={`self-start px-3 py-1 rounded-full text-xs font-bold border ${statusStyle(ticket.status)}`}>
                      {ticket.status}
                    </span>
                  </div>

                  {(ticket.items || []).length > 0 && (
                    <p className="text-sm text-gray-700 mb-3">
                      {(ticket.items || [])
                        .map((it) => `${it.orderedQty || 0}× ${it.code ? it.code + ' ' : ''}${it.name}`)
                        .join(', ')}
                    </p>
                  )}

                  {(ticket.history || []).length === 0 ? (
                    <p className="text-xs text-gray-400">No comments on this ticket yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {(ticket.history || []).map((h, idx) => (
                        <div key={idx} className="text-xs bg-rose-50/70 border border-rose-100 rounded-lg px-3 py-2">
                          <div className="text-gray-500">
                            {h.at} · <span className="font-medium text-rose-800">{h.user}</span>
                            {h.from || h.to ? (
                              <span> · {h.from || '—'} → {h.to || '—'}</span>
                            ) : null}
                          </div>
                          {h.comment ? (
                            <p className="text-gray-800 mt-1 text-sm">{h.comment}</p>
                          ) : (
                            <p className="text-gray-400 mt-1">No comment</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : visibleLogs.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-rose-100">
            <p className="text-gray-500 font-medium">No activity matches that search.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleLogs.map((log, idx) => (
              <div
                key={`${log.timestamp}-${idx}`}
                className="bg-white rounded-xl border border-rose-100 shadow-sm p-4 sm:p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <div className="text-sm text-gray-500">{String(log.timestamp)}</div>
                  <span className={`self-start px-2.5 py-1 rounded-full text-xs font-bold border ${actionStyle(log.action)}`}>
                    {log.action}
                  </span>
                </div>
                <p className="text-sm text-rose-700 font-medium mb-1">
                  {log.username} {log.role ? `(${log.role})` : ''}
                </p>
                <p className="text-gray-800 text-sm leading-relaxed">{log.details}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}