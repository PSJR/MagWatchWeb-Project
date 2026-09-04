import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Field, Tag, cx } from './ui';
import { useCelebration } from './Celebration';
import { useWallet } from '../hooks/useWallet';
import { useCurveState } from '../hooks/useCurve';
import { buy as buyOnChain, sell as sellOnChain } from '../lib/contracts';
import { uniswapTradeUrl } from '../lib/chain';
import { curveParams, quoteBuy, quoteSell, priceImpact } from '../lib/curve';
import { money, pct, toUnits, tokenAmount, truncAddress } from '../lib/format';

const PERCENTS = [0.25, 0.5, 0.75, 1];
const SLIPPAGES = [0.005, 0.01, 0.03];

/**
 * Buy / sell, settled on-chain.
 *
 * The preview is computed locally in BigInt on every keystroke and is exact:
 * curve.js mirrors SparkCurve.sol digit for digit. The write is simulated
 * before the wallet opens, so a revert reads as a sentence instead of a hex
 * blob, and the slippage floor is derived from the same preview.
 */
export default function TradePanel({ token, curve, onTraded, className = '' }) {
  const {
    connected, signedIn, address, connect, balance, getWalletClient, wrongNetwork, switchToChain,
    needsUnlock, openWalletDialog,
  } = useWallet();
  const { burst, comet } = useCelebration();
  const buttonRef = useRef(null);

  const [side, setSide] = useState('buy');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(0.01);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const { state, tokenBalance, refresh } = useCurveState(curve?.address, token?.address, address);

  const pair = token.pair || 'ETH';
  const decimals = pair === 'USDC' ? 6 : 18;
  const graduated = state?.graduated ?? token.status === 'graduated';

  const params = useMemo(
    () => curveParams({ pair, mayhem: token.mayhem }),
    [pair, token.mayhem],
  );

  const amountUnits = useMemo(
    () => toUnits(amount, side === 'buy' ? decimals : 18),
    [amount, side, decimals],
  );

  const preview = useMemo(() => {
    if (!state || amountUnits <= 0n) return null;
    return side === 'buy'
      ? quoteBuy(params, state.baseSold, state.quoteRaised, amountUnits)
      : quoteSell(params, state.baseSold, state.quoteRaised, amountUnits);
  }, [state, params, side, amountUnits]);

  useEffect(() => { setAmount(''); setError(null); }, [side]);

  const setPercent = useCallback((p) => {
    const max = side === 'buy'
      // leave a little for gas, even though gas here is ~$0.001
      ? (balance * 98n) / 100n
      : tokenBalance;
    const value = (max * BigInt(Math.round(p * 1000))) / 1000n;
    const asText = Number(value) / 10 ** (side === 'buy' ? decimals : 18);
    setAmount(String(Number(asText.toFixed(side === 'buy' ? 6 : 0))));
  }, [side, balance, tokenBalance, decimals]);

  const submit = async () => {
    setError(null);
    // A wallet saved in this browser is not the same as no wallet: sending it
    // to connect() would ask an extension that may not exist, when what it
    // actually needs is the password.
    if (needsUnlock) { openWalletDialog(); return; }
    // `connected` means a wallet is attached. An email-only profile is signed
    // in but has no key and cannot sign anything, so it must connect one.
    if (!connected) { await connect().catch((e) => setError(e.message)); return; }
    if (wrongNetwork) { await switchToChain().catch((e) => setError(e.message)); return; }
    if (!preview || amountUnits <= 0n) return;

    const walletClient = getWalletClient();
    if (!walletClient) { setError('Reconnect your wallet.'); return; }

    setBusy(true);
    try {
      const bps = BigInt(Math.round((1 - slippage) * 10_000));
      let result;
      if (side === 'buy') {
        result = await buyOnChain({
          walletClient, account: address, curveAddress: curve.address,
          quoteToken: state.quoteToken, amount: amountUnits,
          minBaseOut: (preview.baseOut * bps) / 10_000n,
        });
        burst(buttonRef.current, { tone: 'buy', count: 18 });
      } else {
        result = await sellOnChain({
          walletClient, account: address, curveAddress: curve.address,
          tokenAddress: token.address, amount: amountUnits,
          minQuoteOut: (preview.quoteOut * bps) / 10_000n,
        });
        burst(buttonRef.current, { tone: 'sell', count: 8 });
      }

      setDone(true);
      comet(buttonRef.current);
      setAmount('');
      await refresh();
      onTraded?.(result);
      setTimeout(() => setDone(false), 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (graduated) {
    return (
      <div className={cx('bg-gold-100 border border-gold-600 rounded-xl p-5', className)}>
        <Tag tone="graduated">Eternal flame</Tag>
        <h3 className="disp text-heading-lg mt-3">This token graduated.</h3>
        <p className="text-sm text-ink3 mt-1.5">
          Its liquidity is locked forever in a Uniswap V3 pool on Robinhood Chain.
          No function in the contract can withdraw it.
        </p>
        <dl className="num text-caption text-ink3 mt-3 space-y-1">
          <div className="flex justify-between gap-3">
            <dt>Pool</dt><dd>{truncAddress(state?.pool || token.pool_address, 8, 6)}</dd>
          </div>
          <div className="flex justify-between gap-3"><dt>Range</dt><dd>full-range</dd></div>
          <div className="flex justify-between gap-3"><dt>Pool fee</dt><dd>1%</dd></div>
        </dl>
        <Button variant="gold" full className="mt-4"
                onClick={() => window.open(uniswapTradeUrl(token.address), '_blank', 'noopener')}>
          Trade on Uniswap V3
        </Button>
      </div>
    );
  }

  const isBuy = side === 'buy';
  const out = preview ? (isBuy ? preview.baseOut : preview.quoteOut) : 0n;
  const impact = preview ? priceImpact(preview) : 0;
  const maxLabel = isBuy ? money(balance, pair) : tokenAmount(tokenBalance);
  const overCap = Boolean(
    preview && isBuy && state?.walletQuoteCap > 0n
    && state.quoteSpent !== undefined
    && state.quoteSpent + preview.quoteIn > state.walletQuoteCap,
  );

  return (
    <div className={cx('bg-surface border border-subtle rounded-xl p-4 shadow-sm', className)}>
      <div className="grid grid-cols-2 gap-1 p-1 bg-sunken rounded-lg mb-4" role="tablist">
        {['buy', 'sell'].map((s) => (
          <button
            key={s} role="tab" aria-selected={side === s} onClick={() => setSide(s)}
            className={cx(
              'h-9 rounded-md text-[13px] font-bold transition-all duration-base ease-out-soft',
              side === s
                ? s === 'buy' ? 'bg-grad-buy text-white shadow-sm' : 'bg-grad-sell text-white shadow-sm'
                : 'text-ink3 hover:text-ink',
            )}
          >
            {s === 'buy' ? 'Buy' : 'Sell'}
          </button>
        ))}
      </div>

      <Field
        as="input" type="number" inputMode="decimal" min="0" step="any" placeholder="0.00"
        value={amount} onChange={(e) => setAmount(e.target.value)}
        label={isBuy ? `How much ${pair}` : `How many $${token.ticker}`}
        hint={`You have ${maxLabel}`}
        suffix={<span className="text-ink3 text-caption font-semibold">{isBuy ? pair : token.ticker}</span>}
        className="[&_input]:num [&_input]:text-num-lg"
      />

      <div className="grid grid-cols-4 gap-1.5 -mt-1 mb-4">
        {PERCENTS.map((p) => (
          <button key={p} type="button" onClick={() => setPercent(p)}
            className="h-8 rounded-md bg-sunken text-caption font-semibold text-ink3
                       hover:bg-accent-soft hover:text-ink transition-colors duration-fast">
            {p === 1 ? 'MAX' : `${p * 100}%`}
          </button>
        ))}
      </div>

      <div className="rounded-lg bg-sunken p-3 space-y-1.5">
        <Row label="You get" strong>
          <span className="num">
            {isBuy ? `${tokenAmount(out)} $${token.ticker}` : money(out, pair)}
          </span>
        </Row>
        <div className="h-px bg-subtle my-2" />
        <Row label={`Creator fee ${(Number(params.creatorFeeBps) / 100).toFixed(1)}% 🪵`}>
          <span className="num">{money(preview?.creatorFee || 0n, pair)}</span>
        </Row>
        <Row label={`Protocol fee ${(Number(params.protocolFeeBps) / 100).toFixed(1)}% ✨`}>
          <span className="num">{money(preview?.protocolFee || 0n, pair)}</span>
        </Row>
        <Row label="Gas (Robinhood Chain) ⛽"><span className="num">~$0.001</span></Row>
        {preview && Math.abs(impact) > 0.01 && (
          <Row label="Price impact">
            <span className={cx('num', Math.abs(impact) > 0.1 ? 'text-ember-700' : 'text-ink3')}>
              {pct(impact)}
            </span>
          </Row>
        )}
        {preview?.refund > 0n && (
          <Row label="Refunded (curve closed)">
            <span className="num text-mint-800">{money(preview.refund, pair)}</span>
          </Row>
        )}
        {preview?.graduates && (
          <p className="text-caption text-gold-800 bg-gold-100 rounded-md px-2 py-1.5 mt-2">
            🔥 This buy graduates the token and creates its Uniswap V3 pool.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 mb-3">
        <span className="text-caption text-ink3">Slippage</span>
        <div className="flex gap-1">
          {SLIPPAGES.map((s) => (
            <button key={s} onClick={() => setSlippage(s)}
              className={cx('num h-7 px-2.5 rounded-md text-caption font-semibold transition-colors',
                slippage === s ? 'bg-accent text-[var(--text-on-primary)]' : 'bg-sunken text-ink3 hover:text-ink')}>
              {s * 100}%
            </button>
          ))}
        </div>
      </div>

      {overCap && (
        <p className="text-caption text-ember-800 bg-ember-100 rounded-md px-3 py-2 mb-3">
          That is over the {money(state.walletQuoteCap, pair)} per-wallet cap on this token.
        </p>
      )}
      {error && (
        <p className="text-caption text-coral-800 bg-coral-100 rounded-md px-3 py-2 mb-3">{error}</p>
      )}
      {needsUnlock ? (
        <p className="text-caption text-ember-800 bg-ember-100 rounded-md px-3 py-2 mb-3">
          Your wallet is locked. Unlock it with your password to trade.
        </p>
      ) : signedIn && !connected && (
        <p className="text-caption text-ember-800 bg-ember-100 rounded-md px-3 py-2 mb-3">
          Your email profile can browse and chat, but trading is signed by a wallet.
          Connect one and it keeps the same profile.
        </p>
      )}

      <Button
        ref={buttonRef} full size="xl" variant={isBuy ? 'buy' : 'sell'}
        loading={busy} success={done}
        disabled={connected && !wrongNetwork && (!preview || amountUnits <= 0n)}
        onClick={submit}
      >
        {done ? '✓ Done'
          : needsUnlock ? 'Unlock wallet'
          : !connected ? 'Connect wallet'
          : wrongNetwork ? 'Switch to Robinhood Chain'
          : isBuy ? `Buy for ${money(amountUnits, pair)}`
          : `Sell ${tokenAmount(amountUnits)} $${token.ticker}`}
      </Button>

      {tokenBalance > 0n && (
        <p className="text-caption text-ink3 mt-3 flex justify-between">
          <span>Your position</span>
          <span className="num">{tokenAmount(tokenBalance)} ${token.ticker}</span>
        </p>
      )}
    </div>
  );
}

function Row({ label, children, strong }) {
  return (
    <div className="flex items-center justify-between gap-3 text-caption">
      <span className={strong ? 'text-ink font-semibold' : 'text-ink3'}>{label}</span>
      <span className={strong ? 'text-ink font-semibold text-[13px]' : 'text-ink3'}>{children}</span>
    </div>
  );
}
