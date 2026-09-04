import React, { useState } from 'react';
import { Button, Card, Field } from './ui';
import { useWallet } from '../hooks/useWallet';
import { CHAIN } from '../lib/chain';

/**
 * Managing a wallet created in this browser: see the seed phrase, or delete it.
 *
 * Both are irreversible in different directions, so both re-ask for the
 * password — an unlocked session is not consent to reveal a key, and it is not
 * consent to destroy one either. Shown only for the embedded wallet; an
 * extension manages its own keys and this must not pretend otherwise.
 */
export default function WalletCard() {
  const { hasEmbeddedWallet, embeddedAddress, connector, exportPhrase, removeEmbedded, disconnect } = useWallet();
  const [mode, setMode] = useState(null);
  const [password, setPassword] = useState('');
  const [phrase, setPhrase] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!hasEmbeddedWallet) return null;

  const reset = () => { setMode(null); setPassword(''); setPhrase(null); setError(null); };

  const reveal = async () => {
    setBusy(true); setError(null);
    try {
      setPhrase(await exportPhrase(password));
      setPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const wipe = async () => {
    setBusy(true); setError(null);
    try {
      await removeEmbedded(password);
      await disconnect();
      reset();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Card className="mt-8 p-5">
      <h2 className="disp text-heading-md">Your wallet</h2>
      <p className="text-caption text-ink3 mt-0.5">
        Created in this browser · {CHAIN.name}
        {connector !== 'embedded' && ' · locked'}
      </p>
      <p className="num text-[13px] text-ink mt-3 break-all">{embeddedAddress}</p>

      {!mode && (
        <div className="flex flex-wrap gap-2 mt-4">
          <Button size="md" variant="secondary" onClick={() => setMode('reveal')}>
            Show my seed phrase
          </Button>
          <Button size="md" variant="ghost" onClick={() => setMode('remove')}>
            Remove from this browser
          </Button>
        </div>
      )}

      {mode === 'reveal' && !phrase && (
        <div className="mt-4 max-w-sm">
          <p className="text-[13px] text-ink2 mb-3">
            Make sure nobody can see your screen. Anyone who reads these words
            owns the wallet.
          </p>
          <Field
            type="password" label="Wallet password" placeholder="your password"
            error={error}
            value={password} onChange={(e) => { setError(null); setPassword(e.target.value); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && password) reveal(); }}
          />
          <div className="flex gap-2">
            <Button size="md" loading={busy} disabled={!password} onClick={reveal}>Show it</Button>
            <Button size="md" variant="ghost" onClick={reset}>Cancel</Button>
          </div>
        </div>
      )}

      {phrase && (
        <div className="mt-4 max-w-sm">
          <ol className="grid grid-cols-3 gap-1.5 bg-sunken rounded-lg p-3">
            {phrase.split(' ').map((w, i) => (
              <li key={i} className="num text-[12px] text-ink flex gap-1.5">
                <span className="text-ink3 w-4 text-right shrink-0">{i + 1}</span>
                <span className="font-semibold">{w}</span>
              </li>
            ))}
          </ol>
          <Button size="md" variant="secondary" onClick={reset} className="mt-3">
            Hide
          </Button>
        </div>
      )}

      {mode === 'remove' && (
        <div className="mt-4 max-w-sm">
          <p className="text-[13px] text-ink2 mb-3">
            This deletes the only copy of the wallet on this device. Without the
            seed phrase written down, anything it holds is gone for good — we
            have no copy to restore from.
          </p>
          <Field
            type="password" label="Confirm with your password" placeholder="your password"
            error={error}
            value={password} onChange={(e) => { setError(null); setPassword(e.target.value); }}
          />
          <div className="flex gap-2">
            <Button size="md" variant="sell" loading={busy} disabled={!password} onClick={wipe}>
              Delete the wallet
            </Button>
            <Button size="md" variant="ghost" onClick={reset}>Keep it</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
