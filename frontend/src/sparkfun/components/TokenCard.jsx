import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import CurveProgress from './CurveProgress';
import { Tag, cx } from './ui';
import { Ember } from './mascots';
import { money, pct, relTime } from '../lib/format';
import { useCelebration } from './Celebration';

/**
 * The most important component in the product: it appears on Home, Explore,
 * the portfolio and the creator profile. The progress ring around the image
 * is the peripheral read — you see how hot a token is without reading a number.
 */
export default function TokenCard({
  token, variant = 'grid', favorited = false, onFavorite, flash, className = '',
}) {
  const { burst } = useCelebration();
  const favRef = useRef(null);
  const [fav, setFav] = useState(favorited);

  const dead = token.status === 'dead';
  const graduated = token.status === 'graduated';
  const fresh = Date.now() - Date.parse(token.created_at) < 10 * 60 * 1000;
  const change = token.change_24h;

  const handleFav = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !fav;
    setFav(next);
    if (next) burst(favRef.current, { tone: 'guava', count: 7 });
    onFavorite?.(token.address, next);
  };

  if (variant === 'mini') {
    return (
      <Link
        to={`/t/${token.address}`}
        className={cx('flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface transition-colors', className)}
      >
        <TokenAvatar token={token} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block disp text-[14px] truncate">${token.ticker}</span>
          <span className="block num text-caption text-ink3">{money(token.market_cap, token.pair)}</span>
        </span>
        {Number.isFinite(change) && (
          <span className={cx('num text-num-sm', change >= 0 ? 'text-mint-800' : 'text-coral-800')}>
            {change >= 0 ? '▲' : '▼'} {pct(change, { sign: false })}
          </span>
        )}
      </Link>
    );
  }

  return (
    <Link
      to={`/t/${token.address}`}
      className={cx(
        'group relative block rounded-xl border p-4 overflow-hidden',
        'transition-[transform,box-shadow,border-color] duration-base ease-out-soft',
        'hover:-translate-y-[3px] hover:shadow-md active:translate-y-0',
        dead ? 'bg-grad-ash border-ash-100 saturate-[.25] shadow-none'
             : graduated ? 'bg-raised border-gold-600 shadow-[0_0_0_3px_rgba(255,194,77,.22),var(--shadow-sm)]'
             : 'bg-raised border-subtle shadow-sm hover:border-strong',
        className,
      )}
      style={flash ? { animation: 'heat-fade 1.2s linear forwards', '--flash-color': flash === 'buy' ? 'var(--mint-100)' : 'var(--coral-100)' } : undefined}
    >
      <div className="flex items-start gap-3">
        <TokenAvatar token={token} size={56} />

        <div className="min-w-0 flex-1">
          <div className="disp text-heading-md leading-tight truncate">${token.ticker}</div>
          <div className="text-caption text-ink3 truncate mt-0.5">
            {token.name} · por @{token.creator_handle} · {relTime(token.created_at)}
          </div>
        </div>

        <button
          ref={favRef}
          type="button"
          onClick={handleFav}
          aria-pressed={fav}
          aria-label={fav ? `Desfavoritar ${token.ticker}` : `Favoritar ${token.ticker}`}
          className={cx('shrink-0 -mt-1 -mr-1 p-1.5 rounded-md text-lg leading-none',
            'transition-transform duration-base ease-pop hover:scale-110',
            fav ? 'text-coral-600 scale-110' : 'text-ink3')}
        >
          {fav ? '♥' : '♡'}
        </button>
      </div>

      <div className="flex items-center gap-2.5 mt-3.5 mb-2.5">
        <span className="num text-num-md font-medium">{money(token.market_cap, token.pair)}</span>
        {Number.isFinite(change) && (
          <span className={cx('num text-num-sm font-medium', change >= 0 ? 'text-mint-800' : 'text-coral-800')}>
            {change >= 0 ? '▲' : '▼'} {pct(change, { sign: false })}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          {fresh && !dead && !graduated && <Tag tone="new">Novo</Tag>}
          {token.mayhem && <Tag tone="mayhem">Mayhem</Tag>}
          {graduated && <Tag tone="graduated">Graduado</Tag>}
          {dead && <Tag tone="dead">Brasa</Tag>}
        </span>
      </div>

      <CurveProgress
        progress={token.progress}
        toGraduate={token.to_graduate}
        pair={token.pair}
        size="sm"
        showLabels={false}
      />

      <div className="flex items-center justify-between gap-2 mt-2 text-caption text-ink3">
        <span className="min-w-0 truncate">
          {graduated ? '🔒 liquidez travada · Uniswap V3'
            : dead ? 'a fogueira apagou'
            : `${Math.round(token.progress * 100)}% da fogueira 🔥`}
        </span>
        <span className="num shrink-0 whitespace-nowrap">
          vol {money(token.volume_24h, token.pair)}
        </span>
      </div>
    </Link>
  );
}

export function TokenAvatar({ token, size = 56, ring = true }) {
  const pctDone = Math.max(0, Math.min(1, token.progress || 0));
  const graduated = token.status === 'graduated';
  const inner = size - 8;

  return (
    <span
      className="relative shrink-0 grid place-items-center rounded-[30%]"
      style={{
        width: size,
        height: size,
        background: ring
          ? `conic-gradient(${graduated ? 'var(--gold-500)' : 'var(--ember-500)'} ${pctDone * 360}deg, var(--border-subtle) 0deg)`
          : 'transparent',
      }}
    >
      <span
        className="grid place-items-center overflow-hidden bg-ember-100 rounded-[28%]"
        style={{ width: inner, height: inner }}
      >
        {token.image_url ? (
          <img
            src={token.image_url}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-base ease-out-soft group-hover:scale-105"
          />
        ) : (
          <Ember size={inner * 0.78} />
        )}
      </span>
    </span>
  );
}
