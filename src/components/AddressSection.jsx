import {
  ADDRESS_SECTIONS,
  MAX_ADDRESS_BLOCKS,
  REQUIRED_BLOCK_FIELDS,
  blockTitle,
  emptyBlock,
  fieldKey,
} from '../utils/addresses';

const inputBase = 'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-400 outline-none';

// Address blocks (1..10) for one section: pickups / deliveries / returns.
export default function AddressSection({ section, blocks, onChange, errors = {}, onFieldEdited }) {
  const cfg = ADDRESS_SECTIONS[section];

  const updateField = (index, field, value) => {
    onChange(blocks.map((b, i) => (i === index ? { ...b, [field]: value } : b)));
    onFieldEdited?.(fieldKey(section, index, field));
  };
  const addBlock = () => {
    if (blocks.length < MAX_ADDRESS_BLOCKS) onChange([...blocks, emptyBlock()]);
  };
  const removeBlock = (index) => {
    if (index === 0) return;
    onChange(blocks.filter((_, i) => i !== index));
    onFieldEdited?.(null, section); // indexes shift: clear this section's errors
  };

  const field = (index, name, { type = 'text', placeholder } = {}) => {
    const key = fieldKey(section, index, name);
    const required = REQUIRED_BLOCK_FIELDS.includes(name);
    const err = errors[key];
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {cfg.labels[name]}{required ? ' *' : ''}
        </label>
        <input
          type={type}
          required={required}
          data-field={key}
          aria-invalid={err ? 'true' : undefined}
          value={blocks[index][name]}
          placeholder={placeholder}
          onChange={(e) => updateField(index, name, e.target.value)}
          className={`${inputBase} ${err ? 'border-red-400 bg-red-50/40' : 'border-rose-200'}`}
        />
        {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        const blockHasError = Object.keys(errors).some((k) => k.startsWith(`${section}.${index}.`));
        return (
          <div
            key={index}
            data-block={`${section}.${index}`}
            className={index > 0 || blocks.length > 1
              ? `space-y-4 rounded-xl border p-4 ${blockHasError ? 'border-red-300 bg-red-50/30' : 'border-rose-200 bg-white/60'}`
              : 'space-y-4'}
          >
            {blocks.length > 1 && (
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-rose-700">{blockTitle(section, index)}</h4>
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => removeBlock(index)}
                    aria-label={`Șterge ${blockTitle(section, index)}`}
                    title={`Șterge ${blockTitle(section, index)}`}
                    className="w-7 h-7 flex items-center justify-center rounded-full text-rose-400 hover:text-rose-700 hover:bg-rose-100 text-lg leading-none"
                  >
                    ×
                  </button>
                )}
              </div>
            )}
            {field(index, 'address')}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {field(index, 'localitate')}
              {field(index, 'judet')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {field(index, 'date', { type: 'date' })}
              {field(index, 'interval', { placeholder: cfg.intervalPlaceholder })}
            </div>
            {field(index, 'phone')}
          </div>
        );
      })}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={addBlock}
          disabled={blocks.length >= MAX_ADDRESS_BLOCKS}
          aria-label={cfg.addLabel}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border bg-white text-rose-700 border-rose-200 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="text-base leading-none">+</span> {cfg.addLabel}
        </button>
        <span className="text-xs text-rose-400">
          {blocks.length} / {MAX_ADDRESS_BLOCKS}
          {blocks.length >= MAX_ADDRESS_BLOCKS ? ' (maxim)' : ''}
        </span>
      </div>
    </div>
  );
}