import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';

export default function ClientRequest() {
  const navigate = useNavigate();
  const [stock, setStock] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [placeFilter, setPlaceFilter] = useState('all');
  const [preview, setPreview] = useState(null);

  const role = localStorage.getItem('role') || '';

  const [form, setForm] = useState({
    pm_bt: '',
    pm_bt_phone: '',
    address_ridicare: '',
    localitate_ridicare: '',
    judet_ridicare: '',
    pickup_date: '',
    pickup_interval: '',
    nr_telefon_ridicare: '',
    address_livrare: '',
    localitate_livrare: '',
    judet_livrare: '',
    delivery_date: '',
    delivery_interval: '',
    nr_telefon_descarcare: '',
    solicit_retur: false,
    address_retur: '',
    localitate_retur: '',
    judet_retur: '',
    retur_date: '',
    retur_interval: '',
    comments: '',
    recipient: 'zmanaszes1@gmail.com',
  });

  useEffect(() => {
    if (!localStorage.getItem('isAuthenticated')) {
      navigate('/login');
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
        console.error('Received non-JSON:', text.slice(0, 200));
        alert('Temporary connection problem with the server. Please try again in a few seconds.');
        setLoading(false);
        return;
      }

      const data = JSON.parse(text);
      if (data.status === 'success') {
        let items = data.stock || [];
        if (role === 'a') {
          items = items.filter((item) => item.forA === true);
        }
        setStock(items);
      }
    } catch (e) {
      console.error(e);
      alert('Connection error. Please try again.');
    }
    setLoading(false);
  };

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    const hasItems = Object.values(selectedItems).some((q) => q > 0);
    if (!hasItems) {
      alert('Select at least one item.');
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const itemsToOrder = Object.keys(selectedItems)
      .filter((id) => selectedItems[id] > 0)
      .map((id) => {
        const found = stock.find((s) => String(s.id) === String(id));
        return {
          id,
          code: found?.code || '',
          name: found?.name,
          orderedQty: selectedItems[id],
        };
      });

    if (itemsToOrder.length === 0) return alert('Select at least one item.');

    const required = [
      'pm_bt', 'pm_bt_phone',
      'address_ridicare', 'localitate_ridicare', 'judet_ridicare', 'nr_telefon_ridicare', 'pickup_date',
      'address_livrare', 'localitate_livrare', 'judet_livrare', 'nr_telefon_descarcare', 'delivery_date'
    ];

    for (const field of required) {
      if (!form[field]?.trim()) {
        alert(`Please fill in: ${field.replace(/_/g, ' ')}`);
        return;
      }
    }

    if (form.solicit_retur) {
      if (!form.address_retur || !form.localitate_retur || !form.judet_retur || !form.retur_date) {
        alert('Please fill in all return address fields.');
        return;
      }
    }

    setLoading(true);

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'createTicket',
          data: {
            clientName: form.pm_bt,
            items: itemsToOrder,
            info: form,
            username: localStorage.getItem('username') || '',
            role: localStorage.getItem('role') || '',
          },
        }),
      });

      const data = await res.json();

      if (data.status === 'success') {
        alert(
          'Ticket created: ' + data.ticketId +
          '\nEmail: ' + (data.emailStatus || 'unknown')
        );
        if (role === 'admin') {
          navigate('/dashboard');
        } else {
          setSelectedItems({});
          setForm({
            pm_bt: '', pm_bt_phone: '',
            address_ridicare: '', localitate_ridicare: '', judet_ridicare: '',
            pickup_date: '', pickup_interval: '', nr_telefon_ridicare: '',
            address_livrare: '', localitate_livrare: '', judet_livrare: '',
            delivery_date: '', delivery_interval: '', nr_telefon_descarcare: '',
            solicit_retur: false,
            address_retur: '', localitate_retur: '', judet_retur: '',
            retur_date: '', retur_interval: '',
            comments: '',
            recipient: 'zmanaszes1@gmail.com',
          });
          setStep(1);
          fetchStock();
        }
      } else {
        alert(data.message || 'Error creating ticket');
      }
    } catch (err) {
      console.error(err);
      alert('Connection error');
    }

    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    navigate('/login');
  };

  const places = [...new Set(stock.map((s) => s.place).filter(Boolean))];
  const visibleStock = placeFilter === 'all'
    ? stock
    : stock.filter((item) => item.place === placeFilter);

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-rose-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex justify-between items-center mb-6">
          {role === 'admin' ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-1.5 text-rose-600 font-medium hover:text-rose-800 transition"
            >
              <span className="text-lg">←</span> Back to Dashboard
            </button>
          ) : (
            <div className="text-sm text-rose-600 font-medium">
              Logged in as <span className="font-bold">{localStorage.getItem('username')}</span> ({role.toUpperCase()})
            </div>
          )}
          <button
            onClick={handleLogout}
            className="text-sm px-3 py-1.5 bg-white text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-50 shadow-sm transition font-medium"
          >
            Logout
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-lg shadow-rose-100/40 border border-rose-100 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-7">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-rose-200">
              📝
            </div>
            <div>
              <h2 className="text-2xl font-bold text-rose-900">
                {step === 1 ? 'Create New Ticket' : 'Order Details'}
              </h2>
              {role === 'a' && step === 1 && (
                <p className="text-xs text-rose-500 mt-0.5">Showing only items available for Type A</p>
              )}
            </div>
          </div>

          {loading && step === 1 ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <svg className="animate-spin h-8 w-8 text-rose-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-rose-600 font-medium">Loading stock...</p>
              </div>
            </div>
          ) : step === 1 ? (
            <>
              <div className="mb-7">
                <label className="block text-sm font-semibold text-rose-900/80 mb-3">Select Items</label>

                <div className="flex flex-wrap gap-2 mb-4">
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

                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {visibleStock.length === 0 ? (
                    <p className="text-center text-gray-400 py-8">No stock items available.</p>
                  ) : (
                    visibleStock.map((item) => (
                      <div
                        key={item.id || `${item.code}-${item.name}`}
                        className="flex justify-between items-start gap-3 p-3.5 rounded-xl border border-rose-100 bg-rose-50/30 hover:bg-rose-50/60 hover:border-rose-200 transition"
                      >
                        <div className="flex items-start gap-3 min-w-0 pr-3">
                          {item.image ? (
                            <button
                              type="button"
                              onClick={() => setPreview(item)}
                              className="shrink-0"
                            >
                              <img
                                src={item.image}
                                alt={item.name}
                                referrerPolicy="no-referrer"
                                className="w-14 h-14 object-cover rounded-lg border border-rose-100 bg-white"
                              />
                            </button>
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-rose-100 text-rose-300 flex items-center justify-center text-lg shrink-0">
                              📦
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800">{item.name}</p>
                            <p className="text-xs text-rose-500/80 mt-0.5">
                              {item.code} · {item.place || '—'} · {item.company || ''}
                              {' · '}Available: <span className="font-semibold">{item.quantity}</span>
                            </p>
                            {item.comments ? (
                              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 mt-1.5">
                                {item.comments}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={item.quantity}
                          value={selectedItems[item.id] || ''}
                          onChange={(e) =>
                            setSelectedItems({
                              ...selectedItems,
                              [item.id]: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-20 px-2.5 py-1.5 text-center border border-rose-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-rose-400/50 focus:border-rose-400 transition"
                          placeholder="0"
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button
                onClick={handleNext}
                className="w-full bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white font-semibold py-3 rounded-xl shadow-md shadow-rose-200 hover:shadow-lg hover:shadow-rose-300 transition"
              >
                Next: Enter Details →
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-5">
                <h3 className="text-lg font-bold text-rose-800 mb-4">👤 Informații</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nume responsabil proiect BT *</label>
                    <input
                      required
                      value={form.pm_bt}
                      onChange={(e) => updateForm('pm_bt', e.target.value)}
                      className="w-full px-3 py-2 border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nr telefon PM BT *</label>
                    <input
                      required
                      value={form.pm_bt_phone}
                      onChange={(e) => updateForm('pm_bt_phone', e.target.value)}
                      className="w-full px-3 py-2 border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-5">
                <h3 className="text-lg font-bold text-rose-800 mb-4">📦 Încarcare (Ridicare)</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adresa ridicare *</label>
                    <input
                      required
                      value={form.address_ridicare}
                      onChange={(e) => updateForm('address_ridicare', e.target.value)}
                      className="w-full px-3 py-2 border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Localitate ridicare *</label>
                      <input
                        required
                        value={form.localitate_ridicare}
                        onChange={(e) => updateForm('localitate_ridicare', e.target.value)}
                        className="w-full px-3 py-2 border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Județ ridicare *</label>
                      <input
                        required
                        value={form.judet_ridicare}
                        onChange={(e) => updateForm('judet_ridicare', e.target.value)}
                        className="w-full px-3 py-2 border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Data ridicare *</label>
                      <input
                        type="date"
                        required
                        value={form.pickup_date}
                        onChange={(e) => updateForm('pickup_date', e.target.value)}
                        className="w-full px-3 py-2 border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Interval orar (opțional)</label>
                      <input
                        value={form.pickup_interval}
                        onChange={(e) => updateForm('pickup_interval', e.target.value)}
                        placeholder="ex: 14:00 - 16:00"
                        className="w-full px-3 py-2 border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nr de telefon ridicare *</label>
                    <input
                      required
                      value={form.nr_telefon_ridicare}
                      onChange={(e) => updateForm('nr_telefon_ridicare', e.target.value)}
                      className="w-full px-3 py-2 border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-5">
                <h3 className="text-lg font-bold text-rose-800 mb-4">🚚 Descărcare (Livrare)</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adresa livrare *</label>
                    <input
                      required
                      value={form.address_livrare}
                      onChange={(e) => updateForm('address_livrare', e.target.value)}
                      className="w-full px-3 py-2 border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Localitate livrare *</label>
                      <input
                        required
                        value={form.localitate_livrare}
                        onChange={(e) => updateForm('localitate_livrare', e.target.value)}
                        className="w-full px-3 py-2 border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Județ livrare *</label>
                      <input
                        required
                        value={form.judet_livrare}
                        onChange={(e) => updateForm('judet_livrare', e.target.value)}
                        className="w-full px-3 py-2 border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Data livrare *</label>
                      <input
                        type="date"
                        required
                        value={form.delivery_date}
                        onChange={(e) => updateForm('delivery_date', e.target.value)}
                        className="w-full px-3 py-2 border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Interval orar (opțional)</label>
                      <input
                        value={form.delivery_interval}
                        onChange={(e) => updateForm('delivery_interval', e.target.value)}
                        placeholder="ex: 10:00 - 12:00"
                        className="w-full px-3 py-2 border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nr de telefon descarcare *</label>
                    <input
                      required
                      value={form.nr_telefon_descarcare}
                      onChange={(e) => updateForm('nr_telefon_descarcare', e.target.value)}
                      className="w-full px-3 py-2 border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-5">
                <h3 className="text-lg font-bold text-rose-800 mb-4">🔄 Retur</h3>
                <label className="flex items-center gap-3 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={form.solicit_retur}
                    onChange={(e) => updateForm('solicit_retur', e.target.checked)}
                    className="w-5 h-5 accent-rose-600"
                  />
                  <span className="font-medium text-gray-800">Solicit retur</span>
                </label>

                {form.solicit_retur && (
                  <div className="space-y-4 pt-2 border-t border-rose-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Adresa retur *</label>
                      <input
                        required={form.solicit_retur}
                        value={form.address_retur}
                        onChange={(e) => updateForm('address_retur', e.target.value)}
                        className="w-full px-3 py-2 border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Localitate retur *</label>
                        <input
                          required={form.solicit_retur}
                          value={form.localitate_retur}
                          onChange={(e) => updateForm('localitate_retur', e.target.value)}
                          className="w-full px-3 py-2 border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Județ retur *</label>
                        <input
                          required={form.solicit_retur}
                          value={form.judet_retur}
                          onChange={(e) => updateForm('judet_retur', e.target.value)}
                          className="w-full px-3 py-2 border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Data retur *</label>
                        <input
                          type="date"
                          required={form.solicit_retur}
                          value={form.retur_date}
                          onChange={(e) => updateForm('retur_date', e.target.value)}
                          className="w-full px-3 py-2 border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Interval orar retur</label>
                        <input
                          value={form.retur_interval}
                          onChange={(e) => updateForm('retur_interval', e.target.value)}
                          placeholder="ex: 14:00 - 16:00"
                          className="w-full px-3 py-2 border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-5">
                <h3 className="text-lg font-bold text-rose-800 mb-4">📝 Comentarii & Email</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Comentarii / Observații</label>
                    <textarea
                      rows={3}
                      value={form.comments}
                      onChange={(e) => updateForm('comments', e.target.value)}
                      className="w-full px-3 py-2 border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none"
                      placeholder="Adaugă orice alte detalii..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email destinatar</label>
                    <input
                      type="email"
                      value={form.recipient}
                      onChange={(e) => updateForm('recipient', e.target.value)}
                      className="w-full px-3 py-2 border border-rose-200 rounded-lg focus:ring-2 focus:ring-rose-400 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 bg-white border border-rose-200 text-rose-700 font-medium py-3 rounded-xl hover:bg-rose-50 transition"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white font-semibold py-3 rounded-xl shadow-md shadow-rose-200 transition disabled:opacity-60"
                >
                  {loading ? 'Sending...' : 'Submit Ticket & Send Email'}
                </button>
              </div>
            </form>
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