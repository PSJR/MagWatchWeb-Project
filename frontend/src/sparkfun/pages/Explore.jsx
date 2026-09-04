import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TokenCard from '../components/TokenCard';
import { Button, EmptyState, ErrorNote, Field, cx } from '../components/ui';
import { CardGridSkeleton } from './Home';
import { api } from '../lib/api';
import { useAsync } from '../hooks/useLive';

const FILTERS = [
  { key: 'movers', label: 'Movers', params: { sort: 'movers' } },
  { key: 'mayhem', label: 'Mayhem', params: { sort: 'movers', mayhem: true } },
  { key: 'new', label: 'New', params: { sort: 'new' } },
  { key: 'mcap', label: 'Market Cap', params: { sort: 'mcap' } },
  { key: 'last_trade', label: 'Last trade', params: { sort: 'last_trade' } },
  { key: 'almost', label: 'Almost there', params: { sort: 'almost' } },
  { key: 'graduated', label: 'Graduated', params: { sort: 'mcap', status: 'graduated' } },
];

export default function Explore() {
  const navigate = useNavigate();
  const [active, setActive] = useState('movers');
  const [query, setQuery] = useState('');
  const [layout, setLayout] = useState('grid');

  const filter = FILTERS.find((f) => f.key === active) || FILTERS[0];
  const list = useAsync(
    (signal) => api.tokens({ ...filter.params, q: query || undefined, limit: 48 }, signal),
    [active, query],
  );

  return (
    <div className="pt-6 md:pt-10">
      <h1 className="text-display-lg mb-5">Explore</h1>

      <Field
        type="search"
        placeholder="search tokens, creators…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        prefix="🔍"
        className="max-w-[520px]"
      />

      <div className="flex items-center gap-2 -mt-2 mb-5 overflow-x-auto scrollbar-none pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActive(f.key)}
            className={cx(
              'h-9 px-4 rounded-pill text-[13px] font-bold whitespace-nowrap shrink-0',
              'transition-[background-color,color,box-shadow] duration-base ease-out-soft',
              active === f.key
                ? f.key === 'mayhem'
                  ? 'bg-grad-mayhem bg-[length:300%_100%] animate-mayhem text-white shadow-[0_3px_0_var(--wild-600)]'
                  : 'bg-accent text-[var(--text-on-primary)] shadow-[0_3px_0_var(--accent-deep)]'
                : 'bg-surface text-ink3 hover:text-ink shadow-hairline',
            )}
          >
            {f.label}
          </button>
        ))}

        <div className="ml-auto flex gap-1 shrink-0">
          {[['grid', '▦'], ['list', '☰']].map(([key, glyph]) => (
            <button
              key={key}
              onClick={() => setLayout(key)}
              aria-label={key === 'grid' ? 'Grid view' : 'List view'}
              aria-pressed={layout === key}
              className={cx('w-9 h-9 rounded-md text-[15px] transition-colors',
                layout === key ? 'bg-accent-soft text-ink' : 'text-ink3 hover:text-ink')}
            >
              {glyph}
            </button>
          ))}
        </div>
      </div>

      {active === 'almost' && (
        <p className="text-caption text-ink3 mb-4 -mt-2">
          Tokens past 85% of the curve. The most adrenaline in the house.
        </p>
      )}

      {list.error ? (
        <ErrorNote onRetry={list.reload}>{list.error}</ErrorNote>
      ) : list.loading ? (
        <CardGridSkeleton count={9} />
      ) : !list.data?.length ? (
        <EmptyState
          mood="carry"
          title={query ? 'Nothing here' : 'That filter is too tight'}
          body={query
            ? `Nobody has lit "${query}" yet. Want to be first?`
            : 'No token matches that right now.'}
          action={query
            ? <Button onClick={() => navigate('/create')}>Light ${query.toUpperCase()}</Button>
            : <Button variant="secondary" onClick={() => { setActive('movers'); setQuery(''); }}>Clear filters</Button>}
        />
      ) : (
        <div className={layout === 'grid'
          ? 'grid [grid-template-columns:repeat(auto-fill,minmax(268px,1fr))] gap-4'
          : 'bg-surface border border-subtle rounded-xl divide-y divide-subtle'}>
          {list.data.map((token) => (
            <TokenCard
              key={token.address}
              token={token}
              variant={layout === 'grid' ? 'grid' : 'mini'}
            />
          ))}
        </div>
      )}
    </div>
  );
}
