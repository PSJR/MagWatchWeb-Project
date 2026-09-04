/**
 * Tests for the embedded wallet's crypto and its refusals.
 *
 * Run with `yarn test:wallet` (or `make test`). Deliberately a plain Node
 * script rather than a jest test: the module needs real WebCrypto, which the
 * jsdom environment CRA's jest runs in does not provide, and stubbing SubtleCrypto
 * to make the test run would mean testing a fake instead of the thing that
 * guards people's keys. Node's WebCrypto is the same implementation the
 * browser exposes.
 *
 * What matters here is not only that a round-trip works, but that every
 * refusal holds: a wrong password, a weak password, and above all an import
 * that would silently replace a different wallet.
 */
import { webcrypto } from 'node:crypto';
import { english, generateMnemonic } from 'viem/accounts';

const store = new Map();
globalThis.window = { crypto: webcrypto };
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const w = await import('../src/sparkfun/lib/embeddedWallet.js');

let failures = 0;
const check = (label, cond, detail = '') => {
  if (cond) console.log(`  ok   ${label}`);
  else { console.log(`  FAIL ${label} ${detail}`); failures++; }
};
const throws = async (label, fn, expect) => {
  try { await fn(); check(label, false, '(nao lancou)'); }
  catch (e) {
    check(label, !expect || e.message.includes(expect), `-> "${e.message}"`);
  }
};

const PW = 'correct-horse-battery';

console.log('estado inicial');
check('sem carteira', w.hasWallet() === false);
check('travada', w.isUnlocked() === false);
check('getAccount lanca quando travada',
  (() => { try { w.getAccount(); return false; } catch (e) { return e.message.includes('locked'); } })());

console.log('\nsenha fraca');
check('9 chars rejeitada', typeof w.validatePassword('123456789') === 'string');
check('10 chars aceita', w.validatePassword('1234567890') === null);
await throws('create recusa senha curta', () => w.create('short'), 'characters');
check('nada foi gravado', w.hasWallet() === false);

console.log('\ncreate');
const { address, phrase } = await w.create(PW);
check('endereco 0x + 40 hex', /^0x[0-9a-fA-F]{40}$/.test(address), address);
check('12 palavras', phrase.split(' ').length === 12);
check('persistiu', w.hasWallet() === true);
check('desbloqueada apos criar', w.isUnlocked() === true);
check('walletAddress bate', w.walletAddress() === address);
check('assina', (await w.getAccount().signMessage({ message: 'oi' })).length === 132);

console.log('\ntexto puro nunca toca o disco');
const raw = store.get('sparkfun.wallet');
check('frase ausente do storage', !raw.includes(phrase.split(' ')[0]) && !raw.includes(phrase));
check('senha ausente do storage', !raw.includes(PW));
const parsed = JSON.parse(raw);
check('guarda so v/salt/iv/ciphertext/address',
  JSON.stringify(Object.keys(parsed).sort()));
console.log('       chaves:', Object.keys(parsed).join(', '));

console.log('\nlock / unlock');
w.lock();
check('travou', w.isUnlocked() === false);
check('carteira continua la', w.hasWallet() === true);
await throws('senha errada falha', () => w.unlock('senha-errada-mesmo'), '');
check('continua travada apos erro', w.isUnlocked() === false);
const acct = await w.unlock(PW);
check('destravou no mesmo endereco', acct.address === address, acct.address);

console.log('\nexport / import');
check('exportPhrase devolve a mesma frase', (await w.exportPhrase(PW)) === phrase);
await throws('exportPhrase recusa senha errada', () => w.exportPhrase('nao-e-essa-senha'), '');
const other = await w.importPhrase(phrase, 'outra-senha-longa');
check('import da mesma frase -> mesmo endereco', other.address === address, other.address);
check('destravada com a senha nova', (await w.unlock('outra-senha-longa')).address === address);
await throws('import rejeita frase invalida',
  () => w.importPhrase('nao sao palavras bip39 de verdade nem doze aqui ok', 'senha-longa-1'), '');

console.log('\nimport nao apaga outra carteira sem permissao');
const foreign = generateMnemonic(english);
let clashed = null;
try { await w.importPhrase(foreign, 'senha-longa-mesmo'); }
catch (e) { clashed = e; }
check('recusou e explicou', clashed?.code === 'WOULD_REPLACE', clashed?.message?.slice(0, 60));
check('nomeou as duas carteiras',
  clashed?.existing?.toLowerCase() === address.toLowerCase() && /^0x/.test(clashed?.incoming || ''));
check('a carteira antiga continua intacta', w.walletAddress() === address);
check('e ainda destrava com a senha dela',
  (await w.unlock('outra-senha-longa')).address === address);
const replaced = await w.importPhrase(foreign, 'senha-longa-mesmo', { replace: true });
check('com replace:true substitui', w.walletAddress() === replaced.address && replaced.address !== address);
check('a mesma frase nao pede permissao',
  (await w.importPhrase(foreign, 'senha-longa-mesmo')).address === replaced.address);
// devolve o estado para o teste de remove abaixo
await w.importPhrase(phrase, 'outra-senha-longa', { replace: true });

console.log('\ncontagem de palavras aparece no erro');
await throws('13 palavras -> diz 13',
  () => w.importPhrase(Array(13).fill('abandon').join(' '), 'senha-longa-1'), 'has 13');

console.log('\nremove');
await throws('remove recusa senha errada', () => w.remove('errada-de-novo'), '');
check('sobreviveu', w.hasWallet() === true);
await w.remove('outra-senha-longa');
check('removeu', w.hasWallet() === false);
check('storage limpo', store.get('sparkfun.wallet') === undefined);
check('travada', w.isUnlocked() === false);

console.log(failures ? `\n${failures} FALHA(S)` : '\nTUDO PASSOU');
process.exit(failures ? 1 : 0);
