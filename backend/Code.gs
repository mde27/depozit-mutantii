/**
 * Depozit BT – Warehouse ticketing backend (Google Apps Script)
 * ===========================================================================
 * ONE SPREADSHEET
 *  - Users, Tickets, Logs and Inventory now all live in ONE spreadsheet
 *    (SPREADSHEET_ID below = the former Inventory/stock spreadsheet).
 *    Missing Tickets / Logs tabs are created automatically with headers.
 *  - The Users tab must be copied over once, otherwise nobody can log in:
 *    in the Apps Script editor select  migrateFromOldSpreadsheet  and click
 *    Run. It copies Users, Tickets and Logs exactly from the old spreadsheet
 *    and never overwrites a tab that already has data rows (safe to run
 *    twice). See View > Logs / Execution log for what it copied.
 *
 * SETUP / DEPLOY
 *  1. Open the existing Apps Script project, replace ALL of Code.gs with this
 *     file and save. Run migrateFromOldSpreadsheet() once (see above).
 *  2. Deploy > Manage deployments > select the existing web-app deployment >
 *     Edit (pencil) > Version: "New version" > Deploy.
 *     Updating the EXISTING deployment keeps the same /exec URL, so the
 *     frontend's src/config.js does not need to change.
 *     Settings must stay: Execute as: Me   |   Who has access: Anyone.
 *     (Do NOT use "New deployment" – that creates a different /exec URL.)
 *  3. If Google asks you to authorise the script again, accept. This version
 *     only adds LockService / CacheService / PropertiesService, which normally
 *     need no extra permission.
 *
 * PASSWORDS
 *  - Passwords are stored as  sha256$<iterations>$<salt>$<hash>  in the Users
 *    sheet (column C). Existing plain-text passwords keep working and are
 *    upgraded to the hashed format automatically on each user's next
 *    successful login. Admins can create users / reset passwords from the
 *    "Users" page of the app.
 *  - After 5 wrong passwords a username is locked for 15 minutes.
 *
 * SESSIONS
 *  - "login" returns a random token valid for 12 hours. Sessions are stored in
 *    Script Properties (key SESSION_<sha256 of token>). Every other action
 *    needs the token; username and role are taken from the session, never from
 *    the request. Expired sessions are cleaned up at every login (optionally
 *    add a time-driven trigger for cleanupSessions()).
 *  - If you edit roles/users directly in the sheet, run revokeAllSessions()
 *    from the editor to force everybody to log in again.
 *
 * ITEM VISIBILITY (Inventory column "visibleTo")
 *  - Values: TypeA, TypeB or TypeA+TypeB (also "A", "B", "A/B", "a; b", ...).
 *    Type A users only see/order TypeA items, Type B users only TypeB items,
 *    admins see everything. An EMPTY cell means "admin only" – change
 *    EMPTY_VISIBLE_TO below to make empty cells visible to everyone.
 *  - The column is found by its header name. Run setupInventoryVisibility()
 *    once from the editor to add the "visibleTo" header (column J) if missing
 *    (migrateFromOldSpreadsheet() does this too). Until the column exists and
 *    is filled in, Type A / Type B users see no items.
 *
 * EMAIL RECIPIENTS
 *  - Edit ORDER_EMAIL_RECIPIENTS below to change who receives the
 *    "New Ticket" email. The app no longer lets the browser choose this.
 * ===========================================================================
 */

// The single spreadsheet holding the Users, Tickets, Logs and Inventory tabs.
// (Users/Tickets/Logs used to live in 1Rmocqx561jUo8pTUrsEjM08B3x8uDqum7KX9e_ioDpI –
//  see migrateFromOldSpreadsheet() at the bottom of this file.)
const SPREADSHEET_ID = "1bon3KMW5-ANMm_G98uGrxikVAjK_9948nBHcY_2q21E";

// Header rows used when a tab has to be created.
const TAB_HEADERS = {
  Users: ["id", "username", "password", "role"],
  Tickets: ["Ticket ID", "Client Name", "Status", "Created At", "Items JSON", "Info JSON", "History JSON"],
  Logs: ["Timestamp", "Username", "Role", "Action", "Details"],
  Inventory: ["id", "code", "name", "company", "place", "qty", "comments", "imageId", "updatedAt", "visibleTo"]
};

// Inventory column that says which user types may see / order an item (found by header name).
const VISIBLE_TO_HEADER = "visibleTo";
// >>> What an EMPTY visibleTo cell means. [] = admin only (hidden from Type A and Type B).
//     Use ["a", "b"] to make items with an empty cell visible to everyone. <<<
const EMPTY_VISIBLE_TO = [];

// >>> EDIT HERE: who receives the "New Ticket" email (comma separated list). <<<
const ORDER_EMAIL_RECIPIENTS = ["zmanaszes1@gmail.com", "lilydark27@gmail.com"];

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;       // 12 hours
const SESSION_PREFIX = "SESSION_";
const PASSWORD_ITERATIONS = 5000;                   // SHA-256 rounds for new hashes
const PASSWORD_MIN_LENGTH = 6;
const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCK_SECONDS = 15 * 60;                 // 15 minutes
const LOCK_WAIT_MS = 30000;
const TICKET_COUNTER_KEY = "TICKET_COUNTER";
const ROLES = ["a", "b", "admin"];

const STATUS = {
  ORDERED: "ORDERED",
  CREATED: "CREATED",   // legacy name of ORDERED
  PICKED_UP: "PICKED_UP",
  DELIVERED: "DELIVERED",
  CLOSED: "CLOSED"
};

// action name -> { admin: true if only admins may call it, fn: handler(data, auth, token) }
const ACTIONS = {
  getStock:        { admin: false, readOnly: true, fn: getStock },  // filtered by role (visibleTo)
  createTicket:    { admin: false, fn: createTicket },
  getTickets:      { admin: true,  readOnly: true, fn: getTickets },
  getLogs:         { admin: true,  readOnly: true, fn: getLogs },
  updateTicket:    { admin: true,  fn: updateTicket },
  confirmDelivery: { admin: true,  fn: confirmDelivery },
  processReturn:   { admin: true,  fn: processReturn },
  listUsers:       { admin: true,  readOnly: true, fn: listUsers },
  createUser:      { admin: true,  fn: createUser },
  updateUser:      { admin: true,  fn: updateUser },
  deleteUser:      { admin: true,  fn: deleteUser }
};

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/** The frontend sends everything as POST with a text/plain JSON body (no CORS preflight). */
function doPost(e) {
  let request;
  try {
    request = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return responseJSON(fail_("Invalid request body"));
  }
  return responseJSON(handleRequest_(request || {}, false));
}

/** Read-only actions are also accepted as GET: ?action=getStock&token=... */
function doGet(e) {
  const p = (e && e.parameter) || {};
  return responseJSON(handleRequest_({ action: p.action, token: p.token, data: {} }, true));
}

function handleRequest_(request, isGet) {
  try {
    const action = String(request.action || "");
    if (!isGet && action === "login") return doLogin(request.username, request.password);
    if (!isGet && action === "logout") return doLogout(request.token);

    const def = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : null;
    if (!def || (isGet && !def.readOnly)) return fail_("Unknown action");

    const auth = getSession_(request.token);
    if (!auth) return { status: "error", code: "AUTH", message: "Session expired or not logged in. Please log in again." };
    if (def.admin && auth.role !== "admin") {
      return { status: "error", code: "FORBIDDEN", message: "You do not have permission for this action." };
    }
    return def.fn(request.data || {}, auth, String(request.token || ""));
  } catch (err) {
    return fail_(String(err && err.message ? err.message : err));
  }
}

function fail_(message, extra) {
  return Object.assign({ status: "error", message: message }, extra || {});
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// Crypto helpers
// ---------------------------------------------------------------------------

function bytesToHex_(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] & 0xff;
    out += (b < 16 ? "0" : "") + b.toString(16);
  }
  return out;
}

function sha256Hex_(text) {
  return bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8));
}

function randomHex_() {
  return Utilities.getUuid().replace(/-/g, "");
}

/** Iterated, salted SHA-256: h1 = H(salt:pw), h(n+1) = H(h(n) || salt:pw). */
function computePasswordHash_(password, salt, iterations) {
  const pwBytes = Utilities.newBlob(salt + ":" + password).getBytes();
  let h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pwBytes);
  for (let i = 1; i < iterations; i++) {
    h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h.concat(pwBytes));
  }
  return bytesToHex_(h);
}

function hashPassword_(password) {
  const salt = randomHex_();
  return "sha256$" + PASSWORD_ITERATIONS + "$" + salt + "$" + computePasswordHash_(password, salt, PASSWORD_ITERATIONS);
}

function isHashedPassword_(stored) {
  return /^sha256\$\d+\$[0-9a-f]+\$[0-9a-f]{64}$/.test(String(stored || ""));
}

function safeEquals_(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** Returns { ok: boolean, legacy: boolean } */
function verifyPassword_(password, stored) {
  stored = String(stored == null ? "" : stored).trim();
  if (!stored || !password) return { ok: false, legacy: false };
  if (isHashedPassword_(stored)) {
    const parts = stored.split("$");
    const iterations = parseInt(parts[1], 10);
    if (!(iterations > 0 && iterations <= 1000000)) return { ok: false, legacy: false };
    return { ok: safeEquals_(computePasswordHash_(password, parts[2], iterations), parts[3]), legacy: false };
  }
  // Legacy plain-text password (upgraded to a hash after a successful login).
  return { ok: safeEquals_(stored, password), legacy: true };
}

// ---------------------------------------------------------------------------
// Users sheet helpers  (A id | B username | C password hash | D role)
// ---------------------------------------------------------------------------

const USERS_SETUP_MESSAGE =
  "The Users tab is missing or empty in the spreadsheet, so nobody can log in. " +
  "Admin: copy the Users tab from the old spreadsheet (run migrateFromOldSpreadsheet() in the Apps Script editor).";

/** Returns the tab, creating it with its header row if missing (or writing the header if the tab is blank). */
function getOrCreateSheet_(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(TAB_HEADERS[name]);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(TAB_HEADERS[name]);
  }
  return sheet;
}

/** Users tab (created with headers if missing). Callers must handle "no users" via readUsers_(). */
function getUsersSheet_() {
  return getOrCreateSheet_("Users");
}

function readUsers_(sheet) {
  const data = sheet.getDataRange().getValues();
  const users = [];
  for (let i = 1; i < data.length; i++) {
    const username = String(data[i][1] == null ? "" : data[i][1]).trim();
    if (!username) continue;
    users.push({
      row: i + 1,
      id: String(data[i][0] == null ? "" : data[i][0]).trim(),
      username: username,
      password: String(data[i][2] == null ? "" : data[i][2]).trim(),
      role: String(data[i][3] == null ? "" : data[i][3]).trim().toLowerCase()
    });
  }
  return users;
}

function findUser_(users, username) {
  const name = String(username || "").trim();
  if (!name) return null;
  const exact = users.filter(u => u.username === name);
  if (exact.length) return exact[0];
  const lower = name.toLowerCase();
  const ci = users.filter(u => u.username.toLowerCase() === lower);
  return ci.length === 1 ? ci[0] : null;
}

// ---------------------------------------------------------------------------
// Login / sessions
// ---------------------------------------------------------------------------

function loginCacheKey_(prefix, username) {
  return prefix + sha256Hex_(String(username || "").trim().toLowerCase()).slice(0, 40);
}

function doLogin(username, password) {
  username = String(username || "").trim();
  password = String(password || "").trim();
  if (!username || !password) return fail_("Enter both username and password");

  const cache = CacheService.getScriptCache();
  const lockKey = loginCacheKey_("LOGIN_LOCK_", username);
  const failKey = loginCacheKey_("LOGIN_FAIL_", username);
  if (cache.get(lockKey)) {
    return fail_("Too many failed attempts. Please try again in " + Math.round(LOGIN_LOCK_SECONDS / 60) + " minutes.", { code: "LOCKED" });
  }

  const sheet = getUsersSheet_();
  const allUsers = readUsers_(sheet);
  if (!allUsers.length) return fail_(USERS_SETUP_MESSAGE, { code: "SETUP" });
  const user = findUser_(allUsers, username);
  const check = user ? verifyPassword_(password, user.password) : { ok: false, legacy: false };

  if (!check.ok || ROLES.indexOf(user.role) === -1) {
    const fails = (parseInt(cache.get(failKey), 10) || 0) + 1;
    if (fails >= LOGIN_MAX_FAILURES) {
      cache.put(lockKey, "1", LOGIN_LOCK_SECONDS);
      cache.remove(failKey);
      logAction(username, "", "LOGIN_LOCKED", "Too many failed login attempts");
    } else {
      cache.put(failKey, String(fails), LOGIN_LOCK_SECONDS);
    }
    return fail_("Invalid credentials");
  }
  cache.remove(failKey);

  if (check.legacy) {
    // Transparent upgrade of the plain-text password to a salted hash.
    withLock_(() => {
      const fresh = findUser_(readUsers_(sheet), user.username);
      if (fresh && fresh.row === user.row && !isHashedPassword_(fresh.password)) {
        sheet.getRange(user.row, 3).setValue(hashPassword_(password));
      }
    });
  }

  cleanupSessions();
  const token = randomHex_() + randomHex_();
  PropertiesService.getScriptProperties().setProperty(
    SESSION_PREFIX + sha256Hex_(token),
    JSON.stringify({ u: user.username, r: user.role, exp: Date.now() + SESSION_TTL_MS })
  );

  logAction(user.username, user.role, "LOGIN", "User logged in" + (check.legacy ? " (password upgraded to hash)" : ""));
  return { status: "success", token: token, username: user.username, role: user.role, expiresInMs: SESSION_TTL_MS };
}

function getSession_(token) {
  token = String(token || "");
  if (!/^[0-9a-f]{32,128}$/.test(token)) return null;
  const props = PropertiesService.getScriptProperties();
  const key = SESSION_PREFIX + sha256Hex_(token);
  const raw = props.getProperty(key);
  if (!raw) return null;
  let s;
  try { s = JSON.parse(raw); } catch (e) { s = null; }
  if (!s || !s.u || !(s.exp > Date.now())) {
    props.deleteProperty(key);
    return null;
  }
  return { username: s.u, role: s.r };
}

function doLogout(token) {
  token = String(token || "");
  if (/^[0-9a-f]{32,128}$/.test(token)) {
    const auth = getSession_(token);
    PropertiesService.getScriptProperties().deleteProperty(SESSION_PREFIX + sha256Hex_(token));
    if (auth) logAction(auth.username, auth.role, "LOGOUT", "User logged out");
  }
  return { status: "success" };
}

/** Removes expired sessions. Safe to run from a time-driven trigger. */
function cleanupSessions() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const now = Date.now();
  Object.keys(all).forEach(k => {
    if (k.indexOf(SESSION_PREFIX) !== 0) return;
    let s = null;
    try { s = JSON.parse(all[k]); } catch (e) { s = null; }
    if (!s || !(s.exp > now)) props.deleteProperty(k);
  });
}

/** Deletes all sessions of one user (optionally keeping one token). */
function revokeUserSessions_(username, keepToken) {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const keepKey = keepToken ? SESSION_PREFIX + sha256Hex_(keepToken) : "";
  const lower = String(username).toLowerCase();
  Object.keys(all).forEach(k => {
    if (k.indexOf(SESSION_PREFIX) !== 0 || k === keepKey) return;
    let s = null;
    try { s = JSON.parse(all[k]); } catch (e) { s = null; }
    if (!s || String(s.u).toLowerCase() === lower) props.deleteProperty(k);
  });
}

/** Run manually from the editor to log everybody out. */
function revokeAllSessions() {
  const props = PropertiesService.getScriptProperties();
  Object.keys(props.getProperties()).forEach(k => {
    if (k.indexOf(SESSION_PREFIX) === 0) props.deleteProperty(k);
  });
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) throw new Error("The server is busy, please try again in a few seconds.");
  try {
    return fn();
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

function parseJson_(value, fallback) {
  try {
    return JSON.parse(value || JSON.stringify(fallback));
  } catch (e) {
    return fallback;
  }
}

/** Prevents user text from being interpreted as a spreadsheet formula. */
function safeCell_(value) {
  const s = String(value == null ? "" : value);
  return /^[=+@]/.test(s) ? "'" + s : s;
}

/** Non-negative integer or null if invalid. Accepts numbers and numeric strings. */
function parseQty_(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

function stockQty_(value) {
  return parseInt(String(value).replace(/,/g, ""), 10) || 0;
}

function nowText_(pattern) {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), pattern || "yyyy-MM-dd HH:mm");
}

function itemLabel_(item) {
  const label = ((item.code ? item.code + " " : "") + (item.name || "")).trim();
  return label || String(item.id || "");
}

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

function getStockSheet_() {
  // Never fall back to "the first tab": that could now be Users or Tickets.
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Inventory");
  if (!sheet) throw new Error("Inventory tab not found in the spreadsheet.");
  return sheet;
}

/** Matches a stock row by id first, then by code. Never by name. */
function findStockRow_(stockData, item) {
  const itemId = String(item.id || "").trim();
  const itemCode = String(item.code || "").trim();
  if (itemId) {
    for (let r = 1; r < stockData.length; r++) {
      if (String(stockData[r][0] || "").trim() === itemId) return r;
    }
  }
  if (itemCode) {
    for (let r = 1; r < stockData.length; r++) {
      if (String(stockData[r][1] || "").trim() === itemCode) return r;
    }
  }
  return -1;
}

/**
 * Parses a visibleTo cell into roles: "TypeA" -> ["a"], "TypeA+TypeB" -> ["a","b"].
 * Case-insensitive, spaces ignored, separators + , ; / | & accepted, "A"/"B" shorthand.
 * Empty -> EMPTY_VISIBLE_TO. Unknown words are ignored (so a typo means admin only).
 */
function parseVisibleTo_(value) {
  const raw = String(value == null ? "" : value).trim().toLowerCase();
  if (!raw) return EMPTY_VISIBLE_TO.slice();
  const roles = [];
  raw.replace(/type[\s_-]+/g, "type").split(/[\s,;\/|&+]+/).forEach(token => {
    const role = (token === "typea" || token === "a") ? "a" : (token === "typeb" || token === "b") ? "b" : "";
    if (role && roles.indexOf(role) === -1) roles.push(role);
  });
  return roles.sort();
}

/** 0-based index of the visibleTo column in the header row, or -1 if there is none. */
function visibleToColumn_(headerRow) {
  const wanted = VISIBLE_TO_HEADER.toLowerCase();
  return (headerRow || []).findIndex(h => String(h == null ? "" : h).trim().toLowerCase() === wanted);
}

/** Roles allowed to see a stock row (no visibleTo column = every cell counts as empty). */
function rowVisibleRoles_(row, visibleCol) {
  return parseVisibleTo_(visibleCol === -1 ? "" : row[visibleCol]);
}

function canSeeStockRow_(auth, row, visibleCol) {
  return auth.role === "admin" || rowVisibleRoles_(row, visibleCol).indexOf(auth.role) !== -1;
}

/**
 * Adds the "visibleTo" header after the last Inventory header (column J) if it is missing.
 * Only writes when needed. Returns a short description of what happened.
 */
function ensureVisibleToColumn_() {
  const sheet = getStockSheet_();
  const lastCol = Math.max(1, sheet.getLastColumn());
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const existing = visibleToColumn_(header);
  if (existing !== -1) return "Inventory: '" + VISIBLE_TO_HEADER + "' column already present (column " + (existing + 1) + ").";
  let lastHeader = 0;
  header.forEach((h, i) => { if (String(h == null ? "" : h).trim()) lastHeader = i + 1; });
  const col = lastHeader + 1;
  sheet.getRange(1, col).setValue(VISIBLE_TO_HEADER);
  return "Inventory: added '" + VISIBLE_TO_HEADER + "' header in column " + col + ". Fill it with TypeA / TypeB / TypeA+TypeB (empty = admin only).";
}

/** Run once from the Apps Script editor to add the visibleTo column header. */
function setupInventoryVisibility() {
  const msg = withLock_(() => ensureVisibleToColumn_());
  Logger.log(msg);
  return msg;
}

function getStock(request, auth) {
  const rows = getStockSheet_().getDataRange().getValues();
  const visibleCol = visibleToColumn_(rows[0]);
  const isAdmin = auth && auth.role === "admin";
  const items = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row[2] || "").trim();
    if (!name) continue;
    if (!auth || !canSeeStockRow_(auth, row, visibleCol)) continue;

    const imageId = String(row[7] || "").trim();

    const item = {
      id: String(row[0] || "").trim(),
      code: String(row[1] || "").trim(),
      name: name,
      company: String(row[3] || "").trim(),
      place: String(row[4] || "").trim(),
      quantity: stockQty_(row[5]),
      comments: String(row[6] || "").trim(),
      image: imageId ? ("https://lh3.googleusercontent.com/d/" + imageId) : ""
    };
    if (isAdmin) {
      // Only admins learn the visibility settings.
      item.visibleTo = visibleCol === -1 ? "" : String(row[visibleCol] == null ? "" : row[visibleCol]).trim();
      item.visibleRoles = rowVisibleRoles_(row, visibleCol);
    }
    items.push(item);
  }

  return { status: "success", stock: items };
}

// ---------------------------------------------------------------------------
// Order addresses (1..10 pickup / delivery / return blocks per ticket)
// ---------------------------------------------------------------------------
// New tickets store info.pickups / info.deliveries / info.returns as arrays of
// { address, localitate, judet, date, interval, phone }. The old flat fields are
// still filled from the FIRST block, and old tickets (flat fields only) are read
// back as single-block arrays.

const MAX_ADDRESS_BLOCKS = 10;
const ADDRESS_FIELDS = ["address", "localitate", "judet", "date", "interval", "phone"];
const ADDRESS_REQUIRED = ["address", "localitate", "judet", "date", "phone"];
const ADDRESS_MAX_LENGTH = { address: 200, localitate: 100, judet: 100, date: 10, interval: 50, phone: 40 };
const ADDRESS_FIELD_NAMES = { address: "adresa", localitate: "localitate", judet: "județ", date: "data", interval: "interval orar", phone: "telefon" };
const ADDRESS_SECTIONS = {
  pickups: {
    title: "Ridicare",
    legacy: { address: "address_ridicare", localitate: "localitate_ridicare", judet: "judet_ridicare", date: "pickup_date", interval: "pickup_interval", phone: "nr_telefon_ridicare" }
  },
  deliveries: {
    title: "Livrare",
    legacy: { address: "address_livrare", localitate: "localitate_livrare", judet: "judet_livrare", date: "delivery_date", interval: "delivery_interval", phone: "nr_telefon_descarcare" }
  },
  returns: {
    title: "Retur",
    legacy: { address: "address_retur", localitate: "localitate_retur", judet: "judet_retur", date: "retur_date", interval: "retur_interval", phone: "nr_telefon_retur" }
  }
};

function text_(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeAddressBlock_(block) {
  const out = {};
  ADDRESS_FIELDS.forEach(f => { out[f] = text_(block && block[f]); });
  return out;
}

function legacyAddressBlock_(info, section) {
  const legacy = ADDRESS_SECTIONS[section].legacy;
  const out = {};
  ADDRESS_FIELDS.forEach(f => { out[f] = text_(info && info[legacy[f]]); });
  return out;
}

/** Address blocks of a stored ticket: new arrays, or one block built from the old flat fields. */
function addressBlocks_(info, section) {
  const list = info && info[section];
  if (Array.isArray(list) && list.length) return list.map(normalizeAddressBlock_);
  const block = legacyAddressBlock_(info, section);
  return ADDRESS_FIELDS.some(f => block[f]) ? [block] : [];
}

/** Adds pickups/deliveries/returns arrays to a stored ticket's info (for old tickets). */
function withAddressArrays_(info) {
  const out = Object.assign({}, info || {});
  Object.keys(ADDRESS_SECTIONS).forEach(section => { out[section] = addressBlocks_(info, section); });
  return out;
}

/**
 * Validates and cleans the order details sent by the app.
 * Returns { errors: string[], info } where info only has known fields,
 * the address arrays and the legacy flat fields (= first block).
 */
function validateOrderInfo_(raw) {
  raw = (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw : {};
  const errors = [];
  const info = {
    pm_bt: text_(raw.pm_bt),
    pm_bt_phone: text_(raw.pm_bt_phone),
    solicit_retur: raw.solicit_retur === true || raw.solicit_retur === "true",
    comments: text_(raw.comments)
  };
  if (!info.pm_bt) errors.push("Nume responsabil proiect BT is required");
  if (!info.pm_bt_phone) errors.push("Nr telefon PM BT is required");
  if (info.pm_bt.length > 100) errors.push("Nume responsabil proiect BT is too long (max 100)");
  if (info.pm_bt_phone.length > 40) errors.push("Nr telefon PM BT is too long (max 40)");
  if (info.comments.length > 2000) errors.push("Comentarii is too long (max 2000)");

  Object.keys(ADDRESS_SECTIONS).forEach(section => {
    const def = ADDRESS_SECTIONS[section];
    let blocks = [];
    if (section !== "returns" || info.solicit_retur) {
      // Old app versions only send the flat fields: treat them as one block.
      const rawBlocks = Array.isArray(raw[section]) ? raw[section] : [legacyAddressBlock_(raw, section)];
      if (rawBlocks.length < 1) errors.push(def.title + ": at least one address is required");
      if (rawBlocks.length > MAX_ADDRESS_BLOCKS) errors.push(def.title + ": at most " + MAX_ADDRESS_BLOCKS + " addresses are allowed");
      blocks = rawBlocks.slice(0, MAX_ADDRESS_BLOCKS).map((b, i) => {
        const label = def.title + " " + (i + 1);
        if (!b || typeof b !== "object" || Array.isArray(b)) {
          errors.push(label + ": invalid address");
          b = {};
        }
        const block = normalizeAddressBlock_(b);
        const missing = ADDRESS_REQUIRED.filter(f => !block[f]);
        if (missing.length) errors.push(label + ": missing " + missing.map(f => ADDRESS_FIELD_NAMES[f]).join(", "));
        ADDRESS_FIELDS.forEach(f => {
          if (block[f].length > ADDRESS_MAX_LENGTH[f]) errors.push(label + ": " + ADDRESS_FIELD_NAMES[f] + " is too long (max " + ADDRESS_MAX_LENGTH[f] + ")");
        });
        if (block.date && !/^\d{4}-\d{2}-\d{2}$/.test(block.date)) errors.push(label + ": invalid date (expected YYYY-MM-DD)");
        return block;
      });
    }
    // A return section is only kept when solicit_retur is ticked.
    info[section] = blocks;
    const first = blocks[0] || normalizeAddressBlock_({});
    ADDRESS_FIELDS.forEach(f => { info[def.legacy[f]] = first[f]; });
  });

  return { errors: errors, info: info };
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

function getTicketSheet_(create) {
  if (create) return getOrCreateSheet_("Tickets");
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Tickets");
}

function findTicketRow_(rows, ticketId) {
  const id = String(ticketId || "").trim();
  if (!id) return -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === id) return i;
  }
  return -1;
}

function normalizeStatus_(status) {
  const s = String(status || "").trim().toUpperCase();
  return s === STATUS.CREATED ? STATUS.ORDERED : s;
}

function appendHistory_(sheet, rowIndex, currentStatus, user, comment, nextStatus) {
  if (sheet.getLastColumn() < 7) sheet.getRange(1, 7).setValue("History JSON");

  const existing = parseJson_(sheet.getRange(rowIndex, 7).getValue(), []);
  existing.push({
    at: nowText_(),
    user: user || "unknown",
    from: currentStatus,
    to: nextStatus || currentStatus,
    comment: String(comment || "").trim()
  });
  sheet.getRange(rowIndex, 7).setValue(JSON.stringify(existing));
}

function getTickets() {
  const ticketSheet = getTicketSheet_(false);
  if (!ticketSheet) return { status: "success", tickets: [] };

  const data = ticketSheet.getDataRange().getValues();
  const tickets = [];
  for (let i = 1; i < data.length; i++) {
    if (!String(data[i][0] || "").trim()) continue;
    tickets.push({
      ticketId: data[i][0],
      client: data[i][1],
      status: data[i][2],
      createdAt: data[i][3],
      items: parseJson_(data[i][4], []),
      info: withAddressArrays_(parseJson_(data[i][5], {})),
      history: parseJson_(data[i][6], [])
    });
  }
  return { status: "success", tickets: tickets };
}

/** Next TICK-NNNN id = max(highest id in the sheet, stored counter) + 1. Call inside the lock. */
function nextTicketId_(ticketSheet) {
  let max = 0;
  const lastRow = ticketSheet.getLastRow();
  if (lastRow >= 2) {
    const ids = ticketSheet.getRange(2, 1, lastRow - 1, 1).getValues();
    ids.forEach(r => {
      const m = /^TICK-(\d+)$/i.exec(String(r[0]).trim());
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
  }
  const props = PropertiesService.getScriptProperties();
  const next = Math.max(max, parseInt(props.getProperty(TICKET_COUNTER_KEY), 10) || 0) + 1;
  props.setProperty(TICKET_COUNTER_KEY, String(next));
  return "TICK-" + String(next).padStart(4, "0");
}

function createTicket(data, auth) {
  const rawItems = Array.isArray(data.items) ? data.items : [];
  if (!rawItems.length) return fail_("Select at least one item.");

  // Only known fields are kept (info.recipient is ignored: recipients are fixed in ORDER_EMAIL_RECIPIENTS).
  const checked = validateOrderInfo_(data.info);
  if (checked.errors.length) {
    return fail_("Please check the order details: " + checked.errors.join("; "), { code: "INVALID_INFO", errors: checked.errors });
  }
  const info = checked.info;

  const clientName = (String(data.clientName || info.pm_bt || "Unknown").trim() || "Unknown").slice(0, 100);

  // Validate items against the inventory (by id, then code).
  const stockData = getStockSheet_().getDataRange().getValues();
  const visibleCol = visibleToColumn_(stockData[0]);
  const items = [];
  const problems = [];
  rawItems.forEach(it => {
    const qty = parseQty_(it && it.orderedQty);
    if (qty === null || qty === 0) {
      problems.push("Invalid quantity for " + itemLabel_(it || {}));
      return;
    }
    const r = findStockRow_(stockData, it || {});
    if (r === -1 || !canSeeStockRow_(auth, stockData[r], visibleCol)) {
      // Same message for hidden items, so their existence is not revealed.
      problems.push("Item not found in stock: " + itemLabel_(it || {}));
      return;
    }
    items.push({
      id: String(stockData[r][0] || "").trim(),
      code: String(stockData[r][1] || "").trim(),
      name: String(stockData[r][2] || "").trim(),
      orderedQty: qty
    });
  });
  if (problems.length) return fail_(problems.join("; "));

  const ticketId = withLock_(() => {
    const ticketSheet = getTicketSheet_(true);
    const id = nextTicketId_(ticketSheet);
    const history = [{ at: nowText_(), user: auth.username, from: "", to: STATUS.ORDERED, comment: String(info.comments || "") }];
    ticketSheet.appendRow([
      id,
      safeCell_(clientName),
      STATUS.ORDERED,
      new Date().toISOString(),
      JSON.stringify(items),
      JSON.stringify(info),
      JSON.stringify(history)
    ]);
    logAction(
      auth.username, auth.role, "CREATE_TICKET",
      "Ticket " + id + " | Client: " + clientName + " | Items: " + items.map(it => it.orderedQty + "× " + itemLabel_(it)).join(", ")
    );
    return id;
  });

  let emailStatus = "not attempted";
  try {
    sendOrderEmail(info, items, ticketId);
    emailStatus = "sent successfully";
  } catch (e) {
    emailStatus = "ERROR: " + e.toString();
  }

  return { status: "success", ticketId: ticketId, emailStatus: emailStatus };
}

function updateTicket(data, auth) {
  const comment = String(data.comment || "").trim();
  const nextStatus = data.nextStatus ? String(data.nextStatus).trim().toUpperCase() : "";
  if (!nextStatus && !comment) return fail_("Nothing to update: add a comment.");
  if (nextStatus && nextStatus !== STATUS.PICKED_UP) {
    return fail_("Status " + nextStatus + " cannot be set here.", { code: "INVALID_STATE" });
  }

  return withLock_(() => {
    const ticketSheet = getTicketSheet_(false);
    if (!ticketSheet) return fail_("Ticket not found");
    const rows = ticketSheet.getDataRange().getValues();
    const i = findTicketRow_(rows, data.ticketId);
    if (i === -1) return fail_("Ticket not found");

    const current = String(rows[i][2] || "").trim();
    if (nextStatus && normalizeStatus_(current) !== STATUS.ORDERED) {
      return fail_("Ticket " + rows[i][0] + " is " + current + " and cannot be marked picked up.", { code: "INVALID_STATE" });
    }

    appendHistory_(ticketSheet, i + 1, current, auth.username, comment, nextStatus || current);
    if (nextStatus) ticketSheet.getRange(i + 1, 3).setValue(nextStatus);

    logAction(
      auth.username, auth.role,
      nextStatus ? ("STATUS_" + nextStatus) : "COMMENT",
      "Ticket " + rows[i][0] + (comment ? (" | " + comment) : "")
    );
    return { status: "success" };
  });
}

/** Finds the entry of the request that corresponds to a stored ticket item. */
function matchRequestItem_(requestItems, item, index) {
  const id = String(item.id || "").trim();
  const code = String(item.code || "").trim();
  let m = null;
  if (id) m = requestItems.find(d => d && String(d.id || "").trim() === id);
  if (!m && code) m = requestItems.find(d => d && String(d.code || "").trim() === code);
  if (!m && requestItems[index] && !String(requestItems[index].id || "").trim() && !String(requestItems[index].code || "").trim()) {
    m = requestItems[index];
  }
  return m || null;
}

/**
 * Shared logic for delivery (stock -) and return (stock +).
 * opts: { fromStatus, toStatus, qtyField, maxField, sign, logAction, logLabel }
 */
function applyStockMovement_(data, auth, opts) {
  const requestItems = Array.isArray(data.items) ? data.items : [];
  const comment = String(data.comment || "").trim();

  return withLock_(() => {
    const ticketSheet = getTicketSheet_(false);
    if (!ticketSheet) return fail_("Ticket not found");
    const rows = ticketSheet.getDataRange().getValues();
    const i = findTicketRow_(rows, data.ticketId);
    if (i === -1) return fail_("Ticket not found");

    const ticketId = rows[i][0];
    const current = String(rows[i][2] || "").trim();
    if (normalizeStatus_(current) !== opts.fromStatus) {
      return fail_("Ticket " + ticketId + " is " + (current || "without status") + "; this action is only allowed when it is " + opts.fromStatus + ". Nothing was changed.", { code: "INVALID_STATE" });
    }

    const ticketItems = parseJson_(rows[i][4], []);
    const errors = [];
    const planned = ticketItems.map((item, idx) => {
      const max = parseQty_(item[opts.maxField]) || 0;
      const match = matchRequestItem_(requestItems, item, idx);
      const qty = match ? parseQty_(match[opts.qtyField]) : max;
      if (qty === null) errors.push(itemLabel_(item) + ": quantity must be a whole number ≥ 0");
      else if (qty > max) errors.push(itemLabel_(item) + ": " + qty + " is more than " + max);
      return { item: item, qty: qty };
    });
    if (errors.length) return fail_("Invalid quantities – " + errors.join("; "), { code: "INVALID_QTY" });

    // Locate stock rows (id first, then code) before changing anything.
    const stockSheet = getStockSheet_();
    const stockData = stockSheet.getDataRange().getValues();
    const missing = [];
    planned.forEach(p => {
      p.row = findStockRow_(stockData, p.item);
      if (p.row === -1 && p.qty > 0) missing.push({ id: p.item.id || "", code: p.item.code || "", name: p.item.name || "" });
    });
    if (missing.length && !data.allowMissingStock) {
      return fail_(
        "These items were not found in the Inventory sheet (by id or code), so stock cannot be updated: " +
        missing.map(itemLabel_).join(", ") + ". Nothing was changed.",
        { code: "STOCK_NOT_FOUND", missing: missing }
      );
    }

    const warnings = [];
    planned.forEach(p => {
      if (p.row === -1 || p.qty === 0) return;
      const currentQty = stockQty_(stockData[p.row][5]);
      let newQty = currentQty + opts.sign * p.qty;
      if (newQty < 0) {
        warnings.push(itemLabel_(p.item) + ": stock was " + currentQty + ", set to 0");
        newQty = 0;
      }
      stockSheet.getRange(p.row + 1, 6).setValue(newQty);
      stockData[p.row][5] = newQty;
    });
    if (missing.length) warnings.push("Stock NOT updated (item not found): " + missing.map(itemLabel_).join(", "));

    const updatedItems = planned.map(p => {
      const out = Object.assign({}, p.item);
      out[opts.qtyField] = p.qty;
      return out;
    });

    appendHistory_(ticketSheet, i + 1, current, auth.username, comment, opts.toStatus);
    ticketSheet.getRange(i + 1, 3).setValue(opts.toStatus);
    ticketSheet.getRange(i + 1, 5).setValue(JSON.stringify(updatedItems));

    logAction(
      auth.username, auth.role, opts.logAction,
      "Ticket " + ticketId + " | " + opts.logLabel + ": " +
      updatedItems.map(it => (it[opts.qtyField] || 0) + "× " + it.name).join(", ") +
      (comment ? " | " + comment : "") +
      (warnings.length ? " | WARNING: " + warnings.join("; ") : "")
    );
    return { status: "success", warnings: warnings };
  });
}

/** PICKED_UP -> DELIVERED, subtracts delivered quantities from stock. */
function confirmDelivery(data, auth) {
  return applyStockMovement_(data, auth, {
    fromStatus: STATUS.PICKED_UP, toStatus: STATUS.DELIVERED,
    qtyField: "deliveredQty", maxField: "orderedQty", sign: -1,
    logAction: "CONFIRM_DELIVERY", logLabel: "Sent"
  });
}

/** DELIVERED -> CLOSED, adds returned quantities back to stock. */
function processReturn(data, auth) {
  return applyStockMovement_(data, auth, {
    fromStatus: STATUS.DELIVERED, toStatus: STATUS.CLOSED,
    qtyField: "returnedQty", maxField: "deliveredQty", sign: 1,
    logAction: "PROCESS_RETURN", logLabel: "Returned"
  });
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

function sendOrderEmail(info, items, ticketId) {
  const recipients = ORDER_EMAIL_RECIPIENTS
    .map(r => String(r || "").trim())
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(",");
  if (!recipients) return;

  MailApp.sendEmail({
    to: recipients,
    subject: ("New Ticket " + ticketId + " - " + (info.pm_bt || "Depozit BT")).replace(/[\r\n]+/g, " "),
    htmlBody: buildEmailHtml(info, items, ticketId),
    name: "Depozit BT"
  });
}

function escapeHtml_(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailHtml(info, items, ticketId) {
  const esc = escapeHtml_;
  // One paragraph per address: "Ridicare 2: address, localitate, județ / date interval · Tel: phone".
  const addressHtml = (section) => {
    const blocks = addressBlocks_(info, section);
    const title = ADDRESS_SECTIONS[section].title;
    return blocks.map((b, i) => `
    <p><b>${esc(title)}${blocks.length > 1 ? " " + (i + 1) : ""}:</b> ${esc(b.address)}, ${esc(b.localitate)}, ${esc(b.judet)}<br>
       ${esc(b.date)} ${esc(b.interval)} &nbsp; <b>Tel:</b> ${esc(b.phone)}</p>`).join("");
  };
  let html = `
  <div style="font-family:Segoe UI,Arial,sans-serif;color:#222;max-width:700px">
    <h2 style="color:#e11d48">New Ticket – ${esc(ticketId)}</h2>
    <p><b>PM BT:</b> ${esc(info.pm_bt)} &nbsp; <b>Tel:</b> ${esc(info.pm_bt_phone)}</p>`;
  html += addressHtml("pickups");
  html += addressHtml("deliveries");
  if (info.solicit_retur) html += addressHtml("returns");
  if (info.comments) html += `<p><b>Comentarii:</b> ${esc(info.comments)}</p>`;
  html += `<h3>Produse</h3>`;
  items.forEach(it => {
    html += `<div style="margin:8px 0;padding:8px;border:1px solid #fecdd3;border-radius:8px">
      <b>${esc(it.code || "")} ${esc(it.name)}</b> &times; ${esc(it.orderedQty || it.qty || 0)}
    </div>`;
  });
  html += `</div>`;
  return html;
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

function logAction(username, role, action, details) {
  const logSheet = getOrCreateSheet_("Logs");
  logSheet.appendRow([nowText_("yyyy-MM-dd HH:mm:ss"), safeCell_(username || "unknown"), role || "", action, safeCell_(details || "")]);
}

function getLogs() {
  const logSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Logs");
  if (!logSheet) return { status: "success", logs: [] };

  const data = logSheet.getDataRange().getValues();
  const logs = [];
  for (let i = data.length - 1; i >= 1; i--) {
    logs.push({
      timestamp: data[i][0],
      username: data[i][1],
      role: data[i][2],
      action: data[i][3],
      details: data[i][4]
    });
  }
  return { status: "success", logs: logs };
}

// ---------------------------------------------------------------------------
// User management (admin only)
// ---------------------------------------------------------------------------

function validateNewPassword_(password) {
  if (password.length < PASSWORD_MIN_LENGTH) return "Password must be at least " + PASSWORD_MIN_LENGTH + " characters.";
  if (password.length > 200) return "Password is too long.";
  return "";
}

function listUsers() {
  const users = readUsers_(getUsersSheet_()).map(u => ({ id: u.id, username: u.username, role: u.role }));
  return { status: "success", users: users };
}

function createUser(data, auth) {
  const username = String(data.username || "").trim();
  const password = String(data.password || "").trim();
  const role = String(data.role || "").trim().toLowerCase();

  if (!/^[A-Za-z0-9._@-]{2,50}$/.test(username)) {
    return fail_("Username must be 2–50 characters: letters, digits, . _ @ -");
  }
  const pwError = validateNewPassword_(password);
  if (pwError) return fail_(pwError);
  if (ROLES.indexOf(role) === -1) return fail_("Role must be a, b or admin.");

  return withLock_(() => {
    const sheet = getUsersSheet_();
    const users = readUsers_(sheet);
    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      return fail_("Username \"" + username + "\" already exists.");
    }
    const id = Utilities.getUuid();
    sheet.appendRow([id, username, hashPassword_(password), role]);
    logAction(auth.username, auth.role, "USER_CREATE", "Created user " + username + " (role " + role + ")");
    return { status: "success", user: { id: id, username: username, role: role } };
  });
}

function updateUser(data, auth, token) {
  const target = String(data.username || "").trim();
  const newRole = data.role !== undefined && data.role !== null && data.role !== "" ? String(data.role).trim().toLowerCase() : "";
  const newPassword = data.password !== undefined && data.password !== null && data.password !== "" ? String(data.password).trim() : "";

  if (!target) return fail_("Username is required.");
  if (!newRole && !newPassword) return fail_("Nothing to update.");
  if (newRole && ROLES.indexOf(newRole) === -1) return fail_("Role must be a, b or admin.");
  if (newPassword) {
    const pwError = validateNewPassword_(newPassword);
    if (pwError) return fail_(pwError);
  }

  return withLock_(() => {
    const sheet = getUsersSheet_();
    const users = readUsers_(sheet);
    const user = users.find(u => u.username.toLowerCase() === target.toLowerCase());
    if (!user) return fail_("User not found.");

    const isSelf = user.username.toLowerCase() === auth.username.toLowerCase();
    const changes = [];

    if (newRole && newRole !== user.role) {
      if (user.role === "admin") {
        if (isSelf) return fail_("You cannot remove your own admin role.");
        const admins = users.filter(u => u.role === "admin").length;
        if (admins <= 1) return fail_("You cannot remove the last admin.");
      }
      sheet.getRange(user.row, 4).setValue(newRole);
      changes.push("role " + user.role + " → " + newRole);
    }
    if (newPassword) {
      sheet.getRange(user.row, 3).setValue(hashPassword_(newPassword));
      changes.push("password reset");
    }
    if (!changes.length) return { status: "success", user: { id: user.id, username: user.username, role: user.role } };

    // Force the user to log in again so the new role/password takes effect (keep the admin's own session).
    revokeUserSessions_(user.username, isSelf ? token : "");
    logAction(auth.username, auth.role, "USER_UPDATE", "Updated user " + user.username + ": " + changes.join(", "));
    return { status: "success", user: { id: user.id, username: user.username, role: newRole || user.role } };
  });
}

function deleteUser(data, auth) {
  const target = String(data.username || "").trim();
  if (!target) return fail_("Username is required.");

  return withLock_(() => {
    const sheet = getUsersSheet_();
    const users = readUsers_(sheet);
    const user = users.find(u => u.username.toLowerCase() === target.toLowerCase());
    if (!user) return fail_("User not found.");
    if (user.username.toLowerCase() === auth.username.toLowerCase()) return fail_("You cannot delete your own account.");
    if (user.role === "admin" && users.filter(u => u.role === "admin").length <= 1) {
      return fail_("You cannot delete the last admin.");
    }

    sheet.deleteRow(user.row);
    revokeUserSessions_(user.username, "");
    logAction(auth.username, auth.role, "USER_DELETE", "Deleted user " + user.username + " (role " + user.role + ")");
    return { status: "success" };
  });
}

// ---------------------------------------------------------------------------
// One-time migration (run manually from the Apps Script editor)
// ---------------------------------------------------------------------------

/**
 * Copies the Users, Tickets and Logs tabs from the OLD spreadsheet into
 * SPREADSHEET_ID (the Inventory spreadsheet). Each tab is copied as a whole
 * (Sheet.copyTo), so values, number formats and text cells stay exactly the same.
 * A destination tab that already has data rows (more than the header row) is
 * NEVER overwritten, so it is safe to run this more than once. A destination
 * tab that is missing, blank or only has a header row is replaced by the copy.
 * It also adds the Inventory "visibleTo" header if it is missing.
 * Returns (and logs) a short report.
 */
function migrateFromOldSpreadsheet() {
  const OLD_SPREADSHEET_ID = "1Rmocqx561jUo8pTUrsEjM08B3x8uDqum7KX9e_ioDpI"; // old location of Users/Tickets/Logs
  if (OLD_SPREADSHEET_ID === SPREADSHEET_ID) throw new Error("Old and new spreadsheet are the same.");

  const report = withLock_(() => {
    const src = SpreadsheetApp.openById(OLD_SPREADSHEET_ID);
    const dst = SpreadsheetApp.openById(SPREADSHEET_ID);
    const lines = [];

    ["Users", "Tickets", "Logs"].forEach(name => {
      const from = src.getSheetByName(name);
      if (!from) {
        lines.push(name + ": not found in the old spreadsheet – skipped.");
        return;
      }
      const srcValues = from.getDataRange().getValues();
      const srcRows = from.getLastRow();

      const existing = dst.getSheetByName(name);
      if (existing && existing.getLastRow() > 1) {
        lines.push(name + ": NOT copied – the destination tab already has " + (existing.getLastRow() - 1) + " data row(s). Nothing was overwritten.");
        return;
      }

      const copy = from.copyTo(dst);
      if (existing) dst.deleteSheet(existing);
      copy.setName(name);

      // Verify the copy value by value.
      const dstValues = copy.getDataRange().getValues();
      const same = JSON.stringify(dstValues) === JSON.stringify(srcValues);
      lines.push(name + ": copied " + Math.max(0, srcRows - 1) + " data row(s)" + (srcRows ? " + header" : "") +
        (same ? " – verified identical." : " – WARNING: values differ after copy, please check the tab."));
    });
    try {
      lines.push(ensureVisibleToColumn_());
    } catch (e) {
      lines.push("Inventory: could not check the visibleTo column – " + e.message);
    }
    return lines;
  });

  report.forEach(line => Logger.log(line));
  logAction("script editor", "admin", "MIGRATE", "migrateFromOldSpreadsheet: " + report.join(" | "));
  return report.join("\n");
}
