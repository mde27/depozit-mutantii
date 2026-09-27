const STYLES = {
  error: 'bg-red-50 border-red-200 text-red-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
};

// Small inline message box used instead of alert() popups.
export default function Banner({ type = 'error', message, onClose, children, className = '' }) {
  if (!message) return null;
  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={`flex items-start justify-between gap-3 px-4 py-3 rounded-xl border text-sm ${STYLES[type] || STYLES.error} ${className}`}
    >
      <div className="min-w-0">
        <p className="whitespace-pre-line break-words">{message}</p>
        {children}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="shrink-0 -mt-0.5 text-lg leading-none opacity-60 hover:opacity-100"
        >
          ×
        </button>
      )}
    </div>
  );
}