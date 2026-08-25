import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';

export default function Stock() {
  const navigate = useNavigate();
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  if (!localStorage.getItem('isAuthenticated')) {
    navigate('/login');
    return;
  }
  // Only admin can access these pages
  if (localStorage.getItem('role') !== 'admin') {
    navigate('/client');
    return;
  }
  if (!localStorage.getItem('isAuthenticated')) navigate('/login');
    fetchStock();
}, [navigate]);

  const fetchStock = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=getStock`);
      const data = await res.json();
      if (data.status === 'success') setStock(data.stock);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

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

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <svg className="animate-spin h-8 w-8 text-rose-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-rose-600 font-medium">Loading inventory...</p>
              </div>
            </div>
          ) : stock.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              No inventory data available.
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-rose-100">
                    <th className="py-3 px-4 font-semibold text-rose-800/70">ID</th>
                    <th className="py-3 px-4 font-semibold text-rose-800/70">Item Name</th>
                    <th className="py-3 px-4 font-semibold text-rose-800/70">Available Stock</th>
                    <th className="py-3 px-4 font-semibold text-rose-800/70">Image</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-50">
                  {stock.map((item) => (
                    <tr key={item.id} className="hover:bg-rose-50/50 transition">
                      <td className="py-3.5 px-4 text-rose-400 font-medium">#{item.id}</td>
                      <td className="py-3.5 px-4 font-medium text-gray-800">{item.name}</td>
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
                      <td className="py-3.5 px-4">
                        {item.image ? (
                          <div className="relative inline-block group">
                            <a
                              href={item.image}
                              target="_blank"
                              rel="noreferrer"
                              className="text-rose-600 hover:text-rose-800 font-medium hover:underline transition"
                            >
                              View Image
                            </a>

                            {/* Hover preview */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50">
                              <div className="bg-white rounded-xl shadow-xl border border-rose-100 p-1.5">
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-40 h-40 object-cover rounded-lg"
                                />
                              </div>
                              {/* Little arrow */}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-8 border-transparent border-t-white drop-shadow" />
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-300">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}