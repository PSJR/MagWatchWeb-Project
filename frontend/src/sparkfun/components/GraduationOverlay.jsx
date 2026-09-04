import React, { useEffect, useRef, useState } from 'react';
import { Button, cx } from './ui';
import { Ember } from './mascots';
import { useCelebration } from './Celebration';
import { money, truncAddress } from '../lib/format';

/**
 * Graduation — the most important moment in the brand. Four phases over 6s,
 * skippable with Esc or a tap at any time (design/06-motion.md § 6).
 * Under reduced motion it renders phase 3 immediately, with no sequence.
 */
const PHASES = [
  { at: 0, key: 'tension' },
  { at: 1200, key: 'explosion' },
  { at: 3000, key: 'flame' },
  { at: 5000, key: 'rest' },
];

export default function GraduationOverlay({ token, plan, onDone }) {
  const { burst } = useCelebration();
  const [phase, setPhase] = useState('tension');
  const rootRef = useRef(null);
  const reduced = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reduced) { setPhase('rest'); return undefined; }
    const timers = PHASES.map((p) => setTimeout(() => {
      setPhase(p.key);
      if (p.key === 'explosion' && rootRef.current) {
        burst(rootRef.current, { tone: 'graduation', count: 160 });
      }
    }, p.at));
    return () => timers.forEach(clearTimeout);
  }, [burst, reduced]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onDone();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  const showCard = phase === 'flame' || phase === 'rest';

  return (
    <div
      ref={rootRef}
      onClick={onDone}
      role="dialog"
      aria-modal="true"
      aria-label={`${token.ticker} graduated`}
      className={cx(
        'fixed inset-0 z-[800] grid place-items-center p-6 text-center transition-colors duration-slow',
        phase === 'tension' ? 'bg-[rgba(46,32,25,.55)]' : 'bg-[rgba(46,32,25,.86)]',
      )}
    >
      {phase !== 'tension' && (
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-grad-bonfire opacity-25 animate-spin12 pointer-events-none"
        />
      )}

      <div className="relative max-w-[440px] w-full">
        <Ember
          size={phase === 'tension' ? 90 : 150}
          mood="cheer"
          className={cx('mx-auto transition-all duration-slower ease-pop',
            phase !== 'tension' && 'animate-bob')}
        />

        <h2
          className={cx('text-display-hero text-cream-50 mt-4 transition-all duration-slower ease-pop',
            phase === 'tension' ? 'opacity-0 scale-90' : 'opacity-100 scale-100')}
        >
          ${token.ticker} GRADUATED
        </h2>
        <p className="text-cream-50/80 mt-2">It lit the big bonfire.</p>

        <div
          className={cx('bg-gold-100 rounded-2xl p-5 mt-7 text-left transition-all duration-slower ease-out-soft',
            showCard ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6')}
        >
          <p className="text-[13px] text-gold-800 font-semibold">
            ✅ Pool created on Uniswap V3 · Robinhood Chain
          </p>
          <p className="text-[13px] text-gold-800 font-semibold mt-1">
            🔒 Liquidity locked forever
          </p>
          <dl className="num text-caption text-cocoa-800 mt-3 space-y-1">
            <div className="flex justify-between gap-3">
              <dt>Pool</dt><dd>{truncAddress(token.pool_address, 8, 6)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Liquidity</dt><dd>{money(plan?.quote_liquidity || token.raised, token.pair)} + 200M ${token.ticker}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Range</dt><dd>full-range</dd>
            </div>
          </dl>
        </div>

        <div className={cx('flex gap-2 justify-center mt-5 transition-opacity duration-slow',
          phase === 'rest' ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
          <Button
            variant="gold"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`https://app.uniswap.org/swap?chain=4663&outputCurrency=${token.address}`, '_blank', 'noopener');
            }}
          >
            Trade on Uniswap V3
          </Button>
          <Button variant="secondary" onClick={onDone}>Back</Button>
        </div>

        <p className="text-caption text-cream-50/50 mt-6">tap or press Esc to skip</p>
      </div>
    </div>
  );
}
