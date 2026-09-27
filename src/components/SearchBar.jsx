// Search input with clear (x) button and an "N of M items" counter.
export default function SearchBar({ value, onChange, shown, total, placeholder = 'Search code, name, place, company, comments...', className = '' }) {
  return (
    <div className={className}>
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-rose-300 pointer-events-none"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          role="searchbox"
          aria-label="Search items"
          enterKeyHint="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onChange('');
          }}
          placeholder={placeholder}
          className="w-full pl-9 pr-9 py-2.5 bg-white border border-rose-200 rounded-xl text-gray-800 placeholder-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-400/50 focus:border-rose-400 transition"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            title="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-rose-400 hover:text-rose-700 hover:bg-rose-50 text-lg leading-none"
          >
            ×
          </button>
        )}
      </div>
      <p className="text-xs text-rose-500/80 mt-1.5" aria-live="polite">
        {shown} of {total} items
      </p>
    </div>
  );
}

// Empty state shown when the search / place filter hides every item.
export function NoSearchResults({ query, placeFilter, onClearSearch, onShowAllPlaces }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="text-3xl mb-2">🔍</div>
      <p className="font-medium text-gray-700">
        {query.trim() ? <>No items match “{query.trim()}”</> : 'No items in this place'}
        {placeFilter !== 'all' && <> in {placeFilter}</>}.
      </p>
      <p className="text-sm text-gray-400 mt-1">
        Try fewer or shorter words. Accents don't matter (e.g. “bancuta” finds “Băncuță”).
      </p>
      <div className="flex flex-wrap justify-center gap-2 mt-4">
        {query.trim() && (
          <button
            type="button"
            onClick={onClearSearch}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border bg-white text-rose-700 border-rose-200 hover:bg-rose-50"
          >
            Clear search
          </button>
        )}
        {placeFilter !== 'all' && (
          <button
            type="button"
            onClick={onShowAllPlaces}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border bg-white text-rose-700 border-rose-200 hover:bg-rose-50"
          >
            Show all places
          </button>
        )}
      </div>
    </div>
  );
}