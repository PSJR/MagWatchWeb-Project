import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TokenCard from '../components/TokenCard';
import { Button, Field, Tag, Toggle, cx } from '../components/ui';
import { Wick } from '../components/mascots';
import { useCelebration } from '../components/Celebration';
import { useWallet } from '../hooks/useWallet';
import { api } from '../lib/api';
import { PAIRS, curveParams, TOTAL_SUPPLY } from '../lib/curve';
import { money, usd } from '../lib/format';

const BLANK = {
  name: '', ticker: '', description: '', image_url: '', banner_url: '',
  x: '', telegram: '', website: '', pair: 'ETH', mayhem: false, dev_buy: '',
};

export default function Create() {
  const navigate = useNavigate();
  const { connected, connect, user } = useWallet();
  const { burst } = useCelebration();
  const buttonRef = useRef(null);

  const [form, setForm] = useState(BLANK);
  const [tickerState, setTickerState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [holdProgress, setHoldProgress] = useState(0);

  const set = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [key]: key === 'ticker' ? String(value).toUpperCase().replace(/[^A-Z0-9]/g, '') : value }));
  };

  // Ticker availability, debounced — suggests rather than blocks.
  useEffect(() => {
    if (form.ticker.length < 2) { setTickerState(null); return undefined; }
    const id = setTimeout(async () => {
      try { setTickerState(await api.tickerAvailable(form.ticker)); } catch { /* non-blocking */ }
    }, 350);
    return () => clearTimeout(id);
  }, [form.ticker]);

  const params = useMemo(
    () => curveParams({ pair: form.pair, mayhem: form.mayhem }),
    [form.pair, form.mayhem],
  );

  // The preview is a real TokenCard, fed a real projected token shape.
  const preview = useMemo(() => ({
    address: 'preview',
    ticker: form.ticker || 'TICKER',
    name: form.name || 'Nome do seu token',
    image_url: form.image_url || null,
    creator_handle: user?.handle || 'você',
    created_at: new Date().toISOString(),
    status: 'live',
    pair: form.pair,
    mayhem: form.mayhem,
    progress: 0,
    to_graduate: params.graduationRaise,
    market_cap: (params.virtualQuote0 / params.virtualBase0) * TOTAL_SUPPLY,
    volume_24h: 0,
    change_24h: null,
    base_sold: 0,
  }), [form, params, user]);

  const canSubmit = form.name.trim().length >= 1 && form.ticker.length >= 2;

  const submit = useCallback(async () => {
    setError(null);
    if (!connected) { await connect().catch(() => {}); return; }
    setBusy(true);
    try {
      const token = await api.createToken({
        name: form.name.trim(),
        ticker: form.ticker,
        description: form.description.trim(),
        image_url: form.image_url || null,
        banner_url: form.banner_url || null,
        links: { x: form.x || null, telegram: form.telegram || null, website: form.website || null },
        pair: form.pair,
        mayhem: form.mayhem,
        dev_buy: Number(form.dev_buy) || 0,
      });
      burst(buttonRef.current, { tone: 'gold', count: 24 });
      setTimeout(() => navigate(`/t/${token.address}`), 420);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }, [connected, connect, form, burst, navigate]);

  return (
    <div className="pt-6 md:pt-10">
      <header className="mb-7">
        <h1 className="text-display-lg">Acender um token</h1>
        <p className="text-ink3 mt-2 max-w-prose2">
          Leva uns 20 segundos e custa só o gas da Robinhood Chain.
        </p>
      </header>

      <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
      <div className="order-2 lg:order-1">
        <Section title="O básico">
          <Field
            label="Nome do token" placeholder="Pizza da Meia-Noite" maxLength={48}
            value={form.name} onChange={set('name')}
          />
          <Field
            label="Ticker" placeholder="PIZZA" prefix="$" maxLength={10}
            value={form.ticker} onChange={set('ticker')}
            error={tickerState && !tickerState.available
              ? `$${tickerState.ticker} já está aceso.${tickerState.suggestions.length ? ` Que tal $${tickerState.suggestions.join(' ou $')}?` : ''}`
              : null}
            hint={tickerState?.available ? '✓ livre' : 'De 2 a 10 letras ou números.'}
          />
          <Field
            as="textarea" rows={3} label="Descrição" maxLength={500}
            placeholder="Conte a história em duas linhas."
            value={form.description} onChange={set('description')}
          />
          <Field
            label="Imagem (URL)" placeholder="https://…"
            hint="Cole o link da imagem do token. Upload chega em breve."
            value={form.image_url} onChange={set('image_url')}
          />
        </Section>

        <Section title="Links sociais">
          <div className="grid sm:grid-cols-3 gap-x-4">
            <Field label="X" prefix="𝕏" placeholder="@perfil" value={form.x} onChange={set('x')} />
            <Field label="Telegram" prefix="✈" placeholder="t.me/…" value={form.telegram} onChange={set('telegram')} />
            <Field label="Site" prefix="🔗" placeholder="https://…" value={form.website} onChange={set('website')} />
          </div>
        </Section>

        <Section title="Par de negociação">
          <div className="grid sm:grid-cols-2 gap-3">
            {Object.values(PAIRS).map((p) => (
              <button
                key={p.symbol}
                type="button"
                onClick={() => setForm((f) => ({ ...f, pair: p.symbol }))}
                aria-pressed={form.pair === p.symbol}
                className={cx(
                  'text-left p-4 rounded-xl border transition-all duration-base ease-out-soft',
                  form.pair === p.symbol
                    ? 'border-accent bg-accent-soft shadow-glow-ember -translate-y-px'
                    : 'border-subtle bg-surface saturate-[.7] hover:saturate-100',
                )}
              >
                <span className="disp text-heading-md block">{p.label}</span>
                <span className="text-caption text-ink3 block mt-1">{p.blurb}</span>
                <span className="num text-caption text-ink3 block mt-2">
                  gradua em {money(p.graduationRaise, p.symbol)}
                </span>
              </button>
            ))}
          </div>
        </Section>

        <MayhemBlock
          value={form.mayhem}
          onChange={(v) => setForm((f) => ({ ...f, mayhem: v }))}
          holdProgress={holdProgress}
          setHoldProgress={setHoldProgress}
        />

        <Section title="Compra inicial (opcional)">
          <Field
            type="number" min="0" step="any" label={`Comprar na largada (${form.pair})`}
            placeholder="0.0" prefix="⚡"
            hint="Compra sua própria bolsa no mesmo bloco em que o token nasce."
            value={form.dev_buy} onChange={set('dev_buy')}
            className="[&_input]:num max-w-[280px]"
          />
        </Section>

        {error && (
          <p className="text-[13px] text-coral-800 bg-coral-100 rounded-lg px-4 py-3 mb-4">{error}</p>
        )}

        <div className="flex items-center gap-4 flex-wrap">
          <Button
            ref={buttonRef} size="xl" loading={busy} disabled={!canSubmit}
            onClick={submit} className="min-w-[220px]"
          >
            🔥 {connected ? 'Acender' : 'Entrar e acender'}
          </Button>
          <span className="text-caption text-ink3">
            Custo: só o gas ⛽ ~$0,001
          </span>
        </div>
      </div>

      <aside className="order-1 lg:order-2 lg:sticky lg:top-24">
        <p className="overline mb-3">Preview ao vivo</p>
        <TokenCard token={preview} className="pointer-events-none" />
        <dl className="mt-4 bg-surface border border-subtle rounded-xl p-4 space-y-2 text-caption">
          <Line label="Supply total" value="1.000.000.000" />
          <Line label="Na curva" value="800.000.000" />
          <Line label="Para a pool" value="200.000.000" />
          <Line label="Market cap inicial" value={money(preview.market_cap, form.pair)} />
          <Line label="Fee do criador" value={`${(params.fees.creator * 100).toFixed(1)}%`} />
          <Line
            label="Limite por carteira"
            value={params.walletCap ? `${(params.walletCap / 1e6).toFixed(0)}M` : 'sem limite'}
          />
        </dl>
      </aside>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-7">
      <h2 className="overline mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Line({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink3">{label}</dt>
      <dd className="num text-ink">{value}</dd>
    </div>
  );
}

/**
 * Mayhem is not a switch in a row — it is a block that visibly wakes up, and
 * arming it takes a deliberate 800ms hold, because it cannot be undone.
 */
function MayhemBlock({ value, onChange, holdProgress, setHoldProgress }) {
  const timer = useRef(null);

  const startHold = () => {
    if (value) { onChange(false); return; }
    const started = Date.now();
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - started) / 800);
      setHoldProgress(p);
      if (p >= 1) {
        clearInterval(timer.current);
        setHoldProgress(0);
        onChange(true);
      }
    }, 16);
  };

  const cancelHold = () => {
    clearInterval(timer.current);
    setHoldProgress(0);
  };

  useEffect(() => () => clearInterval(timer.current), []);

  return (
    <section className="mb-7">
      <div className={cx(
        'relative overflow-hidden rounded-xl border p-5 transition-all duration-slow ease-out-soft',
        value
          ? 'border-wild-500 bg-wild-100 shadow-glow-mayhem'
          : 'border-subtle bg-surface',
      )}>
        {value && (
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-grad-mayhem bg-[length:300%_100%] animate-mayhem opacity-[.10]"
          />
        )}
        <div className="relative flex items-start gap-4">
          <Wick size={56} awake={value} className={value ? 'animate-bob' : ''} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Tag tone="mayhem">Fogo Selvagem</Tag>
              {value && <span className="text-caption text-wild-800 font-semibold">aceso</span>}
            </div>
            <p className="text-[13px] text-ink2 mt-2 leading-relaxed max-w-[46ch]">
              Sem limite de compra por carteira, fee de 2,5% para você e uma curva mais íngreme.
              Sobe mais rápido. Cai mais rápido. <strong>Não dá para desligar depois de acender.</strong>
            </p>
          </div>

          <button
            type="button"
            onPointerDown={startHold}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            aria-pressed={value}
            className={cx(
              'relative shrink-0 h-11 px-4 rounded-lg text-[13px] font-bold overflow-hidden',
              'transition-colors duration-fast',
              value ? 'bg-wild-500 text-white' : 'bg-sunken text-ink3 hover:text-ink',
            )}
          >
            {holdProgress > 0 && (
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-wild-500/40"
                style={{ transform: `scaleX(${holdProgress})`, transformOrigin: 'left' }}
              />
            )}
            <span className="relative">{value ? 'Apagar' : 'Segure para acender'}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
