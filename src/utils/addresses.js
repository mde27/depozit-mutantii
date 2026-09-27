// Multiple pickup / delivery / return addresses per ticket.
// New tickets store info.pickups / info.deliveries / info.returns as arrays of
// { address, localitate, judet, date, interval, phone }. The old flat fields
// (address_ridicare, pickup_date, ...) are still filled from the FIRST block, and
// old tickets that only have the flat fields are read as a single block.

export const MAX_ADDRESS_BLOCKS = 10;
export const BLOCK_FIELDS = ['address', 'localitate', 'judet', 'date', 'interval', 'phone'];
export const REQUIRED_BLOCK_FIELDS = ['address', 'localitate', 'judet', 'date', 'phone'];

export const ADDRESS_SECTIONS = {
  pickups: {
    title: 'Adresa ridicare',
    short: 'Ridicare',
    addLabel: 'Adaugă adresă ridicare',
    intervalPlaceholder: 'ex: 14:00 - 16:00',
    labels: {
      address: 'Adresa ridicare',
      localitate: 'Localitate ridicare',
      judet: 'Județ ridicare',
      date: 'Data ridicare',
      interval: 'Interval orar (opțional)',
      phone: 'Nr de telefon ridicare',
    },
    legacy: {
      address: 'address_ridicare',
      localitate: 'localitate_ridicare',
      judet: 'judet_ridicare',
      date: 'pickup_date',
      interval: 'pickup_interval',
      phone: 'nr_telefon_ridicare',
    },
  },
  deliveries: {
    title: 'Adresa livrare',
    short: 'Livrare',
    addLabel: 'Adaugă adresă livrare',
    intervalPlaceholder: 'ex: 10:00 - 12:00',
    labels: {
      address: 'Adresa livrare',
      localitate: 'Localitate livrare',
      judet: 'Județ livrare',
      date: 'Data livrare',
      interval: 'Interval orar (opțional)',
      phone: 'Nr de telefon descarcare',
    },
    legacy: {
      address: 'address_livrare',
      localitate: 'localitate_livrare',
      judet: 'judet_livrare',
      date: 'delivery_date',
      interval: 'delivery_interval',
      phone: 'nr_telefon_descarcare',
    },
  },
  returns: {
    title: 'Adresa retur',
    short: 'Retur',
    addLabel: 'Adaugă adresă retur',
    intervalPlaceholder: 'ex: 14:00 - 16:00',
    labels: {
      address: 'Adresa retur',
      localitate: 'Localitate retur',
      judet: 'Județ retur',
      date: 'Data retur',
      interval: 'Interval orar retur',
      phone: 'Nr. telefon retur',
    },
    legacy: {
      address: 'address_retur',
      localitate: 'localitate_retur',
      judet: 'judet_retur',
      date: 'retur_date',
      interval: 'retur_interval',
      phone: 'nr_telefon_retur',
    },
  },
};

export function emptyBlock() {
  return { address: '', localitate: '', judet: '', date: '', interval: '', phone: '' };
}

function clean(value) {
  return String(value ?? '').trim();
}

export function normalizeBlock(block) {
  const out = emptyBlock();
  BLOCK_FIELDS.forEach((f) => {
    out[f] = clean(block?.[f]);
  });
  return out;
}

/** Address blocks of a ticket's info, from the new arrays or (old tickets) the flat fields. */
export function blocksFromInfo(info, section) {
  const list = info?.[section];
  if (Array.isArray(list) && list.length) return list.map(normalizeBlock);
  const { legacy } = ADDRESS_SECTIONS[section];
  const block = emptyBlock();
  BLOCK_FIELDS.forEach((f) => {
    block[f] = clean(info?.[legacy[f]]);
  });
  return BLOCK_FIELDS.some((f) => block[f]) ? [block] : [];
}

/** Flat legacy fields (address_ridicare, pickup_date, ...) filled from the first block. */
export function legacyFieldsFromBlocks(section, blocks) {
  const { legacy } = ADDRESS_SECTIONS[section];
  const first = blocks[0] ? normalizeBlock(blocks[0]) : emptyBlock();
  const out = {};
  BLOCK_FIELDS.forEach((f) => {
    out[legacy[f]] = first[f];
  });
  return out;
}

/** Key used for field errors and data-field attributes, e.g. "deliveries.1.phone". */
export function fieldKey(section, index, field) {
  return `${section}.${index}.${field}`;
}

/** Returns { [fieldKey]: message } for missing required fields in every block. */
export function validateBlocks(section, blocks) {
  const errors = {};
  blocks.forEach((block, i) => {
    REQUIRED_BLOCK_FIELDS.forEach((f) => {
      if (!clean(block[f])) errors[fieldKey(section, i, f)] = 'Câmp obligatoriu';
    });
  });
  return errors;
}

export function blockTitle(section, index) {
  return `${ADDRESS_SECTIONS[section].title} ${index + 1}`;
}
