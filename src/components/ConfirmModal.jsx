import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

// Centered confirmation dialog over a dimmed backdrop (not window.confirm).
// Esc and a click on the backdrop cancel; focus starts on the cancel button
// and stays inside the dialog; everything is disabled while `busy`.
export default function ConfirmModal({
  open,
  title,
  children,
  confirmLabel,
  busyLabel,
  cancelLabel = 'Anulează',
  onConfirm,
  onCancel,
  busy = false,
  testId = 'confirm-modal',
}) {
  const cancelRef = useRef(null);
  const dialogRef = useRef(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    cancelRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!busy) onCancel();
      } else if (e.key === 'Tab') {
        const focusable = [...(dialogRef.current?.querySelectorAll('button:not([disabled])') || [])];
        if (!focusable.length) { e.preventDefault(); return; }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        else if (!dialogRef.current?.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-[1px]"
      data-testid={`${testId}-backdrop`}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        data-testid={testId}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl shadow-rose-900/20 border border-rose-100 p-6"
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-600 text-lg font-bold" aria-hidden="true">!</div>
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-gray-800">{title}</h2>
            <div id={descId} className="mt-1.5 text-sm text-gray-600 space-y-1">{children}</div>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl font-semibold border border-rose-200 text-rose-700 bg-white hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-50"
          >
            {busy ? (busyLabel || confirmLabel) : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
