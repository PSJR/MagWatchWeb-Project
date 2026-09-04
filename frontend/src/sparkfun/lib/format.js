/**
 * Number and text formatting.
 * Rules come from /design/02-typography.md § 2 — they are load-bearing:
 * every live number is tabular and abbreviations are fixed at 3 significant
 * digits so a ticking price never reflows the layout.
 */

const SUBSCRIPTS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

/**
 * BigInt wei -> Number, for display only. Contract amounts are BigInt
 * everywhere they matter; this is the single place they become lossy, and it
 * only ever feeds text on screen.
 */
export function fromUnits(value, decimals = 18) {
  if (value === null || value === undefined) return 0;
  const big = typeof value === 'bigint' ? value : toBigIntOrNull(value);
  if (big === null) return Number(value);
  const base = 10n ** BigInt(decimals);
  return Number(big / base) + Number(big % base) / Number(base);
}

/**
 * Raw base units reach the client in two shapes and only two:
 *   - BigInt, from curve.js and from contract reads
 *   - a decimal integer *string*, from the API, because uint256 does not fit
 *     any numeric BSON type (Decimal128 stops at 34 digits) so the indexer
 *     stores it exactly as text
 * Every already-scaled value is a JSON number. So "digits-only string" is an
 * unambiguous marker for raw units, and treating it as scaled prints wei —
 * which is exactly what the live feed used to do.
 */
const RAW_INTEGER = /^-?\d+$/;

function toBigIntOrNull(value) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'string' && RAW_INTEGER.test(value.trim())) {
    try {
      return BigInt(value.trim());
    } catch {
      return null;
    }
  }
  return null;
}

/** Number -> BigInt wei, rounding down. Used when the user types an amount. */
export function toUnits(value, decimals = 18) {
  const text = String(value ?? '').trim();
  if (!text || Number.isNaN(Number(text))) return 0n;
  const [whole = '0', frac = ''] = text.split('.');
  const padded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(padded || '0');
}

const asNumber = (n, decimals) => (toBigIntOrNull(n) !== null ? fromUnits(n, decimals) : n);

/** U+2212 MINUS SIGN — never a hyphen in front of a number. */
export const MINUS = '−';

export function compact(value, { prefix = '', digits = 3, decimals = 18 } = {}) {
  const n = asNumber(value, decimals);
  if (n === null || n === undefined || Number.isNaN(n)) return `${prefix}—`;
  const abs = Math.abs(n);
  const sign = n < 0 ? MINUS : '';
  const unit = abs >= 1e9 ? ['B', 1e9] : abs >= 1e6 ? ['M', 1e6] : abs >= 1e3 ? ['K', 1e3] : ['', 1];
  const v = abs / unit[1];
  const places = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  const body = unit[0] ? v.toFixed(places) : v.toFixed(abs >= 1 ? 2 : Math.min(digits, 4));
  return `${sign}${prefix}${trimZeros(body)}${unit[0]}`;
}

export function usd(n, opts = {}) {
  return compact(n, { prefix: '$', ...opts });
}

/**
 * Sub-cent prices use subscript zero notation: $0.0₅418 rather than a wall of
 * zeros that no one can count at a glance.
 */
export function price(value, { prefix = '$', decimals = 18 } = {}) {
  const n = asNumber(value, decimals);
  if (!(n > 0)) return `${prefix}0.00`;
  if (n >= 1) return `${prefix}${n.toFixed(2)}`;
  if (n >= 0.01) return `${prefix}${n.toFixed(4)}`;

  const exp = Math.floor(Math.log10(n));
  const zeros = -exp - 1;
  const digits = Math.round(n * Math.pow(10, exp === 0 ? 0 : -exp + 2));
  if (zeros < 2) return `${prefix}${n.toFixed(6)}`;
  return `${prefix}0.0${subscript(zeros)}${String(digits).slice(0, 3)}`;
}

function subscript(n) {
  return String(n).split('').map((d) => SUBSCRIPTS[Number(d)]).join('');
}

/** Percentages always carry an explicit sign — colour is never the only cue. */
export function pct(n, { digits = 1, sign = true } = {}) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const v = n * 100;
  const s = v < 0 ? MINUS : sign ? '+' : '';
  return `${s}${Math.abs(v).toFixed(digits)}%`;
}

export function tokenAmount(value) {
  const n = asNumber(value, 18);
  if (!(n > 0)) return '0';
  if (n >= 1e6) return compact(n);
  return Math.round(n).toLocaleString('pt-BR');
}

export function quote(value, pair = 'ETH') {
  const n = asNumber(value, pair === 'USDC' ? 6 : 18);
  if (pair === 'USDC') return usd(n);
  if (!(n > 0)) return '0 ETH';
  if (n >= 1000) return `${compact(n)} ETH`;
  const places = n >= 10 ? 2 : n >= 1 ? 3 : n >= 0.001 ? 4 : 6;
  return `${trimZeros(n.toFixed(places))} ETH`;
}

/**
 * Format a value in its own denomination.
 *
 * A token paired against ETH has its market cap, volume and fees denominated
 * in ETH, not dollars — printing `$` on those was simply wrong. Showing a USD
 * figure for ETH pairs needs an ETH/USD feed, which the platform does not have
 * yet; until it does, values are shown honestly in the pair's own unit.
 */
export function money(value, pair = 'ETH', opts) {
  return pair === 'USDC' ? usd(asNumber(value, 6), opts) : quote(value, pair);
}

/** 0x7f2a…9C41 — six leading, four trailing, per the spec. */
export function truncAddress(addr, lead = 6, tail = 4) {
  if (!addr) return '';
  if (addr.length <= lead + tail + 1) return addr;
  return `${addr.slice(0, lead)}…${addr.slice(-tail)}`;
}

export function relTime(iso, now = Date.now()) {
  const t = typeof iso === 'number' ? iso : Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 3) return 'agora';
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function joinedOn(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function trimZeros(s) {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/** Deterministic 32-bit hash — drives generated mascots and avatar colours. */
export function hashCode(str = '') {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
