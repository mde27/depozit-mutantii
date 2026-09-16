import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();

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
    // ... rest of the existing code (fetchTickets / fetchStock etc.)
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    navigate('/login');
  };

  const cards = [
    {
      path: '/client',
      emoji: '📝',
      title: 'New Request',
      description: 'Create a new order ticket and select items from the warehouse.',
      accent: 'from-rose-500 to-pink-500',
    },
    {
      path: '/warehouse',
      emoji: '🚛',
      title: 'Management',
      description: 'Confirm deliveries, process returns, and close active tickets.',
      accent: 'from-rose-600 to-rose-500',
    },
    {
      path: '/stock',
      emoji: '📊',
      title: 'Live Stock',
      description: 'View current inventory levels and item details.',
      accent: 'from-pink-500 to-rose-500',
    },
    {
      path: '/logs',
      emoji: '📜',
      title: 'Activity Log',
      description: 'See who created tickets and what items were ordered.',
      accent: 'from-rose-500 to-pink-400',
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-rose-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10 pb-6 border-b border-rose-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center text-white text-xl shadow-md shadow-rose-200">
              📦
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-rose-900 tracking-tight">
                Depozit BT
              </h1>
              <p className="text-sm text-rose-600/70 font-medium">Main Dashboard</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="self-start sm:self-auto px-4 py-2 text-sm font-medium text-rose-700 bg-white border border-rose-200 rounded-xl hover:bg-rose-50 hover:border-rose-300 shadow-sm transition"
          >
            Logout
          </button>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {cards.map((card) => (
            <button
              key={card.path}
              onClick={() => navigate(card.path)}
              className="group relative text-left bg-white rounded-2xl p-7 border border-rose-100 shadow-sm hover:shadow-xl hover:shadow-rose-100/60 hover:border-rose-200 hover:-translate-y-1 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-rose-400/40"
            >
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${card.accent} text-white text-xl mb-4 shadow-md shadow-rose-200/50 group-hover:scale-110 transition-transform`}>
                {card.emoji}
              </div>
              <h3 className="text-lg font-bold text-rose-900 mb-2 group-hover:text-rose-700 transition-colors">
                {card.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {card.description}
              </p>
              <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity text-rose-400">
                →
              </div>
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-rose-300 mt-12">
          Warehouse management • Rose theme
        </p>
      </div>
    </div>
  );
}