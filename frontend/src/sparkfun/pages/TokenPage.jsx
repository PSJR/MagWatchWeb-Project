import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CurveChart from '../components/CurveChart';
import CurveProgress from '../components/CurveProgress';
import LiveFeed from '../components/LiveFeed';
import TradePanel from '../components/TradePanel';
import { TokenAvatar } from '../components/TokenCard';
import { Button, EmptyState, ErrorNote, Field, Skeleton, Tag, cx } from '../components/ui';
import GraduationOverlay from '../components/GraduationOverlay';
import { useCelebration } from '../components/Celebration';
import { useWallet } from '../hooks/useWallet';
import { useAsync, useLive } from '../hooks/useLive';
import { api } from '../lib/api';
import { money, price as fmtPrice, pct, relTime, tokenAmount, truncAddress } from '../lib/format';

const TABS = [
  { key: 'about', label: 'Sobre' },
  { key: 'trades', label: 'Trades' },
  { key: 'holders', label: 'Holders' },
  { key: 'chat', label: 'Chat' },
];

export default function TokenPage() {
  const { address } = useParams();
  const { user } = useWallet();
  const { burst } = useCelebration();

  const [tab, setTab] = useState('about');
  const [graduation, setGraduation] = useState(null);

  const token = useAsync((signal) => api.token(address, signal), [address]);
  const trades = useAsync(() => api.trades(address, { limit: 40 }), [address]);
  const holders = useAsync(() => api.holders(address), [address]);
  const comments = useAsync(() => api.comments(address), [address]);
  const portfolio = useAsync(() => (user ? api.portfolio() : Promise.resolve([])), [user?.id]);

  const onEvent = useCallback((event) => {
    if (event.type === 'trade' && event.trade.token_address === address) {
      token.setData(event.token);
      trades.setData((prev) => [event.trade, ...(prev || [])].slice(0, 40));
    }
    if (event.type === 'graduation' && event.token.address === address) {
      token.setData(event.token);
      setGraduation(event);
    }
    if (event.type === 'comment') {
      comments.setData((prev) => [...(prev || []), event.comment]);
    }
  }, [address, token, trades, comments]);

  useLive(`token:${address}`, { onEvent });

  if (token.loading) return <TokenSkeleton />;
  if (token.error) return <div className="pt-10"><ErrorNote onRetry={token.reload}>{token.error}</ErrorNote></div>;
  const t = token.data;
  if (!t) return null;

  const graduated = t.status === 'graduated';

  return (
    <div className="pt-6 md:pt-10">
      {graduation && <GraduationOverlay token={graduation.token} plan={graduation.plan} onDone={() => setGraduation(null)} />}

      <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
        <div className="min-w-0">
          <header className="flex items-start gap-4">
            <TokenAvatar token={t} size={72} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-display-md">${t.ticker}</h1>
                {t.mayhem && <Tag tone="mayhem">Mayhem</Tag>}
                {graduated && <Tag tone="graduated">Graduado</Tag>}
              </div>
              <p className="text-ink3 text-sm mt-1">
                {t.name} · por{' '}
                <Link to={`/u/${t.creator_handle}`} className="text-ink hover:underline">
                  @{t.creator_handle}
                </Link>{' '}
                · {relTime(t.created_at)}
              </p>
            </div>
          </header>

          <div className="flex items-baseline gap-3 flex-wrap mt-5">
            <span className="num text-num-lg font-medium">{fmtPrice(t.price, { prefix: '' })} {t.pair}</span>
            {Number.isFinite(t.change_24h) && (
              <span className={cx('num text-[15px] font-medium',
                t.change_24h >= 0 ? 'text-mint-800' : 'text-coral-800')}>
                {t.change_24h >= 0 ? '▲' : '▼'} {pct(t.change_24h, { sign: false })}
              </span>
            )}
            <span className="num text-caption text-ink3">
              MC {money(t.market_cap, t.pair)} · Vol 24h {money(t.volume_24h, t.pair)} · {t.holders} holders
            </span>
          </div>

          <div className="mt-5 bg-surface border border-subtle rounded-xl p-3">
            <CurveChart token={t} />
          </div>

          <div className="mt-5">
            {graduated ? <EternalFlame token={t} /> : (
              <CurveProgress progress={t.progress} toGraduate={t.to_graduate} pair={t.pair} />
            )}
          </div>

          <nav className="flex gap-1 mt-8 mb-4 border-b border-subtle" role="tablist">
            {TABS.map((item) => (
              <button
                key={item.key}
                role="tab"
                aria-selected={tab === item.key}
                onClick={() => setTab(item.key)}
                className={cx(
                  'relative h-10 px-4 text-[14px] font-semibold transition-colors duration-fast',
                  tab === item.key ? 'disp text-ink' : 'text-ink3 hover:text-ink',
                )}
              >
                {item.label}
                {tab === item.key && (
                  <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-pill bg-accent" />
                )}
              </button>
            ))}
          </nav>

          {tab === 'about' && <About token={t} />}
          {tab === 'trades' && <LiveFeed trades={trades.data || []} showToken={false} />}
          {tab === 'holders' && <Holders rows={holders.data} />}
          {tab === 'chat' && (
            <Chat
              address={address}
              comments={comments.data}
              canPost={Boolean(user)}
              onPosted={(c) => comments.setData((prev) => [...(prev || []), c])}
              onCheer={burst}
            />
          )}
        </div>

        <aside className="lg:sticky lg:top-24 space-y-4">
          <TradePanel
            token={t}
            curve={{ address: t.curve }}
            onTraded={() => { token.reload(); trades.reload(); portfolio.reload(); }}
          />

          <div className="bg-surface border border-subtle rounded-xl p-4">
            <p className="overline mb-2">Criador</p>
            <Link to={`/u/${t.creator_handle}`} className="disp text-heading-md hover:underline">
              @{t.creator_handle}
            </Link>
            <p className="num text-caption text-ink3 mt-2">
              🪵 gerou {money(t.creator_fees, t.pair)} em fees com este token
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function About({ token }) {
  const links = Object.entries(token.links || {}).filter(([, v]) => v);
  return (
    <div className="space-y-5">
      {token.description
        ? <p className="text-ink2 max-w-prose2 leading-relaxed">{token.description}</p>
        : <p className="text-ink3 text-sm">Sem descrição — o criador deixou o mistério.</p>}

      {links.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {links.map(([key, value]) => (
            <a
              key={key} href={value} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-surface
                         shadow-hairline text-[13px] font-semibold text-ink hover:shadow-sm"
            >
              {key === 'x' ? '𝕏' : key === 'telegram' ? '✈' : '🔗'} {key}
            </a>
          ))}
        </div>
      )}

      <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-caption max-w-[560px]">
        <Row label="Contrato" value={truncAddress(token.address, 10, 6)} mono />
        <Row label="Par" value={token.pair} />
        <Row label="Supply" value="1.000.000.000" mono />
        <Row label="Nascido em" value={new Date(token.created_at).toLocaleString('pt-BR')} />
        <Row label="Arrecadado" value={money(token.raised, token.pair)} mono />
        <Row label="Trades" value={token.trades} mono />
      </dl>
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex justify-between gap-3 border-b border-subtle py-2">
      <dt className="text-ink3">{label}</dt>
      <dd className={cx('text-ink truncate', mono && 'num')}>{value}</dd>
    </div>
  );
}

function EternalFlame({ token }) {
  return (
    <div className="bg-gold-100 border border-gold-600 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-2">
        <span aria-hidden="true" className="text-xl">🔒</span>
        <h2 className="disp text-heading-lg text-gold-800">Chama eterna</h2>
      </div>
      <p className="text-[13px] text-ink2">
        A curva fechou e a liquidez foi travada para sempre numa pool do Uniswap V3
        na Robinhood Chain.
      </p>
      <dl className="num text-caption text-ink3 mt-3 space-y-1">
        <div className="flex justify-between gap-3"><dt>Pool</dt><dd className="truncate">{truncAddress(token.pool_address, 10, 6)}</dd></div>
        <div className="flex justify-between gap-3"><dt>Liquidez</dt><dd>{money(token.raised, token.pair)} + 200M ${token.ticker}</dd></div>
        <div className="flex justify-between gap-3"><dt>Faixa</dt><dd>full-range</dd></div>
      </dl>
    </div>
  );
}

function Holders({ rows }) {
  if (!rows) return <Skeleton className="h-40 w-full" rounded="rounded-xl" />;
  if (!rows.length) return <EmptyState mood="sleepy" title="Nenhum holder ainda" body="Seja o primeiro a pegar uma bolsa." />;

  return (
    <ul className="divide-y divide-subtle">
      {rows.map((h, i) => (
        <li key={h.handle + i} className="flex items-center gap-3 py-2.5">
          <span className="num text-caption text-ink3 w-6 shrink-0">{i + 1}</span>
          <Link to={`/u/${h.handle}`} className="text-[14px] font-semibold text-ink hover:underline truncate">
            @{h.handle}
          </Link>
          <span className="flex gap-1 shrink-0">
            {h.is_creator && <span title="Criador">👑</span>}
            {h.early && <span title="Comprou no primeiro minuto">🌱</span>}
            {h.whale && <span title="Mais de 3% do supply">🐋</span>}
          </span>
          <span className="ml-auto num text-caption text-ink3 shrink-0">
            {tokenAmount(h.balance)} · {pct(h.share, { sign: false })}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Chat({ address, comments, canPost, onPosted, onCheer }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = React.useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [comments]);

  const send = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      const c = await api.comment(address, { body: body.trim() });
      onPosted(c);
      setBody('');
    } catch { /* surfaced by the disabled state; keep the draft */ }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div ref={listRef} className="max-h-[380px] overflow-y-auto space-y-2 mb-4">
        {!comments?.length ? (
          <EmptyState mood="wave" title="Silêncio total" body="Diga oi para os outros holders." />
        ) : comments.map((c) => (
          <div key={c.id} className="bg-surface border border-subtle rounded-xl px-4 py-2.5 animate-pop-in">
            <p className="text-caption text-ink3 mb-0.5">
              <Link to={`/u/${c.handle}`} className="font-semibold text-ink hover:underline">@{c.handle}</Link>
              {c.tier === 'creator' && ' 👑'}
              {c.tier === 'whale' && ' 🐋'}
              {' · '}{relTime(c.ts)}
            </p>
            <p className="text-[14px] text-ink2">{c.body}</p>
          </div>
        ))}
      </div>

      {canPost ? (
        <div className="flex gap-2 items-start">
          <Field
            placeholder="escreva algo…" maxLength={400} value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="flex-1"
          />
          <Button size="lg" loading={busy} disabled={!body.trim()} onClick={send} className="mt-6">
            Enviar
          </Button>
        </div>
      ) : (
        <p className="text-caption text-ink3">Entre na casa para conversar.</p>
      )}
    </div>
  );
}

function TokenSkeleton() {
  return (
    <div className="pt-10 grid lg:grid-cols-[1fr_360px] gap-8">
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="w-18 h-18" rounded="rounded-[30%]" />
          <div className="space-y-2 flex-1"><Skeleton className="h-7 w-40" /><Skeleton className="h-4 w-64" /></div>
        </div>
        <Skeleton className="h-60 w-full" rounded="rounded-xl" />
        <Skeleton className="h-4 w-full" rounded="rounded-pill" />
      </div>
      <Skeleton className="h-[420px] w-full" rounded="rounded-xl" />
    </div>
  );
}
