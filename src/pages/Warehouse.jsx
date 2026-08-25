import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';

export default function Warehouse() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('isAuthenticated')) navigate('/login');
    fetchTickets();
  }, [navigate]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=getTickets`);
      const data = await res.json();
      if (data.status === 'success') setTickets(data.tickets);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const activeTickets = tickets.filter((t) => t.status !== 'CLOSED');

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
            onClick={fetchTickets}
            className="text-sm px-3 py-1.5 bg-white text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-50 shadow-sm transition font-medium"
          >
            Refresh
          </button>
        </div>

        <div className="flex items-center gap-3 mb-7">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-rose-200">
            🚛
          </div>
          <h2 className="text-2xl font-bold text-rose-900">Active Tickets</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin h-8 w-8 text-rose-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-rose-600 font-medium">Loading tickets...</p>
            </div>
          </div>
        ) : activeTickets.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-rose-100">
            <div className="text-4xl mb-3">✨</div>
            <p className="text-gray-500 font-medium">No active tickets pending.</p>
            <p className="text-sm text-rose-400 mt-1">All clear for now.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {activeTickets.map((ticket) => (
              <TicketCard key={ticket.ticketId} ticket={ticket} onUpdate={fetchTickets} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TicketCard({ ticket, onUpdate }) {
  const [items, setItems] = useState(ticket.items);
  const [processing, setProcessing] = useState(false);

  const handleAction = async (actionType) => {
    setProcessing(true);
    await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: actionType,
        data: { ticketId: ticket.ticketId, items },
      }),
    });
    onUpdate();
  };

  return (
    <div className="bg-white rounded-2xl shadow-md shadow-rose-100/30 border border-rose-100 overflow-hidden">
      {/* Colored left accent bar */}
      <div className="flex">
        <div
          className={`w-1.5 shrink-0 ${
            ticket.status === 'CREATED' ? 'bg-amber-400' : 'bg-blue-400'
          }`}
        />
        <div className="flex-1 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-5">
            <h3 className="text-lg font-bold text-gray-800">
              {ticket.ticketId}
              <span className="text-gray-400 font-normal ml-2 text-base">| {ticket.client}</span>
            </h3>
            <span
              className={`self-start px-3 py-1 rounded-full text-xs font-bold ${
                ticket.status === 'CREATED'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}
            >
              {ticket.status}
            </span>
          </div>

          <div className="overflow-x-auto mb-5 -mx-1">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-rose-50">
                  <th className="py-2.5 px-3 font-semibold text-rose-800/60">Item Name</th>
                  <th className="py-2.5 px-3 font-semibold text-rose-800/60">Ordered</th>
                  {ticket.status === 'CREATED' && (
                    <th className="py-2.5 px-3 font-semibold text-rose-800/60">Delivered Qty</th>
                  )}
                  {ticket.status === 'DELIVERED' && (
                    <th className="py-2.5 px-3 font-semibold text-rose-800/60">Returned Qty</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id} className="border-b border-rose-50/60 last:border-0">
                    <td className="py-3 px-3 font-medium text-gray-800">{item.name}</td>
                    <td className="py-3 px-3 text-gray-600">{item.orderedQty}</td>

                    {ticket.status === 'CREATED' && (
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          defaultValue={item.orderedQty}
                          className="w-20 px-2.5 py-1.5 border border-rose-200 rounded-lg bg-rose-50/30 focus:outline-none focus:ring-2 focus:ring-rose-400/50 focus:border-rose-400 transition text-center"
                          onChange={(e) => {
                            const copy = [...items];
                            copy[idx].deliveredQty = parseInt(e.target.value) || 0;
                            setItems(copy);
                          }}
                        />
                      </td>
                    )}

                    {ticket.status === 'DELIVERED' && (
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          defaultValue={item.deliveredQty}
                          className="w-20 px-2.5 py-1.5 border border-rose-200 rounded-lg bg-rose-50/30 focus:outline-none focus:ring-2 focus:ring-rose-400/50 focus:border-rose-400 transition text-center"
                          onChange={(e) => {
                            const copy = [...items];
                            copy[idx].returnedQty = parseInt(e.target.value) || 0;
                            setItems(copy);
                          }}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {ticket.status === 'CREATED' && (
            <button
              disabled={processing}
              onClick={() => handleAction('confirmDelivery')}
              className="bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md shadow-rose-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'Processing...' : 'Confirm Delivery'}
            </button>
          )}
          {ticket.status === 'DELIVERED' && (
            <button
              disabled={processing}
              onClick={() => handleAction('processReturn')}
              className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md shadow-emerald-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'Processing...' : 'Process Return & Close Ticket'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}