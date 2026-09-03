import React from 'react';
import { Link } from 'react-router-dom';
import { cx } from './ui';
import { money, relTime, tokenAmount } from '../lib/format';

/**
 * The heat trail: each row lands with the direction's colour behind it and
 * fades to transparent over 1.2s, so a busy token visibly runs warm.
 */
export default function LiveFeed({ trades = [], showToken = true, className = '', emptyLabel = 'Silêncio total por aqui.' }) {
  if (!trades.length) {
    return <p className={cx('text-caption text-ink3 py-6 text-center', className)}>{emptyLabel}</p>;
  }

  return (
    <ul className={cx('divide-y divide-subtle', className)}>
      {trades.map((t) => (
        <li
          key={t.id}
          className="flex items-center gap-3 py-2.5 px-1 rounded-md"
          style={{
            animation: 'heat-fade 1.2s linear forwards',
            '--flash-color': t.side === 'buy' ? 'var(--mint-100)' : 'var(--coral-100)',
          }}
        >
          <span
            className={cx('w-1.5 h-8 rounded-pill shrink-0',
              t.side === 'buy' ? 'bg-mint-500' : 'bg-coral-500')}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 text-[13px]">
            <span className="text-ink font-semibold">@{t.handle}</span>{' '}
            <span className={t.side === 'buy' ? 'text-mint-800' : 'text-coral-800'}>
              {t.side === 'buy' ? 'comprou' : 'vendeu'}
            </span>{' '}
            {showToken && (
              <Link to={`/t/${t.token_address}`} className="disp text-ink hover:underline">
                ${t.ticker}
              </Link>
            )}
            <span className="block num text-caption text-ink3">
              {tokenAmount(t.base)} · {money(t.quote, t.pair || 'ETH')}
            </span>
          </span>
          <span className="num text-caption text-ink3 shrink-0">{relTime(t.ts)}</span>
        </li>
      ))}
    </ul>
  );
}
