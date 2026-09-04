import React, { useEffect, useState } from 'react';
import { Button, Field } from './ui';
import { Ember } from './mascots';
import { useWallet } from '../hooks/useWallet';
import { CHAIN, CHAIN_ID } from '../lib/chain';
import { truncAddress } from '../lib/format';

/**
 * Ways in, in order of preference:
 *
 *   1. a browser wallet — the user already has keys and something that keeps them
 *   2. an email, and spark.fun creates a wallet in the browser
 *   3. unlock or restore a wallet created here before
 *
 * The seed phrase is shown exactly once, and the dialog will not let the user
 * past it without confirming they wrote it down. There is no reset: nobody
 * else has this key, which is the point and also the risk.
 */
export default function WalletDialog({ onClose }) {
  const {
    connect, createEmbedded, unlockEmbedded, importEmbedded,
    connecting, error, hasInjected, hasEmbeddedWallet, embeddedAddress, validatePassword,
  } = useWallet();

  const [step, setStep] = useState(hasEmbeddedWallet ? 'unlock' : 'choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [phraseInput, setPhraseInput] = useState('');
  const [created, setCreated] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [clash, setClash] = useState(null);

  useEffect(() => {
    const onKey = (e) => {
      // Escaping mid-phrase would lose the only copy of it.
      if (e.key === 'Escape' && step !== 'phrase') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, step]);

  const run = async (fn) => {
    setLocalError(null);
    setBusy(true);
    try {
      return await fn();
    } catch (err) {
      setLocalError(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const shown = clash ? null : localError || error;

  return (
    <div
      className="fixed inset-0 z-[500] grid place-items-end sm:place-items-center p-0 sm:p-6
                 bg-[rgba(46,32,25,.42)] backdrop-blur-md animate-rise-in"
      onClick={step === 'phrase' ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Connect a wallet"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-[440px] max-h-[92vh] overflow-y-auto bg-raised
                   rounded-t-3xl sm:rounded-2xl p-6 shadow-xl animate-pop-in"
      >
        <div className="flex items-center gap-3 mb-1">
          <Ember size={44} mood={step === 'phrase' ? 'cheer' : 'happy'} className="animate-bob" />
          <div>
            <h2 className="disp text-heading-lg">
              {step === 'choose' && 'Come on in'}
              {step === 'email' && 'Create a wallet'}
              {step === 'phrase' && 'Write these down'}
              {step === 'unlock' && 'Unlock your wallet'}
              {step === 'import' && 'Restore a wallet'}
            </h2>
            <p className="text-caption text-ink3">{CHAIN.name} · {CHAIN_ID}</p>
          </div>
        </div>

        {step === 'choose' && (
          <Choose
            hasInjected={hasInjected}
            connecting={connecting || busy}
            onBrowser={() => run(() => connect().then(onClose))}
            onEmail={() => setStep('email')}
            onImport={() => setStep('import')}
          />
        )}

        {step === 'email' && (
          <CreateForm
            {...{ email, setEmail, password, setPassword, confirm, setConfirm, validatePassword }}
            busy={connecting || busy}
            onBack={() => setStep('choose')}
            onSubmit={() => run(async () => {
              const result = await createEmbedded({ email, password });
              setCreated(result);
              setStep('phrase');
            })}
          />
        )}

        {step === 'phrase' && created && (
          <PhraseReveal
            phrase={created.phrase}
            address={created.address}
            saved={saved}
            setSaved={setSaved}
            onDone={onClose}
          />
        )}

        {step === 'unlock' && (
          <UnlockForm
            address={embeddedAddress}
            password={password}
            setPassword={(v) => { setLocalError(null); setPassword(v); }}
            error={shown}
            busy={connecting || busy}
            onSubmit={() => run(() => unlockEmbedded(password).then(onClose))}
            onOther={() => setStep('choose')}
          />
        )}

        {step === 'import' && (
          <ImportForm
            {...{ phraseInput, setPhraseInput, password, setPassword, validatePassword }}
            busy={connecting || busy}
            clash={clash}
            onBack={() => { setClash(null); setStep('choose'); }}
            onSubmit={(replace = false) => run(async () => {
              try {
                await importEmbedded({ phrase: phraseInput, password, replace });
                onClose();
              } catch (err) {
                // Not a failure yet: the user has to decide about the wallet
                // already here, which only they can see the value of.
                if (err.code === 'WOULD_REPLACE') { setClash(err); return; }
                throw err;
              }
            })}
          />
        )}

        {shown && step !== 'phrase' && step !== 'unlock' && (
          <p className="text-caption text-coral-800 bg-coral-100 rounded-md px-3 py-2 mt-3">{shown}</p>
        )}

        {step !== 'phrase' && (
          <p className="text-caption text-ink3 mt-5 leading-relaxed">
            You keep custody either way: signing in proves who you are and
            authorises no transaction. Tokens created here carry no guarantee and
            no promise of value. Most go to zero. We keep it fun — but the risk is
            real.
          </p>
        )}
      </div>
    </div>
  );
}

function Choose({ hasInjected, connecting, onBrowser, onEmail, onImport }) {
  return (
    <>
      <div className="mt-5 space-y-2">
        <Button
          full size="xl" loading={connecting}
          variant={hasInjected ? 'primary' : 'secondary'}
          onClick={onBrowser}
        >
          Connect wallet
        </Button>
        <p className="text-caption text-ink3 text-center">
          {hasInjected
            ? 'Uses the wallet already in this browser. It keeps your keys.'
            : 'No wallet found in this browser — install MetaMask or Rabby, or use an email below.'}
        </p>
      </div>

      <div className="flex items-center gap-3 my-5">
        <span className="flex-1 h-px bg-subtle" />
        <span className="text-caption text-ink3">or</span>
        <span className="flex-1 h-px bg-subtle" />
      </div>

      <Button
        full size={hasInjected ? 'lg' : 'xl'}
        variant={hasInjected ? 'secondary' : 'primary'}
        onClick={onEmail}
      >
        Use an email and create a wallet
      </Button>
      <p className="text-caption text-ink3 mt-2">
        spark.fun makes the wallet in this browser and encrypts it with your password.
        The key never reaches our servers, so we cannot move your funds — and cannot
        reset your password either.
      </p>

      <button
        type="button"
        onClick={onImport}
        className="mt-4 text-caption text-ink3 underline hover:text-ink"
      >
        I already have a seed phrase
      </button>
    </>
  );
}

function CreateForm({
  email, setEmail, password, setPassword, confirm, setConfirm,
  validatePassword, busy, onBack, onSubmit,
}) {
  const weak = password ? validatePassword(password) : null;
  const mismatch = confirm && password !== confirm ? 'The two passwords do not match.' : null;
  const ready = email.includes('@') && !weak && !mismatch && confirm;

  return (
    <>
      <Field
        type="email" label="Email" placeholder="you@email.com"
        hint="Only to find your profile again. No password is stored on our side."
        value={email} onChange={(e) => setEmail(e.target.value)}
      />
      <Field
        type="password" label="Wallet password" placeholder="at least 10 characters"
        error={weak}
        hint="This encrypts the wallet on this device. We never see it and cannot reset it."
        value={password} onChange={(e) => setPassword(e.target.value)}
      />
      <Field
        type="password" label="Repeat the password" placeholder="again"
        error={mismatch}
        value={confirm} onChange={(e) => setConfirm(e.target.value)}
      />

      <Button full size="xl" loading={busy} disabled={!ready} onClick={onSubmit}>
        Create my wallet
      </Button>
      <Button full size="md" variant="ghost" onClick={onBack} className="mt-2">
        Back
      </Button>
    </>
  );
}

function PhraseReveal({ phrase, address, saved, setSaved, onDone }) {
  const [copied, setCopied] = useState(false);
  const words = phrase.split(' ');

  return (
    <>
      <p className="text-[13px] text-ink2 mt-4">
        These twelve words <strong>are</strong> your wallet. Anyone who has them owns
        it, and nobody — including us — can recover it for you. Write them on paper,
        in order, and keep them somewhere only you can reach.
      </p>

      <ol className="grid grid-cols-3 gap-1.5 mt-4 bg-sunken rounded-lg p-3">
        {words.map((w, i) => (
          <li key={i} className="num text-[12px] text-ink flex gap-1.5">
            <span className="text-ink3 w-4 text-right shrink-0">{i + 1}</span>
            <span className="font-semibold">{w}</span>
          </li>
        ))}
      </ol>

      <p className="num text-caption text-ink3 mt-2">{truncAddress(address, 10, 8)}</p>

      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(phrase);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="mt-3 text-caption text-ink3 underline hover:text-ink"
      >
        {copied ? 'Copied — now put it somewhere safe' : 'Copy to clipboard'}
      </button>
      <p className="text-caption text-ink3 mt-1">
        A clipboard is not a safe place to leave it. Paper is.
      </p>

      <label className="flex items-start gap-2.5 mt-5 cursor-pointer">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-[var(--accent)]"
        />
        <span className="text-[13px] text-ink2">
          I wrote down the twelve words. I understand that losing them and my
          password means losing the wallet, with no way back.
        </span>
      </label>

      <Button full size="xl" disabled={!saved} onClick={onDone} className="mt-4">
        {saved ? "Let's go" : 'Confirm you saved them'}
      </Button>
    </>
  );
}

function UnlockForm({ address, password, setPassword, error, busy, onSubmit, onOther }) {
  return (
    <>
      <p className="text-[13px] text-ink2 mt-4">
        There is a wallet saved in this browser.
      </p>
      <p className="num text-caption text-ink3 mb-3">{truncAddress(address || '', 10, 8)}</p>

      <Field
        type="password" label="Wallet password" placeholder="your password"
        error={error}
        value={password} onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && password) onSubmit(); }}
      />
      <Button full size="xl" loading={busy} disabled={!password} onClick={onSubmit}>
        Unlock
      </Button>
      <Button full size="md" variant="ghost" onClick={onOther} className="mt-2">
        Use a different wallet
      </Button>
    </>
  );
}

function ImportForm({
  phraseInput, setPhraseInput, password, setPassword, validatePassword, busy, clash, onBack, onSubmit,
}) {
  const weak = password ? validatePassword(password) : null;
  const words = phraseInput.trim() ? phraseInput.trim().split(/\s+/).length : 0;
  const ready = words >= 12 && !weak;

  if (clash) {
    return (
      <>
        <p className="text-[13px] text-ink2 mt-4">
          There is already a different wallet in this browser:
        </p>
        <p className="num text-[13px] text-ink font-semibold mt-1">{clash.existing}</p>
        <p className="text-[13px] text-ink2 mt-3">
          The phrase you pasted is for{' '}
          <span className="num font-semibold">{truncAddress(clash.incoming, 10, 8)}</span>.
          Only one wallet is kept here, so importing replaces the one above —
          and without its own seed phrase, anything in it becomes unreachable.
        </p>
        <Button full size="xl" variant="sell" loading={busy} onClick={() => onSubmit(true)} className="mt-4">
          Replace it anyway
        </Button>
        <Button full size="md" variant="ghost" onClick={onBack} className="mt-2">
          Keep the wallet I have
        </Button>
      </>
    );
  }

  return (
    <>
      <Field
        as="textarea" rows={3} label="Seed phrase"
        placeholder="twelve words, separated by spaces"
        hint={words ? `${words} words` : 'From this wallet or any other — it stays on this device.'}
        value={phraseInput} onChange={(e) => setPhraseInput(e.target.value)}
        className="[&_textarea]:num [&_textarea]:text-[13px]"
      />
      <Field
        type="password" label="New password for this device" placeholder="at least 10 characters"
        error={weak}
        value={password} onChange={(e) => setPassword(e.target.value)}
      />
      <Button full size="xl" loading={busy} disabled={!ready} onClick={() => onSubmit(false)}>
        Restore
      </Button>
      <Button full size="md" variant="ghost" onClick={onBack} className="mt-2">
        Back
      </Button>
    </>
  );
}
