import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, logout } from '../api';
import { getSession } from '../session';
import Banner from '../components/Banner';
import SearchBar, { NoSearchResults } from '../components/SearchBar';
import { filterStock } from '../utils/search';
import AddressSection from '../components/AddressSection';
import {
  ADDRESS_SECTIONS,
  blockTitle,
  emptyBlock,
  legacyFieldsFromBlocks,
  normalizeBlock,
  validateBlocks,
} from '../utils/addresses';

const NO_ITEMS_MESSAGE = 'Select at least one item.';
const INFO_FIELD_LABELS = { pm_bt: 'Nume responsabil proiect BT', pm_bt_phone: 'Nr telefon PM BT' };
const emptyForm = () => ({ pm_bt: '', pm_bt_phone: '', solicit_retur: false, comments: '' });

export default function ClientRequest() {
  const navigate = useNavigate();
  const [stock, setStock] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [loading, setLoading] = useState(false);
  const [stockLoading, setStockLoading] = useState(true);
  const [stockReload, setStockReload] = useState(0);
  const [step, setStep] = useState(1);
  const [placeFilter, setPlaceFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { role, username } = getSession();

  const [form, setForm] = useState(emptyForm);
  // 1..10 address blocks per section; see src/utils/addresses.js
  const [pickups, setPickups] = useState(() => [emptyBlock()]);
  const [deliveries, setDeliveries] = useState(() => [emptyBlock()]);
  const [returns, setReturns] = useState(() => [emptyBlock()]);
  const [fieldErrors, setFieldErrors] = useState({});

  // Login is required (RequireAuth in App.jsx); the server checks the session token.
  useEffect(() => {
    let cancelled = false;
    api('getStock')
      .then((data) => {
        if (cancelled) return;
        // The server only returns the items visible to this user's type (Inventory "visibleTo").
        setStock(data.stock || []);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setStockLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stockReload]);

  const fetchStock = () => {
    setStockLoading(true);
    setStockReload((n) => n + 1);
  };

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    clearFieldError(field);
  };

  // key = one field ("pickups.1.phone"); section = drop all errors of that section.
  const clearFieldError = (key, section) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (k === key || (section && k.startsWith(`${section}.`))) delete next[k];
      });
      return next;
    });
  };

  const setItemQty = (id, qty) => {
    setSelectedItems((prev) => ({ ...prev, [id]: qty }));
    if (qty > 0 && error === NO_ITEMS_MESSAGE) setError('');
  };

  const handleNext = () => {
    const hasItems = Object.values(selectedItems).some((q) => q > 0);
    if (!hasItems) {
      setError(NO_ITEMS_MESSAGE);
      return;
    }
    setError('');
    setSuccess('');
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

    if (itemsToOrder.length === 0) {
      setError(NO_ITEMS_MESSAGE);
      return;
    }

    // Validate every block; errors are shown next to each field and summarised per block.
    const sections = { pickups, deliveries, ...(form.solicit_retur ? { returns } : {}) };
    const errors = {};
    ['pm_bt', 'pm_bt_phone'].forEach((f) => {
      if (!form[f]?.trim()) errors[f] = 'Câmp obligatoriu';
    });
    Object.entries(sections).forEach(([section, blocks]) => Object.assign(errors, validateBlocks(section, blocks)));

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      const groups = {};
      Object.keys(errors).forEach((key) => {
        const [section, index, field] = key.split('.');
        const title = field ? blockTitle(section, Number(index)) : 'Informații';
        const label = field ? ADDRESS_SECTIONS[section].labels[field] : INFO_FIELD_LABELS[section];
        (groups[title] = groups[title] || []).push(label);
      });
      setError('Please fill in the required fields:\n' +
        Object.entries(groups).map(([title, labels]) => `• ${title}: ${labels.join(', ')}`).join('\n'));
      const first = document.querySelector(`[data-field="${Object.keys(errors)[0]}"]`);
      first?.focus();
      return;
    }

    const clean = (blocks) => blocks.map(normalizeBlock);
    const info = {
      pm_bt: form.pm_bt.trim(),
      pm_bt_phone: form.pm_bt_phone.trim(),
      solicit_retur: form.solicit_retur,
      comments: form.comments,
      pickups: clean(pickups),
      deliveries: clean(deliveries),
      returns: form.solicit_retur ? clean(returns) : [],
    };
    // Legacy flat fields (address_ridicare, pickup_date, ..., nr_telefon_retur) = first block.
    Object.assign(
      info,
      legacyFieldsFromBlocks('pickups', info.pickups),
      legacyFieldsFromBlocks('deliveries', info.deliveries),
      legacyFieldsFromBlocks('returns', info.returns)
    );

    setLoading(true);
    setError('');

    try {
      // Email recipients are fixed on the server; username/role come from the session token.
      const data = await api('createTicket', {
        clientName: info.pm_bt,
        items: itemsToOrder,
        info,
      });

      const message = 'Ticket created: ' + data.ticketId +
        '\nEmail: ' + (data.emailStatus || 'unknown');
      if (role === 'admin') {
        navigate('/dashboard', { state: { notice: message } });
      } else {
        setSelectedItems({});
        setForm(emptyForm());
        setPickups([emptyBlock()]);
        setDeliveries([emptyBlock()]);
        setReturns([emptyBlock()]);
        setFieldErrors({});
        setStep(1);
        setSuccess(message);
        window.scrollTo(0, 0);
        fetchStock();
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error creating ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const places = [...new Set(stock.map((s) => s.place).filter(Boolean))];
  // Filtering only changes what is shown; selectedItems (keyed by id) is never touched,
  // so quantities are kept for items hidden by the search or place filter.
  const visibleStock = filterStock(stock, { query, place: placeFilter });
  const visibleIds = new Set(visibleStock.map((item) => String(item.id)));
  const selectedIds = Object.keys(selectedItems).filter((id) => selectedItems[id] > 0);
  const hiddenSelected = selectedIds.filter((id) => !visibleIds.has(String(id))).length;

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
              Logged in as <span className="font-bold">{username}</span> ({role.toUpperCase()})
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
              {(role === 'a' || role === 'b') && step === 1 && (
                <p className="text-xs text-rose-500 mt-0.5" data-testid="type-note">
                  Showing items available for Type {role.toUpperCase()}
                </p>
              )}
            </div>
          </div>

          <Banner type="success" message={success} onClose={() => setSuccess('')} className="mb-5" />
          {step === 1 && <Banner message={error} onClose={() => setError('')} className="mb-5" />}

          {stockLoading && step === 1 ? (
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
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <label className="block text-sm font-semibold text-rose-900/80">Select Items</label>
                  {selectedIds.length > 0 && (
                    <span
                      data-testid="selected-count"
                      className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200"
                    >
                      {selectedIds.length} {selectedIds.length === 1 ? 'item' : 'items'} selected
                      {hiddenSelected > 0 && (
                        <span className="font-medium text-rose-500"> · {hiddenSelected} hidden by filter</span>
                      )}
                    </span>
                  )}
                </div>

                <SearchBar
                  value={query}
                  onChange={setQuery}
                  shown={visibleStock.length}
                  total={stock.length}
                  className="mb-3"
                />

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
                  {stock.length === 0 ? (
                    <p className="text-center text-gray-400 py-8">
                      {role === 'admin' ? 'No stock items available.' : 'No stock items are available for your account yet.'}
                    </p>
                  ) : visibleStock.length === 0 ? (
                    <NoSearchResults
                      query={query}
                      placeFilter={placeFilter}
                      onClearSearch={() => setQuery('')}
                      onShowAllPlaces={() => setPlaceFilter('all')}
                    />
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
                          onChange={(e) => setItemQty(item.id, parseInt(e.target.value) || 0)}
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
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-5">
                <h3 className="text-lg font-bold text-rose-800 mb-4">👤 Informații</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nume responsabil proiect BT *</label>
                    <input
                      required
                      data-field="pm_bt"
                      aria-invalid={fieldErrors.pm_bt ? 'true' : undefined}
                      value={form.pm_bt}
                      onChange={(e) => updateForm('pm_bt', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-400 outline-none ${fieldErrors.pm_bt ? 'border-red-400 bg-red-50/40' : 'border-rose-200'}`}
                    />
                    {fieldErrors.pm_bt && <p className="text-xs text-red-600 mt-1">{fieldErrors.pm_bt}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nr telefon PM BT *</label>
                    <input
                      required
                      data-field="pm_bt_phone"
                      aria-invalid={fieldErrors.pm_bt_phone ? 'true' : undefined}
                      value={form.pm_bt_phone}
                      onChange={(e) => updateForm('pm_bt_phone', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-400 outline-none ${fieldErrors.pm_bt_phone ? 'border-red-400 bg-red-50/40' : 'border-rose-200'}`}
                    />
                    {fieldErrors.pm_bt_phone && <p className="text-xs text-red-600 mt-1">{fieldErrors.pm_bt_phone}</p>}
                  </div>
                </div>
              </div>

              <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-5">
                <h3 className="text-lg font-bold text-rose-800 mb-4">📦 Încarcare (Ridicare)</h3>
                <AddressSection
                  section="pickups"
                  blocks={pickups}
                  onChange={setPickups}
                  errors={fieldErrors}
                  onFieldEdited={clearFieldError}
                />
              </div>

              <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-5">
                <h3 className="text-lg font-bold text-rose-800 mb-4">🚚 Descărcare (Livrare)</h3>
                <AddressSection
                  section="deliveries"
                  blocks={deliveries}
                  onChange={setDeliveries}
                  errors={fieldErrors}
                  onFieldEdited={clearFieldError}
                />
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
                  <div className="pt-4 border-t border-rose-200">
                    <AddressSection
                      section="returns"
                      blocks={returns}
                      onChange={setReturns}
                      errors={fieldErrors}
                      onFieldEdited={clearFieldError}
                    />
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
                  <p className="text-xs text-gray-500">
                    Emailul cu comanda se trimite automat către destinatarii configurați.
                  </p>
                </div>
              </div>

              <Banner message={error} onClose={() => setError('')} />

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setError(''); setStep(1); }}
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