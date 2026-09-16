import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';

export default function Stock() {
  const navigate = useNavigate();
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [placeFilter, setPlaceFilter] = useState('all');

  useEffect(() => {
    if (!localStorage.getItem('isAuthenticated')) {
      navigate('/login');
      return;
    }
    if (localStorage.getItem('role') !== 'admin') {
      navigate('/client');
      return;
    }
    fetchStock();
  }, [navigate]);

  const fetchStock = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=getStock`);
      const text = await res.text();
      if (!text.trim().startsWith('{')) {
        alert('Temporary connection problem. Please try again.');
        setLoading(false);
        return;
      }
      const data = JSON.parse(text);
      if (data.status === 'success') setStock(data.stock || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const places = [...new Set(stock.map((s) => s.place).filter(Boolean))];
  const visibleStock =
    placeFilter === 'all' ? stock : stock.filter((item) => item.place === placeFilter);

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-rose-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-1.5 text-rose-600 font-medium mb-6 hover:text-rose-800 transition"
        >
          <span className="text-lg">←</span> Back to Dashboard
        </button>

        <div className="bg-white rounded-2xl shadow-lg shadow-rose-100/40 border border-rose-100 p-6 sm:p-8">
          <div className="flex items-center justify-between mb-7">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-rose-200">
                📊
              </div>
              <h2 className="text-2xl font-bold text-rose-900">Current Inventory</h2>
            </div>
            <button
              onClick={fetchStock}
              className="text-sm px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 transition font-medium"
            >
              Refresh
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            <button
              type="button"
              onClick={() => setPlaceFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                placeFilter === 'all'
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-white text-rose-700 border-rose-200'
              }`}
            >
              All
            </button>
            {places.map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setPlaceFilter(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                  placeFilter === p
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white text-rose-700 border-rose-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-rose-600 font-medium">Loading inventory...</p>
            </div>
          ) : visibleStock.length === 0 ? (
            <div className="text-center py-16 text-gray-400">No inventory data available.</div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-rose-100">
                    <th className="py-3 px-4 font-semibold text-rose-800/70">Photo</th>
                    <th className="py-3 px-4 font-semibold text-rose-800/70">Code</th>
                    <th className="py-3 px-4 font-semibold text-rose-800/70">Item</th>
                    <th className="py-3 px-4 font-semibold text-rose-800/70">Place</th>
                    <th className="py-3 px-4 font-semibold text-rose-800/70">Qty</th>
                    <th className="py-3 px-4 font-semibold text-rose-800/70">Comments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-50">
                  {visibleStock.map((item) => (
                    <tr key={item.id || item.code} className="hover:bg-rose-50/50 transition">
                      <td className="py-3 px-4">
                        {item.image ? (
                          <button type="button" onClick={() => setPreview(item)}>
                            <img
                              src={item.image}
                              alt={item.name}
                              referrerPolicy="no-referrer"
                              className="w-14 h-14 object-cover rounded-lg border border-rose-100 bg-white"
                            />
                          </button>
                        ) : (
                          <span className="text-gray-300">N/A</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-rose-400 font-medium">{item.code || '—'}</td>
                      <td className="py-3.5 px-4 font-medium text-gray-800">{item.name}</td>
                      <td className="py-3.5 px-4 text-gray-600">{item.place || '—'}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${
                            item.quantity > 0
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-red-50 text-red-600 border border-red-100'
                          }`}
                        >
                          {item.quantity}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-amber-800 max-w-xs">
                        {item.comments || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <img
            src={preview.image}
            alt={preview.name}
            referrerPolicy="no-referrer"
            className="max-w-[90vw] max-h-[80vh] object-contain rounded-2xl shadow-2xl bg-white"
          />
        </div>
      )}
    </div>
  );
}