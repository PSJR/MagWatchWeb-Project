import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Field, Tag, cx } from './ui';
import { useCelebration } from './Celebration';
import { useWallet } from '../hooks/useWallet';
import { api } from '../lib/api';
import { curveParams, quoteBuy, quoteSell } from '../lib/curve';
import { money, quote as fmtQuote, pct, tokenAmount } from '../lib/format';

const PERCENTS = [0.25, 0.5, 0.75, 1];

/**
 * Buy / sell. The quote is computed locally on every keystroke (sub-frame) and
 * settled server-side; the two agree because the curve is mirrored and pinned
 * by tests/test_curve_parity.py.
 */
export default function TradePanel({ token, position, onTraded, className = '' }) {
  const { connected, connect, balance } = useWallet();
  const { burst, comet } = useCelebration();
  const buttonRef = useRef(null);

  const [side, setSide] = useState('buy');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(0.01);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const graduated = token.status === 'graduated';
  const params = useMemo(
    () => curveParams({ pair: token.pair, mayhem: token.mayhem }),
    [token.pair, token.mayhem],
  );

  const value = Number(amount) || 0;
  const preview = useMemo(() => {
    if (!value) return null;
    return side === 'buy'
      ? quoteBuy(params, token.base_sold, value)
      : quoteSell(params, token.base_sold, value);
  }, [side, value, params, token.base_sold]);

  useEffect(() => { setAmount(''); setError(null); }, [side]);

  const setPercent = useCallback((p) => {
    const max = side === 'buy' ? balance * 0.98 : (position?.balance || 0);
    setAmount(String(Number((max * p).toFixed(side === 'buy' ? 6 : 0))));
  }, [side, balance, position]);

  const submit = async () => {
    setError(null);
    if (!connected) { await connect().catch(() => {}); return; }
    if (!value) return;

    setBusy(true);
    try {
      const trade = await api.trade(token.address, { side, amount: value, slippage });
      // Optimistic success reads at ~120ms; the receipt catches up after.
      setDone(true);
      if (side === 'buy') burst(buttonRef.current, { tone: 'buy', count: 18 });
      else burst(buttonRef.current, { tone: 'sell', count: 8 });
      comet(buttonRef.current);
      setAmount('');
      onTraded?.(trade);
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
        <Tag tone="graduated">Chama eterna</Tag>
        <h3 className="disp text-heading-lg mt-3">Este token graduou.</h3>
        <p className="text-sm text-ink3 mt-1.5">
          A liquidez está travada para sempre numa pool do Uniswap V3 na Robinhood Chain.
        </p>
        <dl className="num text-caption text-ink3 mt-3 space-y-1">
          <div className="flex justify-between gap-3">
            <dt>Pool</dt><dd className="truncate">{token.pool_address}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Faixa</dt><dd>full-range</dd>
          </div>
        </dl>
        <Button variant="gold" full className="mt-4"
                onClick={() => window.open(`https://app.uniswap.org/swap?chain=4663&outputCurrency=${token.address}`, '_blank', 'noopener')}>
          Negociar no Uniswap V3
        </Button>
      </div>
    );
  }

  const isBuy = side === 'buy';
  const out = preview ? (isBuy ? preview.baseOut : preview.quoteOut) : 0;
  const maxLabel = isBuy ? fmtQuote(balance, token.pair) : tokenAmount(position?.balance || 0);

  return (
    <div className={cx('bg-surface border border-subtle rounded-xl p-4 shadow-sm', className)}>
      {/* The segmented control recolours the whole panel, mint <-> coral. */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-sunken rounded-lg mb-4" role="tablist">
        {['buy', 'sell'].map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={side === s}
            onClick={() => setSide(s)}
            className={cx(
              'h-9 rounded-md text-[13px] font-bold transition-all duration-base ease-out-soft',
              side === s
                ? s === 'buy' ? 'bg-grad-buy text-white shadow-sm' : 'bg-grad-sell text-white shadow-sm'
                : 'text-ink3 hover:text-ink',
            )}
          >
            {s === 'buy' ? 'Comprar' : 'Vender'}
          </button>
        ))}
      </div>

      <Field
        as="input"
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        placeholder="0.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        label={isBuy ? `Quanto de ${token.pair}` : `Quantos $${token.ticker}`}
        hint={`Você tem ${maxLabel}`}
        suffix={<span className="text-ink3 text-caption font-semibold">{isBuy ? token.pair : token.ticker}</span>}
        className="[&_input]:num [&_input]:text-num-lg"
      />

      <div className="grid grid-cols-4 gap-1.5 -mt-1 mb-4">
        {PERCENTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPercent(p)}
            className="h-8 rounded-md bg-sunken text-caption font-semibold text-ink3
                       hover:bg-accent-soft hover:text-ink transition-colors duration-fast"
          >
            {p === 1 ? 'MAX' : `${p * 100}%`}
          </button>
        ))}
      </div>

      <div className="rounded-lg bg-sunken p-3 space-y-1.5">
        <Row label="Você recebe" strong>
          <span className="num">
            {isBuy ? `${tokenAmount(out)} $${token.ticker}` : fmtQuote(out, token.pair)}
          </span>
        </Row>
        <div className="h-px bg-subtle my-2" />
        <Row label={`Fee do criador ${(params.fees.creator * 100).toFixed(1)}% 🪵`}>
          <span className="num">{fmtQuote(preview?.creatorFee || 0, token.pair)}</span>
        </Row>
        <Row label={`Fee do protocolo ${(params.fees.protocol * 100).toFixed(1)}% ✨`}>
          <span className="num">{fmtQuote(preview?.protocolFee || 0, token.pair)}</span>
        </Row>
        <Row label="Gas (Robinhood Chain) ⛽">
          <span className="num">~$0.001</span>
        </Row>
        {preview && Math.abs(preview.priceImpact) > 0.01 && (
          <Row label="Impacto no preço">
            <span className={cx('num', Math.abs(preview.priceImpact) > 0.1 ? 'text-ember-700' : 'text-ink3')}>
              {pct(preview.priceImpact)}
            </span>
          </Row>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 mb-3">
        <span className="text-caption text-ink3">Margem de preço</span>
        <div className="flex gap-1">
          {[0.005, 0.01, 0.03].map((s) => (
            <button
              key={s}
              onClick={() => setSlippage(s)}
              className={cx('num h-7 px-2.5 rounded-md text-caption font-semibold transition-colors',
                slippage === s ? 'bg-accent text-[var(--text-on-primary)]' : 'bg-sunken text-ink3 hover:text-ink')}
            >
              {s * 100}%
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-caption text-coral-800 bg-coral-100 rounded-md px-3 py-2 mb-3">{error}</p>
      )}

      <Button
        ref={buttonRef}
        full
        size="xl"
        variant={isBuy ? 'buy' : 'sell'}
        loading={busy}
        success={done}
        disabled={connected && !value}
        onClick={submit}
      >
        {done ? '✓ Feito' : !connected ? 'Entrar na casa'
          : isBuy ? `Comprar por ${fmtQuote(value, token.pair)}`
          : `Vender ${tokenAmount(value)} $${token.ticker}`}
      </Button>

      {position?.balance > 0 && (
        <p className="text-caption text-ink3 mt-3 flex justify-between">
          <span>Sua posição</span>
          <span className="num">
            {tokenAmount(position.balance)} · {money(position.value, token.pair)}
          </span>
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
