// Shared stock search: case- and diacritics-insensitive, every word must match (AND).
// normalize('NFD') splits letters from their accents, e.g. "ș" → "s" + U+0326 and
// "ş" → "s" + U+0327, then the combining marks are removed, so ș/ş/s, ț/ţ/t,
// ă/â/a and î/i all compare equal.

export const STOCK_SEARCH_FIELDS = ['code', 'name', 'place', 'company', 'comments'];

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

export function searchTokens(query) {
  return normalizeText(query).split(/\s+/).filter(Boolean);
}

export function matchesSearch(item, tokens, fields = STOCK_SEARCH_FIELDS) {
  if (!tokens.length) return true;
  const haystack = fields.map((f) => normalizeText(item?.[f])).join(' ');
  return tokens.every((t) => haystack.includes(t));
}

/** Applies the place filter ('all' = no filter) and the search query together. */
export function filterStock(items, { query = '', place = 'all' } = {}) {
  const tokens = searchTokens(query);
  return items.filter(
    (item) => (place === 'all' || item.place === place) && matchesSearch(item, tokens)
  );
}
