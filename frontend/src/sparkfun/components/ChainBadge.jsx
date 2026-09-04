import React, { useEffect, useState } from 'react';
import { CHAIN } from '../lib/chain';
import { cx } from './ui';
import { Ember } from './mascots';

/**
 * The network seal. Its dot pulses on the chain's heartbeat — but grouped one
 * pulse per ten blocks (~1Hz), never 10Hz, which would be a strobe and a
 * photosensitivity hazard (design/09 § 3).
 */
export default function ChainBadge({ compact = false, className = '' }) {
  const [blocks, setBlocks] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return undefined;
    const id = setInterval(() => setBlocks((b) => b + 10), CHAIN.blockTimeMs * 10);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      data-chain-badge
      title={`${CHAIN.name} · ${CHAIN.stack} · a block every ~${CHAIN.blockTimeMs}ms`}
      className={cx(
        'inline-flex items-center gap-2 rounded-pill px-3 py-1.5 shadow-hairline',
        'bg-orbit-100 text-orbit-700 text-[12px] font-semibold whitespace-nowrap',
        className,
      )}
    >
      <span className="w-[7px] h-[7px] rounded-pill bg-orbit-500 animate-beat" aria-hidden="true" />
      {compact ? CHAIN.id : <>Robinhood Chain · {CHAIN.id}</>}
      <span className="sr-only">
        Connected to {CHAIN.name}, id {CHAIN.id}. {blocks} blocks this session.
      </span>
    </span>
  );
}

/** Gas is near-free here, and the mascot says so without an alarm. */
export function GasPill({ gwei = 0.001, className = '' }) {
  return (
    <span
      className={cx('inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1.5',
        'bg-surface shadow-hairline text-caption text-ink3 whitespace-nowrap', className)}
      title="Gas on Robinhood Chain — paid in ETH"
    >
      <Ember size={16} mood="blow" aria-hidden="true" />
      <span className="num">~${gwei.toFixed(3)}</span>
    </span>
  );
}
