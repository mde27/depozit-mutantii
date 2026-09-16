import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';

export default function Warehouse() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('isAuthenticated')) {
      navigate('/login');
      return;
    }
    if (localStorage.getItem('role') !== 'admin') {
      navigate('/client');
      return;
    }
    fetchTickets();
  }, [navigate]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=getTickets`);
      const data = await res.json();
      if (data.status === 'success') setTickets(data.tickets || []);
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
          <p className="text-center text-rose-600 py-20">Loading tickets...</p>
        ) : activeTickets.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-rose-100">
            <p className="text-gray-500 font-medium">No active tickets pending.</p>
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

function statusStyle(status) {
  if (status === 'CREATED' || status === 'ORDERED') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'PICKED_UP') return 'bg-violet-50 text-violet-700 border-violet-200';
  if (status === 'DELIVERED') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-gray-50 text-gray-700 border-gray-200';
}

function barColor(status) {
  if (status === 'CREATED' || status === 'ORDERED') return 'bg-amber-400';
  if (status === 'PICKED_UP') return 'bg-violet-400';
  if (status === 'DELIVERED') return 'bg-blue-400';
  return 'bg-gray-300';
}

function TicketCard({ ticket, onUpdate }) {
  const [items, setItems] = useState(ticket.items || []);
  const [comment, setComment] = useState('');
  const [processing, setProcessing] = useState(false);
  const status = ticket.status === 'CREATED' ? 'ORDERED' : ticket.status;

  const sendUpdate = async (action, extra = {}) => {
    setProcessing(true);
    const payloadItems = items.map((item) => ({
      ...item,
      deliveredQty: item.deliveredQty ?? item.orderedQty ?? 0,
      returnedQty: item.returnedQty ?? item.deliveredQty ?? item.orderedQty ?? 0,
    }));

    await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action,
        data: {
          ticketId: ticket.ticketId,
          items: payloadItems,
          comment,
          username: localStorage.getItem('username') || '',
          role: localStorage.getItem('role') || '',
          ...extra,
        },
      }),
    });

    setComment('');
    onUpdate();
    setProcessing(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-md shadow-rose-100/30 border border-rose-100 overflow-hidden">
      <div className="flex">
        <div className={`w-1.5 shrink-0 ${barColor(status)}`} />
        <div className="flex-1 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-5">
            <h3 className="text-lg font-bold text-gray-800">
              {ticket.ticketId}
              <span className="text-gray-400 font-normal ml-2 text-base">| {ticket.client}</span>
            </h3>
            <span className={`self-start px-3 py-1 rounded-full text-xs font-bold border ${statusStyle(status)}`}>
              {status}
            </span>
          </div>

          <div className="overflow-x-auto mb-5 -mx-1">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-rose-50">
                  <th className="py-2.5 px-3 font-semibold text-rose-800/60">Item Name</th>
                  <th className="py-2.5 px-3 font-semibold text-rose-800/60">Ordered</th>
                  {status === 'PICKED_UP' && (
                    <th className="py-2.5 px-3 font-semibold text-rose-800/60">Delivered Qty</th>
                  )}
                  {status === 'DELIVERED' && (
                    <th className="py-2.5 px-3 font-semibold text-rose-800/60">Returned Qty</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id || idx} className="border-b border-rose-50/60 last:border-0">
                    <td className="py-3 px-3 font-medium text-gray-800">
                      {item.code ? `${item.code} · ` : ''}{item.name}
                    </td>
                    <td className="py-3 px-3 text-gray-600">{item.orderedQty}</td>
                    {status === 'PICKED_UP' && (
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          defaultValue={item.orderedQty}
                          className="w-20 px-2.5 py-1.5 border border-rose-200 rounded-lg bg-rose-50/30 text-center"
                          onChange={(e) => {
                            const copy = [...items];
                            copy[idx].deliveredQty = parseInt(e.target.value) || 0;
                            setItems(copy);
                          }}
                        />
                      </td>
                    )}
                    {status === 'DELIVERED' && (
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          defaultValue={item.deliveredQty ?? item.orderedQty}
                          className="w-20 px-2.5 py-1.5 border border-rose-200 rounded-lg bg-rose-50/30 text-center"
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

          {(ticket.history || []).length > 0 && (
            <div className="mb-4 space-y-2">
              {(ticket.history || []).map((h, i) => (
                <div key={i} className="text-xs bg-rose-50/70 border border-rose-100 rounded-lg px-3 py-2">
                  <span className="text-gray-500">{h.at}</span>
                  {' · '}
                  <span className="font-medium text-rose-800">{h.user}</span>
                  {h.from !== h.to && (
                    <span className="text-gray-600"> · {h.from} → {h.to}</span>
                  )}
                  {h.comment ? <p className="text-gray-800 mt-1">{h.comment}</p> : null}
                </div>
              ))}
            </div>
          )}

          <textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comment (if you cannot close / extra note)..."
            className="w-full mb-3 px-3 py-2 border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none text-sm"
          />

          <div className="flex flex-wrap gap-2">
            <button
              disabled={processing || !comment.trim()}
              onClick={() => sendUpdate('updateTicket')}
              className="px-4 py-2.5 rounded-xl font-semibold border border-rose-200 text-rose-700 bg-white hover:bg-rose-50 disabled:opacity-50"
            >
              Save comment
            </button>

            {status === 'ORDERED' && (
              <button
                disabled={processing}
                onClick={() => sendUpdate('updateTicket', { nextStatus: 'PICKED_UP' })}
                className="px-4 py-2.5 rounded-xl font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50"
              >
                Mark picked up
              </button>
            )}

            {status === 'PICKED_UP' && (
              <button
                disabled={processing}
                onClick={() => sendUpdate('confirmDelivery')}
                className="px-4 py-2.5 rounded-xl font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
              >
                Confirm delivery
              </button>
            )}

            {status === 'DELIVERED' && (
              <button
                disabled={processing}
                onClick={() => sendUpdate('processReturn')}
                className="px-4 py-2.5 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              >
                Process return & close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}