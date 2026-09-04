import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TokenCard from '../components/TokenCard';
import WalletCard from '../components/WalletCard';
import LiveFeed from '../components/LiveFeed';
import { Button, CountUp, EmptyState, ErrorNote, Skeleton, cx } from '../components/ui';
import { Pip } from '../components/mascots';
import { useWallet } from '../hooks/useWallet';
import { useAsync } from '../hooks/useLive';
import { api } from '../lib/api';
import { joinedOn, money, pct, relTime, tokenAmount, truncAddress } from '../lib/format';

/**
 * Platform- and account-level totals sum trades across ETH- and USDC-paired
 * tokens, which have no common denominator until there is an ETH/USD feed.
 * They are labelled in ETH because ETH is the chain's gas token and the
 * default pair; a mixed-pair account will read slightly high until the feed
 * lands. This is a known gap, not a rounding choice.
 */


const BADGES = {
  early_adopter:  { label: 'Early Adopter', icon: '🌱', how: 'Among the first 10,000 in the house' },
  top_trader_day: { label: 'Top Trader Today', icon: '🏆', how: '#1 in PnL over the last 24h' },
  top_trader_week:{ label: 'Top Trader This Week', icon: '👑', how: '#1 in PnL over the last 7 days' },
  mayhem_survivor:{ label: 'Mayhem Survivor', icon: '🔥', how: 'Profit on 3 Mayhem tokens' },
  sniper:         { label: 'Sniper', icon: '🎯', how: 'Bought 5 graduates in their first minute' },
  diamond_hands:  { label: 'Diamond Hands', icon: '💎', how: 'Held a token for 30 days' },
  full_hearth:    { label: 'Full Hearth', icon: '🪵', how: 'Bought 10 tokens that graduated' },
  host:           { label: 'Host', icon: '🏠', how: '100 days in a row here' },
  patient:        { label: 'Patient', icon: '☕', how: '7 days without selling through a hard drop' },
};

const MOODS = ['😌', '🔥', '🤔', '😤', '🥳', '😴'];

const THEMES = {
  hearth: 'bg-grad-hearth', dusk: 'bg-grad-dusk',
  dawn: 'bg-[linear-gradient(180deg,#FFE9D0,#FFC0CF)]',
  snow: 'bg-[linear-gradient(180deg,#E8F4FF,#D7F5F3)]',
  forest: 'bg-[linear-gradient(180deg,#CDF3E2,#9BE7C4)]',
  wildfire: 'bg-grad-mayhem bg-[length:300%_100%] animate-mayhem',
};

const TABS = [
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'history', label: 'History' },
  { key: 'favorites', label: 'Favourites' },
  { key: 'activity', label: 'Activity' },
];

/** Renders both /me (private) and /u/:handle (public) — one component, two lenses. */
export default function Profile({ own = false }) {
  const { handle: routeHandle } = useParams();
  const { user, openWalletDialog } = useWallet();
  const handle = own ? user?.handle : routeHandle;

  const [tab, setTab] = useState('portfolio');
  const [mood, setMood] = useState(null);

  const profile = useAsync(
    (signal) => (handle ? api.profile(handle, signal) : Promise.resolve(null)),
    [handle],
  );
  const portfolio = useAsync(
    () => (own && user ? api.portfolio() : Promise.resolve(null)),
    [own, user?.id],
  );
  const history = useAsync(
    () => (own && user && tab === 'history' ? api.history({ limit: 100 }) : Promise.resolve(null)),
    [own, user?.id, tab],
  );
  const favorites = useAsync(
    () => (own && user && tab === 'favorites' ? api.favorites() : Promise.resolve(null)),
    [own, user?.id, tab],
  );
  // Public profiles lead with activity, so it loads immediately there; on the
  // private profile it waits for the tab.
  const activity = useAsync(
    () => (handle && (!own || tab === 'activity') ? api.activity(handle) : Promise.resolve(null)),
    [handle, own, tab],
  );

  if (own && !user) {
    return (
      <div className="pt-16">
        <EmptyState
          title="Sign in to see your profile"
          body="Your wallet, your portfolio and your campfire live here."
          action={<Button onClick={openWalletDialog}>Connect wallet</Button>}
        />
      </div>
    );
  }

  if (profile.loading) return <ProfileSkeleton />;
  if (profile.error) return <div className="pt-10"><ErrorNote onRetry={profile.reload}>{profile.error}</ErrorNote></div>;
  const p = profile.data;
  if (!p) return null;

  const pnl = p.pnl_pct ?? 0;
  const currentMood = mood || p.mood;
  const theme = THEMES[p.banner_theme] || THEMES.hearth;

  return (
    <div className="pt-6 md:pt-10">
      <header className={cx('relative rounded-3xl overflow-hidden px-6 pt-8 pb-6 md:px-10', theme)}>
        <Pip
          seed={p.address || p.handle}
          size={104}
          pnl={pnl}
          className="absolute right-4 top-4 md:right-10 animate-bob pointer-events-none"
        />

        <div className="relative">
          <h1 className="text-display-md text-cocoa-900">@{p.handle}</h1>
          {p.address && (
            <button
              onClick={() => navigator.clipboard?.writeText(p.address)}
              className="num text-caption text-cocoa-800/70 hover:text-cocoa-900 mt-1"
              title="Copy address"
            >
              {truncAddress(p.address)} ⧉
            </button>
          )}
          <p className="text-caption text-cocoa-800/70 mt-1">
            here since {joinedOn(p.created_at)}
          </p>

          {p.badges?.length > 0 && (
            <ul className="flex gap-2 flex-wrap mt-4">
              {p.badges.map((key) => {
                const b = BADGES[key];
                if (!b) return null;
                return (
                  <li key={key}>
                    <span
                      title={b.how}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-pill
                                 bg-cream-50/75 text-cocoa-900 text-caption font-bold
                                 transition-transform duration-base ease-pop hover:-translate-y-0.5 hover:rotate-[8deg]"
                    >
                      <span aria-hidden="true">{b.icon}</span> {b.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {own && (
            <div className="flex items-center gap-1.5 mt-4">
              <span className="text-caption text-cocoa-800/70 mr-1">today's mood:</span>
              {MOODS.map((m) => (
                <button
                  key={m}
                  onClick={() => { setMood(m); api.updateMe({ mood: m }).catch(() => {}); }}
                  aria-label={`Set mood ${m}`}
                  className={cx('w-9 h-9 rounded-pill text-[17px] transition-transform duration-base ease-pop',
                    currentMood === m ? 'scale-125 bg-cream-50/70' : 'opacity-60 hover:opacity-100')}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
        <StatCard
          label="Total invested"
          value={p.total_invested}
          format={(v) => money(v, 'ETH')}
          hidden={p.total_invested === null}
          sub={`across ${p.tokens_bought} tokens`}
        />
        <StatCard
          label="Total PnL"
          value={p.pnl_abs}
          format={(v) => money(v, 'ETH')}
          hidden={p.pnl_abs === null}
          tone={pnl >= 0 ? 'up' : 'down'}
          sub={`${pnl >= 0 ? '▲' : '▼'} ${pct(pnl, { sign: false })}`}
        />
        <StatCard label="Graduates I caught early" value={p.early_graduates} sub="in the first minute" />
        <StatCard label="Rank" value={p.rank} format={(v) => (v ? `#${Math.round(v)}` : '—')} sub="on the leaderboard" />
      </div>

      {own && (
        <>
          <nav className="flex gap-1 mt-8 mb-4 border-b border-subtle overflow-x-auto scrollbar-none" role="tablist">
            {TABS.map((item) => (
              <button
                key={item.key}
                role="tab"
                aria-selected={tab === item.key}
                onClick={() => setTab(item.key)}
                className={cx('relative h-10 px-4 text-[14px] font-semibold whitespace-nowrap transition-colors',
                  tab === item.key ? 'disp text-ink' : 'text-ink3 hover:text-ink')}
              >
                {item.label}
                {tab === item.key && <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-pill bg-accent" />}
              </button>
            ))}
          </nav>

          {tab === 'portfolio' && <Portfolio rows={portfolio.data} loading={portfolio.loading} />}
          {tab === 'history' && <History rows={history.data} />}
          {tab === 'favorites' && <Favorites rows={favorites.data} />}
          {tab === 'activity' && <Activity rows={activity.data} />}

          <WalletCard />
        </>
      )}

      {!own && (
        <div className="mt-8">
          <h2 className="overline mb-3">Activity</h2>
          <Activity rows={activity.data} />
          {p.is_creator && (
            <Link
              to={`/c/${p.handle}`}
              className="inline-flex items-center gap-2 mt-6 h-11 px-4 rounded-lg bg-surface
                         shadow-hairline font-semibold text-[14px] hover:shadow-sm"
            >
              🪵 See creator profile
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, format, sub, tone, hidden }) {
  return (
    <div className="bg-surface border border-subtle rounded-xl p-4">
      <p className="text-caption uppercase tracking-[.08em] text-ink3">{label}</p>
      <p className={cx('num text-[26px] font-medium mt-2 leading-none',
        tone === 'up' && 'text-mint-800', tone === 'down' && 'text-coral-800')}>
        {hidden ? <span className="text-ink3">private</span>
          : <CountUp value={Number(value) || 0} format={format} />}
      </p>
      {sub && <p className="text-caption text-ink3 mt-1.5">{sub}</p>}
    </div>
  );
}

function Portfolio({ rows, loading }) {
  if (loading) return <Skeleton className="h-40 w-full" rounded="rounded-xl" />;
  if (!rows?.length) {
    return (
      <EmptyState
        title="Your wallet is brand new"
        body="Nothing lit yet. The campfire is right there."
        action={<Link to="/explore"><Button variant="secondary">Explore tokens</Button></Link>}
      />
    );
  }

  return (
    <ul className="bg-surface border border-subtle rounded-xl divide-y divide-subtle">
      {rows.map((p) => (
        <li key={p.token.address} className="flex items-center gap-3 p-3">
          <TokenCard token={p.token} variant="mini" className="flex-1 min-w-0 !p-0" />
          <div className="text-right shrink-0">
            <p className="num text-[14px] font-medium">{money(p.value, p.token.pair)}</p>
            <p className={cx('num text-caption', p.pnl >= 0 ? 'text-mint-800' : 'text-coral-800')}>
              {p.pnl >= 0 ? '▲' : '▼'} {pct(p.pnl_pct, { sign: false })}
            </p>
          </div>
          <Link to={`/t/${p.token.address}`} className="shrink-0">
            <Button size="sm" variant="secondary">Sell</Button>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function History({ rows }) {
  if (!rows) return <Skeleton className="h-40 w-full" rounded="rounded-xl" />;
  if (!rows.length) return <EmptyState mood="sleepy" title="No trades yet" body="When you buy something, it shows up here." />;
  return <LiveFeed trades={rows} />;
}

function Favorites({ rows }) {
  if (!rows) return <Skeleton className="h-40 w-full" rounded="rounded-xl" />;
  if (!rows.length) {
    return <EmptyState title="No favourites yet" body="Tap the ♡ on any token to keep it here." />;
  }
  return (
    <div className="grid [grid-template-columns:repeat(auto-fill,minmax(268px,1fr))] gap-4">
      {rows.map((t) => <TokenCard key={t.address} token={t} favorited />)}
    </div>
  );
}

function Activity({ rows }) {
  if (!rows) return <Skeleton className="h-32 w-full" rounded="rounded-xl" />;
  if (!rows.length) return <EmptyState mood="sleepy" title="Nothing here yet" body="Recent actions show up along this line." />;

  return (
    <ol className="relative pl-6 space-y-3 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-subtle">
      {rows.map((e, i) => (
        <li key={i} className="relative">
          <span
            aria-hidden="true"
            className={cx('absolute -left-[22px] top-1.5 w-3.5 h-3.5 rounded-pill border-2 border-canvas',
              e.kind === 'created' ? 'bg-accent' : e.data.side === 'buy' ? 'bg-mint-500' : 'bg-coral-500')}
          />
          <p className="text-[14px] text-ink2">
            {e.kind === 'created' ? (
              <>lit <Link to={`/t/${e.data.address}`} className="disp text-ink hover:underline">${e.data.ticker}</Link></>
            ) : (
              <>
                {e.data.side === 'buy' ? 'bought' : 'sold'}{' '}
                <Link to={`/t/${e.data.token_address}`} className="disp text-ink hover:underline">${e.data.ticker}</Link>
                {' · '}<span className="num text-caption text-ink3">{tokenAmount(e.data.base)}</span>
              </>
            )}
          </p>
          <p className="text-caption text-ink3">{relTime(e.ts)}</p>
        </li>
      ))}
    </ol>
  );
}

function ProfileSkeleton() {
  return (
    <div className="pt-10 space-y-6">
      <Skeleton className="h-44 w-full" rounded="rounded-3xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" rounded="rounded-xl" />)}
      </div>
    </div>
  );
}
