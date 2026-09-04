import React, { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TokenCard from '../components/TokenCard';
import LiveFeed from '../components/LiveFeed';
import { Button, EmptyState, ErrorNote, Skeleton, cx } from '../components/ui';
import { Ember } from '../components/mascots';
import { api } from '../lib/api';
import { useAsync, useLive } from '../hooks/useLive';
import { money } from '../lib/format';

/**
 * Platform- and account-level totals sum trades across ETH- and USDC-paired
 * tokens, which have no common denominator until there is an ETH/USD feed.
 * They are labelled in ETH because ETH is the chain's gas token and the
 * default pair; a mixed-pair account will read slightly high until the feed
 * lands. This is a known gap, not a rounding choice.
 */


const FILTERS = [
  { key: 'movers', label: 'Movers' },
  { key: 'new', label: 'New' },
  { key: 'almost', label: 'Almost there' },
];

export default function Home() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('movers');
  const [flashes, setFlashes] = useState({});

  const feed = useAsync((signal) => api.tokens({ sort: filter, limit: 24 }, signal), [filter]);
  const stats = useAsync(() => api.stats(), []);
  const recent = useAsync(() => api.liveFeed({ limit: 12 }), []);

  const onEvent = useCallback((event) => {
    if (event.type === 'trade') {
      setFlashes((f) => ({ ...f, [event.trade.token_address]: event.trade.side }));
      setTimeout(() => setFlashes((f) => {
        const next = { ...f };
        delete next[event.trade.token_address];
        return next;
      }), 1200);
      recent.setData((prev) => [event.trade, ...(prev || [])].slice(0, 12));
    }
    if (event.type === 'token.created') {
      feed.setData((prev) => [event.token, ...(prev || [])].slice(0, 24));
    }
  }, [feed, recent]);

  const { connected } = useLive('global', { onEvent });

  return (
    <div className="pt-6 md:pt-10">
      <section className="relative overflow-hidden rounded-3xl bg-grad-dusk px-6 py-10 md:px-12 md:py-16">
        <div className="relative z-10 max-w-[34ch]">
          <h1 className="text-display-hero text-cocoa-900">Light your spark.</h1>
          <p className="mt-4 text-[16px] md:text-[17px] text-cocoa-800/80 max-w-[42ch]">
            Tokens born in 100 milliseconds, in a warm little house.
            Just Robinhood Chain gas — nothing beyond that.
          </p>
          <div className="flex flex-wrap gap-3 mt-7">
            <Button size="xl" onClick={() => navigate('/create')}>
              🔥 Light a token
            </Button>
            <Link
              to="/explore"
              className="inline-flex items-center h-14 px-6 rounded-lg bg-cream-50/70 text-cocoa-900
                         font-bold text-[15px] shadow-[0_3px_0_rgba(74,54,43,.16)]
                         hover:-translate-y-px active:translate-y-[3px] active:shadow-none
                         transition-[transform,box-shadow] duration-fast ease-out-soft"
            >
              Explore the campfire
            </Link>
          </div>
        </div>

        <Ember
          size={150}
          mood="happy"
          className="absolute right-4 bottom-0 md:right-16 md:bottom-4 animate-bob opacity-95 pointer-events-none"
        />

        {stats.data && (
          <dl className="relative z-10 flex flex-wrap gap-x-8 gap-y-2 mt-9 text-cocoa-800/75">
            <Stat label="tokens lit" value={stats.data.tokens_live} />
            <Stat label="graduated" value={stats.data.tokens_graduated} />
            <Stat label="24h volume" value={money(stats.data.volume_24h, 'ETH')} />
            <Stat label="24h trades" value={stats.data.trades_24h} />
          </dl>
        )}
      </section>

      <div className="grid lg:grid-cols-[1fr_300px] gap-8 mt-10">
        <section>
          <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-none">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cx(
                  'h-9 px-4 rounded-pill text-[13px] font-bold whitespace-nowrap shrink-0',
                  'transition-[background-color,color,box-shadow] duration-base ease-out-soft',
                  filter === f.key
                    ? 'bg-accent text-[var(--text-on-primary)] shadow-[0_3px_0_var(--accent-deep)]'
                    : 'bg-surface text-ink3 hover:text-ink shadow-hairline',
                )}
              >
                {f.label}
              </button>
            ))}
            <Link to="/explore" className="ml-auto text-caption text-ink3 hover:text-ink shrink-0">
              see all →
            </Link>
          </div>

          {feed.error ? (
            <ErrorNote onRetry={feed.reload}>{feed.error}</ErrorNote>
          ) : feed.loading ? (
            <CardGridSkeleton />
          ) : !feed.data?.length ? (
            <EmptyState
              title="The campfire is cold"
              body="Nobody has lit anything yet. Care to be first?"
              action={<Button onClick={() => navigate('/create')}>Light a token</Button>}
            />
          ) : (
            <div className="grid [grid-template-columns:repeat(auto-fill,minmax(268px,1fr))] gap-4">
              {feed.data.map((token) => (
                <TokenCard key={token.address} token={token} flash={flashes[token.address]} />
              ))}
            </div>
          )}
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-24 bg-surface border border-subtle rounded-xl p-4">
            <h2 className="overline flex items-center gap-2 mb-3">
              <span className={cx('w-1.5 h-1.5 rounded-pill', connected ? 'bg-mint-500 animate-beat' : 'bg-ash-400')} />
              happening now
            </h2>
            <LiveFeed trades={recent.data || []} emptyLabel="Nobody has poked the fire yet." />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <dt className="text-caption uppercase tracking-[.08em] opacity-70">{label}</dt>
      <dd className="num text-[18px] font-medium text-cocoa-900">{value}</dd>
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }) {
  return (
    <div className="grid [grid-template-columns:repeat(auto-fill,minmax(268px,1fr))] gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface border border-subtle rounded-xl p-4">
          <div className="flex gap-3">
            <Skeleton className="w-14 h-14" rounded="rounded-[30%]" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
          <Skeleton className="h-4 w-28 mt-4" />
          <Skeleton className="h-2.5 w-full mt-3" rounded="rounded-pill" />
        </div>
      ))}
    </div>
  );
}
