import { useRef, useState } from 'react';
import { MAX_PHOTOS, preparePhoto } from '../utils/images';

// Optional ticket photos (1–5). Each photo is resized/compressed in the browser before upload.
// value: [{ name, mimeType, data, previewUrl, bytes }]
export default function PhotoPicker({ value, onChange, highlight = false, disabled = false }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const room = MAX_PHOTOS - value.length;

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setError('');
    const accepted = files.slice(0, room);
    const problems = [];
    if (files.length > room) problems.push(`Maximum ${MAX_PHOTOS} poze – ${files.length - room} nu au fost adăugate.`);
    setBusy(true);
    const prepared = [];
    for (const f of accepted) {
      try {
        prepared.push(await preparePhoto(f));
      } catch (e) {
        problems.push(e.message);
      }
    }
    setBusy(false);
    if (prepared.length) onChange([...value, ...prepared]);
    if (problems.length) setError(problems.join(' '));
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = (idx) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div data-testid="photo-picker">
      {highlight && (
        <p className="mb-3 text-sm rounded-lg border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2" data-testid="photo-hint">
          Ai selectat „Alte transporturi”: te rugăm să adaugi poze cu ce trebuie transportat.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {value.map((p, i) => (
          <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-rose-200 bg-white" data-testid="photo-preview">
            <img src={p.previewUrl} alt={p.name} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={disabled}
              aria-label={`Șterge ${p.name}`}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 text-rose-700 text-sm font-bold shadow hover:bg-white"
            >
              ×
            </button>
          </div>
        ))}
        {room > 0 && (
          <button
            type="button"
            disabled={busy || disabled}
            onClick={() => inputRef.current?.click()}
            className="w-24 h-24 rounded-lg border-2 border-dashed border-rose-300 text-rose-600 text-xs font-medium hover:bg-rose-50 disabled:opacity-50 flex flex-col items-center justify-center gap-1"
          >
            <span className="text-2xl">📷</span>
            {busy ? 'Se pregătește…' : 'Adaugă poze'}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        data-testid="photo-input"
        onChange={(e) => addFiles(e.target.files)}
      />
      <p className="text-xs text-gray-500 mt-2">
        Opțional · maximum {MAX_PHOTOS} poze · se micșorează automat înainte de trimitere.
      </p>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
