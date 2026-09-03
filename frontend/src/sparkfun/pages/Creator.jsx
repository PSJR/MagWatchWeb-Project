import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import TokenCard from '../components/TokenCard';
import { Button, CountUp, EmptyState, ErrorNote, Skeleton, cx } from '../components/ui';
import { Cinder } from '../components/mascots';
import { useCelebration } from '../components/Celebration';
import { useWallet } from '../hooks/useWallet';
import { useAsync } from '../hooks/useLive';
import { api } from '../lib/api';
import { claimCreatorFees, readClaimableFees } from '../lib/contracts';
import { money, pct } from '../lib/format';

/**
 * Platform- and account-level totals sum trades across ETH- and USDC-paired
 * tokens, which have no common denominator until there is an ETH/USD feed.
 * They are labelled in ETH because ETH is the chain's gas token and the
 * default pair; a mixed-pair account will read slightly high until the feed
 * lands. This is a known gap, not a rounding choice.
 */


const LEVELS = {
  bronze:   { label: 'Bronze',   color: '#C88A5A' },
  silver:   { label: 'Silver',   color: '#B9C2CC' },
  gold:     { label: 'Gold',     color: 'var(--gold-500)' },
  platinum: { label: 'Platinum', color: 'var(--orbit-300)' },
  diamond:  { label: 'Diamond',  color: '#B6A8FF' },
};

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'live', label: 'Ativos' },
  { key: 'graduated', label: 'Graduados' },
];

/** Renders /creator (own dashboard) and /c/:handle (public creator profile). */
export default function Creator({ own = false }) {
  const { handle: routeHandle } = useParams();
  const { user, connect, address, getWalletClient } = useWallet();
  const handle = own ? user?.handle : routeHandle;
  const { burst } = useCelebration();

  const [filter, setFilter] = useState('all');
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState(null);
  const claimRef = React.useRef(null);

  const data = useAsync(
    (signal) => {
      if (!handle) return Promise.resolve(null);
      return own ? api.creatorDashboard() : api.creator(handle, signal);
    },
    [handle, own],
  );

  if (own && !user) {
    return (
      <div className="pt-16">
        <EmptyState
          title="Entre para ver sua lenha"
          body="Seus tokens, seus fees e seu nível ficam aqui."
          action={<Button onClick={() => connect().catch(() => {})}>Entrar na casa</Button>}
        />
      </div>
    );
  }

  if (data.loading) return <CreatorSkeleton />;
  if (data.error) return <div className="pt-10"><ErrorNote onRetry={data.reload}>{data.error}</ErrorNote></div>;
  const c = data.data;
  if (!c) return null;

  if (!c.tokens_created) {
    return (
      <div className="pt-16">
        <EmptyState
          mood="sleepy"
          title="Sua primeira faísca espera"
          body="Leva uns 20 segundos e custa só o gas."
          action={<Link to="/create"><Button>Acender um token</Button></Link>}
        />
      </div>
    );
  }

  const level = LEVELS[c.level] || LEVELS.bronze;
  const tokens = c.tokens.filter((t) => filter === 'all' || t.status === filter);

  /**
   * Fees are claimed by calling the curve directly from the creator's wallet.
   * The backend has no key and cannot move them — it only reports what the
   * chain already owes.
   */
  const claim = async () => {
    const walletClient = getWalletClient();
    if (!walletClient) { setClaimError('Reconecte a carteira.'); return; }
    setClaiming(true);
    setClaimError(null);
    try {
      const owed = c.tokens.filter((t) => t.curve);
      let claimed = 0;
      for (const t of owed) {
        const amount = await readClaimableFees(t.curve).catch(() => 0n);
        if (amount <= 0n) continue;
        await claimCreatorFees({ walletClient, account: address, curveAddress: t.curve });
        claimed += 1;
      }
      if (!claimed) { setClaimError('Nada de lenha para pegar ainda.'); return; }
      burst(claimRef.current, { tone: 'gold', count: 20 });
      data.reload();
    } catch (err) {
      setClaimError(err.message);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="pt-6 md:pt-10">
      <header className="relative rounded-3xl overflow-hidden bg-grad-hearth px-6 pt-8 pb-6 md:px-10">
        <Cinder
          level={c.level}
          size={100}
          className="absolute right-4 top-4 md:right-10 animate-bob pointer-events-none"
        />
        <div className="relative">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-display-md text-cocoa-900">{c.nickname}</h1>
            {c.verified_creator && <span title="Criador verificado">✅</span>}
          </div>
          <p className="text-caption text-cocoa-800/70 mt-1">
            @{c.handle} · {c.follower_count} seguidores
          </p>
          {c.bio && <p className="text-[14px] text-cocoa-800/85 mt-2 max-w-prose2">{c.bio}</p>}
          <span
            className="inline-flex items-center gap-2 mt-4 h-8 px-3 rounded-pill bg-cream-50/80 text-caption font-bold"
            style={{ color: 'var(--cocoa-900)' }}
          >
            <span className="w-2.5 h-2.5 rounded-pill" style={{ background: level.color }} aria-hidden="true" />
            {level.label} Creator
          </span>
        </div>
      </header>

      {/* The number the creator comes to see. */}
      <section className="mt-4 rounded-2xl border border-gold-600 bg-gold-100 p-6">
        <p className="overline text-gold-800 flex items-center gap-2">
          🪵 Lenha acumulada
          <span className="w-1.5 h-1.5 rounded-pill bg-mint-500 animate-beat" aria-hidden="true" />
          <span className="font-normal normal-case tracking-normal">ao vivo</span>
        </p>
        <p className="num text-num-hero font-medium text-cocoa-900 mt-2 leading-none">
          <CountUp value={c.fees_lifetime} format={(v) => money(v, 'ETH')} />
        </p>
        <div className="flex items-center gap-4 flex-wrap mt-3">
          <p className="num text-caption text-gold-800">
            +{money(c.fees_today, 'ETH')} hoje · {money(c.fees_30d, 'ETH')} em 30 dias
          </p>
          {own && (
            <Button
              ref={claimRef} size="sm" variant="gold" loading={claiming}
              onClick={claim} className="ml-auto"
            >
              Sacar lenha 🪵
            </Button>
          )}
        </div>
        {claimError && (
          <p className="text-caption text-coral-800 bg-coral-100 rounded-md px-3 py-2 mt-3">{claimError}</p>
        )}
        {own && (
          <p className="text-caption text-gold-800 mt-2">
            O saque chama o contrato direto da sua carteira. A plataforma não guarda chave e não move sua lenha.
          </p>
        )}
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        <Metric label="Tokens criados" value={c.tokens_created} />
        <Metric label="Volume gerado" value={money(c.total_volume, 'ETH')} />
        <Metric
          label="Taxa de graduação"
          value={pct(c.graduation_rate, { sign: false, digits: 0 })}
          sub="média da casa: 12%"
        />
        <Metric label="Holders únicos" value={c.unique_holders} />
      </div>

      {c.next_level_need && (
        <p className="text-caption text-ink3 mt-3">
          {c.next_level_need} — a fórmula é pública: 45% volume, 35% graduação, 20% seguidores.
        </p>
      )}

      {c.fees_series?.length > 1 && (
        <section className="mt-8">
          <h2 className="overline mb-3">Fees nos últimos 30 dias</h2>
          <div className="bg-surface border border-subtle rounded-xl p-3" style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={c.fees_series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="t" hide
                />
                <Tooltip
                  cursor={{ fill: 'var(--accent-soft)' }}
                  contentStyle={{
                    background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)',
                    borderRadius: 14, fontFamily: 'JetBrains Mono', fontSize: 12,
                    color: 'var(--text-primary)',
                  }}
                  formatter={(v) => [money(v, 'ETH'), 'fees']}
                  labelFormatter={(v) => new Date(v).toLocaleDateString('pt-BR')}
                />
                <Bar dataKey="fees" fill="var(--accent)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="overline">Tokens</h2>
          <div className="ml-auto flex gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cx('h-8 px-3 rounded-pill text-caption font-bold transition-colors',
                  filter === f.key ? 'bg-accent text-[var(--text-on-primary)]' : 'bg-surface text-ink3 hover:text-ink shadow-hairline')}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {!tokens.length ? (
          <p className="text-caption text-ink3 py-8 text-center">Nenhum token nesse filtro.</p>
        ) : (
          <div className="grid [grid-template-columns:repeat(auto-fill,minmax(268px,1fr))] gap-4">
            {tokens.map((t) => (
              <div key={t.address}>
                <TokenCard token={t} />
                <p className="num text-caption text-ink3 mt-1.5 px-1">
                  🪵 gerou {money(t.creator_fees, t.pair)} em fees
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {c.best_token && (
        <section className="mt-8">
          <h2 className="overline mb-3">Melhor token</h2>
          <div className="max-w-[380px]">
            <TokenCard token={c.best_token} />
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value, sub }) {
  return (
    <div className="bg-surface border border-subtle rounded-xl p-4">
      <p className="text-caption uppercase tracking-[.08em] text-ink3">{label}</p>
      <p className="num text-[22px] font-medium mt-2 leading-none">{value}</p>
      {sub && <p className="text-caption text-ink3 mt-1.5">{sub}</p>}
    </div>
  );
}

function CreatorSkeleton() {
  return (
    <div className="pt-10 space-y-4">
      <Skeleton className="h-44 w-full" rounded="rounded-3xl" />
      <Skeleton className="h-32 w-full" rounded="rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" rounded="rounded-xl" />)}
      </div>
    </div>
  );
}
