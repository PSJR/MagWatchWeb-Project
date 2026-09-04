/**
 * Wallet created in the browser, for people who sign in with an email.
 *
 * Non-custodial on purpose. The seed phrase is generated here, encrypted here,
 * and the ciphertext is all that is ever stored. The server never receives the
 * phrase or the key — it only learns the public address, and only after the
 * wallet proves ownership by signing a nonce. So spark.fun cannot move these
 * funds, cannot recover them, and cannot be compelled to.
 *
 * That is the trade: no custody also means no password reset. Losing both the
 * password and the backup phrase loses the wallet, which is why create() hands
 * the phrase back for the user to write down and the UI refuses to continue
 * until they confirm they have.
 *
 * Crypto: PBKDF2-SHA256 at 600k iterations (OWASP's 2023 floor) derives a
 * 256-bit key; AES-GCM encrypts the phrase with a random 96-bit IV. Salt and
 * IV are per-wallet and stored alongside the ciphertext, which is standard —
 * neither is secret.
 */
import { english, generateMnemonic, mnemonicToAccount } from 'viem/accounts';

const STORAGE_KEY = 'sparkfun.wallet';
const FORMAT_VERSION = 1;
const PBKDF2_ITERATIONS = 600_000;
const MIN_PASSWORD_LENGTH = 10;

/** Decrypted account lives in memory for the session only, never on disk. */
let unlockedAccount = null;

const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

function subtle() {
  const c = typeof window !== 'undefined' && (window.crypto || window.msCrypto);
  if (!c?.subtle) {
    // Browsers only expose WebCrypto on secure origins. Without it there is no
    // safe way to do this, so refuse rather than fall back to something weaker.
    throw new Error(
      'This browser cannot create a wallet securely. It needs HTTPS (or localhost).',
    );
  }
  return c;
}

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.v === FORMAT_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

export function hasWallet() {
  return Boolean(readStored());
}

export function walletAddress() {
  return readStored()?.address || null;
}

export function isUnlocked() {
  return Boolean(unlockedAccount);
}

/**
 * The signer, for callers about to sign or send. Throws when locked rather
 * than returning null: every caller reaches straight for .signMessage, so a
 * null would surface as "cannot read properties of null" instead of the one
 * thing the user can act on, which is entering their password again.
 */
export function getAccount() {
  if (!unlockedAccount) {
    throw new Error('The wallet is locked. Enter your password to unlock it.');
  }
  return unlockedAccount;
}

export function lock() {
  unlockedAccount = null;
}

async function deriveKey(password, salt, iterations = PBKDF2_ITERATIONS) {
  const crypto = subtle();
  const base = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptPhrase(phrase, password) {
  const crypto = subtle();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(phrase));
  return {
    v: FORMAT_VERSION,
    iterations: PBKDF2_ITERATIONS,
    salt: toB64(salt),
    iv: toB64(iv),
    ct: toB64(ct),
  };
}

async function decryptPhrase(stored, password) {
  const crypto = subtle();
  const key = await deriveKey(password, fromB64(stored.salt), stored.iterations);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(stored.iv) }, key, fromB64(stored.ct),
    );
    return dec.decode(plain);
  } catch {
    // AES-GCM fails authentication on a wrong password; it is indistinguishable
    // from corrupted data, and saying "wrong password" is the useful reading.
    throw new Error('Wrong password.');
  }
}

export function validatePassword(password) {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters — this is the only thing protecting the wallet.`;
  }
  return null;
}

/**
 * Creates a wallet and returns the phrase so the caller can show it once.
 * Refuses to overwrite an existing wallet: that would strand any funds in it.
 */
export async function create(password) {
  const problem = validatePassword(password);
  if (problem) throw new Error(problem);
  if (hasWallet()) {
    throw new Error('A wallet already exists in this browser. Unlock it, or remove it first.');
  }

  const phrase = generateMnemonic(english);
  const account = mnemonicToAccount(phrase);
  const stored = await encryptPhrase(phrase, password);

  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, address: account.address }));
  unlockedAccount = account;

  return { address: account.address, phrase };
}

export async function unlock(password) {
  const stored = readStored();
  if (!stored) throw new Error('No wallet in this browser.');
  const phrase = await decryptPhrase(stored, password);
  const account = mnemonicToAccount(phrase);
  if (account.address.toLowerCase() !== String(stored.address).toLowerCase()) {
    throw new Error('This wallet data does not match its address. Restore from your phrase.');
  }
  unlockedAccount = account;
  return account;
}

/** Re-asks for the password: showing a phrase should never ride on an old unlock. */
export async function exportPhrase(password) {
  const stored = readStored();
  if (!stored) throw new Error('No wallet in this browser.');
  return decryptPhrase(stored, password);
}

/**
 * Restores a wallet from a phrase the user already has.
 *
 * Only one wallet is stored per browser, so importing replaces what is there.
 * That is fine when it is the same wallet, and destructive when it is not: the
 * stored ciphertext is the only copy, so replacing a *different* wallet strands
 * whatever it holds. Hence `replace` — the caller has to have asked the user
 * about that specific address first.
 */
export async function importPhrase(phrase, password, { replace = false } = {}) {
  const problem = validatePassword(password);
  if (problem) throw new Error(problem);

  const cleaned = String(phrase).trim().toLowerCase().split(/\s+/).join(' ');
  const words = cleaned.split(' ');
  if (![12, 15, 18, 21, 24].includes(words.length)) {
    throw new Error(
      `A seed phrase has 12 or 24 words — this one has ${words.length}. Check for a missing one.`,
    );
  }

  let account;
  try {
    account = mnemonicToAccount(cleaned);
  } catch {
    throw new Error('That phrase is not valid. Check the spelling and the word order.');
  }

  const existing = walletAddress();
  if (existing && !replace && existing.toLowerCase() !== account.address.toLowerCase()) {
    const err = new Error(
      `This browser already holds a different wallet (${existing}). Importing this phrase `
      + 'replaces it, and anything in the old one becomes unreachable without its own phrase.',
    );
    err.code = 'WOULD_REPLACE';
    err.existing = existing;
    err.incoming = account.address;
    throw err;
  }

  const stored = await encryptPhrase(cleaned, password);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, address: account.address }));
  unlockedAccount = account;
  return { address: account.address };
}

/**
 * Deletes the wallet from this browser. Requires the password, so a stale
 * session cannot wipe it, and it is irreversible without the phrase.
 */
export async function remove(password) {
  const stored = readStored();
  if (!stored) return;
  await decryptPhrase(stored, password);
  localStorage.removeItem(STORAGE_KEY);
  unlockedAccount = null;
}
